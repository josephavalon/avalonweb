/**
 * Fire-and-forget "a request came in" ping for the admin alert.
 *
 * This module NEVER reads a form field. It sends an empty POST whose only job
 * is to tell the server that *something* was submitted — the server then texts
 * and emails the admins a constant message telling them to open the secure
 * system. The intake itself lives in Cognito and never touches Avalon's
 * servers, which is the whole point of the front-door architecture
 * (docs/PHI_DATA_FLOW.md).
 *
 * Cognito's success state on /start and the /start/received landing can both
 * fire for a SINGLE submission. That is the duplicate this guards against —
 * and only that one.
 */

// Mirrors DIRECT_RECEIPT_KEY in src/pages/RequestReceived.jsx — same idea, own
// key, so clearing one signal never silently disarms the other.
const ALERT_KEY = 'av.start.alert.v1';

// How long two pings are treated as the same submission.
//
// This used to be "once per browser session, forever", which silently swallowed
// every submission after the first: a client who mistyped their number and sent
// the form again, two people booking from one phone, or anyone submitting a
// second request in the same tab all produced NO alert at all. The admins had
// no way to know a request existed, because the whole point of this ping is
// that the page tells them.
//
// The real duplicate window is the gap between Cognito flipping to success and
// the /start/received landing mounting — a second or two. A minute is generous
// cover for a slow redirect while still letting a genuine second submission
// through.
const SAME_SUBMISSION_WINDOW_MS = 60 * 1000;

function readSession(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode / storage disabled — the server-side nonce check still dedupes */
  }
}

function newNonce() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // Shape must satisfy the server's /^[a-f0-9-]{8,64}$/i.
  return `${Date.now().toString(16)}-${Math.floor(Math.random() * 1e16).toString(16)}`;
}

/**
 * Ping the alert endpoint once per submission.
 *
 * @param {'start'|'vitalice'} source which form was submitted
 * @returns {boolean} true if a request was actually issued
 */
export function pingIntakeAlert(source = 'start') {
  if (typeof window === 'undefined') return false;

  const last = Number(readSession(ALERT_KEY));
  if (Number.isFinite(last) && last > 0 && Date.now() - last < SAME_SUBMISSION_WINDOW_MS) {
    return false;
  }

  const nonce = newNonce();
  // Stamped BEFORE the request so a double-invoked effect cannot race into two
  // sends. The server dedupes on the nonce as well, so both halves have to fail
  // for an admin to get a duplicate.
  writeSession(ALERT_KEY, String(Date.now()));

  const safeSource = source === 'vitalice' ? 'vitalice' : 'start';

  // keepalive: Cognito may navigate immediately on success, and an in-flight
  // fetch would otherwise be cancelled. It also caps the payload at 64KB, which
  // is moot here — there is no payload, and there must never be one.
  fetch(`/api/notify/intake-alert?source=${safeSource}`, {
    method: 'POST',
    headers: { 'x-avalon-alert-nonce': nonce },
    keepalive: true,
    cache: 'no-store',
  }).catch(() => {
    /* An alert is a nice-to-have; the Cognito email is the system of record.
       Never surface this to the visitor, never retry. */
  });

  return true;
}
