import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import {
  isSchedulingMigrationError,
  requireUuid,
  requireVersion,
  schedulingRpcError,
} from '../_lib/operational-workflows.js';

const SHIFT_SELECT = 'id,series_id,occurrence_key,event_container_id,appointment_id,title,starts_at,ends_at,timezone,location_name,location_address,service_area,role_required,slots_required,status,instructions,version';
const ASSIGNMENT_SELECT = 'id,shift_id,provider_profile_id,status,offered_at,claimed_at,assigned_at,completed_at,created_at,updated_at';

function requestError(message, code, status = 400) {
  return Object.assign(new Error(message), { code, status, expose: true });
}

function parseBody(req) {
  if (typeof req.body !== 'string') return req.body || {};
  try { return JSON.parse(req.body); }
  catch { throw requestError('Request body must be valid JSON.', 'invalid_json'); }
}

function isoBoundary(value, fallback, field) {
  if (!value) return fallback;
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) throw requestError(`${field} is invalid.`, 'invalid_schedule_range');
  return new Date(timestamp).toISOString();
}

async function resolveActiveProvider(db, authed) {
  const { data, error } = await db.from('provider_profiles')
    .select('id,profile_id,provider_role,credential_status,nursys_status,scope_tags,active')
    .eq('tenant_id', authed.tenantId)
    .eq('profile_id', authed.user.id)
    .eq('active', true)
    .eq('credential_status', 'clear')
    .eq('nursys_status', 'clear')
    .in('provider_role', ['rn', 'np'])
    .limit(2);
  if (error) throw error;
  if (!(data || []).length) {
    throw requestError('An active, credential-cleared nurse profile is required.', 'provider_not_eligible', 403);
  }
  if (data.length > 1) {
    throw requestError('Multiple active provider profiles need administrator review.', 'provider_profile_ambiguous', 409);
  }
  return data[0];
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
      // A free-text admin title or event name can contain a person's name even
      // when keyword guards pass. Before a nurse claims the shift, expose only
      // a server-derived operational label and the minimum staffing facts.
      title: hasOperationalAccess ? shift.title : `${String(shift.role_required || 'clinical').toUpperCase()} shift`,
      event_container_id: hasOperationalAccess ? shift.event_container_id : null,
      appointment_id: hasOperationalAccess ? shift.appointment_id : null,
      location_name: hasOperationalAccess ? shift.location_name : null,
      location_address: hasOperationalAccess ? shift.location_address : null,
      service_area: hasOperationalAccess ? shift.service_area : null,
      instructions: hasOperationalAccess ? shift.instructions : null,
      event: hasOperationalAccess && event ? event : null,
      assignment,
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
      .in('id', assignedIds).gte('starts_at', from).lte('starts_at', to).limit(500)
    : Promise.resolve({ data: [], error: null });
  const openPromise = db.from('operational_shifts').select(SHIFT_SELECT).eq('tenant_id', authed.tenantId)
    .eq('status', 'open').gte('starts_at', new Date(now).toISOString()).lte('starts_at', to)
    .order('starts_at', { ascending: true }).limit(500);
  const [ownResult, openResult] = await Promise.all([ownPromise, openPromise]);
  if (ownResult.error) throw ownResult.error;
  if (openResult.error) throw openResult.error;

  const visibleOpen = (openResult.data || []).filter((shift) => canCover(provider.provider_role, shift.role_required));
  const byId = new Map([...(ownResult.data || []), ...visibleOpen].map((row) => [row.id, row]));
  const sorted = [...byId.values()].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return hydrate(db, authed.tenantId, sorted, assignments);
}

async function callSchedulingRpc(db, name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw schedulingRpcError(error);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireRole(req, res, ['nurse', 'rn', 'np', 'admin']);
  if (!authed) return;
  try {
    const provider = await resolveActiveProvider(authed.db, authed);
    if (req.method === 'GET') {
      const shifts = await loadShifts(authed.db, authed, provider, req.query || {});
      return res.status(200).json({ shifts });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = parseBody(req);
    const action = String(body.action || '').toLowerCase();
    const common = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_shift_id: requireUuid(body.shiftId, 'Shift id'),
      p_provider_profile_id: provider.id,
      p_expected_version: requireVersion(body.version),
    };
    if (action === 'claim') {
      const assignment = await callSchedulingRpc(authed.db, 'claim_operational_shift', common);
      return res.status(200).json({ ok: true, assignment });
    }
    if (action === 'complete') {
      const assignment = await callSchedulingRpc(authed.db, 'complete_operational_shift_assignment', common);
      return res.status(200).json({ ok: true, assignment });
    }
    return res.status(400).json({ error: 'Unsupported shift action.', code: 'invalid_action' });
  } catch (caught) {
    const error = isSchedulingMigrationError(caught) ? schedulingRpcError(caught) : caught;
    console.warn('[me/shifts] failed', safeLogContext(error, 'me_shifts_failed'));
    const publicMessage = error.code === 'scheduling_migration_required' || error.expose
      ? error.message
      : 'Could not load shifts.';
    return res.status(error.status || 500).json({
      error: publicMessage,
      code: safeErrorCode(error, 'me_shifts_failed'),
    });
  }
}
