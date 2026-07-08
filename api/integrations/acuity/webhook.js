/**
 * POST /api/integrations/acuity/webhook
 *
 * Receives Acuity scheduling events and syncs them onto the canonical record:
 * public.appointments (the same row Stripe's deposit/balance data attaches to,
 * keyed by acuity_appointment_id). Contact detail is stored in external_payload
 * (jsonb); the CRM of record is Attio (upserted non-blocking).
 *
 * Acuity webhook config: Dashboard → Integrations → Webhooks
 *   URL: https://<domain>/api/integrations/acuity/webhook
 *   Events: scheduled, rescheduled, canceled, changed
 *
 * Idempotency: events deduped by (acuity_appointment_id + action). The payload
 * hash is retained only as an integrity signal when Acuity resends the same
 * logical event with timestamp/noise changes.
 * Until Supabase is wired, events are logged and 200'd so Acuity won't retry.
 */

import crypto from 'crypto';
import { getAppointment } from '../../_acuity.js';
import { gfeSyncAndAssign } from '../../_lib/gfe-core.js';
import { requireLiveWebhook } from '../../_lib/pre-api-guard.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { buildReconciliationCase, insertReconciliationCaseOnce } from '../../_reconciliation.js';
import { upsertAttioPerson } from '../../_attio.js';
import { upsertHubspotContact } from '../../_hubspot.js';
import { sendSms, isSmsConfigured } from '../../_lib/send-sms.js';
import { findRedemptionForAppointment, refundMemberCredit } from '../../_lib/member-credits.js';
import { decrementForAppointment } from '../../_lib/inventory-burndown.js';
import { loadEventsGfeTypeIds, isEventsGfeAppointment, syncEventsGfeAppointment } from '../../_lib/events-gfe.js';

// bodyParser is disabled so we can HMAC over the exact bytes Acuity signed.
// Re-stringifying a parsed body breaks the signature compare every time (and
// silently nudges deployers toward unsetting the webhook secret, which lets
// anyone forge a "canceled" event for any guessed appointment id).
export const config = {
  api: {
    bodyParser: false,
  },
};

const ACUITY_WEBHOOK_MAX_BODY_BYTES = Number.parseInt(process.env.ACUITY_WEBHOOK_MAX_BODY_BYTES || String(64 * 1024), 10);
const ACUITY_WEBHOOK_FETCH_TIMEOUT_MS = Number.parseInt(process.env.ACUITY_WEBHOOK_FETCH_TIMEOUT_MS || '10000', 10);

// ── Supabase (lazy; graceful no-op until service-role key is configured) ─────
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

async function defaultTenantId(db) {
  const { data } = await db.from('tenants').select('id').eq('slug', 'avalon-vitality').maybeSingle();
  return data?.id || null;
}

function payloadHash(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 16);
}

function httpError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

function readRawBody(req, maxBytes = ACUITY_WEBHOOK_MAX_BODY_BYTES) {
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
        reject(httpError('Acuity webhook payload too large', 413, 'acuity_webhook_body_too_large'));
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

// Acuity posts application/x-www-form-urlencoded by default; some testing
// harnesses post JSON. Accept either, and surface a clear error if neither.
function parseAcuityBody(rawBody, contentTypeHeader = '') {
  const contentType = String(contentTypeHeader).split(';')[0].trim().toLowerCase();
  const text = rawBody.toString('utf8');
  if (!text) return {};
  if (contentType === 'application/x-www-form-urlencoded' || contentType === '') {
    const params = new URLSearchParams(text);
    const body = {};
    for (const [k, v] of params) body[k] = v;
    return body;
  }
  if (contentType === 'application/json' || contentType.endsWith('+json')) {
    return JSON.parse(text);
  }
  throw httpError(`Unsupported content-type: ${contentType}`, 415, 'acuity_webhook_unsupported_content_type');
}

function timeoutError(label) {
  return Object.assign(new Error(`${label} timed out`), { code: 'acuity_webhook_timeout' });
}

function withTimeout(promise, label, ms = ACUITY_WEBHOOK_FETCH_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(label)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function safeErrorCode(err, fallback = 'acuity_webhook_error') {
  const code = err?.code || err?.type || err?.statusCode || err?.status || err?.name || fallback;
  return String(code).replace(/[^a-z0-9_:-]+/gi, '_').slice(0, 80) || fallback;
}

function safeLogContext(err, fallback) {
  return {
    code: safeErrorCode(err, fallback),
    status: err?.statusCode || err?.status || null,
  };
}

function safeEqual(left = '', right = '') {
  const l = Buffer.from(left);
  const r = Buffer.from(right);
  if (l.length !== r.length) return false;
  return crypto.timingSafeEqual(l, r);
}

// Acuity's signature is HMAC-SHA256 of the raw request bytes, base64-encoded,
// delivered in `X-Acuity-Signature`. We compare the base64 form first and
// fall back to hex for ergonomics in non-Acuity callers (load balancers etc.
// occasionally hex-encode). HMAC is computed over the rawBody Buffer — never
// over a re-stringified parsed object.
function verifyWebhookSignature(req, rawBody) {
  const secret = process.env.ACUITY_WEBHOOK_SECRET;
  if (!secret) return { required: false, valid: null };
  const supplied = String(
    req.headers?.['x-acuity-signature']
    || req.headers?.['x-webhook-signature']
    || req.headers?.['x-signature']
    || ''
  ).replace(/^sha256=/i, '').trim();
  if (!supplied) return { required: true, valid: false };
  const mac = crypto.createHmac('sha256', secret).update(rawBody);
  const expectedBase64 = mac.digest('base64');
  // re-hash for hex fallback (Buffer.digest() consumed the hmac)
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const valid = safeEqual(supplied, expectedBase64) || safeEqual(supplied, expectedHex);
  return { required: true, valid };
}

const STATUS_BY_ACTION = {
  scheduled:   'scheduled',
  rescheduled: 'scheduled',
  changed:     'scheduled',
  canceled:    'canceled',
};

// Canonical: upsert public.appointments by acuity_appointment_id (no native
// unique constraint, so select-then-update/insert).
//
// external_payload is treated as a merge target, NOT a write-through. The
// checkout flow writes provider='avalon_checkout' (with items, membership,
// amounts, consent flags) and we must preserve those when an Acuity
// "scheduled"/"changed" event arrives. Acuity's view of the world lives under
// external_payload.acuity so the two never collide.
function buildAcuityPayload(existing = {}, appt, action) {
  const contact = {
    name: `${appt.firstName || ''} ${appt.lastName || ''}`.trim() || null,
    email: appt.email || null,
    phone: appt.phone || null,
  };
  return {
    ...existing,
    acuity: {
      action,
      contact,
      appointment: appt,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function upsertAppointment(db, appt, action) {
  const acuityId = String(appt.id);
  const tenantId = await defaultTenantId(db);
  const now = new Date().toISOString();

  // Load the existing row first so we can merge external_payload rather than
  // overwriting checkout's authoritative state.
  const { data: existing } = await db.from('appointments')
    .select('id, external_payload')
    .eq('acuity_appointment_id', acuityId)
    .maybeSingle();

  const patch = {
    tenant_id:             tenantId,
    acuity_appointment_id: acuityId,
    starts_at:             appt.datetime || appt.date || null,
    status:                STATUS_BY_ACTION[action] || 'scheduled',
    protocol_key:          appt.type || null,
    external_payload:      buildAcuityPayload(existing?.external_payload || {}, appt, action),
    updated_at:            now,
  };

  if (existing?.id) {
    const { error } = await db.from('appointments').update(patch).eq('id', existing.id);
    if (error) {
      console.error('[acuity/webhook] appointment update failed', safeLogContext(error, 'appointment_upsert_failed'));
      return null;
    }
    return existing.id;
  }

  const { data: inserted, error: insertError } = await db.from('appointments')
    .insert({ ...patch, created_at: now }).select('id').single();
  if (!insertError) return inserted?.id || null;

  console.error('[acuity/webhook] appointment insert failed', safeLogContext(insertError, 'appointment_upsert_failed'));
  return null;
}

// ── PHI-free transactional SMS (best-effort, idempotent) ─────────────────────
//
// Quo's BAA does NOT cover SMS, so these bodies must stay PHI-free: a generic
// "Avalon visit" line plus a non-clinical date/time only. No name, address,
// service/protocol, dosage, or the word "appointment" (the phi-guard block-list
// rejects it). See api/_lib/phi-guard.js + docs/PHI_DATA_FLOW.md.

const SMS_TZ = process.env.AVALON_SMS_TZ || 'America/Los_Angeles';

// "Sat, Jul 12 at 2:30 PM" — date/time is non-clinical and allowed PHI-free.
function formatVisitWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    // e.g. "Sat, Jul 12, 2:30 PM" — non-clinical date/time only.
    return new Intl.DateTimeFormat('en-US', {
      timeZone: SMS_TZ,
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

function smsBodyForAction(action, whenLabel) {
  const when = whenLabel ? ` for ${whenLabel}` : '';
  if (action === 'scheduled') {
    return `Your Avalon visit is confirmed${when}. Reply STOP to opt out.`;
  }
  if (action === 'rescheduled' || action === 'changed') {
    return `Your Avalon visit has been updated${when}. Reply STOP to opt out.`;
  }
  if (action === 'canceled') {
    return 'Your Avalon visit has been canceled. Questions? Just reply here. Reply STOP to opt out.';
  }
  return '';
}

// Pull a phone from whatever we have: the freshly-fetched Acuity appt
// (scheduled/rescheduled) or the stored canonical row (canceled).
function phoneFromAppt(appt = {}) {
  return appt.phone || '';
}
function phoneFromStoredRow(payload = {}) {
  return payload?.acuity?.contact?.phone
    || payload?.acuity?.appointment?.phone
    || payload?.contact?.phone
    || '';
}
function whenFromAppt(appt = {}) {
  return appt.datetime || appt.date || '';
}
function whenFromStoredRow(payload = {}) {
  return payload?.acuity?.appointment?.datetime
    || payload?.acuity?.appointment?.date
    || payload?.appointment?.acuityDatetime
    || '';
}

// Idempotent, best-effort. Dedupe via an audit_events row keyed on
// (action, appointment record id); never throws out of the webhook.
async function sendTransactionalSms(db, {
  tenantId,
  appointmentRecordId,
  acuityAppointmentId,
  action,
  phone,
  whenLabel,
}) {
  try {
    if (!isSmsConfigured()) return; // QUO_API_KEY/FROM missing → graceful no-op
    if (!phone) return;
    const auditAction = `acuity_sms_${action}_sent`;

    // Dedupe: if we already logged a send for this appointment+action, skip.
    if (appointmentRecordId) {
      const { data: prior } = await db.from('audit_events')
        .select('id')
        .eq('action', auditAction)
        .eq('entity_id', appointmentRecordId)
        .limit(1)
        .maybeSingle();
      if (prior?.id) return;
    }

    const body = smsBodyForAction(action, whenLabel);
    if (!body) return;

    const result = await sendSms({ to: phone, body });
    if (!result?.ok) {
      console.warn('[acuity/webhook] sms send not ok', { action, code: result?.code || 'unknown' });
      return; // don't log a "sent" audit row on failure → safe to retry
    }
    await writeAuditEvent(db, {
      tenantId,
      action: auditAction,
      entityType: 'appointment',
      entityId: appointmentRecordId || null,
      phiTouched: false, // PHI-free body by construction
      payload: { acuityAppointmentId: String(acuityAppointmentId), channel: 'sms' },
    });
  } catch (err) {
    // Never let SMS break the webhook.
    console.warn('[acuity/webhook] transactional sms failed', safeLogContext(err, 'acuity_sms_failed'));
  }
}

// ── Events GFE branch (ET3) ──────────────────────────────────────────────────
//
// Appointments booked on an events GFE appointment type are pointer/status
// syncs on event_visits (via the audited transition RPC) and must NEVER enter
// the mobile-IV canonical appointment upsert/SMS/CRM flow below. PHI law: the
// Acuity pointer + gfe_status enum only; the audit payload is content-free.
// Keeps the acuity_events idempotency bookkeeping consistent with the
// existing pattern (processed/failed + processed_at).
async function processEventsGfeAppointment(db, { apptId, action, email, tenantId, eventId, res }) {
  let sync;
  try {
    sync = await syncEventsGfeAppointment(db, { apptId, action, email });
  } catch (err) {
    console.warn('[acuity/webhook] events gfe sync failed', safeLogContext(err, 'events_gfe_sync_failed'));
    if (eventId) await db.from('acuity_events').update({
      processed_status: 'failed', error_message: safeErrorCode(err, 'events_gfe_sync_failed'), processed_at: new Date().toISOString(),
    }).eq('id', eventId);
    return res.status(200).json({ ok: false, eventsGfe: true, code: safeErrorCode(err, 'events_gfe_sync_failed') });
  }
  if (eventId) await db.from('acuity_events')
    .update({ processed_status: 'processed', processed_at: new Date().toISOString() }).eq('id', eventId);
  await writeAuditEvent(db, {
    tenantId, action: `acuity_webhook_events_gfe_${action}`,
    entityType: 'event_visit', entityId: sync.visitId || null, phiTouched: false,
    payload: { acuityAppointmentId: String(apptId), matched: sync.matched, transitioned: sync.transitioned || null },
  });
  return res.status(200).json({ ok: true, action, eventsGfe: true, matched: sync.matched });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireLiveWebhook(req, res, { provider: 'acuity', secretEnv: 'ACUITY_WEBHOOK_SECRET' })) return;

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    if (err.code === 'acuity_webhook_body_too_large') {
      return res.status(413).json({ error: 'Acuity webhook payload too large', code: err.code });
    }
    return res.status(400).json({ error: 'Could not read webhook body', code: 'acuity_webhook_body_read_failed' });
  }

  // Verify signature BEFORE parsing — the HMAC is over the bytes Acuity sent,
  // not our re-stringified parse of them.
  const signature = verifyWebhookSignature(req, rawBody);
  if (signature.required && !signature.valid) {
    console.warn('[acuity/webhook] invalid signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  let body;
  try {
    body = parseAcuityBody(rawBody, req.headers?.['content-type']);
  } catch (err) {
    if (err.code === 'acuity_webhook_unsupported_content_type') {
      return res.status(415).json({ error: 'Unsupported Acuity webhook content type', code: err.code });
    }
    return res.status(400).json({ error: 'Could not parse webhook body', code: 'acuity_webhook_body_parse_failed' });
  }

  const action = body.action; // scheduled | rescheduled | canceled | changed
  const apptId = body.id;
  if (!action || !apptId) {
    return res.status(400).json({ error: 'Missing action or appointment id' });
  }

  const hash = payloadHash(rawBody);
  console.log(`[acuity/webhook] action=${action} apptId=${apptId} hash=${hash}`);

  const db = await getSupabase();
  if (!db) {
    return res.status(200).json({ ok: true, queued: false, note: 'db_not_configured' });
  }

  try {
    // 1. Dedupe + log raw event. Event identity is appointment + action; the
    // payload hash only flags replay drift and must not create a second event.
    const tenantId = await defaultTenantId(db);
    const { data: existingEvent } = await db.from('acuity_events')
      .select('id, processed_status, webhook_event_hash')
      .eq('acuity_appointment_id', String(apptId))
      .eq('action', action)
      .maybeSingle();

    if (existingEvent?.processed_status === 'processed') {
      if (existingEvent.webhook_event_hash && existingEvent.webhook_event_hash !== hash) {
        console.warn(`[acuity/webhook] duplicate event hash drift action=${action} apptId=${apptId}`);
      }
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const eventPatch = {
      tenant_id:              tenantId,
      webhook_event_hash:    hash,
      acuity_appointment_id: String(apptId),
      action,
      calendar_id:           String(body.calendarID || ''),
      appointment_type_id:   String(body.appointmentTypeID || ''),
      signature_valid:       signature.valid,
      raw_payload_json:      body,
      processed_status:      'pending',
    };
    const eventWrite = existingEvent?.id
      ? db.from('acuity_events').update(eventPatch).eq('id', existingEvent.id)
      : db.from('acuity_events').insert({ ...eventPatch, created_at: new Date().toISOString() });
    const { data: eventRow } = await eventWrite.select().single();
    const eventId = eventRow?.id;

    // Events GFE appointment type ids — loaded once per invocation (ET3).
    const eventsGfeTypeIds = await loadEventsGfeTypeIds(db);

    // 2. canceled — flip status on the canonical row, refund any redeemed
    //    visit credit, and send a PHI-free cancellation SMS. Done (no Acuity
    //    fetch needed; the canonical row already has contact/time in payload).
    if (action === 'canceled') {
      // Events GFE cancel → gfe_status scheduled→invited reset, then return
      // early (never the mobile-IV cancel flow). The cancel payload carries
      // appointmentTypeID but no email, so matching is pointer-only here.
      if (isEventsGfeAppointment(body, eventsGfeTypeIds)) {
        return processEventsGfeAppointment(db, { apptId, action, email: '', tenantId, eventId, res });
      }

      // Load the canonical row first so we can: (a) refund a redeemed credit
      // tied to it, and (b) pull a phone/time for the SMS.
      const { data: canceledRow } = await db.from('appointments')
        .select('id, external_payload')
        .eq('acuity_appointment_id', String(apptId))
        .maybeSingle();

      await db.from('appointments')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('acuity_appointment_id', String(apptId));

      // Refund a redeemed visit credit, if this visit consumed one. The
      // redemption ledger row is linked by appointment_id (set at fulfillment
      // in stripe/webhook.js → redeemMemberCredit). Idempotent per appointment.
      if (canceledRow?.id) {
        try {
          const redemption = await findRedemptionForAppointment(db, {
            tenantId, appointmentId: canceledRow.id,
          });
          if (redemption) {
            const refundUnits = Math.abs(Number(redemption.units || 0)) || 1;
            await refundMemberCredit(db, {
              tenantId,
              profileId: redemption.profile_id || null,
              email: redemption.member_email || '',
              appointmentId: canceledRow.id,
              units: refundUnits,
              creditValueCents: Number(redemption.credit_value_cents || 0),
              source: 'credit_refund_cancellation',
              description: 'Visit credit refunded (canceled visit)',
              externalPayload: { acuityAppointmentId: String(apptId), redemptionLedgerId: redemption.id },
            });
            await writeAuditEvent(db, {
              tenantId, action: 'member_credit_refunded_cancellation',
              entityType: 'appointment', entityId: canceledRow.id, phiTouched: false,
              payload: { acuityAppointmentId: String(apptId), units: refundUnits },
            });
          }
        } catch (refundErr) {
          console.warn('[acuity/webhook] credit refund on cancel failed', safeLogContext(refundErr, 'credit_refund_failed'));
        }
      }

      if (eventId) await db.from('acuity_events')
        .update({ processed_status: 'processed', processed_at: new Date().toISOString() }).eq('id', eventId);
      await writeAuditEvent(db, {
        tenantId, action: 'acuity_webhook_appointment_canceled',
        entityType: 'appointment', entityId: canceledRow?.id || null, phiTouched: true,
        payload: { acuityAppointmentId: String(apptId), webhookEventHash: hash },
      });

      // PHI-free cancellation SMS (best-effort, idempotent, never throws).
      await sendTransactionalSms(db, {
        tenantId,
        appointmentRecordId: canceledRow?.id || null,
        acuityAppointmentId: apptId,
        action: 'canceled',
        phone: phoneFromStoredRow(canceledRow?.external_payload || {}),
        whenLabel: '', // no time in cancellation copy
      });

      return res.status(200).json({ ok: true, action: 'canceled' });
    }

    // 3. scheduled / rescheduled / changed — fetch full appt then upsert canonical row.
    let appt;
    try {
      appt = await withTimeout(getAppointment(apptId), 'acuity appointment fetch');
    } catch (err) {
      if (eventId) {
        await db.from('acuity_events').update({
          processed_status: 'failed', error_message: safeErrorCode(err, 'appointment_fetch_failed'), processed_at: new Date().toISOString(),
        }).eq('id', eventId);
        await db.from('reconciliation_cases').insert(buildReconciliationCase({
          caseType: 'appointment_drift', provider: 'acuity',
          externalReference: String(apptId), payload: {
            action,
            eventId,
            errorCode: safeErrorCode(err, 'appointment_fetch_failed'),
            errorStatus: err?.statusCode || err?.status || null,
          },
          tenantId,
        }));
      }
      console.error('[acuity/webhook] fetch appt failed', safeLogContext(err, 'appointment_fetch_failed'));
      return res.status(200).json({ ok: true, note: 'appt_fetch_failed' });
    }

    // Events GFE scheduled/rescheduled/changed → gfe_status invited→scheduled,
    // then return early — events GFE appointments never enter the mobile-IV
    // canonical upsert/SMS/CRM/burndown flow below.
    if (isEventsGfeAppointment(appt, eventsGfeTypeIds)) {
      return processEventsGfeAppointment(db, { apptId, action, email: appt.email || '', tenantId, eventId, res });
    }

    const appointmentRecordId = await upsertAppointment(db, appt, action);
    if (appointmentRecordId) {
      await writeAuditEvent(db, {
        tenantId, action: `acuity_webhook_appointment_${action}`,
        entityType: 'appointment', entityId: appointmentRecordId, phiTouched: true,
        payload: { acuityAppointmentId: String(apptId), webhookEventHash: hash },
      });

      // GFE: sync any GFE on the Acuity form → patient profile, and auto-assign
      // a Qualiphy exam when the category toggle is on. Best-effort — wrapped so
      // it can never break the canonical appointment sync above.
      try {
        const { data: row } = await db.from('appointments')
          .select('id, tenant_id, acuity_appointment_id, external_payload')
          .eq('id', appointmentRecordId).maybeSingle();
        if (row) {
          const baseUrl = (process.env.PUBLIC_SITE_URL || 'https://snooches.avalonvitality.co').replace(/\/$/, '');
          await gfeSyncAndAssign({ db, appt, appointmentRow: row, tenantId, baseUrl, action });
        }
      } catch (gfeErr) {
        console.warn('[acuity/webhook] gfe sync/assign failed', safeLogContext(gfeErr, 'gfe_sync_assign_failed'));
      }
    }

    // CRM sync — non-blocking, contact only (no clinical detail).
    if (appt.email) {
      upsertAttioPerson({
        firstName: appt.firstName, lastName: appt.lastName, email: appt.email, phone: appt.phone,
        source: 'Acuity', lifecycleStage: 'Booked', service: appt.type || 'IV Therapy',
      }).catch(async (e) => {
        console.warn('[acuity/webhook] Attio sync failed', safeLogContext(e, 'attio_sync_failed'));
        try {
          await insertReconciliationCaseOnce(db, buildReconciliationCase({
            caseType: 'crm_sync_failed',
            provider: 'attio',
            externalReference: String(apptId),
            tenantId,
            payload: {
              appointmentRecordId,
              acuityAppointmentId: String(apptId),
              action,
              eventId,
              errorCode: safeErrorCode(e, 'attio_sync_failed'),
              errorStatus: e?.statusCode || e?.status || null,
            },
          }));
        } catch (err) {
          console.warn('[acuity/webhook] reconciliation insert failed', safeLogContext(err, 'reconciliation_insert_failed'));
        }
      });
      upsertHubspotContact({
        firstName: appt.firstName, lastName: appt.lastName, email: appt.email, phone: appt.phone,
        source: 'Acuity', lifecycleStage: 'Booked',
      }).catch(async (e) => {
        console.warn('[acuity/webhook] HubSpot sync failed', safeLogContext(e, 'hubspot_sync_failed'));
        try {
          await insertReconciliationCaseOnce(db, buildReconciliationCase({
            caseType: 'crm_sync_failed',
            provider: 'hubspot',
            externalReference: String(apptId),
            tenantId,
            payload: {
              appointmentRecordId,
              acuityAppointmentId: String(apptId),
              action,
              eventId,
              errorCode: safeErrorCode(e, 'hubspot_sync_failed'),
              errorStatus: e?.statusCode || e?.status || null,
            },
          }));
        } catch (err) {
          console.warn('[acuity/webhook] hubspot reconciliation insert failed', safeLogContext(err, 'reconciliation_insert_failed'));
        }
      });
    }

    // Inventory burndown — decrement stock for the IV/add-ons this visit
    // consumed. Acuity doesn't fire a discrete `completed` event in our
    // current setup, so we treat "scheduled/rescheduled/changed AND the
    // appointment start time has already passed" as the completion signal.
    // Idempotent (keyed by appointment_id in inventory_consumption_events) so
    // re-fires are safe. Wrapped — must never break the webhook.
    if (appointmentRecordId) {
      try {
        const startIso = appt.datetime || appt.date || null;
        const startMs = startIso ? new Date(startIso).getTime() : NaN;
        const startHasPassed = Number.isFinite(startMs) && startMs <= Date.now();
        if (startHasPassed) {
          const { data: apptRow } = await db.from('appointments')
            .select('id, tenant_id, external_payload')
            .eq('id', appointmentRecordId)
            .maybeSingle();
          if (apptRow) {
            await decrementForAppointment({ db, appointment: apptRow });
          }
        }
      } catch (burndownErr) {
        console.warn('[acuity/webhook] inventory burndown failed', safeLogContext(burndownErr, 'inventory_burndown_failed'));
      }
    }

    // PHI-free transactional SMS on scheduled / rescheduled (changed = silent;
    // it's an internal edit, not a member-facing time change). Best-effort,
    // idempotent per (appointment + action), never throws.
    if (action === 'scheduled' || action === 'rescheduled') {
      await sendTransactionalSms(db, {
        tenantId,
        appointmentRecordId,
        acuityAppointmentId: apptId,
        action,
        phone: phoneFromAppt(appt),
        whenLabel: formatVisitWhen(whenFromAppt(appt)),
      });
    }

    if (eventId) await db.from('acuity_events')
      .update({ processed_status: 'processed', processed_at: new Date().toISOString() }).eq('id', eventId);

    return res.status(200).json({ ok: true, action });
  } catch (err) {
    console.error('[acuity/webhook] unhandled error', safeLogContext(err, 'acuity_webhook_unhandled'));
    return res.status(200).json({
      ok: false,
      code: safeErrorCode(err, 'acuity_webhook_unhandled'),
    });
  }
}
