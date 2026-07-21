/**
 * POST /api/me/subscription/cancel
 *
 * Self-serve membership cancel. Default behaviour is cancel-at-period-end so
 * the member keeps their remaining credits + perks until the next renewal
 * date (matches the copy on the portal Memberships page: "you keep your X
 * credits until <renewal>"). atPeriodEnd=false cancels immediately, useful
 * for support tools or a future "cancel right now" flow.
 */

import Stripe from 'stripe';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { authAndActiveSubscription } from './_helpers.js';

// Known, non-PHI cancellation categories the portal surfaces. The category
// (an enum, never free text) is the only piece allowed onto Stripe metadata,
// because Stripe has no BAA — any free-text the member types in "Other" could
// contain PHI and must stay in our Supabase audit log, never in Stripe.
const REASON_CATEGORIES = new Set(['too_expensive', 'not_using', 'switching', 'other']);

function normalizeReasonCategory(value) {
  const v = String(value || '').trim().toLowerCase();
  return REASON_CATEGORIES.has(v) ? v : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const { atPeriodEnd = true } = body;
  const cancelAtEnd = atPeriodEnd !== false;

  // Cancellation reason is OPTIONAL — cancel must still work with none.
  // `reasonCategory` is a safe enum (goes to Stripe metadata + audit);
  // `reasonText` is free text (audit ONLY, never Stripe — possible PHI).
  const reasonCategory = normalizeReasonCategory(body.reason || body.reasonCategory);
  const reasonText = typeof body.reasonText === 'string'
    ? body.reasonText.trim().slice(0, 1000)
    : '';

  const ctx = await authAndActiveSubscription(req, res, Stripe);
  if (!ctx) return;
  const { authed, stripe, subscription } = ctx;

  try {
    let updated;
    if (cancelAtEnd) {
      updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        // Only the safe category reaches Stripe; never the free text.
        ...(reasonCategory
          ? { metadata: { ...(subscription.metadata || {}), cancellation_reason: reasonCategory } }
          : {}),
      });
    } else {
      // Stripe's cancel() accepts a structured cancellation_details.comment, but
      // we keep PHI out of Stripe: stamp the safe category onto metadata first.
      if (reasonCategory) {
        await stripe.subscriptions.update(subscription.id, {
          metadata: { ...(subscription.metadata || {}), cancellation_reason: reasonCategory },
        });
      }
      updated = await stripe.subscriptions.cancel(subscription.id);
    }

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId || null,
      actorProfileId: authed.user?.id || null,
      action: 'self_plan_cancel',
      entityType: 'subscription',
      entityId: subscription.id,
      phiTouched: false,
      payload: {
        atPeriodEnd: cancelAtEnd,
        cancelAt: updated.cancel_at || null,
        cancellationReason: reasonCategory || null,
        cancellationReasonText: reasonText || null,
      },
    });

    return res.status(200).json({
      ok: true,
      atPeriodEnd: cancelAtEnd,
      cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000).toISOString() : null,
      currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null,
      status: updated.status,
    });
  } catch (err) {
    console.warn('[me/subscription/cancel] failed', safeLogContext(err, 'subscription_cancel_failed'));
    return res.status(500).json({
      error: 'Could not cancel the plan.',
      code: safeErrorCode(err, 'subscription_cancel_failed'),
    });
  }
}
