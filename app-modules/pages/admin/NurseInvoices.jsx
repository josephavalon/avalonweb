import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ExternalLink,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPatch } from '@/lib/apiClient';

const BUTTON = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 font-body text-[10px] font-bold uppercase tracking-[0.13em] transition-colors disabled:cursor-not-allowed disabled:opacity-35';
const PAGE_SIZE = 50;
const PREVIEW_INVOICES = [
  {
    id: 'preview-invoice-identity-hold',
    invoice_number: 'AV-20260829-EXAMPLE',
    nurse_name: 'Example Contractor',
    nurse_email: 'contractor@example.com',
    status: 'quarantined',
    identity_assurance: 'shared_door_roster_match',
    delivery_status: 'sent',
    receipt_storage_status: 'complete',
    period_start: '2026-08-16',
    period_end: '2026-08-29',
    wages_cents: 72000,
    reimbursements_cents: 6850,
    total_cents: 78850,
    submitted_at: '2026-08-29T15:42:00Z',
    version: 1,
    lines: [
      { id: 'preview-line-1', line_type: 'shift', service_date: '2026-08-22' },
      { id: 'preview-line-2', line_type: 'shift', service_date: '2026-08-28' },
      { id: 'preview-line-3', line_type: 'expense', description: 'Parking' },
    ],
    receipts: [{ id: 'preview-receipt-1', fileName: 'receipt-1.pdf', scanStatus: 'quarantined', signedUrl: null }],
    statusEvents: [
      { id: 'preview-event-1', from_status: null, to_status: 'quarantined', invoice_version: 1, created_at: '2026-08-29T15:42:00Z' },
    ],
  },
  {
    id: 'preview-invoice-approved',
    invoice_number: 'AV-20260815-SAMPLE',
    nurse_name: 'Sample Nurse',
    nurse_email: 'nurse@example.com',
    status: 'approved',
    identity_assurance: 'admin_verified_shared_door',
    delivery_status: 'sent',
    receipt_storage_status: 'none',
    period_start: '2026-08-01',
    period_end: '2026-08-15',
    wages_cents: 96000,
    reimbursements_cents: 0,
    total_cents: 96000,
    submitted_at: '2026-08-15T17:18:00Z',
    review_note: 'Preview: identity verified against the contractor record.',
    version: 3,
    lines: [
      { id: 'preview-line-4', line_type: 'shift', service_date: '2026-08-04' },
      { id: 'preview-line-5', line_type: 'shift', service_date: '2026-08-12' },
    ],
    receipts: [],
    statusEvents: [
      { id: 'preview-event-2', from_status: 'submitted', to_status: 'approved', invoice_version: 3, created_at: '2026-08-16T18:20:00Z' },
    ],
  },
];

const PREVIEW_METRICS = {
  submitted: 0,
  quarantined: 1,
  approvedCents: 96000,
  paidCents: 0,
};

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(Number(cents || 0) / 100);
}

function statusLabel(value) {
  return String(value || 'unknown').replace(/_/g, ' ');
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function receiptName(receipt, index) {
  return receipt.fileName || receipt.file_name || `Receipt ${index + 1}`;
}

function Metric({ label, value, detail }) {
  return (
    <div className="min-w-0 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
      <p className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/45">{label}</p>
      <p className="mt-2 break-words font-heading text-[clamp(1.35rem,7vw,1.875rem)] uppercase leading-none">{value}</p>
      <p className="mt-1 font-body text-[10px] text-foreground/40">{detail}</p>
    </div>
  );
}

export default function NurseInvoices() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    invoices: [],
    metrics: {},
    preview: false,
    pagination: { offset: 0, limit: PAGE_SIZE, total: 0, hasMore: false, nextOffset: 0 },
  });
  const [inputs, setInputs] = useState({});
  const [busy, setBusy] = useState('');

  const loadPage = useCallback(async (offset = 0, append = false) => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await apiGet(`/api/admin/nurse-invoices?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!Array.isArray(data?.invoices)) {
        const invalid = new Error('Finance returned an invalid invoice response.');
        invalid.code = 'invalid_invoice_response';
        throw invalid;
      }
      const page = Array.isArray(data?.invoices) ? data.invoices : [];
      setState((current) => {
        const combined = append ? [...current.invoices, ...page] : page;
        const unique = [...new Map(combined.map((invoice) => [invoice.id, invoice])).values()];
        return {
          loading: false,
          error: '',
          invoices: unique,
          metrics: data?.metrics || {},
          preview: false,
          pagination: data?.pagination || {
            offset,
            limit: PAGE_SIZE,
            total: unique.length,
            hasMore: false,
            nextOffset: unique.length,
          },
        };
      });
    } catch (error) {
      if (import.meta.env.DEV && error?.code === 'invalid_invoice_response' && !append) {
        setState({
          loading: false,
          error: '',
          invoices: PREVIEW_INVOICES,
          metrics: PREVIEW_METRICS,
          preview: true,
          pagination: { offset: 0, limit: PAGE_SIZE, total: PREVIEW_INVOICES.length, hasMore: false, nextOffset: PREVIEW_INVOICES.length },
        });
      } else {
        setState((current) => ({ ...current, loading: false, error: error.message || 'Could not load nurse invoices.' }));
      }
    }
  }, []);

  const load = useCallback(() => loadPage(0, false), [loadPage]);

  useEffect(() => { load(); }, [load]);

  const transition = useCallback(async (invoice, status) => {
    if (state.preview) {
      setState((current) => ({ ...current, error: 'Preview invoices cannot be changed. Install the Finance migration and storage configuration first.' }));
      return;
    }
    const key = `${invoice.id}:${status}`;
    const values = inputs[invoice.id] || {};
    const paymentReference = String(values.paymentReference || '').trim();
    const reviewNote = String(values.reviewNote || '').trim();
    if (status === 'paid' && !paymentReference) {
      setState((current) => ({ ...current, error: 'Add the Gusto, ACH, check, or payout reference before marking an invoice paid.' }));
      return;
    }
    setBusy(key);
    setState((current) => ({ ...current, error: '' }));
    try {
      await apiPatch('/api/admin/nurse-invoices', {
        invoiceId: invoice.id,
        status,
        expectedVersion: invoice.version,
        reviewNote,
        paymentReference,
      });
      setInputs((current) => ({ ...current, [invoice.id]: {} }));
      await loadPage(0, false);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || 'The invoice could not be updated.' }));
    } finally {
      setBusy('');
    }
  }, [inputs, loadPage, state.preview]);

  const totals = useMemo(() => ({
    submitted: state.metrics.submitted ?? state.invoices.filter((row) => row.status === 'submitted').length,
    quarantined: state.metrics.quarantined ?? state.invoices.filter((row) => row.status === 'quarantined').length,
    approvedCents: state.metrics.approvedCents ?? state.invoices.filter((row) => row.status === 'approved').reduce((sum, row) => sum + Number(row.total_cents || 0), 0),
    paidCents: state.metrics.paidCents ?? state.invoices.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.total_cents || 0), 0),
  }), [state.invoices, state.metrics]);

  const setInput = (invoiceId, field, value) => {
    setInputs((current) => ({
      ...current,
      [invoiceId]: { ...(current[invoiceId] || {}), [field]: value },
    }));
  };

  return (
    <AdminShell title="Finance">
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Finance · Accounts payable</p>
            <h1 className="font-heading text-4xl uppercase leading-none">Nurse invoices</h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-foreground/52">Every Nurse Portal submission is retained here with server-calculated totals, immutable line items, receipt evidence, delivery state, and an admin audit trail.</p>
          </div>
          <button type="button" onClick={load} disabled={state.loading} className={`${BUTTON} border-foreground/12 bg-foreground/[0.04] text-foreground/60`}>
            <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />Refresh
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Submitted" value={totals.submitted} detail="Ready for finance review" />
          <Metric label="Identity hold" value={totals.quarantined} detail="Shared-door or unmatched identity" />
          <Metric label="Approved" value={money(totals.approvedCents)} detail="Approved accounts payable" />
          <Metric label="Paid" value={money(totals.paidCents)} detail="Payment reference recorded" />
        </div>

        {state.preview ? <p role="status" className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.06] p-4 font-body text-sm text-sky-100">Local preview data is shown. No invoice, receipt, approval, or payment action can be saved from this screen.</p> : null}
        {state.error ? <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/[0.08] p-4 font-body text-sm text-red-200">{state.error}</p> : null}

        <div className="grid gap-3">
          {state.invoices.map((invoice) => {
            const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
            const receipts = Array.isArray(invoice.receipts) ? invoice.receipts : [];
            const statusEvents = Array.isArray(invoice.statusEvents) ? invoice.statusEvents : [];
            const values = inputs[invoice.id] || {};
            const quarantined = invoice.status === 'quarantined';
            const identity = invoice.identity_assurance || invoice.identityAssurance || 'shared_door';
            return (
              <article key={invoice.id} className="rounded-2xl border border-foreground/10 bg-background/52 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 text-foreground/48" />
                      <h2 className="font-body text-sm font-semibold">{invoice.invoice_number}</h2>
                      <span className="rounded-full border border-foreground/10 px-2 py-1 font-body text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/58">{statusLabel(invoice.status)}</span>
                      {quarantined ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/22 bg-amber-300/[0.05] px-2 py-1 font-body text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200"><ShieldAlert className="h-3 w-3" />Identity hold</span> : null}
                    </div>
                    <p className="mt-2 font-body text-sm text-foreground/58">{invoice.nurse_name} · {invoice.nurse_email}</p>
                    <p className="mt-1 font-body text-xs text-foreground/40">{invoice.period_start}–{invoice.period_end} · {lines.filter((line) => line.line_type === 'shift').length} shifts · {lines.filter((line) => line.line_type === 'expense').length} expenses · submitted {dateTime(invoice.submitted_at)}</p>
                    <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/35">Identity: {statusLabel(identity)} · Finance notice: {statusLabel(invoice.delivery_status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-3xl leading-none">{money(invoice.total_cents)}</p>
                    <p className="mt-1 font-body text-[10px] text-foreground/40">{money(invoice.wages_cents)} wages · {money(invoice.reimbursements_cents)} expenses</p>
                  </div>
                </div>

                {invoice.review_note ? <p className="mt-3 rounded-xl bg-foreground/[0.035] p-3 font-body text-sm text-foreground/60">{invoice.review_note}</p> : null}

                {statusEvents.length ? (
                  <details className="mt-3 rounded-xl border border-foreground/8 bg-foreground/[0.02] px-3 py-2">
                    <summary className="cursor-pointer font-body text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/42">Immutable status history · {statusEvents.length}</summary>
                    <div className="mt-2 grid gap-1">
                      {statusEvents.slice(0, 8).map((event) => (
                        <p key={event.id} className="font-body text-[10px] text-foreground/48">
                          {event.from_status ? `${statusLabel(event.from_status)} → ` : ''}{statusLabel(event.to_status)} · v{event.invoice_version} · {dateTime(event.created_at)}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}

                {receipts.length ? (
                  <div className="mt-3">
                    <p className="mb-2 font-body text-[10px] text-foreground/40">Private receipt evidence · quarantined until an approved scanner clears it.</p>
                    <div className="flex flex-wrap gap-2">
                      {receipts.map((receipt, index) => {
                        const signedUrl = receipt.signedUrl || receipt.signed_url || '';
                        if (!signedUrl) {
                          return (
                            <span key={receipt.id || index} aria-disabled="true" className={`${BUTTON} cursor-not-allowed border-foreground/10 bg-foreground/[0.02] text-foreground/30`}>
                              <ReceiptText className="h-3.5 w-3.5" />{receiptName(receipt, index)} · {statusLabel(receipt.scanStatus || receipt.scan_status || 'quarantined')}
                            </span>
                          );
                        }
                        return (
                          <a key={receipt.id || index} href={signedUrl} target="_blank" rel="noreferrer" className={`${BUTTON} border-foreground/10 bg-foreground/[0.035] text-foreground/58`}>
                            <ReceiptText className="h-3.5 w-3.5" />{receiptName(receipt, index)}<ExternalLink className="h-3 w-3" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {['quarantined', 'submitted', 'approved', 'correction_required'].includes(invoice.status) ? (
                  <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)_auto] lg:items-end">
                    <label>
                      <span className="mb-1 block font-body text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/40">Review note</span>
                      <input value={values.reviewNote || ''} onChange={(event) => setInput(invoice.id, 'reviewNote', event.target.value)} placeholder={quarantined ? 'How identity was verified' : 'Correction or approval note'} className="min-h-10 w-full rounded-xl border border-foreground/10 bg-background px-3 font-body text-sm outline-none focus:border-foreground/35" />
                    </label>
                    {invoice.status === 'approved' ? (
                      <label>
                        <span className="mb-1 block font-body text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/40">Payment reference</span>
                        <input value={values.paymentReference || ''} onChange={(event) => setInput(invoice.id, 'paymentReference', event.target.value)} placeholder="Gusto / ACH / check reference" className="min-h-10 w-full rounded-xl border border-foreground/10 bg-background px-3 font-body text-sm outline-none focus:border-foreground/35" />
                      </label>
                    ) : <span />}
                    <div className="flex flex-wrap justify-end gap-2">
                      {quarantined ? <button type="button" onClick={() => transition(invoice, 'submitted')} disabled={state.preview || busy !== ''} className={`${BUTTON} border-sky-300/24 bg-sky-300/[0.07] text-sky-200`}><Check className="h-3.5 w-3.5" />Verify identity</button> : null}
                      {['submitted', 'correction_required'].includes(invoice.status) ? <button type="button" onClick={() => transition(invoice, 'approved')} disabled={state.preview || busy !== ''} className={`${BUTTON} border-foreground bg-foreground text-background`}><Check className="h-3.5 w-3.5" />Approve</button> : null}
                      {invoice.status === 'submitted' ? <button type="button" onClick={() => transition(invoice, 'correction_required')} disabled={state.preview || busy !== ''} className={`${BUTTON} border-amber-300/24 text-amber-200`}>Request correction</button> : null}
                      {['quarantined', 'submitted', 'correction_required'].includes(invoice.status) ? <button type="button" onClick={() => transition(invoice, 'rejected')} disabled={state.preview || busy !== ''} className={`${BUTTON} border-red-300/24 text-red-200`}><X className="h-3.5 w-3.5" />Reject</button> : null}
                      {invoice.status === 'approved' ? <button type="button" onClick={() => transition(invoice, 'paid')} disabled={state.preview || busy !== ''} className={`${BUTTON} border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200`}>Mark paid</button> : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {state.loading ? <p className="flex items-center gap-2 rounded-2xl border border-foreground/10 p-6 font-body text-sm text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" />Loading stored invoices</p> : null}
          {!state.loading && !state.invoices.length ? <p className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center font-body text-sm text-foreground/45">No Nurse Portal invoices have been stored yet.</p> : null}
          {state.pagination.hasMore ? (
            <button
              type="button"
              onClick={() => loadPage(state.pagination.nextOffset, true)}
              disabled={state.loading}
              className={`${BUTTON} mx-auto border-foreground/12 bg-foreground/[0.04] text-foreground/60`}
            >
              {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Load older invoices
            </button>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
