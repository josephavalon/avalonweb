import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ArrowRight } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import QuickPatientAdd from '@/components/ops/QuickPatientAdd';
import FirstSessionWelcome from '@/components/admin/FirstSessionWelcome';
import { apiGet } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';

function fmtMoney(amount) {
  const n = Number(amount || 0);
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function Kpi({ label, value, loading }) {
  return (
    <div className="rounded-2xl border border-foreground/[0.10] bg-foreground/[0.04] px-4 py-3.5">
      <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-foreground/[0.08]" />
      ) : (
        <p className="mt-2 font-heading text-3xl uppercase leading-none md:text-4xl">{value}</p>
      )}
    </div>
  );
}

function deriveKpis(summary) {
  if (!summary) return [];
  return [
    { label: 'Revenue 30d',       value: fmtMoney(summary.last30Days?.amount) },
    { label: 'Balances Due',      value: fmtMoney(summary.outstandingBalances?.amount) },
    { label: 'Outstanding Visits',value: String(summary.outstandingBalances?.count ?? 0) },
    { label: 'Active Plans',      value: String(summary.activeSubscriptions?.count ?? 0) },
  ];
}

function loadStateFromSummary(summary, err) {
  if (err) return 'error';
  if (!summary) return 'loading';
  const hasActivity =
    Number(summary.last30Days?.count || 0) > 0 ||
    Number(summary.outstandingBalances?.count || 0) > 0 ||
    Number(summary.activeSubscriptions?.count || 0) > 0;
  return hasActivity ? 'ready' : 'empty';
}

export default function AdminEssentials() {
  useSeo({
    title: 'Admin - Avalon Vitality',
    description: 'Avalon admin console — patients, billing, and collections.',
    robots: 'noindex,nofollow',
  });

  const { user } = useAuthStore();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiGet('/api/admin/finance/summary')
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, []);

  const state = loadStateFromSummary(summary, error);
  const kpis = state === 'ready' ? deriveKpis(summary) : [];
  const outstandingRows = state === 'ready' ? (summary.outstandingBalances?.rows || []).slice(0, 5) : [];

  return (
    <AdminShell title="Dashboard">
      {/* Two core jobs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickPatientAdd
          context="admin"
          source="Admin portal"
          triggerLabel="Add Patient"
          triggerClassName="flex min-h-[64px] w-full items-center justify-center gap-2.5 rounded-2xl border border-foreground bg-foreground px-5 font-body text-xs font-black uppercase tracking-[0.14em] text-background transition-transform active:scale-[0.99]"
        />
        <Link
          to="/admin/bookings"
          className="flex min-h-[64px] w-full items-center justify-center gap-2.5 rounded-2xl border border-foreground/16 bg-foreground/[0.05] px-5 font-body text-xs font-black uppercase tracking-[0.14em] text-foreground transition-colors hover:border-foreground/32"
        >
          <CreditCard className="h-4 w-4" strokeWidth={1.9} /> Bill Patient
        </Link>
      </div>

      {/* KPIs — skeleton while loading, real data when ready, hidden on welcome states */}
      {(state === 'loading' || state === 'ready') && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4" data-testid="admin-kpis" data-state={state}>
          {state === 'loading'
            ? ['Revenue 30d', 'Balances Due', 'Outstanding Visits', 'Active Plans'].map((label) => (
                <Kpi key={label} label={label} loading />
              ))
            : kpis.map((k) => <Kpi key={k.label} label={k.label} value={k.value} />)}
        </div>
      )}

      {/* Ready to collect — real outstanding rows when present */}
      {state === 'ready' && outstandingRows.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.03]">
          <div className="flex items-center justify-between border-b border-foreground/[0.08] px-5 py-4">
            <h2 className="font-heading text-2xl uppercase leading-none">Ready to Collect</h2>
            <Link to="/admin/bookings" className="inline-flex items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/50 transition-colors hover:text-foreground">
              All in bookings <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="hidden grid-cols-[1.4fr_1.4fr_0.8fr_auto] gap-3 px-5 py-2.5 font-body text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/38 md:grid">
            <span>Client</span><span>Service</span><span>Balance</span><span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-foreground/[0.06]">
            {outstandingRows.map((r) => (
              <div key={r.id} className="grid grid-cols-1 gap-2 px-5 py-3.5 md:grid-cols-[1.4fr_1.4fr_0.8fr_auto] md:items-center md:gap-3">
                <p className="font-heading text-lg uppercase leading-none text-foreground">{r.customerName || 'Client'}</p>
                <p className="font-body text-sm text-foreground/72">{r.service}</p>
                <p className="font-heading text-lg leading-none text-foreground">{fmtMoney(r.balanceDue)}</p>
                <Link
                  to="/admin/bookings"
                  className="justify-self-start whitespace-nowrap rounded-xl border border-foreground/82 bg-foreground px-3.5 py-2 font-body text-[10px] font-black uppercase tracking-[0.1em] text-background transition-transform active:scale-[0.99] md:justify-self-end"
                >
                  Complete &amp; Collect
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* First-session / error fallback */}
      {(state === 'empty' || state === 'error') && (
        <FirstSessionWelcome
          userName={user?.name}
          role={user?.role}
          variant={state === 'error' ? 'error' : 'empty'}
        />
      )}

      <p className="mt-5 font-body text-[11px] text-foreground/35">
        Scheduling, clinical review, and nurse dispatch are managed in Acuity. Real collections run from Bookings.
      </p>
    </AdminShell>
  );
}
