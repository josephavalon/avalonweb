import crypto from 'crypto';
import { requireAdmin } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import {
  callNurseRpc,
  parseJsonBody,
  requestError,
  requirePositiveVersion,
  requireUuid,
} from '../_lib/nurse-workflow.js';
import { enqueueMarketplaceJob, nurseMarketplaceCapabilities } from '../_lib/nurse-marketplace.js';

const SAFE_TERM_FIELDS = Object.freeze([
  'engagement_model', 'gross_pay_cents', 'hourly_rate_cents', 'currency',
  'estimated_work_minutes', 'estimated_travel_minutes', 'mileage_rate_cents',
  'guaranteed_minimum_cents', 'cancellation_terms_code', 'expense_policy_code',
]);

async function loadOfferCandidateContexts(db, tenantId) {
  const nowIso = new Date().toISOString();
  const [shiftsResult, providersResult, preferencesResult, policiesResult] = await Promise.all([
    db.from('operational_shifts')
      .select('id,appointment_id,starts_at,ends_at,timezone,role_required,status,version')
      .eq('tenant_id', tenantId).eq('status', 'open').not('appointment_id', 'is', null)
      .order('starts_at').limit(250),
    db.from('provider_profiles')
      .select('id,profile_id,provider_role,credential_status,nursys_status,active')
      .eq('tenant_id', tenantId).in('provider_role', ['rn', 'np']).eq('active', true)
      .eq('credential_status', 'clear').eq('nursys_status', 'clear').limit(250),
    db.from('provider_work_preferences')
      .select('provider_profile_id,engagement_status,engagement_effective_at')
      .eq('tenant_id', tenantId).eq('engagement_status', 'contractor_approved')
      .lte('engagement_effective_at', nowIso).limit(250),
    db.from('nurse_marketplace_policies')
      .select('id,policy_type,market_key,version,rules,rules_hash,approved_at,effective_at')
      .eq('tenant_id', tenantId).eq('status', 'approved').lte('effective_at', nowIso)
      .in('policy_type', ['offer_terms', 'offer_wave', 'offer_expiry'])
      .order('version', { ascending: false }).order('effective_at', { ascending: false }).limit(50),
  ]);
  for (const result of [shiftsResult, providersResult, preferencesResult, policiesResult]) {
    if (result.error) throw result.error;
  }
  const preferenceByProvider = new Map((preferencesResult.data || []).map((row) => [row.provider_profile_id, row]));
  const eligibleProviders = (providersResult.data || []).filter((row) => preferenceByProvider.has(row.id));
  let profileNames = [];
  if (eligibleProviders.length) {
    const namesResult = await db.from('profiles').select('id,full_name,status')
      .eq('tenant_id', tenantId)
      .in('id', eligibleProviders.map((row) => row.profile_id))
      .eq('status', 'active');
    if (namesResult.error) throw namesResult.error;
    profileNames = namesResult.data || [];
  }
  const nameById = new Map(profileNames.map((row) => [row.id, row.full_name]));
  const policies = policiesResult.data || [];
  const wavePolicy = policies.find((policy) => policy.policy_type === 'offer_wave') || null;
  const expiryPolicy = policies.find((policy) => policy.policy_type === 'offer_expiry') || null;
  const allowedWaveKeys = Array.isArray(wavePolicy?.rules?.allowed_wave_keys)
    ? wavePolicy.rules.allowed_wave_keys.map(String).filter(Boolean) : [];
  const allowedCohortKeys = Array.isArray(wavePolicy?.rules?.allowed_cohort_keys)
    ? wavePolicy.rules.allowed_cohort_keys.map(String).filter(Boolean) : [];
  const maxExpiryMinutes = Number(expiryPolicy?.rules?.max_minutes || 0);
  const termsPolicies = policies.filter((policy) => policy.policy_type === 'offer_terms').map((policy) => ({
    id: policy.id,
    label: `${policy.market_key} terms · v${policy.version}`,
    market_key: policy.market_key,
    version: policy.version,
    rules_hash: policy.rules_hash,
    approved_at: policy.approved_at,
    terms: Object.entries(policy.rules?.approved_terms || {}).flatMap(([termsKey, material]) => {
      if (!material || typeof material !== 'object' || Array.isArray(material)
          || material.engagement_model !== 'approved_contractor') return [];
      return [{
        terms_key: termsKey,
        ...Object.fromEntries(SAFE_TERM_FIELDS.map((field) => [field, material[field] ?? null])),
      }];
    }),
  })).filter((policy) => policy.terms.length);
  const shifts = (shiftsResult.data || []).map((shift) => ({
    id: shift.id,
    version: shift.version,
    starts_at: shift.starts_at,
    ends_at: shift.ends_at,
    timezone: shift.timezone,
    role_required: shift.role_required,
    label: `Mobile shift · ${shift.starts_at}`,
  }));
  const providers = eligibleProviders.filter((provider) => nameById.has(provider.profile_id)).map((provider) => ({
    id: provider.id,
    provider_role: provider.provider_role,
    label: nameById.get(provider.profile_id) || `Nurse ${provider.id.slice(0, 8)}`,
  }));
  const available = Boolean(shifts.length && providers.length && termsPolicies.length
    && allowedWaveKeys.length && allowedCohortKeys.length && Number.isInteger(maxExpiryMinutes) && maxExpiryMinutes > 0);
  return {
    available,
    shifts,
    providers,
    terms_policies: termsPolicies,
    offer_wave_policy_id: wavePolicy?.id || null,
    allowed_wave_keys: allowedWaveKeys,
    allowed_cohort_keys: allowedCohortKeys,
    offer_expiry_policy_id: expiryPolicy?.id || null,
    max_expiry_minutes: Number.isInteger(maxExpiryMinutes) && maxExpiryMinutes > 0 ? maxExpiryMinutes : null,
  };
}

async function loadDispatch(db, tenantId) {
  const [days, offers, events, deadLetters, offerCandidateContexts] = await Promise.all([
    db.from('provider_route_days')
      .select('id,provider_profile_id,route_date,status,version,current_plan_version_id,released_at,release_reason_code,updated_at')
      .eq('tenant_id', tenantId).order('route_date', { ascending: true }).limit(250),
    db.from('nurse_shift_offers')
      .select('id,shift_id,provider_profile_id,wave_key,cohort_key,status,version,offered_at,expires_at,acted_at,revocation_code')
      .eq('tenant_id', tenantId).order('offered_at', { ascending: false }).limit(250),
    db.from('nurse_appointment_source_events')
      .select('id,source_provider,source_appointment_id,source_revision,event_type,status,attempts,next_attempt_at,failure_code,received_at,processed_at')
      .eq('tenant_id', tenantId).order('received_at', { ascending: false }).limit(100),
    db.from('nurse_marketplace_dead_letters')
      .select('id,job_id,job_type,error_code,attempts,created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
    loadOfferCandidateContexts(db, tenantId),
  ]);
  for (const result of [days, offers, events, deadLetters]) if (result.error) throw result.error;
  return {
    route_days: days.data || [],
    offers: offers.data || [],
    source_events: events.data || [],
    dead_letters: deadLetters.data || [],
    offer_candidate_contexts: offerCandidateContexts,
  };
}

async function loadInventory(db, tenantId) {
  const [pickups, reservations, manifests] = await Promise.all([
    db.from('nurse_pickup_tasks')
      .select('id,shift_id,provider_profile_id,location_id,route_day_id,status,window_starts_at,window_ends_at,evidence_hash,version,completed_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(250),
    db.from('nurse_inventory_reservations')
      .select('id,shift_id,offer_id,provider_profile_id,requirement_id,location_id,item_id,variant_id,lot_id,quantity,status,version,expires_at,release_code,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500),
    db.from('nurse_supply_manifest_versions')
      .select('id,manifest_id,version,status,requirements_hash,approved_at,published_at,retired_at,created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(250),
  ]);
  for (const result of [pickups, reservations, manifests]) if (result.error) throw result.error;
  return {
    pickup_tasks: (pickups.data || []).map((task) => ({ ...task, allowed_actions: [] })),
    reservations: reservations.data || [],
    manifest_versions: manifests.data || [],
  };
}

async function loadGuides(db, tenantId) {
  const [templates, versions] = await Promise.all([
    db.from('shift_guide_templates')
      .select('id,template_key,name,work_kind,protocol_key,role_required,active,created_at,updated_at')
      .eq('tenant_id', tenantId).order('name').limit(250),
    db.from('shift_guide_versions')
      .select('id,template_id,version,status,publication_status,clinical_reviewed_by,clinical_reviewed_at,medical_director_approval_required,medical_director_approved_by,medical_director_approved_at,published_by,source_reference,approved_at,published_at,retired_at,content_hash,created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500),
  ]);
  for (const result of [templates, versions]) if (result.error) throw result.error;
  const shapedVersions = (versions.data || []).map((version) => {
    const publicationStatus = version.publication_status || 'draft';
    const publishAllowed = Boolean(
      version.content_hash
      && version.clinical_reviewed_at
      && (!version.medical_director_approval_required || version.medical_director_approved_at),
    );
    return {
      ...version,
      normalized_status: publicationStatus,
      allowed_actions: publicationStatus === 'draft'
        ? ['submit_clinical_review']
        : publicationStatus === 'published'
          ? ['retire']
          : publishAllowed && ['clinical_review', 'medical_director_approval'].includes(publicationStatus)
            ? ['publish'] : [],
    };
  });
  return { templates: templates.data || [], versions: shapedVersions };
}

const ACTION_RPC = Object.freeze({
  release_route: 'admin_release_nurse_route_v1',
  recover_route: 'admin_recover_nurse_route_v1',
  recheck_inventory: 'recheck_nurse_inventory_v1',
  submit_clinical_review: 'transition_nurse_guide_version_v1',
  publish: 'transition_nurse_guide_version_v1',
  retire: 'transition_nurse_guide_version_v1',
});

function requiredInteger(value, field, { min = 0, max = 10_000_000 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw requestError(`${field} is invalid.`, 'offer_candidate_terms_invalid');
  }
  return parsed;
}

function requiredCode(value, field, max = 100) {
  const code = String(value || '').trim();
  if (!code || code.length > max || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(code)) {
    throw requestError(`${field} is invalid.`, 'offer_candidate_terms_invalid');
  }
  return code;
}

async function prepareOfferCandidate(db, authed, body) {
  const shiftId = requireUuid(body.entityId || body.shiftId, 'Shift id');
  const providerProfileId = requireUuid(body.providerProfileId, 'Provider profile id');
  const approvalPolicyId = requireUuid(body.approvalPolicyId, 'Approval policy id');
  const idempotencyKey = requireUuid(body.idempotencyKey, 'Idempotency key');
  const expectedShiftVersion = requirePositiveVersion(body.expectedVersion ?? body.expectedShiftVersion, 'Shift version');
  const engagementModel = String(body.engagementModel || '').trim().toLowerCase();
  if (engagementModel !== 'approved_contractor') {
    throw requestError('Engagement model is invalid.', 'offer_candidate_terms_invalid');
  }
  const expiresAtMs = Date.parse(String(body.expiresAt || ''));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw requestError('Offer expiration is invalid.', 'offer_candidate_terms_invalid');
  }
  const terms = {
    termsKey: requiredCode(body.termsKey, 'Terms key'),
    engagementModel,
    grossPayCents: requiredInteger(body.grossPayCents, 'Gross pay'),
    hourlyRateCents: requiredInteger(body.hourlyRateCents, 'Hourly rate'),
    currency: requiredCode(body.currency, 'Currency', 3).toLowerCase(),
    estimatedWorkMinutes: requiredInteger(body.estimatedWorkMinutes, 'Estimated work minutes', { min: 1, max: 1440 }),
    estimatedTravelMinutes: requiredInteger(body.estimatedTravelMinutes, 'Estimated travel minutes', { max: 1440 }),
    mileageRateCents: requiredInteger(body.mileageRateCents, 'Mileage rate'),
    guaranteedMinimumCents: requiredInteger(body.guaranteedMinimumCents, 'Guaranteed minimum'),
    cancellationTermsCode: requiredCode(body.cancellationTermsCode, 'Cancellation terms'),
    expensePolicyCode: requiredCode(body.expensePolicyCode, 'Expense policy'),
    expiresAt: new Date(expiresAtMs).toISOString(),
    waveKey: requiredCode(body.waveKey, 'Wave key'),
    cohortKey: requiredCode(body.cohortKey, 'Cohort key'),
  };
  const requestMaterial = {
    shiftId, providerProfileId, expectedShiftVersion, approvalPolicyId, idempotencyKey, ...terms,
  };
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestMaterial)).digest('hex');
  const candidate = await callNurseRpc(db, 'prepare_nurse_offer_candidate_v1', {
    p_tenant_id: authed.tenantId,
    p_actor_profile_id: authed.user.id,
    p_shift_id: shiftId,
    p_provider_profile_id: providerProfileId,
    p_expected_shift_version: expectedShiftVersion,
    p_approval_policy_id: approvalPolicyId,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_terms_key: terms.termsKey,
    p_engagement_model: terms.engagementModel,
    p_gross_pay_cents: terms.grossPayCents,
    p_hourly_rate_cents: terms.hourlyRateCents,
    p_currency: terms.currency,
    p_estimated_work_minutes: terms.estimatedWorkMinutes,
    p_estimated_travel_minutes: terms.estimatedTravelMinutes,
    p_mileage_rate_cents: terms.mileageRateCents,
    p_guaranteed_minimum_cents: terms.guaranteedMinimumCents,
    p_cancellation_terms_code: terms.cancellationTermsCode,
    p_expense_policy_code: terms.expensePolicyCode,
    p_expires_at: terms.expiresAt,
    p_wave_key: terms.waveKey,
    p_cohort_key: terms.cohortKey,
  });
  const offerTermsId = requireUuid(candidate?.offer_terms_id, 'Prepared offer terms id');
  const readinessJob = await enqueueMarketplaceJob(db, {
    tenantId: authed.tenantId,
    jobType: 'readiness_evaluate',
    idempotencyKey: `offer-ready:${idempotencyKey}:${shiftId}:${providerProfileId}`,
    payload: {
      shiftId,
      providerProfileId,
      actorProfileId: authed.user.id,
      stage: 'offer',
      offerCandidate: {
        offerTermsId,
        waveKey: candidate.wave_key,
        cohortKey: candidate.cohort_key,
        expiresAt: candidate.expires_at,
        approvalCorrelationId: idempotencyKey,
      },
    },
  });
  return { candidate, readiness_job_id: readinessJob?.id || null };
}

async function runAction(db, authed, body) {
  const action = String(body.action || '').trim().toLowerCase();
  if (action === 'prepare_offer_candidate') return prepareOfferCandidate(db, authed, body);
  const rpc = ACTION_RPC[action];
  if (!rpc) throw requestError('Unsupported marketplace admin action.', 'invalid_marketplace_admin_action');
  return callNurseRpc(db, rpc, {
    p_tenant_id: authed.tenantId,
    p_actor_profile_id: authed.user.id,
    p_entity_id: requireUuid(body.entityId, 'Entity id'),
    p_expected_version: requirePositiveVersion(body.expectedVersion, 'Version'),
    p_idempotency_key: requireUuid(body.idempotencyKey, 'Idempotency key'),
    p_action: action,
    p_reason_code: String(body.reasonCode || action).trim().slice(0, 100),
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    if (req.method === 'GET') {
      const view = String(req.query?.view || 'dispatch').toLowerCase();
      const data = view === 'dispatch'
        ? await loadDispatch(authed.db, authed.tenantId)
        : view === 'inventory'
          ? await loadInventory(authed.db, authed.tenantId)
          : view === 'guides'
            ? await loadGuides(authed.db, authed.tenantId)
            : null;
      if (!data) return res.status(400).json({ error: 'Unsupported marketplace view.', code: 'invalid_marketplace_view' });
      return res.status(200).json({ view, ...data, capabilities: nurseMarketplaceCapabilities() });
    }
    if (req.method === 'POST') {
      const result = await runAction(authed.db, authed, parseJsonBody(req));
      return res.status(200).json({ ok: true, result });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.warn('[admin/nurse-marketplace] failed', safeLogContext(error, 'admin_nurse_marketplace_failed'));
    return res.status(error.status || 500).json({
      error: error.expose ? error.message : 'Could not load or update nurse marketplace operations.',
      code: safeErrorCode(error, 'admin_nurse_marketplace_failed'),
    });
  }
}
