/**
 * Shared logic for the admin team-management routes. Keeps the last-admin
 * guard and roster queries in one place so every mutation route enforces them
 * the same way. All functions take the service-role `db` and a tenant scope.
 */

export const TEAM_ROLES = ['staff', 'admin'];

/** Count active admins in a tenant. Used to block demoting/removing the last one. */
export async function countActiveAdmins(db, tenantId) {
  let q = db.from('profiles').select('id', { count: 'exact', head: true })
    .eq('role', 'admin').eq('status', 'active');
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

/**
 * Pure decision: given the target's current role/status, the requested change,
 * and how many active admins exist, would this change drop the tenant to zero
 * active admins? Separated from the DB call so it can be unit-tested.
 */
export function decideDropsLastAdmin(targetProfile, { nextRole, nextStatus } = {}, activeAdminCount = 0) {
  const wasActiveAdmin = targetProfile?.role === 'admin' && targetProfile?.status === 'active';
  if (!wasActiveAdmin) return false;
  const staysActiveAdmin = (nextRole ?? targetProfile.role) === 'admin'
    && (nextStatus ?? targetProfile.status) === 'active';
  if (staysActiveAdmin) return false;
  return activeAdminCount <= 1;
}

/**
 * Returns true if changing `targetProfile` (demoting from admin, or
 * deactivating an active admin) would leave the tenant with zero active admins.
 */
export async function wouldDropLastAdmin(db, tenantId, targetProfile, { nextRole, nextStatus } = {}) {
  const wasActiveAdmin = targetProfile?.role === 'admin' && targetProfile?.status === 'active';
  if (!wasActiveAdmin) return false;
  const staysActiveAdmin = (nextRole ?? targetProfile.role) === 'admin'
    && (nextStatus ?? targetProfile.status) === 'active';
  if (staysActiveAdmin) return false;
  const admins = await countActiveAdmins(db, tenantId);
  return decideDropsLastAdmin(targetProfile, { nextRole, nextStatus }, admins);
}

/** Staff + admin roster for a tenant. */
export async function listTeamMembers(db, tenantId) {
  let q = db.from('profiles')
    .select('id, email, full_name, phone, role, status, deactivated_at, must_change_password, created_at, updated_at')
    .in('role', TEAM_ROLES)
    .order('created_at', { ascending: true });
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Pending (not yet accepted/revoked/expired) invites for a tenant. */
export async function listPendingInvites(db, tenantId) {
  let q = db.from('invitations')
    .select('id, email, phone, full_name, invited_role, status, expires_at, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Load a team member by id, scoped to tenant. Returns null if not found / not staff-or-admin. */
export async function getTeamMember(db, tenantId, profileId) {
  let q = db.from('profiles')
    .select('id, email, full_name, phone, role, status, tenant_id')
    .eq('id', profileId);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data || !TEAM_ROLES.includes(data.role)) return null;
  return data;
}
