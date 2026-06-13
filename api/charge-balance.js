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
import crypto from 'crypto';
import { requireInternalAccess } from './_lib/pre-api-guard.js';
import { collectBalance } from './_lib/balance-core.js';
import { writeAuditEvent } from './_lib/audit-events.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { safeErrorCode, safeLogContext } from './_lib/safe-error.js';

const INTERNAL_CHARGE_LIMIT = {
  windowMs: 60 * 1000,
  max: 15,
};

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

function internalTokenFingerprint(req) {
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  return crypto.createHash('sha256').update(supplied).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Live-flag + internal-secret gate. In pre-API mode this returns the hard wall.
  if (!requireInternalAccess(req, res, 'Charge appointment balance')) return;

  const { acuityAppointmentId, amountCentsOverride } = req.body || {};
  const mode = (req.body?.mode || 'charge') === 'link' ? 'link' : 'charge';
  const overrideRequested = amountCentsOverride !== undefined && amountCentsOverride !== null && amountCentsOverride !== '';

  const db = await getSupabase();
  if (!db) {
    return res.status(503).json({ error: 'Database is not configured', code: 'db_not_configured' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    await writeAuditEvent(db, {
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        actor: 'internal_service',
        reason: 'stripe_not_configured',
        resultCode: 'stripe_not_configured',
        acuityAppointmentId: acuityAppointmentId ? String(acuityAppointmentId) : null,
        mode,
        override: overrideRequested,
      },
    });
    return res.status(503).json({ error: 'Stripe is not configured', code: 'stripe_not_configured' });
  }

  const limit = await checkRateLimit({
    key: `charge-balance:${internalTokenFingerprint(req)}`,
    windowMs: INTERNAL_CHARGE_LIMIT.windowMs,
    max: INTERNAL_CHARGE_LIMIT.max,
  });
  if (!limit.ok) {
    await writeAuditEvent(db, {
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        actor: 'internal_service',
        reason: 'rate_limited',
        resultCode: 'rate_limited',
        mode,
        override: overrideRequested,
      },
    });
    res.setHeader('Retry-After', Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many balance charge attempts. Try again shortly.', code: 'rate_limited' });
  }

  if (!acuityAppointmentId) {
    await writeAuditEvent(db, {
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        actor: 'internal_service',
        reason: 'missing_appointment_lookup',
        resultCode: 'missing_appointment_lookup',
        mode,
        override: overrideRequested,
      },
    });
    return res.status(400).json({ error: 'acuityAppointmentId is required', code: 'missing_appointment_lookup' });
  }

  const { data: appt, error: lookupErr } = await db.from('appointments')
    .select('id, tenant_id, stripe_customer_id, stripe_payment_method_id, balance_due_cents, payment_status, currency')
    .eq('acuity_appointment_id', String(acuityAppointmentId))
    .maybeSingle();

  if (lookupErr) {
    console.warn('[charge-balance] appointment lookup failed', safeLogContext(lookupErr, 'balance_lookup_failed'));
    await writeAuditEvent(db, {
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        actor: 'internal_service',
        reason: 'balance_lookup_failed',
        resultCode: safeErrorCode(lookupErr, 'balance_lookup_failed'),
        acuityAppointmentId: String(acuityAppointmentId),
        mode,
        override: overrideRequested,
      },
    });
    return res.status(500).json({
      error: 'Could not load appointment balance.',
      code: safeErrorCode(lookupErr, 'balance_lookup_failed'),
    });
  }
  if (!appt) {
    await writeAuditEvent(db, {
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      payload: {
        actor: 'internal_service',
        reason: 'appointment_not_found',
        resultCode: 'appointment_not_found',
        acuityAppointmentId: String(acuityAppointmentId),
        mode,
        override: overrideRequested,
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
        resultCode: 'already_paid',
        appointmentId: appt.id,
        balanceDueCents: Number(appt.balance_due_cents || 0),
        mode,
        override: overrideRequested,
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
        resultCode: resolved.code,
        appointmentId: appt.id,
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
      action: 'balance_charge_rejected',
      entityType: 'appointment',
      entityId: appt.id,
      payload: {
        actor: 'internal_service',
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
