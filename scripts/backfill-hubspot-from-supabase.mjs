/**
 * Backfill HubSpot from Supabase's existing patient corpus.
 *
 * Pulls from THREE sources and dedupes:
 *   1. public.profiles      — signed-up clients (may have email + phone + name)
 *   2. public.people        — the canonical person record
 *   3. public.appointments  — Acuity-synced appointments (external_payload)
 *
 * For each distinct patient, upserts one HubSpot contact with:
 *   avalon_source = 'Avalon Backfill'
 *   avalon_lifecycle_stage = 'Booked' (if they have any appointment) else 'Lead'
 *   avalon_relationship_type = 'patient'
 *
 * Contacts with email → upsert-by-email (fast, idempotent).
 * Contacts with phone but no email → search-by-phone → create/update.
 *
 * Idempotent. Safe to re-run.
 *
 * Env required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   HUBSPOT_ACCESS_TOKEN, HUBSPOT_SYNC_ENABLED=true
 *
 * Flags:
 *   --dry        Skip HubSpot writes; print what WOULD be sent.
 *   --limit=N    Process only the first N unique contacts.
 *   --source=X   'all' (default), 'appointments', 'profiles', 'people'
 */

import { upsertHubspotContact, buildHubspotProperties, isHubspotSyncEnabled } from '../api/_hubspot.js';

// ---- flags ---------------------------------------------------------------

const argv = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const DRY = argv.has('dry');
const LIMIT = argv.has('limit') ? Number(argv.get('limit')) : null;
const SOURCE = argv.has('source') ? String(argv.get('source')) : 'all';

// ---- env -----------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}
if (!process.env.HUBSPOT_ACCESS_TOKEN) {
  console.error('HUBSPOT_ACCESS_TOKEN is required.');
  process.exit(1);
}

const HUBSPOT_BASE = 'https://api.hubapi.com';

// ---- helpers -------------------------------------------------------------

async function pgFetch(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function hs(path, opts = {}) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

function splitFullName(full = '') {
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function normalizePhone(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : null;
}

function normEmail(email) {
  const v = String(email || '').trim().toLowerCase();
  if (!v || !v.includes('@')) return null;
  return v;
}

// Merge a candidate contact record into the accumulator keyed by
// (email OR phone). Newer/richer values overwrite empty older ones.
function mergeInto(acc, candidate) {
  if (!candidate) return;
  const key = candidate.email || (candidate.phone ? `phone:${candidate.phone}` : null);
  if (!key) return;
  const prev = acc.get(key) || {};
  const merged = {
    email: candidate.email || prev.email || null,
    phone: candidate.phone || prev.phone || null,
    firstName: candidate.firstName || prev.firstName || null,
    lastName: candidate.lastName || prev.lastName || null,
    name: candidate.name || prev.name || null,
    city: candidate.city || prev.city || null,
    hasBooking: Boolean(candidate.hasBooking || prev.hasBooking),
    source: prev.source || candidate.source || 'Avalon Backfill',
  };
  // Backfill first/last from full name when only one is known.
  if (!merged.firstName && !merged.lastName && merged.name) {
    const parts = splitFullName(merged.name);
    merged.firstName = parts.firstName || null;
    merged.lastName = parts.lastName || null;
  }
  acc.set(key, merged);
}

// ---- source: profiles ----------------------------------------------------

async function loadProfiles(acc) {
  const rows = await pgFetch('/rest/v1/profiles?select=id,email,phone,full_name,preferred_name,saved_address,role&role=eq.client');
  let counted = 0;
  for (const r of rows) {
    const email = normEmail(r.email);
    const phone = normalizePhone(r.phone);
    if (!email && !phone) continue;
    const name = String(r.full_name || r.preferred_name || '').trim();
    const first = name ? splitFullName(name).firstName : null;
    const last = name ? splitFullName(name).lastName : null;
    const city = r.saved_address?.city || null;
    mergeInto(acc, { email, phone, firstName: first, lastName: last, name, city, source: 'Avalon Signup', hasBooking: false });
    counted += 1;
  }
  console.log(`  profiles:     ${counted} candidates`);
}

// ---- source: people ------------------------------------------------------

async function loadPeople(acc) {
  const rows = await pgFetch('/rest/v1/people?select=id,email,phone,display_name');
  let counted = 0;
  for (const r of rows) {
    const email = normEmail(r.email);
    const phone = normalizePhone(r.phone);
    if (!email && !phone) continue;
    const name = String(r.display_name || '').trim();
    const first = name ? splitFullName(name).firstName : null;
    const last = name ? splitFullName(name).lastName : null;
    mergeInto(acc, { email, phone, firstName: first, lastName: last, name, source: 'Avalon People', hasBooking: false });
    counted += 1;
  }
  console.log(`  people:       ${counted} candidates`);
}

// ---- source: appointments ------------------------------------------------

async function loadAppointments(acc) {
  const rows = await pgFetch('/rest/v1/appointments?select=id,acuity_appointment_id,external_payload&limit=5000');
  let counted = 0;
  for (const row of rows) {
    const p = row.external_payload || {};
    const appt = p.appointment || {};
    const contact = p.contact || {};
    const email = normEmail(contact.email || appt.email || p.email);
    const phone = normalizePhone(contact.phone || appt.phone || p.phone);
    if (!email && !phone) continue;
    const first = contact.firstName || appt.firstName || null;
    const last = contact.lastName || appt.lastName || null;
    const name = contact.name || appt.name || [first, last].filter(Boolean).join(' ') || null;
    const city = contact.city || appt.city || null;
    mergeInto(acc, { email, phone, firstName: first, lastName: last, name, city, source: 'Acuity', hasBooking: true });
    counted += 1;
  }
  console.log(`  appointments: ${counted} candidates`);
}

// ---- HubSpot: search by phone --------------------------------------------

async function findContactByPhone(phone) {
  const res = await hs('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }] }],
      properties: ['email', 'phone'],
      limit: 1,
    }),
  });
  if (!res.ok) return null;
  return res.body?.results?.[0] || null;
}

async function upsertByPhone(client) {
  const properties = buildHubspotProperties(client);
  if (properties.email) delete properties.email; // let phone-only stay email-less
  const existing = await findContactByPhone(client.phone);
  if (existing) {
    const patch = await hs(`/crm/v3/objects/contacts/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    if (!patch.ok) throw new Error(`patch by-phone ${patch.status}: ${JSON.stringify(patch.body).slice(0, 160)}`);
    return { id: patch.body?.id || existing.id, updated: true };
  }
  const created = await hs('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  });
  if (!created.ok) throw new Error(`create by-phone ${created.status}: ${JSON.stringify(created.body).slice(0, 160)}`);
  return { id: created.body?.id || null, created: true };
}

// ---- main ----------------------------------------------------------------

console.log('▸ Backfill HubSpot from Supabase');
console.log(`  dry=${DRY} limit=${LIMIT || 'all'} source=${SOURCE} kill_switch=${isHubspotSyncEnabled() ? 'on' : 'off'}`);

const acc = new Map();
if (SOURCE === 'all' || SOURCE === 'profiles') await loadProfiles(acc);
if (SOURCE === 'all' || SOURCE === 'people') await loadPeople(acc);
if (SOURCE === 'all' || SOURCE === 'appointments') await loadAppointments(acc);

let unique = Array.from(acc.values());
if (LIMIT) unique = unique.slice(0, LIMIT);
console.log('');
console.log(`▸ Unique contacts after dedup: ${unique.length}`);
console.log(`  with email:         ${unique.filter((c) => c.email).length}`);
console.log(`  phone-only:         ${unique.filter((c) => !c.email && c.phone).length}`);
console.log(`  hasBooking (Customer): ${unique.filter((c) => c.hasBooking).length}`);
console.log(`  no booking (Lead):     ${unique.filter((c) => !c.hasBooking).length}`);

if (DRY) {
  console.log('');
  console.log('DRY RUN — sample of what would ship:');
  unique.slice(0, 5).forEach((c) => {
    const payload = { ...c, lifecycleStage: c.hasBooking ? 'Booked' : 'Lead', relationshipType: 'patient' };
    const props = buildHubspotProperties(payload);
    console.log(`  ${c.email || `phone:${c.phone}`} → ${Object.keys(props).length} props (${payload.lifecycleStage})`);
  });
  process.exit(0);
}

console.log('');
let syncedEmail = 0;
let syncedPhone = 0;
let skipped = 0;
const failures = [];

for (const [i, c] of unique.entries()) {
  const payload = {
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    name: c.name,
    phone: c.phone,
    city: c.city,
    source: c.source || 'Avalon Backfill',
    lifecycleStage: c.hasBooking ? 'Booked' : 'Lead',
    relationshipType: 'patient',
  };

  try {
    if (c.email) {
      const result = await upsertHubspotContact(payload);
      if (result?.skipped) { skipped += 1; continue; }
      syncedEmail += 1;
    } else {
      const result = await upsertByPhone(payload);
      syncedPhone += 1;
      void result;
    }
    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${unique.length} processed (email=${syncedEmail}, phone=${syncedPhone}, fail=${failures.length})`);
    }
    // Throttle to stay under HubSpot's 100 req/10s ceiling for private apps.
    await new Promise((r) => setTimeout(r, 130));
  } catch (err) {
    failures.push({ key: c.email || c.phone, error: err.message });
    if (failures.length < 8) console.warn(`  ✗ ${c.email || c.phone}: ${err.message.slice(0, 160)}`);
  }
}

console.log('');
console.log(`Backfill complete: ${syncedEmail + syncedPhone} synced (${syncedEmail} by email, ${syncedPhone} by phone), ${skipped} skipped (kill switch), ${failures.length} failed`);
if (failures.length) process.exit(1);
