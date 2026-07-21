/**
 * TTF dashboard data (ET6, blueprint amendment A). Staff-only.
 *   GET /api/events/ttf?slug=<event>
 * Server truth: audit rows + orders + queue entries; never client analytics.
 */
import { getServiceClient, requireStaff } from '../_lib/supabase-auth.js';
import { assembleTtfReport } from '../_lib/events-ttf.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const caller = await requireStaff(req, res);
  if (!caller) return undefined;

  const db = await getServiceClient();
  if (!db) return res.status(500).json({ ok: false, error: 'Service unavailable.' });

  try {
    const slug = String(req.query?.slug || '').trim();
    const { data: container } = await db.from('event_containers').select('id, slug, name').eq('slug', slug).maybeSingle();
    if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

    const { data: visitIds } = await db.from('event_visits').select('id').eq('container_id', container.id);
    const ids = (visitIds || []).map((v) => v.id);

    const [auditRows, orders, queueEntries] = await Promise.all([
      ids.length
        ? db.from('event_audit_log').select('target_id, to_value, at').eq('target_type', 'event_visit').in('target_id', ids).order('at')
            .then(({ data }) => data || [])
        : Promise.resolve([]),
      db.from('event_orders').select('status, created_at, updated_at').eq('container_id', container.id)
        .then(({ data }) => data || []),
      db.from('event_queue_entries').select('joined_at, called_at, resolved_at').eq('container_id', container.id)
        .then(({ data }) => data || []),
    ]);

    return res.status(200).json({
      ok: true,
      event: { slug: container.slug, name: container.name },
      ttf: assembleTtfReport({ auditRows, orders, queueEntries }),
    });
  } catch (err) {
    console.error('[events/ttf]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'TTF unavailable.' });
  }
}
