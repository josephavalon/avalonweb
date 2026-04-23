/**
 * Shared rate limiter for /api routes.
 *
 * Two backends, one interface:
 *   - Vercel KV / Upstash (persistent, per-region) when KV_REST_API_URL and
 *     KV_REST_API_TOKEN env vars are present.
 *   - In-memory Map (per cold-start) as graceful fallback.
 *
 * To upgrade from in-memory to KV at runtime, set the following Vercel env vars:
 *   KV_REST_API_URL     — the REST endpoint from your KV integration
 *   KV_REST_API_TOKEN   — read+write token
 * Zero code changes required. The module detects them at module load.
 *
 * Why no @vercel/kv import? Keeping it dependency-free until KV is actually
 * provisioned — the REST API is three fetch calls. When volume justifies, swap
 * to @vercel/kv for better typing and connection pooling.
 */

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);

// ---------------------------------------------------------------------------
// In-memory fallback — per Vercel instance, resets on cold start.
// ---------------------------------------------------------------------------
const memoryHits = new Map();

function memoryCheck(key, windowMs, max) {
  const now = Date.now();
  const bucket = memoryHits.get(key) || { count: 0, reset: now + windowMs };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + windowMs;
  }
  bucket.count += 1;
  memoryHits.set(key, bucket);
  if (memoryHits.size > 5000) {
    for (const [k, v] of memoryHits) if (now > v.reset) memoryHits.delete(k);
  }
  return { ok: bucket.count <= max, remaining: Math.max(0, max - bucket.count), reset: bucket.reset };
}

// ---------------------------------------------------------------------------
// KV-backed limiter — uses INCR + EXPIRE for atomic counting.
// Upstash/Vercel KV REST: POST to /pipeline with an array of commands.
// ---------------------------------------------------------------------------
async function kvCheck(key, windowMs, max) {
  const windowSec = Math.ceil(windowMs / 1000);
  try {
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSec, 'NX'],
        ['PTTL', key],
      ]),
    });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    const data = await res.json();
    const count = Number(data?.[0]?.result ?? 0);
    const pttl = Number(data?.[2]?.result ?? windowMs);
    return {
      ok: count <= max,
      remaining: Math.max(0, max - count),
      reset: Date.now() + (pttl > 0 ? pttl : windowMs),
    };
  } catch (err) {
    // Fail-open to memory — do not block legitimate traffic on KV outage.
    // Vercel's runtime logs pick this up via console.warn.
    console.warn('[rate-limit] KV check failed, falling back to memory:', err?.message);
    return memoryCheck(key, windowMs, max);
  }
}

/**
 * @param {Object}   opts
 * @param {string}   opts.key        Bucket key — usually `${route}:${ip}`.
 * @param {number}   opts.windowMs   Rolling window length, milliseconds.
 * @param {number}   opts.max        Max requests allowed in the window.
 * @returns {Promise<{ok: boolean, remaining: number, reset: number}>}
 */
export async function checkRateLimit({ key, windowMs, max }) {
  if (KV_ENABLED) return kvCheck(key, windowMs, max);
  return memoryCheck(key, windowMs, max);
}

/**
 * Resolve the client IP from a Vercel request, with x-forwarded-for precedence.
 * Used by all API routes to scope rate-limit buckets.
 */
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd)) return fwd[0];
  return req.socket?.remoteAddress || 'unknown';
}

export const RATE_LIMIT_BACKEND = KV_ENABLED ? 'kv' : 'memory';
