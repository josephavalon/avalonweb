import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Loader2, RefreshCw, TrendingUp, WalletCards } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
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

function fmtDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: DIM }}>{label}</p>
        <Icon className="h-4 w-4" style={{ color: DIM }} strokeWidth={1.8} />
      </div>
      <p className="font-heading text-4xl uppercase leading-none" style={{ color: TEXT }}>{value}</p>
      <p className="mt-1 font-body text-xs" style={{ color: MUTED }}>{detail}</p>
    </div>
  );
}

export default function FinanceControl() {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await apiGet('/api/admin/finance/summary');
      setState({ loading: false, error: '', data });
    } catch {
      setState({ loading: false, error: 'Could not load finance summary.', data: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = state.data || {};
  const outstandingRows = data.outstandingBalances?.rows || [];

  return (
    <AdminShell
      title="Finance"
      actions={(
        <button
          type="button"
          onClick={load}
          disabled={state.loading}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/60 disabled:opacity-45"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} strokeWidth={2} />
          Refresh
        </button>
      )}
    >
      <div className="space-y-6">
        {state.error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 font-body text-sm text-red-200">
            {state.error}
          </div>
        ) : null}

        {state.loading ? (
          <div className="flex items-center gap-2 rounded-2xl p-5 font-body text-sm" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Loading live finance data
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          <Metric
            label="Last 30 Days"
            value={money(data.last30Days?.amount)}
            detail={`${data.last30Days?.count || 0} paid-in-full appointment${data.last30Days?.count === 1 ? '' : 's'}`}
            icon={TrendingUp}
          />
          <Metric
            label="Outstanding"
            value={money(data.outstandingBalances?.amount)}
            detail={`${data.outstandingBalances?.count || 0} balance${data.outstandingBalances?.count === 1 ? '' : 's'} to collect`}
            icon={CreditCard}
          />
          <Metric
            label="Active Plans"
            value={data.activeSubscriptions?.count || 0}
            detail="Stripe active subscriptions"
            icon={Calendar}
          />
          <Metric
            label="Payouts"
            value={(data.payouts || []).length}
            detail="Last Stripe payouts loaded"
            icon={WalletCards}
          />
        </section>

        <section className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Stripe</p>
              <h2 className="font-heading text-3xl uppercase leading-none">Payouts</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left font-body text-sm">
              <thead className="text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>
                <tr><th className="py-2">Payout</th><th>Status</th><th>Arrival</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.06]">
                {(data.payouts || []).map((payout) => (
                  <tr key={payout.id}>
                    <td className="py-3 text-foreground/75">{payout.id}</td>
                    <td className="capitalize text-foreground/60">{payout.status}</td>
                    <td className="text-foreground/60">{fmtDate(payout.arrivalDate)}</td>
                    <td className="text-right font-semibold">{money(payout.amount)}</td>
                  </tr>
                ))}
                {!state.loading && !(data.payouts || []).length ? (
                  <tr><td colSpan={4} className="py-6 text-center text-foreground/45">No payouts returned by Stripe.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Collections</p>
              <h2 className="font-heading text-3xl uppercase leading-none">Outstanding Balances</h2>
            </div>
            <Link to="/admin/bookings" className="rounded-full px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: TEXT, background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              Open bookings
            </Link>
          </div>
          <div className="grid gap-2">
            {outstandingRows.map((row) => (
              <Link key={row.id} to="/admin/bookings" className="grid gap-2 rounded-2xl p-3 md:grid-cols-[1.2fr_1fr_auto]" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <span>
                  <span className="block font-body text-sm font-semibold">{row.customerName}</span>
                  <span className="block truncate font-body text-xs" style={{ color: MUTED }}>{row.customerEmail || row.service}</span>
                </span>
                <span className="font-body text-xs" style={{ color: MUTED }}>{fmtDate(row.startsAt)} · {row.service}</span>
                <span className="font-body text-sm font-bold md:text-right">{money(row.balanceDue)}</span>
              </Link>
            ))}
            {!state.loading && outstandingRows.length === 0 ? (
              <p className="rounded-2xl p-5 text-center font-body text-sm" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: MUTED }}>
                No outstanding balances.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
