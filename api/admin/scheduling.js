import { requireAdmin } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import {
  cleanProviderProfileIds,
  cleanShiftInput,
  expandShiftOccurrences,
  isSchedulingMigrationError,
  requireUuid,
  requireVersion,
  schedulingRpcError,
} from '../_lib/operational-workflows.js';

const SHIFT_STATUSES = ['draft', 'open', 'assigned', 'in_progress', 'completed', 'cancelled'];
const SHIFT_SELECT = 'id,tenant_id,series_id,occurrence_key,event_container_id,appointment_id,title,starts_at,ends_at,timezone,location_name,location_address,service_area,role_required,slots_required,status,instructions,recurrence,version,created_at,updated_at';
const ASSIGNMENT_SELECT = 'id,shift_id,provider_profile_id,status,offered_at,claimed_at,assigned_at,completed_at,created_at,updated_at';
const PROVIDER_SELECT = 'id,profile_id,provider_role,credential_status,nursys_status,scope_tags,active';

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

async function callSchedulingRpc(db, name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw schedulingRpcError(error);
  return data;
}

async function loadProviderProfiles(db, tenantId, assignments) {
  const assignedIds = [...new Set(assignments.map((row) => row.provider_profile_id).filter(Boolean))];
  const eligibleResult = await db.from('provider_profiles').select(PROVIDER_SELECT)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('credential_status', 'clear')
    .eq('nursys_status', 'clear')
    .in('provider_role', ['rn', 'np']);
  if (eligibleResult.error) throw eligibleResult.error;

  let assigned = [];
  if (assignedIds.length) {
    const assignedResult = await db.from('provider_profiles').select(PROVIDER_SELECT)
      .eq('tenant_id', tenantId).in('id', assignedIds);
    if (assignedResult.error) throw assignedResult.error;
    assigned = assignedResult.data || [];
  }
  const byId = new Map([...(eligibleResult.data || []), ...assigned].map((row) => [row.id, row]));
  const profileIds = [...new Set([...byId.values()].map((row) => row.profile_id).filter(Boolean))];
  let profiles = [];
  if (profileIds.length) {
    const profileResult = await db.from('profiles').select('id,full_name,email,phone,status')
      .eq('tenant_id', tenantId).in('id', profileIds);
    if (profileResult.error) throw profileResult.error;
    profiles = profileResult.data || [];
  }
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const shape = (provider) => {
    const profile = profileById.get(provider.profile_id) || {};
    return {
      id: provider.id,
      providerProfileId: provider.id,
      profileId: provider.profile_id,
      full_name: profile.full_name || null,
      email: profile.email || null,
      phone: profile.phone || null,
      role: provider.provider_role,
      credential_status: provider.credential_status,
      nursys_status: provider.nursys_status,
      scope_tags: provider.scope_tags || [],
      active: provider.active === true,
    };
  };
  const all = [...byId.values()].map(shape);
  const allById = new Map(all.map((row) => [row.id, row]));
  const eligibleIds = new Set((eligibleResult.data || []).map((row) => row.id));
  return {
    allById,
    eligible: all.filter((row) => eligibleIds.has(row.id)).sort((a, b) =>
      String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''))),
  };
}

async function loadSchedule(db, tenantId, queryParams = {}) {
  const now = Date.now();
  const from = isoBoundary(queryParams.from, new Date(now - 31 * 86400000).toISOString(), 'Start date');
  const to = isoBoundary(queryParams.to, new Date(now + 366 * 86400000).toISOString(), 'End date');
  if (Date.parse(to) < Date.parse(from)) throw requestError('End date must follow start date.', 'invalid_schedule_range');
  if (Date.parse(to) - Date.parse(from) > 550 * 86400000) throw requestError('Schedule range is too large.', 'invalid_schedule_range');

  let query = db.from('operational_shifts').select(SHIFT_SELECT).eq('tenant_id', tenantId)
    .gte('starts_at', from).lte('starts_at', to).order('starts_at', { ascending: true }).limit(500);
  const status = String(queryParams.status || '').toLowerCase();
  if (status && SHIFT_STATUSES.includes(status)) query = query.eq('status', status);
  const { data: shifts, error } = await query;
  if (error) throw error;

  const shiftRows = shifts || [];
  const shiftIds = shiftRows.map((row) => row.id);
  const eventIds = [...new Set(shiftRows.map((row) => row.event_container_id).filter(Boolean))];
  let assignments = [];
  if (shiftIds.length) {
    const result = await db.from('operational_shift_assignments').select(ASSIGNMENT_SELECT)
      .eq('tenant_id', tenantId).in('shift_id', shiftIds);
    if (result.error) throw result.error;
    assignments = result.data || [];
  }

  const [{ allById, eligible }, eventOptions, appointmentOptions] = await Promise.all([
    loadProviderProfiles(db, tenantId, assignments),
    db.from('event_containers').select('id,slug,name,starts_at,ends_at,venue')
      .eq('tenant_id', tenantId).order('starts_at', { ascending: false }).limit(250),
    db.from('appointments').select('id,order_number,starts_at,protocol_key,acuity_appointment_id,status')
      .eq('tenant_id', tenantId).gte('starts_at', new Date(now - 86400000).toISOString())
      .not('status', 'in', '("archived","cancelled","canceled")')
      .order('starts_at', { ascending: true }).limit(500),
  ]);
  if (eventOptions.error) throw eventOptions.error;
  if (appointmentOptions.error) throw appointmentOptions.error;

  const events = eventOptions.data || [];
  const eventById = new Map(events.map((row) => [row.id, row]));
  const missingEventIds = eventIds.filter((eventId) => !eventById.has(eventId));
  if (missingEventIds.length) {
    const result = await db.from('event_containers').select('id,slug,name,starts_at,ends_at,venue')
      .eq('tenant_id', tenantId).in('id', missingEventIds);
    if (result.error) throw result.error;
    for (const event of result.data || []) eventById.set(event.id, event);
  }

  const assignmentsByShift = new Map();
  for (const assignment of assignments) {
    const shaped = { ...assignment, provider: allById.get(assignment.provider_profile_id) || null };
    assignmentsByShift.set(assignment.shift_id, [...(assignmentsByShift.get(assignment.shift_id) || []), shaped]);
  }
  return {
    shifts: shiftRows.map((shift) => ({
      ...shift,
      event: eventById.get(shift.event_container_id) || null,
      assignments: assignmentsByShift.get(shift.id) || [],
    })),
    nurses: eligible,
    events: [...eventById.values()],
    appointments: appointmentOptions.data || [],
  };
}

function normalizedRecurrence(body, occurrences) {
  if (occurrences.length === 1) return {};
  const recurrence = body.recurrence && typeof body.recurrence === 'object' ? body.recurrence : {};
  return {
    mode: String(recurrence.mode || 'none').toLowerCase(),
    weekdays: Array.isArray(recurrence.weekdays) ? [...new Set(recurrence.weekdays.map(Number))] : [],
    intervalWeeks: Math.min(12, Math.max(1, Number(recurrence.intervalWeeks) || 1)),
    untilDate: recurrence.untilDate ? String(recurrence.untilDate) : null,
  };
}

async function createSchedule(db, authed, body) {
  const shift = cleanShiftInput(body);
  const occurrences = expandShiftOccurrences(body);
  const providerProfileIds = cleanProviderProfileIds(body.assignedProviderProfileIds || body.assignedNurseIds || []);
  if (providerProfileIds.length > shift.slots_required) {
    throw requestError('Assigned nurses exceed the number of slots.', 'too_many_assignments');
  }
  return callSchedulingRpc(db, 'create_operational_shift_series', {
    p_tenant_id: authed.tenantId,
    p_actor_profile_id: authed.user.id,
    p_shift: { ...shift, recurrence: normalizedRecurrence(body, occurrences) },
    p_occurrences: occurrences,
    p_provider_profile_ids: providerProfileIds,
  });
}

async function updateShift(db, authed, body) {
  const shiftId = requireUuid(body.shiftId, 'Shift id');
  const expectedVersion = requireVersion(body.version);
  const base = cleanShiftInput({ ...body, status: 'open' });
  const occurrence = expandShiftOccurrences({ ...body, recurrence: { mode: 'none' } })[0];
  const { status: _status, ...fields } = base;
  return callSchedulingRpc(db, 'update_operational_shift', {
    p_tenant_id: authed.tenantId,
    p_actor_profile_id: authed.user.id,
    p_shift_id: shiftId,
    p_expected_version: expectedVersion,
    p_patch: { ...fields, starts_at: occurrence.startsAt, ends_at: occurrence.endsAt },
  });
}

async function runAction(db, authed, action, body) {
  const shiftId = requireUuid(body.shiftId, 'Shift id');
  const expectedVersion = requireVersion(body.version);
  const common = {
    p_tenant_id: authed.tenantId,
    p_actor_profile_id: authed.user.id,
    p_shift_id: shiftId,
    p_expected_version: expectedVersion,
  };
  if (action === 'assign') {
    return callSchedulingRpc(db, 'assign_operational_shift', {
      ...common,
      p_provider_profile_id: requireUuid(body.providerProfileId, 'Provider'),
    });
  }
  if (action === 'broadcast') {
    return callSchedulingRpc(db, 'offer_operational_shift', {
      ...common,
      p_provider_profile_ids: cleanProviderProfileIds(body.providerProfileIds || []),
    });
  }
  if (['cancel', 'complete', 'open'].includes(action)) {
    return callSchedulingRpc(db, 'transition_operational_shift', { ...common, p_action: action });
  }
  throw requestError('Unsupported scheduling action.', 'invalid_action');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    if (req.method === 'GET') {
      return res.status(200).json(await loadSchedule(authed.db, authed.tenantId, req.query || {}));
    }
    if (!['POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = parseBody(req);
    const action = String(body.action || (req.method === 'PATCH' ? 'update' : 'create')).toLowerCase();
    const data = action === 'create'
      ? await createSchedule(authed.db, authed, body)
      : action === 'update'
        ? await updateShift(authed.db, authed, body)
        : await runAction(authed.db, authed, action, body);
    return res.status(action === 'create' ? 201 : 200).json({ ok: true, data });
  } catch (caught) {
    const error = isSchedulingMigrationError(caught) ? schedulingRpcError(caught) : caught;
    console.warn('[admin/scheduling] failed', safeLogContext(error, 'scheduling_failed'));
    const publicMessage = error.code === 'scheduling_migration_required' || error.expose
      ? error.message
      : 'Scheduling request failed.';
    return res.status(error.status || 500).json({
      error: publicMessage,
      code: safeErrorCode(error, 'scheduling_failed'),
    });
  }
}
