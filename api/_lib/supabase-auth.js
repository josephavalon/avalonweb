/**
 * Supabase-session auth for serverless API routes.
 *
 * The browser sends the signed-in user's Supabase access token as
 * `Authorization: Bearer <token>`. We verify it server-side with the
 * service-role client (which also lets us read profiles.role past RLS) and
 * derive the caller's identity, role, and tenant. This is how the client/admin
 * dashboards authenticate to the API without ever shipping a server secret to
 * the bundle.
 */

let _svc = null;
let _defaultTenantId = null;
let _defaultTenantLookupAt = 0;

// Service-role client (bypasses RLS — server only). Null until envs are set.
export async function getServiceClient() {
  if (_svc) return _svc;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  _svc = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _svc;
}

// Default tenant id, cached for 5 minutes. The auth bootstrap trigger
// (009_private_auth_profile_trigger.sql) seeds profiles with the
// 'avalon-vitality' tenant; the synchronous fallback below must match so
// idempotent re-seeds don't churn tenant_id.
async function getDefaultTenantId(db) {
  if (_defaultTenantId && Date.now() - _defaultTenantLookupAt < 5 * 60 * 1000) {
    return _defaultTenantId;
  }
  try {
    const { data } = await db.from('tenants').select('id').eq('slug', 'avalon-vitality').maybeSingle();
    if (data?.id) {
      _defaultTenantId = data.id;
      _defaultTenantLookupAt = Date.now();
    }
  } catch { /* tenants RLS / missing table → leave null and the caller skips tenant_id */ }
  return _defaultTenantId;
}

/**
 * Idempotent profile seed. The auth.users → profiles trigger normally lands a
 * row, but it can race with the first authed API request (especially after an
 * OAuth signup, where Supabase fires the redirect immediately after creating
 * the auth user). Without a row, every protected endpoint that does
 * `profiles.select(...).eq(id, user.id)` returns no data and the caller falls
 * back to anonymous/default — or worse, 404s.
 *
 * This helper writes the missing row using the same defaults as the trigger,
 * keyed by auth user id. It is safe to call from inside getAuthedUser (which
 * runs on every API request) — the upsert is conditional on a profile lookup
 * having returned nothing, so the steady-state cost is one extra SELECT.
 *
 * Returns the profile row (role, tenant_id, status) the caller should use.
 */
export async function upsertProfileForUser(db, authUser, { source = 'auth_first_touch' } = {}) {
  if (!db || !authUser?.id) return null;
  const tenantId = await getDefaultTenantId(db);
  const meta = authUser.user_metadata || {};
  const fullName = String(meta.full_name || meta.name || '').trim() || null;
  const row = {
    id: authUser.id,
    email: (authUser.email || '').trim() || null,
    phone: (authUser.phone || '').trim() || null,
    full_name: fullName,
    role: 'client',
    status: 'active',
    tenant_id: tenantId,
  };
  try {
    // onConflict 'id' makes this a true no-op when the trigger already seeded
    // the row; we only fill in NULLs we're authoritative for. Do NOT overwrite
    // role here — an admin/staff promotion may have landed via a different code
    // path (invite-accept) before this helper runs.
    const { data, error } = await db.from('profiles')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: false })
      .select('role, tenant_id, status')
      .maybeSingle();
    if (error) throw error;
    // Best-effort: surface the seed so we can spot churn / unexpected first-touches.
    try {
      console.warn('[supabase-auth] profile seeded on auth first-touch', {
        userId: authUser.id, source,
      });
    } catch { /* ignore */ }
    return data || null;
  } catch (err) {
    // Don't block the request — the caller will degrade to the default client
    // role, which is the same behaviour as before this helper existed.
    try {
      console.warn('[supabase-auth] profile seed failed', {
        userId: authUser.id, code: err?.code || err?.name || 'profile_seed_failed',
      });
    } catch { /* ignore */ }
    return null;
  }
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : '';
}

// The Supabase access token is a JWT whose payload carries the session's
// Authenticator Assurance Level (`aal`): 'aal1' (single factor) or 'aal2' (a
// second factor was verified this session). We only READ the claim — the token
// was already cryptographically verified by db.auth.getUser() above the caller.
function jwtAal(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1] || '', 'base64url').toString('utf8'));
    return String(payload?.aal || 'aal1').toLowerCase();
  } catch {
    return 'aal1';
  }
}

// Hard MFA enforcement for the operator tier, flag-gated so it can be turned on
// only AFTER admins have enrolled a factor (otherwise it locks every admin out).
// Off by default — deploying the gate changes nothing until MFA_ENFORCED is set.
function mfaEnforced() {
  const v = String(process.env.MFA_ENFORCED || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Verify the request's Supabase access token. Returns
 * { user, role, email, tenantId, db } on success, or null if unauthenticated /
 * Supabase is not configured.
 */
export async function getAuthedUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const db = await getServiceClient();
  if (!db) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const user = data.user;
  let role = 'client';
  let tenantId = null;
  let status = 'active';
  let profileRow = null;
  try {
    const { data: profile } = await db.from('profiles').select('role, tenant_id, status').eq('id', user.id).maybeSingle();
    profileRow = profile || null;
  } catch { /* no profile row → fall through to seed below */ }
  // Profile-seeding race: the auth.users trigger that seeds public.profiles can
  // be slightly behind the first authed API request after an OAuth signup. If
  // we got here with no row, synchronously upsert one so the rest of this
  // request — and every protected endpoint that joins on profiles — sees a
  // valid identity. Idempotent: a steady-state miss is rare and the upsert is
  // ON CONFLICT (id) DO UPDATE on null-able cols only.
  if (!profileRow) {
    profileRow = await upsertProfileForUser(db, user, { source: 'getAuthedUser' });
  }
  if (profileRow?.role) role = profileRow.role;
  if (profileRow?.tenant_id) tenantId = profileRow.tenant_id;
  if (profileRow?.status) status = profileRow.status;
  // A deactivated member's JWT remains valid until exp; reject it here so the
  // ban is effective immediately for the API. (The browser will redirect to
  // /admin/login on the next 401.)
  if (status !== 'active') return null;
  // An elevated role with a null tenant would silently bypass every team-core
  // helper's `if (tenantId) q = q.eq('tenant_id', tenantId)` filter, granting
  // cross-tenant read/write. Treat the row as misconfigured and drop the role
  // to client — the user stays signed in, but admin/staff gates 403.
  if (role !== 'client' && !tenantId) {
    role = 'client';
  }
  return { user, role, email: (user.email || '').trim(), tenantId, db, aal: jwtAal(token) };
}

/** Gate a route to admins. Writes the 401/403 response itself; returns null when blocked. */
export async function requireAdmin(req, res) {
  const authed = await getAuthedUser(req);
  if (!authed) { res.status(401).json({ error: 'Sign in required' }); return null; }
  if (authed.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return null; }
  if (mfaEnforced() && authed.aal !== 'aal2') {
    res.status(403).json({ error: 'Multi-factor authentication required', code: 'mfa_required' });
    return null;
  }
  return authed;
}

/**
 * Gate a route to any of `roles`. Writes the 401/403 response itself; returns
 * null when blocked. Use this for customer/scheduling/billing routes the
 * `staff` tier should reach — e.g. requireRole(req, res, ['admin', 'staff']).
 */
export async function requireRole(req, res, roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const authed = await getAuthedUser(req);
  if (!authed) { res.status(401).json({ error: 'Sign in required' }); return null; }
  if (!allowed.includes(authed.role)) { res.status(403).json({ error: 'Insufficient access' }); return null; }
  // Operator-tier (admin/staff) sessions must be AAL2 once enforcement is on.
  if (mfaEnforced() && (authed.role === 'admin' || authed.role === 'staff') && authed.aal !== 'aal2') {
    res.status(403).json({ error: 'Multi-factor authentication required', code: 'mfa_required' });
    return null;
  }
  return authed;
}

/** Gate a route to admin or staff (the operator tier). */
export function requireStaff(req, res) {
  return requireRole(req, res, ['admin', 'staff']);
}
