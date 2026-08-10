const GUIDED_PREFILL_FIELDS = new Set([
  'GuidedSource',
  'GuidedTherapy',
  'GuidedGoal',
  'GuidedContext',
  'GuidedTiming',
]);

export function sanitizeCognitoPrefill(prefill) {
  if (!prefill || typeof prefill !== 'object' || Array.isArray(prefill)) return {};
  const clean = {};
  for (const [field, value] of Object.entries(prefill)) {
    if (!GUIDED_PREFILL_FIELDS.has(field) || typeof value !== 'string') continue;
    const normalized = value.trim().slice(0, 120);
    if (normalized) clean[field] = normalized;
  }
  return clean;
}

export default sanitizeCognitoPrefill;
