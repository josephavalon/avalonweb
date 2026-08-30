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
import { requireStaff } from '../_lib/supabase-auth.js';
import { mintVisitToken, qrMode } from '../_lib/events-qr.js';

function nonEmptyJti(value) {
  const jti = String(value || '').trim();
  return jti || null;
}

/**
 * Return only a JTI confirmed to exist on the tenant/event-scoped visit row.
 * Concurrent manifest requests race through a conditional null-only update; a
 * loser must re-read the winner. Read/write errors and a missing winner fail
 * closed so mintVisitToken can never invent an untracked replay identifier.
 */
export async function ensurePersistedVisitJti({
  db,
  visit,
  tenantId,
  containerId,
  createJti = () => crypto.randomUUID(),
}) {
  const existing = nonEmptyJti(visit?.qr_jti);
  if (existing) return existing;

  const candidate = nonEmptyJti(createJti());
  if (!candidate) throw new Error('event_visit_jti_generation_failed');

  const { data: claimed, error: claimError } = await db
    .from('event_visits')
    .update({ qr_jti: candidate })
    .eq('id', visit.id)
    .eq('tenant_id', tenantId)
    .eq('container_id', containerId)
    .is('qr_jti', null)
    .select('qr_jti')
    .maybeSingle();
  if (claimError) throw claimError;

  const claimedJti = nonEmptyJti(claimed?.qr_jti);
  if (claimedJti) {
    if (claimedJti !== candidate) throw new Error('event_visit_jti_claim_mismatch');
    return claimedJti;
  }

  const { data: winner, error: winnerError } = await db
    .from('event_visits')
    .select('qr_jti')
    .eq('id', visit.id)
    .eq('tenant_id', tenantId)
    .eq('container_id', containerId)
    .maybeSingle();
  if (winnerError) throw winnerError;

  const winnerJti = nonEmptyJti(winner?.qr_jti);
  if (!winnerJti) throw new Error('event_visit_jti_not_persisted');
  return winnerJti;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const caller = await requireStaff(req, res);
  if (!caller) return undefined;
  const { db, tenantId } = caller;

  try {
    const slug = String(req.query?.slug || '').trim();
    const { data: container, error: containerError } = await db
      .from('event_containers')
      .select('id, slug, name, starts_at')
      .eq('slug', slug)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (containerError) throw containerError;
    if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

    const { data: visits, error } = await db
      .from('event_visits')
      .select('id, attendee_name, status, gfe_status, gfe_scope, qr_jti, qr_key_id, service_id')
      .eq('tenant_id', tenantId)
      .eq('container_id', container.id)
      .in('status', ['pending', 'confirmed', 'served']);
    if (error) throw error;

    // Do not rely on a nested service-role join for authorization. Resolve the
    // referenced services through an explicit tenant-scoped lookup, then fail
    // closed if a visit points at a service outside that boundary.
    const serviceIds = [...new Set((visits || []).map((visit) => visit.service_id).filter(Boolean))];
    const servicesById = new Map();
    if (serviceIds.length) {
      const { data: services, error: servicesError } = await db
        .from('event_services')
        .select('id, name, service_class, requires_gfe')
        .eq('tenant_id', tenantId)
        .in('id', serviceIds);
      if (servicesError) throw servicesError;
      for (const service of services || []) servicesById.set(service.id, service);
      if (serviceIds.some((id) => !servicesById.has(id))) throw new Error('event_service_scope_mismatch');
    }

    const now = new Date();
    const entries = [];
    for (const v of visits || []) {
      // Persist the jti BEFORE minting so concurrent manifest downloads mint
      // identical tokens: the conditional update (is qr_jti null) makes the
      // first writer win; losers re-read the winner's jti.
      const service = v.service_id ? servicesById.get(v.service_id) : null;
      const jti = await ensurePersistedVisitJti({
        db,
        visit: v,
        tenantId,
        containerId: container.id,
      });
      const minted = mintVisitToken({
        ...v,
        qr_jti: jti,
        service_class: service?.service_class || null,
        event_slug: container.slug,
      }, { now });
      if (minted.kid && minted.kid !== v.qr_key_id) {
        await db.from('event_visits')
          .update({ qr_key_id: minted.kid })
          .eq('id', v.id)
          .eq('tenant_id', tenantId)
          .eq('container_id', container.id);
      }
      entries.push({
        visitId: v.id,
        jti,
        name: v.attendee_name || 'Guest',
        status: v.status,
        gfeStatus: v.gfe_status,
        gfeScope: v.gfe_scope || {},
        gfeRequired: Boolean(service?.requires_gfe),
        serviceName: service?.name || null,
        serviceClass: service?.service_class || null,
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
