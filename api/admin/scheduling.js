import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { cleanShiftInput, expandShiftOccurrences, workflowId } from '../_lib/operational-workflows.js';
import { sendEmail } from '../_lib/send-email.js';

const ACTIVE_ASSIGNMENTS = ['claimed', 'assigned', 'completed'];
const SHIFT_STATUSES = ['draft', 'open', 'assigned', 'in_progress', 'completed', 'cancelled'];

async function loadSchedule(db, tenantId, { from, to, status } = {}) {
  let query = db.from('operational_shifts').select('*').eq('tenant_id', tenantId)
    .order('starts_at', { ascending: true }).limit(500);
  if (from) query = query.gte('starts_at', from);
  if (to) query = query.lte('starts_at', to);
  if (status && SHIFT_STATUSES.includes(status)) query = query.eq('status', status);
  const { data: shifts, error } = await query;
  if (error) throw error;

  const shiftIds = (shifts || []).map((row) => row.id);
  const eventIds = [...new Set((shifts || []).map((row) => row.event_container_id).filter(Boolean))];
  let assignments = [];
  let events = [];
  if (shiftIds.length) {
    const result = await db.from('operational_shift_assignments').select('*')
      .eq('tenant_id', tenantId).in('shift_id', shiftIds);
    if (result.error) throw result.error;
    assignments = result.data || [];
  }
  if (eventIds.length) {
    const result = await db.from('event_containers').select('id, slug, name, starts_at, ends_at, venue')
      .eq('tenant_id', tenantId).in('id', eventIds);
    if (result.error) throw result.error;
    events = result.data || [];
  }
  const eventOptions = await db.from('event_containers').select('id, slug, name, starts_at, ends_at, venue')
    .eq('tenant_id', tenantId).order('starts_at', { ascending: false }).limit(250);
  if (!eventOptions.error) {
    const byId = new Map(events.map((row) => [row.id, row]));
    for (const row of eventOptions.data || []) byId.set(row.id, row);
    events = [...byId.values()];
  }
  const appointmentOptions = await db.from('appointments')
    .select('id, order_number, starts_at, protocol_key, acuity_appointment_id, status')
    .eq('tenant_id', tenantId).gte('starts_at', new Date(Date.now() - 86400000).toISOString())
    .not('status', 'in', '("archived","cancelled","canceled")')
    .order('starts_at', { ascending: true }).limit(500);

  const nurseIds = [...new Set(assignments.map((row) => row.nurse_profile_id))];
  let nurses = [];
  if (nurseIds.length) {
    const result = await db.from('profiles').select('id, full_name, email, phone, role, status')
      .eq('tenant_id', tenantId).in('id', nurseIds);
    if (result.error) throw result.error;
    nurses = result.data || [];
  }
  const allNursesResult = await db.from('profiles').select('id, full_name, email, phone, role, status')
    .eq('tenant_id', tenantId).in('role', ['nurse', 'rn', 'np', 'admin']).eq('status', 'active')
    .order('full_name', { ascending: true });
  if (!allNursesResult.error) {
    const byId = new Map(nurses.map((row) => [row.id, row]));
    for (const row of allNursesResult.data || []) byId.set(row.id, row);
    nurses = [...byId.values()];
  }

  const eventById = new Map(events.map((row) => [row.id, row]));
  const nurseById = new Map(nurses.map((row) => [row.id, row]));
  const assignmentsByShift = new Map();
  for (const assignment of assignments) {
    const shaped = { ...assignment, nurse: nurseById.get(assignment.nurse_profile_id) || null };
    assignmentsByShift.set(assignment.shift_id, [...(assignmentsByShift.get(assignment.shift_id) || []), shaped]);
  }
  return {
    shifts: (shifts || []).map((shift) => ({
      ...shift,
      event: eventById.get(shift.event_container_id) || null,
      assignments: assignmentsByShift.get(shift.id) || [],
    })),
    nurses,
    events,
    appointments: appointmentOptions.error ? [] : appointmentOptions.data || [],
  };
}

async function validateNurses(db, tenantId, nurseIds) {
  const ids = [...new Set((nurseIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await db.from('profiles').select('id').eq('tenant_id', tenantId)
    .in('id', ids).in('role', ['nurse', 'rn', 'np', 'admin']).eq('status', 'active');
  if (error) throw error;
  if ((data || []).length !== ids.length) throw Object.assign(new Error('One or more nurses are unavailable.'), { status: 400, code: 'invalid_nurse' });
  return ids;
}

async function validateShiftLinks(db, tenantId, body) {
  if (body.eventContainerId) {
    const event = await db.from('event_containers').select('id').eq('tenant_id', tenantId).eq('id', body.eventContainerId).maybeSingle();
    if (event.error) throw event.error;
    if (!event.data) throw Object.assign(new Error('The linked event is not available in this workspace.'), { status: 400, code: 'invalid_shift_event' });
  }
  if (body.appointmentId) {
    const appointment = await db.from('appointments').select('id').eq('tenant_id', tenantId).eq('id', body.appointmentId).maybeSingle();
    if (appointment.error) throw appointment.error;
    if (!appointment.data) throw Object.assign(new Error('The linked appointment is not available in this workspace.'), { status: 400, code: 'invalid_shift_appointment' });
  }
}

async function createSchedule(db, authed, body) {
  await validateShiftLinks(db, authed.tenantId, body);
  const base = cleanShiftInput(body);
  const occurrences = expandShiftOccurrences(body);
  const seriesId = occurrences.length > 1 ? workflowId() : null;
  const nurseIds = await validateNurses(db, authed.tenantId, body.assignedNurseIds);
  if (nurseIds.length > base.slots_required) {
    throw Object.assign(new Error('Assigned nurses exceed the number of slots.'), { status: 400, code: 'too_many_assignments' });
  }
  const recurrence = body.recurrence && typeof body.recurrence === 'object' ? body.recurrence : {};
  const rows = occurrences.map((occurrence) => ({
    tenant_id: authed.tenantId,
    series_id: seriesId,
    occurrence_key: seriesId ? occurrence.occurrenceDate : null,
    ...base,
    starts_at: occurrence.startsAt,
    ends_at: occurrence.endsAt,
    recurrence: seriesId ? recurrence : {},
    status: base.status === 'open' && nurseIds.length >= base.slots_required ? 'assigned' : base.status,
    created_by: authed.user.id,
  }));
  const { data: shifts, error } = await db.from('operational_shifts').insert(rows).select('*');
  if (error) throw error;
  if (nurseIds.length) {
    const assignmentRows = (shifts || []).flatMap((shift) => nurseIds.map((nurseId) => ({
      tenant_id: authed.tenantId,
      shift_id: shift.id,
      nurse_profile_id: nurseId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      created_by: authed.user.id,
    })));
    const result = await db.from('operational_shift_assignments').insert(assignmentRows);
    if (result.error) throw result.error;
  }
  return shifts || [];
}

async function updateShift(db, authed, body) {
  const shiftId = String(body.shiftId || '');
  if (!shiftId) throw Object.assign(new Error('Shift id is required.'), { status: 400, code: 'shift_id_required' });
  const current = await db.from('operational_shifts').select('*')
    .eq('tenant_id', authed.tenantId).eq('id', shiftId).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw Object.assign(new Error('Shift not found.'), { status: 404, code: 'shift_not_found' });
  if (body.version != null && Number(body.version) !== Number(current.data.version)) {
    throw Object.assign(new Error('This shift changed while you were editing it. Refresh and try again.'), { status: 409, code: 'shift_version_conflict' });
  }
  await validateShiftLinks(db, authed.tenantId, body);
  const patch = {};
  const keys = {
    title: 'title', locationName: 'location_name', locationAddress: 'location_address',
    serviceArea: 'service_area', roleRequired: 'role_required', slotsRequired: 'slots_required',
    instructions: 'instructions', eventContainerId: 'event_container_id', appointmentId: 'appointment_id',
  };
  for (const [input, column] of Object.entries(keys)) {
    if (Object.hasOwn(body, input)) patch[column] = body[input] === '' ? null : body[input];
  }
  if (body.status && SHIFT_STATUSES.includes(body.status)) patch.status = body.status;
  if (body.startDate || body.startTime || body.endTime) {
    const start = new Date(current.data.starts_at);
    const end = new Date(current.data.ends_at);
    const occurrence = expandShiftOccurrences({
      startDate: body.startDate || start.toISOString().slice(0, 10),
      startTime: body.startTime || start.toISOString().slice(11, 16),
      endTime: body.endTime || end.toISOString().slice(11, 16),
      timezone: body.timezone || current.data.timezone,
      recurrence: { mode: 'none' },
    })[0];
    patch.starts_at = occurrence.startsAt;
    patch.ends_at = occurrence.endsAt;
    patch.timezone = body.timezone || current.data.timezone;
  }
  patch.version = Number(current.data.version || 0) + 1;
  const { data, error } = await db.from('operational_shifts').update(patch)
    .eq('tenant_id', authed.tenantId).eq('id', shiftId).eq('version', current.data.version).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('This shift changed while you were editing it. Refresh and try again.'), { status: 409, code: 'shift_version_conflict' });
  return data;
}

async function broadcastShift(db, authed, body) {
  const shiftId = String(body.shiftId || '');
  const shiftResult = await db.from('operational_shifts').select('id, title, status')
    .eq('tenant_id', authed.tenantId).eq('id', shiftId).maybeSingle();
  if (shiftResult.error) throw shiftResult.error;
  if (!shiftResult.data || !['draft', 'open'].includes(shiftResult.data.status)) {
    throw Object.assign(new Error('Only a draft or open shift can be broadcast.'), { status: 409, code: 'shift_not_broadcastable' });
  }
  let roster = db.from('profiles').select('id, email').eq('tenant_id', authed.tenantId)
    .in('role', ['nurse', 'rn', 'np']).eq('status', 'active');
  const requested = [...new Set((body.nurseProfileIds || []).filter(Boolean))];
  if (requested.length) roster = roster.in('id', requested);
  const rosterResult = await roster;
  if (rosterResult.error) throw rosterResult.error;
  if (!(rosterResult.data || []).length) throw Object.assign(new Error('No active clinicians are available to notify.'), { status: 400, code: 'empty_broadcast_roster' });
  const existing = await db.from('operational_shift_assignments').select('nurse_profile_id, status')
    .eq('tenant_id', authed.tenantId).eq('shift_id', shiftId);
  if (existing.error) throw existing.error;
  const locked = new Set((existing.data || []).filter((row) => ['claimed', 'assigned', 'completed'].includes(row.status)).map((row) => row.nurse_profile_id));
  const recipients = rosterResult.data.filter((profile) => !locked.has(profile.id));
  const now = new Date().toISOString();
  const rows = recipients.map((profile) => ({
    tenant_id: authed.tenantId, shift_id: shiftId, nurse_profile_id: profile.id,
    status: 'offered', offered_at: now, created_by: authed.user.id,
  }));
  if (rows.length) {
    const offers = await db.from('operational_shift_assignments').upsert(rows, { onConflict: 'shift_id,nurse_profile_id' });
    if (offers.error) throw offers.error;
  }
  await db.from('operational_shifts').update({ status: 'open' })
    .eq('tenant_id', authed.tenantId).eq('id', shiftId).in('status', ['draft', 'open']);
  const deliveries = await Promise.all(recipients.map((profile) => sendEmail({
    to: profile.email,
    subject: 'Avalon coverage shift available',
    text: 'A new Avalon coverage shift is available. Sign in to review the operational details and claim it.',
  })));
  return { shiftId, offered: rows.length, emailed: deliveries.filter((item) => item.ok).length, deliveryFailures: deliveries.filter((item) => !item.ok).length };
}

async function assignNurse(db, authed, body) {
  const shiftId = String(body.shiftId || '');
  const [nurseId] = await validateNurses(db, authed.tenantId, [body.nurseProfileId]);
  if (!shiftId || !nurseId) throw Object.assign(new Error('Shift and nurse are required.'), { status: 400, code: 'assignment_required' });
  const shiftResult = await db.from('operational_shifts').select('id, slots_required, status')
    .eq('tenant_id', authed.tenantId).eq('id', shiftId).maybeSingle();
  if (shiftResult.error || !shiftResult.data) throw Object.assign(new Error('Shift not found.'), { status: 404, code: 'shift_not_found' });
  if (['completed', 'cancelled'].includes(shiftResult.data.status)) throw Object.assign(new Error('Closed shifts cannot be assigned.'), { status: 409, code: 'shift_closed' });
  const now = new Date().toISOString();
  const { error } = await db.from('operational_shift_assignments').upsert({
    tenant_id: authed.tenantId, shift_id: shiftId, nurse_profile_id: nurseId,
    status: 'assigned', assigned_at: now, created_by: authed.user.id,
  }, { onConflict: 'shift_id,nurse_profile_id' });
  if (error) throw error;
  const active = await db.from('operational_shift_assignments').select('id', { count: 'exact', head: true })
    .eq('tenant_id', authed.tenantId).eq('shift_id', shiftId).in('status', ACTIVE_ASSIGNMENTS);
  if (active.error) throw active.error;
  await db.from('operational_shifts').update({
    status: Number(active.count || 0) >= shiftResult.data.slots_required ? 'assigned' : 'open',
  }).eq('tenant_id', authed.tenantId).eq('id', shiftId);
  return { shiftId, nurseProfileId: nurseId };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireStaff(req, res);
  if (!authed) return;
  try {
    if (req.method === 'GET') {
      const data = await loadSchedule(authed.db, authed.tenantId, req.query || {});
      return res.status(200).json(data);
    }
    if (!['POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const action = String(body.action || (req.method === 'PATCH' ? 'update' : 'create'));
    let result;
    if (action === 'create') result = await createSchedule(authed.db, authed, body);
    else if (action === 'update') result = await updateShift(authed.db, authed, body);
    else if (action === 'assign') result = await assignNurse(authed.db, authed, body);
    else if (action === 'broadcast') result = await broadcastShift(authed.db, authed, body);
    else if (['cancel', 'complete', 'open'].includes(action)) {
      const nextStatus = action === 'cancel' ? 'cancelled' : action === 'complete' ? 'completed' : 'open';
      const { data, error } = await authed.db.from('operational_shifts').update({ status: nextStatus })
        .eq('tenant_id', authed.tenantId).eq('id', body.shiftId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error('Shift not found.'), { status: 404, code: 'shift_not_found' });
      if (nextStatus === 'cancelled' || nextStatus === 'completed') {
        await authed.db.from('operational_shift_assignments').update({
          status: nextStatus, ...(nextStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        }).eq('tenant_id', authed.tenantId).eq('shift_id', body.shiftId).in('status', ACTIVE_ASSIGNMENTS);
      }
      result = data;
    } else throw Object.assign(new Error('Unsupported scheduling action.'), { status: 400, code: 'invalid_action' });

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id,
      action: `operational_shift_${action}`, entityType: 'operational_shifts',
      entityId: Array.isArray(result) ? result[0]?.id : result?.id || result?.shiftId || body.shiftId || null,
      phiTouched: false, payload: { action, count: Array.isArray(result) ? result.length : 1 },
    });
    return res.status(action === 'create' ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    console.warn('[admin/scheduling] failed', safeLogContext(error, 'scheduling_failed'));
    return res.status(error.status || 500).json({ error: error.message || 'Scheduling request failed.', code: safeErrorCode(error, 'scheduling_failed') });
  }
}
