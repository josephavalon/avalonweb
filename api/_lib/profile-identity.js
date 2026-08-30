/**
 * Resolve a legacy profile email through the service-role-only database
 * function installed by migration 055. PostgreSQL performs a canonical,
 * case-insensitive equality comparison; no caller-controlled wildcard pattern
 * is ever sent to PostgREST.
 */
export async function resolveUniqueProfileIdByEmail(db, { tenantId, email } = {}) {
  const canonicalEmail = String(email || '').trim().toLowerCase();
  if (!db || !tenantId || !canonicalEmail) return null;
  const { data, error } = await db.rpc('resolve_unique_profile_id_by_email', {
    p_tenant_id: tenantId,
    p_email: canonicalEmail,
  });
  if (error) return null;
  const profileId = Array.isArray(data) ? data[0] : data;
  return typeof profileId === 'string' && profileId ? profileId : null;
}
