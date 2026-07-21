/**
 * POST/GET /api/cron/expire-credits
 *
 * Vercel cron handler — runs daily (suggested 03:00 UTC) and sweeps every
 * tenant's `member_credit_ledger` for grants whose 1-year `expires_at` has
 * passed, posting offsetting negative `credit_expiry` rows. The grant logic
 * itself lives in `api/_lib/member-credits.js` (`expireStaleCredits`) and is
 * already idempotent (migration 023 adds the unique index on the grant id),
 * so re-running the sweep is safe and a no-op when nothing is due.
 *
 * AUTH: Vercel cron invocations carry `Authorization: Bearer ${CRON_SECRET}`
 * (configured in vercel.json -> crons[].headers). Requests without the right
 * secret are rejected with 401. This prevents anyone from kicking off the
 * sweep by hitting the URL directly. CRON_SECRET MUST be set in Vercel env.
 *
 * Behaviour:
 *   - Iterates every tenant in `public.tenants`.
 *   - For each, calls expireStaleCredits(db, { tenantId, asOf: new Date() }).
 *   - Aggregates totals and writes a single `credits_expired_sweep` audit
 *     event with per-tenant + grand-total counts.
 *   - Returns { ok, tenants, totalExpiredUnits, totalRows, perTenant: [...] }.
 *
 * Failures inside one tenant do not abort the whole run — they are captured
 * in the per-tenant result so the rest of the sweep still completes.
 */

import { getServiceClient } from '../_lib/supabase-auth.js';
import { expireStaleCredits } from '../_lib/member-credits.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // refuse to run if the secret isn't configured
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return Boolean(match && match[1].trim() === expected);
}

export default async function handler(req, res) {
  // Vercel cron defaults to GET; allow POST for manual re-runs from a curl
  // shell. Any other method is rejected.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'cron_secret_missing_or_invalid' });
  }

  const db = await getServiceClient();
  if (!db) {
    return res.status(503).json({ error: 'Supabase is not configured', code: 'supabase_unconfigured' });
  }

  const startedAt = new Date();
  const asOf = startedAt;

  try {
    const { data: tenants, error: tenantsErr } = await db
      .from('tenants')
      .select('id, slug, name');
    if (tenantsErr) throw tenantsErr;

    const perTenant = [];
    let totalExpiredUnits = 0;
    let totalRows = 0;

    for (const tenant of (tenants || [])) {
      try {
        const result = await expireStaleCredits(db, { tenantId: tenant.id, asOf });
        const expired = Number(result?.expired || 0);
        const rows = Number(result?.rows || 0);
        totalExpiredUnits += expired;
        totalRows += rows;
        perTenant.push({
          tenantId: tenant.id,
          slug: tenant.slug || null,
          expired,
          rows,
        });
      } catch (err) {
        console.warn('[cron/expire-credits] tenant sweep failed',
          safeLogContext(err, 'cron_expire_credits_tenant_failed'));
        perTenant.push({
          tenantId: tenant.id,
          slug: tenant.slug || null,
          expired: 0,
          rows: 0,
          error: safeErrorCode(err, 'cron_expire_credits_tenant_failed'),
        });
      }
    }

    // Single durable audit row so finance/compliance can prove the sweep ran.
    // No PHI — totals + tenant ids only.
    await writeAuditEvent(db, {
      tenantId: null, // cross-tenant sweep
      actorProfileId: null,
      action: 'credits_expired_sweep',
      entityType: 'member_credit_ledger',
      phiTouched: false,
      payload: {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        tenants: perTenant.length,
        totalExpiredUnits,
        totalRows,
        perTenant,
      },
    });

    return res.status(200).json({
      ok: true,
      tenants: perTenant.length,
      totalExpiredUnits,
      totalRows,
      perTenant,
    });
  } catch (err) {
    console.warn('[cron/expire-credits] sweep failed',
      safeLogContext(err, 'cron_expire_credits_failed'));
    return res.status(500).json({
      error: 'Credit-expiry sweep failed.',
      code: safeErrorCode(err, 'cron_expire_credits_failed'),
    });
  }
}
