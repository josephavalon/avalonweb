import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/useAuthStore';
import {
  APPOINTMENTS,
  NURSES,
  getClient,
  getService,
  formatTime,
} from '@/fixtures/commandMockData';
import { SEED_ITEMS } from '@/data/inventorySeed';
import { appendActivity, readLocal, writeLocal } from '@/lib/localOs';
import { useSeo } from '@/lib/seo';
import {
  buildAcuityCloseoutPacket,
  evaluateAcuityCloseout,
  readAcuityCloseoutDraft,
  saveAcuityCloseoutDraft,
  saveAcuityCloseoutPacket,
} from '@/lib/acuityCloseout';
import {
  buildKitControlTower,
  buildTrainingControlTower,
  NURSE_CLIENT_CONTACT_TEMPLATES,
  queueClientRouteBridgeUpdate,
  queueGustoPayrollProof,
  queueKitDeduction,
  queueNurseClientContact,
  syncVisitKitUsage,
} from '@/lib/platformOps';
import {
  ChevronRight,
  MapPin,
  Clock,
  CheckCircle,
  CheckCircle2,
  Circle,
  MessageCircle,
  Phone,
  AlertCircle,
  ArrowRight,
  X,
  Play,
  Square,
  FileText,
  User,
  LogOut,
  LayoutDashboard,
  Package,
  GraduationCap,
  ShieldCheck,
  Navigation,
} from 'lucide-react';

// ── constants ──────────────────────────────────────────────────────────────────
// GOLD reserved only for: START VISIT / COMPLETE VISIT / SEND ALERT buttons + AV logo + accent bar
const GOLD           = 'hsl(var(--accent))';
const DISPATCH_PHONE = 'tel:+14155550101';
const EASE           = [0.16, 1, 0.3, 1];

const DEMO_NURSE_RECORD = {
  id: 's2',
  name: 'Stephanie R.',
  status: 'Assigned',
  area: 'SF',
  city: 'San Francisco',
  kit: 'Ready / stocked',
  kitStatus: 'Ready',
  certifications: ['RN', 'IV therapy', 'NAD review'],
  protocols: ['hydration', 'recovery', 'myers'],
  visits: 2,
  nurseys: { status: 'Clear', state: 'CA' },
  trainingModules: [
    { id: 'iv-start-safety', status: 'Clear', tone: 'ready', daysLeft: 180 },
    { id: 'myers-add-ons', status: 'Clear', tone: 'ready', daysLeft: 120 },
    { id: 'emergency-response', status: 'Clear', tone: 'ready', daysLeft: 90 },
    { id: 'acuity-closeout', status: 'Clear', tone: 'ready', daysLeft: 180 },
  ],
};

// ── helpers ────────────────────────────────────────────────────────────────────
function formatElapsed(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function mapsUrl(address, city) {
  const q = encodeURIComponent(`${address}, ${city}`);
  return `maps://?q=${q}`;
}

function statusOrder(s) {
  if (s === 'in_progress') return 0;
  if (s === 'confirmed')   return 1;
  if (s === 'scheduled')   return 2;
  if (s === 'completed')   return 3;
  return 4;
}

function normalizeNurseVisitStatus(status = 'scheduled') {
  const value = String(status || '').toLowerCase();
  if (/complete/.test(value)) return 'completed';
  if (/post_visit/.test(value)) return 'post_visit';
  if (/progress|started/.test(value)) return 'in_progress';
  if (/confirm|assigned|route|arrived/.test(value)) return 'confirmed';
  return value || 'scheduled';
}

function nurseRecordForName(name = '') {
  const needle = String(name || '').toLowerCase();
  return NURSES.find((nurse) => String(nurse.name || '').toLowerCase() === needle) || NURSES[0] || DEMO_NURSE_RECORD;
}

function trainingIdsForService(serviceName = '') {
  const service = String(serviceName).toLowerCase();
  const ids = new Set(['iv-start-safety', 'emergency-response', 'acuity-closeout']);
  if (service.includes('nad')) ids.add('nad-protocol-review');
  if (/myers|performance|glutathione|vip|magnesium|b-complex/.test(service)) ids.add('myers-add-ons');
  if (/\bim\b|b12|shot|injection/.test(service)) ids.add('im-shot-review');
  return ids;
}

function nextDemoAppointmentIso() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date.toISOString();
}

function demoClientFromBooking(booking = {}) {
  const name = booking.contact?.name || [booking.contact?.firstName, booking.contact?.lastName].filter(Boolean).join(' ');
  const [firstName = 'Preview', ...lastParts] = String(name || 'Preview Client').split(' ');
  return {
    id: 'demo-client-preview',
    first_name: firstName,
    last_name: lastParts.join(' ') || 'Client',
    phone: booking.contact?.phone || '(415) 980-7708',
    source: booking.source || 'Beta demo',
    visit_count: 3,
    tags: ['RETURNING', 'GFE CLEAR'],
    intake_completed: true,
  };
}

function demoServiceFromBooking(booking = {}) {
  return {
    id: 'demo-service-preview',
    name: booking.service || 'Recovery Protocol',
    duration_minutes: /nad/i.test(booking.service || '') ? 90 : 45,
    base_price: Number(booking.subtotal || 325),
  };
}

function buildDemoNurseAppointment(booking = {}) {
  const address = booking.address && booking.address !== 'Client address pending'
    ? booking.address
    : '188 King St, Suite 2205';
  return {
    id: 'demo-nurse-shift-001',
    client_id: 'demo-client-preview',
    service_id: 'demo-service-preview',
    nurse_id: 's2',
    status: readLocal('visitStatus.demo-nurse-shift-001', 'confirmed'),
    scheduled_at: nextDemoAppointmentIso(),
    location_address: address,
    location_city: booking.city || 'San Francisco',
    location_notes: booking.notes || 'Concierge arrival. Text client before elevator.',
    clinical_notes: 'Acuity closeout placeholder. Confirm ID, vitals, consent, and protocol before start.',
    shiftValue: Number(booking.subtotal || 325),
    shift_pay: 95,
    _demoClient: demoClientFromBooking(booking),
    _demoService: demoServiceFromBooking(booking),
  };
}

function resolveClient(appt) {
  return getClient(appt.client_id) || appt._demoClient;
}

function resolveService(appt) {
  return getService(appt.service_id) || appt._demoService;
}

// ── sub-components ─────────────────────────────────────────────────────────────

function StatusIcon({ status, size = 22 }) {
  if (status === 'completed')   return <CheckCircle size={size} className="text-white/65" />;
  if (status === 'in_progress') return <Play        size={size} className="text-white" />;
  return <Circle size={size} className="text-white" />;
}

function TagPill({ label }) {
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full border border-white/[0.06] text-[11px] text-white bg-white/[0.06] font-semibold tracking-[0.04em] uppercase">
      {label}
    </span>
  );
}

function MissionItem({ icon: Icon, label, status, detail, tone = 'default' }) {
  const toneStyle = {
    ready: { color: 'hsl(142 71% 45%)', background: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.2)' },
    action: { color: GOLD, background: 'hsl(var(--accent) / 0.08)', border: 'hsl(var(--accent) / 0.22)' },
    critical: { color: 'hsl(var(--destructive))', background: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.24)' },
    default: { color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.08)' },
  }[tone] || {};
  return (
    <div className="rounded-[10px] p-3" style={{ background: toneStyle.background, border: `1px solid ${toneStyle.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon size={15} className="mt-0.5 shrink-0" style={{ color: toneStyle.color }} />
          <div className="min-w-0">
            <div className="text-[11px] text-white tracking-[0.1em] font-semibold uppercase">{label}</div>
            <div className="text-[11px] text-white/48 mt-1 leading-snug">{detail}</div>
          </div>
        </div>
        <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-[0.11em] font-semibold" style={{ color: toneStyle.color, border: `1px solid ${toneStyle.border}` }}>
          {status}
        </span>
      </div>
    </div>
  );
}

function AcuityCloseoutGate({ verdict }) {
  const ready = verdict.complete;
  const tone = ready ? 'hsl(142 71% 45%)' : GOLD;

  return (
    <div className="rounded-[14px] p-3.5 mb-3.5" style={{ background: 'rgba(255,255,255,0.035)', border: `1px solid ${ready ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] text-white tracking-[0.12em] font-semibold">
            ACUITY CLOSEOUT
          </div>
          <div className="text-[11px] text-white/45 mt-1">
            Acuity is the record. This blocks local completion only.
          </div>
        </div>
        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full uppercase tracking-[0.12em] font-semibold" style={{ color: tone, background: `${tone}18`, border: `1px solid ${tone}35` }}>
          {verdict.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {verdict.sections.map((section) => (
          <div
            key={section.key}
            className="rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
            style={{ background: section.complete ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.04)', border: `1px solid ${section.complete ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.07)'}` }}
          >
            <span className="text-[10px] text-white/65 uppercase tracking-[0.11em] truncate">
              {section.label}
            </span>
            {section.complete ? (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={13} style={{ color: GOLD }} className="shrink-0" />
            )}
          </div>
        ))}
      </div>

      <div className="text-[11px] text-white/55 leading-relaxed">
        {verdict.nextAction}
      </div>
    </div>
  );
}

// ── visit timer hook ───────────────────────────────────────────────────────────
function useTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [running]);

  return elapsed;
}

// ── VisitCard ──────────────────────────────────────────────────────────────────
function VisitCard({ appt, visitNumber, nurseName = 'Nurse', nurseRecord, onStatusChange }) {
  const [expanded,      setExpanded]      = useState(false);
  const [localStatus,   setLocalStatus]   = useState(() => normalizeNurseVisitStatus(readLocal(`visitStatus.${appt.id}`, appt.status)));
  const [etaDraft,      setEtaDraft]      = useState(() => readLocal(`routeEta.${appt.id}`, '20 min'));
  const [lastContact,   setLastContact]   = useState(() => readLocal(`clientContact.${appt.id}`, ''));
  const [clinicalNotes, setClinicalNotes] = useState(appt.clinical_notes || '');
  const [completedAt,   setCompletedAt]   = useState(null);
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [vitals, setVitals] = useState({
    bp_checked:       false,
    iv_assessed:      false,
    patient_stable:   false,
    consent_signed:   false,
  });

  // ── Visit closeout state ──────────────────────────────────────────────────────
  const NOTES_KEY = `visit.${appt.id}.closeoutProof`;
  const [notesOpen, setNotesOpen] = useState(false);
  const [acuityCloseout, setAcuityCloseout] = useState(() => readAcuityCloseoutDraft(appt.id));
  const [visitNote, setVisitNote] = useState('');
  const [bp, setBp] = useState('');
  const [hr, setHr] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  function updateAcuityCloseout(patch) {
    setAcuityCloseout(saveAcuityCloseoutDraft(appt.id, patch));
  }

  function saveNotes() {
    writeLocal(NOTES_KEY, {
      saved: true,
      hasNotes: Boolean(visitNote.trim()),
      vitalsCaptured: Boolean(bp.trim() || hr.trim()),
      updatedAt: new Date().toISOString(),
    });
    appendActivity(`Saved visit notes for ${client.first_name} ${client.last_name}`, { role: 'nurse', visit: appt.id });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  const elapsed = useTimer(timerRunning);
  const client  = resolveClient(appt);
  const service = resolveService(appt);

  if (!client || !service) return null;

  const missionVisit = {
    id: appt.id,
    client: `${client.first_name} ${client.last_name}`,
    service: service.name,
    therapy: service.name,
    nurseName,
  };
  const activeNurse = nurseRecord || nurseRecordForName(nurseName);
  const kitTower = buildKitControlTower({ inventory: SEED_ITEMS, nurses: [activeNurse], visits: [missionVisit] });
  const nurseKit = kitTower.kits[0];
  const kitShort = nurseKit?.missing?.length || 0;
  const trainingTower = buildTrainingControlTower({ nurses: [activeNurse] });
  const trainingRow = trainingTower.nurseRows[0];
  const requiredTraining = trainingRow?.modules?.filter((module) => trainingIdsForService(service.name).has(module.id)) || [];
  const expiredTraining = requiredTraining.filter((module) => module.status === 'Expired');
  const dueTraining = requiredTraining.filter((module) => module.status !== 'Clear');
  const clearanceReady = client.intake_completed;
  const clientName = `${client.first_name} ${client.last_name}`;
  const visitAddress = `${appt.location_address}, ${appt.location_city}`;

  function queueRouteUpdate(status) {
    const eta = /arrived/i.test(status) ? 'Arrived' : /completed|complete/i.test(status) ? 'Complete' : etaDraft;
    writeLocal(`routeEta.${appt.id}`, eta);
    queueClientRouteBridgeUpdate({
      visitId: appt.id,
      status,
      eta,
      nurseName,
      client: clientName,
      clientPhone: client.phone,
      address: visitAddress,
      service: service.name,
      source: 'Nurse Shift',
    });
  }

  function sendEta() {
    queueRouteUpdate('En Route');
    appendActivity(`Nurse ETA set for ${clientName}: ${etaDraft}`, { role: 'nurse', visit: appt.id });
  }

  function markArrived() {
    queueRouteUpdate('Arrived');
    setLocalStatus('confirmed');
    writeLocal(`visitStatus.${appt.id}`, 'confirmed');
    onStatusChange(appt.id, 'confirmed');
    appendActivity(`Nurse arrived: ${clientName}`, { role: 'nurse', visit: appt.id });
  }

  function sendClientContact(template) {
    queueNurseClientContact({
      visitId: appt.id,
      templateId: template.id,
      nurseName,
      client: clientName,
      clientPhone: client.phone,
      source: 'Nurse Shift',
    });
    writeLocal(`clientContact.${appt.id}`, template.label);
    setLastContact(template.label);
  }

  function startVisit() {
    queueRouteUpdate('In Progress');
    setLocalStatus('in_progress');
    writeLocal(`visitStatus.${appt.id}`, 'in_progress');
    appendActivity(`Started visit: ${client.first_name} ${client.last_name}`, { role: 'nurse', visit: appt.id });
    setTimerRunning(true);
    onStatusChange(appt.id, 'in_progress');
  }

  function endVisit() {
    setTimerRunning(false);
    setLocalStatus('post_visit');
    writeLocal(`visitStatus.${appt.id}`, 'post_visit');
    appendActivity(`Ended visit timer: ${client.first_name} ${client.last_name}`, { role: 'nurse', visit: appt.id });
    onStatusChange(appt.id, 'post_visit');
  }

  function completeVisit() {
    const now = new Date();
    const closeoutPacket = saveAcuityCloseoutPacket(buildAcuityCloseoutPacket({
      appointment: appt,
      client,
      service,
      closeout: acuityCloseout,
      note: clinicalNotes,
      nurseName,
      completedAt: now.toISOString(),
    }));
    if (closeoutPacket.eventFlagged) {
      const incidents = readLocal('clinicalIncidents', []);
      writeLocal('clinicalIncidents', [{
        id: `incident-${appt.id}-${Date.now()}`,
        visitId: appt.id,
        clientName: `${client.first_name} ${client.last_name}`,
        service: service.name,
        summary: closeoutPacket.adverseEvent,
        sourceOfRecord: 'Acuity',
        status: 'Needs review',
        createdAt: now.toISOString(),
      }, ...incidents].slice(0, 80));
      appendActivity(`Event follow-up flagged for ${client.first_name} ${client.last_name}`, { role: 'nurse', visit: appt.id, sourceOfRecord: 'Acuity' });
    }
    setCompletedAt(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    setLocalStatus('completed');
    writeLocal(`visitStatus.${appt.id}`, 'completed');
    const kitVisit = {
      id: appt.id,
      client: `${client.first_name} ${client.last_name}`,
      service: service.name,
      therapy: service.name,
      nurseName,
    };
    queueKitDeduction(kitVisit, SEED_ITEMS);
    syncVisitKitUsage({ inventory: SEED_ITEMS, visits: [kitVisit], actor: nurseName });
    queueGustoPayrollProof({
      visitId: appt.id,
      nurseName,
      service: service.name,
      shiftValue: appt.shiftValue || appt.shift_pay,
      chartStatus: closeoutPacket.acuityStatus,
      completedAt: now.toISOString(),
    });
    queueRouteUpdate('Completed');
    writeLocal(`visitStatus.${appt.id}`, 'completed');
    appendActivity(`Completed visit: ${client.first_name} ${client.last_name}`, { role: 'nurse', visit: appt.id });
    onStatusChange(appt.id, 'completed');
  }

  const allVitalsChecked = Object.values(vitals).every(Boolean);
  const acuityVerdict = evaluateAcuityCloseout(acuityCloseout);
  const closeoutMissing = acuityVerdict.missing;
  const closeoutComplete = acuityVerdict.complete;
  const canCompleteVisit = allVitalsChecked && closeoutComplete;

  const statusLabel = {
    scheduled:   'Scheduled',
    confirmed:   'Confirmed',
    in_progress: 'In Progress',
    post_visit:  'In Progress',
    completed:   'Completed',
  }[localStatus] || localStatus;

  const statusColor = {
    scheduled:   'rgba(255,255,255,0.5)',
    confirmed:   'hsl(142 71% 45%)',
    in_progress: 'hsl(142 71% 45%)',
    post_visit:  'hsl(142 71% 45%)',
    completed:   'rgba(255,255,255,0.7)',
  }[localStatus];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`bg-[hsl(var(--card))] rounded-2xl overflow-hidden mb-3 transition-colors border ${
        expanded ? 'border-white/[0.18]' : 'border-white/[0.06]'
      }`}
    >
      {/* ── card header ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full bg-transparent border-0 cursor-pointer p-4 text-left"
      >
        <div className="flex items-start gap-3">
          {/* visit number badge */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            localStatus === 'completed' ? 'bg-white/10' : 'bg-white/5'
          }`}>
            <StatusIcon status={localStatus} size={16} />
          </div>

          <div className="flex-1 min-w-0">
            {/* visit number + status pill */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-heading text-[11px] tracking-[0.12em] text-white/40">
                VISIT {visitNumber}
              </span>
              <span
                className="text-[10px] px-2 py-px rounded-full font-bold tracking-[0.06em] uppercase"
                style={{ background: `${statusColor}22`, color: statusColor }}
              >
                {statusLabel}
              </span>
            </div>

            {/* client name */}
            <div className="font-heading text-[22px] text-white leading-[1.1] mb-1">
              {client.first_name} {client.last_name}
            </div>

            {/* service + duration */}
            <div className="text-sm text-white mb-1.5">
              {service.name}
              <span className="text-white/50 ml-1.5">· {service.duration_minutes} min</span>
            </div>

            {/* time + address */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-white">
                <Clock size={12} className="text-white/35" />
                {formatTime(appt.scheduled_at)}
              </span>
              <span className="flex items-center gap-1 text-xs text-white">
                <MapPin size={12} className="text-white/35" />
                {appt.location_address}
              </span>
            </div>
          </div>

          <ChevronRight
            size={18}
            className={`text-white shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* ── expanded body ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 border-t border-white/[0.06] pt-4">

              {/* ── full address ── */}
              <a
                href={mapsUrl(appt.location_address, appt.location_city)}
                className="flex items-start gap-2.5 px-3.5 py-3 bg-white/[0.03] rounded-[10px] border border-white/[0.08] no-underline mb-4"
              >
                <MapPin size={16} className="text-white/45 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm text-white font-semibold">
                    {appt.location_address}, {appt.location_city}
                  </div>
                  {appt.location_notes && (
                    <div className="text-xs text-white mt-0.5">{appt.location_notes}</div>
                  )}
                </div>
              </a>

              {/* ── nurse-owned eta ── */}
              <div className="mb-5 rounded-[14px] p-3.5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-heading text-[13px] tracking-[0.12em] text-white/45">
                      NURSE ETA
                    </div>
                    <div className="mt-1 text-[11px] text-white/50 leading-relaxed">
                      You set it. Client sees your latest update.
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-emerald-300" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)' }}>
                    Final say
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2.5 sm:grid-cols-4 sm:gap-1.5">
                  {['10 min', '20 min', '30 min', '45 min'].map((eta) => (
                    <button
                      key={eta}
                      type="button"
                      onClick={() => setEtaDraft(eta)}
                      className="min-h-[44px] rounded-lg text-[10px] font-semibold uppercase tracking-[0.1em]"
                      style={{
                        background: etaDraft === eta ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${etaDraft === eta ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.08)'}`,
                        color: etaDraft === eta ? 'hsl(var(--background))' : 'rgba(255,255,255,0.72)',
                      }}
                    >
                      {eta}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={sendEta}
                    className="min-h-[44px] rounded-xl text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ background: GOLD, color: 'hsl(var(--background))', border: '1px solid hsl(var(--accent))' }}
                  >
                    Send ETA
                  </button>
                  <button
                    type="button"
                    onClick={markArrived}
                    className="min-h-[44px] rounded-xl text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'hsl(var(--foreground))', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Arrived
                  </button>
                </div>
              </div>

              {/* ── client contact ── */}
              <div className="mb-5 rounded-[14px] p-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-heading text-[13px] tracking-[0.12em] text-white/45">
                      CLIENT CONTACT
                    </div>
                    <div className="mt-1 text-[11px] text-white/50 leading-relaxed">
                      Operational only. No PHI.
                    </div>
                  </div>
                  <MessageCircle size={16} className="shrink-0 text-white/40" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {NURSE_CLIENT_CONTACT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => sendClientContact(template)}
                      className="min-h-[42px] rounded-xl px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        background: lastContact === template.label ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.045)',
                        border: `1px solid ${lastContact === template.label ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.08)'}`,
                        color: lastContact === template.label ? 'hsl(var(--background))' : 'rgba(255,255,255,0.72)',
                      }}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── mission packet ── */}
              <div className="mb-5">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="font-heading text-[13px] tracking-[0.12em] text-white/40">
                    MISSION PACKET
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.08] text-white/45 uppercase tracking-[0.12em]">
                    No PHI in ops
                  </span>
                </div>
                <div className="grid gap-2">
                  <MissionItem
                    icon={ShieldCheck}
                    label="Clearance"
                    status={clearanceReady ? 'Ready' : 'Block'}
                    detail={clearanceReady ? 'Intake present. GFE remains Acuity/clinical source.' : 'Do not start until intake/GFE path is clear.'}
                    tone={clearanceReady ? 'ready' : 'critical'}
                  />
                  <MissionItem
                    icon={Package}
                    label="Kit"
                    status={kitShort ? 'Restock' : 'Ready'}
                    detail={kitShort ? nurseKit.missing.slice(0, 2).map((item) => item.match).join(' · ') : `${nurseKit?.kitInventory?.length || 0} carried kit lines ready.`}
                    tone={kitShort ? 'action' : 'ready'}
                  />
                  <MissionItem
                    icon={GraduationCap}
                    label="Protocol"
                    status={expiredTraining.length ? 'Block' : dueTraining.length ? 'Review' : 'Ready'}
                    detail={dueTraining.length ? dueTraining.slice(0, 2).map((item) => item.title).join(' · ') : 'Required protocol reviews current.'}
                    tone={expiredTraining.length ? 'critical' : dueTraining.length ? 'action' : 'ready'}
                  />
                  <MissionItem
                    icon={Navigation}
                    label="Route"
                    status="Ready"
                    detail={`${appt.location_address}, ${appt.location_city}`}
                    tone="default"
                  />
                  <MissionItem
                    icon={FileText}
                    label="Closeout"
                    status={localStatus === 'post_visit' ? (closeoutComplete ? 'Ready' : 'Needed') : 'Armed'}
                    detail={localStatus === 'post_visit' ? acuityVerdict.nextAction : 'Acuity closeout gates completion after service.'}
                    tone={localStatus === 'post_visit' ? (closeoutComplete ? 'ready' : 'action') : 'default'}
                  />
                </div>
              </div>

              {/* ── client intake summary ── */}
              <div className="mb-5">
                <div className="font-heading text-[13px] tracking-[0.12em] text-white/40 mb-2.5">
                  CLIENT INTAKE SUMMARY
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-3.5 py-3 mb-2.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <User size={14} className="text-white/40" />
                    <span className="text-[13px] text-white font-semibold">
                      {client.first_name} {client.last_name}
                    </span>
                    <span className="text-xs text-white">· {client.visit_count} visits</span>
                  </div>

                  {client.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {client.tags.map(tag => <TagPill key={tag} label={tag} />)}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    {client.intake_completed ? (
                      <div className="text-xs text-white">
                        <span className="text-emerald-400 mr-1.5">✓</span>
                        Intake form completed
                      </div>
                    ) : (
                      <div className="text-xs text-white">
                        <span className="text-red-400 mr-1.5">!</span>
                        Intake form not on file
                      </div>
                    )}
                    <div className="text-xs text-white">
                      <span className="text-white/35 mr-1.5">⊕</span>
                      Source: {client.source}
                    </div>
                    {appt.location_notes && (
                      <div className="text-xs text-white mt-1">
                        <span className="text-yellow-400 mr-1.5">⚠</span>
                        <strong>Note:</strong> {appt.location_notes}
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  to={`/provider/clients/${client.id}`}
                  className="flex items-center gap-1.5 text-xs text-white/55 no-underline font-semibold tracking-[0.04em]"
                >
                  <FileText size={13} />
                  VIEW FULL INTAKE
                  <ArrowRight size={12} />
                </Link>
              </div>

              {/* ── visit flow ── */}
              <div className="font-heading text-[13px] tracking-[0.12em] text-white/40 mb-3">
                VISIT FLOW
              </div>

              {/* COMPLETED STATE */}
              {localStatus === 'completed' && (
                <div className="bg-accent/[0.08] border border-accent/25 rounded-[10px] p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={16} style={{ color: GOLD }} />
                    <span className="text-white font-bold text-sm">
                      Visit Completed {completedAt ? `at ${completedAt}` : ''}
                    </span>
                  </div>
                  {clinicalNotes && (
                    <div className="text-[13px] text-white leading-relaxed bg-black/25 px-3 py-2.5 rounded-lg">
                      {clinicalNotes}
                    </div>
                  )}
                </div>
              )}

              {/* SCHEDULED / CONFIRMED — START VISIT */}
              {(localStatus === 'scheduled' || localStatus === 'confirmed') && (
                <button
                  onClick={startVisit}
                  className="w-full py-4 border-0 rounded-xl cursor-pointer flex items-center justify-center gap-2.5"
                  style={{ background: GOLD }}
                >
                  <Play size={18} color="hsl(var(--background))" />
                  <span className="font-heading text-xl tracking-[0.08em]" style={{ color: 'hsl(var(--background))' }}>
                    START VISIT
                  </span>
                </button>
              )}

              {/* IN PROGRESS — timer + end */}
              {localStatus === 'in_progress' && (
                <div className="mb-3">
                  <div className="bg-emerald-400/[0.08] border border-emerald-400/25 rounded-xl p-4 flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[11px] text-white tracking-[0.08em] mb-1">ELAPSED TIME</div>
                      <div className="font-heading text-[42px] text-emerald-400 tracking-[0.04em] leading-none">
                        {formatElapsed(elapsed)}
                      </div>
                    </div>
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"
                      style={{ boxShadow: '0 0 8px hsl(142 71% 45%)' }}
                    />
                  </div>

                  <button
                    onClick={endVisit}
                    className="w-full py-3.5 bg-red-400/[0.12] border border-red-400/40 rounded-xl cursor-pointer flex items-center justify-center gap-2.5"
                  >
                    <Square size={16} className="text-red-400" />
                    <span className="font-heading text-[18px] text-red-400 tracking-[0.08em]">
                      END VISIT
                    </span>
                  </button>
                </div>
              )}

              {/* POST-VISIT — Acuity closeout + complete */}
              {localStatus === 'post_visit' && (
                <div>
                  <AcuityCloseoutGate verdict={acuityVerdict} />

                  <div className="mb-3.5">
                    <label className="block text-[11px] text-white tracking-[0.08em] mb-2 font-semibold">
                      ACUITY NOTE
                    </label>
                    <textarea
                      value={clinicalNotes}
                      onChange={e => setClinicalNotes(e.target.value)}
                      placeholder="Brief factual note for Acuity closeout..."
                      rows={4}
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-[10px] p-3 text-white text-sm resize-y font-[inherit] outline-none placeholder:text-white/35"
                    />
                  </div>

	                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-3.5 py-3 mb-3.5">
	                    <div className="text-[11px] text-white tracking-[0.08em] mb-2.5 font-semibold">
	                      VISIT CHECKLIST
	                    </div>
                    {[
                      { key: 'bp_checked',     label: 'BP checked'       },
                      { key: 'iv_assessed',    label: 'IV site assessed' },
                      { key: 'patient_stable', label: 'Patient stable'   },
                      { key: 'consent_signed', label: 'Consent signed'   },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2.5 mb-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vitals[key]}
                          onChange={e => setVitals(v => ({ ...v, [key]: e.target.checked }))}
                          className="w-4 h-4 cursor-pointer"
                          style={{ accentColor: 'hsl(142 71% 45%)' }}
                        />
                        <span className="text-sm text-white">{label}</span>
                        {vitals[key] && <CheckCircle size={14} className="text-emerald-400" />}
	                      </label>
	                    ))}
	                  </div>

	                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-3.5 py-3 mb-3.5">
	                    <div className="flex items-center justify-between gap-3 mb-3">
	                      <div>
	                        <div className="text-[11px] text-white tracking-[0.08em] font-semibold">
	                          ACUITY REQUIRED FIELDS
	                        </div>
	                        <div className="text-[11px] text-white/45 mt-1">
	                          Acuity remains the source of record.
	                        </div>
	                      </div>
	                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.08] text-white/50">
	                        {closeoutComplete ? 'READY' : `${closeoutMissing.length} LEFT`}
	                      </span>
	                    </div>

	                    <div className="grid grid-cols-1 gap-2 mb-3">
	                      {[
	                        ['identityVerified', 'ID/DOB verified'],
	                        ['consentVerified', 'Consent verified'],
	                        ['gfeVerified', 'GFE verified'],
	                        ['allergiesReviewed', 'Allergies reviewed'],
	                        ['medicationsReviewed', 'Meds reviewed'],
	                        ['expirationChecked', 'Lot/expiration checked'],
	                      ].map(([key, label]) => (
	                        <label key={key} className="flex items-center gap-2.5 cursor-pointer">
	                          <input
	                            type="checkbox"
	                            checked={acuityCloseout[key]}
	                            onChange={e => updateAcuityCloseout({ [key]: e.target.checked })}
	                            className="w-4 h-4 cursor-pointer"
	                            style={{ accentColor: 'hsl(142 71% 45%)' }}
	                          />
	                          <span className="text-sm text-white">{label}</span>
	                        </label>
	                      ))}
	                    </div>

	                    <div className="grid grid-cols-3 gap-2 mb-2">
	                      {[
	                        ['preBp', 'Pre BP'],
	                        ['preHr', 'Pre HR'],
	                        ['preSpo2', 'Pre SpO2'],
	                        ['postBp', 'Post BP'],
	                        ['postHr', 'Post HR'],
	                        ['postSpo2', 'Post SpO2'],
	                      ].map(([key, label]) => (
	                        <input
	                          key={key}
	                          value={acuityCloseout[key]}
	                          onChange={e => updateAcuityCloseout({ [key]: e.target.value })}
	                          placeholder={label}
	                          className="min-w-0 rounded-lg px-2 py-2 text-xs font-[inherit] outline-none placeholder:text-white/30"
	                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
	                        />
	                      ))}
	                    </div>

	                    <div className="grid grid-cols-1 gap-2 mb-2">
	                      <input
	                        value={acuityCloseout.routeSite}
	                        onChange={e => updateAcuityCloseout({ routeSite: e.target.value })}
	                        placeholder="Route/site, e.g. IV left AC, IM right deltoid"
	                        className="rounded-lg px-3 py-2 text-sm font-[inherit] outline-none placeholder:text-white/30"
	                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
	                      />
	                      <input
	                        value={acuityCloseout.lotOrKitId}
	                        onChange={e => updateAcuityCloseout({ lotOrKitId: e.target.value })}
	                        placeholder="Medication lot or kit ID"
	                        className="rounded-lg px-3 py-2 text-sm font-[inherit] outline-none placeholder:text-white/30"
	                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
	                      />
	                      <textarea
	                        value={acuityCloseout.adverseEvent}
	                        onChange={e => updateAcuityCloseout({ adverseEvent: e.target.value })}
	                        rows={2}
	                        placeholder="Adverse event note. Enter None if no event."
	                        className="rounded-lg px-3 py-2 text-sm resize-none font-[inherit] outline-none placeholder:text-white/30"
	                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
	                      />
	                      <input
	                        value={acuityCloseout.dischargeCondition}
	                        onChange={e => updateAcuityCloseout({ dischargeCondition: e.target.value })}
	                        placeholder="Discharge condition"
	                        className="rounded-lg px-3 py-2 text-sm font-[inherit] outline-none placeholder:text-white/30"
	                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
	                      />
	                      <input
	                        value={acuityCloseout.nurseSignature}
	                        onChange={e => updateAcuityCloseout({ nurseSignature: e.target.value })}
	                        placeholder="Nurse signature"
	                        className="rounded-lg px-3 py-2 text-sm font-[inherit] outline-none placeholder:text-white/30"
	                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
	                      />
	                    </div>

	                    <label className="flex items-start gap-2.5 cursor-pointer">
	                      <input
	                        type="checkbox"
	                        checked={acuityCloseout.attestation}
	                        onChange={e => updateAcuityCloseout({ attestation: e.target.checked })}
	                        className="w-4 h-4 mt-0.5 cursor-pointer"
	                        style={{ accentColor: 'hsl(142 71% 45%)' }}
	                      />
	                      <span className="text-xs text-white leading-relaxed">
	                        I attest the Acuity closeout is accurate and complete for this visit.
	                      </span>
	                    </label>

	                    <label className="flex items-start gap-2.5 cursor-pointer mt-3">
	                      <input
	                        type="checkbox"
	                        checked={acuityCloseout.acuityEntered}
	                        onChange={e => updateAcuityCloseout({ acuityEntered: e.target.checked })}
	                        className="w-4 h-4 mt-0.5 cursor-pointer"
	                        style={{ accentColor: 'hsl(142 71% 45%)' }}
	                      />
	                      <span className="text-xs text-white leading-relaxed">
	                        Acuity updated manually.
	                      </span>
	                    </label>

	                    {!closeoutComplete && (
	                      <div className="text-[11px] text-white/55 mt-3">
	                        Missing: {closeoutMissing.slice(0, 6).join(', ')}{closeoutMissing.length > 6 ? '...' : ''}
	                      </div>
	                    )}
	                  </div>

	                  <button
	                    onClick={completeVisit}
	                    disabled={!canCompleteVisit}
	                    className="w-full py-4 border-0 rounded-xl flex items-center justify-center gap-2.5 transition-colors"
	                    style={{
	                      background: canCompleteVisit ? GOLD : 'hsl(var(--accent) / 0.2)',
	                      cursor: canCompleteVisit ? 'pointer' : 'not-allowed',
	                    }}
	                  >
	                    <CheckCircle
	                      size={18}
	                      style={{ color: canCompleteVisit ? 'hsl(var(--background))' : 'hsl(var(--accent) / 0.5)' }}
	                    />
	                    <span
	                      className="font-heading text-xl tracking-[0.08em]"
	                      style={{ color: canCompleteVisit ? 'hsl(var(--background))' : 'hsl(var(--accent) / 0.5)' }}
	                    >
	                      COMPLETE VISIT
	                    </span>
	                  </button>

	                  {!canCompleteVisit && (
	                    <div className="text-[11px] text-white text-center mt-2">
	                      Complete field check and Acuity closeout to finish.
	                    </div>
	                  )}
                </div>
              )}

              {/* ── Visit Notes ───────────────────────────────────────── */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setNotesOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.06em] transition-colors"
                  style={{
                    background: notesOpen ? 'hsl(var(--accent) / 0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${notesOpen ? 'hsl(var(--accent) / 0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: notesOpen ? GOLD : 'rgba(255,255,255,0.55)',
                  }}
                >
                  📋 {notesOpen ? 'Hide Notes' : 'Add Notes'}
                </button>

                <AnimatePresence>
                  {notesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-xl p-4 space-y-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <textarea
                          value={visitNote}
                          onChange={e => setVisitNote(e.target.value)}
                          placeholder="Visit notes..."
                          rows={3}
                          className="w-full rounded-lg p-3 text-sm resize-none font-[inherit] outline-none placeholder:text-white/30"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={bp}
                            onChange={e => setBp(e.target.value)}
                            placeholder="120/80"
                            className="flex-1 rounded-lg px-3 py-2 text-sm font-[inherit] outline-none placeholder:text-white/30"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
                            aria-label="Blood pressure"
                          />
                          <input
                            type="text"
                            value={hr}
                            onChange={e => setHr(e.target.value)}
                            placeholder="72"
                            className="flex-1 rounded-lg px-3 py-2 text-sm font-[inherit] outline-none placeholder:text-white/30"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'hsl(var(--foreground))' }}
                            aria-label="Heart rate"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={saveNotes}
                            className="px-4 py-1.5 rounded-lg text-sm font-semibold tracking-[0.06em] transition-colors"
                            style={{ background: GOLD, color: 'hsl(var(--background))' }}
                          >
                            Save
                          </button>
                          {notesSaved && (
                            <span className="text-xs text-emerald-400 font-semibold">Saved ✓</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── SupplyAlertModal ───────────────────────────────────────────────────────────
function SupplyAlertModal({ onClose }) {
  const [issue, setIssue] = useState('');
  const [sent, setSent]   = useState(false);

  function handleSend() {
    if (!issue.trim()) return;
    setSent(true);
    setTimeout(onClose, 1800);
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Nurse shift action"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="fixed inset-0 bg-black/75 z-[200] flex items-end px-4 pb-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[480px] mx-auto bg-[hsl(var(--card))] border border-white/[0.06] rounded-[20px] p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="font-heading text-xl text-white tracking-[0.06em]">
            SUPPLY ISSUE
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-0 cursor-pointer p-1"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-5">
            <CheckCircle size={40} className="text-white/70 mx-auto mb-3" />
            <div className="text-white text-base font-semibold">Alert sent to dispatch</div>
          </div>
        ) : (
          <>
            <textarea
              value={issue}
              onChange={e => setIssue(e.target.value)}
              placeholder="Describe the supply issue (e.g. missing IV bags, wrong medication, out of gauze)..."
              rows={4}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-[10px] p-3 text-white text-sm resize-none font-[inherit] outline-none placeholder:text-white/35 mb-3.5"
            />
            <button
              onClick={handleSend}
              className="w-full py-3.5 border-0 rounded-xl font-heading text-[18px] tracking-[0.08em] cursor-pointer"
              style={{ background: GOLD, color: 'hsl(var(--background))' }}
            >
              SEND ALERT
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── NurseShift (main export) ───────────────────────────────────────────────────
export default function NurseShift() {
  useSeo({
    title: 'Nurse Shift Command - Avalon Vitality',
    description: 'Avalon nurse shift command for live visits, routing, inventory, training, and closeout.',
    path: '/provider/shift',
    robots: 'noindex, nofollow',
  });
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Sync theme from localStorage so admin theme changes carry through here too
  useEffect(() => {
    const THEMES = ['dark', 'light', 'golden', 'dubs'];
    const saved = localStorage.getItem('avalon.theme') || 'dark';
    const el = document.documentElement;
    THEMES.forEach(t => el.classList.remove(t));
    el.classList.add(saved);
    return () => {
      // Clean up only if no AdminLayout will re-apply (defensive)
    };
  }, []);

  const [apptStatuses, setApptStatuses] = useState({});
  const [supplyModal,  setSupplyModal]  = useState(false);

  // Show today's visits when present; otherwise keep NURSE001 useful in demo mode
  // by showing Stephanie's active assigned queue.
  const todayStr = new Date().toISOString().slice(0, 10);
  const demoSeed = readLocal('demoSeed', null);
  const latestBooking = readLocal('lastBooking', null);
  const shouldShowDemoShift = APPOINTMENTS.length === 0
    && (demoSeed?.username === 'NURSE001' || user?.name === 'Stephanie R.');
  const demoAppts = shouldShowDemoShift ? [buildDemoNurseAppointment(latestBooking || {})] : [];
  const assignedAppts = APPOINTMENTS.filter(a => {
    const isNurse = a.nurse_id === 's2';
    const notCancelled = a.status !== 'cancelled';
    return isNurse && notCancelled;
  });
  const todayAppts = assignedAppts.filter(a => {
    const apptDate    = a.scheduled_at.slice(0, 10);
    const isToday     = apptDate === todayStr;
    return isToday;
  });
  const activeAssigned = assignedAppts.filter(a => a.status !== 'completed');
  const myAppts  = (todayAppts.length ? todayAppts : activeAssigned.length ? activeAssigned : assignedAppts.length ? assignedAppts : demoAppts).sort((a, b) => {
    const aStatus = apptStatuses[a.id] || a.status;
    const bStatus = apptStatuses[b.id] || b.status;
    if (statusOrder(aStatus) !== statusOrder(bStatus)) {
      return statusOrder(aStatus) - statusOrder(bStatus);
    }
    return new Date(a.scheduled_at) - new Date(b.scheduled_at);
  });

  const completedCount = myAppts.filter(a => (apptStatuses[a.id] || a.status) === 'completed').length;
  const remainingCount = myAppts.filter(a => {
    const s = apptStatuses[a.id] || a.status;
    return s !== 'completed';
  }).length;

  const nextAppt  = myAppts.find(a => (apptStatuses[a.id] || a.status) !== 'completed');
  const nextTime  = nextAppt ? formatTime(nextAppt.scheduled_at) : null;
  const travelEst = remainingCount > 0 ? `~${remainingCount * 20} min` : '—';

  function handleStatusChange(id, newStatus) {
    setApptStatuses(prev => ({ ...prev, [id]: newStatus }));
  }

  function handleEndShift() {
    if (window.confirm('End shift and return to dashboard?')) {
      navigate('/provider/dashboard');
    }
  }

  const nurseName = user?.name || 'Nurse';
  const nurseRecord = nurseRecordForName(nurseName);

  return (
    <div className="min-h-dvh bg-background text-foreground font-body">

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-[100] backdrop-blur-xl border-b border-foreground/[0.06] px-4 h-14 flex items-center justify-between" style={{ background: 'hsl(var(--background) / 0.92)' }}>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-[22px] tracking-[0.08em]" style={{ color: GOLD }}>AV</span>
          <span className="font-heading text-[11px] text-white tracking-[0.18em]">SHIFT VIEW</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-white font-semibold">{nurseName}</span>
          <Link
            to="/provider/dashboard"
            className="flex items-center gap-1 text-xs text-white no-underline px-2.5 py-1.5 border border-white/[0.06] rounded-lg"
          >
            <LayoutDashboard size={13} />
            Dashboard
          </Link>
        </div>
      </div>

      {/* ── page content ── */}
      <div className="max-w-[512px] mx-auto px-4 pt-5 pb-24">

        {/* ── SHIFT STATUS CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="bg-[hsl(var(--card))] border border-white/[0.06] rounded-[20px] p-5 mb-6 relative overflow-hidden"
        >
          {/* gold accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
            style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }}
          />

          <div className="font-heading text-[11px] tracking-[0.18em] text-white/40 mb-1.5">
            TODAY'S SHIFT
          </div>

          <h1 className="font-heading text-[64px] text-white leading-[0.95] mb-1.5">
            {myAppts.length} VISIT{myAppts.length !== 1 ? 'S' : ''}
          </h1>

          {nextTime && (
            <div className="text-sm text-white mb-4">
              Next appointment at{' '}
              <span className="text-white/90 font-bold">{nextTime}</span>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {[
              { icon: <CheckCircle2 size={13} className="text-emerald-400" />, label: `${completedCount} completed` },
              { icon: <Circle       size={13} className="text-white" />,        label: `${remainingCount} remaining` },
              { icon: <Clock        size={13} className="text-white" />,        label: `Travel est. ${travelEst}` },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/[0.06] rounded-full text-xs text-white"
              >
                {icon}
                {label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── SECTION LABEL ── */}
        <div className="font-heading text-[13px] tracking-[0.14em] text-white/40 mb-3">
          TODAY'S VISITS
        </div>

        {/* ── VISIT CARDS ── */}
        {myAppts.length === 0 ? (
          <div className="text-center py-10 text-white text-[15px]">
            No visits scheduled for today.
          </div>
        ) : (
          myAppts.map((appt, i) => (
            <VisitCard
              key={appt.id}
              appt={appt}
              visitNumber={i + 1}
              nurseName={nurseName}
              nurseRecord={nurseRecord}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {/* ── BOTTOM QUICK ACTIONS ── */}
      <div className="fixed bottom-0 inset-x-0 backdrop-blur-2xl border-t border-foreground/[0.06] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] z-[100]" style={{ background: 'hsl(var(--background) / 0.96)' }}>
        <div className="max-w-[512px] mx-auto flex gap-2.5">

          {/* Call Dispatch */}
          <a
            href={DISPATCH_PHONE}
            className="flex-1 flex min-h-[58px] flex-col items-center justify-center gap-1 bg-white/5 border border-white/[0.06] rounded-xl no-underline text-white"
          >
            <Phone size={18} className="text-white/50" />
            <span className="text-[11px] text-white font-semibold tracking-[0.04em]">DISPATCH</span>
          </a>

          {/* Supply Issue */}
          <button
            onClick={() => setSupplyModal(true)}
            className="flex-1 flex min-h-[58px] flex-col items-center justify-center gap-1 bg-white/5 border border-white/[0.06] rounded-xl cursor-pointer"
          >
            <AlertCircle size={18} className="text-yellow-400" />
            <span className="text-[11px] text-white font-semibold tracking-[0.04em]">SUPPLY ISSUE</span>
          </button>

          {/* End Shift */}
          <button
            onClick={handleEndShift}
            className="flex-1 flex min-h-[58px] flex-col items-center justify-center gap-1 bg-red-400/[0.08] border border-red-400/25 rounded-xl cursor-pointer"
          >
            <LogOut size={18} className="text-red-400" />
            <span className="text-[11px] text-red-400 font-semibold tracking-[0.04em]">END SHIFT</span>
          </button>
        </div>
      </div>

      {/* ── SUPPLY MODAL ── */}
      <AnimatePresence>
        {supplyModal && (
          <SupplyAlertModal onClose={() => setSupplyModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
