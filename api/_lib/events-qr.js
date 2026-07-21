/**
 * Door credential tokens + offline manifest signing (ET5, blueprint §2.3 +
 * eng review T7: key rotation via `kid`, single-use replay protection via
 * `jti`, manifest freshness via generatedAt).
 *
 * Two modes (plan placeholder rule):
 *  - ed25519: EVENTS_QR_PRIVATE_KEY (PKCS8 PEM) + EVENTS_QR_PUBLIC_KEY (SPKI
 *    PEM) + EVENTS_QR_KEY_ID set → tokens verify OFFLINE at the door with the
 *    public key shipped in the manifest.
 *  - online_only_placeholder: no keypair configured → tokens are HMAC-signed
 *    with a server-side secret that never leaves the server. The scanner
 *    still works but must be online (server verifies); the manifest says so
 *    loudly so nobody mistakes placeholder mode for the offline drill.
 *
 * PHI LAW: the token payload carries identity + status enums + scope flags
 * only — never conditions, meds, or reasons. Allergy detail is a tap into the
 * chart from the clinical serve view, never encoded here.
 */
import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

export function qrMode(env = process.env) {
  return env.EVENTS_QR_PRIVATE_KEY && env.EVENTS_QR_PUBLIC_KEY
    ? 'ed25519'
    : 'online_only_placeholder';
}

function hmacSecret(env = process.env) {
  // Derived, never shipped: placeholder mode is online-verify only.
  const base = env.EVENTS_QR_HMAC_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || 'avalon-events-dev';
  return crypto.createHash('sha256').update(`events-qr:${base}`).digest();
}

/**
 * Build the signed door token for a visit. Payload is the offline scan's
 * whole world: who, what service class, cleared-for-what, which event.
 */
export function mintVisitToken(visit, { env = process.env, now = new Date() } = {}) {
  const mode = qrMode(env);
  const kid = mode === 'ed25519' ? (env.EVENTS_QR_KEY_ID || 'k1') : 'hmac-placeholder';
  const payload = {
    v: 1,
    vid: visit.id,
    jti: visit.qr_jti || crypto.randomUUID(),
    nm: visit.attendee_name || 'Guest',
    sc: visit.service_class || null,          // flow | express | null (experience)
    gfe: visit.gfe_status,
    scope: visit.gfe_scope || {},             // e.g. {iv:true, im:true} — the NP's call
    ev: visit.event_slug || visit.container_id,
    iat: Math.floor(new Date(now).getTime() / 1000),
  };
  const header = { alg: mode === 'ed25519' ? 'EdDSA' : 'HS256', kid };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  let sig;
  if (mode === 'ed25519') {
    const key = crypto.createPrivateKey(env.EVENTS_QR_PRIVATE_KEY);
    sig = crypto.sign(null, Buffer.from(signingInput), key);
  } else {
    sig = crypto.createHmac('sha256', hmacSecret(env)).update(signingInput).digest();
  }
  return { token: `${signingInput}.${b64u(sig)}`, jti: payload.jti, kid };
}

/** Server-side verification (both modes). Returns { valid, payload?, reason? }. */
export function verifyVisitToken(token, { env = process.env } = {}) {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return { valid: false, reason: 'malformed' };
    const header = JSON.parse(fromB64u(h).toString());
    const signingInput = `${h}.${p}`;
    let valid = false;
    if (header.alg === 'EdDSA') {
      if (!env.EVENTS_QR_PUBLIC_KEY) return { valid: false, reason: 'no_public_key' };
      const key = crypto.createPublicKey(env.EVENTS_QR_PUBLIC_KEY);
      valid = crypto.verify(null, Buffer.from(signingInput), key, fromB64u(s));
    } else if (header.alg === 'HS256') {
      const expect = crypto.createHmac('sha256', hmacSecret(env)).update(signingInput).digest();
      const got = fromB64u(s);
      valid = expect.length === got.length && crypto.timingSafeEqual(expect, got);
    }
    if (!valid) return { valid: false, reason: 'bad_signature' };
    return { valid: true, payload: JSON.parse(fromB64u(p).toString()), kid: header.kid };
  } catch {
    return { valid: false, reason: 'malformed' };
  }
}

/**
 * Per-service clearance at a station (blueprint §6.2.2): the scanner enforces
 * the SCOPE of the NP's clearance. A guest cleared for shots only scans green
 * at the shot bar and red at an IV chair.
 *   station: 'flow' (IV chairs) | 'express' (shot bar) | 'experience'
 */
export function clearanceAtStation({ gfeStatus, gfeScope = {}, gfeRequired = true }, station) {
  if (station === 'experience') return { allowed: true, level: 'ok' };
  if (!gfeRequired) return { allowed: false, level: 'stop', reason: 'not_a_clinical_ticket' };
  if (gfeStatus !== 'cleared') return { allowed: false, level: 'stop', reason: `gfe_${gfeStatus}` };
  const scoped = station === 'flow' ? gfeScope.iv : station === 'express' ? gfeScope.im : false;
  // Empty scope on a cleared visit = cleared for everything (pre-shot-bar events).
  const scopeIsEmpty = !gfeScope || Object.keys(gfeScope).length === 0;
  if (scoped || scopeIsEmpty) return { allowed: true, level: 'ok' };
  return { allowed: false, level: 'stop', reason: 'outside_clearance_scope' };
}
