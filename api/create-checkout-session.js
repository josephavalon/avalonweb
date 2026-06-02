import Stripe from 'stripe';
import { sanitizeCheckoutItems, sanitizeCheckoutMembership } from './_lib/catalog-pricing.js';
import { isLiveApiEnabled } from './_lib/pre-api-guard.js';
import { getDepositAmountDollars } from '../src/lib/checkoutConfig.js';
import { getSupabaseServiceClient } from './_supabase-server.js';
import {
  buildCheckoutPayload,
  buildPendingAppointmentRecord,
  buildStripeCheckoutMetadata,
} from './_checkout-fulfillment.js';

function dollarsToCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

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

function stripeLineItems(items = [], membership = null, { depositOnly = false, depositAmount = getDepositAmountDollars(process.env) } = {}) {
  const lineItems = depositOnly && items.length
    ? [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: dollarsToCents(depositAmount),
          product_data: {
            name: 'Avalon non-refundable deductible',
            metadata: { type: 'deductible' },
          },
        },
      }]
    : items.map((item) => ({
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
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: dollarsToCents(membership.price),
        recurring: { interval: membership.billing === 'annual' ? 'year' : 'month' },
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

    const depositAmount = getDepositAmountDollars(process.env);
    const line_items = stripeLineItems(items, membership, {
      depositOnly: hasVisitItems,
      depositAmount,
    });

    if (!line_items.length) {
      return res.status(400).json({ error: 'No items to checkout' });
    }

    const sessionMode = mode === 'subscription' || membership ? 'subscription' : 'payment';
    const visitSubtotalCents = dollarsToCents(visitSubtotal);
    const depositCents = dollarsToCents(depositAmount);
    const balanceDueCents = hasVisitItems ? Math.max(0, visitSubtotalCents - depositCents) : 0;
    const primaryService = items[0]?.label || membership?.name || 'Avalon Visit';
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
      const { data: pendingRecord, error: pendingError } = await db.from('appointments')
        .insert(buildPendingAppointmentRecord(checkoutPayload))
        .select('id')
        .single();

      if (pendingError || !pendingRecord?.id) {
        throw httpError(pendingError?.message || 'Could not prepare booking for checkout', 500, 'booking_prepare_failed');
      }

      pendingRecordId = pendingRecord.id;
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
      customer_email: contact.email,
      line_items,
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

    // Deposit (one-time payment): save the card on file so the nurse can charge
    // the remaining balance off-session at the end of the appointment.
    if (sessionMode === 'payment') {
      sessionParams.payment_intent_data = { setup_future_usage: 'off_session' };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

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
    console.error('[create-checkout-session]', err.message, err.body || '');
    return res.status(err.status || 500).json({
      error: err.message || 'Checkout failed',
    });
  }
}
