/**
 * POST /api/events/checkout
 *
 * Reserve seats for an event (blueprint v1.5 ET2). Body:
 *   { slug, items: [{ tierId, attendees: [{ name, email }] }], buyer: { email }, member?: bool }
 *
 * Flow: rate-limit → load the published container (presale|public only) →
 * resolve tiers → createEventOrderWithHolds (events-core). Free orders confirm
 * immediately (the RSVP path); paid orders get a Stripe Checkout session whose
 * expiry tracks the capacity hold so an abandoned session releases seats.
 *
 * PHI LAW: Stripe metadata carries ids/slugs only — no names, no emails beyond
 * what Stripe itself collects at payment. Line items are tier names (public
 * catalog labels), never per-attendee detail.
 */
import Stripe from 'stripe';
import { getSupabaseServiceClient } from '../_supabase-server.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { fetchPublicEvent, createEventOrderWithHolds, HOLD_MINUTES } from '../_lib/events-core.js';

const RATE_LIMIT = { windowMs: 60 * 1000, max: 10 };
const OPEN_STATUSES = new Set(['presale', 'public']);

/**
 * Pure request validation — returns { slug, items, buyer, isMember } or throws
 * a status-tagged error. Exported for scripts/verify-events-checkout.mjs.
 */
export function validateEventCheckoutRequest(body = {}) {
  const fail = (message, code) => {
    throw Object.assign(new Error(message), { status: 400, code });
  };
  const slug = String(body.slug || '').trim();
  if (!slug) fail('Event slug is required.', 'slug_required');

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) fail('At least one tier is required.', 'items_required');
  if (rawItems.length > 10) fail('Too many tiers in one reservation.', 'items_too_many');

  const items = rawItems.map((item) => {
    const tierId = String(item?.tierId || '').trim();
    if (!tierId) fail('Each item needs a tierId.', 'tier_id_required');
    const attendees = Array.isArray(item?.attendees) ? item.attendees : [];
    if (!attendees.length) fail('Each tier needs at least one attendee.', 'attendees_required');
    if (attendees.length > 20) fail('Party too large for one reservation.', 'party_too_large');
    return {
      tierId,
      attendees: attendees.map((a) => ({
        name: String(a?.name || '').trim().slice(0, 120) || null,
        email: String(a?.email || '').trim().toLowerCase().slice(0, 254) || null,
      })),
    };
  });

  const buyerEmail = String(body.buyer?.email || '').trim().toLowerCase();
  if (!buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    fail('A valid buyer email is required.', 'buyer_email_invalid');
  }

  return { slug, items, buyer: { email: buyerEmail }, isMember: body.member === true };
}

/**
 * Pure: events-core order lines → Stripe Checkout line_items. Tier names only
 * (public catalog labels) — no attendee identity. Exported for verify script.
 */
export function stripeLineItemsFromOrderLines(lines = []) {
  return lines.map((line) => ({
    quantity: line.qty,
    price_data: {
      currency: 'usd',
      unit_amount: line.unitCents,
      product_data: { name: line.tierName || 'Avalon Event' },
    },
  }));
}

// Mirrors create-checkout-session.js publicBaseUrl (simpler: events checkout
// is preview-first, so the header fallback stays available).
function publicBaseUrl(req) {
  const configured = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  const proto = req.headers?.['x-forwarded-proto'] || 'http';
  const host = req.headers?.host || '127.0.0.1:5173';
  return `${proto}://${host}`;
}

// Stripe enforces a 30-minute minimum on Checkout expiry; the DB capacity hold
// is HOLD_MINUTES (15). The lazy hold reaper + checkout.session.expired branch
// reconcile the gap — seats free up as soon as either fires.
function checkoutExpiresAt() {
  return Math.floor(Date.now() / 1000) + Math.max(30, HOLD_MINUTES) * 60;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  const limit = await checkRateLimit({ key: `events-checkout:${ip}`, ...RATE_LIMIT });
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'rate_limited' });
  }

  try {
    const { slug, items, buyer, isMember } = validateEventCheckoutRequest(req.body || {});

    const db = await getSupabaseServiceClient();
    if (!db) {
      return res.status(503).json({ error: 'Reservations are unavailable right now.', code: 'db_not_configured' });
    }

    const eventData = await fetchPublicEvent(db, slug);
    if (!eventData || !OPEN_STATUSES.has(eventData.container.status)) {
      return res.status(404).json({ error: 'This event is not open for reservations.', code: 'event_not_open' });
    }
    const { container, tiers } = eventData;

    // Resolve tier rows and verify they belong to this container (fetchPublicEvent
    // already scopes to container + active, so a miss here is either a foreign
    // tier id or an inactive one — both rejected).
    const tierById = new Map(tiers.map((t) => [t.id, t]));
    const resolvedItems = items.map(({ tierId, attendees }) => {
      const tier = tierById.get(tierId);
      if (!tier || tier.container_id !== container.id) {
        throw Object.assign(new Error('Unknown or inactive tier for this event.'), { status: 400, code: 'tier_not_found' });
      }
      return { tier, attendees };
    });

    const result = await createEventOrderWithHolds(db, {
      container,
      items: resolvedItems,
      buyer,
      isMember,
    });

    if (result.free) {
      return res.status(200).json({
        ok: true,
        free: true,
        orderId: result.order.id,
        visitIds: (result.visits || []).map((v) => v.id),
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Secure checkout is not configured.', code: 'payment_provider_missing' });
    }

    const baseUrl = publicBaseUrl(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: buyer.email,
      line_items: stripeLineItemsFromOrderLines(result.lines),
      expires_at: checkoutExpiresAt(),
      client_reference_id: result.order.id,
      // ids/slugs only — the webhook routes on kind + event_order_id.
      metadata: {
        kind: 'event',
        event_order_id: result.order.id,
        container_slug: container.slug,
      },
      success_url: `${baseUrl}/trips/{CHECKOUT_SESSION_ID}?order=${result.order.id}`,
      cancel_url: `${baseUrl}/events/${container.slug}?payment=cancelled`,
    });

    const { error: linkError } = await db
      .from('event_orders')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', result.order.id);
    if (linkError) {
      console.warn('[events/checkout] could not link Stripe session', safeLogContext(linkError, 'event_session_link_failed'));
    }

    return res.status(200).json({ ok: true, url: session.url, orderId: result.order.id });
  } catch (err) {
    const status = Number(err?.status) || 500;
    if (status >= 500) {
      console.error('[events/checkout] failed', safeLogContext(err, 'event_checkout_failed'));
    }
    return res.status(status).json({
      error: status < 500 ? (err.message || 'Reservation could not be started.') : 'Reservation could not be started. Please try again.',
      code: err.code || err.reason || safeErrorCode(err, 'event_checkout_failed'),
    });
  }
}
