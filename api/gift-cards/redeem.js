/**
 * POST /api/gift-cards/redeem  { code }
 *
 * Authed: the caller must be a signed-in member. Validates the code, claims
 * it atomically (one-time-only redemption guarded by a status-conditional
 * UPDATE), and grants visit credit to the caller's account via the existing
 * member_credit_ledger (source='gift_card_redemption').
 *
 * Errors map 1:1 to GiftCardRedeemError codes so the client can render the
 * right message (already redeemed / not found / pending / etc).
 */

import { getAuthedUser } from '../_lib/supabase-auth.js';
import { redeemGiftCard, GiftCardRedeemError } from '../_lib/gift-cards.js';
import { getDefaultTenantId } from '../_supabase-server.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authed = await getAuthedUser(req);
    if (!authed) {
      return res.status(401).json({ error: 'Sign in to redeem a gift card.', code: 'gift_card_auth_required' });
    }

    const { code = '' } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: 'A gift card code is required.', code: 'gift_card_code_required' });
    }

    // Tenant resolution mirrors create-checkout-session.js: prefer the
    // authed user's tenant when available, otherwise fall back to the
    // default Avalon tenant. The ledger row is scoped to this tenant.
    const tenantId = authed.tenantId || (await getDefaultTenantId(authed.db));
    if (!tenantId) {
      return res.status(503).json({ error: 'Gift cards are temporarily unavailable.', code: 'gift_card_tenant_unavailable' });
    }

    const result = await redeemGiftCard(authed.db, {
      code,
      tenantId,
      profileId: authed.user?.id || null,
      email: authed.email,
    });

    return res.status(200).json({
      ok: true,
      amountCents: result.amountCents,
      units: result.units,
      currency: result.currency,
    });
  } catch (err) {
    if (err instanceof GiftCardRedeemError) {
      return res.status(err.status || 400).json({ error: err.message, code: err.code });
    }
    console.error('[gift-cards/redeem] failed', safeLogContext(err, 'gift_card_redeem_failed'));
    return res.status(500).json({
      error: 'We could not redeem that gift card. Please try again.',
      code: safeErrorCode(err, 'gift_card_redeem_failed'),
    });
  }
}
