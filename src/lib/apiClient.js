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
  supabase.auth.getSession()
    .then(({ data }) => { cachedToken = data?.session?.access_token || null; })
    .catch(() => {});
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token || null;
  });
}

export async function authedFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (hasSupabase) {
    let token = cachedToken;
    if (!token) {
      // No cached token yet (first call before the seed resolves). Fetch once,
      // but never let a stalled auth lock hang the request forever.
      try {
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('getSession_timeout')), 4000)),
        ]);
        token = data?.session?.access_token || null;
        if (token) cachedToken = token;
      } catch { /* proceed unauthenticated — request will 401 and the UI shows an error */ }
    }
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
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
