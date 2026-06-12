/**
 * POST /api/charge-balance
 *
 * Nurse-triggered (no portal): charges the remaining appointment balance to the
 * card saved on file at deposit time. Off-session. If the card needs SCA
 * authentication, returns a Stripe-hosted link for the client to complete.
 *
 * Auth: behind AVALON_INTERNAL_API_SECRET + AVALON_ENABLE_LIVE_API (via
 * requireInternalAccess). Never callable from the public client bundle.
 *
 * Body: { acuityAppointmentId: string, amountCentsOverride?: number }
 */

import Stripe from 'stripe';
import { requireInternalAccess } from './_lib/pre-api-guard.js';
import { collectBalance } from './_lib/balance-core.js';
import { writeAuditEvent } from './_lib/audit-events.js';

function resolveChargeAmount({ requestedOverride, balanceDue }) {
  const balance = Number(balanceDue || 0);
  const hasOverride = requestedOverride !== undefined && requestedOverride !== null && requestedOverride !== '';
  const amount = hasOverride ? Number(requestedOverride) : balance;
  if (!Number.isFinite(amount)) return { error: 'Invalid charge amount', code: 'invalid_amount', hasOverride };
  if (hasOverride && amount > balance) return { error: 'Charge override exceeds balance due', code: 'override_exceeds_balance', hasOverride, amount, balance };
  return { amount, balance, hasOverride };
}

let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Live-flag + internal-secret gate. In pre-API mode this returns the hard wall.
  if (!requireInternalAccess(req, res, 'Charge appointment balance')) return;

  const { acuityAppointmentId, amountCentsOverride } = req.body || {};
  const mode = (req.body?.mode || 'charge') === 'link' ? 'link' : 'charge';
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const db = await getSupabase();
  if (!db) {
    return res.status(503).json({ error: 'Database is not configured', code: 'db_not_configured' });
  }

  if (!acuityAppointmentId) {
    await writeAuditEvent(db, {
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        actor: 'internal_service',
        reason: 'missing_appointment_lookup',
        mode,
        override: amountCentsOverride !== undefined && amountCentsOverride !== null && amountCentsOverride !== '',
      },
    });
    return res.status(400).json({ error: 'acuityAppointmentId is required', code: 'missing_appointment_lookup' });
  }

  const { data: appt, error: lookupErr } = await db.from('appointments')
    .select('id, tenant_id, stripe_customer_id, stripe_payment_method_id, balance_due_cents, payment_status, currency')
    .eq('acuity_appointment_id', String(acuityAppointmentId))
    .maybeSingle();

  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  if (!appt) {
    await writeAuditEvent(db, {
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        actor: 'internal_service',
        reason: 'appointment_not_found',
        acuityAppointmentId: String(acuityAppointmentId),
        mode,
        override: amountCentsOverride !== undefined && amountCentsOverride !== null && amountCentsOverride !== '',
      },
    });
    return res.status(404).json({ error: 'Appointment not found', code: 'appointment_not_found' });
  }
  if (appt.payment_status === 'paid_in_full') {
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        actor: 'internal_service',
        reason: 'already_paid',
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
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        actor: 'internal_service',
        reason: resolved.code,
        requestedAmountCents: resolved.amount ?? null,
        balanceDueCents: resolved.balance ?? Number(appt.balance_due_cents || 0),
        mode,
        override: Boolean(resolved.hasOverride),
      },
    });
    return res.status(400).json({ error: resolved.error, code: resolved.code });
  }
  const amount = resolved.amount;
  if (!amount || amount < 50) {
    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || null,
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        actor: 'internal_service',
        reason: 'no_balance',
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
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        actor: 'internal_service',
        reason: 'no_customer',
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

  // Shared with /api/admin/collect-balance so both paths charge identically.
  const result = await collectBalance({
    stripe,
    db,
    appt,
    amount,
    mode,
    currency: appt.currency || 'usd',
    baseUrl,
    acuityAppointmentId,
  });
  await writeAuditEvent(db, {
    tenantId: appt.tenant_id || null,
    action: 'balance_charge_attempt',
    entityType: 'appointment',
    entityId: appt.id,
    payload: {
      actor: 'internal_service',
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
