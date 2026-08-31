import { writeAuditEvent } from '../_lib/audit-events.js';
import { financeAdapterHealth, requireNursePayActor, sendPayOpsError } from '../_lib/payops-core.js';
import { effectiveEngagement, safeEngagementView } from '../_lib/payops-views.js';

function safeAdapterStates() {
  const health = financeAdapterHealth();
  return {
    mercury: { state: health.mercury.state, action: health.mercury.action },
    gustoEmbedded: { state: health.gustoEmbedded.state, action: health.gustoEmbedded.action },
    contractorTax: { state: health.contractorTax.state, action: health.contractorTax.action },
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireNursePayActor(req, res);
    if (!authed) return;
    const decision = await effectiveEngagement(authed.db, authed.tenantId, authed.user.id);
    let payee = null;
    let payroll = null;
    if (decision?.legal_entity_id && decision.decision_status === 'CONTRACTOR_APPROVED') {
      const result = await authed.db.from('payee_profiles')
        .select('id,address_status,tax_readiness,payment_readiness,destination_masked_label,contact_consent_status,version')
        .eq('tenant_id', authed.tenantId)
        .eq('worker_profile_id', authed.user.id)
        .eq('legal_entity_id', decision.legal_entity_id)
        .maybeSingle();
      if (result.error) throw result.error;
      if (result.data) {
        payee = {
          id: result.data.id,
          addressStatus: result.data.address_status,
          taxReadiness: result.data.tax_readiness,
          paymentReadiness: result.data.payment_readiness,
          destinationMaskedLabel: result.data.destination_masked_label,
          contactConsentStatus: result.data.contact_consent_status,
          version: result.data.version,
        };
      }
    }
    if (decision?.legal_entity_id && decision.decision_status === 'W2_EMPLOYEE') {
      const result = await authed.db.from('payroll_profiles')
        .select('id,onboarding_status,coverage_status,payment_method_status,statement_status,version')
        .eq('tenant_id', authed.tenantId)
        .eq('worker_profile_id', authed.user.id)
        .eq('legal_entity_id', decision.legal_entity_id)
        .maybeSingle();
      if (result.error) throw result.error;
      if (result.data) {
        payroll = {
          id: result.data.id,
          onboardingStatus: result.data.onboarding_status,
          coverageStatus: result.data.coverage_status,
          paymentMethodStatus: result.data.payment_method_status,
          statementStatus: result.data.statement_status,
          version: result.data.version,
        };
      }
    }

    const outstandingActions = [];
    if (!decision || decision.decision_status === 'PENDING_REVIEW') {
      outstandingActions.push({ code: 'ENGAGEMENT_REVIEW_REQUIRED', owner: 'HR/Legal', blocking: true });
    } else if (decision.decision_status === 'CONTRACTOR_APPROVED') {
      if (!payee) outstandingActions.push({ code: 'PAYEE_PROFILE_REQUIRED', owner: 'Finance', blocking: true });
      if (payee && payee.taxReadiness !== 'ready') outstandingActions.push({ code: 'TAX_READINESS_REQUIRED', owner: 'Finance/Tax', blocking: true });
      if (payee && payee.paymentReadiness !== 'ready') outstandingActions.push({ code: 'PAYMENT_DESTINATION_REQUIRED', owner: 'Nurse/Finance', blocking: true });
    } else if (decision.decision_status === 'W2_EMPLOYEE') {
      if (!payroll) outstandingActions.push({ code: 'PAYROLL_PROFILE_REQUIRED', owner: 'HR/Payroll', blocking: true });
      if (payroll && payroll.onboardingStatus !== 'READY') outstandingActions.push({ code: 'PAYROLL_ONBOARDING_REQUIRED', owner: 'HR/Payroll', blocking: true });
      if (payroll && payroll.coverageStatus !== 'VERIFIED') outstandingActions.push({ code: 'PAYROLL_COVERAGE_REVIEW_REQUIRED', owner: 'HR/Payroll', blocking: true });
    }

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: 'nurse_pay_profile_read',
      entityType: 'profiles',
      entityId: authed.user.id,
      phiTouched: false,
      payload: { engagementStatus: decision?.decision_status || 'PENDING_REVIEW' },
    });
    return res.status(200).json({
      engagement: safeEngagementView(decision),
      contractor: payee,
      employee: payroll,
      outstandingActions,
      adapterStates: safeAdapterStates(),
      supportRoute: '/help',
    });
  } catch (error) {
    return sendPayOpsError(res, error, 'Your pay profile is unavailable.');
  }
}
