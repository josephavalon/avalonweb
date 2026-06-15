// Single source of truth for the two-tier admin access model.
//   admin → everything, including team management.
//   staff → customer / scheduling / billing only.
// Used by RequireAuth route guards (via allowedRolesFor), the AdminShell nav
// filter, and the access tests. Keep this in sync with the route table in
// App.jsx and the NAV array in AdminShell.jsx.

// Sections the `staff` tier may open. `admin` is not listed because admins can
// open every admin route.
export const STAFF_ROUTES = Object.freeze([
  '/admin', // dashboard
  '/admin/crm', // customers
  '/admin/bookings', // billing — ready to collect
  '/admin/finance', // billing — payments
]);

export const ALL_TEAM_ROLES = Object.freeze(['admin', 'staff']);

/** Can a given role open a given admin path? */
export function canAccessAdminRoute(role, path) {
  if (role === 'admin') return true;
  if (role === 'staff') return STAFF_ROUTES.includes(path);
  return false;
}

/** allowedRoles array for a route guard: staff-allowed routes include staff. */
export function allowedRolesForRoute(path) {
  return STAFF_ROUTES.includes(path) ? ['admin', 'staff'] : ['admin'];
}
