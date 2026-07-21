/**
 * Offline door manifest (ET5, blueprint §2.3). Staff-only.
 *   GET /api/events/manifest?slug=<event>
 *
 * The serve app downloads this before doors open; at the door, signature
 * verification + local lookup work with zero connectivity (ed25519 mode).
 * In placeholder mode the manifest says so and the scanner stays online-only.
 *
 * PHI LAW: names, service class, gfe enum + scope flags. Nothing deeper.
 */
import { getServiceClient, requireStaff } from '../_lib/supabase-auth.js';
import { mintVisitToken, qrMode } from '../_lib/events-qr.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const caller = await requireStaff(req, res);
  if (!caller) return undefined;

  const db = await getServiceClient();
  if (!db) return res.status(500).json({ ok: false, error: 'Service unavailable.' });

  try {
    const slug = String(req.query?.slug || '').trim();
    const { data: container } = await db
      .from('event_containers')
      .select('id, slug, name, starts_at')
      .eq('slug', slug)
      .maybeSingle();
    if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

    const { data: visits, error } = await db
      .from('event_visits')
      .select('id, attendee_name, status, gfe_status, gfe_scope, qr_jti, qr_key_id, service_id, event_services:service_id (name, service_class, requires_gfe)')
      .eq('container_id', container.id)
      .in('status', ['pending', 'confirmed', 'served']);
    if (error) throw error;

    const now = new Date();
    const entries = [];
    for (const v of visits || []) {
      // Persist the jti BEFORE minting so concurrent manifest downloads mint
      // identical tokens: the conditional update (is qr_jti null) makes the
      // first writer win; losers re-read the winner's jti.
      let jti = v.qr_jti;
      if (!jti) {
        const candidate = crypto.randomUUID();
        const { data: claimed } = await db
          .from('event_visits')
          .update({ qr_jti: candidate })
          .eq('id', v.id)
          .is('qr_jti', null)
          .select('qr_jti')
          .maybeSingle();
        if (claimed?.qr_jti) {
          jti = claimed.qr_jti;
        } else {
          const { data: winner } = await db.from('event_visits').select('qr_jti').eq('id', v.id).maybeSingle();
          jti = winner?.qr_jti || candidate;
        }
      }
      const minted = mintVisitToken({
        ...v,
        qr_jti: jti,
        service_class: v.event_services?.service_class || null,
        event_slug: container.slug,
      }, { now });
      if (minted.kid && minted.kid !== v.qr_key_id) {
        await db.from('event_visits').update({ qr_key_id: minted.kid }).eq('id', v.id);
      }
      entries.push({
        visitId: v.id,
        jti,
        name: v.attendee_name || 'Guest',
        status: v.status,
        gfeStatus: v.gfe_status,
        gfeScope: v.gfe_scope || {},
        gfeRequired: Boolean(v.event_services?.requires_gfe),
        serviceName: v.event_services?.name || null,
        serviceClass: v.event_services?.service_class || null,
        token: minted.token,
      });
    }

    return res.status(200).json({
      ok: true,
      manifest: {
        event: { slug: container.slug, name: container.name, startsAt: container.starts_at },
        generatedAt: now.toISOString(),
        mode: qrMode(),                                  // 'ed25519' | 'online_only_placeholder'
        publicKey: process.env.EVENTS_QR_PUBLIC_KEY || null,
        keyId: process.env.EVENTS_QR_KEY_ID || null,
        visits: entries,
      },
    });
  } catch (err) {
    console.error('[events/manifest]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Manifest unavailable.' });
  }
}
