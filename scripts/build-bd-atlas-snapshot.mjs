import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const SOURCE_SHA256 = 'd783ef0113a7a0cbfced470f2a150a30dbb18ef09f9450fe175bc4ec2cf8ad36';
export const SOURCE_NAME = 'regional_opportunity_atlas';
export const SOURCE_SNAPSHOT = '2026-08-29';
export const DATASET_PAYLOAD_SHA256 = '9c02a1420b422588e73ead84712c3e7f17d1c1b3f81cb79b510e24fa3d663563';
export const EXPECTED = Object.freeze({
  events: 903,
  targets: 337,
  eventSourceLinked: 735,
  eventNeedsReview: 168,
  companies: 338,
  opportunities: 1240,
  mutations: 1578,
  highPriority: 645,
});

const OUTPUT_PATH = new URL('../supabase/migrations/066_avalon_bd_atlas_snapshot.sql', import.meta.url);

const CATEGORY_LABELS = Object.freeze({
  sf: 'Street & community', fest: 'Festivals', fit: 'Races & fitness', spt: 'Sports',
  conf: 'Conferences', nite: 'Nightlife', hol: 'Holiday', health: 'Health & longevity',
  clinical: 'Clinical innovation', work: 'Workplace & benefits', premium: 'Premium & philanthropy',
  food: 'Food & drink', arts: 'Arts, design & film', market: 'Markets & makers',
  campus: 'College & campus', family: 'Family shows', comedy: 'Comedy', talks: 'Talks & ideas',
});

const SEGMENT_LABELS = Object.freeze({
  events: 'Event planners & DMCs', private: 'Weddings & private events',
  hospitality: 'Catering & hospitality', venues: 'Venues & operators',
  referral: 'Referral channels', film: 'Film & production',
  tech100: 'SF tech offices · 100+', tech15: 'SF tech wellness buyers · 15+',
  sfoffice: 'Live SF offices · confirmed', baywell: 'Bay Area wellness-friendly employers',
  wellvenue: 'Recovery venues & fitness partners', funded: 'Newly funded SF',
  yc: 'YC companies', wellness: 'Wellness-aligned companies', anchor: 'SF anchor accounts',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deterministicUuid(key) {
  const bytes = createHash('sha256').update(`avalon-bd-atlas-v1\0${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // RFC 9562 UUIDv8: deterministic, application-defined payload.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function extractArrayLiteral(html, variableName) {
  const marker = `const ${variableName}=`;
  const markerAt = html.indexOf(marker);
  assert.ok(markerAt >= 0, `missing ${marker}`);
  const start = html.indexOf('[', markerAt + marker.length);
  assert.ok(start >= 0, `missing array for ${variableName}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    const next = html[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated array for ${variableName}`);
}

function parseLiteralArray(html, variableName) {
  const literal = extractArrayLiteral(html, variableName);
  const value = vm.runInNewContext(`(${literal})`, Object.create(null), {
    timeout: 1_000,
    contextCodeGeneration: { strings: false, wasm: false },
  });
  return JSON.parse(JSON.stringify(value));
}

function validHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function priorityFields(priority) {
  const values = {
    1: { priority: 'low', fitScore: 50 },
    2: { priority: 'normal', fitScore: 70 },
    3: { priority: 'high', fitScore: 90 },
  };
  assert.ok(values[priority], `unexpected Atlas priority: ${priority}`);
  return values[priority];
}

function normalizeName(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function firstEventDate(event) {
  if (event.u === true) return null;
  const first = Array.isArray(event.dt) ? event.dt.find((value) => /^\d{2}-\d{2}$/.test(value)) : null;
  if (first) return `2026-${first}`;
  if (typeof event.start === 'string' && /^\d{2}-\d{2}$/.test(event.start)) return `2026-${event.start}`;
  return null;
}

function compactLines(lines) {
  return lines.filter((line) => line && String(line).trim()).join('\n');
}

function targetOpportunityType(segment) {
  if (['tech100', 'tech15', 'sfoffice', 'baywell', 'funded', 'yc', 'anchor'].includes(segment)) return 'Corporate Wellness';
  if (segment === 'wellvenue') return 'Venue Partnership';
  if (segment === 'venues') return 'Venue Partnership';
  if (segment === 'hospitality') return 'Hospitality Partnership';
  return 'Strategic Partnership';
}

function assertGeneratedRecordContract(companies, opportunities) {
  const companyTypes = new Set(['Venue', 'Festival', 'Hotel', 'Record Label', 'Corporate', 'Fitness', 'Wellness', 'Hospitality', 'Sports', 'Brand', 'Agency', 'Healthcare', 'Other']);
  const relationshipStatuses = new Set(['unknown', 'cold', 'warm', 'active', 'partner', 'dormant', 'do_not_contact']);
  const opportunityTypes = new Set(['Event Wellness', 'Artist Wellness', 'Employee Wellness', 'Corporate Wellness', 'Venue Partnership', 'Hospitality Partnership', 'Retainer', 'Activation', 'Strategic Partnership', 'Other']);
  const stages = new Set(['new', 'researching']);
  const priorities = new Set(['low', 'normal', 'high']);
  const validateBase = (row) => {
    assert.ok(Array.from(row.name).length >= 1 && Array.from(row.name).length <= 240, `${row.externalId} name length changed`);
    assert.equal(row.normalizedName, normalizeName(row.name), `${row.externalId} normalized name changed`);
    assert.ok(Array.from(row.externalId).length >= 1 && Array.from(row.externalId).length <= 240, `${row.externalId} external ID length changed`);
    assert.ok(Array.isArray(row.tags) && row.tags.length <= 30, `${row.externalId} tag count changed`);
    assert.ok(row.tags.every((tag) => typeof tag === 'string' && Array.from(tag).length >= 1 && Array.from(tag).length <= 80), `${row.externalId} tag length changed`);
    for (const forbidden of ['expectedValueCents', 'expected_value_cents', 'createdByAgentId', 'updatedByAgentId', 'agentIdentityId']) {
      assert.ok(!Object.hasOwn(row, forbidden), `${row.externalId} cannot carry ${forbidden}`);
    }
  };
  for (const row of companies) {
    validateBase(row);
    assert.ok(companyTypes.has(row.companyType), `${row.externalId} company type changed`);
    assert.ok(relationshipStatuses.has(row.relationshipStatus), `${row.externalId} relationship status changed`);
    assert.ok(row.fitScore === null || [50, 70, 90].includes(row.fitScore), `${row.externalId} fit score changed`);
    assert.ok(!Object.hasOwn(row, 'websiteUrl') && !Object.hasOwn(row, 'normalizedDomain'), `${row.externalId} cannot infer website/domain`);
  }
  for (const row of opportunities) {
    validateBase(row);
    assert.ok(opportunityTypes.has(row.opportunityType), `${row.externalId} opportunity type changed`);
    assert.ok(stages.has(row.pipelineStage), `${row.externalId} stage changed`);
    assert.ok(priorities.has(row.priority), `${row.externalId} priority changed`);
    assert.ok([10, 15].includes(row.probability), `${row.externalId} probability changed`);
    assert.ok([50, 70, 90].includes(row.fitScore), `${row.externalId} fit score changed`);
    if (row.expectedCloseDate !== null) {
      assert.match(row.expectedCloseDate, /^2026-(?:09|10|11|12)-(?:0[1-9]|[12]\d|3[01])$/, `${row.externalId} date changed`);
      assert.equal(new Date(`${row.expectedCloseDate}T12:00:00Z`).toISOString().slice(0, 10), row.expectedCloseDate, `${row.externalId} date is invalid`);
    }
  }
  assert.equal(new Set(companies.map((row) => row.externalId)).size, companies.length, 'company external IDs must be unique');
  assert.equal(new Set(companies.map((row) => row.normalizedName)).size, companies.length, 'active domainless company normalized names must be unique');
  assert.equal(new Set(opportunities.map((row) => row.externalId)).size, opportunities.length, 'opportunity external IDs must be unique');
}

export function buildDataset(html) {
  assert.equal(sha256(html), SOURCE_SHA256, 'Atlas source SHA-256 changed; review the new snapshot before generating SQL');
  const events = parseLiteralArray(html, 'EV');
  const targets = parseLiteralArray(html, 'TARGETS');
  assert.equal(events.length, EXPECTED.events);
  assert.equal(targets.length, EXPECTED.targets);
  assert.equal(new Set(events.map((event) => String(event.id))).size, EXPECTED.events, 'event IDs must be unique');
  assert.equal(new Set(targets.map((target) => target.id)).size, EXPECTED.targets, 'target IDs must be unique');
  assert.ok(events.every((event) => event.n && event.l && event.c && [1, 2, 3].includes(event.p)), 'event contract changed');
  assert.ok(targets.every((target) => target.id && target.n && target.seg && [1, 2, 3].includes(target.p)), 'target contract changed');

  const holdingExternalId = 'holding:unresolved-event-hosts';
  const holdingId = deterministicUuid(`company:${holdingExternalId}`);
  const companies = [{
    id: holdingId,
    externalId: holdingExternalId,
    name: 'Atlas event leads — unresolved hosts (internal)',
    normalizedName: normalizeName('Atlas event leads — unresolved hosts (internal)'),
    companyType: 'Other',
    industry: 'Internal research holding record',
    location: 'Bay Area',
    description: 'Internal holding company for Atlas event opportunities whose legal organizer or host has not been resolved. Do not contact this record.',
    relationshipStatus: 'do_not_contact',
    fitScore: null,
    nextAction: 'Resolve and human-review the legal organizer before assigning any event opportunity.',
    tags: ['atlas', 'atlas-holding', 'internal-only', 'do-not-contact', 'review-required', 'outreach-blocked'],
  }];

  for (const target of targets) {
    const { fitScore } = priorityFields(target.p);
    companies.push({
      id: deterministicUuid(`company:target:${target.id}`),
      externalId: `target:${target.id}`,
      name: target.n.trim(),
      normalizedName: normalizeName(target.n),
      companyType: target.seg === 'venues' || target.seg === 'wellvenue' ? 'Venue'
        : target.seg === 'hospitality' ? 'Hospitality'
          : target.seg === 'film' ? 'Agency'
            : target.seg === 'events' || target.seg === 'private' || target.seg === 'referral' ? 'Agency'
              : 'Corporate',
      industry: SEGMENT_LABELS[target.seg] || target.seg,
      location: target.loc || null,
      description: compactLines([
        target.qual && `Qualification: ${target.qual}`,
        target.signal && `Signal: ${target.signal}`,
        target.budget && `Budget evidence: ${target.budget}`,
        target.fit && `Fit: ${target.fit}`,
        target.conf && `Evidence status: ${target.conf}`,
        target.src && `Primary evidence: ${target.src}`,
        target.src2 && `Additional evidence: ${target.src2}`,
        target.src3 && `Additional evidence: ${target.src3}`,
        target.socialDiscovery && `Social discovery: ${target.socialDiscovery}`,
      ]),
      relationshipStatus: 'unknown',
      fitScore,
      nextAction: 'Human review required before any contact or calendar action.',
      tags: ['atlas', 'atlas-target', target.seg, `priority-p${target.p}`, 'review-required', 'outreach-blocked'],
    });
  }

  const opportunities = [];
  for (const event of events) {
    const { priority, fitScore } = priorityFields(event.p);
    const sourceLinked = validHttpUrl(event.src) && event.u !== true;
    opportunities.push({
      id: deterministicUuid(`opportunity:event:${event.id}`),
      externalId: `event:${event.id}`,
      companyId: holdingId,
      name: event.n.trim(),
      normalizedName: normalizeName(event.n),
      opportunityType: 'Event Wellness',
      pipelineStage: sourceLinked ? 'researching' : 'new',
      probability: sourceLinked ? 15 : 10,
      fitScore,
      priority,
      expectedCloseDate: firstEventDate(event),
      nextAction: sourceLinked
        ? 'Resolve the legal organizer or host, verify the public event, then human-review access, permissions, economics, and staffing before outreach.'
        : 'Resolve the legal organizer or host and verify the official source and 2026 date before qualification or outreach.',
      description: compactLines([
        `Atlas date: ${event.d || 'Not published'}`,
        `Location: ${event.l}`,
        `Category: ${CATEGORY_LABELS[event.c] || event.c}`,
        event.hrs && `Hours: ${event.hrs}`,
        event.att && `Attendance signal: ${event.att}`,
        event.modeled && `Modeled attendance: ${event.modeled}`,
        event.crowdBasis && `Crowd basis: ${event.crowdBasis}`,
        event.src && `Source supplied by Atlas: ${event.src}`,
        event.socialDiscovery && `Social discovery: ${event.socialDiscovery}`,
        event.note && `Research note: ${event.note}`,
      ]),
      notesSummary: 'Reviewed Atlas intelligence only. This record is not outreach, calendar, sales, access, or activation approval.',
      tags: [
        'atlas', 'atlas-event', event.c, event.mo, `priority-p${event.p}`,
        'review-required', 'outreach-blocked', sourceLinked ? 'source-linked' : 'needs-source-review',
        ...(event.u === true ? ['date-unconfirmed'] : []),
      ],
    });
  }

  for (const target of targets) {
    const { priority, fitScore } = priorityFields(target.p);
    opportunities.push({
      id: deterministicUuid(`opportunity:target:${target.id}`),
      externalId: `target:${target.id}`,
      companyId: deterministicUuid(`company:target:${target.id}`),
      name: `${target.n.trim()} — account research`,
      normalizedName: normalizeName(`${target.n} — account research`),
      opportunityType: targetOpportunityType(target.seg),
      pipelineStage: 'researching',
      probability: 15,
      fitScore,
      priority,
      expectedCloseDate: null,
      nextAction: 'Human review required before any contact or calendar action.',
      description: compactLines([
        `Segment: ${SEGMENT_LABELS[target.seg] || target.seg}`,
        target.qual && `Qualification: ${target.qual}`,
        target.signal && `Signal: ${target.signal}`,
        target.budget && `Budget evidence: ${target.budget}`,
        target.fit && `Fit: ${target.fit}`,
        target.route && `Atlas suggested route (not approved): ${target.route}`,
        target.conf && `Evidence status: ${target.conf}`,
        target.src && `Primary evidence: ${target.src}`,
        target.src2 && `Additional evidence: ${target.src2}`,
        target.src3 && `Additional evidence: ${target.src3}`,
        target.socialDiscovery && `Social discovery: ${target.socialDiscovery}`,
      ]),
      notesSummary: 'Reviewed Atlas intelligence only. This record is not outreach, calendar, sales, access, or activation approval.',
      tags: ['atlas', 'atlas-target', target.seg, `priority-p${target.p}`, 'review-required', 'outreach-blocked'],
    });
  }

  assert.equal(companies.length, EXPECTED.companies);
  assert.equal(opportunities.length, EXPECTED.opportunities);
  assert.equal(opportunities.filter((item) => item.externalId.startsWith('event:') && item.pipelineStage === 'researching').length, EXPECTED.eventSourceLinked);
  assert.equal(opportunities.filter((item) => item.externalId.startsWith('event:') && item.pipelineStage === 'new').length, EXPECTED.eventNeedsReview);
  assert.equal(opportunities.filter((item) => item.externalId.startsWith('target:') && item.pipelineStage === 'researching').length, EXPECTED.targets);
  assert.equal(opportunities.filter((item) => item.priority === 'high').length, EXPECTED.highPriority);
  assert.equal(new Set([...companies, ...opportunities].map((row) => row.id)).size, EXPECTED.mutations, 'record UUID collision');
  assertGeneratedRecordContract(companies, opportunities);

  const mutations = [
    ...companies.map((row) => ({
      id: deterministicUuid(`mutation:company:${row.externalId}`),
      objectType: 'company', objectId: row.id, externalId: row.externalId,
      requestId: `atlas:${SOURCE_SNAPSHOT}:company:${row.externalId}`,
    })),
    ...opportunities.map((row) => ({
      id: deterministicUuid(`mutation:opportunity:${row.externalId}`),
      objectType: 'opportunity', objectId: row.id, externalId: row.externalId,
      requestId: `atlas:${SOURCE_SNAPSHOT}:opportunity:${row.externalId}`,
    })),
  ];
  assert.equal(mutations.length, EXPECTED.mutations);
  assert.equal(new Set(mutations.map((row) => row.id)).size, EXPECTED.mutations, 'mutation UUID collision');
  assert.equal(new Set(mutations.map((row) => row.requestId)).size, EXPECTED.mutations, 'mutation request collision');
  assert.equal(new Set([...companies, ...opportunities, ...mutations].map((row) => row.id)).size, EXPECTED.mutations * 2, 'record/mutation UUID collision');

  const payloadSha256 = sha256(JSON.stringify({ companies, opportunities, mutations }));
  assert.equal(payloadSha256, DATASET_PAYLOAD_SHA256, `generated Atlas dataset payload changed: ${payloadSha256}`);

  return { companies, opportunities, mutations };
}

function jsonPayload(value, delimiter) {
  const json = JSON.stringify(value).replace(/[\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16)}`);
  assert.ok(!json.includes(delimiter), `payload contains SQL delimiter ${delimiter}`);
  return json;
}

export function buildMigration(dataset) {
  const companiesJson = jsonPayload(dataset.companies, '$atlas_companies$');
  const opportunitiesJson = jsonPayload(dataset.opportunities, '$atlas_opportunities$');
  const mutationsJson = jsonPayload(dataset.mutations, '$atlas_mutations$');
  return `-- GENERATED FILE. Edit scripts/build-bd-atlas-snapshot.mjs, then regenerate.\n-- Source SHA-256: ${SOURCE_SHA256}\n-- Dataset payload SHA-256: ${DATASET_PAYLOAD_SHA256}\n-- Source: ${SOURCE_NAME} · snapshot ${SOURCE_SNAPSHOT}\n-- Rows: ${EXPECTED.companies} companies · ${EXPECTED.opportunities} opportunities · ${EXPECTED.mutations} append-only human mutation records\n-- Safety: research records only; no autonomous outreach, calendar actions, public-site, or Nurse mutations.\n\n${MIGRATION_PREFIX}\n\ninsert into atlas_companies_stage (\n  id, external_id, name, normalized_name, company_type, industry, location, description,\n  relationship_status, fit_score, next_action, tags\n)\nselect\n  payload.id::uuid, payload.\"externalId\", payload.name, payload.\"normalizedName\", payload.\"companyType\",\n  payload.industry, payload.location, payload.description, payload.\"relationshipStatus\", payload.\"fitScore\",\n  payload.\"nextAction\", array(select jsonb_array_elements_text(payload.tags))\nfrom jsonb_to_recordset($atlas_companies$${companiesJson}$atlas_companies$::jsonb) as payload(\n  id text, \"externalId\" text, name text, \"normalizedName\" text, \"companyType\" text,\n  industry text, location text, description text, \"relationshipStatus\" text, \"fitScore\" smallint,\n  \"nextAction\" text, tags jsonb\n);\n\ninsert into atlas_opportunities_stage (\n  id, external_id, company_id, name, normalized_name, opportunity_type, pipeline_stage, probability,\n  fit_score, priority, expected_close_date, next_action, description, notes_summary, tags\n)\nselect\n  payload.id::uuid, payload.\"externalId\", payload.\"companyId\"::uuid, payload.name, payload.\"normalizedName\",\n  payload.\"opportunityType\", payload.\"pipelineStage\", payload.probability, payload.\"fitScore\",\n  payload.priority, payload.\"expectedCloseDate\"::date, payload.\"nextAction\", payload.description,\n  payload.\"notesSummary\", array(select jsonb_array_elements_text(payload.tags))\nfrom jsonb_to_recordset($atlas_opportunities$${opportunitiesJson}$atlas_opportunities$::jsonb) as payload(\n  id text, \"externalId\" text, \"companyId\" text, name text, \"normalizedName\" text,\n  \"opportunityType\" text, \"pipelineStage\" text, probability smallint, \"fitScore\" smallint, priority text,\n  \"expectedCloseDate\" text, \"nextAction\" text, description text, \"notesSummary\" text, tags jsonb\n);\n\ninsert into atlas_mutations_stage (id, object_type, object_id, external_id, request_id)\nselect payload.id::uuid, payload.\"objectType\", payload.\"objectId\"::uuid, payload.\"externalId\", payload.\"requestId\"\nfrom jsonb_to_recordset($atlas_mutations$${mutationsJson}$atlas_mutations$::jsonb) as payload(\n  id text, \"objectType\" text, \"objectId\" text, \"externalId\" text, \"requestId\" text\n);\n\n${MIGRATION_SUFFIX}\n`;
}

const MIGRATION_PREFIX = `begin;
set transaction isolation level read committed;

do $preflight$
declare
  eligible_admins integer;
  required_table text;
  column_shape record;
begin
  foreach required_table in array array[
    'tenants', 'profiles', 'bd_companies', 'bd_agent_identities', 'bd_agent_permissions', 'bd_people',
    'bd_opportunities', 'bd_opportunity_people', 'bd_activities', 'bd_activity_people', 'bd_tasks',
    'bd_notes', 'bd_files', 'bd_lists', 'bd_list_items', 'bd_call_ingestions', 'bd_agent_mutations'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception using errcode = 'P0001', message = 'bd_atlas_preflight_table_missing_' || required_table;
    end if;
  end loop;
  if exists (
    select 1 from (values
      ('profiles', 'id'), ('profiles', 'tenant_id'), ('profiles', 'email'), ('profiles', 'role'), ('profiles', 'status'),
      ('bd_companies', 'id'), ('bd_companies', 'tenant_id'), ('bd_companies', 'normalized_name'),
      ('bd_companies', 'normalized_domain'), ('bd_companies', 'deleted_at'),
      ('bd_opportunities', 'id'), ('bd_opportunities', 'tenant_id'), ('bd_opportunities', 'company_id'),
      ('bd_opportunities', 'deleted_at'), ('bd_agent_mutations', 'id'),
      ('bd_agent_mutations', 'tenant_id'), ('bd_agent_mutations', 'request_id')
    ) as required(table_name, column_name)
    where not exists (
      select 1 from information_schema.columns definition
      where definition.table_schema = 'public'
        and definition.table_name = required.table_name
        and definition.column_name = required.column_name
    )
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_preflight_columns_missing';
  end if;

  for column_shape in
    select * from (values
      ('bd_companies', 'source_external_id', 'text'),
      ('bd_companies', 'source_snapshot', 'date'),
      ('bd_opportunities', 'source_external_id', 'text'),
      ('bd_opportunities', 'source_snapshot', 'date')
    ) as expected(table_name, column_name, data_type)
  loop
    if exists (
      select 1 from information_schema.columns definition
      where definition.table_schema = 'public'
        and definition.table_name = column_shape.table_name
        and definition.column_name = column_shape.column_name
    ) and not exists (
      select 1 from information_schema.columns definition
      where definition.table_schema = 'public'
        and definition.table_name = column_shape.table_name
        and definition.column_name = column_shape.column_name
        and definition.data_type = column_shape.data_type
        and definition.is_nullable = 'YES'
        and definition.column_default is null
    ) then
      raise exception using errcode = 'P0001', message = 'bd_atlas_preflight_column_shape_mismatch',
        detail = column_shape.table_name || '.' || column_shape.column_name;
    end if;
  end loop;

  select count(*) into eligible_admins
  from public.profiles profile
  join public.tenants tenant on tenant.id = profile.tenant_id
  where profile.role = 'admin' and profile.status = 'active'
    and lower(profile.email) = lower('joseph@avalonvitality.co');
  if eligible_admins <> 1 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_requires_exactly_one_named_active_human_admin',
      detail = 'eligible_count=' || eligible_admins;
  end if;
end
$preflight$;

alter table public.bd_companies add column if not exists source_external_id text;
alter table public.bd_companies add column if not exists source_snapshot date;
alter table public.bd_opportunities add column if not exists source_external_id text;
alter table public.bd_opportunities add column if not exists source_snapshot date;

do $indexes$
begin
  if to_regclass('public.bd_companies_source_external_unique_idx') is null then
    create unique index bd_companies_source_external_unique_idx
      on public.bd_companies (tenant_id, source, source_external_id)
      where source_external_id is not null;
  elsif not exists (
    select 1 from pg_index index_definition
    where index_definition.indexrelid = 'public.bd_companies_source_external_unique_idx'::regclass
      and index_definition.indrelid = 'public.bd_companies'::regclass
      and index_definition.indisunique and index_definition.indisvalid and index_definition.indisready
      and (select array_agg(attribute.attname::text order by key_column.ordinality)
           from unnest(index_definition.indkey) with ordinality key_column(attnum, ordinality)
           join pg_attribute attribute on attribute.attrelid = index_definition.indrelid and attribute.attnum = key_column.attnum)
          = array['tenant_id', 'source', 'source_external_id']::text[]
      and pg_get_expr(index_definition.indpred, index_definition.indrelid) = '(source_external_id IS NOT NULL)'
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_company_source_index_mismatch';
  end if;

  if to_regclass('public.bd_opportunities_source_external_unique_idx') is null then
    create unique index bd_opportunities_source_external_unique_idx
      on public.bd_opportunities (tenant_id, source, source_external_id)
      where source_external_id is not null;
  elsif not exists (
    select 1 from pg_index index_definition
    where index_definition.indexrelid = 'public.bd_opportunities_source_external_unique_idx'::regclass
      and index_definition.indrelid = 'public.bd_opportunities'::regclass
      and index_definition.indisunique and index_definition.indisvalid and index_definition.indisready
      and (select array_agg(attribute.attname::text order by key_column.ordinality)
           from unnest(index_definition.indkey) with ordinality key_column(attnum, ordinality)
           join pg_attribute attribute on attribute.attrelid = index_definition.indrelid and attribute.attnum = key_column.attnum)
          = array['tenant_id', 'source', 'source_external_id']::text[]
      and pg_get_expr(index_definition.indpred, index_definition.indrelid) = '(source_external_id IS NOT NULL)'
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_opportunity_source_index_mismatch';
  end if;
end
$indexes$;

create temporary table atlas_import_context (
  tenant_id uuid primary key,
  actor_profile_id uuid not null
) on commit drop;
insert into atlas_import_context (tenant_id, actor_profile_id)
select profile.tenant_id, profile.id
from public.profiles profile
join public.tenants tenant on tenant.id = profile.tenant_id
where profile.role = 'admin' and profile.status = 'active'
  and lower(profile.email) = lower('joseph@avalonvitality.co');

create temporary table atlas_side_effect_baseline (
  table_name text primary key,
  row_count bigint not null
) on commit drop;
insert into atlas_side_effect_baseline values
  ('bd_agent_identities', (select count(*) from public.bd_agent_identities)),
  ('bd_agent_permissions', (select count(*) from public.bd_agent_permissions)),
  ('bd_people', (select count(*) from public.bd_people)),
  ('bd_opportunity_people', (select count(*) from public.bd_opportunity_people)),
  ('bd_activities', (select count(*) from public.bd_activities)),
  ('bd_activity_people', (select count(*) from public.bd_activity_people)),
  ('bd_tasks', (select count(*) from public.bd_tasks)),
  ('bd_notes', (select count(*) from public.bd_notes)),
  ('bd_files', (select count(*) from public.bd_files)),
  ('bd_lists', (select count(*) from public.bd_lists)),
  ('bd_list_items', (select count(*) from public.bd_list_items)),
  ('bd_call_ingestions', (select count(*) from public.bd_call_ingestions));

create temporary table atlas_companies_stage (
  id uuid primary key, external_id text unique not null, name text not null, normalized_name text not null,
  company_type text not null, industry text, location text, description text, relationship_status text not null,
  fit_score smallint, next_action text, tags text[] not null
) on commit drop;
create temporary table atlas_opportunities_stage (
  id uuid primary key, external_id text unique not null, company_id uuid not null, name text not null,
  normalized_name text not null, opportunity_type text not null, pipeline_stage text not null,
  probability smallint not null, fit_score smallint not null, priority text not null, expected_close_date date,
  next_action text not null, description text, notes_summary text not null, tags text[] not null
) on commit drop;
create temporary table atlas_mutations_stage (
  id uuid primary key, object_type text not null, object_id uuid not null, external_id text not null,
  request_id text unique not null
) on commit drop;`;

const MIGRATION_SUFFIX = `do $collisions$
declare
  tenant uuid := (select tenant_id from atlas_import_context);
  existing_companies integer;
  existing_opportunities integer;
  existing_mutations integer;
begin
  if (select count(*) from atlas_companies_stage) <> 338
     or (select count(*) from atlas_opportunities_stage) <> 1240
     or (select count(*) from atlas_mutations_stage) <> 1578 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_generated_stage_count_mismatch';
  end if;
  if exists (
    select 1 from public.bd_companies existing join atlas_companies_stage staged on staged.id = existing.id
    where existing.tenant_id <> tenant or existing.source <> 'regional_opportunity_atlas'
       or existing.source_external_id is distinct from staged.external_id
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_company_id_collision';
  end if;
  if exists (
    select 1 from public.bd_opportunities existing join atlas_opportunities_stage staged on staged.id = existing.id
    where existing.tenant_id <> tenant or existing.source <> 'regional_opportunity_atlas'
       or existing.source_external_id is distinct from staged.external_id
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_opportunity_id_collision';
  end if;
  if exists (
    select 1 from public.bd_agent_mutations existing join atlas_mutations_stage staged on staged.id = existing.id
    where existing.tenant_id <> tenant or existing.source <> 'regional_opportunity_atlas'
       or existing.request_id is distinct from staged.request_id
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_mutation_id_collision';
  end if;
  if exists (
    select 1 from public.bd_companies existing join atlas_companies_stage staged
      on existing.tenant_id = tenant and existing.source = 'regional_opportunity_atlas'
     and existing.source_external_id = staged.external_id and existing.id <> staged.id
  ) or exists (
    select 1 from public.bd_opportunities existing join atlas_opportunities_stage staged
      on existing.tenant_id = tenant and existing.source = 'regional_opportunity_atlas'
     and existing.source_external_id = staged.external_id and existing.id <> staged.id
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_external_id_collision';
  end if;
  if exists (
    select 1 from public.bd_companies existing join atlas_companies_stage staged
      on existing.tenant_id = tenant and existing.normalized_name = staged.normalized_name
     and existing.deleted_at is null and existing.id <> staged.id
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_active_company_name_collision';
  end if;
  if exists (
    select 1 from public.bd_agent_mutations existing join atlas_mutations_stage staged
      on existing.tenant_id = tenant and existing.request_id = staged.request_id and existing.id <> staged.id
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_request_id_collision';
  end if;

  select count(*) into existing_companies from public.bd_companies
    where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29';
  select count(*) into existing_opportunities from public.bd_opportunities
    where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29';
  select count(*) into existing_mutations from public.bd_agent_mutations
    where tenant_id = tenant and source = 'regional_opportunity_atlas'
      and request_id like 'atlas:2026-08-29:%';
  if not ((existing_companies = 0 and existing_opportunities = 0 and existing_mutations = 0)
       or (existing_companies = 338 and existing_opportunities = 1240 and existing_mutations = 1578)) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_partial_prior_import_forbidden',
      detail = format('companies=%s opportunities=%s mutations=%s', existing_companies, existing_opportunities, existing_mutations);
  end if;
end
$collisions$;

insert into public.bd_companies (
  id, tenant_id, name, normalized_name, website_url, normalized_domain, company_type, industry, location,
  description, relationship_status, source, source_external_id, source_snapshot, fit_score, next_action, tags,
  created_by, updated_by, created_by_agent_id, updated_by_agent_id
)
select staged.id, context.tenant_id, staged.name, staged.normalized_name, null, null, staged.company_type,
  staged.industry, staged.location, staged.description, staged.relationship_status,
  'regional_opportunity_atlas', staged.external_id, date '2026-08-29', staged.fit_score,
  staged.next_action, staged.tags, context.actor_profile_id, context.actor_profile_id, null, null
from atlas_companies_stage staged cross join atlas_import_context context
on conflict (id) do nothing;

insert into public.bd_opportunities (
  id, tenant_id, company_id, name, normalized_name, opportunity_type, pipeline_stage, expected_value_cents,
  probability, source, source_external_id, source_snapshot, fit_score, priority, expected_close_date,
  next_action, description, notes_summary, tags, handoff_status, created_by, updated_by,
  created_by_agent_id, updated_by_agent_id
)
select staged.id, context.tenant_id, staged.company_id, staged.name, staged.normalized_name,
  staged.opportunity_type, staged.pipeline_stage, null, staged.probability, 'regional_opportunity_atlas',
  staged.external_id, date '2026-08-29', staged.fit_score, staged.priority, staged.expected_close_date,
  staged.next_action, staged.description, staged.notes_summary, staged.tags, 'not_ready',
  context.actor_profile_id, context.actor_profile_id, null, null
from atlas_opportunities_stage staged cross join atlas_import_context context
on conflict (id) do nothing;

insert into public.bd_agent_mutations (
  id, tenant_id, actor_type, actor_profile_id, agent_identity_id, model_used, action, source, confidence,
  approval_status, object_type, object_id, previous_value, resulting_value, request_id
)
select staged.id, context.tenant_id, 'human', context.actor_profile_id, null, null,
  case staged.object_type when 'company' then 'import_atlas_company_snapshot' else 'import_atlas_opportunity_snapshot' end,
  'regional_opportunity_atlas', null, 'human_approved', staged.object_type, staged.object_id, null,
  jsonb_build_object(
    'source', 'regional_opportunity_atlas', 'sourceSnapshot', '2026-08-29',
    'sourceExternalId', staged.external_id, 'reviewRequired', true, 'outreachBlocked', true
  ), staged.request_id
from atlas_mutations_stage staged cross join atlas_import_context context
on conflict (tenant_id, request_id) do nothing;

do $postflight$
declare
  tenant uuid := (select tenant_id from atlas_import_context);
  actor uuid := (select actor_profile_id from atlas_import_context);
begin
  if (select count(*) from public.bd_companies where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29') <> 338 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_company_count';
  end if;
  if (select count(*) from public.bd_opportunities where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29') <> 1240 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_opportunity_count';
  end if;
  if (select count(*) from public.bd_companies where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and source_external_id like 'target:%') <> 337
     or (select count(*) from public.bd_companies where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and source_external_id = 'holding:unresolved-event-hosts' and relationship_status = 'do_not_contact') <> 1 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_company_partition';
  end if;
  if (select count(*) from public.bd_opportunities where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and source_external_id like 'event:%') <> 903
     or (select count(*) from public.bd_opportunities where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and source_external_id like 'target:%') <> 337 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_opportunity_partition';
  end if;
  if (select count(*) from public.bd_opportunities where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and priority = 'high') <> 645 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_high_priority_count';
  end if;
  if (select count(*) from public.bd_opportunities where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and source_external_id like 'event:%' and pipeline_stage = 'researching' and probability = 15) <> 735
     or (select count(*) from public.bd_opportunities where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and source_external_id like 'event:%' and pipeline_stage = 'new' and probability = 10) <> 168
     or (select count(*) from public.bd_opportunities where tenant_id = tenant and source = 'regional_opportunity_atlas' and source_snapshot = date '2026-08-29' and source_external_id like 'target:%' and pipeline_stage = 'researching' and probability = 15) <> 337 then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_stage_probability';
  end if;
  if exists (
    select 1 from public.bd_opportunities imported
    where imported.tenant_id = tenant and imported.source = 'regional_opportunity_atlas' and imported.source_snapshot = date '2026-08-29'
      and (imported.expected_value_cents is not null or imported.handoff_status <> 'not_ready'
        or not imported.tags @> array['review-required', 'outreach-blocked']::text[]
        or imported.created_by <> actor or imported.updated_by <> actor
        or imported.created_by_agent_id is not null or imported.updated_by_agent_id is not null
        or (imported.priority, imported.fit_score) not in (('low', 50), ('normal', 70), ('high', 90)))
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_opportunity_safety';
  end if;
  if exists (
    select 1 from atlas_opportunities_stage staged
    left join public.bd_opportunities imported on imported.id = staged.id and imported.tenant_id = tenant
    where imported.id is null or imported.company_id is distinct from staged.company_id
       or imported.name is distinct from staged.name or imported.normalized_name is distinct from staged.normalized_name
       or imported.opportunity_type is distinct from staged.opportunity_type
       or imported.source is distinct from 'regional_opportunity_atlas'
       or imported.source_snapshot is distinct from date '2026-08-29'
       or imported.source_external_id is distinct from staged.external_id
       or imported.pipeline_stage is distinct from staged.pipeline_stage
       or imported.probability is distinct from staged.probability or imported.priority is distinct from staged.priority
       or imported.fit_score is distinct from staged.fit_score
       or imported.expected_close_date is distinct from staged.expected_close_date
       or imported.next_action is distinct from staged.next_action
       or imported.description is distinct from staged.description
       or imported.notes_summary is distinct from staged.notes_summary
       or imported.tags is distinct from staged.tags
       or imported.expected_value_cents is not null or imported.handoff_status <> 'not_ready'
       or imported.deleted_at is not null or imported.deleted_by is not null
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_opportunity_linkage';
  end if;
  if exists (
    select 1 from atlas_companies_stage staged
    left join public.bd_companies imported on imported.id = staged.id and imported.tenant_id = tenant
    where imported.id is null
       or imported.name is distinct from staged.name or imported.normalized_name is distinct from staged.normalized_name
       or imported.company_type is distinct from staged.company_type
       or imported.industry is distinct from staged.industry or imported.location is distinct from staged.location
       or imported.description is distinct from staged.description
       or imported.relationship_status is distinct from staged.relationship_status
       or imported.source is distinct from 'regional_opportunity_atlas'
       or imported.source_snapshot is distinct from date '2026-08-29'
       or imported.source_external_id is distinct from staged.external_id
       or imported.fit_score is distinct from staged.fit_score or imported.next_action is distinct from staged.next_action
       or imported.tags is distinct from staged.tags
       or imported.website_url is not null or imported.normalized_domain is not null
       or imported.deleted_at is not null or imported.deleted_by is not null
       or imported.created_by <> actor or imported.updated_by <> actor
       or imported.created_by_agent_id is not null or imported.updated_by_agent_id is not null
       or not imported.tags @> array['review-required', 'outreach-blocked']::text[]
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_company_safety';
  end if;
  if (select count(*) from public.bd_agent_mutations
      where tenant_id = tenant and source = 'regional_opportunity_atlas' and request_id like 'atlas:2026-08-29:%') <> 1578
     or exists (
       select 1 from atlas_mutations_stage staged
       left join public.bd_agent_mutations mutation on mutation.id = staged.id
       where mutation.id is null or mutation.tenant_id <> tenant
          or mutation.actor_type <> 'human' or mutation.actor_profile_id <> actor
          or mutation.agent_identity_id is not null or mutation.model_used is not null or mutation.confidence is not null
          or mutation.approval_status <> 'human_approved' or mutation.object_type <> staged.object_type
          or mutation.object_id <> staged.object_id or mutation.request_id <> staged.request_id
          or mutation.source <> 'regional_opportunity_atlas'
          or mutation.action <> case staged.object_type when 'company' then 'import_atlas_company_snapshot' else 'import_atlas_opportunity_snapshot' end
          or mutation.previous_value is not null
          or mutation.resulting_value is distinct from jsonb_build_object(
            'source', 'regional_opportunity_atlas', 'sourceSnapshot', '2026-08-29',
            'sourceExternalId', staged.external_id, 'reviewRequired', true, 'outreachBlocked', true
          )
     ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_human_mutation_attribution';
  end if;
  if exists (
    select 1 from atlas_side_effect_baseline baseline
    where baseline.row_count <> case baseline.table_name
      when 'bd_agent_identities' then (select count(*) from public.bd_agent_identities)
      when 'bd_agent_permissions' then (select count(*) from public.bd_agent_permissions)
      when 'bd_people' then (select count(*) from public.bd_people)
      when 'bd_opportunity_people' then (select count(*) from public.bd_opportunity_people)
      when 'bd_activities' then (select count(*) from public.bd_activities)
      when 'bd_activity_people' then (select count(*) from public.bd_activity_people)
      when 'bd_tasks' then (select count(*) from public.bd_tasks)
      when 'bd_notes' then (select count(*) from public.bd_notes)
      when 'bd_files' then (select count(*) from public.bd_files)
      when 'bd_lists' then (select count(*) from public.bd_lists)
      when 'bd_list_items' then (select count(*) from public.bd_list_items)
      when 'bd_call_ingestions' then (select count(*) from public.bd_call_ingestions)
    end
  ) then
    raise exception using errcode = 'P0001', message = 'bd_atlas_postflight_unexpected_side_effect';
  end if;
end
$postflight$;

commit;`;

export function verifyMigrationText(sql, dataset) {
  assert.match(sql, /^-- GENERATED FILE\./);
  assert.ok(sql.includes(`Source SHA-256: ${SOURCE_SHA256}`));
  assert.ok(sql.includes(`Dataset payload SHA-256: ${DATASET_PAYLOAD_SHA256}`));
  assert.equal((sql.match(/\bbegin\s*;/gi) || []).length, 1);
  assert.equal((sql.match(/\bcommit\s*;/gi) || []).length, 1);
  assert.match(sql.trim(), /commit;$/);
  assert.doesNotMatch(sql, /FLASH_EVENTS|robbot3k_|send_email\s*\(/i);
  assert.match(sql, /bd_companies_source_external_unique_idx[\s\S]*\(tenant_id, source, source_external_id\)[\s\S]*where source_external_id is not null/);
  assert.match(sql, /bd_opportunities_source_external_unique_idx[\s\S]*\(tenant_id, source, source_external_id\)[\s\S]*where source_external_id is not null/);
  assert.match(sql, /bd_atlas_requires_exactly_one_named_active_human_admin/);
  assert.match(sql, /lower\(profile\.email\) = lower\('joseph@avalonvitality\.co'\)/);
  assert.match(sql, /relationship_status = 'do_not_contact'/);
  assert.match(sql, /expected_value_cents is not null or imported\.handoff_status <> 'not_ready'/);
  assert.match(sql, /created_by_agent_id is not null or imported\.updated_by_agent_id is not null/);
  assert.match(sql, /bd_atlas_postflight_unexpected_side_effect/);
  assert.match(sql, /bd_atlas_postflight_high_priority_count/);
  assert.equal(dataset.companies.length, EXPECTED.companies);
  assert.equal(dataset.opportunities.length, EXPECTED.opportunities);
  assert.equal(dataset.mutations.length, EXPECTED.mutations);
  return true;
}

function cli() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf('--source');
  assert.ok(sourceIndex >= 0 && args[sourceIndex + 1], 'usage: node scripts/build-bd-atlas-snapshot.mjs --source <canonical-index.html> [--write|--check]');
  const sourcePath = resolve(args[sourceIndex + 1]);
  const html = readFileSync(sourcePath, 'utf8');
  const dataset = buildDataset(html);
  const generated = buildMigration(dataset);
  verifyMigrationText(generated, dataset);
  if (args.includes('--write')) {
    writeFileSync(OUTPUT_PATH, generated);
    console.log(`wrote ${OUTPUT_PATH.pathname}`);
  } else {
    const current = readFileSync(OUTPUT_PATH, 'utf8');
    assert.equal(current, generated, 'migration 066 is stale; regenerate it with --write');
    console.log(`verified Atlas source and migration: ${EXPECTED.events} events + ${EXPECTED.targets} targets`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) cli();
