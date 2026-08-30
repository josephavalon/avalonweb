import { requireAdmin } from '../_lib/supabase-auth.js';
import { safeLogContext } from '../_lib/safe-error.js';
import {
  CATALOG_AUDIENCES,
  CatalogError,
  buildAdminDashboard,
  isAgentRequestedChange,
  loadCatalogGraph,
  mergeOfferingPatch,
  resolveEffectivePrice,
  riskForAction,
  validateCompositeOffering,
} from '../_lib/catalog-core.js';
import { importLegacyCatalog } from '../_lib/catalog-legacy-import.js';

const MUTATING_ACTIONS = new Set([
  'create_offering', 'update_offering', 'duplicate_offering', 'archive_offering',
  'change_price', 'schedule_price_change', 'import_legacy',
]);

const PRICE_SCOPE_KEY = Object.freeze({
  event: 'event_key',
  corporate: 'corporate_key',
  member: 'membership_key',
  location: 'location_key',
  partner: 'partner_key',
  promotional: 'promotion_key',
  contract: 'contract_key',
  custom: 'custom_key',
});

function normalizePriceConditions(priceType, rawConditions) {
  const type = String(priceType || 'standard').trim().toLowerCase();
  const conditions = rawConditions == null ? {} : rawConditions;
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) {
    throw new CatalogError('invalid_catalog_price_conditions', 'Price conditions must be a scoped object.');
  }
  const entries = Object.entries(conditions);
  if (type === 'standard') {
    if (entries.length) {
      throw new CatalogError('invalid_catalog_price_conditions', 'Standard retail pricing cannot have contextual conditions.');
    }
    return { type, conditions: {} };
  }
  const scopeKey = PRICE_SCOPE_KEY[type];
  if (!scopeKey || entries.length !== 1 || entries[0][0] !== scopeKey) {
    throw new CatalogError(
      'invalid_catalog_price_conditions',
      `A ${type || 'contextual'} price requires exactly one ${scopeKey || 'recognized scope'} condition.`,
    );
  }
  const scopeValue = entries[0][1];
  if (!['string', 'number'].includes(typeof scopeValue) || !String(scopeValue).trim()) {
    throw new CatalogError('invalid_catalog_price_conditions', `${scopeKey} must be a non-empty stable identifier.`);
  }
  return { type, conditions: { [scopeKey]: scopeValue } };
}

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function reasonFrom(body) {
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 2) throw new CatalogError('catalog_change_reason_required', 'A reason is required for Catalog changes.');
  return reason;
}

function publicError(error) {
  if (error instanceof CatalogError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  const databaseMessage = String(error?.message || error?.details || error?.hint || '');
  if (databaseMessage.includes('catalog_version_conflict') || error?.code === '40001') {
    return { status: 409, code: 'catalog_version_conflict', message: 'This offering changed. Refresh and try again.' };
  }
  if (databaseMessage.includes('catalog_activation_')) {
    return { status: 409, code: 'catalog_activation_incomplete', message: 'This offering is not complete enough to activate.' };
  }
  if (error?.code === '23505') {
    return { status: 409, code: 'catalog_conflict', message: 'That Catalog identifier is already in use.' };
  }
  return { status: 500, code: 'catalog_operation_failed', message: 'The Catalog operation could not be completed.' };
}

function findOffering(graph, identifier) {
  const value = String(identifier || '').trim();
  return (graph.offerings || []).find((offering) => (
    offering.id === value || offering.stable_key === value
  )) || null;
}

function normalizeCreatePayload(body) {
  const source = body.offering && typeof body.offering === 'object' ? body.offering : body;
  const clinicalMetadata = {
    ...(source.clinical_metadata && typeof source.clinical_metadata === 'object' ? source.clinical_metadata : {}),
  };
  if (Object.prototype.hasOwnProperty.call(source, 'protocol_reference')) {
    clinicalMetadata.protocol_reference = source.protocol_reference;
  }
  const fulfillmentMetadata = {
    ...(source.fulfillment_metadata && typeof source.fulfillment_metadata === 'object' ? source.fulfillment_metadata : {}),
  };
  if (Object.prototype.hasOwnProperty.call(source, 'required_supplies')) {
    fulfillmentMetadata.required_supplies = source.required_supplies;
  }
  const availabilityMode = source.availability_mode || 'closed';
  const publicPresentation = {
    display_name: source.public_name || source.internal_name || '',
    description: source.client_description ?? source.description ?? null,
    short_description: source.short_description ?? null,
    nurse_instructions: null,
    admin_notes: null,
    benefits: Array.isArray(source.benefits) ? source.benefits : [],
    use_cases: Array.isArray(source.use_cases) ? source.use_cases : [],
    included_items: Array.isArray(source.included_items) ? source.included_items : [],
    hero_url: source.hero_url ?? null,
    thumbnail_url: source.thumbnail_url ?? null,
    icon: source.icon ?? null,
    detail_path: source.detail_path ?? null,
    booking_path: source.booking_path ?? null,
    display_order: Number(source.display_order || 0),
    featured: source.featured === true,
    metadata: {},
  };
  return {
    ...source,
    clinical_metadata: clinicalMetadata,
    fulfillment_metadata: fulfillmentMetadata,
    presentations: {
      ...(source.presentations && typeof source.presentations === 'object' ? source.presentations : {}),
      public: source.presentations?.public || publicPresentation,
    },
    availability_mode: availabilityMode,
  };
}

async function saveOffering(db, { tenantId, actorId, payload, expectedVersion, reason }) {
  const { data, error } = await db.rpc('catalog_admin_save_offering', {
    p_tenant_id: tenantId,
    p_actor_id: actorId,
    p_offering: payload,
    p_expected_version: expectedVersion == null ? null : Number(expectedVersion),
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

async function queueApproval(db, { tenantId, actorId, action, body, reason }) {
  const requestedByAgent = String(body.requested_by_agent || body.agent_id || 'catalog-agent').slice(0, 200);
  const { data, error } = await db.from('catalog_change_requests').insert({
    tenant_id: tenantId,
    action,
    risk_type: riskForAction(action),
    object_type: 'offering',
    object_id: String(body.offering_id || body.stable_key || '').slice(0, 300) || null,
    requested_change: body,
    reason,
    status: 'pending',
    requested_by_profile_id: actorId,
    requested_by_agent: requestedByAgent,
  }).select('id,action,risk_type,status,created_at').single();
  if (error) throw error;
  return data;
}

function duplicatePayload(graph, source, body) {
  const copied = mergeOfferingPatch(graph, source, {});
  const suffix = Date.now().toString(36);
  const stableKey = String(body.new_stable_key || `${source.stable_key}-copy-${suffix}`)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    ...copied,
    stable_key: stableKey,
    sku: body.sku || null,
    internal_name: body.internal_name || `${source.internal_name} Copy`,
    public_name: body.public_name || `${source.public_name} Copy`,
    status: 'draft',
    visibility: Object.fromEntries(CATALOG_AUDIENCES.map((audience) => [audience, audience === 'admin'])),
    availability_mode: 'closed',
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireAdmin(req, res);
  if (!authed) return;
  if (!authed.tenantId) {
    return res.status(503).json({ error: 'Catalog tenant is unavailable.', code: 'catalog_tenant_missing' });
  }
  const { db, tenantId, user } = authed;

  try {
    if (req.method === 'GET') {
      if (String(req.query?.view || 'dashboard') !== 'dashboard') {
        throw new CatalogError('invalid_catalog_view', 'Unsupported Catalog view.');
      }
      const graph = await loadCatalogGraph(db, tenantId);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json(buildAdminDashboard(graph));
    }

    const body = bodyObject(req);
    const action = String(body.action || '').trim();
    if (!action) throw new CatalogError('catalog_action_required', 'Catalog action is required.');
    if (req.method === 'PATCH' && action !== 'update_offering') {
      throw new CatalogError('invalid_catalog_method', 'PATCH supports update_offering only.', 405);
    }
    if (req.method === 'POST' && action === 'update_offering') {
      throw new CatalogError('invalid_catalog_method', 'Use PATCH for update_offering.', 405);
    }

    if (MUTATING_ACTIONS.has(action)) {
      const reason = reasonFrom(body);
      if (isAgentRequestedChange(body)) {
        const approval = await queueApproval(db, {
          tenantId, actorId: user.id, action, body, reason,
        });
        return res.status(202).json({ source: 'live', approval_required: true, change_request: approval });
      }

      if (action === 'import_legacy') {
        const result = await importLegacyCatalog(db, {
          tenantId, actorId: user.id, reason,
        });
        return res.status(200).json({
          source: 'live',
          imported: true,
          run: result.run,
          count: result.projection.offerings.length,
          shadow_verified: true,
        });
      }

      let graph = await loadCatalogGraph(db, tenantId);
      if (action === 'create_offering') {
        const payload = validateCompositeOffering(normalizeCreatePayload(body));
        const saved = await saveOffering(db, {
          tenantId, actorId: user.id, payload, expectedVersion: null, reason,
        });
        return res.status(201).json({ source: 'live', offering: saved });
      }

      const identifier = body.offering_id || body.stable_key || body.id;
      const existing = findOffering(graph, identifier);
      if (!existing) throw new CatalogError('catalog_offering_not_found', 'Offering not found.', 404);

      if (action === 'update_offering') {
        const expectedVersion = Number(body.expected_version ?? body.version);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new CatalogError('catalog_version_required', 'The version you opened is required for this update.', 409);
        }
        const patch = body.offering && typeof body.offering === 'object' ? { ...body, ...body.offering } : body;
        // Resolve offering_id to the locked row's stable key. A sparse UI patch
        // can never turn a UUID into a new accidental stable identity.
        patch.stable_key = existing.stable_key;
        const merged = mergeOfferingPatch(graph, existing, patch);
        const payload = validateCompositeOffering(merged, { update: true });
        const saved = await saveOffering(db, {
          tenantId, actorId: user.id, payload, expectedVersion, reason,
        });
        return res.status(200).json({ source: 'live', offering: saved });
      }

      if (action === 'duplicate_offering') {
        const payload = validateCompositeOffering(duplicatePayload(graph, existing, body));
        const saved = await saveOffering(db, {
          tenantId, actorId: user.id, payload, expectedVersion: null, reason,
        });
        return res.status(201).json({ source: 'live', offering: saved });
      }

      if (action === 'archive_offering') {
        const expectedVersion = Number(body.expected_version ?? body.version);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new CatalogError('catalog_version_required', 'The current offering version is required to archive.', 409);
        }
        const patch = {
          status: 'archived',
          visibility: Object.fromEntries(CATALOG_AUDIENCES.map((audience) => [audience, false])),
          availability_mode: 'closed',
        };
        const payload = validateCompositeOffering(mergeOfferingPatch(graph, existing, patch), { update: true });
        const saved = await saveOffering(db, {
          tenantId, actorId: user.id, payload, expectedVersion, reason,
        });
        return res.status(200).json({ source: 'live', offering: saved });
      }

      if (action === 'change_price' || action === 'schedule_price_change') {
        const amount = Number(body.amount_cents ?? body.price_cents ?? body.new_price_cents);
        if (!Number.isInteger(amount) || amount < 0) {
          throw new CatalogError('invalid_catalog_price', 'Price must be an integer number of cents.');
        }
        let effectiveFrom = new Date().toISOString();
        if (action === 'schedule_price_change') {
          const scheduledAt = new Date(body.effective_from || '');
          if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
            throw new CatalogError('invalid_catalog_effective_date', 'Scheduled price changes require a valid future effective date.');
          }
          effectiveFrom = scheduledAt.toISOString();
        }
        const scopedPrice = normalizePriceConditions(body.price_type || 'standard', body.conditions);
        const { data, error } = await db.rpc('catalog_change_price', {
          p_tenant_id: tenantId,
          p_actor_id: user.id,
          p_stable_key: existing.stable_key,
          p_amount_cents: amount,
          p_price_type: scopedPrice.type,
          p_effective_from: effectiveFrom,
          p_conditions: scopedPrice.conditions,
          p_reason: reason,
        });
        if (error) throw error;
        return res.status(200).json({ source: 'live', price_rule: data });
      }
    }

    if (action === 'get_effective_price') {
      const graph = await loadCatalogGraph(db, tenantId);
      const existing = findOffering(graph, body.offering_id || body.stable_key || body.id);
      if (!existing) throw new CatalogError('catalog_offering_not_found', 'Offering not found.', 404);
      const context = body.context && typeof body.context === 'object' ? body.context : {};
      const decision = resolveEffectivePrice(graph, existing.id, { ...context, now: new Date() });
      return res.status(200).json({
        source: 'live',
        offering_id: existing.stable_key,
        price_cents: decision.price_cents,
        currency: decision.currency,
        compare_at_price_cents: decision.compare_at_price_cents,
        trace: decision.trace,
      });
    }

    throw new CatalogError('unsupported_catalog_action', 'Unsupported Catalog action.');
  } catch (error) {
    const exposed = publicError(error);
    console.warn('[admin/catalog] operation failed', safeLogContext(error, exposed.code));
    return res.status(exposed.status).json({ error: exposed.message, code: exposed.code });
  }
}
