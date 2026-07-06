/**
 * Events platform core: pricing, capacity holds, RSVP lifecycle, fulfillment
 * transitions, waitlist promotion. Shared by api/events/* endpoints and the
 * Stripe/Acuity webhook branches.
 *
 * PHI LAW: nothing in this module reads or writes health content. Visits carry
 * pointers + status enums only; every status change goes through the audited
 * transition_event_visit() DB function (the TTF source of truth — T4).
 *
 * Pure pricing/availability logic is exported separately from DB effects so
 * verify scripts can unit-test it without a database.
 */

export const HOLD_MINUTES = 15;
export const WAITLIST_CLAIM_HOURS = 4;

/* ----------------------------- pure logic ------------------------------- */

/**
 * Resolve the unit price for a tier at a given quantity.
 * volume_rules: [{ min_qty, unit_price_cents }] — highest matching min_qty wins.
 * Volume/discount rules only ever attach to experience tiers (§13.2 posture);
 * enforcement of that rule lives where tiers are authored (admin), not here.
 */
export function unitPriceForQty(tier, qty) {
  const base = Number.isFinite(tier?.price_cents) ? tier.price_cents : 0;
  const rules = Array.isArray(tier?.volume_rules) ? tier.volume_rules : [];
  let best = null;
  for (const r of rules) {
    const min = Number(r?.min_qty);
    const price = Number(r?.unit_price_cents);
    if (!Number.isFinite(min) || !Number.isFinite(price) || min < 1) continue;
    if (qty >= min && (best == null || min > best.min)) best = { min, price };
  }
  return best ? best.price : base;
}

/**
 * items: [{ tier, attendees: [{ name, email }] }] — tier is the DB row.
 * Returns { totalCents, lines: [{ tierId, tierName, qty, unitCents, subtotalCents }] }.
 * Throws on inactive tiers, empty parties, or a closed sales window.
 */
export function computeOrderLines(items, { now = new Date(), isMember = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('No items to reserve.'), { status: 400 });
  }
  const lines = [];
  let totalCents = 0;
  for (const { tier, attendees } of items) {
    if (!tier || tier.active === false) {
      throw Object.assign(new Error('Unknown or inactive tier.'), { status: 400 });
    }
    const qty = Array.isArray(attendees) ? attendees.length : 0;
    if (qty < 1) throw Object.assign(new Error('Each tier needs at least one attendee.'), { status: 400 });
    if (qty > 20) throw Object.assign(new Error('Party too large for one reservation.'), { status: 400 });
    if (!salesWindowOpen(tier, { now, isMember })) {
      throw Object.assign(new Error(`${tier.name} is not open yet.`), { status: 409, reason: 'window_closed' });
    }
    const unitCents = unitPriceForQty(tier, qty);
    const subtotalCents = unitCents * qty;
    totalCents += subtotalCents;
    lines.push({ tierId: tier.id, tierName: tier.name, qty, unitCents, subtotalCents });
  }
  return { totalCents, lines };
}

/** Presale gating: members enter at presale_opens_at, public at public_opens_at. */
export function salesWindowOpen(tier, { now = new Date(), isMember = false } = {}) {
  const t = now.getTime();
  const presale = tier?.presale_opens_at ? new Date(tier.presale_opens_at).getTime() : null;
  const pub = tier?.public_opens_at ? new Date(tier.public_opens_at).getTime() : null;
  if (pub == null && presale == null) return true;           // always-open tier
  if (isMember && presale != null) return t >= presale;
  if (pub != null) return t >= pub;
  return isMember ? false : false;                            // presale-only tier, non-member
}

/** A held visit still counts against capacity until its hold expires. */
export function isCountedAgainstCapacity(visit, now = new Date()) {
  if (['pending', 'confirmed', 'served'].includes(visit.status)) return true;
  if (visit.status === 'held') {
    return visit.hold_expires_at ? new Date(visit.hold_expires_at).getTime() > now.getTime() : true;
  }
  return false;
}

/* ----------------------------- DB effects ------------------------------- */

/** Load a published container with tiers + live assets + theme by slug. */
export async function fetchPublicEvent(db, slug) {
  const { data: container, error } = await db
    .from('event_containers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!container) return null;
  const [{ data: tiers }, { data: assets }, { data: theme }] = await Promise.all([
    db.from('event_tiers').select('*').eq('container_id', container.id).eq('active', true).order('price_cents', { ascending: false }),
    db.from('event_assets').select('id, kind, storage_path, renditions').eq('container_id', container.id).eq('status', 'live'),
    container.theme_id
      ? db.from('event_themes').select('id, name, tokens').eq('id', container.theme_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { container, tiers: tiers || [], assets: assets || [], theme: theme || null };
}

/** Active (capacity-consuming) visit count per tier, after releasing stale holds. */
export async function tierAvailability(db, { container, tier, now = new Date() }) {
  await releaseExpiredHolds(db, container.id, now);
  const { count, error } = await db
    .from('event_visits')
    .select('id', { count: 'exact', head: true })
    .eq('tier_id', tier.id)
    .in('status', ['held', 'pending', 'confirmed', 'served']);
  if (error) throw error;
  const cap = tier.allocation ?? container.capacity ?? null;
  return { taken: count ?? 0, capacity: cap, available: cap == null ? null : Math.max(0, cap - (count ?? 0)) };
}

/** Duplicate prevention (T3): one active visit per email per container. */
export async function findActiveVisitByEmail(db, containerId, email) {
  if (!email) return null;
  const { data, error } = await db
    .from('event_visits')
    .select('id, status, tier_id')
    .eq('container_id', containerId)
    .ilike('attendee_email', String(email).trim())
    .in('status', ['held', 'pending', 'confirmed'])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function transition(db, visitId, field, to, meta = {}) {
  const { data, error } = await db.rpc('transition_event_visit', {
    p_visit_id: visitId, p_field: field, p_to: to, p_actor: null, p_meta: meta,
  });
  if (error) throw error;
  return data;
}

/**
 * Create an order + held visits for a validated reservation.
 * items: [{ tier, attendees: [{ name, email }] }] (tier rows already loaded).
 * Free orders (totalCents === 0) confirm immediately — the RSVP path.
 */
export async function createEventOrderWithHolds(db, { container, items, buyer = {}, now = new Date(), isMember = false }) {
  const { totalCents, lines } = computeOrderLines(items, { now, isMember });

  // Capacity check per tier BEFORE writing anything.
  for (const { tier, attendees } of items) {
    const { available } = await tierAvailability(db, { container, tier, now });
    if (available != null && attendees.length > available) {
      throw Object.assign(new Error(`${tier.name} has ${available} seat(s) left.`), { status: 409, reason: 'sold_out' });
    }
  }

  // Duplicate prevention on the buyer + each attendee email.
  for (const { attendees } of items) {
    for (const a of attendees) {
      const dupe = await findActiveVisitByEmail(db, container.id, a.email);
      if (dupe) {
        throw Object.assign(new Error('This guest already has a reservation for this event.'), { status: 409, reason: 'duplicate' });
      }
    }
  }

  const { data: order, error: orderErr } = await db
    .from('event_orders')
    .insert({
      tenant_id: container.tenant_id,
      container_id: container.id,
      buyer_email: buyer.email || null,
      buyer_person_id: buyer.personId || null,
      total_cents: totalCents,
      status: 'pending',
    })
    .select()
    .single();
  if (orderErr) throw orderErr;

  const holdExpires = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000).toISOString();
  const visitRows = [];
  for (const { tier, attendees } of items) {
    for (const a of attendees) {
      visitRows.push({
        tenant_id: container.tenant_id,
        container_id: container.id,
        tier_id: tier.id,
        order_id: order.id,
        service_id: tier.service_id || null,
        attendee_name: a.name || null,
        attendee_email: a.email || null,
        status: 'held',
        hold_expires_at: holdExpires,
      });
    }
  }
  const { data: visits, error: visitErr } = await db.from('event_visits').insert(visitRows).select();
  if (visitErr) throw visitErr;

  if (totalCents === 0) {
    const confirmed = await confirmEventOrder(db, { orderId: order.id, now });
    return { ...confirmed, totalCents, lines, free: true };
  }
  return { order, visits, totalCents, lines, free: false };
}

/**
 * Idempotent fulfillment: mark the order paid and confirm its visits.
 * Safe to call from webhook replays — a paid order short-circuits.
 */
export async function confirmEventOrder(db, { orderId, stripeSessionId = null, paymentIntent = null, now = new Date() }) {
  const { data: order, error } = await db.from('event_orders').select('*').eq('id', orderId).single();
  if (error) throw error;
  if (order.status === 'paid') {
    const { data: visits } = await db.from('event_visits').select('*').eq('order_id', orderId);
    return { order, visits: visits || [], alreadyFulfilled: true };
  }

  const patch = { status: 'paid', updated_at: new Date(now).toISOString() };
  if (stripeSessionId) patch.stripe_session_id = stripeSessionId;
  if (paymentIntent) patch.stripe_payment_intent = paymentIntent;
  const { data: paidOrder, error: payErr } = await db
    .from('event_orders').update(patch).eq('id', orderId).select().single();
  if (payErr) throw payErr;

  const { data: visits, error: vErr } = await db
    .from('event_visits')
    .select('*, event_services:service_id (requires_gfe, gfe_pathway)')
    .eq('order_id', orderId);
  if (vErr) throw vErr;

  const confirmed = [];
  for (const v of visits || []) {
    let row = v;
    if (v.status === 'held') {
      row = await transition(db, v.id, 'status', 'confirmed', { via: 'fulfillment', order_id: orderId });
    } else if (v.status === 'pending') {
      row = await transition(db, v.id, 'status', 'confirmed', { via: 'fulfillment', order_id: orderId });
    }
    const svc = v.event_services;
    if (svc?.requires_gfe && row.gfe_status === 'not_started') {
      row = await transition(db, v.id, 'gfe_status', 'invited', { via: 'fulfillment' });
      await db.from('event_visits').update({ gfe_pathway: svc.gfe_pathway || 'acuity_np' }).eq('id', v.id);
    }
    confirmed.push(row);
  }
  return { order: paidOrder, visits: confirmed, alreadyFulfilled: false };
}

/** Release stale holds (lazy reaper — runs on every availability check). */
export async function releaseExpiredHolds(db, containerId, now = new Date()) {
  const { data: stale, error } = await db
    .from('event_visits')
    .select('id')
    .eq('container_id', containerId)
    .eq('status', 'held')
    .lt('hold_expires_at', new Date(now).toISOString());
  if (error) throw error;
  for (const v of stale || []) {
    await transition(db, v.id, 'status', 'canceled', { via: 'hold_expired' });
  }
  return (stale || []).length;
}

/**
 * Refund sync (2A/T2): flip order + visits, then promote the waitlist.
 * Called from the charge.refunded webhook branch; idempotent.
 */
export async function syncEventOrderRefund(db, { order, now = new Date() }) {
  if (order.status === 'refunded') return { order, promoted: null, alreadySynced: true };
  const { data: refunded, error } = await db
    .from('event_orders')
    .update({ status: 'refunded', refund_status: 'refunded', updated_at: new Date(now).toISOString() })
    .eq('id', order.id)
    .select()
    .single();
  if (error) throw error;

  const { data: visits } = await db.from('event_visits').select('id, status, tier_id').eq('order_id', order.id);
  let tierId = null;
  for (const v of visits || []) {
    if (['confirmed', 'pending', 'no_show'].includes(v.status)) {
      await transition(db, v.id, 'status', 'refunded', { via: 'charge.refunded' });
      tierId = tierId || v.tier_id;
    }
  }
  const promoted = await promoteWaitlist(db, { containerId: order.container_id, tierId, now });
  return { order: refunded, promoted, alreadySynced: false };
}

/** Top unpromoted waitlist entry gets a claim window (blueprint 4.5.3). */
export async function promoteWaitlist(db, { containerId, tierId = null, now = new Date() }) {
  let q = db
    .from('event_waitlist')
    .select('*')
    .eq('container_id', containerId)
    .is('promoted_at', null)
    .order('position', { ascending: true })
    .limit(1);
  if (tierId) q = q.eq('tier_id', tierId);
  const { data: entry, error } = await q.maybeSingle();
  if (error) throw error;
  if (!entry) return null;
  const claimExpires = new Date(new Date(now).getTime() + WAITLIST_CLAIM_HOURS * 3600 * 1000).toISOString();
  const { data: promoted, error: pErr } = await db
    .from('event_waitlist')
    .update({ promoted_at: new Date(now).toISOString(), claim_expires_at: claimExpires })
    .eq('id', entry.id)
    .select()
    .single();
  if (pErr) throw pErr;
  return promoted;
}
