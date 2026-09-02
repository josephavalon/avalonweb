import crypto from 'crypto';
import {
  callNurseRpc,
  evaluateShiftReadiness,
  loadOwnAssignment,
  loadWorkPreferences,
  requestError,
  requireUuid,
} from './nurse-workflow.js';
import { enqueueMarketplaceJob, envEnabled, nurseMarketplaceCapabilities } from './nurse-marketplace.js';
import { loadOwnedRouteDay, planOwnedRouteDay } from './nurse-route-days.js';
import { routeProviderConfiguration } from './nurse-route-provider.js';

const JOB_HANDLERS = Object.freeze({
  notification_deliver: 'deliver_nurse_in_app_offer_v1',
  daily_readiness_sweep: 'run_nurse_marketplace_daily_sweep_v1',
});

const MAX_ATTEMPTS = 8;

function retryDelaySeconds(attempt) {
  return Math.min(6 * 60 * 60, 30 * (2 ** Math.max(0, Number(attempt || 1) - 1)));
}

async function completeJob(db, job, result) {
  const update = await db.from('nurse_marketplace_jobs').update({
    status: 'completed',
    result: result && typeof result === 'object' ? result : { result: result ?? null },
    completed_at: new Date().toISOString(),
    lease_token: null,
    lease_expires_at: null,
    last_error_code: null,
  }).eq('tenant_id', job.tenant_id).eq('id', job.id).eq('lease_token', job.lease_token);
  if (update.error) throw update.error;
}

async function failJob(db, job, error) {
  const attempts = Number(job.attempts || 0);
  const exhausted = attempts >= MAX_ATTEMPTS;
  const code = String(error?.code || error?.name || 'marketplace_job_failed').replace(/[^a-z0-9_:-]/gi, '_').slice(0, 100);
  if (exhausted) {
    const deadLetter = await db.from('nurse_marketplace_dead_letters').upsert({
      tenant_id: job.tenant_id,
      job_id: job.id,
      job_type: job.job_type,
      idempotency_key: job.idempotency_key,
      payload: job.payload || {},
      error_code: code,
      attempts,
    }, { onConflict: 'tenant_id,job_id', ignoreDuplicates: true });
    if (deadLetter.error) throw deadLetter.error;
  }
  const availableAt = new Date(Date.now() + retryDelaySeconds(attempts) * 1000).toISOString();
  const update = await db.from('nurse_marketplace_jobs').update({
    status: exhausted ? 'dead_letter' : 'pending',
    available_at: exhausted ? job.available_at : availableAt,
    lease_token: null,
    lease_expires_at: null,
    last_error_code: code,
  }).eq('tenant_id', job.tenant_id).eq('id', job.id).eq('lease_token', job.lease_token);
  if (update.error) throw update.error;
  return { outcome: exhausted ? 'dead_letter' : 'retry', code };
}

async function processJob(db, job) {
  if (job.job_type === 'appointment_reconcile') {
    if (!envEnabled('NURSE_AUTO_SHIFT_CREATION_ENABLED')) {
      throw requestError('Automatic shift creation is disabled.', 'nurse_auto_shift_creation_disabled', 503);
    }
    const reconciled = await callNurseRpc(db, 'reconcile_nurse_appointment_event_v1', {
      p_tenant_id: job.tenant_id,
      p_job_id: job.id,
      p_payload: job.payload || {},
    });
    const shiftId = reconciled?.shift_id || reconciled?.shiftId || null;
    const approvedCandidates = Array.isArray(job.payload?.approvedCandidates)
      ? job.payload.approvedCandidates : [];
    const readinessJobs = [];
    // Candidate construction is intentionally not inferred from broad nurse
    // lists. A tenant-approved dispatcher/policy process must attach an
    // explicit, allowlisted candidate contract to this durable source job.
    for (const rawCandidate of approvedCandidates.slice(0, 100)) {
      if (!shiftId) break;
      const providerProfileId = requireUuid(rawCandidate?.providerProfileId, 'Candidate provider profile id');
      const offerTermsId = requireUuid(rawCandidate?.offerTermsId, 'Candidate offer terms id');
      const approvalCorrelationId = requireUuid(rawCandidate?.approvalCorrelationId, 'Candidate approval correlation id');
      const waveKey = String(rawCandidate?.waveKey || '').trim();
      const cohortKey = String(rawCandidate?.cohortKey || '').trim();
      const expiresAt = new Date(rawCandidate?.expiresAt || '').toISOString();
      if (!waveKey || waveKey.length > 100 || !cohortKey || cohortKey.length > 100) {
        throw requestError('Approved offer wave candidate is invalid.', 'approved_offer_candidate_invalid');
      }
      const queued = await enqueueMarketplaceJob(db, {
        tenantId: job.tenant_id,
        jobType: 'readiness_evaluate',
        idempotencyKey: `offer-ready:${approvalCorrelationId}:${shiftId}:${providerProfileId}`,
        payload: {
          shiftId,
          providerProfileId,
          actorProfileId: rawCandidate.actorProfileId || null,
          stage: 'offer',
          offerCandidate: { offerTermsId, waveKey, cohortKey, expiresAt, approvalCorrelationId },
        },
      });
      if (queued?.id) readinessJobs.push(queued.id);
    }
    return {
      ...reconciled,
      readiness_job_ids: readinessJobs,
      candidate_handoff: approvedCandidates.length ? 'accepted' : 'approved_candidates_required',
    };
  }
  if (job.job_type === 'readiness_evaluate') {
    const providerProfileId = job.payload?.providerProfileId;
    const providerResult = await db.from('provider_profiles')
      .select('id,profile_id,person_id,provider_role,credential_status,nursys_status,scope_tags,active')
      .eq('tenant_id', job.tenant_id).eq('id', providerProfileId).maybeSingle();
    if (providerResult.error) throw providerResult.error;
    if (!providerResult.data) throw requestError('Provider profile not found.', 'provider_profile_required', 409);
    let shiftIds = job.payload?.shiftId ? [job.payload.shiftId] : [];
    if (!shiftIds.length && job.payload?.routeDayId) {
      const stops = await db.from('provider_route_day_stops').select('appointment_id')
        .eq('tenant_id', job.tenant_id).eq('route_day_id', job.payload.routeDayId).eq('selected', true);
      if (stops.error) throw stops.error;
      const appointmentIds = (stops.data || []).map((row) => row.appointment_id).filter(Boolean);
      if (appointmentIds.length) {
        const shifts = await db.from('operational_shifts').select('id')
          .eq('tenant_id', job.tenant_id).in('appointment_id', appointmentIds);
        if (shifts.error) throw shifts.error;
        shiftIds = (shifts.data || []).map((row) => row.id);
      }
    }
    const preferences = await loadWorkPreferences(db, job.tenant_id, providerProfileId);
    const results = [];
    for (const shiftId of shiftIds) {
      const [shiftResult, assignment] = await Promise.all([
        db.from('operational_shifts').select('*').eq('tenant_id', job.tenant_id).eq('id', shiftId).maybeSingle(),
        loadOwnAssignment(db, job.tenant_id, providerProfileId, shiftId),
      ]);
      if (shiftResult.error) throw shiftResult.error;
      if (!shiftResult.data) continue;
      const evaluated = await evaluateShiftReadiness({
        db,
        authed: { db, tenantId: job.tenant_id, user: { id: job.payload?.actorProfileId || providerResult.data.profile_id } },
        provider: providerResult.data,
        shift: { ...shiftResult.data, assignment },
        preferences,
        stage: job.payload?.stage || 'claim',
      });
      results.push({ shiftId, status: evaluated.readiness.status, snapshotId: evaluated.snapshot.id });
      if (evaluated.readiness.status === 'ready' && job.payload?.stage === 'offer' && job.payload?.offerCandidate) {
        const candidate = job.payload.offerCandidate;
        const offerTermsId = requireUuid(candidate.offerTermsId, 'Candidate offer terms id');
        const approvalCorrelationId = requireUuid(candidate.approvalCorrelationId, 'Candidate approval correlation id');
        const waveKey = String(candidate.waveKey || '').trim();
        const cohortKey = String(candidate.cohortKey || '').trim();
        const expiresAt = new Date(candidate.expiresAt || '').toISOString();
        if (!waveKey || waveKey.length > 100 || !cohortKey || cohortKey.length > 100) {
          throw requestError('Approved offer wave candidate is invalid.', 'approved_offer_candidate_invalid');
        }
        await enqueueMarketplaceJob(db, {
          tenantId: job.tenant_id,
          jobType: 'offer_distribute',
          idempotencyKey: `offer-distribute:${approvalCorrelationId}:${shiftId}:${providerProfileId}`,
          payload: {
            approval_correlation_id: approvalCorrelationId,
            offers: [{
              shift_id: shiftId,
              provider_profile_id: providerProfileId,
              offer_terms_id: offerTermsId,
              readiness_snapshot_id: evaluated.snapshot.id,
              wave_key: waveKey,
              cohort_key: cohortKey,
              expires_at: expiresAt,
            }],
          },
        });
      }
    }
    return { stage: job.payload?.stage || 'claim', results };
  }
  if (job.job_type === 'offer_distribute') {
    if (!envEnabled('NURSE_SHIFT_OFFERS_ENABLED')) {
      throw requestError('Shift offers are disabled.', 'nurse_shift_offers_disabled', 503);
    }
    if (!job.payload?.approval_correlation_id || !Array.isArray(job.payload?.offers)) {
      throw requestError('An audited approved offer candidate payload is required.', 'approved_offer_candidates_required');
    }
    requireUuid(job.payload.approval_correlation_id, 'Offer approval correlation id');
    const termsIds = job.payload.offers.map((offer) => requireUuid(offer?.offer_terms_id, 'Offer terms id'));
    const termsResult = await db.from('nurse_offer_terms')
      .select('id,engagement_model')
      .eq('tenant_id', job.tenant_id)
      .in('id', termsIds);
    if (termsResult.error) throw termsResult.error;
    if ((termsResult.data || []).length !== new Set(termsIds).size
        || (termsResult.data || []).some((terms) => terms.engagement_model !== 'approved_contractor')) {
      throw requestError('Only approved contractor terms may enter an offer wave.', 'approved_offer_candidates_required');
    }
    const distributed = await callNurseRpc(db, 'distribute_nurse_shift_offers_v1', {
      p_tenant_id: job.tenant_id,
      p_job_id: job.id,
      p_payload: job.payload,
    });
    const deliveriesResult = await db.from('nurse_offer_deliveries')
      .select('id')
      .eq('tenant_id', job.tenant_id)
      .eq('channel', 'in_app')
      .eq('status', 'queued')
      .limit(500);
    if (deliveriesResult.error) throw deliveriesResult.error;
    const deliveryJobIds = [];
    for (const delivery of deliveriesResult.data || []) {
      const queued = await enqueueMarketplaceJob(db, {
        tenantId: job.tenant_id,
        jobType: 'notification_deliver',
        idempotencyKey: `offer-delivery:${delivery.id}`,
        payload: { delivery_id: delivery.id },
      });
      if (queued?.id) deliveryJobIds.push(queued.id);
    }
    return { ...distributed, delivery_job_ids: deliveryJobIds };
  }
  if (job.job_type === 'route_stop_reconcile') {
    return callNurseRpc(db, 'reconcile_nurse_route_stop_v1', {
      p_tenant_id: job.tenant_id,
      p_actor_profile_id: job.payload?.actorProfileId,
      p_provider_profile_id: job.payload?.providerProfileId,
      p_route_day_id: job.payload?.routeDayId,
      p_shift_id: job.payload?.shiftId,
      p_shift_run_id: job.payload?.shiftRunId,
      p_idempotency_key: job.payload?.idempotencyKey,
    });
  }
  if (job.job_type === 'route_plan') {
    if (!envEnabled('NURSE_ROUTE_PLANNING_ENABLED') || !routeProviderConfiguration().ready) {
      throw requestError('Route planning is unavailable.', 'route_planning_disabled', 503);
    }
    if (String(job.payload?.originKind || '').toLowerCase() === 'current') {
      throw requestError(
        'Foreground origin requires fresh nurse consent and cannot be retried in the background.',
        'foreground_origin_retry_requires_fresh_consent',
        409,
      );
    }
    const routeDay = await loadOwnedRouteDay(db, {
      tenantId: job.tenant_id,
      providerProfileId: job.payload?.providerProfileId,
      routeDayId: job.payload?.routeDayId,
    });
    return planOwnedRouteDay(db, {
      tenantId: job.tenant_id,
      actorProfileId: job.payload?.actorProfileId,
      providerProfileId: job.payload?.providerProfileId,
      routeDay,
      body: {
        expectedVersion: job.payload?.expectedVersion,
        idempotencyKey: job.payload?.idempotencyKey,
        originKind: job.payload?.originKind,
        consentTextVersion: job.payload?.consentTextVersion,
      },
    });
  }
  const rpcName = JOB_HANDLERS[job.job_type];
  if (!rpcName) throw requestError('Unsupported marketplace job type.', 'marketplace_job_type_invalid');
  if (['offer_distribute', 'notification_deliver'].includes(job.job_type)
    && !envEnabled('NURSE_SHIFT_OFFERS_ENABLED')) {
    throw requestError('Shift offers are disabled.', 'nurse_shift_offers_disabled', 503);
  }
  return callNurseRpc(db, rpcName, {
    p_tenant_id: job.tenant_id,
    p_job_id: job.id,
    p_payload: job.payload || {},
  });
}

export async function leaseMarketplaceJobs(db, { limit, leaseSeconds, worker = null } = {}) {
  const resolvedLimit = limit ?? Number(process.env.NURSE_MARKETPLACE_JOB_BATCH_SIZE || 25);
  const resolvedLease = leaseSeconds ?? Number(process.env.NURSE_MARKETPLACE_WORKER_LEASE_SECONDS || 55);
  const result = await db.rpc('lease_nurse_marketplace_jobs_v1', {
    p_worker: worker || `vercel-${crypto.randomUUID()}`,
    p_limit: Math.max(1, Math.min(100, Number(resolvedLimit) || 25)),
    p_lease_seconds: Math.max(30, Math.min(300, Number(resolvedLease) || 55)),
  });
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
}

export async function runNurseMarketplaceWorker(db, options = {}) {
  const capabilities = nurseMarketplaceCapabilities();
  if (!capabilities.auto_shift_creation && !capabilities.offers && !capabilities.route_planning) {
    return { outcome: 'disabled', processed: 0, completed: 0, retried: 0, deadLetters: 0 };
  }
  const jobs = await leaseMarketplaceJobs(db, options);
  const results = [];
  for (const job of jobs) {
    try {
      const result = await processJob(db, job);
      await completeJob(db, job, result);
      results.push({ id: job.id, outcome: 'completed' });
    } catch (error) {
      results.push({ id: job.id, ...(await failJob(db, job, error)) });
    }
  }
  return {
    outcome: jobs.length ? 'processed' : 'idle',
    processed: jobs.length,
    completed: results.filter((row) => row.outcome === 'completed').length,
    retried: results.filter((row) => row.outcome === 'retry').length,
    deadLetters: results.filter((row) => row.outcome === 'dead_letter').length,
  };
}
