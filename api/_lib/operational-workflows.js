import crypto from 'crypto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_OCCURRENCES = 180;
const MAX_HORIZON_DAYS = 366;

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

/** Convert a local wall-clock value to an ISO instant without a runtime timezone dependency. */
export function zonedLocalToIso(date, time, timezone = 'America/Los_Angeles') {
  const d = dateParts(date);
  const t = TIME_RE.exec(String(time || ''));
  if (!d || !t || !validTimezone(timezone)) return '';
  const wanted = Date.UTC(d.year, d.month - 1, d.day, Number(t[1]), Number(t[2]), 0);
  let guess = wanted;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = localPartsAt(new Date(guess), timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
    guess += wanted - represented;
  }
  return new Date(guess).toISOString();
}

/**
 * Expand a weekly recurrence into independent shift instances. Weekdays use
 * JS numbering (0 Sunday ... 6 Saturday). The first occurrence is never
 * back-filled before startDate and the series is capped at one year/180 rows.
 */
export function expandShiftOccurrences(input = {}) {
  const startDate = String(input.startDate || '');
  const startTime = String(input.startTime || '');
  const endTime = String(input.endTime || '');
  const timezone = String(input.timezone || 'America/Los_Angeles');
  if (!dateParts(startDate) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || !validTimezone(timezone)) {
    throw Object.assign(new Error('A valid date, start/end time, and timezone are required.'), { code: 'invalid_shift_time' });
  }

  const recurrence = input.recurrence && typeof input.recurrence === 'object' ? input.recurrence : {};
  const mode = String(recurrence.mode || 'none');
  const startWeekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();
  let weekdays = mode === 'weekdays' ? [1, 2, 3, 4, 5]
    : Array.isArray(recurrence.weekdays) ? recurrence.weekdays.map(Number).filter((day) => day >= 0 && day <= 6)
      : [startWeekday];
  weekdays = [...new Set(weekdays)];
  const intervalWeeks = mode === 'biweekly' ? 2 : Math.min(12, Math.max(1, Number(recurrence.intervalWeeks) || 1));
  const countLimit = mode === 'none' ? 1 : Math.min(MAX_OCCURRENCES, Math.max(1, Number(recurrence.count) || MAX_OCCURRENCES));
  const untilDate = DATE_RE.test(String(recurrence.untilDate || ''))
    ? String(recurrence.untilDate)
    : addDays(startDate, MAX_HORIZON_DAYS);
  const horizonDate = addDays(startDate, MAX_HORIZON_DAYS);
  const lastDate = untilDate < horizonDate ? untilDate : horizonDate;

  const rows = [];
  for (let offset = 0; offset <= MAX_HORIZON_DAYS && rows.length < countLimit; offset += 1) {
    const occurrenceDate = addDays(startDate, offset);
    if (!occurrenceDate || occurrenceDate > lastDate) break;
    const weekday = new Date(`${occurrenceDate}T00:00:00Z`).getUTCDay();
    const weekIndex = Math.floor(dayDiff(startDate, occurrenceDate) / 7);
    if (mode !== 'none' && (!weekdays.includes(weekday) || weekIndex % intervalWeeks !== 0)) continue;
    if (mode === 'none' && offset > 0) break;

    const startsAt = zonedLocalToIso(occurrenceDate, startTime, timezone);
    let endDate = occurrenceDate;
    if (endTime <= startTime) endDate = addDays(occurrenceDate, 1);
    const endsAt = zonedLocalToIso(endDate, endTime, timezone);
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
      throw Object.assign(new Error('Shift end time must be after its start time.'), { code: 'invalid_shift_range' });
    }
    rows.push({ occurrenceDate, startsAt, endsAt });
  }
  if (!rows.length) throw Object.assign(new Error('The recurrence produced no shifts.'), { code: 'empty_recurrence' });
  return rows;
}

export function cleanShiftInput(body = {}) {
  const title = String(body.title || '').trim().slice(0, 160);
  if (!title) throw Object.assign(new Error('Shift title is required.'), { code: 'shift_title_required' });
  const slotsRequired = Math.min(100, Math.max(1, Number(body.slotsRequired) || 1));
  const status = ['draft', 'open'].includes(body.status) ? body.status : 'open';
  return {
    title,
    timezone: String(body.timezone || 'America/Los_Angeles').slice(0, 80),
    location_name: String(body.locationName || '').trim().slice(0, 180) || null,
    location_address: String(body.locationAddress || '').trim().slice(0, 300) || null,
    service_area: String(body.serviceArea || '').trim().slice(0, 120) || null,
    role_required: String(body.roleRequired || 'RN').trim().slice(0, 80),
    slots_required: slotsRequired,
    status,
    instructions: String(body.instructions || '').trim().slice(0, 1000) || null,
    event_container_id: body.eventContainerId || null,
    appointment_id: body.appointmentId || null,
  };
}

export function workflowId() {
  return crypto.randomUUID();
}

export function money(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

export function safeStatus(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

export async function postBalancedLedger(db, {
  tenantId, sourceType, sourceId, occurredAt, amountCents, currency = 'USD',
  debit, credit, memo = '', dimensions = {}, actorProfileId = null,
}) {
  const amount = money(amountCents);
  if (!db || !tenantId || !sourceType || !sourceId || amount <= 0) return { posted: false };
  const groupId = workflowId();
  const base = {
    tenant_id: tenantId,
    entry_group_id: groupId,
    amount_cents: amount,
    currency: String(currency || 'USD').toUpperCase().slice(0, 3),
    occurred_at: occurredAt || new Date().toISOString(),
    source_type: sourceType,
    source_id: String(sourceId),
    memo: String(memo || '').slice(0, 240) || null,
    dimensions,
    created_by: actorProfileId,
  };
  const rows = [
    { ...base, ...debit, direction: 'debit', idempotency_key: `${sourceType}:${sourceId}:debit` },
    { ...base, ...credit, direction: 'credit', idempotency_key: `${sourceType}:${sourceId}:credit` },
  ];
  const { error } = await db.from('os_finance_ledger').upsert(rows, {
    onConflict: 'tenant_id,idempotency_key,account_code,direction', ignoreDuplicates: true,
  });
  if (error) throw error;
  return { posted: true, entryGroupId: groupId };
}

