/**
 * GET/POST /api/admin/gfe/settings
 *
 * Read or update the per-tenant GFE policy: which booking categories (mobile /
 * plan / events) require a GFE, plus the Qualiphy exam id(s) and clinic id.
 * Toggle ON → Qualiphy auto-conducts the GFE; toggle OFF → an Avalon NP does it
 * in Acuity (no app involvement). Admin only. Audited.
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

const DEFAULTS = {
  require_mobile: false,
  require_plan: false,
  require_events: false,
  qualiphy_exam_ids: [4106],
  qualiphy_clinic_id: 4389,
};

function shape(row) {
  return {
    mobile: !!(row?.require_mobile),
    plan: !!(row?.require_plan),
    events: !!(row?.require_events),
    examIds: Array.isArray(row?.qualiphy_exam_ids) ? row.qualiphy_exam_ids : DEFAULTS.qualiphy_exam_ids,
    clinicId: row?.qualiphy_clinic_id ?? DEFAULTS.qualiphy_clinic_id,
  };
}

export default async function handler(req, res) {
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  const { db, tenantId } = authed;
  if (!tenantId) return res.status(409).json({ error: 'No tenant on this account.', code: 'no_tenant' });

  if (req.method === 'GET') {
    const { data, error } = await db.from('gfe_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
    if (error) {
      console.warn('[gfe/settings] read failed', safeLogContext(error, 'gfe_settings_read_failed'));
      return res.status(500).json({ error: 'Could not load GFE settings.', code: safeErrorCode(error, 'gfe_settings_read_failed') });
    }
    return res.status(200).json({ settings: shape(data || DEFAULTS) });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const patch = {
      tenant_id: tenantId,
      require_mobile: b.mobile === undefined ? undefined : !!b.mobile,
      require_plan: b.plan === undefined ? undefined : !!b.plan,
      require_events: b.events === undefined ? undefined : !!b.events,
      qualiphy_exam_ids: Array.isArray(b.examIds) ? b.examIds.map(Number).filter(Boolean) : undefined,
      qualiphy_clinic_id: b.clinicId === undefined ? undefined : Number(b.clinicId) || null,
      updated_at: new Date().toISOString(),
    };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    // Upsert keyed by tenant_id (PK).
    const { data, error } = await db.from('gfe_settings').upsert(patch, { onConflict: 'tenant_id' }).select('*').maybeSingle();
    if (error) {
      console.warn('[gfe/settings] write failed', safeLogContext(error, 'gfe_settings_write_failed'));
      return res.status(500).json({ error: 'Could not save GFE settings.', code: safeErrorCode(error, 'gfe_settings_write_failed') });
    }
    await writeAuditEvent(db, {
      tenantId, actorProfileId: authed.user?.id || null,
      action: 'gfe_settings_update', entityType: 'gfe_settings',
      payload: { mobile: patch.require_mobile, plan: patch.require_plan, events: patch.require_events },
    });
    return res.status(200).json({ ok: true, settings: shape(data || patch) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
