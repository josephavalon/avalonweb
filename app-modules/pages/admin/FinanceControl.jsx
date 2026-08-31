import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Boxes,
  BriefcaseBusiness,
  CreditCard,
  FileCheck2,
  Landmark,
  Loader2,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet } from '@/lib/apiClient';

const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.38)';

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function centsMoney(value) {
  try {
    const cents = BigInt(String(value || '0'));
    const sign = cents < BigInt(0) ? '-' : '';
    const absolute = cents < BigInt(0) ? -cents : cents;
    return `${sign}$${(absolute / BigInt(100)).toLocaleString()}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
  } catch {
    return 'Unavailable';
  }
}

function statusTone(status) {
  if (status === 'AVAILABLE' || status === 'HEALTHY') return 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700';
  if (status === 'RESTRICTED' || status === 'MANUAL') return 'border-amber-500/25 bg-amber-500/[0.06] text-amber-800';
  return 'border-red-500/20 bg-red-500/[0.05] text-red-700';
}

function StatusPill({ status }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] ${statusTone(status)}`}>{String(status || 'UNKNOWN').replaceAll('_', ' ')}</span>;
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: DIM }}>{label}</p>
        <Icon className="h-4 w-4" style={{ color: DIM }} strokeWidth={1.8} />
      </div>
      <p className="break-words font-heading text-3xl uppercase leading-none sm:text-4xl" style={{ color: TEXT }}>{value}</p>
      <p className="mt-1 font-body text-xs" style={{ color: MUTED }}>{detail}</p>
    </div>
  );
}

function DomainUnavailable({ title, status, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-foreground/15 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold">{title}</h3><StatusPill status={status} /></div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/55">{body}</p>
    </div>
  );
}

export default function FinanceControl() {
  const [state, setState] = useState({ loading: true, error: '', summary: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const summary = await apiGet('/api/admin/finance/summary');
      if (!summary?.clientRevenue || !summary?.nursePayOps || !summary?.inventoryCosts) {
        throw new Error('Finance returned an invalid domain summary.');
      }
      setState({ loading: false, error: '', summary });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Could not load finance domains.', summary: null });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.loading && !state.summary) {
    return <AdminShell title="Avalon Finance"><div className="flex min-h-[28rem] items-center justify-center text-foreground/45"><Loader2 className="h-5 w-5 animate-spin" /></div></AdminShell>;
  }
  if (!state.summary) {
    return (
      <AdminShell title="Avalon Finance">
        <OperationalSourceUnavailable
          title="Finance domains unavailable"
          description="Client revenue, Nurse PayOps, and inventory costs could not be verified. No zeroed or sample finance metrics are shown, and all finance actions remain disabled."
        />
      </AdminShell>
    );
  }

  const clientDomain = state.summary.clientRevenue;
  const client = clientDomain.data;
  const payOps = state.summary.nursePayOps;
  const inventory = state.summary.inventoryCosts;
  const inventoryData = inventory.data;
  const adapters = Object.entries(payOps.adapterHealth || {});

  return (
    <AdminShell
      title="Avalon Finance"
      actions={(
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/60 disabled:opacity-45">
          <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      )}
    >
      <div className="space-y-8">
        <header className="max-w-3xl">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Three finance domains · one controlled view</p>
          <h1 className="mt-2 font-heading text-5xl uppercase leading-none">Finance control</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/55">Client revenue stays in Stripe. Nurse earnings and payment controls stay in PayOps. Supplies and kit costs come only from the typed inventory ledger. No domain is used as proof for another.</p>
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/10 pb-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">Client revenue · Stripe</p><h2 className="mt-1 text-2xl font-semibold">Collections and merchant settlement</h2></div>
            <StatusPill status={clientDomain.status} />
          </div>
          {clientDomain.status !== 'AVAILABLE' || !client ? (
            <DomainUnavailable title="Stripe source unavailable" status={clientDomain.status} body="Client charges, deposits, balances, subscriptions, and Stripe merchant payouts are not shown until the live Stripe source reconnects. Nurse PayOps remains independently visible below." />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Deposits taken" value={money(client.depositsTaken?.amount)} detail={`${client.depositsTaken?.count || 0} collected`} icon={CreditCard} />
                <Metric label="Last 30 days" value={money(client.last30Days?.amount)} detail={`${client.last30Days?.count || 0} Stripe charges`} icon={Banknote} />
                <Metric label="Outstanding" value={money(client.outstandingBalances?.amount)} detail={`${client.outstandingBalances?.count || 0} client balances`} icon={FileCheck2} />
                <Metric label="Merchant payouts" value={client.merchantPayouts?.length || 0} detail="Stripe-to-Avalon, not nurse payouts" icon={Landmark} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/bookings" className="rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]">Open collections</Link>
                <Link to="/admin/reconciliation" className="rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]">Client reconciliation</Link>
                <Link to="/admin/promo-codes" className="rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]">Promo codes</Link>
              </div>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/10 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">Supplies &amp; inventory · Avalon</p>
              <h2 className="mt-1 text-2xl font-semibold">Stock value, consumption, and write-offs</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={inventory.sourceStatus} />
              <StatusPill status={inventory.status} />
            </div>
          </div>
          {inventory.status !== 'AVAILABLE' || !inventoryData ? (
            <DomainUnavailable
              title={inventory.status === 'RESTRICTED' ? 'Finance role required' : 'Inventory cost source unavailable'}
              status={inventory.status}
              body={inventory.status === 'RESTRICTED'
                ? 'Inventory quantities remain operationally available to authorized admins, but valuation and cost evidence require an active Finance role.'
                : 'Typed stock movements, lots, and purchase orders have not been verified as finance evidence. Legacy browser inventory and manually entered prices are never accepted as accounting truth.'}
            />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Metric label="Inventory value" value={centsMoney(inventoryData.metrics?.inventoryValueCents)} detail="typed balance valuation" icon={Boxes} />
                <Metric label="Receipts · 30 days" value={centsMoney(inventoryData.metrics?.receiptCost30dCents)} detail="reviewed stock received" icon={PackageSearch} />
                <Metric label="Consumption · 30 days" value={centsMoney(inventoryData.metrics?.consumptionCost30dCents)} detail={`${inventoryData.metrics?.postedConsumptionCost30dCents === inventoryData.metrics?.consumptionCost30dCents ? 'posted' : 'operational estimate'} · ${centsMoney(inventoryData.metrics?.postedConsumptionCost30dCents)} posted`} icon={BriefcaseBusiness} />
                <Metric label="Write-offs · 30 days" value={centsMoney(inventoryData.metrics?.writeOffCost30dCents)} detail={`${centsMoney(inventoryData.metrics?.postedWriteOffCost30dCents)} posted`} icon={ShieldCheck} />
                <Metric label="Open PO commitment" value={centsMoney(inventoryData.metrics?.openPurchaseOrderCommitmentCents)} detail={`${inventoryData.metrics?.openPurchaseOrderCount || 0} purchase orders`} icon={FileCheck2} />
                <Metric label="Cost exceptions" value={(inventoryData.metrics?.uncostedMovementCount || 0) + (inventoryData.metrics?.invalidDirectionCount || 0) + (inventoryData.metrics?.unpreparedMovementCount || 0)} detail="uncosted, invalid, or unprepared" icon={RefreshCw} />
              </div>
              <p className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-800">
                Operational consumption is an estimate until a Finance maker prepares the cost event and a separate controller posts the balanced journal.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/inventory-costs" className="rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background">Inventory costs</Link>
            <Link to="/admin/inventory" className="rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]">Manage stock &amp; kits</Link>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/10 pb-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">Nurse PayOps · Avalon</p><h2 className="mt-1 text-2xl font-semibold">1099 payables and W-2 payroll controls</h2></div>
            <StatusPill status={payOps.status} />
          </div>
          {payOps.status !== 'AVAILABLE' ? (
            <DomainUnavailable
              title={payOps.status === 'RESTRICTED' ? 'Finance role required' : 'PayOps unavailable'}
              status={payOps.status}
              body={payOps.status === 'RESTRICTED'
                ? 'Nurse-pay amounts require an active Finance role. Provider status remains visible so operators do not mistake an unconfigured rail for a healthy one.'
                : 'PayOps schema or source verification is incomplete. No nurse-pay amounts or synthetic empty-state claims are shown; provider live-send flags remain disabled.'}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="1099 Payables" value={centsMoney(payOps.contractor?.openNetCents)} detail={`${payOps.contractor?.openCount || 0} open · ${payOps.contractor?.heldCount || 0} held`} icon={BriefcaseBusiness} />
              <Metric label="W-2 Payroll" value={centsMoney(payOps.employee?.activeNetCents)} detail={`${payOps.employee?.activeRunCount || 0} active runs · ${payOps.employee?.actionRequiredCount || 0} action required`} icon={Users} />
              <Metric label="Avalon nurse-pay subledger" value={payOps.ledger?.postedCount || 0} detail={`${payOps.ledger?.draftCount || 0} draft journals · not complete company books`} icon={ShieldCheck} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/payables" className="rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background">1099 Payables</Link>
            <Link to="/admin/nurse-invoices" className="rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]">Nurse invoice review</Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {adapters.map(([key, adapter]) => (
              <article key={key} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}</h3><StatusPill status={adapter.state} /></div>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: MUTED }}>{adapter.action}</p>
              </article>
            ))}
          </div>
        </section>

        <p className="rounded-2xl p-4 text-xs leading-relaxed" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: MUTED }}>
          Money movement, payroll submission, classification, tax filing, reconciliation approval, inventory-cost preparation, journal posting, and period close remain human-approved actions. Disabled or unverified providers are never reported as healthy.
        </p>
      </div>
    </AdminShell>
  );
}
