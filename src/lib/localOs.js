import { redactLocalPhi } from './preApiSecurity.js';

const PREFIX = 'av.local.';

export function readLocal(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[local-os-read]', key, err);
    return fallback;
  }
}

export function writeLocal(key, value) {
  const safeValue = redactLocalPhi(value);
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(safeValue));
    window.dispatchEvent(new CustomEvent('av.local.change', {
      detail: { key, value: safeValue, updatedAt: new Date().toISOString() },
    }));
  } catch {
    if (import.meta.env?.DEV) console.warn('[local-os-write]', key);
  }
  return safeValue;
}

export function clearLocal(key) {
  try {
    window.localStorage.removeItem(`${PREFIX}${key}`);
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[local-os-clear]', key, err);
  }
}

// Wipe every Avalon-prefixed localStorage entry. Called on sign-out so a
// shared device doesn't carry one user's redacted booking draft / activity
// log into the next user's session. Cookie consent + attribution are kept;
// they're device-level preferences, not user data.
const SIGNOUT_PRESERVE = new Set(['cookieConsent', 'av.analytics.attribution']);
export function clearAllAvLocal() {
  if (typeof window === 'undefined') return;
  try {
    const toRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (SIGNOUT_PRESERVE.has(key)) continue;
      if (key.startsWith(PREFIX) || key.startsWith('av_') || key.startsWith('av.')) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[local-os-clear-all]', err);
  }
}

export function appendActivity(text, meta = {}) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    meta,
    at: new Date().toISOString(),
  };
  const log = readLocal('activity', []);
  writeLocal('activity', [item, ...log].slice(0, 80));
  return item;
}

export function readActivity(limit = 20) {
  return readLocal('activity', []).slice(0, limit);
}

export function saveBookingDraft(draft) {
  return writeLocal('bookingDraft', { ...draft, updatedAt: new Date().toISOString() });
}

export function readBookingDraft() {
  return readLocal('bookingDraft', null);
}

export function clearBookingDraft() {
  clearLocal('bookingDraft');
}

export function saveLastBooking(booking) {
  return writeLocal('lastBooking', { ...booking, updatedAt: new Date().toISOString() });
}

export function readLastBooking() {
  return readLocal('lastBooking', null);
}

export function savePortalSignal(key, value) {
  return writeLocal(`portal.${key}`, { value, updatedAt: new Date().toISOString() });
}
