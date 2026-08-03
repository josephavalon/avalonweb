// Front-door lockdown QA.
//
// snooches.avalonvitality.co is the PHI-free front door: a static brochure plus
// a Cognito-hosted intake iframe. Zero patient identity may touch Avalon's DOM,
// Avalon's analytics, or Avalon's Supabase from that host. Several independent
// mechanisms hold that line, and every one of them is a one-line edit away from
// silently disappearing:
//
//   * the sealed iframe (a "temporary" native input would re-open PHI capture)
//   * the host list (adding the apex would take the WHOLE site down the gate)
//   * the client route gate + the server route gate (need both, see below)
//   * the two mutually-exclusive CSP blocks (a merged block would hand
//     cognitoforms.com script rights on every host)
//   * PHI-free analytics (a path with a query string is a health interest)
//
// This script is the tripwire for all of them. It is wired two ways on purpose:
// `npm run test:front-door` for a fast local loop, and checkFrontDoorLockdown()
// inside scripts/launch-blocker-qa.mjs so the launch gate cannot pass without
// it. See docs/COGNITO_FRONT_DOOR.md for the architecture record.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['src', 'app-modules'];
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);

const FRONT_DOOR_HOST = 'snooches.avalonvitality.co';

// Hosts that must NEVER appear in either front-door host list. The apex and www
// run the full legacy funnel; listing them here would 404-by-redirect the real
// business into /start.
const FORBIDDEN_HOSTS = ['avalonvitality.co', 'www.avalonvitality.co'];

// Routes that mount a PHI-collecting funnel and therefore must be wrapped in
// <FrontDoorRedirect> in src/App.jsx. Hardcoded deliberately: deriving this
// from the file would make the check assert only that App.jsx equals itself.
const GATED_ROUTES = [
  '/custom',
  '/book',
  '/booking/confirmation',
  '/checkout',
  '/checkout/success',
  '/signup',
  '/order',
  '/gift',
  '/review',
  // The account surface — every panel calls a server-gated api/me/* route.
  // There is no top-level /account route; /members/account is the canonical
  // path (/account/new-password is a password-reset landing, not PHI).
  '/members/account',
];

// Handlers that write patient identity / appointment / payment data and already
// call blockFrontDoorPhiRoute(). Snapshotted at authoring time so this is a
// REGRESSION tripwire: a handler may be added to the list, never removed from
// it. Deriving the list by grep would make the assertion vacuous.
const PHI_WRITING_HANDLERS = [
  'api/acuity-book.js',
  'api/charge-balance.js',
  'api/checkout/verify.js',
  'api/create-checkout-session.js',
  'api/events/apply.js',
  'api/events/checkout.js',
  'api/events/kiosk.js',
  'api/events/organizer.js',
  'api/gift-cards/purchase.js',
  'api/gift-cards/redeem.js',
  'api/invite/accept.js',
  'api/manual-booking.js',
  'api/me/account/delete-request.js',
  'api/me/billing-portal.js',
  'api/me/conversations/create.js',
  'api/me/documents/sign.js',
  'api/me/pay-balance.js',
  'api/me/payment-methods.js',
  'api/me/profile.js',
  'api/me/refund-request.js',
  'api/me/subscription/cancel.js',
  'api/me/subscription/change.js',
  'api/me/subscription/pause.js',
  'api/reviews/submit.js',
  // Tickets carry name + email + free-text message and INSERT into Supabase
  // support_tickets. Gated 2026-07-30.
  'api/support.js',
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(abs));
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(abs);
  }
  return files;
}

function read(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8').catch(() => null);
}

// Pull the quoted string entries out of a `NAME = new Set([ ... ])` literal.
// Returns null when the declaration is not found at all.
function hostSetEntries(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*new Set\\(\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return null;
  return [...match[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
}

// The `element={...}` source for a given <Route path="...">, paren/brace
// balanced so nested wrappers are captured whole.
function routeElementSource(appSource, routePath) {
  const routeIndex = appSource.indexOf(`<Route path="${routePath}"`);
  if (routeIndex === -1) return null;
  const elementIndex = appSource.indexOf('element={', routeIndex);
  if (elementIndex === -1) return null;
  let depth = 0;
  for (let i = elementIndex + 'element='.length; i < appSource.length; i += 1) {
    const ch = appSource[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return appSource.slice(elementIndex, i + 1);
    }
  }
  return null;
}

function cspDirective(value, name) {
  for (const part of String(value).split(';')) {
    const trimmed = part.trim();
    if (trimmed === name || trimmed.startsWith(`${name} `)) return trimmed;
  }
  return '';
}

function matchesHostCondition(conditions) {
  return Array.isArray(conditions)
    && conditions.some((c) => c?.type === 'host' && c?.value === FRONT_DOOR_HOST);
}

// --- Checks ------------------------------------------------------------------

// 1. The embed is Cognito's seamless script and nothing of our own.
//
// This assertion was inverted on 2026-07-31. It used to require a sealed
// cross-origin iframe. The user chose design fidelity over origin isolation
// (see the header of CognitoFormEmbed.jsx), so the fields now live in Avalon's
// DOM by design and an iframe check would fail forever.
//
// The invariant that survives, and the one actually worth guarding: only
// Cognito's script may create fields. The moment this component renders an
// <input> of its own, patient keystrokes are being captured by Avalon code
// rather than Cognito's, and the values can be posted anywhere.
async function checkSeamlessEmbed(failures) {
  const rel = 'src/components/forms/CognitoFormEmbed.jsx';
  const source = await read(rel);
  if (source === null) {
    failures.push(`${rel}: missing — the Cognito embed is the only intake surface`);
    return;
  }
  const nativeField = source.match(/<(input|textarea|select)\b/i);
  if (nativeField) {
    failures.push(`${rel}: renders a native <${nativeField[1]}> — only Cognito's script may create intake fields`);
  }
  for (const forbidden of ['full_name', 'mobile_number', 'data-cognito-placeholder']) {
    if (source.includes(forbidden)) {
      failures.push(`${rel}: contains "${forbidden}" — a hand-rolled name/phone form would post PHI wherever we point it`);
    }
  }
  // Check the CODE, not the prose. This file's header comment explains the
  // seamless decision at length, so a plain source.includes() stayed true even
  // with the real script URL renamed — caught by break-testing, not review.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const required of ['/f/seamless.js', 'data-key', 'data-form']) {
    if (!code.includes(required)) {
      failures.push(`${rel}: missing "${required}" in executable code — intake must be Cognito's seamless embed`);
    }
  }
  // Fail-closed: a build without config must show a phone number, never a
  // stopgap form of our own.
  if (!source.includes('cognito-unavailable')) {
    failures.push(`${rel}: missing the fail-closed fallback — a misconfigured build must not fall back to collecting PHI itself`);
  }
}

// 2. The gate must stay scoped to the front-door host. If the apex ever lands
//    in either list, every PHI route on the real site redirects to /start.
async function checkHostListScope(failures) {
  const lists = [
    { rel: 'src/lib/frontDoor.js', name: 'FRONT_DOOR_HOSTS' },
    { rel: 'api/_lib/pre-api-guard.js', name: 'FRONT_DOOR_HOSTS' },
  ];
  const seen = [];
  for (const { rel, name } of lists) {
    const source = await read(rel);
    if (source === null) {
      failures.push(`${rel}: missing — the front-door gate has no host list`);
      continue;
    }
    const entries = hostSetEntries(source, name);
    if (!entries) {
      failures.push(`${rel}: could not find a "${name} = new Set([...])" host list`);
      continue;
    }
    if (!entries.includes(FRONT_DOOR_HOST)) {
      failures.push(`${rel}: ${name} does not contain ${FRONT_DOOR_HOST}`);
    }
    for (const forbidden of FORBIDDEN_HOSTS) {
      if (entries.includes(forbidden)) {
        failures.push(`${rel}: ${name} contains "${forbidden}" — the front-door gate must never go global`);
      }
    }
    seen.push({ rel, entries: [...entries].sort().join(',') });
  }
  // The client list and the server list are a deliberate duplicate; drift
  // between them means one half of the gate is silently open.
  if (seen.length === 2 && seen[0].entries !== seen[1].entries) {
    failures.push(`front-door host lists drift: ${seen[0].rel} [${seen[0].entries}] vs ${seen[1].rel} [${seen[1].entries}]`);
  }
}

// 3 + 4. Every PHI route is client-gated, and CareAcuityForward stays outermost
//        so apex/www/care behavior is bit-for-bit unchanged.
async function checkRouteGates(failures) {
  const rel = 'src/App.jsx';
  const source = await read(rel);
  if (source === null) {
    failures.push(`${rel}: missing`);
    return;
  }
  for (const route of GATED_ROUTES) {
    const element = routeElementSource(source, route);
    if (element === null) {
      failures.push(`${rel}: no <Route path="${route}"> with an element prop to gate`);
      continue;
    }
    if (!element.includes('<FrontDoorRedirect')) {
      failures.push(`${rel}: route "${route}" is not wrapped in <FrontDoorRedirect> — it would mount the PHI funnel on the front door`);
      continue;
    }
    const care = element.indexOf('<CareAcuityForward');
    const front = element.indexOf('<FrontDoorRedirect');
    if (care !== -1 && care > front) {
      failures.push(`${rel}: route "${route}" nests <CareAcuityForward> inside <FrontDoorRedirect> — CareAcuityForward must stay OUTERMOST so apex/care behavior is unchanged`);
    }
  }
}

// 5. Two mutually-exclusive CSP blocks. Merging them would grant
//    cognitoforms.com frame rights on every host; moving it to script-src would
//    let vendor JS run inside Avalon's document.
async function checkCspSplit(failures) {
  const rel = 'vercel.json';
  const raw = await read(rel);
  if (raw === null) {
    failures.push(`${rel}: missing`);
    return;
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    failures.push(`${rel}: is not valid JSON (${err.message})`);
    return;
  }

  const blocks = [];
  for (const entry of config.headers || []) {
    for (const header of entry.headers || []) {
      if (header.key === 'Content-Security-Policy') blocks.push({ entry, value: header.value });
    }
  }

  if (blocks.length !== 2) {
    failures.push(`${rel}: expected exactly 2 Content-Security-Policy header blocks (one has-host, one missing-host), found ${blocks.length}`);
    return;
  }

  const snoochesBlock = blocks.find((b) => matchesHostCondition(b.entry.has));
  const otherBlock = blocks.find((b) => matchesHostCondition(b.entry.missing));

  if (!snoochesBlock) {
    failures.push(`${rel}: no CSP block keyed on has host=${FRONT_DOOR_HOST}`);
  }
  if (!otherBlock) {
    failures.push(`${rel}: no CSP block keyed on missing host=${FRONT_DOOR_HOST} — without it every other host loses its CSP entirely`);
  }
  if (!snoochesBlock || !otherBlock || snoochesBlock === otherBlock) return;

  // The seamless embed executes Cognito's script in our document and XHRs back
  // to them on submit, so the front-door host needs script-src and connect-src
  // as well. Inverted 2026-07-31 alongside the embed switch.
  for (const directive of ['script-src', 'connect-src']) {
    if (!cspDirective(snoochesBlock.value, directive).includes('https://www.cognitoforms.com')) {
      failures.push(`${rel}: front-door CSP ${directive} is missing https://www.cognitoforms.com — the seamless embed would be blocked`);
    }
  }

  // Every other host stays clean. This is the tripwire that stops the grant
  // spreading to the apex along with a careless copy-paste.
  for (const directive of ['script-src', 'connect-src', 'frame-src']) {
    if (cspDirective(otherBlock.value, directive).includes('cognitoforms.com')) {
      failures.push(`${rel}: default CSP ${directive} allows cognitoforms.com — only the front-door host may grant it`);
    }
  }

  for (const [label, block] of [['front-door', snoochesBlock], ['default', otherBlock]]) {
    const scriptSrc = cspDirective(block.value, 'script-src');
    if (scriptSrc.includes("'unsafe-inline'")) {
      failures.push(`${rel}: ${label} CSP script-src contains 'unsafe-inline'`);
    }
    if (!scriptSrc.includes('sha256-')) {
      failures.push(`${rel}: ${label} CSP script-src is missing the JSON-LD sha256- hash`);
    }
  }
}

// 6. A page path with its query string attached is a health interest
//    (/protocols?therapy=NAD). Neither the caller nor the analytics layer may
//    be the only line of defense.
async function checkPageViewPathIsBare(failures) {
  const appRel = 'src/App.jsx';
  const appSource = await read(appRel);
  if (appSource === null) {
    failures.push(`${appRel}: missing`);
  } else if (appSource.includes('${pathname}${search}')) {
    failures.push(`${appRel}: builds \`\${pathname}\${search}\` — page views must carry the bare pathname, never the query string`);
  }

  const analyticsRel = 'src/lib/analytics.js';
  const analytics = await read(analyticsRel);
  if (analytics === null) {
    failures.push(`${analyticsRel}: missing`);
    return;
  }
  const stripper = analytics.match(/function pathOnly\([\s\S]*?\n\}/);
  if (!stripper || !stripper[0].includes("split('?')") || !stripper[0].includes("split('#')")) {
    failures.push(`${analyticsRel}: pathOnly() must strip both the query string and the hash`);
  }
  const fn = analytics.match(/export function trackPageView\([\s\S]*?\n\}/);
  if (!fn) {
    failures.push(`${analyticsRel}: trackPageView() not found`);
  } else if (!fn[0].includes('pathOnly(path)')) {
    failures.push(`${analyticsRel}: trackPageView() must pass its path through pathOnly() before emitting it`);
  }
}

// 7. No free-form event names. An ad-hoc track('nad_1000_for_jane') is exactly
//    how an identifier reaches an analytics destination with no BAA.
async function checkAnalyticsEventTaxonomy(failures) {
  const analyticsRel = 'src/lib/analytics.js';
  const analytics = await read(analyticsRel);
  if (analytics === null) {
    failures.push(`${analyticsRel}: missing`);
    return;
  }
  const block = analytics.match(/ANALYTICS_EVENTS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\)/);
  if (!block) {
    failures.push(`${analyticsRel}: ANALYTICS_EVENTS = Object.freeze({...}) not found`);
    return;
  }
  const known = new Set([...block[1].matchAll(/:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));

  for (const dir of SCAN_DIRS) {
    for (const file of await walk(path.join(ROOT, dir))) {
      const text = await fs.readFile(file, 'utf8');
      const rel = path.relative(ROOT, file);
      for (const match of text.matchAll(/\btrack\(\s*(['"])([^'"]+)\1/g)) {
        if (known.has(match[2])) continue;
        const line = text.slice(0, match.index).split(/\r?\n/).length;
        failures.push(`${rel}:${line} track('${match[2]}') is not in ANALYTICS_EVENTS — add it to the taxonomy instead of inventing an event name`);
      }
    }
  }
}

// 8. The /start landing page must not own name/phone state again. Those exact
//    handlers are what the Cognito iframe replaced.
async function checkLandingHasNoIdentityCapture(failures) {
  const rel = 'app-modules/pages/NurseDelivery.jsx';
  const source = await read(rel);
  if (source === null) {
    failures.push(`${rel}: missing`);
    return;
  }
  for (const forbidden of ['onNameChange', 'onPhoneChange', 'landing-name', 'landing-phone']) {
    if (source.includes(forbidden)) {
      failures.push(`${rel}: contains "${forbidden}" — /start must not capture patient identity outside the Cognito iframe`);
    }
  }
}

// 9. The server half of the gate. Client redirects are cosmetic: anyone can
//    POST straight at these handlers on the front-door host.
async function checkServerGateCoverage(failures) {
  for (const rel of PHI_WRITING_HANDLERS) {
    const source = await read(rel);
    if (source === null) {
      failures.push(`${rel}: listed as a PHI-writing handler but the file is missing — update PHI_WRITING_HANDLERS if it moved`);
      continue;
    }
    // Must be a CALL, not just the import. Deleting the guard line while
    // leaving `import { blockFrontDoorPhiRoute }` in place is the exact shape
    // a careless refactor takes, and a substring check would sleep through it.
    if (!/blockFrontDoorPhiRoute\s*\(\s*req\s*,\s*res/.test(source)) {
      failures.push(`${rel}: lost its blockFrontDoorPhiRoute(req, res, ...) call — PHI can be POSTed to it on ${FRONT_DOOR_HOST}`);
    }
  }
}

export async function runFrontDoorChecks() {
  const failures = [];
  await checkSeamlessEmbed(failures);
  await checkHostListScope(failures);
  await checkRouteGates(failures);
  await checkCspSplit(failures);
  await checkPageViewPathIsBare(failures);
  await checkAnalyticsEventTaxonomy(failures);
  await checkLandingHasNoIdentityCapture(failures);
  await checkServerGateCoverage(failures);
  return failures;
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const failures = await runFrontDoorChecks();
  if (failures.length) {
    console.error('Front-door QA failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `Front-door QA passed. ${GATED_ROUTES.length} routes client-gated, `
    + `${PHI_WRITING_HANDLERS.length} handlers server-gated, CSP split intact.`,
  );
}
