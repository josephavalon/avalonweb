import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bdDataReviewComplete, requireBdDataReview } from '../api/_lib/bd-data-review-gate.js';

assert.equal(bdDataReviewComplete({}), false, 'missing readiness flag must fail closed');
assert.equal(bdDataReviewComplete({ AVALON_BD_DATA_REVIEWED: 'false' }), false);
assert.equal(bdDataReviewComplete({ AVALON_BD_DATA_REVIEWED: '1' }), false, 'only explicit true may open the gate');
assert.equal(bdDataReviewComplete({ AVALON_BD_DATA_REVIEWED: ' TRUE ' }), true);

let statusCode = null;
let body = null;
const headers = new Map();
const blocked = requireBdDataReview({
  setHeader(name, value) { headers.set(name, value); },
  status(code) { statusCode = code; return this; },
  json(value) { body = value; return this; },
}, {});
assert.equal(blocked, false);
assert.equal(statusCode, 503);
assert.equal(headers.get('Cache-Control'), 'no-store');
assert.deepEqual(body, {
  error: 'Avalon BD is unavailable until the production data review is complete.',
  code: 'bd_data_review_required',
});
assert.equal(requireBdDataReview({ status() { throw new Error('ready gate must not write a response'); } }, {
  AVALON_BD_DATA_REVIEWED: 'true',
}), true);

const protectedRoutes = [
  '../api/admin/robbot3k.js',
  '../api/cron/robbot3k-refresh.js',
  '../api/cron/robbot3k-outreach.js',
  '../api/webhooks/robbot3k.js',
];
for (const route of protectedRoutes) {
  const source = readFileSync(new URL(route, import.meta.url), 'utf8');
  assert.match(source, /import \{ requireBdDataReview \} from ['"]\.\.\/_lib\/bd-data-review-gate\.js['"];?/,
    `${route} must import the production data-review gate`);
  assert.match(source, /if \(!requireBdDataReview\(res\)\) return;/,
    `${route} must fail closed before reading or mutating BD data`);
}

const routeOrderChecks = [
  ['../api/admin/robbot3k.js', "const { db, tenantId, user } = authed"],
  ['../api/cron/robbot3k-refresh.js', 'const db = await getServiceClient()'],
  ['../api/cron/robbot3k-outreach.js', 'const db = await getServiceClient()'],
  ['../api/webhooks/robbot3k.js', 'const payload = req.body'],
];
for (const [route, firstSensitiveOperation] of routeOrderChecks) {
  const source = readFileSync(new URL(route, import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('export default async function handler'));
  assert.ok(handler.indexOf('requireBdDataReview(res)') < handler.indexOf(firstSensitiveOperation),
    `${route} must gate before its first BD data operation`);
}

const adminRobBot = readFileSync(new URL('../api/admin/robbot3k.js', import.meta.url), 'utf8');
assert.ok(adminRobBot.indexOf('requireAdmin(req, res)') < adminRobBot.indexOf('requireBdDataReview(res)'),
  'outreach admin route must authenticate before revealing readiness state');

const adminBd = readFileSync(new URL('../api/admin/bd.js', import.meta.url), 'utf8');
assert.match(adminBd, /requireBdCrmEnabled\(res\)/,
  'standalone CRM must use its independent server gate');
assert.doesNotMatch(adminBd, /requireBdDataReview|AVALON_BD_DATA_REVIEWED/,
  'standalone CRM enablement must not open or depend on the outreach gate');

const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
assert.match(envExample, /^AVALON_BD_DATA_REVIEWED=false$/m);
assert.match(envExample, /^AVALON_BD_CRM_ENABLED=false$/m);
assert.doesNotMatch(envExample, /^VITE_AVALON_BD_DATA_REVIEWED=/m, 'the gate must remain server-only');

console.log('PASS: outreach remains data-review gated while standalone Avalon BD uses its own fail-closed gate.');
