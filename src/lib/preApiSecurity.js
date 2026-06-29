const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^.+\.local$/i,
];

const BETA_HOST_PATTERNS = [
  /^snooches\.avalonvitality\.co$/i,
];

// Production-only hosts. Demo auth MUST be impossible here even if a build
// accidentally ships with VITE_AVALON_DEMO_PASSWORD or someone forgets to set
// VITE_AVALON_DEMO_AUTH=false. Apex + www are the launch-marketing surfaces.
const PRODUCTION_HOST_PATTERNS = [
  /^avalonvitality\.co$/i,
  /^www\.avalonvitality\.co$/i,
];

function currentHost() {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
}

export function isLocalSimulationHost(host = currentHost()) {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(String(host)));
}

export function isBetaSimulationHost(host = currentHost()) {
  return BETA_HOST_PATTERNS.some((pattern) => pattern.test(String(host)));
}

export function isProductionHost(host = currentHost()) {
  return PRODUCTION_HOST_PATTERNS.some((pattern) => pattern.test(String(host)));
}

export function isLiveApiArmed() {
  const env = /** @type {Record<string, string | undefined>} */ (import.meta.env || {});
  return env.VITE_AVALON_ENABLE_LIVE_API === 'true';
}

// Single source of truth for the prod refusal. Used by both the demo gate AND
// by sign-in call sites so we can warn + log a structured refusal without
// silently falling through to a "wrong password" error.
export function demoAuthLockReason() {
  const env = /** @type {Record<string, string | undefined>} */ (import.meta.env || {});
  if (env.VITE_AVALON_DEMO_AUTH === 'false') return 'demo_auth_env_disabled';
  // Vite's PROD flag is set during a production build. We require BOTH
  // build-time PROD and a non-simulation host before we'll fall open; a prod
  // build that ships to snooches (beta) must keep demo auth working.
  const isProdBuild = Boolean(env.PROD) && env.MODE !== 'development';
  if (isProdBuild && isProductionHost()) return 'demo_auth_production_host';
  // Catch-all: any avalonvitality.co host that isn't explicitly whitelisted as
  // beta. This is the belt to the PROD-build-flag suspenders — it fires even on
  // a non-PROD build (e.g. a preview alias accidentally pointing at apex).
  if (!isLocalSimulationHost() && !isBetaSimulationHost() && isProductionHost()) {
    return 'demo_auth_production_host';
  }
  if (isLiveApiArmed()) return 'live_api_armed';
  return '';
}

export function isDemoAuthAllowed() {
  if (demoAuthLockReason()) return false;
  return isLocalSimulationHost() || isBetaSimulationHost();
}

export const PRE_API_SECURITY_MODE = {
  mode: isLiveApiArmed() ? 'live-api-armed' : 'pre-api-hard-wall',
  localSimulation: isLocalSimulationHost(),
  betaSimulation: isBetaSimulationHost(),
  liveApiArmed: isLiveApiArmed(),
  demoAuthAllowed: isDemoAuthAllowed(),
  label: isLiveApiArmed()
    ? 'Live API armed'
    : isBetaSimulationHost()
      ? 'Beta simulation only'
      : 'Local simulation only',
};

export const PHI_STORAGE_KEYS = [
  'ssn',
  'diagnosis',
  'medicalconditions',
  'medicalhistory',
  'allergies',
  'medications',
  'dob',
  'dateofbirth',
  'birthdate',
  'emergencycontact',
  'vitals',
  'bloodpressure',
  'heartrate',
  'clinicalnotes',
  'chartnote',
  'visitnote',
  'gfepayload',
  'intakeanswers',
  'adverseevent',
  'reaction',
  'dischargecondition',
  'patientsignature',
  'providersignature',
  'signaturedata',
  'temperature',
  'respiratoryrate',
  'oxygen',
  'spo2',
  'prebp',
  'prehr',
  'prespo2',
  'postbp',
  'posthr',
  'postspo2',
  'painlevel',
  'symptoms',
  'contraindications',
  'nursesignature',
  'acuitynote',
];

const PHI_EXACT_KEYS = new Set(['bp', 'hr', 'spo2']);

function sensitiveKey(key = '') {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return PHI_EXACT_KEYS.has(normalized) || PHI_STORAGE_KEYS.some((blocked) => normalized.includes(blocked));
}

export function redactLocalPhi(value) {
  if (Array.isArray(value)) return value.map(redactLocalPhi);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    sensitiveKey(key) ? '[redacted-local-simulation]' : redactLocalPhi(nested),
  ]));
}
