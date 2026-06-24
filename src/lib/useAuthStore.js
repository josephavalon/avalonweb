// Auth store — real Supabase Auth in production, demo roster as a local fallback.
// When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set (`hasSupabase`), this
// uses Supabase Auth (password, passwordless email, OAuth, phone, and passkey).
// Without them it keeps the original demo behavior, so local/dev is unchanged.
// The user shape + hook API stay stable, so RequireAuth and every route keep working.

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { appendActivity, clearAllAvLocal } from './localOs';
import { seedDemoState } from './platformOps';
import { isDemoAuthAllowed, PRE_API_SECURITY_MODE } from './preApiSecurity';
import { supabase, hasSupabase } from './supabase';
import { authProviderConfig } from './authProviderConfig';

const AuthStoreContext = createContext(null);
const SESSION_KEY = 'av.session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
// HIPAA §164.312(a)(2)(iii): automatic logoff after inactivity. 15 min is the
// industry default for clinical workstations. Tracked in sessionStorage so a
// page reload doesn't reset the clock.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_KEY = 'av.lastActivity';
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;
const IDLE_ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

function noteActivity() {
  try { sessionStorage.setItem(IDLE_KEY, String(Date.now())); } catch { /* private mode */ }
}

function readLastActivity() {
  try {
    const raw = sessionStorage.getItem(IDLE_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

function clearLastActivity() {
  try { sessionStorage.removeItem(IDLE_KEY); } catch { /* ignore */ }
}

// ── Demo accounts (local fallback only — used when Supabase is not configured) ──
const DEMO_USERS = {
  'ADMIN':        { role: 'admin',     name: 'Admin',             redirect: '/admin',             status: 'active', canonical: 'ADMIN001' },
  'ADMIN001':     { role: 'admin',     name: 'Admin',             redirect: '/admin',             status: 'active', canonical: 'ADMIN001' },
  'ADMIN0001':    { role: 'admin',     name: 'Admin',             redirect: '/admin',             status: 'active', canonical: 'ADMIN001' },
  'STAFF':        { role: 'staff',     name: 'Jordan (Staff)',    redirect: '/admin',             status: 'active', canonical: 'STAFF001' },
  'STAFF001':     { role: 'staff',     name: 'Jordan (Staff)',    redirect: '/admin',             status: 'active', canonical: 'STAFF001' },
  'CLIENT':       { role: 'client',    name: 'Sarah',             redirect: '/members/dashboard', status: 'active', canonical: 'CLIENT001' },
  'CLIENT001':    { role: 'client',    name: 'Sarah',             redirect: '/members/dashboard', status: 'active', canonical: 'CLIENT001' },
  'CLIENT0001':   { role: 'client',    name: 'Sarah',             redirect: '/members/dashboard', status: 'active', canonical: 'CLIENT001' },
  'NURSE':        { role: 'nurse',     name: 'Stephanie R.',      redirect: '/provider/shift',    status: 'active', canonical: 'NURSE001' },
  'NURSE001':     { role: 'nurse',     name: 'Stephanie R.',      redirect: '/provider/shift',    status: 'active', canonical: 'NURSE001' },
  'NURSE0001':    { role: 'nurse',     name: 'Stephanie R.',      redirect: '/provider/shift',    status: 'active', canonical: 'NURSE001' },
};
// Beta/demo passcode. It must be supplied per environment and is still gated to
// beta/local hosts by isDemoAuthAllowed().
const DEMO_PASSWORD = import.meta.env.VITE_AVALON_DEMO_PASSWORD || '';
// ─────────────────────────────────────────────────────────────────────────

const ROLE_REDIRECT = {
  admin: '/admin',
  staff: '/admin',
  client: '/members/dashboard',
  nurse: '/provider/shift',
};
function redirectForRole(role) {
  return ROLE_REDIRECT[role] || '/members/dashboard';
}

function normalizeLoginIdentifier(value = '') {
  return String(value).trim().replace(/\s+/g, '').toUpperCase();
}

function customerSafeAuthError(fallback) {
  return fallback;
}

function demoAuthErrorMessage(err) {
  const message = String(err?.message || '');
  if (
    message === 'Invalid username or password.'
    || message === 'Local demo auth is disabled outside Avalon simulation mode.'
    || message === 'Demo auth password is not configured. Set VITE_AVALON_DEMO_PASSWORD for local simulation.'
    || message === 'Account suspended. Contact support at hello@avalonvitality.co'
    || message === 'This account is no longer active.'
  ) {
    return message;
  }
  return 'Sign in failed.';
}

function demoMfaState() {
  return {
    status: 'not_required_demo_local',
    required: false,
    verified: true,
    method: 'demo_password',
    reason: 'Demo auth is host-gated and disabled in production live API mode.',
  };
}

function supabaseMfaState(authUser = {}) {
  const aal = String(authUser?.aal || authUser?.app_metadata?.aal || '').toLowerCase();
  const amr = Array.isArray(authUser?.amr) ? authUser.amr : [];
  const methodNames = amr.map((entry) => String(entry?.method || entry || '').toLowerCase());
  const verified = aal === 'aal2' || methodNames.some((method) => ['mfa', 'totp', 'webauthn', 'phone'].includes(method));
  return {
    status: verified ? 'verified' : 'not_enforced',
    required: false,
    verified,
    method: verified ? 'supabase_session_factor' : 'passwordless_or_sso',
    reason: verified
      ? 'Supabase session reports a second authentication factor.'
      : 'Supabase MFA enforcement is a production configuration decision tracked as a go-live user action.',
  };
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
  let mustChangePassword = false;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role, must_change_password')
      .eq('id', authUser.id)
      .maybeSingle();
    if (data?.role) role = data.role;
    if (data?.must_change_password) mustChangePassword = true;
  } catch { /* RLS/no row → default to client */ }
  const meta = authUser.user_metadata || {};
  const name = meta.name || meta.full_name || authUser.email || authUser.phone || 'Member';
  return {
    id: authUser.id,
    email: authUser.email || '',
    phone: authUser.phone || '',
    name,
    role,
    mustChangePassword,
    redirect: redirectForRole(role),
    authMode: 'supabase',
    mfa: supabaseMfaState(authUser),
    lastActiveAt: new Date().toISOString(),
  };
}

export function AuthStoreProvider({ children }) {
  const [user, setUser]       = useState(() => (hasSupabase ? null : readSession()));
  const [loading, setLoading] = useState(hasSupabase);
  const [error, setError]     = useState(null);

  const refreshSupabaseSession = useCallback(async () => {
    if (!hasSupabase) return null;
    setLoading(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const u = await buildSupabaseUser(data?.session?.user || null);
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve + track the Supabase session (no-op in demo mode).
  useEffect(() => {
    if (!hasSupabase) return undefined;
    let active = true;
    // Safety net: if getSession ever stalls (e.g. navigator.locks contention),
    // never leave the whole authed app stuck behind RequireAuth's loading gate.
    // Force loading off after a few seconds so it can resolve (to /login if no
    // session landed). Cleared as soon as the real resolution arrives.
    const loadingSafety = setTimeout(() => { if (active) setLoading(false); }, 8000);
    refreshSupabaseSession().finally(() => { if (active) { clearTimeout(loadingSafety); setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer the profile lookup OUT of this callback. buildSupabaseUser runs a
      // supabase.from('profiles') query, and PostgREST calls getSession() to
      // attach its auth header — which needs the navigator.locks auth lock that
      // this callback is currently HOLDING. Awaiting it inline deadlocks (the
      // login button spins forever after sign-in). setTimeout(0) lets the lock
      // release first. supabase-js documents this exact pitfall.
      setTimeout(async () => {
        const u = await buildSupabaseUser(session?.user || null);
        if (active) { setUser(u); setLoading(false); clearTimeout(loadingSafety); }
      }, 0);
    });
    return () => { active = false; clearTimeout(loadingSafety); listener?.subscription?.unsubscribe?.(); };
  }, [refreshSupabaseSession]);

  // Email magic-link (Supabase). Returns { ok, pending }; the user clicks the
  // emailed link, lands back on /login, and onAuthStateChange sets the session.
  const signInWithEmail = useCallback(async (email) => {
    if (!hasSupabase) return { ok: false, error: 'Sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: String(email || '').trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) throw err;
      return { ok: true, pending: true, message: 'Check your email for a secure sign-in link.' };
    } catch (err) {
      const msg = customerSafeAuthError('Could not send the sign-in link.');
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  // New-account signup. Supabase sends a confirmation email; once the user
  // clicks the link, onAuthStateChange fires and the public.profiles row is
  // populated by the handle_new_user trigger.
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
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: cleanName ? { full_name: cleanName } : undefined,
        },
      });
      if (err) throw err;
      return { ok: true, pending: true, message: 'Check your email to confirm and finish signing in.' };
    } catch (err) {
      const msg = customerSafeAuthError('Could not create your account.');
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  // Email + password (Supabase). Used by staff who set a password via the
  // invite-accept flow; customers stay passwordless (magic link). On success
  // onAuthStateChange sets the session.
  const signInWithPassword = useCallback(async ({ email, password } = {}) => {
    if (!hasSupabase) return { ok: false, error: 'Password sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || ''),
      });
      if (err) throw err;
      return { ok: true }; // onAuthStateChange sets the user
    } catch (err) {
      const msg = customerSafeAuthError('That email or password was not correct.');
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  // Update the signed-in user's password (used to clear must_change_password
  // after an admin force-set a temporary one).
  const updatePassword = useCallback(async (newPassword) => {
    if (!hasSupabase) return { ok: false, error: 'Not configured.' };
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.updateUser({ password: String(newPassword || '') });
      if (err) throw err;
      // Clear the must-change flag now that they've rotated it.
      try { await supabase.from('profiles').update({ must_change_password: false }).eq('id', data?.user?.id); } catch { /* non-fatal */ }
      const u = await buildSupabaseUser(data?.user || null);
      if (u) setUser(u);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: customerSafeAuthError('Could not update your password.') };
    }
  }, []);

  // Phone OTP (Supabase). signInWithPhone texts a code (delivered via the Quo
  // Send-SMS auth hook); verifyPhoneOtp checks it and onAuthStateChange sets
  // the session.
  const signInWithPhone = useCallback(async (phone) => {
    if (!authProviderConfig.phone) return { ok: false, error: 'Phone sign-in is not enabled for this environment.' };
    if (!hasSupabase) return { ok: false, error: 'Phone sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ phone: String(phone || '').trim() });
      if (err) throw err;
      return { ok: true, pending: true, message: 'We texted you a 6-digit code.' };
    } catch (err) {
      const msg = customerSafeAuthError('Could not send the code.');
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  const verifyPhoneOtp = useCallback(async (phone, token) => {
    if (!authProviderConfig.phone) return { ok: false, error: 'Phone sign-in is not enabled for this environment.' };
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
      const msg = customerSafeAuthError('That code was not valid.');
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  // Passkey / WebAuthn (Supabase native). signInWithPasskey is a passwordless
  // returning-user sign-in; registerPasskey enrolls one for the current session.
  const signInWithPasskey = useCallback(async () => {
    if (!authProviderConfig.passkey) return { ok: false, error: 'Passkey sign-in is not enabled for this environment.' };
    if (!hasSupabase) return { ok: false, error: 'Passkey sign-in is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPasskey();
      if (err) throw err;
      return { ok: true }; // onAuthStateChange sets the user
    } catch (err) {
      const msg = customerSafeAuthError('Passkey sign-in failed.');
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  const registerPasskey = useCallback(async () => {
    if (!authProviderConfig.passkey) return { ok: false, error: 'Passkey enrollment is not enabled for this environment.' };
    if (!hasSupabase) return { ok: false, error: 'Passkeys are not configured yet.' };
    setError(null);
    try {
      const { error: err } = await supabase.auth.registerPasskey();
      if (err) throw err;
      return { ok: true, message: 'Passkey added — use it to sign in next time.' };
    } catch (err) {
      return { ok: false, error: customerSafeAuthError('Could not add a passkey.') };
    }
  }, []);

  // Social sign-in (Google / Apple) via Supabase OAuth. Redirects to the
  // provider and back to /auth/callback, which exchanges the code and routes
  // by profile role.
  // Enable the provider in Supabase → Auth → Providers for it to work.
  const signInWithOAuth = useCallback(async (provider) => {
    if (!authProviderConfig[provider]) return { ok: false, error: `${provider === 'apple' ? 'Apple' : 'Google'} sign-in is not enabled for this environment.` };
    if (!hasSupabase) return { ok: false, error: 'Social sign-in is not configured yet.' };
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) throw err;
      return { ok: true, pending: true };
    } catch (err) {
      const msg = customerSafeAuthError(`Could not sign in with ${provider}.`);
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
    // Staff with a password sign in directly; passwordless customers (no
    // password supplied) get a magic link as before.
    if (hasSupabase && !isDemoAccount && String(password || '').length > 0) return signInWithPassword({ email, password });
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
        mfa: demoMfaState(),
        securityWall: 'pre-api-hard-wall',
      };
      seedDemoState(profile.canonical || usernameKey);
      setUser(sessionUser);
      writeSession(sessionUser);
      appendActivity('Signed in', { role: sessionUser.role, username: usernameKey, authMode: sessionUser.authMode });
      return { ok: true, user: sessionUser };
    } catch (err) {
      const msg = demoAuthErrorMessage(err);
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, [signInWithEmail, signInWithPassword]);

  // Password recovery creates a Supabase recovery session and lands on the same
  // password update screen used by invited staff who must rotate a temp password.
  const requestPasswordReset = useCallback(async (email) => {
    if (!hasSupabase) return { ok: false, error: 'Password reset is not configured yet.' };
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), {
        redirectTo: `${window.location.origin}/account/new-password`,
      });
      if (err) throw err;
      return { ok: true, pending: true, message: 'Check your email for a password reset link.' };
    } catch (err) {
      const msg = customerSafeAuthError('Could not send the password reset link.');
      setError(msg);
      return { ok: false, error: msg };
    } finally { setLoading(false); }
  }, []);

  const signOut = useCallback(async () => {
    if (user) appendActivity('Signed out', { role: user.role, username: user.username });
    // Clear LOCAL session state first so sign-out is instant. supabase.auth.signOut()
    // can stall on the navigator.locks auth lock; awaiting it before clearing left
    // the UI hung on "Signing out…" forever. Fire it best-effort in the background.
    setUser(null);
    if (!hasSupabase) writeSession(null);
    clearLastActivity();
    clearAllAvLocal();
    if (hasSupabase) { supabase.auth.signOut().catch(() => { /* best-effort */ }); }
  }, [user]);

  // Idle auto-logoff. While a user is signed in, track activity and force
  // sign-out after IDLE_TIMEOUT_MS of inactivity. The timestamp lives in
  // sessionStorage so a page refresh doesn't reset the clock.
  useEffect(() => {
    if (!user) { clearLastActivity(); return undefined; }
    noteActivity();
    const onActivity = () => noteActivity();
    IDLE_ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    const onVisibility = () => { if (document.visibilityState === 'visible') noteActivity(); };
    document.addEventListener('visibilitychange', onVisibility);
    const tick = setInterval(() => {
      const last = readLastActivity();
      if (last == null) { noteActivity(); return; }
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        clearInterval(tick);
        appendActivity('Session idle timeout', { role: user.role, username: user.username });
        signOut();
      }
    }, IDLE_CHECK_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      IDLE_ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, signOut]);

  return React.createElement(
    AuthStoreContext.Provider,
    {
      value: {
        user, loading, error,
        signIn, signInWithEmail, signInWithPassword, updatePassword, signUpWithEmail, signInWithPhone, verifyPhoneOtp,
        signInWithPasskey, registerPasskey, signInWithOAuth,
        signOut, requestPasswordReset, refreshSupabaseSession,
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
