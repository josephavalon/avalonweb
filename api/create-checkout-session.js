import Stripe from 'stripe';
import crypto from 'crypto';
import { sanitizeCheckoutItems, sanitizeCheckoutMembership } from './_lib/catalog-pricing.js';
import { isLiveApiEnabled } from './_lib/pre-api-guard.js';
import { getDefaultTenantId, getSupabaseServiceClient } from './_supabase-server.js';
import {
  buildCheckoutPayload,
  buildPendingAppointmentRecord,
  buildStripeCheckoutMetadata,
} from './_checkout-fulfillment.js';

function dollarsToCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

const BOOKING_DEPOSIT_CENTS = dollarsToCents(process.env.BOOKING_DEPOSIT_DOLLARS || 50);

function httpError(message, status = 500, code = 'server_error') {
  return Object.assign(new Error(message), { status, code });
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

function publicCheckoutError(err = {}) {
  if (err.status && err.status < 500) return err.message || 'Checkout could not be started.';
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
    contact = {},
    appointment = {},
    paymentMethod = 'card',
    checkoutUiMode = 'hosted',
  } = req.body || {};

  if (!contact.firstName || !contact.email) {
    return res.status(400).json({ error: 'First name and email are required' });
  }

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

    const sessionMode = mode === 'subscription' || membership ? 'subscription' : 'payment';
    const visitSubtotalCents = dollarsToCents(visitSubtotal);
    const primaryService = items[0]?.label || membership?.name || 'Avalon Visit';
    const requestedDepositCents = dollarsToCents(appointment.depositAmount || 0);
    const depositCents = membership
      ? dollarsToCents(membership.price)
      : hasVisitItems
        ? Math.min(requestedDepositCents || BOOKING_DEPOSIT_CENTS, visitSubtotalCents)
        : 0;
    const balanceDueCents = membership ? 0 : Math.max(0, visitSubtotalCents - depositCents);
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
      appointment,
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
          '[create-checkout-session] Supabase appointment record unavailable; continuing with Stripe metadata fulfillment:',
          pendingError?.message || 'missing appointment id'
        );
      } else {
        pendingRecordId = pendingRecord.id;
      }
    } else {
      console.warn('[create-checkout-session] Supabase is not configured; using Stripe metadata fulfillment fallback.');
    }

    const embeddedCheckout = checkoutUiMode === 'embedded';
    const successUrl = `${baseUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&payment=success`;
    const cancelUrl = `${baseUrl}/checkout?payment=cancelled`;
    const returnUrl = `${baseUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&payment=success`;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
        appointment,
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
      idempotencyKey: checkoutIdempotencyKey({
        mode: sessionMode,
        contact,
        appointment,
        items,
        membership,
      }),
    });

    if (db && pendingRecordId) {
      const { error: sessionLinkError } = await db.from('appointments')
        .update({
          stripe_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingRecordId);

      if (sessionLinkError) {
        console.warn('[create-checkout-session] could not link Stripe session:', sessionLinkError.message);
      }
    }

    return res.status(200).json({
      ok: true,
      provider: 'stripe',
      appointment: { id: pendingRecordId || session.id, provider: pendingRecordId ? 'avalon_checkout' : 'stripe_metadata', status: 'payment_pending' },
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
        console.error('[create-checkout-session:rollback]', rollbackErr.message || rollbackErr);
      }
    }
    console.error('[create-checkout-session]', err.message || 'Checkout failed');
    return res.status(err.status || 500).json({
      error: publicCheckoutError(err),
    });
  }
}
