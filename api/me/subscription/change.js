/**
 * POST /api/me/subscription/change
 *
 * Self-serve plan switching from the patient portal Memberships page. Two
 * modes via the `action` field:
 *   - 'preview' → returns the proration the member will see before they
 *                 commit (Stripe upcoming invoice with the target price
 *                 swapped in for the current item).
 *   - 'commit'  → applies the swap on the active subscription with
 *                 proration_behavior='create_prorations'.
 *
 * Stripe price strategy: see api/me/_subscription-plans.js. We honour
 * STRIPE_PRICE_ID_{ESSENTIALS,VITALITY,CONCIERGE} env vars when set so ops can
 * migrate to canonical Stripe Prices without a code change; otherwise we
 * build a recurring price_data inline (the same pattern fulfillment uses for
 * the deferred plan subscription at signup).
 */

import { Stripe, resolvePortalPlan, resolveTargetPrice, subscriptionItemsPatch, upcomingInvoiceItems } from '../_subscription-plans.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { authAndActiveSubscription } from './_helpers.js';

function shapeProration(invoice) {
  if (!invoice) return null;
  return {
    amountDue: Math.round(Number(invoice.amount_due || 0)) / 100,
    subtotal: Math.round(Number(invoice.subtotal || 0)) / 100,
    total: Math.round(Number(invoice.total || 0)) / 100,
    currency: invoice.currency || 'usd',
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    items: (invoice.lines?.data || []).map((line) => ({
      description: line.description || '',
      amount: Math.round(Number(line.amount || 0)) / 100,
      proration: !!line.proration,
      periodStart: line.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
      periodEnd: line.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetPlan, action = 'preview' } = (req.body && typeof req.body === 'object') ? req.body : {};
  const plan = resolvePortalPlan(targetPlan);
  if (!plan) {
    return res.status(400).json({
      error: 'Unknown plan.',
      code: 'plan_unknown',
      allowed: ['essentials', 'vitality', 'concierge'],
    });
  }
  if (action !== 'preview' && action !== 'commit') {
    return res.status(400).json({ error: 'action must be "preview" or "commit"', code: 'action_invalid' });
  }

  const ctx = await authAndActiveSubscription(req, res, Stripe);
  if (!ctx) return; // helper already wrote 401/404/503
  const { authed, stripe, customerId, subscription, item } = ctx;

  try {
    const resolved = await resolveTargetPrice(stripe, plan);

    if (action === 'preview') {
      // Use createPreview when available (newer SDKs) and fall back to the
      // legacy retrieveUpcoming so this works on older Stripe API versions.
      const previewParams = {
        customer: customerId,
        subscription: subscription.id,
        subscription_items: upcomingInvoiceItems({ itemId: item.id, resolved }),
        subscription_proration_behavior: 'create_prorations',
      };
      let invoice = null;
      try {
        invoice = typeof stripe.invoices.createPreview === 'function'
          ? await stripe.invoices.createPreview(previewParams)
          : await stripe.invoices.retrieveUpcoming(previewParams);
      } catch (err) {
        // Bubble the Stripe message up so the UI can show "this price isn't
        // valid on this customer" instead of a generic 500.
        console.warn('[me/subscription/change] preview failed', safeLogContext(err, 'subscription_preview_failed'));
        return res.status(err?.statusCode || 502).json({
          error: 'Could not preview the plan change.',
          code: safeErrorCode(err, 'subscription_preview_failed'),
        });
      }
      return res.status(200).json({
        ok: true,
        targetPlan: plan.id,
        proration: shapeProration(invoice),
      });
    }

    // action === 'commit'
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: subscriptionItemsPatch({ itemId: item.id, resolved }),
      proration_behavior: 'create_prorations',
      metadata: {
        ...(subscription.metadata || {}),
        portalPlanId: plan.id,
        portalPlanChangedAt: new Date().toISOString(),
      },
    });

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId || null,
      actorProfileId: authed.user?.id || null,
      action: 'self_plan_change',
      entityType: 'subscription',
      entityId: subscription.id,
      phiTouched: false,
      payload: {
        targetPlan: plan.id,
        subscriptionId: subscription.id,
      },
    });

    return res.status(200).json({
      ok: true,
      targetPlan: plan.id,
      subscription: {
        id: updated.id,
        status: updated.status,
        currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null,
      },
    });
  } catch (err) {
    console.warn('[me/subscription/change] failed', safeLogContext(err, 'subscription_change_failed'));
    return res.status(500).json({
      error: 'Could not change the plan.',
      code: safeErrorCode(err, 'subscription_change_failed'),
    });
  }
}
