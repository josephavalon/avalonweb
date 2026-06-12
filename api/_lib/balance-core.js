/**
 * Shared remaining-balance collection logic.
 *
 * Two callers use this:
 *  - /api/charge-balance        (internal-secret gated — nurse trigger, no portal)
 *  - /api/admin/collect-balance (admin-session gated — admin dashboard button)
 *
 * Keeping the Stripe logic in one place means both paths charge identically and
 * stay in sync. Callers do the auth + appointment lookup + amount validation,
 * then hand the resolved appointment row here.
 */

function balanceLinkConfigError(message, code) {
  return { httpStatus: 503, json: { error: message, code } };
}

export function validateBalanceReturnBaseUrl(baseUrl = '') {
  let parsed;
  try {
    parsed = new URL(String(baseUrl || ''));
  } catch {
    return { error: 'PUBLIC_SITE_URL must be configured before creating balance payment links.', code: 'public_site_url_invalid' };
  }
  const localHost = /^(localhost|127\.|0\.0\.0\.0)$/i.test(parsed.hostname) || parsed.hostname.endsWith('.local');
  if (!['https:', 'http:'].includes(parsed.protocol) || (parsed.protocol !== 'https:' && !localHost)) {
    return { error: 'PUBLIC_SITE_URL must be an HTTPS URL before creating balance payment links.', code: 'public_site_url_unsafe' };
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return { baseUrl: parsed.toString().replace(/\/$/, '') };
}

// A Stripe-hosted page the customer completes themselves (no saved card needed).
// Also the SCA / card-error fallback for the off-session charge below.
export function buildBalanceLink({ stripe, appt, amount, currency, baseUrl, metadata }) {
  const base = validateBalanceReturnBaseUrl(baseUrl);
  if (base.error) {
    const err = new Error(base.error);
    err.code = base.code;
    throw err;
  }
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer: appt.stripe_customer_id,
    line_items: [{
      quantity: 1,
      price_data: { currency, unit_amount: amount, product_data: { name: 'Avalon visit — remaining balance' } },
    }],
    payment_intent_data: { metadata },
    success_url: `${base.baseUrl}/booking/confirmation?balance=paid`,
    cancel_url: `${base.baseUrl}/booking/confirmation?balance=pending`,
  });
}

/**
 * Collect (or hand off) the remaining balance. Returns { httpStatus, json }.
 *  - mode 'link'   → always returns a hosted payment link.
 *  - mode 'charge' → off-session charge to the saved card; on SCA/card error,
 *                    falls back to a hosted link with requiresAction:true.
 */
export async function collectBalance({ stripe, db, appt, amount, mode = 'charge', currency = 'usd', baseUrl = '', acuityAppointmentId }) {
  const metadata = { kind: 'balance', acuityAppointmentId: String(acuityAppointmentId ?? appt.id) };

  if (mode === 'link') {
    const base = validateBalanceReturnBaseUrl(baseUrl);
    if (base.error) return balanceLinkConfigError(base.error, base.code);
    try {
      const session = await buildBalanceLink({ stripe, appt, amount, currency, baseUrl: base.baseUrl, metadata });
      return { httpStatus: 200, json: { ok: true, mode: 'link', url: session.url, amount } };
    } catch (linkErr) {
      return { httpStatus: linkErr.code?.startsWith('public_site_url_') ? 503 : 502, json: { error: linkErr.message, code: linkErr.code || 'balance_link_failed' } };
    }
  }

  if (!appt.stripe_payment_method_id) {
    return { httpStatus: 409, json: { error: 'No saved card on file', code: 'no_card_on_file' } };
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: appt.stripe_customer_id,
      payment_method: appt.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata,
    }, {
      idempotencyKey: `balance:${appt.id}:${amount}`,
    });

    const now = new Date().toISOString();
    await db.from('appointments').update({
      stripe_balance_payment_intent: pi.id,
      balance_paid_at: now,
      payment_status: 'paid_in_full',
      updated_at: now,
    }).eq('id', appt.id);

    return { httpStatus: 200, json: { ok: true, status: pi.status, paymentIntentId: pi.id, amount } };
  } catch (err) {
    // SCA / card error → hand the client a Stripe-hosted link to finish.
    if (err.code === 'authentication_required' || err.type === 'StripeCardError') {
      const base = validateBalanceReturnBaseUrl(baseUrl);
      if (base.error) return balanceLinkConfigError(base.error, base.code);
      try {
        const session = await buildBalanceLink({ stripe, appt, amount, currency, baseUrl: base.baseUrl, metadata });
        return { httpStatus: 200, json: { ok: false, requiresAction: true, url: session.url, reason: err.code || 'card_error' } };
      } catch (linkErr) {
        return { httpStatus: linkErr.code?.startsWith('public_site_url_') ? 503 : 502, json: { error: linkErr.message, code: linkErr.code || 'balance_link_failed' } };
      }
    }
    return { httpStatus: err.statusCode || 500, json: { error: err.message } };
  }
}
