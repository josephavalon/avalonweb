/**
 * Shared-secret check for the two webhook receivers whose providers do not sign
 * their payloads (Qualiphy GFE results, Quo inbound SMS). Stripe, Acuity and
 * Resend all sign, and use real HMAC verification instead — see their handlers.
 *
 * Two things this fixes over the copies it replaces:
 *
 * 1. CONSTANT-TIME COMPARE. Both handlers used `provided !== expected`, which
 *    short-circuits on the first differing byte.
 *
 * 2. THE HEADER IS PREFERRED OVER THE QUERY STRING. A secret in `?secret=` is
 *    written verbatim into Vercel's request logs on every call, so anyone with
 *    log access has the credential. For Qualiphy that matters more than usual:
 *    the secret is the ONLY thing standing between an attacker and forging an
 *    "Approved" GFE, which caches clinical clearance on the patient profile and
 *    writes it into Acuity as the source of record.
 *
 * The query-string form is still ACCEPTED, deliberately. Some webhook consoles
 * only let you paste a URL, with no way to add a header, and silently breaking
 * an integration that a nurse workflow depends on is worse than a logged
 * secret. It warns instead, so the choice is visible rather than accidental.
 * Use the header wherever the provider supports it, and treat any secret that
 * has travelled in a query string as compromised when you rotate.
 */
import { safeEqual } from './invoice-token.js';

/**
 * @returns {{ ok: true } | { ok: false, status: number, code: string }}
 */
export function checkWebhookSecret(req, { secretEnv, provider }) {
  const expected = String(process.env[secretEnv] || '');
  if (!expected) {
    return { ok: false, status: 503, code: 'webhook_not_configured' };
  }

  const fromHeader = String(req.headers?.['x-webhook-secret'] || '');
  const fromQuery = String(req.query?.secret || '');

  if (fromHeader) {
    if (!safeEqual(fromHeader, expected)) return { ok: false, status: 401, code: 'unauthorized' };
    return { ok: true };
  }

  if (fromQuery) {
    // Never log the value itself — the point of the warning is that it is
    // already in the request log one line above this one.
    console.warn(`[${provider}] webhook authenticated via query string; the secret is now in the request log. Move to the x-webhook-secret header if the provider supports it.`);
    if (!safeEqual(fromQuery, expected)) return { ok: false, status: 401, code: 'unauthorized' };
    return { ok: true };
  }

  return { ok: false, status: 401, code: 'unauthorized' };
}
