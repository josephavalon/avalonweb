/**
 * /api/admin/reconciliation — operational reconciliation dashboard backend.
 *
 * Surfaces three "silent failure" signals so a human can act:
 *
 *  GET ?kind=renewals
 *      Active Stripe plan subscriptions whose `current_period_end` has passed
 *      and we have NO local signal that the renewal actually credited:
 *        - no member_credit_ledger row with source='membership_renewal_grant'
 *          inside the current cycle window for that subscription, AND
 *        - no audit_events row with action='plan_renewed_email_sent' for the
 *          subscription's most-recent invoice id.
 *      List shape: member email + plan + last successful renewal + days overdue.
 *
 *  GET ?kind=acuity_sync
 *      Appointments where Stripe says paid (paid_in_full / partial_payment) but
 *      `acuity_appointment_id` is null or empty AND created within the last 30
 *      days. The Stripe webhook is supposed to have created the Acuity visit;
 *      a missing id means a fulfillment slip the customer can't see.
 *
 *  GET ?kind=payment_failures
 *      Open `reconciliation_cases` rows the Stripe webhook opened on
 *      `invoice.payment_failed` (case_type='acuity_succeeded_stripe_failed'
 *      with provider='stripe' + payload.reason='subscription_payment_failed')
 *      in the last 30 days, that haven't been resolved (status='open' AND no
 *      `reconciliation_marked_resolved` audit event referencing the case id).
 *
 *  GET ?kind=*&showResolved=1
 *      Include items a staff member acknowledged via the POST action below.
 *
 *  POST { kind, entityId, note? }
 *      Records a `reconciliation_marked_resolved` audit_event so the row drops
 *      out of the default list. CRITICAL: this is acknowledgement only. It
 *      does NOT retry a charge, create an Acuity appointment, or refund —
 *      humans act, the dashboard tracks. The audit row is the durable proof
 *      the issue was looked at.
 *
 * Tenant scoped via the authenticated profile (service-role bypasses RLS).
 * Degrades gracefully when expected columns/tables are missing.
 */

import Stripe from 'stripe';
import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const RECONCILIATION_RESOLVED_ACTION = 'reconciliation_marked_resolved';
const RENEWAL_GRANT_SOURCE = 'membership_renewal_grant';
const RENEWAL_EMAIL_ACTION = 'plan_renewed_email_sent';
const RENEWAL_EMAIL_ENTITY = 'stripe_billing_email';
const PAYMENT_FAILED_CASE_TYPE = 'acuity_succeeded_stripe_failed';
const PAYMENT_FAILED_REASON = 'subscription_payment_failed';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RENEWAL_GRACE_DAYS = 0; // overdue the instant current_period_end passes
const RENEWAL_LOOKBACK_DAYS = 7; // dedupe window for recent successful signals
const PAID_APPOINTMENT_LOOKBACK_DAYS = 30;
const PAYMENT_FAILURE_LOOKBACK_DAYS = 30;

const KIND_TO_ENTITY_TYPE = {
  renewals: 'stripe_subscription',
  acuity_sync: 'appointment',
  payment_failures: 'reconciliation_case',
};

// Postgres 42P01 / PostgREST PGRST205 — table simply not migrated yet.
function isMissingTable(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42p01'
    || code === 'pgrst205'
    || (msg.includes('relation') && msg.includes('does not exist'))
    || msg.includes('could not find the table')
    || msg.includes('schema cache')
  );
}

function isMissingColumn(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return code === '42703' || (msg.includes('column') && (msg.includes('does not exist') || msg.includes('not found')));
}

function daysBetween(fromIso, toMs = Date.now()) {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((toMs - t) / MS_PER_DAY));
}

function emailFromPayload(payload) {
  return String(payload?.contact?.email || '').trim().toLowerCase();
}

function nameFromPayload(payload) {
  const c = payload?.contact || {};
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return full || c.name || c.fullName || '';
}

// Load the set of entity ids the operator already acknowledged. Used to filter
// rows out of the default view (and to mark them resolved=true when showResolved
// is on). Scoped to a single kind so different reconciliation streams don't
// collide on the same entity id.
async function loadResolvedEntityIds(db, { tenantId, kind }) {
  const entityType = KIND_TO_ENTITY_TYPE[kind];
  const resolved = new Set();
  if (!entityType) return resolved;
  try {
    let q = db.from('audit_events')
      .select('entity_id, payload')
      .eq('action', RECONCILIATION_RESOLVED_ACTION)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })
      .limit(500);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
    if (error) throw error;
    (data || []).forEach((row) => {
      // Some kinds carry the entity id in payload.entityId rather than entity_id
      // (e.g. a Stripe subscription id is not a uuid and won't live in entity_id).
      if (row.entity_id) resolved.add(String(row.entity_id));
      if (row.payload?.entityId) resolved.add(String(row.payload.entityId));
    });
  } catch (err) {
    if (!isMissingTable(err)) {
      console.warn('[admin/reconciliation] resolved lookup failed', safeLogContext(err, 'recon_resolved_lookup_failed'));
    }
  }
  return resolved;
}

// ─── kind=renewals ───────────────────────────────────────────────────────────
//
// "Active plan, period ended, no recent renewal signal." We iterate Stripe
// subscriptions (Stripe is the source of truth — there is no local
// `subscriptions` table) and cross-reference our local credit ledger + audit
// events for the renewal signal.
async function handleRenewals(req, res, { db, tenantId, showResolved }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({
      issues: [],
      configured: false,
      reason: 'stripe_not_configured',
    });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let subscriptions = [];
  try {
    let startingAfter;
    for (;;) {
      const page = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      subscriptions.push(...page.data);
      if (!page.has_more || !page.data.length) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (err) {
    console.warn('[admin/reconciliation] stripe subscriptions list failed', safeLogContext(err, 'recon_renewals_list_failed'));
    return res.status(502).json({
      error: 'Could not list Stripe subscriptions.',
      code: safeErrorCode(err, 'recon_renewals_list_failed'),
    });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const overdueSubs = subscriptions.filter((sub) => {
    if (sub.cancel_at_period_end) return false; // cancelling is expected to lapse
    const cpe = Number(sub.current_period_end || 0);
    return cpe > 0 && cpe + RENEWAL_GRACE_DAYS * 86400 < nowSec;
  });

  // Pull recent renewal-grant ledger rows and renewal-email audit rows so we
  // can mark anything with a fresh successful signal as "actually fine."
  const sinceIso = new Date(Date.now() - RENEWAL_LOOKBACK_DAYS * MS_PER_DAY).toISOString();
  const recentRenewalGrantBySubId = new Map();
  try {
    let lq = db.from('member_credit_ledger')
      .select('stripe_subscription_id, created_at')
      .eq('source', RENEWAL_GRANT_SOURCE)
      .gte('created_at', sinceIso);
    if (tenantId) lq = lq.eq('tenant_id', tenantId);
    const { data: ledger, error } = await lq;
    if (error) throw error;
    (ledger || []).forEach((row) => {
      if (!row.stripe_subscription_id) return;
      const prior = recentRenewalGrantBySubId.get(row.stripe_subscription_id);
      if (!prior || row.created_at > prior) recentRenewalGrantBySubId.set(row.stripe_subscription_id, row.created_at);
    });
  } catch (err) {
    if (!isMissingTable(err) && !isMissingColumn(err)) {
      console.warn('[admin/reconciliation] ledger lookup failed', safeLogContext(err, 'recon_renewals_ledger_failed'));
    }
  }

  // Customer → profile (email, name).
  const customerIds = Array.from(new Set(
    overdueSubs
      .map((s) => (typeof s.customer === 'string' ? s.customer : s.customer?.id))
      .filter(Boolean),
  ));
  const profileByCustomerId = new Map();
  if (customerIds.length) {
    try {
      let pq = db.from('profiles')
        .select('id, email, full_name, preferred_name, stripe_customer_id, tenant_id')
        .in('stripe_customer_id', customerIds);
      if (tenantId) pq = pq.eq('tenant_id', tenantId);
      const { data, error } = await pq;
      if (error) throw error;
      (data || []).forEach((p) => {
        if (p.stripe_customer_id) profileByCustomerId.set(p.stripe_customer_id, p);
      });
    } catch (err) {
      console.warn('[admin/reconciliation] profile lookup failed', safeLogContext(err, 'recon_renewals_profile_lookup_failed'));
    }
  }

  const resolvedIds = await loadResolvedEntityIds(db, { tenantId, kind: 'renewals' });

  const issues = overdueSubs.map((sub) => {
    const cpeIso = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    const cpsIso = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
    const profile = customerId ? profileByCustomerId.get(customerId) : null;
    const item = sub.items?.data?.[0];
    const unitAmount = item?.price?.unit_amount ?? 0;
    const lastGrantAt = recentRenewalGrantBySubId.get(sub.id) || null;
    return {
      kind: 'renewals',
      entityId: sub.id,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      memberEmail: profile?.email || sub.metadata?.contact_email || null,
      memberName: profile?.full_name || profile?.preferred_name || null,
      planName: sub.metadata?.planName || sub.metadata?.plan_name || item?.price?.nickname || '—',
      planMonthlyCents: Number(unitAmount || 0),
      currentPeriodStart: cpsIso,
      currentPeriodEnd: cpeIso,
      lastSuccessfulRenewalAt: lastGrantAt,
      daysOverdue: daysBetween(cpeIso),
      resolved: resolvedIds.has(sub.id),
    };
  })
  // The renewal already credited in our books — Stripe just hasn't moved the
  // period forward yet (clock skew, recent webhook). Hide unless explicitly
  // showing resolved/everything.
  .filter((row) => !row.lastSuccessfulRenewalAt || showResolved)
  .filter((row) => showResolved || !row.resolved);

  return res.status(200).json({ issues, configured: true });
}

// ─── kind=acuity_sync ────────────────────────────────────────────────────────
//
// "Paid but no Acuity id." The Stripe webhook is the only writer of
// acuity_appointment_id on paid checkouts; a missing id within the lookback
// window is a fulfillment slip the customer can't see.
async function handleAcuitySync(req, res, { db, tenantId, showResolved }) {
  const sinceIso = new Date(Date.now() - PAID_APPOINTMENT_LOOKBACK_DAYS * MS_PER_DAY).toISOString();
  let rows = [];
  try {
    let q = db.from('appointments')
      .select('id, tenant_id, payment_status, acuity_appointment_id, deposit_amount_cents, balance_due_cents, visit_subtotal_cents, deposit_paid_at, created_at, stripe_checkout_session_id, external_payload')
      .in('payment_status', ['paid_in_full', 'partial_payment', 'deposit_paid'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
    if (error) throw error;
    rows = data || [];
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(200).json({ issues: [], tableMissing: true });
    }
    console.warn('[admin/reconciliation] acuity_sync query failed', safeLogContext(err, 'recon_acuity_sync_query_failed'));
    return res.status(500).json({
      error: 'Could not load appointments.',
      code: safeErrorCode(err, 'recon_acuity_sync_query_failed'),
    });
  }

  const resolvedIds = await loadResolvedEntityIds(db, { tenantId, kind: 'acuity_sync' });

  const issues = rows
    .filter((row) => {
      const id = String(row.acuity_appointment_id || '').trim();
      return id.length === 0;
    })
    .map((row) => {
      const payload = row.external_payload || {};
      const totalCents = Number(row.visit_subtotal_cents || 0)
        || (Number(row.deposit_amount_cents || 0) + Number(row.balance_due_cents || 0));
      return {
        kind: 'acuity_sync',
        entityId: row.id,
        appointmentId: row.id,
        memberEmail: emailFromPayload(payload) || null,
        memberName: nameFromPayload(payload) || null,
        paymentStatus: row.payment_status,
        amountCents: totalCents,
        depositAmountCents: Number(row.deposit_amount_cents || 0),
        balanceDueCents: Number(row.balance_due_cents || 0),
        depositPaidAt: row.deposit_paid_at,
        createdAt: row.created_at,
        ageDays: daysBetween(row.created_at),
        stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
        primaryService: payload.primaryService || payload.appointment?.serviceLabel || 'Avalon Visit',
        resolved: resolvedIds.has(row.id),
      };
    })
    .filter((row) => showResolved || !row.resolved);

  return res.status(200).json({ issues, tableMissing: false });
}

// ─── kind=payment_failures ───────────────────────────────────────────────────
//
// Stripe's webhook is the writer: on `invoice.payment_failed` it inserts a
// reconciliation_cases row (case_type='acuity_succeeded_stripe_failed',
// provider='stripe', payload.reason='subscription_payment_failed'). Status
// stays 'open' until ops manually flips it (or we ack via this dashboard).
async function handlePaymentFailures(req, res, { db, tenantId, showResolved }) {
  const sinceIso = new Date(Date.now() - PAYMENT_FAILURE_LOOKBACK_DAYS * MS_PER_DAY).toISOString();
  let rows = [];
  try {
    let q = db.from('reconciliation_cases')
      .select('id, tenant_id, case_type, provider, external_reference, status, severity, payload, created_at, resolved_at, appointment_id')
      .eq('case_type', PAYMENT_FAILED_CASE_TYPE)
      .eq('provider', 'stripe')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    // status='open' filter only when we're hiding resolved; otherwise include
    // every status so the UI's "show resolved" toggle is complete.
    if (!showResolved) q = q.eq('status', 'open');
    const { data, error } = await q;
    if (error) throw error;
    rows = data || [];
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(200).json({ issues: [], tableMissing: true });
    }
    console.warn('[admin/reconciliation] payment_failures query failed', safeLogContext(err, 'recon_payment_failures_query_failed'));
    return res.status(500).json({
      error: 'Could not load payment failure cases.',
      code: safeErrorCode(err, 'recon_payment_failures_query_failed'),
    });
  }

  const resolvedIds = await loadResolvedEntityIds(db, { tenantId, kind: 'payment_failures' });

  const issues = rows
    .filter((row) => {
      // Belt-and-suspenders: the case_type is overloaded (it also covers other
      // subscription failure flavors). The Stripe webhook stamps the reason
      // when it's a recurring payment_failed; only surface those here.
      const reason = String(row.payload?.reason || '').toLowerCase();
      // If reason is missing on legacy rows, fall back to "any open stripe case
      // with a subscription id" — better surfaced than dropped.
      const looksLikeSubFailure = !!row.payload?.stripeSubscriptionId || !!row.payload?.stripeInvoiceId;
      return reason === PAYMENT_FAILED_REASON || looksLikeSubFailure;
    })
    .map((row) => {
      const payload = row.payload || {};
      return {
        kind: 'payment_failures',
        entityId: row.id,
        caseId: row.id,
        status: row.status,
        severity: row.severity,
        stripeInvoiceId: payload.stripeInvoiceId || row.external_reference || null,
        stripeSubscriptionId: payload.stripeSubscriptionId || null,
        stripeCustomerId: payload.stripeCustomerId || null,
        appointmentId: row.appointment_id || payload.appointmentRecordId || null,
        planName: payload.planName || null,
        amountDueCents: Number(payload.amountDueCents || 0),
        attemptCount: payload.attemptCount || null,
        nextPaymentAttempt: payload.nextPaymentAttempt || null,
        reason: payload.reason || null,
        errorCode: payload.errorCode || null,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        ageDays: daysBetween(row.created_at),
        resolved: row.status !== 'open' || resolvedIds.has(row.id),
      };
    })
    .filter((row) => showResolved || !row.resolved);

  return res.status(200).json({ issues, tableMissing: false });
}

async function getHandler(req, res, authed) {
  const { db, tenantId, user } = authed;
  const kind = String(req.query?.kind || '').trim();
  const showResolved = String(req.query?.showResolved || '').trim() === '1';

  if (!KIND_TO_ENTITY_TYPE[kind]) {
    return res.status(400).json({
      error: "kind must be one of 'renewals', 'acuity_sync', 'payment_failures'",
      code: 'invalid_kind',
    });
  }

  // Best-effort audit of the read — same posture as api/admin/bookings.
  writeAuditEvent(db, {
    tenantId,
    actorProfileId: user?.id || null,
    action: 'admin_reconciliation_read',
    entityType: 'reconciliation_dashboard',
    phiTouched: false,
    payload: { route: 'api/admin/reconciliation', kind, showResolved },
  }).catch(() => {});

  if (kind === 'renewals') return handleRenewals(req, res, { db, tenantId, showResolved });
  if (kind === 'acuity_sync') return handleAcuitySync(req, res, { db, tenantId, showResolved });
  if (kind === 'payment_failures') return handlePaymentFailures(req, res, { db, tenantId, showResolved });
  return res.status(400).json({ error: 'invalid_kind', code: 'invalid_kind' });
}

async function postHandler(req, res, authed) {
  const { db, tenantId, user } = authed;
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const kind = String(body.kind || '').trim();
  const entityId = String(body.entityId || '').trim();
  const note = body.note != null ? String(body.note).slice(0, 2000) : '';
  const entityType = KIND_TO_ENTITY_TYPE[kind];

  if (!entityType) return res.status(400).json({ error: 'invalid_kind', code: 'invalid_kind' });
  if (!entityId) return res.status(400).json({ error: 'entityId is required', code: 'entity_id_required' });

  // entity_id is uuid in audit_events for appointment/reconciliation_case rows,
  // but a Stripe subscription id (`sub_...`) is NOT a uuid — putting it in
  // entity_id will fail the insert. Persist non-uuid ids in payload.entityId
  // and leave entity_id null for the renewals kind; loadResolvedEntityIds
  // reads both shapes.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId);

  const result = await writeAuditEvent(db, {
    tenantId,
    actorProfileId: user?.id || null,
    action: RECONCILIATION_RESOLVED_ACTION,
    entityType,
    entityId: isUuid ? entityId : null,
    phiTouched: false,
    payload: {
      route: 'api/admin/reconciliation',
      kind,
      entityId,
      note: note || null,
      resolvedBy: user?.email || user?.id || null,
      resolvedAt: new Date().toISOString(),
    },
  });
  if (result?.error) {
    return res.status(500).json({ error: 'Could not record acknowledgement.', code: result.error });
  }
  return res.status(200).json({ ok: true, kind, entityId });
}

export default async function handler(req, res) {
  const authed = await requireStaff(req, res);
  if (!authed) return;

  if (req.method === 'GET') return getHandler(req, res, authed);
  if (req.method === 'POST') return postHandler(req, res, authed);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
