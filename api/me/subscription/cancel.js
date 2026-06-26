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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { atPeriodEnd = true } = (req.body && typeof req.body === 'object') ? req.body : {};
  const cancelAtEnd = atPeriodEnd !== false;

  const ctx = await authAndActiveSubscription(req, res, Stripe);
  if (!ctx) return;
  const { authed, stripe, subscription } = ctx;

  try {
    let updated;
    if (cancelAtEnd) {
      updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
    } else {
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
