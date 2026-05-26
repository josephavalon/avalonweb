const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function currentHost() {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
}

export function isLocalSimulationHost(host = currentHost()) {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(String(host)));
}

export function isLiveApiArmed() {
  const env = import.meta.env || {};
  return env.VITE_AVALON_ENABLE_LIVE_API === 'true';
}

export function isDemoAuthAllowed() {
  const env = import.meta.env || {};
  if (env.VITE_AVALON_DEMO_AUTH === 'false') return false;
  return !isLiveApiArmed() && isLocalSimulationHost();
}

export const PRE_API_SECURITY_MODE = {
  mode: isLiveApiArmed() ? 'live-api-armed' : 'pre-api-hard-wall',
  localSimulation: isLocalSimulationHost(),
  liveApiArmed: isLiveApiArmed(),
  demoAuthAllowed: isDemoAuthAllowed(),
  label: isLiveApiArmed() ? 'Live API armed' : 'Local simulation only',
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
];

function sensitiveKey(key = '') {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return PHI_STORAGE_KEYS.some((blocked) => normalized.includes(blocked));
}

export function redactLocalPhi(value) {
  if (Array.isArray(value)) return value.map(redactLocalPhi);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    sensitiveKey(key) ? '[redacted-local-simulation]' : redactLocalPhi(nested),
  ]));
}
