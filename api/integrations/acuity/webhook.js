/**
 * POST /api/integrations/acuity/webhook
 *
 * Receives Acuity Scheduling webhook events and syncs them into Avalon OS.
 *
 * Acuity webhook configuration:
 *   Dashboard → Integrations → Webhooks → Add Webhook
 *   URL: https://<your-domain>/api/integrations/acuity/webhook
 *   Events: scheduled, rescheduled, canceled, changed
 *
 * Idempotency: events are deduplicated by
 *   (acuity_appointment_id + action + hash of raw payload)
 *
 * Storage:
 *   Events are written to the `acuity_events` table in Supabase.
 *   Bookings are written to the `bookings` table.
 *   Customers are found-or-created in the `users` + `customer_profiles` tables.
 *
 *   Until Supabase is wired, events are logged to console and returned 200
 *   so Acuity does not retry endlessly.
 */

import crypto from 'crypto';
import { getAppointment } from '../../_acuity.js';

// ── Supabase client (initialised lazily once env is available) ─────────────
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // DB not yet wired — graceful fallback
  // Dynamic import so the module doesn't hard-fail in environments without the package
  const { createClient } = require('@supabase/supabase-js');
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function payloadHash(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

function appointmentToBooking(appt) {
  return {
    source:                       'acuity',
    external_provider:            'acuity',
    external_appointment_id:      String(appt.id),
    external_calendar_id:         String(appt.calendarID || ''),
    external_appointment_type_id: String(appt.appointmentTypeID || ''),
    scheduled_at:                 appt.datetime || appt.date,
    status:                       'scheduled',
    customer_name:                `${appt.firstName || ''} ${appt.lastName || ''}`.trim(),
    customer_email:               appt.email  || null,
    customer_phone:               appt.phone  || null,
    service_name:                 appt.type   || null,
    location:                     appt.location || null,
    notes:                        appt.notes  || null,
    raw_external_json:            appt,
  };
}

// ── Main handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Acuity sends POST; respond quickly so it doesn't retry
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body   = req.body || {};
  const action = body.action; // scheduled | rescheduled | canceled | changed
  const apptId = body.id;

  if (!action || !apptId) {
    return res.status(400).json({ error: 'Missing action or appointment id' });
  }

  const hash = payloadHash(body);

  // ── Respond immediately — process async below ──────────────────────────
  // (Vercel functions are synchronous; this pattern logs and returns 200 fast)
  console.log(`[acuity/webhook] action=${action} apptId=${apptId} hash=${hash}`);

  const db = getSupabase();

  if (!db) {
    // Supabase not yet configured — log and return 200 so Acuity doesn't retry
    console.warn('[acuity/webhook] Supabase not configured — event logged only');
    return res.status(200).json({ ok: true, queued: false, note: 'db_not_configured' });
  }

  try {
    // ── 1. Deduplicate ─────────────────────────────────────────────────────
    const { data: existing } = await db
      .from('acuity_events')
      .select('id, processed_status')
      .eq('acuity_appointment_id', String(apptId))
      .eq('action', action)
      .eq('webhook_event_hash', hash)
      .maybeSingle();

    if (existing && existing.processed_status === 'processed') {
      console.log(`[acuity/webhook] duplicate skipped id=${existing.id}`);
      return res.status(200).json({ ok: true, duplicate: true });
    }

    // ── 2. Persist raw event ───────────────────────────────────────────────
    const { data: eventRow, error: eventErr } = await db
      .from('acuity_events')
      .upsert({
        webhook_event_hash:       hash,
        acuity_appointment_id:    String(apptId),
        action,
        calendar_id:              String(body.calendarID || ''),
        appointment_type_id:      String(body.appointmentTypeID || ''),
        raw_payload_json:         body,
        processed_status:         'pending',
        created_at:               new Date().toISOString(),
      }, { onConflict: 'webhook_event_hash', ignoreDuplicates: false })
      .select()
      .single();

    if (eventErr) {
      console.error('[acuity/webhook] event insert error', eventErr.message);
      return res.status(200).json({ ok: true, note: 'event_log_failed' });
    }

    const eventId = eventRow?.id;

    // ── 3. Fetch full appointment from Acuity ──────────────────────────────
    let appt;
    try {
      appt = await getAppointment(apptId);
    } catch (err) {
      await db.from('acuity_events').update({
        processed_status: 'failed',
        error_message:    err.message,
        processed_at:     new Date().toISOString(),
      }).eq('id', eventId);
      console.error('[acuity/webhook] fetch appt failed', err.message);
      return res.status(200).json({ ok: true, note: 'appt_fetch_failed' });
    }

    // ── 4. canceled ────────────────────────────────────────────────────────
    if (action === 'canceled') {
      await db.from('bookings')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('external_appointment_id', String(apptId));

      await db.from('acuity_events').update({
        processed_status: 'processed',
        processed_at:     new Date().toISOString(),
      }).eq('id', eventId);

      console.log(`[acuity/webhook] canceled booking apptId=${apptId}`);
      return res.status(200).json({ ok: true, action: 'canceled' });
    }

    // ── 5. Find or create customer ─────────────────────────────────────────
    let customerId = null;
    const email = appt.email?.trim().toLowerCase() || null;
    const phone = (appt.phone || '').replace(/\D/g, '').slice(-10) || null;

    if (email) {
      const { data: existingUser } = await db
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        customerId = existingUser.id;
      }
    }

    if (!customerId && phone) {
      const { data: existingUser } = await db
        .from('users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (existingUser) customerId = existingUser.id;
    }

    if (!customerId) {
      // Create a new customer user from Acuity data
      const isBeta = email?.endsWith('@beta.avalon.local') || false;
      const { data: newUser, error: userErr } = await db
        .from('users')
        .insert({
          role:           'customer',
          email,
          phone,
          first_name:     appt.firstName || null,
          last_name:      appt.lastName  || null,
          display_name:   `${appt.firstName || ''} ${appt.lastName || ''}`.trim() || 'Guest',
          status:         'active',
          source:         'acuity',
          is_beta_user:   isBeta,
          is_demo_user:   isBeta,
          environment:    isBeta ? 'beta' : 'production',
          created_at:     new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        })
        .select('id')
        .single();

      if (userErr) {
        console.error('[acuity/webhook] user create error', userErr.message);
      } else {
        customerId = newUser?.id;
        // Create customer_profile row
        if (customerId) {
          await db.from('customer_profiles').insert({
            user_id:       customerId,
            customer_type: 'registered',
            created_at:    new Date().toISOString(),
            updated_at:    new Date().toISOString(),
          });
        }
      }
    }

    // ── 6. rescheduled — update existing booking ──────────────────────────
    if (action === 'rescheduled') {
      const { data: existing } = await db
        .from('bookings')
        .select('id, scheduled_at')
        .eq('external_appointment_id', String(apptId))
        .maybeSingle();

      if (existing) {
        await db.from('bookings').update({
          scheduled_at:                 appt.datetime || appt.date,
          external_calendar_id:         String(appt.calendarID || ''),
          external_appointment_type_id: String(appt.appointmentTypeID || ''),
          service_name:                 appt.type || null,
          notes:                        appt.notes || null,
          raw_external_json:            appt,
          updated_at:                   new Date().toISOString(),
        }).eq('id', existing.id);

        console.log(`[acuity/webhook] rescheduled booking id=${existing.id}`);
      } else {
        // No prior booking — treat as new scheduled
        await createBooking(db, appt, customerId);
      }

      await db.from('acuity_events').update({
        processed_status: 'processed',
        processed_at:     new Date().toISOString(),
      }).eq('id', eventId);

      return res.status(200).json({ ok: true, action: 'rescheduled' });
    }

    // ── 7. scheduled / changed — upsert booking ───────────────────────────
    await createBooking(db, appt, customerId);

    await db.from('acuity_events').update({
      processed_status: 'processed',
      processed_at:     new Date().toISOString(),
    }).eq('id', eventId);

    console.log(`[acuity/webhook] processed action=${action} apptId=${apptId}`);
    return res.status(200).json({ ok: true, action });

  } catch (err) {
    console.error('[acuity/webhook] unhandled error', err.message);
    // Still return 200 — we don't want Acuity to retry storms
    return res.status(200).json({ ok: false, error: err.message });
  }
}

// ── Upsert booking ─────────────────────────────────────────────────────────
async function createBooking(db, appt, customerId) {
  const booking = {
    ...appointmentToBooking(appt),
    customer_user_id: customerId || null,
    updated_at:       new Date().toISOString(),
  };

  const { data: existing } = await db
    .from('bookings')
    .select('id')
    .eq('external_appointment_id', String(appt.id))
    .maybeSingle();

  if (existing) {
    await db.from('bookings').update({
      ...booking,
      created_at: undefined, // don't overwrite original created_at
    }).eq('id', existing.id);
  } else {
    await db.from('bookings').insert({
      ...booking,
      created_at: new Date().toISOString(),
    });
  }
}
