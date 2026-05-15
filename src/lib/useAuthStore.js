// Lightweight auth store — no external dependency.
// Swap signIn/signOut for Firebase, Supabase, or a JWT endpoint.
// The user shape and hook API stay the same — nothing else needs to change.

import React, { useState, createContext, useContext } from 'react';

const AuthStoreContext = createContext(null);
const SESSION_KEY = 'av.session';

// ── Demo accounts (replace with real auth before production) ──────────────
const DEMO_USERS = {
  'ADMIN001':  { role: 'admin',    name: 'Admin',  redirect: '/admin',              status: 'active' },
  'CLIENT001': { role: 'client',   name: 'Client', redirect: '/members/dashboard',  status: 'active' },
  'NURSE001':  { role: 'provider', name: 'Nurse',  redirect: '/provider/dashboard', status: 'active' },
};
const DEMO_PASSWORD = 'JonJones1986';
// ─────────────────────────────────────────────────────────────────────────

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeSession(user) {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* private mode — non-fatal */ }
}

export function AuthStoreProvider({ children }) {
  const [user, setUser]       = useState(() => readSession());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const signIn = async ({ email, password }) => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 600)); // simulate network

      // Match against demo roster (case-insensitive username)
      const usernameKey = Object.keys(DEMO_USERS).find(
        (k) => k.toLowerCase() === email.trim().toLowerCase()
      );

      if (!usernameKey || password !== DEMO_PASSWORD) {
        throw new Error('Invalid username or password.');
      }

      const profile = DEMO_USERS[usernameKey];
      if (profile.status === 'suspended') throw new Error('Account suspended. Contact support at hello@avalonvitality.co');
      if (profile.status === 'archived') throw new Error('This account is no longer active.');
      const sessionUser = {
        id:       crypto.randomUUID(),
        username: usernameKey,
        name:     profile.name,
        role:     profile.role,
        redirect: profile.redirect,
      };

      setUser(sessionUser);
      writeSession(sessionUser);
      return { ok: true, user: sessionUser };
    } catch (err) {
      const msg = err.message || 'Sign in failed.';
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    writeSession(null);
  };

  return React.createElement(
    AuthStoreContext.Provider,
    { value: { user, loading, error, signIn, signOut, requestPasswordReset } },
    children
  );
}

export function useAuthStore() {
  const ctx = useContext(AuthStoreContext);
  if (!ctx) throw new Error('useAuthStore must be inside AuthStoreProvider');
  return ctx;
}
