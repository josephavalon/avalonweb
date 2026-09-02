import crypto from 'crypto';
import { safeErrorCode } from './safe-error.js';
import { connectedInventoryFlags, inventoryCanaryProfileAllowed } from './connected-inventory.js';

export const NURSE_ROLES = Object.freeze(['nurse', 'rn', 'np', 'admin']);
export const READINESS_DOMAINS = Object.freeze([
  'identity',
  'license',
  'schedule',
  'kit',
  'client',
  'gfe',
  'patient_payment',
  'route',
  'safety',
]);
export const READINESS_STAGES = Object.freeze(['offer', 'claim', 'route_release', 'run_start']);

export const READINESS_DOMAINS_BY_STAGE = Object.freeze({
  offer: Object.freeze(['identity', 'license', 'schedule', 'client', 'gfe', 'patient_payment', 'safety']),
  claim: Object.freeze(['identity', 'license', 'schedule', 'client', 'gfe', 'patient_payment', 'safety']),
  route_release: READINESS_DOMAINS,
  run_start: READINESS_DOMAINS,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const READY_STATES = new Set(['ready', 'not_required', 'handoff']);
const RESOLVED_STEP_STATES = new Set([
  'completed', 'not_applicable', 'patient_declined',
  'clinically_contraindicated', 'handed_off', 'supervisor_override',
]);
const ACTIVE_ASSIGNMENTS = new Set(['claimed', 'assigned']);
const ACTIVE_LICENSE_STATES = new Set(['active', 'clear', 'current', 'valid']);
const NURSYS_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const READY_GFE_STATES = new Set(['approved', 'clear', 'cleared', 'complete', 'completed', 'not_required']);
const READY_PAYMENT_STATES = new Set(['authorized', 'captured', 'complete', 'completed', 'paid', 'not_required', 'waived']);
const RUN_SELECT = 'id,shift_id,assignment_id,provider_profile_id,route_day_id,readiness_snapshot_id,offer_terms_id,guide_version_id,guide_version,status,current_step_key,started_at,clocked_in_at,clocked_out_at,closed_at,version,created_at,updated_at';
const SNAPSHOT_SELECT = 'id,evaluation_key,shift_id,provider_profile_id,evaluation_stage,evaluator_version,source_shift_version,overall_status,claim_allowed,evidence,checked_at,expires_at,invalidated_at,invalidation_reason,created_at';
const OFFER_TERMS_SELECT = 'id,shift_id,provider_profile_id,terms_version,status,engagement_model,gross_pay_cents,hourly_rate_cents,currency,estimated_work_minutes,estimated_travel_minutes,mileage_rate_cents,guaranteed_minimum_cents,cancellation_terms_code,expense_policy_code,expires_at,accepted_at,created_at,updated_at';

export function requestError(message, code, status = 400) {
  return Object.assign(new Error(message), { code, status, expose: true });
}

export function parseJsonBody(req) {
  if (typeof req.body !== 'string') return req.body && typeof req.body === 'object' ? req.body : {};
  try { return JSON.parse(req.body); }
  catch { throw requestError('Request body must be valid JSON.', 'invalid_json'); }
}

export function requireUuid(value, field = 'Id') {
  const normalized = String(value || '').trim();
  if (!UUID_RE.test(normalized)) throw requestError(`${field} is invalid.`, 'invalid_id');
  return normalized;
}

export function requirePositiveVersion(value, field = 'Version') {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw requestError(`${field} is required. Refresh and try again.`, 'version_required', 409);
  }
  return version;
}

export function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function clientIdempotencyKey(value, fallbackPrefix = 'nurse') {
  const supplied = cleanText(value, 160);
  if (!supplied) return crypto.randomUUID();
  if (!UUID_RE.test(supplied)) {
    throw requestError(`${fallbackPrefix} idempotency key must be a UUID.`, 'invalid_idempotency_key');
  }
  return supplied;
}

export function isNurseWorkflowMigrationError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return ['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST203', 'PGRST204'].includes(code)
    || /provider_work_preferences|nurse_(?:appointment_source_events|marketplace|shift_offers|offer_deliveries|inventory_reservations|pickup_tasks|route_)|nurse_shift_(?:domain_evidence|readiness_snapshots)|nurse_offer_(?:counters|terms)|shift_guide_(?:templates|versions)|mobile_shift_(?:runs|time_events|step_events)|shift_exceptions|record_nurse_|start_nurse_shift_run|close_nurse_shift_run|decline_operational_shift|counter_operational_shift_offer|schema cache/i.test(message);
}

export function nurseWorkflowError(error, fallbackMessage = 'Nurse workflow is unavailable.') {
  if (isNurseWorkflowMigrationError(error)) {
    return requestError(
      'Nurse workflow is unavailable until the guided-shift migration is applied.',
      'nurse_workflow_migration_required',
      503,
    );
  }
  const message = String(error?.message || '');
  if (/approved_guide_required|appointment_protocol_guide_required/i.test(message)) {
    return requestError(
      'An approved guided-shift workflow is required. Contact Clinical Operations.',
      'approved_shift_guide_required',
      409,
    );
  }
  if (/current_offer_terms_required/i.test(message)) {
    return requestError('Current approved offer terms are required before accepting this shift.', 'offer_terms_required', 409);
  }
  if (/offer_unavailable|offer_terms_changed|accepted_terms_hash_mismatch|fresh_claim_readiness_required|inventory_reservation_(?:incomplete|unavailable)/i.test(message)) {
    return requestError('This offer is unavailable. Refresh the Work Queue.', 'offer_unavailable', 409);
  }
  if (/engagement_model_not_approved/i.test(message)) {
    return requestError(
      'These offer terms do not match a current human-approved engagement classification.',
      'engagement_model_not_approved',
      409,
    );
  }
  if (/current_readiness_blocks_care_step/i.test(message)) {
    return requestError(
      'Current readiness blocks ordinary care steps. Pause care, open an exception, or complete an allowed handoff.',
      'current_readiness_blocks_care_step',
      409,
    );
  }
  if (/provider_work_preferences_required|provider_schedule_conflict|minimum_turnaround_not_met|maximum_daily_stops_reached|maximum_daily_hours_exceeded/i.test(message)) {
    return requestError(
      'This shift no longer fits your current availability or capacity. Refresh before continuing.',
      'nurse_capacity_changed',
      409,
    );
  }
  if (/break_handoff_confirmation_required/i.test(message)) {
    return requestError(
      'Confirm that no patient or time-critical therapy is left unattended before starting a break.',
      'break_handoff_confirmation_required',
      409,
    );
  }
  if (/fresh_readiness_required/i.test(message)) {
    return requestError('Shift readiness must be refreshed before continuing.', 'fresh_readiness_required', 409);
  }
  if (/active_license_evidence_missing|fresh_nursys_license_evidence_missing|shift_license_scope_evidence_missing|kit_readiness_evidence_missing|route_readiness_evidence_missing|appointment_readiness_unavailable|gfe_not_ready|patient_payment_not_ready|active_safety_hold|open_shift_exception|guide_step_not_allowed/i.test(message)) {
    return requestError('Shift readiness changed. Refresh and follow the listed remediation before continuing.', 'shift_readiness_changed', 409);
  }
  if (/shift_already_clocked_(?:in|out)|break_already_open|open_break_required|clock_in_required|closeout_steps_incomplete|shift_clock_out_required|shift_run_already_closed/i.test(message)) {
    return requestError('The shift state changed. Refresh before continuing.', 'shift_run_state_conflict', 409);
  }
  if (/version|stale|changed while/i.test(message)) {
    return requestError('This record changed. Refresh and try again.', 'nurse_workflow_version_conflict', 409);
  }
  if (/not found/i.test(message) || String(error?.code || '') === 'P0002') {
    return requestError('The requested nurse workflow record was not found.', 'nurse_workflow_not_found', 404);
  }
  if (/not authorized|permission|required|forbidden/i.test(message) || String(error?.code || '') === '42501') {
    return requestError('You do not have permission to change this nurse workflow.', 'nurse_workflow_forbidden', 403);
  }
  if (error?.expose) return error;
  return Object.assign(new Error(fallbackMessage), {
    code: safeErrorCode(error, 'nurse_workflow_failed'),
    status: Number(error?.status || error?.statusCode) || 500,
  });
}

export function sendNurseWorkflowError(res, caught, fallbackMessage = 'Nurse workflow is unavailable.') {
  const error = nurseWorkflowError(caught, fallbackMessage);
  return res.status(error.status || 500).json({
    error: error.expose || error.code === 'nurse_workflow_migration_required' ? error.message : fallbackMessage,
    code: safeErrorCode(error, 'nurse_workflow_failed'),
  });
}

export async function resolveNurseProvider(authed) {
  const result = await authed.db.from('provider_profiles')
    .select('id,profile_id,person_id,provider_role,credential_status,nursys_status,scope_tags,active,created_at,updated_at')
    .eq('tenant_id', authed.tenantId)
    .eq('profile_id', authed.user.id)
    .in('provider_role', ['rn', 'np'])
    .limit(2);
  if (result.error) throw result.error;
  if (!(result.data || []).length) {
    throw requestError('A nurse provider profile is required.', 'provider_profile_required', 403);
  }
  if (result.data.length > 1) {
    throw requestError('Multiple nurse profiles need administrator review.', 'provider_profile_ambiguous', 409);
  }
  return result.data[0];
}

export function publicProvider(provider, engagement = null) {
  return {
    id: provider.id,
    provider_role: provider.provider_role,
    credential_status: provider.credential_status,
    nursys_status: provider.nursys_status,
    active: Boolean(provider.active),
    engagement_status: engagement || undefined,
  };
}

export async function loadWorkPreferences(db, tenantId, providerProfileId) {
  const result = await db.from('provider_work_preferences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

export function engagementFromPreferences(preferences, now = new Date()) {
  const requested = String(preferences?.engagement_status || '').trim().toLowerCase();
  const contractorApproved = Boolean(
    requested === 'contractor_approved'
    && preferences?.engagement_approved_by
    && preferences?.engagement_approved_at
    && preferences?.engagement_effective_at
    && Date.parse(preferences.engagement_effective_at) <= now.getTime(),
  );
  if (!contractorApproved) {
    const w2Approved = requested === 'w2_approved'
      && preferences?.engagement_approved_by
      && preferences?.engagement_approved_at
      && preferences?.engagement_effective_at
      && Date.parse(preferences.engagement_effective_at) <= now.getTime();
    return {
      classification: 'w2',
      approved: Boolean(w2Approved),
      effective_at: w2Approved ? preferences.engagement_effective_at : null,
      source: w2Approved ? 'human_approved' : 'safe_default',
    };
  }
  return {
    classification: 'contractor',
    approved: true,
    effective_at: preferences.engagement_effective_at,
    source: 'human_approved',
  };
}

function validTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function stringArray(value, { maxItems = 50, maxLength = 100, upper = false } = {}) {
  if (!Array.isArray(value)) return [];
  const rows = value
    .map((entry) => cleanText(entry, maxLength))
    .filter(Boolean)
    .map((entry) => upper ? entry.toUpperCase() : entry);
  return [...new Set(rows)].slice(0, maxItems);
}

function finiteNumber(value, min, max, fallback = null) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return fallback;
  return number;
}

export function sanitizePreferenceSection(section, raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (section === 'business_profile') {
    const preferredContact = String(input.preferred_contact || '').trim().toLowerCase();
    return {
      display_name: cleanText(input.display_name, 120) || null,
      business_name: cleanText(input.business_name, 160) || null,
      work_email: cleanText(input.work_email, 160).toLowerCase() || null,
      work_phone: cleanText(input.work_phone, 40) || null,
      preferred_contact: ['email', 'phone', 'sms'].includes(preferredContact) ? preferredContact : null,
    };
  }
  if (section === 'availability') {
    const timezone = cleanText(input.timezone, 80) || 'America/Los_Angeles';
    if (!validTimezone(timezone)) throw requestError('Availability timezone is invalid.', 'invalid_availability');
    const weekly = Array.isArray(input.weekly) ? input.weekly.slice(0, 28).map((window) => {
      const normalized = {
        day: Number(window?.day),
        start: String(window?.start || ''),
        end: String(window?.end || ''),
      };
      const breakStart = String(window?.break_start || '');
      const breakEnd = String(window?.break_end || '');
      if (breakStart || breakEnd) {
        if (!TIME_RE.test(breakStart) || !TIME_RE.test(breakEnd)
          || breakEnd <= breakStart
          || breakStart < normalized.start
          || breakEnd > normalized.end) {
          throw requestError('Protected break times must be inside the availability window.', 'invalid_availability_break');
        }
        normalized.break_start = breakStart;
        normalized.break_end = breakEnd;
      }
      return normalized;
    }).filter((window) => Number.isInteger(window.day) && window.day >= 0 && window.day <= 6
      && TIME_RE.test(window.start) && TIME_RE.test(window.end) && window.end > window.start) : [];
    return {
      timezone,
      weekly,
      blackout_dates: stringArray(input.blackout_dates, { maxItems: 366, maxLength: 10 }).filter((date) => DATE_RE.test(date)),
      max_daily_hours: finiteNumber(input.max_daily_hours, 0.25, 24, 8),
    };
  }
  if (section === 'service_preferences') {
    return {
      service_codes: stringArray(input.service_codes, { maxItems: 100, maxLength: 100 }),
      modalities: stringArray(input.modalities, { maxItems: 20, maxLength: 40 }),
      max_travel_minutes: finiteNumber(input.max_travel_minutes, 0, 480, 60),
      max_daily_stops: Math.round(finiteNumber(input.max_daily_stops, 1, 50, 8)),
      preferred_visit_minutes: Math.round(finiteNumber(input.preferred_visit_minutes, 5, 480, 45)),
      minimum_turnaround_minutes: Math.round(finiteNumber(input.minimum_turnaround_minutes, 0, 240, 15)),
    };
  }
  if (section === 'service_area') {
    return {
      home_market: cleanText(input.home_market, 120) || null,
      cities: stringArray(input.cities, { maxItems: 100, maxLength: 120 }),
      postal_codes: stringArray(input.postal_codes, { maxItems: 100, maxLength: 12, upper: true }),
      radius_miles: finiteNumber(input.radius_miles, 0, 500, 25),
    };
  }
  throw requestError('Unsupported nurse preference section.', 'invalid_preference_section');
}

export async function savePreferenceSection(db, {
  tenantId,
  providerProfileId,
  section,
  value,
  expectedVersion = null,
}) {
  const existing = await loadWorkPreferences(db, tenantId, providerProfileId);
  if (!existing) {
    const insert = await db.from('provider_work_preferences').insert({
      tenant_id: tenantId,
      provider_profile_id: providerProfileId,
      business_profile: section === 'business_profile' ? value : {},
      availability: section === 'availability' ? value : {},
      service_preferences: section === 'service_preferences' ? value : {},
      service_area: section === 'service_area' ? value : {},
      version: 1,
    }).select('*').single();
    if (insert.error) throw insert.error;
    return insert.data;
  }
  if (expectedVersion != null && Number(existing.version) !== Number(expectedVersion)) {
    throw requestError('These preferences changed. Refresh and try again.', 'preference_version_conflict', 409);
  }
  let query = db.from('provider_work_preferences')
    .update({ [section]: value, version: Number(existing.version || 1) + 1 })
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('version', Number(existing.version || 1))
    .select('*');
  const result = await query.limit(1);
  if (result.error) throw result.error;
  if (!(result.data || []).length) {
    throw requestError('These preferences changed. Refresh and try again.', 'preference_version_conflict', 409);
  }
  return result.data[0];
}

function readinessDomain(status, reasonCode, source, {
  checkedAt = null,
  expiresAt = null,
  ownerRole = 'operations',
  remediation = null,
} = {}) {
  return {
    status,
    reason_code: reasonCode,
    source,
    checked_at: checkedAt,
    expires_at: expiresAt,
    owner_role: ownerRole,
    remediation,
  };
}

function normalizeStoredDomain(value, nowIso) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const status = String(value.status || '').toLowerCase();
  if (!['ready', 'blocked', 'not_required', 'unavailable', 'expired'].includes(status)) return null;
  const expiry = value.expires_at || null;
  if (status === 'ready' && (!expiry || Date.parse(expiry) <= Date.parse(nowIso))) {
    return readinessDomain('unavailable', 'readiness_evidence_stale', value.source || 'readiness_snapshot', {
      checkedAt: value.checked_at || null,
      expiresAt: expiry,
      ownerRole: value.owner_role || 'operations',
      remediation: value.remediation_code || 'refresh_readiness_evidence',
    });
  }
  return readinessDomain(status, value.reason_code || `${status}_evidence`, value.source || 'readiness_snapshot', {
    checkedAt: value.checked_at || null,
    expiresAt: expiry,
    ownerRole: value.owner_role || 'operations',
    remediation: value.remediation_code || null,
  });
}

function canCover(providerRole, roleRequired) {
  const provider = String(providerRole || '').trim().toLowerCase();
  const required = String(roleRequired || 'rn').trim().toLowerCase();
  if (provider === 'np') return ['rn', 'np', 'nurse', 'registered nurse', 'nurse practitioner'].includes(required);
  return provider === 'rn' && ['rn', 'nurse', 'registered nurse'].includes(required);
}

function localScheduleParts(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[values.weekday],
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function scheduleAvailability(preferences, shift) {
  const availability = preferences?.availability;
  if (!availability || !Array.isArray(availability.weekly) || !availability.weekly.length) return false;
  const timezone = validTimezone(availability.timezone) ? availability.timezone : shift.timezone;
  const starts = localScheduleParts(new Date(shift.starts_at), timezone || 'America/Los_Angeles');
  const ends = localScheduleParts(new Date(shift.ends_at), timezone || 'America/Los_Angeles');
  if (starts.date !== ends.date || (availability.blackout_dates || []).includes(starts.date)) return false;
  return availability.weekly.some((window) => {
    const insideWindow = Number(window.day) === starts.day
      && String(window.start) <= starts.time && String(window.end) >= ends.time;
    if (!insideWindow) return false;
    const hasProtectedBreak = TIME_RE.test(String(window.break_start || ''))
      && TIME_RE.test(String(window.break_end || ''));
    return !hasProtectedBreak
      || ends.time <= String(window.break_start)
      || starts.time >= String(window.break_end);
  });
}

function servicePreferenceIssue(preferences, shift, appointment) {
  const configuredServices = Array.isArray(preferences?.service_preferences?.service_codes)
    ? preferences.service_preferences.service_codes.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : [];
  const protocolKey = String(appointment?.protocol_key || '').trim().toLowerCase();
  if (configuredServices.length && (!protocolKey || !configuredServices.includes(protocolKey))) {
    return { reason_code: 'service_preference_mismatch' };
  }

  const serviceArea = preferences?.service_area || {};
  const configuredAreas = [
    serviceArea.home_market,
    ...(Array.isArray(serviceArea.cities) ? serviceArea.cities : []),
    ...(Array.isArray(serviceArea.postal_codes) ? serviceArea.postal_codes : []),
  ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  if (!configuredAreas.length) return { reason_code: 'service_area_preference_missing' };
  const shiftArea = `${shift.service_area || ''} ${shift.location_address || ''}`.toLowerCase();
  if (!configuredAreas.some((area) => shiftArea.includes(area))) {
    return { reason_code: 'service_area_preference_mismatch' };
  }
  return null;
}

async function loadSchedulingCapacityIssue(db, tenantId, providerProfileId, shift, preferences) {
  const assignments = await db.from('operational_shift_assignments')
    .select('shift_id,status')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .in('status', ['claimed', 'assigned']);
  if (assignments.error) throw assignments.error;
  const ids = (assignments.data || []).map((row) => row.shift_id).filter((id) => id && id !== shift.id);
  let acceptedShifts = [];
  if (ids.length) {
    const shifts = await db.from('operational_shifts')
      .select('id,starts_at,ends_at,status')
      .eq('tenant_id', tenantId)
      .in('id', ids)
      .in('status', ['open', 'assigned', 'in_progress']);
    if (shifts.error) throw shifts.error;
    acceptedShifts = shifts.data || [];
  }
  const candidateStart = Date.parse(shift.starts_at);
  const candidateEnd = Date.parse(shift.ends_at);
  const overlap = acceptedShifts.find((row) => Date.parse(row.starts_at) < candidateEnd
    && Date.parse(row.ends_at) > candidateStart);
  if (overlap) return { reason_code: 'schedule_conflict', shift: overlap };

  const turnaroundMinutes = Number(preferences?.service_preferences?.minimum_turnaround_minutes || 0);
  if (turnaroundMinutes > 0) {
    const turnaroundMs = turnaroundMinutes * 60 * 1000;
    const tooClose = acceptedShifts.find((row) => {
      const startsAt = Date.parse(row.starts_at);
      const endsAt = Date.parse(row.ends_at);
      return (endsAt <= candidateStart && candidateStart - endsAt < turnaroundMs)
        || (startsAt >= candidateEnd && startsAt - candidateEnd < turnaroundMs);
    });
    if (tooClose) return { reason_code: 'minimum_turnaround_not_met', shift: tooClose };
  }

  const timezone = validTimezone(preferences?.availability?.timezone)
    ? preferences.availability.timezone
    : shift.timezone || 'America/Los_Angeles';
  const candidateDate = localScheduleParts(new Date(candidateStart), timezone).date;
  const sameDay = acceptedShifts.filter((row) => localScheduleParts(new Date(row.starts_at), timezone).date === candidateDate);
  const maxDailyStops = Number(preferences?.service_preferences?.max_daily_stops || 0);
  if (maxDailyStops > 0 && sameDay.length + 1 > maxDailyStops) {
    return { reason_code: 'maximum_daily_stops_reached' };
  }
  const maxDailyHours = Number(preferences?.availability?.max_daily_hours || 0);
  const candidateMinutes = Math.max(0, candidateEnd - candidateStart) / 60000;
  const acceptedMinutes = sameDay.reduce((total, row) => (
    total + Math.max(0, Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60000
  ), 0);
  if (maxDailyHours > 0 && acceptedMinutes + candidateMinutes > maxDailyHours * 60) {
    return { reason_code: 'maximum_daily_hours_exceeded' };
  }
  return null;
}

async function loadDomainEvidence(db, tenantId, providerProfileId, shiftId) {
  const result = await db.from('nurse_shift_domain_evidence')
    .select('domain,status,reason_code,source,owner_role,remediation_code,evidence_ref,checked_at,expires_at,version')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('shift_id', shiftId);
  if (result.error) throw result.error;
  return result.data || [];
}

function inventoryLineKey({ location_id: locationId, item_id: itemId, variant_id: variantId, lot_id: lotId }) {
  return [locationId, itemId, variantId || '-', lotId || '-'].join(':');
}

function inventoryItemKey({ item_id: itemId, variant_id: variantId, lot_id: lotId }) {
  return [itemId, variantId || '-', lotId || '-'].join(':');
}

function kitEvidence(status, reasonCode, nowIso, expiresAt, remediation = null) {
  return readinessDomain(status, reasonCode, 'nurse_inventory_reservations', {
    checkedAt: nowIso,
    expiresAt,
    ownerRole: 'operations',
    remediation,
  });
}

// Release/start inventory readiness is deliberately reconstructed from the
// pinned manifest, exact allocations, live stock ledger, lot controls, pickup
// evidence, and accepted nurse-kit custody. Generic domain evidence cannot
// satisfy these stages.
async function loadCanonicalKitEvidence(
  db,
  tenantId,
  providerProfileId,
  shiftId,
  stage,
  now,
  nowIso,
  expiresAt,
) {
  const pinnedResult = await db.from('nurse_shift_supply_requirements')
    .select('manifest_version_id,requirements_hash,pinned_at,invalidated_at')
    .eq('tenant_id', tenantId)
    .eq('shift_id', shiftId)
    .is('invalidated_at', null)
    .maybeSingle();
  if (pinnedResult.error) throw pinnedResult.error;
  if (!pinnedResult.data) {
    return kitEvidence('blocked', 'approved_supply_manifest_required', nowIso, expiresAt,
      'Operations must pin a clinically approved supply manifest to this shift.');
  }

  const [manifestResult, requirementsResult, reservationsResult, pickupsResult, custodyResult] = await Promise.all([
    db.from('nurse_supply_manifest_versions')
      .select('id,status,content_hash,requirements_hash,approved_at,retired_at')
      .eq('tenant_id', tenantId)
      .eq('id', pinnedResult.data.manifest_version_id)
      .maybeSingle(),
    db.from('nurse_supply_manifest_requirements')
      .select('id,item_id,variant_id,quantity,lot_required,temperature_evidence_required,calibration_evidence_required')
      .eq('tenant_id', tenantId)
      .eq('manifest_version_id', pinnedResult.data.manifest_version_id),
    db.from('nurse_inventory_reservations')
      .select('id,requirement_id,location_id,item_id,variant_id,lot_id,quantity,status,expires_at,reserved_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('shift_id', shiftId)
      .eq('provider_profile_id', providerProfileId)
      .in('status', ['reserved', 'consumed']),
    db.from('nurse_pickup_tasks')
      .select('id,location_id,route_day_id,status,evidence_hash,completed_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('shift_id', shiftId)
      .eq('provider_profile_id', providerProfileId)
      .neq('status', 'cancelled'),
    db.from('os_inventory_location_assignments')
      .select('location_id,assignment_status,is_primary,accepted_at')
      .eq('tenant_id', tenantId)
      .eq('provider_profile_id', providerProfileId)
      .eq('assignment_status', 'accepted')
      .eq('is_primary', true)
      .limit(1),
  ]);
  for (const result of [manifestResult, requirementsResult, reservationsResult, pickupsResult, custodyResult]) {
    if (result.error) throw result.error;
  }
  const manifest = manifestResult.data;
  const requirements = requirementsResult.data || [];
  const reservations = reservationsResult.data || [];
  const pickups = pickupsResult.data || [];
  const custodyLocationId = custodyResult.data?.[0]?.location_id || null;
  if (!manifest || manifest.status !== 'approved' || !manifest.approved_at || manifest.retired_at
      || (manifest.requirements_hash || manifest.content_hash) !== pinnedResult.data.requirements_hash) {
    return kitEvidence('blocked', 'approved_supply_manifest_required', nowIso, expiresAt,
      'Operations must repin the current approved supply manifest.');
  }
  if (!requirements.length) {
    return kitEvidence('blocked', 'supply_manifest_requirements_missing', nowIso, expiresAt,
      'Inventory Operations must add approved structured requirements to the manifest.');
  }
  if (!custodyLocationId) {
    return kitEvidence('blocked', 'active_nurse_kit_custody_required', nowIso, expiresAt,
      'Operations must establish and accept the nurse kit custody assignment.');
  }
  const custodyLocationResult = await db.from('os_inventory_locations')
    .select('id,location_type,status')
    .eq('tenant_id', tenantId)
    .eq('id', custodyLocationId)
    .maybeSingle();
  if (custodyLocationResult.error) throw custodyLocationResult.error;
  if (custodyLocationResult.data?.location_type !== 'nurse_kit'
      || custodyLocationResult.data?.status !== 'active') {
    return kitEvidence('blocked', 'active_nurse_kit_custody_required', nowIso, expiresAt,
      'Operations must restore an active nurse-kit custody location.');
  }
  let connectedCanary = false;
  if (connectedInventoryFlags().connected) {
    const canaryProfile = await db.from('provider_profiles').select('profile_id')
      .eq('tenant_id', tenantId).eq('id', providerProfileId).maybeSingle();
    if (canaryProfile.error) throw canaryProfile.error;
    connectedCanary = inventoryCanaryProfileAllowed(canaryProfile.data?.profile_id);
  }
  if (connectedCanary) {
    const itemIds = [...new Set(requirements.map((row) => row.item_id).filter(Boolean))];
    const [physicalKitResult, countResult, catalogResult] = await Promise.all([
      db.from('os_inventory_kits').select('id,status,version').eq('tenant_id', tenantId)
        .eq('location_id', custodyLocationId).maybeSingle(),
      db.from('os_inventory_count_sessions').select('id,status,snapshot_at,submitted_at,reviewed_at,version')
        .eq('tenant_id', tenantId).eq('location_id', custodyLocationId)
        .in('status', ['reconciled', 'approved_adjustment'])
        .order('reviewed_at', { ascending: false }).limit(1).maybeSingle(),
      itemIds.length ? db.from('os_inventory_items')
        .select('id,regulated_class,classification_reviewed_at,base_uom,storage_policy')
        .eq('tenant_id', tenantId).in('id', itemIds) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [physicalKitResult, countResult, catalogResult]) if (result.error) throw result.error;
    const allowedKitStates = stage === 'run_start' ? ['in_custody'] : ['in_custody', 'handoff_pending'];
    if (!physicalKitResult.data || !allowedKitStates.includes(physicalKitResult.data.status)) {
      return kitEvidence('blocked', 'physical_kit_custody_not_ready', nowIso, expiresAt,
        'Operations must resolve the physical kit custody or handoff state.');
    }
    if ((catalogResult.data || []).length !== itemIds.length || (catalogResult.data || []).some((item) => (
      item.regulated_class === 'unknown' || !item.classification_reviewed_at || !item.base_uom
        || !item.storage_policy || typeof item.storage_policy.storageClass !== 'string'
    ))) {
      return kitEvidence('blocked', 'inventory_classification_required', nowIso, expiresAt,
        'Clinical and Inventory Operations must review classification and units for every required item.');
    }
    const acceptedAt = custodyResult.data?.[0]?.accepted_at ? Date.parse(custodyResult.data[0].accepted_at) : 0;
    const reviewedAt = countResult.data?.reviewed_at ? Date.parse(countResult.data.reviewed_at) : 0;
    if (!reviewedAt || reviewedAt < now.getTime() - 24 * 60 * 60 * 1000 || reviewedAt < acceptedAt) {
      return kitEvidence('blocked', 'fresh_accepted_count_required', nowIso, expiresAt,
        'Complete a blind kit count after custody acceptance and within the last 24 hours.');
    }
  }

  const requirementById = new Map(requirements.map((row) => [row.id, row]));
  for (const requirement of requirements) {
    const allocated = reservations
      .filter((row) => row.requirement_id === requirement.id)
      .reduce((total, row) => total + Number(row.quantity || 0), 0);
    if (allocated < Number(requirement.quantity || 0)) {
      return kitEvidence('blocked', 'inventory_reservation_incomplete', nowIso, expiresAt,
        'Inventory Operations must restore exact stock reservations for every required line.');
    }
  }
  if (reservations.some((row) => row.status === 'reserved' && Date.parse(row.expires_at) <= now.getTime())) {
    return kitEvidence('blocked', 'inventory_reservation_evidence_stale', nowIso, expiresAt,
      'Inventory Operations must refresh expired reservations.');
  }
  if (reservations.some((row) => {
    const requirement = requirementById.get(row.requirement_id);
    return (requirement?.lot_required || requirement?.temperature_evidence_required
      || requirement?.calibration_evidence_required) && !row.lot_id;
  })) {
    return kitEvidence('blocked', 'inventory_lot_required', nowIso, expiresAt,
      'Inventory Operations must reserve an exact approved lot.');
  }

  const lotIds = [...new Set(reservations.map((row) => row.lot_id).filter(Boolean))];
  let lots = [];
  if (lotIds.length) {
    const lotResult = await db.from('os_inventory_lots')
      .select('id,item_id,variant_id,expires_on,disposition_status,temperature_controlled,temperature_evidence_expires_at,calibration_required,calibration_expires_at')
      .eq('tenant_id', tenantId)
      .in('id', lotIds);
    if (lotResult.error) throw lotResult.error;
    lots = lotResult.data || [];
  }
  const lotById = new Map(lots.map((row) => [row.id, row]));
  const today = nowIso.slice(0, 10);
  const invalidLot = reservations.find((reservation) => {
    if (!reservation.lot_id) return false;
    const lot = lotById.get(reservation.lot_id);
    const requirement = requirementById.get(reservation.requirement_id);
    return !lot
      || lot.disposition_status !== 'available'
      || (lot.expires_on && lot.expires_on < today)
      || ((lot.temperature_controlled || requirement?.temperature_evidence_required)
        && (!lot.temperature_evidence_expires_at || Date.parse(lot.temperature_evidence_expires_at) <= now.getTime()))
      || ((lot.calibration_required || requirement?.calibration_evidence_required)
        && (!lot.calibration_expires_at || Date.parse(lot.calibration_expires_at) <= now.getTime()));
  });
  if (invalidLot) {
    return kitEvidence('blocked', 'inventory_lot_evidence_stale', nowIso, expiresAt,
      'Inventory Operations must replace quarantined, expired, or unverified stock.');
  }

  const sourceLocationIds = [...new Set(reservations.map((row) => row.location_id).filter(Boolean))];
  const balanceLocationIds = [...new Set([...sourceLocationIds, custodyLocationId])];
  const balancesResult = await db.from('os_inventory_location_balances')
    .select('location_id,item_id,variant_id,lot_id,quantity_on_hand,last_movement_at')
    .eq('tenant_id', tenantId)
    .in('location_id', balanceLocationIds);
  if (balancesResult.error) throw balancesResult.error;
  const balances = new Map((balancesResult.data || []).map((row) => [inventoryLineKey(row), Number(row.quantity_on_hand || 0)]));
  if (sourceLocationIds.length) {
    const commitmentsResult = await db.from('nurse_inventory_reservations')
      .select('location_id,item_id,variant_id,lot_id,quantity')
      .eq('tenant_id', tenantId)
      .in('location_id', sourceLocationIds)
      .in('status', ['prepared', 'reserved'])
      .gt('expires_at', nowIso)
      .limit(5000);
    if (commitmentsResult.error) throw commitmentsResult.error;
    const commitments = new Map();
    for (const row of commitmentsResult.data || []) {
      const key = inventoryLineKey(row);
      commitments.set(key, (commitments.get(key) || 0) + Number(row.quantity || 0));
    }
    for (const [key, quantity] of commitments) {
      if (quantity > (balances.get(key) || 0)) {
        return kitEvidence('blocked', 'inventory_reservation_overcommitted', nowIso, expiresAt,
          'Inventory Operations must reconcile competing reservations against the live stock ledger.');
      }
    }
  }

  const requiredAtSource = new Map();
  const requiredInCustody = new Map();
  const transferredToCustody = new Map();
  for (const reservation of reservations) {
    const sourceKey = inventoryLineKey(reservation);
    if (reservation.status === 'reserved') {
      requiredAtSource.set(sourceKey, (requiredAtSource.get(sourceKey) || 0) + Number(reservation.quantity || 0));
    }
    const custodyKey = inventoryItemKey(reservation);
    requiredInCustody.set(custodyKey, (requiredInCustody.get(custodyKey) || 0) + Number(reservation.quantity || 0));
    if (reservation.status === 'consumed') {
      transferredToCustody.set(custodyKey, (transferredToCustody.get(custodyKey) || 0) + Number(reservation.quantity || 0));
    }
  }
  const custodyBalances = new Map();
  for (const row of balancesResult.data || []) {
    if (row.location_id === custodyLocationId) custodyBalances.set(inventoryItemKey(row), Number(row.quantity_on_hand || 0));
  }

  const activePickup = pickups.filter((row) => row.status !== 'completed');
  if (pickups.some((row) => row.status === 'blocked')) {
    return kitEvidence('blocked', 'pickup_inventory_blocked', nowIso, expiresAt,
      'Inventory Operations must resolve the blocked pickup task.');
  }
  if (stage === 'route_release') {
    for (const [key, quantity] of requiredAtSource) {
      if ((balances.get(key) || 0) < quantity) {
        return kitEvidence('blocked', 'inventory_source_balance_insufficient', nowIso, expiresAt,
          'Inventory Operations must restore the reserved source-of-record balance.');
      }
    }
    for (const [key, quantity] of transferredToCustody) {
      if ((custodyBalances.get(key) || 0) < quantity) {
        return kitEvidence('blocked', 'nurse_kit_balance_insufficient', nowIso, expiresAt,
          'Inventory Operations must reconcile the completed transfer into the nurse kit.');
      }
    }
    if (activePickup.some((row) => !row.route_day_id)) {
      return kitEvidence('blocked', 'pickup_route_stop_required', nowIso, expiresAt,
        'Operations must place each required pickup on this route before release.');
    }
    if (activePickup.length) {
      const routeDayIds = [...new Set(activePickup.map((row) => row.route_day_id))];
      const routeDaysResult = await db.from('provider_route_days')
        .select('id,current_plan_version_id')
        .eq('tenant_id', tenantId)
        .eq('provider_profile_id', providerProfileId)
        .in('id', routeDayIds);
      if (routeDaysResult.error) throw routeDaysResult.error;
      const currentPlanIds = new Set((routeDaysResult.data || []).map((row) => row.current_plan_version_id).filter(Boolean));
      const pickupPlanStopsResult = await db.from('nurse_route_plan_stops')
        .select('pickup_task_id,plan_version_id')
        .eq('tenant_id', tenantId)
        .in('pickup_task_id', activePickup.map((row) => row.id));
      if (pickupPlanStopsResult.error) throw pickupPlanStopsResult.error;
      const routedPickupIds = new Set((pickupPlanStopsResult.data || [])
        .filter((row) => currentPlanIds.has(row.plan_version_id))
        .map((row) => row.pickup_task_id));
      if (activePickup.some((row) => !routedPickupIds.has(row.id))) {
        return kitEvidence('blocked', 'pickup_route_stop_required', nowIso, expiresAt,
          'Operations must include every required pickup in the current feasible plan.');
      }
    }
    const offKitReservation = reservations.some((row) => row.location_id !== custodyLocationId && row.status !== 'consumed');
    if (offKitReservation && !activePickup.length) {
      return kitEvidence('blocked', 'pickup_orchestration_required', nowIso, expiresAt,
        'Operations must create a navigable pickup task for off-kit inventory.');
    }
    return kitEvidence('ready', activePickup.length ? 'pickup_routed_inventory_reserved' : 'nurse_kit_inventory_verified',
      nowIso, expiresAt);
  }

  if (pickups.some((row) => row.status !== 'completed' || !row.completed_at || !row.evidence_hash)) {
    return kitEvidence('blocked', 'pickup_custody_incomplete', nowIso, expiresAt,
      'Complete the verified pickup and custody transfer before starting this appointment.');
  }
  if (reservations.some((row) => row.status !== 'consumed' && row.location_id !== custodyLocationId)) {
    return kitEvidence('blocked', 'inventory_not_in_nurse_custody', nowIso, expiresAt,
      'Inventory Operations must complete the canonical transfer into the assigned nurse kit.');
  }
  for (const [key, quantity] of requiredInCustody) {
    if ((custodyBalances.get(key) || 0) < quantity) {
      return kitEvidence('blocked', 'nurse_kit_balance_insufficient', nowIso, expiresAt,
        'Inventory Operations must reconcile the nurse-kit stock ledger before care starts.');
    }
  }
  return kitEvidence('ready', 'nurse_kit_custody_and_stock_verified', nowIso, expiresAt);
}

async function loadAppointmentReadiness(db, tenantId, appointmentId) {
  if (!appointmentId) return null;
  const result = await db.from('appointments')
    .select('id,status,starts_at,patient_person_id,provider_profile_id,protocol_key,gfe_status,payment_status')
    .eq('tenant_id', tenantId)
    .eq('id', appointmentId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function loadLicenseEvidence(db, tenantId, providerProfileId) {
  const result = await db.from('provider_license_jurisdictions')
    .select('state,license_status,expires_on,nursys_checked_at')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId);
  if (result.error) throw result.error;
  return result.data || [];
}

async function loadRouteEvidence(db, tenantId, providerProfileId, appointmentId, shift, stage = 'run_start') {
  if (!appointmentId) return null;
  const routeDate = new Date(shift.starts_at).toLocaleDateString('en-CA', {
    timeZone: shift.timezone || 'America/Los_Angeles',
  });
  const days = await db.from('provider_route_days')
    .select('id,status,assignment_revision,acknowledged_revision,current_plan_version_id')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('route_date', routeDate)
    .limit(1);
  if (days.error) throw days.error;
  const day = (days.data || [])[0];
  if (!day) return null;
  const stop = await db.from('provider_route_day_stops')
    .select('id,selected,assignment_snapshot_at')
    .eq('tenant_id', tenantId)
    .eq('route_day_id', day.id)
    .eq('appointment_id', appointmentId)
    .eq('assigned_provider_profile_id', providerProfileId)
    .maybeSingle();
  if (stop.error) throw stop.error;
  const routeAcknowledged = Boolean(
    day.acknowledged_revision
    && Date.parse(day.acknowledged_revision) >= Date.parse(day.assignment_revision),
  );
  let planStop = null;
  if (day.current_plan_version_id) {
    const planStopResult = await db.from('nurse_route_plan_stops')
      .select('id,stop_key,sequence_number,latitude,longitude,planned_arrival_at,planned_departure_at')
      .eq('tenant_id', tenantId)
      .eq('plan_version_id', day.current_plan_version_id)
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    if (planStopResult.error) throw planStopResult.error;
    planStop = planStopResult.data || null;
  }
  const selected = Boolean(stop.data?.selected && planStop);
  const stageReady = stage === 'route_release'
    ? ['feasible', 'released', 'acknowledged', 'active', 'paused'].includes(day.status)
    : stage === 'run_start'
      ? ['acknowledged', 'active', 'paused'].includes(day.status) && routeAcknowledged
      : selected;
  return selected && stageReady ? { day, stop: { ...stop.data, plan_stop: planStop } } : null;
}

async function hasSafetyHold(db, tenantId, patientPersonId) {
  if (!patientPersonId) return false;
  const result = await db.from('do_not_treat_flags')
    .select('id,restriction_level')
    .eq('tenant_id', tenantId)
    .eq('patient_person_id', patientPersonId)
    .eq('active', true)
    .limit(1);
  if (result.error) throw result.error;
  return Boolean((result.data || []).length);
}

function storedOrFallback(stored, fallback) {
  return stored || fallback;
}

export async function loadCurrentOfferTerms(db, tenantId, providerProfileId, shiftId, now = new Date()) {
  const result = await db.from('nurse_offer_terms')
    .select(OFFER_TERMS_SELECT)
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('shift_id', shiftId)
    .order('terms_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  const latest = result.data || null;
  const latestStatus = String(latest?.status || '').toLowerCase();
  const current = Boolean(
    latest
    && (latestStatus === 'accepted'
      || (latestStatus === 'proposed' && Date.parse(latest.expires_at) > now.getTime())),
  );
  if (current) return { ...latest, reason_code: null, claim_eligible: true };
  return {
    status: 'unavailable',
    reason_code: !latest
      ? 'offer_terms_missing'
      : latestStatus === 'proposed' && Date.parse(latest.expires_at) <= now.getTime()
        ? 'offer_terms_expired'
        : 'offer_terms_not_current',
    claim_eligible: false,
    latest_status: latest?.status || null,
    terms_version: latest?.terms_version || null,
    engagement_model: latest?.engagement_model || null,
    gross_pay_cents: latest?.gross_pay_cents ?? null,
    hourly_rate_cents: latest?.hourly_rate_cents ?? null,
    currency: latest?.currency || null,
    estimated_work_minutes: latest?.estimated_work_minutes ?? null,
    estimated_travel_minutes: latest?.estimated_travel_minutes ?? null,
    mileage_rate_cents: latest?.mileage_rate_cents ?? null,
    guaranteed_minimum_cents: latest?.guaranteed_minimum_cents ?? null,
    cancellation_terms_code: latest?.cancellation_terms_code || null,
    expense_policy_code: latest?.expense_policy_code || null,
    expires_at: latest?.expires_at || null,
  };
}

export async function loadOfferTermsById(db, tenantId, providerProfileId, offerTermsId) {
  if (!offerTermsId) return null;
  const result = await db.from('nurse_offer_terms')
    .select(OFFER_TERMS_SELECT)
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('id', offerTermsId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data ? { ...result.data, claim_eligible: false, historical: true } : null;
}

export async function evaluateShiftReadiness({
  db,
  authed,
  provider,
  shift,
  preferences = null,
  now = new Date(),
  stage = 'claim',
}) {
  const normalizedStage = READINESS_STAGES.includes(stage) ? stage : 'claim';
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const [domainEvidence, licenses, schedulingIssue, appointment, offerTerms] = await Promise.all([
    loadDomainEvidence(db, authed.tenantId, provider.id, shift.id),
    loadLicenseEvidence(db, authed.tenantId, provider.id),
    loadSchedulingCapacityIssue(db, authed.tenantId, provider.id, shift, preferences),
    loadAppointmentReadiness(db, authed.tenantId, shift.appointment_id),
    loadCurrentOfferTerms(db, authed.tenantId, provider.id, shift.id, now),
  ]);
  const storedEvidence = Object.fromEntries(domainEvidence.map((row) => [row.domain, row]));
  const stored = Object.fromEntries(READINESS_DOMAINS.map((key) => [
    key,
    normalizeStoredDomain(storedEvidence[key], nowIso),
  ]));
  const isEvent = Boolean(shift.event_container_id);
  const engagement = engagementFromPreferences(preferences, now);
  const approvedEngagementModel = engagement.classification === 'contractor' ? 'approved_contractor' : 'w2';
  const engagementMatchesOffer = Boolean(
    engagement.approved
    && offerTerms.engagement_model === approvedEngagementModel,
  );

  const domains = {};
  domains.identity = provider.active && ['rn', 'np'].includes(provider.provider_role)
    ? readinessDomain('ready', 'provider_identity_verified', 'provider_profiles', {
      checkedAt: nowIso, expiresAt, ownerRole: 'operations', remediation: null,
    })
    : readinessDomain('blocked', 'provider_inactive', 'provider_profiles', {
      checkedAt: nowIso, expiresAt, ownerRole: 'operations', remediation: 'Contact Operations to restore provider access.',
    });

  const today = nowIso.slice(0, 10);
  const validLicense = licenses.some((row) => ACTIVE_LICENSE_STATES.has(String(row.license_status || '').toLowerCase())
    && (!row.expires_on || row.expires_on >= today)
    && row.nursys_checked_at
    && now.getTime() - Date.parse(row.nursys_checked_at) >= 0
    && now.getTime() - Date.parse(row.nursys_checked_at) <= NURSYS_EVIDENCE_MAX_AGE_MS);
  const credentialClear = provider.credential_status === 'clear' && provider.nursys_status === 'clear';
  const roleCovered = canCover(provider.provider_role, shift.role_required);
  const verifiedLicenseEvidence = stored.license?.status === 'ready';
  domains.license = credentialClear && validLicense && roleCovered && verifiedLicenseEvidence
    ? readinessDomain('ready', stored.license.reason_code || 'license_and_scope_clear', stored.license.source, {
      checkedAt: stored.license.checked_at, expiresAt: stored.license.expires_at,
      ownerRole: 'clinical_operations', remediation: null,
    })
    : readinessDomain('blocked', !credentialClear ? 'credential_verification_not_clear'
      : !validLicense ? 'fresh_nursys_license_evidence_missing'
        : !verifiedLicenseEvidence ? 'shift_license_scope_evidence_missing'
          : 'provider_scope_mismatch', 'provider_license_jurisdictions', {
      checkedAt: nowIso,
      expiresAt,
      ownerRole: 'clinical_operations',
      remediation: 'Clinical Operations must verify fresh Nursys, jurisdiction, restrictions, and shift scope evidence.',
    });

  const alreadyAssigned = Boolean(shift.assignment && ACTIVE_ASSIGNMENTS.has(shift.assignment.status));
  const available = alreadyAssigned || scheduleAvailability(preferences, shift);
  const preferenceIssue = isEvent ? null : servicePreferenceIssue(preferences, shift, appointment);
  const unresolvedSchedulingIssue = schedulingIssue || preferenceIssue;
  const blockingSchedulingIssue = alreadyAssigned && unresolvedSchedulingIssue?.reason_code !== 'schedule_conflict'
    ? null : unresolvedSchedulingIssue;
  const scheduleReady = roleCovered && !blockingSchedulingIssue && available
    && !['completed', 'cancelled'].includes(String(shift.status || '').toLowerCase());
  domains.schedule = scheduleReady
    ? readinessDomain('ready', alreadyAssigned ? 'assignment_active' : 'availability_and_capacity_clear', 'operational_shifts', {
      checkedAt: nowIso, expiresAt, ownerRole: 'operations', remediation: null,
    })
    : readinessDomain('blocked', blockingSchedulingIssue?.reason_code
      || (!available ? 'availability_not_configured_or_outside_window' : 'shift_not_available'), 'operational_shifts', {
      checkedAt: nowIso,
      expiresAt,
      ownerRole: 'operations',
      remediation: blockingSchedulingIssue
        ? blockingSchedulingIssue.reason_code === 'schedule_conflict'
          ? 'Resolve the overlapping assignment with Operations.'
          : 'Adjust your availability, capacity, service, or area preferences—or ask Operations to review this offer.'
        : 'Update availability or contact Operations.',
    });

  domains.kit = ['route_release', 'run_start'].includes(normalizedStage)
    ? await loadCanonicalKitEvidence(
      db, authed.tenantId, provider.id, shift.id, normalizedStage, now, nowIso, expiresAt,
    )
    : stored.kit || readinessDomain('unavailable', 'kit_readiness_evidence_missing', 'kit_custody', {
      checkedAt: null,
      expiresAt: null,
      ownerRole: 'operations',
      remediation: 'Inventory readiness is verified after claim and before route release.',
    });

  if (isEvent) {
    for (const key of ['client', 'gfe', 'patient_payment']) {
      domains[key] = stored[key] || readinessDomain('not_required', 'event_patient_workflow_handoff', 'events', {
        checkedAt: nowIso,
        expiresAt,
        ownerRole: key === 'gfe' ? 'clinical' : 'event_operations',
        remediation: null,
      });
    }
  } else if (!appointment) {
    for (const [key, owner] of [['client', 'operations'], ['gfe', 'clinical'], ['patient_payment', 'finance']]) {
      domains[key] = readinessDomain('blocked', 'appointment_readiness_missing', 'appointments', {
        checkedAt: nowIso,
        expiresAt,
        ownerRole: owner,
        remediation: 'Operations must link and verify the mobile appointment.',
      });
    }
  } else {
    const clientFallback = appointment.patient_person_id && !['cancelled', 'canceled'].includes(String(appointment.status || '').toLowerCase())
      ? readinessDomain('ready', 'client_and_appointment_verified', 'appointments', {
        checkedAt: nowIso, expiresAt, ownerRole: 'operations', remediation: null,
      })
      : readinessDomain('blocked', 'client_readiness_incomplete', 'appointments', {
        checkedAt: nowIso, expiresAt, ownerRole: 'operations', remediation: 'Operations must complete client intake and appointment linkage.',
      });
    domains.client = storedOrFallback(stored.client, clientFallback);
    const gfeFallback = READY_GFE_STATES.has(String(appointment.gfe_status || '').toLowerCase())
      ? readinessDomain('ready', 'gfe_clear', 'appointments', {
        checkedAt: nowIso, expiresAt, ownerRole: 'clinical', remediation: null,
      })
      : readinessDomain('blocked', 'gfe_not_clear', 'appointments', {
        checkedAt: nowIso, expiresAt, ownerRole: 'clinical', remediation: 'Clinical must complete or approve the GFE before care.',
      });
    domains.gfe = storedOrFallback(stored.gfe, gfeFallback);
    const paymentFallback = READY_PAYMENT_STATES.has(String(appointment.payment_status || '').toLowerCase())
      ? readinessDomain('ready', 'patient_payment_gate_clear', 'appointments', {
        checkedAt: nowIso, expiresAt, ownerRole: 'finance', remediation: null,
      })
      : readinessDomain('blocked', 'patient_payment_gate_not_clear', 'appointments', {
        checkedAt: nowIso, expiresAt, ownerRole: 'finance', remediation: 'Operations or Finance must clear the configured patient-payment gate.',
      });
    domains.patient_payment = storedOrFallback(stored.patient_payment, paymentFallback);
  }

  if (isEvent && !shift.appointment_id) {
    domains.route = stored.route || readinessDomain('not_required', 'event_route_workflow_handoff', 'events', {
      checkedAt: nowIso, expiresAt, ownerRole: 'event_operations', remediation: null,
    });
  } else {
    const routeEvidence = await loadRouteEvidence(
      db, authed.tenantId, provider.id, shift.appointment_id, shift, normalizedStage,
    );
    const routeFallback = routeEvidence
      ? readinessDomain('ready', 'assigned_route_stop_verified', 'provider_route_day_stops', {
        checkedAt: nowIso, expiresAt, ownerRole: 'operations', remediation: null,
      })
      : readinessDomain('unavailable', 'route_readiness_evidence_missing', 'provider_route_day_stops', {
        checkedAt: nowIso,
        expiresAt,
        ownerRole: 'operations',
        remediation: 'Choose an origin and ask Operations to release a feasible route before starting work.',
      });
    domains.route = ['route_release', 'run_start'].includes(normalizedStage)
      ? routeFallback
      : storedOrFallback(stored.route, routeFallback);
  }

  if (isEvent && !appointment?.patient_person_id) {
    domains.safety = stored.safety || readinessDomain('not_required', 'event_safety_workflow_handoff', 'events', {
      checkedAt: nowIso, expiresAt, ownerRole: 'event_operations', remediation: null,
    });
  } else if (!appointment?.patient_person_id) {
    domains.safety = readinessDomain('blocked', 'patient_safety_identity_missing', 'do_not_treat_flags', {
      checkedAt: nowIso,
      expiresAt,
      ownerRole: 'clinical',
      remediation: 'Clinical must verify the patient safety record.',
    });
  } else {
    const safetyHold = await hasSafetyHold(db, authed.tenantId, appointment.patient_person_id);
    domains.safety = safetyHold
      ? readinessDomain('blocked', 'active_safety_hold', 'do_not_treat_flags', {
        checkedAt: nowIso, expiresAt, ownerRole: 'clinical', remediation: 'Contact Clinical before proceeding.',
      })
      : readinessDomain('ready', 'no_active_safety_hold', 'do_not_treat_flags', {
        checkedAt: nowIso, expiresAt, ownerRole: 'clinical', remediation: null,
      });
  }

  // Claiming must happen before the nurse supplies an origin and before a
  // route can be planned. Route and kit are therefore visible during offer
  // evaluation but become blocking only for route release and run start.
  const blockingDomains = READINESS_DOMAINS_BY_STAGE[normalizedStage];
  const domainsReady = blockingDomains.every((key) => READY_STATES.has(domains[key]?.status));
  const termsRequired = normalizedStage === 'offer' || normalizedStage === 'claim';
  const termsReady = !termsRequired || (offerTerms.claim_eligible === true && engagementMatchesOffer);
  const ready = domainsReady && termsReady;
  const claimAllowed = normalizedStage === 'offer' || normalizedStage === 'claim' ? ready : false;
  const startAllowed = normalizedStage === 'run_start' && ready && alreadyAssigned;
  const readiness = {
    stage: normalizedStage,
    status: ready ? 'ready' : 'blocked',
    claim_allowed: claimAllowed,
    route_release_allowed: normalizedStage === 'route_release' && ready && alreadyAssigned,
    start_allowed: startAllowed,
    checked_at: nowIso,
    expires_at: expiresAt,
    domains,
    offer_terms: {
      status: offerTerms.status,
      reason_code: offerTerms.reason_code || (engagementMatchesOffer ? null : 'engagement_model_not_approved'),
      terms_version: offerTerms.terms_version,
      expires_at: offerTerms.expires_at,
    },
    blockers: [
      ...blockingDomains.filter((key) => !READY_STATES.has(domains[key]?.status)),
      ...(termsReady ? [] : ['offer_terms']),
    ],
  };

  const evidenceArray = READINESS_DOMAINS.map((domain) => ({ domain, ...domains[domain] }));
  const persisted = await db.from('nurse_shift_readiness_snapshots').insert({
    tenant_id: authed.tenantId,
    shift_id: shift.id,
    provider_profile_id: provider.id,
    evaluation_stage: normalizedStage,
    evaluator_version: `nurse-readiness-v2-${normalizedStage}`,
    source_shift_version: shift.version,
    overall_status: readiness.status,
    // Legacy run RPCs use this boolean as their generic executable gate. The
    // stage column prevents a run-start snapshot from satisfying an offer
    // claim while preserving compatibility until every DB reader is upgraded.
    claim_allowed: normalizedStage === 'run_start' ? readiness.start_allowed : readiness.claim_allowed,
    evidence: evidenceArray,
    checked_at: nowIso,
    expires_at: expiresAt,
  }).select(SNAPSHOT_SELECT).single();
  if (persisted.error) throw persisted.error;
  return { readiness, offerTerms, snapshot: persisted.data };
}

export async function loadLatestRun(db, tenantId, providerProfileId, shiftId) {
  const result = await db.from('mobile_shift_runs')
    .select(RUN_SELECT)
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

export async function loadRunReadiness(db, tenantId, providerProfileId, readinessSnapshotId) {
  if (!readinessSnapshotId) return null;
  const result = await db.from('nurse_shift_readiness_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('id', readinessSnapshotId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const evidence = Array.isArray(result.data.evidence) ? result.data.evidence : [];
  return {
    status: result.data.overall_status,
    stage: result.data.evaluation_stage || 'claim',
    claim_allowed: Boolean(result.data.claim_allowed),
    start_allowed: Boolean(
      (result.data.evaluation_stage || 'claim') === 'run_start'
      && result.data.overall_status === 'ready'
      && !result.data.invalidated_at
      && Date.parse(result.data.expires_at) > Date.now(),
    ),
    checked_at: result.data.checked_at,
    expires_at: result.data.expires_at,
    source_shift_version: result.data.source_shift_version,
    evaluator_version: result.data.evaluator_version,
    invalidated_at: result.data.invalidated_at,
    invalidation_reason: result.data.invalidation_reason,
    domains: Object.fromEntries(evidence
      .filter((entry) => entry && READINESS_DOMAINS.includes(entry.domain))
      .map((entry) => {
        const { domain, ...details } = entry;
        return [domain, details];
      })),
  };
}

export async function loadRunGuide(db, tenantId, run) {
  if (!run?.guide_version_id) return null;
  const versionResult = await db.from('shift_guide_versions')
    .select('id,template_id,version,status,publication_status,steps,required_closeout_keys,source_reference,approved_at,published_at')
    .eq('tenant_id', tenantId)
    .eq('id', run.guide_version_id)
    .maybeSingle();
  if (versionResult.error) throw versionResult.error;
  if (!versionResult.data || !['approved', 'retired'].includes(versionResult.data.status)) return null;
  if (!['published', 'retired', 'legacy_approved'].includes(versionResult.data.publication_status)) return null;
  const templateResult = await db.from('shift_guide_templates')
    .select('id,template_key,name,work_kind,protocol_key,role_required,active')
    .eq('tenant_id', tenantId)
    .eq('id', versionResult.data.template_id)
    .maybeSingle();
  if (templateResult.error) throw templateResult.error;
  if (!templateResult.data) return null;
  return {
    id: versionResult.data.id,
    label: run.guide_version,
    template_key: templateResult.data.template_key,
    name: templateResult.data.name,
    work_kind: templateResult.data.work_kind,
    protocol_key: templateResult.data.protocol_key,
    role_required: templateResult.data.role_required,
    version: versionResult.data.version,
    status: versionResult.data.status,
    publication_status: versionResult.data.publication_status,
    steps: Array.isArray(versionResult.data.steps) ? versionResult.data.steps : [],
    required_closeout_keys: Array.isArray(versionResult.data.required_closeout_keys)
      ? versionResult.data.required_closeout_keys : [],
    source_reference: versionResult.data.source_reference,
    approved_at: versionResult.data.approved_at,
    published_at: versionResult.data.published_at,
  };
}

export async function loadShiftById(db, tenantId, shiftId) {
  const result = await db.from('operational_shifts')
    .select('id,series_id,occurrence_key,event_container_id,appointment_id,title,starts_at,ends_at,timezone,location_name,location_address,service_area,role_required,slots_required,status,instructions,version')
    .eq('tenant_id', tenantId)
    .eq('id', shiftId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw requestError('Shift not found.', 'shift_not_found', 404);
  return result.data;
}

export async function loadOwnAssignment(db, tenantId, providerProfileId, shiftId) {
  const result = await db.from('operational_shift_assignments')
    .select('id,shift_id,provider_profile_id,status,offered_at,claimed_at,assigned_at,completed_at,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('shift_id', shiftId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

export async function requireOwnedShift(db, tenantId, providerProfileId, shiftId) {
  const [shift, assignment] = await Promise.all([
    loadShiftById(db, tenantId, shiftId),
    loadOwnAssignment(db, tenantId, providerProfileId, shiftId),
  ]);
  if (!assignment || !['claimed', 'assigned', 'completed'].includes(assignment.status)) {
    throw requestError('An accepted nurse assignment is required.', 'active_assignment_required', 403);
  }
  return { shift: { ...shift, assignment }, assignment };
}

export async function callNurseRpc(db, name, args) {
  const result = await db.rpc(name, args);
  if (result.error) throw result.error;
  return Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : result.data;
}

export async function loadRunEvents(db, tenantId, providerProfileId, runId) {
  const [timeResult, stepResult, exceptionResult] = await Promise.all([
    db.from('mobile_shift_time_events')
      .select('id,shift_run_id,event_type,device_occurred_at,occurred_at,reason_code,idempotency_key,metadata,created_at')
      .eq('tenant_id', tenantId).eq('provider_profile_id', providerProfileId).eq('shift_run_id', runId)
      .order('occurred_at', { ascending: true }),
    db.from('mobile_shift_step_events')
      .select('id,shift_run_id,step_key,resolution,reason_code,device_occurred_at,occurred_at,payload,idempotency_key,created_at')
      .eq('tenant_id', tenantId).eq('provider_profile_id', providerProfileId).eq('shift_run_id', runId)
      .order('created_at', { ascending: true }),
    db.from('shift_exceptions')
      .select('id,shift_run_id,kind,reason_code,severity,status,owner_role,note,created_at,resolved_at')
      .eq('tenant_id', tenantId).eq('provider_profile_id', providerProfileId).eq('shift_run_id', runId)
      .order('created_at', { ascending: true }),
  ]);
  if (timeResult.error) throw timeResult.error;
  if (stepResult.error) throw stepResult.error;
  if (exceptionResult.error) throw exceptionResult.error;
  return {
    timeEvents: timeResult.data || [],
    stepEvents: stepResult.data || [],
    exceptions: exceptionResult.data || [],
  };
}

export async function loadRouteForShift(db, tenantId, providerProfileId, shift) {
  const evidence = await loadRouteEvidence(
    db, tenantId, providerProfileId, shift.appointment_id, shift, 'run_start',
  );
  if (!evidence) return null;
  const destination = evidence.stop.plan_stop
    ? `${Number(evidence.stop.plan_stop.latitude)},${Number(evidence.stop.plan_stop.longitude)}` : '';
  return {
    route_day_id: evidence.day.id,
    route_status: evidence.day.status,
    stop_id: evidence.stop.id,
    assignment_revision: evidence.day.assignment_revision,
    acknowledged_revision: evidence.day.acknowledged_revision,
    navigation: destination ? {
      apple_maps_url: `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`,
      google_maps_url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    } : null,
    continuous_location_tracking: false,
  };
}

export function nextNurseAction({ run, timeEvents = [], stepEvents = [], exceptions = [], guide = null, readiness = null }) {
  if (!run) return { action: 'start', label: 'Start preflight', clock_out_available: false };
  if (['time_submitted', 'closed'].includes(run.status)) {
    return { action: 'review_payment', label: 'Review invoice and payout status', clock_out_available: false };
  }
  const openException = exceptions.find((row) => !['resolved', 'closed'].includes(row.status));
  const clockedIn = timeEvents.some((row) => row.event_type === 'clock_in');
  const clockedOut = timeEvents.some((row) => row.event_type === 'clock_out');
  if (!clockedIn && openException) {
    return {
      action: 'resolve_exception',
      label: 'Wait for exception review before clocking in',
      exception_id: openException.id,
      clock_out_available: false,
    };
  }
  if (!clockedIn && readiness?.status !== 'ready') {
    return {
      action: 'readiness_blocked',
      label: 'Wait for readiness review before clocking in',
      reason_code: readiness?.blockers?.[0] || 'fresh_readiness_required',
      clock_out_available: false,
    };
  }
  if (!clockedIn) return { action: 'clock_in', label: 'Clock in', clock_out_available: false };
  if (clockedOut && openException) {
    return {
      action: 'resolve_exception',
      label: 'Resolve exception',
      exception_id: openException.id,
      clock_out_available: false,
    };
  }
  if (clockedOut) return { action: 'closeout', label: 'Submit shift closeout', clock_out_available: false };
  if (openException) {
    return {
      action: 'resolve_exception',
      label: 'Resolve exception',
      exception_id: openException.id,
      clock_out_available: true,
    };
  }
  if (readiness?.status !== 'ready') {
    return {
      action: 'readiness_blocked',
      label: 'Pause care and open an exception',
      reason_code: readiness?.blockers?.[0] || 'current_readiness_blocked',
      clock_out_available: true,
    };
  }
  const activeBreak = [...timeEvents].reverse().find((row) => ['break_start', 'break_end'].includes(row.event_type));
  if (activeBreak?.event_type === 'break_start') {
    return { action: 'break_end', label: 'End break', clock_out_available: true };
  }
  const latestStepByKey = new Map();
  for (const event of stepEvents) latestStepByKey.set(event.step_key, event);
  const completedKeys = new Set([...latestStepByKey.entries()]
    .filter(([, event]) => RESOLVED_STEP_STATES.has(event.resolution))
    .map(([key]) => key));
  const nextStep = (guide?.steps || []).find((step) => {
    const key = cleanText(step?.step_key || step?.key, 100);
    return key && !completedKeys.has(key);
  });
  if (nextStep) {
    const stepKey = cleanText(nextStep.step_key || nextStep.key, 100);
    return {
      action: 'resolve_step',
      label: cleanText(nextStep.label || nextStep.title || nextStep.name, 160) || 'Complete next approved step',
      instructions: cleanText(nextStep.instructions, 1000) || null,
      step_key: stepKey,
      clock_out_available: true,
    };
  }
  const closeoutKey = (guide?.required_closeout_keys || []).find((key) => {
    const normalized = cleanText(key, 100);
    return normalized && !completedKeys.has(normalized);
  });
  if (closeoutKey) {
    const labels = {
      source_record_closed: 'Confirm source record closeout',
      kit_reconciled: 'Reconcile kit and supplies',
      route_reconciled: 'Confirm route closeout',
    };
    return {
      action: 'resolve_step',
      label: labels[closeoutKey] || 'Complete required closeout',
      step_key: closeoutKey,
      clock_out_available: true,
    };
  }
  const latestStep = stepEvents[stepEvents.length - 1] || null;
  return {
    action: 'continue_guide',
    label: 'Continue guided shift',
    latest_step_key: latestStep?.step_key || null,
    clock_out_available: true,
  };
}
