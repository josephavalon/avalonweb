import { useEffect, useState } from 'react';
import CommunicationCenter from '@/components/messaging/CommunicationCenter';
import ClinicalClearancePanel from '@/components/clinical/ClinicalClearancePanel';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Car,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Route,
  Send,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import {
  buildAvalonKernelSnapshot,
  setKernelNurseEta,
} from '@/lib/avalonKernel';
import {
  addMileageEntry,
  advanceLatestBooking,
  acceptShiftBroadcast,
  appleMapsUrl,
  buildKitControlTower,
  buildNurseRoutePreview,
  buildTrainingControlTower,
  declineShiftBroadcast,
  googleMapsUrl,
  readAssignmentBroadcasts,
  readNurseAlertSettings,
  readMileageLog,
  seedAssignmentBroadcastsFromLatestBooking,
} from '@/lib/platformOps';
import { readLastBooking, readLocal } from '@/lib/localOs';
import {
  buildUnifiedOperationalTruth,
  syncLocalRepository,
} from '@/lib/localRepository';
import { evaluateClinicalClearance } from '@/lib/clinicalClearance';
import { SEED_ITEMS } from '@/data/inventorySeed';
import {
  APPOINTMENTS,
  NURSES,
  getClient,
  getService,
  formatTime,
} from '@/fixtures/commandMockData';

const BG = 'hsl(var(--background))';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const ACCENT = 'hsl(var(--accent))';
const RED = 'rgb(248,113,113)';

function fallbackNurseRecord(user) {
  return {
    id: 'nurse-local-preview',
    name: user?.name || 'Avalon Nurse',
    status: 'Ready',
    area: 'Bay Area',
    phone: '',
    credentialStatus: 'Clear',
    credStatus: 'Clear',
    nurseys: { status: 'Clear' },
    kitStatus: 'Ready',
    todayVisits: 0,
    visitsToday: 0,
    source: 'local-preview-fallback',
  };
}

function nurseIdForUser(user) {
  if (user?.username === 'NURSE001') return 's2';
  return 's2';
}

function nurseRecordForUser(user) {
  const name = String(user?.name || '').toLowerCase();
  return NURSES.filter(Boolean).find((nurse) => String(nurse.name || '').toLowerCase() === name)
    || NURSES.filter(Boolean)[0]
    || fallbackNurseRecord(user);
}

function sortAppointments(a, b) {
  const statusWeight = { in_progress: 0, confirmed: 1, scheduled: 2, completed: 3 };
  const aw = statusWeight[a.status] ?? 4;
  const bw = statusWeight[b.status] ?? 4;
  if (aw !== bw) return aw - bw;
  return new Date(a.scheduled_at) - new Date(b.scheduled_at);
}

function statusTone(status) {
  if (status === 'confirmed' || status === 'in_progress') return ACCENT;
  if (status === 'completed') return DIM;
  return MUTED;
}

function StatCard({ icon: Icon, label, value, sub, tone = TEXT }) {
  return (
    <div className="rounded-[22px] p-4 min-h-[120px] flex flex-col justify-between" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <Icon className="w-5 h-5" style={{ color: tone }} strokeWidth={1.6} />
      <div>
        <p className="font-heading text-4xl leading-none" style={{ color: TEXT }}>{value}</p>
        <p className="font-body text-[11px] tracking-[0.16em] uppercase mt-1" style={{ color: DIM }}>{label}</p>
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

function ReadinessTile({ icon: Icon, label, value, detail, tone = TEXT, to }) {
  const body = (
    <div className="rounded-[22px] p-4 min-h-[142px] flex flex-col justify-between transition-transform active:scale-[0.99]" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between gap-3">
        <Icon className="w-5 h-5" style={{ color: tone }} strokeWidth={1.6} />
        <ArrowRight className="w-4 h-4" style={{ color: DIM }} strokeWidth={1.6} />
      </div>
      <div>
        <p className="font-heading text-3xl uppercase leading-none" style={{ color: TEXT }}>{value}</p>
        <p className="font-body text-[10px] tracking-[0.18em] uppercase mt-1" style={{ color: DIM }}>{label}</p>
        <p className="font-body text-xs mt-2 leading-snug" style={{ color: MUTED }}>{detail}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function VisitRow({ appt, index }) {
  const client = getClient(appt.client_id);
  const service = getService(appt.service_id);
  if (!client || !service) return null;
  const localStatus = readLocal(`visitStatus.${appt.id}`, appt.status);
  const tone = statusTone(localStatus);

  return (
    <Link
      to="/provider/shift"
      className="block rounded-[22px] p-4 transition-transform active:scale-[0.99]"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-heading text-lg" style={{ background: 'hsl(var(--accent) / 0.08)', color: ACCENT, border: '1px solid hsl(var(--accent) / 0.20)' }}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-2xl uppercase leading-none truncate" style={{ color: TEXT }}>
                {client.first_name} {client.last_name}
              </p>
              <p className="font-body text-sm mt-1 truncate" style={{ color: MUTED }}>{formatTime(appt.scheduled_at)} · {service.name}</p>
            </div>
            <span className="font-body text-[9px] tracking-[0.18em] uppercase rounded-full px-2.5 py-1 shrink-0" style={{ color: tone, background: `${tone}18`, border: `1px solid ${tone}40` }}>
              {localStatus.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 font-body text-xs min-w-0" style={{ color: MUTED }}>
            <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{appt.location_address}</span>
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
  const [broadcasts, setBroadcasts] = useState(() => seedAssignmentBroadcastsFromLatestBooking());
  const [alertSettings, setAlertSettings] = useState(() => readNurseAlertSettings());
  const [mileageLog, setMileageLog] = useState(() => readMileageLog());
  const [mileageDraft, setMileageDraft] = useState({ miles: '', note: '' });
  const nurseId = nurseIdForUser(user);
  const assigned = APPOINTMENTS
    .filter((appt) => appt.nurse_id === nurseId && appt.status !== 'cancelled')
    .sort(sortAppointments);
  const nurseRecord = nurseRecordForUser(user);
  const nurseVisitRecords = assigned.map((appt) => ({
    id: appt.id,
    client: `${getClient(appt.client_id)?.first_name || ''} ${getClient(appt.client_id)?.last_name || ''}`.trim(),
    service: getService(appt.service_id)?.name || 'Avalon visit',
    nurseName: nurseRecord.name,
  }));
  const kitTower = buildKitControlTower({ inventory: SEED_ITEMS, nurses: [nurseRecord], visits: nurseVisitRecords });
  const nurseKit = kitTower.kits[0];
  const trainingTower = buildTrainingControlTower({ nurses: [nurseRecord] });
  const trainingRow = trainingTower.nurseRows[0];
  const repositorySeed = {
    requests: latestBooking ? [latestBooking] : [],
    nurses: [nurseRecord],
    inventory: SEED_ITEMS,
    booking: latestBooking,
  };
  const operationalTruth = buildUnifiedOperationalTruth(repositorySeed);
  const nurseTruth = operationalTruth.roleViews.find((roleView) => roleView.role === 'nurse');
  const active = assigned.filter((appt) => readLocal(`visitStatus.${appt.id}`, appt.status) !== 'completed');
  const queue = active.length ? active : assigned.slice(0, 3);
  const next = queue[0];
  const completed = assigned.filter((appt) => readLocal(`visitStatus.${appt.id}`, appt.status) === 'completed').length;
  const readyCount = active.filter((appt) => ['confirmed', 'in_progress'].includes(readLocal(`visitStatus.${appt.id}`, appt.status))).length;
  const intakeRisks = active.filter((appt) => !getClient(appt.client_id)?.intake_completed).length;
  const credentialClear = /clear/i.test(nurseRecord.credentialStatus || nurseRecord.credStatus || nurseRecord.nurseys?.status || '');
  const kitShort = nurseKit?.missing?.length || 0;
  const trainingDue = trainingRow?.due?.length || 0;
  const shiftReady = credentialClear && !kitShort && !trainingRow?.critical?.length;
  const kernel = buildAvalonKernelSnapshot({ booking: latestBooking, nurses: [nurseRecord], role: 'nurse' });
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const liveHandoff = latestBooking?.nurse && latestBooking.nurse !== 'Unassigned' && latestBooking?.status !== 'Completed'
    ? latestBooking
    : null;
  const liveClearance = liveHandoff ? evaluateClinicalClearance(liveHandoff) : null;
  const routeAppointments = queue.map((appt) => ({
    ...appt,
    clientName: `${getClient(appt.client_id)?.first_name || ''} ${getClient(appt.client_id)?.last_name || ''}`.trim(),
    serviceName: getService(appt.service_id)?.name,
    timeLabel: formatTime(appt.scheduled_at),
  }));
  const routeStops = buildNurseRoutePreview(routeAppointments, liveHandoff);
  const nextStop = routeStops[0];
  const openBroadcasts = broadcasts.filter((item) => item.status !== 'Assigned' && !(item.passedBy || []).includes(user?.name || 'Stephanie R.'));
  const todayMileage = mileageLog
    .filter((entry) => new Date(entry.createdAt).toDateString() === new Date().toDateString())
    .reduce((total, entry) => total + Number(entry.miles || 0), 0);

  useEffect(() => {
    const onLocalChange = (event) => {
      if (event.detail?.key === 'lastBooking') {
        setLatestBooking(readLastBooking());
        setBroadcasts(seedAssignmentBroadcastsFromLatestBooking());
      }
      if (event.detail?.key === 'assignmentBroadcasts') setBroadcasts(readAssignmentBroadcasts());
      if (event.detail?.key === 'nurseAlertSettings') setAlertSettings(readNurseAlertSettings());
      if (event.detail?.key === 'nurseMileageLog') setMileageLog(readMileageLog());
    };
    window.addEventListener('av.local.change', onLocalChange);
    window.addEventListener('storage', onLocalChange);
    return () => {
      window.removeEventListener('av.local.change', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    };
  }, []);

  useEffect(() => {
    syncLocalRepository(repositorySeed, 'Nurse Dashboard');
  }, [latestBooking?.id, latestBooking?.status, nurseRecord.id, assigned.length]);

  const moveLiveHandoff = (status) => {
    const result = advanceLatestBooking(status, { actor: 'nurse' });
    if (result.booking) setLatestBooking(result.booking);
  };

  const claimBroadcast = (broadcast) => {
    const nurseName = user?.name || 'Stephanie R.';
    const nextBroadcasts = acceptShiftBroadcast(broadcast.id, nurseName);
    setBroadcasts(nextBroadcasts);
    setLatestBooking(readLastBooking());
  };

  const passBroadcast = (broadcast) => {
    const nurseName = user?.name || 'Stephanie R.';
    const nextBroadcasts = declineShiftBroadcast(broadcast.id, nurseName);
    setBroadcasts(nextBroadcasts);
  };

  const logMileage = () => {
    const nextLog = addMileageEntry({
      miles: mileageDraft.miles,
      note: mileageDraft.note,
      from: 'Current location',
      to: nextStop?.address || 'Visit route',
      visitId: nextStop?.id || '',
    });
    setMileageLog(nextLog);
    setMileageDraft({ miles: '', note: '' });
  };

  const setLiveEta = (eta) => {
    const visitId = latestBooking?.id || latestBooking?.reference || 'latest';
    setKernelNurseEta(visitId, eta, user?.name || 'Nurse');
    setLatestBooking(readLastBooking());
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-28" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 px-4 py-3 backdrop-blur-2xl" style={{ background: 'rgba(8,8,7,0.86)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="font-heading text-2xl tracking-[0.2em]" style={{ color: TEXT }}>AV</Link>
          <div className="text-center min-w-0">
              <p className="font-body text-[11px] tracking-[0.18em] uppercase" style={{ color: DIM }}>Nurse Command</p>
            <p className="font-body text-xs truncate" style={{ color: MUTED }}>{user?.name || 'NURSE001'} · {dateLabel}</p>
          </div>
          <button type="button" onClick={handleSignOut} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Sign out">
            <LogOut className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        <section className="rounded-[30px] p-5 sm:p-7 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, hsl(var(--accent) / 0.10), hsl(var(--foreground) / 0.045) 48%, hsl(var(--foreground) / 0.025))', border: `1px solid ${BORDER}` }}>
          <div className="relative z-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="font-body text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: ACCENT }}>NURSE001</p>
              <h1 className="font-heading text-5xl sm:text-7xl uppercase leading-[0.9] max-w-2xl">
                Shift<br />Command.
              </h1>
              <p className="font-body text-base mt-4 max-w-xl leading-relaxed" style={{ color: MUTED }}>
                Your next visit and route, ready first.
              </p>
            </div>
            <div className="rounded-[24px] p-4" style={{ background: 'rgba(0,0,0,0.24)', border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[11px] tracking-[0.18em] uppercase mb-3" style={{ color: DIM }}>Next Stop</p>
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

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard icon={CalendarClock} label="Active Visits" value={active.length} sub={`${completed} completed in history`} tone={MUTED} />
          <StatCard icon={ShieldCheck} label="Ready" value={shiftReady ? 'YES' : 'NO'} sub={shiftReady ? `${readyCount} visits clear` : 'Fix blockers first'} tone={shiftReady ? ACCENT : RED} />
          <StatCard
            icon={LayoutDashboard}
            label="Truth Spine"
            value={operationalTruth.status}
            sub={`${nurseTruth?.visibleCount || 0} records · ${operationalTruth.ledger.eventCount} events`}
            tone={operationalTruth.repository.quarantineCount ? RED : ACCENT}
          />
        </section>

        <section>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="font-body text-[10px] tracking-[0.32em] uppercase" style={{ color: DIM }}>Preflight</p>
              <h2 className="font-heading text-3xl uppercase mt-1" style={{ color: TEXT }}>Readiness</h2>
            </div>
            {!shiftReady && (
              <span className="rounded-full px-3 py-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: RED, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)' }}>
                Action
              </span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ReadinessTile
              icon={ShieldCheck}
              label="Credential"
              value={credentialClear ? 'CLEAR' : 'HOLD'}
              detail={nurseRecord.nurseys?.status || nurseRecord.credentialStatus || 'Nurseys review'}
              tone={credentialClear ? ACCENT : RED}
              to="/provider/credentials"
            />
            <ReadinessTile
              icon={Package}
              label="Kit"
              value={kitShort ? `${kitShort} LOW` : 'READY'}
              detail={kitShort ? nurseKit.missing.slice(0, 2).map((item) => item.match).join(' · ') : `${nurseKit?.kitInventory?.length || 0} kit lines`}
              tone={kitShort ? RED : ACCENT}
              to="/provider/kits"
            />
            <ReadinessTile
              icon={trainingRow?.critical?.length ? AlertTriangle : GraduationCap}
              label="Training"
              value={trainingRow?.critical?.length ? 'BLOCK' : trainingDue ? `${trainingDue} DUE` : 'CLEAR'}
              detail={trainingDue ? trainingRow.due.slice(0, 2).map((item) => item.title).join(' · ') : 'Protocol review current'}
              tone={trainingRow?.critical?.length ? RED : trainingDue ? ACCENT : ACCENT}
              to="/provider/training"
            />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <ActionButton icon={Stethoscope} label="Shift" to="/provider/shift" tone={ACCENT} />
          <ActionButton icon={Route} label="Route" href={nextStop ? appleMapsUrl(nextStop.address) : undefined} tone={TEXT} />
          <ActionButton icon={Package} label="Kits" to="/provider/kits" tone={TEXT} />
          <ActionButton icon={GraduationCap} label="Training" to="/provider/training" tone={TEXT} />
          <ActionButton icon={LayoutDashboard} label="Tools" to="/provider/role-os" tone={TEXT} />
        </section>

        <section className="rounded-[26px] p-4 sm:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-body text-[10px] tracking-[0.28em] uppercase" style={{ color: DIM }}>Kernel</p>
              <h2 className="font-heading text-3xl uppercase leading-none mt-2" style={{ color: TEXT }}>Visit Ready</h2>
            </div>
            <span className="rounded-full px-3 py-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: kernel.kitReadiness.status === 'Blocked' ? RED : ACCENT, background: 'hsl(var(--foreground) / 0.045)', border: `1px solid ${BORDER}` }}>
              {kernel.kitReadiness.score}/100
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[
              ['Eligible', kernel.nurseEligibility[0]?.eligible ? 'YES' : 'CHECK'],
              ['Kit', kernel.kitReadiness.status],
              ['Chart', kernel.chart?.status || 'Draft'],
              ['GFE', kernel.clientTracker.gfe.status],
              ['Fatigue', kernel.scale.fatigue.rows[0]?.status || 'Clear'],
              ['Route', kernel.scale.routePacket.eta],
              ['Mission', kernel.scale.missionPacket.consent.status],
              ['QA', `${kernel.scale.postVisitQa.score}/100`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] tracking-[0.16em] uppercase" style={{ color: DIM }}>{label}</p>
                <p className="mt-1 truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{value}</p>
              </div>
            ))}
          </div>
          {liveHandoff && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {['10 min', '20 min', '30 min'].map((eta) => (
                <button
                  key={eta}
                  type="button"
                  onClick={() => setLiveEta(eta)}
                  className="min-h-[44px] rounded-2xl font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}
                >
                  ETA {eta}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[26px] p-4 sm:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[10px] tracking-[0.28em] uppercase" style={{ color: DIM }}>Assignment Broadcasts</p>
                <h2 className="font-heading text-3xl uppercase leading-none mt-2" style={{ color: TEXT }}>
                  {openBroadcasts.length ? `${openBroadcasts.length} Unassigned` : 'All Assigned'}
                </h2>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: openBroadcasts.length ? ACCENT : MUTED }}>
                <Send className="w-5 h-5" strokeWidth={1.6} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {openBroadcasts.length ? openBroadcasts.slice(0, 3).map((broadcast) => (
                <div key={broadcast.id} className="rounded-[20px] p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-heading text-2xl uppercase leading-none truncate" style={{ color: TEXT }}>{broadcast.client}</p>
                      <p className="font-body text-sm mt-1 truncate" style={{ color: MUTED }}>{broadcast.service}</p>
                      <p className="font-body text-xs mt-1" style={{ color: DIM }}>{broadcast.date} · {broadcast.time} · {broadcast.assignmentScope || 'Single appointment'}</p>
                      <p className="font-body text-[11px] mt-1 truncate" style={{ color: DIM }}>
                        {broadcast.city || 'City pending'} · ${broadcast.shiftValue || 85} · Reply Y/N
                      </p>
                      <p className="font-body text-[11px] mt-1 truncate" style={{ color: DIM }}>
                        {broadcast.credentialFilter || 'Nurseys Clear'}
                      </p>
                      <p className="font-body text-[11px] mt-1 truncate" style={{ color: DIM }}>Escalates after {broadcast.escalationAfterMinutes || alertSettings.escalationAfterMinutes} min</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => claimBroadcast(broadcast)}
                        className="min-h-[42px] rounded-full px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em]"
                        style={{ background: TEXT, color: BG }}
                      >
                        Y
                      </button>
                      <button
                        type="button"
                        onClick={() => passBroadcast(broadcast)}
                        className="min-h-[42px] rounded-full px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em]"
                        style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
                      >
                        N
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {broadcast.channels.map((channel) => (
                      <span key={channel.key} className="flex min-h-[34px] items-center justify-center gap-1 rounded-full font-body text-[9px] uppercase tracking-[0.12em]" style={{ color: MUTED, background: 'hsl(var(--foreground) / 0.045)', border: `1px solid ${BORDER}` }}>
                        {channel.key === 'email' ? <Mail className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                        {channel.key}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <a href={broadcast.maps?.apple || appleMapsUrl(broadcast.address)} className="flex min-h-[36px] items-center justify-center gap-1 rounded-full font-body text-[9px] uppercase tracking-[0.12em]" style={{ color: TEXT, background: 'hsl(var(--foreground) / 0.07)', border: `1px solid ${BORDER}` }}>
                      <Navigation className="w-3 h-3" strokeWidth={1.6} /> Route
                    </a>
                    <a href={broadcast.clientPhone ? `sms:${broadcast.clientPhone}` : undefined} className="flex min-h-[36px] items-center justify-center gap-1 rounded-full font-body text-[9px] uppercase tracking-[0.12em]" style={{ color: TEXT, background: 'hsl(var(--foreground) / 0.07)', border: `1px solid ${BORDER}` }}>
                      <MessageCircle className="w-3 h-3" strokeWidth={1.6} /> Text
                    </a>
                  </div>
                </div>
              )) : (
                <div className="rounded-[20px] p-4 font-body text-sm" style={{ color: MUTED, background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  No assignment broadcasts are currently active.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[26px] p-4 sm:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[10px] tracking-[0.28em] uppercase" style={{ color: DIM }}>Route Preview</p>
                <h2 className="font-heading text-3xl uppercase leading-none mt-2" style={{ color: TEXT }}>
                  {routeStops.length ? `${routeStops.length} Stops` : 'No Route'}
                </h2>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: ACCENT }}>
                <Navigation className="w-5 h-5" strokeWidth={1.6} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {routeStops.length ? routeStops.map((stop, index) => (
                <div key={`${stop.id}-${stop.address}`} className="flex gap-3 rounded-[18px] p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-heading text-base shrink-0" style={{ background: 'hsl(var(--accent) / 0.10)', color: ACCENT, border: '1px solid hsl(var(--accent) / 0.22)' }}>{index + 1}</div>
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold truncate" style={{ color: TEXT }}>{stop.label}</p>
                    <p className="font-body text-xs truncate" style={{ color: MUTED }}>{stop.service} · {stop.time || 'Time pending'}</p>
                    <p className="font-body text-xs truncate" style={{ color: DIM }}>{stop.address}</p>
                  </div>
                </div>
              )) : (
                <p className="font-body text-sm" style={{ color: MUTED }}>Claim or receive an assignment to preview route options.</p>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={nextStop ? appleMapsUrl(nextStop.address) : undefined}
                className={`min-h-[52px] rounded-2xl flex items-center justify-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em] ${nextStop ? '' : 'pointer-events-none opacity-40'}`}
                style={{ background: TEXT, color: BG }}
              >
                Apple <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href={nextStop ? googleMapsUrl(nextStop.address) : undefined}
                target="_blank"
                rel="noreferrer"
                className={`min-h-[52px] rounded-2xl flex items-center justify-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em] ${nextStop ? '' : 'pointer-events-none opacity-40'}`}
                style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
              >
                Google <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] p-4 sm:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-body text-[10px] tracking-[0.28em] uppercase" style={{ color: DIM }}>Personal Mileage</p>
              <h2 className="font-heading text-3xl uppercase leading-none mt-2" style={{ color: TEXT }}>{todayMileage.toFixed(1)} Mi Today</h2>
              <p className="font-body text-xs mt-1" style={{ color: MUTED }}>Gusto-ready after shift close.</p>
            </div>
            <Car className="w-6 h-6" style={{ color: ACCENT }} strokeWidth={1.6} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]">
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={mileageDraft.miles}
              onChange={(event) => setMileageDraft((draft) => ({ ...draft, miles: event.target.value }))}
              placeholder="Miles"
              className="min-h-[54px] rounded-2xl px-4 font-body text-base outline-none"
              style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}
            />
            <input
              type="text"
              value={mileageDraft.note}
              onChange={(event) => setMileageDraft((draft) => ({ ...draft, note: event.target.value }))}
              placeholder="Note"
              className="min-h-[54px] rounded-2xl px-4 font-body text-base outline-none"
              style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}
            />
            <button
              type="button"
              onClick={logMileage}
              disabled={!Number(mileageDraft.miles)}
              className="min-h-[54px] rounded-2xl px-5 font-body text-[10px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
              style={{ background: TEXT, color: BG }}
            >
              Log
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {mileageLog.slice(0, 3).map((entry) => (
              <div key={entry.id} className="rounded-[18px] p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <p className="font-heading text-2xl leading-none" style={{ color: TEXT }}>{Number(entry.miles).toFixed(1)} mi</p>
                <p className="font-body text-xs mt-1 truncate" style={{ color: MUTED }}>{entry.to}</p>
                {entry.note && <p className="font-body text-[11px] mt-1 truncate" style={{ color: DIM }}>{entry.note}</p>}
              </div>
            ))}
            {!mileageLog.length && (
              <p className="font-body text-sm" style={{ color: MUTED }}>No mileage logged.</p>
            )}
          </div>
        </section>

        {liveHandoff && (
          <section className="rounded-[26px] p-4" style={{ background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[10px] tracking-[0.28em] uppercase" style={{ color: ACCENT }}>Live Handoff</p>
                <h2 className="font-heading text-3xl uppercase leading-none mt-2" style={{ color: TEXT }}>{liveHandoff.service}</h2>
                <p className="font-body text-sm mt-2" style={{ color: MUTED }}>{[liveHandoff.date, liveHandoff.time, liveHandoff.address].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="rounded-full px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
                {liveHandoff.status}
              </span>
            </div>
            <div className="mt-4">
              <ClinicalClearancePanel booking={liveHandoff} title="RN Gate" compact />
            </div>
            {!liveClearance?.dispatchAllowed && (
              <p className="mt-3 rounded-2xl px-3 py-2 font-body text-[11px] leading-relaxed" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.18)' }}>
                RN actions are locked until clearance is complete. {liveClearance?.nextAction}
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" disabled={!liveClearance?.dispatchAllowed} onClick={() => moveLiveHandoff('En Route')} className="min-h-[52px] rounded-2xl font-body text-[10px] font-semibold uppercase tracking-[0.16em] disabled:opacity-35" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}>En Route</button>
              <button type="button" disabled={!liveClearance?.dispatchAllowed} onClick={() => moveLiveHandoff('Arrived')} className="min-h-[52px] rounded-2xl font-body text-[10px] font-semibold uppercase tracking-[0.16em] disabled:opacity-35" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}>Arrived</button>
              <button type="button" disabled={!liveClearance?.dispatchAllowed} onClick={() => moveLiveHandoff('Completed')} className="min-h-[52px] rounded-2xl font-body text-[10px] font-semibold uppercase tracking-[0.16em] disabled:opacity-35" style={{ background: TEXT, color: BG }}>Complete</button>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="font-body text-[10px] tracking-[0.32em] uppercase" style={{ color: DIM }}>Queue</p>
              <h2 className="font-heading text-3xl uppercase mt-1" style={{ color: TEXT }}>Visits</h2>
            </div>
            <Link to="/provider/clients" className="font-body text-[10px] tracking-[0.18em] uppercase" style={{ color: ACCENT }}>Clients</Link>
          </div>
          <div className="space-y-3">
            {queue.length ? queue.map((appt, index) => <VisitRow key={appt.id} appt={appt} index={index} />) : (
              <div className="rounded-[22px] p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
                No visits assigned to this nurse.
              </div>
            )}
          </div>
        </section>

        {/* ── Messages ────────────────────────────────────────────── */}
        <section>
          <p className="font-body text-[10px] tracking-[0.28em] uppercase mb-3" style={{ color: DIM }}>Messages</p>
          <CommunicationCenter compact />
        </section>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] backdrop-blur-2xl" style={{ background: 'rgba(8,8,7,0.9)', borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto grid grid-cols-4 gap-2">
          <Link to="/provider/dashboard" className="flex min-h-[56px] items-center justify-center rounded-2xl text-center font-body text-[10px] tracking-[0.18em] uppercase" style={{ background: CARD_STRONG, color: ACCENT, border: `1px solid ${BORDER}` }}>Command</Link>
          <Link to="/provider/shift" className="flex min-h-[56px] items-center justify-center rounded-2xl text-center font-body text-[10px] tracking-[0.18em] uppercase" style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>Shift</Link>
          <Link to="/provider/role-os" className="flex min-h-[56px] items-center justify-center rounded-2xl text-center font-body text-[10px] tracking-[0.18em] uppercase" style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>Tools</Link>
          <Link to="/provider/settings" className="flex min-h-[56px] items-center justify-center rounded-2xl text-center font-body text-[10px] tracking-[0.18em] uppercase" style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>Settings</Link>
        </div>
      </nav>
    </div>
  );
}
