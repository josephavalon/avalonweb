/**
 * Seed the rehearsal/demo events into real rows (ET4 — replaces the deleted
 * localStorage demo store, src/data/events.js). Idempotent by slug.
 *
 * Run:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-events-demo.mjs
 * (Requires migration 034 applied.)
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const EVENTS = [
  {
    slug: 'festival-recovery-presale',
    name: 'Vital Ice Recovery House',
    status: 'presale',
    capacity: 48,
    starts_at: '2026-08-15T23:00:00Z',   // 4pm PT
    ends_at: '2026-08-16T04:00:00Z',
    venue: 'Pacific Heights, San Francisco',
    host_name: 'Avalon Vitality',
    walk_up_gfe: false,
    description_blocks: {
      vibe: 'A dusk recovery lounge built around timed IV appointments.',
      description:
        'A recovery lounge inside the party. Compression chairs, cold towels, and a quiet concierge health check before arrival — pick your drip, bring your people, and be back on the floor before the second set.',
      included: [
        'Clinician-reviewed health check before arrival',
        'Timed IV hydration appointments for eligible guests',
        'Compression lounge and cold towel service',
        'Photo drop on your trip page after the event',
      ],
      goodToKnow: [
        'First time? A 90-second health check from our clinical team clears you before the event.',
        'Full refund 7+ days out. Medical declines are always fully refunded.',
        'Exact address unlocks on your trip page once you are confirmed.',
      ],
    },
    private: {
      exact_address: 'Pacific Heights private residence — address shared with confirmed guests',
      arrival_notes: 'Arrive within your window; the concierge meets you at the gate.',
    },
    tiers: [
      {
        name: 'Hydration Appointment', price_cents: 14900, service: 'iv-drip',
        description: 'IV hydration appointment, lounge access, and your pre-event health check.',
        presale_opens_at: '2026-07-10T17:00:00Z', public_opens_at: '2026-07-12T17:00:00Z',
      },
      {
        name: 'Recovery Plus', price_cents: 22500, service: 'iv-drip',
        description: 'Hydration with glutathione option, compression lounge, priority arrival window.',
        presale_opens_at: '2026-07-10T17:00:00Z', public_opens_at: '2026-07-12T17:00:00Z',
      },
      {
        name: 'Experience Only', price_cents: 3500, experience_only: true,
        description: 'Lounge access, hydration bar, compression chair queue, and photo drop.',
      },
    ],
  },
];

const { data: tenant } = await db.from('tenants').select('id').eq('status', 'active').order('created_at').limit(1).maybeSingle();
const { data: services } = await db.from('event_services').select('id, slug');
const serviceBySlug = Object.fromEntries((services || []).map((s) => [s.slug, s.id]));

for (const ev of EVENTS) {
  const { data: existing } = await db.from('event_containers').select('id').eq('slug', ev.slug).maybeSingle();
  let containerId = existing?.id;
  if (!containerId) {
    const { data: created, error } = await db.from('event_containers').insert({
      tenant_id: tenant?.id || null,
      slug: ev.slug,
      name: ev.name,
      status: ev.status,
      capacity: ev.capacity,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      venue: ev.venue,
      host_name: ev.host_name,
      walk_up_gfe: ev.walk_up_gfe,
      description_blocks: ev.description_blocks,
    }).select('id').single();
    if (error) throw error;
    containerId = created.id;
    console.log(`created event ${ev.slug} (${containerId})`);
  } else {
    console.log(`event ${ev.slug} exists (${containerId}) — leaving content as-is`);
  }

  await db.from('event_container_private').upsert({
    container_id: containerId,
    tenant_id: tenant?.id || null,
    ...ev.private,
  });

  const { data: existingTiers } = await db.from('event_tiers').select('name').eq('container_id', containerId);
  const have = new Set((existingTiers || []).map((t) => t.name));
  for (const tier of ev.tiers) {
    if (have.has(tier.name)) continue;
    const { error } = await db.from('event_tiers').insert({
      tenant_id: tenant?.id || null,
      container_id: containerId,
      name: tier.name,
      description: tier.description,
      price_cents: tier.price_cents,
      experience_only: Boolean(tier.experience_only),
      presale_opens_at: tier.presale_opens_at || null,
      public_opens_at: tier.public_opens_at || null,
      service_id: tier.service ? serviceBySlug[tier.service] || null : null,
    });
    if (error) throw error;
    console.log(`  + tier ${tier.name}`);
  }
}
console.log('seed complete');
