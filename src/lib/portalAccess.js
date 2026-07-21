const PORTAL_INTENT_KEY = 'av.portalIntent';
// Portal choice is tab-scoped session state, not an authorization grant. Keep
// it for a full workday so periodic Supabase session refreshes do not silently
// push an Admin out of the Customer or Nurse experience they selected.
const PORTAL_INTENT_TTL_MS = 12 * 60 * 60 * 1000;

export const PORTALS = Object.freeze({
  customer: { role: 'client', redirect: '/members/dashboard' },
  nurse: { role: 'nurse', redirect: '/provider/shift' },
  admin: { role: 'admin', redirect: '/admin' },
  organizer: { role: 'promoter', redirect: '/organizer' },
});

const DEFAULT_PORTAL = Object.freeze({
  client: 'customer',
  nurse: 'nurse',
  promoter: 'organizer',
  admin: 'admin',
  staff: 'admin',
});

function normalizePortal(value) {
  const portal = String(value || '').trim().toLowerCase();
  return Object.hasOwn(PORTALS, portal) ? portal : '';
}

function trustedMetadataPortals(authUser) {
  const raw = authUser?.app_metadata?.portal_access;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePortal).filter(Boolean);
}

export function allowedPortalsForUser({ canonicalRole, authUser } = {}) {
  const role = String(canonicalRole || '').trim().toLowerCase();
  const baseline = role === 'admin'
    ? ['customer', 'nurse', 'admin', 'organizer']
    : role === 'staff'
      ? ['admin']
      : role === 'nurse'
        ? ['nurse']
        : role === 'promoter'
          ? ['organizer']
        : ['customer'];

  // app_metadata is written by the auth server. It may narrow or extend a
  // non-admin account, but it can never manufacture Admin access by itself.
  const metadata = trustedMetadataPortals(authUser).filter((portal) => portal !== 'admin' || ['admin', 'staff'].includes(role));
  return [...new Set([...baseline, ...metadata])];
}

export function resolvePortalSession({ canonicalRole, authUser, requestedPortal } = {}) {
  const role = String(canonicalRole || 'client').trim().toLowerCase();
  const allowedPortals = allowedPortalsForUser({ canonicalRole: role, authUser });
  const requested = normalizePortal(requestedPortal);
  const portal = requested && allowedPortals.includes(requested)
    ? requested
    : (DEFAULT_PORTAL[role] || 'customer');
  const config = PORTALS[portal] || PORTALS.customer;
  const effectiveRole = portal === 'admin' && role === 'staff'
    ? 'staff'
    : portal === 'organizer' && role === 'admin'
      ? 'admin'
      : config.role;

  return {
    activePortal: portal,
    portalAccess: allowedPortals,
    role: effectiveRole,
    redirect: config.redirect,
  };
}

export function rememberPortalIntent(portal, email = '') {
  const normalized = normalizePortal(portal);
  if (!normalized || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(PORTAL_INTENT_KEY, JSON.stringify({
      portal: normalized,
      email: String(email || '').trim().toLowerCase(),
      createdAt: Date.now(),
    }));
  } catch { /* private mode — non-fatal */ }
}

export function readPortalIntent(authUser) {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    const raw = sessionStorage.getItem(PORTAL_INTENT_KEY);
    const intent = raw ? JSON.parse(raw) : null;
    if (!intent || Date.now() - Number(intent.createdAt || 0) > PORTAL_INTENT_TTL_MS) {
      sessionStorage.removeItem(PORTAL_INTENT_KEY);
      return '';
    }
    const expectedEmail = String(intent.email || '').trim().toLowerCase();
    const actualEmail = String(authUser?.email || '').trim().toLowerCase();
    if (expectedEmail && actualEmail && expectedEmail !== actualEmail) return '';
    return normalizePortal(intent.portal);
  } catch {
    return '';
  }
}

export function clearPortalIntent() {
  try { sessionStorage.removeItem(PORTAL_INTENT_KEY); } catch { /* ignore */ }
}

// `/signup` is the New Customer entry. An existing Admin should never create a
// second identity there; their trusted cross-portal access opens the customer
// dashboard instead. Other roles keep their normal destination.
export function newCustomerDestinationForUser(user) {
  if (!user) return '';
  const primaryRole = String(user.primaryRole || user.role || '').toLowerCase();
  const portalAccess = Array.isArray(user.portalAccess) ? user.portalAccess : [];
  if (primaryRole === 'admin' && portalAccess.includes('customer')) return PORTALS.customer.redirect;
  return user.redirect || PORTALS.customer.redirect;
}

// Authorization UI follows the canonical identity, not the temporary role used
// to render a Customer or Nurse portal. An Admin remains MFA-gated everywhere.
export function requiresPrivilegedMfa(user) {
  const securityRole = String(user?.primaryRole || user?.role || '').toLowerCase();
  return securityRole === 'admin' || securityRole === 'staff';
}
