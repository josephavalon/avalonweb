/**
 * Referral program helpers.
 *
 * Each member has a short uppercase `profiles.referral_code` (generated on
 * demand by /api/me/referral). New members can sign up with `?ref=<code>`;
 * the SPA persists that to localStorage, and on first authed page load posts
 * to /api/me/redeem-referral which attributes the referee by inserting a
 * `referrals` row (status='pending', unique on referee_profile_id so a
 * referee can only ever be attributed once).
 *
 * When the referee pays for their first appointment, the Stripe webhook calls
 * `creditReferralOnFirstPaid` which grants $50 (1 visit credit) to BOTH
 * referee and referrer via `grantMembershipCredit(source='referral_bonus')`
 * and flips the row to 'credited'. Both grants respect the 1-year expiry
 * already wired into `grantMembershipCredit`.
 *
 * Idempotency:
 *   - redeemReferralForNewMember: unique on referee_profile_id → second call
 *     no-ops (returns 'already_attributed').
 *   - creditReferralOnFirstPaid: only acts on rows whose status is 'pending';
 *     flips to 'credited' after both grants land. Replays no-op
 *     ('already_credited' / 'no_pending_referral').
 *   - Grants themselves are idempotent per the unique
 *     (tenant_id, source, stripe_checkout_session_id) key in
 *     `member_credit_ledger`. For referral grants we synthesize a per-side
 *     stable key ('referral:<row id>:referee' / 'referrer') so the same
 *     referral row can't grant twice even if the webhook retries.
 */

import { grantMembershipCredit } from './member-credits.js';

// $50 per side, expressed in cents to match the existing credit-value
// convention. 1 visit credit each. Bumping these is safe — the grant rows
// carry the value at issue time.
export const REFERRAL_CREDIT_CENTS = 5000;
export const REFERRAL_CREDIT_UNITS = 1;

// Profiles.referral_code is 8 chars, uppercase, ambiguity-friendly alphabet
// (no 0/O/1/I/L). Short enough to read over the phone, long enough that a
// random guess hits ~1 in 2.8 trillion before we even check the DB.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;

export function generateReferralCode() {
  let out = '';
  for (let i = 0; i < CODE_LEN; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeReferralCode(value = '') {
  return String(value || '').trim().toUpperCase();
}

/**
 * Get-or-create the caller's referral code. Idempotent: the first call mints
 * a code and writes it to `profiles.referral_code`; subsequent calls return
 * the stored code. Returns null if the profile row can't be loaded.
 *
 * Race: two concurrent first-calls could both attempt insert. The
 * `profiles.referral_code` unique index makes the loser retry with a new
 * code; we re-read on conflict so the caller always gets the winning code.
 */
export async function getOrCreateReferralCode(db, { profileId } = {}) {
  if (!db || !profileId) return null;
  const { data: existing, error: readErr } = await db
    .from('profiles')
    .select('id, referral_code')
    .eq('id', profileId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing?.referral_code) return existing.referral_code;

  // Generate-and-store with collision retry. 4 attempts is plenty given the
  // alphabet size; in practice the first attempt almost always wins.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = generateReferralCode();
    const { error: writeErr } = await db
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', profileId)
      .is('referral_code', null); // only set if still null — concurrent winner survives
    if (!writeErr) {
      // Re-read in case a concurrent call beat us (still-null was false → no rows updated).
      const { data: after } = await db
        .from('profiles')
        .select('referral_code')
        .eq('id', profileId)
        .maybeSingle();
      if (after?.referral_code) return after.referral_code;
      // else loop and try again
    } else if (/duplicate|unique|23505/i.test(writeErr.message || '')) {
      // unique collision on the code itself — generate a new one.
      continue;
    } else {
      throw writeErr;
    }
  }
  return null;
}

/**
 * Stats for the caller's referral card on the Dashboard.
 *   totalReferred  — referrals rows where this profile is the referrer
 *   totalCredited  — subset whose status is 'credited' (i.e. referee paid)
 *   creditCentsEarned — totalCredited * REFERRAL_CREDIT_CENTS
 */
export async function getReferralStats(db, { referrerProfileId } = {}) {
  if (!db || !referrerProfileId) {
    return { totalReferred: 0, totalCredited: 0, creditCentsEarned: 0 };
  }
  const { data, error } = await db
    .from('referrals')
    .select('id, status')
    .eq('referrer_profile_id', referrerProfileId);
  if (error) {
    // Table missing (migration not applied) — degrade to zeros, not a 500.
    if (/relation .*referrals.* does not exist|42P01/i.test(error.message || '')) {
      return { totalReferred: 0, totalCredited: 0, creditCentsEarned: 0 };
    }
    throw error;
  }
  const rows = Array.isArray(data) ? data : [];
  const totalReferred = rows.length;
  const totalCredited = rows.filter((r) => r.status === 'credited').length;
  return {
    totalReferred,
    totalCredited,
    creditCentsEarned: totalCredited * REFERRAL_CREDIT_CENTS,
  };
}

/**
 * Look up a referrer by referral code. Returns { id, tenantId, email } or null.
 */
export async function findReferrerByCode(db, code) {
  const norm = normalizeReferralCode(code);
  if (!db || !norm) return null;
  const { data, error } = await db
    .from('profiles')
    .select('id, tenant_id, email, referral_code, status')
    .eq('referral_code', norm)
    .maybeSingle();
  if (error) {
    if (/relation .*does not exist|42P01|column .*referral_code.* does not exist/i.test(error.message || '')) {
      return null;
    }
    throw error;
  }
  if (!data) return null;
  if (data.status && data.status !== 'active') return null;
  return { id: data.id, tenantId: data.tenant_id, email: data.email };
}

/**
 * Record a new-member attribution. Called from /api/me/redeem-referral when
 * an authed user submits the `?ref=<code>` they carried through signup.
 *
 * Returns one of:
 *   { status: 'attributed', referralId }
 *   { status: 'already_attributed' }     — this referee already has a row
 *   { status: 'invalid_code' }           — code didn't match an active profile
 *   { status: 'self_referral' }          — code belongs to this user
 *   { status: 'skipped' }                — no db / no profileId
 */
export async function redeemReferralForNewMember(db, { refereeProfileId, code, tenantId = null } = {}) {
  const norm = normalizeReferralCode(code);
  if (!db || !refereeProfileId || !norm) return { status: 'skipped' };

  // Already attributed? Fast-path so we don't bother validating the code.
  try {
    const { data: existing } = await db
      .from('referrals')
      .select('id, status')
      .eq('referee_profile_id', refereeProfileId)
      .maybeSingle();
    if (existing?.id) return { status: 'already_attributed', referralId: existing.id };
  } catch (err) {
    if (!/relation .*does not exist|42P01/i.test(err.message || '')) throw err;
    return { status: 'skipped' };
  }

  const referrer = await findReferrerByCode(db, norm);
  if (!referrer) return { status: 'invalid_code' };
  if (referrer.id === refereeProfileId) return { status: 'self_referral' };

  const row = {
    referrer_profile_id: referrer.id,
    referee_profile_id: refereeProfileId,
    code: norm,
    status: 'pending',
    tenant_id: tenantId || referrer.tenantId || null,
  };
  const { data, error } = await db
    .from('referrals')
    .insert(row)
    .select('id')
    .maybeSingle();
  if (error) {
    // Lost a race with another redeem call for the same referee → treat as
    // already-attributed (the unique index on referee_profile_id is the
    // durable guard).
    if (/duplicate|unique|23505/i.test(error.message || '')) {
      const { data: after } = await db
        .from('referrals')
        .select('id')
        .eq('referee_profile_id', refereeProfileId)
        .maybeSingle();
      return { status: 'already_attributed', referralId: after?.id || null };
    }
    throw error;
  }
  return { status: 'attributed', referralId: data?.id || null };
}

/**
 * Grant the $50/$50 visit credit pair when the referee's first paid
 * appointment lands. Called from the Stripe webhook's post-checkout path
 * (alongside `recordIvCreditRedemption`/`sendCheckoutWelcomeEmail`).
 *
 * Idempotent in three layers:
 *   1. We only act on referral rows whose status is 'pending'.
 *   2. After granting we flip to 'credited' with a credited_at timestamp;
 *      replays find 'credited' and no-op.
 *   3. The grant rows themselves are deduped via the existing unique
 *      (tenant_id, source, stripe_checkout_session_id) key — we synthesize a
 *      per-side stable session id ('referral:<row id>:referee'/'referrer')
 *      so the same referral can never mint two credits per side.
 *
 * Best-effort — caller MUST wrap in try/catch and never block the webhook.
 *
 * Returns one of:
 *   { status: 'credited', referralId, refereeGrantId, referrerGrantId }
 *   { status: 'already_credited', referralId }
 *   { status: 'no_pending_referral' }
 *   { status: 'skipped' }
 */
export async function creditReferralOnFirstPaid(db, {
  refereeProfileId,
  refereeEmail = '',
  appointmentId = null,
  tenantId = null,
} = {}) {
  if (!db || !refereeProfileId) return { status: 'skipped' };

  let pending = null;
  try {
    const { data } = await db
      .from('referrals')
      .select('id, referrer_profile_id, referee_profile_id, code, status, tenant_id')
      .eq('referee_profile_id', refereeProfileId)
      .maybeSingle();
    pending = data || null;
  } catch (err) {
    if (/relation .*does not exist|42P01/i.test(err.message || '')) {
      return { status: 'skipped' };
    }
    throw err;
  }

  if (!pending) return { status: 'no_pending_referral' };
  if (pending.status === 'credited') {
    return { status: 'already_credited', referralId: pending.id };
  }
  if (pending.status !== 'pending') {
    // 'invalid' / 'revoked' / unknown future statuses → don't grant.
    return { status: 'no_pending_referral' };
  }

  const grantTenantId = tenantId || pending.tenant_id || null;
  if (!grantTenantId) return { status: 'skipped' };

  // Look up referrer email so grantMembershipCredit can resolve them when
  // their profile lookup ever returns a null id (defensive — profileId alone
  // is enough in practice).
  let referrerEmail = '';
  try {
    const { data: ref } = await db
      .from('profiles')
      .select('email')
      .eq('id', pending.referrer_profile_id)
      .maybeSingle();
    referrerEmail = ref?.email || '';
  } catch { /* email is a fallback only */ }

  // Per-side synthetic session ids — stable, unique per referral row, never
  // collide with real Stripe session ids (they start with 'cs_').
  const refereeKey = `referral:${pending.id}:referee`;
  const referrerKey = `referral:${pending.id}:referrer`;

  const refereeGrant = await grantMembershipCredit(db, {
    tenantId: grantTenantId,
    profileId: pending.referee_profile_id,
    email: refereeEmail || '',
    appointmentId,
    stripeCheckoutSessionId: refereeKey,
    source: 'referral_bonus',
    description: 'Referral bonus — welcome credit',
    units: REFERRAL_CREDIT_UNITS,
    creditValueCents: REFERRAL_CREDIT_CENTS,
    externalPayload: {
      referralId: pending.id,
      side: 'referee',
      code: pending.code,
      referrerProfileId: pending.referrer_profile_id,
    },
  });

  const referrerGrant = await grantMembershipCredit(db, {
    tenantId: grantTenantId,
    profileId: pending.referrer_profile_id,
    email: referrerEmail || '',
    appointmentId: null, // referrer's credit isn't tied to the referee's visit
    stripeCheckoutSessionId: referrerKey,
    source: 'referral_bonus',
    description: 'Referral bonus — friend booked their first visit',
    units: REFERRAL_CREDIT_UNITS,
    creditValueCents: REFERRAL_CREDIT_CENTS,
    externalPayload: {
      referralId: pending.id,
      side: 'referrer',
      code: pending.code,
      refereeProfileId: pending.referee_profile_id,
      refereeAppointmentId: appointmentId,
    },
  });

  // Flip to credited only AFTER both grants land (idempotent via the
  // ledger's unique key). Guard the update with the still-pending status so a
  // racing replay that already flipped the row can't be reverted.
  const { error: updErr } = await db
    .from('referrals')
    .update({
      status: 'credited',
      credited_at: new Date().toISOString(),
      referee_grant_id: refereeGrant?.id || null,
      referrer_grant_id: referrerGrant?.id || null,
      appointment_id: appointmentId || null,
    })
    .eq('id', pending.id)
    .eq('status', 'pending');
  if (updErr) {
    // Don't fail the webhook over a status-flip glitch — the grants are
    // already idempotent so a replay will safely no-op the inserts and try
    // the flip again.
    return {
      status: 'credited',
      referralId: pending.id,
      refereeGrantId: refereeGrant?.id || null,
      referrerGrantId: referrerGrant?.id || null,
      flipWarning: updErr.message || 'status_flip_failed',
    };
  }

  return {
    status: 'credited',
    referralId: pending.id,
    refereeGrantId: refereeGrant?.id || null,
    referrerGrantId: referrerGrant?.id || null,
  };
}
