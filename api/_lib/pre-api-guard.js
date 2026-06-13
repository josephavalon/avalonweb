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

function hostFromRequest(req = {}) {
  const raw = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  return String(raw).split(',')[0].split(':')[0].trim();
}

export function isLocalRequest(req = {}) {
  const host = hostFromRequest(req);
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host));
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
