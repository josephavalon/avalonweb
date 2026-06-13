import Stripe from 'stripe';
import { getAppointment } from './_acuity.js';
import { writeAuditEvent } from './_lib/audit-events.js';
import { isLiveApiEnabled, localAppointment } from './_lib/pre-api-guard.js';
import { getAuthedUser } from './_lib/supabase-auth.js';
import { verifyAppointmentSummaryToken } from './_lib/summary-token.js';
import { getSupabaseServiceClient } from './_supabase-server.js';
import {
  checkoutPayloadFromRecord,
  checkoutPayloadFromStripeMetadata,
  isLegacyStripeMetadataPayload,
} from './_checkout-fulfillment.js';

const SUMMARY_COLUMNS = [
  'id',
  'tenant_id',
  'acuity_appointment_id',
  'stripe_checkout_session_id',
  'payment_status',
  'status',
  'starts_at',
  'protocol_key',
  'visit_subtotal_cents',
  'deposit_amount_cents',
  'balance_due_cents',
  'external_payload',
].join(', ');

const SUMMARY_STAFF_ROLES = new Set(['admin', 'nurse']);

async function appointmentRecordForSession(session) {
  const db = await getSupabaseServiceClient();
  if (!db) return null;

  const { data: bySession } = await db.from('appointments')
    .select(SUMMARY_COLUMNS)
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (bySession) return bySession;

  const appointmentRecordId = session.metadata?.appointmentRecordId;
  if (!appointmentRecordId) return null;

  const { data: byRecord } = await db.from('appointments')
    .select(SUMMARY_COLUMNS)
    .eq('id', appointmentRecordId)
    .maybeSingle();
  return byRecord || null;
}

function appointmentFromCheckout({ checkout = {}, record = {}, session = {}, acuityId = '' } = {}) {
  const appointment = checkout.appointment || {};
  const amounts = checkout.amounts || {};
  const firstItem = checkout.items?.[0] || null;
  return {
    id: acuityId || record?.acuity_appointment_id || record?.id || session.id || '',
    type: checkout.primaryService || record?.protocol_key || firstItem?.label || checkout.membership?.name || 'Avalon Vitality Session',
    datetime: record?.starts_at || appointment.acuityDatetime || null,
    duration: 60,
    location: appointment.address || '',
    price: amounts.visitSubtotalCents != null ? Math.round(Number(amounts.visitSubtotalCents || 0) / 100) : null,
    paymentStatus: record?.payment_status || session.payment_status || '',
    status: record?.status || session.status || '',
    balanceDueCents: amounts.balanceDueCents ?? record?.balance_due_cents ?? null,
    depositAmountCents: amounts.depositAmountCents ?? record?.deposit_amount_cents ?? null,
    source: 'avalon_checkout',
  };
}

function appointmentFromAcuity(appointment, fallback = {}) {
  if (!appointment) return fallback;
  return {
    ...fallback,
    id: String(appointment.id || fallback.id || ''),
    type: appointment.type || fallback.type || 'Avalon Vitality Session',
    datetime: appointment.datetime || fallback.datetime || null,
    duration: appointment.duration || fallback.duration || 60,
    location: appointment.location || fallback.location || '',
    price: appointment.price ?? fallback.price ?? null,
    confirmationPage: appointment.confirmationPage || '',
    source: 'acuity',
  };
}

function summaryToken(req) {
  return String(req.headers?.['x-appointment-summary-token'] || '').trim();
}

function attemptedSummaryAuthMode(req, authed) {
  if (authed) return 'supabase';
  if (summaryToken(req)) return 'summary_token';
  if (req.query?.summary_token) return 'summary_token_query';
  return 'none';
}

function checkoutEmail(checkout = {}) {
  return String(checkout.contact?.email || '').trim().toLowerCase();
}

function safeSummaryErrorCode(err, fallback = 'summary_error') {
  const code = err?.code || err?.type || err?.statusCode || err?.status || fallback;
  return String(code).replace(/[^a-z0-9_:-]+/gi, '_').slice(0, 80) || fallback;
}

function summaryAccessMode({ req, authed, session, record, checkout, acuityId }) {
  if (verifyAppointmentSummaryToken(summaryToken(req), {
    sessionId: session.id,
    appointmentRecordId: record?.id || session.metadata?.appointmentRecordId || '',
    appointmentId: acuityId || '',
  })) {
    return 'summary_token';
  }

  if (!authed) return '';
  if (SUMMARY_STAFF_ROLES.has(String(authed.role || '').toLowerCase())) {
    return 'supabase_staff';
  }
  const email = String(authed.email || '').trim().toLowerCase();
  return email && email === checkoutEmail(checkout) ? 'supabase_owner' : '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = String(req.query?.session_id || '').trim();
  const appointmentId = String(req.query?.appointment || req.query?.id || '').trim();

  if (!sessionId && !appointmentId) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    if (!isLiveApiEnabled()) {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(localAppointment(appointmentId || sessionId || 'local-preview'));
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'session_id is required for live appointment summaries' });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    const paymentIntent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
    const record = await appointmentRecordForSession(session);
    const checkout = record
      ? checkoutPayloadFromRecord(record)
      : isLegacyStripeMetadataPayload(session.metadata || {})
        ? checkoutPayloadFromStripeMetadata(session.metadata || {})
        : null;

    const acuityId = record?.acuity_appointment_id
      || session.metadata?.acuityAppointmentId
      || paymentIntent?.metadata?.acuityAppointmentId
      || '';

    const authed = await getAuthedUser(req);
    const accessMode = summaryAccessMode({ req, authed, session, record, checkout: checkout || {}, acuityId });
    const auditDb = await getSupabaseServiceClient();
    if (!accessMode) {
      await writeAuditEvent(auditDb, {
        tenantId: record?.tenant_id || authed?.tenantId || null,
        actorProfileId: authed?.user?.id || null,
        action: 'appointment_summary_denied',
        entityType: 'appointment',
        entityId: record?.id || null,
        phiTouched: false,
        payload: {
          route: 'api/appointment-summary',
          result: 'denied',
          attemptedAuth: attemptedSummaryAuthMode(req, authed),
          reason: 'summary_auth_required',
          hasRecord: Boolean(record),
          hasAcuityId: Boolean(acuityId),
        },
      });
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(401).json({
        error: 'Appointment summary authorization required',
        code: 'summary_auth_required',
      });
    }

    if (!checkout) {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(404).json({
        error: 'Appointment summary is not available',
        code: 'summary_payload_missing',
      });
    }

    let summary = appointmentFromCheckout({ checkout, record, session, acuityId });
    if (acuityId) {
      try {
        summary = appointmentFromAcuity(await getAppointment(acuityId), summary);
      } catch (err) {
        console.warn('[appointment-summary] acuity summary unavailable', {
          code: safeSummaryErrorCode(err, 'acuity_summary_unavailable'),
        });
      }
    }

    await writeAuditEvent(auditDb, {
      tenantId: record?.tenant_id || authed?.tenantId || null,
      actorProfileId: authed?.user?.id || null,
      action: 'appointment_summary_read',
      entityType: 'appointment',
      entityId: record?.id || null,
      phiTouched: true,
      payload: {
        route: 'api/appointment-summary',
        result: 'allowed',
        authMode: accessMode,
        source: summary.source,
        hasRecord: Boolean(record),
        hasAcuityId: Boolean(acuityId),
      },
    });

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(summary);
  } catch (err) {
    console.error('[appointment-summary] summary failed', {
      code: safeSummaryErrorCode(err, 'summary_failed'),
    });
    return res.status(err.statusCode || err.status || 500).json({
      error: err.statusCode === 404 ? 'Appointment summary not found' : 'Could not load appointment summary',
    });
  }
}
