/**
 * On-site GFE queue (ET5, blueprint §6.3) — board-only mode until the BAA SMS
 * provider lands (ET8): positions live on the departures board; no texts.
 *
 *   GET  /api/events/queue?slug=<event>            staff: full queue console data
 *   POST /api/events/queue { slug, action, ... }   staff actions:
 *        call_next { station, lane? }  — capacity-aware (T6): express jumps only
 *                                        when an express station calls
 *        at_station | in_gfe { entryId }
 *        clear | decline { entryId }   — clinical one-taps; clear flips the
 *                                        linked visit's gfe_status via the RPC
 *        no_answer { entryId }         — 2 strikes → parked as 'left'
 *        rejoin { entryId }            — one-tap back to waiting (end of lane)
 *
 * PHI LAW: entries carry initials, phone, lane, status — no health content.
 * Flags live in the chart; the console deep-links, it never stores.
 */
import { getServiceClient, requireStaff, requireRole } from '../_lib/supabase-auth.js';

const CLINICAL_ROLES = ['nurse', 'rn', 'np', 'physician', 'medical_director', 'admin', 'founder'];

async function loadContainer(db, slug) {
  const { data } = await db.from('event_containers').select('id, tenant_id, slug, name, walk_up_gfe').eq('slug', slug).maybeSingle();
  return data || null;
}

async function nextPosition(db, containerId) {
  const { data } = await db.from('event_queue_entries')
    .select('position').eq('container_id', containerId)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  return (data?.position || 0) + 1;
}

export default async function handler(req, res) {
  const db = await getServiceClient();
  if (!db) return res.status(500).json({ ok: false, error: 'Service unavailable.' });

  if (req.method === 'GET') {
    const caller = await requireStaff(req, res);
    if (!caller) return undefined;
    const container = await loadContainer(db, String(req.query?.slug || '').trim());
    if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });
    const { data: entries, error } = await db
      .from('event_queue_entries')
      .select('id, display_initials, service_interest, lane, status, position, station_id, call_count, joined_at, called_at, phone_e164, visit_id')
      .eq('container_id', container.id)
      .order('position', { ascending: true });
    if (error) return res.status(500).json({ ok: false, error: 'Queue unavailable.' });
    return res.status(200).json({ ok: true, event: { slug: container.slug, name: container.name }, entries: entries || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const action = String(body.action || '');

  // Clear/decline are clinical decisions — clinical roles only (blueprint 3.4).
  const caller = ['clear', 'decline'].includes(action)
    ? await requireRole(req, res, CLINICAL_ROLES)
    : await requireStaff(req, res);
  if (!caller) return undefined;

  try {
    const container = await loadContainer(db, String(body.slug || '').trim());
    if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

    async function getEntry(id) {
      const { data } = await db.from('event_queue_entries').select('*').eq('id', id).eq('container_id', container.id).maybeSingle();
      return data || null;
    }
    async function patch(id, fields) {
      const { data, error } = await db.from('event_queue_entries').update(fields).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    if (action === 'call_next') {
      const station = String(body.station || '').trim() || 'gfe-1';
      const lane = ['express', 'flow'].includes(body.lane) ? body.lane : null;
      // Capacity-aware ordering (T6): a lane jump happens only when a station
      // explicitly calls for that lane; otherwise strict position order.
      let q = db.from('event_queue_entries')
        .select('id, position, lane')
        .eq('container_id', container.id)
        .eq('status', 'waiting')
        .order('position', { ascending: true })
        .limit(1);
      if (lane) q = q.eq('lane', lane);
      const { data: next } = await q.maybeSingle();
      if (!next) return res.status(200).json({ ok: true, result: 'queue_empty' });
      const entry = await patch(next.id, {
        status: 'called', station_id: station,
        called_at: new Date().toISOString(),
        call_count: 1,
      });
      return res.status(200).json({ ok: true, result: 'called', entry });
    }

    const entry = await getEntry(String(body.entryId || ''));
    if (!entry) return res.status(404).json({ ok: false, error: 'Queue entry not found.' });

    if (action === 'at_station') {
      return res.status(200).json({ ok: true, entry: await patch(entry.id, { status: 'at_station' }) });
    }
    if (action === 'in_gfe') {
      return res.status(200).json({ ok: true, entry: await patch(entry.id, { status: 'in_gfe' }) });
    }
    if (action === 'no_answer') {
      // Two unanswered calls → auto-park as 'left' with one-tap rejoin (§6.3.2).
      const calls = (entry.call_count || 0) + 1;
      const parked = calls >= 2;
      const patched = await patch(entry.id, {
        call_count: calls,
        status: parked ? 'left' : 'waiting',
        station_id: parked ? entry.station_id : null,
        resolved_at: parked ? new Date().toISOString() : null,
      });
      return res.status(200).json({ ok: true, result: parked ? 'parked' : 'requeued', entry: patched });
    }
    if (action === 'rejoin') {
      const patched = await patch(entry.id, {
        status: 'waiting', station_id: null, resolved_at: null, call_count: 0,
        position: await nextPosition(db, container.id),
      });
      return res.status(200).json({ ok: true, entry: patched });
    }
    if (action === 'clear' || action === 'decline') {
      const status = action === 'clear' ? 'cleared' : 'declined';
      const patched = await patch(entry.id, { status, resolved_at: new Date().toISOString() });
      // Walk-ups with a linked visit get the audited GFE flip too.
      if (entry.visit_id) {
        const to = action === 'clear' ? 'cleared' : 'declined_medical';
        await db.rpc('transition_event_visit', {
          p_visit_id: entry.visit_id, p_field: 'gfe_status', p_to: to,
          p_actor: caller.user?.id || null, p_meta: { via: 'queue_console', entry: entry.id },
        }).then(({ error }) => { if (error) console.warn('[events/queue] visit gfe flip failed', error.message); });
      }
      return res.status(200).json({ ok: true, entry: patched });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[events/queue]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Queue action failed.' });
  }
}
