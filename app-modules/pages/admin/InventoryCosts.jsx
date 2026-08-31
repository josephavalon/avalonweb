import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  FileClock,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet } from '@/lib/apiClient';

function money(value) {
  try {
    const amount = BigInt(String(value ?? '0'));
    const sign = amount < BigInt(0) ? '-' : '';
    const absolute = amount < BigInt(0) ? -amount : amount;
    return `${sign}$${(absolute / BigInt(100)).toLocaleString()}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
  } catch {
    return 'Unavailable';
  }
}

function quantity(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 3 })
    : String(value || '0');
}

function Metric({ label, value, detail, icon: Icon, warning = false }) {
  return (
    <article className={`rounded-2xl border p-4 ${warning ? 'border-amber-500/20 bg-amber-500/[0.055]' : 'border-foreground/10 bg-foreground/[0.035]'}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/40">{label}</p>
        <Icon className={`h-4 w-4 ${warning ? 'text-amber-700' : 'text-foreground/35'}`} strokeWidth={1.8} />
      </div>
      <p className="mt-4 font-heading text-3xl uppercase leading-none sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-foreground/50">{detail}</p>
    </article>
  );
}

function statusClass(status) {
  if (status === 'POSTED') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700';
  if (status === 'DRAFT') return 'border-blue-500/25 bg-blue-500/10 text-blue-700';
  return 'border-amber-500/25 bg-amber-500/10 text-amber-800';
}

export default function InventoryCosts() {
  const [state, setState] = useState({ loading: true, error: '', payload: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await apiGet('/api/admin/finance/inventory-costs?limit=100');
      if (payload?.status !== 'AVAILABLE' || !payload?.data?.metrics || !Array.isArray(payload?.data?.recentMovements)) {
        throw new Error('Inventory cost evidence is unavailable.');
      }
      setState({ loading: false, error: '', payload });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Inventory cost evidence is unavailable.', payload: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = state.payload?.data?.metrics;
  const movements = state.payload?.data?.recentMovements || [];
  const exceptionCount = useMemo(() => metrics
    ? Number(metrics.uncostedMovementCount || 0)
      + Number(metrics.invalidDirectionCount || 0)
      + Number(metrics.unpreparedMovementCount || 0)
    : 0, [metrics]);

  return (
    <AdminShell
      title="Inventory Costs"
      actions={(
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.13em] disabled:opacity-40">
          <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      )}
    >
      {state.loading && !state.payload ? (
        <div className="flex min-h-[28rem] items-center justify-center text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !state.payload ? (
        <OperationalSourceUnavailable
          title="Inventory cost evidence unavailable"
          description={`${state.error || 'The typed inventory cost source could not be verified.'} No legacy item prices or synthetic zero values are shown.`}
        />
      ) : (
        <div className="space-y-7">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/50">
                <ShieldCheck className="h-3.5 w-3.5" /> Typed stock movements only
              </div>
              <h1 className="mt-3 font-heading text-4xl uppercase leading-none sm:text-5xl">Supplies &amp; inventory costs</h1>
              <p className="mt-3 text-sm leading-relaxed text-foreground/55">Operational stock value and usage are visible here. An amount becomes accounting evidence only after maker preparation and separate controller posting.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/inventory" className="rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-background">Manage inventory</Link>
              <Link to="/admin/finance" className="rounded-full border border-foreground/12 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em]">Finance control</Link>
            </div>
          </header>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-800">
            Live cost-event preparation remains {state.payload.capabilities?.enabled ? 'gated by Finance role and recent MFA' : 'disabled'} until schema, reconciliation, and chart-of-accounts postflight are approved. This screen never posts a journal or moves money.
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Inventory value" value={money(metrics.inventoryValueCents)} detail="current typed balance valuation" icon={Boxes} />
            <Metric label="Consumption · 30 days" value={money(metrics.consumptionCost30dCents)} detail={`${money(metrics.postedConsumptionCost30dCents)} posted`} icon={PackageCheck} />
            <Metric label="Write-offs · 30 days" value={money(metrics.writeOffCost30dCents)} detail={`${money(metrics.postedWriteOffCost30dCents)} posted`} icon={AlertTriangle} />
            <Metric label="Open PO commitment" value={money(metrics.openPurchaseOrderCommitmentCents)} detail={`${metrics.openPurchaseOrderCount || 0} purchase orders`} icon={ClipboardCheck} />
            <Metric label="Receipts · 30 days" value={money(metrics.receiptCost30dCents)} detail="received stock cost snapshots" icon={PackageCheck} />
            <Metric label="Prepared journals" value={metrics.preparedJournalCount || 0} detail="draft, not posted" icon={FileClock} />
            <Metric label="Posted journals" value={metrics.postedJournalCount || 0} detail="controller-posted cost evidence" icon={ShieldCheck} />
            <Metric label="Exceptions" value={exceptionCount} detail={`${metrics.uncostedMovementCount || 0} uncosted · ${metrics.invalidDirectionCount || 0} invalid · ${metrics.unpreparedMovementCount || 0} unprepared`} icon={AlertTriangle} warning={exceptionCount > 0} />
          </section>

          <section className="overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.025]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-5 py-4">
              <div><h2 className="text-base font-semibold">Recent cost-bearing movements</h2><p className="mt-1 text-xs text-foreground/45">Latest 100 typed receipts, consumption, expiry, shrinkage, returns, and adjustments.</p></div>
              <span className="rounded-full border border-foreground/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-foreground/50">{movements.length} rows</span>
            </div>
            {movements.length ? (
              <div className="divide-y divide-foreground/10">
                {movements.map((movement) => (
                  <article key={movement.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.8fr))] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{movement.itemName}</p>
                      <p className="mt-1 truncate text-[11px] text-foreground/45">{[movement.sku, movement.lotCode ? `Lot ${movement.lotCode}` : null, movement.expiresOn ? `Expires ${movement.expiresOn}` : null].filter(Boolean).join(' · ') || 'No SKU or lot'}</p>
                    </div>
                    <div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-foreground/35">Movement</p><p className="mt-1 text-sm">{String(movement.movementType || '').replaceAll('_', ' ')}</p></div>
                    <div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-foreground/35">Quantity / cost</p><p className="mt-1 text-sm tabular-nums">{quantity(movement.quantityDelta)} · {movement.costReady ? money(movement.totalCostCents) : 'Uncosted'}</p></div>
                    <div className="md:text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${statusClass(movement.postingStatus)}`}>{String(movement.postingStatus || 'UNPREPARED').replaceAll('_', ' ')}</span>{!movement.validDirection && <p className="mt-1 text-[10px] font-semibold text-red-700">Direction review required</p>}</div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-5 py-14 text-center"><Boxes className="mx-auto h-7 w-7 text-foreground/25" /><p className="mt-3 text-sm font-semibold">No typed cost movements yet</p><p className="mt-1 text-xs text-foreground/45">This is an honest empty state, not a zero-balance claim.</p></div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
