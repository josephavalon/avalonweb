/**
 * /api/admin/promo-codes  — Stripe-of-record admin CRUD for promo codes.
 *
 * No DB table: Stripe is the single source of truth. We list/create/archive
 * promotion codes against the live Stripe account using STRIPE_SECRET_KEY (same
 * env var + SDK as api/create-checkout-session.js). The hosted Checkout session
 * already passes `allow_promotion_codes: true`, so any code created here is
 * immediately redeemable at the checkout input field — no other wiring needed.
 *
 *   GET                  → list active promotion codes joined with their coupon
 *                          shape (percent_off OR amount_off, duration, redemption
 *                          counts, expiry).
 *   POST                 → create a coupon + bind a promotion code to it.
 *     body: {
 *       code,                            // human-typed, e.g. "WELCOME10"
 *       percent_off?:1-100,              // exactly one of percent_off/amount_off
 *       amount_off?:number (dollars),    // (amount_off charges in USD cents)
 *       duration:'once'|'forever'|'repeating',
 *       duration_in_months?:number,      // required when duration='repeating'
 *       max_redemptions?:number,         // total redemptions across all customers
 *       expires_at?:ISO|seconds,         // redeem-by deadline
 *     }
 *   POST ?action=archive  → { id } deactivates a promotion code (active=false).
 *                          Stripe disallows hard delete; archived codes simply
 *                          stop redeeming and drop out of the active list.
 *
 * Auth: requireStaff (admin OR staff). All writes audited via writeAuditEvent
 * with PHI-free payload (code id + summary only). Errors are passed through the
 * safe-error helpers so we never leak the Stripe key or full Stripe SDK stack.
 */

import Stripe from 'stripe';
import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const VALID_DURATIONS = new Set(['once', 'forever', 'repeating']);

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Same one-arg construction as api/create-checkout-session.js — no apiVersion
  // pin, no telemetry tweaks, so behavior matches the checkout path exactly.
  return new Stripe(key);
}

function toDollarsFromCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return Math.round(n) / 100;
}

function dollarsToCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.round(n * 100));
}

function isoFromUnix(seconds) {
  if (!seconds || typeof seconds !== 'number') return null;
  try { return new Date(seconds * 1000).toISOString(); } catch { return null; }
}

// Parse a caller-supplied expires_at into a Stripe-friendly unix-seconds value.
// Accepts ISO strings, ms-since-epoch, or seconds-since-epoch (which we detect
// heuristically). Returns null on garbage input; the route then 400s.
function parseExpiresAt(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // <= ~year 2100 in seconds vs. ms heuristic.
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

// Codes Stripe accepts are 4-50 chars of letters/digits — uppercase by convention
// for the input UI. Reject anything looser here so the user gets a clean error
// instead of a raw Stripe rejection.
function normalizeCode(input) {
  const trimmed = String(input || '').trim().toUpperCase();
  if (!trimmed) return '';
  if (!/^[A-Z0-9]{4,50}$/.test(trimmed)) return '';
  return trimmed;
}

// Shape a Stripe promotion_code + its expanded coupon into the row the UI
// renders. Keeps every number/date in a stable, JSON-friendly form so the
// client never has to know Stripe's internals.
function shapeRow(promo) {
  const coupon = promo?.coupon || {};
  return {
    id: promo.id,
    code: promo.code,
    active: Boolean(promo.active),
    created_at: isoFromUnix(promo.created),
    expires_at: isoFromUnix(promo.expires_at),
    max_redemptions: promo.max_redemptions ?? null,
    times_redeemed: typeof promo.times_redeemed === 'number' ? promo.times_redeemed : 0,
    customer: promo.customer || null,
    restrictions: promo.restrictions || null,
    coupon: {
      id: coupon.id || null,
      name: coupon.name || null,
      percent_off: typeof coupon.percent_off === 'number' ? coupon.percent_off : null,
      amount_off_dollars: typeof coupon.amount_off === 'number' ? toDollarsFromCents(coupon.amount_off) : null,
      currency: coupon.currency || null,
      duration: coupon.duration || null,
      duration_in_months: coupon.duration_in_months ?? null,
      redeem_by: isoFromUnix(coupon.redeem_by),
      times_redeemed: typeof coupon.times_redeemed === 'number' ? coupon.times_redeemed : null,
      max_redemptions: coupon.max_redemptions ?? null,
      valid: coupon.valid !== false,
    },
  };
}

async function handleList(stripe, res) {
  try {
    // expand the coupon on each promotion_code so the UI can render % / $ off
    // without a second round-trip per row.
    const page = await stripe.promotionCodes.list({
      active: true,
      limit: 100,
      expand: ['data.coupon'],
    });
    return res.status(200).json({
      codes: (page.data || []).map(shapeRow),
    });
  } catch (err) {
    console.warn('[admin/promo-codes] list failed', safeLogContext(err, 'promo_codes_list_failed'));
    return res.status(500).json({
      error: 'Could not load promo codes.',
      code: safeErrorCode(err, 'promo_codes_list_failed'),
    });
  }
}

async function handleCreate(stripe, db, authed, body, res) {
  const code = normalizeCode(body.code);
  if (!code) {
    return res.status(400).json({
      error: 'Code must be 4–50 letters or digits (A–Z, 0–9).',
      code: 'invalid_code',
    });
  }

  const duration = String(body.duration || '').trim();
  if (!VALID_DURATIONS.has(duration)) {
    return res.status(400).json({
      error: 'Duration must be one of: once, forever, repeating.',
      code: 'invalid_duration',
    });
  }

  // Stripe coupons take EITHER percent_off OR amount_off — never both, never
  // neither. Reject ambiguous payloads at the door.
  const hasPercent = body.percent_off != null && body.percent_off !== '';
  const hasAmount = body.amount_off != null && body.amount_off !== '';
  if (hasPercent === hasAmount) {
    return res.status(400).json({
      error: 'Provide exactly one of percent_off or amount_off.',
      code: 'invalid_discount',
    });
  }

  const couponParams = { duration };
  if (hasPercent) {
    const pct = Number(body.percent_off);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return res.status(400).json({ error: 'percent_off must be 1–100.', code: 'invalid_percent_off' });
    }
    // Round to 2 decimals — Stripe accepts fractional percents.
    couponParams.percent_off = Math.round(pct * 100) / 100;
  } else {
    const cents = dollarsToCents(body.amount_off);
    if (cents == null) {
      return res.status(400).json({ error: 'amount_off must be a positive number (USD).', code: 'invalid_amount_off' });
    }
    couponParams.amount_off = cents;
    couponParams.currency = 'usd';
  }

  if (duration === 'repeating') {
    const months = Number(body.duration_in_months);
    if (!Number.isFinite(months) || months < 1 || months > 60) {
      return res.status(400).json({
        error: 'duration_in_months must be 1–60 for repeating coupons.',
        code: 'invalid_duration_in_months',
      });
    }
    couponParams.duration_in_months = Math.floor(months);
  }

  // The coupon's redeem_by mirrors the promotion code's expires_at so the
  // backing coupon also dies when the surfaced code does.
  const expiresAtUnix = parseExpiresAt(body.expires_at);
  if (body.expires_at && expiresAtUnix == null) {
    return res.status(400).json({ error: 'expires_at could not be parsed.', code: 'invalid_expires_at' });
  }
  if (expiresAtUnix) couponParams.redeem_by = expiresAtUnix;

  // max_redemptions lives on BOTH objects in Stripe. We set it on the
  // promotion_code (what customers redeem) and leave coupon.max_redemptions
  // off so the coupon is reusable if we ever attach more codes to it.
  let maxRedemptions = null;
  if (body.max_redemptions != null && body.max_redemptions !== '') {
    const n = Number(body.max_redemptions);
    if (!Number.isFinite(n) || n < 1) {
      return res.status(400).json({ error: 'max_redemptions must be a positive integer.', code: 'invalid_max_redemptions' });
    }
    maxRedemptions = Math.floor(n);
  }

  // Tag everything we create so it's obviously ours in the Stripe dashboard
  // and we can later filter on metadata.source if needed.
  couponParams.metadata = { source: 'avalon_admin_promo_codes' };

  let coupon;
  try {
    coupon = await stripe.coupons.create(couponParams);
  } catch (err) {
    console.warn('[admin/promo-codes] coupon create failed', safeLogContext(err, 'promo_code_coupon_create_failed'));
    return res.status(400).json({
      error: err?.raw?.message || err?.message || 'Stripe rejected the coupon.',
      code: safeErrorCode(err, 'promo_code_coupon_create_failed'),
    });
  }

  const promoParams = {
    coupon: coupon.id,
    code,
    metadata: { source: 'avalon_admin_promo_codes' },
  };
  if (maxRedemptions != null) promoParams.max_redemptions = maxRedemptions;
  if (expiresAtUnix) promoParams.expires_at = expiresAtUnix;

  let promo;
  try {
    promo = await stripe.promotionCodes.create(promoParams);
  } catch (err) {
    console.warn('[admin/promo-codes] promotion code create failed', safeLogContext(err, 'promo_code_create_failed'));
    // Best-effort rollback: if the promo-code create blew up (e.g. code already
    // taken), nuke the orphan coupon so we don't litter the Stripe account.
    try { await stripe.coupons.del(coupon.id); } catch { /* swallow rollback err */ }
    return res.status(400).json({
      error: err?.raw?.message || err?.message || 'Stripe rejected the promo code.',
      code: safeErrorCode(err, 'promo_code_create_failed'),
    });
  }

  // Re-expand so the response carries the same shape as GET rows.
  const expanded = { ...promo, coupon };
  const row = shapeRow(expanded);

  await writeAuditEvent(db, {
    tenantId: authed.tenantId,
    actorProfileId: authed.user?.id || null,
    action: 'promo_code_created',
    entityType: 'stripe_promotion_code',
    entityId: promo.id,
    phiTouched: false,
    payload: {
      code: row.code,
      coupon_id: coupon.id,
      percent_off: row.coupon.percent_off,
      amount_off_dollars: row.coupon.amount_off_dollars,
      duration: row.coupon.duration,
      duration_in_months: row.coupon.duration_in_months,
      max_redemptions: row.max_redemptions,
      expires_at: row.expires_at,
    },
  });

  return res.status(200).json({ ok: true, promo: row });
}

async function handleArchive(stripe, db, authed, body, res) {
  const id = String(body?.id || '').trim();
  if (!id || !id.startsWith('promo_')) {
    return res.status(400).json({ error: 'Promotion code id is required.', code: 'invalid_promo_id' });
  }
  try {
    const promo = await stripe.promotionCodes.update(id, { active: false });
    await writeAuditEvent(db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user?.id || null,
      action: 'promo_code_archived',
      entityType: 'stripe_promotion_code',
      entityId: id,
      phiTouched: false,
      payload: { code: promo?.code || null },
    });
    return res.status(200).json({ ok: true, id, active: false });
  } catch (err) {
    console.warn('[admin/promo-codes] archive failed', safeLogContext(err, 'promo_code_archive_failed'));
    return res.status(400).json({
      error: err?.raw?.message || err?.message || 'Could not archive the promo code.',
      code: safeErrorCode(err, 'promo_code_archive_failed'),
    });
  }
}

export default async function handler(req, res) {
  const authed = await requireStaff(req, res);
  if (!authed) return;

  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured (missing STRIPE_SECRET_KEY).',
      code: 'stripe_not_configured',
    });
  }

  if (req.method === 'GET') {
    return handleList(stripe, res);
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = String(req.query?.action || '').toLowerCase();
    if (action === 'archive') {
      return handleArchive(stripe, authed.db, authed, body, res);
    }
    return handleCreate(stripe, authed.db, authed, body, res);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
