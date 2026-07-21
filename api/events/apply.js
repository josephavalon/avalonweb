/**
 * Application-gated tiers: "Request to join" (blueprint 4.3.5, ET4).
 * POST { slug, tierId?, name, email, phone?, answers? }
 *
 * PHI LAW: answers are ADMIT questions only (who are you, who's your group,
 * how did you hear) — the form never asks anything medical, and this endpoint
 * enforces a shallow shape + size cap as a backstop.
 */
import { getSupabaseServiceClient } from '../_supabase-server.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const limit = await checkRateLimit({ key: `events-apply:${clientIp(req)}`, windowMs: 600_000, max: 10 });
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  let db;
  try {
    db = await getSupabaseServiceClient();
  } catch {
    return res.status(500).json({ ok: false, error: 'Applications are unavailable right now.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const slug = String(body.slug || '').trim();
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
    const phone = String(body.phone || '').trim().slice(0, 40) || null;
    if (!slug || !name || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'Name and a valid email are required.' });
    }

    // Backstop shape guard: flat object, short string values, small payload.
    const answers = {};
    if (body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)) {
      for (const [k, v] of Object.entries(body.answers).slice(0, 8)) {
        if (typeof v === 'string') answers[String(k).slice(0, 60)] = v.slice(0, 500);
      }
    }

    const { data: container } = await db
      .from('event_containers')
      .select('id, tenant_id, status')
      .eq('slug', slug)
      .maybeSingle();
    if (!container || !['presale', 'public', 'sold_out'].includes(container.status)) {
      return res.status(404).json({ ok: false, error: 'Event not found.' });
    }

    // One pending application per email per event.
    const { data: existing } = await db
      .from('event_applications')
      .select('id, status')
      .eq('container_id', container.id)
      .eq('email', email)
      .in('status', ['pending', 'approved'])
      .maybeSingle();
    if (existing) {
      return res.status(200).json({ ok: true, status: existing.status, duplicate: true });
    }

    const { data: application, error } = await db
      .from('event_applications')
      .insert({
        tenant_id: container.tenant_id,
        container_id: container.id,
        tier_id: body.tierId || null,
        name,
        email,
        phone,
        answers,
      })
      .select('id, status')
      .single();
    if (error) throw error;

    return res.status(200).json({ ok: true, status: application.status });
  } catch (err) {
    console.error('[events/apply]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Applications are unavailable right now.' });
  }
}
