/**
 * GET /api/admin/discounts
 *
 * Staff/admin discount redemption report. Stripe remains the coupon source of
 * truth; this endpoint reads the local redemption facts captured by the Stripe
 * webhook and joins appointment payloads for admin-only customer context.
 */

import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { requireStaff } from '../_lib/supabase-auth.js';

function centsToDollars(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

function fmtCode(row = {}) {
  return row.code || row.coupon_name || row.stripe_promotion_code_id || row.stripe_coupon_id || 'Discount';
}

function shapeRedeemer(row, appointment) {
  const payload = appointment?.external_payload || {};
  const contact = payload.contact || {};
  const appointmentPayload = payload.appointment || {};
  const name = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    orderNumber: appointment?.order_number || '',
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripeCouponId: row.stripe_coupon_id || '',
    stripePromotionCodeId: row.stripe_promotion_code_id || '',
    code: fmtCode(row),
    couponName: row.coupon_name || '',
    discountType: row.discount_type || '',
    percentOff: row.percent_off == null ? null : Number(row.percent_off),
    amountOff: row.amount_off_cents == null ? null : centsToDollars(row.amount_off_cents),
    amountDiscount: centsToDollars(row.amount_discount_cents),
    currency: row.currency || 'usd',
    fullComp: !!row.full_comp,
    redeemedAt: row.redeemed_at,
    customerName: name || 'Client',
    customerEmail: contact.email || '',
    customerPhone: contact.phone || '',
    service: payload.primaryService || appointment?.protocol_key || 'Avalon Visit',
    startsAt: appointment?.starts_at || appointmentPayload.acuityDatetime || null,
    paymentStatus: appointment?.payment_status || '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;
  const limit = Math.min(Number(req.query?.limit) || 250, 1000);

  try {
    let query = db.from('discount_redemptions')
      .select('id, tenant_id, appointment_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id, stripe_discount_id, stripe_coupon_id, stripe_promotion_code_id, redemption_key, code, coupon_name, discount_type, percent_off, amount_off_cents, amount_discount_cents, currency, full_comp, redeemed_at, created_at')
      .order('redeemed_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data: rows, error } = await query;
    if (error) throw error;

    const appointmentIds = [...new Set((rows || []).map((row) => row.appointment_id).filter(Boolean))];
    let appointmentsById = new Map();
    if (appointmentIds.length) {
      let apptQuery = db.from('appointments')
        .select('id, tenant_id, starts_at, protocol_key, payment_status, order_number, external_payload')
        .in('id', appointmentIds);
      if (tenantId) apptQuery = apptQuery.eq('tenant_id', tenantId);
      const { data: appts, error: apptError } = await apptQuery;
      if (apptError) throw apptError;
      appointmentsById = new Map((appts || []).map((appt) => [appt.id, appt]));
    }

    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: authed.user?.id || null,
      action: 'admin_discount_redemptions_read',
      entityType: 'discount_redemptions',
      phiTouched: true,
      payload: {
        route: 'api/admin/discounts',
        resultCount: (rows || []).length,
        limit,
      },
    });

    return res.status(200).json({
      discounts: (rows || []).map((row) => shapeRedeemer(row, appointmentsById.get(row.appointment_id))),
    });
  } catch (err) {
    console.warn('[admin/discounts] query failed', safeLogContext(err, 'admin_discounts_query_failed'));
    return res.status(500).json({
      error: 'Could not load discount redemptions.',
      code: safeErrorCode(err, 'admin_discounts_query_failed'),
    });
  }
}
