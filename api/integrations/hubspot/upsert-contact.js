/**
 * POST /api/integrations/hubspot/upsert-contact
 *
 * Upserts a HubSpot Contact by email. Keep payload CRM-safe: identifiers +
 * lifecycle facets + hospitality guest profile ONLY. No PHI. See
 * `api/_hubspot.js` for the allowlist and `scripts/no-phi-in-hubspot-qa.mjs`
 * for the CI guard.
 */

import { checkRateLimit, clientIp } from '../../_lib/rate-limit.js';
import { upsertHubspotContact, HubspotPhiRefused } from '../../_hubspot.js';
import { isLiveApiEnabled } from '../../_lib/pre-api-guard.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

// Whitelist of fields staff may push to HubSpot. Anything else on the request
// body is dropped before reaching the client. Hospitality guest profile is
// accepted here so the admin CRM page can push its editor state directly.
function sanitizeClient(input = {}) {
  const gp = input.guestProfile || {};
  return {
    name: input.name || '',
    firstName: input.firstName || '',
    lastName: input.lastName || '',
    email: input.email || '',
    phone: input.phone || '',
    city: input.city || '',
    source: input.source || 'Avalon Web',
    lifecycleStage: input.lifecycleStage || 'Lead',
    planInterest: input.planInterest || '',
    visitCount: input.visitCount,
    hipaaNppSignedAt: input.hipaaNppSignedAt || null,
    hipaaNppVersion: input.hipaaNppVersion || null,
    termsSignedAt: input.termsSignedAt || null,
    guestProfile: {
      instagram: gp.instagram || '',
      tiktok: gp.tiktok || '',
      linkedin: gp.linkedin || '',
      style: gp.style || '',
      wardrobe: gp.wardrobe || '',
      beverage: gp.beverage || '',
      music: gp.music || '',
      notes: gp.notes || '',
      context: gp.context || '',
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rate = await checkRateLimit({
    key: `hubspot-upsert:${clientIp(req)}`,
    windowMs: 60_000,
    max: 30,
  });
  if (!rate.ok) {
    return res.status(429).json({ error: 'Too many CRM sync attempts. Please retry shortly.' });
  }

  try {
    const client = sanitizeClient(req.body?.client || req.body || {});

    if (!isLiveApiEnabled()) {
      return res.status(200).json({
        ok: true,
        provider: 'local-simulation',
        previewOnly: true,
        preApiHardWall: true,
        record: { id: `local-hubspot-${Date.now()}`, webUrl: null },
        client: {
          source: client.source,
          lifecycleStage: client.lifecycleStage,
          planInterest: client.planInterest,
        },
      });
    }

    const authed = await requireAdmin(req, res);
    if (!authed) return;

    const result = await upsertHubspotContact(client);
    return res.status(200).json({
      ok: true,
      provider: 'hubspot',
      skipped: Boolean(result?.skipped),
      reason: result?.reason || null,
      record: {
        id: result?.id || null,
        webUrl: result?.id && process.env.HUBSPOT_PORTAL_ID
          ? `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/contact/${result.id}`
          : null,
      },
    });
  } catch (err) {
    if (err instanceof HubspotPhiRefused) {
      return res.status(400).json({
        ok: false,
        provider: 'hubspot',
        error: 'Hospitality field contained health-related terms; refusing to sync to CRM.',
        code: 'hubspot_phi_refused',
        property: err.property,
      });
    }
    console.error('[hubspot/upsert-contact]', safeLogContext(err, 'hubspot_upsert_failed'));
    return res.status(err.status || 500).json({
      ok: false,
      provider: 'hubspot',
      error: 'CRM sync failed',
      code: safeErrorCode(err, 'hubspot_upsert_failed'),
    });
  }
}
