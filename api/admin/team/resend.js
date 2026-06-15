/**
 * POST /api/admin/team/resend
 *
 * Admin-only. Regenerates the token + code for a pending invite and resends it.
 * Body: { inviteId: string, delivery?: 'email' | 'sms' | 'both' }
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { checkRateLimit, clientIp } from '../../_lib/rate-limit.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { sendInviteEmail } from '../../_lib/invite-email.js';
import { sendSms } from '../../_lib/send-sms.js';
import { generateToken, generateCode, hashToken, hashCode } from '../../_lib/invite-token.js';

function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://avalonvitality.co').replace(/\/$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  // Two-layer throttle: cap an admin's total resend burst, then a per-invite
  // bucket so a compromised admin can't email/SMS-storm the same address.
  const actorLimit = await checkRateLimit({
    key: `team-resend-actor:${authed.user?.id || clientIp(req)}`,
    windowMs: 60 * 1000,
    max: 5,
  });
  if (!actorLimit.ok) return res.status(429).json({ error: 'Too many resend attempts. Try again shortly.' });

  const { db, tenantId } = authed;
  const inviteId = String(req.body?.inviteId || '').trim();
  const delivery = ['email', 'sms', 'both'].includes(req.body?.delivery) ? req.body.delivery : 'email';
  if (!inviteId) return res.status(400).json({ error: 'inviteId is required.' });

  const inviteLimit = await checkRateLimit({
    key: `team-resend-invite:${inviteId}`,
    windowMs: 60 * 1000,
    max: 1,
  });
  if (!inviteLimit.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((inviteLimit.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Wait a moment before resending this invite again.', code: 'rate_limited' });
  }

  let invite;
  try {
    let q = db.from('invitations')
      .select('id, email, phone, invited_role, status, tenant_id')
      .eq('id', inviteId).eq('status', 'pending');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    invite = data;
  } catch (err) {
    return res.status(500).json({ error: 'Could not load the invite.', code: safeErrorCode(err, 'invite_lookup_failed') });
  }
  if (!invite) return res.status(404).json({ error: 'No pending invite found.' });

  const token = generateToken();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { error } = await db.from('invitations').update({
      token_hash: hashToken(token),
      code_hash: hashCode(invite.email, code),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('id', invite.id);
    if (error) throw error;
  } catch (err) {
    return res.status(500).json({ error: 'Could not refresh the invite.', code: safeErrorCode(err, 'invite_refresh_failed') });
  }

  const inviteUrl = `${siteUrl()}/invite/accept?token=${encodeURIComponent(token)}`;
  const delivered = { email: false, sms: false };
  const errors = [];
  if (delivery === 'email' || delivery === 'both') {
    try { await sendInviteEmail({ to: invite.email, inviteUrl, code, role: invite.invited_role, inviterName: authed.email }); delivered.email = true; }
    catch (err) { errors.push(`email:${err?.reason || err?.code || 'failed'}`); }
  }
  if (delivery === 'sms' || delivery === 'both') {
    if (!invite.phone) { errors.push('sms:no_phone'); }
    else {
      const smsRes = await sendSms({ to: invite.phone, body: `Avalon Vitality admin invite code: ${code}. Open ${siteUrl()}/invite/accept to finish.` });
      if (smsRes.ok) delivered.sms = true; else errors.push(`sms:${smsRes.code}`);
    }
  }

  await writeAuditEvent(db, {
    tenantId, actorProfileId: authed.user?.id || null,
    action: 'team_invite_resent', entityType: 'invitation', entityId: invite.id,
    payload: { email: invite.email, delivery, delivered, errors },
  });

  const anyDelivered = delivered.email || delivered.sms;
  return res.status(anyDelivered ? 200 : 502).json({ ok: anyDelivered, delivered, ...(errors.length ? { warnings: errors } : {}) });
}
