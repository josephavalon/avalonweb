// Auth store — real Supabase Auth in production, demo roster as a local fallback.
// When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set (`hasSupabase`), this
// uses Supabase Auth (email magic-link now; phone/passkey layered on next).
// Without them it keeps the original demo behavior, so local/dev is unchanged.
// The user shape + hook API stay stable, so RequireAuth and every route keep working.

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { appendActivity } from './localOs';
import { seedDemoState } from './platformOps';
import { isDemoAuthAllowed, PRE_API_SECURITY_MODE } from './preApiSecurity';
import { supabase, hasSupabase } from './supabase';

const AuthStoreContext = createContext(null);
const SESSION_KEY = 'av.session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// ── Demo accounts (local fallback only — used when Supabase is not configured) ──
const DEMO_USERS = {
  'ADMIN':        { role: 'admin',     name: 'Admin',             redirect: '/admin',             status: 'active', canonical: 'ADMIN001' },
  'ADMIN001':     { role: 'admin',     name: 'Admin',             redirect: '/admin',             status: 'active', canonical: 'ADMIN001' },
  'ADMIN0001':    { role: 'admin',     name: 'Admin',             redirect: '/admin',             status: 'active', canonical: 'ADMIN001' },
  'CLIENT':       { role: 'client',    name: 'Sarah',             redirect: '/members/dashboard', status: 'active', canonical: 'CLIENT001' },
  'CLIENT001':    { role: 'client',    name: 'Sarah',             redirect: '/members/dashboard', status: 'active', canonical: 'CLIENT001' },
  'CLIENT0001':   { role: 'client',    name: 'Sarah',             redirect: '/members/dashboard', status: 'active', canonical: 'CLIENT001' },
  'NURSE':        { role: 'provider',  name: 'Stephanie R.',      redirect: '/provider/shift',    status: 'active', canonical: 'NURSE001' },
  'NURSE001':     { role: 'provider',  name: 'Stephanie R.',      redirect: '/provider/shift',    status: 'active', canonical: 'NURSE001' },
  'NURSE0001':    { role: 'provider',  name: 'Stephanie R.',      redirect: '/provider/shift',    status: 'active', canonical: 'NURSE001' },
  'NP':           { role: 'np',        name: 'Mobile GFE NP',     redirect: '/provider/role-os',  status: 'active', canonical: 'NP001' },
  'NP001':        { role: 'np',        name: 'Mobile GFE NP',     redirect: '/provider/role-os',  status: 'active', canonical: 'NP001' },
  'NP0001':       { role: 'np',        name: 'Mobile GFE NP',     redirect: '/provider/role-os',  status: 'active', canonical: 'NP001' },
  'MD':           { role: 'physician', name: 'Medical Director',  redirect: '/provider/role-os',  status: 'active', canonical: 'MD001' },
  'MD001':        { role: 'physician', name: 'Medical Director',  redirect: '/provider/role-os',  status: 'active', canonical: 'MD001' },
  'MD0001':       { role: 'physician', name: 'Medical Director',  redirect: '/provider/role-os',  status: 'active', canonical: 'MD001' },
  'PHYSICIAN':    { role: 'physician', name: 'Medical Director',  redirect: '/provider/role-os',  status: 'active', canonical: 'PHYSICIAN001' },
  'PHYSICIAN001': { role: 'physician', name: 'Medical Director',  redirect: '/provider/role-os',  status: 'active', canonical: 'PHYSICIAN001' },
  'PHYSICIAN0001': { role: 'physician', name: 'Medical Director', redirect: '/provider/role-os',  status: 'active', canonical: 'PHYSICIAN001' },
};
// Beta/demo passcode. Primarily from VITE_AVALON_DEMO_PASSWORD; falls back to the
// known beta passcode so the simulation logins (CLIENT001 / ADMIN001) work on
// snooches + localhost without extra build config. isDemoAuthAllowed() still
// gates this to beta/local hosts only, so it is inert on the production domain.
const DEMO_PASSWORD = import.meta.env.VITE_AVALON_DEMO_PASSWORD || 'JonJones1986';
// ─────────────────────────────────────────────────────────────────────────

const ROLE_REDIRECT = {
  admin: '/admin',
  client: '/members/dashboard',
  provider: '/provider/role-os',
  np: '/provider/role-os',
  physician: '/provider/role-os',
};
function redirectForRole(role) {
  return ROLE_REDIRECT[role] || '/members/dashboard';
}

function normalizeLoginIdentifier(value = '') {
  return String(value).trim().replace(/\s+/g, '').toUpperCase();
}

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    if (!session) return null;
    if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
      sessionStorage.removeItem(SESSION_KEY);
      appendActivity('Session expired', { role: session.role, username: session.username });
      return null;
    }
    return session;
  } catch { return null; }
}

function writeSession(user) {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* private mode — non-fatal */ }
}

function createSessionId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const values = cryptoApi.getRandomValues(new Uint32Array(2));
    const token = Array.from(values, (value) => value.toString(36)).join('');
    return `session-${Date.now()}-${token}`;
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Build the app's user object from a Supabase session user. Role comes from
// public.profiles.role (default 'client'); admins are set there directly.
async function buildSupabaseUser(authUser) {
  if (!authUser) return null;
  let role = 'client';
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle();
    if (data?.role) role = data.role;
  } catch { /* RLS/no row → default to client */ }
  const meta = authUser.user_metadata || {};
  const name = meta.name || meta.full_name || authUser.email || authUser.phone || 'Member';
  return {
    id: authUser.id,
    email: authUser.email || '',
    phone: authUser.phone || '',
    name,
    role,
    redirect: redirectForRole(role),
    authMode: 'supabase',
    lastActiveAt: new Date().toISOString(),
  };
}

export function AuthStoreProvider({ children }) {
  const [user, setUser]       = useState(() => (hasSupabase ? null : readSession()));
  const [loading, setLoading] = useState(hasSupabase);
  const [error, setError]     = useState(null);

  // Resolve + track the Supabase session (no-op in demo mode).
  useEffect(() => {
    if (!hasSupabase) return undefined;
    let active = true;
    supabase.auth.getSession()
      .then(async ({ data }) => {
        const u = await buildSupabaseUser(data?.session?.user || null);
        if (active) { setUser(u); setLoading(false); }
      })
      .catch(() => { if (active) setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = await buildSupabaseUser(session?.user || null);
      if (active) setUser(u);
    });
    return () => { active = false; listener?.subscription?.unsubscribe?.(); };
  }, []);

  // Email magic-link (Supabase). Returns { ok, pending }; the user clicks the
  // emailed link, lands back on /login, and onAuthStateChange sets the session.
  const signInWithEmail = useCallback(async (email) => {
    if (!hasSupabase) return { ok: false, error: 'Sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: String(email || '').trim(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (err) throw err;
      return { ok: true, pending: true, message: 'Check your email for a secure sign-in link.' };
    } catch (err) {
      const msg = err.message || 'Could not send the sign-in link.';
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  // New-account signup. Supabase sends a confirmation email; once the user
  // clicks the link, onAuthStateChange fires and the public.profiles row is
  // populated by migration 007's handle_new_user trigger.
  const signUpWithEmail = useCallback(async ({ email, fullName, phone } = {}) => {
    if (!hasSupabase) return { ok: false, error: 'Sign-up is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const cleanEmail = String(email || '').trim();
      const cleanPhone = String(phone || '').trim();
      const cleanName  = String(fullName || '').trim();
      const { error: err } = await supabase.auth.signUp({
        email: cleanEmail,
        password: createSessionId(),
        phone: cleanPhone || undefined,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: cleanName ? { full_name: cleanName } : undefined,
        },
      });
      if (err) throw err;
      return { ok: true, pending: true, message: 'Check your email to confirm and finish signing in.' };
    } catch (err) {
      const msg = err.message || 'Could not create your account.';
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  // Phone OTP (Supabase). signInWithPhone texts a code (delivered via the Quo
  // Send-SMS auth hook); verifyPhoneOtp checks it and onAuthStateChange sets
  // the session.
  const signInWithPhone = useCallback(async (phone) => {
    if (!hasSupabase) return { ok: false, error: 'Phone sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ phone: String(phone || '').trim() });
      if (err) throw err;
      return { ok: true, pending: true, message: 'We texted you a 6-digit code.' };
    } catch (err) {
      const msg = err.message || 'Could not send the code.';
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  const verifyPhoneOtp = useCallback(async (phone, token) => {
    if (!hasSupabase) return { ok: false, error: 'Phone sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        phone: String(phone || '').trim(),
        token: String(token || '').trim(),
        type: 'sms',
      });
      if (err) throw err;
      return { ok: true }; // onAuthStateChange sets the user
    } catch (err) {
      const msg = err.message || 'That code was not valid.';
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  // Passkey / WebAuthn (Supabase native). signInWithPasskey is a passwordless
  // returning-user sign-in; registerPasskey enrolls one for the current session.
  const signInWithPasskey = useCallback(async () => {
    if (!hasSupabase) return { ok: false, error: 'Passkey sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPasskey();
      if (err) throw err;
      return { ok: true }; // onAuthStateChange sets the user
    } catch (err) {
      const msg = err.message || 'Passkey sign-in failed.';
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  const registerPasskey = useCallback(async () => {
    if (!hasSupabase) return { ok: false, error: 'Passkeys are not configured yet.' };
    setError(null);
    try {
      const { error: err } = await supabase.auth.registerPasskey();
      if (err) throw err;
      return { ok: true, message: 'Passkey added — use it to sign in next time.' };
    } catch (err) {
      return { ok: false, error: err.message || 'Could not add a passkey.' };
    }
  }, []);

  // Social sign-in (Google / Apple) via Supabase OAuth. Redirects to the
  // provider and back to /login, where onAuthStateChange sets the session.
  // Enable the provider in Supabase → Auth → Providers for it to work.
  const signInWithOAuth = useCallback(async (provider) => {
    if (!hasSupabase) return { ok: false, error: 'Social sign-in is not configured yet.' };
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (err) throw err;
      return { ok: true, pending: true };
    } catch (err) {
      const msg = err.message || `Could not sign in with ${provider}.`;
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // Back-compat entry point: Supabase mode routes an email to a magic link
  // (passwordless); demo mode runs the original roster check.
  const signIn = useCallback(async ({ email, password } = {}) => {
    // Demo-roster accounts (CLIENT001 / ADMIN001 …) stay usable on beta/local even
    // when Supabase is configured — a simulation backdoor gated by isDemoAuthAllowed().
    // Anything that isn't a known roster ID falls through to Supabase magic-link.
    const identifier = normalizeLoginIdentifier(email);
    const isDemoAccount = isDemoAuthAllowed()
      && Object.keys(DEMO_USERS).some((k) => normalizeLoginIdentifier(k) === identifier);
    if (hasSupabase && !isDemoAccount) return signInWithEmail(email);

    setLoading(true); setError(null);
    try {
      await new Promise((r) => setTimeout(r, 600));
      if (!isDemoAuthAllowed()) throw new Error('Local demo auth is disabled outside Avalon simulation mode.');
      if (!DEMO_PASSWORD) throw new Error('Demo auth password is not configured. Set VITE_AVALON_DEMO_PASSWORD for local simulation.');
      const submittedUsername = normalizeLoginIdentifier(email);
      const usernameKey = Object.keys(DEMO_USERS).find((k) => normalizeLoginIdentifier(k) === submittedUsername);
      if (!usernameKey || String(password || '').trim() !== DEMO_PASSWORD) throw new Error('Invalid username or password.');
      const profile = DEMO_USERS[usernameKey];
      if (profile.status === 'suspended') throw new Error('Account suspended. Contact support at hello@avalonvitality.co');
      if (profile.status === 'archived') throw new Error('This account is no longer active.');
      const sessionUser = {
        id: createSessionId(),
        username: usernameKey,
        canonicalUsername: profile.canonical || usernameKey,
        name: profile.name,
        role: profile.role,
        redirect: profile.redirect,
        seededAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        authMode: PRE_API_SECURITY_MODE.mode,
        mfa: 'placeholder',
        securityWall: 'pre-api-hard-wall',
      };
      seedDemoState(profile.canonical || usernameKey);
      setUser(sessionUser);
      writeSession(sessionUser);
      appendActivity('Signed in', { role: sessionUser.role, username: usernameKey, authMode: sessionUser.authMode });
      return { ok: true, user: sessionUser };
    } catch (err) {
      const msg = err.message || 'Sign in failed.';
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, [signInWithEmail]);

  // "Forgot password" under a passwordless model is just sending a fresh
  // magic-link to the email on file — same flow as sign-in.
  const requestPasswordReset = useCallback(async (email) => {
    return signInWithEmail(email);
  }, [signInWithEmail]);

  const signOut = useCallback(async () => {
    if (user) appendActivity('Signed out', { role: user.role, username: user.username });
    if (hasSupabase) { try { await supabase.auth.signOut(); } catch { /* ignore */ } }
    setUser(null);
    if (!hasSupabase) writeSession(null);
  }, [user]);

  return React.createElement(
    AuthStoreContext.Provider,
    {
      value: {
        user, loading, error,
        signIn, signInWithEmail, signUpWithEmail, signInWithPhone, verifyPhoneOtp,
        signInWithPasskey, registerPasskey, signInWithOAuth,
        signOut, requestPasswordReset,
        authBackend: hasSupabase ? 'supabase' : 'demo',
      },
    },
    children
  );
}

export function useAuthStore() {
  const ctx = useContext(AuthStoreContext);
  if (!ctx) throw new Error('useAuthStore must be inside AuthStoreProvider');
  return ctx;
}
