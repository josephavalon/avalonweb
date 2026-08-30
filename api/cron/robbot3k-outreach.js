import crypto from 'crypto';
import { getDefaultTenantId } from '../_supabase-server.js';
import { getServiceClient } from '../_lib/supabase-auth.js';
import { executeDueOutreach, pacificSendWindow } from '../_lib/robbot3k-execution.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { requireBdDataReview } from '../_lib/bd-data-review-gate.js';

function secretMatches(req) {
  const expected = String(process.env.CRON_SECRET || '');
  const provided = String(req.headers?.authorization || '');
  if (!expected || !provided.startsWith('Bearer ')) return false;
  const actual = provided.slice('Bearer '.length);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'Cron authentication is not configured.' });
  if (!secretMatches(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!requireBdDataReview(res)) return;
  const window = pacificSendWindow(new Date());
  if (!window.open) {
    return res.status(200).json({ ok: true, skipped: true, reason: window.reason, pacific: window });
  }
  try {
    const db = await getServiceClient();
    if (!db) return res.status(503).json({ error: 'Supabase service role is not configured.' });
    const tenantId = await getDefaultTenantId(db);
    if (!tenantId) return res.status(503).json({ error: 'Avalon tenant is not configured.' });
    const result = await executeDueOutreach(db, tenantId, null, { triggerSource: 'schedule', limit: 50 });
    return res.status(200).json(result);
  } catch (error) {
    console.warn('[cron/robbot3k-outreach] failed', safeLogContext(error, 'robbot3k_cron_outreach_failed'));
    return res.status(500).json({ error: 'Scheduled RobBot3K outreach evaluation failed.', code: safeErrorCode(error, 'robbot3k_cron_outreach_failed') });
  }
}
