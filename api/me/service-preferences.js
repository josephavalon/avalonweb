import { requireRole } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeLogContext } from '../_lib/safe-error.js';
import {
  NURSE_ROLES,
  loadWorkPreferences,
  parseJsonBody,
  publicProvider,
  requirePositiveVersion,
  resolveNurseProvider,
  sanitizePreferenceSection,
  savePreferenceSection,
  sendNurseWorkflowError,
} from '../_lib/nurse-workflow.js';

const SECTION = 'service_preferences';

function servicePreferenceView(provider, stored = {}) {
  const available = Array.isArray(provider.scope_tags) ? provider.scope_tags.filter(Boolean) : [];
  const approved = new Set(available.map((value) => String(value).toLowerCase()));
  return {
    ...stored,
    service_codes: Array.isArray(stored.service_codes)
      ? stored.service_codes.filter((value) => approved.has(String(value).toLowerCase()))
      : [],
    available_service_codes: available,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    const provider = await resolveNurseProvider(authed);
    if (req.method === 'GET') {
      const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
      return res.status(200).json({ provider: publicProvider(provider), service_preferences: servicePreferenceView(provider, preferences?.service_preferences), version: preferences?.version || null, updated_at: preferences?.updated_at || null });
    }
    if (req.method !== 'PUT') {
      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = parseJsonBody(req);
    const value = sanitizePreferenceSection(SECTION, body.service_preferences);
    const approvedCodes = new Set((provider.scope_tags || []).map((code) => String(code).toLowerCase()));
    value.service_codes = value.service_codes.filter((code) => approvedCodes.has(String(code).toLowerCase()));
    const saved = await savePreferenceSection(authed.db, {
      tenantId: authed.tenantId,
      providerProfileId: provider.id,
      section: SECTION,
      value,
      expectedVersion: body.version == null ? null : requirePositiveVersion(body.version),
    });
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: 'nurse_service_preferences_updated',
      entityType: 'provider_work_preferences',
      entityId: saved.id,
      payload: { provider_profile_id: provider.id, version: saved.version },
    });
    return res.status(200).json({ ok: true, provider: publicProvider(provider), service_preferences: servicePreferenceView(provider, saved.service_preferences), version: saved.version, updated_at: saved.updated_at });
  } catch (error) {
    console.warn('[me/service-preferences] failed', safeLogContext(error, 'nurse_service_preferences_failed'));
    return sendNurseWorkflowError(res, error, 'Could not load or save nurse service preferences.');
  }
}
