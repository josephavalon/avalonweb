/**
 * POST /api/admin/clients/[id]/credits
 *
 * Adjust a member's IV credit balance manually. Used by staff/admin to grant
 * a make-good credit (positive units) or revoke an unused credit (negative).
 * Writes the adjustment row to `member_credit_ledger` and emits an
 * `admin_credit_adjust` audit event.
 *
 * Body: { units: integer (non-zero), note: string }
 * Staff and admin may use this endpoint — credit adjustments are part of the
 * day-to-day make-good workflow, not an admin-only mutation.
 */

import { writeAuditEvent } from '../../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../../_lib/safe-error.js';
import { requireStaff } from '../../../_lib/supabase-auth.js';
import { loadProfile } from '../[id].js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'Missing client id.' });

  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db, tenantId, user } = authed;

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const units = Math.trunc(Number(body.units));
  const note = String(body.note || '').trim();

  if (!Number.isFinite(units) || units === 0) {
    return res.status(400).json({ error: 'units must be a non-zero integer.' });
  }
  if (!note) {
    return res.status(400).json({ error: 'A reason / note is required for every credit adjustment.' });
  }

  try {
    const { data: profile, error: readErr } = await loadProfile(db, id);
    if (readErr) throw readErr;
    if (!profile) return res.status(404).json({ error: 'Client not found.' });
    if (tenantId && profile.tenant_id && profile.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    const memberTenant = profile.tenant_id || tenantId || null;
    if (!memberTenant) {
      return res.status(400).json({ error: 'Client is not scoped to a tenant; cannot adjust credits.' });
    }

    const row = {
      tenant_id: memberTenant,
      profile_id: profile.id || null,
      member_email: (profile.email || '').toLowerCase() || null,
      source: 'admin_adjustment',
      units,
      credit_value_cents: 0,
      currency: 'usd',
      description: note,
      external_payload: {
        actorProfileId: user?.id || null,
        actorRole: authed.role,
      },
    };

    const { data: inserted, error: insertErr } = await db.from('member_credit_ledger')
      .insert(row)
      .select('id, units, created_at')
      .maybeSingle();
    if (insertErr) throw insertErr;

    await writeAuditEvent(db, {
      tenantId: memberTenant,
      actorProfileId: user?.id || null,
      action: 'admin_credit_adjust',
      entityType: 'profiles',
      entityId: profile.id,
      phiTouched: false,
      payload: {
        units,
        ledgerId: inserted?.id || null,
        actorRole: authed.role,
        hasNote: Boolean(note),
      },
    });

    return res.status(200).json({ ledgerEntry: inserted });
  } catch (err) {
    console.warn('[admin/clients/[id]/credits] failed', safeLogContext(err, 'admin_client_credit_failed'));
    return res.status(500).json({
      error: 'Could not adjust credits.',
      code: safeErrorCode(err, 'admin_client_credit_failed'),
    });
  }
}
