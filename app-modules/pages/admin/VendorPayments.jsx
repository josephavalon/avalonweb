import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FilePlus2,
  Landmark,
  Loader2,
  LockKeyhole,
  PackageCheck,
  PauseCircle,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, authedFetch } from '@/lib/apiClient';

const INPUT = 'min-h-11 w-full rounded-xl border border-foreground/10 bg-background px-3 text-sm outline-none transition focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-45';
const BUTTON = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.13em] transition disabled:cursor-not-allowed disabled:opacity-35';
const BIGINT_ZERO = BigInt(0);
const CENTS_PER_DOLLAR = BigInt(100);
const today = new Date().toISOString().slice(0, 10);
const dueDefault = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);

function idempotencyKey(action, id = 'new') {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `vendor-ap-ui:${action}:${id}:${nonce}`;
}

function statusLabel(value) {
  return String(value || 'UNKNOWN').replaceAll('_', ' ');
}

function money(value, currency = 'USD') {
  try {
    const cents = BigInt(String(value ?? '0'));
    const sign = cents < BIGINT_ZERO ? '-' : '';
    const absolute = cents < BIGINT_ZERO ? -cents : cents;
    const prefix = currency === 'USD' ? '$' : `${currency} `;
    return `${sign}${prefix}${(absolute / CENTS_PER_DOLLAR).toLocaleString()}.${String(absolute % CENTS_PER_DOLLAR).padStart(2, '0')}`;
  } catch {
    return 'Unavailable';
  }
}

function dollarsToCents(value) {
  const clean = String(value ?? '').trim().replaceAll(',', '');
  if (!/^\d+(?:\.\d{0,2})?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.split('.');
  const cents = (BigInt(whole) * CENTS_PER_DOLLAR) + BigInt(fraction.padEnd(2, '0') || '0');
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

function dateTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function statusTone(status, canonicalSettled = false) {
  if (canonicalSettled) return 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-700';
  if (['HELD', 'ACTION_REQUIRED', 'RECONCILIATION_REQUIRED', 'CANCELLED', 'FAILED', 'DEAD_LETTER'].includes(status)) {
    return 'border-red-500/25 bg-red-500/[0.06] text-red-700';
  }
  if (['MATCHED', 'READY', 'CHECKER_APPROVED'].includes(status)) {
    return 'border-blue-500/25 bg-blue-500/[0.06] text-blue-700';
  }
  return 'border-amber-500/25 bg-amber-500/[0.06] text-amber-800';
}

function StatusPill({ status, canonicalSettled = false }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${statusTone(status, canonicalSettled)}`}>
      {canonicalSettled ? 'Settled + reconciled' : statusLabel(status)}
    </span>
  );
}

function Field({ label, detail, children }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/42">{label}</span>
      {children}
      {detail ? <span className="mt-1 block leading-relaxed text-foreground/40">{detail}</span> : null}
    </label>
  );
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <article className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/40">{label}</p>
        <Icon className="h-4 w-4 text-foreground/35" strokeWidth={1.8} />
      </div>
      <p className="mt-4 font-heading text-3xl uppercase leading-none sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-foreground/48">{detail}</p>
    </article>
  );
}

function FormPanel({ title, description, icon: Icon, children, open = false }) {
  return (
    <details open={open} className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-4">
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span className="rounded-xl border border-foreground/10 bg-background p-2"><Icon className="h-4 w-4 text-foreground/50" /></span>
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-foreground/45">{description}</span>
        </span>
      </summary>
      <div className="mt-4 border-t border-foreground/10 pt-4">{children}</div>
    </details>
  );
}

function validPayload(payload) {
  const data = payload?.data;
  return payload?.status === 'AVAILABLE'
    && data
    && Array.isArray(data.profiles)
    && Array.isArray(data.bills)
    && Array.isArray(data.payments)
    && Array.isArray(data.catalogs?.vendors)
    && Array.isArray(data.catalogs?.legalEntities)
    && Array.isArray(data.catalogs?.purchaseOrders)
    && Array.isArray(data.catalogs?.purchaseOrderLines)
    && payload.capabilities
    && Array.isArray(payload.capabilities.roles);
}

export default function VendorPayments() {
  const [state, setState] = useState({ loading: true, error: '', code: '', payload: null, busy: '' });
  const [selectedBillId, setSelectedBillId] = useState('');
  const [profileForm, setProfileForm] = useState({
    inventoryVendorId: '', legalEntityId: '', legalName: '', taxClassification: 'LLC',
    providerRecipientId: '', destinationMaskedLabel: '',
  });
  const [reviewForm, setReviewForm] = useState({
    profileId: '', taxReportingStatus: 'READY', w9Status: 'VERIFIED',
    tinMatchStatus: 'MATCHED', paymentReadiness: 'READY', reasonCode: 'VENDOR_DUE_DILIGENCE_COMPLETE',
  });
  const [billForm, setBillForm] = useState({
    profileId: '', purchaseOrderId: '', billNumber: '', invoiceDate: today, dueDate: dueDefault,
    taxAmount: '0.00', shippingAmount: '0.00', sourceDocumentRef: '', sourceDocumentChecksum: '',
  });
  const [lineForm, setLineForm] = useState({
    purchaseOrderLineId: '', lineType: 'INVENTORY', lineCode: 'SUPPLY_ITEM', quantity: '1', unitAmount: '0.00',
  });
  const [matchForm, setMatchForm] = useState({ exceptionCode: 'NON_PO_SERVICE_REVIEWED' });
  const [approvalForm, setApprovalForm] = useState({
    fundingAccountRef: '', fundingAccountMaskedLabel: '', makerReason: 'VENDOR_BILL_REVIEWED',
    checkerReason: 'VENDOR_PAYMENT_APPROVED', executorReason: 'VENDOR_PAYMENT_QUEUE_AUTHORIZED',
  });
  const [controlForm, setControlForm] = useState({ holdReason: 'MANUAL_REVIEW_REQUIRED', cancelReason: 'VENDOR_BILL_CANCELLED' });
  const [settlementForm, setSettlementForm] = useState({
    evidenceSource: 'PROVIDER_CONFIRMED', financeIntegrationEventId: '', bankStatementItemId: '',
    providerTransactionId: '', evidenceRef: '', reasonCode: 'VENDOR_PAYMENT_RECONCILED',
  });

  const load = useCallback(async (preferredBillId = '') => {
    setState((current) => ({ ...current, loading: true, error: '', code: '' }));
    try {
      let activeBillId = preferredBillId;
      let payload = await apiGet(`/api/admin/vendor-bills?limit=100${activeBillId ? `&billId=${encodeURIComponent(activeBillId)}` : ''}`);
      if (!validPayload(payload)) throw new Error('Vendor AP returned an invalid controlled response.');
      if (!activeBillId && payload.data.bills.length) {
        activeBillId = payload.data.bills[0].id;
        payload = await apiGet(`/api/admin/vendor-bills?limit=100&billId=${encodeURIComponent(activeBillId)}`);
        if (!validPayload(payload) || !payload.data.detail) throw new Error('Vendor AP bill evidence is unavailable.');
      }
      setSelectedBillId(activeBillId);
      setState({ loading: false, error: '', code: '', payload, busy: '' });
    } catch (error) {
      setState((current) => ({
        loading: false,
        error: error.message || 'Vendor AP is unavailable.',
        code: error.body?.code || '',
        payload: current.payload,
        busy: '',
      }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const perform = async (key, path, body, {
    billId = selectedBillId,
    confirmMessage = '',
    after,
  } = {}) => {
    if (confirmMessage && globalThis.confirm?.(confirmMessage) === false) return;
    setState((current) => ({ ...current, busy: key, error: '', code: '' }));
    try {
      const result = await authedFetch(path, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(key, billId || 'new') },
        body: JSON.stringify(body),
      });
      if (after) after(result);
      const nextBillId = result?.bill?.id || billId;
      await load(nextBillId);
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        busy: '',
        error: error.message || 'The controlled Vendor AP action could not be completed.',
        code: error.body?.code || '',
      }));
    }
  };

  const payload = state.payload;
  const data = payload?.data;
  const capabilities = payload?.capabilities || {};
  const catalogs = data?.catalogs || { vendors: [], legalEntities: [], purchaseOrders: [], purchaseOrderLines: [] };
  const profiles = data?.profiles || [];
  const bills = data?.bills || [];
  const payments = data?.payments || [];
  const detail = data?.detail || null;
  const selectedBill = bills.find((row) => row.id === selectedBillId) || null;
  const selectedPayment = selectedBill ? payments.find((row) => row.vendorBillId === selectedBill.id) || null : null;
  const selectedProfile = selectedBill ? profiles.find((row) => row.id === selectedBill.vendorFinanceProfileId) || null : null;
  const vendorById = useMemo(() => new Map((catalogs.vendors || []).map((row) => [row.id, row])), [catalogs.vendors]);
  const entityById = useMemo(() => new Map((catalogs.legalEntities || []).map((row) => [row.id, row])), [catalogs.legalEntities]);
  const profileById = useMemo(() => new Map(profiles.map((row) => [row.id, row])), [profiles]);
  const paymentByBill = useMemo(() => new Map(payments.map((row) => [row.vendorBillId, row])), [payments]);
  const formProfile = profileById.get(billForm.profileId);
  const profilePurchaseOrders = catalogs.purchaseOrders.filter((row) => (
    !formProfile || row.vendorId === formProfile.inventoryVendorId
  ));
  const selectedPoLines = catalogs.purchaseOrderLines.filter((row) => row.purchaseOrderId === selectedBill?.purchaseOrderId);
  const selectedCatalogLine = selectedPoLines.find((row) => row.id === lineForm.purchaseOrderLineId) || null;
  const canonicalSettlement = selectedPayment?.canonicalSettled === true;

  const metrics = useMemo(() => ({
    obligations: bills.filter((row) => !['SETTLED', 'CANCELLED'].includes(row.status)).reduce((sum, row) => sum + BigInt(row.totalCents || '0'), BIGINT_ZERO),
    queued: payments.filter((row) => ['COMMAND_QUEUED', 'PROVIDER_PENDING'].includes(row.status)).length,
    held: bills.filter((row) => row.status === 'HELD').length,
    settled: payments.filter((payment) => payment.canonicalSettled === true).length,
  }), [bills, payments]);

  if (state.loading && !payload) {
    return <AdminShell title="Vendor Payments"><div className="flex min-h-[28rem] items-center justify-center text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div></AdminShell>;
  }
  if (!payload) {
    return (
      <AdminShell title="Vendor Payments">
        <OperationalSourceUnavailable
          title={state.code === 'finance_permission_required' ? 'Finance role required' : 'Vendor AP unavailable'}
          description={state.code === 'finance_permission_required'
            ? 'An active Finance role is required. Admin access alone does not grant permission to view or authorize vendor payments.'
            : `${state.error || 'The Vendor AP source could not be verified.'} No sample obligations, zero balances, or paid claims are shown.`}
        />
      </AdminShell>
    );
  }

  const createProfile = (event) => {
    event.preventDefault();
    perform('create-profile', '/api/admin/vendor-bills', {
      action: 'create_profile',
      ...profileForm,
      destinationProvider: 'mercury',
    }, { billId: '' });
  };

  const reviewProfile = (event) => {
    event.preventDefault();
    const profile = profileById.get(reviewForm.profileId);
    if (!profile) return;
    perform('review-profile', '/api/admin/vendor-bills', {
      action: 'review_profile',
      ...reviewForm,
      expectedVersion: profile.version,
    });
  };

  const createBill = (event) => {
    event.preventDefault();
    const taxCents = dollarsToCents(billForm.taxAmount);
    const shippingCents = dollarsToCents(billForm.shippingAmount);
    if (taxCents === null || shippingCents === null) {
      setState((current) => ({ ...current, error: 'Tax and delivery must be valid dollar amounts.' }));
      return;
    }
    perform('create-bill', '/api/admin/vendor-bills', {
      action: 'create_bill',
      profileId: billForm.profileId,
      purchaseOrderId: billForm.purchaseOrderId || null,
      billNumber: billForm.billNumber,
      invoiceDate: billForm.invoiceDate,
      dueDate: billForm.dueDate,
      currency: 'USD',
      taxCents,
      shippingCents,
      sourceDocumentRef: billForm.sourceDocumentRef,
      sourceDocumentChecksum: billForm.sourceDocumentChecksum,
    }, { billId: '' });
  };

  const addLine = (event) => {
    event.preventDefault();
    if (!selectedBill) return;
    const unitAmountCents = dollarsToCents(lineForm.unitAmount);
    const quantity = Number(lineForm.quantity);
    const amountCents = unitAmountCents === null || !Number.isFinite(quantity) ? null : Math.round(unitAmountCents * quantity);
    if (unitAmountCents === null || !Number.isSafeInteger(amountCents) || quantity <= 0) {
      setState((current) => ({ ...current, error: 'Quantity and unit amount must produce valid integer cents.' }));
      return;
    }
    const inventory = Boolean(selectedBill.purchaseOrderId);
    perform('add-line', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/lines`, {
      expectedVersion: selectedBill.version,
      purchaseOrderLineId: inventory ? lineForm.purchaseOrderLineId : null,
      inventoryItemId: inventory ? selectedCatalogLine?.itemId : null,
      lineType: inventory ? 'INVENTORY' : lineForm.lineType,
      lineCode: lineForm.lineCode.trim().toUpperCase(),
      quantity,
      unitAmountCents,
      amountCents,
    });
  };

  const matchBill = () => {
    if (!selectedBill) return;
    perform('match-bill', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/match`, {
      expectedVersion: selectedBill.version,
      matchType: selectedBill.purchaseOrderId ? 'THREE_WAY' : 'NON_PO_CONTROLLED_EXCEPTION',
      exceptionCode: selectedBill.purchaseOrderId ? null : matchForm.exceptionCode,
    });
  };

  return (
    <AdminShell
      title="Vendor Payments"
      actions={(
        <button type="button" onClick={() => load(selectedBillId)} disabled={state.loading} className={`${BUTTON} border border-foreground/10 bg-foreground/[0.04]`}>
          <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} /> Refresh evidence
        </button>
      )}
    >
      <div className="space-y-7">
        <header className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/50">
            <ShieldCheck className="h-3.5 w-3.5" /> Four-person money control
          </div>
          <h1 className="mt-3 font-heading text-4xl uppercase leading-none sm:text-5xl">Vendors &amp; supply payments</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/55">Match a vendor bill to its purchase order and receipts, then route one locked proposal through maker, checker, executor, and reconciliation control. Queueing records authorization only—it does not contact Mercury, move money, or prove settlement.</p>
        </header>

        {!capabilities.enabled ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.055] p-4 text-sm text-amber-800">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Vendor AP is read-only until the migration, role, provider, reconciliation, and canary gates are approved. Existing evidence remains visible; money actions stay disabled.</p>
          </div>
        ) : null}
        {capabilities.enabled && !capabilities.recentMfa ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.055] p-4 text-sm text-amber-800">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Recent multi-factor authentication is required before any Vendor AP mutation. Evidence remains readable, but setup, approval, queue, hold, cancellation, and settlement controls are hidden.</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Open obligations" value={money(metrics.obligations)} detail={`${bills.filter((row) => !['SETTLED', 'CANCELLED'].includes(row.status)).length} active bills`} icon={ReceiptText} />
          <Metric label="Queued commands" value={metrics.queued} detail="authorization only—not payment" icon={CircleDollarSign} />
          <Metric label="Review holds" value={metrics.held} detail="blocked before dispatch" icon={PauseCircle} />
          <Metric label="Reconciled settlement" value={metrics.settled} detail="evidence-backed records" icon={CheckCircle2} />
        </div>

        <section className="grid gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-4 text-xs sm:grid-cols-3">
          <div><p className="font-bold uppercase tracking-[0.12em] text-foreground/35">Your finance role</p><p className="mt-1 font-semibold">{capabilities.roles.map(statusLabel).join(', ') || 'Read only'}</p></div>
          <div><p className="font-bold uppercase tracking-[0.12em] text-foreground/35">Execution boundary</p><p className="mt-1 font-semibold">Approval outbox only</p></div>
          <div><p className="font-bold uppercase tracking-[0.12em] text-foreground/35">Settlement truth</p><p className="mt-1 font-semibold">Evidence + exact reconciliation</p></div>
        </section>

        {state.error ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.055] p-4 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{state.error}{state.code ? ` (${state.code})` : ''}</p>
          </div>
        ) : null}

        <section>
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/38">Setup</p>
            <h2 className="mt-1 text-xl font-semibold">Vendor readiness and new obligations</h2>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            {capabilities.createProfile ? (
              <FormPanel title="1 · Add vendor finance profile" description="Link an active inventory vendor to the paying legal entity. Store only an opaque provider recipient reference and masked destination label." icon={Building2}>
                <form onSubmit={createProfile} className="grid gap-3">
                  <Field label="Inventory vendor">
                    <select required value={profileForm.inventoryVendorId} onChange={(event) => {
                      const vendor = vendorById.get(event.target.value);
                      setProfileForm((current) => ({ ...current, inventoryVendorId: event.target.value, legalName: current.legalName || vendor?.name || '' }));
                    }} className={INPUT}>
                      <option value="">Choose vendor</option>
                      {catalogs.vendors.filter((row) => row.status === 'active').map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Paying legal entity">
                    <select required value={profileForm.legalEntityId} onChange={(event) => setProfileForm((current) => ({ ...current, legalEntityId: event.target.value }))} className={INPUT}>
                      <option value="">Choose entity</option>
                      {catalogs.legalEntities.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.state}</option>)}
                    </select>
                  </Field>
                  <Field label="Vendor legal name"><input required maxLength={160} value={profileForm.legalName} onChange={(event) => setProfileForm((current) => ({ ...current, legalName: event.target.value }))} className={INPUT} /></Field>
                  <Field label="Tax classification" detail="Classification only. Never enter a TIN on this page.">
                    <select value={profileForm.taxClassification} onChange={(event) => setProfileForm((current) => ({ ...current, taxClassification: event.target.value }))} className={INPUT}>
                      {['C_CORP', 'S_CORP', 'PARTNERSHIP', 'LLC', 'SOLE_PROPRIETOR', 'NONPROFIT', 'GOVERNMENT', 'FOREIGN', 'OTHER_REVIEW_REQUIRED'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                    </select>
                  </Field>
                  <Field label="Mercury recipient reference" detail="Opaque provider ID only—not routing or account numbers."><input required autoComplete="off" value={profileForm.providerRecipientId} onChange={(event) => setProfileForm((current) => ({ ...current, providerRecipientId: event.target.value }))} className={INPUT} /></Field>
                  <Field label="Masked destination label" detail="Example: Vendor account •••• 1234"><input required autoComplete="off" value={profileForm.destinationMaskedLabel} onChange={(event) => setProfileForm((current) => ({ ...current, destinationMaskedLabel: event.target.value }))} className={INPUT} /></Field>
                  <button disabled={Boolean(state.busy)} className={`${BUTTON} bg-foreground text-background`}><FilePlus2 className="h-3.5 w-3.5" />Create pending profile</button>
                </form>
              </FormPanel>
            ) : null}

            {capabilities.reviewProfile ? (
              <FormPanel title="2 · Review vendor readiness" description="A checker records W-9, TIN-match, and destination-review outcomes. This page stores statuses, never the underlying TIN." icon={ShieldCheck}>
                <form onSubmit={reviewProfile} className="grid gap-3">
                  <Field label="Vendor profile">
                    <select required value={reviewForm.profileId} onChange={(event) => setReviewForm((current) => ({ ...current, profileId: event.target.value }))} className={INPUT}>
                      <option value="">Choose profile</option>
                      {profiles.map((row) => <option key={row.id} value={row.id}>{row.legalName} · {statusLabel(row.status)} · v{row.version}</option>)}
                    </select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tax reporting"><select value={reviewForm.taxReportingStatus} onChange={(event) => setReviewForm((current) => ({ ...current, taxReportingStatus: event.target.value }))} className={INPUT}>{['READY', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'HELD'].map((value) => <option key={value}>{value}</option>)}</select></Field>
                    <Field label="W-9 review"><select value={reviewForm.w9Status} onChange={(event) => setReviewForm((current) => ({ ...current, w9Status: event.target.value }))} className={INPUT}>{['VERIFIED', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'EXPIRED'].map((value) => <option key={value}>{value}</option>)}</select></Field>
                    <Field label="TIN match result"><select value={reviewForm.tinMatchStatus} onChange={(event) => setReviewForm((current) => ({ ...current, tinMatchStatus: event.target.value }))} className={INPUT}>{['MATCHED', 'MANUAL_REVIEW', 'MISMATCH', 'UNAVAILABLE'].map((value) => <option key={value}>{value}</option>)}</select></Field>
                    <Field label="Payment readiness"><select value={reviewForm.paymentReadiness} onChange={(event) => setReviewForm((current) => ({ ...current, paymentReadiness: event.target.value }))} className={INPUT}>{['READY', 'ACTION_REQUIRED', 'HELD'].map((value) => <option key={value}>{value}</option>)}</select></Field>
                  </div>
                  <Field label="Structured reason"><input required value={reviewForm.reasonCode} onChange={(event) => setReviewForm((current) => ({ ...current, reasonCode: event.target.value.toUpperCase() }))} className={INPUT} /></Field>
                  <button disabled={Boolean(state.busy)} className={`${BUTTON} bg-foreground text-background`}><ShieldCheck className="h-3.5 w-3.5" />Record independent review</button>
                </form>
              </FormPanel>
            ) : null}

            {capabilities.createBill ? (
              <FormPanel title="3 · Enter vendor bill" description="Create the obligation from a source document. A purchase order is a commitment; it does not become payable until a bill is matched." icon={ReceiptText}>
                <form onSubmit={createBill} className="grid gap-3">
                  <Field label="Vendor profile">
                    <select required value={billForm.profileId} onChange={(event) => setBillForm((current) => ({ ...current, profileId: event.target.value, purchaseOrderId: '' }))} className={INPUT}>
                      <option value="">Choose profile</option>
                      {profiles.map((row) => <option key={row.id} value={row.id}>{row.legalName} · {statusLabel(row.status)}</option>)}
                    </select>
                  </Field>
                  <Field label="Purchase order" detail="Leave blank only for a controlled non-inventory bill.">
                    <select value={billForm.purchaseOrderId} onChange={(event) => setBillForm((current) => ({ ...current, purchaseOrderId: event.target.value }))} className={INPUT}>
                      <option value="">No PO · controlled exception</option>
                      {profilePurchaseOrders.map((row) => <option key={row.id} value={row.id}>{row.orderNumber} · {statusLabel(row.status)} · {money(row.totalCents)}</option>)}
                    </select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Bill number"><input required value={billForm.billNumber} onChange={(event) => setBillForm((current) => ({ ...current, billNumber: event.target.value }))} className={INPUT} /></Field>
                    <Field label="Invoice date"><input required type="date" value={billForm.invoiceDate} onChange={(event) => setBillForm((current) => ({ ...current, invoiceDate: event.target.value }))} className={INPUT} /></Field>
                    <Field label="Due date"><input required type="date" value={billForm.dueDate} onChange={(event) => setBillForm((current) => ({ ...current, dueDate: event.target.value }))} className={INPUT} /></Field>
                    <Field label="Tax"><input required inputMode="decimal" value={billForm.taxAmount} onChange={(event) => setBillForm((current) => ({ ...current, taxAmount: event.target.value }))} className={INPUT} /></Field>
                    <Field label="Delivery / shipping"><input required inputMode="decimal" value={billForm.shippingAmount} onChange={(event) => setBillForm((current) => ({ ...current, shippingAmount: event.target.value }))} className={INPUT} /></Field>
                  </div>
                  <Field label="Source document ID"><input required autoComplete="off" value={billForm.sourceDocumentRef} onChange={(event) => setBillForm((current) => ({ ...current, sourceDocumentRef: event.target.value }))} className={INPUT} /></Field>
                  <Field label="Document fingerprint · SHA-256"><input required autoComplete="off" minLength={64} maxLength={64} value={billForm.sourceDocumentChecksum} onChange={(event) => setBillForm((current) => ({ ...current, sourceDocumentChecksum: event.target.value.toLowerCase() }))} className={INPUT} /></Field>
                  <button disabled={Boolean(state.busy)} className={`${BUTTON} bg-foreground text-background`}><ReceiptText className="h-3.5 w-3.5" />Create draft bill</button>
                </form>
              </FormPanel>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/38">Payment workspace</p><h2 className="mt-1 text-xl font-semibold">Bills, authorization, and settlement evidence</h2></div>
            <span className="rounded-full border border-foreground/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-foreground/45">{bills.length} persisted bills</span>
          </div>

          {!bills.length ? (
            <div className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center">
              <Boxes className="mx-auto h-7 w-7 text-foreground/25" />
              <p className="mt-3 text-sm font-semibold">No persisted vendor bills</p>
              <p className="mt-1 text-xs text-foreground/45">This is a verified empty queue—not a zero-spend or paid-status claim.</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(16rem,0.75fr)_minmax(0,2fr)]">
              <div className="grid content-start gap-2">
                {bills.map((bill) => {
                  const profile = profileById.get(bill.vendorFinanceProfileId);
                  const payment = paymentByBill.get(bill.id);
                  return (
                    <button key={bill.id} type="button" onClick={() => load(bill.id)} className={`rounded-2xl border p-4 text-left transition ${bill.id === selectedBillId ? 'border-foreground/30 bg-foreground/[0.07]' : 'border-foreground/10 bg-foreground/[0.025] hover:bg-foreground/[0.045]'}`}>
                      <div className="flex items-start justify-between gap-3"><p className="truncate text-sm font-semibold">{profile?.legalName || 'Vendor bill'}</p><StatusPill status={payment?.status || bill.status} /></div>
                      <p className="mt-2 text-xs text-foreground/48">{bill.billNumber} · due {bill.dueDate}</p>
                      <p className="mt-3 font-heading text-2xl">{money(bill.totalCents, bill.currency)}</p>
                    </button>
                  );
                })}
              </div>

              {selectedBill ? (
                <article className="space-y-5 rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">{vendorById.get(selectedProfile?.inventoryVendorId)?.name || selectedProfile?.legalName || 'Vendor'}</p>
                      <h3 className="mt-1 text-xl font-semibold">Bill {selectedBill.billNumber}</h3>
                      <p className="mt-1 text-xs text-foreground/45">{entityById.get(selectedBill.legalEntityId)?.name || 'Legal entity'} · due {selectedBill.dueDate} · bill v{selectedBill.version}</p>
                    </div>
                    <div className="text-right"><p className="font-heading text-4xl">{money(selectedBill.totalCents, selectedBill.currency)}</p><div className="mt-2"><StatusPill status={selectedPayment?.status || selectedBill.status} canonicalSettled={canonicalSettlement} /></div></div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-foreground/10 bg-background/45 p-4 text-xs sm:grid-cols-4">
                    <div><p className="uppercase tracking-[0.11em] text-foreground/35">Purchase order</p><p className="mt-1 font-semibold">{catalogs.purchaseOrders.find((row) => row.id === selectedBill.purchaseOrderId)?.orderNumber || 'Controlled non-PO'}</p></div>
                    <div><p className="uppercase tracking-[0.11em] text-foreground/35">Match</p><p className="mt-1 font-semibold">{statusLabel(selectedBill.matchStatus)}</p></div>
                    <div><p className="uppercase tracking-[0.11em] text-foreground/35">Destination</p><p className="mt-1 font-semibold">{selectedPayment?.destinationMaskedLabel || selectedProfile?.destinationMaskedLabel || 'Not prepared'}</p></div>
                    <div><p className="uppercase tracking-[0.11em] text-foreground/35">Reconciliation</p><p className="mt-1 font-semibold">{statusLabel(selectedPayment?.reconciliationState || 'UNMATCHED')}</p></div>
                  </div>

                  <section className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm font-semibold">Immutable bill lines</h4><p className="mt-1 text-xs text-foreground/43">Line totals are locked after matching.</p></div><span className="text-xs font-semibold">{detail?.lines?.length || 0} lines</span></div>
                    {detail?.lines?.length ? (
                      <div className="mt-3 divide-y divide-foreground/10">
                        {detail.lines.map((line) => <div key={line.id} className="grid gap-2 py-3 text-xs sm:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.7fr))]"><div><p className="font-semibold">{statusLabel(line.lineCode)}</p><p className="text-foreground/40">{statusLabel(line.lineType)}</p></div><div><p className="text-foreground/35">Quantity</p><p className="mt-1 font-semibold">{line.quantity}</p></div><div><p className="text-foreground/35">Unit</p><p className="mt-1 font-semibold">{money(line.unitAmountCents, line.currency)}</p></div><div className="sm:text-right"><p className="text-foreground/35">Line total</p><p className="mt-1 font-semibold">{money(line.amountCents, line.currency)}</p></div></div>)}
                      </div>
                    ) : <p className="mt-3 text-xs text-foreground/42">No persisted line evidence yet.</p>}

                    {capabilities.addLine && selectedBill.status === 'DRAFT' ? (
                      <form onSubmit={addLine} className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 sm:grid-cols-2">
                        {selectedBill.purchaseOrderId ? (
                          <Field label="Purchase-order line">
                            <select required value={lineForm.purchaseOrderLineId} onChange={(event) => {
                              const line = selectedPoLines.find((row) => row.id === event.target.value);
                              setLineForm((current) => ({ ...current, purchaseOrderLineId: event.target.value, quantity: line?.quantityOrdered || '1', unitAmount: line ? (Number(line.unitCostCents) / 100).toFixed(2) : current.unitAmount }));
                            }} className={INPUT}>
                              <option value="">Choose received item</option>
                              {selectedPoLines.map((row) => <option key={row.id} value={row.id}>{row.itemName}{row.sku ? ` · ${row.sku}` : ''} · received {row.quantityReceived}/{row.quantityOrdered}</option>)}
                            </select>
                          </Field>
                        ) : (
                          <Field label="Line type"><select value={lineForm.lineType} onChange={(event) => setLineForm((current) => ({ ...current, lineType: event.target.value }))} className={INPUT}>{['SERVICE', 'FEE', 'OTHER'].map((value) => <option key={value}>{value}</option>)}</select></Field>
                        )}
                        <Field label="Structured line code"><input required value={lineForm.lineCode} onChange={(event) => setLineForm((current) => ({ ...current, lineCode: event.target.value.toUpperCase() }))} className={INPUT} /></Field>
                        <Field label="Quantity"><input required inputMode="decimal" value={lineForm.quantity} onChange={(event) => setLineForm((current) => ({ ...current, quantity: event.target.value }))} className={INPUT} /></Field>
                        <Field label="Unit amount"><input required inputMode="decimal" value={lineForm.unitAmount} onChange={(event) => setLineForm((current) => ({ ...current, unitAmount: event.target.value }))} className={INPUT} /></Field>
                        <button disabled={Boolean(state.busy) || (Boolean(selectedBill.purchaseOrderId) && !selectedCatalogLine)} className={`${BUTTON} bg-foreground text-background sm:col-span-2`}><FilePlus2 className="h-3.5 w-3.5" />Add immutable line</button>
                      </form>
                    ) : null}
                  </section>

                  <section className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
                      <h4 className="text-sm font-semibold">PO · receipt · bill match</h4>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/43">Inventory bills require matching PO cost, received quantity, and bill total. Non-PO bills require a coded non-inventory exception.</p>
                      {detail?.matches?.map((match) => (
                        <div key={match.id} className="mt-3 rounded-xl border border-foreground/10 p-3 text-xs">
                          <div className="flex items-center justify-between gap-2"><StatusPill status={match.match_status} /><span>Variance {money(match.variance_cents)}</span></div>
                          <p className="mt-2 text-foreground/48">{match.receipt_count} receipts · {match.fully_received ? 'fully received' : 'receiving incomplete'} · tolerance {money(match.tolerance_cents)}</p>
                        </div>
                      ))}
                      {capabilities.matchBill && selectedBill.status === 'DRAFT' && detail?.lines?.length ? (
                        <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4">
                          <p className="rounded-xl border border-foreground/10 bg-foreground/[0.035] p-3 text-xs leading-relaxed text-foreground/50">Matching uses Avalon&apos;s server-owned exact-total policy. Operators cannot raise the variance tolerance.</p>
                          {!selectedBill.purchaseOrderId ? <Field label="Controlled exception code"><input value={matchForm.exceptionCode} onChange={(event) => setMatchForm((current) => ({ ...current, exceptionCode: event.target.value.toUpperCase() }))} className={INPUT} /></Field> : null}
                          <button type="button" onClick={matchBill} disabled={Boolean(state.busy)} className={`${BUTTON} bg-foreground text-background`}><PackageCheck className="h-3.5 w-3.5" />Record match evidence</button>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
                      <h4 className="text-sm font-semibold">Authorization record</h4>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/43">Maker, checker, and executor must be different active Finance operators.</p>
                      {detail?.approvals?.length ? <div className="mt-3 grid gap-2">{detail.approvals.map((approval) => <div key={approval.id} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 px-3 py-2 text-xs"><div><p className="font-semibold">{statusLabel(approval.stage)} · {statusLabel(approval.decision)}</p><p className="mt-1 text-foreground/40">{statusLabel(approval.reason_code)}</p></div><p className="text-right text-foreground/42">v{approval.aggregate_version}<br />{dateTime(approval.created_at)}</p></div>)}</div> : <p className="mt-3 text-xs text-foreground/42">No authorization recorded.</p>}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">Payment authorization</h4><p className="mt-1 text-xs text-foreground/43">A locked proposal can be queued only after independent maker and checker review.</p></div>{selectedPayment ? <StatusPill status={selectedPayment.status} canonicalSettled={canonicalSettlement} /> : null}</div>
                    {!selectedPayment && capabilities.makerApprove && ['MATCHED', 'MATCH_EXCEPTION'].includes(selectedBill.status) ? (
                      <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 sm:grid-cols-2">
                        <Field label="Mercury provider account ID" detail="Use the exact approved Mercury ID—not a routing or bank account number."><input autoComplete="off" value={approvalForm.fundingAccountRef} onChange={(event) => setApprovalForm((current) => ({ ...current, fundingAccountRef: event.target.value }))} className={INPUT} /></Field>
                        <Field label="Masked funding label"><input autoComplete="off" value={approvalForm.fundingAccountMaskedLabel} onChange={(event) => setApprovalForm((current) => ({ ...current, fundingAccountMaskedLabel: event.target.value }))} className={INPUT} /></Field>
                        <Field label="Maker reason"><input value={approvalForm.makerReason} onChange={(event) => setApprovalForm((current) => ({ ...current, makerReason: event.target.value.toUpperCase() }))} className={INPUT} /></Field>
                        <button type="button" onClick={() => perform('maker-approve', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/approve`, { stage: 'maker', expectedVersion: selectedBill.version, fundingAccountRef: approvalForm.fundingAccountRef, fundingAccountMaskedLabel: approvalForm.fundingAccountMaskedLabel, reasonCode: approvalForm.makerReason })} disabled={Boolean(state.busy) || !approvalForm.fundingAccountRef.trim() || !approvalForm.fundingAccountMaskedLabel.trim()} className={`${BUTTON} bg-foreground text-background sm:self-end`}><ShieldCheck className="h-3.5 w-3.5" />Maker approve</button>
                      </div>
                    ) : null}
                    {selectedPayment?.status === 'APPROVAL_PENDING' && capabilities.checkerApprove ? (
                      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-foreground/10 pt-4"><div className="min-w-[16rem] flex-1"><Field label="Checker reason"><input value={approvalForm.checkerReason} onChange={(event) => setApprovalForm((current) => ({ ...current, checkerReason: event.target.value.toUpperCase() }))} className={INPUT} /></Field></div><button type="button" onClick={() => perform('checker-approve', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/approve`, { stage: 'checker', paymentId: selectedPayment.id, expectedVersion: selectedPayment.version, reasonCode: approvalForm.checkerReason })} disabled={Boolean(state.busy)} className={`${BUTTON} bg-foreground text-background`}><ShieldCheck className="h-3.5 w-3.5" />Checker approve</button></div>
                    ) : null}
                    {selectedPayment?.status === 'READY' && capabilities.queueCommand ? (
                      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-foreground/10 pt-4"><div className="min-w-[16rem] flex-1"><Field label="Executor reason"><input value={approvalForm.executorReason} onChange={(event) => setApprovalForm((current) => ({ ...current, executorReason: event.target.value.toUpperCase() }))} className={INPUT} /></Field></div><button type="button" onClick={() => perform('queue-command', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/payment`, { action: 'queue', paymentId: selectedPayment.id, expectedVersion: selectedPayment.version, reasonCode: approvalForm.executorReason }, { confirmMessage: 'Queue the independently approved vendor payment command? This records executor authorization inside Avalon only. It does not contact Mercury, move money, or prove payment.' })} disabled={Boolean(state.busy)} className={`${BUTTON} bg-foreground text-background`}><Landmark className="h-3.5 w-3.5" />Queue approval command</button></div>
                    ) : null}
                    {detail?.command ? (
                      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.055] p-3 text-xs text-amber-800">
                        <p className="font-semibold">Outbox command · {statusLabel(detail.command.status)}</p>
                        <p className="mt-1 leading-relaxed">{detail.command.attemptCount} attempts · updated {dateTime(detail.command.updatedAt)}. This is internal execution evidence, not provider acceptance or settlement.</p>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-2xl border border-foreground/10 bg-background/35 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">Settlement &amp; reconciliation evidence</h4><p className="mt-1 text-xs leading-relaxed text-foreground/43">“Settled + reconciled” appears only when controlled evidence and an approved zero-variance bank match both exist.</p></div>{canonicalSettlement ? <StatusPill status="SETTLED" canonicalSettled /> : <StatusPill status={selectedPayment?.reconciliationState || 'UNMATCHED'} />}</div>
                    {detail?.paymentEvidence?.map((evidence) => (
                      <div key={evidence.id} className="mt-3 grid gap-2 rounded-xl border border-foreground/10 p-3 text-xs sm:grid-cols-3">
                        <div><p className="text-foreground/35">Evidence</p><p className="mt-1 font-semibold">{statusLabel(evidence.evidenceSource)}</p></div>
                        <div><p className="text-foreground/35">Provider reference</p><p className="mt-1 font-semibold">{evidence.providerReferenceRecorded ? 'Recorded' : 'Not established'}</p></div>
                        <div><p className="text-foreground/35">Fingerprint</p><p className="mt-1 font-mono text-[10px]">…{evidence.evidenceChecksum.slice(-12)}</p></div>
                      </div>
                    ))}
                    {detail?.reconciliation?.map((row) => (
                      <div key={row.id} className="mt-3 grid gap-2 rounded-xl border border-foreground/10 p-3 text-xs sm:grid-cols-4">
                        <div><p className="text-foreground/35">Bank match</p><p className="mt-1 font-semibold">{statusLabel(row.matchStatus)}</p></div>
                        <div><p className="text-foreground/35">Matched</p><p className="mt-1 font-semibold">{money(row.matchedAmountCents)}</p></div>
                        <div><p className="text-foreground/35">Variance</p><p className="mt-1 font-semibold">{money(row.varianceCents)}</p></div>
                        <div><p className="text-foreground/35">Approved</p><p className="mt-1 font-semibold">{dateTime(row.approvedAt)}</p></div>
                      </div>
                    ))}
                    {selectedPayment && capabilities.settle && ['COMMAND_QUEUED', 'PROVIDER_PENDING', 'RECONCILIATION_REQUIRED'].includes(selectedPayment.status) ? (
                      <FormPanel title="Controller settlement evidence" description="Record only after the exact bank item and provider/manual evidence have been independently verified." icon={FileCheck2}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Evidence source"><select value={settlementForm.evidenceSource} onChange={(event) => setSettlementForm((current) => ({ ...current, evidenceSource: event.target.value, financeIntegrationEventId: '' }))} className={INPUT}><option value="PROVIDER_CONFIRMED">Provider confirmed</option><option value="CONTROLLED_MANUAL">Controlled manual</option></select></Field>
                          {settlementForm.evidenceSource === 'PROVIDER_CONFIRMED' ? <Field label="Verified provider event ID"><input value={settlementForm.financeIntegrationEventId} onChange={(event) => setSettlementForm((current) => ({ ...current, financeIntegrationEventId: event.target.value }))} className={INPUT} /></Field> : null}
                          <Field label="Bank statement item ID"><input value={settlementForm.bankStatementItemId} onChange={(event) => setSettlementForm((current) => ({ ...current, bankStatementItemId: event.target.value }))} className={INPUT} /></Field>
                          <Field label="Provider transaction reference"><input autoComplete="off" value={settlementForm.providerTransactionId} onChange={(event) => setSettlementForm((current) => ({ ...current, providerTransactionId: event.target.value }))} className={INPUT} /></Field>
                          <Field label="Evidence record ID"><input autoComplete="off" value={settlementForm.evidenceRef} onChange={(event) => setSettlementForm((current) => ({ ...current, evidenceRef: event.target.value }))} className={INPUT} /></Field>
                          <p className="rounded-xl border border-foreground/10 bg-foreground/[0.035] p-3 text-xs leading-relaxed text-foreground/50">Avalon generates the evidence fingerprint from the locked command, verified provider event, and posted bank payload. Operators cannot supply or replace it.</p>
                          <Field label="Controller reason"><input value={settlementForm.reasonCode} onChange={(event) => setSettlementForm((current) => ({ ...current, reasonCode: event.target.value.toUpperCase() }))} className={INPUT} /></Field>
                          <button type="button" onClick={() => perform('settle-payment', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/payment`, { action: 'settle', paymentId: selectedPayment.id, expectedVersion: selectedPayment.version, evidenceSource: settlementForm.evidenceSource, financeIntegrationEventId: settlementForm.evidenceSource === 'PROVIDER_CONFIRMED' ? settlementForm.financeIntegrationEventId : null, bankStatementItemId: settlementForm.bankStatementItemId, providerTransactionId: settlementForm.providerTransactionId, evidenceRef: settlementForm.evidenceRef, reasonCode: settlementForm.reasonCode }, { confirmMessage: 'Record this vendor payment as settled only if the provider/manual evidence and exact bank reconciliation are independently verified?' })} disabled={Boolean(state.busy) || !settlementForm.bankStatementItemId || !settlementForm.providerTransactionId || !settlementForm.evidenceRef || (settlementForm.evidenceSource === 'PROVIDER_CONFIRMED' && !settlementForm.financeIntegrationEventId)} className={`${BUTTON} bg-foreground text-background sm:self-end`}><CheckCircle2 className="h-3.5 w-3.5" />Record reconciled settlement</button>
                        </div>
                      </FormPanel>
                    ) : null}
                  </section>

                  {!['SETTLED', 'CANCELLED'].includes(selectedBill.status) && (capabilities.hold || capabilities.cancel) ? (
                    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-red-500/15 bg-red-500/[0.025] p-4">
                      <div className="min-w-[16rem] flex-1"><Field label={selectedBill.status === 'HELD' ? 'Hold release reason' : 'Hold reason'}><input value={controlForm.holdReason} onChange={(event) => setControlForm((current) => ({ ...current, holdReason: event.target.value.toUpperCase() }))} className={INPUT} /></Field></div>
                      {capabilities.hold ? <button type="button" onClick={() => perform(selectedBill.status === 'HELD' ? 'release-hold' : 'place-hold', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/hold`, { expectedVersion: selectedBill.version, hold: selectedBill.status !== 'HELD', reasonCode: controlForm.holdReason }, { confirmMessage: selectedBill.status === 'HELD' ? '' : 'Place this bill and any unclaimed payment command on hold?' })} disabled={Boolean(state.busy)} className={`${BUTTON} border border-foreground/15 bg-background`}><PauseCircle className="h-3.5 w-3.5" />{selectedBill.status === 'HELD' ? 'Release hold' : 'Place hold'}</button> : null}
                      {capabilities.cancel ? <button type="button" onClick={() => perform('cancel-bill', `/api/admin/vendor-bills/${encodeURIComponent(selectedBill.id)}/cancel`, { expectedVersion: selectedBill.version, reasonCode: controlForm.cancelReason }, { confirmMessage: 'Cancel this vendor bill? A pending outbox command will be cancelled; claimed provider work requires controlled recovery.' })} disabled={Boolean(state.busy)} className={`${BUTTON} border border-red-500/25 text-red-700`}><XCircle className="h-3.5 w-3.5" />Cancel bill</button> : null}
                    </section>
                  ) : null}

                  {state.busy ? <p className="flex items-center gap-2 text-xs text-foreground/45"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving controlled action and refreshing evidence</p> : null}
                </article>
              ) : null}
            </div>
          )}
        </section>

        <p className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4 text-xs leading-relaxed text-foreground/55">
          Privacy boundary: this workspace accepts structured codes, opaque provider references, masked destination labels, and evidence fingerprints only. Never enter patient information, raw TINs, routing numbers, or bank account numbers.
        </p>
      </div>
    </AdminShell>
  );
}
