/**
 * POST /api/admin/bookings/retry-acuity
 *
 * Staff/admin retry for paid appointments whose Stripe payment succeeded but
 * Acuity scheduling failed. Reuses the same checkout fulfillment helper as the
 * webhook and checkout verify path.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import {
  checkoutPayloadFromRecord,
  claimSchedulingCreation,
  createSchedulingAppointmentWithFallback,
} from '../../_checkout-fulfillment.js';

function buildExternalPayload(existingPayload = {}, patch = {}) {
  return {
    ...existingPayload,
    fulfillment: {
      ...(existingPayload.fulfillment || {}),
      ...patch,
      source: 'admin_retry_acuity',
      updatedAt: new Date().toISOString(),
    },
  };
}

function scopedAppointmentUpdate(db, record, tenantId, patch) {
  let query = db.from('appointments').update(patch).eq('id', record.id);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return query;
}

function isPaymentCompleteEnoughForRetry(status) {
  return ['partial_payment', 'paid_in_full', 'deposit_paid'].includes(String(status || ''));
}

async function auditRetry(db, { tenantId, actorProfileId, appointmentId, result, code }) {
  await writeAuditEvent(db, {
    tenantId,
    actorProfileId,
    action: 'admin_retry_acuity',
    entityType: 'appointment',
    entityId: appointmentId,
    phiTouched: true,
    payload: {
      route: 'api/admin/bookings/retry-acuity',
      result,
      ...(code ? { code } : {}),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const appointmentId = String(req.body?.appointmentId || '').trim();
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required', code: 'appointment_id_missing' });
  }

  const { db, tenantId } = authed;
  let query = db.from('appointments')
    .select('id, tenant_id, status, payment_status, acuity_appointment_id, reconciliation_status, external_payload')
    .eq('id', appointmentId)
    .maybeSingle();
  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data: record, error: readError } = await query;
  if (readError) {
    console.warn('[admin/bookings/retry-acuity] read failed', safeLogContext(readError, 'retry_acuity_read_failed'));
    return res.status(500).json({ error: 'Could not load booking.', code: safeErrorCode(readError, 'retry_acuity_read_failed') });
  }
  if (!record) return res.status(404).json({ error: 'Booking not found.', code: 'booking_not_found' });
  if (record.acuity_appointment_id) {
    await auditRetry(db, {
      tenantId: record.tenant_id || tenantId || null,
      actorProfileId: authed.user?.id || null,
      appointmentId: record.id,
      result: 'rejected',
      code: 'acuity_already_created',
    });
    return res.status(409).json({ error: 'Booking already has an Acuity appointment.', code: 'acuity_already_created' });
  }
  if (record.reconciliation_status !== 'action_required') {
    await auditRetry(db, {
      tenantId: record.tenant_id || tenantId || null,
      actorProfileId: authed.user?.id || null,
      appointmentId: record.id,
      result: 'rejected',
      code: 'retry_not_action_required',
    });
    return res.status(409).json({ error: 'Booking does not require scheduling retry.', code: 'retry_not_action_required' });
  }
  if (!isPaymentCompleteEnoughForRetry(record.payment_status)) {
    await auditRetry(db, {
      tenantId: record.tenant_id || tenantId || null,
      actorProfileId: authed.user?.id || null,
      appointmentId: record.id,
      result: 'rejected',
      code: 'retry_payment_not_confirmed',
    });
    return res.status(409).json({ error: 'Payment is not confirmed for this booking.', code: 'retry_payment_not_confirmed' });
  }

  const checkout = checkoutPayloadFromRecord(record);
  if (!checkout?.appointment || !checkout?.contact) {
    return res.status(409).json({ error: 'Booking payload is incomplete.', code: 'checkout_payload_missing' });
  }

  const wonSchedulingClaim = await claimSchedulingCreation(db, record.id);
  if (!wonSchedulingClaim) {
    return res.status(409).json({ error: 'Scheduling is already being retried. Refresh in a moment.', code: 'scheduling_lock_held' });
  }

  try {
    const acuityAppointment = await createSchedulingAppointmentWithFallback({
      appointment: checkout.appointment || {},
      contact: checkout.contact || {},
      items: checkout.items || [],
      membership: checkout.membership || null,
      amounts: checkout.amounts || {},
      req,
    });

    if (!acuityAppointment?.id) {
      throw Object.assign(new Error('Acuity did not return an appointment id.'), { code: 'acuity_missing_appointment_id' });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await scopedAppointmentUpdate(db, record, tenantId, {
      status: 'scheduled',
      acuity_appointment_id: String(acuityAppointment.id),
      reconciliation_status: 'ok',
      scheduling_lock_at: null,
      external_payload: buildExternalPayload(record.external_payload || {}, {
        acuityAppointment,
        retryBy: authed.user?.id || null,
      }),
      updated_at: now,
    });
    if (updateError) throw updateError;

    await auditRetry(db, {
      tenantId: record.tenant_id || tenantId || null,
      actorProfileId: authed.user?.id || null,
      appointmentId: record.id,
      result: 'acuity_created',
      code: 'ok',
    });

    return res.status(200).json({
      ok: true,
      appointmentId: record.id,
      acuityAppointmentId: String(acuityAppointment.id),
    });
  } catch (err) {
    console.warn('[admin/bookings/retry-acuity] retry failed', safeLogContext(err, 'retry_acuity_failed'));
    await scopedAppointmentUpdate(db, record, tenantId, {
      reconciliation_status: 'action_required',
      scheduling_lock_at: null,
      external_payload: buildExternalPayload(record.external_payload || {}, {
        retryError: safeLogContext(err, 'retry_acuity_failed'),
        retryBy: authed.user?.id || null,
      }),
      updated_at: new Date().toISOString(),
    });
    await auditRetry(db, {
      tenantId: record.tenant_id || tenantId || null,
      actorProfileId: authed.user?.id || null,
      appointmentId: record.id,
      result: 'failed',
      code: safeErrorCode(err, 'retry_acuity_failed'),
    });
    return res.status(err.status || 502).json({
      error: 'Could not create the Acuity appointment.',
      code: safeErrorCode(err, 'retry_acuity_failed'),
    });
  }
}
