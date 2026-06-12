import crypto from 'crypto';

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function stableJson(value = {}) {
  return JSON.stringify(sortValue(value));
}

export async function writeAuditEvent(db, {
  tenantId = null,
  actorProfileId = null,
  action,
  entityType,
  entityId = null,
  phiTouched = false,
  payload = {},
} = {}) {
  if (!db || !action || !entityType) return { skipped: true };
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const payloadHash = crypto.createHash('sha256').update(stableJson(safePayload)).digest('hex');
  try {
    const { error } = await db.from('audit_events').insert({
      tenant_id: tenantId,
      actor_profile_id: actorProfileId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      phi_touched: Boolean(phiTouched),
      payload_hash: payloadHash,
      payload: safePayload,
    });
    if (error) throw error;
    return { inserted: true };
  } catch (err) {
    console.warn('[audit_events] insert failed:', err.message);
    return { error: err.message };
  }
}
