import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CloudOff,
  CloudUpload,
  Coffee,
  ExternalLink,
  Flag,
  Loader2,
  MapPin,
  Navigation,
  Play,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, apiPost } from '@/lib/apiClient';
import { assertApiResponse } from '@/lib/apiResponse';
import { nursePortalNav } from '@/lib/nursePortalNav';
import {
  applyNurseOutboxOverlay,
  cacheNurseShiftPayload,
  getNurseOfflineIdentity,
  isNetworkFailure,
  listNurseOutbox,
  NURSE_OFFLINE_ACTIONS,
  queueNurseOfflineAction,
  readCachedNurseShiftPayload,
  readinessAllowsOfflineClockIn,
  syncNurseOutbox,
} from '@/lib/nurseOfflineOutbox';
import { useSeo } from '@/lib/seo';

const READY_STATUSES = new Set(['ready', 'clear']);
const TERMINAL_RUN_STATUSES = new Set(['completed', 'closed', 'time_submitted', 'paid', 'cancelled']);
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
});
const SHORT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
});
const RESOLUTIONS = [
  { value: 'completed', label: 'Completed', tone: 'primary' },
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'patient_declined', label: 'Patient declined', reason: true },
  { value: 'clinically_contraindicated', label: 'Contraindicated', reason: true },
  { value: 'blocked_by_safety', label: 'Safety blocked', reason: true },
  { value: 'blocked_by_system', label: 'System blocked', reason: true },
  { value: 'handed_off', label: 'Handed off', reason: true },
];
const EXCEPTION_TYPES = [
  { value: 'emergency', kind: 'emergency', label: 'Emergency', severity: 'emergency', reasonCode: 'nurse_reported_emergency' },
  { value: 'safety', kind: 'safety', label: 'Safety concern', severity: 'urgent', reasonCode: 'nurse_reported_safety_concern' },
  { value: 'clinical_escalation', kind: 'clinical', label: 'Clinical escalation', severity: 'urgent', reasonCode: 'nurse_requested_clinical_escalation' },
  { value: 'adverse_event', kind: 'clinical', label: 'Adverse event', severity: 'emergency', reasonCode: 'nurse_reported_adverse_event' },
  { value: 'system_outage', kind: 'system', label: 'System / outage', severity: 'operational', reasonCode: 'nurse_reported_system_outage' },
  { value: 'patient_unavailable', kind: 'client', label: 'Patient unavailable', severity: 'operational', reasonCode: 'patient_unavailable' },
  { value: 'staffing_change', kind: 'route', label: 'Staffing change', severity: 'operational', reasonCode: 'staffing_change' },
  { value: 'other', kind: 'system', label: 'Other operational issue', severity: 'operational', reasonCode: 'other_operational_issue' },
];
const TIME_CORRECTION_REASONS = [
  { value: 'missed_clock_event', label: 'Missed clock event' },
  { value: 'incorrect_clock_time', label: 'Incorrect clock time' },
  { value: 'missed_break_event', label: 'Missed break event' },
  { value: 'device_connectivity_issue', label: 'Device or connectivity issue' },
  { value: 'other_operational_correction', label: 'Other operational correction' },
];

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const labelCase = (value, fallback = '') => text(value || fallback).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const eventType = (event) => text(event?.event_type || event?.type || event?.action).toLowerCase();
const eventTime = (event) => event?.occurred_at || event?.recorded_at || event?.created_at;
const formatDateTime = (value, fallback = 'Not available') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? TIME_FORMATTER.format(date) : fallback;
};
const requestUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

function assertGuidedShiftPayload(value, shiftId, message) {
  assertApiResponse(value, {
    objects: ['shift'],
    arrays: ['timeEvents', 'stepEvents', 'exceptions'],
    nullableObjects: ['readiness', 'run', 'route', 'guide', 'nextAction'],
  }, message);
  if (!value || typeof value !== 'object' || !value.shift || text(value.shift.id) !== text(shiftId)) {
    throw new Error(message);
  }
  return value;
}

function toIsoTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function lastTimeEvent(events, wanted) {
  return [...events].reverse().find((event) => wanted.has(eventType(event))) || null;
}

function clockState(payload) {
  const events = Array.isArray(payload?.timeEvents) ? payload.timeEvents : [];
  const explicit = text(payload?.run?.time_status || payload?.run?.clock_status).toLowerCase();
  const lastClock = lastTimeEvent(events, new Set(['clock_in', 'clocked_in', 'clock_out', 'clocked_out']));
  const lastBreak = lastTimeEvent(events, new Set(['break_start', 'break_end']));
  const clockedIn = ['clocked_in', 'working', 'on_break'].includes(explicit)
    || ['clock_in', 'clocked_in'].includes(eventType(lastClock));
  const clockedOut = ['clocked_out', 'time_submitted'].includes(explicit)
    || ['clock_out', 'clocked_out'].includes(eventType(lastClock));
  const onBreak = explicit === 'on_break'
    || (clockedIn && eventType(lastBreak) === 'break_start' && (!lastClock || Date.parse(eventTime(lastBreak)) > Date.parse(eventTime(lastClock))));
  return { clockedIn: clockedIn && !clockedOut, clockedOut, onBreak };
}

function elapsedLabel(payload, now) {
  const events = Array.isArray(payload?.timeEvents) ? payload.timeEvents : [];
  const clockIn = events.find((event) => ['clock_in', 'clocked_in'].includes(eventType(event)));
  const start = Date.parse(eventTime(clockIn) || payload?.run?.clocked_in_at);
  if (!Number.isFinite(start)) return 'Time is recorded by the server';
  const end = clockState(payload).clockedIn ? now : Date.parse(payload?.run?.clocked_out_at) || now;
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m recorded`;
}

function safeNavigationUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function StatusPill({ value }) {
  const status = text(value).toLowerCase() || 'unavailable';
  const positive = READY_STATUSES.has(status) || ['active', 'clocked_in', 'completed', 'clear'].includes(status);
  const negative = ['blocked', 'failed', 'expired', 'exception_review', 'cancelled'].includes(status);
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.11em] ${positive ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700' : negative ? 'border-red-500/25 bg-red-500/[0.06] text-red-700' : 'border-amber-500/25 bg-amber-500/[0.06] text-amber-800'}`}>{labelCase(status)}</span>;
}

function ReadinessCard({ readiness }) {
  const domains = Array.isArray(readiness?.domains)
    ? readiness.domains
    : readiness?.domains && typeof readiness.domains === 'object'
      ? Object.entries(readiness.domains).map(([key, value]) => ({ key, ...(value && typeof value === 'object' ? value : {}) }))
      : [];
  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><h2 className="text-sm font-semibold">Shift readiness</h2></div>
        <StatusPill value={readiness?.status} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {domains.map((domain) => (
          <div key={domain?.key || domain?.label} className="rounded-2xl border border-foreground/10 bg-background/65 p-3">
            <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold">{domain?.label || labelCase(domain?.key)}</p><StatusPill value={domain?.status} /></div>
            {domain?.reason || domain?.reason_code ? <p className="mt-2 text-xs leading-relaxed text-foreground/55">{domain.reason || labelCase(domain.reason_code)}</p> : null}
            {domain?.remediation ? <p className="mt-2 text-xs font-medium text-foreground/75">Next: {domain.remediation}</p> : null}
          </div>
        ))}
        {!domains.length ? <p className="text-xs leading-relaxed text-foreground/55">No readiness evidence is available. Starting care stays disabled until the server returns current evidence.</p> : null}
      </div>
    </section>
  );
}

function RouteCard({ route }) {
  const appleUrl = safeNavigationUrl(route?.navigation?.apple_maps_url);
  const googleUrl = safeNavigationUrl(route?.navigation?.google_maps_url);
  const hasRoute = Boolean(route?.route_day_id);
  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><h2 className="text-sm font-semibold">Route handoff</h2></div>
        <StatusPill value={route?.route_status || (hasRoute ? 'ready' : 'unavailable')} />
      </div>
      {hasRoute ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-foreground/55">Open turn-by-turn directions in your maps app. Avalon does not continuously track your location.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {appleUrl ? <a href={appleUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><Navigation className="h-3.5 w-3.5" />Apple Maps<ExternalLink className="h-3 w-3" /></a> : null}
            {googleUrl ? <a href={googleUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><Navigation className="h-3.5 w-3.5" />Google Maps<ExternalLink className="h-3 w-3" /></a> : null}
          </div>
          {!appleUrl && !googleUrl ? <p className="mt-3 text-xs text-amber-800">Navigation is not available until the route provider returns a verified handoff URL.</p> : null}
        </>
      ) : <p className="mt-3 text-xs leading-relaxed text-foreground/55">No persisted route is available. Navigation and arrival actions remain disabled.</p>}
    </section>
  );
}

function NextActionCard({ nextAction, clockedIn, onResolve, busy }) {
  const [resolution, setResolution] = useState('completed');
  const action = text(nextAction?.action).toLowerCase();
  const stepKey = text(nextAction?.step_key || nextAction?.stepKey);
  const isGuideStep = action === 'resolve_step' && Boolean(stepKey);
  const canResolve = clockedIn && isGuideStep;

  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Next verified action</p>
      <h2 className="mt-2 text-xl font-semibold">{nextAction?.label || labelCase(action, 'No action available')}</h2>
      {isGuideStep && text(nextAction?.instructions) ? <p className="mt-2 text-sm leading-relaxed text-foreground/65">{text(nextAction.instructions)}</p> : null}
      {!nextAction ? <p className="mt-2 text-sm leading-relaxed text-foreground/55">The server did not return a next action. Refresh or contact Avalon Operations; do not invent a care step.</p> : null}
      {nextAction && !clockedIn && !['start', 'clock_in', 'review_payment'].includes(action) ? <p className="mt-2 text-sm text-amber-800">Clock in before resolving shift steps.</p> : null}
      {isGuideStep ? (
        <div className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {RESOLUTIONS.map((item) => (
              <button key={item.value} type="button" onClick={() => setResolution(item.value)} aria-pressed={resolution === item.value} className={`min-h-11 rounded-xl border px-3 text-left text-xs font-semibold ${resolution === item.value ? 'border-foreground bg-foreground text-background' : 'border-foreground/12 bg-background/60'}`}>{item.label}</button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-foreground/50">Only the selected structured resolution is saved here. Put any required clinical narrative in the approved clinical source of record.</p>
          <button type="button" disabled={!canResolve || busy} onClick={() => onResolve({ stepKey, resolution, reasonCode: resolution })} className="mt-3 min-h-12 w-full rounded-2xl bg-foreground px-4 text-[11px] font-bold uppercase tracking-[0.13em] text-background disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 inline h-4 w-4" />}Save step resolution
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ExceptionPanel({ exceptions, onOpen, busy }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('safety');
  const selected = EXCEPTION_TYPES.find((item) => item.value === type) || EXCEPTION_TYPES[1];
  const active = exceptions.filter((item) => !['resolved', 'closed'].includes(text(item?.status).toLowerCase()));
  const submit = async () => {
    const ok = await onOpen({ exceptionType: selected.kind, severity: selected.severity, reasonCode: selected.reasonCode });
    if (ok) setOpen(false);
  };
  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><div><h2 className="text-sm font-semibold">Exceptions and safety</h2><p className="mt-0.5 text-xs text-foreground/45">{active.length} unresolved</p></div></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-11 rounded-full border border-red-500/25 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-red-700"><Flag className="mr-1 inline h-3.5 w-3.5" />Report an issue</button>
      </div>
      {active.length ? <div className="mt-3 grid gap-2">{active.map((item) => <div key={item.id} className="rounded-xl border border-red-500/15 bg-red-500/[0.035] p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold">{labelCase(item.exception_type || item.kind, 'Open exception')}</p><StatusPill value={item.status || 'open'} /></div>{item.created_at ? <p className="mt-1 text-[10px] text-foreground/40">{item.pending_sync ? 'Saved on device' : 'Opened'} {formatDateTime(item.created_at)}</p> : null}{item.pending_sync ? <p className="mt-1 text-xs font-medium text-amber-800">Avalon has not been alerted yet. Sync is pending.</p> : null}</div>)}</div> : null}
      {open ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.035] p-4">
          <p className="text-xs font-semibold text-red-800">If anyone is in immediate danger, call 911 first.</p>
          <a href="tel:911" className="mt-2 inline-flex min-h-11 items-center rounded-full border border-red-500/30 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-red-700"><AlertOctagon className="mr-1 h-3.5 w-3.5" />Call 911</a>
          <label className="mt-3 block text-xs font-semibold">Issue type
            <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base">{EXCEPTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <p className="mt-3 text-xs leading-relaxed text-foreground/55">This saves only the structured issue type and severity. Add clinical details only in the approved clinical record. Avalon is alerted only after the server confirms this report.</p>
          <button type="button" disabled={busy} onClick={submit} className="mt-3 min-h-11 rounded-full bg-red-700 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-40">Save issue report</button>
        </div>
      ) : null}
    </section>
  );
}

function TimeCorrectionPanel({ onSubmit, busy, pending }) {
  const [reasonCode, setReasonCode] = useState(TIME_CORRECTION_REASONS[0].value);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const requestedClockInAt = toIsoTimestamp(clockIn);
  const requestedClockOutAt = toIsoTimestamp(clockOut);
  const chronological = !requestedClockInAt || !requestedClockOutAt
    || Date.parse(requestedClockOutAt) >= Date.parse(requestedClockInAt);
  const canSubmit = Boolean(requestedClockInAt || requestedClockOutAt) && chronological;
  const submit = async () => {
    if (!canSubmit) return;
    const ok = await onSubmit({
      reasonCode,
      ...(requestedClockInAt ? { requestedClockInAt } : {}),
      ...(requestedClockOutAt ? { requestedClockOutAt } : {}),
    });
    if (ok) { setClockIn(''); setClockOut(''); }
  };
  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold">Time correction request</h2><p className="mt-1 text-xs leading-relaxed text-foreground/50">Request a coded correction without changing recorded time on this device.</p></div>
        {pending ? <StatusPill value="pending_sync" /> : null}
      </div>
      <label className="mt-3 block text-xs font-semibold">Reason
        <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base">
          {TIME_CORRECTION_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
        </select>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Requested clock-in
          <input type="datetime-local" value={clockIn} onChange={(event) => setClockIn(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" />
        </label>
        <label className="text-xs font-semibold">Requested clock-out
          <input type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" />
        </label>
      </div>
      {!chronological ? <p className="mt-2 text-xs text-red-700">Requested clock-out must follow requested clock-in.</p> : null}
      <p className="mt-3 text-xs leading-relaxed text-foreground/50">No free-text or clinical detail is stored. Operations must review the structured request before recorded time changes.</p>
      <button type="button" disabled={!canSubmit || busy} onClick={submit} className="mt-3 min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Clock3 className="mr-1 inline h-3.5 w-3.5" />}Request correction
      </button>
    </section>
  );
}

function OfflineSyncPanel({ offline, cachedAt, items, syncing, online, error, onSync }) {
  const pending = items.filter((item) => item.status === 'pending');
  const conflicts = items.filter((item) => item.status === 'conflict');
  if (!offline && !items.length && !error) return null;
  return (
    <section className={`mt-4 rounded-3xl border p-4 ${conflicts.length ? 'border-red-500/25 bg-red-500/[0.045]' : 'border-amber-500/25 bg-amber-500/[0.045]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {offline ? <CloudOff className="mt-0.5 h-4 w-4 text-amber-800" /> : <CloudUpload className="mt-0.5 h-4 w-4 text-amber-800" />}
          <div>
            <h2 className="text-sm font-semibold">{offline ? 'Offline shift mode' : 'Device actions awaiting sync'}</h2>
            <p className="mt-1 text-xs leading-relaxed text-foreground/55">{offline ? `Showing a sanitized assigned-shift cache${cachedAt ? ` from ${formatDateTime(cachedAt)}` : ''}. No names, addresses, navigation, notes, or clinical record data are stored.` : `${pending.length} action${pending.length === 1 ? '' : 's'} pending server confirmation.`}</p>
          </div>
        </div>
        {items.length ? <button type="button" disabled={!online || syncing} onClick={onSync} className="min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-40">{syncing ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 inline h-3.5 w-3.5" />}Sync now</button> : null}
      </div>
      {pending.some((item) => item.action === 'open_exception') ? <p className="mt-3 rounded-xl border border-amber-500/20 bg-background/60 p-3 text-xs font-medium text-amber-800">An issue report is saved only on this device. Avalon has not been alerted until it syncs.</p> : null}
      {conflicts.length ? (
        <div className="mt-3 grid gap-2">
          {conflicts.map((item) => <p key={item.id} role="alert" className="rounded-xl border border-red-500/20 bg-background/60 p-3 text-xs text-red-700">409 conflict retained for {labelCase(item.action)} · {labelCase(item.conflictCode, 'Server state conflict')}. Refresh current server state before retrying.</p>)}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
      {offline ? <p className="mt-3 text-xs font-medium text-amber-800">Fresh preflight never starts offline. Clock-in requires an explicitly allowed, unexpired readiness snapshot. Clock-out remains available.</p> : null}
    </section>
  );
}

export default function NurseGuidedShift() {
  const { shiftId = '' } = useParams();
  useSeo({
    title: 'Guided Shift — Avalon Vitality',
    description: 'Persisted nurse time, route, guided steps, exceptions, and closeout.',
    path: shiftId ? `/provider/shifts/${shiftId}` : '/provider/shifts',
    robots: 'noindex, nofollow, noarchive',
  });
  const [state, setState] = useState({ loading: true, error: '', payload: null, offline: false, cachedAt: null });
  const [outbox, setOutbox] = useState({ items: [], syncing: false, error: '' });
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [breakHandoffConfirmed, setBreakHandoffConfirmed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const idempotencyKeys = useRef(new Map());
  const identityRef = useRef(null);
  const payloadRef = useRef(null);

  const refreshOutbox = useCallback(async (identity = identityRef.current) => {
    if (!identity || !shiftId) return [];
    const items = await listNurseOutbox({ shiftId, identity });
    setOutbox((current) => ({ ...current, items }));
    return items;
  }, [shiftId]);

  const syncNow = useCallback(async ({ includeConflicts = false, identity: suppliedIdentity = null } = {}) => {
    const identity = suppliedIdentity || identityRef.current;
    if (!identity || !shiftId || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
    setOutbox((current) => ({ ...current, syncing: true, error: '' }));
    try {
      const result = await syncNurseOutbox({ shiftId, identity, includeConflicts });
      if (result.latestPayload) {
        assertGuidedShiftPayload(result.latestPayload, shiftId, 'The synced shift source returned an invalid response.');
        payloadRef.current = result.latestPayload;
        setState({ loading: false, error: '', payload: result.latestPayload, offline: false, cachedAt: null });
      }
      setOutbox({
        items: result.items,
        syncing: false,
        error: result.stoppedReason === 'server_rejected'
          ? 'The server rejected a queued action. It remains visible for review.' : '',
      });
      if (result.syncedCount) setActionNotice(`${result.syncedCount} device action${result.syncedCount === 1 ? '' : 's'} synced and confirmed by the server.`);
      if (result.stoppedReason === 'offline') setState((current) => ({ ...current, offline: true, error: 'Network connection was lost during sync.' }));
      return result;
    } catch (error) {
      const networkFailure = isNetworkFailure(error);
      if (networkFailure) setState((current) => ({ ...current, offline: true, error: 'Network connection was lost during sync.' }));
      setOutbox((current) => ({
        ...current,
        syncing: false,
        error: networkFailure ? 'Sync paused until the connection returns.' : 'Queued actions could not be synced.',
      }));
      return null;
    }
  }, [shiftId]);

  const load = useCallback(async () => {
    if (!shiftId) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = assertGuidedShiftPayload(
        await apiGet(`/api/me/shift-runs?shiftId=${encodeURIComponent(shiftId)}`),
        shiftId,
        'The guided shift source returned an invalid response.',
      );
      payloadRef.current = data;
      setState({ loading: false, error: '', payload: data, offline: false, cachedAt: null });
      try {
        const identity = await getNurseOfflineIdentity(data);
        identityRef.current = identity;
        await cacheNurseShiftPayload({ shiftId, payload: data, identity });
        const items = await refreshOutbox(identity);
        if (items.some((item) => item.status === 'pending')) void syncNow({ identity });
      } catch {
        identityRef.current = null;
        setOutbox((current) => ({ ...current, error: 'Secure offline storage is unavailable until the authenticated nurse scope can be verified.' }));
      }
    } catch (error) {
      if (isNetworkFailure(error)) {
        try {
          const identity = identityRef.current || await getNurseOfflineIdentity();
          identityRef.current = identity;
          const cached = await readCachedNurseShiftPayload({ shiftId, identity });
          if (cached) {
            const items = await refreshOutbox(identity);
            payloadRef.current = cached.payload;
            setOutbox((current) => ({ ...current, items }));
            setState({
              loading: false,
              error: 'The network source is unavailable. Showing the sanitized device cache.',
              payload: cached.payload,
              offline: true,
              cachedAt: cached.cachedAt,
            });
            return;
          }
        } catch { /* fail closed below when no authenticated cache is available */ }
      }
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message || 'Could not load the guided shift.',
        offline: isNetworkFailure(error),
      }));
    }
  }, [refreshOutbox, shiftId, syncNow]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { payloadRef.current = state.payload; }, [state.payload]);
  useEffect(() => {
    const connected = () => { setOnline(true); void load(); };
    const disconnected = () => {
      setOnline(false);
      void load();
    };
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, [load]);

  const displayPayload = useMemo(
    () => applyNurseOutboxOverlay(state.payload, outbox.items),
    [outbox.items, state.payload],
  );

  useEffect(() => {
    if (!displayPayload || !clockState(displayPayload).clockedIn) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [displayPayload]);

  const queueAction = async ({ action, extra, idempotencyKey, deviceOccurredAt, currentPayload, offlineMode = false }) => {
    const identity = identityRef.current;
    if (!identity) throw new Error('Secure offline actions are unavailable because this nurse session is not fully bound.');
    await queueNurseOfflineAction({
      shiftId,
      action,
      extra,
      identity,
      currentPayload,
      idempotencyKey,
      deviceOccurredAt,
    });
    const items = await refreshOutbox(identity);
    setOutbox((current) => ({ ...current, items, error: '' }));
    if (offlineMode) {
      const cached = await readCachedNurseShiftPayload({ shiftId, identity });
      if (cached) {
        payloadRef.current = cached.payload;
        setState({
          loading: false,
          error: 'The network source is unavailable. Showing the sanitized device cache.',
          payload: cached.payload,
          offline: true,
          cachedAt: cached.cachedAt,
        });
      }
    }
    if (action === 'open_exception') {
      setActionNotice('Issue report saved on this device. Avalon has not been alerted; sync is pending.');
    } else if (action === 'clock_out') {
      setActionNotice('Clock-out saved on this device and pending server sync.');
    } else if (action === 'request_time_correction') {
      setActionNotice('Structured time correction saved on this device and pending review sync.');
    } else {
      setActionNotice(`${labelCase(action)} saved on this device and pending server sync.`);
    }
    return true;
  };

  const perform = async (action, extra = {}) => {
    const keyName = `${shiftId}:${action}:${extra.stepKey || extra.exceptionType || extra.reasonCode || ''}`;
    let idempotencyKey = idempotencyKeys.current.get(keyName);
    if (!idempotencyKey) {
      idempotencyKey = requestUuid();
      idempotencyKeys.current.set(keyName, idempotencyKey);
    }
    const deviceOccurredAt = new Date().toISOString();
    const currentPayload = displayPayload || state.payload;
    const offlineNow = state.offline || !online || (typeof navigator !== 'undefined' && navigator.onLine === false);
    const existingQueue = outbox.items.some((item) => ['pending', 'conflict'].includes(item.status));
    setBusy(action);
    setActionError('');
    setActionNotice('');
    try {
      if (offlineNow || (existingQueue && NURSE_OFFLINE_ACTIONS.has(action))) {
        if (!NURSE_OFFLINE_ACTIONS.has(action)) {
          throw new Error('Fresh preflight cannot start offline. Reconnect and refresh current server readiness.');
        }
        const queued = await queueAction({ action, extra, idempotencyKey, deviceOccurredAt, currentPayload, offlineMode: offlineNow });
        idempotencyKeys.current.delete(keyName);
        if (!offlineNow && online) void syncNow();
        return queued;
      }

      let current = state.payload;
      if (action === 'closeout') {
        current = assertGuidedShiftPayload(
          await apiGet(`/api/me/shift-runs?shiftId=${encodeURIComponent(shiftId)}`),
          shiftId,
          'Current run state is required before closeout.',
        );
      }
      const identity = identityRef.current;
      const result = assertGuidedShiftPayload(await apiPost('/api/me/shift-runs', {
        action,
        shiftId,
        version: current?.run?.version ?? current?.shift?.version,
        idempotencyKey,
        deviceOccurredAt,
        ...(identity ? { deviceId: identity.deviceId, authSessionBinding: identity.authSessionBinding } : {}),
        ...extra,
      }), shiftId, 'The saved shift action returned an invalid response.');
      idempotencyKeys.current.delete(keyName);
      payloadRef.current = result;
      setState({ loading: false, error: '', payload: result, offline: false, cachedAt: null });
      try {
        const verifiedIdentity = identity || await getNurseOfflineIdentity(result);
        identityRef.current = verifiedIdentity;
        await cacheNurseShiftPayload({ shiftId, payload: result, identity: verifiedIdentity });
        await refreshOutbox(verifiedIdentity);
      } catch { /* the server-confirmed action remains valid even if device caching is unavailable */ }
      if (action === 'open_exception') setActionNotice('Avalon server confirmed the structured issue report.');
      else if (action === 'request_time_correction') setActionNotice('The structured time correction is pending Operations review.');
      return true;
    } catch (error) {
      if (isNetworkFailure(error) && NURSE_OFFLINE_ACTIONS.has(action)) {
        try {
          setState((current) => ({ ...current, offline: true, error: 'The network source is unavailable.' }));
          const queued = await queueAction({ action, extra, idempotencyKey, deviceOccurredAt, currentPayload, offlineMode: true });
          idempotencyKeys.current.delete(keyName);
          return queued;
        } catch (queueError) {
          setActionError(queueError.message || 'That action could not be saved safely offline.');
          return false;
        }
      }
      const conflict = error?.status === 409;
      setActionError(conflict
        ? `Server conflict (${text(error?.body?.code) || 'state_changed'}). Refresh current shift state before retrying.`
        : error.message || 'That action could not be saved. Your screen was not advanced.');
      return false;
    } finally {
      setBusy('');
    }
  };

  if (state.loading && !state.payload) {
    return (
      <main className="min-h-dvh bg-background px-4 pb-28 pt-8 text-foreground">
        <section className="mx-auto max-w-3xl">
          <p className="flex items-center gap-2 rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading persisted guided shift</p>
        </section>
        <MobileNavBar items={nursePortalNav(shiftId)} columns={nursePortalNav(shiftId).length} maxWidth="shift" mobileOnly={false} ariaLabel="Guided nurse shift" />
      </main>
    );
  }

  if (!state.loading && state.error && !state.payload) {
    return (
      <main className="min-h-dvh bg-background px-4 pb-28 pt-8 text-foreground">
        <section className="mx-auto max-w-3xl">
          <Link to="/provider/shifts" className="mb-5 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]"><ArrowLeft className="h-4 w-4" />Work queue</Link>
          <OperationalSourceUnavailable
            title="Guided shift unavailable"
            description="The authenticated server source could not be reached and no matching sanitized device cache was available. No care step is inferred, and all shift actions remain disabled."
          />
        </section>
        <MobileNavBar items={nursePortalNav(shiftId)} columns={nursePortalNav(shiftId).length} maxWidth="shift" mobileOnly={false} ariaLabel="Guided nurse shift" />
      </main>
    );
  }

  const payload = displayPayload;
  const shift = payload?.shift || {};
  const readiness = payload?.readiness || shift.readiness || null;
  const ready = READY_STATUSES.has(text(readiness?.status).toLowerCase());
  const run = payload?.run || null;
  const runState = text(run?.status || run?.workflow_status).toLowerCase();
  const hasRun = Boolean(run?.id);
  const terminal = TERMINAL_RUN_STATUSES.has(runState);
  const { clockedIn, clockedOut, onBreak } = clockState(payload);
  const timeEvents = Array.isArray(payload?.timeEvents) ? payload.timeEvents : [];
  const exceptions = Array.isArray(payload?.exceptions) ? payload.exceptions : [];
  const unresolvedExceptions = exceptions.filter((item) => !['resolved', 'closed'].includes(text(item?.status).toLowerCase()));
  const nextAction = payload?.nextAction || null;
  const startAllowed = ready && readiness?.start_allowed === true && !hasRun && !state.offline && online;
  const clockInAllowed = readinessAllowsOfflineClockIn(payload, now) && hasRun && !clockedIn && !clockedOut && !terminal && !unresolvedExceptions.length;
  const closeoutSuggested = text(nextAction?.action).toLowerCase() === 'closeout';
  const pendingItems = outbox.items.filter((item) => item.status === 'pending');
  const pendingClockOut = pendingItems.some((item) => item.action === 'clock_out');
  const pendingTimeCorrection = pendingItems.some((item) => item.action === 'request_time_correction');

  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 text-foreground">
      <section className="mx-auto max-w-3xl">
        <header className="sticky top-0 z-30 -mx-4 border-b border-foreground/[0.08] bg-background/90 px-4 pb-4 pt-2 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Link to="/provider/shifts" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/15" aria-label="Back to work queue"><ArrowLeft className="h-4 w-4" /></Link>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">Guided shift</p>
              <h1 className="truncate text-sm font-semibold">{state.offline ? 'Assigned clinical shift' : shift.title || 'Clinical work item'}</h1>
            </div>
            {clockedIn ? (
              <button type="button" disabled={busy === 'clock_out'} onClick={() => perform('clock_out')} className="min-h-11 shrink-0 rounded-full bg-red-700 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50">
                {busy === 'clock_out' ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <TimerReset className="mr-1 inline h-3.5 w-3.5" />}Clock out
              </button>
            ) : <button type="button" onClick={load} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/15" aria-label="Refresh shift"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button>}
          </div>
        </header>

        <div className="mt-5 rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">Workflow</p><h2 className="mt-1 font-heading text-4xl uppercase">{labelCase(runState, hasRun ? 'Active' : 'Preflight')}</h2></div>
            <StatusPill value={readiness?.status || 'unavailable'} />
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground/60"><Clock3 className="h-4 w-4" />{clockedIn || clockedOut ? elapsedLabel(payload, now) : `${formatDateTime(shift.starts_at, 'Start time unavailable')} – ${shift.ends_at ? SHORT_TIME_FORMATTER.format(new Date(shift.ends_at)) : 'end pending'}`}</p>
          {shift.location_name || shift.service_area ? <p className="mt-2 flex items-center gap-2 text-sm text-foreground/60"><MapPin className="h-4 w-4" />{shift.location_name || shift.service_area}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {!hasRun ? <button type="button" disabled={!startAllowed || Boolean(busy)} onClick={() => perform('start')} className="min-h-12 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:cursor-not-allowed disabled:opacity-40"><Play className="mr-1 inline h-3.5 w-3.5" />Start preflight</button> : null}
            {clockInAllowed ? <button type="button" disabled={Boolean(busy)} onClick={() => perform('clock_in')} className="min-h-12 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Clock in</button> : null}
            {clockedIn && !onBreak ? <><label className="flex min-h-11 items-center gap-2 rounded-xl border border-foreground/15 px-3 text-xs font-semibold"><input type="checkbox" checked={breakHandoffConfirmed} onChange={(event) => setBreakHandoffConfirmed(event.target.checked)} className="h-4 w-4" />No patient or time-critical therapy is unattended</label><button type="button" disabled={Boolean(busy) || !breakHandoffConfirmed} onClick={async () => { const saved = await perform('break_start', { handoffConfirmed: true }); if (saved) setBreakHandoffConfirmed(false); }} className="min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-40"><Coffee className="mr-1 inline h-3.5 w-3.5" />Start break</button></> : null}
            {clockedIn && onBreak ? <button type="button" disabled={Boolean(busy)} onClick={() => perform('break_end')} className="min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-40"><Play className="mr-1 inline h-3.5 w-3.5" />End break</button> : null}
            {closeoutSuggested && !terminal ? <button type="button" disabled={Boolean(busy)} onClick={() => perform('closeout')} className="min-h-11 rounded-full border border-emerald-500/30 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800 disabled:opacity-40"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Complete closeout</button> : null}
          </div>
          {(!ready || readiness?.start_allowed !== true || state.offline) && !hasRun ? <p className="mt-3 text-xs text-amber-800">Starting stays disabled until the device is online and every readiness check is current, clear, and explicitly authorized by the server.</p> : null}
          {hasRun && !clockedIn && !clockedOut && !readinessAllowsOfflineClockIn(payload, now) ? <p className="mt-3 text-xs text-amber-800">Clock-in is disabled because the last server readiness is unavailable, not explicitly allowed, or expired. Reconnect and refresh.</p> : null}
          {clockedIn ? <p className="mt-3 text-xs font-medium text-red-700">Clock out remains available even when closeout or exception review is unresolved. Recorded time is never hidden by those issues.</p> : null}
        </div>

        <OfflineSyncPanel
          offline={state.offline}
          cachedAt={state.cachedAt}
          items={outbox.items}
          syncing={outbox.syncing}
          online={online}
          error={outbox.error}
          onSync={() => syncNow({ includeConflicts: true })}
        />

        {actionError ? <p role="alert" className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-700">{actionError} Retry uses the same request identifier so the server can prevent a duplicate.</p> : null}
        {actionNotice ? <p role="status" className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-sm text-emerald-800">{actionNotice}</p> : null}
        {state.error && payload && !state.offline ? <p role="alert" className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-800">The shift could not fully refresh. Existing server-confirmed state remains visible.</p> : null}

        <div className="mt-4 grid gap-4">
          <ReadinessCard readiness={readiness} />
          <RouteCard route={payload?.route} />
          <NextActionCard nextAction={nextAction} clockedIn={clockedIn && !onBreak} busy={busy === 'resolve_step'} onResolve={(values) => perform('resolve_step', values)} />
          <ExceptionPanel exceptions={exceptions} busy={busy === 'open_exception'} onOpen={(values) => perform('open_exception', values)} />

          <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4" /><h2 className="text-sm font-semibold">Recorded time</h2></div><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/40">{pendingItems.length ? 'Server + device pending' : state.offline ? 'Sanitized cache' : 'Server history'}</span></div>
            <div className="mt-3 grid gap-2">
              {timeEvents.slice(-8).reverse().map((event) => <div key={event.id || `${eventType(event)}-${eventTime(event)}`} className="flex items-center justify-between gap-3 rounded-xl bg-background/65 px-3 py-2"><span className="text-xs font-semibold">{labelCase(eventType(event))}{event.pending_sync ? <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-800">Pending sync</span> : null}</span><span className="text-xs text-foreground/50">{formatDateTime(eventTime(event))}</span></div>)}
              {!timeEvents.length ? <p className="text-xs leading-relaxed text-foreground/50">No time event has been recorded yet.</p> : null}
            </div>
          </section>

          {hasRun ? <TimeCorrectionPanel onSubmit={(values) => perform('request_time_correction', values)} busy={busy === 'request_time_correction'} pending={pendingTimeCorrection} /> : null}

          {clockedOut ? (
            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-700" /><h2 className="mt-2 text-lg font-semibold">{pendingClockOut ? 'Clock-out pending sync' : 'Time recorded'}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-foreground/55">{pendingClockOut ? 'Clock-out is preserved on this device with its device time. It is not server-confirmed until sync completes.' : unresolvedExceptions.length ? 'Your time is saved. Unresolved work is in exception review and does not erase recorded time.' : 'Your recorded time is ready for review. Payment status appears only after the stored Finance state changes.'}</p>
              <Link to="/provider/invoices" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]">Review Time & Pay</Link>
            </section>
          ) : null}
        </div>
      </section>
      <MobileNavBar items={nursePortalNav(shiftId)} columns={nursePortalNav(shiftId).length} maxWidth="shift" mobileOnly={false} ariaLabel="Guided nurse shift" />
    </main>
  );
}
