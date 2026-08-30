import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

async function requireEligibleProvider(authed) {
  const result = await authed.db.from('provider_profiles')
    .select('id')
    .eq('tenant_id', authed.tenantId)
    .eq('profile_id', authed.user.id)
    .eq('active', true)
    .eq('credential_status', 'clear')
    .eq('nursys_status', 'clear')
    .in('provider_role', ['rn', 'np'])
    .limit(2);
  if (result.error) throw result.error;
  if (!(result.data || []).length) {
    throw Object.assign(new Error('An active, credential-cleared nurse profile is required.'), {
      status: 403,
      code: 'provider_not_eligible',
    });
  }
  if (result.data.length > 1) {
    throw Object.assign(new Error('Multiple active provider profiles need administrator review.'), {
      status: 409,
      code: 'provider_profile_ambiguous',
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireRole(req, res, ['nurse', 'rn', 'np', 'admin']);
  if (!authed) return;
  try {
    await requireEligibleProvider(authed);
    // The canonical 047 schema links contractor invoices to the authenticated
    // auth/profile id. Never fall back to a matching email: shared-door intake
    // email is self-asserted until an administrator links the row.
    const result = await authed.db.from('nurse_invoices')
      .select('id,invoice_number,status,period_start,period_end,wages_cents,reimbursements_cents,total_cents,currency,submitted_at,reviewed_at,review_note,paid_at,payment_reference,identity_assurance,version')
      .eq('tenant_id', authed.tenantId)
      .eq('nurse_profile_id', authed.user.id)
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (result.error) throw result.error;
    return res.status(200).json({ invoices: result.data || [] });
  } catch (error) {
    console.warn('[me/nurse-invoices] failed', safeLogContext(error, 'me_nurse_invoices_failed'));
    const missingCode = ['42P01', '42703', 'PGRST200', 'PGRST204'].includes(String(error?.code || ''));
    const financeMissing = missingCode && /nurse_invoices/i.test(String(error?.message || ''));
    const setupMissing = missingCode && !financeMissing;
    const userError = ['provider_not_eligible', 'provider_profile_ambiguous'].includes(String(error?.code || ''));
    const status = userError ? error.status : missingCode ? 503 : 500;
    return res.status(status).json({
      error: financeMissing
        ? 'Invoices are not available until the finance migration is applied.'
        : setupMissing
          ? 'Provider access is not available until account setup is complete.'
          : userError ? error.message : 'Could not load invoices.',
      code: financeMissing
        ? 'finance_migration_required'
        : setupMissing
          ? 'provider_setup_required'
          : safeErrorCode(error, 'me_nurse_invoices_failed'),
    });
  }
}
