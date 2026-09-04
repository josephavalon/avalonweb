import { getServiceClient } from '../_lib/supabase-auth.js';
import {
  deliverNurseInvoiceNotification,
  nurseInvoiceNotificationConfiguration,
} from '../_lib/nurse-invoice-delivery.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { safeEqual } from '../_lib/invoice-token.js';

const MAX_PER_RUN = 25;

function authorized(req) {
  const expected = String(process.env.CRON_SECRET || '');
  const provided = String(req.headers?.authorization || req.headers?.Authorization || '');
  // Constant-time, matching api/cron/robbot3k-*.js. The bearer prefix is
  // checked separately so the secret comparison itself never short-circuits on
  // the first differing byte.
  if (!expected || !provided.startsWith('Bearer ')) return false;
  return safeEqual(provided.slice('Bearer '.length), expected);
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
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'cron_secret_invalid' });
  }
  const configuration = nurseInvoiceNotificationConfiguration();
  if (!configuration.ready) {
    return res.status(503).json({
      error: 'Finance notification delivery is not configured.',
      code: configuration.reason,
    });
  }
  const db = await getServiceClient();
  if (!db) return res.status(503).json({ error: 'Supabase is not configured.', code: 'supabase_unconfigured' });

  const results = [];
  try {
    for (let index = 0; index < MAX_PER_RUN; index += 1) {
      const result = await deliverNurseInvoiceNotification(db);
      if (result.outcome === 'idle') break;
      results.push(result);
    }
  } catch (error) {
    console.warn('[cron/nurse-invoice-notifications] failed',
      safeLogContext(error, 'nurse_invoice_notification_cron_failed'));
    return res.status(500).json({
      error: 'Finance notification recovery failed.',
      code: safeErrorCode(error, 'nurse_invoice_notification_cron_failed'),
      processed: results.length,
    });
  }

  const count = (outcome) => results.filter((result) => result.outcome === outcome).length;
  return res.status(200).json({
    ok: true,
    processed: results.length,
    sent: count('sent'),
    retryScheduled: count('retry_scheduled'),
    exhausted: count('exhausted'),
    reconciliationRequired: count('reconciliation_required'),
  });
}
