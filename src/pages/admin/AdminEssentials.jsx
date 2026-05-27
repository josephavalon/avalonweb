import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ClipboardList,
  LogOut,
  MessageCircle,
  Package,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import { APPOINTMENTS, NURSES, getClient, getService, formatTime } from '@/fixtures/commandMockData';
import { readActivity, readLastBooking } from '@/lib/localOs';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.58)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const ACCENT = 'hsl(var(--accent))';

function Status({ yes, label }) {
  return (
    <span
      className="inline-flex min-w-[54px] items-center justify-center rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.16em]"
      style={{
        color: yes ? 'rgb(110,231,183)' : 'rgb(248,113,113)',
        background: yes ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)',
        border: `1px solid ${yes ? 'rgba(16,185,129,0.22)' : 'rgba(248,113,113,0.22)'}`,
      }}
    >
      {label || (yes ? 'Yes' : 'No')}
    </span>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-[22px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: DIM }}>{label}</p>
      <p className="mt-3 font-heading text-5xl uppercase leading-none" style={{ color: TEXT }}>{value}</p>
      <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: MUTED }}>{detail}</p>
    </div>
  );
}

function ActionLink({ to, icon: Icon, label, primary }) {
  return (
    <Link
      to={to}
      className="flex min-h-[54px] items-center justify-between rounded-2xl px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-transform active:scale-[0.98]"
      style={{
        background: primary ? TEXT : CARD_STRONG,
        color: primary ? BG : TEXT,
        border: `1px solid ${primary ? TEXT : BORDER}`,
      }}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
        {label}
      </span>
      <span style={{ color: primary ? BG : DIM }}>→</span>
    </Link>
  );
}

function ReadinessRow({ icon: Icon, label, detail, yes = true, status }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: TEXT }}>{label}</p>
        <p className="mt-1 truncate font-body text-xs" style={{ color: MUTED }}>{detail}</p>
      </div>
      <Status yes={yes} label={status} />
    </div>
  );
}

export default function AdminEssentials() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const latestBooking = readLastBooking();
  const activity = readActivity().slice(0, 4);
  const activeVisits = APPOINTMENTS.filter((appt) => appt.status !== 'completed' && appt.status !== 'cancelled');
  const nextVisit = activeVisits[0];
  const nextClient = nextVisit ? getClient(nextVisit.client_id) : null;
  const nextService = nextVisit ? getService(nextVisit.service_id) : null;
  const clearNurses = NURSES.filter((nurse) => /clear|active|verified/i.test(nurse.nurseys?.status || nurse.credentialStatus || nurse.credStatus || '')).length;

  useSeo({
    title: 'Admin Essentials - Avalon Vitality',
    description: 'Avalon admin essentials: live local workflow readiness and the few controls needed for beta operations.',
    robots: 'noindex,nofollow',
  });

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <main className="min-h-dvh pb-28 font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/88 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-heading text-2xl tracking-[0.18em]">AV</span>
            <span className="hidden font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/42 sm:inline">Admin</span>
          </Link>
          <div className="text-center">
            <p className="font-heading text-2xl uppercase leading-none tracking-[0.08em] md:text-3xl">Command</p>
            <p className="mt-1 font-body text-[9px] uppercase tracking-[0.22em]" style={{ color: DIM }}>Bare essentials</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/[0.10] bg-foreground/[0.045] text-foreground/60"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pt-5 md:grid-cols-[0.82fr_1.18fr] md:gap-8 md:px-8 md:pt-8">
        <div className="space-y-5">
          <div className="rounded-[28px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Today</p>
            <h1 className="mt-3 font-heading text-6xl uppercase leading-[0.88] md:text-7xl">Working?</h1>
            <p className="mt-4 max-w-sm font-body text-sm leading-relaxed" style={{ color: MUTED }}>
              Only what matters for the beta: bookings, visits, nurses, inventory, messages.
            </p>
            <div className="mt-5 grid gap-2">
              <ActionLink to="/admin/bookings" icon={ClipboardList} label="Visits" primary />
              <ActionLink to="/admin/inventory" icon={Package} label="Inventory" />
              <ActionLink to="/admin/communications" icon={MessageCircle} label="Messages" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Visits" value={activeVisits.length || 1} detail="Open or ready." />
            <Metric label="Nurses" value={clearNurses || 1} detail="Credential-clear in beta." />
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-2.5">
            <ReadinessRow icon={CalendarCheck} label="Booking flow" detail={latestBooking ? `Last booking ${latestBooking.reference || latestBooking.id}` : 'Book, checkout, confirmation load locally.'} yes />
            <ReadinessRow icon={UserRound} label="Client portal" detail="Dashboard, account, and messages load." yes />
            <ReadinessRow icon={Users} label="Nurse portal" detail="Shift, ETA, route, kit, and protocol packet load." yes />
            <ReadinessRow icon={Package} label="Inventory" detail="Stock, kit, deduction, and restock views load." yes />
            <ReadinessRow icon={ShieldCheck} label="Clinical record" detail="External charting is off in beta." yes={false} status="Off" />
          </div>

          <div className="rounded-[28px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>Next move</p>
                <p className="mt-1 font-heading text-3xl uppercase leading-none">One visit</p>
              </div>
              <Status yes label="Ready" />
            </div>
            <div className="rounded-[22px] p-4" style={{ background: 'hsl(var(--foreground) / 0.035)', border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em]">{nextClient ? `${nextClient.first_name} ${nextClient.last_name}` : latestBooking?.contact?.name || 'Preview Client'}</p>
              <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>
                {nextVisit
                  ? `${formatTime(nextVisit.scheduled_at)} · ${nextService?.name || 'Protocol'} · ${nextVisit.location_city}`
                  : latestBooking
                    ? `${latestBooking.service || latestBooking.plan || 'Protocol'} · ${latestBooking.status || 'Ready'}`
                    : 'Beta visit queue loaded.'}
              </p>
            </div>
          </div>

          <div className="rounded-[28px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="mb-3 font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>Latest</p>
            <div className="space-y-2">
              {(activity.length ? activity : [{ id: 'ready', text: 'Admin essentials loaded', time: 'now' }]).map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: 'hsl(var(--foreground) / 0.035)' }}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.08)', color: 'rgb(110,231,183)' }}>
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-body text-xs" style={{ color: TEXT }}>{item.text}</p>
                    <p className="font-body text-[10px]" style={{ color: DIM }}>{item.time || item.createdAt || 'local'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MobileNavBar
        ariaLabel="Admin quick navigation"
        columns={5}
        items={[
          { to: '/admin', icon: Check, label: 'Core', exact: true },
          { to: '/admin/bookings', icon: ClipboardList, label: 'Visits' },
          { to: '/admin/inventory', icon: Package, label: 'Stock' },
          { to: '/admin/communications', icon: MessageCircle, label: 'Comms' },
          { to: '/', icon: ArrowLeft, label: 'Site', exact: true },
        ]}
      />
    </main>
  );
}
