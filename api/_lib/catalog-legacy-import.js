import { createHash } from 'node:crypto';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS, PACKAGES } from '../../src/data/catalog.js';
import { productsByCategory } from '../../src/data/catalog/products-by-category.js';
import { slugify } from '../../src/data/catalog/slugify.js';
import {
  CatalogError,
  loadCatalogGraph,
  projectClientCatalog,
  publicProjectionComparable,
} from './catalog-core.js';

const SOURCE_NAME = 'legacy_products_by_category';
const SOURCE_VERSION = 'productsByCategory-v1';
const PUBLIC_CATEGORY_ORDER = Object.freeze(['iv-vitamins', 'nad', 'cbd', 'iv-addons', 'shots']);
const ADDON_CATEGORY_KEYS = new Set(['iv-addons', 'shots']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function hashCanonical(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function parseMoneyCents(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate * 100);
    }
    if (typeof candidate !== 'string') continue;
    const parsed = Number(candidate.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 100);
  }
  return null;
}

function durationMinutesFromText(value) {
  if (typeof value !== 'string') return null;
  const text = value.toLowerCase();
  const range = text.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(hr|hour|min)/);
  if (range) {
    const maximum = Number(range[2]);
    return Math.round(maximum * (range[3].startsWith('h') ? 60 : 1));
  }
  const single = text.match(/(\d+(?:\.\d+)?)\s*(hr|hour|min)/);
  if (!single) return null;
  return Math.round(Number(single[1]) * (single[2].startsWith('h') ? 60 : 1));
}

function sourceDurationMinutes(treatment) {
  const direct = durationMinutesFromText(treatment.duration);
  if (direct) return direct;
  const timeline = Array.isArray(treatment.timeline) ? treatment.timeline : [];
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const minutes = durationMinutesFromText(timeline[index]?.value);
    if (minutes) return minutes;
  }
  return null;
}

function offeringType(categoryKey) {
  if (categoryKey === 'iv-addons') return 'add_on';
  if (categoryKey === 'shots') return 'im_injection';
  return 'iv_treatment';
}

function categoryRows() {
  return PUBLIC_CATEGORY_ORDER.map((stableKey, displayOrder) => {
    const category = productsByCategory[stableKey];
    if (!category) throw new CatalogError('legacy_category_missing', `Missing source category: ${stableKey}`, 500);
    return {
      stable_key: stableKey,
      name: category.categoryLabel || category.title,
      description: category.description || null,
      display_order: displayOrder,
    };
  });
}

function sourceFulfillmentItems(treatment) {
  if (Array.isArray(treatment.included)) {
    return treatment.included.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  }
  return [];
}

function buildOfferingRows(categories) {
  const categoryOrder = new Map(categories.map((category) => [category.stable_key, category.display_order]));
  const rows = [];
  for (const categoryKey of PUBLIC_CATEGORY_ORDER) {
    const category = productsByCategory[categoryKey];
    category.treatments.forEach((treatment, displayOrder) => {
      const stableKey = slugify(treatment.name);
      const priceCents = parseMoneyCents(treatment.oneTime, treatment.price);
      if (!stableKey || !priceCents) {
        throw new CatalogError('legacy_offering_invalid', `Source offering is missing stable identity or positive price: ${treatment.name}`, 500);
      }
      const requiredSupplies = sourceFulfillmentItems(treatment);
      const duration = sourceDurationMinutes(treatment);
      // The current legacy sources do not contain a dedicated, approved nurse
      // instruction field. Marketing descriptions and ingredient lists are not
      // relabelled as clinical guidance, so every imported row stays nurse-
      // closed until an authorized human supplies fulfillment instructions.
      const nurseReady = false;
      rows.push({
        stable_key: stableKey,
        sku: `AV-${stableKey.toUpperCase()}`,
        internal_name: treatment.name,
        public_name: treatment.name,
        short_name: treatment.name,
        offering_type: offeringType(categoryKey),
        category_key: categoryKey,
        category_name: category.categoryLabel || category.title,
        category_description: category.description || null,
        category_display_order: categoryOrder.get(categoryKey),
        description: treatment.benefitStatement || treatment.desc || null,
        short_description: treatment.benefitStatement || treatment.desc || null,
        benefits: Array.isArray(treatment.benefits) ? treatment.benefits : [],
        use_cases: Array.isArray(treatment.idealFor) ? treatment.idealFor : [],
        included_items: requiredSupplies,
        required_supplies: requiredSupplies,
        nurse_instructions: null,
        nurse_ready: nurseReady,
        estimated_duration_minutes: duration,
        display_order: displayOrder,
        featured: false,
        thumbnail_url: treatment.image || null,
        hero_url: treatment.image || null,
        detail_path: `/products/${categoryKey}/${stableKey}`,
        booking_path: `/book?protocol=${encodeURIComponent(treatment.protocolKey || stableKey)}`,
        price_cents: priceCents,
        compare_at_price_cents: null,
        currency: 'USD',
        treatment_type: offeringType(categoryKey),
        protocol_reference: treatment.protocolKey || treatment.doseKey || stableKey,
        requires_clinical_review: !ADDON_CATEGORY_KEYS.has(categoryKey),
        tags: [categoryKey],
        allowed_addon_keys: [],
      });
    });
  }

  const addonKeys = rows
    .filter((row) => ['add_on', 'im_injection'].includes(row.offering_type))
    .map((row) => row.stable_key);
  for (const row of rows) {
    if (row.offering_type === 'iv_treatment') row.allowed_addon_keys = addonKeys.slice();
  }
  return rows;
}

const LEGACY_PRODUCT_SLUG_ALIASES = Object.freeze({
  'iv-vitamins': {
    dehydration: 'hydration-iv',
    hydration: 'hydration-iv',
    myers: 'myers-cocktail-iv',
    'myers-cocktail': 'myers-cocktail-iv',
    postnight: 'post-night-out-iv',
    'post-night-out': 'post-night-out-iv',
    immunity: 'immunity-iv',
    energy: 'energy-iv',
    recovery: 'recovery-iv',
    travel: 'jet-lag-iv',
    'travel-iv': 'jet-lag-iv',
    'night-out-iv': 'post-night-out-iv',
    'launch-performance': 'event-performance-iv',
    'launch-recovery': 'recovery-iv',
    'food-poisoning': 'food-poisoning-iv',
  },
  nad: {
    'nad-250mg': 'nad-iv-250mg',
    'nad-500mg': 'nad-iv-500mg',
    'nad-750mg': 'nad-iv-750mg',
    'nad-1000mg': 'nad-iv-1000mg',
    'nad-1250mg': 'nad-iv-1250mg',
    'nad-1500mg': 'nad-iv-1500mg',
    'nad-vitality': 'nad-iv-vitality',
  },
  shots: {
    glutathione: 'glutathione-im-200mg',
    nad: 'nad-im-50mg',
  },
  cbd: {
    'cbd-33mg': 'cbd-iv-33mg',
    'cbd-66mg': 'cbd-iv-66mg',
    'cbd-99mg': 'cbd-iv-99mg',
    'cbd-132mg': 'cbd-iv-132mg',
    'cbd-vitality': 'cbd-iv-vitality',
  },
});

function buildAliases(offerings) {
  const known = new Set(offerings.map((row) => row.stable_key));
  const aliases = [];
  const identities = new Map();
  const add = (namespace, aliasKey, offeringKey, source) => {
    if (!known.has(offeringKey)) throw new CatalogError('legacy_alias_target_missing', `Alias target missing: ${offeringKey}`, 500);
    const identity = `${namespace}:${aliasKey}`;
    const existing = identities.get(identity);
    if (existing && existing !== offeringKey) {
      throw new CatalogError('legacy_alias_ambiguous', `Ambiguous source alias: ${identity}`, 500);
    }
    if (existing) return;
    identities.set(identity, offeringKey);
    aliases.push({ namespace, alias_key: aliasKey, offering_key: offeringKey, source });
  };

  for (const row of offerings) {
    add('public_slug', row.stable_key, row.stable_key, 'productsByCategory');
    add('detail_path', row.detail_path, row.stable_key, 'productsByCategory');
    add('legacy_product_name', row.public_name.toLowerCase(), row.stable_key, 'productsByCategory');
  }
  for (const [categoryKey, mapping] of Object.entries(LEGACY_PRODUCT_SLUG_ALIASES)) {
    for (const [legacySlug, offeringKey] of Object.entries(mapping)) {
      add('legacy_product_slug', `${categoryKey}/${legacySlug}`, offeringKey, 'productsByCategory-aliases');
    }
  }

  const sessionKeyTargets = {
    hydration: 'hydration-iv',
    energy: 'energy-iv',
    immunity: 'immunity-iv',
    beauty: 'beauty-iv',
    recovery: 'recovery-iv',
    jetlag: 'jet-lag-iv',
    myers: 'myers-cocktail-iv',
    postnight: 'post-night-out-iv',
  };
  for (const session of IV_SESSIONS) {
    if (sessionKeyTargets[session.key]) {
      add('legacy_protocol_key', session.key, sessionKeyTargets[session.key], 'IV_SESSIONS');
      add('legacy_cart_key', session.key, sessionKeyTargets[session.key], 'IV_SESSIONS');
    }
    for (const dose of session.doses || []) {
      const prefix = session.key === 'nad' ? 'nad-iv-' : 'cbd-iv-';
      const suffix = dose.key.endsWith('_vitality') ? 'vitality' : `${dose.label.toLowerCase()}`;
      const offeringKey = `${prefix}${suffix}`;
      add('legacy_dose_key', dose.key, offeringKey, 'IV_SESSIONS');
      add('legacy_cart_key', dose.key, offeringKey, 'IV_SESSIONS');
    }
  }
  for (const addon of IV_ADDONS) {
    const addonSlug = slugify(addon.label);
    if (known.has(addonSlug)) add('legacy_addon_slug', addonSlug, addonSlug, 'IV_ADDONS');
  }
  for (const shot of IM_SHOTS) {
    const shotSlug = slugify(shot.label);
    add('legacy_shot_slug', shotSlug, shotSlug, 'IM_SHOTS');
  }

  return aliases.sort((a, b) => (
    a.namespace.localeCompare(b.namespace) || a.alias_key.localeCompare(b.alias_key)
  ));
}

function packageReconciliation(offerings) {
  const normalizedNames = new Map(offerings.map((row) => [
    row.public_name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    row.stable_key,
  ]));
  return PACKAGES.map((legacyPackage) => {
    const components = (legacyPackage.items || []).map((item) => {
      const normalized = String(item.label || '').toLowerCase()
        .replace(/^im/, '')
        .replace(/^addon/, '')
        .replace(/shot|addon/g, '')
        .replace(/[^a-z0-9]+/g, '');
      return {
        source_label: item.label,
        offering_key: normalizedNames.get(normalized) || null,
      };
    });
    return {
      key: legacyPackage.key,
      name: legacyPackage.label,
      disposition: 'excluded_non_public',
      reason: 'PACKAGES is not the current public productsByCategory source; incomplete legacy bundles are never activated implicitly.',
      resolved_components: components.filter((component) => component.offering_key).length,
      unresolved_components: components.filter((component) => !component.offering_key).map((component) => component.source_label),
    };
  });
}

function sourceComparable(categories, offerings) {
  const categoriesByKey = new Map(categories.map((category) => [category.stable_key, category]));
  const offeringsByKey = new Map(offerings.map((offering) => [offering.stable_key, offering]));
  return offerings.map((row) => {
    const category = categoriesByKey.get(row.category_key);
    const allowedAddons = row.allowed_addon_keys.map((key) => {
      const addon = offeringsByKey.get(key);
      return {
        id: addon.stable_key,
        public_name: addon.public_name,
        price_cents: addon.price_cents,
        currency: addon.currency,
      };
    }).sort((a, b) => a.public_name.localeCompare(b.public_name));
    return {
      id: row.stable_key,
      public_name: row.public_name,
      short_name: row.short_name,
      type: row.offering_type,
      status: 'active',
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
      availability: { available: true },
      category: {
        key: category.stable_key,
        name: category.name,
        description: category.description,
        display_order: category.display_order,
      },
      included_items: row.included_items,
      allowed_addons: allowedAddons,
    };
  });
}

export function buildLegacyCatalogManifest() {
  const categories = categoryRows();
  const offerings = buildOfferingRows(categories);
  if (offerings.length !== 37 || new Set(offerings.map((row) => row.stable_key)).size !== 37) {
    throw new CatalogError('legacy_public_count_mismatch', 'Current public source must contain exactly 37 unique offerings.', 500);
  }
  const aliases = buildAliases(offerings);
  const comparable = sourceComparable(categories, offerings);
  return {
    sourceName: SOURCE_NAME,
    sourceVersion: SOURCE_VERSION,
    categories,
    offerings,
    aliases,
    comparable,
    sourceHash: hashCanonical(comparable),
    reconciliation: {
      public_source: 'src/data/catalog/products-by-category.js',
      public_offering_count: offerings.length,
      exact_public_source_required: true,
      package_policy: 'excluded_non_public',
      packages: packageReconciliation(offerings),
      nurse_policy: 'Only source rows with explicit fulfillment items and numeric source duration are nurse-visible.',
    },
  };
}

async function recordFailedRun(db, { tenantId, actorId, manifest, code, detail }) {
  const { data: existing } = await db.from('catalog_import_runs')
    .select('id,status,cutover_ready')
    .eq('tenant_id', tenantId)
    .eq('source_name', manifest.sourceName)
    .eq('source_hash', manifest.sourceHash)
    .maybeSingle();
  // A transient retry failure must never downgrade a previously verified
  // source hash. Readiness is immutable for that exact successful import.
  if (existing?.status === 'succeeded' && existing?.cutover_ready === true) return;
  const row = {
    tenant_id: tenantId,
    source_name: manifest.sourceName,
    source_version: manifest.sourceVersion,
    idempotency_key: `legacy:${manifest.sourceHash}`,
    source_hash: manifest.sourceHash,
    status: 'failed',
    source_count: manifest.offerings.length,
    catalog_count: 0,
    exact_match: false,
    shadow_verified: false,
    cutover_ready: false,
    source_manifest: {
      categories: manifest.categories,
      offerings: manifest.offerings,
      aliases: manifest.aliases,
    },
    reconciliation: manifest.reconciliation,
    error_code: String(code || 'legacy_import_failed').slice(0, 120),
    error_detail: String(detail || 'Legacy Catalog import failed.').slice(0, 1000),
    created_by: actorId,
  };
  const mutation = existing?.id
    ? db.from('catalog_import_runs').update(row)
      .eq('tenant_id', tenantId).eq('id', existing.id).neq('status', 'succeeded')
    : db.from('catalog_import_runs').insert(row);
  const { error } = await mutation;
  if (error) {
    // The primary failure remains authoritative; this best-effort ledger write
    // must not replace it with a second error.
    console.warn('[catalog-import] could not record failed run', { code: error.code || 'failure_ledger_error' });
  }
}

export async function importLegacyCatalog(db, { tenantId, actorId, reason }) {
  if (!db || !tenantId || !actorId) {
    throw new CatalogError('catalog_import_identity_required', 'Tenant and admin identity are required.', 400);
  }
  if (typeof reason !== 'string' || reason.trim().length < 2) {
    throw new CatalogError('catalog_import_reason_required', 'A reason is required for import.', 400);
  }
  const manifest = buildLegacyCatalogManifest();
  const idempotencyKey = `legacy:${manifest.sourceHash}`;
  let applied;
  try {
    const { data, error } = await db.rpc('catalog_apply_legacy_import', {
      p_tenant_id: tenantId,
      p_actor_id: actorId,
      p_source_name: manifest.sourceName,
      p_source_version: manifest.sourceVersion,
      p_idempotency_key: idempotencyKey,
      p_source_hash: manifest.sourceHash,
      p_categories: manifest.categories,
      p_offerings: manifest.offerings,
      p_aliases: manifest.aliases,
      p_reconciliation: { ...manifest.reconciliation, admin_reason: reason.trim() },
    });
    if (error) throw Object.assign(new Error('Catalog import transaction failed.'), { code: error.code, cause: error });
    applied = data;
  } catch (error) {
    await recordFailedRun(db, {
      tenantId,
      actorId,
      manifest,
      code: error.code || 'legacy_import_failed',
      detail: error.message,
    });
    throw new CatalogError('catalog_import_failed', 'Catalog import did not commit.', 500);
  }

  if (applied?.status === 'succeeded' && applied?.idempotent === true) {
    const graph = await loadCatalogGraph(db, tenantId);
    const projection = projectClientCatalog(graph);
    return { run: applied, projection, manifest };
  }

  const graph = await loadCatalogGraph(db, tenantId);
  const runId = applied?.run_id;
  const verifyingRun = (graph.importRuns || []).find((run) => run.id === runId);
  if (!verifyingRun || verifyingRun.status !== 'verifying') {
    throw new CatalogError('catalog_import_verification_missing', 'Catalog import could not enter verification.', 500);
  }

  // Independently render the exact public contract.  A synthetic readiness
  // row permits this server-internal shadow render only; no API can return it
  // before catalog_finalize_import commits cutover_ready=true.
  const shadowGraph = {
    ...graph,
    importRuns: [{
      ...verifyingRun,
      status: 'succeeded',
      exact_match: true,
      shadow_verified: true,
      cutover_ready: true,
      catalog_hash: manifest.sourceHash,
    }],
  };
  let projection;
  let projectedHash;
  try {
    projection = projectClientCatalog(shadowGraph);
    projectedHash = hashCanonical(publicProjectionComparable(projection));
  } catch (error) {
    await db.from('catalog_import_runs').update({
      status: 'failed',
      error_code: 'shadow_projection_failed',
      error_detail: String(error.message || 'Shadow projection failed.').slice(0, 1000),
      exact_match: false,
      shadow_verified: false,
      cutover_ready: false,
      verified_at: new Date().toISOString(),
    }).eq('tenant_id', tenantId).eq('id', runId)
      .in('status', ['running', 'verifying', 'failed']).eq('cutover_ready', false);
    throw new CatalogError('catalog_shadow_projection_failed', 'Catalog shadow projection failed.', 500);
  }

  if (projectedHash !== manifest.sourceHash) {
    await db.from('catalog_import_runs').update({
      status: 'failed',
      catalog_hash: projectedHash,
      error_code: 'shadow_mismatch',
      error_detail: 'Rendered public Catalog did not exactly match productsByCategory.',
      exact_match: false,
      shadow_verified: false,
      cutover_ready: false,
      verified_at: new Date().toISOString(),
    }).eq('tenant_id', tenantId).eq('id', runId)
      .in('status', ['running', 'verifying', 'failed']).eq('cutover_ready', false);
    throw new CatalogError('catalog_shadow_mismatch', 'Catalog shadow comparison did not match.', 409);
  }

  const { data: finalized, error: finalizeError } = await db.rpc('catalog_finalize_import', {
    p_tenant_id: tenantId,
    p_actor_id: actorId,
    p_run_id: runId,
    p_catalog_hash: projectedHash,
  });
  if (finalizeError || finalized?.status !== 'succeeded' || finalized?.exact_match !== true) {
    throw new CatalogError('catalog_import_finalize_failed', 'Catalog import was not activated.', 500);
  }

  const finalGraph = await loadCatalogGraph(db, tenantId);
  const finalProjection = projectClientCatalog(finalGraph);
  if (finalProjection.offerings.length !== 37) {
    throw new CatalogError('catalog_final_projection_incomplete', 'Final Catalog projection is incomplete.', 500);
  }
  return { run: finalized, projection: finalProjection, manifest };
}
