/**
 * POST /api/notify/intake-alert — buzz the admins' phones when a new request
 * lands on the site.
 *
 * ── WHY THIS ENDPOINT CANNOT RECEIVE DATA ───────────────────────────────────
 * Cognito Forms holds the intake and emails the admins itself; that email is
 * easy to miss. This adds a text on the company line saying "go look at the
 * secure system" — and nothing else. It carries no name, no phone, no service,
 * no time, no identifier of any kind.
 *
 * The no-PHI property is STRUCTURAL, not a promise. bodyParser is off, a
 * request with a body is refused before anything reads it, and the request's
 * parsed-body property is never referenced here. The browser sends an empty
 * POST; the only input is a `?source=` value matched against a hardcoded Set
 * and used solely to PICK a frozen message. Nothing from the request is ever
 * interpolated into an SMS. scripts/front-door-qa.mjs asserts all of that.
 *
 * Deliberately does NOT call blockFrontDoorPhiRoute(): avalonvitality.co and
 * www are both in FRONT_DOOR_HOSTS, so that guard would 409 the endpoint on
 * exactly the hosts this feature runs on. Same exemption, and same reasoning,
 * as api/invoice/submit.js.
 *
 * Deliberately does NOT gate on AVALON_ENABLE_LIVE_API either. An operational
 * alert that silently stops firing because a flag drifted is worse than having
 * no alert at all — you would not find out until you lost a client. It gates on
 * isSmsConfigured() instead, which fails visibly in the response.
 *
 * ── WHY THERE IS NO SHARED SECRET ───────────────────────────────────────────
 * The caller is a public web page, so any token in the bundle is public too. A
 * secret here would be theater. What actually bounds the damage: recipients are
 * fixed by env (an attacker cannot choose a target), the body is a constant (no
 * content to inject), and the rate limits below cap the Quo spend. The worst
 * case is a stranger making three phones buzz with a message that says nothing.
 */
import crypto from 'crypto';
import { adminAlertPhones, isSmsConfigured, sendSms } from '../_lib/send-sms.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeLogContext } from '../_lib/safe-error.js';

// Vercel must not parse a body — see the header. A request that carries one is
// refused on Content-Length before any read happens.
export const config = { api: { bodyParser: false } };

// Frozen, complete sentences with no interpolation. These strings are the ONLY
// thing this endpoint can transmit.
//
// CRITICAL: bodyContainsPhi() (api/_lib/phi-guard.js) blocks the bare words
// "nurse" and "appointment". The obvious wording — "new appointment request,
// check the nurse queue" — is refused by sendSms(), which returns { ok: false }
// rather than throwing, so the failure is SILENT: zero texts, no error anywhere
// the client can see. Every word below is chosen to clear that block-list, and
// scripts/front-door-qa.mjs runs these constants through bodyContainsPhi() so a
// future edit fails CI instead of failing quietly in production.
const ALERT_BODIES = Object.freeze({
  start: 'Avalon Vitality: a new request just came in on the site. Open the secure system to review and follow up. Details are not sent by text.',
  vitalice: 'Avalon Vitality: a new Vital Ice request just came in on the site. Open the secure system to review and follow up. Details are not sent by text.',
});

// Every alert ends with a short random reference, e.g. "Ref 7QTX".
//
// This is not decoration. The bodies above are constants, so two alerts were
// byte-identical, and carriers silently drop repeated identical SMS to the same
// number — observed 2026-08-31: the first alert arrived, the next two were
// accepted by Quo (2xx, skipped: 0) and never reached the handset. A varying
// tail makes each message unique.
//
// It is random and derived from NOTHING about the request — not the time, not
// the source, not the submitter. It carries no information at all, which is
// what keeps it outside PHI while still defeating dedupe. It also gives ops a
// token to quote when matching a text to a Quo dashboard entry.
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
function alertRef() {
  return Array.from(crypto.randomBytes(4))
    .map((byte) => REF_ALPHABET[byte % REF_ALPHABET.length])
    .join('');
}

const SOURCES = new Set(Object.keys(ALERT_BODIES));
const DEFAULT_SOURCE = 'start';

// Hosts allowed to trigger an alert. Not authentication — anyone can forge an
// Origin header — but it filters drive-by curl without pretending otherwise.
const ALLOWED_ORIGIN_HOSTS = new Set([
  'avalonvitality.co',
  'www.avalonvitality.co',
  'beta.avalonvitality.co',
  'snooches.avalonvitality.co',
  'localhost',
  '127.0.0.1',
]);

// Only an https link on a host we control may ride along, so that changing one
// env var can never turn an SMS from Avalon's own number into a phishing lure.
const ALLOWED_LINK_HOSTS = new Set([
  'www.cognitoforms.com',
  'avalonvitality.co',
  'www.avalonvitality.co',
  'beta.avalonvitality.co',
]);

// Per-IP caps stop one bored visitor. The GLOBAL caps are the ones that bound
// the Quo bill, because per-IP limiting does nothing against a distributed
// script. NOTE: without KV_REST_API_URL/_TOKEN, rate-limit.js falls back to a
// per-instance Map — "global" is then per-Vercel-instance. Provision KV.
const LIMITS = [
  { name: 'ip-minute', key: (ip) => `intake-alert:ip:${ip}`, windowMs: 60 * 1000, max: 3 },
  { name: 'ip-day', key: (ip) => `intake-alert:ipd:${ip}`, windowMs: 24 * 60 * 60 * 1000, max: 20 },
  { name: 'global-minute', key: () => 'intake-alert:global:m', windowMs: 60 * 1000, max: 10 },
  { name: 'global-hour', key: () => 'intake-alert:global:h', windowMs: 60 * 60 * 1000, max: 60 },
];

const NONCE_RE = /^[a-f0-9-]{8,64}$/i;
const NONCE_TTL_MS = 6 * 60 * 60 * 1000;

function originHost(req) {
  const raw = req.headers?.origin || req.headers?.referer || '';
  if (!raw) return null;
  try {
    return new URL(String(raw)).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function alertLink() {
  const raw = String(process.env.ADMIN_ALERT_LINK || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return '';
    if (!ALLOWED_LINK_HOSTS.has(url.hostname.toLowerCase())) return '';
    return ` ${url.toString()}`;
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'method_not_allowed' });
  }

  // Refuse anything carrying a payload. This is the structural half of the
  // no-PHI guarantee: if a caller ever tries to "helpfully" send the form
  // fields, the request dies here rather than being read and discarded.
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 0) {
    return res.status(400).json({ ok: false, code: 'unexpected_body' });
  }

  const host = originHost(req);
  if (host && !ALLOWED_ORIGIN_HOSTS.has(host)) {
    return res.status(403).json({ ok: false, code: 'forbidden_origin' });
  }

  const requested = String(req.query?.source || '');
  const source = SOURCES.has(requested) ? requested : DEFAULT_SOURCE;

  // Cognito's success state and the /start/received landing can both fire for
  // one submission, and React StrictMode double-invokes effects in dev. The
  // nonce is generated once per submission on the client, so the second arrival
  // is a no-op instead of a second buzz. Reuses the rate limiter as a
  // seen-once set — max: 1 in a 6h window is exactly that.
  const nonce = String(req.headers['x-avalon-alert-nonce'] || '');
  if (nonce && !NONCE_RE.test(nonce)) {
    return res.status(400).json({ ok: false, code: 'invalid_nonce' });
  }

  // Every one of these is an independent counter, so they are issued together
  // rather than one after another. Run sequentially they cost five round trips
  // to the KV store BEFORE Quo is even called — measured at ~1.7s of dead time
  // between a client pressing START and the message reaching the provider. A
  // notification is only useful if it is fast, so the checks overlap.
  const ip = clientIp(req);
  const checks = LIMITS.map((limit) => ({
    name: limit.name,
    promise: checkRateLimit({ key: limit.key(ip), windowMs: limit.windowMs, max: limit.max }),
  }));
  const noncePromise = nonce
    ? checkRateLimit({ key: `intake-alert:nonce:${nonce}`, windowMs: NONCE_TTL_MS, max: 1 })
    : Promise.resolve({ ok: true });

  const [nonceResult, ...limitResults] = await Promise.all([
    noncePromise,
    ...checks.map((c) => c.promise),
  ]);

  // Dedupe wins over the rate limit: a replayed submission is not abuse, and
  // reporting it as rate-limited would be a misleading answer to the client.
  if (!nonceResult.ok) {
    console.log('[intake-alert] outcome', { source, result: 'deduped', sent: 0 });
    return res.status(200).json({ ok: true, deduped: true, sent: 0 });
  }

  const breached = limitResults.findIndex((r) => !r.ok);
  if (breached !== -1) {
    const result = limitResults[breached];
    res.setHeader('Retry-After', Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
    console.log('[intake-alert] outcome', { source, result: 'rate_limited', bucket: checks[breached].name, sent: 0 });
    return res.status(429).json({ ok: false, code: 'rate_limited' });
  }

  if (!isSmsConfigured()) {
    console.log('[intake-alert] outcome', { source, result: 'sms_not_configured', sent: 0 });
    return res.status(200).json({ ok: true, sent: 0, code: 'sms_not_configured' });
  }

  const phones = adminAlertPhones();
  if (!phones.length) {
    console.log('[intake-alert] outcome', { source, result: 'no_admin_phones', sent: 0 });
    return res.status(200).json({ ok: true, sent: 0, code: 'no_admin_phones' });
  }
  // Count only — the numbers themselves never reach a log line.
  console.log('[intake-alert] dispatching', { source, recipients: phones.length });

  const ref = alertRef();
  const body = `${ALERT_BODIES[source]} Ref ${ref}.${alertLink()}`;

  try {
    // sendSms never throws and never rejects; allSettled is belt-and-braces so
    // one bad number cannot suppress the other admins' texts.
    const results = await Promise.allSettled(phones.map((to) => sendSms({ to, body })));
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value?.ok).length;
    const skipped = phones.length - sent;
    const providerIds = results
      .map((r) => (r.status === 'fulfilled' ? r.value?.providerId : null))
      .filter(Boolean);
    console.log('[intake-alert] outcome', { source, ref, result: 'dispatched', sent, skipped, providerIds });
    if (skipped > 0) {
      // Codes only — never a number, never the nonce.
      const codes = results.map((r) => (r.status === 'fulfilled' ? r.value?.code || 'ok' : 'rejected'));
      console.warn('[intake-alert] some alerts did not send', { sent, skipped, codes });
    }
    return res.status(200).json({ ok: true, sent, skipped });
  } catch (err) {
    console.warn('[intake-alert] send failed', safeLogContext(err, 'intake_alert_send_failed'));
    return res.status(200).json({ ok: true, sent: 0, code: 'send_failed' });
  }
}
