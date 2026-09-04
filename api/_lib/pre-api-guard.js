const LIVE_API_FLAGS = ['AVALON_ENABLE_LIVE_API', 'VITE_AVALON_ENABLE_LIVE_API'];

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

// Host-scoped "front door" gate — SERVER SIDE.
//
// snooches.avalonvitality.co is the PHI-free front door: a static brochure plus
// the Cognito-hosted intake. src/lib/frontDoor.js gates the PHI-collecting
// ROUTES in the browser, but that is client-side only — anyone can still POST
// straight at /api/create-checkout-session on that host and land PHI in
// Supabase, which drags Supabase back into HIPAA BAA scope. This list is the
// server-side half of that same gate.
//
// DELIBERATE DUPLICATE of FRONT_DOOR_HOSTS in src/lib/frontDoor.js. It is not
// imported because that module lives in the client bundle behind the Vite `@/`
// alias and reads `window`; serverless functions must not depend on it. If you
// change one list, change the other — they are load-bearing together.
//
// 2026-08-03: apex and www were promoted to front-door hosts. Keep this list
// hosts run the full legacy funnel and their behavior is unchanged.
const FRONT_DOOR_HOSTS = new Set([
  'avalonvitality.co',
  'www.avalonvitality.co',
  'snooches.avalonvitality.co',
]);

// Hosts that legitimately run the full OS funnel.
//
// 2026-09-01: the gate below was inverted to deny-by-default. It used to answer
// "is this host on the front-door list?", which meant any host nobody thought to
// add served the PHI routes wide open — including every *.vercel.app preview URL
// of this project. Previews are publicly reachable (no deployment protection)
// and Preview env carries AVALON_ENABLE_LIVE_API, STRIPE_SECRET_KEY,
// ACUITY_API_KEY, RESEND_API_KEY and QUO_API_KEY, so a stranger who found one
// could drive real charges and real bookings against production vendors.
// Verified before the fix: GET /api/create-checkout-session answered 409 on www
// and 405 on avalonweb-*.vercel.app, i.e. the guard never ran there.
//
// Allow-listing the OS is safe when we forget to update it; allow-listing the
// front door was not. A new host now has to be named here on purpose before it
// can touch PHI.
const OS_HOSTS = new Set([
  'beta.avalonvitality.co',
  'care.avalonvitality.co',
]);

// Escape hatch for QA against a RAW preview URL, which is now gated like any
// other unknown host. The normal workflow aliases a preview onto
// beta.avalonvitality.co and needs nothing here.
//
// Read per-request rather than at module load so it cannot be baked into a
// warm lambda, and INERT IN PRODUCTION no matter what the dashboard says. An
// escape hatch that can be left on in prod is just the old bug with extra
// steps, and a script asserting "it is unset" would only ever check the shell
// it runs in, never Vercel. Refusing to read it is the only version of that
// promise which cannot drift.
const EMPTY_HOST_SET = new Set();

function osExtraHosts() {
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') return EMPTY_HOST_SET;
  const raw = String(process.env.AVALON_OS_EXTRA_HOSTS || '').trim();
  if (!raw) return EMPTY_HOST_SET;
  return new Set(
    raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  );
}

function hostFromRequest(req = {}) {
  const raw = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  return String(raw).split(',')[0].split(':')[0].trim().toLowerCase();
}

export function isLocalRequest(req = {}) {
  const host = hostFromRequest(req);
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

// True when this request must NOT be allowed to touch PHI. Deny-by-default:
// a host is only exempt if it is explicitly a known OS host, a private/local
// address, or named in AVALON_OS_EXTRA_HOSTS.
//
// hostFromRequest() reads x-forwarded-host, which is attacker-controlled in
// principle. Verified 2026-09-01 that Vercel overrides it: sending
// `X-Forwarded-Host: beta.avalonvitality.co` to www.avalonvitality.co still
// answered 409, as did a bare unknown host. If this ever moves off Vercel, that
// assumption has to be re-tested — it is now the key to the gate.
export function isFrontDoorHost(req = {}) {
  const host = hostFromRequest(req);
  if (FRONT_DOOR_HOSTS.has(host)) return true;
  if (isLocalRequest(req)) return false;
  if (osExtraHosts().has(host)) return false;
  return !OS_HOSTS.has(host);
}

export function frontDoorBlockedPayload(action = 'This endpoint') {
  return {
    ok: false,
    code: 'front_door_phi_route_disabled',
    mode: 'front-door-phi-free',
    action,
    message: `${action} is disabled on the PHI-free front door. Intake happens on the Cognito-hosted form at /start.`,
  };
}

// Call FIRST in any handler that writes patient identity, appointment, or
// payment data to Supabase / Stripe / Acuity. Returns true when it has already
// answered the request, matching blockLiveVendorAction()'s shape.
//
// Do NOT apply to: auth routes, /api/analytics, /api/robots, cron jobs,
// webhook receivers (Stripe/Acuity/Resend must keep delivering on every host),
// or api/admin/* routes already behind requireStaff/requireAdmin.
export function blockFrontDoorPhiRoute(req, res, action = 'This endpoint') {
  if (!isFrontDoorHost(req)) return false;
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(409).json(frontDoorBlockedPayload(action));
  return true;
}

export function isLiveApiEnabled() {
  return LIVE_API_FLAGS.some((flag) => process.env[flag] === 'true');
}

export function preApiBlockedPayload(action = 'Live vendor action') {
  return {
    ok: false,
    code: 'pre_api_hard_wall',
    mode: 'local-simulation-only',
    action,
    message: `${action} is blocked until AVALON_ENABLE_LIVE_API=true or VITE_AVALON_ENABLE_LIVE_API=true.`,
  };
}

export function blockLiveVendorAction(req, res, action) {
  if (isLiveApiEnabled()) return false;
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(409).json(preApiBlockedPayload(action));
  return true;
}

export function requireLiveWebhook(req, res, { provider, secretEnv }) {
  if (!isLiveApiEnabled()) {
    res.setHeader?.('Cache-Control', 'no-store');
    res.status(409).json(preApiBlockedPayload(`${provider} webhook processing`));
    return false;
  }

  if (!process.env[secretEnv]) {
    res.setHeader?.('Cache-Control', 'no-store');
    res.status(503).json({
      ok: false,
      code: 'webhook_secret_missing',
      provider,
      message: `${secretEnv} is required before ${provider} webhooks can be accepted.`,
    });
    return false;
  }

  return true;
}

export function requireInternalAccess(req, res, action = 'Internal API access') {
  if (blockLiveVendorAction(req, res, action)) return false;

  const secret = process.env.AVALON_INTERNAL_API_SECRET;
  if (!secret) {
    res.setHeader?.('Cache-Control', 'no-store');
    res.status(503).json({
      ok: false,
      code: 'internal_auth_missing',
      message: 'AVALON_INTERNAL_API_SECRET is required before live internal APIs can respond.',
    });
    return false;
  }

  const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (supplied !== secret) {
    res.setHeader?.('Cache-Control', 'no-store');
    res.status(401).json({ ok: false, code: 'unauthorized' });
    return false;
  }

  return true;
}

export function localAvailability({ date, appointmentTypeID, timezone = 'America/Los_Angeles' } = {}) {
  const day = String(date || new Date().toISOString().slice(0, 10));
  return ['10:00', '12:00', '14:00', '16:00', '18:00'].map((time, index) => ({
    time: `${day}T${time}:00-07:00`,
    slotsAvailable: index === 2 ? 1 : 2,
    appointmentTypeID: Number(appointmentTypeID) || 0,
    timezone,
    provider: 'local-simulation',
    preApi: true,
  }));
}

export function localAppointment(id = 'local-preview') {
  const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  return {
    id,
    type: 'Avalon local simulation',
    datetime: startsAt,
    duration: 60,
    location: 'Local simulation address redacted',
    firstName: 'Preview',
    lastName: 'Client',
    email: 'preview@avalon.local',
    phone: '',
    notes: '[LOCAL SIMULATION ONLY] No live Acuity record was read.',
    price: 0,
    forms: [],
    preApi: true,
  };
}

export function localAppointments() {
  return [
    {
      ...localAppointment('local-day-001'),
      type: 'Recovery Protocol',
      status: 'scheduled',
    },
    {
      ...localAppointment('local-day-002'),
      type: 'Launch Presale GFE Queue',
      status: 'pending-clearance',
    },
  ];
}
