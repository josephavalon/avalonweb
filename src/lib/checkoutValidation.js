export function normalizeCheckoutEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isValidCheckoutEmail(value = '') {
  const email = normalizeCheckoutEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function checkoutPhoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCheckoutPhone(value = '') {
  const digits = checkoutPhoneDigits(value);
  return digits.length >= 10 && digits.length <= 15;
}

export function parseCheckoutDob(value = '') {
  const text = String(value || '').trim();
  let year;
  let month;
  let day;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    [year, month, day] = text.split('-').map(Number);
  } else {
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    month = Number(match[1]);
    day = Number(match[2]);
    year = Number(match[3]);
  }

  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isAdultCheckoutDob(value = '', now = new Date()) {
  const dob = parseCheckoutDob(value);
  if (!dob || dob > now) return false;
  const eighteenthBirthday = new Date(dob);
  eighteenthBirthday.setFullYear(eighteenthBirthday.getFullYear() + 18);
  return eighteenthBirthday <= now;
}

export function hasValidCheckoutContact(contact = {}) {
  return Boolean(
    String(contact.firstName || '').trim() &&
    isValidCheckoutEmail(contact.email) &&
    isValidCheckoutPhone(contact.phone)
  );
}
