/**
 * POST /api/auth/welcome-email
 *
 * Idempotent best-effort trigger for the post-signup welcome email. Called by
 * /auth/callback after Supabase exchanges the confirmation code. Returns 200
 * whether the email sends or not — signup must never block on Resend.
 *
 * Dedupe is handled by checking `audit_events` for a prior
 * `welcome_email_sent` row for this user. No schema change required.
 */
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { sendWelcomeEmail } from '../_welcome-email.js';
import { signWelcomeToken, isMagicLinkWelcomeEnabled } from '../_lib/welcome-token.js';

const ACTION_SENT = 'welcome_email_sent';
const ACTION_FAILED = 'welcome_email_failed';
const ENTITY_TYPE = 'profiles';

async function alreadySent(db, userId) {
  if (!db || !userId) return false;
  try {
    const { data } = await db
      .from('audit_events')
      .select('id')
      .eq('action', ACTION_SENT)
      .eq('entity_type', ENTITY_TYPE)
      .eq('entity_id', userId)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    // If we can't check, default to sending — at-most-twice is friendlier than
    // never. Resend's per-recipient throttling will catch true duplicates.
    console.warn('[welcome-email] dedupe check failed', safeLogContext(err, 'welcome_email_dedupe_failed'));
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await getAuthedUser(req);
  if (!authed) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const { db, user, tenantId, role } = authed;
  // Only clients get the welcome email. Staff/admin onboarding happens via
  // the invite-accept flow and has its own messaging.
  if (role !== 'client') {
    return res.status(200).json({ ok: true, skipped: 'non_client_role' });
  }
  const recipient = (user?.email || '').trim();
  if (!recipient) {
    return res.status(200).json({ ok: true, skipped: 'no_recipient' });
  }

  if (await alreadySent(db, user.id)) {
    return res.status(200).json({ ok: true, skipped: 'already_sent' });
  }

  const name =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    '';

  let magicToken;
  if (isMagicLinkWelcomeEnabled()) {
    try {
      magicToken = signWelcomeToken({ userId: user.id });
    } catch (err) {
      // Missing secret in prod → fall back to plain CTA rather than fail the email.
      console.warn('[welcome-email] magic token sign failed; falling back to plain CTA', safeLogContext(err, 'welcome_email_token_sign_failed'));
      magicToken = undefined;
    }
  }

  try {
    const result = await sendWelcomeEmail({ to: recipient, name, magicToken });
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: user.id,
      action: ACTION_SENT,
      entityType: ENTITY_TYPE,
      entityId: user.id,
      phiTouched: false,
      payload: {
        provider: 'resend',
        message_id: result?.id || null,
      },
    });
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.warn('[welcome-email] send failed', safeLogContext(err, 'welcome_email_send_failed'));
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: user.id,
      action: ACTION_FAILED,
      entityType: ENTITY_TYPE,
      entityId: user.id,
      phiTouched: false,
      payload: {
        provider: 'resend',
        code: safeErrorCode(err, 'welcome_email_send_failed'),
      },
    });
    // Best-effort: return 200 so the auth callback never strands.
    return res.status(200).json({ ok: true, sent: false, code: safeErrorCode(err, 'welcome_email_send_failed') });
  }
}
