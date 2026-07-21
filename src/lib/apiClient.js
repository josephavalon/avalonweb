// Authenticated fetch for the Supabase-session API layer (/api/me, /api/admin).
// Attaches the signed-in user's access token as a Bearer header so the server
// can verify identity + role. No-ops the header in demo mode (no Supabase).

import { supabase, hasSupabase } from './supabase';

// Cache the access token and keep it fresh via onAuthStateChange. Calling
// supabase.auth.getSession() on EVERY request contends on the navigator.locks
// auth lock; when the admin dashboard fires several requests at once they
// serialize on that lock and the data loads stall/spin. Reading a cached token
// is lock-free, so requests stop blocking each other.
let cachedToken = null;
if (hasSupabase) {
  // onAuthStateChange fires INITIAL_SESSION on registration (seeding the token)
  // and keeps it fresh on refresh/sign-in/out. Synchronous, makes no supabase
  // calls, so it never holds/needs the auth lock — safe inline and lock-free.
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token || null;
  });
}

function timeout(ms, label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms));
}

// Decode a JWT's `exp` (no verification) so we never send a token we already
// know is expired. Returns true if expired/expiring; false if it can't tell
// (the 401-retry below is the real safety net).
function isExpired(token) {
  try {
    const part = (token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
    if (!payload?.exp) return false;
    return Date.now() / 1000 >= payload.exp - 10; // 10s skew
  } catch {
    return false;
  }
}

async function readSessionToken() {
  try {
    const { data } = await Promise.race([supabase.auth.getSession(), timeout(4000, 'getSession_timeout')]);
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

// Force a token refresh from the (longer-lived) refresh token. Used when the
// access token is expired or the server rejected it. Returns null if the
// refresh token itself is gone — the caller then surfaces a real 401.
async function forceRefreshToken() {
  try {
    const { data } = await Promise.race([supabase.auth.refreshSession(), timeout(6000, 'refresh_timeout')]);
    const token = data?.session?.access_token || null;
    if (token) cachedToken = token;
    return token;
  } catch {
    return null;
  }
}

export async function authedFetch(path, options = {}, _retried = false) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (hasSupabase) {
    let token = cachedToken;
    if (token && isExpired(token)) { cachedToken = null; token = null; } // don't send a dead token
    if (!token) {
      token = await readSessionToken();       // getSession refreshes an expired session
      if (!token) token = await forceRefreshToken();
      if (token) cachedToken = token;
    }
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  // Self-heal: a 401 means the token was stale despite the checks above (clock
  // skew, just-expired, revoked, or onAuthStateChange never seeded it). Force a
  // refresh and retry the request once before surfacing an error to the user.
  if (res.status === 401 && hasSupabase && !_retried) {
    cachedToken = null;
    const fresh = await forceRefreshToken();
    if (fresh) return authedFetch(path, options, true);
  }

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { error: text }; }

  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const apiGet = (path) => authedFetch(path, { method: 'GET' });
export const apiPost = (path, payload) => authedFetch(path, { method: 'POST', body: JSON.stringify(payload || {}) });
export const apiPatch = (path, payload) => authedFetch(path, { method: 'PATCH', body: JSON.stringify(payload || {}) });
