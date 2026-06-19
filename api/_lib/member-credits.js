function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
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
    .select('units')
    .eq('tenant_id', tenantId);
  query = memberFilter(query, { profileId, email: normalizedEmail });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + Number(row.units || 0), 0);
}

export async function listMemberCreditLedger(db, { tenantId, profileId = null, email = '', limit = 50 } = {}) {
  if (!db || !tenantId) return [];
  const normalizedEmail = normalizeEmail(email);
  if (!profileId && !normalizedEmail) return [];
  let query = db.from('member_credit_ledger')
    .select('id, source, units, credit_value_cents, currency, description, appointment_id, stripe_checkout_session_id, stripe_subscription_id, stripe_invoice_id, created_at, external_payload')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  query = memberFilter(query, { profileId, email: normalizedEmail });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
  externalPayload = {},
} = {}) {
  if (!db || !tenantId) return null;
  const member = await resolveCreditMember(db, { tenantId, profileId, email });
  if (!member.profileId && !member.email) return null;
  const row = {
    tenant_id: tenantId,
    profile_id: member.profileId || null,
    member_email: member.email || null,
    appointment_id: appointmentId || null,
    stripe_checkout_session_id: stripeCheckoutSessionId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    stripe_invoice_id: stripeInvoiceId || null,
    source,
    units: 1,
    credit_value_cents: 0,
    currency: 'usd',
    description,
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
