import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { requireStaff } from '../../_lib/supabase-auth.js';

const LOCKED_STATUSES = new Set(['in_treatment', 'started', 'completed']);

function rosterEntry(row) {
  return {
    id: row.id,
    name: row.profiles?.full_name || row.people?.display_name || `${String(row.provider_role || 'RN').toUpperCase()} provider`,
    role: row.provider_role,
    credentialStatus: row.credential_status,
    nursysStatus: row.nursys_status,
    scopeTags: row.scope_tags || [],
    active: row.active,
  };
}

async function validateProvider(db, tenantId, providerId, appointment) {
  if (!providerId) return null;
  const { data: provider, error } = await db.from('provider_profiles')
    .select('id, tenant_id, provider_role, credential_status, nursys_status, scope_tags, active, profiles:profile_id(full_name), people:person_id(display_name)')
    .eq('id', providerId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (!provider?.active) throw Object.assign(new Error('Selected provider is inactive.'), { status: 422, code: 'provider_inactive' });
  if (provider.credential_status !== 'clear' || !['clear', 'placeholder'].includes(provider.nursys_status)) throw Object.assign(new Error('Selected provider is not credential-cleared.'), { status: 422, code: 'provider_credentials' });
  const scope = (provider.scope_tags || []).map((tag) => String(tag).toLowerCase());
  if (scope.length && appointment.protocol_key && !scope.includes(String(appointment.protocol_key).toLowerCase())) throw Object.assign(new Error('Selected provider is outside this protocol scope.'), { status: 422, code: 'provider_scope' });
  const start = new Date(appointment.starts_at);
  const duration = Number(appointment.external_payload?.appointment?.durationMinutes || appointment.external_payload?.durationMinutes || 60);
  const windowStart = new Date(start.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString();
  const { data: nearby, error: nearbyError } = await db.from('appointments')
    .select('id, starts_at, external_payload')
    .eq('tenant_id', tenantId).eq('provider_profile_id', provider.id)
    .neq('id', appointment.id).neq('status', 'cancelled')
    .gte('starts_at', windowStart).lte('starts_at', windowEnd);
  if (nearbyError) throw nearbyError;
  const end = start.getTime() + duration * 60000;
  const conflict = (nearby || []).some((row) => {
    const otherStart = new Date(row.starts_at).getTime();
    const otherDuration = Number(row.external_payload?.appointment?.durationMinutes || row.external_payload?.durationMinutes || 60);
    return start.getTime() < otherStart + otherDuration * 60000 && end > otherStart;
  });
  if (conflict) throw Object.assign(new Error('Selected provider has an appointment conflict.'), { status: 409, code: 'appointment_conflict' });
  return provider;
}

export default async function handler(req, res) {
  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db, tenantId } = authed;
  try {
    if (req.method === 'GET') {
      const { data, error } = await db.from('provider_profiles')
        .select('id, tenant_id, provider_role, credential_status, nursys_status, scope_tags, active, profiles:profile_id(full_name), people:person_id(display_name)')
        .eq('tenant_id', tenantId).eq('active', true).order('provider_role');
      if (error) throw error;
      return res.status(200).json({ providers: (data || []).map(rosterEntry) });
    }
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : [req.body || {}];
    if (!changes.length || changes.length > 100) return res.status(422).json({ error: 'Provide between 1 and 100 assignment changes.' });
    const results = [];
    for (const change of changes) {
      const appointmentId = String(change.appointmentId || '');
      const { data: appointment, error } = await db.from('appointments')
        .select('id, tenant_id, provider_profile_id, protocol_key, starts_at, status, updated_at, external_payload')
        .eq('id', appointmentId).eq('tenant_id', tenantId).maybeSingle();
      if (error) throw error;
      if (!appointment) throw Object.assign(new Error('Appointment not found.'), { status: 404, code: 'appointment_missing' });
      if (change.expectedUpdatedAt && appointment.updated_at !== change.expectedUpdatedAt) throw Object.assign(new Error('This booking changed. Refresh before assigning it.'), { status: 409, code: 'assignment_revision_conflict' });
      const forced = Boolean(change.force);
      if (LOCKED_STATUSES.has(String(appointment.status).toLowerCase()) && (!forced || !String(change.overrideReason || '').trim())) throw Object.assign(new Error('Treatment has started. A forced override with a reason is required.'), { status: 409, code: 'treatment_assignment_locked' });
      const providerId = change.providerProfileId || null;
      await validateProvider(db, tenantId, providerId, appointment);
      const { data: updated, error: updateError } = await db.from('appointments')
        .update({ provider_profile_id: providerId })
        .eq('id', appointment.id).eq('updated_at', appointment.updated_at)
        .select('id, provider_profile_id, updated_at').maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw Object.assign(new Error('This booking changed. Refresh before assigning it.'), { status: 409, code: 'assignment_revision_conflict' });
      const action = !providerId ? 'appointment_unassigned' : appointment.provider_profile_id ? 'appointment_reassigned' : 'appointment_assigned';
      await writeAuditEvent(db, {
        tenantId, actorProfileId: authed.user.id, action: forced ? `${action}_forced` : action, entityType: 'appointment', entityId: appointment.id, phiTouched: true,
        payload: { previousProviderProfileId: appointment.provider_profile_id, providerProfileId: providerId, forced, overrideReason: forced ? String(change.overrideReason).trim() : null },
      });
      results.push(updated);
    }
    return res.status(200).json({ assignments: results });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Could not change assignment.', code: error.code || safeErrorCode(error, 'assignment_failed') });
  }
}
