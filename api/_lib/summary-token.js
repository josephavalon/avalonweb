import crypto from 'crypto';

const SUMMARY_TOKEN_TTL_MS = 15 * 60 * 1000;

function secret() {
  return process.env.APPOINTMENT_SUMMARY_TOKEN_SECRET || '';
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createAppointmentSummaryToken({
  sessionId = '',
  appointmentRecordId = '',
  appointmentId = '',
  ttlMs = SUMMARY_TOKEN_TTL_MS,
} = {}) {
  if (!secret() || !sessionId) return '';
  const payload = encode({
    sid: String(sessionId),
    rid: appointmentRecordId ? String(appointmentRecordId) : '',
    aid: appointmentId ? String(appointmentId) : '',
    exp: Date.now() + ttlMs,
  });
  return `${payload}.${sign(payload)}`;
}

export function verifyAppointmentSummaryToken(token = '', {
  sessionId = '',
  appointmentRecordId = '',
  appointmentId = '',
} = {}) {
  if (!secret() || !token) return false;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const supplied = Buffer.from(signature);
  const actual = Buffer.from(expected);
  if (supplied.length !== actual.length || !crypto.timingSafeEqual(supplied, actual)) return false;

  let parsed = null;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return false;
  }

  if (!parsed?.exp || Date.now() > Number(parsed.exp)) return false;
  if (sessionId && parsed.sid !== String(sessionId)) return false;
  if (appointmentRecordId && parsed.rid && parsed.rid !== String(appointmentRecordId)) return false;
  if (appointmentId && parsed.aid && parsed.aid !== String(appointmentId)) return false;
  return true;
}
