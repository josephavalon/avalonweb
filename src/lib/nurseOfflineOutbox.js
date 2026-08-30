import { apiGet, apiPost } from './apiClient';
import { hasSupabase, supabase } from './supabase';

const DB_NAME = 'avalon-nurse-offline';
const DB_VERSION = 1;
const META_STORE = 'device_scope';
const CACHE_STORE = 'sanitized_shift_cache';
const OUTBOX_STORE = 'nurse_action_outbox';
const SCOPE_PREFIX = 'auth-scope:';
const DEVICE_KEY = 'device-id';
const CACHE_SCHEMA_VERSION = 1;
const MAX_CACHE_AGE_MS = 72 * 60 * 60 * 1000;
const IDENTITY_FIELDS = ['authSessionBinding', 'userBinding', 'tenantBinding', 'providerBinding'];

export const NURSE_OFFLINE_ACTIONS = new Set([
  'clock_in',
  'break_start',
  'break_end',
  'clock_out',
  'resolve_step',
  'open_exception',
  'closeout',
  'request_time_correction',
]);

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
const RESOLVED_STEP_STATES = new Set([
  'completed',
  'not_applicable',
  'patient_declined',
  'clinically_contraindicated',
  'handed_off',
]);
const READINESS_SAFE_RESOLUTIONS = new Set([
  'patient_declined',
  'clinically_contraindicated',
  'blocked_by_safety',
  'blocked_by_system',
  'handed_off',
]);
const READINESS_SAFE_STEP_KEYS = new Set(['source_record_closed', 'kit_reconciled', 'route_reconciled']);
const EXCEPTION_KINDS = new Set(['safety', 'clinical', 'route', 'kit', 'client', 'time', 'system', 'emergency']);
const EXCEPTION_SEVERITIES = new Set(['operational', 'urgent', 'emergency']);
const CODE_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,99}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READY_STATUSES = new Set(['ready', 'clear']);

function offlineError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function code(value) {
  const normalized = text(value, 100).toLowerCase();
  return CODE_PATTERN.test(normalized) ? normalized : '';
}

function identifier(value) {
  const normalized = text(value, 160);
  return normalized && !/[\s/?#]/.test(normalized) ? normalized : '';
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function isoTimestamp(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function randomUuid() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw offlineError('Secure device identification is unavailable.', 'offline_secure_random_unavailable');
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw offlineError('Secure session binding is unavailable.', 'offline_secure_hash_unavailable');
  }
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1] || '';
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(part.length + ((4 - (part.length % 4)) % 4), '=');
    return JSON.parse(globalThis.atob(base64));
  } catch {
    return null;
  }
}

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(offlineError('Offline storage is unavailable in this browser.', 'indexeddb_unavailable'));
  }
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
      if (!database.objectStoreNames.contains(CACHE_STORE)) database.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) database.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error || offlineError('Offline storage could not open.', 'indexeddb_open_failed'));
    request.onblocked = () => reject(offlineError('Offline storage upgrade is blocked by another tab.', 'indexeddb_blocked'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact(storeName, mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;
      let request;
      try {
        request = operation(store);
      } catch (error) {
        reject(error);
        return;
      }
      if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || transaction.error);
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || offlineError('Offline storage failed.', 'indexeddb_transaction_failed'));
      transaction.onabort = () => reject(transaction.error || offlineError('Offline storage was interrupted.', 'indexeddb_transaction_aborted'));
    });
  } finally {
    database.close();
  }
}

const readRecord = (storeName, key) => transact(storeName, 'readonly', (store) => store.get(key));
const readAllRecords = (storeName) => transact(storeName, 'readonly', (store) => store.getAll());
const putRecord = (storeName, value) => transact(storeName, 'readwrite', (store) => store.put(value));
const deleteRecord = (storeName, key) => transact(storeName, 'readwrite', (store) => store.delete(key));

function sameIdentity(left, right) {
  return IDENTITY_FIELDS.every((field) => text(left?.[field], 96) && left[field] === right?.[field]);
}

function requireIdentity(identity) {
  if (!identity || !IDENTITY_FIELDS.every((field) => /^[0-9a-f]{64}$/.test(text(identity[field], 96)))) {
    throw offlineError('Offline actions require a verified nurse session.', 'offline_identity_unverified');
  }
  return identity;
}

async function currentSessionBindings() {
  if (!hasSupabase || !supabase) {
    throw offlineError('Offline actions require an authenticated Supabase session.', 'offline_auth_session_required');
  }
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.access_token || !session?.user?.id) {
    throw offlineError('The authenticated session could not be verified.', 'offline_auth_session_unavailable');
  }
  const claims = decodeJwtPayload(session.access_token);
  const sessionId = identifier(claims?.session_id || claims?.sid);
  const subject = identifier(claims?.sub || session.user.id);
  if (!sessionId || !subject || subject !== session.user.id) {
    throw offlineError('The authenticated session is missing a stable session binding.', 'offline_auth_binding_unavailable');
  }
  return {
    userId: session.user.id,
    authSessionBinding: await sha256(`nurse-session:${subject}:${sessionId}`),
    userBinding: await sha256(`nurse-user:${subject}`),
  };
}

async function readOrCreateDeviceId() {
  const existing = await readRecord(META_STORE, DEVICE_KEY);
  if (UUID_PATTERN.test(text(existing?.value, 64))) return existing.value;
  const value = randomUuid();
  await putRecord(META_STORE, { key: DEVICE_KEY, value, createdAt: new Date().toISOString() });
  return value;
}

function providerIdFromPayload(payload) {
  return identifier(
    payload?.shift?.assignment?.provider_profile_id
    || payload?.shift?.assignment?.providerProfileId
    || payload?.provider?.id,
  );
}

async function resolveFreshScope(payload, sessionBindings) {
  const providerProfileId = providerIdFromPayload(payload);
  if (!providerProfileId) {
    throw offlineError('The assigned provider identity is unavailable.', 'offline_provider_binding_unavailable');
  }
  const { data, error } = await supabase.from('profiles')
    .select('tenant_id')
    .eq('id', sessionBindings.userId)
    .maybeSingle();
  const tenantId = identifier(data?.tenant_id);
  if (error || !tenantId) {
    throw offlineError('The tenant identity could not be verified.', 'offline_tenant_binding_unavailable');
  }
  const scope = {
    key: `${SCOPE_PREFIX}${sessionBindings.authSessionBinding}`,
    authSessionBinding: sessionBindings.authSessionBinding,
    userBinding: sessionBindings.userBinding,
    tenantBinding: await sha256(`nurse-tenant:${tenantId}`),
    providerBinding: await sha256(`nurse-provider:${providerProfileId}`),
    updatedAt: new Date().toISOString(),
  };
  await putRecord(META_STORE, scope);
  return scope;
}

export async function getNurseOfflineIdentity(payload = null) {
  const sessionBindings = await currentSessionBindings();
  let scope = null;
  if (payload) scope = await resolveFreshScope(payload, sessionBindings);
  else scope = await readRecord(META_STORE, `${SCOPE_PREFIX}${sessionBindings.authSessionBinding}`);
  const identity = {
    authSessionBinding: sessionBindings.authSessionBinding,
    userBinding: sessionBindings.userBinding,
    tenantBinding: scope?.tenantBinding,
    providerBinding: scope?.providerBinding,
    deviceId: await readOrCreateDeviceId(),
  };
  requireIdentity(identity);
  if (!sameIdentity(identity, scope)) {
    throw offlineError('The cached nurse scope does not match this session.', 'offline_scope_mismatch');
  }
  return identity;
}

function sanitizeAssignment(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: identifier(value.id) || null,
    shift_id: identifier(value.shift_id) || null,
    status: code(value.status) || 'unknown',
    offered_at: isoTimestamp(value.offered_at),
    claimed_at: isoTimestamp(value.claimed_at),
    assigned_at: isoTimestamp(value.assigned_at),
    completed_at: isoTimestamp(value.completed_at),
  };
}

function sanitizeShift(value) {
  if (!value || typeof value !== 'object') return null;
  const id = identifier(value.id);
  const assignment = sanitizeAssignment(value.assignment);
  if (!id || !assignment || !['claimed', 'assigned', 'completed'].includes(assignment.status)) return null;
  return {
    id,
    starts_at: isoTimestamp(value.starts_at),
    ends_at: isoTimestamp(value.ends_at),
    timezone: identifier(value.timezone) || 'America/Los_Angeles',
    role_required: code(value.role_required) || null,
    status: code(value.status) || 'unknown',
    version: positiveInteger(value.version),
    assignment,
  };
}

function sanitizeReadinessDomain(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    status: code(value.status) || 'unavailable',
    reason_code: code(value.reason_code) || null,
    source_updated_at: isoTimestamp(value.source_updated_at),
    expires_at: isoTimestamp(value.expires_at),
  };
}

function sanitizeReadiness(value) {
  if (!value || typeof value !== 'object') return null;
  const inputDomains = value.domains && typeof value.domains === 'object' && !Array.isArray(value.domains)
    ? value.domains : {};
  const domains = {};
  for (const [key, domain] of Object.entries(inputDomains)) {
    const safeKey = code(key);
    const safeDomain = sanitizeReadinessDomain(domain);
    if (safeKey && safeDomain) domains[safeKey] = safeDomain;
  }
  return {
    status: code(value.status) || 'unavailable',
    claim_allowed: value.claim_allowed === true,
    start_allowed: value.start_allowed === true,
    checked_at: isoTimestamp(value.checked_at),
    expires_at: isoTimestamp(value.expires_at),
    source_shift_version: positiveInteger(value.source_shift_version),
    evaluator_version: identifier(value.evaluator_version) || null,
    invalidated_at: isoTimestamp(value.invalidated_at),
    invalidation_reason: code(value.invalidation_reason) || null,
    domains,
  };
}

function sanitizeRun(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: identifier(value.id) || null,
    shift_id: identifier(value.shift_id) || null,
    status: code(value.status) || 'unknown',
    workflow_status: code(value.workflow_status) || null,
    time_status: code(value.time_status) || null,
    clock_status: code(value.clock_status) || null,
    clocked_in_at: isoTimestamp(value.clocked_in_at),
    clocked_out_at: isoTimestamp(value.clocked_out_at),
    version: positiveInteger(value.version),
    guide_version_id: identifier(value.guide_version_id) || null,
  };
}

function sanitizeGuide(value) {
  if (!value || typeof value !== 'object' || !['approved', 'retired'].includes(code(value.status))) return null;
  const steps = Array.isArray(value.steps) ? value.steps.map((step) => ({
    step_key: code(step?.step_key || step?.key) || null,
    label: text(step?.label || step?.title || step?.name, 160) || null,
    instructions: text(step?.instructions, 1200) || null,
  })).filter((step) => step.step_key) : [];
  return {
    id: identifier(value.id) || null,
    template_key: code(value.template_key) || null,
    name: text(value.name, 160) || null,
    work_kind: code(value.work_kind) || null,
    protocol_key: code(value.protocol_key) || null,
    role_required: code(value.role_required) || null,
    version: positiveInteger(value.version),
    status: code(value.status),
    steps,
    required_closeout_keys: Array.isArray(value.required_closeout_keys)
      ? value.required_closeout_keys.map(code).filter(Boolean) : [],
    approved_at: isoTimestamp(value.approved_at),
  };
}

function sanitizeTimeEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const type = code(value.event_type || value.type || value.action);
  if (!TIME_ACTIONS.has(type)) return null;
  return {
    id: identifier(value.id) || null,
    event_type: type,
    device_occurred_at: isoTimestamp(value.device_occurred_at),
    occurred_at: isoTimestamp(value.occurred_at || value.recorded_at || value.created_at),
    reason_code: code(value.reason_code) || null,
    idempotency_key: identifier(value.idempotency_key) || null,
    created_at: isoTimestamp(value.created_at),
  };
}

function sanitizeStepEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const stepKey = code(value.step_key);
  const resolution = code(value.resolution);
  if (!stepKey || !STEP_RESOLUTIONS.has(resolution)) return null;
  return {
    id: identifier(value.id) || null,
    step_key: stepKey,
    resolution,
    reason_code: code(value.reason_code) || null,
    device_occurred_at: isoTimestamp(value.device_occurred_at),
    occurred_at: isoTimestamp(value.occurred_at || value.created_at),
    idempotency_key: identifier(value.idempotency_key) || null,
    created_at: isoTimestamp(value.created_at),
  };
}

function sanitizeException(value) {
  if (!value || typeof value !== 'object') return null;
  const kind = code(value.kind || value.exception_type);
  if (!EXCEPTION_KINDS.has(kind)) return null;
  return {
    id: identifier(value.id) || null,
    kind,
    reason_code: code(value.reason_code) || null,
    severity: code(value.severity) || 'operational',
    status: code(value.status) || 'open',
    owner_role: code(value.owner_role) || null,
    created_at: isoTimestamp(value.created_at),
    resolved_at: isoTimestamp(value.resolved_at),
  };
}

function sanitizeNextAction(value, guide) {
  if (!value || typeof value !== 'object') return null;
  const action = code(value.action) || null;
  const stepKey = code(value.step_key || value.stepKey) || null;
  const approvedStep = action === 'resolve_step' && stepKey
    ? guide?.steps?.find((step) => step.step_key === stepKey) : null;
  return {
    action,
    step_key: stepKey,
    label: approvedStep?.label || null,
    instructions: approvedStep?.instructions || null,
    exception_id: identifier(value.exception_id) || null,
    latest_step_key: code(value.latest_step_key) || null,
    clock_out_available: value.clock_out_available === true,
  };
}

export function sanitizeNurseShiftPayload(payload) {
  const shift = sanitizeShift(payload?.shift);
  if (!shift) throw offlineError('Only an accepted assigned shift can be cached.', 'offline_shift_not_assigned');
  const guide = sanitizeGuide(payload?.guide);
  return {
    shift,
    readiness: sanitizeReadiness(payload?.readiness || payload?.shift?.readiness),
    run: sanitizeRun(payload?.run),
    guide,
    guide_status: guide ? 'approved' : 'unavailable',
    timeEvents: Array.isArray(payload?.timeEvents) ? payload.timeEvents.map(sanitizeTimeEvent).filter(Boolean) : [],
    stepEvents: Array.isArray(payload?.stepEvents) ? payload.stepEvents.map(sanitizeStepEvent).filter(Boolean) : [],
    exceptions: Array.isArray(payload?.exceptions) ? payload.exceptions.map(sanitizeException).filter(Boolean) : [],
    nextAction: sanitizeNextAction(payload?.nextAction, guide),
    route: null,
  };
}

function cacheKey(shiftId, identity) {
  return [identity.authSessionBinding, identity.userBinding, identity.tenantBinding, identity.providerBinding, identifier(shiftId)].join(':');
}

export async function cacheNurseShiftPayload({ shiftId, payload, identity }) {
  requireIdentity(identity);
  const sanitized = sanitizeNurseShiftPayload(payload);
  if (sanitized.shift.id !== identifier(shiftId)) {
    throw offlineError('The cached shift identifier does not match.', 'offline_shift_mismatch');
  }
  const cachedAt = new Date().toISOString();
  await putRecord(CACHE_STORE, {
    key: cacheKey(shiftId, identity),
    schemaVersion: CACHE_SCHEMA_VERSION,
    shiftId: sanitized.shift.id,
    ...Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, identity[field]])),
    cachedAt,
    payload: sanitized,
  });
  return { payload: sanitized, cachedAt };
}

export async function readCachedNurseShiftPayload({ shiftId, identity }) {
  requireIdentity(identity);
  const record = await readRecord(CACHE_STORE, cacheKey(shiftId, identity));
  if (!record || record.schemaVersion !== CACHE_SCHEMA_VERSION || !sameIdentity(record, identity)) return null;
  const cachedAt = Date.parse(record.cachedAt);
  if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > MAX_CACHE_AGE_MS) return null;
  if (record?.payload?.shift?.id !== identifier(shiftId)) return null;
  return { payload: record.payload, cachedAt: record.cachedAt };
}

export function readinessAllowsOfflineClockIn(payload, now = Date.now()) {
  const readiness = payload?.readiness || payload?.shift?.readiness;
  const expiry = Date.parse(readiness?.expires_at || '');
  return READY_STATUSES.has(code(readiness?.status))
    && readiness?.start_allowed === true
    && !readiness?.invalidated_at
    && Number.isFinite(expiry)
    && expiry > now;
}

function sanitizeQueuedFields(action, extra) {
  if (action === 'break_start') {
    if (extra?.handoffConfirmed !== true) {
      throw offlineError(
        'Confirm that no patient or time-critical therapy is left unattended before starting a break.',
        'offline_break_handoff_required',
      );
    }
    return { handoffConfirmed: true };
  }
  if (TIME_ACTIONS.has(action) || action === 'closeout') return {};
  if (action === 'resolve_step') {
    const stepKey = code(extra?.stepKey || extra?.step_key);
    const resolution = code(extra?.resolution);
    const reasonCode = code(extra?.reasonCode || extra?.reason_code);
    if (!stepKey || !STEP_RESOLUTIONS.has(resolution)) {
      throw offlineError('This approved guide step cannot be queued.', 'offline_step_action_invalid');
    }
    if (resolution !== 'completed' && !reasonCode) {
      throw offlineError('A structured reason code is required.', 'offline_step_reason_required');
    }
    return { stepKey, resolution, ...(reasonCode ? { reasonCode } : {}) };
  }
  if (action === 'open_exception') {
    const exceptionType = code(extra?.exceptionType || extra?.kind);
    const severity = code(extra?.severity) || 'operational';
    const reasonCode = code(extra?.reasonCode || extra?.reason_code);
    if (!EXCEPTION_KINDS.has(exceptionType) || !EXCEPTION_SEVERITIES.has(severity) || !reasonCode) {
      throw offlineError('This structured exception cannot be queued.', 'offline_exception_action_invalid');
    }
    return { exceptionType, severity, reasonCode };
  }
  if (action === 'request_time_correction') {
    const reasonCode = code(extra?.reasonCode || extra?.reason_code);
    const requestedClockInAt = isoTimestamp(extra?.requestedClockInAt || extra?.requested_clock_in_at);
    const requestedClockOutAt = isoTimestamp(extra?.requestedClockOutAt || extra?.requested_clock_out_at);
    if (!reasonCode || (!requestedClockInAt && !requestedClockOutAt)) {
      throw offlineError('A coded time correction and requested time are required.', 'offline_time_correction_invalid');
    }
    return {
      reasonCode,
      ...(requestedClockInAt ? { requestedClockInAt } : {}),
      ...(requestedClockOutAt ? { requestedClockOutAt } : {}),
    };
  }
  throw offlineError('This action is not approved for offline use.', 'offline_action_not_allowed');
}

export async function queueNurseOfflineAction({
  shiftId,
  action,
  extra = {},
  identity,
  currentPayload,
  idempotencyKey,
  deviceOccurredAt,
}) {
  requireIdentity(identity);
  const normalizedAction = code(action);
  if (!NURSE_OFFLINE_ACTIONS.has(normalizedAction)) {
    throw offlineError('Starting preflight is never queued offline.', 'offline_action_not_allowed');
  }
  if (!currentPayload?.run?.id) {
    throw offlineError('Start preflight online before recording offline work.', 'offline_run_required');
  }
  if (normalizedAction === 'clock_in' && !readinessAllowsOfflineClockIn(currentPayload)) {
    throw offlineError('Clock-in requires unexpired server readiness that explicitly allows starting.', 'offline_clock_in_not_ready');
  }
  const shift = identifier(shiftId);
  const requestId = UUID_PATTERN.test(text(idempotencyKey, 64)) ? idempotencyKey : randomUuid();
  const occurredAt = isoTimestamp(deviceOccurredAt) || new Date().toISOString();
  const fields = sanitizeQueuedFields(normalizedAction, extra);
  if (normalizedAction === 'resolve_step'
    && !readinessAllowsOfflineClockIn(currentPayload)
    && !READINESS_SAFE_RESOLUTIONS.has(fields.resolution)
    && !READINESS_SAFE_STEP_KEYS.has(fields.stepKey)) {
    throw offlineError(
      'Current readiness is unavailable or expired. Pause care, save a structured exception, or clock out.',
      'offline_current_readiness_blocks_care_step',
    );
  }
  const existing = await readRecord(OUTBOX_STORE, requestId);
  if (existing) {
    if (!sameIdentity(existing, identity) || existing.shiftId !== shift || existing.action !== normalizedAction) {
      throw offlineError('The retry identifier belongs to a different action.', 'offline_idempotency_collision');
    }
    return existing;
  }
  const item = {
    id: requestId,
    shiftId: shift,
    action: normalizedAction,
    fields,
    deviceId: identity.deviceId,
    deviceOccurredAt: occurredAt,
    idempotencyKey: requestId,
    ...Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, identity[field]])),
    status: 'pending',
    createdAt: occurredAt,
    attemptCount: 0,
    lastAttemptAt: null,
    conflictCode: null,
    conflictHttpStatus: null,
  };
  await putRecord(OUTBOX_STORE, item);
  return item;
}

export async function listNurseOutbox({ shiftId, identity }) {
  requireIdentity(identity);
  const shift = identifier(shiftId);
  const records = await readAllRecords(OUTBOX_STORE);
  return (Array.isArray(records) ? records : [])
    .filter((item) => item?.shiftId === shift && sameIdentity(item, identity))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function safeConflictCode(error) {
  return code(error?.body?.code || error?.code) || 'server_state_conflict';
}

function validateReplayResponse(value, shiftId) {
  if (!value || typeof value !== 'object' || value?.shift?.id !== shiftId) {
    throw offlineError('The saved shift action returned an invalid response.', 'offline_replay_response_invalid');
  }
  return value;
}

export function isNetworkFailure(error) {
  if (Number.isInteger(error?.status)) return false;
  const message = String(error?.message || '').toLowerCase();
  return globalThis.navigator?.onLine === false
    || error instanceof TypeError
    || /network|fetch|offline|load failed|connection/.test(message);
}

export async function syncNurseOutbox({ shiftId, identity, includeConflicts = false }) {
  requireIdentity(identity);
  const queue = (await listNurseOutbox({ shiftId, identity }))
    .filter((item) => item.status === 'pending' || (includeConflicts && item.status === 'conflict'));
  let latestPayload = null;
  let syncedCount = 0;
  let stoppedReason = null;

  // Ordered replay is intentional: later guide, break, clock-out, and closeout
  // actions may depend on the server accepting every earlier device event.
  for (const item of queue) {
    if (!sameIdentity(item, identity) || item.deviceId !== identity.deviceId) {
      stoppedReason = 'identity_mismatch';
      break;
    }
    try {
      let version;
      if (item.action === 'closeout') {
        const current = validateReplayResponse(
          await apiGet(`/api/me/shift-runs?shiftId=${encodeURIComponent(item.shiftId)}`),
          item.shiftId,
        );
        version = positiveInteger(current?.run?.version);
        if (!version) throw offlineError('Current run version is unavailable for closeout.', 'closeout_version_unavailable');
      }
      const request = {
        action: item.action,
        shiftId: item.shiftId,
        idempotencyKey: item.idempotencyKey,
        deviceId: item.deviceId,
        deviceOccurredAt: item.deviceOccurredAt,
        authSessionBinding: item.authSessionBinding,
        ...item.fields,
        ...(version ? { version } : {}),
      };
      const result = validateReplayResponse(await apiPost('/api/me/shift-runs', request), item.shiftId);
      await deleteRecord(OUTBOX_STORE, item.id);
      await cacheNurseShiftPayload({ shiftId: item.shiftId, payload: result, identity });
      latestPayload = result;
      syncedCount += 1;
    } catch (error) {
      if (error?.status === 409) {
        await putRecord(OUTBOX_STORE, {
          ...item,
          status: 'conflict',
          attemptCount: Number(item.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          conflictCode: safeConflictCode(error),
          conflictHttpStatus: 409,
        });
        stoppedReason = 'conflict';
      } else if (isNetworkFailure(error)) {
        await putRecord(OUTBOX_STORE, {
          ...item,
          status: 'pending',
          attemptCount: Number(item.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
        });
        stoppedReason = 'offline';
      } else {
        await putRecord(OUTBOX_STORE, {
          ...item,
          status: 'conflict',
          attemptCount: Number(item.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          conflictCode: safeConflictCode(error),
          conflictHttpStatus: Number.isInteger(error?.status) ? error.status : 0,
        });
        stoppedReason = 'server_rejected';
      }
      break;
    }
  }
  return {
    latestPayload,
    syncedCount,
    stoppedReason,
    items: await listNurseOutbox({ shiftId, identity }),
  };
}

function eventType(event) {
  return code(event?.event_type || event?.type || event?.action);
}

function deriveOfflineNextAction(payload, pendingItems) {
  if (pendingItems.some((item) => item.action === 'closeout')) {
    return { action: 'sync_pending', clock_out_available: false };
  }
  const timeEvents = Array.isArray(payload?.timeEvents) ? payload.timeEvents : [];
  const stepEvents = Array.isArray(payload?.stepEvents) ? payload.stepEvents : [];
  const exceptions = Array.isArray(payload?.exceptions) ? payload.exceptions : [];
  const clockedIn = timeEvents.some((event) => eventType(event) === 'clock_in');
  const clockedOut = timeEvents.some((event) => eventType(event) === 'clock_out');
  const openException = exceptions.find((item) => !['resolved', 'closed'].includes(code(item?.status)));
  if (!clockedIn) return readinessAllowsOfflineClockIn(payload)
    ? { action: 'clock_in', clock_out_available: false }
    : { action: 'readiness_blocked', clock_out_available: false };
  if (clockedOut) return openException
    ? { action: 'resolve_exception', exception_id: openException.id, clock_out_available: false }
    : { action: 'closeout', clock_out_available: false };
  if (openException) return { action: 'resolve_exception', exception_id: openException.id, clock_out_available: true };
  const lastBreak = [...timeEvents].reverse().find((event) => ['break_start', 'break_end'].includes(eventType(event)));
  if (eventType(lastBreak) === 'break_start') return { action: 'break_end', clock_out_available: true };
  if (!readinessAllowsOfflineClockIn(payload)) return { action: 'readiness_blocked', clock_out_available: true };
  const latestStepByKey = new Map();
  for (const event of stepEvents) latestStepByKey.set(code(event?.step_key), event);
  const resolved = new Set([...latestStepByKey.entries()]
    .filter(([key, event]) => key && RESOLVED_STEP_STATES.has(code(event?.resolution)))
    .map(([key]) => key));
  const nextStep = (payload?.guide?.steps || []).find((step) => code(step?.step_key || step?.key) && !resolved.has(code(step?.step_key || step?.key)));
  if (nextStep) return {
    action: 'resolve_step',
    step_key: code(nextStep.step_key || nextStep.key),
    label: text(nextStep.label, 160) || null,
    instructions: text(nextStep.instructions, 1200) || null,
    clock_out_available: true,
  };
  const closeoutKey = (payload?.guide?.required_closeout_keys || []).map(code).find((key) => key && !resolved.has(key));
  if (closeoutKey) return { action: 'resolve_step', step_key: closeoutKey, clock_out_available: true };
  return { action: 'continue_guide', clock_out_available: true };
}

export function applyNurseOutboxOverlay(payload, items = []) {
  if (!payload || typeof payload !== 'object') return payload;
  const pending = items.filter((item) => item?.status === 'pending');
  if (!pending.length) return payload;
  const next = {
    ...payload,
    run: payload.run ? { ...payload.run } : null,
    timeEvents: [...(Array.isArray(payload.timeEvents) ? payload.timeEvents : [])],
    stepEvents: [...(Array.isArray(payload.stepEvents) ? payload.stepEvents : [])],
    exceptions: [...(Array.isArray(payload.exceptions) ? payload.exceptions : [])],
  };
  for (const item of pending) {
    if (TIME_ACTIONS.has(item.action)) {
      next.timeEvents.push({
        id: `offline-${item.id}`,
        event_type: item.action,
        device_occurred_at: item.deviceOccurredAt,
        occurred_at: item.deviceOccurredAt,
        idempotency_key: item.idempotencyKey,
        pending_sync: true,
      });
    } else if (item.action === 'resolve_step') {
      next.stepEvents.push({
        id: `offline-${item.id}`,
        step_key: item.fields.stepKey,
        resolution: item.fields.resolution,
        reason_code: item.fields.reasonCode || null,
        device_occurred_at: item.deviceOccurredAt,
        occurred_at: item.deviceOccurredAt,
        idempotency_key: item.idempotencyKey,
        pending_sync: true,
      });
    } else if (item.action === 'open_exception') {
      next.exceptions.push({
        id: `offline-${item.id}`,
        kind: item.fields.exceptionType,
        reason_code: item.fields.reasonCode,
        severity: item.fields.severity,
        status: 'pending_sync',
        created_at: item.deviceOccurredAt,
        pending_sync: true,
      });
    }
  }
  next.nextAction = deriveOfflineNextAction(next, pending);
  return next;
}
