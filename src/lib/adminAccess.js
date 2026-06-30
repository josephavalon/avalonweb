// Single source of truth for the two-tier admin access model.
//   admin → live launch console, plus preview-only engineering surfaces when enabled.
//   staff → live launch console; mutating team actions remain admin-only server-side.
// Used by RequireAuth route guards (via allowedRolesFor), the AdminShell nav
// filter, and the access tests. Keep this in sync with the route table in
// App.jsx and the NAV array in AdminShell.jsx.

// Sections the `staff` tier may open when the route is otherwise visible.
// Preview-only routes are still hidden unless VITE_ADMIN_PREVIEW=1.
export const STAFF_ROUTES = Object.freeze([
  '/admin', // dashboard
  '/admin/clients', // patient records (live, derived from bookings)
  '/admin/memberships', // master list of every active plan-holder
  '/admin/inbox', // two-way client message threads
  '/admin/messages', // PHI-free client texting (Quo)
  '/admin/crm', // preview-only patients/customer surface
  '/admin/bookings', // billing — ready to collect
  '/admin/finance', // billing — payments
  '/admin/inventory',
  '/admin/team',
  '/admin/email-templates', // editable customer email templates
  '/admin/promo-codes', // Stripe-of-record promo code management
  '/admin/shift-marketplace', // read-only nurse shift offer board (preview mode)
  '/admin/refunds', // member refund requests — Stripe-issued
  '/admin/deletion-requests', // member account-deletion requests (anonymize)
  '/admin/expiring-credits', // members with visit credits about to expire
  '/admin/reviews', // post-visit NPS + review moderation
  '/admin/reconciliation', // renewals / acuity sync / payment failures
  '/admin/soon', // coming-soon placeholders (Inventory/Events/Clinical/GFE/Tools/Settings)
]);

export const ALL_TEAM_ROLES = Object.freeze(['admin', 'staff']);

export const LIVE_ADMIN_ROUTES = Object.freeze([
  '/admin',
  '/admin/clients',
  '/admin/memberships',
  '/admin/inbox',
  '/admin/messages',
  '/admin/bookings',
  '/admin/finance',
  '/admin/inventory',
  '/admin/team',
  '/admin/gfe', // GFE policy toggles (admin-only)
  '/admin/email-templates', // editable customer email templates
  '/admin/promo-codes', // Stripe-of-record promo code management
  '/admin/shift-marketplace', // read-only nurse shift offer board
  '/admin/refunds', // member refund requests
  '/admin/deletion-requests', // member account-deletion requests
  '/admin/expiring-credits', // members with credits about to expire
  '/admin/reviews', // post-visit NPS + review moderation
  '/admin/reconciliation', // renewals / acuity sync / payment failures
  '/admin/soon', // coming-soon placeholders
]);

function normalizeAdminPath(path = '') {
  const value = String(path || '').split(/[?#]/)[0] || '/admin';
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function adminPreviewEnabled() {
  return import.meta.env?.VITE_ADMIN_PREVIEW === '1';
}

// Match a path against an allow-list. A path counts as allowed if it equals an
// entry exactly OR begins with one followed by `/` (so `/admin/clients/abc`
// inherits permission from `/admin/clients`).
function matchesAllowList(path, allowList) {
  if (allowList.includes(path)) return true;
  return allowList.some((entry) => path.startsWith(`${entry}/`));
}

/** Can a given role open a given admin path? */
export function canAccessAdminRoute(role, path) {
  const normalized = normalizeAdminPath(path);
  if (!adminPreviewEnabled() && !matchesAllowList(normalized, LIVE_ADMIN_ROUTES)) return false;
  if (role === 'admin') return true;
  if (role === 'staff') return matchesAllowList(normalized, STAFF_ROUTES);
  return false;
}

/** allowedRoles array for a route guard: staff-allowed routes include staff. */
export function allowedRolesForRoute(path) {
  return matchesAllowList(normalizeAdminPath(path), STAFF_ROUTES) ? ['admin', 'staff'] : ['admin'];
}
