import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OPERATING_DAY_MODE,
  OPERATING_DAY_SIMULATOR_VERSION,
  OPERATING_DAY_SOURCE_OF_TRUTH,
  buildOperatingDaySnapshot,
} from '../src/lib/operatingDaySimulator.js';

const snapshot = buildOperatingDaySnapshot();

assert.equal(OPERATING_DAY_SIMULATOR_VERSION, '2026.05.full-operating-day-v1');
assert.equal(snapshot.mode, OPERATING_DAY_MODE);
assert.equal(snapshot.status, 'Full Day Simulated');
assert.equal(snapshot.score, 1000, 'Full operating day simulator must score 1000/1000.');
assert.equal(snapshot.complete, true, 'Full operating day simulator cannot leave local gaps.');
assert.equal(snapshot.openLocalGaps.length, 0, 'Full operating day simulator cannot hide failed criteria.');

assert.ok(snapshot.timeline.length >= 15, 'Day simulator must cover full opening-to-EOD timeline.');
assert.equal(snapshot.timeline[0].label, 'Ops opens day');
assert.equal(snapshot.timeline.at(-1).label, 'EOD reconciliation');

assert.ok(snapshot.requests.length >= 8, 'Day simulator must include meaningful demand.');
assert.ok(snapshot.requests.some((row) => row.locationType === 'hotel'), 'Day must include hotel demand.');
assert.ok(snapshot.requests.some((row) => row.locationType === 'home'), 'Day must include home demand.');
assert.ok(snapshot.requests.some((row) => row.locationType === 'office'), 'Day must include office demand.');
assert.ok(snapshot.requests.some((row) => row.locationType === 'event'), 'Day must include event/launch demand.');
assert.ok(snapshot.requests.some((row) => row.isNewClient), 'Day must include a new client.');
assert.ok(snapshot.requests.some((row) => row.isNewClient === false), 'Day must include a returning client.');
assert.ok(snapshot.requests.some((row) => row.eventPresale), 'Day must include presale/event flow.');

assert.ok(snapshot.gfeProof.find((row) => row.id === 'annual-returning' && row.required === false), 'Returning annual GFE must skip new GFE.');
assert.ok(snapshot.gfeProof.find((row) => row.id === 'avalon-np-first' && row.status === 'Pass'), 'Avalon NP first path must be represented.');
assert.ok(snapshot.gfeProof.find((row) => row.id === 'qualiphy-fallback-only' && row.status === 'Pass'), 'Qualiphy fallback-only path must be represented.');

assert.ok(snapshot.dispatch.metrics.requests >= 4, 'Dispatch brain must run against active day visits.');
assert.ok(snapshot.marketplace.offers.some((offer) => offer.replyCommand === 'Y/N'), 'Nurse Y/N shift flow must exist.');
assert.ok(snapshot.arrival.missions.some((row) => row.clientTextReady && /on the way/i.test(row.clientText || '')), 'Client route update must wait for nurse acceptance.');
assert.ok(snapshot.arrival.missions.some((row) => row.maps?.apple && row.maps?.google), 'Route handoffs must include Apple and Google maps.');

assert.ok(snapshot.closeout.metrics.payrollReady >= 2, 'Clean closeouts must unlock payroll proof.');
assert.ok(snapshot.closeout.metrics.incidents >= 1, 'Adverse event lane must exist.');
assert.ok(snapshot.kit.metrics.queuedDeductions > 0, 'Every completed IV must produce kit deductions.');
assert.ok(snapshot.postVisit.aftercareQueue.length >= 1, 'Aftercare must be queued after clean closeout.');
assert.ok(snapshot.postVisit.rebookQueue.length >= 1, 'Rebook prompt must be queued after clean closeout.');

assert.ok(snapshot.financeProof.every((row) => row.phiExcluded), 'Finance, banking, payroll, and books queues must exclude PHI.');
assert.ok(snapshot.failureProof.every((row) => row.represented), 'Every wire-tomorrow failure state must be represented.');
assert.equal(snapshot.wire.complete, true, 'Wire-readiness proof must remain complete during day simulation.');
assert.equal(OPERATING_DAY_SOURCE_OF_TRUTH.length, 10, 'Source-of-truth map must cover all operating objects.');

const root = process.cwd();
const admin = fs.readFileSync(path.join(root, 'src/pages/admin/Command.jsx'), 'utf8');
const release = fs.readFileSync(path.join(root, 'scripts/release-qa.mjs'), 'utf8');
assert.match(admin, /OperatingDaySimulatorPanel/, 'Admin command center must surface the full operating day simulator.');
assert.match(release, /test:day/, 'Release QA must run the full operating day gate.');

console.log('Operating day QA passed: full local operating day simulated at 1000/1000.');
