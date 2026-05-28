import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock,
  GraduationCap,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Settings,
  Stethoscope,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { readLastBooking } from '@/lib/localOs';
import { setKernelNurseEta } from '@/lib/avalonKernel';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import QuickPatientAdd from '@/components/ops/QuickPatientAdd';
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

function activeVisit() {
  const appt = APPOINTMENTS
    .filter((item) => item.status !== 'completed' && item.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
  const local = readLastBooking();

  if (appt) {
    const client = getClient(appt.client_id);
    const service = getService(appt.service_id);
    return {
      id: appt.id,
      client: client ? `${client.first_name} ${client.last_name}` : 'Avalon Client',
      service: service?.name || 'Protocol',
      time: formatTime(appt.scheduled_at),
      address: appt.location_address,
      phone: client?.phone || '+14159807708',
      status: appt.status?.replace('_', ' ') || 'Ready',
    };
  }

  return {
    id: local?.id || 'local-shift',
    client: local?.contact?.name || 'No active visit',
    service: local?.service || 'Ready for assignment',
    time: [local?.date, local?.time].filter(Boolean).join(' · ') || 'Standby',
    address: local?.address || 'Route appears after assignment',
    phone: local?.contact?.phone || '+14159807708',
    status: local?.status || 'Ready',
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

function EtaButton({ eta, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[52px] rounded-2xl px-3 font-body text-[10px] font-bold uppercase tracking-[0.16em] transition-transform active:scale-[0.98]"
      style={{
        background: selected ? TEXT : CARD,
        color: selected ? INVERT : TEXT,
        border: `1px solid ${selected ? TEXT : BORDER}`,
      }}
    >
      {eta}
    </button>
  );
}

function Checklist({ items }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item} className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'hsl(var(--accent) / 0.10)', color: ACCENT, border: '1px solid hsl(var(--accent) / 0.22)' }}>
            <Check className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="truncate text-sm">{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function NurseShift() {
  useSeo({
    title: 'Nurse Shift - Avalon Vitality',
    description: 'Low-input Avalon nurse shift view for ETA, route, client text, kit, and protocol review.',
    path: '/provider/shift',
    robots: 'noindex, nofollow',
  });

  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const visit = activeVisit();
  const [eta, setEta] = useState('20 min');
  const [stage, setStage] = useState('Ready');
  const [latestPatient, setLatestPatient] = useState(null);
  const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(visit.address)}`;
  const textUrl = `sms:${visit.phone}?body=${encodeURIComponent(`Hi, this is ${user?.name || 'your Avalon nurse'}. My ETA is ${eta}.`)}`;

  const chooseEta = (value) => {
    setEta(value);
    setKernelNurseEta(visit.id, value, user?.name || 'Avalon Nurse');
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[620px] items-center justify-between gap-3">
          <Link to="/" className="font-heading text-2xl tracking-[0.2em]">AV</Link>
          <div className="min-w-0 text-center">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Shift</p>
            <p className="truncate text-xs" style={{ color: MUTED }}>{user?.name || 'Nurse'}</p>
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

      <section className="mx-auto max-w-[620px] px-4 pt-5">
        <div className="rounded-[30px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="rounded-full px-3 py-1 font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
              {stage}
            </span>
            <Clock className="h-5 w-5" style={{ color: ACCENT }} strokeWidth={1.6} />
          </div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Next Visit</p>
          <h1 className="mt-3 truncate font-heading text-6xl uppercase leading-[0.88]">{visit.client}</h1>
          <p className="mt-3 text-sm" style={{ color: MUTED }}>{visit.service} · {visit.time}</p>
          <div className="mt-5 flex min-h-[48px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG }}>
            <MapPin className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
            <span className="truncate text-sm" style={{ color: MUTED }}>{visit.address}</span>
          </div>
        </div>

        <div className="mt-4 rounded-[28px] p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Set ETA</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['10 min', '20 min', '30 min'].map((value) => (
              <EtaButton key={value} eta={value} selected={eta === value} onClick={() => chooseEta(value)} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <Action href={mapsUrl} icon={Navigation} label="Route" primary />
          <Action href={textUrl} icon={MessageCircle} label="Text Client" />
          <QuickPatientAdd
            context="nurse"
            source="Nurse shift"
            triggerLabel="New Patient"
            triggerClassName="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.045] px-4 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition-transform active:scale-[0.98]"
            onCreated={(patient) => setLatestPatient(patient)}
          />
          <Action to="/provider/role-os?focus=inventory" icon={Package} label="Kit" />
          <Action to="/provider/role-os?focus=protocols" icon={GraduationCap} label="Protocol" />
        </div>

        {latestPatient && (
          <div className="mt-4 rounded-[24px] border border-foreground/10 bg-foreground/[0.035] px-4 py-3">
            <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: DIM }}>Added</p>
            <p className="mt-1 truncate text-sm" style={{ color: MUTED }}>{latestPatient.name} · intake needed</p>
          </div>
        )}

        <div className="mt-4 rounded-[28px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Closeout</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['Arrived', 'Started', 'Done'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStage(value)}
                className="min-h-[50px] rounded-2xl px-2 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{
                  background: stage === value ? TEXT : CARD_STRONG,
                  color: stage === value ? INVERT : TEXT,
                  border: `1px solid ${stage === value ? TEXT : BORDER}`,
                }}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[28px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="mb-3 font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Before Treatment</p>
          <Checklist items={['Confirm identity', 'Review protocol', 'Check kit count', 'Document in chart']} />
        </div>
      </section>

      <MobileNavBar
        ariaLabel="Nurse navigation"
        columns={5}
        maxWidth="shift"
        zIndex="high"
        items={[
          { to: '/provider/dashboard', icon: Stethoscope, label: 'Home' },
          { to: '/provider/shift', icon: Stethoscope, label: 'Shift', primary: true, exact: true },
          { href: textUrl, icon: MessageCircle, label: 'Text' },
          { to: '/provider/role-os?focus=inventory', icon: Package, label: 'Kit' },
          { to: '/provider/settings', icon: Settings, label: 'Me' },
        ]}
      />
    </main>
  );
}
