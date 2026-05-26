import { appendActivity, readLocal, writeLocal } from '../../src/lib/localOs.js';

export const LOCAL_REPOSITORY_VERSION = '2026.05.no-api-repo-v1';
export const LOCAL_SCHEMA_VERSION = '2026.05.local-schema-v1';
export const LOCAL_EVENT_LEDGER_VERSION = '2026.05.local-ledger-v1';

export const LOCAL_REPOSITORY_ENTITIES = [
  'booking',
  'client',
  'nurse',
  'visit',
  'kit',
  'inventoryItem',
  'inventoryTransaction',
  'message',
  'auditEvent',
  'crossPortalEvent',
];

export const ROLE_VISIBILITY_RULES = {
  client: {
    canSee: ['booking', 'client', 'visit', 'message', 'crossPortalEvent'],
    redact: ['internalMargin', 'nursePhone', 'clinicalNotes', 'auditPayload', 'financePayload'],
  },
  nurse: {
    canSee: ['booking', 'client', 'nurse', 'visit', 'kit', 'inventoryItem', 'message', 'crossPortalEvent'],
    redact: ['internalMargin', 'financePayload', 'auditPayload', 'unassignedClientPhone'],
  },
  admin: {
    canSee: LOCAL_REPOSITORY_ENTITIES,
    redact: ['clinicalNotes'],
  },
  finance: {
    canSee: ['booking', 'visit', 'inventoryTransaction', 'auditEvent'],
    redact: ['phone', 'email', 'address', 'clinicalNotes', 'gfePayload'],
  },
  clinical: {
    canSee: ['booking', 'client', 'visit', 'auditEvent'],
    redact: ['financePayload', 'paymentInstrument'],
  },
};

const REQUIRED_FIELDS = {
  booking: ['id', 'client', 'status'],
  client: ['id', 'name'],
  nurse: ['id', 'name', 'status'],
  visit: ['id', 'client', 'status'],
  kit: ['id', 'nurse', 'status'],
  inventoryItem: ['id', 'name', 'status'],
  inventoryTransaction: ['id', 'item', 'quantity', 'status'],
  message: ['id', 'audience', 'status'],
  auditEvent: ['id', 'actor', 'action', 'at'],
  crossPortalEvent: ['id', 'type', 'actor', 'at'],
};

export const LOCAL_ENTITY_SCHEMAS = {
  booking: {
    required: REQUIRED_FIELDS.booking,
    safeFields: ['service', 'city', 'address', 'time', 'nurse', 'payment', 'intake', 'consent', 'gfe', 'total'],
    owner: 'booking',
  },
  client: {
    required: REQUIRED_FIELDS.client,
    safeFields: ['phone', 'email', 'address', 'clinicalMode'],
    owner: 'identity',
  },
  nurse: {
    required: REQUIRED_FIELDS.nurse,
    safeFields: ['area', 'kit', 'visits', 'credentialStatus'],
    owner: 'provider',
  },
  visit: {
    required: REQUIRED_FIELDS.visit,
    safeFields: ['service', 'nurse', 'eta', 'closeoutStatus', 'clinicalMode'],
    owner: 'operations',
  },
  kit: {
    required: REQUIRED_FIELDS.kit,
    safeFields: ['area'],
    owner: 'inventory',
  },
  inventoryItem: {
    required: REQUIRED_FIELDS.inventoryItem,
    safeFields: ['sku', 'qty', 'minLevel', 'detail'],
    owner: 'inventory',
  },
  inventoryTransaction: {
    required: REQUIRED_FIELDS.inventoryTransaction,
    safeFields: ['bookingId', 'reason', 'clinicalMode'],
    owner: 'inventory',
  },
  message: {
    required: REQUIRED_FIELDS.message,
    safeFields: ['body', 'priority'],
    owner: 'communications',
  },
  auditEvent: {
    required: REQUIRED_FIELDS.auditEvent,
    safeFields: ['entityId'],
    owner: 'compliance',
  },
  crossPortalEvent: {
    required: REQUIRED_FIELDS.crossPortalEvent,
    safeFields: ['visitId', 'clientVisible', 'nurseVisible', 'adminVisible', 'payload'],
    owner: 'sync',
  },
};

function nowIso() {
  return new Date().toISOString();
}

function text(value, fallback = '') {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  const match = text(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function slug(value, fallback = 'item') {
  const next = text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return next || fallback;
}

function stableId(prefix, value) {
  return `${prefix}-${slug(value || Date.now())}`;
}

function hashValue(value) {
  const raw = JSON.stringify(value ?? '');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(7, '0');
}

function makeEntity(type, id, data, source = 'local') {
  const label = data.label || data.client || data.name || data.item || data.type || id;
  return {
    id: text(id, stableId(type, label)),
    type,
    label: text(label, type),
    source,
    data,
    updatedAt: data.updatedAt || nowIso(),
  };
}

function validateEntity(entity) {
  const errors = [];
  if (!LOCAL_REPOSITORY_ENTITIES.includes(entity?.type)) errors.push('Unknown entity type');
  if (!entity?.id) errors.push('Missing id');
  const schema = LOCAL_ENTITY_SCHEMAS[entity?.type] || {};
  const required = schema.required || REQUIRED_FIELDS[entity?.type] || [];
  required.forEach((field) => {
    if (entity.data?.[field] === undefined || entity.data?.[field] === null || entity.data?.[field] === '') {
      errors.push(`Missing ${field}`);
    }
  });
  if (entity.type === 'inventoryTransaction' && number(entity.data?.quantity, 0) <= 0) {
    errors.push('Quantity must be positive');
  }
  return {
    ok: errors.length === 0,
    errors,
    entity,
    schemaVersion: LOCAL_SCHEMA_VERSION,
  };
}

export function readRepositoryLedger() {
  const events = readLocal('repo.eventLedger', []);
  return {
    version: LOCAL_EVENT_LEDGER_VERSION,
    events,
    eventCount: events.length,
    lastEventAt: events[0]?.at || null,
  };
}

export function makeRepositoryEvent({
  type = 'repository.event',
  entityType = '',
  entityId = '',
  actor = 'Avalon OS',
  payload = {},
} = {}) {
  const at = nowIso();
  const base = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: LOCAL_EVENT_LEDGER_VERSION,
    type,
    entityType,
    entityId,
    actor,
    payload,
    at,
  };
  return {
    ...base,
    checksum: hashValue(base),
  };
}

export function appendRepositoryEvent(event = {}) {
  const item = makeRepositoryEvent(event);
  const current = readLocal('repo.eventLedger', []);
  writeLocal('repo.eventLedger', [item, ...current].slice(0, 500));
  return item;
}

export function buildRepositoryLedgerSnapshot() {
  const ledger = readRepositoryLedger();
  const byType = ledger.events.reduce((rows, event) => {
    const type = event.type || 'repository.event';
    rows[type] = (rows[type] || 0) + 1;
    return rows;
  }, {});
  const invalid = ledger.events.filter((event) => event.checksum !== hashValue({
    id: event.id,
    version: event.version,
    type: event.type,
    entityType: event.entityType,
    entityId: event.entityId,
    actor: event.actor,
    payload: event.payload,
    at: event.at,
  }));

  return {
    version: LOCAL_EVENT_LEDGER_VERSION,
    events: ledger.events,
    eventCount: ledger.eventCount,
    lastEventAt: ledger.lastEventAt,
    byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
    integrity: invalid.length ? 'Check' : 'Sealed',
    invalidCount: invalid.length,
  };
}

function normalizeBooking(raw = {}, index = 0) {
  const id = text(raw.id || raw.reference || raw.bookingId, `booking-${index + 1}`);
  const client = text(raw.client || raw.name || raw.contact?.name || [raw.contact?.firstName, raw.contact?.lastName].filter(Boolean).join(' '), 'Client pending');
  return makeEntity('booking', id, {
    id,
    client,
    status: text(raw.status, 'New Request'),
    service: text(raw.service || raw.therapy || raw.protocol, 'Protocol pending'),
    city: text(raw.city || raw.market || raw.zip, 'Bay Area'),
    address: text(raw.address || raw.location, 'Address pending'),
    time: text(raw.time || [raw.date, raw.appointmentTime].filter(Boolean).join(' '), 'Time pending'),
    nurse: text(raw.nurse || raw.assignedNurse, 'Unassigned'),
    payment: text(raw.payment, 'Pending'),
    intake: text(raw.intake, 'Pending'),
    consent: text(raw.consent, 'Pending'),
    gfe: text(raw.gfe || raw.clearance, 'Pending'),
    total: number(raw.total || raw.subtotal || raw.price, 0),
  }, raw.source || 'booking-seed');
}

function normalizeClient(raw = {}, index = 0) {
  const name = text(raw.client || raw.name || raw.contact?.name || [raw.contact?.firstName, raw.contact?.lastName].filter(Boolean).join(' '), 'Client pending');
  const id = text(raw.clientId || raw.client_id || raw.id, stableId('client', name || index));
  return makeEntity('client', id, {
    id,
    name,
    phone: text(raw.phone || raw.contact?.phone),
    email: text(raw.email || raw.contact?.email),
    address: text(raw.address || raw.location),
    clinicalMode: 'placeholder-only',
  }, raw.source || 'client-seed');
}

function normalizeVisit(raw = {}, index = 0) {
  const id = text(raw.visitId || raw.id || raw.reference, `visit-${index + 1}`);
  const client = text(raw.client || raw.name || raw.contact?.name, 'Client pending');
  return makeEntity('visit', id, {
    id,
    client,
    status: text(raw.status, 'New Request'),
    service: text(raw.service || raw.therapy || raw.protocol, 'Protocol pending'),
    nurse: text(raw.nurse || raw.assignedNurse, 'Unassigned'),
    eta: text(raw.eta || raw.routeEta, 'Nurse sets final ETA'),
    closeoutStatus: text(raw.closeoutStatus, 'Open'),
    clinicalMode: 'placeholder-only',
  }, raw.source || 'visit-seed');
}

function normalizeNurse(raw = {}, index = 0) {
  const id = text(raw.id || raw.nurseId, `nurse-${index + 1}`);
  const name = text(raw.name, 'Nurse pending');
  return makeEntity('nurse', id, {
    id,
    name,
    status: text(raw.status, 'Unknown'),
    area: text(raw.area || raw.city, 'Unmapped'),
    kit: text(raw.kit, 'Not Set'),
    visits: number(raw.visits, 0),
    credentialStatus: text(raw.credentialStatus || raw.credStatus || raw.nurseys?.status, 'Placeholder'),
  }, raw.source || 'nurse-seed');
}

function normalizeKit(raw = {}, index = 0) {
  const nurse = text(raw.name || raw.nurse, `Nurse ${index + 1}`);
  return makeEntity('kit', stableId('kit', raw.id || nurse), {
    id: stableId('kit', raw.id || nurse),
    nurse,
    status: text(raw.kit || raw.status, 'Not Set'),
    area: text(raw.area, 'Unmapped'),
  }, raw.source || 'kit-seed');
}

function normalizeInventoryItem(raw = {}, index = 0) {
  const id = text(raw.id || raw.sku, `inventory-${index + 1}`);
  return makeEntity('inventoryItem', id, {
    id,
    name: text(raw.name, 'Unnamed item'),
    sku: text(raw.sku),
    status: text(raw.status, 'Unknown'),
    qty: number(raw.qty ?? raw.quantity ?? raw.detail, 0),
    minLevel: number(raw.minLevel, 0),
    detail: text(raw.detail),
  }, raw.source || 'inventory-seed');
}

function normalizeInventoryTransaction(raw = {}, index = 0) {
  const item = text(raw.item || raw.name, 'Inventory item');
  const id = text(raw.id, `transaction-${slug(item)}-${index + 1}`);
  return makeEntity('inventoryTransaction', id, {
    id,
    item,
    quantity: number(raw.quantity || raw.qty, 1),
    status: text(raw.status, 'planned'),
    bookingId: text(raw.bookingId || raw.visitId),
    reason: text(raw.reason || raw.service || raw.therapy),
    clinicalMode: 'placeholder-only',
  }, raw.source || 'inventory-transaction');
}

function normalizeMessage(raw = {}, index = 0) {
  const id = text(raw.id, `message-${index + 1}`);
  return makeEntity('message', id, {
    id,
    audience: text(raw.audience || raw.threadId || raw.channel, 'ops'),
    body: text(raw.body || raw.text || raw.subject, 'Message placeholder'),
    status: text(raw.status, 'Queued'),
    priority: text(raw.priority, 'normal'),
  }, raw.source || 'message-seed');
}

function normalizeAuditEvent(raw = {}, index = 0) {
  const id = text(raw.id, `audit-${index + 1}`);
  return makeEntity('auditEvent', id, {
    id,
    actor: text(raw.actor || raw.meta?.actor, 'Avalon OS'),
    action: text(raw.action || raw.text || raw.type, 'local.event'),
    at: text(raw.at || raw.updatedAt || raw.createdAt, nowIso()),
    entityId: text(raw.entityId || raw.bookingId || raw.visitId),
  }, raw.source || 'audit-seed');
}

function normalizeCrossPortalEvent(raw = {}, index = 0) {
  const id = text(raw.id, `sync-${index + 1}`);
  return makeEntity('crossPortalEvent', id, {
    id,
    type: text(raw.type, 'state.sync'),
    actor: text(raw.actor, 'Avalon OS'),
    at: text(raw.at || raw.updatedAt || raw.createdAt, nowIso()),
    visitId: text(raw.visitId || raw.bookingId),
    clientVisible: raw.clientVisible !== false,
    nurseVisible: raw.nurseVisible !== false,
    adminVisible: true,
    payload: raw.payload || {},
  }, raw.source || 'cross-portal');
}

function dedupeEntities(entities = []) {
  const byKey = new Map();
  entities.forEach((entity) => {
    byKey.set(`${entity.type}:${entity.id}`, entity);
  });
  return Array.from(byKey.values());
}

function collectSeedEntities({ requests = [], nurses = [], inventory = [], booking = null } = {}) {
  const requestList = [booking, ...requests].filter(Boolean);
  const messages = readLocal('opsMessages', []);
  const audit = [...readLocal('activity', []), ...readLocal('kernel.events', [])];
  const crossPortalEvents = readLocal('repo.crossPortalEvents', []);
  const kitLedger = readLocal('kitDeductionLedger', []);

  return [
    ...requestList.map(normalizeBooking),
    ...requestList.map(normalizeClient),
    ...requestList.map(normalizeVisit),
    ...nurses.map(normalizeNurse),
    ...nurses.map(normalizeKit),
    ...inventory.map(normalizeInventoryItem),
    ...kitLedger.map(normalizeInventoryTransaction),
    ...messages.map(normalizeMessage),
    ...audit.map(normalizeAuditEvent),
    ...crossPortalEvents.map(normalizeCrossPortalEvent),
  ];
}

export function readRepositoryState() {
  return readLocal('repo.state', {
    version: LOCAL_REPOSITORY_VERSION,
    entities: [],
    quarantine: [],
    updatedAt: null,
  });
}

export function buildLocalRepositorySnapshot(seed = {}) {
  const persisted = readRepositoryState();
  const seedEntities = collectSeedEntities(seed);
  const merged = dedupeEntities([...(persisted.entities || []), ...seedEntities]);
  const validations = merged.map(validateEntity);
  const entities = validations.filter((item) => item.ok).map((item) => item.entity);
  const quarantine = [
    ...(persisted.quarantine || []),
    ...validations
      .filter((item) => !item.ok)
      .map((item) => ({
        id: item.entity?.id || `quarantine-${Date.now()}`,
        type: item.entity?.type || 'unknown',
        label: item.entity?.label || 'Invalid entity',
        errors: item.errors,
        updatedAt: nowIso(),
      })),
  ].slice(0, 80);
  const byType = LOCAL_REPOSITORY_ENTITIES.map((type) => ({
    type,
    count: entities.filter((item) => item.type === type).length,
  }));
  const schemaRows = LOCAL_REPOSITORY_ENTITIES.map((type) => ({
    type,
    owner: LOCAL_ENTITY_SCHEMAS[type]?.owner || 'unknown',
    required: LOCAL_ENTITY_SCHEMAS[type]?.required || [],
    safeFields: LOCAL_ENTITY_SCHEMAS[type]?.safeFields || [],
  }));
  const ledger = buildRepositoryLedgerSnapshot();
  const completeness = Math.round((entities.length / Math.max(entities.length + quarantine.length, 1)) * 100);

  return {
    version: LOCAL_REPOSITORY_VERSION,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    entities,
    quarantine,
    byType,
    schemas: schemaRows,
    ledger,
    entityCount: entities.length,
    quarantineCount: quarantine.length,
    contractCount: LOCAL_REPOSITORY_ENTITIES.length,
    schemaCount: schemaRows.length,
    ledgerCount: ledger.eventCount,
    lastEventAt: ledger.lastEventAt,
    integrityScore: Math.max(0, completeness - ledger.invalidCount * 10),
    health: quarantine.length ? 'Action' : 'Clean',
    updatedAt: persisted.updatedAt || nowIso(),
  };
}

export function syncLocalRepository(seed = {}, actor = 'Avalon OS') {
  const snapshot = buildLocalRepositorySnapshot(seed);
  const next = {
    version: LOCAL_REPOSITORY_VERSION,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    entities: snapshot.entities,
    quarantine: snapshot.quarantine,
    updatedAt: nowIso(),
  };
  writeLocal('repo.state', next);
  const ledgerEvent = appendRepositoryEvent({
    type: 'repository.synced',
    entityType: 'repository',
    entityId: LOCAL_REPOSITORY_VERSION,
    payload: {
      entityCount: snapshot.entityCount,
      quarantineCount: snapshot.quarantineCount,
      schemaCount: snapshot.schemaCount,
    },
    actor,
  });
  queueCrossPortalEvent({
    type: 'repository.synced',
    payload: {
      entityCount: snapshot.entityCount,
      quarantineCount: snapshot.quarantineCount,
      schemaCount: snapshot.schemaCount,
      ledgerEventId: ledgerEvent.id,
    },
    actor,
    ledger: false,
  });
  return { ...next, ledgerEvent };
}

export function upsertRepositoryEntity(type, input = {}, actor = 'Avalon OS') {
  const normalizers = {
    booking: normalizeBooking,
    client: normalizeClient,
    nurse: normalizeNurse,
    visit: normalizeVisit,
    kit: normalizeKit,
    inventoryItem: normalizeInventoryItem,
    inventoryTransaction: normalizeInventoryTransaction,
    message: normalizeMessage,
    auditEvent: normalizeAuditEvent,
    crossPortalEvent: normalizeCrossPortalEvent,
  };
  const normalizer = normalizers[type];
  if (!normalizer) return { ok: false, errors: ['Unknown entity type'] };
  const validation = validateEntity(normalizer(input));
  const current = readRepositoryState();
  if (!validation.ok) {
    const quarantine = [{
      id: validation.entity.id,
      type,
      label: validation.entity.label,
      errors: validation.errors,
      updatedAt: nowIso(),
    }, ...(current.quarantine || [])].slice(0, 80);
    writeLocal('repo.state', { ...current, quarantine, updatedAt: nowIso() });
    appendRepositoryEvent({
      type: 'repository.quarantined',
      entityType: type,
      entityId: validation.entity.id,
      payload: { errors: validation.errors },
      actor,
    });
    return { ok: false, errors: validation.errors };
  }
  const entities = dedupeEntities([validation.entity, ...(current.entities || [])]);
  writeLocal('repo.state', { ...current, entities, updatedAt: nowIso() });
  appendRepositoryEvent({
    type: `${type}.upserted`,
    entityType: type,
    entityId: validation.entity.id,
    payload: { label: validation.entity.label },
    actor,
  });
  queueCrossPortalEvent({ type: `${type}.upserted`, payload: { id: validation.entity.id }, actor });
  return { ok: true, entity: validation.entity };
}

/**
 * @param {{ type?: string, payload?: Record<string, any>, actor?: string, visitId?: string, ledger?: boolean }} options
 */
export function queueCrossPortalEvent({ type = 'state.sync', payload = {}, actor = 'Avalon OS', visitId = '', ledger = true } = {}) {
  const item = {
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    actor,
    visitId: visitId || payload.visitId || payload.bookingId || '',
    payload,
    at: nowIso(),
    clientVisible: payload.clientVisible !== false,
    nurseVisible: payload.nurseVisible !== false,
    adminVisible: true,
  };
  const current = readLocal('repo.crossPortalEvents', []);
  writeLocal('repo.crossPortalEvents', [item, ...current].slice(0, 160));
  if (ledger) {
    appendRepositoryEvent({
      type,
      entityType: 'crossPortalEvent',
      entityId: item.id,
      payload: {
        visitId: item.visitId,
        ...payload,
      },
      actor,
    });
  }
  appendActivity(`Repo sync: ${type}`, { actor, visitId: item.visitId });
  return item;
}

export function buildRoleSafeRepositorySnapshot(role = 'admin', seed = {}) {
  const snapshot = buildLocalRepositorySnapshot(seed);
  const rules = ROLE_VISIBILITY_RULES[role] || ROLE_VISIBILITY_RULES.client;
  const visibleEntities = snapshot.entities.filter((entity) => rules.canSee.includes(entity.type));
  const redactedFields = visibleEntities.reduce((sum, entity) => (
    sum + rules.redact.filter((field) => Object.prototype.hasOwnProperty.call(entity.data || {}, field)).length
  ), 0);

  return {
    role,
    canSee: rules.canSee,
    redact: rules.redact,
    visibleEntities,
    visibleCount: visibleEntities.length,
    hiddenCount: snapshot.entityCount - visibleEntities.length,
    redactedFields,
    quarantineCount: snapshot.quarantineCount,
    status: snapshot.quarantineCount ? 'Guarded' : 'Clean',
  };
}

export function buildCrossPortalSyncSnapshot(seed = {}) {
  const snapshot = buildLocalRepositorySnapshot(seed);
  const events = snapshot.entities.filter((entity) => entity.type === 'crossPortalEvent');
  const ledgerEvents = snapshot.ledger.events || [];
  const bookings = snapshot.entities.filter((entity) => entity.type === 'booking');
  const visits = snapshot.entities.filter((entity) => entity.type === 'visit');
  const assignments = bookings.filter((entity) => entity.data.nurse && entity.data.nurse !== 'Unassigned').length;
  const etaReady = visits.filter((entity) => entity.data.eta && entity.data.eta !== 'Nurse sets final ETA').length;
  const channels = [
    { id: 'admin', label: 'Admin Command', status: 'Live', proof: `${snapshot.entityCount} entities visible` },
    { id: 'client', label: 'Client Portal', status: assignments || etaReady ? 'Synced' : 'Ready', proof: 'Booking, visit, ETA, message state' },
    { id: 'nurse', label: 'Nurse Portal', status: assignments ? 'Synced' : 'Ready', proof: 'Mission, kit, route, closeout state' },
    { id: 'inventory', label: 'Inventory', status: snapshot.entities.some((entity) => entity.type === 'inventoryTransaction') ? 'Synced' : 'Ready', proof: 'Projected and actual deductions' },
    { id: 'audit', label: 'Audit', status: events.length || ledgerEvents.length ? 'Recording' : 'Ready', proof: `${events.length + ledgerEvents.length} local sync events` },
  ];
  const score = Math.round((channels.filter((item) => item.status !== 'Ready').length / channels.length) * 100);
  const eventRows = [
    ...events.map((entity) => entity.data),
    ...ledgerEvents.map((event) => ({
      id: event.id,
      type: event.type,
      actor: event.actor,
      at: event.at,
      visitId: event.entityId,
    })),
  ];

  return {
    score,
    status: score >= 80 ? 'Strong' : score >= 40 ? 'Live' : 'Ready',
    events: eventRows.slice(0, 12),
    eventCount: eventRows.length,
    assignments,
    etaReady,
    channels,
  };
}

export function buildUnifiedOperationalTruth(seed = {}) {
  const repository = buildLocalRepositorySnapshot(seed);
  const sync = buildCrossPortalSyncSnapshot(seed);
  const roleViews = ['client', 'nurse', 'admin', 'finance', 'clinical'].map((role) => buildRoleSafeRepositorySnapshot(role, seed));

  return {
    version: LOCAL_REPOSITORY_VERSION,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    repository,
    sync,
    roleViews,
    ledger: repository.ledger,
    schemas: repository.schemas,
    score: Math.round((repository.integrityScore + sync.score) / 2),
    status: repository.quarantineCount ? 'Guarded' : sync.status,
  };
}
