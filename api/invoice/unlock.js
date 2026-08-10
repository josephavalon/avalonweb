/**
 * POST /api/invoice/unlock — the password gate for /invoice.
 *
 * Deliberately does NOT use requireInternalAccess() from api/_lib/pre-api-guard.js:
 * that helper calls blockLiveVendorAction() first, which 409s unless
 * AVALON_ENABLE_LIVE_API=true, and it reads one shared bearer secret from an
 * Authorization header — the wrong shape for a two-field human login. This
 * handler follows api/apply.js instead (rate limit → honeypot → validate).
 *
 * Env (server-only — a VITE_ prefix would inline the password into the public
 * bundle, and scripts/launch-blocker-qa.mjs scans dist for these names):
 *   AVALON_INVOICE_USER
 *   AVALON_INVOICE_PASSWORD
 *   AVALON_INVOICE_TOKEN_SECRET
 */
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeLogContext } from '../_lib/safe-error.js';
import { createInvoiceToken, isInvoiceTokenConfigured, safeEqual } from '../_lib/invoice-token.js';

const PER_IP = { windowMs: 15 * 60 * 1000, max: 10 };
// One shared password invites distributed guessing, so cap the whole endpoint too.
const GLOBAL = { windowMs: 60 * 60 * 1000, max: 120 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  const perIp = await checkRateLimit({ key: `invoice-unlock:${ip}`, ...PER_IP });
  if (!perIp.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((perIp.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }
  const global = await checkRateLimit({ key: 'invoice-unlock:global', ...GLOBAL });
  if (!global.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((global.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  // Fail closed: an unconfigured gate is a closed gate, never an open one.
  const expectedUser = String(process.env.AVALON_INVOICE_USER || '');
  const expectedPassword = String(process.env.AVALON_INVOICE_PASSWORD || '');
  if (!expectedUser || !expectedPassword || !isInvoiceTokenConfigured()) {
    return res.status(503).json({
      error: 'Invoice access is not configured yet.',
      code: 'invoice_auth_not_configured',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    // Honeypot — bots fill it, humans never see it. 200 so they don't retry.
    if (body.website) return res.status(200).json({ ok: true, token: '' });

    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    // Both compared even when the first fails, so a wrong username and a wrong
    // password cost the same time. One message for both, no field-level hint.
    const userOk = safeEqual(username, expectedUser);
    const passOk = safeEqual(password, expectedPassword);
    if (!userOk || !passOk) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    return res.status(200).json({ ok: true, token: createInvoiceToken() });
  } catch (error) {
    console.error('Invoice unlock failed', safeLogContext(error, 'invoice_unlock_failed'));
    return res.status(500).json({ error: 'Unable to unlock right now. Please try again.' });
  }
}
