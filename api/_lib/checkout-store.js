import { safeLogContext } from './safe-error.js';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);
const DEFAULT_TTL_SECONDS = 60 * 60 * 48;

async function kvPipeline(commands) {
  if (!KV_ENABLED) {
    throw Object.assign(new Error('Checkout KV store is not configured.'), { code: 'checkout_store_unavailable' });
  }
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Checkout KV store request failed with ${res.status}.`), {
      code: 'checkout_store_request_failed',
      status: res.status,
    });
  }
  return res.json();
}

export function checkoutStoreAvailable() {
  return KV_ENABLED;
}

export async function writeCheckoutStoreRecord(key, payload, ttlSeconds = DEFAULT_TTL_SECONDS) {
  try {
    await kvPipeline([
      ['SET', key, JSON.stringify(payload), 'EX', Math.max(60, Math.floor(ttlSeconds))],
    ]);
    return true;
  } catch (err) {
    console.warn('[checkout-store] write failed', safeLogContext(err, 'checkout_store_write_failed'));
    return false;
  }
}

export async function readCheckoutStoreRecord(key) {
  if (!key) return null;
  try {
    const data = await kvPipeline([['GET', key]]);
    const raw = data?.[0]?.result;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.warn('[checkout-store] read failed', safeLogContext(err, 'checkout_store_read_failed'));
    return null;
  }
}
