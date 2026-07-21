function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

// Credits expire one year after they are issued (migration 017 adds the
// `expires_at` column). `grantMembershipCredit` stamps issued + 365 days; the
// balance/ledger reads below net out any grant that is past its expiry, and
// `expireStaleCredits` writes the offsetting `credit_expiry` debit so the
// expiry is durable in the ledger (not just computed on read).
export const CREDIT_TTL_DAYS = 365;

function addDays(iso, days) {
  const base = iso ? new Date(iso) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

// A grant row is "live" if it never expires or its expiry is still in the
// future. Redemption / refund / adjustment rows (which may carry their own
// expires_at copied from the grant, or none) are never themselves expired —
// only positive grant balance ages out.
function isExpiredGrantRow(row, nowMs) {
  if (!row || !row.expires_at) return false;
  if (Number(row.units || 0) <= 0) return false; // only positive grants expire
  const t = new Date(row.expires_at).getTime();
  return Number.isFinite(t) && t <= nowMs;
}

export function creditMemberEmail(value = '') {
  return normalizeEmail(value);
}

export async function resolveCreditMember(db, { tenantId, profileId = null, email = '' } = {}) {
  if (!db) return { profileId: profileId || null, email: normalizeEmail(email) };
  const normalizedEmail = normalizeEmail(email);
  if (profileId) {
    const { data } = await db.from('profiles')
      .select('id, email, tenant_id')
      .eq('id', profileId)
      .maybeSingle();
    return {
      profileId,
      email: normalizeEmail(data?.email || normalizedEmail),
      tenantId: data?.tenant_id || tenantId || null,
    };
  }
  if (!normalizedEmail) return { profileId: null, email: '', tenantId: tenantId || null };

  let query = db.from('profiles')
    .select('id, email, tenant_id')
    .ilike('email', normalizedEmail)
    .limit(1);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data } = await query.maybeSingle();
  return {
    profileId: data?.id || null,
    email: normalizeEmail(data?.email || normalizedEmail),
    tenantId: data?.tenant_id || tenantId || null,
  };
}

function memberFilter(query, { profileId = null, email = '' } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (profileId && normalizedEmail) {
    return query.or(`profile_id.eq.${profileId},member_email.eq.${normalizedEmail}`);
  }
  if (profileId) return query.eq('profile_id', profileId);
  return query.eq('member_email', normalizedEmail);
}

export async function getMemberCreditBalance(db, { tenantId, profileId = null, email = '' } = {}) {
  if (!db || !tenantId) return 0;
  const normalizedEmail = normalizeEmail(email);
  if (!profileId && !normalizedEmail) return 0;
  let query = db.from('member_credit_ledger')
    .select('units, expires_at, source')
    .eq('tenant_id', tenantId);
  query = memberFilter(query, { profileId, email: normalizedEmail });
  const { data, error } = await query;
  if (error) throw error;
  return liveBalance(data || [], Date.now());
}

// Spendable balance, respecting the 1-year expiry, computed identically whether
// or not the sweep (`expireStaleCredits`) has posted the `credit_expiry` debit.
//
// FIFO / oldest-first: the redeem RPC writes a single un-attributed debit, so we
// can't see which grant a past spend drew from. We assume spends consume the
// OLDEST (nearest-expiry) credits first — the member-favourable, prompt-required
// FIFO behaviour — so already-spent units come off the expired pile before any
// remaining expired units are aged out.
//
//   spent              = redemptions + already-posted credit_expiry debits (abs)
//   unspentExpired     = max(0, expiredGrantUnits − spent)   ← FIFO: spend hits expired first
//   live               = max(0, rawLedgerSum − unspentExpired)
//
// rawLedgerSum nets grants − redemptions − posted expiries (never double-counts);
// we then drop only the still-unspent expired units. The naive "skip expired
// grant rows" approach is wrong because it double-counts a spent-then-expired
// grant and can drive the balance negative.
function liveBalance(rows, nowMs) {
  let rawSum = 0;
  let expiredGrantUnits = 0;   // positive grant units whose 1-yr clock passed
  let spentUnits = 0;          // redemptions + credit_expiry debits, absolute
  for (const row of rows) {
    const units = Number(row.units || 0);
    rawSum += units;
    if (units < 0) {
      // redemptions and credit_expiry rows both represent units leaving the pool
      spentUnits += Math.abs(units);
    } else if (isExpiredGrantRow(row, nowMs)) {
      expiredGrantUnits += units;
    }
  }
  // FIFO: spends (incl. prior expiries) draw down the expired pile first.
  const unspentExpired = Math.max(0, expiredGrantUnits - spentUnits);
  // Only lose what's still on the books → never negative.
  const lose = Math.min(Math.max(0, rawSum), unspentExpired);
  return Math.max(0, rawSum - lose);
}

export async function listMemberCreditLedger(db, { tenantId, profileId = null, email = '', limit = 50 } = {}) {
  if (!db || !tenantId) return [];
  const normalizedEmail = normalizeEmail(email);
  if (!profileId && !normalizedEmail) return [];
  let query = db.from('member_credit_ledger')
    .select('id, source, units, credit_value_cents, currency, description, appointment_id, stripe_checkout_session_id, stripe_subscription_id, stripe_invoice_id, expires_at, created_at, external_payload')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  query = memberFilter(query, { profileId, email: normalizedEmail });
  const { data, error } = await query;
  if (error) throw error;
  // Keep the full history (expiry is auditable) but annotate each row with a
  // computed `expired` flag so callers can grey-out / exclude aged grants
  // without re-deriving the 1-year rule. liveBalance() above is the source of
  // truth for the actual spendable number.
  const nowMs = Date.now();
  return (data || []).map((row) => ({
    ...row,
    expired: isExpiredGrantRow(row, nowMs),
  }));
}

export async function grantMembershipCredit(db, {
  tenantId,
  profileId = null,
  email = '',
  appointmentId = null,
  stripeCheckoutSessionId = null,
  stripeSubscriptionId = null,
  stripeInvoiceId = null,
  source = 'membership_initial_grant',
  description = 'Membership IV credit',
  units = 1,
  creditValueCents = 0,
  externalPayload = {},
  // Issue timestamp drives expiry; override only in backfills/tests. Grants
  // expire CREDIT_TTL_DAYS (1 year) after issue. Pass expiresAt=null explicitly
  // to mint a never-expiring credit (e.g. a goodwill admin_adjustment).
  issuedAt = null,
  expiresAt = undefined,
} = {}) {
  if (!db || !tenantId) return null;
  const member = await resolveCreditMember(db, { tenantId, profileId, email });
  if (!member.profileId && !member.email) return null;
  const issuedIso = issuedAt || new Date().toISOString();
  const resolvedExpiresAt = expiresAt === undefined
    ? addDays(issuedIso, CREDIT_TTL_DAYS)
    : (expiresAt || null);
  const row = {
    tenant_id: tenantId,
    profile_id: member.profileId || null,
    member_email: member.email || null,
    appointment_id: appointmentId || null,
    stripe_checkout_session_id: stripeCheckoutSessionId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    stripe_invoice_id: stripeInvoiceId || null,
    source,
    units: Math.max(1, Math.floor(Number(units) || 1)),
    credit_value_cents: Math.max(0, Math.round(Number(creditValueCents) || 0)),
    currency: 'usd',
    description,
    expires_at: resolvedExpiresAt,
    external_payload: externalPayload || {},
  };
  const conflictTarget = source === 'membership_renewal_grant'
    ? 'tenant_id,source,stripe_invoice_id'
    : 'tenant_id,source,stripe_checkout_session_id';
  const { data, error } = await db.from('member_credit_ledger')
    .upsert(row, { onConflict: conflictTarget, ignoreDuplicates: true })
    .select('id')
    .maybeSingle();
  if (error && !/duplicate|unique|23505/i.test(error.message || '')) throw error;
  return data || null;
}

// Thrown when a member tries to redeem more credits than their live balance.
// The caller (webhook) treats this as a reconciliation case, not a hard failure.
export class InsufficientMemberCreditError extends Error {
  constructor(message = 'insufficient_member_credit') {
    super(message);
    this.name = 'InsufficientMemberCreditError';
    this.code = 'insufficient_member_credit';
  }
}

export async function redeemMemberCredit(db, {
  tenantId,
  profileId = null,
  email = '',
  appointmentId = null,
  stripeCheckoutSessionId,
  units = 1,
  creditValueCents = 0,
  description = 'IV credit redeemed',
  externalPayload = {},
} = {}) {
  if (!db || !tenantId || !stripeCheckoutSessionId) return null;
  const safeUnits = Math.max(1, Math.floor(Number(units || 1)));
  const member = await resolveCreditMember(db, { tenantId, profileId, email });
  if (!member.profileId && !member.email) return null;
  const valueCents = Math.max(0, Math.round(Number(creditValueCents || 0)));
  // Atomic, balance-floored debit (migration 016). Serializes concurrent
  // redemptions for the member and refuses to drive the balance negative, so a
  // credit can never be spent twice. Idempotent per checkout session.
  const { data, error } = await db.rpc('redeem_member_credit', {
    p_tenant_id: tenantId,
    p_profile_id: member.profileId || null,
    p_member_email: member.email || null,
    p_appointment_id: appointmentId || null,
    p_checkout_session_id: stripeCheckoutSessionId,
    p_units: safeUnits,
    p_credit_value_cents: valueCents,
    p_description: description,
    p_external_payload: externalPayload || {},
  });
  if (error) {
    if (/insufficient_member_credit/i.test(error.message || '')) {
      throw new InsufficientMemberCreditError();
    }
    // Migration 016 not applied yet (function missing): fall back to the prior
    // idempotent insert so redemption keeps working. No worse than before; the
    // atomic guard activates automatically once 016 is live.
    if (error.code === 'PGRST202' || /could not find the function|does not exist|42883/i.test(error.message || '')) {
      const row = {
        tenant_id: tenantId,
        profile_id: member.profileId || null,
        member_email: member.email || null,
        appointment_id: appointmentId || null,
        stripe_checkout_session_id: stripeCheckoutSessionId,
        source: 'iv_credit_redemption',
        units: -safeUnits,
        credit_value_cents: valueCents,
        currency: 'usd',
        description,
        external_payload: externalPayload || {},
      };
      const { data: fb, error: fbErr } = await db.from('member_credit_ledger')
        .upsert(row, { onConflict: 'tenant_id,source,stripe_checkout_session_id', ignoreDuplicates: true })
        .select('id')
        .maybeSingle();
      if (fbErr && !/duplicate|unique|23505/i.test(fbErr.message || '')) throw fbErr;
      return fb || null;
    }
    throw error;
  }
  // rpc returning the row gives an object (or a single-element array depending on
  // the client); normalize to the row.
  return Array.isArray(data) ? data[0] || null : data || null;
}

// ── Refund a redeemed credit when its visit is canceled ──────────────────────
//
// When an appointment that consumed a visit credit is canceled, return the
// credit to the member by posting a POSITIVE grant row
// (source 'credit_refund_cancellation'). This is a fresh grant: it gets a NEW
// 1-year expiry (the member is made whole and has a year to re-use it).
//
// Idempotent per appointment: one refund row per appointment_id. The webhook
// is already deduped per (appointment + action), but the unique source key
// (migration 017) is the durable guard if the cancel event is replayed or two
// cancel paths race.
export async function refundMemberCredit(db, {
  tenantId,
  profileId = null,
  email = '',
  appointmentId,
  units = 1,
  creditValueCents = 0,
  source = 'credit_refund_cancellation',
  description = 'Visit credit refunded (canceled visit)',
  externalPayload = {},
} = {}) {
  if (!db || !tenantId || !appointmentId) return null;
  const member = await resolveCreditMember(db, { tenantId, profileId, email });
  if (!member.profileId && !member.email) return null;
  const safeUnits = Math.max(1, Math.floor(Number(units) || 1));
  const row = {
    tenant_id: tenantId,
    profile_id: member.profileId || null,
    member_email: member.email || null,
    appointment_id: appointmentId,
    source,
    units: safeUnits, // positive: credit returned to the member
    credit_value_cents: Math.max(0, Math.round(Number(creditValueCents) || 0)),
    currency: 'usd',
    description,
    // Fresh 1-year clock on the refunded credit.
    expires_at: addDays(new Date().toISOString(), CREDIT_TTL_DAYS),
    external_payload: externalPayload || {},
  };
  const { data, error } = await db.from('member_credit_ledger')
    .upsert(row, { onConflict: 'tenant_id,source,appointment_id', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();
  if (error) {
    // If the unique index (migration 017) isn't live yet, fall back to a
    // select-then-insert so a replay still can't double-refund.
    if (/no unique|on conflict|42P10|constraint/i.test(error.message || '')) {
      const { data: existing } = await db.from('member_credit_ledger')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('source', source)
        .eq('appointment_id', appointmentId)
        .maybeSingle();
      if (existing?.id) return existing;
      const { data: ins, error: insErr } = await db.from('member_credit_ledger')
        .insert(row).select('id').maybeSingle();
      if (insErr && !/duplicate|unique|23505/i.test(insErr.message || '')) throw insErr;
      return ins || null;
    }
    if (!/duplicate|unique|23505/i.test(error.message || '')) throw error;
  }
  return data || null;
}

// Find the redeemed-credit ledger row tied to an appointment so the webhook can
// refund the same units/value when the visit is canceled. Returns null if the
// visit never spent a credit.
export async function findRedemptionForAppointment(db, { tenantId, appointmentId } = {}) {
  if (!db || !tenantId || !appointmentId) return null;
  const { data, error } = await db.from('member_credit_ledger')
    .select('id, tenant_id, profile_id, member_email, units, credit_value_cents, appointment_id')
    .eq('tenant_id', tenantId)
    .eq('appointment_id', appointmentId)
    .eq('source', 'iv_credit_redemption')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// ── Expiry sweep ─────────────────────────────────────────────────────────────
//
// Writes offsetting negative `credit_expiry` rows for grants whose 1-year
// expiry has passed and whose units have NOT already been consumed or expired.
// Idempotent: a grant that already has a matching `credit_expiry` row (keyed by
// its grant id, migration 017) is skipped, so re-running the sweep never
// double-expires.
//
// NOTE on FIFO: the spend path is the security-definer RPC `redeem_member_credit`
// (migration 016) which sums the whole balance and inserts a single debit — it
// does NOT attribute the debit to a specific grant. So we cannot perfectly know
// which grant a past redemption drew down. We approximate conservatively: an
// expired grant is expired only up to the member's CURRENT live balance, so the
// sweep can never push the balance negative (it never claws back credits the
// member already spent). Net effect: near-expiry credits are effectively used
// first because the balance read already drops aged grants. True per-grant FIFO
// would require changing the RPC, which is out of scope for this file lane.
export async function expireStaleCredits(db, { tenantId, asOf = null, limit = 500 } = {}) {
  if (!db || !tenantId) return { expired: 0, rows: 0, skipped: true };
  const nowIso = asOf || new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  // 1. Candidate expired grants for this tenant (positive units, past expiry).
  const { data: grants, error: grantErr } = await db.from('member_credit_ledger')
    .select('id, tenant_id, profile_id, member_email, units, credit_value_cents, expires_at')
    .eq('tenant_id', tenantId)
    .gt('units', 0)
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(limit);
  if (grantErr) throw grantErr;
  if (!grants || grants.length === 0) return { expired: 0, rows: 0 };

  // 2. Which of those already have a credit_expiry offset? (idempotency)
  const grantIds = grants.map((g) => g.id);
  const { data: already, error: alreadyErr } = await db.from('member_credit_ledger')
    .select('external_payload')
    .eq('tenant_id', tenantId)
    .eq('source', 'credit_expiry')
    .in('external_payload->>expiredGrantId', grantIds);
  if (alreadyErr && !/operator|->>|not supported/i.test(alreadyErr.message || '')) throw alreadyErr;
  const expiredSet = new Set(
    (already || []).map((r) => r?.external_payload?.expiredGrantId).filter(Boolean)
  );

  // Per-member budget of units we're allowed to expire this run. Uses the SAME
  // FIFO rule as liveBalance(): spends (incl. prior expiries) draw down the
  // expired pile first, so we only age out the still-unspent expired units and
  // can never claw back credits the member already redeemed (balance stays >= 0).
  // We decrement the budget as we post each expiry across the member's grants.
  const budgetByMember = new Map();
  function memberKey(grant) {
    return grant.profile_id ? `p:${grant.profile_id}` : `e:${normalizeEmail(grant.member_email)}`;
  }
  async function expiryBudget(grant) {
    const key = memberKey(grant);
    if (budgetByMember.has(key)) return budgetByMember.get(key);
    let q = db.from('member_credit_ledger')
      .select('units, expires_at, source')
      .eq('tenant_id', tenantId);
    q = memberFilter(q, { profileId: grant.profile_id || null, email: grant.member_email || '' });
    const { data: memberRows, error: mErr } = await q;
    if (mErr) throw mErr;
    let rawSum = 0;
    let expiredGrantUnits = 0;
    let spentUnits = 0;
    for (const r of (memberRows || [])) {
      const u = Number(r.units || 0);
      rawSum += u;
      if (u < 0) spentUnits += Math.abs(u);
      else if (isExpiredGrantRow(r, nowMs)) expiredGrantUnits += u;
    }
    // Already-posted credit_expiry rows are counted in spentUnits above, so this
    // is the remaining un-swept, unspent, expired budget — never negative.
    const budget = Math.min(Math.max(0, rawSum), Math.max(0, expiredGrantUnits - spentUnits));
    budgetByMember.set(key, budget);
    return budget;
  }
  function decBudget(grant, by) {
    const key = memberKey(grant);
    budgetByMember.set(key, Math.max(0, (budgetByMember.get(key) || 0) - by));
  }

  let expiredUnits = 0;
  let rows = 0;
  for (const grant of grants) {
    if (expiredSet.has(grant.id)) continue; // already swept
    const budget = await expiryBudget(grant);
    const grantUnits = Math.max(0, Math.floor(Number(grant.units) || 0));
    const expireUnits = Math.min(grantUnits, budget);
    if (expireUnits <= 0) continue; // nothing unspent left to expire for this member

    const offset = {
      tenant_id: tenantId,
      profile_id: grant.profile_id || null,
      member_email: grant.member_email || null,
      appointment_id: null,
      source: 'credit_expiry',
      units: -expireUnits,
      credit_value_cents: Math.max(0, Math.round(Number(grant.credit_value_cents) || 0)),
      currency: 'usd',
      description: 'Visit credit expired (1 year)',
      expires_at: grant.expires_at,
      external_payload: { expiredGrantId: grant.id },
    };
    const { error: insErr } = await db.from('member_credit_ledger').insert(offset);
    if (insErr) {
      // Unique guard (migration 017) won the race — already expired; skip.
      if (/duplicate|unique|23505/i.test(insErr.message || '')) continue;
      throw insErr;
    }
    decBudget(grant, expireUnits);
    expiredUnits += expireUnits;
    rows += 1;
  }
  return { expired: expiredUnits, rows };
}
