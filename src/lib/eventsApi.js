/**
 * Client wrapper for the events endpoints (ET4). Replaces the localStorage
 * demo store (src/data/events.js) — visits live in Postgres now; this module
 * is the only way client pages talk to the events backend.
 */

async function devFallbackEvent(slug) {
  if (!import.meta.env.DEV) return null;
  const { fallbackEvent } = await import('./eventsFallback');
  return fallbackEvent(slug);
}

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
    // Local development may load the isolated synthetic fixture below.
  }
  return devFallbackEvent(slug);
}

// Production has no synchronous synthetic first paint. EventPage starts in a
// loading state and reconciles only with the live endpoint. The development
// fallback stays behind the dynamic import above and is absent from live JS.
export function fetchEventSync() {
  return null;
}

// Background revalidator. Same as fetchEvent but never returns fallback on error —
// the caller keeps whatever it already had if the API is unavailable.
export async function fetchEventFresh(slug) {
  const { event } = await getJson(`/api/events/catalog?slug=${encodeURIComponent(slug)}`);
  return event || null;
}

/**
 * Reserve (free RSVP or paid). items: [{ tierId, attendees: [{name, email}] }].
 * Paid (inline) → { clientSecret, paymentIntentId, orderId, returnUrl }.
 * Paid (hosted) → { url, orderId }.
 * Free → { free: true, orderId, visitIds }.
 */
export async function reserveEvent({ slug, items, buyer, member = false, mode }) {
  const res = await fetch('/api/events/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ slug, items, buyer, member, mode }),
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
