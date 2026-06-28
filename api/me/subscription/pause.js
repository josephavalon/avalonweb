/**
 * POST /api/me/subscription/pause
 *
 * Pause collection on the member's active subscription for N billing cycles
 * (1 or 2 — the portal exposes "Pause for 1 cycle"). Uses Stripe's
 * pause_collection.behavior='mark_uncollectible' + resumes_at so renewals
 * resume automatically without staff intervention; the member's existing
 * credits stay on file the whole time.
 */

import Stripe from 'stripe';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { authAndActiveSubscription } from './_helpers.js';

const MAX_CYCLES = 2;

// Fallback only — used when the subscription price has no usable recurring
// descriptor (should be rare; every plan price is recurring).
const FALLBACK_CYCLE_DAYS = 30;

/**
 * Derive the real billing-cycle length (in days) for ONE cycle from the
 * subscription's price.recurring { interval, interval_count }. A 6-month plan
 * has interval='month', interval_count=6 → 180 days; pausing it for "1 cycle"
 * must skip the whole 6 months, not a hardcoded 30. We approximate calendar
 * months/years as 30/365 days for the resumes_at timestamp — Stripe resumes
 * collection on the first invoice on/after resumes_at, so this lands the
 * member back on their normal renewal cadence without skipping extra cycles.
 */
function cycleDaysFromSubscription(subscription) {
  const recurring = subscription?.items?.data?.[0]?.price?.recurring;
  const interval = recurring?.interval;
  const count = Math.max(1, Math.floor(Number(recurring?.interval_count) || 1));
  const perUnitDays = { day: 1, week: 7, month: 30, year: 365 }[interval];
  if (!perUnitDays) return FALLBACK_CYCLE_DAYS;
  return perUnitDays * count;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { cycles = 1 } = (req.body && typeof req.body === 'object') ? req.body : {};
  const requested = Math.floor(Number(cycles) || 1);
  if (!Number.isFinite(requested) || requested < 1 || requested > MAX_CYCLES) {
    return res.status(400).json({
      error: `cycles must be between 1 and ${MAX_CYCLES}.`,
      code: 'cycles_invalid',
    });
  }

  const ctx = await authAndActiveSubscription(req, res, Stripe);
  if (!ctx) return;
  const { authed, stripe, subscription } = ctx;

  try {
    const cycleDays = cycleDaysFromSubscription(subscription);
    const resumesAtUnix = Math.floor(Date.now() / 1000) + requested * cycleDays * 24 * 60 * 60;
    const updated = await stripe.subscriptions.update(subscription.id, {
      pause_collection: {
        behavior: 'mark_uncollectible',
        resumes_at: resumesAtUnix,
      },
    });

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId || null,
      actorProfileId: authed.user?.id || null,
      action: 'self_plan_pause',
      entityType: 'subscription',
      entityId: subscription.id,
      phiTouched: false,
      payload: {
        cycles: requested,
        cycleDays,
        resumesAt: new Date(resumesAtUnix * 1000).toISOString(),
      },
    });

    return res.status(200).json({
      ok: true,
      cycles: requested,
      cycleDays,
      resumesAt: new Date(resumesAtUnix * 1000).toISOString(),
      status: updated.status,
    });
  } catch (err) {
    console.warn('[me/subscription/pause] failed', safeLogContext(err, 'subscription_pause_failed'));
    return res.status(500).json({
      error: 'Could not pause the plan.',
      code: safeErrorCode(err, 'subscription_pause_failed'),
    });
  }
}
