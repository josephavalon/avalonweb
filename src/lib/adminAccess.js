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
  '/admin/inbox', // two-way client message threads
  '/admin/messages', // PHI-free client texting (Quo)
  '/admin/crm', // preview-only patients/customer surface
  '/admin/bookings', // billing — ready to collect
  '/admin/finance', // billing — payments
  '/admin/inventory',
  '/admin/team',
  '/admin/soon', // coming-soon placeholders (Inventory/Events/Clinical/GFE/Tools/Settings)
]);

export const ALL_TEAM_ROLES = Object.freeze(['admin', 'staff']);

export const LIVE_ADMIN_ROUTES = Object.freeze([
  '/admin',
  '/admin/clients',
  '/admin/inbox',
  '/admin/messages',
  '/admin/bookings',
  '/admin/finance',
  '/admin/inventory',
  '/admin/team',
  '/admin/soon', // coming-soon placeholders
]);

function normalizeAdminPath(path = '') {
  const value = String(path || '').split(/[?#]/)[0] || '/admin';
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function adminPreviewEnabled() {
  return import.meta.env?.VITE_ADMIN_PREVIEW === '1';
}

/** Can a given role open a given admin path? */
export function canAccessAdminRoute(role, path) {
  const normalized = normalizeAdminPath(path);
  if (!adminPreviewEnabled() && !LIVE_ADMIN_ROUTES.includes(normalized)) return false;
  if (role === 'admin') return true;
  if (role === 'staff') return STAFF_ROUTES.includes(normalized);
  return false;
}

/** allowedRoles array for a route guard: staff-allowed routes include staff. */
export function allowedRolesForRoute(path) {
  return STAFF_ROUTES.includes(normalizeAdminPath(path)) ? ['admin', 'staff'] : ['admin'];
}
