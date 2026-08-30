import { writeAuditEvent } from '../_lib/audit-events.js';
import {
  BD_PIPELINE_STAGES,
  BdInputError,
  bdInteger,
  bdIsoDate,
  cleanBdText,
  normalizeCompanyInput,
  normalizeOpportunityInput,
  normalizePersonInput,
  normalizeBdTags,
  recordBdMutation,
  requireBdUuid,
} from '../_lib/bd-crm-core.js';
import { requireBdCrmEnabled } from '../_lib/bd-crm-gate.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { requireAdmin } from '../_lib/supabase-auth.js';

const LIST_VIEWS = new Set(['companies', 'people', 'pipeline', 'tasks', 'lists']);
const RECORD_TYPES = new Set(['company', 'person', 'opportunity']);
const ACTIVITY_TYPES = new Set([
  'email', 'call', 'meeting', 'dm', 'note', 'research',
  'proposal', 'follow_up', 'status_change', 'file', 'internal_comment', 'task',
]);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const REOPEN_PROBABILITY = Object.freeze({
  new: 10, researching: 15, approved: 20, contacted: 30,
  engaged: 40, discovery: 50, proposal: 65, negotiation: 80,
});
const POST_ACTIONS = new Set([
  'create_company', 'create_person', 'create_opportunity', 'create_activity',
  'create_task', 'add_note', 'register_file_metadata', 'create_list',
  'add_list_item', 'record_call', 'merge_records',
]);
const PATCH_ACTIONS = new Set([
  'update_company', 'update_person', 'update_opportunity', 'change_pipeline_stage',
  'update_task', 'complete_task', 'soft_delete',
]);

function missingMigration(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '42p01' || code === 'pgrst205' || (message.includes('bd_') && message.includes('does not exist'));
}

function bodyObject(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { throw new BdInputError('Request body must be valid JSON.', 'json_invalid'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BdInputError('Request body is required.', 'body_required');
  return body;
}

function pagination(query = {}) {
  const limit = Math.min(200, Math.max(1, Math.floor(Number(query.limit) || 50)));
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
  return { limit, offset };
}

function pageResult(data, count, limit, offset) {
  const rows = data || [];
  const total = Number(count || 0);
  return {
    pagination: {
      limit, offset, total,
      hasMore: offset + rows.length < total,
      nextOffset: offset + rows.length,
    },
  };
}

function escapeSearchTerm(value) {
  const term = cleanBdText(value, { field: 'Search', max: 100, required: true });
  if (term.length < 2) throw new BdInputError('Search needs at least 2 characters.', 'search_too_short');
  const safe = term.replace(/[^a-z0-9@.+\- ]/gi, ' ').replace(/\s+/g, ' ').trim();
  if (safe.length < 2) throw new BdInputError('Search needs at least 2 letters or numbers.', 'search_too_short');
  return safe;
}

function relationIds(input = {}) {
  const companyId = requireBdUuid(input.companyId, 'companyId', { optional: true });
  const personId = requireBdUuid(input.personId, 'personId', { optional: true });
  const opportunityId = requireBdUuid(input.opportunityId, 'opportunityId', { optional: true });
  if (!companyId && !personId && !opportunityId) {
    throw new BdInputError('Link this record to a company, person, or opportunity.', 'relationship_required');
  }
  return { company_id: companyId, person_id: personId, opportunity_id: opportunityId };
}

async function selectAll(db, table, columns, tenantId, configure = (query) => query) {
  const pageSize = 500;
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    let query = db.from(table).select(columns).eq('tenant_id', tenantId).range(start, start + pageSize - 1);
    query = configure(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}

async function ownerNameMap(db, tenantId, rows = []) {
  const ids = [...new Set(rows.map((row) => row?.owner_profile_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const names = new Map();
  for (const batch of chunks(ids)) {
    const result = await db.from('profiles').select('id, full_name')
      .eq('tenant_id', tenantId).in('id', batch);
    if (result.error) throw result.error;
    for (const profile of result.data || []) names.set(profile.id, profile.full_name || null);
  }
  return names;
}

function withOwnerName(row, names) {
  return row ? { ...row, owner_name: row.owner_profile_id ? names.get(row.owner_profile_id) || null : null } : row;
}

function chunks(values, size = 100) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const PACIFIC_DATE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function pacificDateTimeParts(date) {
  return Object.fromEntries(PACIFIC_DATE_PARTS.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));
}

function pacificMidnightUtc({ year, month, day }) {
  const desiredWallTime = Date.UTC(year, month - 1, day);
  let candidate = desiredWallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = pacificDateTimeParts(new Date(candidate));
    const actualWallTime = Date.UTC(
      actual.year, actual.month - 1, actual.day,
      actual.hour, actual.minute, actual.second,
    );
    const corrected = candidate + (desiredWallTime - actualWallTime);
    if (corrected === candidate) break;
    candidate = corrected;
  }
  return new Date(candidate);
}

export function pacificDayWindow(now = new Date()) {
  const current = pacificDateTimeParts(now);
  const nextDate = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  return {
    start: pacificMidnightUtc(current).toISOString(),
    end: pacificMidnightUtc({
      year: nextDate.getUTCFullYear(),
      month: nextDate.getUTCMonth() + 1,
      day: nextDate.getUTCDate(),
    }).toISOString(),
  };
}

async function combineRowQueries(queries, { limit = 200, sortField = 'created_at', ascending = false } = {}) {
  if (!queries.length) return [];
  const results = await Promise.all(queries);
  const byId = new Map();
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data || []) if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((left, right) => {
    const a = left?.[sortField] ? new Date(left[sortField]).getTime() : ascending ? Number.MAX_SAFE_INTEGER : 0;
    const b = right?.[sortField] ? new Date(right[sortField]).getTime() : ascending ? Number.MAX_SAFE_INTEGER : 0;
    return ascending ? a - b : b - a;
  }).slice(0, limit);
}

function relatedQueries(db, table, tenantId, column, ids, { deleted = true, limit = 250 } = {}) {
  return chunks([...new Set(ids.filter(Boolean))]).map((batch) => {
    let query = db.from(table).select('*').eq('tenant_id', tenantId).in(column, batch);
    if (deleted) query = query.is('deleted_at', null);
    return query.limit(limit);
  });
}

async function listView(db, tenantId, view, queryParams) {
  const { limit, offset } = pagination(queryParams);
  const config = {
    companies: { table: 'bd_companies', order: 'updated_at', name: 'companies' },
    people: { table: 'bd_people', order: 'updated_at', name: 'people' },
    pipeline: { table: 'bd_opportunities', order: 'updated_at', name: 'opportunities' },
    tasks: { table: 'bd_tasks', order: 'due_at', name: 'tasks' },
    lists: { table: 'bd_lists', order: 'updated_at', name: 'lists' },
  }[view];
  let query = db.from(config.table).select('*', { count: 'exact' })
    .eq('tenant_id', tenantId).is('deleted_at', null)
    .order(config.order, { ascending: view === 'tasks', nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (view === 'pipeline' && queryParams.stage) {
    if (!BD_PIPELINE_STAGES.includes(String(queryParams.stage))) throw new BdInputError('Pipeline stage is not supported.', 'pipeline_stage_invalid');
    query = query.eq('pipeline_stage', String(queryParams.stage));
  }
  if (view === 'tasks' && queryParams.status) {
    const status = String(queryParams.status);
    if (!['open', 'in_progress', 'completed', 'cancelled'].includes(status)) throw new BdInputError('Task status is not supported.', 'task_status_invalid');
    query = query.eq('status', status);
  }
  const result = await query;
  if (result.error) throw result.error;
  const rows = result.data || [];
  const names = await ownerNameMap(db, tenantId, rows);
  return { [config.name]: rows.map((row) => withOwnerName(row, names)), ...pageResult(rows, result.count, limit, offset) };
}

async function dashboard(db, tenantId) {
  const now = new Date();
  const pacificToday = pacificDayWindow(now);
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString();
  const [opportunities, dueTasks, overdueTasks, meetings, recentChanges] = await Promise.all([
    selectAll(db, 'bd_opportunities', 'id, name, company_id, owner_profile_id, pipeline_stage, expected_value_cents, weighted_value_cents, priority, fit_score, next_action, next_action_date, updated_at', tenantId,
      (query) => query.is('deleted_at', null).not('pipeline_stage', 'in', '(won,lost)').order('updated_at', { ascending: false })),
    db.from('bd_tasks').select('*').eq('tenant_id', tenantId).is('deleted_at', null)
      .in('status', ['open', 'in_progress']).gte('due_at', pacificToday.start).lt('due_at', pacificToday.end)
      .order('due_at', { ascending: true }).limit(25),
    db.from('bd_tasks').select('*').eq('tenant_id', tenantId).is('deleted_at', null)
      .in('status', ['open', 'in_progress']).lt('due_at', pacificToday.start)
      .order('due_at', { ascending: true }).limit(25),
    db.from('bd_activities').select('id, occurred_at, content, source, company_id, primary_person_id, opportunity_id')
      .eq('tenant_id', tenantId).eq('activity_type', 'meeting')
      .gte('occurred_at', now.toISOString()).lte('occurred_at', weekEnd)
      .order('occurred_at', { ascending: true }).limit(25),
    db.from('bd_opportunities').select('id, name, company_id, owner_profile_id, pipeline_stage, priority, fit_score, next_action, updated_at')
      .eq('tenant_id', tenantId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(15),
  ]);
  for (const result of [dueTasks, overdueTasks, meetings, recentChanges]) if (result.error) throw result.error;
  const upcomingCalls = (meetings.data || []).map((meeting) => ({
    ...meeting,
    scheduled_at: meeting.occurred_at,
    provider: meeting.source || 'manual',
    status: 'scheduled',
    organization: null,
    contact_name: null,
    contact_role: null,
    person_id: meeting.primary_person_id || null,
  }));
  const openPipelineCents = opportunities.reduce((sum, item) => sum + Number(item.expected_value_cents || 0), 0);
  const priority = opportunities.filter((item) => ['high', 'urgent'].includes(item.priority))
    .sort((a, b) => Number(b.fit_score || 0) - Number(a.fit_score || 0)).slice(0, 25);
  const ownerNames = await ownerNameMap(db, tenantId, [
    ...priority, ...(dueTasks.data || []), ...(overdueTasks.data || []), ...(recentChanges.data || []),
  ]);
  return {
    summary: {
      openPipelineCents,
      openOpportunities: opportunities.length,
      priorityOpportunities: priority.length,
      callsThisWeek: upcomingCalls.length,
      actionsDueToday: (dueTasks.data || []).length,
      overdueActions: (overdueTasks.data || []).length,
    },
    priorityOpportunities: priority.map((row) => withOwnerName(row, ownerNames)),
    repliesRequiringAction: [],
    followUpsDue: (dueTasks.data || []).map((row) => withOwnerName(row, ownerNames)),
    overdueTasks: (overdueTasks.data || []).map((row) => withOwnerName(row, ownerNames)),
    upcomingCalls,
    newDiscoveries: [],
    recentlyChangedOpportunities: (recentChanges.data || []).map((row) => withOwnerName(row, ownerNames)),
    runtime: {
      callTranscriptExtraction: 'not_connected',
      fileStorage: 'not_connected',
      agentRecordQandA: 'not_connected',
      outreachExecution: 'not_connected',
    },
  };
}

async function globalSearch(db, tenantId, rawTerm) {
  const term = escapeSearchTerm(rawTerm);
  const pattern = `%${term}%`;
  const [companies, people, opportunities, notes, activities, tasks] = await Promise.all([
    db.from('bd_companies').select('id, name, company_type, website_url, location, fit_score')
      .eq('tenant_id', tenantId).is('deleted_at', null).ilike('name', pattern).limit(10),
    db.from('bd_people').select('id, full_name, title, email, company_id, decision_maker_status')
      .eq('tenant_id', tenantId).is('deleted_at', null).or(`full_name.ilike.${pattern},email.ilike.${pattern}`).limit(10),
    db.from('bd_opportunities').select('id, name, company_id, pipeline_stage, expected_value_cents, priority')
      .eq('tenant_id', tenantId).is('deleted_at', null).ilike('name', pattern).limit(10),
    db.from('bd_notes').select('id, title, content, company_id, person_id, opportunity_id, updated_at')
      .eq('tenant_id', tenantId).is('deleted_at', null).or(`title.ilike.${pattern},content.ilike.${pattern}`).limit(10),
    db.from('bd_activities').select('id, activity_type, content, company_id, primary_person_id, opportunity_id, occurred_at')
      .eq('tenant_id', tenantId).ilike('content', pattern).order('occurred_at', { ascending: false }).limit(10),
    db.from('bd_tasks').select('id, title, notes, status, company_id, person_id, opportunity_id, due_at')
      .eq('tenant_id', tenantId).is('deleted_at', null).or(`title.ilike.${pattern},notes.ilike.${pattern}`).limit(10),
  ]);
  for (const result of [companies, people, opportunities, notes, activities, tasks]) if (result.error) throw result.error;
  return {
    query: term,
    companies: companies.data || [], people: people.data || [],
    opportunities: opportunities.data || [], notes: notes.data || [],
    activities: activities.data || [], tasks: tasks.data || [],
  };
}

async function getRecordContext(db, tenantId, recordType, rawId) {
  if (!RECORD_TYPES.has(recordType)) throw new BdInputError('Record type is not supported.', 'record_type_invalid');
  const id = requireBdUuid(rawId, 'id');
  const table = { company: 'bd_companies', person: 'bd_people', opportunity: 'bd_opportunities' }[recordType];
  const recordResult = await db.from(table).select('*').eq('tenant_id', tenantId).eq('id', id).is('deleted_at', null).maybeSingle();
  if (recordResult.error) throw recordResult.error;
  if (!recordResult.data) throw new BdInputError('Record was not found.', 'record_not_found', 404);

  const companyId = recordType === 'company' ? id : recordResult.data.company_id || null;
  const personId = recordType === 'person' ? id : null;
  const opportunityId = recordType === 'opportunity' ? id : null;
  const relationships = { companies: [], people: [], opportunities: [] };
  if (recordType === 'company') {
    const [people, opportunities] = await Promise.all([
      db.from('bd_people').select('*').eq('tenant_id', tenantId).eq('company_id', id).is('deleted_at', null).order('full_name').limit(250),
      db.from('bd_opportunities').select('*').eq('tenant_id', tenantId).eq('company_id', id).is('deleted_at', null).order('updated_at', { ascending: false }).limit(250),
    ]);
    if (people.error) throw people.error;
    if (opportunities.error) throw opportunities.error;
    relationships.people = people.data || [];
    relationships.opportunities = opportunities.data || [];
  } else if (recordType === 'person') {
    if (companyId) {
      const company = await db.from('bd_companies').select('*').eq('tenant_id', tenantId)
        .eq('id', companyId).is('deleted_at', null).maybeSingle();
      if (company.error) throw company.error;
      if (company.data) relationships.companies = [company.data];
    }
    const links = await db.from('bd_opportunity_people').select('opportunity_id, relationship_role')
      .eq('tenant_id', tenantId).eq('person_id', id).limit(250);
    if (links.error) throw links.error;
    const ids = (links.data || []).map((item) => item.opportunity_id);
    if (ids.length) {
      const opportunities = await db.from('bd_opportunities').select('*').eq('tenant_id', tenantId).in('id', ids).is('deleted_at', null);
      if (opportunities.error) throw opportunities.error;
      relationships.opportunities = (opportunities.data || []).map((row) => ({
        ...row,
        relationshipRole: links.data.find((link) => link.opportunity_id === row.id)?.relationship_role || 'stakeholder',
      }));
    }
  } else {
    const [company, peopleLinks] = await Promise.all([
      db.from('bd_companies').select('*').eq('tenant_id', tenantId)
        .eq('id', companyId).is('deleted_at', null).maybeSingle(),
      db.from('bd_opportunity_people').select('person_id, relationship_role').eq('tenant_id', tenantId).eq('opportunity_id', id).limit(250),
    ]);
    if (company.error) throw company.error;
    if (peopleLinks.error) throw peopleLinks.error;
    if (company.data) relationships.companies = [company.data];
    const ids = (peopleLinks.data || []).map((item) => item.person_id);
    if (ids.length) {
      const people = await db.from('bd_people').select('*').eq('tenant_id', tenantId).in('id', ids).is('deleted_at', null);
      if (people.error) throw people.error;
      relationships.people = (people.data || []).map((row) => ({
        ...row,
        relationshipRole: peopleLinks.data.find((link) => link.person_id === row.id)?.relationship_role || 'stakeholder',
      }));
    }
  }

  const relatedPersonIds = recordType === 'person'
    ? [personId]
    : relationships.people.map((row) => row.id).slice(0, 250);
  const relatedOpportunityIds = recordType === 'opportunity'
    ? [opportunityId]
    : relationships.opportunities.map((row) => row.id).slice(0, 250);

  const secondaryLinkQueries = chunks(relatedPersonIds).map((batch) => db.from('bd_activity_people')
    .select('activity_id').eq('tenant_id', tenantId).in('person_id', batch).limit(500));
  const secondaryLinkResults = await Promise.all(secondaryLinkQueries);
  const secondaryActivityIds = [];
  for (const result of secondaryLinkResults) {
    if (result.error) throw result.error;
    for (const link of result.data || []) secondaryActivityIds.push(link.activity_id);
  }

  const activityQueries = [];
  const taskQueries = [];
  const noteQueries = [];
  const fileQueries = [];
  const callQueries = [];
  if (recordType === 'company') {
    activityQueries.push(db.from('bd_activities').select('*').eq('tenant_id', tenantId).eq('company_id', companyId).limit(300));
    taskQueries.push(db.from('bd_tasks').select('*').eq('tenant_id', tenantId).eq('company_id', companyId).is('deleted_at', null).limit(200));
    noteQueries.push(db.from('bd_notes').select('*').eq('tenant_id', tenantId).eq('company_id', companyId).is('deleted_at', null).limit(200));
    fileQueries.push(db.from('bd_files').select('*').eq('tenant_id', tenantId).eq('company_id', companyId).is('deleted_at', null).limit(200));
    callQueries.push(db.from('bd_call_ingestions').select('*').eq('tenant_id', tenantId).eq('company_id', companyId).limit(100));
  }
  if (recordType === 'person') {
    activityQueries.push(db.from('bd_activities').select('*').eq('tenant_id', tenantId).eq('primary_person_id', personId).limit(300));
    taskQueries.push(db.from('bd_tasks').select('*').eq('tenant_id', tenantId).eq('person_id', personId).is('deleted_at', null).limit(200));
    noteQueries.push(db.from('bd_notes').select('*').eq('tenant_id', tenantId).eq('person_id', personId).is('deleted_at', null).limit(200));
    fileQueries.push(db.from('bd_files').select('*').eq('tenant_id', tenantId).eq('person_id', personId).is('deleted_at', null).limit(200));
  }
  activityQueries.push(...relatedQueries(db, 'bd_activities', tenantId, 'opportunity_id', relatedOpportunityIds, { deleted: false, limit: 300 }));
  activityQueries.push(...relatedQueries(db, 'bd_activities', tenantId, 'primary_person_id', recordType === 'company' ? relatedPersonIds : [], { deleted: false, limit: 300 }));
  activityQueries.push(...relatedQueries(db, 'bd_activities', tenantId, 'id', secondaryActivityIds, { deleted: false, limit: 300 }));
  taskQueries.push(...relatedQueries(db, 'bd_tasks', tenantId, 'opportunity_id', relatedOpportunityIds, { limit: 200 }));
  noteQueries.push(...relatedQueries(db, 'bd_notes', tenantId, 'opportunity_id', relatedOpportunityIds, { limit: 200 }));
  fileQueries.push(...relatedQueries(db, 'bd_files', tenantId, 'opportunity_id', relatedOpportunityIds, { limit: 200 }));
  callQueries.push(...relatedQueries(db, 'bd_call_ingestions', tenantId, 'opportunity_id', relatedOpportunityIds, { deleted: false, limit: 100 }));
  if (recordType === 'company') {
    taskQueries.push(...relatedQueries(db, 'bd_tasks', tenantId, 'person_id', relatedPersonIds, { limit: 200 }));
    noteQueries.push(...relatedQueries(db, 'bd_notes', tenantId, 'person_id', relatedPersonIds, { limit: 200 }));
    fileQueries.push(...relatedQueries(db, 'bd_files', tenantId, 'person_id', relatedPersonIds, { limit: 200 }));
  }
  const [timeline, tasks, notes, files, calls, mutations] = await Promise.all([
    combineRowQueries(activityQueries, { limit: 300, sortField: 'occurred_at' }),
    combineRowQueries(taskQueries, { limit: 200, sortField: 'due_at', ascending: true }),
    combineRowQueries(noteQueries, { limit: 200, sortField: 'updated_at' }),
    combineRowQueries(fileQueries, { limit: 200, sortField: 'created_at' }),
    combineRowQueries(callQueries, { limit: 100, sortField: 'occurred_at' }),
    db.from('bd_agent_mutations').select('*').eq('tenant_id', tenantId)
      .eq('object_type', recordType).eq('object_id', id).order('created_at', { ascending: false }).limit(100),
  ]);
  if (mutations.error) throw mutations.error;
  const ownerRows = [recordResult.data, ...relationships.companies, ...relationships.people, ...relationships.opportunities, ...tasks];
  const ownerNames = await ownerNameMap(db, tenantId, ownerRows);
  return {
    recordType,
    record: withOwnerName(recordResult.data, ownerNames),
    relationships: {
      companies: relationships.companies.map((row) => withOwnerName(row, ownerNames)),
      people: relationships.people.map((row) => withOwnerName(row, ownerNames)),
      opportunities: relationships.opportunities.map((row) => withOwnerName(row, ownerNames)),
    },
    timeline,
    tasks: tasks.map((row) => withOwnerName(row, ownerNames)),
    notes,
    files,
    callIntelligence: calls,
    mutationHistory: mutations.data || [],
    runtime: { fileStorage: 'not_connected', transcriptExtraction: 'not_connected', recordQandA: 'not_connected' },
  };
}

async function insertRecord(db, tenantId, actorProfileId, table, objectType, row, action) {
  // These are separate service-role requests, not one database transaction.
  // A mutation-history failure can occur after the business row has committed;
  // autonomous Agent BD writes stay disabled until a transactional RPC exists.
  const result = await db.from(table).insert({
    ...row, tenant_id: tenantId, created_by: actorProfileId,
    updated_by: actorProfileId,
  }).select('*').single();
  if (result.error) throw result.error;
  await recordBdMutation(db, {
    tenantId, actorProfileId, action, objectType, objectId: result.data.id,
    source: 'admin_api', approvalStatus: 'human_approved', resultingValue: result.data,
  });
  const ownerNames = await ownerNameMap(db, tenantId, [result.data]);
  return withOwnerName(result.data, ownerNames);
}

async function validateOwnerProfile(db, tenantId, actorProfileId, ownerProfileId) {
  if (!ownerProfileId || ownerProfileId === actorProfileId) return ownerProfileId || null;
  const result = await db.from('profiles').select('id, tenant_id, status, role')
    .eq('id', ownerProfileId).eq('tenant_id', tenantId).eq('status', 'active')
    .in('role', ['admin', 'staff']).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new BdInputError('Owner must be an active Avalon operator in this tenant.', 'owner_invalid', 409);
  return result.data.id;
}

async function createCompany(db, tenantId, actorProfileId, input) {
  const row = normalizeCompanyInput(input);
  let duplicateQuery = db.from('bd_companies').select('id, name, normalized_domain')
    .eq('tenant_id', tenantId).is('deleted_at', null);
  duplicateQuery = row.normalized_domain
    ? duplicateQuery.eq('normalized_domain', row.normalized_domain)
    : duplicateQuery.eq('normalized_name', row.normalized_name);
  const duplicateResult = await duplicateQuery.limit(2);
  if (duplicateResult.error) throw duplicateResult.error;
  if ((duplicateResult.data || []).length) {
    throw new BdInputError(
      row.normalized_domain
        ? 'An active company already uses that domain.'
        : 'An active company already uses that name. Add a verified domain or open the existing record.',
      'company_duplicate',
      409,
    );
  }
  row.source = 'manual';
  row.owner_profile_id = await validateOwnerProfile(db, tenantId, actorProfileId, row.owner_profile_id || actorProfileId);
  return insertRecord(db, tenantId, actorProfileId, 'bd_companies', 'company', row, 'create_company');
}

async function createPerson(db, tenantId, actorProfileId, input) {
  const row = normalizePersonInput(input);
  if (row.company_id) {
    const companyResult = await db.from('bd_companies').select('id')
      .eq('tenant_id', tenantId).eq('id', row.company_id).is('deleted_at', null).maybeSingle();
    if (companyResult.error) throw companyResult.error;
    if (!companyResult.data) {
      throw new BdInputError(
        'Selected company is not an active Avalon BD company.',
        'person_company_invalid',
        409,
      );
    }
  }
  row.source = 'manual';
  row.owner_profile_id = await validateOwnerProfile(db, tenantId, actorProfileId, row.owner_profile_id || actorProfileId);
  return insertRecord(db, tenantId, actorProfileId, 'bd_people', 'person', row, 'create_person');
}

async function createOpportunity(db, tenantId, actorProfileId, input) {
  const row = normalizeOpportunityInput(input);
  row.source = 'manual';
  row.owner_profile_id = await validateOwnerProfile(db, tenantId, actorProfileId, row.owner_profile_id || actorProfileId);
  if (row.pipeline_stage === 'won') row.probability = 100;
  if (row.pipeline_stage === 'lost') row.probability = 0;
  const contactIds = Array.isArray(input.contactIds) ? [...new Set(input.contactIds.map((id) => requireBdUuid(id, 'contactId')))] : [];
  if (contactIds.length > 25) throw new BdInputError('An opportunity can start with at most 25 contacts.', 'contacts_too_many');
  const opportunity = await insertRecord(db, tenantId, actorProfileId, 'bd_opportunities', 'opportunity', row, 'create_opportunity');
  if (contactIds.length) {
    const links = contactIds.map((personId, index) => ({
      tenant_id: tenantId, opportunity_id: opportunity.id, person_id: personId,
      relationship_role: index === 0 ? 'primary_contact' : 'stakeholder', created_by: actorProfileId,
    }));
    const result = await db.from('bd_opportunity_people').insert(links);
    if (result.error) throw result.error;
  }
  return opportunity;
}

async function createActivity(db, tenantId, actorProfileId, input) {
  const relations = relationIds(input);
  const activityType = String(input.activityType || '').trim();
  if (!ACTIVITY_TYPES.has(activityType)) throw new BdInputError('Activity type is not supported.', 'activity_type_invalid');
  const content = cleanBdText(input.content, { field: 'Activity content', max: 20000, required: true });
  const occurredAt = bdIsoDate(input.occurredAt || new Date().toISOString(), { field: 'Activity timestamp' });
  const source = cleanBdText(input.source, { field: 'Source', max: 120 }) || 'manual';
  const result = await db.from('bd_activities').insert({
    tenant_id: tenantId, occurred_at: occurredAt, activity_type: activityType,
    company_id: relations.company_id, primary_person_id: relations.person_id,
    opportunity_id: relations.opportunity_id, content, source,
    actor_type: 'human', actor_profile_id: actorProfileId,
    approval_status: 'human_approved',
  }).select('*').single();
  if (result.error) throw result.error;
  const personIds = Array.isArray(input.personIds) ? [...new Set(input.personIds.map((id) => requireBdUuid(id, 'personId')))] : [];
  if (personIds.length > 50) throw new BdInputError('An activity can reference at most 50 people.', 'activity_people_too_many');
  if (personIds.length) {
    const linkResult = await db.from('bd_activity_people').insert(personIds.map((personId) => ({
      tenant_id: tenantId, activity_id: result.data.id, person_id: personId,
    })));
    if (linkResult.error) throw linkResult.error;
  }
  await recordBdMutation(db, {
    tenantId, actorProfileId, action: 'create_activity', objectType: 'activity', objectId: result.data.id,
    source: 'admin_api', approvalStatus: 'human_approved', resultingValue: result.data,
  });
  return result.data;
}

async function createTask(db, tenantId, actorProfileId, input) {
  const relations = relationIds(input);
  const priority = String(input.priority || 'normal');
  if (!PRIORITIES.has(priority)) throw new BdInputError('Task priority is not supported.', 'priority_invalid');
  const row = {
    ...relations,
    title: cleanBdText(input.title, { field: 'Task title', max: 240, required: true }),
    owner_profile_id: await validateOwnerProfile(
      db, tenantId, actorProfileId, requireBdUuid(input.ownerProfileId || actorProfileId, 'ownerProfileId'),
    ),
    due_at: bdIsoDate(input.dueAt, { field: 'Due date' }),
    priority,
    status: 'open',
    source: 'manual',
    notes: cleanBdText(input.notes, { field: 'Task notes', max: 10000 }),
  };
  return insertRecord(db, tenantId, actorProfileId, 'bd_tasks', 'task', row, 'create_task');
}

async function addNote(db, tenantId, actorProfileId, input) {
  const relations = relationIds(input);
  if ([relations.company_id, relations.person_id, relations.opportunity_id].filter(Boolean).length !== 1) {
    throw new BdInputError('A note must belong to exactly one record.', 'note_relationship_invalid');
  }
  const row = {
    ...relations,
    title: cleanBdText(input.title, { field: 'Note title', max: 240 }),
    content: cleanBdText(input.content, { field: 'Note content', max: 50000, required: true }),
    source: 'manual',
  };
  return insertRecord(db, tenantId, actorProfileId, 'bd_notes', 'note', row, 'add_note');
}

async function registerFileMetadata(db, tenantId, actorProfileId, input) {
  const relations = relationIds(input);
  if ([relations.company_id, relations.person_id, relations.opportunity_id].filter(Boolean).length !== 1) {
    throw new BdInputError('File metadata must belong to exactly one record.', 'file_relationship_invalid');
  }
  const documentType = String(input.documentType || 'other');
  if (!['proposal', 'contract', 'deck', 'transcript', 'recording', 'other'].includes(documentType)) throw new BdInputError('Document type is not supported.', 'document_type_invalid');
  const row = {
    ...relations,
    file_name: cleanBdText(input.fileName, { field: 'File name', max: 255, required: true }),
    mime_type: cleanBdText(input.mimeType, { field: 'MIME type', max: 160 }),
    size_bytes: bdInteger(input.sizeBytes, { field: 'File size', min: 0, max: 52428800 }),
    document_type: documentType,
    storage_provider: 'unconnected',
    storage_status: 'metadata_only',
    source: 'manual',
  };
  return insertRecord(db, tenantId, actorProfileId, 'bd_files', 'file', row, 'register_file_metadata');
}

async function createList(db, tenantId, actorProfileId, input) {
  const entityType = String(input.entityType || '').trim();
  if (!['company', 'person', 'opportunity'].includes(entityType)) throw new BdInputError('List entity type is not supported.', 'list_entity_invalid');
  const listMode = String(input.listMode || 'manual');
  if (!['manual', 'saved_filter'].includes(listMode)) throw new BdInputError('List mode is not supported.', 'list_mode_invalid');
  const filterDefinition = input.filterDefinition == null ? {} : input.filterDefinition;
  if (!filterDefinition || typeof filterDefinition !== 'object' || Array.isArray(filterDefinition)) throw new BdInputError('List filter must be an object.', 'list_filter_invalid');
  const row = {
    name: cleanBdText(input.name, { field: 'List name', max: 120, required: true }),
    description: cleanBdText(input.description, { field: 'List description', max: 2000 }),
    list_mode: listMode,
    entity_type: entityType,
    filter_definition: filterDefinition,
    owner_profile_id: actorProfileId,
  };
  return insertRecord(db, tenantId, actorProfileId, 'bd_lists', 'list', row, 'create_list');
}

async function addListItem(db, tenantId, actorProfileId, input) {
  const listId = requireBdUuid(input.listId, 'listId');
  const relations = relationIds(input);
  const populated = Object.entries(relations).filter(([, value]) => value);
  if (populated.length !== 1) throw new BdInputError('Choose exactly one company, person, or opportunity.', 'list_item_relationship_invalid');
  const listResult = await db.from('bd_lists').select('id, entity_type').eq('tenant_id', tenantId).eq('id', listId).is('deleted_at', null).maybeSingle();
  if (listResult.error) throw listResult.error;
  if (!listResult.data) throw new BdInputError('List was not found.', 'list_not_found', 404);
  const selectedType = populated[0][0].replace('_id', '');
  if (selectedType !== listResult.data.entity_type) throw new BdInputError('That record type does not match this list.', 'list_item_type_mismatch');
  const result = await db.from('bd_list_items').insert({
    tenant_id: tenantId, list_id: listId, ...relations, added_by: actorProfileId,
  }).select('*').single();
  if (result.error && result.error.code !== '23505') throw result.error;
  const item = result.data || { list_id: listId, ...relations, duplicate: true };
  await recordBdMutation(db, {
    tenantId, actorProfileId, action: 'add_list_item', objectType: 'list', objectId: listId,
    source: 'admin_api', approvalStatus: 'human_approved', resultingValue: item,
  });
  return item;
}

function jsonList(value, field, maxItems = 100) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new BdInputError(`${field} must be a list of at most ${maxItems} items.`, `${field.toLowerCase().replace(/\W+/g, '_')}_invalid`);
  return value;
}

function pacificDateFromTimestamp(rawValue, isoValue) {
  const raw = String(rawValue || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = pacificDateTimeParts(new Date(isoValue));
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

async function normalizeFollowUpTasks(db, tenantId, actorProfileId, value, companyId, opportunityId) {
  const tasks = jsonList(value, 'Follow-up tasks', 10);
  const normalized = [];
  for (const [index, task] of tasks.entries()) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      throw new BdInputError(`Follow-up task ${index + 1} must be an object.`, 'follow_up_tasks_invalid');
    }
    const priority = String(task.priority || 'normal');
    if (!PRIORITIES.has(priority)) throw new BdInputError(`Follow-up task ${index + 1} has an invalid priority.`, 'follow_up_tasks_invalid');
    const requestedOwner = requireBdUuid(task.ownerProfileId || actorProfileId, 'ownerProfileId');
    const ownerProfileId = await validateOwnerProfile(db, tenantId, actorProfileId, requestedOwner);
    const personId = requireBdUuid(task.personId, 'personId', { optional: true });
    if (personId) {
      const personResult = await db.from('bd_people').select('id').eq('tenant_id', tenantId)
        .eq('id', personId).eq('company_id', companyId).is('deleted_at', null).maybeSingle();
      if (personResult.error) throw personResult.error;
      if (!personResult.data) throw new BdInputError(
        `Follow-up task ${index + 1} contact must be active at this company.`,
        'follow_up_task_person_invalid',
        409,
      );
    }
    normalized.push({
      companyId,
      opportunityId,
      personId,
      title: cleanBdText(task.title, { field: `Follow-up task ${index + 1} title`, max: 240, required: true }),
      dueAt: bdIsoDate(task.dueAt, { field: `Follow-up task ${index + 1} due date` }),
      priority,
      notes: cleanBdText(task.notes, { field: `Follow-up task ${index + 1} notes`, max: 10000 }),
      ownerProfileId,
    });
  }
  return normalized;
}

async function recordCall(db, tenantId, actorProfileId, input) {
  const companyId = requireBdUuid(input.companyId, 'companyId');
  const opportunityId = requireBdUuid(input.opportunityId, 'opportunityId');
  const opportunityResult = await db.from('bd_opportunities').select('*')
    .eq('tenant_id', tenantId).eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (opportunityResult.error) throw opportunityResult.error;
  if (!opportunityResult.data) throw new BdInputError('Opportunity was not found.', 'opportunity_not_found', 404);
  if (opportunityResult.data.company_id !== companyId) throw new BdInputError('Call company does not match the opportunity company.', 'call_relationship_invalid', 409);
  const manualNotes = cleanBdText(input.manualNotes, { field: 'Call notes', max: 50000 });
  const summary = cleanBdText(input.summary, { field: 'Call summary', max: 20000 });
  if (!manualNotes && !summary) throw new BdInputError('Add call notes or a summary.', 'call_notes_required');
  if (input.transcriptText || input.transcriptStoragePath || input.recordingUrl) {
    throw new BdInputError('Transcript and recording storage are not connected. Add manual notes or metadata only.', 'call_storage_not_connected', 409);
  }
  const recordingMetadata = input.recordingMetadata == null ? {} : input.recordingMetadata;
  if (!recordingMetadata || typeof recordingMetadata !== 'object' || Array.isArray(recordingMetadata)) throw new BdInputError('Recording metadata must be an object.', 'recording_metadata_invalid');
  const proposedUpdates = input.proposedUpdates == null ? {} : input.proposedUpdates;
  if (!proposedUpdates || typeof proposedUpdates !== 'object' || Array.isArray(proposedUpdates)) throw new BdInputError('Proposed updates must be an object.', 'proposed_updates_invalid');
  if (Object.hasOwn(input, 'applyOpportunityUpdates') && typeof input.applyOpportunityUpdates !== 'boolean') {
    throw new BdInputError('Apply opportunity updates must be true or false.', 'apply_opportunity_updates_invalid');
  }
  const applyOpportunityUpdates = input.applyOpportunityUpdates === true;
  const dealProbability = bdInteger(input.dealProbability, { field: 'Deal probability', min: 0, max: 100 });
  const followUpAt = bdIsoDate(input.followUpAt, { field: 'Follow-up date' });
  const expectedValueCents = bdInteger(input.expectedValueCents, { field: 'Expected value', min: 0 });
  const expectedCloseDate = bdIsoDate(input.expectedCloseDate, { field: 'Expected close date', dateOnly: true });
  const followUpTaskInputs = await normalizeFollowUpTasks(
    db, tenantId, actorProfileId, input.followUpTasks, companyId, opportunityId,
  );
  let opportunityExpectedVersion = null;
  const opportunityPatch = {};
  if (applyOpportunityUpdates) {
    opportunityExpectedVersion = bdInteger(input.opportunityExpectedVersion, {
      field: 'Opportunity expected version', min: 1, optional: false,
    });
    if (Number(opportunityResult.data.version) !== opportunityExpectedVersion) {
      throw new BdInputError('The opportunity changed. Refresh it before applying call updates.', 'version_conflict', 409);
    }
    if (Object.hasOwn(input, 'expectedValueCents')) {
      opportunityPatch.expected_value_cents = expectedValueCents;
    }
    if (Object.hasOwn(input, 'dealProbability')) {
      if (dealProbability == null) throw new BdInputError('Deal probability is required when applying it.', 'deal_probability_invalid');
      opportunityPatch.probability = dealProbability;
    }
    if (Object.hasOwn(input, 'expectedCloseDate')) {
      opportunityPatch.expected_close_date = expectedCloseDate;
    }
    if (Object.hasOwn(input, 'nextAction') || Object.hasOwn(input, 'recommendedFollowUp')) {
      opportunityPatch.next_action = cleanBdText(input.nextAction ?? input.recommendedFollowUp, { field: 'Next action', max: 1000 });
    }
    if (Object.hasOwn(input, 'followUpAt')) {
      opportunityPatch.next_action_date = followUpAt ? pacificDateFromTimestamp(input.followUpAt, followUpAt) : null;
    }
    if (!Object.keys(opportunityPatch).length) {
      throw new BdInputError('Choose at least one opportunity field to apply.', 'opportunity_patch_empty');
    }
    if (opportunityResult.data.pipeline_stage === 'won' && opportunityPatch.probability != null && opportunityPatch.probability !== 100) {
      throw new BdInputError('Won opportunities must keep 100% probability.', 'probability_stage_conflict', 409);
    }
    if (opportunityResult.data.pipeline_stage === 'lost' && opportunityPatch.probability != null && opportunityPatch.probability !== 0) {
      throw new BdInputError('Lost opportunities must keep 0% probability.', 'probability_stage_conflict', 409);
    }
  }
  const row = {
    tenant_id: tenantId,
    company_id: companyId,
    opportunity_id: opportunityId,
    meeting_external_id: cleanBdText(input.meetingExternalId, { field: 'Meeting id', max: 240 }),
    occurred_at: bdIsoDate(input.occurredAt || new Date().toISOString(), { field: 'Call time' }),
    duration_seconds: bdInteger(input.durationSeconds, { field: 'Duration', min: 0, max: 86400 }),
    recording_metadata: recordingMetadata,
    transcript_status: 'not_connected',
    manual_notes: manualNotes,
    summary,
    client_objectives: jsonList(input.clientObjectives, 'Client objectives'),
    pain_points: jsonList(input.painPoints, 'Pain points'),
    budget_min_cents: bdInteger(input.budgetMinCents, { field: 'Minimum budget', min: 0 }),
    budget_max_cents: bdInteger(input.budgetMaxCents, { field: 'Maximum budget', min: 0 }),
    expected_value_cents: expectedValueCents,
    expected_close_date: expectedCloseDate,
    timing: cleanBdText(input.timing, { field: 'Timing', max: 2000 }),
    decision_makers: jsonList(input.decisionMakers, 'Decision makers'),
    stakeholders: jsonList(input.stakeholders, 'Stakeholders'),
    services_of_interest: jsonList(input.servicesOfInterest, 'Services of interest'),
    requirements: jsonList(input.requirements, 'Requirements'),
    objections: jsonList(input.objections, 'Objections'),
    requested_deliverables: jsonList(input.requestedDeliverables, 'Requested deliverables'),
    recommended_next_steps: jsonList(input.recommendedNextSteps, 'Next steps'),
    recommended_follow_up: cleanBdText(input.recommendedFollowUp, { field: 'Recommended follow-up', max: 10000 }),
    follow_up_at: followUpAt,
    deal_probability: dealProbability,
    proposed_updates: proposedUpdates,
    extraction_source: 'manual',
    approval_status: 'approved',
    approved_by: actorProfileId,
    approved_at: new Date().toISOString(),
    created_by: actorProfileId,
  };
  if (row.budget_min_cents != null && row.budget_max_cents != null && row.budget_max_cents < row.budget_min_cents) {
    throw new BdInputError('Maximum budget must be at least the minimum budget.', 'budget_range_invalid');
  }
  const result = await db.from('bd_call_ingestions').insert(row).select('*').single();
  if (result.error) throw result.error;
  const activity = await createActivity(db, tenantId, actorProfileId, {
    activityType: 'call', companyId, opportunityId,
    occurredAt: row.occurred_at,
    content: summary || 'Call notes recorded in Avalon BD.',
    source: 'manual_call_ingestion',
  });
  await recordBdMutation(db, {
    tenantId, actorProfileId, action: 'record_call', objectType: 'call_ingestion', objectId: result.data.id,
    source: 'admin_api', approvalStatus: 'human_approved', resultingValue: result.data,
  });
  let opportunity = null;
  if (applyOpportunityUpdates) {
    opportunity = await updateVersioned(
      db, tenantId, actorProfileId, 'bd_opportunities', 'opportunity', opportunityId,
      opportunityExpectedVersion, opportunityPatch, 'apply_call_opportunity_updates',
    );
  }
  const tasks = [];
  for (const task of followUpTaskInputs) tasks.push(await createTask(db, tenantId, actorProfileId, task));
  return { call: result.data, activity, opportunity, tasks };
}

async function updateVersioned(db, tenantId, actorProfileId, table, objectType, id, expectedVersion, patch, action) {
  const currentResult = await db.from(table).select('*').eq('tenant_id', tenantId).eq('id', id).is('deleted_at', null).maybeSingle();
  if (currentResult.error) throw currentResult.error;
  if (!currentResult.data) throw new BdInputError('Record was not found.', 'record_not_found', 404);
  if (Number(currentResult.data.version) !== expectedVersion) throw new BdInputError('Record changed while you were editing it. Refresh and try again.', 'version_conflict', 409);
  const result = await db.from(table).update({ ...patch, updated_by: actorProfileId, version: expectedVersion + 1 })
    .eq('tenant_id', tenantId).eq('id', id).eq('version', expectedVersion).select('*').maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new BdInputError('Record changed while you were editing it. Refresh and try again.', 'version_conflict', 409);
  await recordBdMutation(db, {
    tenantId, actorProfileId, action, objectType, objectId: id,
    source: 'admin_api', approvalStatus: 'human_approved',
    previousValue: currentResult.data, resultingValue: result.data,
  });
  return result.data;
}

async function updateCoreRecord(db, tenantId, actorProfileId, action, body) {
  const config = {
    update_company: { table: 'bd_companies', objectType: 'company', normalize: normalizeCompanyInput },
    update_person: { table: 'bd_people', objectType: 'person', normalize: normalizePersonInput },
    update_opportunity: { table: 'bd_opportunities', objectType: 'opportunity', normalize: normalizeOpportunityInput },
  }[action];
  const id = requireBdUuid(body.id, 'id');
  const expectedVersion = bdInteger(body.expectedVersion, { field: 'Expected version', min: 1, optional: false });
  const patch = config.normalize(body.patch || {}, { partial: true });
  delete patch.source;
  if (config.objectType === 'opportunity' && (Object.hasOwn(body.patch || {}, 'pipelineStage') || Object.hasOwn(body.patch || {}, 'lostReason'))) {
    throw new BdInputError('Use change_pipeline_stage for stage and lost-reason updates.', 'pipeline_action_required');
  }
  if (Object.hasOwn(patch, 'owner_profile_id') && patch.owner_profile_id) {
    patch.owner_profile_id = await validateOwnerProfile(db, tenantId, actorProfileId, patch.owner_profile_id);
  }
  if (!Object.keys(patch).length) throw new BdInputError('At least one editable field is required.', 'patch_empty');
  return updateVersioned(db, tenantId, actorProfileId, config.table, config.objectType, id, expectedVersion, patch, action);
}

async function changeStage(db, tenantId, actorProfileId, body) {
  const id = requireBdUuid(body.id || body.opportunityId, 'opportunityId');
  const expectedVersion = bdInteger(body.expectedVersion, { field: 'Expected version', min: 1, optional: false });
  const stage = String(body.stage || body.patch?.stage || '').trim();
  if (!BD_PIPELINE_STAGES.includes(stage)) throw new BdInputError('Pipeline stage is not supported.', 'pipeline_stage_invalid');
  const currentResult = await db.from('bd_opportunities').select('id, pipeline_stage, probability, version')
    .eq('tenant_id', tenantId).eq('id', id).is('deleted_at', null).maybeSingle();
  if (currentResult.error) throw currentResult.error;
  if (!currentResult.data) throw new BdInputError('Opportunity was not found.', 'record_not_found', 404);
  const patch = {
    pipeline_stage: stage,
    ...(stage === 'won' ? { probability: 100, lost_reason: null } : {}),
    ...(stage === 'lost' ? { probability: 0, lost_reason: cleanBdText(body.lostReason, { field: 'Lost reason', max: 1000 }) } : {}),
    ...(!['won', 'lost'].includes(stage) ? { lost_reason: null } : {}),
    ...(['won', 'lost'].includes(currentResult.data.pipeline_stage) && Object.hasOwn(REOPEN_PROBABILITY, stage)
      ? { probability: REOPEN_PROBABILITY[stage] }
      : {}),
  };
  const opportunity = await updateVersioned(db, tenantId, actorProfileId, 'bd_opportunities', 'opportunity', id, expectedVersion, patch, 'change_pipeline_stage');
  const activity = await createActivity(db, tenantId, actorProfileId, {
    activityType: 'status_change', companyId: opportunity.company_id, opportunityId: opportunity.id,
    content: `Pipeline stage changed to ${stage}.`, source: 'admin_pipeline',
  });
  return { opportunity, activity };
}

async function updateTask(db, tenantId, actorProfileId, body, complete = false) {
  const id = requireBdUuid(body.id || body.taskId, 'taskId');
  const expectedVersion = bdInteger(body.expectedVersion, { field: 'Expected version', min: 1, optional: false });
  const patch = {};
  if (complete) {
    patch.status = 'completed';
    patch.completed_at = new Date().toISOString();
  } else {
    const input = body.patch || {};
    if (Object.hasOwn(input, 'title')) patch.title = cleanBdText(input.title, { field: 'Task title', max: 240, required: true });
    if (Object.hasOwn(input, 'dueAt')) patch.due_at = bdIsoDate(input.dueAt, { field: 'Due date' });
    if (Object.hasOwn(input, 'priority')) {
      if (!PRIORITIES.has(input.priority)) throw new BdInputError('Task priority is not supported.', 'priority_invalid');
      patch.priority = input.priority;
    }
    if (Object.hasOwn(input, 'status')) {
      if (!['open', 'in_progress', 'cancelled'].includes(input.status)) throw new BdInputError('Task status is not supported.', 'task_status_invalid');
      patch.status = input.status;
      patch.completed_at = null;
    }
    if (Object.hasOwn(input, 'notes')) patch.notes = cleanBdText(input.notes, { field: 'Task notes', max: 10000 });
    if (!Object.keys(patch).length) throw new BdInputError('At least one task field is required.', 'patch_empty');
  }
  return updateVersioned(db, tenantId, actorProfileId, 'bd_tasks', 'task', id, expectedVersion, patch, complete ? 'complete_task' : 'update_task');
}

async function assertNoArchiveDependencies(db, tenantId, recordType, id) {
  const dependencies = {
    company: [
      ['bd_people', 'company_id', true], ['bd_opportunities', 'company_id', true],
      ['bd_activities', 'company_id', false], ['bd_tasks', 'company_id', true],
      ['bd_notes', 'company_id', true], ['bd_files', 'company_id', true],
      ['bd_list_items', 'company_id', false], ['bd_call_ingestions', 'company_id', false],
    ],
    person: [
      ['bd_opportunity_people', 'person_id', false], ['bd_activities', 'primary_person_id', false],
      ['bd_activity_people', 'person_id', false], ['bd_tasks', 'person_id', true],
      ['bd_notes', 'person_id', true], ['bd_files', 'person_id', true],
      ['bd_list_items', 'person_id', false],
    ],
    opportunity: [
      ['bd_opportunity_people', 'opportunity_id', false], ['bd_activities', 'opportunity_id', false],
      ['bd_tasks', 'opportunity_id', true], ['bd_notes', 'opportunity_id', true],
      ['bd_files', 'opportunity_id', true], ['bd_list_items', 'opportunity_id', false],
      ['bd_call_ingestions', 'opportunity_id', false],
    ],
  }[recordType] || [];
  for (const [table, column, hasSoftDelete] of dependencies) {
    let query = db.from(table).select(column).eq('tenant_id', tenantId).eq(column, id);
    if (hasSoftDelete) query = query.is('deleted_at', null);
    const result = await query.limit(1);
    if (result.error) throw result.error;
    if ((result.data || []).length) {
      throw new BdInputError(
        'Archive blocked because this record still has active relationships. Reassign, merge, or archive the linked records first.',
        'archive_dependencies_active',
        409,
      );
    }
  }
}

async function softDelete(db, tenantId, actorProfileId, body) {
  const type = String(body.recordType || '').trim();
  const config = {
    company: ['bd_companies', 'company'], person: ['bd_people', 'person'], opportunity: ['bd_opportunities', 'opportunity'],
    task: ['bd_tasks', 'task'], note: ['bd_notes', 'note'], file: ['bd_files', 'file'], list: ['bd_lists', 'list'],
  }[type];
  if (!config) throw new BdInputError('Record type cannot be archived.', 'record_type_invalid');
  const id = requireBdUuid(body.id, 'id');
  const expectedVersion = bdInteger(body.expectedVersion, { field: 'Expected version', min: 1, optional: false });
  const [table, objectType] = config;
  if (['company', 'person', 'opportunity'].includes(type)) {
    await assertNoArchiveDependencies(db, tenantId, type, id);
  }
  const hasDeletedBy = ['bd_companies', 'bd_people', 'bd_opportunities'].includes(table);
  return updateVersioned(db, tenantId, actorProfileId, table, objectType, id, expectedVersion, {
    deleted_at: new Date().toISOString(), ...(hasDeletedBy ? { deleted_by: actorProfileId } : {}),
  }, 'soft_delete');
}

async function handlePost(db, tenantId, actorProfileId, body) {
  const action = String(body.action || '').trim();
  if (!POST_ACTIONS.has(action)) throw new BdInputError('Unknown Avalon BD action.', 'action_invalid');
  if (action === 'create_company') return { record: await createCompany(db, tenantId, actorProfileId, body.company || body.record) };
  if (action === 'create_person') return { record: await createPerson(db, tenantId, actorProfileId, body.person || body.record) };
  if (action === 'create_opportunity') return { record: await createOpportunity(db, tenantId, actorProfileId, body.opportunity || body.record) };
  if (action === 'create_activity') return { record: await createActivity(db, tenantId, actorProfileId, body.activity || body.record) };
  if (action === 'create_task') return { record: await createTask(db, tenantId, actorProfileId, body.task || body.record) };
  if (action === 'add_note') return { record: await addNote(db, tenantId, actorProfileId, body.note || body.record) };
  if (action === 'register_file_metadata') return {
    record: await registerFileMetadata(db, tenantId, actorProfileId, body.file || body.record),
    storageConnected: false,
  };
  if (action === 'create_list') return { record: await createList(db, tenantId, actorProfileId, body.list || body.record) };
  if (action === 'add_list_item') return { record: await addListItem(db, tenantId, actorProfileId, body.item || body.record) };
  if (action === 'record_call') return {
    ...(await recordCall(db, tenantId, actorProfileId, body.call || body.record)),
    transcriptExtractionConnected: false,
    recordingStorageConnected: false,
  };
  if (action === 'merge_records') {
    const recordType = String(body.recordType || '').trim();
    if (!['company', 'person'].includes(recordType)) throw new BdInputError('Only company and person records can be merged.', 'bd_merge_type_invalid');
    const sourceId = requireBdUuid(body.sourceId, 'sourceId');
    const targetId = requireBdUuid(body.targetId, 'targetId');
    if (sourceId === targetId) throw new BdInputError('Choose two different records to merge.', 'bd_merge_same_record');
    const sourceVersion = bdInteger(body.sourceExpectedVersion, { field: 'Source expected version', min: 1, optional: false });
    const targetVersion = bdInteger(body.targetExpectedVersion, { field: 'Target expected version', min: 1, optional: false });
    const result = await db.rpc('bd_merge_records', {
      p_tenant_id: tenantId,
      p_record_type: recordType,
      p_source_id: sourceId,
      p_target_id: targetId,
      p_source_version: sourceVersion,
      p_target_version: targetVersion,
      p_actor_profile_id: actorProfileId,
    });
    if (result.error) throw result.error;
    return { merge: result.data };
  }
  throw new BdInputError('Unknown Avalon BD action.', 'action_invalid');
}

async function handlePatch(db, tenantId, actorProfileId, body) {
  const action = String(body.action || '').trim();
  if (!PATCH_ACTIONS.has(action)) throw new BdInputError('Unknown Avalon BD update.', 'action_invalid');
  if (['update_company', 'update_person', 'update_opportunity'].includes(action)) return { record: await updateCoreRecord(db, tenantId, actorProfileId, action, body) };
  if (action === 'change_pipeline_stage') return changeStage(db, tenantId, actorProfileId, body);
  if (action === 'complete_task') return { record: await updateTask(db, tenantId, actorProfileId, body, true) };
  if (action === 'update_task') return { record: await updateTask(db, tenantId, actorProfileId, body, false) };
  return { record: await softDelete(db, tenantId, actorProfileId, body) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  if (!requireBdCrmEnabled(res)) return;
  const { db, tenantId, user } = authed;
  if (!tenantId) return res.status(403).json({ error: 'Admin tenant is required.', code: 'tenant_required' });

  try {
    if (req.method === 'GET') {
      const view = String(req.query?.view || 'dashboard').trim();
      let result;
      if (view === 'dashboard') result = await dashboard(db, tenantId);
      else if (view === 'search') result = await globalSearch(db, tenantId, req.query?.q);
      else if (view === 'record') result = await getRecordContext(db, tenantId, String(req.query?.recordType || ''), req.query?.id);
      else if (LIST_VIEWS.has(view)) result = await listView(db, tenantId, view, req.query || {});
      else throw new BdInputError('Unknown Avalon BD view.', 'view_invalid');
      await writeAuditEvent(db, {
        tenantId, actorProfileId: user.id, action: 'admin_bd_read', entityType: 'avalon_bd',
        phiTouched: false, payload: { view, recordType: req.query?.recordType || null },
      });
      return res.status(200).json(result);
    }

    if (!['POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = bodyObject(req);
    const result = req.method === 'POST'
      ? await handlePost(db, tenantId, user.id, body)
      : await handlePatch(db, tenantId, user.id, body);
    await writeAuditEvent(db, {
      tenantId, actorProfileId: user.id, action: `admin_bd_${String(body.action || 'mutation')}`,
      entityType: 'avalon_bd', phiTouched: false,
      payload: { action: body.action, recordId: result.record?.id || result.opportunity?.id || null },
    });
    return res.status(req.method === 'POST' ? 201 : 200).json({ ok: true, ...result });
  } catch (error) {
    console.warn('[admin/bd] failed', safeLogContext(error, 'admin_bd_failed'));
    if (missingMigration(error)) {
      return res.status(503).json({ error: 'Avalon BD database migration 064 is required.', code: 'migration_required' });
    }
    if (error instanceof BdInputError || (Number(error?.status) >= 400 && Number(error?.status) < 500)) {
      return res.status(Number(error.status) || 400).json({ error: error.message, code: error.code || 'bd_request_rejected' });
    }
    if (String(error?.code || '').toUpperCase() === 'P0001' && String(error?.message || '').startsWith('bd_merge_')) {
      const code = String(error.message);
      const status = code.endsWith('_not_found') ? 404 : code === 'bd_merge_admin_required' ? 403 : 409;
      const messages = {
        bd_merge_source_not_found: 'Source record was not found.',
        bd_merge_target_not_found: 'Target record was not found.',
        bd_merge_active_records_required: 'Both merge records must still be active.',
        bd_merge_version_conflict: 'A merge record changed. Refresh both records and review again.',
        bd_merge_same_record: 'Choose two different records to merge.',
        bd_merge_admin_required: 'An active Avalon admin must perform this merge.',
        bd_merge_person_company_mismatch: 'Both people must be linked to the same company before they can be merged.',
        bd_merge_person_collision: 'Merge blocked: both companies have the same active name-only contact.',
        bd_merge_opportunity_person_collision: 'Merge blocked: both people are linked to the same opportunity.',
        bd_merge_activity_person_collision: 'Merge blocked: both people appear on the same activity.',
        bd_merge_list_collision: 'Merge blocked: both records already belong to the same list.',
      };
      return res.status(status).json({ error: messages[code] || 'Records cannot be merged safely.', code });
    }
    if (error?.code === '23505') return res.status(409).json({ error: 'A matching active record already exists.', code: 'duplicate_record' });
    if (error?.code === '23503') return res.status(409).json({ error: 'A linked Avalon BD record was not found.', code: 'relationship_invalid' });
    return res.status(500).json({ error: 'Avalon BD could not complete that request.', code: safeErrorCode(error, 'admin_bd_failed') });
  }
}
