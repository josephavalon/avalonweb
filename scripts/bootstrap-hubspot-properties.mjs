/**
 * Bootstrap the Avalon custom properties into a HubSpot portal.
 *
 * Idempotent: for each property, checks whether it exists; creates it if not.
 * Never touches existing property definitions (so a manual edit in HubSpot
 * won't be overwritten). Safe to re-run.
 *
 * Requires:
 *   HUBSPOT_ACCESS_TOKEN  (private-app token with `crm.schemas.contacts.write`)
 *
 * Optional:
 *   HUBSPOT_PROPERTY_GROUP  (defaults to "contactinformation" — HubSpot's
 *                             default "Contact information" group. Set to a
 *                             custom group name to bucket the Avalon props
 *                             together in the portal UI.)
 *
 * Run:  node scripts/bootstrap-hubspot-properties.mjs
 */

const BASE = 'https://api.hubapi.com';

// --- Property definitions -------------------------------------------------

const GROUP = process.env.HUBSPOT_PROPERTY_GROUP || 'contactinformation';

const PROPERTIES = [
  // Lifecycle facets
  { name: 'avalon_source',              label: 'Avalon Source',              type: 'string',      fieldType: 'text' },
  { name: 'avalon_lifecycle_stage',     label: 'Avalon Lifecycle Stage',     type: 'string',      fieldType: 'text' },
  { name: 'avalon_plan_interest',       label: 'Avalon Plan Interest',       type: 'string',      fieldType: 'text' },
  { name: 'avalon_visit_count',         label: 'Avalon Visit Count',         type: 'number',      fieldType: 'number' },
  // Consent metadata (timestamps + version strings only — never signatures)
  { name: 'avalon_hipaa_npp_signed_at', label: 'HIPAA NPP Signed At',        type: 'datetime',    fieldType: 'date' },
  { name: 'avalon_hipaa_npp_version',   label: 'HIPAA NPP Version',          type: 'string',      fieldType: 'text' },
  { name: 'avalon_terms_signed_at',     label: 'Terms Signed At',            type: 'datetime',    fieldType: 'date' },
  // Hospitality guest profile (non-PHI)
  { name: 'avalon_instagram_handle',    label: 'Instagram Handle',           type: 'string',      fieldType: 'text' },
  { name: 'avalon_tiktok_handle',       label: 'TikTok Handle',              type: 'string',      fieldType: 'text' },
  { name: 'avalon_linkedin_url',        label: 'LinkedIn URL',               type: 'string',      fieldType: 'text' },
  { name: 'avalon_beverage_preference', label: 'Beverage Preference',        type: 'string',      fieldType: 'text' },
  { name: 'avalon_music_preference',    label: 'Music Preference',           type: 'string',      fieldType: 'text' },
  { name: 'avalon_style_notes',         label: 'Style Notes',                type: 'string',      fieldType: 'textarea' },
  { name: 'avalon_wardrobe_notes',      label: 'Wardrobe Notes',             type: 'string',      fieldType: 'textarea' },
  { name: 'avalon_hospitality_notes',   label: 'Hospitality Notes',          type: 'string',      fieldType: 'textarea' },
  { name: 'avalon_visit_context',       label: 'Visit Context',              type: 'string',      fieldType: 'textarea' },
];

// --- Runtime --------------------------------------------------------------

const token = process.env.HUBSPOT_ACCESS_TOKEN;
if (!token) {
  console.error('HUBSPOT_ACCESS_TOKEN is required.');
  process.exit(1);
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function hs(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await readJson(res);
  return { status: res.status, ok: res.ok, body };
}

async function propertyExists(name) {
  const { status } = await hs(`/crm/v3/properties/contacts/${encodeURIComponent(name)}`);
  return status === 200;
}

async function createProperty(def) {
  const payload = {
    name: def.name,
    label: def.label,
    type: def.type,
    fieldType: def.fieldType,
    groupName: GROUP,
    description: `Avalon Vitality — ${def.label}. Managed by scripts/bootstrap-hubspot-properties.mjs. Non-PHI.`,
  };
  const res = await hs('/crm/v3/properties/contacts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Create ${def.name} failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

let created = 0;
let existed = 0;
const failures = [];

for (const def of PROPERTIES) {
  try {
    const exists = await propertyExists(def.name);
    if (exists) {
      existed += 1;
      console.log(`  = ${def.name}  (already exists — untouched)`);
      continue;
    }
    await createProperty(def);
    created += 1;
    console.log(`  + ${def.name}  (${def.type} · ${def.fieldType})`);
  } catch (err) {
    failures.push({ name: def.name, error: err.message });
    console.error(`  ✗ ${def.name}  ${err.message}`);
  }
}

console.log('');
console.log(`Bootstrap complete: ${created} created, ${existed} already present, ${failures.length} failed.`);
if (failures.length) process.exit(1);
