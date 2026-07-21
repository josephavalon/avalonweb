/**
 * POST /api/me/refund-request
 *
 * Self-serve REFUND REQUEST from the patient portal. This NEVER issues a
 * refund — refunds are always a human, staff-actioned decision (clinical /
 * finance / HIPAA reasons). This endpoint only records the request so staff
 * can review and action it from the back office.
 *
 * Auth: Supabase access-token. The appointment must belong to the caller
 * (matched by booking-contact email, mirroring /api/me/appointments and
 * /api/me/pay-balance — booking is anonymous, so the session email is the
 * only tie back to a patient).
 *
 * Durability: the request is written to the `refund_requests` table when it
 * exists. Regardless, an `action='refund_requested'` audit event is ALWAYS
 * written with the appointment id + reason as the durable source of truth, so
 * the request survives even if the table migration has not been applied yet.
 *
 * Idempotency: a second request for an appointment that already has an OPEN
 * (status='requested') request is rejected gracefully (200, already_requested)
 * so a double-tap or a re-load cannot spam staff with duplicate cases.
 */
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

function emailFromPayload(payload = {}) {
  return String(payload?.contact?.email || '').trim().toLowerCase();
}

// A Postgres "relation does not exist" (undefined_table) — the migration for
// `refund_requests` has not been applied. We treat this as soft: the audit
// event is still the source of truth, so the request is not lost.
function isMissingTable(err) {
  const code = err?.code || err?.cause?.code;
  if (code === '42P01') return true;
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('schema cache');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });

  const { db, user, email, tenantId } = authed;
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const appointmentId = body.appointmentId;
  const reason = String(body.reason || '').trim().slice(0, 2000);

  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required', code: 'appointment_id_missing' });
  }
  if (!reason) {
    return res.status(400).json({ error: 'A reason is required', code: 'reason_missing' });
  }

  try {
    // 1) Load the appointment and verify ownership (same scoping as pay-balance).
    let query = db.from('appointments')
      .select('id, tenant_id, payment_status, deposit_amount_cents, balance_due_cents, external_payload')
      .eq('id', appointmentId);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data: appt, error: readErr } = await query.maybeSingle();
    if (readErr) throw readErr;
    if (!appt) return res.status(404).json({ error: 'Appointment not found', code: 'appointment_not_found' });

    const bookingEmail = emailFromPayload(appt.external_payload);
    if (!bookingEmail || bookingEmail !== String(email || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'Not your appointment', code: 'appointment_not_yours' });
    }

    const apptTenantId = appt.tenant_id || tenantId || null;

    // 2) Reject duplicates: an existing OPEN request for this appointment.
    //    If the table is missing this is skipped silently (audit event still
    //    fires below). We never block the request on a missing table.
    let tableExists = true;
    try {
      let dupQuery = db.from('refund_requests')
        .select('id, status')
        .eq('appointment_id', appt.id)
        .eq('status', 'requested')
        .limit(1);
      if (apptTenantId) dupQuery = dupQuery.eq('tenant_id', apptTenantId);
      const { data: existing, error: dupErr } = await dupQuery.maybeSingle();
      if (dupErr) throw dupErr;
      if (existing?.id) {
        return res.status(200).json({ ok: true, status: 'requested', alreadyRequested: true });
      }
    } catch (err) {
      if (isMissingTable(err)) {
        tableExists = false;
      } else {
        throw err;
      }
    }

    // 3) Insert the durable request row (when the table exists).
    let requestId = null;
    if (tableExists) {
      try {
        const { data: inserted, error: insErr } = await db.from('refund_requests')
          .insert({
            tenant_id: apptTenantId,
            appointment_id: appt.id,
            profile_id: user?.id || null,
            reason,
            status: 'requested',
          })
          .select('id')
          .maybeSingle();
        if (insErr) throw insErr;
        requestId = inserted?.id || null;
      } catch (err) {
        if (isMissingTable(err)) {
          tableExists = false;
        } else {
          throw err;
        }
      }
    }

    // 4) ALWAYS write the audit event — this is the durable source of truth and
    //    the staff notification of record. (No Stripe call. Refund is a
    //    human decision actioned later from the back office.)
    await writeAuditEvent(db, {
      tenantId: apptTenantId,
      actorProfileId: user?.id || null,
      action: 'refund_requested',
      entityType: 'appointment',
      entityId: appt.id,
      phiTouched: false,
      payload: {
        route: 'api/me/refund-request',
        refundRequestId: requestId,
        reason,
        requestedByEmail: bookingEmail,
        paymentStatus: appt.payment_status,
        depositPaidCents: Number(appt.deposit_amount_cents || 0),
        balanceDueCents: Number(appt.balance_due_cents || 0),
        durableRow: tableExists,
      },
    });

    return res.status(200).json({ ok: true, status: 'requested', refundRequestId: requestId });
  } catch (err) {
    console.warn('[me/refund-request] failed', safeLogContext(err, 'refund_request_failed'));
    return res.status(500).json({
      error: 'Could not submit your refund request. Please try again or contact Avalon.',
      code: safeErrorCode(err, 'refund_request_failed'),
    });
  }
}
