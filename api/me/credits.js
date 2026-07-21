/**
 * GET /api/me/credits
 *
 * Signed-in member credit balance and recent ledger activity. Credits are
 * matched by profile id and checkout email so bookings made before sign-in can
 * still appear once the member logs in with the same email.
 */

import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { getMemberCreditBalance, listMemberCreditLedger, resolveCreditMember } from '../_lib/member-credits.js';

function dollarsFromCents(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

function shapeLedgerRow(row = {}) {
  return {
    id: row.id,
    source: row.source,
    units: Number(row.units || 0),
    creditValue: dollarsFromCents(row.credit_value_cents),
    currency: row.currency || 'usd',
    description: row.description || '',
    appointmentId: row.appointment_id || null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripeSubscriptionId: row.stripe_subscription_id || null,
    stripeInvoiceId: row.stripe_invoice_id || null,
    createdAt: row.created_at,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, email, tenantId, user } = authed;
  if (!tenantId || !email) return res.status(200).json({ balance: 0, ledger: [] });

  try {
    const member = await resolveCreditMember(db, { tenantId, profileId: user?.id, email });
    const [balance, ledger] = await Promise.all([
      getMemberCreditBalance(db, { tenantId, profileId: member.profileId || user?.id, email: member.email || email }),
      listMemberCreditLedger(db, { tenantId, profileId: member.profileId || user?.id, email: member.email || email, limit: 50 }),
    ]);

    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: user?.id || null,
      action: 'client_credits_read',
      entityType: 'member_credit_ledger',
      phiTouched: false,
      payload: {
        route: 'api/me/credits',
        resultCount: ledger.length,
      },
    });

    return res.status(200).json({
      balance,
      ledger: ledger.map(shapeLedgerRow),
    });
  } catch (err) {
    console.warn('[me/credits] credit query failed', safeLogContext(err, 'client_credits_query_failed'));
    return res.status(500).json({
      error: 'Could not load credits.',
      code: safeErrorCode(err, 'client_credits_query_failed'),
    });
  }
}
