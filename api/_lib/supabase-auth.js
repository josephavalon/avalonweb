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

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : '';
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
  try {
    const { data: profile } = await db.from('profiles').select('role, tenant_id, status').eq('id', user.id).maybeSingle();
    if (profile?.role) role = profile.role;
    if (profile?.tenant_id) tenantId = profile.tenant_id;
    if (profile?.status) status = profile.status;
  } catch { /* no profile row → default client */ }
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
  return { user, role, email: (user.email || '').trim(), tenantId, db };
}

/** Gate a route to admins. Writes the 401/403 response itself; returns null when blocked. */
export async function requireAdmin(req, res) {
  const authed = await getAuthedUser(req);
  if (!authed) { res.status(401).json({ error: 'Sign in required' }); return null; }
  if (authed.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return null; }
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
  return authed;
}

/** Gate a route to admin or staff (the operator tier). */
export function requireStaff(req, res) {
  return requireRole(req, res, ['admin', 'staff']);
}
