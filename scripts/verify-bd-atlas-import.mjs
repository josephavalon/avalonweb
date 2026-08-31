import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DATASET_PAYLOAD_SHA256, EXPECTED, SOURCE_NAME, SOURCE_SHA256, SOURCE_SNAPSHOT, verifyMigrationText } from './build-bd-atlas-snapshot.mjs';

const sql = readFileSync(new URL('../supabase/migrations/066_avalon_bd_atlas_snapshot.sql', import.meta.url), 'utf8');

function extractPayload(delimiter) {
  const start = sql.indexOf(delimiter);
  assert.ok(start >= 0, `missing ${delimiter} payload`);
  const end = sql.indexOf(delimiter, start + delimiter.length);
  assert.ok(end > start, `unterminated ${delimiter} payload`);
  return JSON.parse(sql.slice(start + delimiter.length, end));
}

const companies = extractPayload('$atlas_companies$');
const opportunities = extractPayload('$atlas_opportunities$');
const mutations = extractPayload('$atlas_mutations$');
const dataset = { companies, opportunities, mutations };

verifyMigrationText(sql, dataset);
assert.ok(sql.includes(`Source SHA-256: ${SOURCE_SHA256}`));
assert.ok(sql.includes(`Dataset payload SHA-256: ${DATASET_PAYLOAD_SHA256}`));
assert.ok(sql.includes(`Source: ${SOURCE_NAME} · snapshot ${SOURCE_SNAPSHOT}`));
assert.equal(createHash('sha256').update(JSON.stringify(dataset)).digest('hex'), DATASET_PAYLOAD_SHA256, 'generated dataset payload hash changed');

assert.equal(companies.length, EXPECTED.companies);
assert.equal(opportunities.length, EXPECTED.opportunities);
assert.equal(mutations.length, EXPECTED.mutations);
assert.equal(new Set(companies.map((row) => row.id)).size, companies.length);
assert.equal(new Set(companies.map((row) => row.externalId)).size, companies.length);
assert.equal(new Set(opportunities.map((row) => row.id)).size, opportunities.length);
assert.equal(new Set(opportunities.map((row) => row.externalId)).size, opportunities.length);
assert.equal(new Set(mutations.map((row) => row.id)).size, mutations.length);
assert.equal(new Set(mutations.map((row) => row.requestId)).size, mutations.length);
assert.equal(new Set([...companies, ...opportunities, ...mutations].map((row) => row.id)).size, EXPECTED.mutations * 2);

const holding = companies.filter((row) => row.externalId === 'holding:unresolved-event-hosts');
const targetCompanies = companies.filter((row) => row.externalId.startsWith('target:'));
assert.equal(holding.length, 1);
assert.equal(holding[0].relationshipStatus, 'do_not_contact');
assert.match(holding[0].name, /internal/i);
assert.ok(holding[0].tags.includes('internal-only'));
assert.equal(targetCompanies.length, EXPECTED.targets);

const eventOpportunities = opportunities.filter((row) => row.externalId.startsWith('event:'));
const targetOpportunities = opportunities.filter((row) => row.externalId.startsWith('target:'));
assert.equal(eventOpportunities.length, EXPECTED.events);
assert.equal(targetOpportunities.length, EXPECTED.targets);
assert.equal(eventOpportunities.filter((row) => row.pipelineStage === 'researching' && row.probability === 15).length, EXPECTED.eventSourceLinked);
assert.equal(eventOpportunities.filter((row) => row.pipelineStage === 'new' && row.probability === 10).length, EXPECTED.eventNeedsReview);
assert.equal(targetOpportunities.filter((row) => row.pipelineStage === 'researching' && row.probability === 15).length, EXPECTED.targets);
assert.equal(opportunities.filter((row) => row.priority === 'high').length, EXPECTED.highPriority);
assert.ok(eventOpportunities.filter((row) => row.tags.includes('date-unconfirmed')).every((row) => row.expectedCloseDate === null));
assert.ok(targetOpportunities.every((row) => row.expectedCloseDate === null));
assert.ok(eventOpportunities.filter((row) => row.pipelineStage === 'researching').every((row) => /^2026-\d{2}-\d{2}$/.test(row.expectedCloseDate)));

for (const row of [...companies, ...opportunities]) {
  assert.ok(row.tags.includes('review-required'), `${row.externalId} must require human review`);
  assert.ok(row.tags.includes('outreach-blocked'), `${row.externalId} must block outreach`);
}
for (const row of opportunities) {
  assert.deepEqual(
    { low: 50, normal: 70, high: 90 }[row.priority],
    row.fitScore,
    `${row.externalId} priority/fit mapping changed`,
  );
  assert.match(row.notesSummary, /not outreach, calendar, sales, access, or activation approval/i);
}

const companyByExternalId = new Map(targetCompanies.map((row) => [row.externalId, row]));
for (const row of targetOpportunities) {
  assert.equal(row.companyId, companyByExternalId.get(row.externalId)?.id, `${row.externalId} target linkage changed`);
}
assert.ok(eventOpportunities.every((row) => row.companyId === holding[0].id), 'all event leads must remain on the do-not-contact holding company');

const records = new Map([
  ...companies.map((row) => [`company:${row.externalId}`, row.id]),
  ...opportunities.map((row) => [`opportunity:${row.externalId}`, row.id]),
]);
for (const mutation of mutations) {
  assert.equal(mutation.objectId, records.get(`${mutation.objectType}:${mutation.externalId}`));
  assert.equal(mutation.requestId, `atlas:${SOURCE_SNAPSHOT}:${mutation.objectType}:${mutation.externalId}`);
}

assert.match(sql, /actor_type, actor_profile_id, agent_identity_id, model_used/);
assert.match(sql, /'human', context\.actor_profile_id, null, null/);
assert.match(sql, /'human_approved'/);
assert.match(sql, /on conflict \(tenant_id, request_id\) do nothing/);
assert.match(sql, /on conflict \(id\) do nothing/g);
assert.doesNotMatch(sql, /insert into public\.bd_(?:agent_identities|agent_permissions|activities|tasks|people)/i);

console.log(`verified BD Atlas import: ${EXPECTED.companies} companies, ${EXPECTED.opportunities} opportunities, ${EXPECTED.mutations} human mutation records`);
