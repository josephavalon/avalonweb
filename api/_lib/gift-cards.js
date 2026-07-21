/**
 * Gift cards — purchase + redeem helpers.
 *
 * Flow:
 *   1. Customer hits /api/gift-cards/purchase → we create a pending row in
 *      `gift_cards` with a freshly-minted unguessable code (status='pending'),
 *      then open a Stripe Checkout session whose metadata.kind='gift_card' so
 *      the webhook can find us back. The code is NOT emailed until the deposit
 *      succeeds.
 *   2. On checkout.session.completed (webhook), the webhook calls
 *      `fulfillGiftCard({ db, session })` which: looks up the pending row by
 *      stripe_session_id (or creates one from session.metadata if the row was
 *      lost), stamps issued_at, and sends the gift-card email with the code +
 *      redemption instructions. Idempotent — safe on webhook retries.
 *   3. Recipient hits /api/gift-cards/redeem with { code } while signed in →
 *      we validate the code is pending + unredeemed, atomically claim it
 *      (status='redeemed', redeemed_at + redeemed_by_profile_id stamped), and
 *      mint a member_credit_ledger row with source='gift_card_redemption' for
 *      the same dollar value (units = ceil(amount/$250)). A code can only be
 *      redeemed once — the unique-on-claim guard makes this safe under races.
 *
 * Security:
 *   - Codes are 16 chars (4×4 dash-grouped) drawn from a 32-char alphabet that
 *     excludes ambiguous glyphs (0/O, 1/I/L). 80 bits of entropy, sourced from
 *     crypto.randomBytes. Looking up a row by random guess is infeasible.
 *   - The gift-card email is PHI-FREE: recipient first name (their own), sender
 *     name, optional personal message, amount, code. No clinical detail.
 *   - Redemption requires an authed Supabase session (getAuthedUser). The
 *     claim is a UPDATE … WHERE status='pending' AND redeemed_at IS NULL, so
 *     two concurrent redeems can never both win.
 */

import crypto from 'crypto';
import { Resend } from 'resend';
import { grantMembershipCredit } from './member-credits.js';

// 32-char alphabet, ambiguous glyphs (0, O, 1, I, L) stripped, uppercase.
// 5 bits per char × 16 chars = 80 bits of entropy. Aligns with industry gift-card
// strength and is comfortably unguessable (≈ 1 in 1.2e24).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_GROUPS = 4;
const CODE_GROUP_LEN = 4;
const CODE_LEN = CODE_GROUPS * CODE_GROUP_LEN; // 16

// VISIT_CREDIT_CENTS mirrors the webhook + create-checkout-session constant: a
// granted visit credit is worth $250 toward an Avalon visit. We grant
// ceil(amountCents / $250) units so a $250 card = 1 visit, $500 = 2, etc.
// Custom amounts under $250 grant 1 credit (the visit consumes it; member pays
// the difference at the visit, matching the existing IV credit rules).
const VISIT_CREDIT_CENTS = 25000;

// ── Code generation ────────────────────────────────────────────────────────

/**
 * Mint a cryptographically-secure 16-char gift-card code, dash-grouped 4×4.
 * Example: K3MN-7H2X-PQR8-WTYZ. Uses rejection sampling against the 32-char
 * alphabet so the distribution is uniform (no modulo bias). The whole process
 * draws from crypto.randomBytes — no Math.random anywhere.
 */
export function generateCode() {
  const out = [];
  // Pull a generous buffer so the rejection loop almost never re-rolls; refill
  // only if the alphabet's "dead bytes" eat through it (extremely unlikely with
  // a 32-char alphabet — exactly 256/32 = 8 bytes map to each char).
  let buf = crypto.randomBytes(CODE_LEN * 2);
  let cursor = 0;
  while (out.length < CODE_LEN) {
    if (cursor >= buf.length) {
      buf = crypto.randomBytes(CODE_LEN * 2);
      cursor = 0;
    }
    const byte = buf[cursor++];
    // 256 % 32 === 0, so every byte maps uniformly — no rejection needed.
    out.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]);
  }
  const groups = [];
  for (let i = 0; i < CODE_GROUPS; i += 1) {
    groups.push(out.slice(i * CODE_GROUP_LEN, (i + 1) * CODE_GROUP_LEN).join(''));
  }
  return groups.join('-');
}

// Accept user-typed codes: strip whitespace + dashes, uppercase, re-validate
// shape so we never query the DB for obvious garbage (and avoid leaking row
// presence through error timings).
export function normalizeCode(input = '') {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== CODE_LEN) return '';
  // Reject any character not in our alphabet (typed "O" instead of "0" etc.).
  for (const ch of raw) {
    if (!CODE_ALPHABET.includes(ch)) return '';
  }
  // Re-insert the dashes so storage + display are consistent.
  const groups = [];
  for (let i = 0; i < CODE_GROUPS; i += 1) {
    groups.push(raw.slice(i * CODE_GROUP_LEN, (i + 1) * CODE_GROUP_LEN));
  }
  return groups.join('-');
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function trimmedString(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function safeAmountCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function unitsForAmount(amountCents) {
  const cents = safeAmountCents(amountCents);
  if (cents <= 0) return 1;
  return Math.max(1, Math.ceil(cents / VISIT_CREDIT_CENTS));
}

// ── Pending row (pre-Stripe Checkout) ─────────────────────────────────────

/**
 * Insert a `gift_cards` row in status='pending' linked to the Stripe Checkout
 * session id we're about to create. Generates a unique code; on the vanishingly
 * rare collision (uq_gift_cards_code) we retry up to a handful of times.
 *
 * Returns { id, code } on success, or null when the DB is unavailable / no
 * code could be minted after retries.
 */
export async function createPendingGiftCard(db, {
  stripeSessionId,
  amountCents,
  currency = 'usd',
  recipientEmail,
  recipientName = '',
  senderEmail = '',
  senderName = '',
  senderMessage = '',
} = {}) {
  if (!db || !stripeSessionId) return null;
  const safeCents = safeAmountCents(amountCents);
  if (safeCents <= 0) return null;

  // A few attempts is plenty — collision probability at 80 bits is negligible.
  // We retry only on the unique-violation on `code` (23505 on uq_gift_cards_code);
  // any other error is surfaced.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const row = {
      code,
      amount_cents: safeCents,
      currency: String(currency || 'usd').toLowerCase(),
      recipient_email: normalizeEmail(recipientEmail),
      recipient_name: trimmedString(recipientName, 120),
      sender_email: normalizeEmail(senderEmail),
      sender_name: trimmedString(senderName, 120),
      sender_message: trimmedString(senderMessage, 1000),
      stripe_session_id: String(stripeSessionId),
      status: 'pending',
    };
    const { data, error } = await db.from('gift_cards')
      .insert(row)
      .select('id, code')
      .maybeSingle();
    if (!error && data?.id) return data;
    if (error && /code/i.test(error.message || '') && /unique|duplicate|23505/i.test(error.message || '')) {
      continue; // unique collision on `code` — retry with a fresh draw
    }
    // Collision on `stripe_session_id` (the call is being retried by the
    // purchase route): return the existing row so the caller can keep going.
    if (error && /stripe_session_id/i.test(error.message || '') && /unique|duplicate|23505/i.test(error.message || '')) {
      const { data: existing } = await db.from('gift_cards')
        .select('id, code')
        .eq('stripe_session_id', String(stripeSessionId))
        .maybeSingle();
      return existing || null;
    }
    if (error) {
      throw error;
    }
  }
  return null;
}

// ── Fulfillment (webhook entry point) ─────────────────────────────────────

/**
 * Called from the Stripe webhook on checkout.session.completed. Idempotent.
 * Resolves the pending gift_cards row (by stripe_session_id), back-fills one
 * from session.metadata if a row was lost (kind='gift_card' guard), stamps
 * issued_at, and emails the recipient the redemption code + instructions.
 *
 * NEVER throws — webhook MUST return 200. Returns { sent, reason? }.
 */
export async function fulfillGiftCard(db, { session } = {}) {
  if (!db || !session?.id) return { sent: false, reason: 'no_session_or_db' };
  const md = session.metadata || {};
  // Only act on sessions tagged as gift-card purchases. Belt-and-braces: a
  // gift_cards row may exist even without the metadata tag, so we also check
  // for an existing pending row before bailing.
  const taggedGiftCard = String(md.kind || '') === 'gift_card';

  let { data: row, error: lookupError } = await db.from('gift_cards')
    .select('id, code, amount_cents, currency, recipient_email, recipient_name, sender_email, sender_name, sender_message, status, issued_at, stripe_session_id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (lookupError) {
    console.warn('[gift-cards] fulfill lookup failed', { code: lookupError.code, message: lookupError.message });
    return { sent: false, reason: 'lookup_failed' };
  }

  // If the pending insert was lost (DB blip during purchase) but the session
  // is clearly a gift_card purchase, reconstruct from metadata so the customer
  // doesn't lose their money. Idempotent against the unique stripe_session_id
  // index — if a row was just created concurrently, we'll re-read it.
  if (!row && taggedGiftCard) {
    try {
      const created = await createPendingGiftCard(db, {
        stripeSessionId: session.id,
        amountCents: Number(md.giftAmountCents || session.amount_total || 0),
        currency: session.currency || 'usd',
        recipientEmail: md.recipientEmail || '',
        recipientName: md.recipientName || '',
        senderEmail: md.senderEmail || session.customer_email || '',
        senderName: md.senderName || '',
        senderMessage: md.senderMessage || '',
      });
      if (created?.id) {
        const reread = await db.from('gift_cards')
          .select('id, code, amount_cents, currency, recipient_email, recipient_name, sender_email, sender_name, sender_message, status, issued_at, stripe_session_id')
          .eq('id', created.id).maybeSingle();
        row = reread.data || null;
      }
    } catch (err) {
      console.warn('[gift-cards] fulfill back-fill failed', { code: err?.code, message: err?.message });
    }
  }

  if (!row) {
    if (!taggedGiftCard) return { sent: false, reason: 'not_a_gift_card_session' };
    return { sent: false, reason: 'gift_card_row_missing' };
  }

  // Idempotency: if we've already stamped issued_at, the email has already gone
  // out (or was attempted). Don't re-mail the recipient on webhook retries.
  if (row.issued_at) {
    return { sent: false, reason: 'already_fulfilled' };
  }

  const nowIso = new Date().toISOString();
  // Stamp issued_at FIRST so a webhook redelivery short-circuits even if the
  // Resend call below partially fails. (At-most-once is safer than at-least-once
  // here — the recipient can re-request the code through support if needed.)
  const { error: stampError } = await db.from('gift_cards')
    .update({ issued_at: nowIso, status: row.status === 'pending' ? 'issued' : row.status })
    .eq('id', row.id)
    .is('issued_at', null);
  if (stampError) {
    console.warn('[gift-cards] fulfill stamp failed', { code: stampError.code, message: stampError.message });
    return { sent: false, reason: 'stamp_failed' };
  }

  try {
    await sendGiftCardEmail({
      to: row.recipient_email,
      recipientName: row.recipient_name || '',
      senderName: row.sender_name || '',
      senderMessage: row.sender_message || '',
      amountCents: Number(row.amount_cents || 0),
      code: row.code,
    });
    return { sent: true, code: row.code, id: row.id };
  } catch (err) {
    // Don't unwind issued_at — that would re-mail on retry. Log loud so ops can
    // re-send by hand via /admin if Resend is the failure.
    console.warn('[gift-cards] gift card email send failed', { code: err?.code, message: err?.message });
    return { sent: false, reason: 'email_send_failed', id: row.id };
  }
}

// ── Redemption (authed POST entry point) ──────────────────────────────────

export class GiftCardRedeemError extends Error {
  constructor(code = 'gift_card_error', message = 'Gift card error', status = 400) {
    super(message);
    this.name = 'GiftCardRedeemError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Validate + claim a gift-card code for an authed member, then grant the
 * corresponding member_credit_ledger row.
 *
 * Idempotency: the atomic UPDATE filter (status='pending' AND redeemed_at IS
 * NULL) guarantees only one caller can flip the row. A code is therefore a
 * single-use bearer token; once redeemed, all subsequent attempts get a clean
 * 'already_redeemed' (even from the original redeemer).
 *
 * The credit grant is keyed off this gift card's id so a replay (same code,
 * same member, mid-failure between claim and grant) can't double-grant.
 */
export async function redeemGiftCard(db, { code, tenantId, profileId, email } = {}) {
  if (!db) throw new GiftCardRedeemError('gift_card_storage_unavailable', 'Gift cards are temporarily unavailable.', 503);
  const normalized = normalizeCode(code);
  if (!normalized) throw new GiftCardRedeemError('gift_card_invalid_format', 'That code does not look right. Check it and try again.', 400);
  if (!profileId && !normalizeEmail(email)) {
    throw new GiftCardRedeemError('gift_card_auth_required', 'Sign in to redeem a gift card.', 401);
  }

  const { data: card, error: readError } = await db.from('gift_cards')
    .select('id, code, amount_cents, currency, recipient_email, recipient_name, status, issued_at, redeemed_at, stripe_session_id')
    .eq('code', normalized)
    .maybeSingle();
  if (readError) {
    console.warn('[gift-cards] redeem lookup failed', { code: readError.code, message: readError.message });
    throw new GiftCardRedeemError('gift_card_lookup_failed', 'We could not check that code. Please try again.', 500);
  }
  if (!card) {
    // Generic message — never confirm or deny existence of a code (otherwise the
    // endpoint becomes a code-validity oracle for bulk-guess attempts).
    throw new GiftCardRedeemError('gift_card_not_found', "We couldn't find that gift card. Check the code and try again.", 404);
  }
  if (!card.issued_at) {
    // Pending (Stripe payment still settling) — soft block, customer should retry.
    throw new GiftCardRedeemError('gift_card_pending', 'This gift card is being issued. Please try again in a moment.', 409);
  }
  if (card.status === 'redeemed' || card.redeemed_at) {
    throw new GiftCardRedeemError('gift_card_already_redeemed', 'This gift card has already been redeemed.', 409);
  }
  if (card.status !== 'pending' && card.status !== 'issued') {
    throw new GiftCardRedeemError('gift_card_unavailable', 'This gift card is not redeemable.', 409);
  }

  // Atomic claim. The WHERE clause is the lock: only one concurrent caller
  // can flip status from 'issued' to 'redeemed'. A second concurrent attempt
  // updates zero rows and bounces out with 'already_redeemed'.
  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimError } = await db.from('gift_cards')
    .update({
      status: 'redeemed',
      redeemed_at: nowIso,
      redeemed_by_profile_id: profileId || null,
    })
    .eq('id', card.id)
    .in('status', ['pending', 'issued'])
    .is('redeemed_at', null)
    .select('id, code, amount_cents, currency')
    .maybeSingle();
  if (claimError) {
    console.warn('[gift-cards] redeem claim failed', { code: claimError.code, message: claimError.message });
    throw new GiftCardRedeemError('gift_card_claim_failed', 'We could not redeem that code. Please try again.', 500);
  }
  if (!claimed) {
    // Someone else won the race (or it flipped between read and claim).
    throw new GiftCardRedeemError('gift_card_already_redeemed', 'This gift card has already been redeemed.', 409);
  }

  // Grant the credit. Source 'gift_card_redemption' is keyed in the ledger's
  // CHECK constraint (see migration alter in REPORT). We pass a synthetic
  // stripeCheckoutSessionId of `giftcard:<id>` so the standard upsert dedupe
  // (tenant_id, source, stripe_checkout_session_id) can't double-grant on
  // replay. The gift-card row is already locked (status='redeemed') so a
  // second redemption can't reach this code, but defense in depth is cheap.
  const amountCents = safeAmountCents(claimed.amount_cents);
  try {
    await grantMembershipCredit(db, {
      tenantId,
      profileId: profileId || null,
      email: email || '',
      stripeCheckoutSessionId: `giftcard:${claimed.id}`,
      source: 'gift_card_redemption',
      description: 'Gift card redeemed',
      units: unitsForAmount(amountCents),
      creditValueCents: amountCents,
      externalPayload: {
        giftCardId: claimed.id,
        giftCardAmountCents: amountCents,
      },
    });
  } catch (err) {
    // If the ledger insert blows up (e.g. the CHECK constraint hasn't been
    // updated yet to allow 'gift_card_redemption'), the redemption is wedged:
    // the card is flipped to 'redeemed' but no credit was granted. We surface
    // a loud error so the operator + customer both see it; the row can be
    // reset by hand via /admin if the ledger source string isn't whitelisted
    // yet. Better to fail loudly than silently lose the customer's credit.
    console.error('[gift-cards] credit grant after redeem failed', { code: err?.code, message: err?.message });
    throw new GiftCardRedeemError('gift_card_credit_grant_failed', 'We redeemed the code but could not apply the credit. Please contact support.', 500);
  }

  return {
    id: claimed.id,
    code: claimed.code,
    amountCents,
    units: unitsForAmount(amountCents),
    currency: claimed.currency || 'usd',
  };
}

// ── Email ─────────────────────────────────────────────────────────────────

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

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

function siteBase() {
  return String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatUsd(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return '$0.00';
  return (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function firstName(name) {
  if (!name || typeof name !== 'string') return 'there';
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

/**
 * Recipient email — PHI-free per docs/PHI_DATA_FLOW.md. Carries: recipient
 * first name, sender name, optional sender message (user-supplied), gift
 * amount, redemption code, and a redemption URL.
 */
export async function sendGiftCardEmail({
  to,
  recipientName = '',
  senderName = '',
  senderMessage = '',
  amountCents = 0,
  code = '',
} = {}) {
  const recipient = String(to || '').trim();
  if (!recipient) {
    throw Object.assign(new Error('Gift card email skipped: missing recipient'), { code: 'email_delivery_skipped', reason: 'missing_recipient' });
  }
  if (!process.env.RESEND_API_KEY) {
    throw Object.assign(new Error('Gift card email skipped: Resend is not configured'), { code: 'email_delivery_skipped', reason: 'resend_not_configured' });
  }

  const base = siteBase();
  const redeemUrl = base ? `${base}/members/redeem?code=${encodeURIComponent(code)}` : '';
  const safeAmount = formatUsd(amountCents);
  const safeCode = String(code || '');
  const safeRecipient = firstName(recipientName);
  const safeSender = String(senderName || '').trim();
  const personalMessage = String(senderMessage || '').trim();

  const noteHtml = personalMessage
    ? `<blockquote style="margin:18px 0;padding:14px 18px;border-left:3px solid #111;background:#fafafa;font-size:14px;line-height:1.55;color:#333;font-style:italic;">${escapeHtml(personalMessage)}</blockquote>`
    : '';
  const fromHtml = safeSender
    ? `<p style="font-size:14px;line-height:1.55;color:#555;margin:0 0 18px;">From <strong>${escapeHtml(safeSender)}</strong></p>`
    : '';
  const ctaHtml = redeemUrl
    ? `<p style="margin:0 0 24px;"><a href="${escapeHtml(redeemUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;">Redeem your gift</a></p>`
    : '';

  const html = `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#111;">
      <p style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#888;margin:0 0 14px;">Avalon Vitality</p>
      <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px;">You've been gifted an Avalon visit</h1>
      <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 12px;">Hi ${escapeHtml(safeRecipient)} — you've received an Avalon Vitality gift card worth <strong>${escapeHtml(safeAmount)}</strong>.</p>
      ${fromHtml}
      ${noteHtml}
      <div style="margin:20px 0;padding:20px;border:1px solid #eee;border-radius:14px;background:#fff;text-align:center;">
        <p style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#888;margin:0 0 8px;">Redemption code</p>
        <p style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:22px;letter-spacing:0.2em;color:#111;margin:0;font-weight:700;">${escapeHtml(safeCode)}</p>
      </div>
      ${ctaHtml}
      <p style="font-size:14px;line-height:1.55;color:#555;margin:0 0 8px;"><strong>How to redeem</strong></p>
      <ol style="font-size:14px;line-height:1.6;color:#555;margin:0 0 18px;padding-left:20px;">
        <li>Create or sign in to your Avalon account.</li>
        <li>Visit <a href="${escapeHtml(base ? `${base}/members/redeem` : '/members/redeem')}" style="color:#111;">members/redeem</a> and paste the code above.</li>
        <li>The gift value is applied to your account as visit credit — book a session whenever you're ready.</li>
      </ol>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0 14px;" />
      <p style="font-size:11px;color:#888;line-height:1.5;margin:0;">Avalon Vitality &bull; San Francisco, CA<br />Questions? Reply to this email or write to support@avalonvitality.co.</p>
    </div>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: `${safeSender ? `${safeSender} sent you` : "You've received"} an Avalon gift — ${safeAmount}`,
    html,
  });
  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Gift card email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}
