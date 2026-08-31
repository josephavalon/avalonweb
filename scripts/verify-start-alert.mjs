#!/usr/bin/env node
/**
 * Drill the /start admin SMS alert endpoint against a deployed host.
 *
 *   API_BASE_URL=https://beta.avalonvitality.co node scripts/verify-start-alert.mjs
 *
 * ── WHY THIS REFUSES TO RUN AGAINST PRODUCTION WITHOUT --live ───────────────
 * Every passing run of the happy path makes real phones buzz. Defaulting to
 * beta and demanding an explicit flag for anything else means a careless
 * `npm run verify:start-alert` cannot page the founders at 2am.
 *
 * What it proves:
 *   1. an empty POST is accepted            (the real path)
 *   2. replaying the nonce sends nothing    (one submission = one text)
 *   3. a POST carrying a body is refused    (PHI cannot enter, structurally)
 *   4. GET is rejected
 *   5. the burst limit engages              (Quo spend is bounded)
 */
const DEFAULT_BASE = 'https://beta.avalonvitality.co';
const apiBase = String(process.env.API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
const live = process.argv.includes('--live');

const PROD_HOSTS = new Set(['avalonvitality.co', 'www.avalonvitality.co']);
let host = '';
try {
  host = new URL(apiBase).hostname.toLowerCase();
} catch {
  console.error(`FAIL: API_BASE_URL is not a URL: ${apiBase}`);
  process.exit(1);
}
if (PROD_HOSTS.has(host) && !live) {
  console.error(
    `REFUSING to drill ${host} without --live.\n`
    + 'A passing run texts every number in ADMIN_ALERT_PHONES. Re-run with --live if you meant it.',
  );
  process.exit(1);
}

let failed = false;
const fail = (msg) => { failed = true; console.error(`FAIL: ${msg}`); };
const pass = (msg) => console.log(`  ok  ${msg}`);

const ENDPOINT = '/api/notify/intake-alert';

async function call({ method = 'POST', nonce, body, source = 'start' } = {}) {
  const headers = {};
  if (nonce) headers['x-avalon-alert-nonce'] = nonce;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${apiBase}${ENDPOINT}?source=${source}`, {
    method,
    headers,
    ...(body ? { body } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

const nonce = `${Date.now().toString(16)}-${Math.floor(Math.random() * 1e16).toString(16)}`;

console.log(`Drilling ${apiBase}${ENDPOINT}\n`);

// 1. the real path
const first = await call({ nonce });
if (first.status !== 200 || first.json?.ok !== true) {
  fail(`empty POST should be 200 ok; got ${first.status} ${JSON.stringify(first.json)}`);
} else if (first.json.code === 'sms_not_configured') {
  fail('QUO_API_KEY / QUO_FROM_NUMBER are not set on this deployment — no alert can ever send');
} else if (first.json.code === 'no_admin_phones') {
  fail('ADMIN_ALERT_PHONES is unset or has no valid E.164 entries on this deployment');
} else if (!(first.json.sent > 0)) {
  fail(`accepted but sent 0 texts: ${JSON.stringify(first.json)}`);
} else {
  pass(`empty POST accepted, sent=${first.json.sent} skipped=${first.json.skipped ?? 0}`);
}

// 2. one submission must equal one text
const replay = await call({ nonce });
if (replay.status !== 200 || replay.json?.deduped !== true || replay.json?.sent !== 0) {
  fail(`replayed nonce should dedupe to sent:0; got ${replay.status} ${JSON.stringify(replay.json)}`);
} else {
  pass('replayed nonce deduped — one submission is one text');
}

// 3. the structural no-PHI guarantee
const withBody = await call({ body: JSON.stringify({ name: 'Test Person', phone: '+14155550100' }) });
if (withBody.status !== 400 || withBody.json?.code !== 'unexpected_body') {
  fail(`POST with a body must be 400 unexpected_body; got ${withBody.status} ${JSON.stringify(withBody.json)}`);
} else {
  pass('POST carrying a body refused — PHI cannot enter this endpoint');
}

// 4. method guard
const get = await call({ method: 'GET' });
if (get.status !== 405) fail(`GET should be 405; got ${get.status}`);
else pass('GET rejected');

// 5. the spend cap
let sawLimit = false;
for (let i = 0; i < 12 && !sawLimit; i += 1) {
  const res = await call({ nonce: `${nonce}-burst-${i}` });
  if (res.status === 429) sawLimit = true;
}
if (!sawLimit) {
  fail('12 rapid calls never hit 429 — the rate limit is not engaging. If KV is unset, '
     + 'each Vercel instance has its own counter and the global cap is not global.');
} else {
  pass('burst limit engaged');
}

if (failed) {
  console.error('\nstart-alert verification FAILED.');
  process.exit(1);
}
console.log('\nPASS: start-alert verified (alert sends, dedupes, refuses bodies, rate-limits).');
