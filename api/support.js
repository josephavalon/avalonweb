/**
 * /api/support — public customer support ticket intake.
 *
 * Anyone (signed-in or not) can open a ticket from /support. We store the FULL
 * ticket in Supabase (BAA-covered) and email support@ only a PHI-FREE
 * notification: id + category + subject + contact-if-given + an admin deep link.
 * The free-text `message` may contain PHI, so it must NEVER appear in any Resend
 * payload — staff read it from /admin/support-tickets. This mirrors the
 * store-then-notify posture in docs/PHI_DATA_FLOW.md (comm_threads, reviews).
 *
 * Tickets may be submitted anonymously: when `anonymous` is set we drop name +
 * email entirely (and send no acknowledgment, since we have nowhere to reply).
 */
import { Resend } from 'resend';
import { checkRateLimit, clientIp } from './_lib/rate-limit.js';
import { getServiceClient } from './_lib/supabase-auth.js';
import { writeAuditEvent } from './_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from './_lib/safe-error.js';

const resend = new Resend(process.env.RESEND_API_KEY);

function supportToAddress() {
  return String(process.env.SUPPORT_EMAIL || '').trim() || 'support@avalonvitality.co';
}

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

// `from` must be a verified Resend sender — reuse the shared RESEND_FROM_EMAIL.
function fromAddress() {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (from) return from;
  if (isProductionRuntime()) {
    throw Object.assign(new Error('RESEND_FROM_EMAIL is required in production.'), {
      code: 'resend_from_email_missing',
      status: 500,
    });
  }
  return 'Avalon Vitality <onboarding@resend.dev>';
}

function adminLink() {
  const base = String(process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  return `${base}/admin/support-tickets`;
}

// --- Config ------------------------------------------------------------------

const MAX_LEN = {
  name: 120,
  email: 254, // RFC 5321
  subject: 160,
  message: 5000,
};

const ALLOWED_CATEGORIES = new Set(['billing', 'booking', 'general', 'feedback', 'other']);

const RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
};

// --- Validation --------------------------------------------------------------

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function looksLikeSpam(str) {
  const links = (String(str).match(/https?:\/\//gi) || []).length;
  if (links >= 4) return true; // tickets legitimately may carry a link or two
  if (/<script|onerror=|javascript:/i.test(str)) return true;
  return false;
}

function truncate(str, max) {
  const s = String(str || '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

// A missing table/column means the migration hasn't been applied yet.
function isMissingRelation(err) {
  const code = String(err?.code || '');
  // 42P01 undefined_table, 42703 undefined_column (Postgres / PostgREST)
  if (code === '42P01' || code === '42703') return true;
  return /relation .* does not exist|could not find the table|schema cache/i.test(String(err?.message || ''));
}

// --- Handler ----------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit first — cheapest check.
  const ip = clientIp(req);
  const limit = await checkRateLimit({
    key: `support:${ip}`,
    windowMs: RATE_LIMIT.windowMs,
    max: RATE_LIMIT.max,
  });
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    // Honeypot: hidden `website` field filled → bot. Pretend success, do nothing.
    if (body.website) {
      return res.status(200).json({ success: true });
    }

    const anonymous = body.anonymous === true || body.anonymous === 'true';
    const categoryRaw = truncate(body.category, 40).toLowerCase();
    const category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : 'general';
    const subject = truncate(body.subject, MAX_LEN.subject);
    const message = truncate(body.message, MAX_LEN.message);
    const name = anonymous ? '' : truncate(body.name, MAX_LEN.name);
    const email = anonymous ? '' : truncate(body.email, MAX_LEN.email).toLowerCase();

    // Required: a message always. Contact is required only when NOT anonymous —
    // we need a reply address (and to send the acknowledgment).
    if (!message) {
      return res.status(400).json({ error: 'Please include a message.' });
    }
    if (!anonymous) {
      if (!email) return res.status(400).json({ error: 'Add an email so we can reply, or submit anonymously.' });
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });
    }

    // Spam content filter across free-text fields.
    for (const field of [subject, message, name]) {
      if (field && looksLikeSpam(field)) {
        return res.status(400).json({ error: 'Submission flagged. Please email support@avalonvitality.co directly.' });
      }
    }

    const db = await getServiceClient();
    if (!db) {
      // Supabase unconfigured — we cannot persist, and PHI must not ride email.
      console.warn('Support intake unavailable: no service client');
      return res.status(503).json({ error: 'Support is temporarily unavailable. Please try again.' });
    }

    // Default tenant (matches getDefaultTenantId in supabase-auth.js).
    let tenantId = null;
    try {
      const { data: t } = await db.from('tenants').select('id').eq('slug', 'avalon-vitality').maybeSingle();
      tenantId = t?.id || null;
    } catch { /* leave null; column is nullable */ }

    // --- Persist the full ticket (PHI lives here, never in email) ----------
    const insertRow = {
      tenant_id: tenantId,
      category,
      subject: subject || null,
      message,
      is_anonymous: anonymous,
      name: name || null,
      email: email || null,
      source_ip: ip || null,
      status: 'open',
    };

    const { data: inserted, error: insErr } = await db
      .from('support_tickets')
      .insert(insertRow)
      .select('id, created_at')
      .single();

    if (insErr) {
      if (isMissingRelation(insErr)) {
        console.warn('support_tickets table missing — apply migration 033', safeLogContext(insErr, 'support_migration_required'));
        return res.status(503).json({ error: 'Support is temporarily unavailable. Please try again.', code: 'migration_required' });
      }
      console.error('Support ticket insert failed', safeLogContext(insErr, 'support_insert_failed'));
      return res.status(500).json({ error: 'Could not submit your ticket. Please try again.' });
    }

    const ticketId = inserted?.id || '';
    const shortId = ticketId ? ticketId.slice(0, 8) : '—';

    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: null,
      action: 'support_ticket_created',
      entityType: 'support_tickets',
      entityId: ticketId || null,
      phiTouched: true,
      payload: { category, anonymous },
    });

    // --- PHI-FREE notification to support@ --------------------------------
    // Deliberately excludes `message`. Only metadata + a deep link.
    const safeCategory = escapeHtml(category);
    const safeSubject = escapeHtml(subject || '(no subject)');
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeShortId = escapeHtml(shortId);
    const link = adminLink();

    const notifyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0a0a0a;">
        <h2 style="font-size: 20px; margin: 0 0 16px;">New support ticket</h2>
        <p><strong>Ticket:</strong> #${safeShortId}</p>
        <p><strong>Category:</strong> ${safeCategory}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>From:</strong> ${anonymous ? '<em>Anonymous</em>' : `${safeName || '<em>No name</em>'} &lt;<a href="mailto:${safeEmail}">${safeEmail}</a>&gt;`}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 14px;">
          The message is stored securely and is not included in this email.
          <a href="${escapeHtml(link)}">Open the ticket in the admin console</a> to read and respond.
        </p>
        <p style="font-size: 11px; color: #888;">Submitted ${new Date().toISOString()}</p>
      </div>
    `;

    // Internal notification must succeed (it's the staff signal). The message
    // is safely persisted regardless, so a failure here is non-fatal for the
    // user — but we surface it so the form can show a soft warning if desired.
    let notifyOk = true;
    try {
      const sendResult = await resend.emails.send({
        from: fromAddress(),
        to: supportToAddress(),
        replyTo: email || undefined,
        subject: `New support ticket — ${category} (#${shortId})`,
        html: notifyHtml,
      });
      if (sendResult?.error) {
        notifyOk = false;
        console.warn('Support notification email failed', safeLogContext(sendResult.error, 'support_notify_failed'));
      }
    } catch (err) {
      notifyOk = false;
      console.warn('Support notification email threw', safeLogContext(err, 'support_notify_threw'));
    }

    // --- Acknowledgment to the submitter (non-anonymous only) -------------
    // Fire-and-forget; PHI-free boilerplate.
    if (!anonymous && email) {
      const ackHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0a0a0a;">
          <p>Hi ${safeName || 'there'},</p>
          <p>Thanks for reaching out to Avalon Vitality. We've received your support request (ticket #${safeShortId}) and our team will get back to you within one business day.</p>
          <p style="margin-top: 24px;">— The Avalon Vitality Team</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
          <p style="font-size: 11px; color: #888; line-height: 1.5;">
            Avalon Vitality &bull; San Francisco, CA<br />
            This is an automated confirmation. Reply to this email to add to your ticket.
          </p>
        </div>
      `;
      try {
        await resend.emails.send({
          from: fromAddress(),
          to: email,
          replyTo: supportToAddress(),
          subject: `We received your request (#${shortId})`,
          html: ackHtml,
        });
      } catch (err) {
        console.warn('Support acknowledgment email failed', safeLogContext(err, 'support_ack_failed'));
      }
    }

    return res.status(200).json({ success: true, ticketId: shortId, notified: notifyOk });
  } catch (error) {
    console.error('Support handler error', safeLogContext(error, 'support_handler_failed'));
    return res.status(500).json({ error: 'Failed to submit your ticket.', code: safeErrorCode(error, 'support_handler_failed') });
  }
}
