import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/useAuthStore';
import {
  APPOINTMENTS,
  getClient,
  getService,
  formatTime,
} from '@/data/commandMockData';
import {
  ChevronRight,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
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
} from 'lucide-react';

// ── constants ──────────────────────────────────────────────────────────────────
// GOLD reserved only for: START VISIT / COMPLETE VISIT / SEND ALERT buttons + AV logo + accent bar
const GOLD           = '#c9a84c';
const DISPATCH_PHONE = 'tel:+14155550101';
const EASE           = [0.16, 1, 0.3, 1];

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
function VisitCard({ appt, visitNumber, onStatusChange }) {
  const [expanded,      setExpanded]      = useState(false);
  const [localStatus,   setLocalStatus]   = useState(appt.status);
  const [clinicalNotes, setClinicalNotes] = useState(appt.clinical_notes || '');
  const [completedAt,   setCompletedAt]   = useState(null);
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [vitals, setVitals] = useState({
    bp_checked:       false,
    iv_assessed:      false,
    patient_stable:   false,
    consent_signed:   false,
  });

  const elapsed = useTimer(timerRunning);
  const client  = getClient(appt.client_id);
  const service = getService(appt.service_id);

  if (!client || !service) return null;

  function startVisit() {
    setLocalStatus('in_progress');
    setTimerRunning(true);
    onStatusChange(appt.id, 'in_progress');
  }

  function endVisit() {
    setTimerRunning(false);
    setLocalStatus('post_visit');
    onStatusChange(appt.id, 'post_visit');
  }

  function completeVisit() {
    const now = new Date();
    setCompletedAt(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    setLocalStatus('completed');
    onStatusChange(appt.id, 'completed');
  }

  const allVitalsChecked = Object.values(vitals).every(Boolean);

  const statusLabel = {
    scheduled:   'Scheduled',
    confirmed:   'Confirmed',
    in_progress: 'In Progress',
    post_visit:  'In Progress',
    completed:   'Completed',
  }[localStatus] || localStatus;

  const statusColor = {
    scheduled:   'rgba(255,255,255,0.5)',
    confirmed:   '#4ade80',
    in_progress: '#4ade80',
    post_visit:  '#4ade80',
    completed:   'rgba(255,255,255,0.7)',
  }[localStatus];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`bg-[#141414] rounded-2xl overflow-hidden mb-3 transition-colors border ${
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
                  <div className="text-[11px] text-white/40 mt-1 tracking-[0.04em]">
                    TAP TO OPEN IN MAPS →
                  </div>
                </div>
              </a>

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
                <div className="bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.25)] rounded-[10px] p-3.5">
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
                  <Play size={18} color="#0A0A0A" />
                  <span className="font-heading text-xl tracking-[0.08em]" style={{ color: '#0A0A0A' }}>
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
                      style={{ boxShadow: '0 0 8px #4ade80' }}
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

              {/* POST-VISIT — SOAP notes + vitals + complete */}
              {localStatus === 'post_visit' && (
                <div>
                  <div className="mb-3.5">
                    <label className="block text-[11px] text-white tracking-[0.08em] mb-2 font-semibold">
                      CLINICAL NOTES (SOAP)
                    </label>
                    <textarea
                      value={clinicalNotes}
                      onChange={e => setClinicalNotes(e.target.value)}
                      placeholder="Subjective, Objective, Assessment, Plan..."
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
                          style={{ accentColor: '#4ade80' }}
                        />
                        <span className="text-sm text-white">{label}</span>
                        {vitals[key] && <CheckCircle size={14} className="text-emerald-400" />}
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={completeVisit}
                    disabled={!allVitalsChecked}
                    className="w-full py-4 border-0 rounded-xl flex items-center justify-center gap-2.5 transition-colors"
                    style={{
                      background: allVitalsChecked ? GOLD : 'rgba(201,168,76,0.2)',
                      cursor: allVitalsChecked ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <CheckCircle
                      size={18}
                      style={{ color: allVitalsChecked ? '#0A0A0A' : 'rgba(201,168,76,0.5)' }}
                    />
                    <span
                      className="font-heading text-xl tracking-[0.08em]"
                      style={{ color: allVitalsChecked ? '#0A0A0A' : 'rgba(201,168,76,0.5)' }}
                    >
                      COMPLETE VISIT
                    </span>
                  </button>

                  {!allVitalsChecked && (
                    <div className="text-[11px] text-white text-center mt-2">
                      Complete all checklist items to finish the visit
                    </div>
                  )}
                </div>
              )}

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
        className="w-full max-w-[480px] mx-auto bg-[#141414] border border-white/[0.06] rounded-[20px] p-6"
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
              style={{ background: GOLD, color: '#0A0A0A' }}
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
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [apptStatuses, setApptStatuses] = useState({});
  const [supplyModal,  setSupplyModal]  = useState(false);

  // Show Stephanie's (s2) appointments for today (always uses real current date)
  const todayStr = new Date().toISOString().slice(0, 10);
  const myAppts  = APPOINTMENTS.filter(a => {
    const apptDate    = a.scheduled_at.slice(0, 10);
    const isToday     = apptDate === todayStr;
    const isNurse     = a.nurse_id === 's2';
    const notCancelled = a.status !== 'cancelled';
    return isToday && isNurse && notCancelled;
  }).sort((a, b) => {
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

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-white font-body">

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-[100] bg-[rgba(10,10,10,0.92)] backdrop-blur-xl border-b border-white/[0.06] px-4 h-14 flex items-center justify-between">
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
          className="bg-[#141414] border border-white/[0.06] rounded-[20px] p-5 mb-6 relative overflow-hidden"
        >
          {/* gold accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
            style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }}
          />

          <div className="font-heading text-[11px] tracking-[0.18em] text-white/40 mb-1.5">
            TODAY'S SHIFT
          </div>

          <div className="font-heading text-[64px] text-white leading-[0.95] mb-1.5">
            {myAppts.length} VISIT{myAppts.length !== 1 ? 'S' : ''}
          </div>

          {nextTime && (
            <div className="text-sm text-white mb-4">
              Next appointment at{' '}
              <span className="text-white/90 font-bold">{nextTime}</span>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {[
              { icon: <CheckCircle size={13} className="text-emerald-400" />, label: `${completedCount} completed` },
              { icon: <Circle      size={13} className="text-white" />,        label: `${remainingCount} remaining` },
              { icon: <Clock       size={13} className="text-white" />,        label: `Travel est. ${travelEst}` },
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
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {/* ── BOTTOM QUICK ACTIONS ── */}
      <div className="fixed bottom-0 inset-x-0 bg-[rgba(10,10,10,0.96)] backdrop-blur-2xl border-t border-white/[0.06] px-4 pt-3 pb-5 z-[100]">
        <div className="max-w-[512px] mx-auto flex gap-2.5">

          {/* Call Dispatch */}
          <a
            href={DISPATCH_PHONE}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 bg-white/5 border border-white/[0.06] rounded-xl no-underline text-white"
          >
            <Phone size={18} className="text-white/50" />
            <span className="text-[11px] text-white font-semibold tracking-[0.04em]">DISPATCH</span>
          </a>

          {/* Supply Issue */}
          <button
            onClick={() => setSupplyModal(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 bg-white/5 border border-white/[0.06] rounded-xl cursor-pointer"
          >
            <AlertCircle size={18} className="text-yellow-400" />
            <span className="text-[11px] text-white font-semibold tracking-[0.04em]">SUPPLY ISSUE</span>
          </button>

          {/* End Shift */}
          <button
            onClick={handleEndShift}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 bg-red-400/[0.08] border border-red-400/25 rounded-xl cursor-pointer"
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
