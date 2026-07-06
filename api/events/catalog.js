/**
 * Public events catalog (client journey, ET4).
 *   GET /api/events/catalog            → published events feed (presale|public|sold_out + recent closed)
 *   GET /api/events/catalog?slug=x     → one event: container + tiers (with availability) + live assets + theme
 *
 * PHI LAW: this endpoint serves marketing-shaped data only. The exact address
 * NEVER appears here (it lives in event_container_private, served by trip.js
 * to confirmed attendees only). GFE appears only as aggregate counts, never
 * per-person.
 */
import { getSupabaseServiceClient } from '../_supabase-server.js';
import { fetchPublicEvent, tierAvailability } from '../_lib/events-core.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';

const PUBLIC_STATUSES = ['presale', 'public', 'sold_out'];

function publicContainerShape(c) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    status: c.status,
    capacity: c.capacity,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    venue: c.venue,                       // neighborhood-level only
    venueLat: c.venue_lat,
    venueLng: c.venue_lng,
    hostName: c.host_name,
    cohosts: c.cohosts,
    descriptionBlocks: c.description_blocks,
    walkUpGfe: c.walk_up_gfe,
  };
}

function publicTierShape(t, availability) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    priceCents: t.price_cents,
    experienceOnly: t.experience_only,
    memberGated: t.member_gated,
    applicationGated: t.application_gated,
    presaleOpensAt: t.presale_opens_at,
    publicOpensAt: t.public_opens_at,
    serviceId: t.service_id,
    soldOut: availability ? availability.available === 0 : false,
    remaining: availability?.available ?? null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const limit = await checkRateLimit({ key: `events-catalog:${clientIp(req)}`, windowMs: 60_000, max: 60 });
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  let db;
  try {
    db = await getSupabaseServiceClient();
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Events are unavailable right now.' });
  }

  try {
    const slug = String(req.query?.slug || '').trim();

    if (slug) {
      const bundle = await fetchPublicEvent(db, slug);
      if (!bundle || !PUBLIC_STATUSES.includes(bundle.container.status)) {
        return res.status(404).json({ ok: false, error: 'Event not found.' });
      }
      const { container, tiers, assets, theme } = bundle;

      // Per-tier availability (also lazily reaps expired holds).
      const tierShapes = [];
      for (const t of tiers) {
        const availability = await tierAvailability(db, { container, tier: t });
        tierShapes.push(publicTierShape(t, availability));
      }

      // Clinical lead + services meta (mono-voice facts: name, credential, back-on-floor).
      let clinicalLead = null;
      if (container.clinical_lead_id) {
        const { data: lead } = await db
          .from('provider_profiles')
          .select('provider_role, person_id, people:person_id (display_name)')
          .eq('id', container.clinical_lead_id)
          .maybeSingle();
        if (lead) {
          clinicalLead = {
            name: lead.people?.display_name || null,
            role: (lead.provider_role || '').toUpperCase(),  // RN / NP / PHYSICIAN — mono voice fact
          };
        }
      }
      const serviceIds = [...new Set(tiers.map((t) => t.service_id).filter(Boolean))];
      let services = [];
      if (serviceIds.length) {
        const { data } = await db
          .from('event_services')
          .select('id, name, service_class, requires_gfe, back_on_floor_minutes')
          .in('id', serviceIds);
        services = data || [];
      }

      // GFE progress as COUNTS only (promoter-safe, blueprint 3.1.4).
      const { count: confirmedCount } = await db
        .from('event_visits')
        .select('id', { count: 'exact', head: true })
        .eq('container_id', container.id)
        .in('status', ['confirmed', 'served']);

      return res.status(200).json({
        ok: true,
        event: {
          ...publicContainerShape(container),
          tiers: tierShapes,
          assets,
          theme: theme ? { name: theme.name, tokens: theme.tokens } : null,
          clinicalLead,
          services,
          attendeeCount: confirmedCount ?? 0,
        },
      });
    }

    // Feed: published events + a short "Previously" strip of closed ones.
    const { data: rows, error } = await db
      .from('event_containers')
      .select('*')
      .in('status', [...PUBLIC_STATUSES, 'closed'])
      .order('starts_at', { ascending: true });
    if (error) throw error;

    // Batch-enrich cards: hero image + price-from, two queries total.
    const ids = (rows || []).map((c) => c.id);
    const heroByContainer = {};
    const priceFromByContainer = {};
    if (ids.length) {
      const [{ data: heroes }, { data: tierRows }] = await Promise.all([
        db.from('event_assets').select('container_id, storage_path, renditions')
          .in('container_id', ids).eq('status', 'live').eq('kind', 'hero'),
        db.from('event_tiers').select('container_id, price_cents')
          .in('container_id', ids).eq('active', true),
      ]);
      for (const h of heroes || []) {
        if (!heroByContainer[h.container_id]) {
          heroByContainer[h.container_id] = h.renditions?.card_640 || h.renditions?.hero_1920 || h.storage_path;
        }
      }
      for (const t of tierRows || []) {
        const cur = priceFromByContainer[t.container_id];
        if (t.price_cents > 0 && (cur == null || t.price_cents < cur)) {
          priceFromByContainer[t.container_id] = t.price_cents;
        }
      }
    }

    const now = Date.now();
    const upcoming = [];
    const previously = [];
    for (const c of rows || []) {
      const shape = {
        ...publicContainerShape(c),
        heroImage: heroByContainer[c.id] || null,
        priceFromCents: priceFromByContainer[c.id] ?? null,
      };
      if (c.status === 'closed' || (c.ends_at && new Date(c.ends_at).getTime() < now)) {
        previously.push(shape);
      } else {
        upcoming.push(shape);
      }
    }
    return res.status(200).json({ ok: true, upcoming, previously: previously.slice(-6).reverse() });
  } catch (err) {
    console.error('[events/catalog]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Events are unavailable right now.' });
  }
}
