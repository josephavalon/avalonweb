// Main-URL CBD suppression.
//
// CBD IV is not abandoned work — seoArchitecture.js says the category is "held
// from public indexing until Avalon confirms clinical approval and legal
// review," and beta is where that review continues. So the apex hides it; beta
// keeps it reachable.
//
// This is a BUILD flag, not a host gate. Two reasons:
//
//  1. scripts/build-seo-html.mjs runs in Node at build time and cannot see
//     window.location, so a host gate could never drop CBD from the prerendered
//     HTML or sitemap.xml. Each Vercel project runs its own `npm run build` with
//     its own env, so one flag governs the SPA and the prerender together. Same
//     pattern as VITE_AVALON_OS_BETA (src/App.jsx + build-seo-html.mjs).
//  2. The host lists in src/lib/frontDoor.js and CareAcuityForward.jsx are
//     load-bearing for PHI scope and asserted byte-identical against
//     api/_lib/pre-api-guard.js by scripts/front-door-qa.mjs. Marketing
//     visibility must not ride on a HIPAA-scope gate.
//
// GOTCHA: ?care=1 / ?frontdoor=1 CANNOT preview this. Those arm runtime host
// gates; this is baked in at build time. To preview locally:
//
//     VITE_HIDE_CBD=true npm run build && node scripts/preview-server.mjs
//
// Set VITE_HIDE_CBD=true on the `avalonweb` Vercel project only.
export const CBD_HIDDEN =
  String(import.meta.env?.VITE_HIDE_CBD || '').trim().toLowerCase() === 'true';

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
