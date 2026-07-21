/**
 * POST /api/me/redeem-referral
 *
 * The signup page stashes `?ref=<code>` from the landing URL into
 * localStorage. The Dashboard (or any post-signup authed page) posts the
 * code here once; we attribute the new member to the referrer by inserting a
 * `referrals` row (status='pending'). The actual $50/$50 grant fires later,
 * from the Stripe webhook, when the referee's first paid appointment lands.
 *
 * Body: { code: string }
 *
 * Response shape mirrors `redeemReferralForNewMember` so the client can
 * decide whether to clear localStorage:
 *   { status: 'attributed' | 'already_attributed' | 'invalid_code'
 *     | 'self_referral' | 'skipped' }
 *
 * Idempotent: a unique index on `referrals.referee_profile_id` means a
 * second call (or a parallel one) returns 'already_attributed' without
 * minting a second row.
 */

import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { redeemReferralForNewMember } from '../_lib/referrals.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, tenantId } = authed;
  if (!db || !user?.id) {
    return res.status(200).json({ status: 'skipped' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const code = String(body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Missing referral code', code: 'missing_code' });

  try {
    const result = await redeemReferralForNewMember(db, {
      refereeProfileId: user.id,
      code,
      tenantId: tenantId || null,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.warn('[me/redeem-referral] failed', safeLogContext(err, 'referral_redeem_failed'));
    return res.status(500).json({
      error: 'Could not record your referral.',
      code: safeErrorCode(err, 'referral_redeem_failed'),
    });
  }
}
