/**
 * GET/POST /api/cron/post-visit-survey
 *
 * Vercel cron handler — runs daily (suggested 16:00 UTC ≈ 9 AM PT) and sends a
 * one-time NPS + free-text review request to customers whose Avalon visit
 * happened roughly a day ago (24-48h past). Each appointment gets a fresh
 * crypto-secure token; the customer submits via /review?t=<token> with no
 * login required.
 *
 * AUTH: Vercel cron invocations carry `Authorization: Bearer ${CRON_SECRET}`
 * (configured in vercel.json -> crons[].headers, matching expire-credits).
 * Requests without the right secret are rejected with 401. CRON_SECRET MUST
 * be set in Vercel env.
 *
 * SOURCE OF "HAPPENED":
 *   We do NOT mutate the appointments row from here, and we deliberately avoid
 *   the acuity webhook lane. The most reliable available signal is the
 *   appointment's `starts_at` falling 24-48h in the past with `status` not in
 *   {'archived','canceled','no_show'}. If a clearer terminal status exists
 *   later (e.g. 'completed'), the WHERE narrows naturally.
 *
 * IDEMPOTENCY:
 *   - public.reviews has a UNIQUE constraint on appointment_id, so a duplicate
 *     insert is rejected at the DB level.
 *   - We also pre-filter out any appointment that already has a reviews row.
 *   - Hard cap of 200 per run prevents runaway email storms after an outage.
 *
 * RATE / ABUSE:
 *   - The 200/run throttle is the upper bound. A second run in the same day is
 *     a no-op because the previous run inserted the rows already (the unique
 *     constraint blocks reinserts).
 *   - PHI-free email body: first name + a single CTA. The shell is the same
 *     branded chrome as the other customer emails.
 *
 * RETURNS:
 *   { ok, candidates, inserted, sent, skipped, errors[], perTenant: [...] }
 */

import crypto from 'crypto';
import { Resend } from 'resend';
import { getServiceClient } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const MAX_PER_RUN = 200;
const LOOKBACK_HOURS_END = 24;   // "happened at least 24h ago"
const LOOKBACK_HOURS_START = 48; // "happened no more than 48h ago"
const TERMINAL_EXCLUDE = new Set(['archived', 'canceled', 'cancelled', 'no_show']);

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return Boolean(match && match[1].trim() === expected);
}

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function fromAddress() {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (from) return from;
  if (isProductionRuntime()) {
    throw Object.assign(new Error('RESEND_FROM_EMAIL is required in production.'), {
      code: 'resend_from_email_missing',
    });
  }
  return 'Avalon Vitality <onboarding@resend.dev>';
}

function siteBase() {
  return String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

function reviewUrl(token) {
  const base = siteBase();
  const path = `/review?t=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function firstName(name) {
  if (!name || typeof name !== 'string') return 'there';
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function newToken() {
  // 24 bytes → 48 hex chars. Crypto-secure, unguessable, single-use.
  return crypto.randomBytes(24).toString('hex');
}

function surveyHtml({ greetingName, href }) {
  const safeName = escapeHtml(greetingName);
  const safeHref = escapeHtml(href);
  // PHI-free by contract: first name + generic "visit" reference + CTA. The
  // shell mirrors api/_lib/billing-emails.js so this email matches the rest of
  // the Avalon brand chrome.
  return `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#111;">
      <p style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#888;margin:0 0 14px;">Avalon Vitality</p>
      <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px;">How was your visit, ${safeName}?</h1>
      <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 18px;">
        Thanks for choosing Avalon. We'd love a quick rating (one to ten) and a sentence about how it went — it takes under a minute and shapes how we show up.
      </p>
      <p style="margin:0 0 28px;">
        <a href="${safeHref}" style="display:inline-block;background:#111;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;">
          Leave a review
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 14px;" />
      <p style="font-size:11px;color:#888;line-height:1.5;margin:0;">
        Avalon Vitality &bull; San Francisco, CA<br />
        Questions? Reply to this email or write to support@avalonvitality.co.
      </p>
    </div>
  `;
}

function surveyText({ greetingName, href }) {
  return `How was your visit, ${greetingName}?

Thanks for choosing Avalon. We'd love a quick rating (1-10) and a sentence about how it went — under a minute.

Leave a review: ${href}

Questions? Reply to this email or write to support@avalonvitality.co.`;
}

// Resolve the recipient + display name from the appointment's stored payload.
// Same shape that admin/bookings.js reads (contact.email / contact.name) so
// nothing new gets persisted on the appointment.
function recipientFromAppointment(row) {
  const payload = row?.external_payload || {};
  const contact = payload.contact || {};
  const email = String(contact.email || '').trim().toLowerCase();
  const name = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  return { email, name };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'cron_secret_missing_or_invalid' });
  }

  const db = await getServiceClient();
  if (!db) {
    return res.status(503).json({ error: 'Supabase is not configured', code: 'supabase_unconfigured' });
  }

  const startedAt = new Date();
  const now = startedAt.getTime();
  const windowEnd = new Date(now - LOOKBACK_HOURS_END * 60 * 60 * 1000).toISOString();
  const windowStart = new Date(now - LOOKBACK_HOURS_START * 60 * 60 * 1000).toISOString();

  // Cap candidate fetch generously above MAX_PER_RUN so the dedupe filter
  // doesn't strand candidates beneath the cap.
  const FETCH_LIMIT = MAX_PER_RUN * 3;

  try {
    const { data: candidates, error: candidatesErr } = await db
      .from('appointments')
      .select('id, tenant_id, status, starts_at, external_payload, patient_person_id, customer_person_id')
      .gte('starts_at', windowStart)
      .lte('starts_at', windowEnd)
      .order('starts_at', { ascending: true })
      .limit(FETCH_LIMIT);
    if (candidatesErr) throw candidatesErr;

    const eligible = (candidates || []).filter((row) => !TERMINAL_EXCLUDE.has(String(row.status || '').toLowerCase()));

    // Pre-filter appointments that already have a reviews row. One round trip
    // with the .in() filter avoids N+1 lookups inside the loop.
    let existingIds = new Set();
    if (eligible.length > 0) {
      const ids = eligible.map((r) => r.id);
      try {
        const { data: existingRows, error: existingErr } = await db
          .from('reviews')
          .select('appointment_id')
          .in('appointment_id', ids);
        if (existingErr) throw existingErr;
        existingIds = new Set((existingRows || []).map((r) => r.appointment_id));
      } catch (err) {
        // If the table is missing (migration not applied), abort the run gently.
        const code = safeErrorCode(err, 'reviews_table_missing');
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('does not exist') || msg.includes('could not find the table') || code === '42p01' || code === 'pgrst205') {
          return res.status(503).json({
            error: 'Reviews table not migrated yet.',
            code: 'migration_required',
          });
        }
        throw err;
      }
    }

    const toProcess = eligible.filter((r) => !existingIds.has(r.id)).slice(0, MAX_PER_RUN);

    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    let inserted = 0;
    let sent = 0;
    let skipped = 0;
    const errors = [];
    const perTenant = new Map(); // tenantId -> { inserted, sent, skipped }

    function bump(tenantId, key) {
      const tally = perTenant.get(tenantId) || { inserted: 0, sent: 0, skipped: 0 };
      tally[key] += 1;
      perTenant.set(tenantId, tally);
    }

    // Resolve the profile_id for the visit recipient (people.profile_id ties
    // the person row to an auth.users row). Best-effort — null is fine, the
    // public submit page works off the token alone.
    async function resolveProfileId(row) {
      const personId = row.patient_person_id || row.customer_person_id || null;
      if (!personId) return null;
      try {
        const { data } = await db.from('people').select('profile_id').eq('id', personId).maybeSingle();
        return data?.profile_id || null;
      } catch { return null; }
    }

    for (const row of toProcess) {
      const { email, name } = recipientFromAppointment(row);
      if (!email) {
        skipped += 1;
        bump(row.tenant_id, 'skipped');
        continue;
      }
      const token = newToken();
      const profileId = await resolveProfileId(row);

      // Insert FIRST. If the unique constraint on appointment_id fires (race),
      // we treat this candidate as already-handled and skip the email.
      try {
        const { error: insertErr } = await db.from('reviews').insert({
          tenant_id: row.tenant_id,
          appointment_id: row.id,
          profile_id: profileId,
          email,
          token,
        });
        if (insertErr) {
          const code = String(insertErr.code || '').toLowerCase();
          if (code === '23505') {
            // Duplicate — another run/instance already inserted. Skip silently.
            skipped += 1;
            bump(row.tenant_id, 'skipped');
            continue;
          }
          throw insertErr;
        }
        inserted += 1;
        bump(row.tenant_id, 'inserted');
      } catch (err) {
        errors.push({ appointmentId: row.id, code: safeErrorCode(err, 'review_insert_failed') });
        console.warn('[cron/post-visit-survey] insert failed', safeLogContext(err, 'review_insert_failed'));
        continue;
      }

      // Send the email. Best-effort: a Resend failure leaves the reviews row
      // intact (no resend in this loop) and is logged. The row's token stays
      // valid in case the admin needs to recover.
      if (!resend) {
        // No Resend configured — the row exists, just no email.
        continue;
      }
      try {
        const href = reviewUrl(token);
        const greetingName = firstName(name);
        const result = await resend.emails.send({
          from: fromAddress(),
          to: email,
          subject: 'How was your visit?',
          html: surveyHtml({ greetingName, href }),
          text: surveyText({ greetingName, href }),
        });
        if (result?.error) throw Object.assign(new Error(result.error.message || 'Resend rejected the survey email'), { cause: result.error });
        sent += 1;
        bump(row.tenant_id, 'sent');
      } catch (err) {
        errors.push({ appointmentId: row.id, code: safeErrorCode(err, 'review_email_failed') });
        console.warn('[cron/post-visit-survey] send failed', safeLogContext(err, 'review_email_failed'));
      }
    }

    await writeAuditEvent(db, {
      tenantId: null,
      actorProfileId: null,
      action: 'post_visit_survey_sweep',
      entityType: 'reviews',
      phiTouched: false,
      payload: {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        candidates: (candidates || []).length,
        eligible: eligible.length,
        toProcess: toProcess.length,
        inserted,
        sent,
        skipped,
        errorCount: errors.length,
        perTenant: Array.from(perTenant.entries()).map(([tenantId, t]) => ({ tenantId, ...t })),
      },
    });

    return res.status(200).json({
      ok: true,
      candidates: (candidates || []).length,
      eligible: eligible.length,
      inserted,
      sent,
      skipped,
      errors,
      perTenant: Array.from(perTenant.entries()).map(([tenantId, t]) => ({ tenantId, ...t })),
    });
  } catch (err) {
    console.warn('[cron/post-visit-survey] sweep failed', safeLogContext(err, 'cron_post_visit_survey_failed'));
    return res.status(500).json({
      error: 'Post-visit survey sweep failed.',
      code: safeErrorCode(err, 'cron_post_visit_survey_failed'),
    });
  }
}
