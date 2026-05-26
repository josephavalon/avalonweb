import { flattenNoApiCompletionMap } from '../data/noApiCompletionMap.js';

export const NO_API_GATE_RULE = 'If it does not need an API, it is buildable now.';

export const API_BOUND_HANDOFFS = [
  {
    id: 'acuity-writeback',
    label: 'Live Acuity scheduling writeback',
    owner: 'Acuity API',
    localFallback: 'Operational mirror, closeout packet, and source-of-record boundary',
  },
  {
    id: 'payment-capture',
    label: 'Live payment capture, deposit, refund, and settlement',
    owner: 'Stripe or payment gateway',
    localFallback: 'Deposit state, refund state, price integrity, and no-PHI finance queue',
  },
  {
    id: 'sms-email-delivery',
    label: 'Live SMS and email delivery',
    owner: 'SMS/email provider',
    localFallback: 'Message templates, ack state, escalation rules, and audit log',
  },
  {
    id: 'qualiphy-gfe',
    label: 'Live Qualiphy GFE execution',
    owner: 'Qualiphy',
    localFallback: 'Avalon NP-first routing and fallback placeholder only',
  },
  {
    id: 'nursys-verification',
    label: 'Live Nursys license verification',
    owner: 'Nursys',
    localFallback: 'Credential rules, expiry forecast, scope matrix, and training gate',
  },
  {
    id: 'mercury-settlement',
    label: 'Live Mercury banking movement',
    owner: 'Mercury',
    localFallback: 'Admin-only banking queue and finance handoff contract',
  },
  {
    id: 'gusto-payroll',
    label: 'Live Gusto payroll run',
    owner: 'Gusto',
    localFallback: 'Payroll proof queue, shift value, mileage, and payout preview',
  },
  {
    id: 'quickbooks-posting',
    label: 'Live QuickBooks posting',
    owner: 'QuickBooks',
    localFallback: 'No-PHI accounting summary and revenue leakage flags',
  },
  {
    id: 'hipaa-backend',
    label: 'True HIPAA backend persistence and access controls',
    owner: 'Production backend',
    localFallback: 'Privacy scanner, storage minimization, audit contracts, and placeholder clinical boundary',
  },
];

const PLACEHOLDER_TERMS = [
  'placeholder',
  'source-of-record',
  'boundary',
  'mercury',
  'gusto',
  'quickbooks',
  'qualiphy',
  'nursys',
  'stripe',
  'acuity',
  'clinical eligibility',
  'contraindication',
  'scope matrix',
];

const LOCAL_AUTOMATION_TERMS = [
  'queue',
  'state',
  'resolver',
  'gate',
  'matrix',
  'ledger',
  'checklist',
  'packet',
  'model',
  'score',
  'audit',
  'templates',
  'guard',
  'scanner',
  'generation',
  'editor',
  'dashboard',
  'timeline',
  'display',
  'routing',
  'rules',
];

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function capabilityClass(build) {
  const label = normalize(build.label);
  if (PLACEHOLDER_TERMS.some((term) => label.includes(term))) return 'placeholder-safe';
  if (LOCAL_AUTOMATION_TERMS.some((term) => label.includes(term))) return 'local-automation';
  return 'local-ui';
}

function actionForCapability(build, klass) {
  if (klass === 'placeholder-safe') {
    return 'Model locally, mark as placeholder, block fake certainty.';
  }
  if (klass === 'local-automation') {
    return 'Build local state, rules, queue, and audit proof.';
  }
  return 'Build the screen, controls, empty states, and local persistence.';
}

function proofForCapability(build, klass) {
  if (klass === 'placeholder-safe') return 'No external call required; output must stay clearly labeled.';
  if (klass === 'local-automation') return 'Pure browser/local-storage logic can execute before APIs.';
  return 'UI, routing, copy, layout, and local state do not need external services.';
}

export function classifyNoApiCapability(build) {
  const klass = capabilityClass(build);
  return {
    ...build,
    capabilityClass: klass,
    apiRequired: false,
    status: klass === 'placeholder-safe' ? 'Placeholder Safe' : 'Buildable Now',
    action: actionForCapability(build, klass),
    proof: proofForCapability(build, klass),
  };
}

export function buildNoApiCapabilitySnapshot() {
  const capabilities = flattenNoApiCompletionMap().map(classifyNoApiCapability);
  const localAutomation = capabilities.filter((item) => item.capabilityClass === 'local-automation');
  const placeholderSafe = capabilities.filter((item) => item.capabilityClass === 'placeholder-safe');
  const localUi = capabilities.filter((item) => item.capabilityClass === 'local-ui');
  const classKeys = {
    'local-automation': 'localAutomation',
    'placeholder-safe': 'placeholderSafe',
    'local-ui': 'localUi',
  };
  const byDomain = capabilities.reduce((acc, item) => {
    const existing = acc.get(item.domain) || {
      id: item.domain,
      label: item.domainLabel,
      total: 0,
      localAutomation: 0,
      placeholderSafe: 0,
      localUi: 0,
      critical: 0,
      items: [],
    };
    existing.total += 1;
    existing[classKeys[item.capabilityClass]] += 1;
    if (item.priority === 'critical') existing.critical += 1;
    existing.items.push(item);
    acc.set(item.domain, existing);
    return acc;
  }, new Map());

  return {
    rule: NO_API_GATE_RULE,
    total: capabilities.length,
    localBuildable: capabilities.filter((item) => !item.apiRequired).length,
    apiBlocked: capabilities.filter((item) => item.apiRequired).length,
    localAutomation: localAutomation.length,
    placeholderSafe: placeholderSafe.length,
    localUi: localUi.length,
    criticalBuildable: capabilities.filter((item) => item.priority === 'critical' && !item.apiRequired).length,
    capabilities,
    byDomain: Array.from(byDomain.values()),
    shipNow: capabilities
      .filter((item) => item.priority === 'critical' && item.capabilityClass !== 'placeholder-safe')
      .slice(0, 18),
    placeholderQueue: placeholderSafe.slice(0, 12),
    apiBoundHandoffs: API_BOUND_HANDOFFS,
  };
}
