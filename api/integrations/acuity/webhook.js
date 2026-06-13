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
import { requireLiveWebhook } from '../../_lib/pre-api-guard.js';
import { buildReconciliationCase } from '../../_reconciliation.js';
import { upsertAttioPerson } from '../../_attio.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '64kb',
    },
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

function payloadHash(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

function parsedPayloadSize(body = {}) {
  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
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

function verifyWebhookSignature(req, body) {
  const secret = process.env.ACUITY_WEBHOOK_SECRET;
  if (!secret) return { required: false, valid: null };
  const supplied = String(
    req.headers?.['x-acuity-signature']
    || req.headers?.['x-webhook-signature']
    || req.headers?.['x-signature']
    || ''
  ).replace(/^sha256=/i, '');
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  return { required: true, valid: Boolean(supplied) && safeEqual(supplied, expected) };
}

const STATUS_BY_ACTION = {
  scheduled:   'scheduled',
  rescheduled: 'scheduled',
  changed:     'scheduled',
  canceled:    'canceled',
};

// Canonical: upsert public.appointments by acuity_appointment_id (no native
// unique constraint, so select-then-update/insert).
async function upsertAppointment(db, appt, action) {
  const acuityId = String(appt.id);
  const tenantId = await defaultTenantId(db);
  const contact = {
    name: `${appt.firstName || ''} ${appt.lastName || ''}`.trim() || null,
    email: appt.email || null,
    phone: appt.phone || null,
  };
  const now = new Date().toISOString();
  const patch = {
    tenant_id:             tenantId,
    acuity_appointment_id: acuityId,
    starts_at:             appt.datetime || appt.date || null,
    status:                STATUS_BY_ACTION[action] || 'scheduled',
    protocol_key:          appt.type || null,
    external_payload:      { provider: 'acuity', action, contact, appointment: appt },
    updated_at:            now,
  };

  const { data, error } = await db.from('appointments')
    .upsert({ ...patch, created_at: now }, {
      onConflict: 'acuity_appointment_id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();
  if (!error) return data?.id || null;

  if (/constraint|conflict/i.test(error.message || '')) {
    const { data: existing } = await db.from('appointments')
      .select('id').eq('acuity_appointment_id', acuityId).maybeSingle();
    if (existing) {
      await db.from('appointments').update(patch).eq('id', existing.id);
      return existing.id;
    }
    const { data: inserted, error: insertError } = await db.from('appointments')
      .insert({ ...patch, created_at: now }).select('id').single();
    if (!insertError) return inserted?.id || null;
  }

  console.error('[acuity/webhook] appointment upsert failed', safeLogContext(error, 'appointment_upsert_failed'));
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireLiveWebhook(req, res, { provider: 'acuity', secretEnv: 'ACUITY_WEBHOOK_SECRET' })) return;

  const body = req.body || {};
  const action = body.action; // scheduled | rescheduled | canceled | changed
  const apptId = body.id;
  const signature = verifyWebhookSignature(req, body);

  if (parsedPayloadSize(body) > ACUITY_WEBHOOK_MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Acuity webhook payload too large', code: 'acuity_webhook_body_too_large' });
  }
  if (!action || !apptId) {
    return res.status(400).json({ error: 'Missing action or appointment id' });
  }
  if (signature.required && !signature.valid) {
    console.warn(`[acuity/webhook] invalid signature action=${action} apptId=${apptId}`);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const hash = payloadHash(body);
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

    // 2. canceled — flip status on the canonical row, done.
    if (action === 'canceled') {
      await db.from('appointments')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('acuity_appointment_id', String(apptId));
      if (eventId) await db.from('acuity_events')
        .update({ processed_status: 'processed', processed_at: new Date().toISOString() }).eq('id', eventId);
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

    await upsertAppointment(db, appt, action);

    // CRM sync — non-blocking, contact only (no clinical detail).
    if (appt.email) {
      upsertAttioPerson({
        firstName: appt.firstName, lastName: appt.lastName, email: appt.email, phone: appt.phone,
        source: 'Acuity', lifecycleStage: 'Booked', service: appt.type || 'IV Therapy',
      }).catch((e) => console.warn('[acuity/webhook] Attio sync failed', safeLogContext(e, 'attio_sync_failed')));
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
