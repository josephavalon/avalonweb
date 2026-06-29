/**
 * GET /api/me/referral
 *
 * Returns the signed-in member's referral code (minted on demand the first
 * time this endpoint is hit) and the count of referrals they've made + how
 * many converted into $50 credits.
 *
 *   { code, referLink, totalReferred, totalCredited, creditDollarsEarned,
 *     creditPerSideDollars }
 *
 * The Dashboard "Share & earn" card reads this once on mount.
 */

import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { getAuthedUser } from '../_lib/supabase-auth.js';
import {
  getOrCreateReferralCode,
  getReferralStats,
  REFERRAL_CREDIT_CENTS,
} from '../_lib/referrals.js';

// Where the shared link drops the friend. Snooches is the live customer domain;
// the SPA at `/` reads `?ref=<code>` and stashes it for signup.
const SHARE_BASE = process.env.PUBLIC_SHARE_BASE_URL || 'https://snooches.avalonvitality.co';

function dollars(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user } = authed;
  if (!db || !user?.id) {
    return res.status(200).json({
      code: null,
      referLink: null,
      totalReferred: 0,
      totalCredited: 0,
      creditDollarsEarned: 0,
      creditPerSideDollars: dollars(REFERRAL_CREDIT_CENTS),
    });
  }

  try {
    const code = await getOrCreateReferralCode(db, { profileId: user.id });
    const stats = await getReferralStats(db, { referrerProfileId: user.id });
    const referLink = code ? `${SHARE_BASE.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}` : null;
    return res.status(200).json({
      code: code || null,
      referLink,
      totalReferred: stats.totalReferred,
      totalCredited: stats.totalCredited,
      creditDollarsEarned: dollars(stats.creditCentsEarned),
      creditPerSideDollars: dollars(REFERRAL_CREDIT_CENTS),
    });
  } catch (err) {
    console.warn('[me/referral] load failed', safeLogContext(err, 'referral_load_failed'));
    return res.status(500).json({
      error: 'Could not load your referral code.',
      code: safeErrorCode(err, 'referral_load_failed'),
    });
  }
}
