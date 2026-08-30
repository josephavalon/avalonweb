import crypto from 'crypto';
import { parse } from 'acorn';

export const ATLAS_DEFAULT_URL = 'https://avbaeg826.netlify.app/';
export const CADENCE_DAYS = Object.freeze([0, 3, 7, 14]);

const DATASET_NAMES = new Set([
  'CN', 'PLAY', 'DATA_META', 'FLASH_EVENTS', 'EV', 'TARGET_SEGMENTS', 'TARGETS',
]);
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_AST_VALUE_NODES = 150_000;
const MAX_STATIC_DEPTH = 16;
const MAX_RECORDS = 5_000;
const UNSUBSCRIBE_COPY = 'If you would rather not hear from Avalon about this, reply “no thanks” and we will stop.';

function fail(code, message = code) {
  throw Object.assign(new Error(message), { code });
}

function text(value, max = 2_000) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanName(value) {
  return text(value, 240).replace(/^★\s*/, '');
}

function publicUrl(value) {
  const raw = text(value, 2_000);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function uniqueUrls(values) {
  return Array.from(new Set(values.map(publicUrl).filter(Boolean))).slice(0, 8);
}

function normalizeEmail(value) {
  const email = text(value, 320).toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email) ? email : '';
}

function emailFromText(value) {
  const match = text(value, 4_000).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? normalizeEmail(match[0]) : '';
}

function firstName(contactName) {
  return text(contactName, 120).split(/\s+/)[0] || '';
}

function validCalendlyUrl(value) {
  const url = publicUrl(value);
  return url.startsWith('https://') ? url : '';
}

function staticPropertyKey(node) {
  if (!node || node.computed || node.method || node.kind === 'get' || node.kind === 'set') {
    fail('atlas_dynamic_property', 'Atlas dataset contains a dynamic object property.');
  }
  if (node.key?.type === 'Identifier') return node.key.name;
  if (node.key?.type === 'Literal' && (typeof node.key.value === 'string' || typeof node.key.value === 'number')) {
    return String(node.key.value);
  }
  fail('atlas_invalid_property', 'Atlas dataset contains an unsupported object key.');
}

/**
 * Evaluate only JSON-like syntax from an Acorn AST. No Identifier, Call,
 * MemberExpression, spread, computed property, template expression, function,
 * or operator capable of executing page code is accepted.
 */
export function parseStaticExpression(node, state = { nodes: 0 }, depth = 0) {
  state.nodes += 1;
  if (state.nodes > MAX_AST_VALUE_NODES) fail('atlas_static_value_too_large');
  if (depth > MAX_STATIC_DEPTH) fail('atlas_static_value_too_deep');
  if (!node) fail('atlas_missing_initializer');

  if (node.type === 'Literal') {
    const value = node.value;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (value.length > 100_000) fail('atlas_string_too_large');
      return value;
    }
    fail('atlas_unsupported_literal');
  }

  if (node.type === 'TemplateLiteral') {
    if (node.expressions.length) fail('atlas_dynamic_template');
    return node.quasis.map((part) => part.value.cooked ?? part.value.raw).join('');
  }

  if (node.type === 'UnaryExpression' && ['+', '-'].includes(node.operator)) {
    const value = parseStaticExpression(node.argument, state, depth + 1);
    if (typeof value !== 'number' || !Number.isFinite(value)) fail('atlas_invalid_unary');
    return node.operator === '-' ? -value : value;
  }

  if (node.type === 'ArrayExpression') {
    if (node.elements.length > MAX_RECORDS) fail('atlas_array_too_large');
    return node.elements.map((item) => {
      if (!item || item.type === 'SpreadElement') fail('atlas_dynamic_array');
      return parseStaticExpression(item, state, depth + 1);
    });
  }

  if (node.type === 'ObjectExpression') {
    const output = Object.create(null);
    for (const property of node.properties) {
      if (property.type !== 'Property' || property.shorthand) fail('atlas_dynamic_object');
      const key = staticPropertyKey(property);
      if (Object.prototype.hasOwnProperty.call(output, key)) fail('atlas_duplicate_property');
      output[key] = parseStaticExpression(property.value, state, depth + 1);
    }
    return output;
  }

  fail('atlas_dynamic_expression', `Atlas dataset expression ${node.type} is not static.`);
}

function inlineScripts(html) {
  const scripts = [];
  const matcher = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = matcher.exec(html))) {
    if (/\bsrc\s*=/i.test(match[1])) continue;
    scripts.push(match[2]);
  }
  return scripts;
}

function datasetRootName(node) {
  let current = node?.type === 'ChainExpression' ? node.expression : node;
  while (current?.type === 'MemberExpression') current = current.object;
  return current?.type === 'Identifier' && DATASET_NAMES.has(current.name) ? current.name : '';
}

function memberName(node) {
  if (node?.type !== 'MemberExpression') return '';
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
  if (node.computed && node.property?.type === 'Literal') return String(node.property.value || '');
  return '';
}

function rejectDatasetMutations(ast) {
  const mutators = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift']);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'AssignmentExpression' && datasetRootName(node.left)
      || node.type === 'UpdateExpression' && datasetRootName(node.argument)
      || node.type === 'UnaryExpression' && node.operator === 'delete' && datasetRootName(node.argument)
    ) {
      fail('atlas_dynamic_dataset_mutation', 'Atlas datasets must remain static literals.');
    }
    if (node.type === 'CallExpression') {
      const target = datasetRootName(node.callee);
      if (target && mutators.has(memberName(node.callee))) {
        fail('atlas_dynamic_dataset_mutation', 'Atlas datasets must not be mutated after declaration.');
      }
      const owner = node.callee?.type === 'MemberExpression' ? datasetRootName(node.arguments?.[0]) : '';
      const api = `${datasetRootName(node.callee?.object) || node.callee?.object?.name || ''}.${memberName(node.callee)}`;
      if (owner && ['Object.assign', 'Reflect.set', 'Reflect.deleteProperty'].includes(api)) {
        fail('atlas_dynamic_dataset_mutation', 'Atlas datasets must not be mutated through helper APIs.');
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && typeof value.type === 'string') visit(value);
    }
  };
  visit(ast);
}

export function parseAtlasHtml(html) {
  if (typeof html !== 'string' || !html.trim()) fail('atlas_empty_html');
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) fail('atlas_html_too_large');

  const found = new Map();
  const scripts = inlineScripts(html);
  if (!scripts.length) fail('atlas_no_inline_scripts');

  for (const source of scripts) {
    let ast;
    try {
      ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {
      // Fail closed: a source page we cannot completely parse is not safe to
      // partially import, because dataset boundaries may have changed.
      fail('atlas_script_parse_failed');
    }
    rejectDatasetMutations(ast);
    for (const statement of ast.body) {
      if (statement.type !== 'VariableDeclaration') continue;
      for (const declaration of statement.declarations) {
        const name = declaration.id?.type === 'Identifier' ? declaration.id.name : '';
        if (!DATASET_NAMES.has(name)) continue;
        if (found.has(name)) fail('atlas_duplicate_dataset', `Duplicate Atlas dataset: ${name}`);
        found.set(name, parseStaticExpression(declaration.init));
      }
    }
  }

  for (const required of ['DATA_META', 'EV', 'TARGET_SEGMENTS', 'TARGETS']) {
    if (!found.has(required)) fail('atlas_dataset_missing', `Required Atlas dataset is missing: ${required}`);
  }

  const data = Object.fromEntries(found.entries());
  if (!data.DATA_META || typeof data.DATA_META !== 'object' || Array.isArray(data.DATA_META)) fail('atlas_meta_invalid');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.DATA_META.snapshot || ''))) fail('atlas_snapshot_invalid');
  if (!Array.isArray(data.EV) || !Array.isArray(data.TARGETS)) fail('atlas_records_invalid');
  if (data.EV.length > MAX_RECORDS || data.TARGETS.length > MAX_RECORDS) fail('atlas_record_limit');

  const eventIds = new Set();
  for (const record of [...(Array.isArray(data.FLASH_EVENTS) ? data.FLASH_EVENTS : []), ...data.EV]) {
    const id = text(record?.id, 120);
    if (!id || eventIds.has(id)) fail('atlas_duplicate_event_id');
    eventIds.add(id);
  }
  const targetIds = new Set();
  for (const record of data.TARGETS) {
    const id = text(record?.id, 120);
    if (!id || targetIds.has(id)) fail('atlas_duplicate_target_id');
    targetIds.add(id);
  }

  return {
    meta: data.DATA_META,
    categories: data.CN || {},
    plays: data.PLAY || {},
    segments: data.TARGET_SEGMENTS,
    events: data.EV,
    flashEvents: Array.isArray(data.FLASH_EVENTS) ? data.FLASH_EVENTS : [],
    targets: data.TARGETS,
  };
}

function allowedAtlasHosts() {
  const configured = String(process.env.ROBBOT3K_ATLAS_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set(['avbaeg826.netlify.app', ...configured]);
}

function checkedAtlasUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('atlas_url_invalid');
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port) fail('atlas_url_not_allowed');
  if (!allowedAtlasHosts().has(hostname)) fail('atlas_host_not_allowed');
  if (hostname === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
    fail('atlas_private_host_not_allowed');
  }
  url.hash = '';
  return url;
}

async function responseTextWithLimit(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_HTML_BYTES) fail('atlas_html_too_large');
  if (!response.body?.getReader) {
    const value = await response.text();
    if (Buffer.byteLength(value, 'utf8') > MAX_HTML_BYTES) fail('atlas_html_too_large');
    return value;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_HTML_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      fail('atlas_html_too_large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchAtlasDataset({
  url = process.env.ROBBOT3K_ATLAS_URL || ATLAS_DEFAULT_URL,
  timeoutMs = 15_000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') fail('atlas_fetch_unavailable');
  let current = checkedAtlasUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, Math.min(Number(timeoutMs) || 15_000, 30_000)));
  try {
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      const response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'text/html', 'user-agent': 'Avalon-RobBot3K/1.0' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirectCount === 3) fail('atlas_redirect_invalid');
        current = checkedAtlasUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) fail('atlas_fetch_failed', `Atlas returned HTTP ${response.status}.`);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.includes('text/html')) fail('atlas_content_type_invalid');
      const html = await responseTextWithLimit(response);
      return { url: current.toString(), dataset: parseAtlasHtml(html) };
    }
    fail('atlas_redirect_limit');
  } catch (error) {
    if (error?.name === 'AbortError') fail('atlas_fetch_timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function sortedValue(value) {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedValue(value[key])]));
}

export function approvalEvidenceSnapshot(prospect = {}) {
  const sourceValues = prospect.public_sources ?? prospect.publicSources ?? [];
  return {
    sourceKind: text(prospect.source_kind ?? prospect.sourceKind, 80),
    sourceId: text(prospect.source_id ?? prospect.sourceId, 160),
    sourceSnapshot: text(prospect.source_snapshot ?? prospect.sourceSnapshot, 80),
    verification: text(prospect.verification, 160),
    researchSummary: text(prospect.research_summary ?? prospect.researchSummary, 2_000),
    fitSummary: text(prospect.fit_summary ?? prospect.fitSummary, 2_000),
    recommendedRoute: text(prospect.recommended_route ?? prospect.recommendedRoute, 2_000),
    publicSources: uniqueUrls(Array.isArray(sourceValues) ? sourceValues : []),
  };
}

export function draftHashFor({ recipient, steps, evidence = {} }) {
  const stable = JSON.stringify(sortedValue({
    recipient: normalizeEmail(recipient),
    steps: Array.isArray(steps) ? steps.map((step) => ({
      subject: text(step?.subject, 240),
      body: String(step?.body || '').trim(),
    })) : [],
    evidence,
  }));
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function greeting(organization, contactName) {
  const name = firstName(contactName);
  return name ? `Hi ${name},` : `Hello ${text(organization, 180)} team,`;
}

function schedulingLine(calendlyUrl) {
  return calendlyUrl ? `\n\nIf useful, you can choose a time here: ${calendlyUrl}` : '';
}

function outboundSignal(value) {
  return text(value, 1_500)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b(?:atlas audience signal|the atlas record requires more source research|source-linked research|working hypothesis|permissioned pilot)\s*:?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 480);
}

function buildDraftSteps({ organization, contactName, signal, fit, route, source, calendlyUrl, physicalAddress = '' }) {
  const hello = greeting(organization, contactName);
  const schedule = schedulingLine(calendlyUrl);
  const complianceFooter = `${UNSUBSCRIBE_COPY}${physicalAddress ? `\n\nAvalon Vitality · ${text(physicalAddress, 500)}` : ''}`;
  const publicSignal = outboundSignal(signal);
  const opening = publicSignal
    ? `I noticed ${publicSignal}`
    : 'I’m reaching out because Avalon is exploring Bay Area workplace and event partnerships.';
  const subject = `A wellness idea for ${organization}`.slice(0, 180);
  return [
    {
      day: 0,
      subject,
      body: `${hello}\n\nI’m with Avalon Vitality. ${opening}\n\nAvalon brings clinician-led mobile wellness and recovery services to Bay Area workplaces and events, with the care team and on-site logistics handled end to end.\n\nWould a short conversation about whether this could support ${organization} be useful? If someone else owns workplace, events, or partnerships, I’d appreciate the redirect.${schedule}\n\n${complianceFooter}`,
    },
    {
      day: 3,
      subject: `Re: ${subject}`,
      body: `${hello}\n\nFollowing up on my Avalon note. We can start with a focused workplace recovery block or support a larger team or event day, depending on what is actually useful.\n\nIs there a better person on your team for a brief fit conversation?${schedule}\n\n${complianceFooter}`,
    },
    {
      day: 7,
      subject: `Re: ${subject}`,
      body: `${hello}\n\nOne concise follow-up: if ${organization} has an upcoming team day, event, or high-demand work period, Avalon can outline a practical on-site format and the clinical and operating requirements.\n\nWould a 15-minute call be worthwhile?${schedule}\n\n${complianceFooter}`,
    },
    {
      day: 14,
      subject: `Closing the loop — ${organization}`.slice(0, 180),
      body: `${hello}\n\nClosing the loop. If mobile wellness or recovery support becomes relevant for ${organization}, I’d be glad to speak with the appropriate owner. Otherwise, no action is needed and this is my final follow-up.${schedule}\n\n${complianceFooter}`,
    },
  ];
}

function normalizedBase({
  sourceKind, sourceId, snapshot, organization, segment, location, priority,
  verification, qualification, budgetSignal, researchSummary, fitSummary,
  recommendedRoute, publicSources, sourcePayload, outreachSignal, contactEmail, calendlyUrl, physicalAddress,
}) {
  const sources = uniqueUrls(publicSources);
  const signal = text(researchSummary, 1_500) || 'The Atlas record requires more source research.';
  const fit = text(fitSummary, 1_500) || 'Avalon should validate fit before proposing outreach.';
  const route = text(recommendedRoute, 1_500) || 'Identify the appropriate public business contact and confirm the permission path.';
  const org = cleanName(organization) || 'Prospective partner';
  const email = normalizeEmail(contactEmail);
  const evidence = approvalEvidenceSnapshot({
    source_kind: sourceKind,
    source_id: sourceId,
    source_snapshot: snapshot,
    verification,
    research_summary: signal,
    fit_summary: fit,
    recommended_route: route,
    public_sources: sources,
  });
  const steps = buildDraftSteps({
    organization: org,
    contactName: '',
    signal: outreachSignal || signal,
    fit,
    route,
    source: sources[0] || '',
    calendlyUrl,
    physicalAddress,
  });
  return {
    source_kind: sourceKind,
    source_id: text(sourceId, 160),
    source_snapshot: text(snapshot, 40),
    organization: org,
    name: org,
    segment: text(segment, 160) || null,
    location: text(location, 240) || null,
    priority: [1, 2, 3].includes(Number(priority)) ? Number(priority) : 1,
    verification: text(verification, 120) || null,
    qualification: text(qualification, 1_500) || null,
    budget_signal: text(budgetSignal, 1_500) || null,
    research_summary: signal,
    fit_summary: fit,
    recommended_route: route,
    public_sources: sources,
    source_payload: sourcePayload,
    research_provider: 'deterministic_source_only',
    research_status: sources.length ? 'source_only' : 'needs_evidence',
    draft_evidence: sources.map((url, index) => ({ source: url, primary: index === 0 })),
    contact_email: email || null,
    draft_subject: steps[0].subject,
    draft_body: steps[0].body,
    draft_steps: steps,
    draft_hash: draftHashFor({ recipient: email, steps, evidence }),
    last_researched_at: new Date().toISOString(),
  };
}

export function rebuildProspectDraft(prospect, {
  calendlyUrl = process.env.ROBBOT3K_CALENDLY_URL || '',
  physicalAddress = '',
} = {}) {
  const source = Array.isArray(prospect.public_sources) ? publicUrl(prospect.public_sources[0]) : '';
  const steps = buildDraftSteps({
    organization: cleanName(prospect.organization || prospect.name),
    contactName: text(prospect.contact_name, 120),
    signal: text(prospect.source_payload?.outreach_signal, 1_500)
      || text(prospect.research_summary, 1_500)
      || 'The Atlas record requires more source research.',
    fit: text(prospect.fit_summary, 1_500) || 'Avalon should validate fit before proposing outreach.',
    route: text(prospect.recommended_route, 1_500) || 'Identify the appropriate public business contact and confirm the permission path.',
    source,
    calendlyUrl: validCalendlyUrl(calendlyUrl),
    physicalAddress,
  });
  return {
    draft_subject: steps[0].subject,
    draft_body: steps[0].body,
    draft_steps: steps,
    draft_hash: draftHashFor({
      recipient: prospect.contact_email,
      steps,
      evidence: approvalEvidenceSnapshot(prospect),
    }),
  };
}

export function normalizeAtlasProspects(dataset, {
  calendlyUrl = process.env.ROBBOT3K_CALENDLY_URL || '',
  physicalAddress = '',
} = {}) {
  if (!dataset?.meta?.snapshot) fail('atlas_dataset_invalid');
  const snapshot = text(dataset.meta.snapshot, 40);
  const calendar = validCalendlyUrl(calendlyUrl);
  // FLASH_EVENTS powers the Atlas's auxiliary "coming soon" rail and is not
  // part of the displayed 1,240-record opportunity list. Importing it would
  // silently inflate the user-approved source universe.
  const eventRecords = [...(dataset.events || [])];

  const events = eventRecords.map((event) => {
    const name = cleanName(event.n);
    const category = text(dataset.categories?.[event.c], 120) || text(event.c, 120) || 'Event';
    const play = text(dataset.plays?.[event.play], 80) || text(event.play, 80) || 'Research';
    const attendance = text(event.att || event.modeled, 240);
    const date = text(event.d || (Array.isArray(event.dates) ? event.dates.join(', ') : ''), 240);
    const signal = [
      date ? `${name} is listed for ${date} at ${text(event.l, 240)}.` : `${name} is listed at ${text(event.l, 240)}.`,
      attendance ? `Atlas audience signal: ${attendance}.` : '',
      text(event.note, 1_000),
    ].filter(Boolean).join(' ');
    const primarySource = publicUrl(event.src);
    const sources = uniqueUrls([primarySource, event.crowdSrc, event.socialDiscovery]);
    return normalizedBase({
      sourceKind: 'atlas_event',
      sourceId: event.id,
      snapshot,
      organization: name,
      segment: category,
      location: event.l,
      priority: event.p,
      // Crowd and social-discovery links are supporting signals only. An event
      // becomes approval-eligible only when its own primary source is present.
      verification: primarySource && !event.u ? 'source_linked' : 'needs_verification',
      qualification: attendance || null,
      budgetSignal: null,
      researchSummary: signal,
      fitSummary: event.note || `${category} audience; Avalon must validate a real need and permitted access.`,
      recommendedRoute: `${play}. Confirm organizer, property, clinical, operations, and budget permissions before any activation.`,
      publicSources: sources,
      outreachSignal: date
        ? `${name} is listed for ${date} at ${text(event.l, 240)}.`
        : `${name} is listed at ${text(event.l, 240)}.`,
      sourcePayload: {
        outreach_signal: date
          ? `${name} is listed for ${date} at ${text(event.l, 240)}.`
          : `${name} is listed at ${text(event.l, 240)}.`,
        date: date || null,
        dates: Array.isArray(event.dates) ? event.dates.slice(0, 40) : Array.isArray(event.dt) ? event.dt.slice(0, 40) : [],
        category: text(event.c, 40) || null,
        play: text(event.play, 40) || null,
        attendance: attendance || null,
        date_unconfirmed: Boolean(event.u),
      },
      contactEmail: emailFromText(`${event.access || ''} ${event.note || ''}`),
      calendlyUrl: calendar,
      physicalAddress,
    });
  });

  const targets = (dataset.targets || []).map((target) => {
    const segment = text(dataset.segments?.[target.seg], 160) || text(target.seg, 160) || 'Target account';
    const sources = uniqueUrls([target.src, target.src2, target.src3]);
    return normalizedBase({
      sourceKind: 'atlas_target',
      sourceId: target.id,
      snapshot,
      organization: target.n,
      segment,
      location: target.loc,
      priority: target.p,
      verification: target.conf,
      qualification: target.qual,
      budgetSignal: target.budget,
      researchSummary: target.signal,
      fitSummary: target.fit,
      recommendedRoute: target.route,
      publicSources: sources,
      sourcePayload: {
        atlas_segment: text(target.seg, 80) || null,
        outreach_signal: text(target.signal, 1_000) || null,
      },
      outreachSignal: target.signal,
      contactEmail: emailFromText(`${target.route || ''} ${target.signal || ''}`),
      calendlyUrl: calendar,
      physicalAddress,
    });
  });

  return [...targets, ...events];
}
