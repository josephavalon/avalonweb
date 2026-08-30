import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { isSchedulingMigrationError, schedulingRpcError } from '../_lib/operational-workflows.js';
import {
  NURSE_ROLES,
  callNurseRpc,
  clientIdempotencyKey,
  engagementFromPreferences,
  evaluateShiftReadiness,
  isNurseWorkflowMigrationError,
  loadLatestRun,
  loadOwnAssignment,
  loadShiftById,
  loadWorkPreferences,
  nurseWorkflowError,
  parseJsonBody,
  publicProvider,
  requestError,
  requirePositiveVersion,
  requireUuid,
  resolveNurseProvider,
} from '../_lib/nurse-workflow.js';

const SHIFT_SELECT = 'id,series_id,occurrence_key,event_container_id,appointment_id,title,starts_at,ends_at,timezone,location_name,location_address,service_area,role_required,slots_required,status,instructions,version';
const ASSIGNMENT_SELECT = 'id,shift_id,provider_profile_id,status,offered_at,claimed_at,assigned_at,completed_at,created_at,updated_at';
const READINESS_SOURCE = Symbol('nurseReadinessSource');

function isoBoundary(value, fallback, field) {
  if (!value) return fallback;
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) throw requestError(`${field} is invalid.`, 'invalid_schedule_range');
  return new Date(timestamp).toISOString();
}
function canCover(providerRole, roleRequired) {
  const required = String(roleRequired || '').trim().toLowerCase();
  return providerRole === 'np' ? ['rn', 'np'].includes(required) : required === 'rn';
}

async function hydrate(db, tenantId, shifts, ownAssignments) {
  const eventIds = [...new Set(shifts.map((row) => row.event_container_id).filter(Boolean))];
  let events = [];
  if (eventIds.length) {
    const result = await db.from('event_containers').select('id,name,starts_at,ends_at,venue')
      .eq('tenant_id', tenantId).in('id', eventIds);
    if (result.error) throw result.error;
    events = result.data || [];
  }
  const eventById = new Map(events.map((row) => [row.id, row]));
  const assignmentByShift = new Map(ownAssignments.map((row) => [row.shift_id, row]));
  return shifts.map((shift) => {
    const assignment = assignmentByShift.get(shift.id) || null;
    const hasOperationalAccess = assignment && ['claimed', 'assigned', 'completed'].includes(assignment.status);
    const event = eventById.get(shift.event_container_id) || null;
    return {
      ...shift,
      // Free-text titles and addresses can contain patient or event-attendee
      // details. Keep the raw row server-only for readiness evaluation, then
      // return only the minimum offer facts until this nurse accepts the work.
      title: hasOperationalAccess ? shift.title : `${String(shift.role_required || 'clinical').toUpperCase()} shift`,
      event_container_id: hasOperationalAccess ? shift.event_container_id : null,
      appointment_id: hasOperationalAccess ? shift.appointment_id : null,
      location_name: hasOperationalAccess ? shift.location_name : null,
      location_address: hasOperationalAccess ? shift.location_address : null,
      service_area: hasOperationalAccess ? shift.service_area : null,
      instructions: hasOperationalAccess ? shift.instructions : null,
      event: hasOperationalAccess && event ? event : null,
      assignment,
      [READINESS_SOURCE]: { ...shift, assignment },
    };
  });
}

async function loadShifts(db, authed, provider, queryParams = {}) {
  const now = Date.now();
  const from = isoBoundary(queryParams.from, new Date(now - 90 * 86400000).toISOString(), 'Start date');
  const to = isoBoundary(queryParams.to, new Date(now + 180 * 86400000).toISOString(), 'End date');
  if (Date.parse(to) < Date.parse(from)) throw requestError('End date must follow start date.', 'invalid_schedule_range');
  if (Date.parse(to) - Date.parse(from) > 550 * 86400000) throw requestError('Schedule range is too large.', 'invalid_schedule_range');

  const assignmentResult = await db.from('operational_shift_assignments').select(ASSIGNMENT_SELECT)
    .eq('tenant_id', authed.tenantId).eq('provider_profile_id', provider.id).limit(500);
  if (assignmentResult.error) throw assignmentResult.error;
  const assignments = assignmentResult.data || [];
  const assignedIds = assignments.map((row) => row.shift_id);

  const ownPromise = assignedIds.length
    ? db.from('operational_shifts').select(SHIFT_SELECT).eq('tenant_id', authed.tenantId)
      .in('id', assignedIds).gte('starts_at', from).lte('starts_at', to).limit(250)
    : Promise.resolve({ data: [], error: null });
  const openPromise = db.from('operational_shifts').select(SHIFT_SELECT).eq('tenant_id', authed.tenantId)
    .eq('status', 'open').gte('starts_at', new Date(now).toISOString()).lte('starts_at', to)
    .order('starts_at', { ascending: true }).limit(250);
  const [ownResult, openResult] = await Promise.all([ownPromise, openPromise]);
  if (ownResult.error) throw ownResult.error;
  if (openResult.error) throw openResult.error;

  const visibleOpen = (openResult.data || []).filter((shift) => canCover(provider.provider_role, shift.role_required));
  const byId = new Map([...(ownResult.data || []), ...visibleOpen].map((row) => [row.id, row]));
  const sorted = [...byId.values()].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return hydrate(db, authed.tenantId, sorted, assignments);
}

async function enrichShifts({ db, authed, provider, shifts, preferences }) {
  const enriched = [];
  // Each evaluation reads several independent sources and persists a short-lived
  // snapshot. Small batches avoid exhausting the serverless DB connection pool.
  for (let index = 0; index < shifts.length; index += 5) {
    const batch = shifts.slice(index, index + 5);
    const rows = await Promise.all(batch.map(async (shift) => {
      const sourceShift = shift[READINESS_SOURCE] || shift;
      const { [READINESS_SOURCE]: ignoredSource, ...publicShift } = shift;
      const [{ readiness, offerTerms }, run] = await Promise.all([
        evaluateShiftReadiness({ db, authed, provider, shift: sourceShift, preferences }),
        loadLatestRun(db, authed.tenantId, provider.id, shift.id),
      ]);
      void ignoredSource;
      return { ...publicShift, readiness, offer_terms: offerTerms, run };
    }));
    enriched.push(...rows);
  }
  return enriched;
}

function cleanCounterTerms(body) {
  const input = body.counter && typeof body.counter === 'object' && !Array.isArray(body.counter)
    ? body.counter : body.requestedTerms && typeof body.requestedTerms === 'object' ? body.requestedTerms : {};
  const terms = {};
  if (input.proposedRateCents != null || input.proposed_rate_cents != null) {
    const cents = Number(input.proposedRateCents ?? input.proposed_rate_cents);
    if (!Number.isInteger(cents) || cents < 0 || cents > 1_000_000) {
      throw requestError('Proposed rate must be a valid amount.', 'counter_terms_invalid');
    }
    terms.proposed_rate_cents = cents;
  }
  for (const [clientKey, dbKey] of [['proposedStartAt', 'proposed_start_at'], ['proposedEndAt', 'proposed_end_at']]) {
    const value = input[clientKey] ?? input[dbKey];
    if (value != null) {
      const timestamp = Date.parse(String(value));
      if (!Number.isFinite(timestamp)) throw requestError('Proposed shift time is invalid.', 'counter_terms_invalid');
      terms[dbKey] = new Date(timestamp).toISOString();
    }
  }
  const note = String(input.note || '').trim().replace(/\s+/g, ' ').slice(0, 500);
  if (note) terms.note = note;
  if (!Object.keys(terms).length) throw requestError('Counter terms are required.', 'counter_terms_required');
  return terms;
}

async function reloadShiftContext(authed, provider, shiftId, preferences) {
  const [shift, assignment, run] = await Promise.all([
    loadShiftById(authed.db, authed.tenantId, shiftId),
    loadOwnAssignment(authed.db, authed.tenantId, provider.id, shiftId),
    loadLatestRun(authed.db, authed.tenantId, provider.id, shiftId),
  ]);
  const withAssignment = { ...shift, assignment };
  const { readiness, offerTerms } = await evaluateShiftReadiness({
    db: authed.db, authed, provider, shift: withAssignment, preferences,
  });
  return { shift: withAssignment, assignment, run, readiness, offer_terms: offerTerms };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    const provider = await resolveNurseProvider(authed);
    const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
    const engagement = engagementFromPreferences(preferences);
    if (req.method === 'GET') {
      const shifts = await loadShifts(authed.db, authed, provider, req.query || {});
      const enriched = await enrichShifts({ db: authed.db, authed, provider, shifts, preferences });
      return res.status(200).json({ shifts: enriched, provider: publicProvider(provider, engagement) });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = parseJsonBody(req);
    const action = String(body.action || '').toLowerCase();
    const shiftId = requireUuid(body.shiftId, 'Shift id');
    const version = requirePositiveVersion(body.version, 'Shift version');
    const [shift, assignment] = await Promise.all([
      loadShiftById(authed.db, authed.tenantId, shiftId),
      loadOwnAssignment(authed.db, authed.tenantId, provider.id, shiftId),
    ]);
    const current = { ...shift, assignment };
    const common = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_shift_id: shiftId,
      p_provider_profile_id: provider.id,
      p_expected_version: version,
    };

    if (action === 'claim') {
      const { readiness } = await evaluateShiftReadiness({
        db: authed.db, authed, provider, shift: current, preferences,
      });
      if (!readiness.claim_allowed || shift.status !== 'open'
        || ['claimed', 'assigned', 'completed'].includes(assignment?.status)) {
        return res.status(409).json({ error: 'This shift is not ready to accept.', code: 'shift_not_ready', readiness });
      }
      await callNurseRpc(authed.db, 'claim_operational_shift', common);
      const context = await reloadShiftContext(authed, provider, shiftId, preferences);
      return res.status(200).json({ ok: true, ...context });
    }
    if (action === 'decline') {
      await callNurseRpc(authed.db, 'decline_operational_shift', common);
      const context = await reloadShiftContext(authed, provider, shiftId, preferences);
      return res.status(200).json({ ok: true, ...context });
    }
    if (action === 'counter') {
      const requestedTerms = cleanCounterTerms(body);
      const requestKey = clientIdempotencyKey(body.requestKey || body.idempotencyKey, 'counter');
      const counter = await callNurseRpc(authed.db, 'counter_operational_shift_offer', {
        ...common,
        p_request_key: requestKey,
        p_requested_terms: requestedTerms,
      });
      const context = await reloadShiftContext(authed, provider, shiftId, preferences);
      return res.status(200).json({ ok: true, counter, request_key: requestKey, ...context });
    }
    return res.status(400).json({ error: 'Unsupported shift action.', code: 'invalid_action' });
  } catch (caught) {
    let error = caught;
    if (isNurseWorkflowMigrationError(error)) error = nurseWorkflowError(error);
    else if (isSchedulingMigrationError(error)) error = schedulingRpcError(error);
    else error = nurseWorkflowError(error, 'Could not load or update shifts.');
    console.warn('[me/shifts] failed', safeLogContext(error, 'me_shifts_failed'));
    return res.status(error.status || 500).json({
      error: error.expose || error.code === 'nurse_workflow_migration_required' ? error.message : 'Could not load or update shifts.',
      code: safeErrorCode(error, 'me_shifts_failed'),
    });
  }
}
