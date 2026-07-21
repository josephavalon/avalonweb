/**
 * Event-scoped Stripe webhook helpers (ET2). The Stripe webhook routes here
 * for sessions/charges that belong to the events platform and NOWHERE else —
 * the mobile-IV fulfillment path (handleCheckoutCompleted) is untouched.
 *
 * Refunds (eng decision 2A): the admin refund_requests flow stays the
 * INITIATOR of refunds; charge.refunded here is state-sync only — flip the
 * order + visits and promote the waitlist via events-core.
 *
 * PHI LAW: routing decisions read metadata ids/slugs only. All visit status
 * changes go through transition_event_visit (audited RPC).
 */
import { confirmEventOrder, syncEventOrderRefund } from './events-core.js';

/** Pure: does this Checkout session belong to the events platform? */
export function isEventSession(session) {
  const md = session?.metadata || {};
  return md.kind === 'event' && Boolean(md.event_order_id);
}

/** Pure: does this PaymentIntent belong to the events platform? Used for
 * the inline-checkout flow where fulfillment fires on payment_intent.succeeded
 * (no Checkout session is created).
 */
export function isEventPaymentIntent(paymentIntent) {
  const md = paymentIntent?.metadata || {};
  return md.kind === 'event' && Boolean(md.event_order_id);
}

/** payment_intent.succeeded (inline checkout) → same fulfillment as
 * checkout.session.completed, without a session id. */
export async function handleEventPaymentIntentSucceeded(db, paymentIntent) {
  if (!db) return { action: 'event_fulfillment_skipped_db_not_configured', matched: false };
  const orderId = paymentIntent.metadata.event_order_id;
  const { order, visits, alreadyFulfilled } = await confirmEventOrder(db, {
    orderId,
    stripeSessionId: null,
    paymentIntent: paymentIntent.id,
  });
  return {
    action: alreadyFulfilled ? 'event_order_already_fulfilled' : 'event_order_confirmed_inline',
    matched: true,
    orderId: order.id,
    visitCount: (visits || []).length,
  };
}

/** checkout.session.completed → idempotent fulfillment via events-core. */
export async function handleEventCheckoutCompleted(db, session) {
  if (!db) return { action: 'event_fulfillment_skipped_db_not_configured', matched: false };
  const orderId = session.metadata.event_order_id;
  const paymentIntent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null;
  const { order, visits, alreadyFulfilled } = await confirmEventOrder(db, {
    orderId,
    stripeSessionId: session.id,
    paymentIntent,
  });
  return {
    action: alreadyFulfilled ? 'event_order_already_fulfilled' : 'event_order_confirmed',
    matched: true,
    orderId: order.id,
    visitCount: (visits || []).length,
  };
}

/**
 * Release the capacity holds of one order (held → canceled via the audited
 * RPC) and mark a still-pending order expired. Idempotent: confirmed visits
 * and paid orders are never touched.
 */
export async function releaseOrderHolds(db, orderId) {
  const { data: held, error } = await db
    .from('event_visits')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'held');
  if (error) throw error;
  for (const v of held || []) {
    const { error: rpcErr } = await db.rpc('transition_event_visit', {
      p_visit_id: v.id, p_field: 'status', p_to: 'canceled', p_actor: null,
      p_meta: { via: 'checkout.session.expired', order_id: orderId },
    });
    if (rpcErr) throw rpcErr;
  }
  const { error: orderErr } = await db
    .from('event_orders')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'pending');
  if (orderErr) throw orderErr;
  return (held || []).length;
}

/** checkout.session.expired → free the seats this abandoned order was holding. */
export async function handleEventSessionExpired(db, session) {
  if (!db) return { action: 'event_expiry_skipped_db_not_configured', matched: false };
  const orderId = session.metadata.event_order_id;
  const released = await releaseOrderHolds(db, orderId);
  return { action: 'event_order_expired', matched: true, orderId, released };
}

/**
 * charge.refunded → state-sync (2A). Only acts when an event order matches
 * the charge's payment intent; every other refund is explicitly ignored so
 * the existing refund_requests admin flow keeps sole ownership of them.
 */
export async function handleEventChargeRefunded(db, charge) {
  if (!db) return { action: 'event_refund_skipped_db_not_configured', matched: false };
  const paymentIntent = typeof charge?.payment_intent === 'string'
    ? charge.payment_intent
    : charge?.payment_intent?.id || null;
  if (!paymentIntent) return { action: 'ignored_non_event_refund', matched: false };

  const { data: order, error } = await db
    .from('event_orders')
    .select('*')
    .eq('stripe_payment_intent', paymentIntent)
    .maybeSingle();
  if (error) throw error;
  if (!order) return { action: 'ignored_non_event_refund', matched: false };

  const { alreadySynced, promoted } = await syncEventOrderRefund(db, { order });
  return {
    action: alreadySynced ? 'event_refund_already_synced' : 'event_refund_synced',
    matched: true,
    orderId: order.id,
    waitlistPromoted: Boolean(promoted),
  };
}
