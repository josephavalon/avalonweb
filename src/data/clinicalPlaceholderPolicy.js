export const CLINICAL_DATA_MODE = 'placeholder-only';

export const CLINICAL_SOURCE_OF_RECORD = 'Acuity and Avalon clinical entity';

export const CLINICAL_PLACEHOLDER_POLICY = {
  mode: CLINICAL_DATA_MODE,
  sourceOfRecord: CLINICAL_SOURCE_OF_RECORD,
  reason: 'Avalon clinical data has not been shared with this platform. Clinical surfaces must remain placeholders until the clinical source of record and data-sharing controls are connected.',
  allowed: [
    'Show operational clinical status placeholders',
    'Show annual GFE required or valid state',
    'Show consent complete or pending state',
    'Show Avalon NP first / Qualiphy fallback routing state',
    'Show Acuity closeout proof status',
    'Show nurse bring-list and kit requirements',
    'Show non-PHI operational audit events',
  ],
  blocked: [
    'Do not store real clinical notes',
    'Do not store diagnoses',
    'Do not store real medication orders',
    'Do not store real dosing decisions',
    'Do not store full chart content',
    'Do not present final clinical eligibility as platform-owned truth',
    'Do not send PHI to finance, CRM, or investor metrics',
  ],
  handoff: [
    'Acuity remains the chart and scheduling source of record',
    'Avalon OS tracks operations, routing, inventory, status, and proof',
    'Qualiphy is fallback GFE only when no Avalon remote NP is on call',
    'Clinical details can be connected later behind the identity and compliance service boundary',
  ],
};

export function buildClinicalPlaceholderSnapshot() {
  return {
    ...CLINICAL_PLACEHOLDER_POLICY,
    allowedCount: CLINICAL_PLACEHOLDER_POLICY.allowed.length,
    blockedCount: CLINICAL_PLACEHOLDER_POLICY.blocked.length,
    handoffCount: CLINICAL_PLACEHOLDER_POLICY.handoff.length,
    status: 'Armed',
  };
}
