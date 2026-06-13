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
  try {
    const { data: profile } = await db.from('profiles').select('role, tenant_id').eq('id', user.id).maybeSingle();
    if (profile?.role) role = profile.role;
    if (profile?.tenant_id) tenantId = profile.tenant_id;
  } catch { /* no profile row → default client */ }
  return { user, role, email: (user.email || '').trim(), tenantId, db };
}

/** Gate a route to admins. Writes the 401/403 response itself; returns null when blocked. */
export async function requireAdmin(req, res) {
  const authed = await getAuthedUser(req);
  if (!authed) { res.status(401).json({ error: 'Sign in required' }); return null; }
  if (authed.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return null; }
  return authed;
}
