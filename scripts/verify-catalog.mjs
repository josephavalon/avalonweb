import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  buildAdminDashboard,
  getCatalogReadiness,
  mergeOfferingPatch,
  projectClientCatalog,
  projectNurseCatalog,
  publicProjectionComparable,
  resolveAvailability,
  resolveEffectivePrice,
  validateCompositeOffering,
} from '../api/_lib/catalog-core.js';
import {
  buildLegacyCatalogManifest,
  hashCanonical,
} from '../api/_lib/catalog-legacy-import.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

function syntheticGraph(manifest) {
  const tenantId = 'tenant-internal';
  const categories = manifest.categories.map((row) => ({
    id: `category-internal-${row.stable_key}`,
    tenant_id: tenantId,
    ...row,
    status: 'active',
  }));
  const categoryId = new Map(categories.map((row) => [row.stable_key, row.id]));
  const offerings = manifest.offerings.map((row) => ({
    id: `offering-internal-${row.stable_key}`,
    tenant_id: tenantId,
    stable_key: row.stable_key,
    sku: row.sku,
    internal_name: row.internal_name,
    public_name: row.public_name,
    short_name: row.short_name,
    offering_type: row.offering_type,
    category_id: categoryId.get(row.category_key),
    status: 'active',
    description: row.description,
    short_description: row.short_description,
    internal_description: 'operator only',
    tags: row.tags,
    estimated_duration_minutes: row.estimated_duration_minutes,
    display_order: row.display_order,
    featured: row.featured,
    clinical_metadata: {
      protocol_reference: row.protocol_reference,
      requires_clinical_review: row.requires_clinical_review,
    },
    fulfillment_metadata: { required_supplies: row.required_supplies },
    financial_metadata: { internal_cost_cents: 1234 },
    imported_source: manifest.sourceName,
    version: 1,
  }));
  const offeringId = new Map(offerings.map((row) => [row.stable_key, row.id]));
  const presentations = [];
  const visibility = [];
  const availability = [];
  const prices = [];
  const addonRelations = [];
  for (const row of manifest.offerings) {
    const id = offeringId.get(row.stable_key);
    for (const audience of ['client', 'public', 'admin', 'nurse']) {
      const enabled = audience !== 'nurse';
      presentations.push({
        id: `presentation-${audience}-${row.stable_key}`,
        tenant_id: tenantId,
        offering_id: id,
        audience,
        enabled,
        display_name: row.public_name,
        description: row.description,
        short_description: row.short_description,
        nurse_instructions: null,
        admin_notes: audience === 'admin' ? 'preserve me' : null,
        benefits: row.benefits,
        use_cases: row.use_cases,
        included_items: row.included_items,
        hero_url: row.hero_url,
        thumbnail_url: row.thumbnail_url,
        detail_path: row.detail_path,
        booking_path: row.booking_path,
        display_order: row.display_order,
        featured: row.featured,
        metadata: { preserved: true },
      });
      visibility.push({
        id: `visibility-${audience}-${row.stable_key}`,
        tenant_id: tenantId,
        offering_id: id,
        audience,
        enabled,
        effective_from: '2020-01-01T00:00:00.000Z',
      });
      if (enabled && audience !== 'admin') {
        availability.push({
          id: `availability-${audience}-${row.stable_key}`,
          tenant_id: tenantId,
          offering_id: id,
          rule_key: `global-${audience}`,
          effect: 'allow',
          audience,
          context_type: 'global',
          priority: 100,
          status: 'active',
          effective_from: '2020-01-01T00:00:00.000Z',
          conditions: {},
          days_of_week: [],
        });
      }
    }
    prices.push({
      id: `price-${row.stable_key}`,
      tenant_id: tenantId,
      offering_id: id,
      rule_key: 'legacy-standard',
      price_type: 'standard',
      amount_cents: row.price_cents,
      compare_at_cents: row.compare_at_price_cents,
      currency: row.currency,
      priority: 100,
      conditions: {},
      status: 'active',
      effective_from: '2020-01-01T00:00:00.000Z',
      reason: 'source',
    });
    for (const addonKey of row.allowed_addon_keys) {
      addonRelations.push({
        id: `relation-${row.stable_key}-${addonKey}`,
        tenant_id: tenantId,
        parent_offering_id: id,
        addon_offering_id: offeringId.get(addonKey),
        allowed: true,
      });
    }
  }
  const succeededRun = {
    id: 'run-success',
    tenant_id: tenantId,
    source_name: manifest.sourceName,
    status: 'succeeded',
    source_count: 37,
    catalog_count: 37,
    source_hash: manifest.sourceHash,
    catalog_hash: manifest.sourceHash,
    exact_match: true,
    shadow_verified: true,
    cutover_ready: true,
    created_at: '2026-08-30T12:00:00.000Z',
  };
  return {
    tenantId,
    categories,
    offerings,
    presentations,
    prices,
    visibility,
    availability,
    addonRelations,
    packageItems: [],
    inventoryRequirements: [],
    contextOfferings: [],
    compensationRefs: [],
    aliases: manifest.aliases,
    importRuns: [succeededRun],
    audits: [],
  };
}

const manifest = buildLegacyCatalogManifest();
assert.equal(manifest.categories.length, 5, 'exact five currently rendered public categories');
assert.equal(manifest.offerings.length, 37, 'exact current productsByCategory row count');
assert.equal(new Set(manifest.offerings.map((row) => row.stable_key)).size, 37, 'stable Offering keys are unique');
assert.ok(manifest.offerings.every((row) => row.price_cents > 0 && row.currency === 'USD'), 'all public prices are positive USD cents');
assert.ok(manifest.offerings.some((row) => row.stable_key === 'event-performance-iv'), 'current Event Performance IV is imported');
assert.ok(manifest.offerings.some((row) => row.stable_key === 'food-poisoning-iv'), 'current Food Poisoning IV is imported');
assert.ok(manifest.offerings.some((row) => row.stable_key === 'nad-myers-cocktail-iv'), 'current NAD+ Myers Cocktail IV is imported');
assert.equal(manifest.offerings.filter((row) => row.nurse_ready).length, 0, 'legacy marketing data never becomes approved nurse guidance');
assert.ok(manifest.offerings.every((row) => row.nurse_instructions == null), 'no nurse instruction is derived from supply labels');
assert.ok(manifest.reconciliation.packages.every((row) => row.disposition === 'excluded_non_public'), 'legacy packages cannot silently publish');
assert.ok(manifest.reconciliation.packages.some((row) => row.unresolved_components.length > 0), 'incomplete legacy package components are explicitly recorded');
assert.equal(new Set(manifest.aliases.map((row) => `${row.namespace}:${row.alias_key}`)).size, manifest.aliases.length, 'aliases resolve uniquely');

const graph = syntheticGraph(manifest);
const client = projectClientCatalog(graph, { channel: 'public_website', now: new Date('2026-08-30T12:00:00.000Z') });
assert.equal(client.source, 'live');
assert.equal(client.offerings.length, 37);
const clientKeys = [
  'id', 'public_name', 'short_name', 'type', 'status', 'description',
  'short_description', 'benefits', 'estimated_duration_minutes', 'display_order',
  'featured', 'thumbnail_url', 'hero_url', 'detail_path', 'booking_path',
  'price_cents', 'currency', 'compare_at_price_cents', 'availability', 'category',
  'included_items', 'allowed_addons',
].sort();
assert.deepEqual(Object.keys(client.offerings[0]).sort(), clientKeys, 'public Offering has exact allowlist keys');
assert.ok(client.offerings.every((row) => !row.id.match(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i)), 'public IDs are stable keys, never UUIDs');
assert.doesNotMatch(JSON.stringify(client), /internal_cost|margin|clinical_metadata|admin_notes|sku/i, 'public projection excludes sensitive/internal fields');
assert.equal(hashCanonical(publicProjectionComparable(client)), manifest.sourceHash, 'one canonical comparison schema proves exact public shadow match');

const nurseEmpty = projectNurseCatalog(graph, { channel: 'nurse_portal', now: new Date('2026-08-30T12:00:00.000Z') });
assert.deepEqual(nurseEmpty.offerings, [], 'nurse menu remains closed without dedicated approved instructions');
const approvedGraph = structuredClone(graph);
const approved = approvedGraph.offerings[0];
const nursePresentation = approvedGraph.presentations.find((row) => row.offering_id === approved.id && row.audience === 'nurse');
nursePresentation.enabled = true;
nursePresentation.nurse_instructions = 'Approved fulfillment instruction.';
approvedGraph.visibility.find((row) => row.offering_id === approved.id && row.audience === 'nurse').enabled = true;
approvedGraph.availability.push({
  id: 'approved-nurse-availability', offering_id: approved.id, rule_key: 'approved-nurse',
  effect: 'allow', audience: 'nurse', context_type: 'global', priority: 100,
  status: 'active', effective_from: '2020-01-01T00:00:00.000Z', conditions: {}, days_of_week: [],
});
const nurse = projectNurseCatalog(approvedGraph, { channel: 'nurse_portal', now: new Date('2026-08-30T12:00:00.000Z') });
assert.equal(nurse.offerings.length, 1);
assert.deepEqual(Object.keys(nurse.offerings[0]).sort(), [
  'id', 'public_name', 'type', 'status', 'version', 'estimated_duration_minutes',
  'nurse_instructions', 'required_supplies', 'availability', 'category',
  'protocol_reference', 'allowed_addons', 'inventory_requirements',
].sort(), 'nurse Offering has exact allowlist keys');
assert.doesNotMatch(JSON.stringify(nurse), /price|cost|margin|admin_notes|sku|requires_clinical/i, 'nurse projection excludes price and internal fields');

const failedAttempt = {
  id: 'run-failed', status: 'failed', source_count: 37, catalog_count: 0,
  source_hash: 'f'.repeat(64), catalog_hash: null, exact_match: false,
  shadow_verified: false, cutover_ready: false, created_at: '2026-08-30T13:00:00.000Z',
};
assert.equal(getCatalogReadiness({ ...graph, importRuns: [failedAttempt, graph.importRuns[0]] }).ready, true,
  'new failed ledger row after an RPC rollback preserves unchanged prior cutover');
const invalidatedPrior = { ...graph.importRuns[0], cutover_ready: false };
const verifying = { ...failedAttempt, id: 'run-verifying', status: 'verifying' };
assert.equal(getCatalogReadiness({ ...graph, importRuns: [verifying, invalidatedPrior] }).ready, false,
  'committed verifying import invalidates prior cutover and fails closed');

const archivedGraph = structuredClone(graph);
archivedGraph.offerings[0].status = 'archived';
assert.equal(projectClientCatalog(archivedGraph).offerings.length, 36,
  'audited post-cutover archive does not invalidate the original import proof');
const zeroGraph = structuredClone(graph);
zeroGraph.prices[0].amount_cents = 0;
assert.equal(projectClientCatalog(zeroGraph).offerings.length, 36, 'zero-price public Offering fails closed at projection');
const malformedPathGraph = structuredClone(graph);
malformedPathGraph.presentations.find((row) => (
  row.offering_id === malformedPathGraph.offerings[0].id && row.audience === 'client'
)).detail_path = '/unsafe/internal-route';
assert.equal(projectClientCatalog(malformedPathGraph).offerings.length, 36,
  'malformed client route is omitted server-side instead of poisoning the public payload');

const closedGraph = structuredClone(graph);
closedGraph.availability = closedGraph.availability.filter((row) => row.offering_id !== closedGraph.offerings[0].id);
assert.equal(projectClientCatalog(closedGraph).offerings.length, 36, 'no availability rule defaults closed');
const weekdayGraph = structuredClone(graph);
const weekdayRule = weekdayGraph.availability.find((row) => row.offering_id === weekdayGraph.offerings[0].id && row.audience === 'client');
weekdayRule.days_of_week = [0, 1, 2, 3, 4, 5, 6];
assert.equal(resolveAvailability(weekdayGraph, weekdayGraph.offerings[0].id, 'client', { now: new Date() }).available, false,
  'weekday availability needs an explicit local day, never a UTC guess');
const inventoryGraph = structuredClone(graph);
const inventoryRule = inventoryGraph.availability.find((row) => row.offering_id === inventoryGraph.offerings[0].id && row.audience === 'client');
inventoryRule.require_inventory = true;
assert.equal(resolveAvailability(inventoryGraph, inventoryGraph.offerings[0].id, 'client', {}).available, false,
  'inventory-required availability fails closed without a verified inventory signal');
assert.equal(resolveAvailability(inventoryGraph, inventoryGraph.offerings[0].id, 'client', { inventory_available: true }).available, true,
  'inventory-required availability opens only with an explicit verified signal');

const priceGraph = structuredClone(graph);
priceGraph.prices.push({
  ...priceGraph.prices[0], id: 'contract-price', rule_key: 'contract', price_type: 'contract',
  amount_cents: 12345, priority: 1000, conditions: { contract_key: 'alpha' },
});
assert.equal(resolveEffectivePrice(priceGraph, priceGraph.offerings[0].id, { contract_key: 'alpha' }).price_cents, 12345,
  'contract price deterministically beats standard');
assert.equal(resolveEffectivePrice(priceGraph, priceGraph.offerings[0].id, {}).price_cents, graph.prices[0].amount_cents,
  'conditional contract price does not leak into standard context');
const malformedPriceGraph = structuredClone(graph);
malformedPriceGraph.prices.push({
  ...malformedPriceGraph.prices[0], id: 'malformed-array-price', rule_key: 'event-malformed',
  price_type: 'event', amount_cents: 1, priority: 900, conditions: [],
});
malformedPriceGraph.prices.push({
  ...malformedPriceGraph.prices[0], id: 'malformed-null-price', rule_key: 'contract-null',
  price_type: 'contract', amount_cents: 2, priority: 1000, conditions: { contract_key: null },
});
assert.equal(resolveEffectivePrice(malformedPriceGraph, malformedPriceGraph.offerings[0].id, {}).price_cents, graph.prices[0].amount_cents,
  'malformed or null contextual predicates fail closed instead of becoming global prices');

const existing = { ...graph.offerings[0], clinical_metadata: { protocol_reference: 'verified-protocol', secret: 'preserve' } };
const sparse = mergeOfferingPatch(graph, existing, { public_name: 'Renamed only' });
assert.equal(sparse.public_name, 'Renamed only');
assert.equal(sparse.clinical_metadata.secret, 'preserve', 'sparse update preserves clinical metadata');
assert.deepEqual(sparse.fulfillment_metadata, existing.fulfillment_metadata, 'sparse update preserves fulfillment metadata');
assert.deepEqual(sparse.financial_metadata, existing.financial_metadata, 'sparse update preserves financial metadata');
assert.equal(sparse.admin_notes, 'preserve me', 'sparse update preserves admin notes');
assert.equal(sparse.presentations.admin.metadata.preserved, true, 'sparse update preserves audience metadata');
const guardedPriceGraph = structuredClone(graph);
guardedPriceGraph.prices[0].compare_at_cents = guardedPriceGraph.prices[0].amount_cents + 5000;
guardedPriceGraph.prices[0].minimum_allowed_cents = guardedPriceGraph.prices[0].amount_cents - 1000;
const pricePreservingEdit = mergeOfferingPatch(guardedPriceGraph, guardedPriceGraph.offerings[0], {
  public_name: 'Rename without repricing',
  base_price_cents: guardedPriceGraph.prices[0].amount_cents,
});
assert.equal(pricePreservingEdit.compare_at_price_cents, guardedPriceGraph.prices[0].compare_at_cents,
  'ordinary edits preserve the standard compare-at price');
assert.equal(pricePreservingEdit.minimum_allowed_price_cents, guardedPriceGraph.prices[0].minimum_allowed_cents,
  'ordinary edits preserve the standard minimum-allowed guardrail');
assert.equal(pricePreservingEdit.currency, guardedPriceGraph.prices[0].currency,
  'ordinary edits preserve the standard currency');
assert.equal(validateCompositeOffering({ public_name: 'X', category_id: null, visibility: { public_website: true } }).visibility.public, true,
  'public_website UI visibility maps to canonical public audience');
const adminDashboard = buildAdminDashboard(graph);
assert.equal(adminDashboard.source, 'live', 'admin dashboard consumes live DB source contract');
assert.equal(
  adminDashboard.offerings[0].protocol_reference,
  graph.offerings[0].clinical_metadata.protocol_reference,
  'admin dashboard returns the governed protocol reference so ordinary edits cannot erase it',
);

const [migration, core, importer, adminApi, publicApi, nurseApi, packageJson] = await Promise.all([
  read('supabase/migrations/054_avalon_catalog.sql'),
  read('api/_lib/catalog-core.js'),
  read('api/_lib/catalog-legacy-import.js'),
  read('api/admin/catalog.js'),
  read('api/catalog.js'),
  read('api/me/catalog.js'),
  read('package.json'),
]);

for (const table of [
  'catalog_categories', 'catalog_offerings', 'catalog_presentations', 'catalog_prices',
  'catalog_visibility_rules', 'catalog_availability_rules', 'catalog_addon_relations',
  'catalog_package_items', 'catalog_inventory_requirements', 'catalog_context_offerings',
  'catalog_compensation_refs', 'catalog_aliases', 'catalog_change_requests',
  'catalog_import_runs', 'catalog_audit_log',
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'), `migration creates ${table}`);
  assert.match(migration, new RegExp(`revoke all on table public\\.%I from public, anon, authenticated`, 'i'), 'service-only table revoke template exists');
}
assert.match(migration, /enable row level security/i);
assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete|all)[^;]+to\s+(?:anon|authenticated)/i, 'no direct Catalog table grants to browser roles');
assert.match(migration, /catalog_assert_offering_complete/);
assert.match(migration, /create constraint trigger[\s\S]+catalog_guard_dependent_complete/i, 'dependent mutations are completeness guarded');
assert.match(migration, /price\.amount_cents > 0/);
assert.match(migration, /price\.currency = 'USD'/);
assert.match(migration, /price\.price_type = 'standard' and price\.conditions = '\{\}'::jsonb/);
assert.match(migration, /catalog_external_price_must_be_positive/);
assert.match(migration, /returning version into v_offering_version/,
  'price mutations bump the Offering optimistic-concurrency revision');
assert.match(migration, /and price_type = v_price_type\s+and conditions = v_conditions/i,
  'a context price supersedes only an earlier rule for the same context');
assert.match(migration, /catalog_contextual_price_scope_required/,
  'contextual price types require one explicit recognized scope');
assert.match(migration, /unique \(tenant_id, offering_id, id\)[\s\S]+foreign key \(tenant_id, offering_id, price_rule_id\)[\s\S]+on delete restrict/i,
  'context menu price references are constrained to the same Offering and cannot null the tenant on delete');
assert.match(migration, /catalog_activation_invalid_client_paths/);
assert.match(migration, /v_availability_mode = 'closed'[\s\S]+rule\.effect = 'allow'/, 'explicit closed mode closes active allow rules');
const closedSection = migration.match(/if v_availability_mode = 'closed'[\s\S]+?end if;/i)?.[0] || '';
assert.doesNotMatch(closedSection, /context_type = 'global'/, 'closed means close all, not misleading global-only close');
assert.match(migration, /catalog_audit_is_append_only/);
assert.match(migration, /revoke all on function public\.catalog_apply_legacy_import[\s\S]+from public, anon, authenticated/i);
assert.match(migration, /jsonb_array_length\(p_offerings\) <> 37/);
assert.match(migration, /set cutover_ready = false[\s\S]+where tenant_id = p_tenant_id and cutover_ready = true/i,
  'committed imports transactionally invalidate prior readiness');
assert.ok((migration.match(/pg_advisory_xact_lock\(hashtextextended\(p_tenant_id::text \|\| ':avalon-catalog-import'/g) || []).length >= 4,
  'apply, finalize, save, and price changes share the import lock');
assert.ok((migration.match(/run\.status in \('running', 'verifying'\)/g) || []).length >= 2,
  'admin writes are blocked while an imported graph is being independently verified');
assert.match(migration, /status = 'verifying'/);
assert.match(migration, /catalog_finalize_import/);
assert.match(migration, /catalog_legacy_import_locked_after_cutover/,
  'legacy import is a one-time bootstrap and cannot erase later human enrichment');
assert.match(migration, /error_code = 'superseded_incomplete_import'[\s\S]+stale\.source_hash <> p_source_hash[\s\S]+stale\.status in \('running', 'verifying'\)/i,
  'a newer hash recovers crash-left unfinished imports without leaving admin writes blocked');
assert.match(migration, /create or replace function public\.catalog_read_graph\(p_tenant_id uuid\)/i,
  'Catalog graph and readiness load from one database snapshot');
assert.match(migration, /revoke all on function public\.catalog_read_graph\(uuid\) from public, anon, authenticated/i,
  'atomic graph reader remains service-role only');
assert.match(migration, /allowed_addon_keys/);
assert.match(importer, /existing\?\.status === 'succeeded' && existing\?\.cutover_ready === true\) return/,
  'failure ledger cannot downgrade a successful import');
assert.match(importer, /\.neq\('status', 'succeeded'\)/,
  'a stale failure-ledger writer cannot overwrite a concurrently succeeded import');
assert.ok((importer.match(/\.in\('status', \['running', 'verifying', 'failed'\]\)\.eq\('cutover_ready', false\)/g) || []).length >= 2,
  'shadow failure transitions are conditional and cannot downgrade cutover-ready success');
assert.doesNotMatch(importer, /requiredSupplies\.join\(/, 'supply labels are never invented into nurse instructions');
assert.match(adminApi, /mergeOfferingPatch/);
assert.match(adminApi, /patch\.stable_key = existing\.stable_key/);
assert.match(migration, /v_is_existing and p_expected_version is null[\s\S]+catalog_version_conflict/i,
  'create and duplicate cannot overwrite an existing stable key without an optimistic version');
assert.ok((adminApi.match(/catalog_version_required/g) || []).length >= 2,
  'update and archive both require caller optimistic versions');
assert.match(adminApi, /scheduledAt\.getTime\(\) <= Date\.now\(\)/,
  'scheduled prices require a future effective timestamp');
assert.match(adminApi, /normalizePriceConditions/);
assert.match(adminApi, /approval_required: true/);
assert.match(publicApi, /Cache-Control', 'no-store'/, 'public projection never serves stale prices or visibility');
assert.match(publicApi, /projectClientCatalog/);
assert.match(nurseApi, /projectNurseCatalog/);
assert.match(nurseApi, /requireRole/);
assert.match(core, /price\.price_cents == null \|\| price\.price_cents <= 0/);
assert.match(core, /if \(!Number\.isInteger\(context\.day_of_week\)\) return false/);
assert.match(core, /rule\.require_inventory === true && context\.inventory_available !== true/);
assert.match(core, /db\.rpc\('catalog_read_graph'/,
  'all runtime graph consumers use the atomic snapshot RPC');
assert.doesNotMatch(core, /Promise\.all\(\[\s*selectAllTenantRows/,
  'runtime readiness never combines independent PostgREST snapshots');
assert.match(packageJson, /"verify:catalog"\s*:/, 'package exposes Catalog verification');

console.log(`Catalog verification passed: ${manifest.offerings.length} exact public Offerings, ${manifest.aliases.length} unique aliases, 0 unapproved nurse rows.`);
