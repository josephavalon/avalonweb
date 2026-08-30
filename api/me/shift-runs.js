import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import {
  NURSE_ROLES,
  callNurseRpc,
  cleanText,
  clientIdempotencyKey,
  evaluateShiftReadiness,
  loadCurrentOfferTerms,
  loadLatestRun,
  loadOfferTermsById,
  loadRouteForShift,
  loadRunEvents,
  loadRunGuide,
  loadRunReadiness,
  loadWorkPreferences,
  nextNurseAction,
  nurseWorkflowError,
  parseJsonBody,
  requestError,
  requireOwnedShift,
  requirePositiveVersion,
  requireUuid,
  resolveNurseProvider,
} from '../_lib/nurse-workflow.js';

const TIME_ACTIONS = new Set(['clock_in', 'break_start', 'break_end', 'clock_out']);
const STEP_RESOLUTIONS = new Set([
  'completed',
  'not_applicable',
  'patient_declined',
  'clinically_contraindicated',
  'blocked_by_safety',
  'blocked_by_system',
  'handed_off',
]);
const EXCEPTION_KINDS = new Set(['safety', 'clinical', 'route', 'kit', 'client', 'time', 'system', 'emergency']);
const EXCEPTION_SEVERITIES = new Set(['operational', 'urgent', 'emergency']);
const CORRECTION_REASON_CODES = new Set([
  'missed_clock_in',
  'missed_clock_out',
  'incorrect_clock_in',
  'incorrect_clock_out',
  'break_adjustment',
  'device_time_issue',
  'duplicate_time_event',
  'other_operational',
]);
const READINESS_SAFE_RESOLUTIONS = new Set([
  'patient_declined',
  'clinically_contraindicated',
  'blocked_by_safety',
  'blocked_by_system',
  'handed_off',
]);
const READINESS_SAFE_STEP_KEYS = new Set(['source_record_closed', 'kit_reconciled', 'route_reconciled']);
const REASON_CODE_RE = /^[a-z0-9][a-z0-9_.:-]{0,99}$/;

function plainObject(value, field, maxChars) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(`${field} must be an object.`, 'invalid_shift_run_payload');
  }
  if (JSON.stringify(value).length > maxChars) {
    throw requestError(`${field} is too large.`, 'shift_run_payload_too_large', 413);
  }
  return value;
}

function reasonCode(value, { required = false } = {}) {
  const normalized = cleanText(value, 100).toLowerCase().replace(/\s+/g, '_');
  if (!normalized && required) throw requestError('A reason code is required.', 'reason_code_required');
  if (normalized && !REASON_CODE_RE.test(normalized)) {
    throw requestError('Reason code is invalid.', 'reason_code_invalid');
  }
  return normalized || null;
}

function deviceOccurredAt(value) {
  if (value == null || value === '') return null;
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    throw requestError('Device event time is invalid.', 'device_time_invalid');
  }
  return new Date(timestamp).toISOString();
}

function exceptionOwner(kind, severity) {
  if (kind === 'time') return 'payroll_operations';
  if (['safety', 'clinical', 'emergency'].includes(kind) || ['urgent', 'emergency'].includes(severity)) {
    return 'clinical_operations';
  }
  return 'operations';
}

function correctionMetadata(body) {
  const requestedClockInAt = deviceOccurredAt(body.requestedClockInAt);
  const requestedClockOutAt = deviceOccurredAt(body.requestedClockOutAt);
  const rawBreakMinutes = body.requestedBreakMinutes;
  const requestedBreakMinutes = rawBreakMinutes == null || rawBreakMinutes === ''
    ? null : Number(rawBreakMinutes);
  if (requestedBreakMinutes != null
    && (!Number.isInteger(requestedBreakMinutes) || requestedBreakMinutes < 0 || requestedBreakMinutes > 1440)) {
    throw requestError('Requested break minutes must be between 0 and 1440.', 'invalid_correction_break_minutes');
  }
  if (requestedClockInAt && requestedClockOutAt
    && Date.parse(requestedClockOutAt) <= Date.parse(requestedClockInAt)) {
    throw requestError('Requested clock-out must be after clock-in.', 'invalid_correction_time_order');
  }
  if (!requestedClockInAt && !requestedClockOutAt && requestedBreakMinutes == null) {
    throw requestError('Enter at least one requested time correction.', 'time_correction_value_required');
  }
  return {
    ...(requestedClockInAt ? { requested_clock_in_at: requestedClockInAt } : {}),
    ...(requestedClockOutAt ? { requested_clock_out_at: requestedClockOutAt } : {}),
    ...(requestedBreakMinutes != null ? { requested_break_minutes: requestedBreakMinutes } : {}),
    request_schema: 'nurse_time_correction_v1',
  };
}

function approvedStepKeys(guide) {
  const keys = (guide?.steps || []).map((step) => cleanText(step?.step_key || step?.key, 100)).filter(Boolean);
  return new Set([...keys, ...(guide?.required_closeout_keys || [])]);
}

async function loadContext({ authed, provider, shiftId, readiness = null }) {
  const owned = await requireOwnedShift(authed.db, authed.tenantId, provider.id, shiftId);
  const run = await loadLatestRun(authed.db, authed.tenantId, provider.id, shiftId);
  const offerTermsPromise = run?.offer_terms_id
    ? loadOfferTermsById(authed.db, authed.tenantId, provider.id, run.offer_terms_id)
    : loadCurrentOfferTerms(authed.db, authed.tenantId, provider.id, shiftId);
  if (!run) {
    let currentReadiness = readiness;
    if (!currentReadiness) {
      const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
      const evaluated = await evaluateShiftReadiness({
        db: authed.db,
        authed,
        provider,
        shift: owned.shift,
        preferences,
      });
      currentReadiness = evaluated.readiness;
    }
    return {
      shift: owned.shift,
      readiness: currentReadiness,
      offer_terms: await offerTermsPromise,
      run: null,
      guide: null,
      guide_status: 'not_started',
      timeEvents: [],
      stepEvents: [],
      exceptions: [],
      route: await loadRouteForShift(authed.db, authed.tenantId, provider.id, owned.shift),
      nextAction: nextNurseAction({ run: null, readiness: currentReadiness }),
    };
  }

  let currentReadiness = readiness;
  if (!['time_submitted', 'closed'].includes(String(run.status || '').toLowerCase()) && !currentReadiness) {
    const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
    const evaluated = await evaluateShiftReadiness({
      db: authed.db,
      authed,
      provider,
      shift: owned.shift,
      preferences,
    });
    currentReadiness = evaluated.readiness;
  }

  const [events, route, guide, runReadiness, offerTerms] = await Promise.all([
    loadRunEvents(authed.db, authed.tenantId, provider.id, run.id),
    loadRouteForShift(authed.db, authed.tenantId, provider.id, owned.shift),
    loadRunGuide(authed.db, authed.tenantId, run),
    loadRunReadiness(authed.db, authed.tenantId, provider.id, run.readiness_snapshot_id),
    offerTermsPromise,
  ]);
  const guideStatus = guide ? 'approved' : 'unavailable';
  const resolvedReadiness = currentReadiness || runReadiness || {
    status: 'blocked',
    claim_allowed: false,
    start_allowed: false,
    reason_code: 'run_readiness_snapshot_unavailable',
  };
  return {
    shift: owned.shift,
    readiness: resolvedReadiness,
    offer_terms: offerTerms,
    run,
    guide,
    guide_status: guideStatus,
    guide_blocker: guide ? null : {
      code: 'approved_shift_guide_required',
      owner_role: 'clinical_operations',
      message: 'An approved guided-shift workflow is required. Contact Clinical Operations.',
    },
    ...events,
    route,
    nextAction: nextNurseAction({ run, ...events, guide, readiness: resolvedReadiness }),
  };
}

async function requireRun(authed, provider, shiftId) {
  await requireOwnedShift(authed.db, authed.tenantId, provider.id, shiftId);
  const run = await loadLatestRun(authed.db, authed.tenantId, provider.id, shiftId);
  if (!run) throw requestError('Start the guided shift before recording work.', 'shift_run_required', 409);
  return run;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    const provider = await resolveNurseProvider(authed);
    if (req.method === 'GET') {
      const shiftId = requireUuid(req.query?.shiftId, 'Shift id');
      const context = await loadContext({ authed, provider, shiftId });
      return res.status(200).json(context);
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = parseJsonBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    const shiftId = requireUuid(body.shiftId, 'Shift id');

    if (action === 'start') {
      const version = requirePositiveVersion(body.version ?? body.shiftVersion, 'Shift version');
      const owned = await requireOwnedShift(authed.db, authed.tenantId, provider.id, shiftId);
      const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
      const { readiness } = await evaluateShiftReadiness({
        db: authed.db,
        authed,
        provider,
        shift: owned.shift,
        preferences,
      });
      if (!readiness.start_allowed) {
        return res.status(409).json({
          error: 'This shift is not ready to start.',
          code: 'shift_start_not_ready',
          readiness,
        });
      }
      await callNurseRpc(authed.db, 'start_nurse_shift_run', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_shift_id: shiftId,
        p_provider_profile_id: provider.id,
        p_expected_version: version,
      });
      return res.status(200).json({ ok: true, ...await loadContext({ authed, provider, shiftId, readiness }) });
    }

    const run = await requireRun(authed, provider, shiftId);
    if (action === 'request_time_correction') {
      const reason = reasonCode(body.reasonCode, { required: true });
      if (!CORRECTION_REASON_CODES.has(reason)) {
        throw requestError('Time-correction reason is invalid.', 'time_correction_reason_invalid');
      }
      const key = clientIdempotencyKey(body.idempotencyKey || body.requestKey, 'time_correction');
      await callNurseRpc(authed.db, 'record_nurse_time_event', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_run_id: run.id,
        p_event_type: 'correction_request',
        p_idempotency_key: key,
        p_device_occurred_at: deviceOccurredAt(body.deviceOccurredAt),
        p_reason_code: reason,
        p_metadata: correctionMetadata(body),
      });
      return res.status(200).json({
        ok: true,
        correction_status: 'pending_review',
        idempotency_key: key,
        ...await loadContext({ authed, provider, shiftId }),
      });
    }
    if (TIME_ACTIONS.has(action)) {
      if (action === 'break_start' && body.handoffConfirmed !== true) {
        throw requestError(
          'Confirm that no patient or time-critical therapy is left unattended before starting a break.',
          'break_handoff_confirmation_required',
          409,
        );
      }
      if (action === 'clock_in') {
        const owned = await requireOwnedShift(authed.db, authed.tenantId, provider.id, shiftId);
        const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
        const { readiness } = await evaluateShiftReadiness({
          db: authed.db,
          authed,
          provider,
          shift: owned.shift,
          preferences,
        });
        if (!readiness.start_allowed) {
          return res.status(409).json({
            error: 'This shift is not ready to clock in.',
            code: 'shift_clock_in_not_ready',
            readiness,
          });
        }
      }
      const key = clientIdempotencyKey(body.idempotencyKey || body.requestKey, action);
      await callNurseRpc(authed.db, 'record_nurse_time_event', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_run_id: run.id,
        p_event_type: action,
        p_idempotency_key: key,
        p_device_occurred_at: deviceOccurredAt(body.deviceOccurredAt),
        p_reason_code: reasonCode(body.reasonCode),
        p_metadata: action === 'break_start' ? { handoff_confirmed: true } : {},
      });
      const context = await loadContext({ authed, provider, shiftId });
      return res.status(200).json({
        ok: true,
        idempotency_key: key,
        clockOutRecorded: action === 'clock_out',
        ...context,
      });
    }

    if (action === 'resolve_step') {
      const stepKey = cleanText(body.stepKey || body.step_key, 100);
      if (!stepKey) throw requestError('Step key is required.', 'step_key_required');
      const resolution = String(body.resolution || '').trim().toLowerCase();
      if (!STEP_RESOLUTIONS.has(resolution)) {
        throw requestError('Step resolution is invalid.', 'step_resolution_invalid');
      }
      const guide = await loadRunGuide(authed.db, authed.tenantId, run);
      if (!guide) {
        throw requestError(
          'An approved guided-shift workflow is required. Contact Clinical Operations.',
          'approved_shift_guide_required',
          409,
        );
      }
      if (!approvedStepKeys(guide).has(stepKey)) {
        throw requestError('This step is not part of the approved guide.', 'guide_step_not_approved', 409);
      }
      if (!READINESS_SAFE_RESOLUTIONS.has(resolution) && !READINESS_SAFE_STEP_KEYS.has(stepKey)) {
        const owned = await requireOwnedShift(authed.db, authed.tenantId, provider.id, shiftId);
        const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
        const { readiness } = await evaluateShiftReadiness({
          db: authed.db,
          authed,
          provider,
          shift: owned.shift,
          preferences,
        });
        if (readiness.status !== 'ready') {
          return res.status(409).json({
            error: 'Current readiness blocks ordinary care steps. Pause care, open an exception, or complete an allowed handoff.',
            code: 'current_readiness_blocks_care_step',
            readiness,
          });
        }
      }
      const reason = reasonCode(body.reasonCode, { required: resolution !== 'completed' });
      const key = clientIdempotencyKey(body.idempotencyKey || body.requestKey, 'step');
      await callNurseRpc(authed.db, 'record_nurse_step_event', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_run_id: run.id,
        p_step_key: stepKey,
        p_resolution: resolution,
        p_reason_code: reason,
        p_idempotency_key: key,
        p_device_occurred_at: deviceOccurredAt(body.deviceOccurredAt),
        p_payload: plainObject(body.payload, 'Step payload', 8000),
      });
      return res.status(200).json({
        ok: true,
        idempotency_key: key,
        ...await loadContext({ authed, provider, shiftId }),
      });
    }

    if (action === 'open_exception') {
      const kind = String(body.kind || body.exceptionType || '').trim().toLowerCase();
      if (!EXCEPTION_KINDS.has(kind)) throw requestError('Exception type is invalid.', 'exception_type_invalid');
      const severity = String(body.severity || 'operational').trim().toLowerCase();
      if (!EXCEPTION_SEVERITIES.has(severity)) {
        throw requestError('Exception severity is invalid.', 'exception_severity_invalid');
      }
      const reason = reasonCode(body.reasonCode, { required: true });
      const key = clientIdempotencyKey(body.idempotencyKey || body.requestKey, 'exception');
      await callNurseRpc(authed.db, 'open_nurse_shift_exception', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_run_id: run.id,
        p_kind: kind,
        p_severity: severity,
        p_reason_code: reason,
        p_owner_role: exceptionOwner(kind, severity),
        p_note: cleanText(body.note, 500) || null,
        p_idempotency_key: key,
      });
      return res.status(200).json({
        ok: true,
        idempotency_key: key,
        ...await loadContext({ authed, provider, shiftId }),
      });
    }

    if (action === 'closeout') {
      const version = requirePositiveVersion(body.version ?? body.runVersion, 'Run version');
      await callNurseRpc(authed.db, 'close_nurse_shift_run', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_run_id: run.id,
        p_expected_version: version,
      });
      return res.status(200).json({ ok: true, ...await loadContext({ authed, provider, shiftId }) });
    }

    return res.status(400).json({ error: 'Unsupported shift-run action.', code: 'invalid_action' });
  } catch (caught) {
    const error = nurseWorkflowError(caught, 'Could not load or update the guided shift.');
    console.warn('[me/shift-runs] failed', safeLogContext(error, 'me_shift_runs_failed'));
    return res.status(error.status || 500).json({
      error: error.expose || error.code === 'nurse_workflow_migration_required'
        ? error.message : 'Could not load or update the guided shift.',
      code: safeErrorCode(error, 'me_shift_runs_failed'),
    });
  }
}
