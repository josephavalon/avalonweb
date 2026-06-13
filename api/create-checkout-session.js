import Stripe from 'stripe';
import crypto from 'crypto';
import { sanitizeCheckoutItems, sanitizeCheckoutMembership } from './_lib/catalog-pricing.js';
import { isLiveApiEnabled } from './_lib/pre-api-guard.js';
import { safeErrorCode, safeLogContext } from './_lib/safe-error.js';
import { resolveAppointmentTypeId, resolveAppointmentTypeIdFromLive } from './_acuity.js';
import { getDefaultTenantId, getSupabaseServiceClient } from './_supabase-server.js';
import {
  buildCheckoutPayload,
  buildPendingAppointmentRecord,
  buildStripeCheckoutMetadata,
} from './_checkout-fulfillment.js';
import {
  ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS,
  calculateLaunchPayment,
} from '../src/lib/paymentRules.js';
import {
  hasValidCheckoutContact,
  isAdultCheckoutDob,
  normalizeCheckoutEmail,
} from '../src/lib/checkoutValidation.js';

function dollarsToCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

const BOOKING_DEPOSIT_CENTS = dollarsToCents(process.env.BOOKING_DEPOSIT_DOLLARS || ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS);

const CHECKOUT_INPUT_LIMITS = {
  name: 80,
  email: 254,
  phone: 40,
  dob: 20,
  emergencyContact: 160,
  localBookingId: 80,
  reference: 80,
  acuityDatetime: 40,
  acuityTimezone: 64,
  acuityTypeId: 32,
  timeLabel: 80,
  address: 240,
  zip: 16,
  locationType: 80,
  orderType: 80,
  paymentType: 80,
  visitType: 80,
  clientType: 80,
  notes: 1000,
  booleanFlag: 16,
};

function httpError(message, status = 500, code = 'server_error') {
  return Object.assign(new Error(message), { status, code });
}

async function resolveCheckoutSchedulingTypeId({ appointment = {}, items = [], membership = null } = {}) {
  const explicitId = Number(appointment.acuityTypeId);
  if (explicitId) return explicitId;

  const envId = resolveAppointmentTypeId(items, membership);
  if (envId) return envId;

  const liveId = await resolveAppointmentTypeIdFromLive(items, membership);
  if (liveId) return liveId;

  throw httpError('Scheduling is not configured for this treatment. Please contact Avalon to book.', 400, 'appointment_type_unavailable');
}

function boundedString(value, max) {
  const raw = String(value ?? '').trim();
  if (raw.length > max) {
    return { value: raw.slice(0, max), tooLong: true };
  }
  return { value: raw, tooLong: false };
}

function boundedField(source, key, max, errors, targetKey = key) {
  const { value, tooLong } = boundedString(source?.[key], max);
  if (tooLong) errors.push(targetKey);
  return value;
}

function sanitizeCheckoutInputFields({ contact = {}, appointment = {} } = {}) {
  const tooLong = [];
  const safeContact = {
    ...contact,
    name: boundedField(contact, 'name', CHECKOUT_INPUT_LIMITS.name, tooLong, 'contact.name'),
    firstName: boundedField(contact, 'firstName', CHECKOUT_INPUT_LIMITS.name, tooLong, 'contact.firstName'),
    lastName: boundedField(contact, 'lastName', CHECKOUT_INPUT_LIMITS.name, tooLong, 'contact.lastName'),
    email: boundedField(contact, 'email', CHECKOUT_INPUT_LIMITS.email, tooLong, 'contact.email'),
    phone: boundedField(contact, 'phone', CHECKOUT_INPUT_LIMITS.phone, tooLong, 'contact.phone'),
    dob: boundedField(contact, 'dob', CHECKOUT_INPUT_LIMITS.dob, tooLong, 'contact.dob'),
    emergencyContact: boundedField(contact, 'emergencyContact', CHECKOUT_INPUT_LIMITS.emergencyContact, tooLong, 'contact.emergencyContact'),
    clientType: boundedField(contact, 'clientType', CHECKOUT_INPUT_LIMITS.clientType, tooLong, 'contact.clientType'),
  };
  const safeAppointment = {
    ...appointment,
    localBookingId: boundedField(appointment, 'localBookingId', CHECKOUT_INPUT_LIMITS.localBookingId, tooLong, 'appointment.localBookingId'),
    reference: boundedField(appointment, 'reference', CHECKOUT_INPUT_LIMITS.reference, tooLong, 'appointment.reference'),
    acuityDatetime: boundedField(appointment, 'acuityDatetime', CHECKOUT_INPUT_LIMITS.acuityDatetime, tooLong, 'appointment.acuityDatetime'),
    acuityTimezone: boundedField(appointment, 'acuityTimezone', CHECKOUT_INPUT_LIMITS.acuityTimezone, tooLong, 'appointment.acuityTimezone'),
    acuityTypeId: boundedField(appointment, 'acuityTypeId', CHECKOUT_INPUT_LIMITS.acuityTypeId, tooLong, 'appointment.acuityTypeId'),
    timeLabel: boundedField(appointment, 'timeLabel', CHECKOUT_INPUT_LIMITS.timeLabel, tooLong, 'appointment.timeLabel'),
    address: boundedField(appointment, 'address', CHECKOUT_INPUT_LIMITS.address, tooLong, 'appointment.address'),
    zip: boundedField(appointment, 'zip', CHECKOUT_INPUT_LIMITS.zip, tooLong, 'appointment.zip'),
    locationType: boundedField(appointment, 'locationType', CHECKOUT_INPUT_LIMITS.locationType, tooLong, 'appointment.locationType'),
    orderType: boundedField(appointment, 'orderType', CHECKOUT_INPUT_LIMITS.orderType, tooLong, 'appointment.orderType'),
    paymentType: boundedField(appointment, 'paymentType', CHECKOUT_INPUT_LIMITS.paymentType, tooLong, 'appointment.paymentType'),
    visitType: boundedField(appointment, 'visitType', CHECKOUT_INPUT_LIMITS.visitType, tooLong, 'appointment.visitType'),
    clientType: boundedField(appointment, 'clientType', CHECKOUT_INPUT_LIMITS.clientType, tooLong, 'appointment.clientType'),
    notes: boundedField(appointment, 'notes', CHECKOUT_INPUT_LIMITS.notes, tooLong, 'appointment.notes'),
    dob: boundedField(appointment, 'dob', CHECKOUT_INPUT_LIMITS.dob, tooLong, 'appointment.dob'),
    emergencyContact: boundedField(appointment, 'emergencyContact', CHECKOUT_INPUT_LIMITS.emergencyContact, tooLong, 'appointment.emergencyContact'),
    clinicalReviewOnFile: boundedField(appointment, 'clinicalReviewOnFile', CHECKOUT_INPUT_LIMITS.booleanFlag, tooLong, 'appointment.clinicalReviewOnFile'),
    gfeRequired: boundedField(appointment, 'gfeRequired', CHECKOUT_INPUT_LIMITS.booleanFlag, tooLong, 'appointment.gfeRequired'),
  };
  return { contact: safeContact, appointment: safeAppointment, tooLong };
}

function assertSafeLiveBaseUrl(baseUrl) {
  if (!isLiveApiEnabled()) return;
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw httpError('PUBLIC_SITE_URL must be a valid absolute URL', 503, 'public_site_url_invalid');
  }
  if (/^(localhost|127\.|0\.0\.0\.0)$/i.test(parsed.hostname) || parsed.hostname.endsWith('.local')) {
    throw httpError('PUBLIC_SITE_URL cannot be localhost in live API mode', 503, 'public_site_url_unsafe');
  }
}

function publicBaseUrl(req) {
  const configured = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) {
    assertSafeLiveBaseUrl(configured);
    return configured;
  }
  if (isLiveApiEnabled()) {
    throw httpError('PUBLIC_SITE_URL is required before live checkout', 503, 'public_site_url_missing');
  }
  const proto = req.headers?.['x-forwarded-proto'] || 'http';
  const host = req.headers?.host || '127.0.0.1:5173';
  return `${proto}://${host}`;
}

function stripeLineItems(items = [], membership = null, checkoutChargeItems = null) {
  const sourceItems = Array.isArray(checkoutChargeItems) ? checkoutChargeItems : items;
  const lineItems = membership ? [] : sourceItems.map((item) => ({
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: dollarsToCents(item.price),
      product_data: {
        name: item.label || 'Avalon Visit',
        metadata: { type: item.type || 'service', key: item.key || item.cartKey || '' },
      },
    },
  }));

  if (membership) {
    const recurring = membership.billing === 'annual'
      ? { interval: 'year' }
      : membership.billing === 'six-month'
        ? { interval: 'month', interval_count: 6 }
        : membership.billing === 'three-month'
          ? { interval: 'month', interval_count: 3 }
          : { interval: 'month' };
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: dollarsToCents(membership.price),
        recurring,
        product_data: {
          name: `${membership.name} Subscription`,
          metadata: { type: 'subscription' },
        },
      },
    });
  }

  return lineItems;
}

function checkoutExpiresAt() {
  const rawMinutes = Number.parseInt(process.env.STRIPE_CHECKOUT_EXPIRES_MINUTES || '30', 10);
  const minutes = Number.isFinite(rawMinutes)
    ? Math.min(24 * 60, Math.max(30, rawMinutes))
    : 30;
  return Math.floor(Date.now() / 1000) + minutes * 60;
}

function checkoutIdempotencyKey({ mode, contact = {}, appointment = {}, items = [], membership = null } = {}) {
  const fingerprint = {
    mode,
    email: String(contact.email || '').trim().toLowerCase(),
    phone: String(contact.phone || '').replace(/\D/g, ''),
    appointment: {
      localBookingId: appointment.localBookingId || '',
      reference: appointment.reference || '',
      acuityDatetime: appointment.acuityDatetime || '',
      address: appointment.address || '',
    },
    items: items.map((item) => ({
      key: item.cartKey || item.key || '',
      label: item.label || '',
      type: item.type || '',
      price: Number(item.price || 0),
    })),
    membership: membership ? {
      name: membership.name || '',
      billing: membership.billing || 'monthly',
      price: Number(membership.price || 0),
    } : null,
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex').slice(0, 32);
  return `checkout:${hash}`;
}

const CUSTOMER_SAFE_CHECKOUT_ERROR_CODES = new Set([
  'appointment_type_unavailable',
]);

function publicCheckoutError(err = {}) {
  if (CUSTOMER_SAFE_CHECKOUT_ERROR_CODES.has(err.code)) {
    return err.message || 'Checkout could not be started.';
  }
  if (err.code === 'payment_provider_missing') return 'Secure checkout is not configured.';
  if (err.code === 'public_site_url_missing' || err.code === 'public_site_url_invalid' || err.code === 'public_site_url_unsafe') {
    return 'Checkout is not configured for this domain.';
  }
  return 'Checkout could not be started. Please try again or contact Avalon.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    mode = 'payment',
    items: rawItems = [],
    membership: rawMembership = null,
    contact: rawContact = {},
    appointment: rawAppointment = {},
    paymentMethod = 'card',
    checkoutUiMode = 'hosted',
  } = req.body || {};

  const {
    contact,
    appointment,
    tooLong: checkoutFieldsTooLong,
  } = sanitizeCheckoutInputFields({ contact: rawContact, appointment: rawAppointment });
  if (checkoutFieldsTooLong.length) {
    return res.status(400).json({
      error: 'Checkout fields are too long.',
      code: 'checkout_input_too_long',
      fields: checkoutFieldsTooLong.slice(0, 12),
    });
  }

  if (!hasValidCheckoutContact(contact)) {
    return res.status(400).json({
      error: 'Valid first name, email, and phone are required',
      code: 'contact_invalid',
    });
  }
  contact.email = normalizeCheckoutEmail(contact.email);

  let pendingRecordId = null;
  try {
    const items = sanitizeCheckoutItems(rawItems);
    const membership = sanitizeCheckoutMembership(rawMembership);

    if (!items.length && !membership) {
      return res.status(400).json({ error: 'No items to checkout' });
    }

    const baseUrl = publicBaseUrl(req);

    if (!isLiveApiEnabled()) {
      const localId = `local-${Date.now()}`;
      const successUrl = `${baseUrl}/booking/confirmation?appointment=${encodeURIComponent(localId)}&preapi=1`;
      return res.status(200).json({
        ok: true,
        provider: 'local-simulation',
        previewOnly: true,
        preApiHardWall: true,
        code: 'pre_api_hard_wall',
        appointment: {
          id: localId,
          provider: 'local-simulation',
          type: items[0]?.label || membership?.name || 'Avalon local simulation',
          datetime: appointment.acuityDatetime || null,
          preApi: true,
        },
        url: successUrl,
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        error: 'Secure checkout is not configured',
        code: 'payment_provider_missing',
      });
    }

    const visitSubtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const hasVisitItems = items.length > 0;
    if (hasVisitItems && !appointment.acuityDatetime) {
      return res.status(400).json({
        error: 'Appointment time is required before checkout',
        code: 'appointment_time_missing',
      });
    }
    if (hasVisitItems && !isAdultCheckoutDob(appointment.dob || contact.dob || '')) {
      return res.status(400).json({
        error: 'Valid adult birthdate is required before checkout',
        code: 'dob_invalid',
      });
    }
    if (hasVisitItems) {
      try {
        const appointmentTypeId = await resolveCheckoutSchedulingTypeId({ appointment, items, membership });
        appointment.acuityTypeId = String(appointmentTypeId);
      } catch (err) {
        console.warn('[create-checkout-session] scheduling type unavailable', safeLogContext(err, 'appointment_type_unavailable'));
        const publicMessage = 'Scheduling is not configured for this treatment. Please contact Avalon to book.';
        return res.status(err?.status || 503).json({
          error: publicMessage,
          code: err?.code || 'appointment_type_unavailable',
        });
      }
    }

    const sessionMode = mode === 'subscription' || membership ? 'subscription' : 'payment';
    const visitSubtotalCents = dollarsToCents(visitSubtotal);
    const primaryService = items[0]?.label || membership?.name || 'Avalon Visit';
    const appointmentOrderType = appointment.orderType || appointment.paymentType || '';
    const guestCount = Number(appointment.guests || 1);
    const isGroupVisit = /event/i.test(`${appointmentOrderType} ${appointment.locationType || ''}`) || guestCount > 1;
    const launchPayment = calculateLaunchPayment({
      subtotal: visitSubtotal,
      visitType: membership ? 'subscription' : appointment.visitType || '',
      orderType: membership ? 'subscription' : appointmentOrderType,
      subscriptionPrice: membership?.price || 0,
      isGroupVisit,
      hasKnownPrice: visitSubtotal > 0,
    });
    const fallbackDepositCents = hasVisitItems ? Math.min(BOOKING_DEPOSIT_CENTS, visitSubtotalCents) : 0;
    const depositCents = membership
      ? dollarsToCents(membership.price)
      : hasVisitItems
        ? dollarsToCents((launchPayment.depositAmount ?? (fallbackDepositCents / 100)))
        : 0;
    const balanceDueCents = membership ? 0 : Math.max(0, visitSubtotalCents - depositCents);
    const normalizedAppointment = {
      ...appointment,
      orderType: membership ? 'subscription' : (isGroupVisit ? 'event' : appointment.orderType || 'single'),
      paymentType: membership ? 'subscription_first_month' : launchPayment.paymentType,
      depositAmount: depositCents / 100,
      balanceDue: balanceDueCents / 100,
    };
    const checkoutChargeItems = membership ? [] : [{
      key: 'booking-deposit',
      cartKey: 'booking-deposit',
      label: `${primaryService} booking deposit`,
      price: depositCents / 100,
      type: 'deposit',
    }];
    const line_items = stripeLineItems(items, membership, checkoutChargeItems);

    if (!line_items.length) {
      return res.status(400).json({ error: 'No items to checkout' });
    }

    const checkoutPayload = buildCheckoutPayload({
      contact,
      appointment: normalizedAppointment,
      items,
      membership,
      paymentMethod,
      primaryService,
      visitSubtotalCents,
      depositCents,
      balanceDueCents,
    });

    const db = await getSupabaseServiceClient();
    if (db) {
      const tenantId = await getDefaultTenantId(db);
      const { data: pendingRecord, error: pendingError } = await db.from('appointments')
        .insert({
          ...buildPendingAppointmentRecord(checkoutPayload),
          tenant_id: tenantId,
        })
        .select('id')
        .single();

      if (pendingError || !pendingRecord?.id) {
        console.warn(
          '[create-checkout-session] Supabase appointment record unavailable; refusing live checkout without a safe fulfillment record:',
          pendingError?.message || 'missing appointment id'
        );
        throw httpError('Booking storage is unavailable. Please try again shortly.', 503, 'appointment_record_unavailable');
      } else {
        pendingRecordId = pendingRecord.id;
      }
    } else {
      console.warn('[create-checkout-session] Supabase is not configured; refusing live checkout without a safe fulfillment record.');
      throw httpError('Booking storage is unavailable. Please try again shortly.', 503, 'appointment_record_unavailable');
    }

    const embeddedCheckout = checkoutUiMode === 'embedded';
    const successUrl = `${baseUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&payment=success`;
    const cancelUrl = `${baseUrl}/checkout?payment=cancelled`;
    const returnUrl = `${baseUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&payment=success`;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const idempotencyKey = checkoutIdempotencyKey({
      mode: sessionMode,
      contact,
      appointment: normalizedAppointment,
      items,
      membership,
    });

    const sessionParams = {
      mode: sessionMode,
      // Card only. This surfaces the Apple Pay + Google Pay express buttons
      // (once the Apple Pay domain is verified and the wallets are enabled in
      // the Stripe Dashboard) and DISABLES Stripe Link. Without this, Checkout
      // falls back to the dashboard's automatic methods, and because we pass
      // customer_email below, Link auto-prompts a "Confirm it's you" OTP that
      // hijacks the payment UI before any wallet renders.
      // TODO: add 'amazon_pay' here once it is activated in the Stripe Dashboard.
      payment_method_types: ['card'],
      customer_email: contact.email,
      line_items,
      allow_promotion_codes: true,
      expires_at: checkoutExpiresAt(),
      metadata: buildStripeCheckoutMetadata({
        appointmentRecordId: pendingRecordId,
        contact,
        appointment: normalizedAppointment,
        items,
        membership,
        paymentMethod,
        primaryService,
        visitSubtotalCents,
        depositCents,
        balanceDueCents,
      }),
    };

    if (embeddedCheckout) {
      sessionParams.ui_mode = 'embedded';
      sessionParams.return_url = returnUrl;
      sessionParams.redirect_on_completion = 'if_required';
    } else {
      sessionParams.success_url = successUrl;
      sessionParams.cancel_url = cancelUrl;
    }

    if (sessionMode === 'payment') {
      sessionParams.payment_intent_data = {
        receipt_email: contact.email,
        // When a balance is owed after the $50 deposit, save the card off-session
        // so a nurse/admin can collect the remainder after the appointment
        // (api/charge-balance.js). Stripe requires a customer for off-session reuse.
        ...(Number(balanceDueCents) > 0
          ? { setup_future_usage: 'off_session' }
          : {}),
      };
      if (Number(balanceDueCents) > 0) {
        sessionParams.customer_creation = 'always';
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey,
    });

    const sessionAppointmentRecordId = String(session.metadata?.appointmentRecordId || '').trim();
    const canonicalAppointmentRecordId = sessionAppointmentRecordId || pendingRecordId;
    if (db && pendingRecordId) {
      if (sessionAppointmentRecordId && sessionAppointmentRecordId !== pendingRecordId) {
        const now = new Date().toISOString();
        const { error: canonicalLinkError } = await db.from('appointments')
          .update({
            stripe_checkout_session_id: session.id,
            updated_at: now,
          })
          .eq('id', sessionAppointmentRecordId);
        if (canonicalLinkError) {
          console.warn('[create-checkout-session] could not link canonical Stripe session', safeLogContext(canonicalLinkError, 'checkout_session_link_failed'));
        }

        const { error: duplicateMarkError } = await db.from('appointments')
          .update({
            status: 'checkout_reused',
            payment_status: 'checkout_reused',
            reconciliation_status: 'ok',
            external_payload: {
              provider: 'avalon_checkout_duplicate',
              canonicalAppointmentRecordId: sessionAppointmentRecordId,
              stripeCheckoutSessionId: session.id,
              checkoutIdempotencyKey: idempotencyKey,
            },
            updated_at: now,
          })
          .eq('id', pendingRecordId);
        if (duplicateMarkError) {
          console.warn('[create-checkout-session] could not mark duplicate checkout record', safeLogContext(duplicateMarkError, 'checkout_duplicate_mark_failed'));
        }
      } else {
        const { error: sessionLinkError } = await db.from('appointments')
          .update({
            stripe_checkout_session_id: session.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingRecordId);

        if (sessionLinkError) {
          console.warn('[create-checkout-session] could not link Stripe session', safeLogContext(sessionLinkError, 'checkout_session_link_failed'));
        }
      }
    }

    return res.status(200).json({
      ok: true,
      provider: 'stripe',
      appointment: { id: canonicalAppointmentRecordId || session.id, provider: canonicalAppointmentRecordId ? 'avalon_checkout' : 'stripe_metadata', status: 'payment_pending' },
      balanceDueCents,
      checkoutUiMode: embeddedCheckout ? 'embedded' : 'hosted',
      sessionId: session.id,
      clientSecret: embeddedCheckout ? session.client_secret : null,
      url: session.url,
    });
  } catch (err) {
    if (pendingRecordId) {
      try {
        const db = await getSupabaseServiceClient();
        await db?.from('appointments').update({
          status: 'checkout_failed',
          payment_status: 'checkout_failed',
          reconciliation_status: 'action_required',
          updated_at: new Date().toISOString(),
        }).eq('id', pendingRecordId);
      } catch (rollbackErr) {
        console.error('[create-checkout-session:rollback]', safeLogContext(rollbackErr, 'checkout_rollback_failed'));
      }
    }
    console.error('[create-checkout-session] checkout failed', safeLogContext(err, 'checkout_session_create_failed'));
    return res.status(err.status || 500).json({
      error: publicCheckoutError(err),
      code: safeErrorCode(err, 'checkout_session_create_failed'),
    });
  }
}
