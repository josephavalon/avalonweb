// CBD visibility QA.
//
// CBD IV is permanently suppressed from every customer-facing build. The
// catalog retains compatibility data for historical orders, so each public
// read site must still apply the shared CBD_HIDDEN gate.
//
// This is the tripwire. Two classes of check:
//
//   * SOURCE checks (always run) — the gates are still wired at each read site,
//     and the Node-side copy of the route matcher in build-seo-html.mjs has not
//     drifted from the browser-side one in src/lib/cbdVisibility.js.
//   * BUILD checks (when dist/ exists) — the prerendered HTML and
//     sitemap.xml actually came out clean.
//
// The drift check matters most. build-seo-html.mjs cannot import
// cbdVisibility.js (that module reads import.meta.env, which Node cannot
// evaluate), so the prefix list is deliberately duplicated. Duplicated
// constants are how the front-door host lists nearly went half-open; the same
// assertion pattern applies here.
//
// Wired as `npm run test:cbd` and from scripts/launch-blocker-qa.mjs.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), 'utf8');
}

async function exists(rel) {
  try {
    await fs.access(path.join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

// Every read site that must consult CBD_HIDDEN. If someone deletes a gate, the
// category can reappear with no other signal.
const GATED_READ_SITES = [
  ['src/pages/ConsumerMenu.jsx', 'the /protocols IV CBD section (THE ROUTED MENU)'],
  ['app-modules/pages/Menu.jsx', 'the legacy unrouted menu, kept in sync in case it is revived'],
  ['app-modules/source/components/landing/Navbar.jsx', 'the navbar IV CBD tile'],
  ['app-modules/source/pages/Ingredients.jsx', 'the /ingredients CBD row'],
  ['src/pages/ConsumerProduct.jsx', '/products/cbd/* (THE ROUTED PRODUCT PAGE)'],
  ['app-modules/pages/products/ProductDetail.jsx', 'the legacy unrouted product page'],
  ['src/pages/therapies/ProtocolPage.jsx', '/therapies/cbd'],
  ['src/pages/LearnPage.jsx', 'the /learn CBD guides'],
  ['src/App.jsx', '/services/cbd, /events/cannabis-ce and the CBD service pillar'],
  ['app-modules/pages/BookNow.jsx', 'the active /book catalog and custom base picker'],
  ['app-modules/pages/NurseDelivery.jsx', 'therapy and protocol deep links into /nurse-delivery'],
  ['app-modules/pages/CustomProtocol.jsx', 'the /custom treatment builder'],
  ['app-modules/pages/B2B.jsx', 'the /b2b product catalog'],
];

async function checkReadSitesAreGated(failures) {
  for (const [rel, what] of GATED_READ_SITES) {
    const src = await read(rel);
    if (!src.includes('CBD_HIDDEN')) {
      failures.push(`${rel} no longer references CBD_HIDDEN — ${what} is ungated on the apex.`);
    }
  }
}

// The Menu foldout is hardcoded JSX, so filtering PUBLIC_SESSIONS is not enough:
// without this wrapper the section still renders as an empty "IV CBD · 0 IV
// therapies" accordion. This is the single easiest gate to lose in a refactor.
// /protocols renders src/pages/ConsumerMenu.jsx, NOT app-modules/pages/Menu.jsx.
// src/App.jsx aliases the import to a const named `Menu`, so the dead file looks
// like the live one. Gating only Menu.jsx passes every source check and still
// ships IV CBD to the apex — that happened once; this check exists so it cannot
// happen twice.
async function checkRoutedMenuIsGated(failures) {
  const src = await read('src/pages/ConsumerMenu.jsx');
  if (!/CATEGORY_ORDER[\s\S]{0,220}CBD_HIDDEN/.test(src)) {
    failures.push(
      'src/pages/ConsumerMenu.jsx: CATEGORY_ORDER does not filter on CBD_HIDDEN. '
      + 'This is the component actually routed at /protocols.',
    );
  }
  const app = await read('src/App.jsx');
  if (!/const Menu = lazyRoute\(\(\) => import\('\.\/pages\/ConsumerMenu'\)\)/.test(app)) {
    failures.push(
      'src/App.jsx no longer maps the /protocols route to ./pages/ConsumerMenu. '
      + 'Re-check which component serves /protocols and update this QA script.',
    );
  }
}

async function checkMenuFoldoutIsWrapped(failures) {
  const src = await read('app-modules/pages/Menu.jsx');
  if (!/\{!CBD_HIDDEN && \(\s*<div id="iv-cbd"/.test(src)) {
    failures.push(
      'app-modules/pages/Menu.jsx: the id="iv-cbd" Foldout is not wrapped in {!CBD_HIDDEN && (...)}. '
      + 'Filtering HIDDEN_PUBLIC_PROTOCOL_KEYS alone leaves an empty IV CBD accordion rendered.',
    );
  }
}

// ProductDetail returned HTTP 200 with the default "index, follow" on a miss,
// i.e. a soft 404 Google keeps indexed for weeks. That is why the redirect in
// vercel.json exists; this keeps the page-level half honest too.
// src/App.jsx renders <ProductDetail/> from ./pages/ConsumerProduct — the
// app-modules file of that name is not routed. Check both so neither the live
// page nor a future revival of the legacy one regresses.
async function checkProductDetailNoindexesMisses(failures) {
  const NEEDLE = "robots: match ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'";
  for (const rel of ['src/pages/ConsumerProduct.jsx', 'app-modules/pages/products/ProductDetail.jsx']) {
    const src = await read(rel);
    if (!src.includes(NEEDLE)) {
      failures.push(
        `${rel}: the miss branch no longer sets robots noindex. `
        + 'useSeo defaults to "index, follow", which makes every unknown product URL a soft 404.',
      );
    }
  }
  const app = await read('src/App.jsx');
  if (!/const ProductDetail = lazyRoute\(\(\) => import\('\.\/pages\/ConsumerProduct'\)\)/.test(app)) {
    failures.push(
      'src/App.jsx no longer maps <ProductDetail/> to ./pages/ConsumerProduct. '
      + 'Re-check which component serves /products/:category/:slug and update this QA script.',
    );
  }
}

// Every CBD path must 301 at the Vercel edge on the apex, not just the five
// indexed product URLs.
//
// Why all of them: with VITE_HIDE_CBD=true these routes have no prerendered
// HTML any more, and vercel.json rewrites services/.*, therapies/.*, learn/.*
// and events/.* to /index.html — which ships `robots: index, follow`. React
// corrects it client-side, but a crawler that does not run JS sees an
// indexable 200. The edge redirect runs before rewrites, so it closes that gap.
//
// Prefix match on products, not a slug list: PRODUCT_SLUG_ALIASES gives each
// product two URLs. This cannot be verified locally — scripts/preview-server.mjs
// does not read vercel.json — so the config assertion is the only guard until
// the post-deploy curl.
const REQUIRED_REDIRECT_SOURCES = [
  '/products/cbd/:path*',
  '/services/cbd',
  '/therapies/cbd',
  '/cbd-iv-therapy-bay-area',
  '/events/cannabis-ce',
  '/learn/:slug(.*cbd.*)',
];
const APEX_HOSTS = ['avalonvitality.co', 'www.avalonvitality.co'];

async function checkVercelRedirect(failures) {
  const raw = await read('vercel.json');
  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    failures.push(`vercel.json is not valid JSON: ${error.message}`);
    return;
  }
  const redirects = config.redirects || [];
  for (const source of REQUIRED_REDIRECT_SOURCES) {
    const matching = redirects.filter((r) => r.source === source);
    const hosts = new Set(
      matching.flatMap((r) => (r.has || []).filter((h) => h.type === 'host').map((h) => h.value)),
    );
    for (const host of APEX_HOSTS) {
      if (!hosts.has(host)) {
        failures.push(`vercel.json: no redirect for "${source}" scoped to host ${host}.`);
      }
    }
    for (const r of matching) {
      if (r.permanent !== true) {
        failures.push(`vercel.json: redirect "${r.source}" must be permanent (301) to drop the URL from Google.`);
      }
      if (!(r.has || []).some((h) => h.type === 'host')) {
        failures.push(
          `vercel.json: redirect "${r.source}" is not host-scoped — it would hide CBD on beta too, `
          + 'where the category is still under clinical + legal review.',
        );
      }
    }
  }
}

// Blocking the crawl before Google sees the 301 strands the URLs as "Indexed,
// though blocked by robots.txt" — strictly worse than leaving them crawlable.
async function checkRobotsDoesNotDisallowCbd(failures) {
  const src = await read('api/robots.js');
  if (/Disallow:\s*\/products\/cbd/i.test(src)) {
    failures.push(
      'api/robots.js disallows /products/cbd. That prevents Google from ever seeing the 301 '
      + 'and strands the URLs as "indexed, though blocked". Redirect first; Disallow later or never.',
    );
  }
}

// build-seo-html.mjs runs in Node and cannot import the browser module, so the
// prefix list is duplicated on purpose. Assert it has not drifted.
async function checkRouteMatcherHasNotDrifted(failures) {
  const browser = await read('src/lib/cbdVisibility.js');
  const node = await read('scripts/build-seo-html.mjs');
  if (!/export const CBD_HIDDEN\s*=\s*true/.test(browser)) {
    failures.push('src/lib/cbdVisibility.js: CBD_HIDDEN must remain permanently true.');
  }
  if (!/const HIDE_CBD\s*=\s*true/.test(node)) {
    failures.push('scripts/build-seo-html.mjs: HIDE_CBD must remain permanently true.');
  }
  const extract = (src) => {
    const m = src.match(/CBD_ROUTE_PREFIXES\s*=\s*\[([\s\S]*?)\]/);
    if (!m) return null;
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  };
  const a = extract(browser);
  const b = extract(node);
  if (!a) return failures.push('src/lib/cbdVisibility.js: CBD_ROUTE_PREFIXES not found.');
  if (!b) return failures.push('scripts/build-seo-html.mjs: CBD_ROUTE_PREFIXES copy not found.');
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    failures.push(
      'CBD_ROUTE_PREFIXES drifted between src/lib/cbdVisibility.js and scripts/build-seo-html.mjs. '
      + `Browser: ${JSON.stringify(a)} vs build: ${JSON.stringify(b)}. `
      + 'A prefix in one and not the other hides the route in the SPA but still prerenders it (or vice versa).',
    );
  }
  return undefined;
}

// Validate the generated public surface whenever a build is present.
async function checkBuildOutput(failures) {
  if (!(await exists('dist'))) return;

  if (await exists('dist/sitemap.xml')) {
    const sitemap = await read('dist/sitemap.xml');
    const hits = [...sitemap.matchAll(/<loc>([^<]*cbd[^<]*)<\/loc>/gi)].map((m) => m[1]);
    if (hits.length) {
      failures.push(`dist/sitemap.xml still lists ${hits.length} CBD URL(s): ${hits.join(', ')}`);
    }
  }

  for (const dir of ['dist/products/cbd', 'dist/therapies/cbd', 'dist/services/cbd', 'dist/cbd-iv-therapy-bay-area']) {
    if (await exists(dir)) failures.push(`${dir} was prerendered despite permanent CBD suppression.`);
  }

  if (await exists('dist/learn')) {
    const entries = await fs.readdir(path.join(ROOT, 'dist/learn'));
    const cbd = entries.filter((e) => e.toLowerCase().includes('cbd'));
    if (cbd.length) failures.push(`dist/learn still contains CBD guides: ${cbd.join(', ')}`);
  }
}

async function checkActivePublicCopy(failures) {
  for (const rel of [
    'app-modules/source/components/landing/FAQ.jsx',
    'src/content/avalonConciergeKnowledge.js',
  ]) {
    const src = await read(rel);
    if (/\bcbd\b/i.test(src)) {
      failures.push(`${rel} contains customer-facing CBD copy outside the shared catalog gates.`);
    }
  }
}

// Files under public/ are copied into dist verbatim, so they cannot read the
// build flag — a CBD mention there ships to the apex no matter what
// VITE_HIDE_CBD is set to. Caught this way once already: an unlinked navbar
// design mockup at /nav-previews/bc-combined.html carried an "IV CBD" tile.
async function checkPublicDirHasNoCbd(failures) {
  const offenders = [];
  async function walk(rel) {
    const entries = await fs.readdir(path.join(ROOT, rel), { withFileTypes: true });
    for (const entry of entries) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(child);
      } else if (/\.(html|css|js|json|txt|xml|webmanifest)$/i.test(entry.name)) {
        const body = await fs.readFile(path.join(ROOT, child), 'utf8');
        if (/\bcbd\b/i.test(body)) offenders.push(child);
      }
    }
  }
  await walk('public');
  for (const file of offenders) {
    failures.push(`${file} mentions CBD. Files under public/ are copied verbatim and ignore VITE_HIDE_CBD.`);
  }
}

export async function runCbdVisibilityChecks() {
  const failures = [];
  await checkReadSitesAreGated(failures);
  await checkRoutedMenuIsGated(failures);
  await checkMenuFoldoutIsWrapped(failures);
  await checkProductDetailNoindexesMisses(failures);
  await checkVercelRedirect(failures);
  await checkRobotsDoesNotDisallowCbd(failures);
  await checkRouteMatcherHasNotDrifted(failures);
  await checkActivePublicCopy(failures);
  await checkPublicDirHasNoCbd(failures);
  await checkBuildOutput(failures);
  return failures;
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const failures = await runCbdVisibilityChecks();
  if (failures.length) {
    console.error('CBD visibility QA failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `CBD visibility QA passed. ${GATED_READ_SITES.length} read sites gated, `
    + 'public copy clean, route matcher in sync.',
  );
}
