import { bodyContainsPhi } from './phi-guard.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OCCURRENCES = 180;
const MAX_HORIZON_DAYS = 366;
const RECURRENCE_MODES = new Set(['none', 'weekly', 'weekdays', 'biweekly', 'custom']);
const CLINICAL_ROLES = new Set(['RN', 'NP']);
const IDENTIFIER_PATTERN = /\b(?:patient|client|member|mrn|medical\s+record|chart|treatment|protocol|infusion|injection)\b/i;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/;

function codedError(message, code, status = 400) {
  return Object.assign(new Error(message), { code, status, expose: true });
}

function dateParts(value) {
  if (!DATE_RE.test(String(value || ''))) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function addDays(value, days) {
  const parts = dateParts(value);
  if (!parts) return '';
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return next.toISOString().slice(0, 10);
}

function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function validTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localPartsAt(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function normalizeUuid(value, fieldName) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  if (!UUID_RE.test(normalized)) throw codedError(`${fieldName} is invalid.`, 'invalid_shift_reference');
  return normalized;
}

function assertPhiFreeOperationalText(body) {
  const values = [
    body.title, body.locationName, body.locationAddress, body.serviceArea, body.instructions,
  ].filter((value) => value != null && value !== '');
  if (values.some((value) => bodyContainsPhi(value) || IDENTIFIER_PATTERN.test(String(value))
    || EMAIL_PATTERN.test(String(value)) || PHONE_PATTERN.test(String(value)))) {
    throw codedError('Remove client names, contact details, and clinical information from scheduling fields.', 'phi_in_scheduling_text', 422);
  }
}

/** Convert a local wall-clock value to an ISO instant without a timezone package. */
export function zonedLocalToIso(date, time, timezone = 'America/Los_Angeles') {
  const d = dateParts(date);
  const t = TIME_RE.exec(String(time || ''));
  if (!d || !t || !validTimezone(timezone)) return '';
  const wanted = Date.UTC(d.year, d.month - 1, d.day, Number(t[1]), Number(t[2]), 0);
  let guess = wanted;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localPartsAt(new Date(guess), timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
    guess += wanted - represented;
  }
  const represented = localPartsAt(new Date(guess), timezone);
  if (represented.year !== d.year || represented.month !== d.month || represented.day !== d.day
    || represented.hour !== Number(t[1]) || represented.minute !== Number(t[2])) return '';
  return new Date(guess).toISOString();
}

/**
 * Expand a bounded recurrence into independent shift occurrences. Weekdays use
 * JS numbering (0 Sunday ... 6 Saturday). Local wall-clock time is retained
 * across DST changes and nonexistent local times fail closed.
 */
export function expandShiftOccurrences(input = {}) {
  const startDate = String(input.startDate || '');
  const startTime = String(input.startTime || '');
  const endTime = String(input.endTime || '');
  const timezone = String(input.timezone || 'America/Los_Angeles');
  if (!dateParts(startDate) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || !validTimezone(timezone)) {
    throw codedError('A valid date, start/end time, and timezone are required.', 'invalid_shift_time');
  }

  const recurrence = input.recurrence && typeof input.recurrence === 'object' ? input.recurrence : {};
  const mode = String(recurrence.mode || 'none').toLowerCase();
  if (!RECURRENCE_MODES.has(mode)) throw codedError('The repeat pattern is not supported.', 'invalid_recurrence');
  const startWeekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();
  let weekdays = mode === 'weekdays' ? [1, 2, 3, 4, 5]
    : Array.isArray(recurrence.weekdays) ? recurrence.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [startWeekday];
  weekdays = [...new Set(weekdays)];
  if (!weekdays.length && mode !== 'none') weekdays = [startWeekday];
  const intervalWeeks = mode === 'biweekly' ? 2 : Math.min(12, Math.max(1, Number(recurrence.intervalWeeks) || 1));
  const countLimit = mode === 'none' ? 1 : Math.min(MAX_OCCURRENCES, Math.max(1, Number(recurrence.count) || MAX_OCCURRENCES));
  const requestedUntil = String(recurrence.untilDate || '');
  if (requestedUntil && !dateParts(requestedUntil)) throw codedError('Repeat-until date is invalid.', 'invalid_recurrence_until');
  if (requestedUntil && requestedUntil < startDate) throw codedError('Repeat-until date cannot be before the first shift.', 'invalid_recurrence_until');
  const horizonDate = addDays(startDate, MAX_HORIZON_DAYS);
  const lastDate = requestedUntil && requestedUntil < horizonDate ? requestedUntil : horizonDate;

  const rows = [];
  for (let offset = 0; offset <= MAX_HORIZON_DAYS && rows.length < countLimit; offset += 1) {
    const occurrenceDate = addDays(startDate, offset);
    if (!occurrenceDate || occurrenceDate > lastDate) break;
    const weekday = new Date(`${occurrenceDate}T00:00:00Z`).getUTCDay();
    const weekIndex = Math.floor(dayDiff(startDate, occurrenceDate) / 7);
    if (mode !== 'none' && (!weekdays.includes(weekday) || weekIndex % intervalWeeks !== 0)) continue;
    if (mode === 'none' && offset > 0) break;

    const startsAt = zonedLocalToIso(occurrenceDate, startTime, timezone);
    const endDate = endTime <= startTime ? addDays(occurrenceDate, 1) : occurrenceDate;
    const endsAt = zonedLocalToIso(endDate, endTime, timezone);
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
      throw codedError('Shift time is invalid for the selected timezone.', 'invalid_shift_range');
    }
    rows.push({ occurrenceDate, startsAt, endsAt });
  }
  if (!rows.length) throw codedError('The repeat pattern produced no shifts.', 'empty_recurrence');
  return rows;
}

export function cleanShiftInput(body = {}) {
  assertPhiFreeOperationalText(body);
  const title = String(body.title || '').trim().slice(0, 160);
  if (!title) throw codedError('Shift title is required.', 'shift_title_required');
  const timezone = String(body.timezone || 'America/Los_Angeles').trim().slice(0, 80);
  if (!validTimezone(timezone)) throw codedError('Shift timezone is invalid.', 'invalid_shift_timezone');
  const roleRequired = String(body.roleRequired || 'RN').trim().toUpperCase();
  if (!CLINICAL_ROLES.has(roleRequired)) throw codedError('Clinical shifts must require an RN or NP.', 'invalid_shift_role');
  const slots = Number(body.slotsRequired);
  if (!Number.isInteger(slots) || slots < 1 || slots > 100) {
    throw codedError('Nurse slots must be a whole number from 1 to 100.', 'invalid_shift_slots');
  }
  const status = body.status == null ? 'open' : String(body.status).toLowerCase();
  if (!['draft', 'open'].includes(status)) throw codedError('New shifts must be draft or open.', 'invalid_shift_status');
  return {
    title,
    timezone,
    location_name: String(body.locationName || '').trim().slice(0, 180) || null,
    location_address: String(body.locationAddress || '').trim().slice(0, 300) || null,
    service_area: String(body.serviceArea || '').trim().slice(0, 120) || null,
    role_required: roleRequired,
    slots_required: slots,
    status,
    instructions: String(body.instructions || '').trim().slice(0, 1000) || null,
    event_container_id: normalizeUuid(body.eventContainerId, 'Event'),
    appointment_id: normalizeUuid(body.appointmentId, 'Appointment'),
  };
}

export function cleanProviderProfileIds(values = []) {
  if (!Array.isArray(values)) throw codedError('Provider list is invalid.', 'invalid_provider_list');
  if (values.length > 100) throw codedError('Provider list is too large.', 'invalid_provider_list');
  return [...new Set(values.map((value) => normalizeUuid(value, 'Provider')).filter(Boolean))];
}

export function requireUuid(value, fieldName = 'Id') {
  const normalized = normalizeUuid(value, fieldName);
  if (!normalized) throw codedError(`${fieldName} is required.`, 'id_required');
  return normalized;
}

export function requireVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw codedError('Refresh this shift before changing it.', 'shift_version_required', 409);
  return version;
}

export function isSchedulingMigrationError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return ['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST203', 'PGRST204'].includes(code)
    || /operational_(?:shifts|shift_assignments)|could not find the function|schema cache/i.test(message);
}

export function schedulingRpcError(error) {
  if (isSchedulingMigrationError(error)) {
    return codedError('Scheduling is not available until the operational migration is applied.', 'scheduling_migration_required', 503);
  }
  const message = String(error?.message || 'Scheduling request failed.');
  const code = String(error?.code || 'scheduling_failed');
  if (code === '42501') return codedError('You do not have permission to change this schedule.', 'scheduling_forbidden', 403);
  if (/version|changed while|stale/i.test(message)) return codedError('This shift changed. Refresh and try again.', 'shift_version_conflict', 409);
  if (/not found/i.test(message)) return codedError('Shift not found.', 'shift_not_found', 404);
  if (/full|not open|closed|transition|assigned|claim/i.test(message)) return codedError(message, code, 409);
  if (/provider|credential|role|tenant|permission|authorized/i.test(message)) return codedError(message, code, 403);
  return Object.assign(new Error(message), { code, status: 400, expose: true });
}
