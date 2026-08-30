const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const BD_PIPELINE_STAGES = Object.freeze([
  'new', 'researching', 'approved', 'contacted', 'engaged',
  'discovery', 'proposal', 'negotiation', 'won', 'lost',
]);

export const BD_COMPANY_TYPES = Object.freeze([
  'Venue', 'Festival', 'Hotel', 'Record Label', 'Corporate', 'Fitness',
  'Wellness', 'Hospitality', 'Sports', 'Brand', 'Agency', 'Healthcare', 'Other',
]);

export const BD_OPPORTUNITY_TYPES = Object.freeze([
  'Event Wellness', 'Artist Wellness', 'Employee Wellness', 'Corporate Wellness',
  'Venue Partnership', 'Hospitality Partnership', 'Retainer', 'Activation',
  'Strategic Partnership', 'Other',
]);

export class BdInputError extends Error {
  constructor(message, code = 'bd_input_invalid', status = 400) {
    super(message);
    this.name = 'BdInputError';
    this.code = code;
    this.status = status;
  }
}

export function cleanBdText(value, { field = 'Value', max = 500, required = false } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new BdInputError(`${field} is required.`, `${field.toLowerCase().replace(/\W+/g, '_')}_required`);
  if (text.length > max) throw new BdInputError(`${field} is too long.`, `${field.toLowerCase().replace(/\W+/g, '_')}_too_long`);
  return text || null;
}

export function normalizeBdName(value, { field = 'Name', max = 240 } = {}) {
  const name = cleanBdText(value, { field, max, required: true });
  return { name, normalizedName: name.toLocaleLowerCase('en-US').replace(/\s+/g, ' ') };
}

export function normalizeBdEmail(value, { required = false } = {}) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email && !required) return null;
  if (!EMAIL_RE.test(email) || email.length > 320) {
    throw new BdInputError('Enter a valid email address.', 'email_invalid');
  }
  return email;
}

export function normalizeBdDomain(value, { required = false } = {}) {
  let raw = String(value ?? '').trim().toLowerCase();
  if (!raw && !required) return null;
  if (!raw) throw new BdInputError('Company website or domain is required.', 'domain_required');
  if (!/^https?:\/\//.test(raw)) raw = `https://${raw}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new BdInputError('Enter a valid company website or domain.', 'domain_invalid');
  }
  const domain = url.hostname.replace(/^www\./, '').replace(/\.$/, '');
  if (!domain.includes('.') || domain === 'localhost' || /^\d+(?:\.\d+){3}$/.test(domain)) {
    throw new BdInputError('Enter a public company domain.', 'domain_invalid');
  }
  return domain;
}

export function bdWebsiteUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const domain = normalizeBdDomain(raw, { required: true });
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new BdInputError('Website must use HTTP or HTTPS.', 'website_invalid');
  if (url.username || url.password) throw new BdInputError('Website cannot include embedded credentials.', 'website_invalid');
  url.hash = '';
  if (!url.pathname) url.pathname = '/';
  return { url: url.toString(), domain };
}

export function requireBdUuid(value, field = 'id', { optional = false } = {}) {
  const id = String(value ?? '').trim();
  if (!id && optional) return null;
  if (!UUID_RE.test(id)) throw new BdInputError(`${field} must be a valid id.`, `${field.replace(/\W+/g, '_')}_invalid`);
  return id;
}

export function normalizeBdTags(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new BdInputError('Tags must be a list.', 'tags_invalid');
  const tags = [...new Set(value.map((tag) => String(tag || '').trim()).filter(Boolean))];
  if (tags.length > 30 || tags.some((tag) => tag.length > 80)) throw new BdInputError('Use at most 30 tags of 80 characters each.', 'tags_invalid');
  return tags;
}

export function bdInteger(value, { field, min = 0, max = Number.MAX_SAFE_INTEGER, optional = true } = {}) {
  if ((value == null || value === '') && optional) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new BdInputError(`${field} must be a whole number between ${min} and ${max}.`, `${field.toLowerCase().replace(/\W+/g, '_')}_invalid`);
  }
  return number;
}

export function bdIsoDate(value, { field = 'Date', dateOnly = false, optional = true } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw && optional) return null;
  if (dateOnly) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
      throw new BdInputError(`${field} must be a valid date.`, `${field.toLowerCase().replace(/\W+/g, '_')}_invalid`);
    }
    return raw;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new BdInputError(`${field} must be a valid date and time.`, `${field.toLowerCase().replace(/\W+/g, '_')}_invalid`);
  return parsed.toISOString();
}

export function normalizeCompanyInput(input = {}, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BdInputError('Company payload is required.', 'company_required');
  const row = {};
  if (!partial || Object.hasOwn(input, 'name')) {
    const name = normalizeBdName(input.name, { field: 'Company name' });
    row.name = name.name;
    row.normalized_name = name.normalizedName;
  }
  if (Object.hasOwn(input, 'website') || Object.hasOwn(input, 'websiteUrl')) {
    const website = bdWebsiteUrl(input.websiteUrl ?? input.website);
    row.website_url = website?.url || null;
    row.normalized_domain = website?.domain || null;
  }
  if (Object.hasOwn(input, 'companyType')) {
    if (!BD_COMPANY_TYPES.includes(input.companyType)) throw new BdInputError('Company type is not supported.', 'company_type_invalid');
    row.company_type = input.companyType;
  }
  const textFields = {
    industry: ['industry', 160], location: ['location', 240], company_size: ['companySize', 80],
    description: ['description', 10000], next_action: ['nextAction', 1000], source: ['source', 120],
    logo_url: ['logoUrl', 1000],
  };
  for (const [column, [key, max]] of Object.entries(textFields)) {
    if (Object.hasOwn(input, key)) row[column] = cleanBdText(input[key], { field: key, max });
  }
  if (Object.hasOwn(input, 'ownerProfileId')) row.owner_profile_id = requireBdUuid(input.ownerProfileId, 'ownerProfileId', { optional: true });
  if (Object.hasOwn(input, 'relationshipStatus')) {
    const allowed = ['unknown', 'cold', 'warm', 'active', 'partner', 'dormant', 'do_not_contact'];
    if (!allowed.includes(input.relationshipStatus)) throw new BdInputError('Relationship status is not supported.', 'relationship_status_invalid');
    row.relationship_status = input.relationshipStatus;
  }
  if (Object.hasOwn(input, 'fitScore')) row.fit_score = bdInteger(input.fitScore, { field: 'Fit score', min: 0, max: 100 });
  if (Object.hasOwn(input, 'estimatedOpportunityValueCents')) row.estimated_opportunity_value_cents = bdInteger(input.estimatedOpportunityValueCents, { field: 'Estimated value', min: 0 });
  if (Object.hasOwn(input, 'nextActionDate')) row.next_action_date = bdIsoDate(input.nextActionDate, { field: 'Next action date', dateOnly: true });
  if (Object.hasOwn(input, 'tags')) row.tags = normalizeBdTags(input.tags);
  if (!partial) {
    row.company_type ??= 'Other';
    row.source ??= 'manual';
  }
  return row;
}

export function normalizePersonInput(input = {}, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BdInputError('Person payload is required.', 'person_required');
  const row = {};
  if (!partial || Object.hasOwn(input, 'fullName')) {
    const name = normalizeBdName(input.fullName, { field: 'Full name' });
    row.full_name = name.name;
    row.normalized_full_name = name.normalizedName;
  }
  if (Object.hasOwn(input, 'companyId')) row.company_id = requireBdUuid(input.companyId, 'companyId', { optional: true });
  if (Object.hasOwn(input, 'email')) {
    row.email = normalizeBdEmail(input.email);
    row.normalized_email = row.email;
  }
  const textFields = {
    title: ['title', 240], phone: ['phone', 80], linkedin_url: ['linkedinUrl', 1000],
    location: ['location', 240], source: ['source', 120], next_action: ['nextAction', 1000],
    notes_summary: ['notes', 10000],
  };
  for (const [column, [key, max]] of Object.entries(textFields)) {
    if (Object.hasOwn(input, key)) row[column] = cleanBdText(input[key], { field: key, max });
  }
  if (Object.hasOwn(input, 'socialProfiles')) {
    if (!input.socialProfiles || typeof input.socialProfiles !== 'object' || Array.isArray(input.socialProfiles)) throw new BdInputError('Social profiles must be an object.', 'social_profiles_invalid');
    row.social_profiles = input.socialProfiles;
  }
  if (Object.hasOwn(input, 'ownerProfileId')) row.owner_profile_id = requireBdUuid(input.ownerProfileId, 'ownerProfileId', { optional: true });
  if (Object.hasOwn(input, 'relationshipStrength')) {
    if (!['unknown', 'cold', 'warm', 'strong'].includes(input.relationshipStrength)) throw new BdInputError('Relationship strength is not supported.', 'relationship_strength_invalid');
    row.relationship_strength = input.relationshipStrength;
  }
  if (Object.hasOwn(input, 'decisionMakerStatus')) {
    if (!['unknown', 'influencer', 'decision_maker', 'champion', 'blocker'].includes(input.decisionMakerStatus)) throw new BdInputError('Decision-maker status is not supported.', 'decision_maker_status_invalid');
    row.decision_maker_status = input.decisionMakerStatus;
  }
  if (Object.hasOwn(input, 'nextActionDate')) row.next_action_date = bdIsoDate(input.nextActionDate, { field: 'Next action date', dateOnly: true });
  if (Object.hasOwn(input, 'tags')) row.tags = normalizeBdTags(input.tags);
  if (!partial) row.source ??= 'manual';
  return row;
}

export function normalizeOpportunityInput(input = {}, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BdInputError('Opportunity payload is required.', 'opportunity_required');
  const row = {};
  if (!partial || Object.hasOwn(input, 'name')) {
    const name = normalizeBdName(input.name, { field: 'Opportunity name' });
    row.name = name.name;
    row.normalized_name = name.normalizedName;
  }
  if (!partial || Object.hasOwn(input, 'companyId')) row.company_id = requireBdUuid(input.companyId, 'companyId');
  if (Object.hasOwn(input, 'ownerProfileId')) row.owner_profile_id = requireBdUuid(input.ownerProfileId, 'ownerProfileId', { optional: true });
  if (Object.hasOwn(input, 'opportunityType')) {
    if (!BD_OPPORTUNITY_TYPES.includes(input.opportunityType)) throw new BdInputError('Opportunity type is not supported.', 'opportunity_type_invalid');
    row.opportunity_type = input.opportunityType;
  }
  if (Object.hasOwn(input, 'pipelineStage')) {
    if (!BD_PIPELINE_STAGES.includes(input.pipelineStage)) throw new BdInputError('Pipeline stage is not supported.', 'pipeline_stage_invalid');
    row.pipeline_stage = input.pipelineStage;
  }
  if (Object.hasOwn(input, 'priority')) {
    if (!['low', 'normal', 'high', 'urgent'].includes(input.priority)) throw new BdInputError('Priority is not supported.', 'priority_invalid');
    row.priority = input.priority;
  }
  const textFields = {
    source: ['source', 120], next_action: ['nextAction', 1000], description: ['description', 20000],
    notes_summary: ['notes', 10000], lost_reason: ['lostReason', 1000],
  };
  for (const [column, [key, max]] of Object.entries(textFields)) {
    if (Object.hasOwn(input, key)) row[column] = cleanBdText(input[key], { field: key, max });
  }
  if (Object.hasOwn(input, 'expectedValueCents')) row.expected_value_cents = bdInteger(input.expectedValueCents, { field: 'Expected value', min: 0 });
  if (Object.hasOwn(input, 'probability')) row.probability = bdInteger(input.probability, { field: 'Probability', min: 0, max: 100, optional: false });
  if (Object.hasOwn(input, 'fitScore')) row.fit_score = bdInteger(input.fitScore, { field: 'Fit score', min: 0, max: 100 });
  if (Object.hasOwn(input, 'expectedCloseDate')) row.expected_close_date = bdIsoDate(input.expectedCloseDate, { field: 'Expected close date', dateOnly: true });
  if (Object.hasOwn(input, 'nextActionDate')) row.next_action_date = bdIsoDate(input.nextActionDate, { field: 'Next action date', dateOnly: true });
  if (Object.hasOwn(input, 'tags')) row.tags = normalizeBdTags(input.tags);
  if (!partial) {
    row.opportunity_type ??= 'Other';
    row.pipeline_stage ??= 'new';
    row.priority ??= 'normal';
    row.source ??= 'manual';
    row.probability ??= 10;
  }
  return row;
}

function compactRecordSnapshot(row) {
  if (!row || typeof row !== 'object') return null;
  const blocked = new Set(['description', 'notes_summary', 'content', 'manual_notes', 'recording_metadata']);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !blocked.has(key)));
}

export async function recordBdMutation(db, {
  tenantId, actorType = 'human', actorProfileId = null, agentIdentityId = null,
  modelUsed = null, action, source = 'admin_api', confidence = null,
  approvalStatus = 'human_approved', objectType, objectId, previousValue = null,
  resultingValue = null, requestId = null,
}) {
  if (!db || !tenantId || !action || !objectType || !objectId) throw new Error('bd_mutation_context_required');
  const row = {
    tenant_id: tenantId,
    actor_type: actorType,
    actor_profile_id: actorProfileId,
    agent_identity_id: agentIdentityId,
    model_used: modelUsed,
    action,
    source,
    confidence: confidence == null ? null : Number(confidence),
    approval_status: approvalStatus,
    object_type: objectType,
    object_id: objectId,
    previous_value: compactRecordSnapshot(previousValue),
    resulting_value: compactRecordSnapshot(resultingValue),
    request_id: requestId,
  };
  const query = requestId
    ? db.from('bd_agent_mutations').upsert(row, { onConflict: 'tenant_id,request_id', ignoreDuplicates: true })
    : db.from('bd_agent_mutations').insert(row);
  const { error } = await query;
  if (error) throw error;
}

export async function assertBdAgentPermission(db, tenantId, agentKey, objectType, action) {
  const { data: identity, error: identityError } = await db.from('bd_agent_identities')
    .select('id, agent_key, display_name, status')
    .eq('tenant_id', tenantId).eq('agent_key', String(agentKey || '')).maybeSingle();
  if (identityError) throw identityError;
  if (!identity || identity.status !== 'active') throw new BdInputError('Agent is not active.', 'agent_not_active', 403);
  const { data: permission, error: permissionError } = await db.from('bd_agent_permissions')
    .select('permission_state, constraints, expires_at')
    .eq('tenant_id', tenantId).eq('agent_identity_id', identity.id)
    .eq('object_type', objectType).eq('action', action).maybeSingle();
  if (permissionError) throw permissionError;
  if (!permission || permission.permission_state === 'denied'
    || (permission.expires_at && Date.parse(permission.expires_at) <= Date.now())) {
    throw new BdInputError('Agent permission is not active.', 'agent_permission_denied', 403);
  }
  return { identity, permission, requiresApproval: permission.permission_state === 'approval_required' };
}

/**
 * Deliberately fail-closed V1 seam. A future autonomous writer must replace
 * this with a database-transactional operation that consumes a persisted,
 * exact-payload approval artifact. Merely naming an approver is not proof.
 */
export async function executeAuthorizedBdAgentMutation() {
  throw new BdInputError(
    'Autonomous Avalon BD writes are not connected. A persisted exact-payload approval is required.',
    'agent_write_path_not_connected',
    503,
  );
}

async function ensureRobBotIdentity(db, tenantId, actorProfileId) {
  const existing = await db.from('bd_agent_identities')
    .select('id, agent_key, display_name, status')
    .eq('tenant_id', tenantId).eq('agent_key', 'robbot3k').maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const { data, error } = await db.from('bd_agent_identities').insert({
    tenant_id: tenantId,
    agent_key: 'robbot3k',
    display_name: 'Rob Bot 3000',
    status: 'disabled',
    description: 'Attribution identity for RobBot3K CRM reconciliation. Execution permission remains independently gated.',
    created_by: actorProfileId,
  }).select('id, agent_key, display_name, status').single();
  if (error?.code === '23505') {
    const raced = await db.from('bd_agent_identities').select('id, agent_key, display_name, status')
      .eq('tenant_id', tenantId).eq('agent_key', 'robbot3k').single();
    if (raced.error) throw raced.error;
    return raced.data;
  }
  if (error) throw error;
  return data;
}

async function lookupOne(query) {
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function createOrFind(db, table, row, findAgain) {
  const result = await db.from(table).insert(row).select('*').single();
  if (!result.error) return { record: result.data, created: true };
  if (result.error?.code !== '23505') throw result.error;
  const existing = await findAgain();
  if (!existing) throw result.error;
  return { record: existing, created: false };
}

function prospectDomain(prospect) {
  const payload = prospect?.source_payload && typeof prospect.source_payload === 'object' ? prospect.source_payload : {};
  for (const candidate of [payload.website_url, payload.website, payload.domain]) {
    try {
      const domain = normalizeBdDomain(candidate);
      if (domain) return { domain, websiteUrl: bdWebsiteUrl(candidate)?.url || null };
    } catch { /* source data stays reviewable without fabricating a domain */ }
  }
  return { domain: null, websiteUrl: null };
}

async function findNamedPersonAtCompany(db, tenantId, companyId, normalizedFullName) {
  const result = await db.from('bd_people').select('*')
    .eq('tenant_id', tenantId).eq('company_id', companyId)
    .eq('normalized_full_name', normalizedFullName).is('deleted_at', null)
    .order('created_at', { ascending: true }).limit(2);
  if (result.error) throw result.error;
  if ((result.data || []).length > 1) {
    throw new BdInputError(
      'More than one contact at this company has that name. Add an email or merge the duplicate people before approval.',
      'person_name_ambiguous',
      409,
    );
  }
  return result.data?.[0] || null;
}

async function findNameOnlyPersonAtCompany(db, tenantId, companyId, normalizedFullName) {
  const result = await db.from('bd_people').select('*')
    .eq('tenant_id', tenantId).eq('company_id', companyId)
    .eq('normalized_full_name', normalizedFullName).is('normalized_email', null)
    .is('deleted_at', null).maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

function assertPersonCompany(person, companyId) {
  if (person?.company_id && person.company_id !== companyId) {
    throw new BdInputError(
      'That email already belongs to a contact at another company. Review or merge the CRM record before approval.',
      'person_company_conflict',
      409,
    );
  }
}

async function enrichPersonFromProspect(db, {
  tenantId, actorProfileId, agent, prospectId, person, companyId, email, title,
}) {
  if (!person) return null;
  assertPersonCompany(person, companyId);
  if (email) {
    const emailOwner = await lookupOne(db.from('bd_people').select('*')
      .eq('tenant_id', tenantId).eq('normalized_email', email).is('deleted_at', null));
    if (emailOwner && emailOwner.id !== person.id) {
      throw new BdInputError(
        'That email belongs to a different active person. Review or merge the CRM records before approval.',
        'person_email_conflict',
        409,
      );
    }
    if (person.normalized_email && person.normalized_email !== email) {
      throw new BdInputError(
        'This linked person already has a different email. Review or merge the CRM records before approval.',
        'person_email_conflict',
        409,
      );
    }
  }
  const normalizedTitle = cleanBdText(title, { field: 'Contact title', max: 240 });
  const patch = {
    ...(!person.company_id ? { company_id: companyId } : {}),
    ...(email && !person.normalized_email ? { email, normalized_email: email } : {}),
    ...(normalizedTitle && normalizedTitle !== person.title && (!person.title || person.source === 'robbot3k')
      ? { title: normalizedTitle }
      : {}),
  };
  if (!Object.keys(patch).length) return person;
  const result = await db.from('bd_people').update({
    ...patch,
    version: Number(person.version) + 1,
    updated_by: actorProfileId,
    updated_by_agent_id: agent.id,
  }).eq('tenant_id', tenantId).eq('id', person.id).eq('version', person.version)
    .is('deleted_at', null).select('*').maybeSingle();
  if (result.error?.code === '23505') {
    throw new BdInputError(
      'That email or name-only contact already belongs to another active person. Review or merge the CRM records before approval.',
      'person_email_conflict',
      409,
    );
  }
  if (result.error) throw result.error;
  let attached = result.data;
  if (!attached) {
    attached = await lookupOne(db.from('bd_people').select('*')
      .eq('tenant_id', tenantId).eq('id', person.id).is('deleted_at', null));
    if (!attached) throw new BdInputError('The contact changed during reconciliation.', 'person_version_conflict', 409);
    assertPersonCompany(attached, companyId);
    const fieldsMatch = attached.company_id === companyId
      && (!email || attached.normalized_email === email)
      && (!patch.title || attached.title === patch.title);
    if (fieldsMatch) return attached;
    throw new BdInputError('The contact changed during reconciliation.', 'person_version_conflict', 409);
  }
  await recordBdMutation(db, {
    tenantId, actorType: 'agent', actorProfileId, agentIdentityId: agent.id,
    modelUsed: 'deterministic_reconciliation_v1', confidence: 1,
    action: 'enrich_person_from_prospect', source: 'admin_human_trigger',
    approvalStatus: 'human_approved', objectType: 'person', objectId: attached.id,
    previousValue: person, resultingValue: attached,
    requestId: `robbot3k-reconcile:${prospectId}:person-enrichment:${attached.id}:${attached.version}`,
  });
  return attached;
}

async function findCompanyByName(db, tenantId, normalizedName, { domain = null } = {}) {
  const result = await db.from('bd_companies').select('*')
    .eq('tenant_id', tenantId).eq('normalized_name', normalizedName)
    .is('deleted_at', null).order('created_at', { ascending: true }).limit(2);
  if (result.error) throw result.error;
  let candidates = result.data || [];
  if (domain) candidates = candidates.filter((candidate) => !candidate.normalized_domain || candidate.normalized_domain === domain);
  if (candidates.length > 1) {
    throw new BdInputError(
      'More than one active company has that name. Add a verified domain or resolve the duplicate companies before approval.',
      'company_name_ambiguous',
      409,
    );
  }
  return candidates[0] || null;
}

async function enrichCompanyFromProspect(db, {
  tenantId, actorProfileId, agent, prospect, company, website,
}) {
  if (website.domain) {
    const domainOwner = await lookupOne(db.from('bd_companies').select('*')
      .eq('tenant_id', tenantId).eq('normalized_domain', website.domain).is('deleted_at', null));
    if (domainOwner && domainOwner.id !== company.id) {
      throw new BdInputError(
        'That domain belongs to a different active company. Review or merge the CRM companies before approval.',
        'company_domain_conflict',
        409,
      );
    }
    if (company.normalized_domain && company.normalized_domain !== website.domain) {
      throw new BdInputError(
        'This linked company already has a different domain. Review or merge the CRM companies before approval.',
        'company_domain_conflict',
        409,
      );
    }
  }
  const patch = {
    ...(website.domain && !company.normalized_domain
      ? { normalized_domain: website.domain, website_url: website.websiteUrl }
      : {}),
    ...(website.websiteUrl && !company.website_url ? { website_url: website.websiteUrl } : {}),
    ...(prospect.location && !company.location ? { location: prospect.location } : {}),
    ...((prospect.research_summary || prospect.fit_summary) && !company.description
      ? { description: prospect.research_summary || prospect.fit_summary }
      : {}),
  };
  if (!Object.keys(patch).length) return company;
  const result = await db.from('bd_companies').update({
    ...patch,
    version: Number(company.version) + 1,
    updated_by: actorProfileId,
    updated_by_agent_id: agent.id,
  }).eq('tenant_id', tenantId).eq('id', company.id).eq('version', company.version)
    .is('deleted_at', null).select('*').maybeSingle();
  if (result.error?.code === '23505') {
    throw new BdInputError(
      'That domain belongs to a different active company. Review or merge the CRM companies before approval.',
      'company_domain_conflict',
      409,
    );
  }
  if (result.error) throw result.error;
  if (!result.data) throw new BdInputError('The company changed during reconciliation.', 'company_version_conflict', 409);
  await recordBdMutation(db, {
    tenantId, actorType: 'agent', actorProfileId, agentIdentityId: agent.id,
    modelUsed: 'deterministic_reconciliation_v1', confidence: 1,
    action: 'enrich_company_from_prospect', source: 'admin_human_trigger',
    approvalStatus: 'human_approved', objectType: 'company', objectId: result.data.id,
    previousValue: company, resultingValue: result.data,
    requestId: `robbot3k-reconcile:${prospect.id}:company-enrichment:${result.data.id}:${result.data.version}`,
  });
  return result.data;
}

/**
 * Idempotently reconcile one reviewed RobBot prospect into Avalon BD.
 * This creates no message, sequence, send, or outreach approval. The human
 * caller is captured as the approver; the deterministic reconciliation itself
 * is captured as a RobBot activity + immutable mutation record.
 */
export async function reconcileRobBotProspectToBd(db, tenantId, actorProfileId, prospectId) {
  requireBdUuid(prospectId, 'prospectId');
  const prospectResult = await db.from('robbot3k_prospects').select('*')
    .eq('tenant_id', tenantId).eq('id', prospectId).maybeSingle();
  if (prospectResult.error) throw prospectResult.error;
  const prospect = prospectResult.data;
  if (!prospect) throw new BdInputError('RobBot prospect was not found.', 'prospect_not_found', 404);

  const agent = await ensureRobBotIdentity(db, tenantId, actorProfileId);
  const organization = normalizeBdName(prospect.organization || prospect.name, { field: 'Company name' });
  const website = prospectDomain(prospect);
  let company = null;
  if (prospect.company_id) {
    company = await lookupOne(db.from('bd_companies').select('*').eq('tenant_id', tenantId).eq('id', prospect.company_id).is('deleted_at', null));
  }
  const findCompany = async () => {
    if (website.domain) {
      const byDomain = await lookupOne(db.from('bd_companies').select('*').eq('tenant_id', tenantId).eq('normalized_domain', website.domain).is('deleted_at', null));
      if (byDomain) return byDomain;
    }
    return findCompanyByName(db, tenantId, organization.normalizedName, {
      domain: website.domain,
    });
  };
  company ||= await findCompany();
  let companyCreated = false;
  if (!company) {
    const created = await createOrFind(db, 'bd_companies', {
      tenant_id: tenantId,
      name: organization.name,
      normalized_name: organization.normalizedName,
      website_url: website.websiteUrl,
      normalized_domain: website.domain,
      company_type: 'Other',
      location: prospect.location || null,
      description: prospect.research_summary || prospect.fit_summary || null,
      owner_profile_id: actorProfileId,
      source: 'robbot3k',
      fit_score: Math.max(0, Math.min(100, Number(prospect.priority || 1) * 25)),
      created_by: actorProfileId,
      updated_by: actorProfileId,
      created_by_agent_id: agent.id,
      updated_by_agent_id: agent.id,
    }, findCompany);
    company = created.record;
    companyCreated = created.created;
    if (companyCreated) {
      await recordBdMutation(db, {
        tenantId, actorType: 'agent', actorProfileId, agentIdentityId: agent.id,
        modelUsed: 'deterministic_reconciliation_v1', confidence: 1,
        action: 'create_company_from_prospect', source: 'admin_human_trigger',
        approvalStatus: 'human_approved', objectType: 'company', objectId: company.id,
        resultingValue: company, requestId: `robbot3k-reconcile:${prospect.id}:company:${company.id}`,
      });
    }
  }
  company = await enrichCompanyFromProspect(db, {
    tenantId, actorProfileId, agent, prospect, company, website,
  });

  let person = null;
  let personCreated = false;
  const email = normalizeBdEmail(prospect.contact_email);
  const contactName = String(prospect.contact_name || '').trim();
  const personName = contactName ? normalizeBdName(contactName, { field: 'Contact name' }) : null;
  if (prospect.person_id) {
    person = await lookupOne(db.from('bd_people').select('*').eq('tenant_id', tenantId).eq('id', prospect.person_id).is('deleted_at', null));
  }
  if (email) {
    const emailPerson = await lookupOne(db.from('bd_people').select('*')
      .eq('tenant_id', tenantId).eq('normalized_email', email).is('deleted_at', null));
    if (person && emailPerson && person.id !== emailPerson.id) {
      throw new BdInputError(
        'That email belongs to a different active person. Review or merge the CRM records before approval.',
        'person_email_conflict',
        409,
      );
    }
    person ||= emailPerson;
  }
  if (person) assertPersonCompany(person, company.id);
  if (!person && personName && !email) {
    person = await findNamedPersonAtCompany(db, tenantId, company.id, personName.normalizedName);
  }
  if (!person && personName && email) {
    person = await findNameOnlyPersonAtCompany(db, tenantId, company.id, personName.normalizedName);
  }
  if (!person && personName) {
    const findPerson = email
      ? () => lookupOne(db.from('bd_people').select('*').eq('tenant_id', tenantId).eq('normalized_email', email).is('deleted_at', null))
      : () => findNamedPersonAtCompany(db, tenantId, company.id, personName.normalizedName);
    const created = await createOrFind(db, 'bd_people', {
      tenant_id: tenantId,
      company_id: company.id,
      full_name: personName.name,
      normalized_full_name: personName.normalizedName,
      title: prospect.contact_role || null,
      email,
      normalized_email: email,
      decision_maker_status: 'unknown',
      owner_profile_id: actorProfileId,
      source: 'robbot3k',
      created_by: actorProfileId,
      updated_by: actorProfileId,
      created_by_agent_id: agent.id,
      updated_by_agent_id: agent.id,
    }, findPerson);
    person = created.record;
    assertPersonCompany(person, company.id);
    personCreated = created.created;
    if (personCreated) {
      await recordBdMutation(db, {
        tenantId, actorType: 'agent', actorProfileId, agentIdentityId: agent.id,
        modelUsed: 'deterministic_reconciliation_v1', confidence: 1,
        action: 'create_person_from_prospect', source: 'admin_human_trigger',
        approvalStatus: 'human_approved', objectType: 'person', objectId: person.id,
        resultingValue: person, requestId: `robbot3k-reconcile:${prospect.id}:person:${person.id}`,
      });
    }
  }
  person = await enrichPersonFromProspect(db, {
    tenantId, actorProfileId, agent, prospectId: prospect.id, person, companyId: company.id,
    email, title: prospect.contact_role,
  });

  const opportunityName = normalizeBdName(prospect.name || `${company.name} opportunity`, { field: 'Opportunity name' });
  const findOpportunity = () => lookupOne(db.from('bd_opportunities').select('*')
    .eq('tenant_id', tenantId).eq('company_id', company.id)
    .eq('normalized_name', opportunityName.normalizedName).eq('source', 'robbot3k').is('deleted_at', null));
  let opportunity = null;
  if (prospect.opportunity_id) {
    opportunity = await lookupOne(db.from('bd_opportunities').select('*').eq('tenant_id', tenantId).eq('id', prospect.opportunity_id).is('deleted_at', null));
  }
  opportunity ||= await findOpportunity();
  let opportunityCreated = false;
  if (!opportunity) {
    const created = await createOrFind(db, 'bd_opportunities', {
      tenant_id: tenantId,
      company_id: company.id,
      name: opportunityName.name,
      normalized_name: opportunityName.normalizedName,
      opportunity_type: 'Other',
      owner_profile_id: actorProfileId,
      pipeline_stage: 'researching',
      probability: 10,
      source: 'robbot3k',
      fit_score: Math.max(0, Math.min(100, Number(prospect.priority || 1) * 25)),
      priority: Number(prospect.priority) >= 3 ? 'high' : 'normal',
      description: prospect.fit_summary || prospect.research_summary || null,
      next_action: prospect.recommended_route || null,
      created_by: actorProfileId,
      updated_by: actorProfileId,
      created_by_agent_id: agent.id,
      updated_by_agent_id: agent.id,
    }, findOpportunity);
    opportunity = created.record;
    opportunityCreated = created.created;
    if (opportunityCreated) {
      await recordBdMutation(db, {
        tenantId, actorType: 'agent', actorProfileId, agentIdentityId: agent.id,
        modelUsed: 'deterministic_reconciliation_v1', confidence: 1,
        action: 'create_opportunity_from_prospect', source: 'admin_human_trigger',
        approvalStatus: 'human_approved', objectType: 'opportunity', objectId: opportunity.id,
        resultingValue: opportunity, requestId: `robbot3k-reconcile:${prospect.id}:opportunity:${opportunity.id}`,
      });
    }
  }

  if (person) {
    let relationship = prospect.contact_manually_verified ? 'primary_contact' : 'stakeholder';
    let linkResult = await db.from('bd_opportunity_people').upsert({
      tenant_id: tenantId,
      opportunity_id: opportunity.id,
      person_id: person.id,
      relationship_role: relationship,
      created_by: actorProfileId,
    }, { onConflict: 'tenant_id,opportunity_id,person_id', ignoreDuplicates: true });
    if (linkResult.error?.code === '23505' && relationship === 'primary_contact') {
      relationship = 'stakeholder';
      linkResult = await db.from('bd_opportunity_people').upsert({
        tenant_id: tenantId, opportunity_id: opportunity.id, person_id: person.id,
        relationship_role: 'stakeholder', created_by: actorProfileId,
      }, { onConflict: 'tenant_id,opportunity_id,person_id', ignoreDuplicates: true });
    }
    if (linkResult.error) throw linkResult.error;
    await recordBdMutation(db, {
      tenantId, actorType: 'agent', actorProfileId, agentIdentityId: agent.id,
      modelUsed: 'deterministic_reconciliation_v1', confidence: 1,
      action: 'ensure_person_opportunity_link', source: 'admin_human_trigger',
      approvalStatus: 'human_approved', objectType: 'opportunity', objectId: opportunity.id,
      resultingValue: { personId: person.id, relationshipRole: relationship },
      requestId: `robbot3k-reconcile:${prospect.id}:opportunity-person:${person.id}`,
    });
  }

  const links = { company_id: company.id, person_id: person?.id || null, opportunity_id: opportunity.id, updated_by: actorProfileId };
  const linkResult = await db.from('robbot3k_prospects').update(links)
    .eq('tenant_id', tenantId).eq('id', prospect.id).select('id, company_id, person_id, opportunity_id').single();
  if (linkResult.error) throw linkResult.error;

  const requestId = `robbot3k-reconcile:${prospect.id}:${opportunity.id}`;
  const activityRow = {
    tenant_id: tenantId,
    occurred_at: new Date().toISOString(),
    activity_type: 'rob_bot_action',
    company_id: company.id,
    primary_person_id: person?.id || null,
    opportunity_id: opportunity.id,
    content: 'RobBot3K reconciled this reviewed discovery into Avalon BD. No outreach was sent.',
    source: 'robbot3k_reconciliation',
    actor_type: 'agent',
    actor_profile_id: actorProfileId,
    agent_identity_id: agent.id,
    model_used: 'deterministic_reconciliation_v1',
    confidence: 1,
    approval_status: 'human_approved',
    external_id: requestId,
  };
  let activityResult = await db.from('bd_activities').upsert(activityRow, {
    onConflict: 'tenant_id,source,external_id', ignoreDuplicates: true,
  }).select('id').maybeSingle();
  if (activityResult.error) throw activityResult.error;
  if (!activityResult.data) {
    activityResult = await db.from('bd_activities').select('id')
      .eq('tenant_id', tenantId).eq('source', activityRow.source).eq('external_id', requestId).single();
    if (activityResult.error) throw activityResult.error;
  }
  await recordBdMutation(db, {
    tenantId, actorType: 'agent', actorProfileId, agentIdentityId: agent.id,
    modelUsed: 'deterministic_reconciliation_v1', confidence: 1,
    action: 'create_reconciliation_activity', source: 'admin_human_trigger',
    approvalStatus: 'human_approved', objectType: 'activity', objectId: activityResult.data.id,
    resultingValue: activityRow, requestId: `${requestId}:activity`,
  });
  await recordBdMutation(db, {
    tenantId,
    actorType: 'agent',
    actorProfileId,
    agentIdentityId: agent.id,
    modelUsed: 'deterministic_reconciliation_v1',
    confidence: 1,
    action: 'reconcile_robbot_prospect',
    source: 'admin_human_trigger',
    approvalStatus: 'human_approved',
    objectType: 'robbot_prospect',
    objectId: prospect.id,
    previousValue: { prospectId: prospect.id, companyId: prospect.company_id, personId: prospect.person_id, opportunityId: prospect.opportunity_id },
    resultingValue: { prospectId: prospect.id, ...links },
    requestId,
  });

  return {
    company, person, opportunity,
    created: { company: companyCreated, person: personCreated, opportunity: opportunityCreated },
    prospectLinks: linkResult.data,
    outreachExecuted: false,
    approvalGranted: false,
  };
}

const ROBBOT_OUTCOME_STAGES = Object.freeze({
  approved: 'approved',
  sent: 'contacted',
  reply: 'engaged',
  booked: 'discovery',
});

const ROBBOT_OUTCOME_COPY = Object.freeze({
  approved: 'Human-approved RobBot outreach was recorded. Recipient consent was not inferred.',
  sent: 'RobBot sent a human-approved outreach message.',
  reply: 'An inbound reply was recorded and automated follow-up stopped.',
  booked: 'A discovery call was booked and automated follow-up stopped.',
  held: 'A human operator placed RobBot outreach on hold.',
  revoked: 'A human operator revoked RobBot outreach approval.',
  rejected: 'A human operator rejected RobBot outreach.',
  suppressed: 'The recipient was suppressed and automated outreach stopped.',
});

function robBotActor(actorType, actorProfileId, agentIdentityId) {
  if (actorType === 'human') {
    if (!actorProfileId) throw new BdInputError('Human CRM outcomes require an operator.', 'crm_outcome_actor_required');
    return {
      actor_type: 'human', actor_profile_id: actorProfileId, agent_identity_id: null,
      model_used: null, confidence: null, approval_status: 'human_approved',
    };
  }
  if (actorType === 'agent') {
    return {
      actor_type: 'agent', actor_profile_id: actorProfileId || null, agent_identity_id: agentIdentityId,
      model_used: 'robbot3k_workflow_v1', confidence: 1, approval_status: 'human_approved',
    };
  }
  return {
    actor_type: 'system', actor_profile_id: null, agent_identity_id: null,
    model_used: null, confidence: null, approval_status: 'not_required',
  };
}

/**
 * Idempotent bridge from meaningful RobBot outcomes into the native CRM.
 * It only advances the pipeline through Discovery and never regresses or
 * autonomously enters Proposal, Negotiation, Won, or Lost.
 */
export async function recordRobBotCrmOutcome(db, {
  tenantId, prospectId, outcome, actorType = 'system', actorProfileId = null,
  idempotencyKey, occurredAt = new Date().toISOString(), metadata = {},
} = {}) {
  requireBdUuid(prospectId, 'prospectId');
  if (!Object.hasOwn(ROBBOT_OUTCOME_COPY, outcome)) throw new BdInputError('CRM outcome is not supported.', 'crm_outcome_invalid');
  const stableKey = cleanBdText(idempotencyKey, { field: 'Outcome idempotency key', max: 300, required: true });
  const requestBase = `robbot-crm:${stableKey}`;
  const prospectResult = await db.from('robbot3k_prospects')
    .select('id, company_id, person_id, opportunity_id, organization, name')
    .eq('tenant_id', tenantId).eq('id', prospectId).maybeSingle();
  if (prospectResult.error) throw prospectResult.error;
  const prospect = prospectResult.data;
  if (!prospect) throw new BdInputError('RobBot prospect was not found.', 'prospect_not_found', 404);
  if (!prospect.company_id || !prospect.opportunity_id) {
    return { linked: false, skipped: 'prospect_not_reconciled', outcome };
  }
  const [companyResult, linkedOpportunityResult] = await Promise.all([
    db.from('bd_companies').select('id').eq('tenant_id', tenantId)
      .eq('id', prospect.company_id).is('deleted_at', null).maybeSingle(),
    db.from('bd_opportunities').select('*').eq('tenant_id', tenantId)
      .eq('id', prospect.opportunity_id).is('deleted_at', null).maybeSingle(),
  ]);
  if (companyResult.error) throw companyResult.error;
  if (linkedOpportunityResult.error) throw linkedOpportunityResult.error;
  if (!companyResult.data || !linkedOpportunityResult.data
    || linkedOpportunityResult.data.company_id !== companyResult.data.id) {
    return { linked: false, skipped: 'crm_links_inactive', outcome };
  }
  const completionRequestId = prospect.opportunity_id ? `${requestBase}:opportunity` : `${requestBase}:activity`;
  const prior = await db.from('bd_agent_mutations').select('id')
    .eq('tenant_id', tenantId).eq('request_id', completionRequestId).maybeSingle();
  if (prior.error) throw prior.error;
  if (prior.data) return { linked: true, idempotent: true, outcome };

  let agent = null;
  if (actorType === 'agent') agent = await ensureRobBotIdentity(db, tenantId, actorProfileId);
  const actor = robBotActor(actorType, actorProfileId, agent?.id || null);
  const eventTime = bdIsoDate(occurredAt, { field: 'Outcome timestamp' });
  const activityRow = {
    tenant_id: tenantId,
    occurred_at: eventTime,
    activity_type: outcome === 'sent' ? 'email'
      : outcome === 'reply' ? 'email'
        : outcome === 'booked' ? 'meeting'
          : 'rob_bot_action',
    company_id: prospect.company_id,
    primary_person_id: prospect.person_id,
    opportunity_id: prospect.opportunity_id,
    content: ROBBOT_OUTCOME_COPY[outcome],
    source: 'robbot3k_bridge',
    ...actor,
    external_id: requestBase,
  };
  let activityResult = await db.from('bd_activities').upsert(activityRow, {
    onConflict: 'tenant_id,source,external_id', ignoreDuplicates: true,
  }).select('*').maybeSingle();
  if (activityResult.error) throw activityResult.error;
  if (!activityResult.data) {
    activityResult = await db.from('bd_activities').select('*').eq('tenant_id', tenantId)
      .eq('source', 'robbot3k_bridge').eq('external_id', requestBase).single();
    if (activityResult.error) throw activityResult.error;
  }
  await recordBdMutation(db, {
    tenantId,
    actorType: actor.actor_type,
    actorProfileId: actor.actor_profile_id,
    agentIdentityId: actor.agent_identity_id,
    modelUsed: actor.model_used,
    confidence: actor.confidence,
    action: `robbot_${outcome}_activity`,
    source: 'robbot3k_bridge',
    approvalStatus: actor.approval_status,
    objectType: 'activity',
    objectId: activityResult.data.id,
    resultingValue: { ...activityResult.data, metadata },
    requestId: `${requestBase}:activity`,
  });

  let opportunity = null;
  if (prospect.opportunity_id) {
    const current = linkedOpportunityResult.data;
    if (current) {
      const targetStage = ROBBOT_OUTCOME_STAGES[outcome] || null;
      const stageIndex = BD_PIPELINE_STAGES.indexOf(current.pipeline_stage);
      const targetIndex = targetStage ? BD_PIPELINE_STAGES.indexOf(targetStage) : -1;
      const mayAdvance = targetStage && stageIndex >= 0 && stageIndex < targetIndex && targetIndex <= BD_PIPELINE_STAGES.indexOf('discovery');
      const patch = {
        last_activity_at: eventTime,
        version: Number(current.version) + 1,
        ...(mayAdvance ? { pipeline_stage: targetStage } : {}),
        ...(actorType === 'human' ? { updated_by: actorProfileId } : {}),
        ...(actorType === 'agent' ? { updated_by_agent_id: agent.id } : {}),
      };
      const updated = await db.from('bd_opportunities').update(patch)
        .eq('tenant_id', tenantId).eq('id', current.id).eq('version', current.version)
        .is('deleted_at', null)
        .select('*').maybeSingle();
      if (updated.error) throw updated.error;
      if (!updated.data) throw new BdInputError('Opportunity changed while recording the RobBot outcome.', 'crm_outcome_version_conflict', 409);
      opportunity = updated.data;
      await recordBdMutation(db, {
        tenantId,
        actorType: actor.actor_type,
        actorProfileId: actor.actor_profile_id,
        agentIdentityId: actor.agent_identity_id,
        modelUsed: actor.model_used,
        confidence: actor.confidence,
        action: `robbot_${outcome}_opportunity_update`,
        source: 'robbot3k_bridge',
        approvalStatus: actor.approval_status,
        objectType: 'opportunity',
        objectId: current.id,
        previousValue: current,
        resultingValue: updated.data,
        requestId: `${requestBase}:opportunity`,
      });
    }
  }
  return {
    linked: true,
    idempotent: false,
    outcome,
    activityId: activityResult.data.id,
    opportunity,
    links: {
      companyId: prospect.company_id,
      personId: prospect.person_id,
      opportunityId: prospect.opportunity_id,
    },
  };
}
