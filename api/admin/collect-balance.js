/**
 * POST /api/admin/collect-balance
 *
 * Admin dashboard action to collect a visit's remaining balance. Admin-only
 * (verified Supabase session, profiles.role = 'admin'). Shares the Stripe logic
 * with /api/charge-balance via _lib/balance-core.js.
 *
 * Body: {
 *   appointmentId?: string,        // internal appointments.id (preferred)
 *   acuityAppointmentId?: string,  // fallback lookup key
 *   amountCentsOverride?: number,
 *   mode?: 'charge' | 'link'       // default 'charge' (off-session saved card)
 * }
 */

import Stripe from 'stripe';
import { requireAdmin } from '../_lib/supabase-auth.js';
import { collectBalance } from '../_lib/balance-core.js';
import { writeAuditEvent } from '../_lib/audit-events.js';

function resolveChargeAmount({ requestedOverride, balanceDue }) {
  const balance = Number(balanceDue || 0);
  const hasOverride = requestedOverride !== undefined && requestedOverride !== null && requestedOverride !== '';
  const amount = hasOverride ? Number(requestedOverride) : balance;
  if (!Number.isFinite(amount)) return { error: 'Invalid charge amount', code: 'invalid_amount', hasOverride };
  if (hasOverride && amount > balance) return { error: 'Charge override exceeds balance due', code: 'override_exceeds_balance', hasOverride, amount, balance };
  return { amount, balance, hasOverride };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const { appointmentId, acuityAppointmentId, amountCentsOverride } = req.body || {};
  const mode = (req.body?.mode || 'charge') === 'link' ? 'link' : 'charge';
  if (!appointmentId && !acuityAppointmentId) {
    await writeAuditEvent(authed.db, {
      actorProfileId: authed.user?.id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        reason: 'missing_appointment_lookup',
        resultCode: 'missing_appointment_lookup',
        mode,
        override: amountCentsOverride !== undefined && amountCentsOverride !== null && amountCentsOverride !== '',
      },
    });
    return res.status(400).json({ error: 'appointmentId or acuityAppointmentId is required' });
  }

  const { db } = authed;
  let lookup = db.from('appointments')
    .select('id, tenant_id, stripe_customer_id, stripe_payment_method_id, balance_due_cents, payment_status, currency, acuity_appointment_id');
  lookup = appointmentId
    ? lookup.eq('id', appointmentId)
    : lookup.eq('acuity_appointment_id', String(acuityAppointmentId));

  const { data: appt, error: lookupErr } = await lookup.maybeSingle();
  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  if (!appt) {
    await writeAuditEvent(db, {
      actorProfileId: authed.user?.id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        reason: 'appointment_not_found',
        resultCode: 'appointment_not_found',
        appointmentId: appointmentId || null,
        acuityAppointmentId: acuityAppointmentId ? String(acuityAppointmentId) : null,
        mode,
        override: amountCentsOverride !== undefined && amountCentsOverride !== null && amountCentsOverride !== '',
      },
    });
    return res.status(404).json({ error: 'Appointment not found', code: 'appointment_not_found' });
  }
  if (appt.payment_status === 'paid_in_full') {
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || null,
      actorProfileId: authed.user?.id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        reason: 'already_paid',
        resultCode: 'already_paid',
        appointmentId: appt.id,
        balanceDueCents: Number(appt.balance_due_cents || 0),
        mode,
        override: amountCentsOverride !== undefined && amountCentsOverride !== null && amountCentsOverride !== '',
      },
    });
    return res.status(409).json({ error: 'Balance already paid', code: 'already_paid' });
  }

  const resolved = resolveChargeAmount({ requestedOverride: amountCentsOverride, balanceDue: appt.balance_due_cents });
  if (resolved.error) {
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || null,
      actorProfileId: authed.user?.id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        reason: resolved.code,
        resultCode: resolved.code,
        appointmentId: appt.id,
        requestedAmountCents: resolved.amount ?? null,
        balanceDueCents: resolved.balance ?? Number(appt.balance_due_cents || 0),
        mode,
        override: Boolean(resolved.hasOverride),
      },
    });
    return res.status(resolved.code === 'override_exceeds_balance' ? 400 : 400).json({ error: resolved.error, code: resolved.code });
  }
  const amount = resolved.amount;
  if (!amount || amount < 50) {
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || null,
      actorProfileId: authed.user?.id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        reason: 'no_balance',
        resultCode: 'no_balance',
        appointmentId: appt.id,
        amountCents: amount || 0,
        balanceDueCents: Number(appt.balance_due_cents || 0),
        mode,
        override: Boolean(resolved.hasOverride),
      },
    });
    return res.status(400).json({ error: 'No balance due to charge', code: 'no_balance' });
  }
  if (!appt.stripe_customer_id) {
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || null,
      actorProfileId: authed.user?.id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        reason: 'no_customer',
        resultCode: 'no_customer',
        appointmentId: appt.id,
        amountCents: amount,
        balanceDueCents: Number(appt.balance_due_cents || 0),
        mode,
        override: Boolean(resolved.hasOverride),
      },
    });
    return res.status(409).json({ error: 'No customer on file', code: 'no_customer' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const baseUrl = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const result = await collectBalance({
    stripe,
    db,
    appt,
    amount,
    mode,
    currency: appt.currency || 'usd',
    baseUrl,
    acuityAppointmentId: appt.acuity_appointment_id || acuityAppointmentId || appt.id,
  });
  await writeAuditEvent(db, {
    tenantId: appt.tenant_id || null,
    actorProfileId: authed.user?.id || null,
    action: 'balance_charge_attempt',
    entityType: 'appointment',
    entityId: appt.id,
    payload: {
      appointmentId: appt.id,
      amountCents: amount,
      balanceDueCents: Number(appt.balance_due_cents || 0),
      mode,
      override: Boolean(resolved.hasOverride),
      resultStatus: result.httpStatus,
      resultCode: result.json?.code || (result.json?.ok ? 'ok' : 'error'),
    },
  });
  return res.status(result.httpStatus).json(result.json);
}
