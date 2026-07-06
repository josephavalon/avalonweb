/**
 * Kiosk sign-in + public departures board (ET5, blueprint §6.3.1).
 *
 *   POST /api/events/kiosk { slug, firstName, lastName, phone, serviceInterest, smsOptIn, boardOptOut }
 *        → queue_entry (initials only on the board) + position
 *   GET  /api/events/kiosk?slug=<event>
 *        → board rows: initials + status + position + station. NOTHING else.
 *
 * INTAKE MODE (placeholder rule): until the on-site Acuity GFE appointment
 * type is configured (ACUITY_ONSITE_GFE_TYPE_ID), the kiosk collects ZERO
 * intake content — the NP charts directly in Acuity at the station ("Acuity
 * direct" mode). The platform NEVER stores intake answers in either mode
 * (PHI law); the future wired mode posts them straight to Acuity's API.
 *
 * SMS is board-only until ET8 (BAA provider): sms_opt_in is recorded (TCPA
 * consent at the moment of collection) but no text is sent yet.
 */
import { getSupabaseServiceClient } from '../_supabase-server.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';

function initialsOf(first, last) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  return `${f.slice(0, 1).toUpperCase()}${f ? '.' : ''}${l ? `${l.slice(0, 1).toUpperCase()}.` : ''}` || 'G.';
}

const BOARD_STATUSES = ['waiting', 'notified', 'called', 'at_station', 'in_gfe'];
const LANE_BY_INTEREST = { shots: 'express', im: 'express', shot_bar: 'express' };

export default async function handler(req, res) {
  let db;
  try {
    db = await getSupabaseServiceClient();
  } catch {
    return res.status(500).json({ ok: false, error: 'The lounge is unavailable right now.' });
  }

  const slug = String((req.method === 'GET' ? req.query?.slug : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {})?.slug) || '').trim();
  const { data: container } = await db
    .from('event_containers')
    .select('id, tenant_id, slug, name, walk_up_gfe, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

  if (req.method === 'GET') {
    const limit = await checkRateLimit({ key: `events-board:${clientIp(req)}`, windowMs: 60_000, max: 30 });
    if (!limit.ok) return res.status(429).json({ ok: false, error: 'Slow down.' });
    const { data: rows, error } = await db
      .from('event_queue_entries')
      .select('display_initials, status, position, station_id, lane, service_interest, board_opt_out')
      .eq('container_id', container.id)
      .in('status', BOARD_STATUSES)
      .order('position', { ascending: true })
      .limit(30);
    if (error) return res.status(500).json({ ok: false, error: 'Board unavailable.' });
    const board = (rows || [])
      .filter((r) => !r.board_opt_out)
      .map((r) => ({
        initials: r.display_initials || 'G.',
        status: r.status,
        position: r.position,
        station: r.station_id,
        lane: r.lane,
      }));
    return res.status(200).json({
      ok: true,
      event: { slug: container.slug, name: container.name },
      walkUpGfe: Boolean(container.walk_up_gfe),
      board,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const limit = await checkRateLimit({ key: `events-kiosk:${clientIp(req)}`, windowMs: 60_000, max: 10 });
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'One moment — try again.' });

  try {
    // Walk-up GFE OFF → experience access only; the kiosk hard-blocks IV
    // sign-ups with a concierge exit, never an override (blueprint §6.2.4).
    if (!container.walk_up_gfe) {
      return res.status(200).json({
        ok: true,
        result: 'walk_up_gfe_off',
        message: 'IV sign-ups are closed tonight. Book your Avalon visit and we will come to you.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const firstName = String(body.firstName || '').trim().slice(0, 60);
    const lastName = String(body.lastName || '').trim().slice(0, 60);
    const phoneDigits = String(body.phone || '').replace(/[^\d+]/g, '');
    if (!firstName || phoneDigits.length < 10) {
      return res.status(400).json({ ok: false, error: 'First name and mobile number are required.' });
    }
    const phone = phoneDigits.startsWith('+') ? phoneDigits : `+1${phoneDigits.slice(-10)}`;

    // Duplicate: same phone already active in this queue → return their spot.
    const { data: existing } = await db
      .from('event_queue_entries')
      .select('id, position, status, display_initials')
      .eq('container_id', container.id)
      .eq('phone_e164', phone)
      .in('status', BOARD_STATUSES)
      .maybeSingle();
    if (existing) {
      const { count } = await db.from('event_queue_entries')
        .select('id', { count: 'exact', head: true })
        .eq('container_id', container.id).eq('status', 'waiting').lt('position', existing.position);
      return res.status(200).json({
        ok: true, result: 'already_in_line',
        entry: { position: existing.position, ahead: count ?? 0, initials: existing.display_initials },
      });
    }

    const { data: maxRow } = await db.from('event_queue_entries')
      .select('position').eq('container_id', container.id)
      .order('position', { ascending: false }).limit(1).maybeSingle();
    const position = (maxRow?.position || 0) + 1;
    const serviceInterest = String(body.serviceInterest || 'iv').slice(0, 30);

    const { data: entry, error } = await db
      .from('event_queue_entries')
      .insert({
        tenant_id: container.tenant_id,
        container_id: container.id,
        display_initials: initialsOf(firstName, lastName),
        service_interest: serviceInterest,
        lane: LANE_BY_INTEREST[serviceInterest] || 'flow',
        status: 'waiting',
        position,
        sms_opt_in: Boolean(body.smsOptIn),
        board_opt_out: Boolean(body.boardOptOut),
        phone_e164: phone,
      })
      .select('id, position, display_initials, lane')
      .single();
    if (error) throw error;

    const { count: ahead } = await db.from('event_queue_entries')
      .select('id', { count: 'exact', head: true })
      .eq('container_id', container.id).eq('status', 'waiting').lt('position', entry.position);

    return res.status(200).json({
      ok: true,
      result: 'joined',
      entry: { position: entry.position, ahead: ahead ?? 0, initials: entry.display_initials, lane: entry.lane },
      smsMode: 'board_only',   // ET8 flips this to 'sms' when the BAA provider lands
    });
  } catch (err) {
    console.error('[events/kiosk]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Sign-in failed — grab a team member.' });
  }
}
