/**
 * Trip page data (client journey, ET4).
 *   GET /api/events/trip?order=<uuid>   → order + all its visits ("your party")
 *   GET /api/events/trip?visit=<uuid>   → single visit (per-attendee GFE link)
 *   GET /api/events/trip?session=<cs_*> → resolve a Stripe session id to its order
 *                                          (checkout success redirect)
 *
 * Access model: possession of the v4 UUID is the bearer credential (same
 * entropy class as a signed token; ticket-link convention). QR/manifest
 * hardening with signed JWTs lands in ET5 — this endpoint never returns
 * anything scannable at a door.
 *
 * PHI LAW: returns status enums + pointers only. The GFE payload is the enum
 * and the booking link — never content, never reasons. Exact address appears
 * ONLY when the visit is confirmed/served (Airbnb-style reveal).
 */
import { getSupabaseServiceClient } from '../_supabase-server.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function visitShape(v, service) {
  return {
    id: v.id,
    status: v.status,
    attendeeName: v.attendee_name,
    gfeStatus: v.gfe_status,
    gfePathway: v.gfe_pathway,
    gfeRequired: Boolean(service?.requires_gfe),
    serviceName: service?.name || null,
    serviceClass: service?.service_class || null,
    backOnFloorMinutes: service?.back_on_floor_minutes ?? null,
    photoRelease: v.photo_release,
    servedAt: v.served_at,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const limit = await checkRateLimit({ key: `events-trip:${clientIp(req)}`, windowMs: 60_000, max: 60 });
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  let db;
  try {
    db = await getSupabaseServiceClient();
  } catch {
    return res.status(500).json({ ok: false, error: 'Trip is unavailable right now.' });
  }

  try {
    const orderParam = String(req.query?.order || '').trim();
    const visitParam = String(req.query?.visit || '').trim();
    const sessionParam = String(req.query?.session || '').trim();

    let order = null;
    let visits = [];

    if (sessionParam.startsWith('cs_')) {
      const { data } = await db.from('event_orders').select('*').eq('stripe_session_id', sessionParam).maybeSingle();
      if (!data) return res.status(404).json({ ok: false, error: 'Reservation not found yet — refresh in a moment.' });
      order = data;
    } else if (orderParam) {
      if (!UUID_RE.test(orderParam)) return res.status(400).json({ ok: false, error: 'Bad reference.' });
      const { data } = await db.from('event_orders').select('*').eq('id', orderParam).maybeSingle();
      if (!data) return res.status(404).json({ ok: false, error: 'Reservation not found.' });
      order = data;
    } else if (visitParam) {
      if (!UUID_RE.test(visitParam)) return res.status(400).json({ ok: false, error: 'Bad reference.' });
    } else {
      return res.status(400).json({ ok: false, error: 'Missing reference.' });
    }

    if (order) {
      const { data } = await db.from('event_visits').select('*').eq('order_id', order.id).order('created_at');
      visits = data || [];
    } else {
      const { data } = await db.from('event_visits').select('*').eq('id', visitParam).maybeSingle();
      if (!data) return res.status(404).json({ ok: false, error: 'Reservation not found.' });
      visits = [data];
    }
    if (!visits.length) return res.status(404).json({ ok: false, error: 'Reservation not found.' });

    const containerId = visits[0].container_id;
    const { data: container } = await db.from('event_containers').select('*').eq('id', containerId).maybeSingle();
    if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

    const serviceIds = [...new Set(visits.map((v) => v.service_id).filter(Boolean))];
    const servicesById = {};
    if (serviceIds.length) {
      const { data: services } = await db
        .from('event_services')
        .select('id, name, service_class, requires_gfe, back_on_floor_minutes, acuity_appointment_type_id')
        .in('id', serviceIds);
      for (const s of services || []) servicesById[s.id] = s;
    }

    // Airbnb-style reveal: exact address only once at least one visit in this
    // view is confirmed or served.
    const anyConfirmed = visits.some((v) => ['confirmed', 'served'].includes(v.status));
    let exactAddress = null;
    let arrivalNotes = null;
    if (anyConfirmed) {
      const { data: priv } = await db
        .from('event_container_private')
        .select('exact_address, arrival_notes')
        .eq('container_id', containerId)
        .maybeSingle();
      exactAddress = priv?.exact_address || null;
      arrivalNotes = priv?.arrival_notes || null;
    }

    return res.status(200).json({
      ok: true,
      trip: {
        order: order
          ? { id: order.id, status: order.status, totalCents: order.total_cents, refundStatus: order.refund_status }
          : null,
        event: {
          slug: container.slug,
          name: container.name,
          status: container.status,
          startsAt: container.starts_at,
          endsAt: container.ends_at,
          venue: container.venue,
          hostName: container.host_name,
          exactAddress,
          arrivalNotes,
        },
        visits: visits.map((v) => visitShape(v, servicesById[v.service_id])),
      },
    });
  } catch (err) {
    console.error('[events/trip]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Trip is unavailable right now.' });
  }
}
