/**
 * POST /api/admin/team/revoke
 *
 * Admin-only. Revokes a pending invite so its token/code can no longer be used.
 * Body: { inviteId: string }
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;
  const inviteId = String(req.body?.inviteId || '').trim();
  if (!inviteId) return res.status(400).json({ error: 'inviteId is required.' });

  try {
    let q = db.from('invitations').update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', inviteId).eq('status', 'pending');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q.select('id, email').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'No pending invite found.' });

    await writeAuditEvent(db, {
      tenantId, actorProfileId: authed.user?.id || null,
      action: 'team_invite_revoked', entityType: 'invitation', entityId: data.id,
      payload: { email: data.email },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Could not revoke the invite.', code: safeErrorCode(err, 'invite_revoke_failed') });
  }
}
