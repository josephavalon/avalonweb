/**
 * /api/admin/email-templates  + shared template store
 *
 * Admin/staff CRUD for the DB-backed customer email template store, PLUS the
 * shared code defaults + send-time override lookup used by the email builder
 * libs. Everything lives here so the defaults are defined exactly once and both
 * the admin UI and the send path agree.
 *
 * Endpoint (default export):
 *   GET   → returns ALL known templates, merging any saved DB rows over the
 *           code defaults so unedited templates still list (enabled=false means
 *           "no override — the hardcoded default is in effect").
 *   PATCH → { key, subject, body_html, enabled } upserts one row.
 *
 * Storage: table `public.email_templates` (key text PK, subject, body_html,
 * enabled bool, updated_at). DEGRADES GRACEFULLY when the table is missing:
 * GET still returns the code defaults; PATCH returns 503 'migration_required'.
 *
 * Send-time helpers (named exports, used by api/_lib/billing-emails.js and
 * api/_welcome-email.js):
 *   getTemplateOverride(key)        → { subject, body_html } | null  (cached)
 *   renderTemplate(html, vars)      → placeholder substitution (PHI-free vars)
 *
 * PHI-free by contract — templates may only use the safe placeholders
 * {{firstName}} {{amount}} {{date}} {{planName}}.
 */

import { Resend } from 'resend';
import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { getServiceClient } from '../_lib/supabase-auth.js';
import { checkRateLimit } from '../_lib/rate-limit.js';

// ---------------------------------------------------------------------------
// Code defaults. Subject/body here are the FALLBACK shown when no enabled DB
// override exists. The body strings are the editable layer ONLY — the email
// builders still wrap them in their branded shell, so these are plain copy
// blocks with placeholders, not full documents.
// ---------------------------------------------------------------------------
const PLACEHOLDER_HINT = ['{{firstName}}', '{{amount}}', '{{date}}', '{{planName}}'];

export const TEMPLATE_DEFAULTS = Object.freeze({
  welcome: {
    label: 'Welcome',
    description: 'Sent once after a new account is confirmed or a first/plan checkout completes.',
    placeholders: ['{{firstName}}'],
    subject: 'Welcome to Avalon Vitality',
    body_html:
      '<p>Your account is live. From your dashboard you can book a visit, view your plan, and message the clinical team. We are glad you are here.</p>',
  },
  booking_confirmed: {
    label: 'Booking confirmed',
    description: 'Sent once a paid visit is scheduled in Acuity.',
    placeholders: ['{{firstName}}'],
    subject: 'Your Avalon visit is confirmed',
    body_html:
      '<p>Hi {{firstName}}, your Avalon visit is confirmed. A registered nurse will arrive at your scheduled time.</p>',
  },
  payment_receipt: {
    label: 'Payment receipt',
    description: 'Branded receipt sent after a successful payment.',
    placeholders: ['{{firstName}}', '{{amount}}', '{{date}}'],
    subject: 'Your Avalon receipt — {{amount}}',
    body_html:
      '<p>Hi {{firstName}}, thank you. This confirms your payment to Avalon Vitality.</p>',
  },
  plan_renewed: {
    label: 'Plan renewed',
    description: 'Sent when a membership renews and visit credits are added.',
    placeholders: ['{{firstName}}', '{{planName}}', '{{amount}}'],
    subject: 'Your {{planName}} plan renewed',
    body_html:
      '<p>Hi {{firstName}}, your {{planName}} plan renewed. We have added your visit credits to your account.</p>',
  },
  payment_failed: {
    label: 'Payment failed',
    description: "Recovery email when a card is declined on a plan charge.",
    placeholders: ['{{firstName}}', '{{planName}}', '{{amount}}'],
    subject: "Your payment didn't go through — update your card",
    body_html:
      "<p>Hi {{firstName}}, we tried to process your payment for your {{planName}} plan and it didn't go through. Please update your card to keep your plan active.</p>",
  },
});

export const TEMPLATE_KEYS = Object.freeze(Object.keys(TEMPLATE_DEFAULTS));

// A missing table surfaces as PostgREST 42P01 / "does not exist". Treat those
// as "not migrated yet" so the feature degrades to code defaults rather than 500.
export function isMissingTableError(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42p01' ||
    code === 'pgrst205' || // PostgREST: table not found in schema cache
    (msg.includes('email_templates') && msg.includes('does not exist')) ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  );
}

// {{placeholder}} substitution. Values are coerced to strings; missing keys are
// rendered empty so a template never leaks a raw {{token}}. Vars MUST be
// PHI-free (firstName, amount, date, planName only).
export function renderTemplate(text = '', vars = {}) {
  return String(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? '' : String(v);
  });
}

// ---------------------------------------------------------------------------
// Send-time override lookup. Cached in-process (short TTL) so a burst of
// webhook sends doesn't hammer the DB. Returns null when there is no enabled
// override, the table is missing, or Supabase isn't configured — callers then
// fall back to their hardcoded default. Never throws.
// ---------------------------------------------------------------------------
const OVERRIDE_TTL_MS = 60 * 1000;
let _cache = null; // { at: number, byKey: Map<key, {subject, body_html}|null> }

async function loadOverrides() {
  const db = await getServiceClient();
  if (!db) return new Map();
  const byKey = new Map();
  try {
    const { data, error } = await db
      .from('email_templates')
      .select('key, subject, body_html, enabled')
      .eq('enabled', true);
    if (error) throw error;
    (data || []).forEach((row) => {
      if (!TEMPLATE_KEYS.includes(row.key)) return;
      if (row.subject || row.body_html) {
        byKey.set(row.key, { subject: row.subject || '', body_html: row.body_html || '' });
      }
    });
  } catch (err) {
    if (!isMissingTableError(err)) {
      console.warn('[email-templates] override load failed', safeLogContext(err, 'email_template_override_load_failed'));
    }
    // Missing table / any error → behave as "no overrides".
  }
  return byKey;
}

/**
 * @param {string} key one of TEMPLATE_KEYS
 * @returns {Promise<{subject:string, body_html:string}|null>} enabled override or null
 */
export async function getTemplateOverride(key) {
  if (!TEMPLATE_KEYS.includes(key)) return null;
  const now = Date.now();
  if (!_cache || now - _cache.at > OVERRIDE_TTL_MS) {
    _cache = { at: now, byKey: await loadOverrides() };
  }
  return _cache.byKey.get(key) || null;
}

// Test/seam hook — clear the in-process cache.
export function _clearTemplateOverrideCache() {
  _cache = null;
}

// ---------------------------------------------------------------------------
// Preview + send-test plumbing. Sample data is PHI-FREE by definition (made-up
// first name, dollar amount, calendar string, plan label). The branded shell
// below mirrors the wrapper used by api/_welcome-email.js and
// api/_lib/billing-emails.js so what a staffer previews/tests looks like the
// real production email — only the editable body block is template-driven, the
// chrome (eyebrow, heading, CTA, footer) stays code-owned and cannot be
// influenced by template HTML.
// ---------------------------------------------------------------------------
const SAMPLE_VARS = Object.freeze({
  firstName: 'Alex',
  amount: '$150',
  date: 'Saturday, July 12 at 2:00 PM',
  planName: 'Hydration · 2 visits/mo',
});

// Per-template chrome (heading + optional CTA) so the preview/test matches what
// each production sender wraps around the override body.
const TEMPLATE_SHELLS = Object.freeze({
  welcome:           { heading: 'Welcome to Avalon Vitality',  cta: { href: '/members/dashboard', label: 'Open your dashboard' } },
  booking_confirmed: { heading: 'Your visit is confirmed',     cta: null },
  payment_receipt:   { heading: 'Payment receipt',             cta: { href: '/members/billing',   label: 'View billing' } },
  plan_renewed:      { heading: 'Your plan renewed',           cta: { href: '/members/billing',   label: 'View billing' } },
  payment_failed:    { heading: 'Update your card',            cta: { href: '/members/billing',   label: 'Update payment method' } },
});

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function brandedShell({ heading, bodyHtml, cta }) {
  const ctaHtml = cta?.href
    ? `<p style="margin:0 0 28px;">
         <a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#111;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;">
           ${escapeHtml(cta.label || 'Open')}
         </a>
       </p>`
    : '';
  return `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#111;">
      <p style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#888;margin:0 0 14px;">Avalon Vitality</p>
      <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px;">${escapeHtml(heading)}</h1>
      ${bodyHtml}
      ${ctaHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 14px;" />
      <p style="font-size:11px;color:#888;line-height:1.5;margin:0;">
        Avalon Vitality &bull; San Francisco, CA<br />
        Questions? Reply to this email or write to support@avalonvitality.co.
      </p>
    </div>
  `;
}

// Render a {key, subject, body_html} draft against sample vars. The body block
// goes through renderTemplate (textual placeholder replace only — no eval, no
// scripting), then is dropped into the branded shell. Returns the wrapped HTML
// + the rendered subject so the UI can show both.
function renderForPreview(key, { subject, body_html, sampleData } = {}) {
  const def = TEMPLATE_DEFAULTS[key] || {};
  const subjectSrc = (typeof subject === 'string' && subject.trim()) ? subject : (def.subject || '');
  const bodySrc = (typeof body_html === 'string' && body_html.trim()) ? body_html : (def.body_html || '');
  const vars = { ...SAMPLE_VARS, ...(sampleData && typeof sampleData === 'object' ? sampleData : {}) };
  const subject_rendered = renderTemplate(subjectSrc, vars);
  const body_rendered = renderTemplate(bodySrc, vars);
  const shell = TEMPLATE_SHELLS[key] || { heading: subject_rendered || 'Avalon Vitality', cta: null };
  const html_rendered = brandedShell({ heading: shell.heading, bodyHtml: body_rendered, cta: shell.cta });
  return { subject_rendered, html_rendered };
}

function fromAddressForTest() {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (from) return from;
  // Dev fallback only — production must have RESEND_FROM_EMAIL set.
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('RESEND_FROM_EMAIL is required in production.'), {
      code: 'resend_from_email_missing',
    });
  }
  return 'Avalon Vitality <onboarding@resend.dev>';
}

// Bare email-shape check — rate-limited send-test only, NOT a marketing-grade
// validator. Resend will reject anything actually undeliverable.
function looksLikeEmail(value) {
  const v = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ---------------------------------------------------------------------------
// Admin endpoint
// ---------------------------------------------------------------------------
function defaultRow(key) {
  const def = TEMPLATE_DEFAULTS[key];
  return {
    key,
    label: def.label,
    description: def.description,
    placeholders: def.placeholders,
    placeholderHint: PLACEHOLDER_HINT,
    subject: def.subject,
    body_html: def.body_html,
    enabled: false, // no override → the hardcoded default is in effect
    updated_at: null,
    overridden: false,
  };
}

export default async function handler(req, res) {
  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db, tenantId, user } = authed;

  if (req.method === 'GET') {
    const merged = new Map(TEMPLATE_KEYS.map((key) => [key, defaultRow(key)]));
    let tableMissing = false;
    try {
      const { data, error } = await db
        .from('email_templates')
        .select('key, subject, body_html, enabled, updated_at');
      if (error) throw error;
      (data || []).forEach((row) => {
        if (!merged.has(row.key)) return; // ignore unknown keys
        const base = merged.get(row.key);
        merged.set(row.key, {
          ...base,
          subject: row.subject ?? base.subject,
          body_html: row.body_html ?? base.body_html,
          enabled: Boolean(row.enabled),
          updated_at: row.updated_at || null,
          overridden: true,
        });
      });
    } catch (err) {
      if (isMissingTableError(err)) {
        tableMissing = true;
      } else {
        console.warn('[admin/email-templates] list failed', safeLogContext(err, 'email_templates_list_failed'));
        return res.status(500).json({
          error: 'Could not load email templates.',
          code: safeErrorCode(err, 'email_templates_list_failed'),
        });
      }
    }
    return res.status(200).json({
      templates: Array.from(merged.values()),
      tableMissing,
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const key = String(body.key || '').trim();
    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(400).json({ error: 'Unknown template key.', code: 'unknown_template_key' });
    }
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const bodyHtml = typeof body.body_html === 'string' ? body.body_html : '';
    const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
    if (!subject) {
      return res.status(400).json({ error: 'Subject is required.', code: 'subject_required' });
    }
    if (!bodyHtml.trim()) {
      return res.status(400).json({ error: 'Body is required.', code: 'body_required' });
    }

    const now = new Date().toISOString();
    try {
      const { data, error } = await db
        .from('email_templates')
        .upsert(
          { key, subject, body_html: bodyHtml, enabled, updated_at: now },
          { onConflict: 'key' },
        )
        .select('key, subject, body_html, enabled, updated_at')
        .single();
      if (error) throw error;

      _clearTemplateOverrideCache(); // make the new copy take effect immediately

      await writeAuditEvent(db, {
        tenantId,
        actorProfileId: user?.id || null,
        action: 'admin_email_template_saved',
        entityType: 'email_templates',
        entityId: key,
        phiTouched: false,
        payload: { key, enabled, route: 'api/admin/email-templates' },
      });

      return res.status(200).json({
        ok: true,
        template: { ...data, enabled: Boolean(data.enabled), overridden: true },
      });
    } catch (err) {
      if (isMissingTableError(err)) {
        return res.status(503).json({
          error:
            'The email_templates table has not been created yet. Run the migration, then save again.',
          code: 'migration_required',
        });
      }
      console.warn('[admin/email-templates] save failed', safeLogContext(err, 'email_templates_save_failed'));
      return res.status(500).json({
        error: 'Could not save the template.',
        code: safeErrorCode(err, 'email_templates_save_failed'),
      });
    }
  }

  if (req.method === 'POST') {
    const action = String((req.query && req.query.action) || '').trim();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const key = String(body.key || '').trim();
    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(400).json({ error: 'Unknown template key.', code: 'unknown_template_key' });
    }

    if (action === 'preview') {
      try {
        const out = renderForPreview(key, {
          subject: body.subject,
          body_html: body.body_html,
          sampleData: body.sampleData,
        });
        return res.status(200).json({ ok: true, ...out });
      } catch (err) {
        console.warn('[admin/email-templates] preview failed', safeLogContext(err, 'email_template_preview_failed'));
        return res.status(500).json({
          error: 'Could not render the preview.',
          code: safeErrorCode(err, 'email_template_preview_failed'),
        });
      }
    }

    if (action === 'send-test') {
      // Rate-limit: 10/min per staff actor. The bucket key is the staff user id
      // (falls back to email) so a single staffer can't fan-out test sends.
      const actorBucket = String(user?.id || authed.email || 'unknown');
      const rl = await checkRateLimit({
        key: `admin:email_template_test:${actorBucket}`,
        windowMs: 60 * 1000,
        max: 10,
      });
      if (!rl.ok) {
        return res.status(429).json({
          error: 'Too many test emails — please wait a minute and try again.',
          code: 'rate_limited',
        });
      }

      const to = String(body.to || '').trim() || authed.email || '';
      if (!looksLikeEmail(to)) {
        return res.status(400).json({ error: 'A valid recipient email is required.', code: 'recipient_invalid' });
      }
      if (!process.env.RESEND_API_KEY) {
        return res.status(503).json({
          error: 'Resend is not configured in this environment — test send unavailable.',
          code: 'resend_not_configured',
        });
      }

      let rendered;
      try {
        rendered = renderForPreview(key, {
          subject: body.subject,
          body_html: body.body_html,
          // sampleData is intentionally NOT accepted from the client for sends —
          // PHI-free fixed sample only, no chance of a staffer pasting PHI.
        });
      } catch (err) {
        console.warn('[admin/email-templates] send-test render failed', safeLogContext(err, 'email_template_test_render_failed'));
        return res.status(500).json({
          error: 'Could not render the email.',
          code: safeErrorCode(err, 'email_template_test_render_failed'),
        });
      }

      // Subject prefix makes a test send unmistakable in the recipient's inbox.
      const subject = `[TEST] ${rendered.subject_rendered || TEMPLATE_DEFAULTS[key].subject}`;
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const result = await resend.emails.send({
          from: fromAddressForTest(),
          to,
          subject,
          html: rendered.html_rendered,
        });
        if (result?.error) {
          throw Object.assign(new Error(result.error.message || 'Resend rejected the test email'), {
            cause: result.error,
          });
        }

        await writeAuditEvent(db, {
          tenantId,
          actorProfileId: user?.id || null,
          action: 'email_template_test_sent',
          entityType: 'email_templates',
          entityId: key,
          phiTouched: false,
          payload: { key, route: 'api/admin/email-templates', recipient_domain: to.split('@')[1] || '' },
        });

        return res.status(200).json({ ok: true, id: result?.data?.id || null });
      } catch (err) {
        console.warn('[admin/email-templates] send-test failed', safeLogContext(err, 'email_template_test_send_failed'));
        return res.status(502).json({
          error: 'Could not send the test email.',
          code: safeErrorCode(err, 'email_template_test_send_failed'),
        });
      }
    }

    return res.status(400).json({ error: 'Unknown action.', code: 'unknown_action' });
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
