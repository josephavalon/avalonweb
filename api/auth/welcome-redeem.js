/**
 * GET /api/auth/welcome-redeem?token=<welcomeToken>
 *
 * Welcome magic-link landing. Verifies the HMAC-signed welcome token, then
 * uses Supabase admin to generate a one-shot magic-link for that user and
 * 302s the browser to it — Supabase's link handler does the session
 * exchange and lands the user at /auth/callback which routes them to
 * /members/dashboard.
 *
 * Gated by MAGIC_LINK_WELCOME_ENABLED. When the flag is off (default), this
 * endpoint returns 404 — the welcome email still ships, just with the plain
 * password-style CTA produced by T4.
 *
 * Hard rules:
 *   - Only client-tier users can redeem. If the user's profile role is not
 *     `client` we refuse — staff/admin must sign in through /admin/login.
 *     This is the documented MFA-bypass mitigation from CP-2: the link can
 *     never land an elevated session.
 *   - Redirect target is hard-coded server-side. No open-redirect via
 *     query params.
 *   - Always 302 (or render an error page); never echo the token back.
 */
import { getServiceClient } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { verifyWelcomeToken, isMagicLinkWelcomeEnabled } from '../_lib/welcome-token.js';

const ENTITY_TYPE = 'profiles';
const ACTION_REDEEMED = 'welcome_link_redeemed';
const ACTION_REFUSED = 'welcome_link_refused';

function failurePageHtml(reason) {
  const messages = {
    welcome_link_token_expired: 'This link has expired. Sign in with your email and password to continue.',
    welcome_link_token_signature_invalid: 'This link is no longer valid. Sign in to continue.',
    welcome_link_token_malformed: 'That link does not look right. Sign in to continue.',
    welcome_link_token_missing: 'No welcome link was provided.',
    welcome_link_disabled: 'Welcome links are not enabled here.',
    welcome_link_non_client: 'Your account uses a different sign-in path. Open the admin console to continue.',
    welcome_link_supabase_failed: 'We could not finish signing you in. Try again from the email link, or sign in with your password.',
    default: 'We could not finish signing you in. Try again or sign in with your password.',
  };
  const copy = messages[reason] || messages.default;
  const adminBack = reason === 'welcome_link_non_client' ? '/admin/login' : '/login';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Avalon — sign in</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0a0a0a;color:#f1f1f1;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}main{max-width:420px}h1{font-size:22px;letter-spacing:.02em;margin:0 0 12px}p{font-size:15px;line-height:1.55;color:#bbb;margin:0 0 22px}a{display:inline-block;background:#fff;color:#000;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}</style></head><body><main><h1>Sign in to Avalon</h1><p>${copy}</p><a href="${adminBack}">Go to sign in</a></main></body></html>`;
}

function siteBase() {
  return String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

function send302(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function sendErrorPage(res, reason, status = 400) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(failurePageHtml(reason));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method not allowed');
    return;
  }
  if (!isMagicLinkWelcomeEnabled()) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  let token = '';
  try {
    const url = new URL(req.url, 'http://localhost');
    token = String(url.searchParams.get('token') || '').trim();
  } catch {
    token = '';
  }

  let claims;
  try {
    claims = verifyWelcomeToken(token);
  } catch (err) {
    return sendErrorPage(res, err.code || 'default', 400);
  }

  const db = await getServiceClient();
  if (!db) {
    return sendErrorPage(res, 'welcome_link_supabase_failed', 503);
  }

  let profileEmail = '';
  let profileRole = null; // null = unconfirmed; the gate below fails closed.
  let tenantId = null;
  let lookupOk = false;
  try {
    const { data: profile, error } = await db
      .from('profiles')
      .select('email, role, tenant_id')
      .eq('id', claims.userId)
      .maybeSingle();
    if (error) throw error;
    lookupOk = true;
    if (profile?.email) profileEmail = String(profile.email).trim().toLowerCase();
    if (profile?.role) profileRole = profile.role;
    if (profile?.tenant_id) tenantId = profile.tenant_id;
  } catch (err) {
    console.warn('[welcome-redeem] profile lookup failed', safeLogContext(err, 'welcome_redeem_profile_lookup_failed'));
  }

  // Fail closed: only a positively-confirmed `client` may redeem. A lookup
  // error, a missing profile, or any non-client role is refused — the link must
  // never mint an elevated or unverified session (CP-2 hardening). Previously
  // profileRole defaulted to 'client', so a transient lookup error fell open.
  if (!lookupOk || profileRole !== 'client') {
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: claims.userId,
      action: ACTION_REFUSED,
      entityType: ENTITY_TYPE,
      entityId: claims.userId,
      phiTouched: false,
      payload: { reason: lookupOk ? 'non_client_role' : 'profile_lookup_failed', role_observed: profileRole },
    });
    return sendErrorPage(res, lookupOk ? 'welcome_link_non_client' : 'welcome_link_supabase_failed', lookupOk ? 403 : 503);
  }

  // Need an email to issue the magic link. The auth user's email is the
  // source of truth; profiles.email may be denormalized. Look it up via
  // admin if missing.
  if (!profileEmail) {
    try {
      const { data } = await db.auth.admin.getUserById(claims.userId);
      if (data?.user?.email) profileEmail = String(data.user.email).trim().toLowerCase();
    } catch (err) {
      console.warn('[welcome-redeem] auth admin getUserById failed', safeLogContext(err, 'welcome_redeem_auth_lookup_failed'));
    }
  }
  if (!profileEmail) {
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: claims.userId,
      action: ACTION_REFUSED,
      entityType: ENTITY_TYPE,
      entityId: claims.userId,
      phiTouched: false,
      payload: { reason: 'no_recipient_email' },
    });
    return sendErrorPage(res, 'welcome_link_supabase_failed', 500);
  }

  const redirectTo = `${siteBase() || ''}/auth/callback`;
  try {
    const { data, error } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email: profileEmail,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) throw error;
    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      throw Object.assign(new Error('Supabase did not return an action_link'), { code: 'welcome_link_supabase_failed' });
    }
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: claims.userId,
      action: ACTION_REDEEMED,
      entityType: ENTITY_TYPE,
      entityId: claims.userId,
      phiTouched: false,
      payload: { source: 'welcome_email' },
    });
    return send302(res, actionLink);
  } catch (err) {
    console.warn('[welcome-redeem] supabase link generation failed', safeLogContext(err, 'welcome_redeem_link_failed'));
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: claims.userId,
      action: ACTION_REFUSED,
      entityType: ENTITY_TYPE,
      entityId: claims.userId,
      phiTouched: false,
      payload: { reason: 'supabase_link_failed', code: safeErrorCode(err, 'welcome_redeem_link_failed') },
    });
    return sendErrorPage(res, 'welcome_link_supabase_failed', 500);
  }
}
