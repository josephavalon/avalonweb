import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Loader2, RefreshCw, Tag, TrendingUp, WalletCards } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet } from '@/lib/apiClient';
import { assertApiResponse, hasObjectRows, invalidApiResponse } from '@/lib/apiResponse';

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

function fmtDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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

function DiscountBadge({ row }) {
  return (
    <span className="inline-flex min-h-[26px] items-center rounded-full px-2.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: row.fullComp ? 'hsl(150 60% 45%)' : MUTED, background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
      {row.fullComp ? 'Full comp' : row.discountType || 'Discount'}
    </span>
  );
}

export default function FinanceControl() {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [discountState, setDiscountState] = useState({ loading: true, error: '', rows: null });
  const [tab, setTab] = useState('summary');

  const load = useCallback(async () => {
    setState({ loading: true, error: '', data: null });
    setDiscountState({ loading: true, error: '', rows: null });
    const [summaryResult, discountResult] = await Promise.allSettled([
      apiGet('/api/admin/finance/summary'),
      apiGet('/api/admin/discounts'),
    ]);

    if (summaryResult.status === 'fulfilled') {
      try {
        const summary = assertApiResponse(summaryResult.value, {
          arrays: ['outstandingBalances.rows', 'payouts'],
          objects: ['last30Days', 'depositsTaken', 'outstandingBalances', 'activeSubscriptions'],
          numbers: [
            'last30Days.count', 'last30Days.amount',
            'depositsTaken.count', 'depositsTaken.amount',
            'outstandingBalances.count', 'outstandingBalances.amount',
            'activeSubscriptions.count',
          ],
        }, 'Finance returned an invalid summary response.');
        if (!hasObjectRows(summary.outstandingBalances.rows) || !hasObjectRows(summary.payouts)) {
          throw invalidApiResponse('Finance returned invalid summary records.');
        }
        setState({ loading: false, error: '', data: summary });
      } catch {
        setState({ loading: false, error: 'Could not verify finance summary.', data: null });
      }
    } else {
      setState({ loading: false, error: 'Could not load finance summary.', data: null });
    }

    if (discountResult.status === 'fulfilled') {
      try {
        const discounts = assertApiResponse(discountResult.value, { arrays: ['discounts'] }, 'Finance returned an invalid discount response.');
        if (!hasObjectRows(discounts.discounts)) throw invalidApiResponse('Finance returned invalid discount records.');
        setDiscountState({ loading: false, error: '', rows: discounts.discounts });
      } catch {
        setDiscountState({ loading: false, error: 'Could not verify discount redemptions.', rows: null });
      }
    } else {
      setDiscountState({ loading: false, error: 'Could not load discount redemptions.', rows: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = state.data || {};
  const outstandingRows = data.outstandingBalances?.rows || [];
  const discountRows = discountState.rows || [];
  const fullCompCount = discountRows.filter((row) => row.fullComp).length;
  const discountTotal = discountRows.reduce((sum, row) => sum + Number(row.amountDiscount || 0), 0);

  if (!state.loading && state.error && state.data === null) {
    return (
      <AdminShell title="Finance">
        <OperationalSourceUnavailable
          title="Finance source unavailable"
          description="Finance totals, payouts, balances, and collections could not be verified. No zeroed or sample finance metrics are shown, and finance actions remain disabled until the live source reconnects."
        />
      </AdminShell>
    );
  }

  if (state.loading && state.data === null) {
    return <AdminShell title="Finance"><div className="flex min-h-[28rem] items-center justify-center text-foreground/45"><Loader2 className="h-5 w-5 animate-spin" /></div></AdminShell>;
  }

  if (tab === 'discounts' && discountState.loading) {
    return <AdminShell title="Finance"><div className="flex min-h-[28rem] items-center justify-center text-foreground/45"><Loader2 className="h-5 w-5 animate-spin" /></div></AdminShell>;
  }

  if (tab === 'discounts' && discountState.error && discountState.rows === null) {
    return (
      <AdminShell title="Finance">
        <OperationalSourceUnavailable
          title="Discount source unavailable"
          description="Discount redemptions and totals could not be verified. No zeroed metrics or empty-state claims are shown until the live Stripe source reconnects."
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Finance"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/nurse-invoices" className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/60">
            Nurse invoices
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={state.loading}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.045] px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/60 disabled:opacity-45"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} strokeWidth={2} />
            Refresh
          </button>
        </div>
      )}
    >
      <div className="space-y-6">
        {state.error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 font-body text-sm text-red-200">
            {state.error}
          </div>
        ) : null}
        {discountState.error ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 font-body text-sm text-amber-100">
            {discountState.error}
          </div>
        ) : null}

        {(tab === 'summary' && state.loading) || (tab === 'discounts' && discountState.loading) ? (
          <div className="flex items-center gap-2 rounded-2xl p-5 font-body text-sm" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            {tab === 'discounts' ? 'Loading discount redemptions' : 'Loading live finance data'}
          </div>
        ) : null}

        <div className="flex w-full gap-1 rounded-2xl p-1 sm:w-fit" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {[
            ['summary', 'Summary'],
            ['discounts', 'Discounts'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="min-h-10 flex-1 rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] transition-colors sm:flex-none"
              style={{
                background: tab === key ? TEXT : 'transparent',
                color: tab === key ? 'hsl(var(--background))' : MUTED,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'summary' ? (
          <>
        <section className="grid gap-3 md:grid-cols-5">
          <Metric
            label="Deposits Taken"
            value={money(data.depositsTaken?.amount)}
            detail={`${data.depositsTaken?.count || 0} deposit${data.depositsTaken?.count === 1 ? '' : 's'} collected`}
            icon={WalletCards}
          />
          <Metric
            label="Last 30 Days"
            value={money(data.last30Days?.amount)}
            detail={`${data.last30Days?.count || 0} charge${data.last30Days?.count === 1 ? '' : 's'} across all sources`}
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
          </>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <Metric
                label="Redeemers"
                value={discountRows.length}
                detail="Discounted checkouts recorded"
                icon={Tag}
              />
              <Metric
                label="Full Comps"
                value={fullCompCount}
                detail="100% codes with no balance due"
                icon={CreditCard}
              />
              <Metric
                label="Discounted"
                value={money(discountTotal)}
                detail="Checkout discount amount tracked"
                icon={TrendingUp}
              />
            </section>

            <section className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Stripe</p>
                  <h2 className="font-heading text-3xl uppercase leading-none">Discount Redemptions</h2>
                </div>
                <button
                  type="button"
                  onClick={load}
                  disabled={discountState.loading}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-45"
                  style={{ color: TEXT, background: CARD_STRONG, border: `1px solid ${BORDER}` }}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${discountState.loading ? 'animate-spin' : ''}`} strokeWidth={2} />
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left font-body text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>
                    <tr>
                      <th className="py-2">Customer</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Order</th>
                      <th>Redeemed</th>
                      <th className="text-right">Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/[0.06]">
                    {discountRows.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3">
                          <span className="block font-semibold text-foreground/80">{row.customerName}</span>
                          <span className="block max-w-[220px] truncate text-xs" style={{ color: MUTED }}>{row.customerEmail || row.service}</span>
                        </td>
                        <td>
                          <span className="block font-semibold text-foreground/75">{row.code}</span>
                          <span className="block text-xs" style={{ color: DIM }}>{row.couponName || row.stripePromotionCodeId || row.stripeCouponId}</span>
                        </td>
                        <td><DiscountBadge row={row} /></td>
                        <td>
                          <span className="block text-foreground/70">{row.orderNumber || row.appointmentId?.slice?.(0, 8) || '—'}</span>
                          <span className="block max-w-[180px] truncate text-xs" style={{ color: DIM }}>{row.service}</span>
                        </td>
                        <td className="text-foreground/60">{fmtDateTime(row.redeemedAt)}</td>
                        <td className="text-right font-semibold">{money(row.amountDiscount)}</td>
                      </tr>
                    ))}
                    {!discountState.loading && discountRows.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-foreground/45">No discount redemptions recorded yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
