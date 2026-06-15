/**
 * POST /api/admin/team/invite
 *
 * Admin-only. Creates a pending invitation and delivers it by email (magic
 * link) and/or SMS (6-digit code). One record powers both: we store only the
 * SHA-256 hashes of the token and code.
 *
 * Body: {
 *   email: string,            // required
 *   role: 'staff' | 'admin',  // required
 *   phone?: string,           // required when delivery includes 'sms'
 *   fullName?: string,
 *   delivery?: 'email' | 'sms' | 'both'  // default 'email'
 * }
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { checkRateLimit, clientIp } from '../../_lib/rate-limit.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { sendInviteEmail } from '../../_lib/invite-email.js';
import { sendSms } from '../../_lib/send-sms.js';
import {
  generateToken, generateCode, hashToken, hashCode, isValidTier,
} from '../../_lib/invite-token.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://avalonvitality.co').replace(/\/$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  const limit = await checkRateLimit({ key: `team-invite:${clientIp(req)}`, windowMs: 60 * 1000, max: 20 });
  if (!limit.ok) return res.status(429).json({ error: 'Too many invites. Try again shortly.' });

  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const role = String(body.role || '').trim();
  const phone = String(body.phone || '').trim();
  const fullName = String(body.fullName || '').trim() || null;
  const delivery = ['email', 'sms', 'both'].includes(body.delivery) ? body.delivery : 'email';

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!isValidTier(role)) return res.status(400).json({ error: "Role must be 'staff' or 'admin'." });
  if ((delivery === 'sms' || delivery === 'both') && !phone) {
    return res.status(400).json({ error: 'A phone number is required for SMS delivery.' });
  }

  const { db, tenantId } = authed;

  // Block re-inviting someone who already has an active team account.
  try {
    let existing = db.from('profiles').select('id, role, status').eq('email', email);
    if (tenantId) existing = existing.eq('tenant_id', tenantId);
    const { data: profile } = await existing.maybeSingle();
    if (profile && profile.status === 'active' && (profile.role === 'admin' || profile.role === 'staff')) {
      return res.status(409).json({ error: 'That person already has admin access.', code: 'already_member' });
    }
  } catch { /* lookup failure is non-fatal; continue to invite */ }

  const token = generateToken();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  let inviteId = null;
  try {
    // Supersede any existing pending invite for the same (tenant,email,role) —
    // the unique constraint is on (tenant_id,email,invited_role,status).
    let revoke = db.from('invitations').update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('email', email).eq('invited_role', role).eq('status', 'pending');
    if (tenantId) revoke = revoke.eq('tenant_id', tenantId);
    await revoke;

    const { data: inserted, error: insErr } = await db.from('invitations').insert({
      tenant_id: tenantId,
      email,
      phone: phone || null,
      full_name: fullName,
      invited_role: role,
      invited_by: authed.user?.id || null,
      status: 'pending',
      token_hash: hashToken(token),
      code_hash: hashCode(email, code),
      expires_at: expiresAt,
    }).select('id').single();
    if (insErr) throw insErr;
    inviteId = inserted.id;
  } catch (err) {
    return res.status(500).json({ error: 'Could not create the invite.', code: safeErrorCode(err, 'invite_insert_failed') });
  }

  const inviteUrl = `${siteUrl()}/invite/accept?token=${encodeURIComponent(token)}`;
  const delivered = { email: false, sms: false };
  const errors = [];

  if (delivery === 'email' || delivery === 'both') {
    try {
      await sendInviteEmail({ to: email, inviteUrl, code, role, inviterName: authed.email });
      delivered.email = true;
    } catch (err) { errors.push(`email:${err?.reason || err?.code || 'failed'}`); }
  }
  if (delivery === 'sms' || delivery === 'both') {
    const smsRes = await sendSms({
      to: phone,
      body: `You're invited to the Avalon Vitality admin console. Code: ${code}. Open ${siteUrl()}/invite/accept to finish.`,
    });
    if (smsRes.ok) delivered.sms = true; else errors.push(`sms:${smsRes.code}`);
  }

  await writeAuditEvent(db, {
    tenantId,
    actorProfileId: authed.user?.id || null,
    action: 'team_invite_created',
    entityType: 'invitation',
    entityId: inviteId,
    payload: { email, role, delivery, delivered, errors },
  });

  // The invite exists even if a channel failed; surface partial failure.
  const anyDelivered = delivered.email || delivered.sms;
  return res.status(anyDelivered ? 200 : 502).json({
    ok: anyDelivered,
    inviteId,
    delivered,
    ...(errors.length ? { warnings: errors } : {}),
  });
}
