import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { OS_CAPABILITIES } from '../src/data/osCapabilities.js';

const apply = process.argv.includes('--apply');
const url = String(process.env.SUPABASE_URL || '').trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const expectedRef = String(process.env.AVALON_BETA_SUPABASE_PROJECT_REF || '').trim();
const password = String(process.env.AVALON_BETA_REVIEW_PASSWORD || '');
const emailDomain = String(process.env.AVALON_BETA_REVIEW_EMAIL_DOMAIN || 'example.test').trim().toLowerCase();

function stop(message) {
  console.error(`Seed refused: ${message}`);
  process.exit(1);
}

if (!apply) {
  console.log(`Dry run: would seed 5 review identities, ${OS_CAPABILITIES.length} synthetic capability records, and today's synthetic nurse route. Re-run with --apply after setting the beta-only environment.`);
  process.exit(0);
}
if (!url || !serviceKey || !expectedRef) stop('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and AVALON_BETA_SUPABASE_PROJECT_REF are required.');
if (!url.includes(`${expectedRef}.supabase.co`)) stop('SUPABASE_URL does not match AVALON_BETA_SUPABASE_PROJECT_REF.');
if (/avalon-vitality-prod|production/i.test(`${url} ${expectedRef}`)) stop('the target looks like production.');
if (password.length < 16) stop('AVALON_BETA_REVIEW_PASSWORD must contain at least 16 characters.');
if (!/^(?:example\.test|[^@]+\.test)$/.test(emailDomain)) stop('review identity email domain must end in .test.');

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tenantId = crypto.createHash('sha256').update(`avalon-os-beta:${expectedRef}`).digest('hex');
const tenantUuid = `${tenantId.slice(0, 8)}-${tenantId.slice(8, 12)}-4${tenantId.slice(13, 16)}-a${tenantId.slice(17, 20)}-${tenantId.slice(20, 32)}`;
const routeFixtureIds = {
  provider: 'b0000000-0000-4000-a000-000000000001',
  home: 'b0000000-0000-4000-a000-000000000010',
  office: 'b0000000-0000-4000-a000-000000000011',
  appointments: [
    'b1000000-0000-4000-a000-000000000001',
    'b1000000-0000-4000-a000-000000000002',
    'b1000000-0000-4000-a000-000000000003',
    'b1000000-0000-4000-a000-000000000004',
  ],
};

function pacificDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function pacificIsoAt(date, hour, minute = 0) {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(noonUtc).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMs = represented - noonUtc.getTime();
  return new Date(Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`) - offsetMs).toISOString();
}

const identities = [
  { key: 'admin', role: 'admin', name: 'Avery Admin' },
  { key: 'staff', role: 'staff', name: 'Sam Staff' },
  { key: 'nurse', role: 'nurse', name: 'Nora Nurse' },
  { key: 'organizer', role: 'promoter', name: 'Olivia Organizer' },
  { key: 'client', role: 'client', name: 'Casey Client' },
].map((identity) => ({ ...identity, email: `avalon-beta-${identity.key}@${emailDomain}` }));

async function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

await must(db.from('tenants').upsert({
  id: tenantUuid,
  name: 'Avalon OS Synthetic Beta',
  slug: `avalon-os-beta-${expectedRef}`.slice(0, 120),
  status: 'active',
  brand_config: { theme: 'cream-editorial', synthetic_only: true },
  market_config: { markets: ['San Francisco Beta'], synthetic_only: true },
}, { onConflict: 'id' }), 'tenant');

const profiles = {};
for (const identity of identities) {
  const listed = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  let user = listed.data.users.find((candidate) => candidate.email === identity.email);
  if (!user) {
    const created = await db.auth.admin.createUser({
      email: identity.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: identity.name, synthetic_beta: true },
      app_metadata: { beta_only: true },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }
  await must(db.from('profiles').upsert({
    id: user.id, tenant_id: tenantUuid, email: identity.email, full_name: identity.name,
    role: identity.role, status: 'active', app_metadata: { synthetic_beta: true, review_identity: identity.key },
  }, { onConflict: 'id' }), `profile ${identity.key}`);
  profiles[identity.key] = user.id;
}

await must(db.from('provider_profiles').upsert({
  id: routeFixtureIds.provider,
  tenant_id: tenantUuid,
  profile_id: profiles.nurse,
  provider_role: 'rn',
  credential_status: 'clear',
  nursys_status: 'clear',
  scope_tags: ['mobile_iv', 'synthetic_beta'],
  active: true,
}, { onConflict: 'id' }), 'nurse provider profile');

await must(db.from('provider_route_origins').upsert([
  {
    id: routeFixtureIds.home, tenant_id: tenantUuid, owner_profile_id: profiles.nurse, kind: 'home', label: 'Home',
    address: 'Inner Sunset, San Francisco, CA', latitude: 37.7562, longitude: -122.4768, is_default: true,
  },
  {
    id: routeFixtureIds.office, tenant_id: tenantUuid, owner_profile_id: null, kind: 'office', label: 'Avalon Office',
    address: 'SoMa, San Francisco, CA', latitude: 37.7811, longitude: -122.4006, is_default: false,
  },
], { onConflict: 'id' }), 'nurse route origins');

const routeDate = pacificDate();
const routeFixtures = [
  { name: 'Maya', service: 'Myers Cocktail', protocol: 'myers_cocktail', neighborhood: 'Pacific Heights', address: 'Pacific Heights, San Francisco, CA', hour: 9, minute: 0, duration: 60, latitude: 37.7925, longitude: -122.4382 },
  { name: 'Alex', service: 'Hydration IV', protocol: 'hydration_iv', neighborhood: 'Oakland', address: 'Uptown Oakland, Oakland, CA', hour: 11, minute: 0, duration: 45, latitude: 37.8124, longitude: -122.2683 },
  { name: 'Jordan', service: 'Performance Drip', protocol: 'performance_drip', neighborhood: 'San Mateo', address: 'Downtown San Mateo, San Mateo, CA', hour: 13, minute: 0, duration: 60, latitude: 37.563, longitude: -122.3255 },
  { name: 'Taylor', service: 'NAD+ Infusion', protocol: 'nad_plus', neighborhood: 'Palo Alto', address: 'University Avenue, Palo Alto, CA', hour: 15, minute: 30, duration: 90, latitude: 37.4443, longitude: -122.1608 },
];
await must(db.from('appointments').upsert(routeFixtures.map((fixture, index) => ({
  id: routeFixtureIds.appointments[index],
  tenant_id: tenantUuid,
  provider_profile_id: routeFixtureIds.provider,
  status: 'confirmed',
  starts_at: pacificIsoAt(routeDate, fixture.hour, fixture.minute),
  protocol_key: fixture.protocol,
  payment_status: 'paid',
  gfe_status: 'accepted',
  external_payload: {
    primaryService: fixture.service,
    contact: { firstName: fixture.name },
    appointment: {
      address: fixture.address,
      neighborhood: fixture.neighborhood,
      durationMinutes: fixture.duration,
      coordinate: { latitude: fixture.latitude, longitude: fixture.longitude },
    },
    synthetic: true,
  },
})), { onConflict: 'id' }), 'nurse route appointments');

await must(db.from('os_settings').upsert([
  { tenant_id: tenantUuid, namespace: 'organization', key: 'profile', value: { name: 'Avalon OS Synthetic Beta', synthetic_only: true }, created_by: profiles.admin },
  { tenant_id: tenantUuid, namespace: 'markets', key: 'san-francisco-beta', value: { timezone: 'America/Los_Angeles', status: 'active' }, created_by: profiles.admin },
  { tenant_id: tenantUuid, namespace: 'branding', key: 'theme', value: { design_layer: 'AvalonOS', palette: 'cream-editorial' }, created_by: profiles.admin },
  { tenant_id: tenantUuid, namespace: 'integrations', key: 'safety', value: { mode: 'sandbox_or_manual', production_credentials_allowed: false }, created_by: profiles.admin },
], { onConflict: 'tenant_id,namespace,key' }), 'settings');

const records = OS_CAPABILITIES.map((capability, index) => ({
  tenant_id: tenantUuid,
  capability: capability.slug,
  record_type: 'synthetic_review_fixture',
  title: `Synthetic ${capability.label} ${String(index + 1).padStart(3, '0')}`,
  status: index % 4 === 0 ? 'pending' : 'active',
  amount_cents: capability.domain === 'finance' ? (index + 1) * 1250 : null,
  effective_at: new Date(Date.UTC(2026, index % 12, (index % 25) + 1, 17)).toISOString(),
  data: { synthetic: true, scenario: `${capability.domain}:${capability.kind}`, no_phi: true },
  created_by: profiles.admin,
}));
await must(db.from('os_capability_records').delete().eq('tenant_id', tenantUuid).eq('record_type', 'synthetic_review_fixture'), 'clear prior fixtures');
await must(db.from('os_capability_records').insert(records), 'capability fixtures');

const item = await must(db.from('os_inventory_items').upsert({
  tenant_id: tenantUuid, name: 'Synthetic Hydration Kit', sku: 'BETA-KIT-001', barcode: 'BETA000001',
  unit: 'kit', reorder_point: 5, tags: ['synthetic', 'event'], custom_fields: { market: 'San Francisco Beta' }, created_by: profiles.staff,
}, { onConflict: 'tenant_id,sku' }).select('*').single(), 'inventory item');
await must(db.from('os_stock_transactions').upsert({
  tenant_id: tenantUuid, item_id: item.id, transaction_type: 'receive', quantity_delta: 24,
  unit_cost_cents: 4200, source_type: 'synthetic_seed', source_id: 'BETA-PO-001',
  idempotency_key: 'synthetic-inventory-opening-v1', note: 'Synthetic stock only', created_by: profiles.staff,
}, { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true }), 'inventory opening balance');

const groupId = crypto.randomUUID();
await must(db.from('os_finance_ledger').upsert([
  { tenant_id: tenantUuid, entry_group_id: groupId, account_code: '1000', account_name: 'Beta Test Cash', account_type: 'asset', direction: 'debit', amount_cents: 250000, occurred_at: '2026-08-01T17:00:00.000Z', source_type: 'synthetic_seed', source_id: 'BETA-OPENING', memo: 'Synthetic test-mode opening balance', dimensions: { synthetic: true }, idempotency_key: 'synthetic-ledger-opening-v1:0', created_by: profiles.admin },
  { tenant_id: tenantUuid, entry_group_id: groupId, account_code: '3000', account_name: 'Beta Test Equity', account_type: 'equity', direction: 'credit', amount_cents: 250000, occurred_at: '2026-08-01T17:00:00.000Z', source_type: 'synthetic_seed', source_id: 'BETA-OPENING', memo: 'Synthetic test-mode opening balance', dimensions: { synthetic: true }, idempotency_key: 'synthetic-ledger-opening-v1:1', created_by: profiles.admin },
], { onConflict: 'tenant_id,idempotency_key,account_code,direction', ignoreDuplicates: true }), 'finance opening balance');

console.log(`Seeded Avalon OS beta tenant ${tenantUuid}, ${identities.length} review identities, ${records.length} synthetic capability records, and ${routeFixtures.length} route appointments for ${routeDate}. No password or service credential was printed.`);
