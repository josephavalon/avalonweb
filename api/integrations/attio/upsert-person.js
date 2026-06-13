/**
 * POST /api/integrations/attio/upsert-person
 *
 * Upserts a client into Attio People by email.
 * Keep payload CRM-safe: no clinical notes, no intake answers, no PHI.
 */

import { checkRateLimit, clientIp } from '../../_lib/rate-limit.js';
import { upsertAttioPerson } from '../../_attio.js';
import { isLiveApiEnabled } from '../../_lib/pre-api-guard.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function sanitizeClient(input = {}) {
  return {
    name: input.name || '',
    firstName: input.firstName || '',
    lastName: input.lastName || '',
    email: input.email || '',
    phone: input.phone || '',
    source: input.source || 'Avalon Web',
    lifecycleStage: input.lifecycleStage || 'Lead',
    service: input.service || '',
    planInterest: input.planInterest || '',
    visitCount: input.visitCount,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rate = await checkRateLimit({
    key: `attio-upsert:${clientIp(req)}`,
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
        record: {
          id: `local-attio-${Date.now()}`,
          webUrl: null,
        },
        client: {
          source: client.source,
          lifecycleStage: client.lifecycleStage,
          service: client.service,
          planInterest: client.planInterest,
        },
      });
    }

    const authed = await requireAdmin(req, res);
    if (!authed) return;

    const result = await upsertAttioPerson(client);
    return res.status(200).json({
      ok: true,
      provider: 'attio',
      record: {
        id: result?.data?.id || null,
        webUrl: result?.data?.web_url || null,
      },
    });
  } catch (err) {
    console.error('[attio/upsert-person]', safeLogContext(err, 'attio_upsert_failed'));
    return res.status(err.status || 500).json({
      ok: false,
      provider: 'attio',
      error: 'CRM sync failed',
      code: safeErrorCode(err, 'attio_upsert_failed'),
    });
  }
}
