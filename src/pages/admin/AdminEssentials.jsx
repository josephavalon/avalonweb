import { Link } from 'react-router-dom';
import { CreditCard, ArrowRight } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import QuickPatientAdd from '@/components/ops/QuickPatientAdd';
import { useSeo } from '@/lib/seo';

// Beta console — representative figures until the finance integration
// (QuickBooks / Mercury / Gusto) is wired. Real "ready to collect" data lives
// in /admin/bookings, which runs the actual collectBalance() flow.
const KPIS = [
  { label: 'Revenue Today', value: '$4.2K' },
  { label: 'Balances Due', value: '$600' },
  { label: 'Nurse Tips', value: '$180' },
  { label: 'Patients', value: '132' },
];

const READY = [
  { client: 'Sarah J', therapy: 'Hydration IV', visit: 250, addon: 45, tip: 59 },
  { client: 'Mike D', therapy: 'NAD+', visit: 650, addon: 0, tip: 0 },
  { client: 'Emily C', therapy: 'Immunity IV', visit: 250, addon: 0, tip: 40 },
];

function Kpi({ label, value }) {
  return (
    <div className="rounded-2xl border border-foreground/[0.10] bg-foreground/[0.04] px-4 py-3.5">
      <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40">{label}</p>
      <p className="mt-2 font-heading text-3xl uppercase leading-none md:text-4xl">{value}</p>
    </div>
  );
}

export default function AdminEssentials() {
  useSeo({
    title: 'Admin - Avalon Vitality',
    description: 'Avalon admin console — patients, billing, and collections.',
    robots: 'noindex,nofollow',
  });

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

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {KPIS.map((k) => <Kpi key={k.label} label={k.label} value={k.value} />)}
      </div>

      {/* Ready to collect */}
      <section className="mt-6 overflow-hidden rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.03]">
        <div className="flex items-center justify-between border-b border-foreground/[0.08] px-5 py-4">
          <h2 className="font-heading text-2xl uppercase leading-none">Ready to Collect</h2>
          <Link to="/admin/bookings" className="inline-flex items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/50 transition-colors hover:text-foreground">
            All in bookings <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
        <div className="hidden grid-cols-[1.1fr_1.1fr_1.7fr_0.6fr_auto] gap-3 px-5 py-2.5 font-body text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/38 md:grid">
          <span>Client</span><span>Therapy</span><span>Breakdown</span><span>Total</span><span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-foreground/[0.06]">
          {READY.map((r) => {
            const total = r.visit + r.addon + r.tip;
            return (
              <div key={r.client} className="grid grid-cols-1 gap-2 px-5 py-3.5 md:grid-cols-[1.1fr_1.1fr_1.7fr_0.6fr_auto] md:items-center md:gap-3">
                <p className="font-heading text-lg uppercase leading-none text-foreground">{r.client}</p>
                <p className="font-body text-sm text-foreground/72">{r.therapy}</p>
                <p className="font-body text-xs text-foreground/45">
                  Visit ${r.visit}{r.addon ? ` · Add-on $${r.addon}` : ''}{r.tip ? ` · Tip $${r.tip}` : ''}
                </p>
                <p className="font-heading text-lg leading-none text-foreground">${total}</p>
                <Link
                  to="/admin/bookings"
                  className="justify-self-start whitespace-nowrap rounded-xl border border-foreground/82 bg-foreground px-3.5 py-2 font-body text-[10px] font-black uppercase tracking-[0.1em] text-background transition-transform active:scale-[0.99] md:justify-self-end"
                >
                  Complete &amp; Collect
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-5 font-body text-[11px] text-foreground/35">
        Scheduling &amp; nurse dispatch are managed in Acuity. Real collections run from Bookings.
      </p>
    </AdminShell>
  );
}
