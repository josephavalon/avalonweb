import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

async function hydrate(db, tenantId, shifts, ownAssignments) {
  const eventIds = [...new Set(shifts.map((row) => row.event_container_id).filter(Boolean))];
  let events = [];
  if (eventIds.length) {
    const result = await db.from('event_containers').select('id, slug, name, starts_at, ends_at, venue')
      .eq('tenant_id', tenantId).in('id', eventIds);
    if (!result.error) events = result.data || [];
  }
  const eventById = new Map(events.map((row) => [row.id, row]));
  const assignmentByShift = new Map(ownAssignments.map((row) => [row.shift_id, row]));
  return shifts.map((shift) => ({ ...shift, event: eventById.get(shift.event_container_id) || null, assignment: assignmentByShift.get(shift.id) || null }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireRole(req, res, ['nurse', 'rn', 'np', 'admin']);
  if (!authed) return;
  try {
    if (req.method === 'GET') {
      const now = new Date();
      const from = req.query?.from || new Date(now.getTime() - 90 * 86400000).toISOString();
      const to = req.query?.to || new Date(now.getTime() + 180 * 86400000).toISOString();
      const assignmentResult = await authed.db.from('operational_shift_assignments').select('*')
        .eq('tenant_id', authed.tenantId).eq('nurse_profile_id', authed.user.id);
      if (assignmentResult.error) throw assignmentResult.error;
      const assignments = assignmentResult.data || [];
      const assignedIds = assignments.map((row) => row.shift_id);
      let ownShifts = [];
      if (assignedIds.length) {
        const result = await authed.db.from('operational_shifts').select('*').eq('tenant_id', authed.tenantId)
          .in('id', assignedIds).gte('starts_at', from).lte('starts_at', to);
        if (result.error) throw result.error;
        ownShifts = result.data || [];
      }
      const openResult = await authed.db.from('operational_shifts').select('*').eq('tenant_id', authed.tenantId)
        .eq('status', 'open').gte('starts_at', now.toISOString()).lte('starts_at', to).order('starts_at', { ascending: true });
      if (openResult.error) throw openResult.error;
      const byId = new Map([...ownShifts, ...(openResult.data || [])].map((row) => [row.id, row]));
      const shifts = await hydrate(authed.db, authed.tenantId, [...byId.values()].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)), assignments);
      return res.status(200).json({ shifts });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const action = String(body.action || '');
    const shiftId = String(body.shiftId || '');
    if (!shiftId) return res.status(400).json({ error: 'Shift id is required.' });
    if (action === 'claim') {
      const { data, error } = await authed.db.rpc('claim_operational_shift', {
        p_tenant_id: authed.tenantId, p_shift_id: shiftId, p_nurse_profile_id: authed.user.id,
      });
      if (error) throw Object.assign(new Error(error.message), { status: /full|not open/i.test(error.message) ? 409 : 500, code: error.code });
      return res.status(200).json({ ok: true, assignment: data });
    }
    if (action === 'complete') {
      const now = new Date().toISOString();
      const { data, error } = await authed.db.from('operational_shift_assignments')
        .update({ status: 'completed', completed_at: now })
        .eq('tenant_id', authed.tenantId).eq('shift_id', shiftId).eq('nurse_profile_id', authed.user.id)
        .in('status', ['claimed', 'assigned']).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ error: 'Only your assigned shift can be completed.' });
      const remaining = await authed.db.from('operational_shift_assignments').select('id', { count: 'exact', head: true })
        .eq('tenant_id', authed.tenantId).eq('shift_id', shiftId).in('status', ['claimed', 'assigned']);
      if (!remaining.error && Number(remaining.count || 0) === 0) {
        await authed.db.from('operational_shifts').update({ status: 'completed' })
          .eq('tenant_id', authed.tenantId).eq('id', shiftId);
      }
      return res.status(200).json({ ok: true, assignment: data });
    }
    return res.status(400).json({ error: 'Unsupported shift action.' });
  } catch (error) {
    console.warn('[me/shifts] failed', safeLogContext(error, 'me_shifts_failed'));
    return res.status(error.status || 500).json({ error: error.message || 'Could not load shifts.', code: safeErrorCode(error, 'me_shifts_failed') });
  }
}
