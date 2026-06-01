import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Check,
  GraduationCap,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Route,
  Settings,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { readLastBooking } from '@/lib/localOs';
import { setKernelNurseEta } from '@/lib/avalonKernel';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import QuickPatientAdd from '@/components/ops/QuickPatientAdd';
import { readQuickPatients } from '@/lib/clientIntakeStore';
import { APPOINTMENTS, getClient, getService, formatTime } from '@/fixtures/commandMockData';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const ACCENT = 'hsl(var(--accent))';

function nextVisit() {
  return APPOINTMENTS
    .filter((appt) => appt.status !== 'completed' && appt.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] || null;
}

function visitModel() {
  const local = readLastBooking();
  const appt = nextVisit();
  const client = appt ? getClient(appt.client_id) : null;
  const service = appt ? getService(appt.service_id) : null;

  if (appt && client) {
    return {
      client: `${client.first_name} ${client.last_name}`,
      service: service?.name || 'Protocol',
      time: formatTime(appt.scheduled_at),
      address: appt.location_address,
      status: appt.status?.replace('_', ' ') || 'Ready',
      value: '$85',
      id: appt.id,
    };
  }

  return {
    client: local?.contact?.name || 'No active visit',
    service: local?.service || 'Ready for assignment',
    time: [local?.date, local?.time].filter(Boolean).join(' · ') || 'Standby',
    address: local?.address || 'Route appears after assignment',
    status: local?.status || 'Ready',
    value: '$85',
    id: local?.id || 'dashboard-shift',
  };
}

function Action({ to, href, onClick, icon: Icon, label, primary = false }) {
  const className = 'flex min-h-[58px] items-center justify-between rounded-2xl px-4 font-body text-[11px] font-bold uppercase tracking-[0.18em] transition-transform active:scale-[0.98]';
  const style = {
    background: primary ? TEXT : CARD,
    color: primary ? INVERT : TEXT,
    border: `1px solid ${primary ? TEXT : BORDER}`,
  };
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
        {label}
      </span>
      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
    </>
  );
  if (href) return <a href={href} className={className} style={style}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={className} style={style}>{body}</button>;
  return <Link to={to} className={className} style={style}>{body}</Link>;
}

function CheckRow({ icon: Icon, label, value, ready = true }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{
          background: ready ? 'hsl(var(--accent) / 0.10)' : CARD_STRONG,
          color: ready ? ACCENT : MUTED,
          border: `1px solid ${ready ? 'hsl(var(--accent) / 0.22)' : BORDER}`,
        }}
      >
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[11px] font-bold uppercase tracking-[0.14em]">{label}</p>
        <p className="truncate text-xs" style={{ color: MUTED }}>{value}</p>
      </div>
      <Check className="h-4 w-4 shrink-0" style={{ color: ready ? ACCENT : DIM }} strokeWidth={2} />
    </div>
  );
}

export default function NurseDashboard() {
  useSeo({
    title: 'Nurse Dashboard - Avalon Vitality',
    description: 'Minimal Avalon nurse dashboard for shift readiness, next visit, route, kit, and protocol review.',
    path: '/provider/dashboard',
    robots: 'noindex, nofollow',
  });

  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const visit = visitModel();
  const nurseName = user?.name || 'Nurse';
  const [latestPatient, setLatestPatient] = useState(() => readQuickPatients(1)[0] || null);

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/" className="font-heading text-2xl tracking-[0.2em]">AV</Link>
          <div className="min-w-0 text-center">
            <p className="truncate font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Nurse</p>
            <p className="truncate text-xs" style={{ color: MUTED }}>{nurseName}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-5 md:px-8 md:pt-8">
        <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr] md:gap-6">
          <div className="rounded-[30px] p-5 md:p-7" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Today</p>
            <h1 className="mt-3 max-w-sm font-heading text-6xl uppercase leading-[0.88] md:text-7xl">
              Shift.<br />Ready.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: MUTED }}>
              One visit. One route. Kit and protocol clear before you move.
            </p>
            <div className="mt-6 grid gap-2">
              <Action to="/provider/shift" icon={Stethoscope} label="Open Shift" primary />
              <QuickPatientAdd
                context="nurse"
                source="Nurse dashboard"
                triggerLabel="New Patient"
                triggerClassName="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.045] px-4 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition-transform active:scale-[0.98]"
                onCreated={(patient) => setLatestPatient(patient)}
              />
              <Action onClick={() => setKernelNurseEta(visit.id, '20 min', nurseName)} icon={CalendarClock} label="Set ETA" />
              <Action href={`sms:+14159807708?body=${encodeURIComponent('Avalon nurse online.')}`} icon={MessageCircle} label="Text Ops" />
            </div>
            {latestPatient && (
              <div className="mt-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] px-3 py-2.5">
                <p className="font-body text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>Just Added</p>
                <p className="mt-1 truncate text-sm" style={{ color: MUTED }}>{latestPatient.name} · {latestPatient.gfeStatus}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Next Visit</p>
                  <h2 className="mt-3 truncate font-heading text-4xl uppercase leading-none md:text-5xl">{visit.client}</h2>
                  <p className="mt-2 truncate text-sm" style={{ color: MUTED }}>{visit.service} · {visit.time}</p>
                </div>
                <span className="rounded-full px-3 py-1 font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
                  {visit.status}
                </span>
              </div>
              <div className="mt-5 flex min-h-[48px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG }}>
                <MapPin className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
                <span className="truncate text-sm" style={{ color: MUTED }}>{visit.address}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['Pay', visit.value],
                ['ETA', 'Nurse set'],
                ['Chart', 'External'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <p className="truncate font-heading text-2xl uppercase leading-none">{value}</p>
                  <p className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
          <section className="rounded-[28px] p-4 md:p-5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Preflight</p>
            <div className="mt-4 grid gap-2">
              <CheckRow icon={ShieldCheck} label="Credential" value="Nurseys clear" />
              <CheckRow icon={Package} label="Kit" value="Count before route" />
              <CheckRow icon={GraduationCap} label="Protocol" value="Review before treatment" />
            </div>
          </section>

          <section className="rounded-[28px] p-4 md:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Tools</p>
            <div className="mt-4 grid gap-2">
              <Action href={`https://maps.apple.com/?q=${encodeURIComponent(visit.address)}`} icon={Navigation} label="Route" />
              <Action to="/provider/role-os?focus=inventory" icon={Package} label="Kit" />
              <Action to="/provider/role-os?focus=protocols" icon={GraduationCap} label="Protocol" />
              <Action to="/provider/settings" icon={Settings} label="Profile" />
            </div>
          </section>
        </div>
      </section>

      <MobileNavBar
        ariaLabel="Nurse navigation"
        columns={5}
        items={[
          { to: '/provider/dashboard', icon: CalendarClock, label: 'Home', exact: true },
          { to: '/provider/shift', icon: Stethoscope, label: 'Shift', primary: true },
          { to: '/provider/communications', icon: MessageCircle, label: 'Text' },
          { to: '/provider/role-os?focus=inventory', icon: Package, label: 'Kit' },
          { to: '/provider/settings', icon: Settings, label: 'Me' },
        ]}
      />
    </main>
  );
}
