const PREFIX = 'av.local.';

export function readLocal(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('av.local.change', {
      detail: { key, value, updatedAt: new Date().toISOString() },
    }));
  } catch {
    // Local persistence is progressive enhancement only.
  }
  return value;
}

export function clearLocal(key) {
  try {
    window.localStorage.removeItem(`${PREFIX}${key}`);
  } catch {}
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
