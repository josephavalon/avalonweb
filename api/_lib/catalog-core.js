/**
 * Avalon Catalog server core.
 *
 * Only server routes import this module.  Browser bundles must never query the
 * service-only Catalog tables or receive the raw graph.  Client and nurse
 * projections below are explicit allowlists so adding a sensitive DB column
 * cannot accidentally expand either response.
 */

export const CATALOG_AUDIENCES = Object.freeze([
  'client', 'nurse', 'np', 'physician', 'admin', 'event', 'membership',
  'partner', 'public', 'private_link', 'bd',
]);

export const CATALOG_OFFERING_TYPES = Object.freeze([
  'iv_treatment', 'im_injection', 'add_on', 'service', 'product', 'package',
  'membership_benefit', 'event_offering', 'consultation', 'fee', 'other',
]);

export const PRICE_PRIORITIES = Object.freeze({
  contract: 1000,
  event: 900,
  corporate: 850,
  member: 800,
  location: 700,
  partner: 650,
  promotional: 600,
  custom: 500,
  standard: 100,
});

export class CatalogError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function stringOrNull(value, max = 4000) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return number == null ? null : Math.trunc(number);
}

function stringArray(value, maxItems = 100) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeUrl(value) {
  const url = stringOrNull(value, 1000);
  if (!url) return null;
  if (url.startsWith('/')) return url.startsWith('//') ? null : url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safePath(value) {
  const path = stringOrNull(value, 500);
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

function safeDetailPath(value) {
  const path = safePath(value);
  return path && /^\/products\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(path) ? path : null;
}

function safeBookingPath(value) {
  const path = safePath(value);
  if (!path) return null;
  return /^\/book(?:[/?#][^\s]*)?$/.test(path) || /^\/products\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(path)
    ? path
    : null;
}

function isoNow(context = {}) {
  const candidate = context.now instanceof Date ? context.now : new Date(context.now || Date.now());
  return Number.isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
}

function isEffective(row, nowIso) {
  if (!row) return false;
  if (row.effective_from && row.effective_from > nowIso) return false;
  if (row.effective_to && row.effective_to <= nowIso) return false;
  return true;
}

function conditionsMatch(conditions, context) {
  if (conditions == null) return true;
  if (typeof conditions !== 'object' || Array.isArray(conditions)) return false;
  return Object.entries(conditions).every(([key, expected]) => {
    const actual = context?.[key];
    if (Array.isArray(expected)) {
      return actual != null
        && expected.length > 0
        && expected.every((value) => value != null && typeof value !== 'object')
        && expected.some((value) => String(value) === String(actual));
    }
    if (expected == null || typeof expected === 'object') return false;
    return actual != null && String(actual) === String(expected);
  });
}

function ruleContextMatches(rule, context = {}) {
  // Inventory-gated rules stay closed until the Inventory source supplies an
  // explicit verified signal. Missing data is never interpreted as in stock.
  if (rule.require_inventory === true && context.inventory_available !== true) return false;
  if (rule.channel && String(context.channel || '') !== String(rule.channel)) return false;
  if (rule.context_type && rule.context_type !== 'global') {
    if (String(context.context_type || '') !== String(rule.context_type)) return false;
    if (rule.context_key && String(context.context_key || '') !== String(rule.context_key)) return false;
  }
  if (rule.provider_role && String(context.provider_role || '') !== String(rule.provider_role)) return false;
  if (rule.patient_type && String(context.patient_type || '') !== String(rule.patient_type)) return false;
  if (rule.membership_key && String(context.membership_key || '') !== String(rule.membership_key)) return false;
  if (Array.isArray(rule.days_of_week) && rule.days_of_week.length) {
    // Availability is local-context data. UTC day-of-week is not a safe proxy
    // for a Pacific (or any location-specific) rule.
    if (!Number.isInteger(context.day_of_week)) return false;
    const day = context.day_of_week;
    if (!rule.days_of_week.map(Number).includes(day)) return false;
  }
  // Time-window rules need an explicit local time supplied by the caller.  We
  // do not guess a location's timezone and accidentally open availability.
  if (rule.local_start_time) {
    if (!context.local_time) return false;
    if (String(context.local_time) < String(rule.local_start_time)) return false;
    if (rule.local_end_time && String(context.local_time) >= String(rule.local_end_time)) return false;
  }
  return conditionsMatch(rule.conditions, context);
}

function byOffering(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.offering_id) continue;
    const bucket = map.get(row.offering_id) || [];
    bucket.push(row);
    map.set(row.offering_id, bucket);
  }
  return map;
}

function byId(rows = []) {
  return new Map(rows.filter((row) => row?.id).map((row) => [row.id, row]));
}

function byStableKey(rows = []) {
  return new Map(rows.filter((row) => row?.stable_key).map((row) => [row.stable_key, row]));
}

function compareDisplay(a, b, categoriesById) {
  const categoryA = categoriesById.get(a.category_id);
  const categoryB = categoriesById.get(b.category_id);
  return Number(categoryA?.display_order || 0) - Number(categoryB?.display_order || 0)
    || Number(a.display_order || 0) - Number(b.display_order || 0)
    || String(a.public_name || '').localeCompare(String(b.public_name || ''));
}

/**
 * Load the raw tenant graph from one PostgreSQL statement/snapshot. Never
 * return this object directly to a client. Independent PostgREST reads can
 * straddle an import or composite edit and must not guard public readiness.
 */
export async function loadCatalogGraph(db, tenantId) {
  if (!db || !tenantId) throw new CatalogError('catalog_not_configured', 'Catalog storage is unavailable.', 503);
  const { data, error } = await db.rpc('catalog_read_graph', { p_tenant_id: tenantId });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CatalogError('catalog_storage_error', 'Catalog graph could not be read atomically.', 503, {
      databaseCode: error?.code || null,
    });
  }
  const arrayKeys = [
    'categories', 'offerings', 'presentations', 'prices', 'visibility',
    'availability', 'addonRelations', 'packageItems', 'inventoryRequirements',
    'contextOfferings', 'compensationRefs', 'aliases', 'importRuns', 'audits',
  ];
  if (arrayKeys.some((key) => !Array.isArray(data[key]))) {
    throw new CatalogError('catalog_storage_contract_invalid', 'Catalog graph response was incomplete.', 503);
  }
  return { ...data, tenantId };
}

export function getCatalogReadiness(graph) {
  const readyRun = (Array.isArray(graph?.importRuns) ? graph.importRuns : []).find((run) => (
    run.status === 'succeeded'
    && run.exact_match === true
    && run.shadow_verified === true
    && run.cutover_ready === true
    && Number(run.source_count) > 0
    && Number(run.catalog_count) === Number(run.source_count)
    && run.source_hash === run.catalog_hash
  )) || null;
  if (!readyRun) {
    return { ready: false, code: 'catalog_not_imported', run: null };
  }
  // source_count/catalog_count and hashes prove the initial import. Subsequent
  // audited admin creates/archives must not make the entire Catalog unavailable;
  // completeness triggers protect every active row after that cutover.
  return { ready: true, code: 'ready', run: readyRun };
}

export function resolveVisibility(graph, offeringId, audience, context = {}) {
  if (!CATALOG_AUDIENCES.includes(audience)) return { visible: false, rule: null };
  const now = isoNow(context);
  const candidates = (graph.visibility || [])
    .filter((rule) => rule.offering_id === offeringId && rule.audience === audience && isEffective(rule, now))
    .sort((a, b) => String(b.effective_from || '').localeCompare(String(a.effective_from || '')));
  const rule = candidates[0] || null;
  return { visible: rule?.enabled === true, rule };
}

export function resolveAvailability(graph, offeringId, audience, context = {}) {
  const now = isoNow(context);
  const candidates = (graph.availability || [])
    .filter((rule) => (
      rule.offering_id === offeringId
      && rule.status === 'active'
      && (!rule.audience || rule.audience === audience)
      && isEffective(rule, now)
      && ruleContextMatches(rule, context)
    ))
    .sort((a, b) => (
      Number(b.priority || 0) - Number(a.priority || 0)
      || (a.effect === b.effect ? 0 : a.effect === 'deny' ? -1 : 1)
      || String(b.effective_from || '').localeCompare(String(a.effective_from || ''))
      || String(a.rule_key || '').localeCompare(String(b.rule_key || ''))
    ));
  const rule = candidates[0] || null;
  // Explicit allow is mandatory. No rule and unmatched rules are closed.
  return { available: rule?.effect === 'allow', rule };
}

export function resolveEffectivePrice(graph, offeringId, context = {}) {
  const now = isoNow(context);
  const candidates = (graph.prices || [])
    .filter((rule) => (
      rule.offering_id === offeringId
      && ['active', 'scheduled'].includes(rule.status)
      && isEffective(rule, now)
      && conditionsMatch(rule.conditions, context)
    ))
    .sort((a, b) => (
      Number(b.priority ?? PRICE_PRIORITIES[b.price_type] ?? 0)
        - Number(a.priority ?? PRICE_PRIORITIES[a.price_type] ?? 0)
      || String(b.effective_from || '').localeCompare(String(a.effective_from || ''))
      || String(b.created_at || '').localeCompare(String(a.created_at || ''))
      || String(a.rule_key || '').localeCompare(String(b.rule_key || ''))
    ));
  const rule = candidates[0] || null;
  return {
    price_cents: rule ? integerOrNull(rule.amount_cents) : null,
    currency: rule?.currency || null,
    compare_at_price_cents: rule ? integerOrNull(rule.compare_at_cents) : null,
    trace: rule ? {
      rule_key: rule.rule_key,
      price_type: rule.price_type,
      priority: Number(rule.priority ?? PRICE_PRIORITIES[rule.price_type] ?? 0),
      conditions: rule.conditions || {},
      effective_from: rule.effective_from || null,
      effective_to: rule.effective_to || null,
      reason: rule.reason || null,
    } : {
      rule_key: null,
      price_type: null,
      priority: null,
      conditions: {},
      effective_from: null,
      effective_to: null,
      reason: 'No matching active pricing rule.',
    },
  };
}

function resolveStoredStandardPrice(graph, offeringId, context = {}) {
  const now = isoNow(context);
  return (graph.prices || [])
    .filter((rule) => (
      rule.offering_id === offeringId
      && rule.price_type === 'standard'
      && ['active', 'scheduled'].includes(rule.status)
      && isEffective(rule, now)
      && (!rule.conditions || Object.keys(rule.conditions).length === 0)
    ))
    .sort((a, b) => (
      String(b.effective_from || '').localeCompare(String(a.effective_from || ''))
      || String(b.created_at || '').localeCompare(String(a.created_at || ''))
      || String(a.rule_key || '').localeCompare(String(b.rule_key || ''))
    ))[0] || null;
}

function presentationFor(graph, offeringId, audience) {
  return (graph.presentations || []).find((row) => (
    row.offering_id === offeringId && row.audience === audience && row.enabled === true
  )) || null;
}

function safeAllowedAddons(graph, offering, context, includePrice) {
  const offeringsById = byId(graph.offerings);
  return (graph.addonRelations || [])
    .filter((relation) => relation.parent_offering_id === offering.id && relation.allowed === true)
    .map((relation) => {
      const addon = offeringsById.get(relation.addon_offering_id);
      if (!addon || addon.status !== 'active') return null;
      const audience = includePrice ? 'client' : 'nurse';
      if (!resolveVisibility(graph, addon.id, audience, context).visible) return null;
      if (includePrice && !resolveVisibility(graph, addon.id, 'public', context).visible) return null;
      if (!resolveAvailability(graph, addon.id, audience, context).available) return null;
      const addonPresentation = presentationFor(graph, addon.id, audience)
        || presentationFor(graph, addon.id, 'client');
      if (!addonPresentation) return null;
      if (!includePrice) {
        return { id: addon.stable_key, public_name: addonPresentation.display_name || addon.public_name };
      }
      const price = resolveEffectivePrice(graph, addon.id, context);
      if (price.price_cents == null || price.price_cents <= 0) return null;
      if (price.currency !== 'USD') return null;
      return {
        id: addon.stable_key,
        public_name: addonPresentation.display_name || addon.public_name,
        price_cents: price.price_cents,
        currency: price.currency || 'USD',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.public_name.localeCompare(b.public_name));
}

/** Strict public/client allowlist. Offering objects must have no extra keys. */
export function projectClientCatalog(graph, context = {}) {
  const readiness = getCatalogReadiness(graph);
  if (!readiness.ready) {
    throw new CatalogError('OperationalSourceUnavailable', 'The live Catalog is not ready.', 503, {
      readiness: readiness.code,
    });
  }
  const categoriesById = byId(graph.categories);
  const offerings = (graph.offerings || [])
    .filter((offering) => offering.status === 'active')
    .sort((a, b) => compareDisplay(a, b, categoriesById))
    .map((offering) => {
      const category = categoriesById.get(offering.category_id);
      if (!category || category.status !== 'active') return null;
      // The public route is both a client surface and the public website; both
      // independently controlled visibility flags must be enabled.
      if (!resolveVisibility(graph, offering.id, 'client', context).visible) return null;
      if (!resolveVisibility(graph, offering.id, 'public', context).visible) return null;
      const availability = resolveAvailability(graph, offering.id, 'client', context);
      if (!availability.available) return null;
      const presentation = presentationFor(graph, offering.id, 'client');
      if (!presentation) return null;
      const price = resolveEffectivePrice(graph, offering.id, context);
      if (price.price_cents == null || price.price_cents <= 0) return null;
      if (price.currency !== 'USD') return null;
      const detailPath = safeDetailPath(presentation.detail_path);
      const bookingPath = safeBookingPath(presentation.booking_path);
      if (!detailPath || !bookingPath) return null;

      return {
        id: offering.stable_key,
        public_name: presentation.display_name || offering.public_name,
        short_name: offering.short_name || null,
        type: offering.offering_type,
        status: 'active',
        description: presentation.description || offering.description || null,
        short_description: presentation.short_description || offering.short_description || null,
        benefits: stringArray(presentation.benefits),
        estimated_duration_minutes: integerOrNull(offering.estimated_duration_minutes),
        display_order: Number(presentation.display_order ?? offering.display_order ?? 0),
        featured: presentation.featured === true || offering.featured === true,
        thumbnail_url: safeUrl(presentation.thumbnail_url),
        hero_url: safeUrl(presentation.hero_url),
        detail_path: detailPath,
        booking_path: bookingPath,
        price_cents: price.price_cents,
        currency: price.currency || 'USD',
        compare_at_price_cents: price.compare_at_price_cents,
        availability: { available: true },
        category: {
          key: category.stable_key,
          name: category.name,
          description: category.description || null,
          display_order: Number(category.display_order || 0),
        },
        included_items: stringArray(presentation.included_items),
        allowed_addons: safeAllowedAddons(graph, offering, context, true),
      };
    })
    .filter(Boolean);

  return { source: 'live', generated_at: new Date().toISOString(), offerings };
}

/** Strict nurse allowlist. No UUID, cost, margin, admin, or internal code. */
export function projectNurseCatalog(graph, context = {}) {
  const readiness = getCatalogReadiness(graph);
  if (!readiness.ready) {
    throw new CatalogError('OperationalSourceUnavailable', 'The live Catalog is not ready.', 503, {
      readiness: readiness.code,
    });
  }
  const categoriesById = byId(graph.categories);
  const inventoryByOffering = byOffering(graph.inventoryRequirements);
  const offerings = (graph.offerings || [])
    .filter((offering) => offering.status === 'active')
    .sort((a, b) => compareDisplay(a, b, categoriesById))
    .map((offering) => {
      const category = categoriesById.get(offering.category_id);
      if (!category || category.status !== 'active') return null;
      if (!resolveVisibility(graph, offering.id, 'nurse', context).visible) return null;
      const availability = resolveAvailability(graph, offering.id, 'nurse', context);
      if (!availability.available) return null;
      const presentation = presentationFor(graph, offering.id, 'nurse');
      if (!presentation) return null;
      // A marketing description is not a clinical fulfillment instruction.
      // Nurse publication requires a dedicated human-approved instruction and
      // numeric duration; incomplete rows stay closed instead of poisoning the
      // whole nurse menu contract.
      if (!stringOrNull(presentation.nurse_instructions, 8000)) return null;
      if (!Number.isFinite(Number(offering.estimated_duration_minutes)) || Number(offering.estimated_duration_minutes) <= 0) return null;
      const requirements = (inventoryByOffering.get(offering.id) || [])
        .map((row) => ({
          item_name: stringOrNull(row.inventory_item_name, 240),
          quantity: numberOrNull(row.quantity),
          unit: stringOrNull(row.unit, 80) || 'unit',
        }))
        .filter((row) => row.item_name && row.quantity != null);

      return {
        id: offering.stable_key,
        public_name: presentation.display_name || offering.public_name,
        type: offering.offering_type,
        status: 'active',
        version: Number(offering.version || 1),
        estimated_duration_minutes: integerOrNull(offering.estimated_duration_minutes),
        nurse_instructions: presentation.nurse_instructions || null,
        required_supplies: stringArray(offering.fulfillment_metadata?.required_supplies),
        availability: { available: true },
        category: {
          key: category.stable_key,
          name: category.name,
          display_order: Number(category.display_order || 0),
        },
        protocol_reference: stringOrNull(offering.clinical_metadata?.protocol_reference, 300),
        allowed_addons: safeAllowedAddons(graph, offering, context, false),
        inventory_requirements: requirements,
      };
    })
    .filter(Boolean);

  return { source: 'live', generated_at: new Date().toISOString(), offerings };
}

export function buildAdminDashboard(graph) {
  const readiness = getCatalogReadiness(graph);
  const categoriesById = byId(graph.categories);
  const presentationsByOffering = byOffering(graph.presentations);
  const visibilityByOffering = byOffering(graph.visibility);
  const availabilityByOffering = byOffering(graph.availability);
  const pricesByOffering = byOffering(graph.prices);
  const inventoryByOffering = byOffering(graph.inventoryRequirements);
  const addonRelationsByOffering = byOffering(
    (graph.addonRelations || []).map((row) => ({ ...row, offering_id: row.parent_offering_id })),
  );
  const packageItemsByOffering = byOffering(
    (graph.packageItems || []).map((row) => ({ ...row, offering_id: row.package_offering_id })),
  );

  const rows = (graph.offerings || [])
    .slice()
    .sort((a, b) => compareDisplay(a, b, categoriesById))
    .map((offering) => {
      const category = categoriesById.get(offering.category_id) || null;
      const presentationRows = presentationsByOffering.get(offering.id) || [];
      const clientPresentation = presentationRows.find((row) => row.audience === 'client') || null;
      const nursePresentation = presentationRows.find((row) => row.audience === 'nurse') || null;
      const visibility = Object.fromEntries(CATALOG_AUDIENCES.map((audience) => [
        audience,
        (visibilityByOffering.get(offering.id) || []).find((row) => row.audience === audience)?.enabled === true,
      ]));
      const storedStandardPrice = resolveStoredStandardPrice(graph, offering.id, {});
      const basePrice = storedStandardPrice ? {
        price_cents: integerOrNull(storedStandardPrice.amount_cents),
        compare_at_price_cents: integerOrNull(storedStandardPrice.compare_at_cents),
        currency: storedStandardPrice.currency || 'USD',
        trace: {
          rule_key: storedStandardPrice.rule_key,
          price_type: storedStandardPrice.price_type,
          priority: Number(storedStandardPrice.priority ?? PRICE_PRIORITIES.standard),
          conditions: storedStandardPrice.conditions || {},
          effective_from: storedStandardPrice.effective_from || null,
          effective_to: storedStandardPrice.effective_to || null,
          reason: storedStandardPrice.reason || null,
        },
      } : resolveEffectivePrice(graph, offering.id, {});
      const internalCost = integerOrNull(offering.financial_metadata?.internal_cost_cents);
      const marginCents = basePrice.price_cents != null && internalCost != null
        ? basePrice.price_cents - internalCost
        : null;
      const marginPercent = marginCents != null && basePrice.price_cents > 0
        ? Math.round((marginCents / basePrice.price_cents) * 1000) / 10
        : null;

      return {
        id: offering.id,
        stable_key: offering.stable_key,
        sku: offering.sku || null,
        internal_name: offering.internal_name,
        public_name: offering.public_name,
        short_name: offering.short_name || null,
        type: offering.offering_type,
        offering_type: offering.offering_type,
        category_id: offering.category_id,
        category: category ? {
          id: category.id,
          key: category.stable_key,
          name: category.name,
          display_order: Number(category.display_order || 0),
        } : null,
        status: offering.status,
        version: Number(offering.version || 1),
        description: offering.description || null,
        short_description: offering.short_description || null,
        internal_description: offering.internal_description || null,
        client_description: clientPresentation?.description || null,
        nurse_instructions: nursePresentation?.nurse_instructions || null,
        protocol_reference: offering.clinical_metadata?.protocol_reference || null,
        base_price_cents: basePrice.price_cents,
        compare_at_price_cents: basePrice.compare_at_price_cents,
        minimum_allowed_price_cents: integerOrNull(storedStandardPrice?.minimum_allowed_cents),
        currency: basePrice.currency || 'USD',
        internal_cost_cents: internalCost,
        margin_cents: marginCents,
        margin_percent: marginPercent,
        estimated_duration_minutes: integerOrNull(offering.estimated_duration_minutes),
        display_order: Number(offering.display_order || 0),
        featured: offering.featured === true,
        visibility,
        presentations: presentationRows,
        price_rules: pricesByOffering.get(offering.id) || [],
        availability_rules: availabilityByOffering.get(offering.id) || [],
        inventory_requirements: inventoryByOffering.get(offering.id) || [],
        addon_relations: addonRelationsByOffering.get(offering.id) || [],
        package_items: packageItemsByOffering.get(offering.id) || [],
        price_trace: basePrice.trace,
        updated_at: offering.updated_at || null,
      };
    });

  const active = rows.filter((row) => row.status === 'active');
  const clientVisible = active.filter((row) => row.visibility.client && row.visibility.public);
  const nurseVisible = active.filter((row) => row.visibility.nurse);
  return {
    source: 'live',
    readiness: {
      ready: readiness.ready,
      code: readiness.code,
      latest_import: readiness.run ? {
        id: readiness.run.id,
        status: readiness.run.status,
        source_count: Number(readiness.run.source_count || 0),
        catalog_count: Number(readiness.run.catalog_count || 0),
        shadow_verified: readiness.run.shadow_verified === true,
        cutover_ready: readiness.run.cutover_ready === true,
        verified_at: readiness.run.verified_at || null,
      } : null,
    },
    stats: {
      total: rows.length,
      active: active.length,
      draft: rows.filter((row) => row.status === 'draft').length,
      archived: rows.filter((row) => row.status === 'archived').length,
      client_visible: clientVisible.length,
      nurse_visible: nurseVisible.length,
      categories: (graph.categories || []).filter((row) => row.status === 'active').length,
    },
    offerings: rows,
    categories: graph.categories || [],
    price_rules: graph.prices || [],
    pricing_rules: graph.prices || [],
    availability_rules: graph.availability || [],
    inventory_requirements: graph.inventoryRequirements || [],
    inventory_mappings: graph.inventoryRequirements || [],
    aliases: graph.aliases || [],
    import_runs: graph.importRuns || [],
    audit_history: graph.audits || [],
  };
}

export function validateCompositeOffering(input, { update = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CatalogError('invalid_catalog_offering', 'An offering object is required.');
  }
  const publicName = stringOrNull(input.public_name, 240);
  const internalName = stringOrNull(input.internal_name, 240);
  if (!publicName && !internalName) {
    throw new CatalogError('invalid_catalog_name', 'Public name or internal name is required.');
  }
  const type = stringOrNull(input.type || input.offering_type, 80) || 'other';
  if (!CATALOG_OFFERING_TYPES.includes(type)) {
    throw new CatalogError('invalid_catalog_type', 'Offering type is not supported.');
  }
  const status = stringOrNull(input.status, 40) || 'draft';
  if (!['draft', 'active', 'inactive', 'scheduled', 'archived'].includes(status)) {
    throw new CatalogError('invalid_catalog_status', 'Offering status is not supported.');
  }
  const basePrice = input.base_price_cents == null || input.base_price_cents === ''
    ? null
    : integerOrNull(input.base_price_cents);
  if (basePrice != null && basePrice < 0) {
    throw new CatalogError('invalid_catalog_price', 'Price must be zero or greater.');
  }
  if (update && !Number.isInteger(Number(input.version)) && !Number.isInteger(Number(input.expected_version))) {
    throw new CatalogError('catalog_version_required', 'The current offering version is required for updates.', 409);
  }

  const visibility = {};
  for (const audience of CATALOG_AUDIENCES) visibility[audience] = input.visibility?.[audience] === true;
  if (input.visibility?.public_website === true) visibility.public = true;
  visibility.admin = true;

  return {
    ...input,
    internal_name: internalName || publicName,
    public_name: publicName || internalName,
    type,
    status,
    base_price_cents: basePrice,
    visibility,
  };
}

/**
 * Expand a sparse admin PATCH into the full composite DTO expected by the
 * atomic database save.  Omitted fields preserve their exact stored values;
 * explicit null/empty values remain explicit.  This prevents a name or price
 * edit from erasing clinical, fulfillment, media, or presentation data.
 */
export function mergeOfferingPatch(graph, existing, patch) {
  if (!existing?.id) throw new CatalogError('catalog_offering_not_found', 'Offering not found.', 404);
  const owns = (key) => Object.prototype.hasOwnProperty.call(patch || {}, key);
  const clientPresentation = (graph.presentations || []).find((row) => (
    row.offering_id === existing.id && row.audience === 'client'
  )) || {};
  const nursePresentation = (graph.presentations || []).find((row) => (
    row.offering_id === existing.id && row.audience === 'nurse'
  )) || {};
  const adminPresentation = (graph.presentations || []).find((row) => (
    row.offering_id === existing.id && row.audience === 'admin'
  )) || {};
  const storedStandardPrice = resolveStoredStandardPrice(graph, existing.id, {});
  const presentations = Object.fromEntries(CATALOG_AUDIENCES.map((audience) => {
    const row = (graph.presentations || []).find((candidate) => (
      candidate.offering_id === existing.id && candidate.audience === audience
    ));
    return [audience, row ? {
      display_name: row.display_name,
      description: row.description,
      short_description: row.short_description,
      nurse_instructions: row.nurse_instructions,
      admin_notes: row.admin_notes,
      benefits: row.benefits || [],
      use_cases: row.use_cases || [],
      included_items: row.included_items || [],
      hero_url: row.hero_url,
      thumbnail_url: row.thumbnail_url,
      icon: row.icon,
      detail_path: row.detail_path,
      booking_path: row.booking_path,
      display_order: row.display_order,
      featured: row.featured,
      metadata: row.metadata || {},
    } : {}];
  }));
  const visibility = Object.fromEntries(CATALOG_AUDIENCES.map((audience) => [
    audience,
    (graph.visibility || []).find((row) => (
      row.offering_id === existing.id && row.audience === audience
    ))?.enabled === true,
  ]));
  const mergedVisibility = {
    ...visibility,
    ...(patch?.visibility && typeof patch.visibility === 'object' ? patch.visibility : {}),
  };
  if (patch?.visibility?.public_website === true) mergedVisibility.public = true;
  if (patch?.visibility?.public_website === false) mergedVisibility.public = false;
  mergedVisibility.admin = true;

  const clinicalMetadata = {
    ...(existing.clinical_metadata || {}),
    ...(patch?.clinical_metadata && typeof patch.clinical_metadata === 'object' ? patch.clinical_metadata : {}),
  };
  if (owns('protocol_reference')) clinicalMetadata.protocol_reference = patch.protocol_reference;
  const fulfillmentMetadata = {
    ...(existing.fulfillment_metadata || {}),
    ...(patch?.fulfillment_metadata && typeof patch.fulfillment_metadata === 'object' ? patch.fulfillment_metadata : {}),
  };
  if (owns('required_supplies')) fulfillmentMetadata.required_supplies = patch.required_supplies;
  const financialMetadata = {
    ...(existing.financial_metadata || {}),
    ...(patch?.financial_metadata && typeof patch.financial_metadata === 'object' ? patch.financial_metadata : {}),
  };
  if (owns('internal_cost_cents')) financialMetadata.internal_cost_cents = patch.internal_cost_cents;
  if (owns('target_margin_percent')) financialMetadata.target_margin_percent = patch.target_margin_percent;

  const merged = {
    stable_key: existing.stable_key,
    sku: existing.sku,
    internal_name: existing.internal_name,
    public_name: existing.public_name,
    short_name: existing.short_name,
    type: existing.offering_type,
    category_id: existing.category_id,
    status: existing.status,
    description: existing.description,
    short_description: existing.short_description,
    internal_description: existing.internal_description,
    tags: existing.tags || [],
    estimated_duration_minutes: existing.estimated_duration_minutes,
    display_order: existing.display_order,
    featured: existing.featured,
    taxability: existing.taxability,
    discount_eligible: existing.discount_eligible,
    clinical_metadata: clinicalMetadata,
    fulfillment_metadata: fulfillmentMetadata,
    financial_metadata: financialMetadata,
    internal_cost_cents: financialMetadata.internal_cost_cents ?? null,
    target_margin_percent: financialMetadata.target_margin_percent ?? null,
    base_price_cents: integerOrNull(storedStandardPrice?.amount_cents),
    compare_at_price_cents: integerOrNull(storedStandardPrice?.compare_at_cents),
    minimum_allowed_price_cents: integerOrNull(storedStandardPrice?.minimum_allowed_cents),
    currency: storedStandardPrice?.currency || 'USD',
    client_description: clientPresentation.description ?? existing.description ?? null,
    nurse_instructions: nursePresentation.nurse_instructions ?? null,
    admin_notes: adminPresentation.admin_notes ?? null,
    benefits: clientPresentation.benefits || [],
    use_cases: clientPresentation.use_cases || [],
    included_items: clientPresentation.included_items || [],
    hero_url: clientPresentation.hero_url ?? null,
    thumbnail_url: clientPresentation.thumbnail_url ?? null,
    icon: clientPresentation.icon ?? null,
    detail_path: clientPresentation.detail_path ?? null,
    booking_path: clientPresentation.booking_path ?? null,
    visibility: mergedVisibility,
    presentations,
    version: existing.version,
  };

  const scalarKeys = [
    'sku', 'internal_name', 'public_name', 'short_name', 'type', 'offering_type',
    'category_id', 'category_key', 'status', 'description', 'short_description',
    'internal_description', 'tags', 'estimated_duration_minutes', 'display_order',
    'featured', 'taxability', 'discount_eligible', 'client_description',
    'nurse_instructions', 'admin_notes', 'benefits', 'use_cases', 'included_items', 'hero_url',
    'thumbnail_url', 'icon', 'detail_path', 'booking_path', 'internal_cost_cents',
    'target_margin_percent', 'base_price_cents', 'compare_at_price_cents',
    'minimum_allowed_price_cents', 'currency', 'availability_mode',
  ];
  for (const key of scalarKeys) {
    if (owns(key)) merged[key] = patch[key];
  }
  if (owns('offering_type') && !owns('type')) merged.type = patch.offering_type;
  merged.clinical_metadata = clinicalMetadata;
  merged.fulfillment_metadata = fulfillmentMetadata;
  merged.financial_metadata = financialMetadata;
  merged.visibility = mergedVisibility;
  return merged;
}

export function isAgentRequestedChange(body) {
  return body?.requested_by === 'agent'
    || Boolean(stringOrNull(body?.requested_by_agent, 200))
    || body?.approval_mode === 'request';
}

export function riskForAction(action) {
  if (['change_price', 'schedule_price_change'].includes(action)) return 'pricing';
  if (['set_visibility'].includes(action)) return 'visibility';
  if (['set_availability'].includes(action)) return 'availability';
  if (['activate_offering', 'archive_offering', 'import_legacy'].includes(action)) return 'activation';
  if (['update_clinical'].includes(action)) return 'clinical';
  return 'other';
}

export function publicProjectionComparable(projected) {
  return (projected?.offerings || []).map((row) => ({
    id: row.id,
    public_name: row.public_name,
    short_name: row.short_name,
    type: row.type,
    status: row.status,
    description: row.description,
    short_description: row.short_description,
    benefits: row.benefits,
    estimated_duration_minutes: row.estimated_duration_minutes,
    display_order: row.display_order,
    featured: row.featured,
    thumbnail_url: row.thumbnail_url,
    hero_url: row.hero_url,
    detail_path: row.detail_path,
    booking_path: row.booking_path,
    price_cents: row.price_cents,
    currency: row.currency,
    compare_at_price_cents: row.compare_at_price_cents,
    availability: row.availability,
    category: row.category,
    included_items: row.included_items,
    allowed_addons: row.allowed_addons,
  }));
}

export function catalogStableKeys(graph) {
  return byStableKey(graph?.offerings || []);
}
