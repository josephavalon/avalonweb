/**
 * Client wrapper for the events endpoints (ET4). Replaces the localStorage
 * demo store (src/data/events.js) — visits live in Postgres now; this module
 * is the only way client pages talk to the events backend.
 */

import { fallbackList, fallbackEvent } from './eventsFallback';

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw Object.assign(new Error(body.error || 'Request failed.'), { status: res.status });
  }
  return body;
}

export async function fetchEventsFeed() {
  try {
    const { upcoming, previously } = await getJson('/api/events/catalog');
    return { upcoming: upcoming || [], previously: previously || [] };
  } catch {
    return { upcoming: [], previously: [] };
  }
}

export async function fetchEvent(slug) {
  try {
    const { event } = await getJson(`/api/events/catalog?slug=${encodeURIComponent(slug)}`);
    if (event) return event;
  } catch {
    // Fall through to fallback lookup.
  }
  return fallbackEvent(slug);
}

/**
 * Reserve (free RSVP or paid). items: [{ tierId, attendees: [{name, email}] }].
 * Paid → { url } (Stripe Checkout). Free → { free: true, orderId, visitIds }.
 */
export async function reserveEvent({ slug, items, buyer, member = false }) {
  const res = await fetch('/api/events/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ slug, items, buyer, member }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw Object.assign(new Error(body.error || 'Reservation failed.'), {
      status: res.status,
      reason: body.reason,
    });
  }
  return body;
}

/** Trip lookup by order id, visit id, or Stripe session id (success redirect). */
export async function fetchTrip({ order, visit, session } = {}) {
  const params = new URLSearchParams();
  if (order) params.set('order', order);
  else if (visit) params.set('visit', visit);
  else if (session) params.set('session', session);
  const { trip } = await getJson(`/api/events/trip?${params.toString()}`);
  return trip;
}
