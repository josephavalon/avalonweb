/**
 * POST /api/me/account/unlink
 *
 * Unlink an OAuth identity (e.g. Google) from the SIGNED-IN member's Supabase
 * user. Booking is passwordless-first, so a member can have a Google identity
 * and/or a password and/or just an email. We must never unlink the LAST way in:
 * after unlinking the member has to retain at least one of
 *   (a) another linked OAuth identity, or
 *   (b) a password (surfaced by Supabase as an 'email' provider identity).
 *
 * Implementation note: Supabase's `unlinkIdentity` lives on the user-scoped
 * client (GoTrue `DELETE /user/identities/{id}` authed with the USER's token),
 * NOT on `auth.admin`. The service-role admin API has no unlink. We therefore
 * read the identities with the service-role admin client (to enforce the
 * "don't strip the last credential" guard authoritatively) and then perform the
 * delete against the GoTrue user endpoint using the caller's own bearer token —
 * exactly what the browser SDK would do, just proxied through our API so the
 * guard can't be bypassed.
 *
 * Body: { provider: string }  // e.g. 'google'
 *
 * Emits an audit event. Acts only on the caller's own account.
 */
import { getAuthedUser } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { checkRateLimit } from '../../_lib/rate-limit.js';
import { safeErrorCode } from '../../_lib/safe-error.js';

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, tenantId } = authed;

  const provider = String(req.body?.provider || '').trim().toLowerCase();
  if (!provider) return res.status(400).json({ error: 'provider is required.', code: 'provider_required' });
  if (provider === 'email') {
    return res.status(400).json({ error: 'The email sign-in method cannot be unlinked.', code: 'email_not_unlinkable' });
  }

  const limit = await checkRateLimit({
    key: `me-unlink:${user?.id || 'unknown'}`,
    windowMs: 60 * 1000,
    max: 10,
  });
  if (!limit.ok) {
    return res.status(429).json({ error: 'Too many attempts. Try again shortly.', code: 'rate_limited' });
  }

  try {
    // Authoritative identities read via the admin API.
    const { data: fullData, error: getErr } = await db.auth.admin.getUserById(user.id);
    if (getErr) throw getErr;
    const fullUser = fullData?.user;
    if (!fullUser) return res.status(404).json({ error: 'Account not found.', code: 'user_not_found' });

    const identities = Array.isArray(fullUser.identities) ? fullUser.identities : [];
    const target = identities.find((id) => String(id.provider || '').toLowerCase() === provider);
    if (!target) {
      return res.status(404).json({ error: `No ${provider} sign-in is linked to this account.`, code: 'identity_not_found' });
    }

    // What sign-in methods REMAIN after the unlink? Any other OAuth identity,
    // plus a password (Supabase represents a set password as an 'email'
    // provider identity on the user).
    const remainingOauth = identities.filter(
      (id) => id !== target && String(id.provider || '').toLowerCase() !== 'email',
    );
    const hasPassword = identities.some((id) => String(id.provider || '').toLowerCase() === 'email');

    if (remainingOauth.length === 0 && !hasPassword) {
      return res.status(409).json({
        error: 'Set a password first — unlinking this would leave you with no way to sign in.',
        code: 'last_sign_in_method',
      });
    }

    const identityId = target.identity_id || target.id;
    if (!identityId) throw new Error('Identity is missing an id');

    // Delete against the GoTrue user endpoint with the caller's own token —
    // mirrors the browser SDK's unlinkIdentity (DELETE /user/identities/{id}).
    const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const apikey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const token = bearerToken(req);
    if (!url || !apikey || !token) throw new Error('Auth backend not configured');

    const resp = await fetch(`${url}/auth/v1/user/identities/${encodeURIComponent(identityId)}`, {
      method: 'DELETE',
      headers: {
        apikey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const err = new Error(`unlink failed (${resp.status})`);
      err.status = resp.status;
      err.detail = body.slice(0, 200);
      throw err;
    }

    await writeAuditEvent(db, {
      tenantId: tenantId || null,
      actorProfileId: user?.id || null,
      action: 'account_identity_unlinked',
      entityType: 'profiles',
      entityId: user?.id || null,
      payload: { provider },
    });
    return res.status(200).json({ ok: true, provider });
  } catch (err) {
    return res.status(500).json({ error: 'Could not unlink that sign-in method.', code: safeErrorCode(err, 'unlink_failed') });
  }
}
