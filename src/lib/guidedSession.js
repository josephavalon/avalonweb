export const GUIDED_FLOW_STORAGE_KEY = 'av.guided.flow.v1';

const TIMESTAMP_FIELDS = new Set([
  'startedAt',
  'startedEventAt',
  'recommendedAt',
  'resultViewedAt',
  'selectedAt',
  'startOpenedAt',
  'submittedAt',
]);

function createId() {
  try { return window.crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function sanitizeFlow(value) {
  if (!value?.id || typeof value.id !== 'string') return null;
  const clean = { id: value.id.slice(0, 100) };
  for (const field of TIMESTAMP_FIELDS) {
    const timestamp = Number(value[field]);
    if (Number.isFinite(timestamp) && timestamp >= 0) clean[field] = timestamp;
  }
  return Number.isFinite(clean.startedAt) ? clean : null;
}

export function readGuidedFlow() {
  try {
    return sanitizeFlow(JSON.parse(window.sessionStorage.getItem(GUIDED_FLOW_STORAGE_KEY) || 'null'));
  } catch { return null; }
}

export function startGuidedFlow() {
  const next = { id: createId(), startedAt: Date.now() };
  try { window.sessionStorage.setItem(GUIDED_FLOW_STORAGE_KEY, JSON.stringify(next)); } catch { /* memory-only fallback */ }
  return next;
}

export function restoreGuidedFlow(id, startedAt) {
  const current = readGuidedFlow();
  if (current?.id === id) return current;
  const next = sanitizeFlow({ id, startedAt }) || startGuidedFlow();
  try { window.sessionStorage.setItem(GUIDED_FLOW_STORAGE_KEY, JSON.stringify(next)); } catch { /* memory-only fallback */ }
  return next;
}

export function timestampGuidedFlow(flowId, field, timestamp = Date.now()) {
  if (!TIMESTAMP_FIELDS.has(field)) return readGuidedFlow();
  const current = readGuidedFlow();
  if (!current || current.id !== flowId) return current;
  const next = sanitizeFlow({ ...current, [field]: timestamp });
  try { window.sessionStorage.setItem(GUIDED_FLOW_STORAGE_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
  return next;
}

export function clearGuidedFlow() {
  try { window.sessionStorage.removeItem(GUIDED_FLOW_STORAGE_KEY); } catch { /* best-effort */ }
}
