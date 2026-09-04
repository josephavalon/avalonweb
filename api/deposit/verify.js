/**
 * GET /api/deposit/verify?session_id=cs_… — confirm a reservation deposit was
 * actually paid, before /start/deposit tells anyone it was.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * StartDeposit.jsx used to render "Your $50 deposit is in" from the URL alone.
 * It read `ref` for display, never read `status`, and never asked Stripe — so
 * /start/deposit?ref=AV-K4M2-7QTX was a clean, screenshot-able payment
 * confirmation that anyone could mint. The ref is the ONLY thread ops has
 * between a Stripe payment and a Cognito entry, so a forged one is detectable
 * at the dashboard, but a forgeable receipt on a money flow is a
 * social-engineering and chargeback-dispute vector. This endpoint is the
 * server-side half that makes the page's claim true.
 *
 * ── PHI-FREE BY CONSTRUCTION, same contract as its two siblings ─────────────
 *   • Input is a Stripe session id and nothing else. bodyParser is off and the
 *     parsed-body property is never referenced.
 *   • The response carries exactly four fields, all derived from the payment:
 *     ok, paid, ref, amountCents. Stripe collects an email on its own hosted
 *     page; `customer_details` is deliberately never read, never returned, and
 *     never logged, so we still cannot correlate a payer to an intake.
 *   • Nothing is written to Supabase, Acuity, HubSpot, or Stripe.
 *
 * Deliberately does NOT call blockFrontDoorPhiRoute(): avalonvitality.co and
 * www are front-door hosts, so that guard would 409 this on exactly the hosts
 * the deposit flow runs on. Same documented exemption, and strictly smaller
 * exposure, as api/deposit/create-session.js and api/invoice/submit.js. See
 * docs/PHI_DATA_FLOW.md — an undocumented exemption gets reversed at the next
 * audit.
 *
 * It DOES call blockLiveVendorAction(): it reaches a real vendor.
 */
import Stripe from 'stripe';
import { blockLiveVendorAction } from '../_lib/pre-api-guard.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeLogContext } from '../_lib/safe-error.js';

export const config = { api: { bodyParser: false } };

// Stripe Checkout Session ids are `cs_` + base62. Bounded so a hostile value
// cannot become a long outbound URL path.
const SESSION_ID_RE = /^cs_[A-Za-z0-9_]{8,120}$/;

// The metadata marker create-session.js stamps. Load-bearing: without it, ANY
// Stripe Checkout Session id from any other Avalon flow — a full booking, a
// plan signup, a gift card — would verify here and render the deposit receipt.
// The check is what makes "paid" mean "paid THIS deposit".
const DEPOSIT_KIND = 'start_deposit';

const RATE_LIMIT = { windowMs: 60 * 1000, max: 20 };
const RATE_LIMIT_DAY = { windowMs: 24 * 60 * 60 * 1000, max: 200 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, code: 'method_not_allowed' });
  }

  if (blockLiveVendorAction(req, res, 'Reservation deposit verification')) return undefined;

  const sessionId = String(req.query?.session_id || '').trim();
  if (!SESSION_ID_RE.test(sessionId)) {
    return res.status(400).json({ ok: false, code: 'invalid_session_id' });
  }

  const ip = clientIp(req);
  for (const limit of [RATE_LIMIT, RATE_LIMIT_DAY]) {
    const result = await checkRateLimit({ key: `deposit-verify:${limit.windowMs}:${ip}`, ...limit });
    if (!result.ok) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
      return res.status(429).json({ ok: false, code: 'rate_limited' });
    }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ ok: false, code: 'stripe_not_configured' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session?.metadata?.kind !== DEPOSIT_KIND) {
      // Not one of ours. Answer the same way as an unpaid session rather than
      // confirming that some other session id exists.
      return res.status(200).json({ ok: true, paid: false, ref: '', amountCents: 0 });
    }

    const paid = session.payment_status === 'paid';
    return res.status(200).json({
      ok: true,
      paid,
      ref: paid ? String(session.client_reference_id || '') : '',
      amountCents: paid ? Number(session.amount_total || 0) : 0,
    });
  } catch (err) {
    // An unknown session id lands here as a Stripe 404. Treat it as not-paid
    // rather than 500 — the page only ever needs "may I show the receipt?".
    if (err?.statusCode === 404 || err?.code === 'resource_missing') {
      return res.status(200).json({ ok: true, paid: false, ref: '', amountCents: 0 });
    }
    console.warn('[deposit] verify failed', safeLogContext(err, 'deposit_verify_failed'));
    return res.status(502).json({ ok: false, code: 'verify_failed' });
  }
}
