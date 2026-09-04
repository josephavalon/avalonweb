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
 * Insert-only profile seed. The auth.users → profiles trigger normally lands a
 * row, but it can race with the first authed API request (especially after an
 * OAuth signup, where Supabase fires the redirect immediately after creating
 * the auth user). Without a row, every protected endpoint that does
 * `profiles.select(...).eq(id, user.id)` returns no data and the caller falls
 * back to anonymous/default — or worse, 404s.
 *
 * This helper writes the missing row using the same defaults as the trigger,
 * keyed by auth user id. It never updates an existing row: role, status, and
 * tenant are authoritative security state and must not be reset by first-touch
 * bootstrap after an invite, deactivation, or concurrent trigger insert.
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
    const { data, error } = await db.from('profiles')
      .insert(row)
      .select('role, tenant_id, status')
      .maybeSingle();
    if (error?.code === '23505') {
      // The auth trigger or another request won the insert race. Read the
      // authoritative row; never turn the conflict into an update.
      const { data: existing, error: existingError } = await db.from('profiles')
        .select('role, tenant_id, status')
        .eq('id', authUser.id)
        .maybeSingle();
      if (existingError) throw existingError;
      return existing || null;
    }
    if (error) throw error;
    // Best-effort: surface the seed so we can spot churn / unexpected first-touches.
    try {
      console.warn('[supabase-auth] profile seeded on auth first-touch', {
        userId: authUser.id, source,
      });
    } catch { /* ignore */ }
    return data || null;
  } catch (err) {
    // The caller fails authentication closed when the authoritative profile
    // cannot be created or read.
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
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('role, tenant_id, status')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    try {
      console.warn('[supabase-auth] profile lookup failed', {
        userId: user.id,
        code: profileError?.code || profileError?.name || 'profile_lookup_failed',
      });
    } catch { /* ignore */ }
    return null;
  }
  profileRow = profile || null;
  // Profile-seeding race: the auth.users trigger that seeds public.profiles can
  // be slightly behind the first authed API request after an OAuth signup. If
  // we got here with no row, synchronously upsert one so the rest of this
  // request — and every protected endpoint that joins on profiles — sees a
  // valid identity. A concurrent trigger insert is handled as a read-only
  // conflict path; it never overwrites authoritative profile fields.
  if (!profileRow) {
    profileRow = await upsertProfileForUser(db, user, { source: 'getAuthedUser' });
  }
  if (!profileRow) return null;
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

/**
 * Operator-tier MFA gate, shared so every helper that admits admin/staff sees
 * the same rule. Returns true (and writes the 403) when the caller must be
 * turned away.
 *
 * Extracted 2026-09-01. requireAdmin/requireRole enforced MFA, but
 * requireOsOperator (all of api/os/v1/*) and requireFinanceActor (the finance,
 * payroll and vendor-bill routes under api/admin/) each re-implemented their
 * own authorization on top of getAuthedUser() and never consulted
 * MFA_ENFORCED. Setting the flag would therefore have looked like it covered
 * the admin surface while leaving that whole tier on a password — the exact
 * false assurance the flag exists to prevent.
 */
// 'founder' is included because api/admin/finance/roles.js admits it alongside
// admin for finance ROLE ASSIGNMENT — privilege management, the last place an
// elevated role should be exempt from a second factor.
const OPERATOR_TIER_ROLES = ['admin', 'staff', 'founder'];

export function operatorMfaBlocked(authed, res) {
  if (!mfaEnforced()) return false;
  if (!authed || !OPERATOR_TIER_ROLES.includes(authed.role)) return false;
  if (authed.aal === 'aal2') return false;
  res.status(403).json({ error: 'Multi-factor authentication required', code: 'mfa_required' });
  return true;
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
