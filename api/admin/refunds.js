/**
 * /api/admin/refunds  — admin/staff back-office for member refund requests.
 *
 * Members file requests via /api/me/refund-request (writes `refund_requests`
 * + a 'refund_requested' audit event). This route lets staff list, approve
 * (issuing the real Stripe refund), and deny those requests.
 *
 * Endpoints (default export, dispatch by method):
 *   GET  ?status=open|approved|denied|all   (default: open === 'requested')
 *        → { requests: [...], tableMissing }. Each row is joined with its
 *          appointment so the UI can show date, amount, member email, reason.
 *   POST { id, action: 'approve'|'deny', note?, cents? }
 *        → action='approve': calls stripe.refunds.create against the
 *          appointment's saved Stripe payment_intent for the FULL amount paid
 *          (deposit + balance), or `cents` if the caller wants a partial refund.
 *          Updates the row to status='approved' + records resolver/refund_id.
 *          IDEMPOTENT: a row already 'approved' short-circuits — we never
 *          double-refund. Stripe `idempotencyKey` is the refund_requests row id
 *          as a second-belt guard.
 *        → action='deny': records status='denied' + note + resolver, no Stripe.
 *
 * ALWAYS writes an audit event:
 *   'refund_request_approved' or 'refund_request_denied' (entityType
 *   'refund_request') with the refundRequestId, appointmentId, amount, and
 *   Stripe ids. The audit trail is the durable source of truth — never skipped.
 *
 * Degrades gracefully when the refund_requests table is missing
 * (tableMissing:true in GET; 503 'migration_required' on POST).
 */

import Stripe from 'stripe';
import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

// Postgres 42P01 / PostgREST PGRST205 — the 024_refund_requests.sql migration
// has not been applied yet. Treat as soft: the audit trail still has every
// 'refund_requested' event, so the data is not lost — staff just can't see
// them in this UI until the table exists.
function isMissingTable(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42p01' ||
    code === 'pgrst205' ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function emailFromPayload(payload) {
  return String(payload?.contact?.email || '').trim().toLowerCase();
}

function nameFromPayload(payload) {
  const c = payload?.contact || {};
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return full || c.fullName || '';
}

// Total cents the patient has actually PAID for an appointment. Deposit +
// balance, defensively coerced. We refund this by default. Membership/plan
// charges live on subscriptions and are out of scope here.
function paidCentsFor(appt) {
  const deposit = Number(appt?.deposit_amount_cents || 0);
  const balancePaid = appt?.balance_paid_at ? Number(appt?.balance_due_cents || 0) : 0;
  // balance_due_cents starts at the full remaining and is set to 0 by the
  // balance webhook AFTER charge; balance_paid_at is the reliable "was paid"
  // signal. When it's set, the balance was charged for that recorded amount.
  // If balance_due_cents was zeroed out post-charge, fall back to
  // visit_subtotal_cents - deposit so we still refund the right total.
  if (appt?.balance_paid_at && !balancePaid && Number(appt?.visit_subtotal_cents || 0) > deposit) {
    return deposit + (Number(appt.visit_subtotal_cents) - deposit);
  }
  return deposit + balancePaid;
}

// Pick the payment intent to refund against. Prefer the deposit PI (it carries
// the first dollar paid); fall back to the balance PI when only a balance
// exists. We refund the FULL paid amount against the deposit PI via Stripe's
// refund-by-payment_intent (it walks charges in order).
function paymentIntentFor(appt) {
  return appt?.stripe_deposit_payment_intent || appt?.stripe_balance_payment_intent || null;
}

function normalizeStatusFilter(raw) {
  const v = String(raw || 'open').toLowerCase();
  if (v === 'all') return 'all';
  if (v === 'open' || v === 'requested') return 'requested';
  if (v === 'approved') return 'approved';
  if (v === 'denied') return 'denied';
  return 'requested';
}

async function listHandler(req, res, { db, tenantId }) {
  const statusFilter = normalizeStatusFilter(req.query?.status);
  try {
    let q = db.from('refund_requests')
      .select('id, tenant_id, appointment_id, profile_id, reason, status, created_at, resolved_at, resolver_id, refund_id, refund_amount_cents, note')
      .order('created_at', { ascending: false })
      .limit(200);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);

    const { data: rows, error } = await q;
    if (error) throw error;

    const list = rows || [];
    const apptIds = Array.from(new Set(list.map((r) => r.appointment_id).filter(Boolean)));
    let apptById = new Map();
    if (apptIds.length) {
      let aq = db.from('appointments')
        .select('id, starts_at, payment_status, deposit_amount_cents, balance_due_cents, balance_paid_at, visit_subtotal_cents, currency, stripe_deposit_payment_intent, stripe_balance_payment_intent, external_payload, acuity_appointment_id, protocol_key')
        .in('id', apptIds);
      if (tenantId) aq = aq.eq('tenant_id', tenantId);
      const { data: appts, error: aErr } = await aq;
      if (aErr) throw aErr;
      apptById = new Map((appts || []).map((a) => [a.id, a]));
    }

    const enriched = list.map((r) => {
      const a = apptById.get(r.appointment_id) || null;
      const payload = a?.external_payload || {};
      const paid = a ? paidCentsFor(a) : 0;
      return {
        id: r.id,
        status: r.status,
        reason: r.reason,
        note: r.note || null,
        created_at: r.created_at,
        resolved_at: r.resolved_at || null,
        refund_id: r.refund_id || null,
        refund_amount_cents: r.refund_amount_cents != null ? Number(r.refund_amount_cents) : null,
        appointment: a ? {
          id: a.id,
          starts_at: a.starts_at,
          protocol_key: a.protocol_key,
          payment_status: a.payment_status,
          currency: a.currency || 'usd',
          paid_cents: paid,
          can_refund_via_stripe: Boolean(paymentIntentFor(a)) && paid > 0,
        } : null,
        member: {
          email: emailFromPayload(payload),
          name: nameFromPayload(payload),
        },
      };
    });

    return res.status(200).json({ requests: enriched, tableMissing: false });
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(200).json({ requests: [], tableMissing: true });
    }
    console.warn('[admin/refunds] list failed', safeLogContext(err, 'refund_list_failed'));
    return res.status(500).json({
      error: 'Could not load refund requests.',
      code: safeErrorCode(err, 'refund_list_failed'),
    });
  }
}

async function actionHandler(req, res, { db, tenantId, user }) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const id = String(body.id || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  const note = body.note != null ? String(body.note).trim().slice(0, 2000) : '';
  const centsOverrideRaw = body.cents;

  if (!id) return res.status(400).json({ error: 'id is required', code: 'id_required' });
  if (action !== 'approve' && action !== 'deny') {
    return res.status(400).json({ error: "action must be 'approve' or 'deny'", code: 'invalid_action' });
  }

  // Load the request row + verify tenant scoping.
  let row = null;
  try {
    let q = db.from('refund_requests')
      .select('id, tenant_id, appointment_id, profile_id, reason, status, refund_id, refund_amount_cents')
      .eq('id', id);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    row = data;
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(503).json({
        error: 'The refund_requests table has not been created yet. Run migration 024, then try again.',
        code: 'migration_required',
      });
    }
    console.warn('[admin/refunds] load failed', safeLogContext(err, 'refund_load_failed'));
    return res.status(500).json({ error: 'Could not load the refund request.', code: safeErrorCode(err, 'refund_load_failed') });
  }
  if (!row) return res.status(404).json({ error: 'Refund request not found', code: 'not_found' });

  // IDEMPOTENCY: never double-refund. An already-approved row short-circuits
  // happy-path so retries are safe; an already-denied row is also a no-op.
  if (row.status === 'approved') {
    return res.status(200).json({
      ok: true,
      already: true,
      status: 'approved',
      refundId: row.refund_id || null,
      refundAmountCents: row.refund_amount_cents != null ? Number(row.refund_amount_cents) : null,
    });
  }
  if (row.status === 'denied' && action === 'deny') {
    return res.status(200).json({ ok: true, already: true, status: 'denied' });
  }

  // ---------- DENY (no Stripe) ----------
  if (action === 'deny') {
    const now = new Date().toISOString();
    try {
      const { error: upErr } = await db.from('refund_requests')
        .update({ status: 'denied', resolved_at: now, resolver_id: user?.id || null, note: note || null })
        .eq('id', row.id);
      if (upErr) throw upErr;
    } catch (err) {
      // If the resolver/note columns are missing, retry with a status-only update
      // so denial still records even before the column-add migration ships.
      const msg = String(err?.message || '').toLowerCase();
      const columnMissing = msg.includes('column') && (msg.includes('does not exist') || msg.includes('not found'));
      if (!columnMissing) {
        console.warn('[admin/refunds] deny failed', safeLogContext(err, 'refund_deny_failed'));
        return res.status(500).json({ error: 'Could not deny the request.', code: safeErrorCode(err, 'refund_deny_failed') });
      }
      const { error: fallbackErr } = await db.from('refund_requests').update({ status: 'denied' }).eq('id', row.id);
      if (fallbackErr) {
        console.warn('[admin/refunds] deny fallback failed', safeLogContext(fallbackErr, 'refund_deny_failed'));
        return res.status(500).json({ error: 'Could not deny the request.', code: safeErrorCode(fallbackErr, 'refund_deny_failed') });
      }
    }
    await writeAuditEvent(db, {
      tenantId: row.tenant_id || tenantId || null,
      actorProfileId: user?.id || null,
      action: 'refund_request_denied',
      entityType: 'refund_request',
      entityId: row.id,
      phiTouched: false,
      payload: {
        route: 'api/admin/refunds',
        appointmentId: row.appointment_id,
        note: note || null,
      },
    });
    return res.status(200).json({ ok: true, status: 'denied' });
  }

  // ---------- APPROVE (issue Stripe refund) ----------
  if (!process.env.STRIPE_SECRET_KEY) {
    await writeAuditEvent(db, {
      tenantId: row.tenant_id || tenantId || null,
      actorProfileId: user?.id || null,
      action: 'refund_request_approve_rejected',
      entityType: 'refund_request',
      entityId: row.id,
      payload: { reason: 'stripe_not_configured', appointmentId: row.appointment_id },
    });
    return res.status(503).json({ error: 'Stripe is not configured', code: 'stripe_not_configured' });
  }

  // Load the appointment to find the payment intent + paid amount.
  let appt = null;
  try {
    let aq = db.from('appointments')
      .select('id, tenant_id, payment_status, deposit_amount_cents, balance_due_cents, balance_paid_at, visit_subtotal_cents, currency, stripe_deposit_payment_intent, stripe_balance_payment_intent')
      .eq('id', row.appointment_id);
    if (tenantId) aq = aq.eq('tenant_id', tenantId);
    const { data, error } = await aq.maybeSingle();
    if (error) throw error;
    appt = data;
  } catch (err) {
    console.warn('[admin/refunds] appt load failed', safeLogContext(err, 'refund_appt_load_failed'));
    return res.status(500).json({ error: 'Could not load the appointment.', code: safeErrorCode(err, 'refund_appt_load_failed') });
  }
  if (!appt) return res.status(404).json({ error: 'Appointment not found', code: 'appointment_not_found' });

  const paymentIntent = paymentIntentFor(appt);
  if (!paymentIntent) {
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || row.tenant_id || tenantId || null,
      actorProfileId: user?.id || null,
      action: 'refund_request_approve_rejected',
      entityType: 'refund_request',
      entityId: row.id,
      payload: { reason: 'no_payment_intent', appointmentId: appt.id },
    });
    return res.status(409).json({
      error: 'No Stripe payment intent on this appointment to refund. Issue the refund directly in Stripe and use Deny to close the request.',
      code: 'no_payment_intent',
    });
  }

  const paid = paidCentsFor(appt);
  let amountCents = paid;
  if (centsOverrideRaw !== undefined && centsOverrideRaw !== null && centsOverrideRaw !== '') {
    const n = Number(centsOverrideRaw);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: 'cents must be a positive number', code: 'invalid_cents' });
    }
    if (paid > 0 && n > paid) {
      return res.status(400).json({ error: 'Refund exceeds amount paid', code: 'exceeds_paid' });
    }
    amountCents = Math.round(n);
  }
  if (!amountCents || amountCents < 50) {
    return res.status(400).json({ error: 'Nothing to refund', code: 'no_amount' });
  }

  // CRITICAL: real money. Use the refund_requests row id as the Stripe
  // idempotency key so duplicate POSTs collapse to the same Stripe refund.
  // If the Stripe call fails, we DO NOT update the row → next click retries
  // cleanly. If it succeeds, we record the refund id + amount → the next
  // click short-circuits at the status='approved' guard above.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let refund = null;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent,
        amount: amountCents,
        reason: 'requested_by_customer',
        metadata: {
          refund_request_id: row.id,
          appointment_id: appt.id,
          actor_profile_id: user?.id || '',
        },
      },
      { idempotencyKey: `refund_request_${row.id}` },
    );
  } catch (err) {
    // Audit the failure so the attempt is traceable; surface a safe message.
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || row.tenant_id || tenantId || null,
      actorProfileId: user?.id || null,
      action: 'refund_request_stripe_failed',
      entityType: 'refund_request',
      entityId: row.id,
      payload: {
        appointmentId: appt.id,
        paymentIntent,
        amountCents,
        stripeCode: safeErrorCode(err, 'stripe_refund_failed'),
      },
    });
    console.warn('[admin/refunds] stripe refund failed', safeLogContext(err, 'stripe_refund_failed'));
    return res.status(502).json({
      error: 'Stripe refused the refund. No money has moved. Check Stripe and retry.',
      code: safeErrorCode(err, 'stripe_refund_failed'),
    });
  }

  // Persist the resolution. If the new columns are missing, retry with the
  // minimal update so the status flip still lands (and the audit row carries
  // the Stripe refund id as the durable source of truth).
  const now = new Date().toISOString();
  try {
    const { error: upErr } = await db.from('refund_requests')
      .update({
        status: 'approved',
        resolved_at: now,
        resolver_id: user?.id || null,
        refund_id: refund.id,
        refund_amount_cents: amountCents,
        note: note || null,
      })
      .eq('id', row.id);
    if (upErr) throw upErr;
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    const columnMissing = msg.includes('column') && (msg.includes('does not exist') || msg.includes('not found'));
    if (columnMissing) {
      const { error: fallbackErr } = await db.from('refund_requests').update({ status: 'approved' }).eq('id', row.id);
      if (fallbackErr) {
        console.warn('[admin/refunds] approve status-update failed', safeLogContext(fallbackErr, 'refund_approve_update_failed'));
      }
    } else {
      console.warn('[admin/refunds] approve update failed', safeLogContext(err, 'refund_approve_update_failed'));
    }
    // Do NOT return an error here — the Stripe refund DID happen. The audit
    // event below remains the durable record of approval.
  }

  await writeAuditEvent(db, {
    tenantId: appt.tenant_id || row.tenant_id || tenantId || null,
    actorProfileId: user?.id || null,
    action: 'refund_request_approved',
    entityType: 'refund_request',
    entityId: row.id,
    phiTouched: false,
    payload: {
      route: 'api/admin/refunds',
      appointmentId: appt.id,
      paymentIntent,
      stripeRefundId: refund.id,
      stripeRefundStatus: refund.status,
      amountCents,
      paidCents: paid,
      note: note || null,
    },
  });

  return res.status(200).json({
    ok: true,
    status: 'approved',
    refundId: refund.id,
    refundStatus: refund.status,
    refundAmountCents: amountCents,
  });
}

export default async function handler(req, res) {
  const authed = await requireStaff(req, res);
  if (!authed) return;

  if (req.method === 'GET') return listHandler(req, res, authed);
  if (req.method === 'POST') return actionHandler(req, res, authed);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
