/**
 * POST /api/deposit/create-session — a $50 Stripe Checkout session that lets a
 * visitor hold their spot the moment they finish the intake, instead of waiting
 * for the callback and a texted link.
 *
 * ── WHY THIS IS NOT api/create-checkout-session.js ──────────────────────────
 * That handler is in PHI_WRITING_HANDLERS: it calls blockFrontDoorPhiRoute(),
 * so it answers 409 on avalonvitality.co and www — the exact hosts this button
 * has to work on. It also writes appointments, talks to Acuity, and takes a
 * cart full of patient detail. None of that can happen on the front door.
 *
 * So this is a deliberately minimal sibling, and it is PHI-free by CONSTRUCTION:
 *   • bodyParser is off; a request carrying a payload is refused unread, and
 *     the parsed-body property is never referenced in this file.
 *   • Nothing patient-identifying is sent to Stripe. No customer_email, no
 *     name, no phone, no address, no cart. Stripe collects an email itself, on
 *     its own hosted page, under its own terms — we never see it and, more
 *     importantly, never CORRELATE it to a Cognito entry.
 *   • Metadata goes through safeStripeMetadata()'s frozen allowlist. The three
 *     keys used here were already on it; adding one would require a documented
 *     PHI review, which is the point of the allowlist.
 *   • Nothing is written to Supabase, Acuity, or HubSpot.
 *
 * That makes its exposure strictly smaller than api/invoice/submit.js, which is
 * exempted from the front-door guard on the same reasoning. See
 * docs/PHI_DATA_FLOW.md for the written rationale — an undocumented exemption
 * gets reversed at the next audit.
 *
 * It DOES call blockLiveVendorAction(): unlike the alert ping, this moves real
 * money through a real vendor, which is exactly what that flag exists to hold.
 */
import crypto from 'crypto';
import Stripe from 'stripe';
import { blockLiveVendorAction } from '../_lib/pre-api-guard.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeStripeMetadata } from '../_lib/safe-stripe.js';
import { safeLogContext } from '../_lib/safe-error.js';
import { ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS } from '../../src/lib/paymentRules.js';

export const config = { api: { bodyParser: false } };

function dollarsToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

// Mirrors api/create-checkout-session.js:63 so one env var moves both deposits
// together and they can never silently disagree. The clamp is deliberate: a
// typo'd env ("5000" meaning cents) must not create a $5,000 charge on a page
// whose own copy says $50.
const RAW_DEPOSIT_CENTS = dollarsToCents(
  process.env.BOOKING_DEPOSIT_DOLLARS || ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS,
);
const DEPOSIT_CENTS = RAW_DEPOSIT_CENTS >= 500 && RAW_DEPOSIT_CENTS <= 50000
  ? RAW_DEPOSIT_CENTS
  : dollarsToCents(ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS);

// Hosts we will build a return URL for. X-Forwarded-Host is attacker-controlled
// in principle, and this URL is where a payer lands after paying — trusting it
// raw would be a payment-phishing open redirect. PUBLIC_SITE_URL alone is not
// enough either: it is one value per Vercel project and still points at
// snooches in .env.example, which would strand beta testers on the wrong host.
const ALLOWED_RETURN_HOSTS = new Set([
  'avalonvitality.co',
  'www.avalonvitality.co',
  'beta.avalonvitality.co',
  'snooches.avalonvitality.co',
]);

// Same shape api/notify/intake-alert.js validates. The nonce is minted once per
// submission on the client, so two clicks send the SAME one — which is what
// makes the Stripe idempotency key below actually engage. It is random and
// derived from nothing about the visitor, so it carries no PHI.
const NONCE_RE = /^[a-f0-9-]{8,64}$/i;

const RATE_LIMIT = { windowMs: 60 * 1000, max: 5 };
const RATE_LIMIT_DAY = { windowMs: 24 * 60 * 60 * 1000, max: 40 };
const SESSION_TTL_MINUTES = 30;

function baseUrl(req) {
  const forwarded = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .split(',')[0]
    .split(':')[0]
    .trim()
    .toLowerCase();
  if (ALLOWED_RETURN_HOSTS.has(forwarded)) return `https://${forwarded}`;

  const configured = String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (configured) {
    try {
      const host = new URL(configured).hostname.toLowerCase();
      if (ALLOWED_RETURN_HOSTS.has(host)) return configured;
    } catch {
      /* fall through to the apex */
    }
  }
  return 'https://avalonvitality.co';
}

/**
 * A short code the client can read aloud to the care team, e.g. AV-K4M2-7QTX.
 * Random and derived from nothing about the person, so it carries no PHI — it
 * is the ONLY thread between a Stripe payment and a Cognito entry, and that
 * thread is joined by a human in the dashboard, never by our systems.
 * Same generator shape as buildInvoiceNumber in api/invoice/submit.js.
 */
function buildDepositRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  const block = (n) => Array.from(crypto.randomBytes(n))
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
  return `AV-${block(4)}-${block(4)}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'method_not_allowed' });
  }

  // Structural half of the no-PHI guarantee: refuse anything with a payload
  // before it is read, so a future caller cannot "helpfully" attach the form.
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 0) {
    return res.status(400).json({ ok: false, code: 'unexpected_body' });
  }

  if (blockLiveVendorAction(req, res, 'Reservation deposit checkout')) return undefined;

  const ip = clientIp(req);
  for (const limit of [RATE_LIMIT, RATE_LIMIT_DAY]) {
    const result = await checkRateLimit({
      key: `deposit-session:${limit.windowMs}:${ip}`,
      ...limit,
    });
    if (!result.ok) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
      return res.status(429).json({ ok: false, code: 'rate_limited' });
    }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ ok: false, code: 'stripe_not_configured' });
  }

  const nonce = String(req.headers['x-avalon-deposit-nonce'] || '');
  if (nonce && !NONCE_RE.test(nonce)) {
    return res.status(400).json({ ok: false, code: 'invalid_nonce' });
  }

  const ref = buildDepositRef();
  const base = baseUrl(req);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Load-bearing. Omitting this lets Stripe surface Link, whose OTP prompt
      // reads as a hijack on a first-time visitor and cost this repo a fix
      // once already — see scripts/checkout-payment-methods-qa.mjs.
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: DEPOSIT_CENTS,
          product_data: { name: 'Avalon Vitality reservation deposit' },
        },
      }],
      client_reference_id: ref,
      submit_type: 'book',
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_MINUTES * 60,
      // {CHECKOUT_SESSION_ID} is substituted by Stripe, not by us, so it cannot
      // be forged into a valid session. /start/deposit verifies it via
      // api/deposit/verify.js before claiming anything was paid.
      success_url: `${base}/start/deposit?ref=${encodeURIComponent(ref)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/start?deposit=cancelled`,
      metadata: safeStripeMetadata({
        kind: 'start_deposit',
        depositType: 'start_reservation',
        depositAmountCents: String(DEPOSIT_CENTS),
      }),
    }, {
      // Two clicks on a slow connection should not open two sessions.
      //
      // This used to key off `ref`, which is freshly random on every request —
      // so the key was unique every time and Stripe's idempotency never
      // matched. The guarantee in this comment simply did not exist. The nonce
      // is stable for one submission, so it is the only value here that can
      // carry it. Falls back to `ref` when a caller sends no nonce, which is
      // the old (ineffective) behaviour rather than a new failure mode.
      idempotencyKey: `start-deposit:${nonce || ref}`,
    });

    if (!session?.url) {
      return res.status(502).json({ ok: false, code: 'session_url_missing' });
    }

    // Read the ref back off the session rather than returning the local one.
    // Now that idempotency actually engages, a replayed click returns the FIRST
    // session, whose client_reference_id is the FIRST ref — and that ref is the
    // only thread ops has between a Stripe payment and a Cognito entry. Echoing
    // the freshly-minted local value would hand the visitor a code that matches
    // nothing in the dashboard.
    return res.status(200).json({
      ok: true,
      url: session.url,
      ref: String(session.client_reference_id || ref),
      amountCents: Number(session.amount_total ?? DEPOSIT_CENTS),
    });
  } catch (err) {
    console.warn('[deposit] session create failed', safeLogContext(err, 'deposit_session_failed'));
    return res.status(502).json({ ok: false, code: 'session_create_failed' });
  }
}
