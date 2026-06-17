#!/usr/bin/env node
/**
 * TEST-mode Acuity fulfillment smoke.
 *
 * Required env:
 *   STRIPE_SECRET_KEY=sk_test_...
 *   ACUITY_VERIFY=1
 *   ACUITY_USER_ID
 *   ACUITY_API_KEY
 *   ACUITY_TYPE_HYDRATION and ACUITY_TYPE_MEMBERSHIP, or ACUITY_DEFAULT_TYPE_ID
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * This intentionally does not accept live Stripe keys. It creates real Acuity
 * test appointments through the same Stripe checkout-completed fulfillment
 * handler used in production and cleans up appointments it can find for the
 * generated test emails.
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  cancelAppointment,
  getAppointments,
} from '../api/_acuity.js';
import {
  buildPendingAppointmentRecord,
  buildStripeCheckoutMetadata,
  claimSchedulingCreation,
} from '../api/_checkout-fulfillment.js';
import { handleCheckoutCompleted } from '../api/integrations/stripe/webhook.js';
import {
  fulfillPaidCheckoutIfNeeded,
  persistVerifyFulfillment,
} from '../api/checkout/verify.js';

const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!stripeKey.startsWith('sk_test_')) fail('Set STRIPE_SECRET_KEY to a Stripe TEST key (sk_test_...).');
if (process.env.ACUITY_VERIFY !== '1') fail('Set ACUITY_VERIFY=1 to confirm live Acuity test appointment creation.');
if (!process.env.ACUITY_USER_ID || !process.env.ACUITY_API_KEY) fail('Set ACUITY_USER_ID and ACUITY_API_KEY.');
if (!supabaseUrl || !serviceKey) fail('Set Supabase URL and SUPABASE_SERVICE_ROLE_KEY for the lock test.');
if (!process.env.ACUITY_DEFAULT_TYPE_ID && (!process.env.ACUITY_TYPE_HYDRATION || !process.env.ACUITY_TYPE_MEMBERSHIP)) {
  console.warn('WARN: Set ACUITY_TYPE_HYDRATION and ACUITY_TYPE_MEMBERSHIP, or ACUITY_DEFAULT_TYPE_ID, for deterministic Acuity type mapping. Falling back to live appointment-type name matching.');
}

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const stripe = new Stripe(stripeKey);
const nonce = Date.now();
const testEmails = new Set();

function futureIso(days = 3) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  date.setHours(15, 0, 0, 0);
  return date.toISOString();
}

function payload({ email, membership = null }) {
  testEmails.add(email);
  return {
    appointment: {
      localBookingId: `verify-${nonce}`,
      reference: `verify-${nonce}`,
      acuityDatetime: futureIso(membership ? 5 : 4),
      acuityTimezone: 'America/Los_Angeles',
      timeLabel: 'Verification test',
      address: '1 Ferry Building, San Francisco, CA',
      zip: '94111',
      guests: '1',
      locationType: 'Hotel visit',
      orderType: membership ? 'subscription' : 'single',
      paymentType: membership ? 'subscription_deposit_first_month' : 'one_time_deposit',
      dob: '1990-01-01',
      emergencyContact: 'Verification Contact +14155550100',
      allergies: 'None reported',
      medications: 'None reported',
      privacyAck: true,
      treatmentConsent: true,
      generalConsent: true,
      notes: `[TEST] Avalon verification ${nonce}`,
    },
    contact: {
      firstName: 'Verify',
      lastName: membership ? 'Plan' : 'Booking',
      name: membership ? 'Verify Plan' : 'Verify Booking',
      email,
      phone: '+14155550100',
    },
    items: [{
      key: 'hydration',
      cartKey: 'hydration',
      label: 'Hydration IV',
      type: 'iv',
      price: 150,
    }],
    membership,
    primaryService: 'Hydration IV',
    amounts: {
      currency: 'usd',
      visitSubtotalCents: membership ? 35000 : 15000,
      depositAmountCents: 5000,
      balanceDueCents: membership ? 30000 : 10000,
    },
    req: { headers: { host: 'localhost' } },
  };
}

async function cleanupEmail(email) {
  try {
    const rows = await getAppointments({ max: 100, minDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    for (const row of rows || []) {
      if (String(row.email || '').toLowerCase() === email.toLowerCase()) {
        await cancelAppointment(row.id, 'Avalon verification cleanup').catch(() => {});
      }
    }
  } catch {
    // Cleanup is best-effort; explicit created ids are canceled separately.
  }
}

async function defaultTenantId() {
  const { data } = await db.from('tenants').select('id').eq('slug', 'avalon-vitality').maybeSingle();
  return data?.id || null;
}

async function createPendingRecord(checkoutPayload) {
  const { data, error } = await db.from('appointments').insert({
    ...buildPendingAppointmentRecord(checkoutPayload),
    tenant_id: await defaultTenantId(),
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function createPaidCheckoutSimulation({ checkoutPayload, recordId, label }) {
  let customer = null;
  const paymentMethod = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
  try {
    customer = await stripe.customers.create({
      email: checkoutPayload.contact.email,
      name: checkoutPayload.contact.name,
      description: `Avalon verify-booking-to-acuity ${label}`,
    });
    await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: checkoutPayload.amounts.depositAmountCents,
      currency: 'usd',
      customer: customer.id,
      payment_method: paymentMethod.id,
      confirm: true,
      off_session: true,
      setup_future_usage: 'off_session',
      metadata: {
        kind: 'checkout_deposit_verify',
        appointmentRecordId: recordId,
      },
    });
    if (paymentIntent.status !== 'succeeded' || paymentIntent.amount !== 5000) {
      throw new Error(`${label}: expected a succeeded $50 test deposit, got ${paymentIntent.status} ${paymentIntent.amount}.`);
    }

    const metadata = buildStripeCheckoutMetadata({
      appointmentRecordId: recordId,
      appointment: checkoutPayload.appointment,
      items: checkoutPayload.items,
      membership: checkoutPayload.membership,
      paymentMethod: 'card',
      primaryService: checkoutPayload.primaryService,
      visitSubtotalCents: checkoutPayload.amounts.visitSubtotalCents,
      depositCents: checkoutPayload.amounts.depositAmountCents,
      balanceDueCents: checkoutPayload.amounts.balanceDueCents,
    });

    return {
      customerId: customer.id,
      paymentMethodId: paymentMethod.id,
      paymentIntentId: paymentIntent.id,
      session: {
        id: `cs_test_avalon_verify_${label.replace(/[^a-z0-9]+/gi, '_')}_${nonce}`,
        customer: customer.id,
        payment_status: 'paid',
        payment_intent: paymentIntent.id,
        amount_total: paymentIntent.amount,
        metadata,
      },
    };
  } catch (err) {
    if (customer?.id) await stripe.customers.del(customer.id).catch(() => {});
    throw err;
  }
}

async function readAppointmentRecord(recordId) {
  const { data, error } = await db.from('appointments')
    .select('id, status, payment_status, reconciliation_status, acuity_appointment_id, external_payload')
    .eq('id', recordId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function acuityAppointmentsForEmail(email) {
  const rows = await getAppointments({
    max: 100,
    minDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  return (rows || []).filter((row) => String(row.email || '').toLowerCase() === email.toLowerCase());
}

async function deleteReconciliationCases(sessionId) {
  if (!sessionId) return;
  await db.from('reconciliation_cases').delete().eq('external_reference', sessionId).catch(() => {});
}

async function verifyWebhookFulfillmentPath(label, options) {
  const checkoutPayload = payload(options);
  let recordId = null;
  let customerId = null;
  let sessionId = null;
  let subscriptionId = null;

  try {
    recordId = await createPendingRecord(checkoutPayload);
    const simulation = await createPaidCheckoutSimulation({ checkoutPayload, recordId, label });
    customerId = simulation.customerId;
    sessionId = simulation.session.id;

    const result = await handleCheckoutCompleted(stripe, db, simulation.session);
    if (!result?.acuityAppointmentId) throw new Error(`${label}: webhook fulfillment did not return an Acuity appointment id.`);

    const record = await readAppointmentRecord(recordId);
    if (!record?.acuity_appointment_id) throw new Error(`${label}: appointment row is missing acuity_appointment_id.`);
    if (record.reconciliation_status !== 'ok') throw new Error(`${label}: expected reconciliation_status=ok, got ${record.reconciliation_status}.`);
    if (record.payment_status !== 'partial_payment') throw new Error(`${label}: expected payment_status=partial_payment, got ${record.payment_status}.`);

    if (checkoutPayload.membership) {
      subscriptionId = record.external_payload?.fulfillment?.planSubscriptionId || null;
      if (!subscriptionId) throw new Error(`${label}: webhook fulfillment did not persist planSubscriptionId.`);

      const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice', 'items.data.price'] });
      const item = subscription.items?.data?.[0];
      const trialEndMs = Number(subscription.trial_end || 0) * 1000;
      const firstVisitMs = new Date(checkoutPayload.appointment.acuityDatetime).getTime();
      const checks = [
        ['subscription is trialing', subscription.status === 'trialing'],
        ['subscription charged no recurring amount today', Number(subscription.latest_invoice?.amount_paid || 0) === 0],
        ['recurring amount is full monthly price', item?.price?.unit_amount === checkoutPayload.membership.price * 100],
        ['trial begins after first visit', trialEndMs > firstVisitMs],
      ];
      const failed = checks.filter(([, pass]) => !pass).map(([checkLabel]) => checkLabel);
      if (failed.length) throw new Error(`${label}: ${failed.join('; ')}.`);
    }

    console.log(`PASS: ${label} processed checkout.session.completed, created Acuity appointment ${record.acuity_appointment_id}${subscriptionId ? `, and trialing subscription ${subscriptionId}` : ''}.`);
  } finally {
    if (subscriptionId) await stripe.subscriptions.cancel(subscriptionId).catch(() => {});
    if (recordId) {
      const record = await readAppointmentRecord(recordId).catch(() => null);
      if (record?.acuity_appointment_id) await cancelAppointment(record.acuity_appointment_id, 'Avalon verification cleanup').catch(() => {});
      await db.from('appointments').delete().eq('id', recordId).catch(() => {});
    }
    await deleteReconciliationCases(sessionId);
    if (customerId) await stripe.customers.del(customerId).catch(() => {});
  }
}

async function verifySchedulingLock() {
  const { data: tenant } = await db.from('tenants').select('id').eq('slug', 'avalon-vitality').maybeSingle();
  const { data: record, error } = await db.from('appointments').insert({
    tenant_id: tenant?.id || null,
    status: 'payment_received',
    payment_status: 'partial_payment',
    reconciliation_status: 'pending',
    external_payload: { provider: 'verify-booking-to-acuity', createdAt: new Date().toISOString() },
  }).select('id').single();
  if (error) throw error;
  try {
    const [a, b] = await Promise.all([
      claimSchedulingCreation(db, record.id),
      claimSchedulingCreation(db, record.id),
    ]);
    if ([a, b].filter(Boolean).length !== 1) fail(`Expected exactly one scheduling-lock winner, got ${JSON.stringify([a, b])}.`);
    console.log('PASS: scheduling lock allows exactly one concurrent winner.');
  } finally {
    await db.from('appointments').delete().eq('id', record.id).catch(() => {});
  }
}

async function verifyWebhookAndCheckoutVerifyRace({ label = 'Webhook + checkout verify race', email, membership = null } = {}) {
  const checkoutPayload = payload({ email, membership });
  let recordId = null;
  let customerId = null;
  let sessionId = null;
  let subscriptionId = null;

  try {
    recordId = await createPendingRecord(checkoutPayload);
    const simulation = await createPaidCheckoutSimulation({ checkoutPayload, recordId, label });
    customerId = simulation.customerId;
    sessionId = simulation.session.id;

    const appointmentBefore = await readAppointmentRecord(recordId);
    const paymentIntent = await stripe.paymentIntents.retrieve(simulation.paymentIntentId);
    const verifyPath = async () => {
      const fulfillment = await fulfillPaidCheckoutIfNeeded({
        stripe,
        session: simulation.session,
        appointment: appointmentBefore,
        paymentIntent,
        paymentIntentMetadata: paymentIntent.metadata || {},
      });
      await persistVerifyFulfillment({
        appointment: appointmentBefore,
        session: simulation.session,
        paymentIntentId: paymentIntent.id,
        fulfillment,
        attioPersonId: fulfillment.attioPersonId,
      });
      return fulfillment;
    };

    await Promise.all([
      handleCheckoutCompleted(stripe, db, simulation.session),
      verifyPath(),
    ]);

    const record = await readAppointmentRecord(recordId);
    if (!record?.acuity_appointment_id) throw new Error(`${label}: appointment row is missing acuity_appointment_id.`);
    if (record.reconciliation_status !== 'ok') throw new Error(`${label}: expected reconciliation_status=ok, got ${record.reconciliation_status}.`);

    if (membership) {
      subscriptionId = record.external_payload?.fulfillment?.planSubscriptionId || null;
      if (!subscriptionId) throw new Error(`${label}: race did not persist a planSubscriptionId.`);
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice', 'items.data.price'] });
      const item = subscription.items?.data?.[0];
      if (subscription.status !== 'trialing') throw new Error(`${label}: expected trialing subscription, got ${subscription.status}.`);
      if (Number(subscription.latest_invoice?.amount_paid || 0) !== 0) throw new Error(`${label}: plan subscription charged during race.`);
      if (item?.price?.unit_amount !== membership.price * 100) throw new Error(`${label}: subscription amount did not match full monthly plan price.`);
    }

    const acuityRows = await acuityAppointmentsForEmail(checkoutPayload.contact.email);
    if (acuityRows.length !== 1) {
      throw new Error(`${label}: expected exactly one Acuity appointment for ${checkoutPayload.contact.email}, got ${acuityRows.length}.`);
    }

    console.log(`PASS: ${label} created exactly one Acuity appointment ${record.acuity_appointment_id}${subscriptionId ? ` and trialing subscription ${subscriptionId}` : ''}.`);
  } finally {
    if (subscriptionId) await stripe.subscriptions.cancel(subscriptionId).catch(() => {});
    if (recordId) {
      const record = await readAppointmentRecord(recordId).catch(() => null);
      if (record?.acuity_appointment_id) await cancelAppointment(record.acuity_appointment_id, 'Avalon verification cleanup').catch(() => {});
      await db.from('appointments').delete().eq('id', recordId).catch(() => {});
    }
    await deleteReconciliationCases(sessionId);
    if (customerId) await stripe.customers.del(customerId).catch(() => {});
  }
}

try {
  await verifyWebhookFulfillmentPath('Book Now path', { email: `verify-booking-${nonce}@example.test` });
  await verifyWebhookFulfillmentPath('Plan path', {
    email: `verify-plan-${nonce}@example.test`,
    membership: { name: 'Starter', billing: 'monthly', price: 350 },
  });
  await verifySchedulingLock();
  await verifyWebhookAndCheckoutVerifyRace({
    label: 'Book Now webhook + checkout verify race',
    email: `verify-race-${nonce}@example.test`,
  });
  await verifyWebhookAndCheckoutVerifyRace({
    label: 'Plan webhook + checkout verify race',
    email: `verify-plan-race-${nonce}@example.test`,
    membership: { name: 'Starter', billing: 'monthly', price: 350 },
  });
  console.log('PASS: booking-to-Acuity smoke completed.');
} catch (err) {
  fail(err?.message || err);
} finally {
  for (const email of testEmails) await cleanupEmail(email);
}
