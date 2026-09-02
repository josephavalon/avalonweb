const DB_NAME = 'avalon-inventory-offline-v1';
const STORE = 'actions';
const ALLOWED_TYPES = new Set(['count', 'restock']);
const FORBIDDEN_KEYS = /(supplier|vendor|price|cost|payment|patient|client|diagnos|treatment|clinical|note|email|phone)/i;
const CODE = /^[A-Z0-9_]{3,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const QUANTITY = /^\d+(?:\.\d{1,3})?$/;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function validScalar(key, value) {
  if (value === null) return true;
  if (/id$/i.test(key)) return UUID.test(String(value));
  if (/quantity$/i.test(key)) return QUANTITY.test(String(value));
  if (/version$/i.test(key)) return Number.isSafeInteger(Number(value)) && Number(value) > 0;
  if (/reason|result|action/i.test(key)) return CODE.test(String(value).toUpperCase());
  return typeof value === 'string' && value.length <= 180;
}

function validatePayload(value, key = 'payload') {
  if (Array.isArray(value)) return value.length <= 500 && value.every((entry) => validatePayload(entry, key));
  if (value && typeof value === 'object') return Object.entries(value).every(([childKey, child]) => !FORBIDDEN_KEYS.test(childKey) && validatePayload(child, childKey));
  return validScalar(key, value);
}

export async function queueInventoryAction({ sessionId, type, endpoint, payload, idempotencyKey }) {
  if (!ALLOWED_TYPES.has(type) || !UUID.test(String(sessionId)) || !/^\/api\/me\/kit\/(counts|restock-requests)$/.test(endpoint)
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$/.test(idempotencyKey) || !validatePayload(payload)) {
    throw new Error('This inventory action is not eligible for offline storage.');
  }
  const record = { id: idempotencyKey, sessionId, type, endpoint, payload, idempotencyKey, state: 'queued', createdAt: new Date().toISOString(), version: 1 };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record;
}

export async function listInventoryActions(sessionId) {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.filter((row) => row.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function replayInventoryActions({ sessionId, send }) {
  const rows = await listInventoryActions(sessionId);
  const outcomes = [];
  for (const row of rows.filter((entry) => entry.state === 'queued')) {
    try {
      await send(row);
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(row.id);
        request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      });
      db.close();
      outcomes.push({ id: row.id, status: 'replayed' });
    } catch (error) {
      if (error?.status === 409 || /conflict|version/i.test(String(error?.message || ''))) {
        const db = await openDb();
        row.state = 'conflict'; row.conflictAt = new Date().toISOString();
        await new Promise((resolve, reject) => {
          const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(row);
          request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
        });
        db.close();
        outcomes.push({ id: row.id, status: 'conflict' });
        continue;
      }
      outcomes.push({ id: row.id, status: 'retry_later' });
      break;
    }
  }
  return outcomes;
}
