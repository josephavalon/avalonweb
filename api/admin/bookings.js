/**
 * GET /api/admin/bookings
 *
 * All bookings for the admin dashboard, newest scheduled first. Admin-only
 * (verified Supabase session with profiles.role = 'admin'). Returns contact
 * details (admins are staff) plus payment state + whether a saved card / Stripe
 * customer exists, so the UI can show the right balance-collection action.
 * Staff and admins may read it; tenant scope comes from the authenticated
 * profile.
 *
 * Query: ?scope=upcoming|all (default all), ?limit (default 500, max 1000).
 */

import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { requireStaff } from '../_lib/supabase-auth.js';

function dollarsFromCents(cents) {
  if (cents == null) return null;
  return Math.round(Number(cents)) / 100;
}

function shapeBooking(row) {
  const payload = row.external_payload || {};
  const appointment = payload.appointment || {};
  const contact = payload.contact || {};
  const discount = payload.discount || {};
  const comped = payload.comped || {};
  const creditRedemption = payload.creditRedemption || payload.fulfillment?.creditRedemption || {};
  const name = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  return {
    id: row.id,
    status: row.status,
    startsAt: row.starts_at,
    service: payload.primaryService || row.protocol_key || 'Avalon Visit',
    appointmentType: appointment.orderType || (payload.membership ? 'subscription' : 'single'),
    paymentType: appointment.paymentType || payload.amounts?.depositType || '',
    address: appointment.address || '',
    locationType: appointment.locationType || '',
    isMembership: !!payload.membership,
    customerName: name || '—',
    customerEmail: contact.email || '',
    customerPhone: contact.phone || '',
    paymentStatus: row.payment_status,
    visitSubtotal: dollarsFromCents(row.visit_subtotal_cents),
    depositAmount: dollarsFromCents(row.deposit_amount_cents),
    balanceDue: dollarsFromCents(row.balance_due_cents),
    balanceDueCents: row.balance_due_cents,
    depositPaidAt: row.deposit_paid_at,
    balancePaidAt: row.balance_paid_at,
    comped: Boolean(comped.source || discount.fullComp),
    discountCode: discount.code || comped.code || '',
    discountAmount: dollarsFromCents(discount.amountDiscountCents),
    creditRedeemed: Number(creditRedemption.units || 0) > 0,
    creditUnitsRedeemed: Number(creditRedemption.units || 0),
    creditAmount: dollarsFromCents(creditRedemption.amountCents),
    acuityAppointmentId: row.acuity_appointment_id,
    reconciliationStatus: row.reconciliation_status,
    acuityConfirmationPage: payload.fulfillment?.acuityAppointment?.confirmationPage || payload.fulfillment?.acuityAppointment?.confirmationPageUrl || '',
    acuityRescheduleUrl: payload.fulfillment?.acuityAppointment?.rescheduleUrl || payload.fulfillment?.acuityAppointment?.rescheduleURL || '',
    hasSavedCard: !!row.stripe_payment_method_id,
    hasStripeCustomer: !!row.stripe_customer_id,
    createdAt: row.created_at,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;
  const limit = Math.min(Number(req.query?.limit) || 500, 1000);
  const scope = req.query?.scope === 'upcoming' ? 'upcoming' : 'all';

  let query = db.from('appointments')
    .select('id, tenant_id, status, starts_at, protocol_key, payment_status, reconciliation_status, visit_subtotal_cents, deposit_amount_cents, balance_due_cents, deposit_paid_at, balance_paid_at, acuity_appointment_id, stripe_customer_id, stripe_payment_method_id, external_payload, created_at')
    .neq('status', 'archived')
    .order('starts_at', { ascending: scope === 'upcoming', nullsFirst: false })
    .limit(limit);

  // The service-role client bypasses RLS, so the tenant scope has to come from
  // the JS side. Without it, staff at tenant A would see/charge tenant B.
  if (tenantId) query = query.eq('tenant_id', tenantId);

  if (scope === 'upcoming') {
    query = query.gte('starts_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[admin/bookings] appointment query failed', safeLogContext(error, 'admin_bookings_query_failed'));
    return res.status(500).json({
      error: 'Could not load bookings.',
      code: safeErrorCode(error, 'admin_bookings_query_failed'),
    });
  }
  await writeAuditEvent(db, {
    tenantId: authed.tenantId || data?.find((row) => row?.tenant_id)?.tenant_id || null,
    actorProfileId: authed.user?.id || null,
    action: 'admin_bookings_read',
    entityType: 'appointments',
    phiTouched: true,
    payload: {
      route: 'api/admin/bookings',
      scope,
      limit,
      resultCount: (data || []).length,
    },
  });
  return res.status(200).json({ bookings: (data || []).map(shapeBooking) });
}
