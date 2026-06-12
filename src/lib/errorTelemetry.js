const REDACTED = '[redacted]';
const MAX_DEPTH = 5;
const MAX_STRING_LENGTH = 480;

const PHI_KEY_PATTERN = /(address|birth|birthday|city|client|contact|dob|email|emergency|first.?name|full.?name|last.?name|lat|lng|location|name|note|patient|phone|postal|street|zip)/i;
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|secret|session|token)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const DOB_PATTERN = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;

let telemetryConfig = null;
let globalHandlersAttached = false;

function telemetryEnv() {
  return /** @type {Record<string, string | undefined>} */ (import.meta.env || {});
}

function redactString(value = '') {
  return String(value)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED)
    .replace(DOB_PATTERN, REDACTED)
    .slice(0, MAX_STRING_LENGTH);
}

function scrubUrl(value = '') {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://avalon.local';
    const url = new URL(String(value), base);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return redactString(value).split('?')[0].split('#')[0];
  }
}

function scrubValue(value, key = '', depth = 0) {
  if (value == null) return value;
  if (PHI_KEY_PATTERN.test(key) || SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubValue(item, key, depth + 1));
  if (typeof value !== 'object') return REDACTED;

  const scrubbed = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    scrubbed[childKey] = scrubValue(childValue, childKey, depth + 1);
  }
  return scrubbed;
}

function randomEventId() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseSentryDsn(dsn = '') {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const segments = url.pathname.split('/').filter(Boolean);
    const projectId = segments.pop();
    if (!publicKey || !projectId) return null;
    const pathPrefix = segments.length ? `/${segments.join('/')}` : '';
    const endpoint = `${url.protocol}//${url.host}${pathPrefix}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7&sentry_client=avalon-web/1.0`;
    return { dsn, endpoint };
  } catch {
    return null;
  }
}

function eventFromError(error, context = {}) {
  const env = telemetryEnv();
  const safe = sanitizeErrorForLocalLog(error, context);
  return sanitizeErrorTelemetryEvent({
    event_id: randomEventId(),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: env.MODE || 'production',
    release: env.VITE_APP_VERSION || undefined,
    logger: 'avalon.error-boundary',
    message: safe.message,
    exception: {
      values: [{
        type: safe.name,
        value: safe.message,
        stacktrace: error?.stack ? { frames: [{ filename: 'browser', function: redactString(error.stack) }] } : undefined,
      }],
    },
    request: typeof window !== 'undefined' ? { url: window.location.href } : undefined,
    contexts: {
      react: {
        componentStack: context?.componentStack || '',
      },
    },
    tags: {
      surface: context?.surface || 'browser',
    },
  });
}

function postSentryEnvelope(event) {
  if (!telemetryConfig || typeof fetch !== 'function') return;
  const envelope = [
    JSON.stringify({
      event_id: event.event_id,
      sent_at: new Date().toISOString(),
      dsn: telemetryConfig.dsn,
    }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  fetch(telemetryConfig.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
    body: envelope,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {});
}

function attachGlobalHandlers() {
  if (globalHandlersAttached || typeof window === 'undefined') return;
  globalHandlersAttached = true;
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message || 'window_error');
    postSentryEnvelope(eventFromError(error, { surface: 'window_error' }));
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'unhandled_rejection'));
    postSentryEnvelope(eventFromError(reason, { surface: 'unhandled_rejection' }));
  });
}

export function sanitizeErrorTelemetryEvent(event = {}) {
  const next = scrubValue(event);

  if (next.request) {
    next.request = {
      ...next.request,
      url: next.request.url ? scrubUrl(next.request.url) : undefined,
      query_string: undefined,
      cookies: undefined,
      headers: undefined,
      data: undefined,
    };
  }

  if (next.user) {
    next.user = { id: next.user.id ? REDACTED : undefined };
  }

  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = next.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb?.message ? redactString(crumb.message) : crumb?.message,
      data: crumb?.data ? scrubValue(crumb.data) : undefined,
    }));
  }

  return next;
}

export function sanitizeErrorForLocalLog(error, info = {}) {
  return {
    message: redactString(error?.message || String(error || 'unknown_error')),
    name: redactString(error?.name || 'Error'),
    componentStack: redactString(info?.componentStack || ''),
  };
}

export function initErrorTelemetry() {
  if (telemetryConfig || typeof window === 'undefined') return Boolean(telemetryConfig);
  const config = parseSentryDsn(telemetryEnv().VITE_SENTRY_DSN);
  if (!config) return false;
  telemetryConfig = config;
  attachGlobalHandlers();
  return true;
}

export function captureRenderError(error, info = {}) {
  if (!telemetryConfig) return;
  postSentryEnvelope(eventFromError(error, {
    ...info,
    surface: 'react_render',
  }));
}
