import crypto from 'crypto';
import { writeAuditEvent } from './audit-events.js';
import { safeErrorCode, safeLogContext } from './safe-error.js';
import {
  ATLAS_DEFAULT_URL,
  CADENCE_DAYS,
  approvalEvidenceSnapshot,
  draftHashFor,
  fetchAtlasDataset,
  normalizeAtlasProspects,
  rebuildProspectDraft,
} from './robbot3k-atlas.js';
import { reconcileRobBotProspectToBd, recordRobBotCrmOutcome } from './bd-crm-core.js';

const TERMINAL_STATUSES = new Set(['replied', 'booked', 'suppressed', 'completed', 'archived']);
const STOP_SEQUENCE_STATUSES = new Set(['replied', 'booked', 'completed', 'suppressed', 'cancelled']);
const UNSUBSCRIBE_PATTERN = /(no thanks|unsubscribe|stop hearing|we will stop|we’ll stop)/i;

export function statusAfterProspectEdit(existingStatus, approvalSensitiveChange, fallbackStatus) {
  if (['approved', 'outreach'].includes(existingStatus)) {
    return approvalSensitiveChange ? 'ready' : existingStatus;
  }
  if (TERMINAL_STATUSES.has(existingStatus)) return existingStatus;
  return fallbackStatus;
}

export function atlasRowsMissingFromSnapshot(existingRows = [], incomingRows = []) {
  const incomingKeys = new Set(incomingRows.map((row) => `${row.source_kind}:${row.source_id}`));
  return existingRows.filter((row) =>
    ['atlas_event', 'atlas_target'].includes(row.source_kind)
    && !incomingKeys.has(`${row.source_kind}:${row.source_id}`)
    && row.status !== 'archived');
}

function fail(status, code, message) {
  throw Object.assign(new Error(message || code), { status, code });
}

function string(value, max = 2_000) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function validEmail(value) {
  const email = string(value, 320).toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email) ? email : '';
}

function validHttpsUrl(value, field = 'URL') {
  const raw = string(value, 2_000);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid');
    return parsed.toString();
  } catch {
    fail(400, 'settings_url_invalid', `${field} must be a valid HTTPS URL.`);
  }
}

function manualField(value, field, { max, required = true, preserveLines = false } = {}) {
  const raw = value == null ? '' : String(value);
  if (/\u0000/.test(raw)) fail(400, 'manual_prospect_field_invalid', `${field} contains an invalid character.`);
  if (raw.length > max) fail(400, 'manual_prospect_field_too_long', `${field} must be ${max.toLocaleString()} characters or fewer.`);
  const normalized = preserveLines
    ? raw.replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').trim()
    : raw.replace(/\s+/g, ' ').trim();
  if (required && !normalized) fail(400, 'manual_prospect_field_required', `${field} is required.`);
  return normalized;
}

function manualPublicUrl(value, field) {
  const raw = manualField(value, field, { max: 2_000, required: false });
  if (!raw) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.port
      || !hostname.includes('.')
      || hostname === 'localhost'
      || hostname.endsWith('.local')
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    ) throw new Error('invalid');
    parsed.hash = '';
    return parsed.toString();
  } catch {
    fail(400, 'manual_prospect_source_invalid', `${field} must be a public HTTPS website, domain, or source URL.`);
  }
}

/**
 * Normalize an admin-entered contact without trusting browser validation.
 * The deterministic, opaque source id makes repeat submissions idempotent
 * without putting the recipient's address into a URL, log label, or key.
 */
export function normalizeManualProspectInput(input = {}) {
  const personName = manualField(input.personName ?? input.name, 'Person name', { max: 160, required: false });
  const company = manualField(input.company ?? input.organization, 'Company', { max: 240 });
  const title = manualField(input.title ?? input.role, 'Title', { max: 160, required: false });
  const rawEmail = manualField(input.email, 'Email', { max: 320, required: false });
  const email = rawEmail ? validEmail(rawEmail) : '';
  if (rawEmail && !email) fail(400, 'manual_prospect_email_invalid', 'Enter a valid contact email or leave it blank for research.');
  const opportunityContext = manualField(
    input.opportunityContext ?? input.context ?? input.opportunity,
    'Opportunity / context',
    { max: 2_000 },
  );
  const notes = manualField(input.notes, 'Notes', { max: 4_000, required: false, preserveLines: true });
  const websiteUrl = manualPublicUrl(input.website ?? input.domain, 'Website / domain');
  const sourceUrl = manualPublicUrl(input.sourceUrl ?? input.source_url, 'Source URL');
  const primarySourceUrl = sourceUrl || websiteUrl;
  if (!primarySourceUrl) {
    fail(400, 'manual_prospect_source_required', 'Add a company website, domain, or public source URL.');
  }
  const numericPriority = Number(input.priority);
  const priority = [1, 2, 3].includes(numericPriority) ? numericPriority : 2;
  const isTestRecord = input.isTestRecord === true || input.is_test_record === true;
  const sourceVerified = input.sourceVerified === true || input.source_verified === true;
  return {
    personName,
    company,
    title,
    email,
    opportunityContext,
    notes,
    websiteUrl,
    sourceUrl,
    primarySourceUrl,
    priority,
    isTestRecord,
    sourceVerified,
    sourceId: `manual:${crypto.createHash('sha256').update(
      email || `${company.toLowerCase()}|${personName.toLowerCase()}|${primarySourceUrl.toLowerCase()}`,
    ).digest('hex').slice(0, 32)}`,
  };
}

function isUniqueViolation(error) {
  return String(error?.code || '').toLowerCase() === '23505';
}

function requireData(result, code = 'robbot3k_query_failed') {
  if (result?.error) throw Object.assign(result.error, { code: result.error.code || code });
  return result?.data;
}

function chunks(values, size = 100) {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

export async function selectAllTenantRows(db, table, columns, tenantId, { pageSize = 500, maxRows = 20_000 } = {}) {
  const output = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    // PostgREST commonly caps a response at 1,000 rows. Explicit, stable
    // pages prevent records after that boundary from being treated as new or
    // disappearing from global dashboard counts.
    let query = db.from(table).select(columns).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const page = requireData(await query) || [];
    output.push(...page);
    if (page.length < pageSize) return output;
  }
  fail(500, 'robbot3k_row_limit_exceeded', `RobBot3K ${table} exceeded the safe read limit.`);
}

export function pacificClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    timeZone: 'America/Los_Angeles',
  };
}

function priorityLabel(value) {
  return Number(value) === 3 ? 'High' : Number(value) === 2 ? 'Medium' : 'Low';
}

export function robBotHasOfficialEvidence(row) {
  const verification = string(row.verification, 120).toLowerCase();
  if (!Array.isArray(row.public_sources) || row.public_sources.length === 0) return false;
  if (row.source_kind === 'atlas_event') return verification === 'source_linked';
  // Atlas target evidence uses a small reviewed vocabulary. Accept explicit
  // official/verified/live-confirmed classifications, while excluding weaker
  // social-only and pending-verification labels.
  return verification === 'verified'
    || verification.startsWith('official')
    || verification.startsWith('live-confirmed');
}

function confidenceFor(row) {
  let confidence = 25;
  if (Array.isArray(row.public_sources) && row.public_sources.length) confidence += 25;
  if (robBotHasOfficialEvidence(row)) confidence += 15;
  if (row.contact_email) confidence += 15;
  if (row.contact_manually_verified) confidence += 20;
  return Math.min(confidence, 100);
}

function sequenceForUi(steps) {
  const source = Array.isArray(steps) ? steps : [];
  return CADENCE_DAYS.map((day, index) => {
    const item = source[index] || {};
    return {
      order: index + 1,
      delayDays: day,
      label: string(item.label, 100) || ['Introduction', 'Useful follow-up', 'Scheduling option', 'Close the loop'][index],
      subject: string(item.subject, 240),
      body: String(item.body || '').trim(),
    };
  });
}

function nextActionFor(row, sequence) {
  if (row.status === 'research') return row.research_status === 'needs_evidence'
    ? 'Add a public source, identify the appropriate business contact, and verify the address.'
    : 'Identify and manually verify the appropriate business contact.';
  if (row.status === 'ready') return 'Review the source evidence, recipient, and exact four-message sequence.';
  if (row.status === 'approved' || row.status === 'outreach') {
    return sequence?.next_due_at ? `Touch ${Math.min(Number(sequence.current_step || 0) + 1, 4)} is queued for its approved due time.` : 'Approved sequence is waiting for execution.';
  }
  if (row.status === 'replied') return 'A human owns the reply. Automated follow-up is stopped.';
  if (row.status === 'booked') return 'Call scheduled. Automated follow-up is stopped.';
  if (row.status === 'suppressed') return 'Suppressed. Future outreach is blocked.';
  if (row.status === 'held') return 'Held by a human operator. Nothing will send.';
  if (row.status === 'rejected') return 'Rejected by a human operator.';
  return 'Review the record before taking another action.';
}

function stopReasonFor(row, sequence) {
  if (sequence?.stop_reason) return sequence.stop_reason;
  if (row.status === 'replied') return 'Reply received — automated follow-up stopped.';
  if (row.status === 'booked') return 'Call booked — automated follow-up stopped.';
  if (row.status === 'suppressed') return 'Suppression recorded — all outreach blocked.';
  if (row.status === 'rejected') return 'Rejected by a human operator.';
  if (row.status === 'held') return 'Held by a human operator.';
  return '';
}

export function shapeProspect(row, { approval = null, sequence = null, meeting = null } = {}) {
  const sources = Array.isArray(row.public_sources) ? row.public_sources : [];
  const sourcePayload = row.source_payload && typeof row.source_payload === 'object' && !Array.isArray(row.source_payload)
    ? row.source_payload
    : {};
  const manualEntry = row.source_kind === 'manual' || sourcePayload.manual_entry === true;
  const testRecord = sourcePayload.is_test_record === true;
  const sourceLabel = manualEntry
    ? testRecord ? 'Manual test contact' : row.source_kind === 'manual' ? 'Manual admin entry' : 'Manual entry + Atlas'
    : 'Regional Opportunity Atlas';
  const evidence = sources.map((url, index) => ({
    id: `${row.id}:source:${index}`,
    label: index === 0 ? string(row.research_summary, 500) || (manualEntry ? 'Human-supplied research source' : 'Primary Atlas research source') : 'Additional public research source',
    source: manualEntry ? sourceLabel : string(row.verification, 120) || 'Regional Opportunity Atlas',
    url,
    official: robBotHasOfficialEvidence(row),
  }));
  return {
    id: row.id,
    prospectId: row.id,
    organization: row.organization,
    name: row.name,
    segment: row.segment || 'Uncategorized',
    location: row.location,
    priority: priorityLabel(row.priority),
    priorityValue: Number(row.priority || 1),
    status: row.status,
    confidence: confidenceFor(row),
    verification: row.verification,
    officialEvidence: robBotHasOfficialEvidence(row),
    evidence,
    public_sources: sources,
    source: { label: sourceLabel, url: sources[0] || (manualEntry ? '' : ATLAS_DEFAULT_URL) },
    sourceKind: row.source_kind,
    manualEntry,
    isTestRecord: testRecord,
    opportunityContext: string(sourcePayload.opportunity_context, 2_000) || row.research_summary || '',
    manualNotes: string(sourcePayload.notes, 4_000),
    contact: {
      name: row.contact_name || '',
      role: row.contact_role || '',
      email: row.contact_email || '',
    },
    contactName: row.contact_name || '',
    contactRole: row.contact_role || '',
    contactEmail: row.contact_email || '',
    manualVerified: Boolean(row.contact_manually_verified),
    emailStatus: row.contact_manually_verified ? 'Manually verified' : row.contact_email ? 'Needs manual verification' : 'Not found',
    recipientConsentStatus: row.recipient_consent_status || 'unknown',
    sequence: sequenceForUi(row.draft_steps),
    draftHash: row.draft_hash,
    researchProvider: row.research_provider,
    researchStatus: row.research_status,
    researchSummary: row.research_summary,
    fitSummary: row.fit_summary,
    recommendedRoute: row.recommended_route,
    approval: approval ? {
      id: approval.id,
      decision: approval.decision,
      approvedAt: approval.created_at,
      expiresAt: approval.expires_at,
      humanApprovalIsNotRecipientConsent: true,
    } : null,
    currentTouch: sequence ? Math.min(Number(sequence.current_step || 0) + 1, 4) : 0,
    nextDueAt: sequence?.next_due_at || null,
    sentCount: Number(sequence?.sent_count || 0),
    sequenceStatus: sequence?.status || null,
    meeting: meeting || null,
    stopReason: stopReasonFor(row, sequence),
    nextAction: nextActionFor(row, sequence),
    lastResearchedAt: row.last_researched_at,
    updatedAt: row.updated_at,
    crm: {
      connected: Boolean(row.opportunity_id),
      companyId: row.company_id || null,
      personId: row.person_id || null,
      opportunityId: row.opportunity_id || null,
    },
  };
}

async function rowsByProspect(db, table, tenantId, prospectIds, extraSelect = '*') {
  if (!prospectIds.length) return [];
  const all = [];
  for (const group of chunks(prospectIds, 150)) {
    let query = db.from(table).select(extraSelect).in('prospect_id', group);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const rows = requireData(await query) || [];
    all.push(...rows);
  }
  return all;
}

export async function readRobBotSettings(db, tenantId) {
  let query = db.from('robbot3k_settings').select('*');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const row = requireData(await query.maybeSingle()) || {};
  return {
    senderDisplayName: row.sender_display_name || '',
    displayName: row.sender_display_name || '',
    fromEmail: row.from_email || '',
    replyToEmail: row.reply_to_email || '',
    calendlyUrl: row.calendly_url || '',
    physicalPostalAddress: row.physical_postal_address || '',
    postalAddress: row.physical_postal_address || '',
    providerSelection: row.provider_selection || 'unconfigured',
    // The current adapter is deliberately a stub. Never infer connection from
    // a selected provider or expose any secret material through this object.
    providerStatus: 'not_configured',
    providerConnected: false,
    updatedAt: row.updated_at || null,
  };
}

export async function updateRobBotSettings(db, tenantId, actorProfileId, input = {}) {
  const fromEmail = input.fromEmail == null || input.fromEmail === '' ? '' : validEmail(input.fromEmail);
  const replyToEmail = input.replyToEmail == null || input.replyToEmail === '' ? '' : validEmail(input.replyToEmail);
  if (input.fromEmail && !fromEmail) fail(400, 'settings_from_email_invalid', 'Sender email is invalid.');
  if (input.replyToEmail && !replyToEmail) fail(400, 'settings_reply_to_invalid', 'Reply-to email is invalid.');
  const providerSelection = string(input.providerSelection, 40) || 'unconfigured';
  if (!['unconfigured', 'instantly'].includes(providerSelection)) {
    fail(400, 'settings_provider_invalid', 'Provider must be unconfigured or Instantly.');
  }
  const row = {
    tenant_id: tenantId,
    sender_display_name: string(input.senderDisplayName ?? input.displayName, 160) || null,
    from_email: fromEmail || null,
    reply_to_email: replyToEmail || null,
    calendly_url: validHttpsUrl(input.calendlyUrl, 'Calendly URL') || null,
    physical_postal_address: string(input.physicalPostalAddress ?? input.postalAddress, 500) || null,
    provider_selection: providerSelection,
    // Selection is not a connection. A future adapter and server-only secret
    // must both exist before this may become connected.
    provider_status: 'not_configured',
    created_by: actorProfileId,
    updated_by: actorProfileId,
  };
  requireData(await db.from('robbot3k_settings').upsert(row, {
    onConflict: 'tenant_id', ignoreDuplicates: false,
  }).select('id').single());
  await writeAuditEvent(db, {
    tenantId,
    actorProfileId,
    action: 'robbot3k_settings_updated',
    entityType: 'robbot3k_settings',
    entityId: tenantId,
    phiTouched: false,
    payload: {
      changedFields: ['senderDisplayName', 'displayName', 'fromEmail', 'replyToEmail', 'calendlyUrl', 'physicalPostalAddress', 'postalAddress', 'providerSelection']
        .filter((key) => Object.prototype.hasOwnProperty.call(input, key)),
      providerConnected: false,
    },
  });
  return readRobBotSettings(db, tenantId);
}

export async function upsertManualRobBotProspect(db, tenantId, actorProfileId, input = {}) {
  const normalized = normalizeManualProspectInput(input);
  const emailLookup = normalized.email
    ? db.from('robbot3k_prospects').select('*')
      .eq('tenant_id', tenantId)
      .eq('contact_email', normalized.email)
      .limit(3)
    : Promise.resolve({ data: [] });
  const [emailResult, sourceResult, settings] = await Promise.all([
    emailLookup,
    db.from('robbot3k_prospects').select('*')
      .eq('tenant_id', tenantId)
      .eq('source_kind', 'manual')
      .eq('source_id', normalized.sourceId)
      .limit(3),
    readRobBotSettings(db, tenantId),
  ]);
  const matches = new Map();
  for (const row of [...(requireData(emailResult) || []), ...(requireData(sourceResult) || [])]) matches.set(row.id, row);
  if (matches.size > 1) {
    fail(409, 'manual_prospect_duplicate_ambiguous', 'More than one prospect matches this contact. Resolve the duplicates before adding it again.');
  }
  const existing = [...matches.values()][0] || null;
  if (existing && ['held', 'rejected', ...TERMINAL_STATUSES].includes(existing.status)) {
    fail(409, 'manual_prospect_stopped', 'This contact already belongs to a held or stopped prospect. Review that record instead of reopening it.');
  }

  const now = new Date().toISOString();
  const priorPayload = existing?.source_payload && typeof existing.source_payload === 'object' && !Array.isArray(existing.source_payload)
    ? existing.source_payload
    : {};
  const sources = Array.from(new Set([
    normalized.primarySourceUrl,
    normalized.websiteUrl,
    normalized.sourceUrl,
    ...(Array.isArray(existing?.public_sources) ? existing.public_sources : []),
  ].filter(Boolean))).slice(0, 8);
  const sourceKind = existing?.source_kind || 'manual';
  let verification = existing && robBotHasOfficialEvidence(existing)
    ? existing.verification
    : normalized.sourceVerified ? 'official_manual_source' : 'manual_source_submitted';
  if (sourceKind === 'atlas_event' && normalized.sourceVerified) verification = 'source_linked';
  const contactEmail = normalized.email || existing?.contact_email || '';
  const contactVerified = Boolean(existing?.contact_manually_verified && existing.contact_email === contactEmail);
  const sourcePayload = {
    ...priorPayload,
    manual_entry: true,
    is_test_record: normalized.isTestRecord,
    website_url: normalized.websiteUrl || null,
    source_url: normalized.sourceUrl || normalized.primarySourceUrl,
    opportunity_context: normalized.opportunityContext,
    notes: normalized.notes || null,
    outreach_signal: normalized.opportunityContext,
  };
  const base = {
    tenant_id: tenantId,
    source_kind: sourceKind,
    source_id: existing?.source_id || normalized.sourceId,
    source_snapshot: `manual:${pacificClock(new Date()).date}`,
    organization: normalized.company,
    name: normalized.company,
    segment: existing?.segment || (normalized.isTestRecord ? 'Manual test contact' : 'Manual contact'),
    location: existing?.location || null,
    priority: normalized.priority,
    verification,
    qualification: existing?.qualification || null,
    budget_signal: existing?.budget_signal || null,
    research_summary: normalized.opportunityContext,
    fit_summary: normalized.opportunityContext,
    recommended_route: normalized.personName
      ? `Contact ${normalized.personName}${normalized.title ? `, ${normalized.title}` : ''}, for a human-reviewed fit conversation.`
      : `Identify and verify the right decision-maker at ${normalized.company} before requesting outreach approval.`,
    public_sources: sources,
    source_payload: sourcePayload,
    research_provider: 'manual_admin_entry',
    research_status: robBotHasOfficialEvidence({ source_kind: sourceKind, verification, public_sources: sources })
      ? 'source_only'
      : 'needs_evidence',
    draft_evidence: sources.map((url, index) => ({ source: url, primary: index === 0, entered_by: 'admin' })),
    contact_name: normalized.personName || null,
    contact_role: normalized.title || null,
    contact_email: contactEmail || null,
    contact_manually_verified: contactVerified,
    contact_verified_by: contactVerified ? existing.contact_verified_by : null,
    contact_verified_at: contactVerified ? existing.contact_verified_at : null,
    recipient_consent_status: existing?.recipient_consent_status || 'unknown',
    draft_source: 'deterministic',
    status: contactVerified && robBotHasOfficialEvidence({ source_kind: sourceKind, verification, public_sources: sources })
      ? 'ready'
      : 'research',
    last_researched_at: now,
    updated_by: actorProfileId,
  };
  const draft = rebuildProspectDraft(base, {
    calendlyUrl: settings.calendlyUrl || process.env.ROBBOT3K_CALENDLY_URL || '',
    physicalAddress: settings.physicalPostalAddress,
  });
  const row = { ...base, ...draft };

  let prospectId;
  if (existing) {
    if (['approved', 'outreach'].includes(existing.status)) {
      // Manual edits must never inherit executable state. Stop the sequence
      // before replacing its recipient context, evidence, or drafts.
      await invalidateApproval(db, tenantId, existing.id, 'manual_prospect_updated');
    }
    const result = await db.from('robbot3k_prospects').update(row)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select('id')
      .single();
    prospectId = requireData(result)?.id;
  } else {
    const result = await db.from('robbot3k_prospects').insert({
      ...row,
      created_by: actorProfileId,
    }).select('id').single();
    if (result.error && isUniqueViolation(result.error)) {
      fail(409, 'manual_prospect_duplicate', 'This contact was added by another request. Reload the queue to review it.');
    }
    prospectId = requireData(result)?.id;
  }
  if (!prospectId) fail(500, 'manual_prospect_write_failed', 'The manual prospect could not be stored.');

  await writeAuditEvent(db, {
    tenantId,
    actorProfileId,
    action: existing ? 'robbot3k_manual_prospect_updated' : 'robbot3k_manual_prospect_created',
    entityType: 'robbot3k_prospect',
    entityId: prospectId,
    phiTouched: false,
    payload: {
      created: !existing,
      isTestRecord: normalized.isTestRecord,
      sourceVerified: normalized.sourceVerified,
      approvalCreated: false,
      outreachExecuted: false,
    },
  });
  return {
    prospect: await shapedSingle(db, tenantId, prospectId),
    created: !existing,
  };
}

export async function listRobBotDashboard(db, tenantId, { limit = 100, offset = 0 } = {}) {
  const pageLimit = Math.min(Math.max(Number(limit) || 100, 1), 150);
  const pageOffset = Math.max(Number(offset) || 0, 0);
  let prospectQuery = db.from('robbot3k_prospects')
    .select('*', { count: 'exact' })
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(pageOffset, pageOffset + pageLimit - 1);
  if (tenantId) prospectQuery = prospectQuery.eq('tenant_id', tenantId);
  const prospectResult = await prospectQuery;
  const prospects = requireData(prospectResult) || [];
  const total = Number(prospectResult.count || prospects.length);
  const ids = prospects.map((row) => row.id);

  const [
    approvals, sequences, meetings, runs, settings,
    globalProspects, globalSequences, globalMessages, globalMeetings,
  ] = await Promise.all([
    rowsByProspect(db, 'robbot3k_approvals', tenantId, ids, '*'),
    rowsByProspect(db, 'robbot3k_sequences', tenantId, ids, '*'),
    rowsByProspect(db, 'robbot3k_meetings', tenantId, ids, '*'),
    (async () => {
      let query = db.from('robbot3k_runs').select('*').order('started_at', { ascending: false }).limit(30);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      return requireData(await query) || [];
    })(),
    readRobBotSettings(db, tenantId),
    selectAllTenantRows(db, 'robbot3k_prospects', 'status,last_researched_at', tenantId),
    selectAllTenantRows(db, 'robbot3k_sequences', 'status,next_due_at', tenantId),
    selectAllTenantRows(db, 'robbot3k_messages', 'direction,created_at', tenantId),
    selectAllTenantRows(db, 'robbot3k_meetings', 'status,created_at', tenantId),
  ]);

  const approvalMap = new Map();
  approvals.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).forEach((row) => {
    if (row.is_current && !approvalMap.has(row.prospect_id)) approvalMap.set(row.prospect_id, row);
  });
  const sequenceMap = new Map();
  sequences.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).forEach((row) => {
    if (!sequenceMap.has(row.prospect_id)) sequenceMap.set(row.prospect_id, row);
  });
  const meetingMap = new Map();
  meetings.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).forEach((row) => {
    if (!meetingMap.has(row.prospect_id)) meetingMap.set(row.prospect_id, row);
  });

  const shaped = prospects.map((row) => shapeProspect(row, {
    approval: approvalMap.get(row.id),
    sequence: sequenceMap.get(row.id),
    meeting: meetingMap.get(row.id),
  }));
  const now = Date.now();
  const pacificToday = pacificClock(new Date()).date;
  const isPacificToday = (value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && pacificClock(date).date === pacificToday;
  };
  const stats = {
    researchedToday: globalProspects.filter((item) => isPacificToday(item.last_researched_at)).length,
    readyForReview: globalProspects.filter((item) => item.status === 'ready').length,
    dueToday: globalSequences.filter((item) => ['ready', 'active'].includes(item.status) && item.next_due_at && new Date(item.next_due_at).getTime() <= now).length,
    activeSequences: globalSequences.filter((item) => ['ready', 'active'].includes(item.status)).length,
    repliesToday: globalMessages.filter((item) => item.direction === 'inbound' && isPacificToday(item.created_at)).length,
    totalReplies: globalMessages.filter((item) => item.direction === 'inbound').length,
    callsBookedToday: globalMeetings.filter((item) => ['scheduled', 'completed'].includes(item.status) && isPacificToday(item.created_at)).length,
    totalCallsBooked: globalMeetings.filter((item) => ['scheduled', 'completed'].includes(item.status)).length,
  };
  const lastRefresh = runs.find((row) => row.run_type === 'refresh' && row.status === 'succeeded');
  const lastExecution = runs.find((row) => row.run_type === 'outreach');
  return {
    prospects: shaped,
    pagination: {
      limit: pageLimit,
      offset: pageOffset,
      total,
      hasMore: pageOffset + prospects.length < total,
    },
    stats,
    runs: runs.map((row) => ({
      id: row.id,
      type: row.run_type === 'outreach' ? 'run_due_outreach' : row.run_type,
      action: row.run_type === 'outreach' ? 'run_due_outreach' : row.run_type,
      status: row.status,
      trigger: row.trigger_source,
      counts: row.counts,
      provider: row.provider,
      providerStatus: row.provider_status,
      createdAt: row.started_at,
      completedAt: row.finished_at,
    })),
    run: {
      lastRefreshAt: lastRefresh?.finished_at || null,
      lastExecuteAt: lastExecution?.finished_at || null,
    },
    config: {
      configured: true,
      liveSendRequested: String(process.env.ROBBOT3K_LIVE_SEND_ENABLED || '').toLowerCase() === 'true',
      liveSendEnabled: false,
      providerConnected: false,
      sendMode: 'dry_run',
      provider: 'unconfigured',
      providerStatus: 'No compliant outreach provider adapter is configured.',
      schedule: 'Daily at 6:00 AM America/Los_Angeles; manual research is available anytime.',
      cadenceDays: [...CADENCE_DAYS],
      humanApprovalIsNotRecipientConsent: true,
      senderConfigured: Boolean(settings.fromEmail),
    },
    settings,
    liveSendEnabled: false,
    providerConnected: false,
  };
}

async function getProspect(db, tenantId, prospectId) {
  let query = db.from('robbot3k_prospects').select('*').eq('id', prospectId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const row = requireData(await query.maybeSingle());
  if (!row) fail(404, 'prospect_not_found', 'Prospect not found.');
  return row;
}

async function currentApproval(db, tenantId, prospectId) {
  let query = db.from('robbot3k_approvals').select('*').eq('prospect_id', prospectId).eq('is_current', true);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  return requireData(await query.maybeSingle()) || null;
}

async function latestSequence(db, tenantId, prospectId) {
  let query = db.from('robbot3k_sequences').select('*').eq('prospect_id', prospectId)
    .order('created_at', { ascending: false }).limit(1);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const rows = requireData(await query) || [];
  return rows[0] || null;
}

async function shapedSingle(db, tenantId, prospectId) {
  const [row, approval, sequence] = await Promise.all([
    getProspect(db, tenantId, prospectId),
    currentApproval(db, tenantId, prospectId),
    latestSequence(db, tenantId, prospectId),
  ]);
  return shapeProspect(row, { approval, sequence });
}

async function invalidateApproval(db, tenantId, prospectId, reason = 'draft_or_recipient_changed') {
  let approvals = db.from('robbot3k_approvals').update({ is_current: false, reason })
    .eq('prospect_id', prospectId).eq('is_current', true);
  let sequences = db.from('robbot3k_sequences').update({ status: 'cancelled', stop_reason: reason })
    .eq('prospect_id', prospectId).in('status', ['ready', 'active', 'paused']);
  if (tenantId) {
    approvals = approvals.eq('tenant_id', tenantId);
    sequences = sequences.eq('tenant_id', tenantId);
  }
  const [approvalResult, sequenceResult] = await Promise.all([approvals, sequences]);
  if (approvalResult.error) throw approvalResult.error;
  if (sequenceResult.error) throw sequenceResult.error;
}

function manualSequence(value) {
  if (!Array.isArray(value) || value.length !== 4) fail(400, 'four_drafts_required', 'Exactly four outreach drafts are required.');
  return value.map((item, index) => {
    const delay = Number(item?.delayDays ?? item?.delay_days ?? item?.day);
    if (delay !== CADENCE_DAYS[index]) fail(400, 'cadence_locked', 'The outreach cadence is locked to days 0, 3, 7, and 14.');
    const subject = String(item?.subject || '').trim();
    const body = String(item?.body || '').trim();
    if (subject.length > 240 || body.length > 20_000) {
      fail(400, 'draft_too_long', `Touch ${index + 1} exceeds the allowed subject or body length.`);
    }
    if (!subject || !body) fail(400, 'draft_incomplete', `Touch ${index + 1} needs a subject and body.`);
    if (!UNSUBSCRIBE_PATTERN.test(body)) {
      fail(400, 'unsubscribe_copy_required', `Touch ${index + 1} must include clear stop or unsubscribe copy.`);
    }
    return {
      order: index + 1,
      day: delay,
      delayDays: delay,
      label: string(item?.label, 100) || ['Introduction', 'Useful follow-up', 'Scheduling option', 'Close the loop'][index],
      subject,
      body,
    };
  });
}

export async function updateRobBotProspect(db, tenantId, actorProfileId, prospectId, patch = {}, {
  expectedDraftHash = '',
} = {}) {
  const existing = await getProspect(db, tenantId, prospectId);
  const reviewedDraftHash = string(expectedDraftHash, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(reviewedDraftHash)) {
    fail(400, 'expected_draft_hash_required', 'Save against the exact prospect version shown in the review screen.');
  }
  if (reviewedDraftHash !== existing.draft_hash) {
    fail(409, 'reviewed_draft_changed', 'The recipient, copy, or source evidence changed. Reload before saving.');
  }
  const contact = patch.contact && typeof patch.contact === 'object' ? patch.contact : {};
  const nextEmail = Object.prototype.hasOwnProperty.call(contact, 'email')
    ? validEmail(contact.email)
    : existing.contact_email || '';
  if (Object.prototype.hasOwnProperty.call(contact, 'email') && contact.email && !nextEmail) {
    fail(400, 'contact_email_invalid', 'Enter a valid contact email.');
  }
  const emailChanged = nextEmail !== (existing.contact_email || '');
  const manuallyVerified = patch.manualVerified === true
    ? true
    : emailChanged ? false : Boolean(existing.contact_manually_verified);
  if (patch.manualVerified === true && !nextEmail) fail(400, 'contact_email_required', 'An email is required before manual verification.');

  let steps = Array.isArray(patch.sequence) ? manualSequence(patch.sequence) : existing.draft_steps;
  let draftSource = Array.isArray(patch.sequence) ? 'manual' : existing.draft_source;
  const draftChanged = JSON.stringify(steps || []) !== JSON.stringify(existing.draft_steps || []);
  if (!Array.isArray(steps) || steps.length !== 4) {
    const rebuilt = rebuildProspectDraft({
      ...existing,
      contact_name: Object.prototype.hasOwnProperty.call(contact, 'name') ? string(contact.name, 160) : existing.contact_name,
      contact_email: nextEmail,
    });
    steps = rebuilt.draft_steps;
    draftSource = 'deterministic';
  }
  const hash = draftHashFor({
    recipient: nextEmail,
    steps,
    evidence: approvalEvidenceSnapshot(existing),
  });
  const approvalSensitiveChange = emailChanged || draftChanged || hash !== existing.draft_hash;
  const nextStatus = statusAfterProspectEdit(
    existing.status,
    approvalSensitiveChange,
    manuallyVerified && robBotHasOfficialEvidence(existing) ? 'ready' : 'research',
  );
  const update = {
    contact_name: Object.prototype.hasOwnProperty.call(contact, 'name') ? string(contact.name, 160) || null : existing.contact_name,
    contact_role: Object.prototype.hasOwnProperty.call(contact, 'role') ? string(contact.role, 160) || null : existing.contact_role,
    contact_email: nextEmail || null,
    contact_manually_verified: manuallyVerified,
    contact_verified_by: manuallyVerified ? actorProfileId : null,
    contact_verified_at: manuallyVerified ? new Date().toISOString() : null,
    draft_subject: steps[0]?.subject || null,
    draft_body: steps[0]?.body || null,
    draft_steps: steps,
    draft_hash: hash,
    draft_source: draftSource,
    updated_by: actorProfileId,
    status: nextStatus,
  };

  if (approvalSensitiveChange && ['approved', 'outreach'].includes(existing.status)) {
    // Stop the executable state first. If the subsequent prospect update
    // fails, the old approval/sequence is still safely unusable.
    await invalidateApproval(db, tenantId, prospectId);
  }
  let query = db.from('robbot3k_prospects').update(update)
    .eq('id', prospectId)
    .eq('draft_hash', reviewedDraftHash);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const updateResult = await query.select('id').maybeSingle();
  const updated = requireData(updateResult);
  if (!updated) fail(409, 'reviewed_draft_changed', 'The prospect changed while saving. Reload and review it again.');
  await writeAuditEvent(db, {
    tenantId,
    actorProfileId,
    action: 'robbot3k_prospect_updated',
    entityType: 'robbot3k_prospect',
    entityId: prospectId,
    phiTouched: false,
    payload: { emailChanged, draftChanged, manuallyVerified },
  });
  return shapedSingle(db, tenantId, prospectId);
}

async function isSuppressed(db, tenantId, email) {
  if (!email) return true;
  const domain = email.split('@')[1] || '';
  // Do not interpolate contact data into a PostgREST `.or()` expression; even
  // a syntactically valid address can contain filter punctuation. Independent
  // equality filters stay parameterized by the Supabase client.
  let emailQuery = db.from('robbot3k_suppressions').select('id').eq('email', email).limit(1);
  let domainQuery = db.from('robbot3k_suppressions').select('id').eq('domain', domain).limit(1);
  if (tenantId) {
    emailQuery = emailQuery.eq('tenant_id', tenantId);
    domainQuery = domainQuery.eq('tenant_id', tenantId);
  }
  const [emailResult, domainResult] = await Promise.all([emailQuery, domainQuery]);
  return (requireData(emailResult) || []).length > 0 || (requireData(domainResult) || []).length > 0;
}

async function hasReplyOrMeeting(db, tenantId, prospectId) {
  let messages = db.from('robbot3k_messages').select('id').eq('prospect_id', prospectId).eq('direction', 'inbound').limit(1);
  let meetings = db.from('robbot3k_meetings').select('id').eq('prospect_id', prospectId).in('status', ['scheduled', 'completed']).limit(1);
  if (tenantId) {
    messages = messages.eq('tenant_id', tenantId);
    meetings = meetings.eq('tenant_id', tenantId);
  }
  const [replyResult, meetingResult] = await Promise.all([messages, meetings]);
  return (requireData(replyResult) || []).length > 0 || (requireData(meetingResult) || []).length > 0;
}

async function closeCurrentApproval(db, tenantId, prospectId) {
  let query = db.from('robbot3k_approvals').update({ is_current: false })
    .eq('prospect_id', prospectId).eq('is_current', true);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const result = await query;
  if (result.error) throw result.error;
}

export async function decideRobBotProspect(db, tenantId, actorProfileId, prospectId, decision, reason = '', {
  expectedDraftHash = '',
} = {}) {
  if (!['approved', 'held', 'rejected', 'revoked'].includes(decision)) fail(400, 'decision_invalid', 'Unknown approval decision.');
  const prospect = await getProspect(db, tenantId, prospectId);
  let decisionRecordId = '';

  if (decision === 'approved') {
    const reviewedDraftHash = string(expectedDraftHash, 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(reviewedDraftHash)) {
      fail(400, 'expected_draft_hash_required', 'Approve the exact draft version shown in the review screen.');
    }
    if (reviewedDraftHash !== prospect.draft_hash) {
      fail(409, 'reviewed_draft_changed', 'The recipient, copy, or source evidence changed. Review the updated record before approving.');
    }
    const recipient = validEmail(prospect.contact_email);
    const steps = manualSequence(prospect.draft_steps);
    const evidence = approvalEvidenceSnapshot(prospect);
    const hash = draftHashFor({ recipient, steps, evidence });
    if (!recipient) fail(400, 'verified_recipient_required', 'A contact email is required.');
    if (!prospect.contact_manually_verified) fail(400, 'manual_email_verification_required', 'A human must verify the email first.');
    if (!robBotHasOfficialEvidence(prospect)) fail(400, 'official_evidence_required', 'A source-linked record is required before approval.');
    if (hash !== prospect.draft_hash) fail(409, 'draft_hash_mismatch', 'The drafts changed. Save and review them again.');
    if (TERMINAL_STATUSES.has(prospect.status)) fail(409, 'prospect_stopped', 'This prospect has a stop condition.');
    if (await isSuppressed(db, tenantId, recipient)) fail(409, 'recipient_suppressed', 'This recipient is suppressed.');
    if (await hasReplyOrMeeting(db, tenantId, prospectId)) fail(409, 'reply_or_booking_exists', 'A reply or meeting already stopped outreach.');

    // CRM is the system of record. Reconcile before creating any executable
    // outreach approval so a CRM failure cannot leave a send-enabled sequence.
    await reconcileRobBotProspectToBd(db, tenantId, actorProfileId, prospectId);

    // The row lock, approval snapshot, sequence creation, and state transition
    // happen in one database transaction. This closes the approval TOCTOU gap
    // between the admin review and an executable sequence.
    const rpcResult = await db.rpc('robbot3k_approve_prospect', {
      p_tenant_id: tenantId,
      p_prospect_id: prospectId,
      p_actor_profile_id: actorProfileId,
      p_expected_draft_hash: reviewedDraftHash,
      p_reason: string(reason, 1_000) || null,
    });
    if (rpcResult.error) {
      const rpcCode = string(rpcResult.error.message, 120).toLowerCase();
      const messages = {
        reviewed_draft_changed: 'The recipient, copy, or source evidence changed. Review the updated record before approving.',
        prospect_not_approvable: 'This prospect is no longer ready for approval.',
        verified_recipient_required: 'A human-verified recipient is required.',
        official_evidence_required: 'Source evidence changed or no longer qualifies.',
        four_drafts_required: 'Exactly four reviewed drafts are required.',
        approved_step_invalid: 'The reviewed cadence or compliance copy is invalid.',
        recipient_suppressed: 'This recipient is suppressed.',
        reply_or_booking_exists: 'A reply or meeting already stopped outreach.',
      };
      if (messages[rpcCode]) fail(409, rpcCode, messages[rpcCode]);
      throw rpcResult.error;
    }
    decisionRecordId = String(rpcResult.data || '');
    try {
      const crmOutcome = await recordRobBotCrmOutcome(db, {
        tenantId, prospectId, outcome: 'approved', actorType: 'human', actorProfileId,
        idempotencyKey: `approval:${decisionRecordId || prospectId}:${reviewedDraftHash}`,
        metadata: { approvalId: decisionRecordId || null, recipientConsentInferred: false },
      });
      if (!crmOutcome.linked) {
        throw Object.assign(new Error('The linked Avalon BD company or opportunity is not active.'), {
          code: 'crm_links_inactive',
        });
      }
    } catch (error) {
      // Stop executable state before surfacing the CRM bridge failure.
      await invalidateApproval(db, tenantId, prospectId, 'crm_bridge_failed');
      await db.from('robbot3k_prospects').update({ status: 'ready', updated_by: actorProfileId })
        .eq('tenant_id', tenantId).eq('id', prospectId);
      throw error;
    }
  } else {
    await closeCurrentApproval(db, tenantId, prospectId);
    const decisionRecord = requireData(await db.from('robbot3k_approvals').insert({
      tenant_id: tenantId,
      prospect_id: prospectId,
      decision,
      is_current: true,
      reason: string(reason, 1_000) || null,
      decided_by: actorProfileId,
    }).select('id').single());
    decisionRecordId = decisionRecord.id;
    let sequenceUpdate = db.from('robbot3k_sequences').update({
      status: decision === 'held' ? 'paused' : 'cancelled',
      stop_reason: `human_${decision}`,
    }).eq('prospect_id', prospectId).in('status', ['ready', 'active', 'paused']);
    if (tenantId) sequenceUpdate = sequenceUpdate.eq('tenant_id', tenantId);
    const sequenceResult = await sequenceUpdate;
    if (sequenceResult.error) throw sequenceResult.error;
    let prospectUpdate = db.from('robbot3k_prospects').update({
      status: decision === 'revoked' ? 'ready' : decision,
      updated_by: actorProfileId,
    }).eq('id', prospectId);
    if (tenantId) prospectUpdate = prospectUpdate.eq('tenant_id', tenantId);
    requireData(await prospectUpdate.select('id').single());
    await recordRobBotCrmOutcome(db, {
      tenantId, prospectId, outcome: decision === 'held' ? 'held' : decision === 'revoked' ? 'revoked' : 'rejected',
      actorType: 'human', actorProfileId,
      idempotencyKey: `decision:${decisionRecordId}`,
      metadata: { decision, reasonPresent: Boolean(reason) },
    });
  }

  await writeAuditEvent(db, {
    tenantId,
    actorProfileId,
    action: `robbot3k_${decision}`,
    entityType: 'robbot3k_prospect',
    entityId: prospectId,
    phiTouched: false,
    payload: { decision, recipientConsentInferred: false },
  });
  return shapedSingle(db, tenantId, prospectId);
}

async function stopSequences(db, tenantId, prospectId, status, reason) {
  if (!STOP_SEQUENCE_STATUSES.has(status)) fail(500, 'sequence_stop_status_invalid');
  let query = db.from('robbot3k_sequences').update({ status, stop_reason: reason })
    .eq('prospect_id', prospectId).in('status', ['ready', 'active', 'paused']);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const result = await query;
  if (result.error) throw result.error;
}

export async function markRobBotReply(db, tenantId, actorProfileId, prospectId, {
  message = '', provider = 'manual', providerMessageId = '', eventId = '',
} = {}) {
  const prospect = await getProspect(db, tenantId, prospectId);
  const idempotency = string(eventId, 300) || `reply:${prospectId}:${providerMessageId || crypto.randomUUID()}`;
  const insert = await db.from('robbot3k_messages').upsert({
    tenant_id: tenantId,
    prospect_id: prospectId,
    direction: 'inbound',
    channel: 'email',
    provider: string(provider, 80) || 'manual',
    provider_message_id: string(providerMessageId, 300) || null,
    idempotency_key: idempotency,
    from_email: prospect.contact_email,
    body: string(message, 20_000) || null,
    status: 'replied',
  }, { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true });
  if (insert.error) throw insert.error;
  await stopSequences(db, tenantId, prospectId, 'replied', 'reply_received');
  let update = db.from('robbot3k_prospects').update({ status: 'replied', updated_by: actorProfileId }).eq('id', prospectId);
  if (tenantId) update = update.eq('tenant_id', tenantId);
  requireData(await update.select('id').single());
  await recordRobBotCrmOutcome(db, {
    tenantId, prospectId, outcome: 'reply',
    actorType: actorProfileId ? 'human' : 'system', actorProfileId,
    idempotencyKey: idempotency,
    metadata: { provider: string(provider, 80) || 'manual' },
  });
  await writeAuditEvent(db, {
    tenantId, actorProfileId, action: 'robbot3k_reply_recorded', entityType: 'robbot3k_prospect', entityId: prospectId,
    phiTouched: false, payload: { provider: string(provider, 80) || 'manual' },
  });
  return shapedSingle(db, tenantId, prospectId);
}

export async function markRobBotBooked(db, tenantId, actorProfileId, prospectId, {
  scheduledAt = null, externalId = '', bookingUrl = '', provider = 'manual', metadata = {},
} = {}) {
  await getProspect(db, tenantId, prospectId);
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  if (!scheduledDate || Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
    fail(400, 'scheduled_at_required', 'A valid future meeting time is required before marking a prospect booked.');
  }
  const row = {
    tenant_id: tenantId,
    prospect_id: prospectId,
    provider: string(provider, 80) || 'manual',
    external_id: string(externalId, 300) || null,
    status: 'scheduled',
    scheduled_at: scheduledDate.toISOString(),
    booking_url: string(bookingUrl, 2_000) || null,
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
    created_by: actorProfileId,
  };
  let meetingResult;
  if (row.external_id) {
    meetingResult = await db.from('robbot3k_meetings').upsert(row, {
      onConflict: 'tenant_id,provider,external_id', ignoreDuplicates: false,
    });
  } else {
    meetingResult = await db.from('robbot3k_meetings').insert(row);
  }
  if (meetingResult.error) throw meetingResult.error;
  await stopSequences(db, tenantId, prospectId, 'booked', 'meeting_booked');
  let update = db.from('robbot3k_prospects').update({ status: 'booked', updated_by: actorProfileId }).eq('id', prospectId);
  if (tenantId) update = update.eq('tenant_id', tenantId);
  requireData(await update.select('id').single());
  await recordRobBotCrmOutcome(db, {
    tenantId, prospectId, outcome: 'booked',
    actorType: actorProfileId ? 'human' : 'system', actorProfileId,
    idempotencyKey: `booking:${row.provider}:${row.external_id || crypto.randomUUID()}`,
    occurredAt: row.scheduled_at || new Date().toISOString(),
    metadata: { provider: row.provider, scheduledAt: row.scheduled_at },
  });
  await writeAuditEvent(db, {
    tenantId, actorProfileId, action: 'robbot3k_meeting_booked', entityType: 'robbot3k_prospect', entityId: prospectId,
    phiTouched: false, payload: { provider: row.provider, scheduledAtPresent: Boolean(row.scheduled_at) },
  });
  return shapedSingle(db, tenantId, prospectId);
}

export async function suppressRobBotProspect(db, tenantId, actorProfileId, prospectId, {
  email = '', reason = 'admin', source = 'admin', details = {},
} = {}) {
  const prospect = await getProspect(db, tenantId, prospectId);
  const targetEmail = validEmail(email || prospect.contact_email);
  if (!targetEmail) fail(400, 'suppression_email_required', 'A valid email is required for suppression.');
  let existing = db.from('robbot3k_suppressions').select('id').eq('tenant_id', tenantId).ilike('email', targetEmail).limit(1);
  const existingRows = requireData(await existing) || [];
  if (!existingRows.length) {
    const insert = await db.from('robbot3k_suppressions').insert({
      tenant_id: tenantId,
      prospect_id: prospectId,
      email: targetEmail,
      reason: ['unsubscribe', 'bounce', 'complaint', 'admin', 'recipient_request', 'other'].includes(reason) ? reason : 'other',
      source: string(source, 120) || 'admin',
      details: details && typeof details === 'object' && !Array.isArray(details) ? details : {},
      created_by: actorProfileId,
    });
    if (insert.error && !isUniqueViolation(insert.error)) throw insert.error;
  }
  await stopSequences(db, tenantId, prospectId, 'suppressed', `suppressed:${reason}`);
  await closeCurrentApproval(db, tenantId, prospectId);
  let update = db.from('robbot3k_prospects').update({
    status: 'suppressed', recipient_consent_status: reason === 'unsubscribe' || reason === 'recipient_request' ? 'opted_out' : prospect.recipient_consent_status,
    updated_by: actorProfileId,
  }).eq('id', prospectId);
  if (tenantId) update = update.eq('tenant_id', tenantId);
  requireData(await update.select('id').single());
  await recordRobBotCrmOutcome(db, {
    tenantId, prospectId, outcome: 'suppressed',
    actorType: actorProfileId ? 'human' : 'system', actorProfileId,
    idempotencyKey: `suppression:${reason}:${targetEmail}`,
    metadata: { reason, source: string(source, 120) || 'admin' },
  });
  await writeAuditEvent(db, {
    tenantId, actorProfileId, action: 'robbot3k_suppressed', entityType: 'robbot3k_prospect', entityId: prospectId,
    phiTouched: false, payload: { reason, source: string(source, 120) || 'admin' },
  });
  return shapedSingle(db, tenantId, prospectId);
}

export async function findRobBotProspectForSignal(db, tenantId, {
  prospectId = '', provider = '', providerMessageId = '', email = '',
} = {}) {
  if (prospectId) return getProspect(db, tenantId, prospectId);
  if (providerMessageId) {
    const providerId = string(provider, 80).toLowerCase();
    if (!providerId) fail(400, 'signal_provider_required', 'A provider is required with a provider message ID.');
    let messageQuery = db.from('robbot3k_messages').select('prospect_id')
      .eq('provider', providerId)
      .eq('provider_message_id', providerMessageId)
      .limit(1);
    if (tenantId) messageQuery = messageQuery.eq('tenant_id', tenantId);
    const messages = requireData(await messageQuery) || [];
    if (messages[0]?.prospect_id) return getProspect(db, tenantId, messages[0].prospect_id);
  }
  const targetEmail = validEmail(email);
  if (targetEmail) {
    let query = db.from('robbot3k_prospects').select('*').ilike('contact_email', targetEmail).limit(2);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const rows = requireData(await query) || [];
    if (rows.length === 1) return rows[0];
    if (rows.length > 1) fail(409, 'signal_email_ambiguous', 'More than one prospect uses this email.');
  }
  fail(404, 'signal_prospect_not_found', 'No matching prospect was found.');
}

async function claimRefreshRun(db, tenantId, actorProfileId, triggerSource, localDate, sourceUrl) {
  if (triggerSource === 'schedule') {
    // A serverless timeout can strand a run in `running`, which would otherwise
    // block the second DST-safe cron invocation for the rest of the Pacific day.
    // Reclaim only claims older than 30 minutes; a normal Atlas import is far
    // shorter and the unique partial index still prevents concurrent runs.
    const staleBefore = new Date(Date.now() - 30 * 60_000).toISOString();
    const stale = await db.from('robbot3k_runs').update({
      status: 'failed',
      error_code: 'stale_refresh_claim',
      finished_at: new Date().toISOString(),
    })
      .eq('tenant_id', tenantId)
      .eq('run_type', 'refresh')
      .eq('trigger_source', 'schedule')
      .eq('pacific_local_date', localDate)
      .eq('status', 'running')
      .lt('started_at', staleBefore);
    if (stale.error) throw stale.error;
  }
  const result = await db.from('robbot3k_runs').insert({
    tenant_id: tenantId,
    run_type: 'refresh',
    trigger_source: triggerSource,
    status: 'running',
    pacific_local_date: localDate,
    source_url: sourceUrl,
    provider: 'atlas_static_import',
    provider_status: 'fetching',
    created_by: actorProfileId,
  }).select('*').single();
  if (result.error && triggerSource === 'schedule' && isUniqueViolation(result.error)) return null;
  return requireData(result);
}

export async function runRobBotRefresh(db, tenantId, actorProfileId, {
  triggerSource = 'manual', now = new Date(), fetchImpl = globalThis.fetch,
} = {}) {
  const clock = pacificClock(now);
  if (triggerSource === 'schedule' && clock.hour !== 6) {
    return { skipped: true, reason: 'outside_6am_pacific_window', pacific: clock };
  }
  const sourceUrl = process.env.ROBBOT3K_ATLAS_URL || ATLAS_DEFAULT_URL;
  const run = await claimRefreshRun(db, tenantId, actorProfileId, triggerSource, clock.date, sourceUrl);
  if (!run) return { skipped: true, deduped: true, reason: 'pacific_date_already_refreshed', pacific: clock };

  try {
    const { url, dataset } = await fetchAtlasDataset({ url: sourceUrl, fetchImpl });
    const settings = await readRobBotSettings(db, tenantId);
    const incoming = normalizeAtlasProspects(dataset, {
      calendlyUrl: settings.calendlyUrl || process.env.ROBBOT3K_CALENDLY_URL || '',
      physicalAddress: settings.physicalPostalAddress,
    });
    const existingRows = await selectAllTenantRows(db, 'robbot3k_prospects', '*', tenantId);
    const existingByKey = new Map(existingRows.map((row) => [`${row.source_kind}:${row.source_id}`, row]));
    const changedApproved = [];
    let inserted = 0;
    let updated = 0;
    const upserts = incoming.map((record) => {
      const key = `${record.source_kind}:${record.source_id}`;
      const existing = existingByKey.get(key);
      if (existing) updated += 1;
      else inserted += 1;
      const contactEmail = existing?.contact_email || record.contact_email;
      const contactName = existing?.contact_name || null;
      let draft = rebuildProspectDraft(
        { ...record, contact_email: contactEmail, contact_name: contactName },
        {
          calendlyUrl: settings.calendlyUrl || process.env.ROBBOT3K_CALENDLY_URL || '',
          physicalAddress: settings.physicalPostalAddress,
        },
      );
      let draftSource = 'deterministic';
      if (existing?.draft_source === 'manual' && Array.isArray(existing.draft_steps) && existing.draft_steps.length === 4) {
        draft = {
          draft_subject: existing.draft_subject,
          draft_body: existing.draft_body,
          draft_steps: existing.draft_steps,
          draft_hash: draftHashFor({
            recipient: contactEmail,
            steps: existing.draft_steps,
            evidence: approvalEvidenceSnapshot(record),
          }),
        };
        draftSource = 'manual';
      }
      if (existing && existing.draft_hash && draft.draft_hash !== existing.draft_hash && ['approved', 'outreach'].includes(existing.status)) {
        changedApproved.push(existing.id);
      }
      return {
        ...record,
        ...draft,
        tenant_id: tenantId,
        contact_name: contactName,
        contact_role: existing?.contact_role || null,
        contact_email: contactEmail || null,
        contact_manually_verified: existing?.contact_email === contactEmail ? Boolean(existing?.contact_manually_verified) : false,
        contact_verified_by: existing?.contact_email === contactEmail ? existing?.contact_verified_by || null : null,
        contact_verified_at: existing?.contact_email === contactEmail ? existing?.contact_verified_at || null : null,
        recipient_consent_status: existing?.recipient_consent_status || 'unknown',
        draft_source: draftSource,
        status: existing?.status === 'archived' ? 'research' : existing?.status || 'research',
        created_by: existing?.created_by || actorProfileId,
        updated_by: actorProfileId,
      };
    });

    for (const group of chunks(upserts, 100)) {
      const result = await db.from('robbot3k_prospects').upsert(group, {
        onConflict: 'tenant_id,source_kind,source_id', ignoreDuplicates: false,
      });
      if (result.error) throw result.error;
    }
    for (const prospectId of changedApproved) {
      await invalidateApproval(db, tenantId, prospectId, 'source_refresh_changed_approved_draft');
      let reset = db.from('robbot3k_prospects').update({ status: 'ready' }).eq('id', prospectId);
      if (tenantId) reset = reset.eq('tenant_id', tenantId);
      const result = await reset;
      if (result.error) throw result.error;
    }
    const removed = atlasRowsMissingFromSnapshot(existingRows, incoming);
    for (const row of removed) {
      await invalidateApproval(db, tenantId, row.id, 'atlas_source_record_removed');
      let archive = db.from('robbot3k_prospects').update({
        status: 'archived', updated_by: actorProfileId,
      }).eq('id', row.id);
      if (tenantId) archive = archive.eq('tenant_id', tenantId);
      const result = await archive;
      if (result.error) throw result.error;
    }
    const counts = {
      total: incoming.length,
      inserted,
      updated,
      approvalsInvalidated: changedApproved.length,
      archived: removed.length,
      sourceOnly: incoming.filter((row) => row.research_status === 'source_only').length,
      needsEvidence: incoming.filter((row) => row.research_status === 'needs_evidence').length,
    };
    requireData(await db.from('robbot3k_runs').update({
      status: 'succeeded',
      source_url: url,
      source_snapshot: string(dataset.meta.snapshot, 40),
      provider_status: 'deterministic_source_only',
      counts,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id).select('id').single());
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId,
      action: 'robbot3k_refresh_completed',
      entityType: 'robbot3k_run',
      entityId: run.id,
      phiTouched: false,
      payload: { triggerSource, snapshot: dataset.meta.snapshot, ...counts },
    });
    return { ok: true, runId: run.id, snapshot: dataset.meta.snapshot, counts, pacific: clock };
  } catch (error) {
    const code = safeErrorCode(error, 'robbot3k_refresh_failed');
    try {
      await db.from('robbot3k_runs').update({
        status: 'failed', error_code: code, provider_status: 'failed', finished_at: new Date().toISOString(),
      }).eq('id', run.id);
    } catch { /* preserve the original failure */ }
    console.warn('[robbot3k/refresh] failed', safeLogContext(error, 'robbot3k_refresh_failed'));
    throw error;
  }
}
