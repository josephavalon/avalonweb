// Main-URL CBD suppression.
//
// CBD IV is retained only as backend compatibility data for historical orders.
// It must not render on any customer-facing surface or resolve as a public page.
//
// This is a build-wide constant, not a host gate. Two reasons:
//
//  1. scripts/build-seo-html.mjs runs in Node at build time and cannot see
//     window.location, so a host gate could never drop CBD from the prerendered
//     HTML or sitemap.xml, so scripts/build-seo-html.mjs mirrors this permanent
//     suppression when it creates route files.
//  2. The host lists in src/lib/frontDoor.js and CareAcuityForward.jsx are
//     load-bearing for PHI scope and asserted byte-identical against
//     api/_lib/pre-api-guard.js by scripts/front-door-qa.mjs. Marketing
//     visibility must not ride on a HIPAA-scope gate.
//
// GOTCHA: ?care=1 / ?frontdoor=1 are unrelated runtime host gates. CBD is
// suppressed in every local and hosted build. To preview the result locally:
//
//     npm run build && node scripts/preview-server.mjs
export const CBD_HIDDEN = true;

// Protocol keys treated as CBD. Kept as a set so a future 2nd cannabinoid
// protocol is a one-line change rather than a grep-and-pray.
export const CBD_PROTOCOL_KEYS = new Set(['cbd']);

export function isCbdProtocolKey(key) {
  return CBD_PROTOCOL_KEYS.has(String(key || '').trim().toLowerCase());
}

// Route prefixes that serve CBD content. Prefix matching is deliberate:
// PRODUCT_SLUG_ALIASES in src/data/catalog/products-by-category.js means each
// product answers to two slugs (cbd-iv-33mg AND cbd-33mg), so an exact slug
// list would leak the aliases.
const CBD_ROUTE_PREFIXES = [
  '/services/cbd',
  '/therapies/cbd',
  '/products/cbd',
  '/cbd-iv-therapy-bay-area',
];

// Matches the four noindex CBD education articles under /learn without having
// to restate their slugs (seoArchitecture.js owns those).
const CBD_LEARN_PATTERN = /^\/learn\/[a-z0-9-]*cbd/i;

export function isCbdRoutePath(path = '') {
  const p = String(path || '').trim().toLowerCase();
  if (!p) return false;
  if (CBD_LEARN_PATTERN.test(p)) return true;
  return CBD_ROUTE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export default CBD_HIDDEN;
