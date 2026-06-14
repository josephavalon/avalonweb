// Authenticated fetch for the Supabase-session API layer (/api/me, /api/admin).
// Attaches the signed-in user's access token as a Bearer header so the server
// can verify identity + role. No-ops the header in demo mode (no Supabase).

import { supabase, hasSupabase } from './supabase';

export async function authedFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (hasSupabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* no session — request will 401 */ }
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
