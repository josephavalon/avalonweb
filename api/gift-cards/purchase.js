/**
 * POST /api/gift-cards/purchase
 *
 * Creates a Stripe Checkout session for a gift-card purchase. The flow is:
 *   1. Validate the amount + recipient + sender contact info.
 *   2. Open a Stripe Checkout session (mode='payment') for the gift amount,
 *      tagged metadata.kind='gift_card' so the webhook picks it up.
 *   3. Pre-create the gift_cards row (status='pending') keyed to the new
 *      session id and a freshly-minted unguessable code. The code is NOT
 *      emailed until checkout.session.completed (handled in the webhook by
 *      calling api/_lib/gift-cards.js#fulfillGiftCard).
 *
 * Response: { ok, url, sessionId }.
 *
 * Auth: public. The card is bearer-only (the recipient redeems it once
 * authed at /members/redeem), so anyone can buy a gift for anyone.
 */

import Stripe from 'stripe';
import { isLiveApiEnabled } from '../_lib/pre-api-guard.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { getSupabaseServiceClient } from '../_supabase-server.js';
import { createPendingGiftCard } from '../_lib/gift-cards.js';

// Aligns with the dashboard preset bounds. We don't allow gifts under $25
// (the visit credit is meaningless below that) or above $5,000 (a sanity cap
// so a typo can't dump a 7-figure charge through Stripe). Adjust in one place.
const MIN_GIFT_CENTS = 2500;     // $25
const MAX_GIFT_CENTS = 500000;   // $5,000

function httpError(message, status = 500, code = 'server_error') {
  return Object.assign(new Error(message), { status, code });
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function dollarsToCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  if (isLiveApiEnabled()) {
    throw httpError('Site URL is not configured.', 503, 'public_site_url_missing');
  }
  const proto = req.headers?.['x-forwarded-proto'] || 'http';
  const host = req.headers?.host || '127.0.0.1:5173';
  return `${proto}://${host}`;
}

function isEmailish(value = '') {
  const v = String(value || '').trim();
  // Lightweight check — Stripe and the recipient's MTA will be the real validator.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      amount = 0,                       // dollars
      amountCents: rawAmountCents,      // optional explicit cents
      recipientEmail: rawRecipientEmail = '',
      recipientName: rawRecipientName = '',
      senderEmail: rawSenderEmail = '',
      senderName: rawSenderName = '',
      message: rawMessage = '',
    } = req.body || {};

    const recipientEmail = normalizeEmail(rawRecipientEmail);
    const senderEmail = normalizeEmail(rawSenderEmail);
    const recipientName = String(rawRecipientName || '').trim().slice(0, 120);
    const senderName = String(rawSenderName || '').trim().slice(0, 120);
    // Sender message is the only free-text field that ends up in the email body.
    // Cap at 1000 chars so a runaway paste can't blow the Resend payload.
    const senderMessage = String(rawMessage || '').trim().slice(0, 1000);

    if (!recipientName) {
      return res.status(400).json({ error: 'Recipient name is required.', code: 'recipient_name_required' });
    }
    if (!isEmailish(recipientEmail)) {
      return res.status(400).json({ error: 'A valid recipient email is required.', code: 'recipient_email_invalid' });
    }
    if (!senderName) {
      return res.status(400).json({ error: 'Your name is required.', code: 'sender_name_required' });
    }
    if (!isEmailish(senderEmail)) {
      return res.status(400).json({ error: 'A valid email is required so we can send you a receipt.', code: 'sender_email_invalid' });
    }

    // Accept either `amount` (dollars) or `amountCents`. Prefer cents when both
    // are present so any UI rounding can't shift the charge by a penny.
    const amountCents = Number.isFinite(Number(rawAmountCents))
      ? Math.max(0, Math.round(Number(rawAmountCents)))
      : dollarsToCents(amount);
    if (!amountCents || amountCents < MIN_GIFT_CENTS) {
      return res.status(400).json({ error: 'Minimum gift amount is $25.', code: 'amount_too_small' });
    }
    if (amountCents > MAX_GIFT_CENTS) {
      return res.status(400).json({ error: 'Maximum gift amount is $5,000. Please contact Avalon for larger gifts.', code: 'amount_too_large' });
    }

    if (!isLiveApiEnabled()) {
      // Local dev / preview without live API → simulate so the UI can be QA'd
      // without touching Stripe / Resend. The gift card is NOT actually issued.
      return res.status(200).json({
        ok: true,
        provider: 'local-simulation',
        previewOnly: true,
        url: `${publicBaseUrl(req)}/gift?simulated=1`,
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Secure checkout is not configured.', code: 'payment_provider_missing' });
    }

    const db = await getSupabaseServiceClient();
    if (!db) {
      return res.status(503).json({ error: 'Gift cards are temporarily unavailable.', code: 'gift_card_storage_unavailable' });
    }

    const baseUrl = publicBaseUrl(req);
    const successUrl = `${baseUrl}/gift?purchase=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/gift?purchase=cancelled`;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Stripe Checkout session for the FULL gift amount (no deposit split — this
    // is a one-shot product, not a recurring visit). product_data carries a
    // generic catalog label only — PHI-FREE per docs/PHI_DATA_FLOW.md.
    const sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: senderEmail,
      allow_promotion_codes: false,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'Avalon Vitality Gift Card',
            metadata: { type: 'gift_card' },
          },
        },
      }],
      // metadata.kind='gift_card' is the discriminator the webhook reads to
      // route into api/_lib/gift-cards.js#fulfillGiftCard. The recipient fields
      // double as a back-fill source so a lost gift_cards row can be rebuilt
      // from the session alone (see fulfillGiftCard's back-fill branch).
      metadata: {
        kind: 'gift_card',
        recipientEmail,
        recipientName,
        senderEmail,
        senderName,
        // Snip the message to Stripe's 500-char metadata cap.
        senderMessage: senderMessage.slice(0, 480),
        giftAmountCents: String(amountCents),
      },
      payment_intent_data: {
        receipt_email: senderEmail,
        metadata: {
          kind: 'gift_card',
          recipientEmail,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Pre-create the pending row now so the code is reserved before the
    // recipient gets the email. fulfillGiftCard tolerates a missing row (it
    // back-fills from metadata) — this is the happy path.
    try {
      await createPendingGiftCard(db, {
        stripeSessionId: session.id,
        amountCents,
        currency: 'usd',
        recipientEmail,
        recipientName,
        senderEmail,
        senderName,
        senderMessage,
      });
    } catch (err) {
      // Don't fail the whole purchase just because the pending row couldn't be
      // written — the webhook will back-fill on checkout.session.completed.
      console.warn('[gift-cards/purchase] pending row insert failed', safeLogContext(err, 'gift_card_pending_insert_failed'));
    }

    return res.status(200).json({
      ok: true,
      provider: 'stripe',
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error('[gift-cards/purchase] failed', safeLogContext(err, 'gift_card_purchase_failed'));
    const status = err?.status || 500;
    return res.status(status).json({
      error: err?.message || 'Gift card checkout could not be started.',
      code: safeErrorCode(err, 'gift_card_purchase_failed'),
    });
  }
}
