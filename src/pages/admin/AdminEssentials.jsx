import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ClipboardList,
  Flame,
  LogOut,
  MessageCircle,
  Package,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import QuickPatientAdd from '@/components/ops/QuickPatientAdd';
import { APPOINTMENTS, NURSES, formatTime, getClient, getService } from '@/fixtures/commandMockData';
import { readQuickPatients } from '@/lib/clientIntakeStore';
import { readActivity, readLastBooking } from '@/lib/localOs';
import { useSeo } from '@/lib/seo';
import { useAuthStore } from '@/lib/useAuthStore';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.56)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';

function Pill({ tone = 'ready', children }) {
  const ready = tone === 'ready';
  return (
    <span
      className="inline-flex min-h-[28px] items-center justify-center rounded-full px-3 font-body text-[9px] font-bold uppercase tracking-[0.16em]"
      style={{
        color: ready ? 'rgb(110,231,183)' : 'rgb(251,191,36)',
        background: ready ? 'rgba(16,185,129,0.08)' : 'rgba(251,191,36,0.08)',
        border: `1px solid ${ready ? 'rgba(16,185,129,0.22)' : 'rgba(251,191,36,0.22)'}`,
      }}
    >
      {children}
    </span>
  );
}

function ActionLink({ to, icon: Icon, label, detail, primary }) {
  return (
    <Link
      to={to}
      className="group flex min-h-[74px] items-center justify-between rounded-[22px] px-4 transition-all active:scale-[0.985]"
      style={{
        background: primary ? TEXT : CARD_STRONG,
        color: primary ? BG : TEXT,
        border: `1px solid ${primary ? TEXT : BORDER}`,
      }}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: primary ? 'hsl(var(--background) / 0.12)' : CARD,
            border: `1px solid ${primary ? 'hsl(var(--background) / 0.16)' : BORDER}`,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[11px] font-bold uppercase tracking-[0.16em]">{label}</span>
          <span className="mt-1 block truncate font-body text-xs" style={{ color: primary ? 'hsl(var(--background) / 0.62)' : MUTED }}>
            {detail}
          </span>
        </span>
      </span>
      <span className="font-body text-lg transition-transform group-hover:translate-x-1">→</span>
    </Link>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-[20px] px-4 py-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: DIM }}>{label}</p>
      <p className="mt-2 font-heading text-4xl uppercase leading-none" style={{ color: TEXT }}>{value}</p>
    </div>
  );
}

function CheckRow({ icon: Icon, label, detail, tone = 'ready' }) {
  return (
    <div className="flex min-h-[66px] items-center gap-3 rounded-[20px] px-3.5 py-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: TEXT }}>{label}</span>
        <span className="mt-1 block truncate font-body text-xs" style={{ color: MUTED }}>{detail}</span>
      </span>
      <Pill tone={tone}>{tone === 'ready' ? 'Yes' : 'Manual'}</Pill>
    </div>
  );
}

export default function AdminEssentials() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const latestBooking = readLastBooking();
  const activity = readActivity().slice(0, 3);
  const [quickPatients, setQuickPatients] = useState(() => readQuickPatients(3));
  const activeVisits = APPOINTMENTS.filter((appt) => !['completed', 'cancelled'].includes(appt.status));
  const nextVisit = activeVisits[0];
  const nextClient = nextVisit ? getClient(nextVisit.client_id) : null;
  const nextService = nextVisit ? getService(nextVisit.service_id) : null;
  const clearNurses = NURSES.filter((nurse) => /clear|active|verified/i.test(nurse.nurseys?.status || nurse.credentialStatus || nurse.credStatus || '')).length || 1;

  useSeo({
    title: 'Admin - Avalon Vitality',
    description: 'Avalon admin essentials for beta operations.',
    robots: 'noindex,nofollow',
  });

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <main className="min-h-dvh pb-24 font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/88 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-heading text-2xl tracking-[0.18em]">AV</span>
            <span className="hidden font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/42 sm:inline">Admin</span>
          </Link>
          <div className="text-center">
            <p className="font-heading text-2xl uppercase leading-none tracking-[0.06em] md:text-3xl">Control</p>
            <p className="mt-1 font-body text-[9px] uppercase tracking-[0.22em]" style={{ color: DIM }}>Today only</p>
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
          <div className="rounded-[30px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Admin</p>
            <h1 className="mt-3 font-heading text-6xl uppercase leading-[0.86] md:text-7xl">Clean<br />Control.</h1>
            <p className="mt-4 max-w-sm font-body text-sm leading-relaxed" style={{ color: MUTED }}>
              Visits, nurses, stock, messages. No boards unless you choose them.
            </p>
            <div className="mt-5 grid gap-2">
              <QuickPatientAdd
                context="admin"
                source="Admin portal"
                triggerLabel="Add Client"
                triggerClassName="flex min-h-[74px] items-center justify-between rounded-[22px] border border-foreground bg-foreground px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.985]"
                onCreated={() => setQuickPatients(readQuickPatients(3))}
              />
              <ActionLink to="/admin/bookings" icon={ClipboardList} label="Visits" detail="Queue and closeout" primary />
              <ActionLink to="/admin/events" icon={Ticket} label="Events" detail="Guest roster" />
              <ActionLink to="/admin/client-heat-map" icon={Flame} label="Heat Map" detail="Ideal clients by SF neighborhood" />
              <ActionLink to="/admin/inventory" icon={Package} label="Stock" detail="Kits and inventory" />
              <ActionLink to="/admin/communications" icon={MessageCircle} label="Comms" detail="Staff and client alerts" />
              <ActionLink to="/admin/credentials" icon={ShieldCheck} label="Safety" detail="Credentials and gates" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metric label="Visits" value={activeVisits.length || 1} />
            <Metric label="Nurses" value={clearNurses} />
            <Metric label="Stock" value="OK" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[30px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>Next</p>
                <p className="mt-1 font-heading text-4xl uppercase leading-none">One visit</p>
              </div>
              <Pill>Ready</Pill>
            </div>
            <div className="rounded-[24px] p-4" style={{ background: 'hsl(var(--foreground) / 0.035)', border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em]">
                {nextClient ? `${nextClient.first_name} ${nextClient.last_name}` : latestBooking?.contact?.name || 'Preview Client'}
              </p>
              <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>
                {nextVisit
                  ? `${formatTime(nextVisit.scheduled_at)} · ${nextService?.name || 'Protocol'} · ${nextVisit.location_city}`
                  : latestBooking
                    ? `${latestBooking.service || latestBooking.plan || 'Protocol'} · ${latestBooking.status || 'Ready'}`
                    : 'Beta queue loaded.'}
              </p>
            </div>
          </div>

          <div className="grid gap-2.5">
            <CheckRow icon={CalendarCheck} label="Booking" detail="Book, checkout, confirm." />
            <CheckRow icon={UserRound} label="Client" detail="Account, prep, messages." />
            <CheckRow icon={Users} label="Nurse" detail="Shift, ETA, route, kit." />
            <CheckRow icon={Package} label="Inventory" detail="Kit and stock views." />
            <CheckRow icon={ShieldCheck} label="Chart" detail="External clinical record." tone="manual" />
          </div>

          {quickPatients.length > 0 && (
            <div className="rounded-[30px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="mb-3 font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>New Clients</p>
              <div className="space-y-2">
                {quickPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5" style={{ background: 'hsl(var(--foreground) / 0.035)' }}>
                    <div className="min-w-0">
                      <p className="truncate font-body text-xs font-semibold" style={{ color: TEXT }}>{patient.name}</p>
                      <p className="truncate font-body text-[10px]" style={{ color: DIM }}>{patient.service} · {patient.gfeStatus}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-1 font-body text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: 'rgb(251,191,36)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)' }}>
                      New
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[30px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="mb-3 font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>Pulse</p>
            <div className="space-y-2">
              {(activity.length ? activity : [{ id: 'ready', text: 'Admin loaded', time: 'now' }]).map((item) => (
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
        ariaLabel="Admin navigation"
        columns={5}
        items={[
          { to: '/admin', icon: Check, label: 'Core', exact: true },
          { to: '/admin/bookings', icon: ClipboardList, label: 'Visits' },
          { to: '/admin/events', icon: Ticket, label: 'Events' },
          { to: '/admin/client-heat-map', icon: Flame, label: 'Heat' },
          { to: '/', icon: ArrowLeft, label: 'Site', exact: true },
        ]}
      />
    </main>
  );
}
