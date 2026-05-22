import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BriefcaseMedical,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Route,
  ShieldCheck,
  Stethoscope,
  Truck,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { advanceLatestBooking } from '@/lib/platformOps';
import { readLastBooking, readLocal } from '@/lib/localOs';
import {
  APPOINTMENTS,
  INVENTORY,
  getClient,
  getService,
  formatTime,
} from '@/fixtures/commandMockData';

const BG = '#080807';
const CARD = 'rgba(255,255,255,0.045)';
const CARD_STRONG = 'rgba(255,255,255,0.075)';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT = '#F5EBDD';
const MUTED = 'rgba(245,235,221,0.62)';
const DIM = 'rgba(245,235,221,0.34)';
const GOLD = '#D3B15F';
const GREEN = '#52D28B';
const RED = '#FF7373';

function nurseIdForUser(user) {
  if (user?.username === 'NURSE001') return 's2';
  return 's2';
}

function sortAppointments(a, b) {
  const statusWeight = { in_progress: 0, confirmed: 1, scheduled: 2, completed: 3 };
  const aw = statusWeight[a.status] ?? 4;
  const bw = statusWeight[b.status] ?? 4;
  if (aw !== bw) return aw - bw;
  return new Date(a.scheduled_at) - new Date(b.scheduled_at);
}

function statusTone(status) {
  if (status === 'confirmed' || status === 'in_progress') return GREEN;
  if (status === 'completed') return DIM;
  return GOLD;
}

function StatCard({ icon: Icon, label, value, sub, tone = TEXT }) {
  return (
    <div className="rounded-[22px] p-4 min-h-[120px] flex flex-col justify-between" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <Icon className="w-5 h-5" style={{ color: tone }} strokeWidth={1.6} />
      <div>
        <p className="font-heading text-4xl leading-none" style={{ color: TEXT }}>{value}</p>
        <p className="font-body text-[10px] tracking-[0.22em] uppercase mt-1" style={{ color: DIM }}>{label}</p>
        {sub && <p className="font-body text-xs mt-2 leading-snug" style={{ color: MUTED }}>{sub}</p>}
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, to, href, tone = TEXT, onClick }) {
  const className = "min-h-[76px] rounded-2xl px-4 flex items-center justify-between text-left transition-transform active:scale-[0.98]";
  const style = { background: CARD_STRONG, border: `1px solid ${BORDER}`, color: tone };
  const content = (
    <>
      <span className="flex items-center gap-3 font-body text-xs tracking-[0.18em] uppercase font-semibold">
        <Icon className="w-5 h-5" strokeWidth={1.7} />
        {label}
      </span>
      <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
    </>
  );
  if (to) return <Link to={to} className={className} style={style}>{content}</Link>;
  if (href) return <a href={href} className={className} style={style}>{content}</a>;
  return <button type="button" onClick={onClick} className={className} style={style}>{content}</button>;
}

function VisitRow({ appt, index }) {
  const client = getClient(appt.client_id);
  const service = getService(appt.service_id);
  if (!client || !service) return null;
  const localStatus = readLocal(`visitStatus.${appt.id}`, appt.status);
  const tone = statusTone(localStatus);
  const risk = !client.intake_completed ? 'Intake needed' : localStatus === 'scheduled' ? 'Confirm arrival' : 'Ready';

  return (
    <Link
      to="/provider/shift"
      className="block rounded-[22px] p-4 transition-transform active:scale-[0.99]"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-heading text-lg" style={{ background: 'rgba(211,177,95,0.12)', color: GOLD, border: '1px solid rgba(211,177,95,0.25)' }}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-2xl uppercase leading-none truncate" style={{ color: TEXT }}>
                {client.first_name} {client.last_name}
              </p>
              <p className="font-body text-sm mt-1 truncate" style={{ color: MUTED }}>{service.name}</p>
            </div>
            <span className="font-body text-[9px] tracking-[0.18em] uppercase rounded-full px-2.5 py-1 shrink-0" style={{ color: tone, background: `${tone}18`, border: `1px solid ${tone}40` }}>
              {localStatus.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 font-body text-xs" style={{ color: MUTED }}>
            <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" strokeWidth={1.5} />{formatTime(appt.scheduled_at)}</span>
            <span className="flex items-center gap-2 min-w-0"><MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} /><span className="truncate">{appt.location_address}</span></span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full px-2.5 py-1 font-body text-[10px] tracking-[0.12em] uppercase" style={{ color: risk === 'Ready' ? GREEN : GOLD, background: 'rgba(255,255,255,0.05)' }}>{risk}</span>
            {client.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full px-2.5 py-1 font-body text-[10px] tracking-[0.12em] uppercase" style={{ color: MUTED, background: 'rgba(255,255,255,0.05)' }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function NurseDashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [latestBooking, setLatestBooking] = useState(() => readLastBooking());
  const nurseId = nurseIdForUser(user);
  const assigned = APPOINTMENTS
    .filter((appt) => appt.nurse_id === nurseId && appt.status !== 'cancelled')
    .sort(sortAppointments);
  const active = assigned.filter((appt) => readLocal(`visitStatus.${appt.id}`, appt.status) !== 'completed');
  const queue = active.length ? active : assigned.slice(0, 3);
  const next = queue[0];
  const completed = assigned.filter((appt) => readLocal(`visitStatus.${appt.id}`, appt.status) === 'completed').length;
  const readyCount = active.filter((appt) => ['confirmed', 'in_progress'].includes(readLocal(`visitStatus.${appt.id}`, appt.status))).length;
  const intakeRisks = active.filter((appt) => !getClient(appt.client_id)?.intake_completed).length;
  const kit = INVENTORY.find((item) => item.assignedTo === 'Stephanie R.') || INVENTORY[0];
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const liveHandoff = latestBooking?.nurse && latestBooking.nurse !== 'Unassigned' && latestBooking?.status !== 'Completed'
    ? latestBooking
    : null;

  useEffect(() => {
    const onLocalChange = (event) => {
      if (event.detail?.key === 'lastBooking') setLatestBooking(readLastBooking());
    };
    window.addEventListener('av.local.change', onLocalChange);
    window.addEventListener('storage', onLocalChange);
    return () => {
      window.removeEventListener('av.local.change', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    };
  }, []);

  const moveLiveHandoff = (status) => {
    const result = advanceLatestBooking(status, { actor: 'nurse' });
    if (result.booking) setLatestBooking(result.booking);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-28" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 px-4 py-3 backdrop-blur-2xl" style={{ background: 'rgba(8,8,7,0.86)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="font-heading text-2xl tracking-[0.2em]" style={{ color: GOLD }}>AV</Link>
          <div className="text-center min-w-0">
            <p className="font-body text-[9px] tracking-[0.26em] uppercase" style={{ color: DIM }}>Nurse Command</p>
            <p className="font-body text-xs truncate" style={{ color: MUTED }}>{user?.name || 'NURSE001'} · {dateLabel}</p>
          </div>
          <button type="button" onClick={handleSignOut} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Sign out">
            <LogOut className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        <section className="rounded-[30px] p-5 sm:p-7 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, rgba(211,177,95,0.16), rgba(255,255,255,0.045) 48%, rgba(255,255,255,0.025))', border: `1px solid ${BORDER}` }}>
          <div className="relative z-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="font-body text-[10px] tracking-[0.32em] uppercase mb-3" style={{ color: GOLD }}>NURSE001</p>
              <h1 className="font-heading text-5xl sm:text-7xl uppercase leading-[0.9] max-w-2xl">
                Shift<br />Command.
              </h1>
              <p className="font-body text-base mt-4 max-w-xl leading-relaxed" style={{ color: MUTED }}>
                Your next visit, route, kit status, client intake, and dispatch actions in one thumb-first command view.
              </p>
            </div>
            <div className="rounded-[24px] p-4" style={{ background: 'rgba(0,0,0,0.24)', border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[10px] tracking-[0.24em] uppercase mb-3" style={{ color: DIM }}>Next Stop</p>
              {next ? (
                <>
                  <p className="font-heading text-3xl uppercase leading-none" style={{ color: TEXT }}>{getClient(next.client_id)?.first_name} {getClient(next.client_id)?.last_name}</p>
                  <p className="font-body text-sm mt-2" style={{ color: MUTED }}>{getService(next.service_id)?.name} · {formatTime(next.scheduled_at)}</p>
                  <p className="font-body text-sm mt-2 flex items-center gap-2" style={{ color: MUTED }}><MapPin className="w-4 h-4" />{next.location_address}</p>
                </>
              ) : (
                <p className="font-body text-sm" style={{ color: MUTED }}>No active visits assigned.</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={CalendarClock} label="Active Visits" value={active.length} sub={`${completed} completed in history`} tone={GOLD} />
          <StatCard icon={ShieldCheck} label="Ready" value={readyCount} sub="Cleared or confirmed" tone={GREEN} />
          <StatCard icon={AlertCircle} label="Needs Review" value={intakeRisks} sub="Intake or pre-visit gap" tone={intakeRisks ? RED : GREEN} />
          <StatCard icon={BriefcaseMedical} label="Kit" value={kit?.status === 'Ready' ? 'OK' : '!'} sub={kit ? `${kit.name}: ${kit.status}` : 'No kit assigned'} tone={kit?.status === 'Ready' ? GREEN : GOLD} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <ActionButton icon={Stethoscope} label="Open Shift Flow" to="/provider/shift" tone={GOLD} />
          <ActionButton icon={Route} label="Route Next Stop" href={next ? `maps://?q=${encodeURIComponent(`${next.location_address}, ${next.location_city}`)}` : undefined} tone={TEXT} />
          <ActionButton icon={Phone} label="Call Dispatch" href="tel:+14155550101" tone={TEXT} />
          <ActionButton icon={MessageCircle} label="Text Client" href={next ? `sms:${getClient(next.client_id)?.phone}` : undefined} tone={TEXT} />
        </section>

        {liveHandoff && (
          <section className="rounded-[26px] p-4" style={{ background: 'rgba(211,177,95,0.10)', border: '1px solid rgba(211,177,95,0.26)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[10px] tracking-[0.28em] uppercase" style={{ color: GOLD }}>Live Handoff</p>
                <h2 className="font-heading text-3xl uppercase leading-none mt-2" style={{ color: TEXT }}>{liveHandoff.service}</h2>
                <p className="font-body text-sm mt-2" style={{ color: MUTED }}>{[liveHandoff.date, liveHandoff.time, liveHandoff.address].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="rounded-full px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: GREEN, background: 'rgba(82,210,139,0.12)', border: '1px solid rgba(82,210,139,0.28)' }}>
                {liveHandoff.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => moveLiveHandoff('En Route')} className="min-h-[52px] rounded-2xl font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}>En Route</button>
              <button type="button" onClick={() => moveLiveHandoff('Arrived')} className="min-h-[52px] rounded-2xl font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}>Arrived</button>
              <button type="button" onClick={() => moveLiveHandoff('Completed')} className="min-h-[52px] rounded-2xl font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: TEXT, color: BG }}>Complete</button>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="font-body text-[10px] tracking-[0.32em] uppercase" style={{ color: DIM }}>Assigned Queue</p>
              <h2 className="font-heading text-3xl uppercase mt-1" style={{ color: TEXT }}>Visit Cards</h2>
            </div>
            <Link to="/provider/clients" className="font-body text-[10px] tracking-[0.18em] uppercase" style={{ color: GOLD }}>Clients</Link>
          </div>
          <div className="space-y-3">
            {queue.length ? queue.map((appt, index) => <VisitRow key={appt.id} appt={appt} index={index} />) : (
              <div className="rounded-[22px] p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
                No visits assigned to this nurse.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: FileText, label: 'Consent packets', value: 'Review before starting every visit' },
            { icon: Truck, label: 'Mileage', value: 'Log route and parking notes after shift' },
            { icon: CheckCircle2, label: 'Closeout', value: 'Vitals, SOAP, supply usage, follow-up' },
          ].map((item) => (
            <div key={item.label} className="rounded-[22px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <item.icon className="w-5 h-5 mb-5" style={{ color: GOLD }} strokeWidth={1.5} />
              <p className="font-heading text-xl uppercase leading-none" style={{ color: TEXT }}>{item.label}</p>
              <p className="font-body text-xs mt-2 leading-relaxed" style={{ color: MUTED }}>{item.value}</p>
            </div>
          ))}
        </section>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] backdrop-blur-2xl" style={{ background: 'rgba(8,8,7,0.9)', borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-2">
          <Link to="/provider/dashboard" className="flex min-h-[56px] items-center justify-center rounded-2xl text-center font-body text-[10px] tracking-[0.18em] uppercase" style={{ background: CARD_STRONG, color: GOLD, border: `1px solid ${BORDER}` }}>Command</Link>
          <Link to="/provider/shift" className="flex min-h-[56px] items-center justify-center rounded-2xl text-center font-body text-[10px] tracking-[0.18em] uppercase" style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>Shift</Link>
          <Link to="/provider/settings" className="flex min-h-[56px] items-center justify-center rounded-2xl text-center font-body text-[10px] tracking-[0.18em] uppercase" style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>Settings</Link>
        </div>
      </nav>
    </div>
  );
}
