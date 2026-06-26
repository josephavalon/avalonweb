/**
 * GET /api/admin/memberships
 *
 * Admin master list of every patient who currently has an active membership /
 * plan. Iterates every Stripe subscription in `status: 'active'` (paginated),
 * matches each to a profile by `stripe_customer_id`, and joins in the credit
 * ledger so the admin can see per-member credit balance, the monthly grant for
 * their tier, the last renewal timestamp, and the next renewal date.
 *
 * Staff read-only. Mutations (grant/revoke credits) reuse the existing
 * `api/admin/clients/[id]/credits.js` route so we don't duplicate logic.
 */

import Stripe from 'stripe';
import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

// Tier mapping: derived from the Stripe subscription line item's unit amount.
// Mirrors the three published plans (Essentials / Vitality / Concierge).
const TIER_BREAKS = [
  { maxCents: 12000, tier: 'Essentials', monthlyGrant: 1 },
  { maxCents: 30000, tier: 'Vitality', monthlyGrant: 4 },
  { maxCents: Infinity, tier: 'Concierge', monthlyGrant: 10 },
];

function tierFromAmount(unitAmountCents) {
  const cents = Number(unitAmountCents || 0);
  return TIER_BREAKS.find((b) => cents <= b.maxCents) || TIER_BREAKS[TIER_BREAKS.length - 1];
}

async function listAllActiveSubscriptions(stripe) {
  const all = [];
  let startingAfter;
  for (;;) {
    const page = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    if (!page.has_more || !page.data.length) return all;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

function shapeRow({ sub, profile, creditsBalance, lastRenewal }) {
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount ?? 0;
  const { tier, monthlyGrant } = tierFromAmount(unitAmount);
  const nextRenewal = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  return {
    profileId: profile?.id || null,
    fullName: profile?.full_name || profile?.preferred_name || null,
    email: profile?.email || null,
    tier,
    monthlyGrant,
    monthlyAmount: Math.round(Number(unitAmount || 0)) / 100,
    creditsBalance: Number(creditsBalance || 0),
    lastRenewal,
    nextRenewal,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    status: sub.status,
    orphan: !profile, // sub exists in Stripe but not matched to a profile in our DB
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured', code: 'stripe_secret_missing' });
  }

  const { db, tenantId, user } = authed;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const subs = await listAllActiveSubscriptions(stripe);

    const customerIds = Array.from(new Set(
      subs
        .map((s) => (typeof s.customer === 'string' ? s.customer : s.customer?.id))
        .filter(Boolean)
    ));

    // Resolve profiles by stripe_customer_id (column added in migration 019),
    // tenant-isolated to mirror api/admin/clients/[id].js.
    let profilesByCustomerId = new Map();
    let profileIds = [];
    if (customerIds.length) {
      let q = db.from('profiles')
        .select('id, email, full_name, preferred_name, tenant_id, stripe_customer_id')
        .in('stripe_customer_id', customerIds);
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { data, error } = await q;
      if (error) throw error;
      (data || []).forEach((p) => {
        if (p.stripe_customer_id) profilesByCustomerId.set(p.stripe_customer_id, p);
      });
      profileIds = (data || []).map((p) => p.id).filter(Boolean);
    }

    // Bulk-fetch credit ledger rows for the matched profiles in one query.
    const balanceByProfile = new Map();
    const lastRenewalByProfile = new Map();
    if (profileIds.length) {
      let lq = db.from('member_credit_ledger')
        .select('profile_id, units, source, created_at')
        .in('profile_id', profileIds);
      if (tenantId) lq = lq.eq('tenant_id', tenantId);
      const { data: ledger, error: ledgerErr } = await lq;
      if (ledgerErr) throw ledgerErr;
      (ledger || []).forEach((row) => {
        const pid = row.profile_id;
        if (!pid) return;
        balanceByProfile.set(pid, (balanceByProfile.get(pid) || 0) + Number(row.units || 0));
        if (row.source === 'membership_initial_grant' || row.source === 'membership_renewal_grant') {
          const prior = lastRenewalByProfile.get(pid);
          if (!prior || (row.created_at && row.created_at > prior)) {
            lastRenewalByProfile.set(pid, row.created_at || null);
          }
        }
      });
    }

    const rows = subs.map((sub) => {
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const profile = customerId ? profilesByCustomerId.get(customerId) : null;
      const creditsBalance = profile ? (balanceByProfile.get(profile.id) || 0) : 0;
      const lastRenewal = profile ? (lastRenewalByProfile.get(profile.id) || null) : null;
      return shapeRow({ sub, profile, creditsBalance, lastRenewal });
    });

    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: user?.id || null,
      action: 'admin_memberships_list',
      entityType: 'profiles',
      phiTouched: false,
      payload: { count: rows.length, route: 'api/admin/memberships' },
    });

    return res.status(200).json({ rows });
  } catch (err) {
    console.warn('[admin/memberships] failed', safeLogContext(err, 'admin_memberships_failed'));
    return res.status(500).json({
      error: 'Could not load memberships.',
      code: safeErrorCode(err, 'admin_memberships_failed'),
    });
  }
}
