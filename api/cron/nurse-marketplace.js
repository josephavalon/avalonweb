import crypto from 'crypto';
import { getServiceClient } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { enqueueMarketplaceJob } from '../_lib/nurse-marketplace.js';
import { runNurseMarketplaceWorker } from '../_lib/nurse-marketplace-worker.js';

function authorized(req) {
  const expected = String(process.env.CRON_SECRET || '');
  const provided = String(req.headers?.authorization || req.headers?.Authorization || '');
  if (!expected) return false;
  const expectedHeader = Buffer.from(`Bearer ${expected}`);
  const providedHeader = Buffer.from(provided);
  return expectedHeader.length === providedHeader.length
    && crypto.timingSafeEqual(expectedHeader, providedHeader);
}

async function enqueueTenantMaintenance(db) {
  const tenants = await db.from('tenants').select('id').limit(1000);
  if (tenants.error) throw tenants.error;
  const sweepDate = new Date().toISOString().slice(0, 10);
  const retention = [];
  for (const tenant of tenants.data || []) {
    const purge = await db.rpc('purge_nurse_typed_origin_retention_v1', {
      p_tenant_id: tenant.id,
      p_retention_hours: 24,
    });
    if (purge.error) throw purge.error;
    retention.push(Array.isArray(purge.data) ? purge.data[0] : purge.data);
    await enqueueMarketplaceJob(db, {
      tenantId: tenant.id,
      jobType: 'daily_readiness_sweep',
      idempotencyKey: `daily-sweep:${sweepDate}`,
      payload: { sweep_date: sweepDate, typed_origin_retention_hours: 24 },
    });
  }
  return retention;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ error: 'Cron authentication is not configured.', code: 'cron_secret_not_configured' });
  }
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized', code: 'cron_secret_invalid' });
  const db = await getServiceClient();
  if (!db) return res.status(503).json({ error: 'Supabase is not configured.', code: 'supabase_unconfigured' });
  try {
    const retention = await enqueueTenantMaintenance(db);
    const result = await runNurseMarketplaceWorker(db);
    return res.status(200).json({ ok: true, retention, ...result });
  } catch (error) {
    console.warn('[cron/nurse-marketplace] failed', safeLogContext(error, 'nurse_marketplace_cron_failed'));
    return res.status(500).json({
      error: 'Nurse marketplace recovery failed.',
      code: safeErrorCode(error, 'nurse_marketplace_cron_failed'),
    });
  }
}
