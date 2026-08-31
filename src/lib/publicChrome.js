const PRIVATE_SURFACE_PREFIXES = [
  '/account',
  '/admin',
  '/invoice',
  '/kiosk',
  '/login',
  '/members',
  '/nurse-login',
  '/organizer',
  '/provider',
  '/signup',
  '/forgot',
];

function matchesPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Consumer chrome (cookie notice + concierge) belongs on every public-facing
 * route, including booking, checkout, product, and legal pages. Operational
 * and authenticated surfaces intentionally stay clear of marketing widgets.
 */
export function isPublicChromeRoute(pathname = '/') {
  const normalized = String(pathname || '/').split('?')[0].split('#')[0] || '/';
  if (normalized.includes('/kiosk/')) return false;
  return !PRIVATE_SURFACE_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix));
}

