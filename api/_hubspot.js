/**
 * HubSpot API client.
 * Docs:
 * - Auth (private app tokens): https://developers.hubspot.com/docs/api/private-apps
 * - Contacts upsert (by email): https://developers.hubspot.com/docs/api/crm/contacts
 *
 * IMPORTANT: Never import this in frontend code.
 * HUBSPOT_ACCESS_TOKEN must stay server-side only.
 *
 * HIPAA / BAA STATUS: HubSpot has NOT signed a BAA with Avalon. This module
 * ships ONLY non-PHI hospitality/lifecycle facets (identifiers + guest profile
 * preferences). PHI (DOB, address, emergency contact, allergies, medications,
 * conditions, GFE state, appointment notes, Acuity intake) is architecturally
 * excluded via `buildHubspotProperties`'s allowlist and CI-guarded by
 * `scripts/no-phi-in-hubspot-qa.mjs`.
 *
 * Kill switch: HUBSPOT_SYNC_ENABLED. Callers should treat `{ skipped: true }`
 * as a non-error. See docs/PHI_DATA_FLOW.md.
 */

const BASE = 'https://api.hubapi.com';

// Any property name we're allowed to send. Adding a key here without updating
// the CI PHI-guard is a review-blocker.
const ALLOWED_HUBSPOT_PROPERTIES = new Set([
  // Native HubSpot contact properties
  'email',
  'firstname',
  'lastname',
  'phone',
  'city',
  'hs_lead_status',
  'lifecyclestage',
  // Custom Avalon lifecycle facets (mirror Attio's crmSafeDescription)
  'avalon_source',
  'avalon_lifecycle_stage',
  'avalon_plan_interest',
  'avalon_visit_count',
  'avalon_hipaa_npp_signed_at',
  'avalon_hipaa_npp_version',
  'avalon_terms_signed_at',
  // Hospitality guest profile (staff-editable, non-PHI)
  'avalon_instagram_handle',
  'avalon_tiktok_handle',
  'avalon_linkedin_url',
  'avalon_style_notes',
  'avalon_wardrobe_notes',
  'avalon_beverage_preference',
  'avalon_music_preference',
  'avalon_hospitality_notes',
  'avalon_visit_context',
]);

// Free-text properties whose values must be scanned for PHI-shaped tokens
// before they leave. Everything else is a short label / handle / URL / timestamp.
const HUBSPOT_FREETEXT_PROPERTIES = new Set([
  'avalon_style_notes',
  'avalon_wardrobe_notes',
  'avalon_hospitality_notes',
  'avalon_visit_context',
]);

// If a hospitality free-text field contains PHI-shaped tokens, refuse to send
// the whole payload. This mirrors the Quo SMS/Resend body guards.
const PHI_TOKEN_PATTERNS = [
  /\ballerg/i,
  /\bmedication/i,
  /\bmedicine\b/i,
  /\bprescription\b/i,
  /\bdiagnos/i,
  /\bsymptom/i,
  /\bdose|dosage\b/i,
  /\btreatment\b/i,
  /\bcondition\b/i,
  /\bdisease\b/i,
  /\bpregnan/i,
  /\bnurse\b/i,
  /\bdob\b/i,
  /\bpatient\b/i,
];

export class HubspotPhiRefused extends Error {
  constructor(propertyName) {
    super(`Refusing to send HubSpot property "${propertyName}" — value contains PHI-shaped token`);
    this.name = 'HubspotPhiRefused';
    this.status = 400;
    this.code = 'hubspot_phi_refused';
    this.property = propertyName;
  }
}

export function isHubspotSyncEnabled() {
  return String(process.env.HUBSPOT_SYNC_ENABLED || '').toLowerCase() === 'true';
}

function authHeader() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error('HubSpot token not configured');
  return `Bearer ${token}`;
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function hubspotFetch(path, opts = {}) {
  if (!isHubspotSyncEnabled()) {
    console.log('[hubspot] sync skipped (HUBSPOT_SYNC_ENABLED is not true)', { path });
    return { skipped: true, reason: 'hubspot_sync_disabled', data: null };
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  const data = await readJson(res);
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.errors?.[0]?.message ||
      `HubSpot error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, body: data });
  }
  return data;
}

export function getHubspotConfigStatus() {
  return {
    hasToken: Boolean(process.env.HUBSPOT_ACCESS_TOKEN),
    portalId: process.env.HUBSPOT_PORTAL_ID || null,
    syncEnabled: isHubspotSyncEnabled(),
  };
}

export async function identifyHubspot() {
  return hubspotFetch('/account-info/v3/details');
}

function splitName(fullName = '') {
  const clean = String(fullName || '').trim();
  if (!clean) return { firstName: '', lastName: '' };
  const parts = clean.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(''),
  };
}

function normalizePhoneToE164(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return trimmed;
}

function cleanFreetext(value) {
  const str = String(value ?? '').trim();
  // HubSpot text properties cap at ~65k chars; we cap way lower to keep the
  // CRM tidy and to force staff to write short useful notes.
  return str.length > 2000 ? str.slice(0, 2000) : str;
}

/**
 * Translate a normalized client input into HubSpot's flat `properties` map.
 * ONLY allowlisted keys pass through. Unknown keys are silently dropped.
 * Free-text values that contain PHI-shaped tokens throw HubspotPhiRefused.
 *
 * Accepted input shape (all optional except `email`):
 *   {
 *     email, firstName, lastName, phone, city,
 *     source, lifecycleStage, planInterest, visitCount,
 *     hipaaNppSignedAt, hipaaNppVersion, termsSignedAt,
 *     guestProfile: { instagram, tiktok, linkedin, style, wardrobe,
 *                     beverage, music, notes, context }
 *   }
 */
export function buildHubspotProperties(client = {}) {
  const props = {};

  const email = client.email ? String(client.email).trim().toLowerCase() : null;
  if (email) props.email = email;

  // Prefer explicit first/last; otherwise split full name.
  let firstName = client.firstName || '';
  let lastName = client.lastName || '';
  if ((!firstName || !lastName) && client.name) {
    const parsed = splitName(client.name);
    firstName = firstName || parsed.firstName;
    lastName = lastName || parsed.lastName;
  }
  if (firstName) props.firstname = String(firstName).trim();
  if (lastName) props.lastname = String(lastName).trim();

  const phone = normalizePhoneToE164(client.phone);
  if (phone) props.phone = phone;

  if (client.city) props.city = String(client.city).trim();

  if (client.source) props.avalon_source = String(client.source).trim();
  if (client.lifecycleStage) props.avalon_lifecycle_stage = String(client.lifecycleStage).trim();
  if (client.planInterest) props.avalon_plan_interest = String(client.planInterest).trim();
  if (client.visitCount != null) props.avalon_visit_count = Number(client.visitCount);
  if (client.hipaaNppSignedAt) props.avalon_hipaa_npp_signed_at = String(client.hipaaNppSignedAt);
  if (client.hipaaNppVersion) props.avalon_hipaa_npp_version = String(client.hipaaNppVersion);
  if (client.termsSignedAt) props.avalon_terms_signed_at = String(client.termsSignedAt);

  const gp = client.guestProfile || {};
  if (gp.instagram) props.avalon_instagram_handle = String(gp.instagram).trim();
  if (gp.tiktok) props.avalon_tiktok_handle = String(gp.tiktok).trim();
  if (gp.linkedin) props.avalon_linkedin_url = String(gp.linkedin).trim();
  if (gp.beverage) props.avalon_beverage_preference = String(gp.beverage).trim();
  if (gp.music) props.avalon_music_preference = String(gp.music).trim();
  if (gp.style) props.avalon_style_notes = cleanFreetext(gp.style);
  if (gp.wardrobe) props.avalon_wardrobe_notes = cleanFreetext(gp.wardrobe);
  if (gp.notes) props.avalon_hospitality_notes = cleanFreetext(gp.notes);
  if (gp.context) props.avalon_visit_context = cleanFreetext(gp.context);

  // Final safety pass: any key not on the allowlist is dropped, any free-text
  // value with PHI-shaped tokens throws.
  for (const key of Object.keys(props)) {
    if (!ALLOWED_HUBSPOT_PROPERTIES.has(key)) {
      delete props[key];
      continue;
    }
    if (HUBSPOT_FREETEXT_PROPERTIES.has(key)) {
      const value = String(props[key] ?? '');
      if (PHI_TOKEN_PATTERNS.some((re) => re.test(value))) {
        throw new HubspotPhiRefused(key);
      }
    }
  }

  return props;
}

/**
 * Upsert a contact by email. HubSpot's PATCH by-idProperty=email endpoint
 * updates if a contact exists, otherwise falls back to a POST create.
 * Returns { id, skipped, reason }.
 */
export async function upsertHubspotContact(client = {}) {
  const properties = buildHubspotProperties(client);
  if (!properties.email) {
    throw Object.assign(new Error('Email is required to sync a contact to HubSpot'), { status: 400 });
  }
  const email = properties.email;

  // Try PATCH first (updates existing contact identified by email).
  const patchPath = `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`;
  try {
    const response = await hubspotFetch(patchPath, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    if (response?.skipped) {
      return { id: null, skipped: true, reason: response.reason || 'hubspot_sync_disabled' };
    }
    return { id: response?.id || null, skipped: false, updated: true };
  } catch (err) {
    if (err?.status === 404) {
      // Not found — create instead.
      const created = await hubspotFetch('/crm/v3/objects/contacts', {
        method: 'POST',
        body: JSON.stringify({ properties }),
      });
      if (created?.skipped) {
        return { id: null, skipped: true, reason: created.reason || 'hubspot_sync_disabled' };
      }
      return { id: created?.id || null, skipped: false, created: true };
    }
    throw err;
  }
}
