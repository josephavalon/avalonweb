import crypto from 'crypto';
import { getDefaultTenantId } from '../_supabase-server.js';
import { getServiceClient } from '../_lib/supabase-auth.js';
import { pacificClock, runRobBotRefresh } from '../_lib/robbot3k-core.js';
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

  const clock = pacificClock(new Date());
  // Vercel may schedule both 13:00 and 14:00 UTC. This makes exactly 6:00 AM
  // America/Los_Angeles correct across daylight-saving changes.
  if (clock.hour !== 6) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'outside_6am_pacific_window', pacific: clock });
  }

  try {
    const db = await getServiceClient();
    if (!db) return res.status(503).json({ error: 'Supabase service role is not configured.' });
    const tenantId = await getDefaultTenantId(db);
    if (!tenantId) return res.status(503).json({ error: 'Avalon tenant is not configured.' });
    const result = await runRobBotRefresh(db, tenantId, null, { triggerSource: 'schedule' });
    return res.status(200).json(result);
  } catch (error) {
    console.warn('[cron/robbot3k-refresh] failed', safeLogContext(error, 'robbot3k_cron_refresh_failed'));
    return res.status(500).json({ error: 'Scheduled RobBot3K refresh failed.', code: safeErrorCode(error, 'robbot3k_cron_refresh_failed') });
  }
}
