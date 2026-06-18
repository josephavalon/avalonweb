import { Resend } from 'resend';

// Welcome email sent once after a new client confirms their account (Supabase
// email confirmation or first OAuth sign-in). Best-effort: signup MUST succeed
// even if Resend is down. Stays PHI-free per docs/PHI_DATA_FLOW.md — the body
// contains only the user's own name and a single CTA back to their dashboard.

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function fromAddress() {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (from) return from;
  if (isProductionRuntime()) {
    throw Object.assign(new Error('RESEND_FROM_EMAIL is required in production.'), {
      code: 'resend_from_email_missing',
      reason: 'resend_from_email_missing',
      status: 500,
    });
  }
  return 'Avalon Vitality <onboarding@resend.dev>';
}

function siteBase() {
  return String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

function ctaUrl({ magicToken } = {}) {
  const base = siteBase();
  // T6 magic-link CTA, feature-flagged. When MAGIC_LINK_WELCOME_ENABLED is on
  // AND we have a signed token, point the CTA at the redeem endpoint so the
  // user lands signed-in. Otherwise fall back to a plain dashboard link.
  if (magicToken) {
    const path = `/api/auth/welcome-redeem?token=${encodeURIComponent(magicToken)}`;
    return base ? `${base}${path}` : path;
  }
  return base ? `${base}/members/dashboard` : '/members/dashboard';
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

function welcomeHtml({ greetingName, ctaHref }) {
  const safeName = escapeHtml(greetingName);
  const safeCta = escapeHtml(ctaHref);
  return `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; color: #111;">
      <p style="font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: #888; margin: 0 0 14px;">Avalon Vitality</p>
      <h1 style="font-size: 28px; line-height: 1.15; margin: 0 0 14px;">Welcome, ${safeName}.</h1>
      <p style="font-size: 15px; line-height: 1.55; color: #333; margin: 0 0 18px;">
        Your account is live. From your dashboard you can book a visit, view your plan, and message the clinical team. We are glad you are here.
      </p>
      <p style="margin: 0 0 28px;">
        <a href="${safeCta}" style="display: inline-block; background: #111; color: #fff; padding: 12px 22px; border-radius: 999px; text-decoration: none; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700;">
          Open your dashboard
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 14px;" />
      <p style="font-size: 11px; color: #888; line-height: 1.5; margin: 0;">
        Avalon Vitality &bull; San Francisco, CA<br />
        Questions? Reply to this email or write to support@avalonvitality.co.
      </p>
    </div>
  `;
}

function welcomeText({ greetingName, ctaHref }) {
  return `Welcome, ${greetingName}.

Your Avalon Vitality account is live. From your dashboard you can book a visit, view your plan, and message the clinical team.

Open your dashboard: ${ctaHref}

Questions? Reply to this email or write to support@avalonvitality.co.`;
}

/**
 * Send the welcome email. Best-effort — throws only when Resend itself rejects
 * (so the caller can log to audit_events). Callers MUST catch and not surface
 * to the signup flow.
 *
 * @param {{ to: string, name?: string, magicToken?: string }} args
 *   magicToken — when present AND MAGIC_LINK_WELCOME_ENABLED is on, the CTA
 *   points at /api/auth/welcome-redeem?token=<...> so the recipient lands
 *   signed-in. Caller decides whether to include it; if omitted, the email
 *   uses the plain dashboard link.
 * @returns {Promise<{ id?: string }>}
 */
export async function sendWelcomeEmail({ to, name, magicToken } = {}) {
  const recipient = String(to || '').trim();
  if (!recipient) {
    throw Object.assign(new Error('Welcome email recipient missing'), {
      code: 'welcome_email_recipient_missing',
    });
  }
  if (!process.env.RESEND_API_KEY) {
    throw Object.assign(new Error('Resend is not configured'), {
      code: 'resend_api_key_missing',
    });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const greetingName = firstName(name);
  const ctaHref = ctaUrl({ magicToken });
  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: 'Welcome to Avalon Vitality',
    html: welcomeHtml({ greetingName, ctaHref }),
    text: welcomeText({ greetingName, ctaHref }),
  });
  if (result?.error) {
    throw Object.assign(new Error('Resend rejected the welcome email'), {
      code: 'welcome_email_resend_failed',
      cause: result.error,
    });
  }
  return { id: result?.data?.id };
}
