import Stripe from 'stripe';
import {
  buildReconciliationCase,
  insertReconciliationCaseOnce,
  reconciliationTypeForStripeEvent,
} from '../../_reconciliation.js';
import { requireLiveWebhook } from '../../_lib/pre-api-guard.js';
import { getDefaultTenantId, getSupabaseServiceClient } from '../../_supabase-server.js';
import { sendCustomerPaymentPendingEmail, sendPaymentReceivedEmail } from '../../_booking-email.js';
import { safeStripeMetadata } from '../../_lib/safe-stripe.js';
import {
  grantMembershipCredit,
  redeemMemberCredit,
  InsufficientMemberCreditError,
} from '../../_lib/member-credits.js';
import {
  checkoutPayloadFromRecord,
  checkoutPayloadFromStripeMetadata,
  createSchedulingAppointmentWithFallback,
  createDeferredPlanSubscription,
  claimSchedulingCreation,
  readAcuityAppointmentId,
  isLegacyStripeMetadataPayload,
  syncCheckoutAttioPerson,
} from '../../_checkout-fulfillment.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const STRIPE_WEBHOOK_MAX_BODY_BYTES = Number.parseInt(process.env.STRIPE_WEBHOOK_MAX_BODY_BYTES || String(512 * 1024), 10);
const STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS = Number.parseInt(process.env.STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS || '10000', 10);

function httpError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

function safeErrorCode(err, fallback = 'stripe_webhook_error') {
  const code = err?.code || err?.type || err?.statusCode || err?.status || err?.name || fallback;
  return String(code).replace(/[^a-z0-9_:-]+/gi, '_').slice(0, 80) || fallback;
}

function safeLogContext(err, fallback) {
  return {
    code: safeErrorCode(err, fallback),
    status: err?.statusCode || err?.status || null,
  };
}

function readRawBody(req, maxBytes = STRIPE_WEBHOOK_MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        settled = true;
        reject(httpError('Stripe webhook payload too large', 413, 'webhook_body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function timeoutError(label) {
  return Object.assign(new Error(`${label} timed out`), { code: 'stripe_webhook_timeout' });
}

function withTimeout(promise, label, ms = STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(label)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Canonical record is public.appointments. Resolve by Acuity id, then Stripe session.
async function findAppointmentRecord(db, { acuityId, sessionId, appointmentRecordId }) {
  const columns = 'id, tenant_id, acuity_appointment_id, stripe_checkout_session_id, external_payload';
  if (appointmentRecordId) {
    const { data } = await db.from('appointments')
      .select(columns).eq('id', appointmentRecordId).maybeSingle();
    if (data) return data;
  }
  if (acuityId) {
    const { data } = await db.from('appointments')
      .select(columns).eq('acuity_appointment_id', String(acuityId)).maybeSingle();
    if (data) return data;
  }
  if (sessionId) {
    const { data } = await db.from('appointments')
      .select(columns).eq('stripe_checkout_session_id', sessionId).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function insertReconciliationCase(db, caseRow) {
  await insertReconciliationCaseOnce(db, caseRow);
}

async function insertOperationalFailureCase(db, { caseType, provider = 'avalon', externalReference, tenantId, payload = {} }) {
  if (!db || !caseType) return;
  await insertReconciliationCaseOnce(db, buildReconciliationCase({
    caseType,
    provider,
    externalReference,
    tenantId: tenantId || await getDefaultTenantId(db),
    payload,
  }));
}

async function insertMissingCheckoutRecordCase(db, { session, appointmentRecordId, tenantId }) {
  await insertOperationalFailureCase(db, {
    caseType: 'stripe_succeeded_acuity_failed',
    provider: 'stripe',
    externalReference: session.id,
    tenantId,
    payload: {
      appointmentRecordId: appointmentRecordId || null,
      stripeSessionId: session.id,
      reason: 'checkout_record_missing_or_redacted',
      local_contract: 'stripe_paid_then_acuity_attio_v1',
    },
  });
}

async function pollAcuityAppointmentId(db, recordId, attempts = 5, delayMs = 1000) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const existingId = await readAcuityAppointmentId(db, recordId);
    if (existingId) return existingId;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

function buildExternalPayload(existingPayload = {}, patch = {}) {
  const { discount, comped, ...fulfillmentPatch } = patch || {};
  return {
    ...existingPayload,
    ...(discount ? { discount } : {}),
    ...(comped ? { comped } : {}),
    fulfillment: {
      ...(existingPayload.fulfillment || {}),
      ...fulfillmentPatch,
      updatedAt: new Date().toISOString(),
    },
  };
}

function stripeObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
}

function unixToIso(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function discountCoupon(discount = {}, sessionDiscount = {}) {
  const direct = discount.coupon || sessionDiscount.coupon || null;
  if (direct && typeof direct === 'object') return direct;
  const sourceCoupon = discount.source?.coupon;
  if (sourceCoupon && typeof sourceCoupon === 'object') return sourceCoupon;
  return null;
}

function discountCouponId(discount = {}, sessionDiscount = {}) {
  return stripeObjectId(discount.coupon)
    || stripeObjectId(discount.source?.coupon)
    || stripeObjectId(sessionDiscount.coupon);
}

function discountPromotionCode(discount = {}, sessionDiscount = {}) {
  const direct = discount.promotion_code || sessionDiscount.promotion_code || null;
  return direct && typeof direct === 'object' ? direct : null;
}

function discountPromotionCodeId(discount = {}, sessionDiscount = {}) {
  return stripeObjectId(discount.promotion_code) || stripeObjectId(sessionDiscount.promotion_code);
}

function normalizeCheckoutDiscount({ amount = 0, discount = {}, sessionDiscount = {}, session, index = 0 } = {}) {
  const coupon = discountCoupon(discount, sessionDiscount);
  const promotionCode = discountPromotionCode(discount, sessionDiscount);
  const couponId = coupon?.id || discountCouponId(discount, sessionDiscount);
  const promotionCodeId = promotionCode?.id || discountPromotionCodeId(discount, sessionDiscount);
  const percentOff = coupon?.percent_off == null ? null : Number(coupon.percent_off);
  const amountOffCents = coupon?.amount_off == null ? null : Number(coupon.amount_off);
  const amountDiscountCents = Math.max(0, Math.round(Number(amount || 0)));
  const code = promotionCode?.code || '';
  const redemptionKey = discount.id || promotionCodeId || couponId || code || `discount-${index}`;
  return {
    stripeDiscountId: discount.id || null,
    stripeCouponId: couponId || null,
    stripePromotionCodeId: promotionCodeId || null,
    redemptionKey,
    code,
    couponName: coupon?.name || '',
    discountType: percentOff != null ? 'percent' : amountOffCents != null ? 'amount' : 'unknown',
    percentOff,
    amountOffCents,
    amountDiscountCents,
    currency: (session.currency || coupon?.currency || 'usd').toLowerCase(),
    redeemedAt: unixToIso(discount.start) || (session.created ? unixToIso(session.created) : null) || new Date().toISOString(),
  };
}

function checkoutDiscountEntries(session = {}) {
  const breakdownDiscounts = session.total_details?.breakdown?.discounts;
  if (Array.isArray(breakdownDiscounts) && breakdownDiscounts.length) {
    return breakdownDiscounts.map((entry, index) => normalizeCheckoutDiscount({
      amount: entry.amount,
      discount: entry.discount || {},
      session,
      index,
    }));
  }

  const sessionDiscounts = Array.isArray(session.discounts) ? session.discounts : [];
  const totalDiscount = Number(session.total_details?.amount_discount || 0);
  return sessionDiscounts.map((entry, index) => normalizeCheckoutDiscount({
    amount: index === 0 ? totalDiscount : 0,
    sessionDiscount: entry || {},
    session,
    index,
  }));
}

function isFullCompDiscount(session = {}, discounts = []) {
  const hasFullPercentCoupon = discounts.some((discount) => Number(discount.percentOff || 0) >= 100);
  return hasFullPercentCoupon && Number(session.amount_total || 0) === 0;
}

function discountPayload(discounts = [], { fullComp = false } = {}) {
  if (!discounts.length) return null;
  const primary = discounts[0];
  return {
    code: primary.code || primary.couponName || '',
    couponName: primary.couponName || '',
    stripeCouponId: primary.stripeCouponId || '',
    stripePromotionCodeId: primary.stripePromotionCodeId || '',
    amountDiscountCents: discounts.reduce((sum, discount) => sum + Number(discount.amountDiscountCents || 0), 0),
    currency: primary.currency || 'usd',
    percentOff: primary.percentOff,
    fullComp: !!fullComp,
    appliedAt: primary.redeemedAt || new Date().toISOString(),
  };
}

async function recordDiscountRedemptions(db, {
  session,
  record,
  tenantId,
  paymentIntentId,
  discounts = [],
  fullComp = false,
} = {}) {
  if (!db || !session?.id || !tenantId || !discounts.length) return;
  const rows = discounts.map((discount) => ({
    tenant_id: tenantId,
    appointment_id: record?.id || null,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId || null,
    stripe_customer_id: stripeObjectId(session.customer),
    stripe_discount_id: discount.stripeDiscountId || null,
    stripe_coupon_id: discount.stripeCouponId || null,
    stripe_promotion_code_id: discount.stripePromotionCodeId || null,
    redemption_key: discount.redemptionKey,
    code: discount.code || null,
    coupon_name: discount.couponName || null,
    discount_type: discount.discountType || null,
    percent_off: discount.percentOff,
    amount_off_cents: discount.amountOffCents,
    amount_discount_cents: discount.amountDiscountCents,
    currency: discount.currency || 'usd',
    full_comp: !!fullComp,
    redeemed_at: discount.redeemedAt || new Date().toISOString(),
    external_payload: {
      checkoutAmountSubtotalCents: Number(session.amount_subtotal || 0),
      checkoutAmountTotalCents: Number(session.amount_total || 0),
    },
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db.from('discount_redemptions').upsert(rows, {
    onConflict: 'tenant_id,stripe_checkout_session_id,redemption_key',
  });
  if (error) {
    console.warn('[stripe/webhook] discount redemption upsert failed', safeLogContext(error, 'discount_redemption_upsert_failed'));
  }
}

function checkoutCreditRedemption(checkout = {}, md = {}) {
  const payload = checkout.creditRedemption || {};
  const units = Number(payload.units || checkout.amounts?.creditRedemptionUnits || md.creditRedemptionUnits || 0);
  const amountCents = Number(payload.amountCents || checkout.amounts?.creditRedemptionCents || md.creditRedemptionCents || 0);
  if (!(units > 0) || !(amountCents > 0)) return null;
  return {
    units: Math.max(1, Math.floor(units)),
    amountCents: Math.max(0, Math.round(amountCents)),
    memberProfileId: payload.memberProfileId || null,
  };
}

async function recordMembershipInitialCredit(db, {
  checkout,
  record,
  tenantId,
  session,
  planSubscriptionId = null,
} = {}) {
  if (!db || !checkout?.membership || !tenantId || !session?.id) return;
  try {
    await grantMembershipCredit(db, {
      tenantId,
      profileId: checkout.creditRedemption?.memberProfileId || null,
      email: checkout.contact?.email || '',
      appointmentId: record?.id || null,
      stripeCheckoutSessionId: session.id,
      stripeSubscriptionId: planSubscriptionId || null,
      source: 'membership_initial_grant',
      description: 'Membership IV credit',
      externalPayload: {
        membershipName: checkout.membership?.name || '',
        membershipBilling: checkout.membership?.billing || '',
      },
    });
  } catch (err) {
    console.warn('[stripe/webhook] membership credit grant failed', safeLogContext(err, 'membership_credit_grant_failed'));
  }
}

async function recordIvCreditRedemption(db, {
  checkout,
  record,
  tenantId,
  session,
  md,
} = {}) {
  const credit = checkoutCreditRedemption(checkout, md);
  if (!db || !tenantId || !session?.id || !credit) return;
  try {
    await redeemMemberCredit(db, {
      tenantId,
      profileId: credit.memberProfileId || null,
      email: checkout.contact?.email || '',
      appointmentId: record?.id || null,
      stripeCheckoutSessionId: session.id,
      units: credit.units,
      creditValueCents: credit.amountCents,
      description: 'IV credit redeemed',
      externalPayload: {
        service: checkout.primaryService || '',
      },
    });
  } catch (err) {
    if (err instanceof InsufficientMemberCreditError) {
      // The visit was discounted at checkout but the member's live balance can't
      // cover it (e.g. two near-simultaneous redemptions of the same credit).
      // The ledger is protected (never goes negative); surface the under-charge
      // for ops to collect the balance instead of silently corrupting the ledger.
      console.warn('[stripe/webhook] IV credit redemption insufficient', safeLogContext(err, 'iv_credit_insufficient'));
      await insertOperationalFailureCase(db, {
        caseType: 'credit_redemption_insufficient',
        provider: 'stripe',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentId: record?.id || null,
          memberEmail: checkout.contact?.email || '',
          units: credit.units,
          creditValueCents: credit.amountCents,
        },
      });
      return;
    }
    console.warn('[stripe/webhook] IV credit redemption failed', safeLogContext(err, 'iv_credit_redemption_failed'));
  }
}

async function updateStripeFulfillmentMetadata(stripe, session, patch = {}) {
  const paymentIntentId = typeof session.payment_intent === 'object'
    ? session.payment_intent?.id
    : session.payment_intent || null;
  if (!paymentIntentId) return;

  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: safeStripeMetadata({
        ...(typeof session.payment_intent === 'object' ? session.payment_intent?.metadata || {} : {}),
        ...patch,
      }),
    });
  } catch (err) {
    console.warn('[stripe/webhook] payment intent metadata update failed', safeLogContext(err, 'stripe_metadata_update_failed'));
  }
}

export async function handleCheckoutCompleted(stripe, db, session) {
  const md = session.metadata || {};
  const fulfillablePaymentStatus = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  if (session.payment_status && !fulfillablePaymentStatus) {
    return { action: 'ignored_unpaid_checkout', paymentStatus: session.payment_status };
  }

  const appointmentRecordId = md.appointmentRecordId || null;
  let record = db
    ? await findAppointmentRecord(db, {
        acuityId: md.acuityAppointmentId || null,
        sessionId: session.id,
        appointmentRecordId,
      })
    : null;

  // Pull the saved card off the deposit PaymentIntent so the nurse can charge
  // the balance off-session later.
  let paymentIntent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  let paymentMethodId = null;
  const paymentIntentId = typeof session.payment_intent === 'object'
    ? session.payment_intent?.id
    : session.payment_intent || null;
  if (paymentIntentId) {
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      paymentMethodId = paymentIntent.payment_method || null;
    } catch (e) {
      console.warn('[stripe/webhook] payment_intent retrieve failed', safeLogContext(e, 'stripe_payment_intent_retrieve_failed'));
    }
  }

  const now = new Date().toISOString();
  const tenantId = db ? (record?.tenant_id || await getDefaultTenantId(db)) : null;
  const discounts = checkoutDiscountEntries(session);
  const fullComp = isFullCompDiscount(session, discounts);
  const discountForPayload = discountPayload(discounts, { fullComp });
  let acuityAppointment = (record?.acuity_appointment_id || md.acuityAppointmentId)
    ? { id: record?.acuity_appointment_id || md.acuityAppointmentId, alreadyCreated: true }
    : null;
  let attioPersonId = null;
  let attioSynced = false;
  let fulfillmentError = null;
  const canUseStripeMetadataPayload = !record && isLegacyStripeMetadataPayload(md);
  const checkout = record
    ? checkoutPayloadFromRecord(record)
    : canUseStripeMetadataPayload
      ? checkoutPayloadFromStripeMetadata(md)
      : null;

  if (!checkout) {
    await insertMissingCheckoutRecordCase(db, { session, appointmentRecordId, tenantId });
    return {
      action: 'deposit_paid_checkout_record_missing',
      matched: false,
      persisted: false,
      acuityAppointmentId: null,
      attioSynced: false,
    };
  }

  let schedulingDeferred = false;
  if (!acuityAppointment?.id) {
    const wonSchedulingClaim = await claimSchedulingCreation(db, record?.id);
    if (!wonSchedulingClaim) {
      // Another path (the client return-page, or a concurrent delivery) is
      // already creating this Acuity appointment. Re-read for its id; if it
      // isn't persisted yet, defer — never create a duplicate, and don't
      // overwrite the winner's scheduling fields below.
      const existingId = await pollAcuityAppointmentId(db, record?.id);
      if (existingId) {
        acuityAppointment = { id: existingId, alreadyCreated: true };
      } else {
        schedulingDeferred = true;
      }
    } else {
      try {
        const fulfillmentAmounts = fullComp
          ? {
              ...(checkout.amounts || {}),
              depositAmountCents: 0,
              balanceDueCents: 0,
              discountAmountCents: discountForPayload?.amountDiscountCents || 0,
              discountType: 'full_comp',
            }
          : checkout.amounts || {};
        acuityAppointment = await createSchedulingAppointmentWithFallback({
          appointment: checkout.appointment || {},
          contact: checkout.contact || {},
          items: checkout.items || [],
          membership: checkout.membership || null,
          amounts: fulfillmentAmounts,
          req: null,
        });
        if (!acuityAppointment?.id) {
          throw Object.assign(new Error('Acuity did not return an appointment id.'), { code: 'acuity_missing_appointment_id', status: 502 });
        }
      } catch (err) {
        fulfillmentError = err;
        console.error('[stripe/webhook] Acuity fulfillment failed', safeLogContext(err, 'acuity_fulfillment_failed'));
      }

      if (acuityAppointment?.id && checkout.contact?.email) {
        try {
          const attioResult = await syncCheckoutAttioPerson({
            contact: checkout.contact,
            primaryService: checkout.primaryService || md.service || 'Avalon Visit',
            appointment: checkout.appointment || {},
            items: checkout.items || [],
            membership: checkout.membership || null,
            amounts: fullComp
              ? { ...(checkout.amounts || {}), depositAmountCents: 0, balanceDueCents: 0 }
              : checkout.amounts || {},
          });
          attioPersonId = attioResult?.id || null;
          // attioSynced=true ONLY when the sync actually ran. Skipped calls
          // (BAA-pending kill switch) leave attioSynced=false so reconciliation
          // dashboards don't show a false positive.
          attioSynced = Boolean(attioPersonId) && !attioResult?.skipped;
        } catch (err) {
          console.warn('[stripe/webhook] Attio sync failed', safeLogContext(err, 'attio_sync_failed'));
          await insertOperationalFailureCase(db, {
            caseType: 'crm_sync_failed',
            provider: 'attio',
            externalReference: session.id,
            tenantId,
            payload: {
              appointmentRecordId: record?.id || null,
              stripeSessionId: session.id,
              errorCode: safeErrorCode(err, 'attio_sync_failed'),
              errorStatus: err?.statusCode || err?.status || null,
            },
          });
        }
      }
    }
  }

  if (!record && appointmentRecordId && db) {
    console.warn('[stripe/webhook] appointment record not found:', appointmentRecordId);
  }

  if (acuityAppointment?.id && !acuityAppointment.alreadyCreated) {
    await updateStripeFulfillmentMetadata(stripe, session, {
      acuityAppointmentId: String(acuityAppointment.id),
      fulfillmentStatus: 'acuity_created',
    });
  } else if (fulfillmentError) {
    await updateStripeFulfillmentMetadata(stripe, session, {
      fulfillmentStatus: 'acuity_failed',
      fulfillmentIssue: 'appointment_confirmation_pending',
      fulfillmentError: '',
    });
  }

  if (!schedulingDeferred && paymentIntentId && paymentIntent?.metadata?.opsPaymentEmailSent !== 'true') {
    try {
      // Ops email is PHI-free per docs/PHI_DATA_FLOW.md: only the appointment
      // record ID + a deep link into the admin. All client details are looked
      // up by staff in Supabase, not transmitted via Resend.
      await sendPaymentReceivedEmail({
        appointmentRecordId: record?.id || md.appointmentRecordId || '',
      });
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: safeStripeMetadata({
          ...(paymentIntent?.metadata || {}),
          ...(acuityAppointment?.id ? {
            acuityAppointmentId: String(acuityAppointment.id),
            fulfillmentStatus: 'acuity_created',
          } : fulfillmentError ? {
            fulfillmentStatus: 'acuity_failed',
            fulfillmentIssue: 'appointment_confirmation_pending',
            fulfillmentError: '',
          } : {}),
          opsPaymentEmailSent: 'true',
        }),
      });
    } catch (err) {
      console.warn('[stripe/webhook] payment email failed', safeLogContext(err, 'payment_email_failed'));
      await insertOperationalFailureCase(db, {
        caseType: 'operations_email_failed',
        provider: 'resend',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentRecordId: record?.id || null,
          stripeSessionId: session.id,
          errorCode: safeErrorCode(err, 'payment_email_failed'),
          errorStatus: err?.statusCode || err?.status || null,
        },
      });
    }
  }

  if (fulfillmentError && paymentIntentId && paymentIntent?.metadata?.customerPaymentPendingEmailSent !== 'true') {
    try {
      await sendCustomerPaymentPendingEmail({ checkout });
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: safeStripeMetadata({
          ...(paymentIntent?.metadata || {}),
          customerPaymentPendingEmailSent: 'true',
        }),
      });
    } catch (err) {
      console.warn('[stripe/webhook] customer pending email failed', safeLogContext(err, 'customer_pending_email_failed'));
      await insertOperationalFailureCase(db, {
        caseType: 'customer_email_failed',
        provider: 'resend',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentRecordId: record?.id || null,
          stripeSessionId: session.id,
          errorCode: safeErrorCode(err, 'customer_pending_email_failed'),
          errorStatus: err?.statusCode || err?.status || null,
        },
      });
    }
  }

  // Plan signups: now that the $50 deposit succeeded and the card is saved on
  // the customer, set up the recurring full-price subscription that starts one
  // period after the first visit. Idempotent, so safe on webhook retries.
  let planSubscriptionId = null;
  let planSubscriptionDeferredReason = null;
  if (md.planSignup === 'true' && fullComp) {
    planSubscriptionDeferredReason = 'full_discount_no_payment_method';
  } else if (md.planSignup === 'true' && !paymentMethodId) {
    // A paid (non-comped) deposit should always leave a saved card on the customer.
    // If we got here the card is missing, so the recurring subscription can't be
    // created — and would otherwise be skipped silently, losing recurring revenue
    // with no signal. Flag it so ops can set recurring up by hand.
    planSubscriptionDeferredReason = 'payment_method_missing';
    await insertOperationalFailureCase(db, {
      caseType: 'stripe_subscription_creation_failed',
      provider: 'stripe',
      externalReference: session.id,
      tenantId,
      payload: {
        appointmentRecordId: record?.id || null,
        stripeSessionId: session.id,
        stripeCustomerId: session.customer || null,
        reason: 'payment_method_missing',
        local_contract: 'plan_subscription_after_first_acuity_appointment_v1',
      },
    });
  } else if (md.planSignup === 'true' && acuityAppointment?.id && !fulfillmentError && !schedulingDeferred) {
    try {
      planSubscriptionId = await createDeferredPlanSubscription(stripe, {
        session,
        md,
        paymentMethodId,
        recordId: record?.id,
      });
    } catch (err) {
      console.error('[stripe/webhook] plan subscription creation failed', safeLogContext(err, 'plan_subscription_failed'));
      await insertOperationalFailureCase(db, {
        caseType: 'stripe_subscription_creation_failed',
        provider: 'stripe',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentRecordId: record?.id || null,
          stripeSessionId: session.id,
          stripeCustomerId: session.customer || null,
          errorCode: safeErrorCode(err, 'plan_subscription_failed'),
          errorStatus: err?.statusCode || err?.status || null,
        },
      });
    }
  } else if (md.planSignup === 'true') {
    await insertOperationalFailureCase(db, {
      caseType: 'stripe_subscription_creation_failed',
      provider: 'stripe',
      externalReference: session.id,
      tenantId,
      payload: {
        appointmentRecordId: record?.id || null,
        stripeSessionId: session.id,
        reason: schedulingDeferred ? 'acuity_creation_deferred' : 'acuity_appointment_missing',
        local_contract: 'plan_subscription_after_first_acuity_appointment_v1',
      },
    });
  }

  const recordedVisitSubtotalCents = Number(md.visitSubtotalCents || 0)
    || (md.planSignup === 'true' ? Number(md.planMonthlyPriceCents || 0) : 0)
    || Number(session.amount_subtotal || 0);

  // Authoritative deposit + remaining balance, derived once so payment_status and
  // balance_due_cents can never disagree. Both normally come from server-set
  // checkout metadata; when balanceDueCents is absent (legacy session) we fall
  // back to subtotal − deposit rather than defaulting to 0 — the old `|| 0`
  // default silently marked such visits paid-in-full and suppressed balance
  // collection (lost revenue). For current bookings (balanceDueCents present)
  // this reproduces the previous values exactly.
  const depositPaidCents = fullComp
    ? 0
    : (md.depositAmountCents != null ? Number(md.depositAmountCents) : Number(session.amount_total || 0));
  const balanceDueCents = fullComp
    ? 0
    : (md.balanceDueCents != null
        ? Number(md.balanceDueCents)
        : Math.max(0, recordedVisitSubtotalCents - depositPaidCents));

  const patch = {
    tenant_id:                    tenantId,
    stripe_checkout_session_id:   session.id,
    stripe_customer_id:           session.customer || null,
    stripe_deposit_payment_intent: paymentIntentId,
    stripe_payment_method_id:     paymentMethodId,
    deposit_paid_at:              now,
    payment_status:               balanceDueCents > 0 ? 'partial_payment' : 'paid_in_full',
    status:                       schedulingDeferred ? undefined : acuityAppointment?.id ? 'scheduled' : 'payment_received',
    acuity_appointment_id:         schedulingDeferred ? undefined : acuityAppointment?.id ? String(acuityAppointment.id) : null,
    reconciliation_status:         schedulingDeferred ? undefined : fulfillmentError ? 'action_required' : 'ok',
    scheduling_lock_at:            fulfillmentError ? null : undefined,
    attio_person_id:               attioPersonId || undefined,
    attio_synced_at:               attioSynced ? now : undefined,
    balance_due_cents:            balanceDueCents,
    visit_subtotal_cents:         recordedVisitSubtotalCents || null,
    deposit_amount_cents:         depositPaidCents,
    external_payload:              buildExternalPayload(record?.external_payload || {}, {
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      acuityAppointment,
      attioPersonId,
      ...(planSubscriptionId ? { planSubscriptionId } : {}),
      ...(planSubscriptionDeferredReason ? { planSubscriptionDeferredReason } : {}),
      ...(discountForPayload ? { discount: discountForPayload } : {}),
      ...(checkoutCreditRedemption(checkout, md) ? {
        creditRedemption: {
          units: checkoutCreditRedemption(checkout, md).units,
          amountCents: checkoutCreditRedemption(checkout, md).amountCents,
          redeemedAt: now,
        },
      } : {}),
      ...(fullComp ? {
        comped: {
          source: 'stripe_discount',
          code: discountForPayload?.code || discountForPayload?.couponName || '',
          amountCompedCents: recordedVisitSubtotalCents,
          appliedAt: discountForPayload?.appliedAt || now,
        },
      } : {}),
      error: fulfillmentError ? safeLogContext(fulfillmentError, 'acuity_fulfillment_failed') : null,
    }),
    updated_at:                   now,
  };
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

  if (db && record?.id) {
    await db.from('appointments').update(patch).eq('id', record.id);
    await recordDiscountRedemptions(db, {
      session,
      record,
      tenantId,
      paymentIntentId,
      discounts,
      fullComp,
    });
    await recordMembershipInitialCredit(db, {
      checkout,
      record,
      tenantId,
      session,
      planSubscriptionId,
    });
    await recordIvCreditRedemption(db, {
      checkout,
      record,
      tenantId,
      session,
      md,
    });
    if (fulfillmentError) {
      await insertReconciliationCase(db, buildReconciliationCase({
        caseType: 'stripe_succeeded_acuity_failed',
        provider: 'stripe',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentRecordId: record.id,
          errorCode: safeErrorCode(fulfillmentError, 'acuity_fulfillment_failed'),
          errorStatus: fulfillmentError?.statusCode || fulfillmentError?.status || null,
          local_contract: 'stripe_paid_then_acuity_attio_v1',
        },
      }));
    }
    return {
      action: fulfillmentError ? 'deposit_paid_acuity_failed' : 'deposit_paid_acuity_created',
      matched: true,
      acuityAppointmentId: acuityAppointment?.id || null,
      attioSynced,
    };
  }

  if (!db) {
    return {
      action: fulfillmentError ? 'deposit_paid_acuity_failed_no_db' : 'deposit_paid_acuity_created_no_db',
      matched: false,
      persisted: false,
      acuityAppointmentId: acuityAppointment?.id || null,
      attioSynced,
    };
  }

  // Legacy fallback for older sessions created before the paid-first flow.
  const { data: insertedRecord, error } = await db.from('appointments').insert({
    tenant_id: tenantId,
    acuity_appointment_id: md.acuityAppointmentId || null,
    ...patch,
    created_at: now,
  }).select('id, tenant_id').single();
  if (error) console.warn('[stripe/webhook] appointment insert failed', safeLogContext(error, 'appointment_insert_failed'));
  if (!error && insertedRecord?.id) {
    await recordDiscountRedemptions(db, {
      session,
      record: insertedRecord,
      tenantId: insertedRecord.tenant_id || tenantId,
      paymentIntentId,
      discounts,
      fullComp,
    });
    await recordMembershipInitialCredit(db, {
      checkout,
      record: insertedRecord,
      tenantId: insertedRecord.tenant_id || tenantId,
      session,
      planSubscriptionId,
    });
    await recordIvCreditRedemption(db, {
      checkout,
      record: insertedRecord,
      tenantId: insertedRecord.tenant_id || tenantId,
      session,
      md,
    });
  }
  return { action: 'deposit_paid', matched: false };
}

async function handleBalancePaid(db, paymentIntent) {
  // Balance charges are tagged metadata.kind='balance' by /api/charge-balance.
  const md = paymentIntent.metadata || {};
  if (md.kind !== 'balance') return { action: 'ignored_non_balance_pi' };

  const now = new Date().toISOString();
  const patch = {
    stripe_balance_payment_intent: paymentIntent.id,
    balance_paid_at:               now,
    payment_status:                'paid_in_full',
    updated_at:                    now,
  };
  if (md.acuityAppointmentId) {
    await db.from('appointments').update(patch)
      .eq('acuity_appointment_id', String(md.acuityAppointmentId));
  }
  return { action: 'balance_paid' };
}

async function handleInvoicePaid(stripe, db, invoice) {
  if (!db) return { action: 'membership_credit_skipped_db_not_configured' };
  const subscriptionId = stripeObjectId(invoice.subscription);
  if (!subscriptionId || !invoice.id) return { action: 'ignored_invoice_without_subscription' };
  if (Number(invoice.amount_paid || 0) <= 0) return { action: 'ignored_zero_amount_membership_invoice' };
  if (invoice.billing_reason === 'subscription_create') return { action: 'ignored_membership_subscription_create_invoice' };

  let subscription = typeof invoice.subscription === 'object' ? invoice.subscription : null;
  if (!subscription) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (err) {
      console.warn('[stripe/webhook] subscription retrieve failed for invoice credit', safeLogContext(err, 'stripe_subscription_retrieve_failed'));
      return { action: 'membership_credit_subscription_retrieve_failed' };
    }
  }

  const md = subscription?.metadata || {};
  if (md.kind !== 'plan_recurring') return { action: 'ignored_non_membership_invoice' };
  const appointmentRecordId = md.appointmentRecordId || null;
  const record = appointmentRecordId
    ? await findAppointmentRecord(db, { appointmentRecordId })
    : null;
  if (!record) return { action: 'membership_credit_record_missing' };
  const checkout = checkoutPayloadFromRecord(record);
  const tenantId = record.tenant_id || await getDefaultTenantId(db);
  await grantMembershipCredit(db, {
    tenantId,
    email: checkout?.contact?.email || '',
    appointmentId: record.id,
    stripeCheckoutSessionId: null,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: invoice.id,
    source: 'membership_renewal_grant',
    description: 'Membership renewal IV credit',
    externalPayload: {
      membershipName: checkout?.membership?.name || md.planName || '',
      invoiceBillingReason: invoice.billing_reason || '',
    },
  });
  return { action: 'membership_renewal_credit_granted', matched: true, persisted: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gate = requireLiveWebhook(req, res, {
    provider: 'Stripe',
    secretEnv: 'STRIPE_WEBHOOK_SECRET',
  });
  if (!gate) return null;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event = null;
  let db = null;
  let eventClaimed = false;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    db = await getSupabaseServiceClient();

    // Idempotency: CLAIM the event before running any side effects. Stripe can
    // deliver the same event id concurrently (parallel retries on timeout); the
    // unique (provider, idempotency_key) index makes this insert the atomic
    // claim, so only one delivery fulfills (no double credit / double email).
    //  - insert wins        → we own it, process, then mark 'processed'.
    //  - 'processed' exists  → already done, ack as duplicate.
    //  - 'processing' exists → a sibling is in flight, ack without reprocessing.
    //  - 'failed' exists     → reprocess by re-claiming the row.
    if (db) {
      try {
        const { error: claimErr } = await db.from('integration_events').insert({
          provider: 'stripe',
          event_type: event.type,
          external_event_id: event.id,
          idempotency_key: event.id,
          payload_hash: event.id,
          signature_valid: true,
          status: 'processing',
        });
        if (!claimErr) {
          eventClaimed = true;
        } else if (/duplicate|unique|23505/i.test(claimErr.message || '')) {
          const { data: seenEvent } = await db.from('integration_events')
            .select('status')
            .eq('provider', 'stripe')
            .eq('idempotency_key', event.id)
            .maybeSingle();
          if (seenEvent?.status === 'processing') {
            return res.status(200).json({ received: true, inFlight: true, id: event.id, type: event.type });
          }
          if (seenEvent?.status !== 'failed') {
            console.log('[stripe/webhook] event processed', {
              event: 'stripe_webhook_event_processed',
              id: event.id,
              type: event.type,
              action: 'duplicate_already_processed',
              matched: null,
              persisted: true,
            });
            return res.status(200).json({ received: true, duplicate: true, id: event.id, type: event.type });
          }
          // status 'failed' → re-claim atomically (only if still 'failed').
          const { data: reclaimed, error: reclaimErr } = await db.from('integration_events')
            .update({ status: 'processing', signature_valid: true })
            .eq('provider', 'stripe')
            .eq('idempotency_key', event.id)
            .eq('status', 'failed')
            .select('id');
          if (reclaimErr || !reclaimed?.length) {
            return res.status(200).json({ received: true, inFlight: true, id: event.id, type: event.type });
          }
          eventClaimed = true;
        } else {
          // Non-unique error: fail open and process (best-effort), as before.
          console.warn('[stripe/webhook] idempotency claim skipped', safeLogContext(claimErr, 'idempotency_claim_skipped'));
        }
      } catch (err) {
        console.warn('[stripe/webhook] idempotency claim skipped', safeLogContext(err, 'idempotency_claim_skipped'));
      }
    }

    let result = { action: 'store_for_audit' };
    switch (event.type) {
      case 'checkout.session.completed':
        result = await withTimeout(
          (async () => handleCheckoutCompleted(
            stripe,
            db,
            await withTimeout(stripe.checkout.sessions.retrieve(event.data.object.id, {
              expand: [
                'discounts.coupon',
                'discounts.promotion_code',
                'total_details.breakdown.discounts.discount.coupon',
                'total_details.breakdown.discounts.discount.promotion_code',
              ],
            }), 'stripe checkout session retrieve')
          ))(),
          'stripe checkout fulfillment'
        );
        break;
      case 'payment_intent.succeeded':
        if (!db) {
          result = { action: 'balance_tracking_skipped_db_not_configured' };
          break;
        }
        result = await handleBalancePaid(db, event.data.object);
        break;
      case 'invoice.paid':
        result = await withTimeout(
          handleInvoicePaid(stripe, db, event.data.object),
          'stripe membership invoice credit'
        );
        break;
      case 'checkout.session.expired':
        result = { action: 'release_scheduling_hold' };
        break;
      default:
        result = { action: 'store_for_audit' };
    }

    console.log('[stripe/webhook] event processed', {
      event: 'stripe_webhook_event_processed',
      id: event.id,
      type: event.type,
      action: result?.action || 'unknown',
      matched: result?.matched ?? null,
      persisted: Boolean(db),
    });

    // Mark the claimed event 'processed' so a redelivery short-circuits.
    // Best-effort — never blocks the 200 ack.
    if (db && eventClaimed) {
      try {
        await db.from('integration_events')
          .update({ status: 'processed', processed_at: new Date().toISOString(), event_type: event.type })
          .eq('provider', 'stripe')
          .eq('idempotency_key', event.id);
      } catch (err) {
        console.warn('[stripe/webhook] event idempotency record failed', safeLogContext(err, 'idempotency_record_failed'));
      }
    } else if (db) {
      // Claim was skipped (transient error above) — best-effort upsert.
      try {
        await db.from('integration_events').upsert({
          provider: 'stripe',
          event_type: event.type,
          external_event_id: event.id,
          idempotency_key: event.id,
          payload_hash: event.id,
          signature_valid: true,
          status: 'processed',
          processed_at: new Date().toISOString(),
        }, { onConflict: 'provider,idempotency_key' });
      } catch (err) {
        if (!/duplicate|unique|23505/i.test(err.message || '')) {
          console.warn('[stripe/webhook] event idempotency record failed', safeLogContext(err, 'idempotency_record_failed'));
        }
      }
    }

    return res.status(200).json({
      received: true,
      id: event.id,
      type: event.type,
      persisted: Boolean(db),
      reconciliationCaseType: reconciliationTypeForStripeEvent(event),
      result,
    });
  } catch (err) {
    // Before verification → 400 (Stripe should resend). After → 200 to avoid retry storms.
    if (!event) {
      return res.status(err.status || 400).json({
        error: 'Invalid Stripe webhook',
        code: safeErrorCode(err, 'stripe_webhook_invalid'),
      });
    }
    // Release our claim so a redelivery of this event can reprocess it.
    if (db && eventClaimed) {
      try {
        await db.from('integration_events')
          .update({ status: 'failed', failure_reason: safeErrorCode(err, 'stripe_webhook_processing_failed') })
          .eq('provider', 'stripe')
          .eq('idempotency_key', event.id);
      } catch (_) { /* best-effort */ }
    }
    if (err.code === 'stripe_webhook_timeout') {
      await insertOperationalFailureCase(db, {
        caseType: 'webhook_missed',
        provider: 'stripe',
        externalReference: event.id,
        payload: {
          stripeEventType: event.type,
          errorCode: safeErrorCode(err, 'stripe_webhook_timeout'),
          errorStatus: err?.statusCode || err?.status || null,
        },
      });
      console.warn('[stripe/webhook] event processed', {
        event: 'stripe_webhook_event_processed',
        id: event.id,
        type: event.type,
        action: 'processing_timeout',
        matched: null,
        persisted: Boolean(db),
      });
      return res.status(200).json({
        received: true,
        persisted: Boolean(db),
        timeout: true,
        code: safeErrorCode(err, 'stripe_webhook_timeout'),
      });
    }
    console.error('[stripe/webhook] processing error', safeLogContext(err, 'stripe_webhook_processing_failed'));
    console.warn('[stripe/webhook] event processed', {
      event: 'stripe_webhook_event_processed',
      id: event.id,
      type: event.type,
      action: 'processing_error',
      matched: null,
      persisted: false,
    });
    return res.status(200).json({
      received: true,
      persisted: false,
      code: safeErrorCode(err, 'stripe_webhook_processing_failed'),
    });
  }
}
