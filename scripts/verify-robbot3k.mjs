import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  CADENCE_DAYS,
  draftHashFor,
  normalizeAtlasProspects,
  parseAtlasHtml,
} from '../api/_lib/robbot3k-atlas.js';
import {
  atlasRowsMissingFromSnapshot,
  normalizeManualProspectInput,
  pacificClock,
  robBotHasOfficialEvidence,
  selectAllTenantRows,
  statusAfterProspectEdit,
} from '../api/_lib/robbot3k-core.js';
import {
  approvedBodiesContainPostalAddress,
  failedMessageRetryState,
  initialApprovalExpired,
  outreachProvider,
  senderSettingsReady,
} from '../api/_lib/robbot3k-execution.js';

const fixture = `<!doctype html><script>
const CN={conf:'Conferences'};
const PLAY={out:'Outreach'};
const DATA_META={snapshot:'2026-08-29'};
const FLASH_EVENTS=[{id:'flash-1',n:'Auxiliary rail only',l:'SF',src:'https://example.com/flash'}];
const EV=[{id:1,n:'Verified Event',d:'Sep 1',l:'SF',c:'conf',p:3,play:'out',src:'https://example.com/event',note:'Official organizer opportunity.'}];
const TARGET_SEGMENTS={work:'Workplace'};
const TARGETS=[{id:'ta001',n:'Verified Company',seg:'work',loc:'SF',p:3,signal:'The official site https://example.com/proof lists a San Francisco workplace.',fit:'A team program may fit.',route:'Ask the workplace team at hello@example.com.',src:'https://example.com/company',conf:'Official'}];
</script>`;

const parsed = parseAtlasHtml(fixture);
assert.equal(parsed.events.length, 1);
assert.equal(parsed.flashEvents.length, 1);
assert.equal(parsed.targets.length, 1);

const normalized = normalizeAtlasProspects(parsed, {
  calendlyUrl: 'https://calendly.com/avalon/example',
  physicalAddress: '123 Example Street, San Francisco, CA 94107',
});
assert.equal(normalized.length, 2, 'auxiliary FLASH_EVENTS must not enter the 1,240-record queue');
for (const prospect of normalized) {
  assert.deepEqual(prospect.draft_steps.map((step) => step.day), CADENCE_DAYS);
  assert.ok(prospect.draft_steps.every((step) => /no thanks/i.test(step.body)));
  assert.ok(prospect.draft_steps.every((step) => !step.body.includes('https://example.com/')));
  assert.ok(prospect.draft_steps.every((step) => !/atlas audience signal|working hypothesis|source-linked research|permissioned pilot/i.test(step.body)));
}

const discoveryOnly = normalizeAtlasProspects(parseAtlasHtml(`<!doctype html><script>
const CN={conf:'Conferences'};
const PLAY={out:'Outreach'};
const DATA_META={snapshot:'2026-08-29'};
const EV=[{id:'discovery-only',n:'Discovery Only',l:'SF',c:'conf',p:3,play:'out',crowdSrc:'https://example.com/crowd',socialDiscovery:'https://example.com/social'}];
const TARGET_SEGMENTS={};
const TARGETS=[];
</script>`));
assert.equal(discoveryOnly[0].verification, 'needs_verification', 'discovery links cannot substitute for an event primary source');
assert.equal(robBotHasOfficialEvidence(discoveryOnly[0]), false);
assert.equal(robBotHasOfficialEvidence({
  source_kind: 'atlas_target', verification: 'Live-confirmed Aug 29, 2026', public_sources: ['https://example.com'],
}), true);
assert.equal(robBotHasOfficialEvidence({
  source_kind: 'atlas_target', verification: 'Social-confirmed office; official headcount pending', public_sources: ['https://example.com'],
}), false);
assert.equal(robBotHasOfficialEvidence({
  source_kind: 'manual', verification: 'official_manual_source', public_sources: ['https://example.ai/'],
}), true, 'a human-confirmed first-party manual source can enter the approval pipeline');
assert.equal(robBotHasOfficialEvidence({
  source_kind: 'manual', verification: 'manual_source_submitted', public_sources: ['https://example.ai/'],
}), false, 'an unchecked manual source must remain in research');

const manualContact = normalizeManualProspectInput({
  personName: '  Example Founder  ',
  company: ' Example AI ',
  title: ' CEO ',
  email: ' FOUNDER@EXAMPLE.AI ',
  website: 'example.ai',
  opportunityContext: 'The founder requested a controlled Avalon outreach test.',
  notes: 'Internal test only.',
  priority: 3,
  sourceVerified: true,
  isTestRecord: true,
});
assert.equal(manualContact.personName, 'Example Founder');
assert.equal(manualContact.email, 'founder@example.ai');
assert.equal(manualContact.websiteUrl, 'https://example.ai/');
assert.equal(manualContact.isTestRecord, true);
assert.match(manualContact.sourceId, /^manual:[a-f0-9]{32}$/);
assert.equal(
  manualContact.sourceId,
  normalizeManualProspectInput({
    personName: 'Example Founder', company: 'Example AI', title: 'CEO', email: 'founder@example.ai',
    sourceUrl: 'https://example.ai/team#founder', opportunityContext: 'The founder requested a controlled Avalon outreach test.',
  }).sourceId,
  'repeat manual inserts must share an opaque deterministic dedupe key',
);
assert.throws(() => normalizeManualProspectInput({
  personName: 'Example Founder', company: 'Example AI', title: 'CEO', email: 'not-an-email',
  website: 'example.ai', opportunityContext: 'Controlled test context.',
}), /valid contact email/i);
const manualNameOnly = normalizeManualProspectInput({
  personName: 'Research First', company: 'Example AI', title: 'CEO',
  website: 'example.ai', opportunityContext: 'Find and verify the correct business address before drafting outreach.',
});
assert.equal(manualNameOnly.email, '', 'a named contact may enter research before an email is known');
assert.match(manualNameOnly.sourceId, /^manual:[a-f0-9]{32}$/);
const manualCompanyOnly = normalizeManualProspectInput({
  company: 'Example AI', website: 'example.ai',
  opportunityContext: 'Research the company and identify the correct buyer before outreach.',
});
assert.equal(manualCompanyOnly.personName, '', 'a company may enter research before a person is known');
assert.equal(manualCompanyOnly.title, '');
assert.throws(() => normalizeManualProspectInput({
  personName: 'Example Founder', company: 'Example AI', title: 'CEO', email: 'founder@example.ai',
  website: 'http://127.0.0.1', opportunityContext: 'Controlled test context.',
}), /public HTTPS/i);
assert.throws(() => normalizeManualProspectInput({
  personName: 'Example Founder', company: 'Example AI', title: 'CEO', email: 'founder@example.ai',
  opportunityContext: 'Controlled test context.',
}), /website, domain, or public source URL/i);

const sampleSteps = normalized[0].draft_steps;
const firstHash = draftHashFor({ recipient: 'owner@example.com', steps: sampleSteps, evidence: { sourceSnapshot: '2026-08-29' } });
const changedEvidenceHash = draftHashFor({ recipient: 'owner@example.com', steps: sampleSteps, evidence: { sourceSnapshot: '2026-08-30' } });
assert.notEqual(firstHash, changedEvidenceHash, 'approval hash must bind the evidence snapshot');
assert.equal(statusAfterProspectEdit('approved', false, 'ready'), 'approved', 'no-op save preserves approved state');
assert.equal(statusAfterProspectEdit('approved', true, 'ready'), 'ready', 'approved copy/evidence edit requires reapproval');
assert.deepEqual(
  atlasRowsMissingFromSnapshot(
    [{ id: 'gone', source_kind: 'atlas_target', source_id: 'ta999', status: 'approved' }],
    [{ source_kind: 'atlas_target', source_id: 'ta001' }],
  ).map((row) => row.id),
  ['gone'],
  'removed Atlas rows must enter the archive/stop path',
);
assert.equal(initialApprovalExpired(
  { expires_at: '2026-08-29T00:00:00Z' },
  { sent_count: 0 },
  new Date('2026-08-30T00:00:00Z'),
), true);
assert.equal(initialApprovalExpired(
  { expires_at: '2026-08-29T00:00:00Z' },
  { sent_count: 1 },
  new Date('2026-08-30T00:00:00Z'),
), false, 'expiry applies before the initial send only');
assert.equal(senderSettingsReady({
  from_email: 'sender@example.com',
  reply_to_email: 'reply@example.com',
  calendly_url: 'https://calendly.com/avalon/example',
  physical_postal_address: '123 Example Street',
  provider_selection: 'instantly',
  provider_status: 'connected',
}, 'instantly'), true);
assert.equal(senderSettingsReady({}, 'instantly'), false);
assert.equal(approvedBodiesContainPostalAddress(
  Array.from({ length: 4 }, () => ({ body: 'No thanks.\nAvalon Vitality · 123 Example Street, San Francisco, CA 94107' })),
  '123 Example Street, San Francisco, CA 94107',
), true);
assert.equal(approvedBodiesContainPostalAddress(
  Array.from({ length: 4 }, (_, index) => ({ body: index === 2 ? 'No thanks.' : 'No thanks. 123 Example Street' })),
  '123 Example Street',
), false, 'every approved touch must contain the canonical postal address before live send');
assert.deepEqual(
  failedMessageRetryState({ status: 'failed', attempt_count: 1, next_retry_at: '2026-08-29T12:00:00Z' }, new Date('2026-08-29T12:01:00Z')),
  { retry: true, exhausted: false, reason: 'send_retry_ready', attempts: 1, requiresReconciliation: true },
);
assert.equal(
  failedMessageRetryState({ status: 'failed', attempt_count: 2, next_retry_at: '2026-08-29T13:00:00Z' }, new Date('2026-08-29T12:00:00Z')).reason,
  'send_retry_backoff',
);
assert.equal(
  failedMessageRetryState({ status: 'failed', attempt_count: 3 }, new Date('2026-08-29T12:00:00Z')).exhausted,
  true,
  'provider attempts must stop after the bounded third try',
);
assert.equal(
  failedMessageRetryState({
    status: 'sending', attempt_count: 1, last_attempt_at: '2026-08-29T11:00:00Z',
  }, new Date('2026-08-29T12:00:00Z')).reason,
  'sending_lease_expired',
  'a crashed sending claim must enter provider reconciliation after its lease',
);

const pagedRows = Array.from({ length: 1_240 }, (_, index) => ({ id: String(index), tenant_id: 'tenant-1' }));
const ranges = [];
const pagedDb = {
  from() {
    let start = 0;
    let end = 0;
    const builder = {
      select() { return builder; },
      order() { return builder; },
      range(nextStart, nextEnd) { start = nextStart; end = nextEnd; ranges.push([start, end]); return builder; },
      eq() { return Promise.resolve({ data: pagedRows.slice(start, end + 1), error: null }); },
    };
    return builder;
  },
};
assert.equal((await selectAllTenantRows(pagedDb, 'robbot3k_prospects', '*', 'tenant-1')).length, 1_240);
assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]], 'reads above the PostgREST cap must use stable pages');

assert.throws(() => parseAtlasHtml(`<!doctype html><script>
const DATA_META={snapshot:'2026-08-29'};
const EV=getEvents();
const TARGET_SEGMENTS={work:'Workplace'};
const TARGETS=[];
</script>`), /not static/i);
assert.throws(() => parseAtlasHtml(`<!doctype html><script>
const DATA_META={snapshot:'2026-08-29'};
const EV=[];
EV.push({id:'dynamic'});
const TARGET_SEGMENTS={work:'Workplace'};
const TARGETS=[];
</script>`), /must not be mutated/i);

assert.equal(outreachProvider.configured, false);
assert.equal(outreachProvider.id, 'unconfigured');
assert.equal(outreachProvider.supportsIdempotency, false);
assert.equal(pacificClock(new Date('2026-01-15T14:00:00Z')).hour, 6, 'PST 6 AM guard');
assert.equal(pacificClock(new Date('2026-07-15T13:00:00Z')).hour, 6, 'PDT 6 AM guard');

const liveFixture = '/private/tmp/robbot3k-atlas-live.html';
if (existsSync(liveFixture)) {
  const live = parseAtlasHtml(readFileSync(liveFixture, 'utf8'));
  assert.equal(live.events.length, 903);
  assert.equal(live.targets.length, 337);
  assert.equal(live.flashEvents.length, 11);
  const liveProspects = normalizeAtlasProspects(live);
  assert.equal(liveProspects.length, 1_240, 'displayed Atlas total must remain exact');
  assert.equal(
    liveProspects.filter((row) => row.source_kind === 'atlas_target' && robBotHasOfficialEvidence(row)).length,
    336,
    'target eligibility must mirror the explicit SQL official/verified/live-confirmed vocabulary',
  );
}

const migration = readFileSync(new URL('../supabase/migrations/046_robbot3k_bd.sql', import.meta.url), 'utf8');
for (const table of ['runs', 'settings', 'prospects', 'approvals', 'sequences', 'messages', 'suppressions', 'meetings']) {
  assert.match(migration, new RegExp(`robbot3k_${table}`));
}
assert.match(migration, /revoke all on public\.%I from anon, authenticated/);
assert.match(migration, /decision <> 'approved' or expires_at is not null/);
assert.match(migration, /create or replace function public\.robbot3k_approve_prospect/);
assert.match(migration, /grant execute on function public\.robbot3k_approve_prospect[\s\S]*to service_role/);
assert.match(migration, /status in \('running', 'succeeded'\)/, 'failed scheduled refreshes must be retryable');
assert.match(migration, /attempt_count smallint not null default 0/);
assert.match(migration, /next_retry_at timestamptz/);

const executionSource = readFileSync(new URL('../api/_lib/robbot3k-execution.js', import.meta.url), 'utf8');
assert.doesNotMatch(executionSource, /robbot3k_suppressions[\s\S]{0,160}limit\(500\)/);
assert.match(executionSource, /\.eq\('email', recipient\)/);
assert.match(executionSource, /\.eq\('domain', domain\)/);
assert.match(executionSource, /approvedBodiesContainPostalAddress/);
assert.match(executionSource, /\.eq\('attempt_count', attempts\)/, 'failed claims must be atomically reclaimed');
assert.match(executionSource, /provider\?\.supportsIdempotency === true/);
assert.match(executionSource, /typeof provider\?\.reconcile === 'function'/);
assert.match(executionSource, /gate\.reconcileMessage/);

const adminSource = readFileSync(new URL('../api/admin/robbot3k.js', import.meta.url), 'utf8');
assert.match(adminSource, /result\.mode === 'live'/, 'admin execution copy must reflect the executor mode');
assert.match(adminSource, /create_manual_prospect/);
assert.match(adminSource, /upsertManualRobBotProspect/);
assert.match(adminSource, /reconcileRobBotProspectToBd/, 'manual intake must reconcile into Avalon BD');
assert.match(adminSource, /researchRecordRetained: true/, 'CRM failure must disclose the retained research record');
assert.match(adminSource, /manual_prospect_saved_crm_migration_required/, 'missing migration 048 must be reported precisely');
assert.match(adminSource, /No email was sent\./, 'manual insertion must state its non-sending outcome');

const coreSource = readFileSync(new URL('../api/_lib/robbot3k-core.js', import.meta.url), 'utf8');
assert.doesNotMatch(coreSource, /trim\(\)\.slice\(0, 20_000\)/, 'visible manual drafts must be rejected, not silently truncated');
assert.match(coreSource, /p_expected_draft_hash: reviewedDraftHash/);
assert.match(coreSource, /error_code: 'stale_refresh_claim'/, 'stale scheduled refresh claims must be retryable');
assert.match(coreSource, /\.eq\('contact_email', normalized\.email\)/, 'manual contacts must de-duplicate by exact normalized email');
assert.match(coreSource, /await invalidateApproval\(db, tenantId, existing\.id, 'manual_prospect_updated'\)/, 'manual updates cannot inherit an executable approval');
assert.match(coreSource, /outreachExecuted: false/, 'manual insertion audit must record that it did not execute outreach');
assert.match(coreSource, /scheduled_at_required/, 'booked state must require a future meeting time');

const adminUiSource = readFileSync(new URL('../app-modules/pages/admin/RobBot3K.jsx', import.meta.url), 'utf8');
for (const field of ['Person name', 'Company', 'Title / role', 'Email', 'Company website / domain', 'Opportunity / context', 'Internal notes']) {
  assert.ok(adminUiSource.includes(field), `manual contact UI must include ${field}`);
}
assert.match(adminUiSource, /Test record/);
assert.match(adminUiSource, /Never auto-sends/);
assert.match(adminUiSource, /action\('create_manual_prospect'/);

const webhookSource = readFileSync(new URL('../api/webhooks/robbot3k.js', import.meta.url), 'utf8');
const lookupBlock = webhookSource.match(/findRobBotProspectForSignal\(db, tenantId, \{[\s\S]*?\n    \}\);/)?.[0] || '';
assert.match(lookupBlock, /provider,/);
assert.match(lookupBlock, /providerMessageId,/);
assert.doesNotMatch(lookupBlock, /email\s*:/, 'secured stop webhooks must not fall back to email-only matching');
assert.doesNotMatch(webhookSource, /raw\.includes\(/, 'webhook event classification must not use ambiguous substrings');
assert.match(webhookSource, /ROBBOT3K_GENERIC_WEBHOOK_ENABLED/, 'the generic relay must require a separate explicit enable flag');
assert.match(webhookSource, /webhook_event_id_required/, 'relay events must carry a stable replay identifier');

console.log('RobBot3K verification passed.');
