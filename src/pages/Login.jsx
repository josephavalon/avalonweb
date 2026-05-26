import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Fingerprint, AlertCircle, CheckCircle, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { PRE_API_SECURITY_MODE, isDemoAuthAllowed } from '@/lib/preApiSecurity';

const EASE = [0.16, 1, 0.3, 1];

const DEMO_SHORTCUTS = [
  { username: 'CLIENT0001', label: 'Client', detail: 'booking, prep, support', icon: UserRound },
  { username: 'NURSE0001', label: 'Nurse', detail: 'shift, route, chart', icon: Stethoscope },
  { username: 'NP0001', label: 'NP', detail: 'GFE, approvals', icon: ShieldCheck },
  { username: 'PHYSICIAN0001', label: 'MD', detail: 'standing orders', icon: ShieldCheck },
  { username: 'ADMIN001', label: 'Admin', detail: 'handoff, dispatch, ops', icon: ShieldCheck },
];
const DEMO_PASSWORD = import.meta.env.VITE_AVALON_DEMO_PASSWORD || 'JonJones1986';
const PASSKEY_ENABLED = false;

// ── Reusable field ────────────────────────────────────────────────────────────
function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="font-body text-[11px] tracking-[0.18em] uppercase text-foreground/45">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder}
          className="min-h-[46px] w-full rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3 font-body text-base text-foreground placeholder:text-foreground/20 transition-colors focus:border-foreground/40 focus:outline-none sm:text-sm"
        />
        {children}
      </div>
    </div>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
            <p className="font-body text-[11px] text-red-400 leading-relaxed">{msg}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Success banner ────────────────────────────────────────────────────────────
function SuccessBanner({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" strokeWidth={2} />
            <p className="font-body text-[11px] text-emerald-400 leading-relaxed">{msg}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Submit button ─────────────────────────────────────────────────────────────
function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={{ scale: 0.98 }}
      className="flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-foreground px-6 py-3 font-body text-xs font-semibold uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>{loading ? loadingLabel : label}</span>
      {loading
        ? <span className="w-4 h-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
        : <ArrowRight className="w-4 h-4" strokeWidth={2} />
      }
    </motion.button>
  );
}

// ── Tab: Sign In ──────────────────────────────────────────────────────────────
function SignInTab({ onSwitchTab }) {
  const navigate = useNavigate();
  const { signIn, loading, error } = useAuthStore();
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [fieldError, setFieldError]     = useState('');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading]     = useState(false);
  const [passkeyError, setPasskeyError]         = useState('');
  useEffect(() => {
    if (!PASSKEY_ENABLED) {
      setPasskeySupported(false);
      return;
    }

    const check = async () => {
      if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
        const ok = await window.PublicKeyCredential.isConditionalMediationAvailable();
        setPasskeySupported(ok);
      }
    };
    check();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldError('');
    if (!username.trim()) { setFieldError('Enter your username or email.'); return; }
    if (!password)        { setFieldError('Enter your password.'); return; }
    const result = await signIn({ email: username.trim(), password });
    if (result.ok) navigate(result.user.redirect || '/members/dashboard', { replace: true });
  };

  const handleDemoSignIn = async (demoUsername) => {
    setFieldError('');
    if (!DEMO_PASSWORD) {
      setFieldError('Demo shortcut password is not configured.');
      return;
    }
    setUsername(demoUsername);
    setPassword(DEMO_PASSWORD);
    const result = await signIn({ email: demoUsername, password: DEMO_PASSWORD });
    if (result.ok) navigate(result.user.redirect || '/members/dashboard', { replace: true });
  };

  const handlePasskey = async () => {
    if (!PASSKEY_ENABLED) {
      setPasskeyError('Passkey sign-in is not enabled yet.');
      return;
    }

    setPasskeyLoading(true); setPasskeyError('');
    try {
      const cryptoApi = window.crypto || globalThis.crypto;
      const challenge = cryptoApi?.getRandomValues
        ? cryptoApi.getRandomValues(new Uint8Array(32))
        : Uint8Array.from({ length: 32 }, () => Math.floor(Math.random() * 255));

      await navigator.credentials.get({
        publicKey: { challenge, rpId: window.location.hostname, userVerification: 'required', timeout: 60000 },
      });
      setPasskeyError('Passkey backend not yet configured — use username + password for now.');
    } catch (err) {
      if (err.name !== 'NotAllowedError') setPasskeyError('Passkey sign-in failed. Try username + password.');
    } finally { setPasskeyLoading(false); }
  };

  const displayError = fieldError || error;
  const demoAuthAllowed = isDemoAuthAllowed();

  return (
    <div className="space-y-3.5">
      <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
        <Field id="username" label="Username or Email" value={username}
          onChange={(e) => { setUsername(e.target.value); setFieldError(''); }}
          autoComplete="username" placeholder="CLIENT0001, NURSE0001, ADMIN001" />

        <Field id="password" label="Password" type={showPw ? 'text' : 'password'} value={password}
          onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
          autoComplete="current-password" placeholder="••••••••">
          <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-foreground/30 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/60">
            {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </Field>

        <ErrorBanner msg={passkeyError || displayError} />
        <SubmitBtn loading={loading} label="Sign In" loadingLabel="Signing in…" />
      </form>

      {passkeySupported && (
        <button type="button" onClick={handlePasskey} disabled={passkeyLoading}
          className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border border-foreground/15 bg-foreground/[0.03] py-3 font-body text-xs uppercase tracking-[0.15em] text-foreground transition-all hover:bg-foreground/[0.06] disabled:opacity-40">
          {passkeyLoading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-foreground/30 border-t-foreground animate-spin" /> : <Fingerprint className="w-3.5 h-3.5 text-foreground/60" strokeWidth={1.5} />}
          {passkeyLoading ? 'Authenticating…' : 'Use Passkey'}
        </button>
      )}

      {demoAuthAllowed && (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/48">
            Preview accounts
          </p>
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/30">
            Local only
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {DEMO_SHORTCUTS.map(({ username: demoUsername, label, icon: Icon }) => (
            <button
              key={demoUsername}
              type="button"
              onClick={() => handleDemoSignIn(demoUsername)}
              disabled={loading}
              className="min-h-[72px] cursor-pointer rounded-xl border border-foreground/10 bg-foreground/[0.035] px-2 py-2 text-left transition-all hover:border-foreground/25 hover:bg-foreground/[0.06] active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
            >
              <Icon className="mb-2 h-3.5 w-3.5 text-foreground/55" strokeWidth={1.7} />
              <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">{label}</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground/38">{demoUsername}</p>
            </button>
          ))}
        </div>
          <p className="mt-2 font-body text-[10px] leading-relaxed text-foreground/34">
            Local simulation only. {PRE_API_SECURITY_MODE.label}. No live clinical access.
          </p>
      </div>
      )}
      {!demoAuthAllowed && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.055] p-3">
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-amber-200">Production guard</p>
          <p className="mt-1 font-body text-xs leading-relaxed text-foreground/52">
            Demo access is blocked outside local simulation.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Create Account ───────────────────────────────────────────────────────
function CreateAccountTab() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name.trim())  { setError('Enter your full name.'); return; }
    if (!email.trim()) { setError('Enter your email address.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords don\'t match.'); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setSuccess('Account created! Check your email to verify, then sign in.');
    setName(''); setEmail(''); setPassword(''); setConfirm('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
      <Field id="reg-name" label="Full Name" value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }}
        autoComplete="name" placeholder="Your name" />

      <Field id="reg-email" label="Email Address" type="email" value={email}
        onChange={(e) => { setEmail(e.target.value); setError(''); }}
        autoComplete="email" placeholder="you@example.com" />

      <Field id="reg-password" label="Password" type={showPw ? 'text' : 'password'} value={password}
        onChange={(e) => { setPassword(e.target.value); setError(''); }}
        autoComplete="new-password" placeholder="8+ characters">
        <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-foreground/30 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/60">
          {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
        </button>
      </Field>

      <Field id="reg-confirm" label="Confirm Password" type={showPw ? 'text' : 'password'} value={confirm}
        onChange={(e) => { setConfirm(e.target.value); setError(''); }}
        autoComplete="new-password" placeholder="••••••••" />

      <ErrorBanner msg={error} />
      <SuccessBanner msg={success} />
      <SubmitBtn loading={loading} label="Create Account" loadingLabel="Creating…" />

      <p className="font-body text-[11px] text-foreground/35 text-center leading-relaxed">
        By creating an account you agree to our{' '}
        <Link to="/terms-and-conditions" className="inline-flex min-h-[44px] items-center text-foreground/40 underline transition-colors hover:text-foreground/60">Terms</Link>
        {' '}and{' '}
        <Link to="/privacy-policy" className="inline-flex min-h-[44px] items-center text-foreground/40 underline transition-colors hover:text-foreground/60">Privacy Policy</Link>.
      </p>
    </form>
  );
}

// ── Tab: Forgot Password ──────────────────────────────────────────────────────
function ForgotPasswordTab({ onSwitchTab }) {
  const { requestPasswordReset, loading } = useAuthStore();
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email.trim()) { setError('Enter your email address.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address.'); return; }
    const result = await requestPasswordReset(email.trim());
    if (!result.ok) {
      setError(result.error || 'Password reset is not connected yet.');
      return;
    }
    setSuccess('If that email is on file, a reset link is on its way.');
    setEmail('');
  };

  return (
    <div className="space-y-4">
      <p className="font-body text-xs text-foreground/50 leading-relaxed">
        Enter your email and we'll send a password reset link.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
        <Field id="forgot-email" label="Email Address" type="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          autoComplete="email" placeholder="you@example.com" />
        <ErrorBanner msg={error} />
        <SuccessBanner msg={success} />
        <SubmitBtn loading={loading} label="Send Reset Link" loadingLabel="Sending…" />
      </form>
      <button type="button" onClick={() => onSwitchTab('signin')}
        className="min-h-[44px] w-full text-center font-body text-[11px] uppercase tracking-[0.16em] text-foreground/40 transition-colors hover:text-foreground/65">
        Back to Sign In
      </button>
    </div>
  );
}

// ── Main Login page ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'signin',  label: 'Sign In' },
  { id: 'create',  label: 'Create Account' },
  { id: 'forgot',  label: 'Reset Password' },
];

const TAB_TITLES = {
  signin:  { eyebrow: 'Portal', heading: 'Sign In' },
  create:  { eyebrow: 'Portal', heading: 'Create Account' },
  forgot:  { eyebrow: 'Portal', heading: 'Reset Password' },
};

const PORTAL_METRICS = [
  ['Client', 'Book + prep'],
  ['Nurse', 'Shift command'],
  ['NP / MD', 'Clinical authority'],
  ['Admin', 'Ops console'],
];

export default function Login() {
  useSeo({
    title: 'Sign In — Avalon Vitality',
    description: 'Sign in to Avalon Vitality for client booking, nurse shift command, and admin operations.',
    path: '/login',
  });
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin');

  // Inherit the theme that was active on the main site
  useEffect(() => {
    try {
      const THEMES = ['dark', 'light'];
      const stored = window.localStorage.getItem('avalon.theme');
      const theme = stored && THEMES.includes(stored) ? stored : 'light';
      document.documentElement.classList.remove('dark', 'golden', 'dubs');
      if (theme !== 'light') document.documentElement.classList.add(theme);
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[login-theme]', err);
    }
  }, []);

  const { eyebrow, heading } = TAB_TITLES[tab];

  return (
    <div className="relative min-h-screen min-h-dvh overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-8 md:py-8">
      <main className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl items-center gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.64, ease: EASE }}
          className="hidden min-h-[min(760px,calc(100vh-4rem))] min-h-[min(760px,calc(100dvh-4rem))] flex-col justify-between overflow-hidden rounded-[2rem] border border-foreground/[0.10] bg-foreground/[0.035] p-8 shadow-[0_32px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl lg:flex"
        >
          <div className="flex items-start justify-between gap-5">
            <Link to="/" className="inline-flex min-h-11 flex-col justify-center leading-none transition-colors hover:opacity-70">
              <span className="block font-heading text-[17px] leading-none tracking-[0.22em] text-foreground">AVALON</span>
              <span className="mt-0.5 block font-body text-[7px] uppercase tracking-[0.38em] text-foreground/58">VITALITY</span>
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center rounded-full border border-foreground/[0.12] px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-foreground/52 transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              Back
            </Link>
          </div>

          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.32em] text-foreground/42">Avalon Portal</p>
            <h2 className="mt-4 max-w-xl font-heading text-[7.6rem] uppercase leading-[0.82] tracking-tight text-foreground">
              Care<br />Command
            </h2>
            <p className="mt-6 max-w-md font-body text-base leading-relaxed text-foreground/58">
              Secure access for clients, field nurses, and operations.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {PORTAL_METRICS.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-background/48 p-4 shadow-[0_18px_70px_hsl(var(--foreground)/0.045)] backdrop-blur-xl">
                <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/35">{label}</p>
                <p className="mt-2 font-body text-xs font-semibold text-foreground/72">{value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <section className="flex min-h-[calc(100vh-2.5rem)] min-h-[calc(100dvh-2.5rem)] items-center justify-center lg:min-h-[min(760px,calc(100vh-4rem))] lg:min-h-[min(760px,calc(100dvh-4rem))]">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
            className="relative w-full max-w-sm rounded-3xl border border-foreground/10 bg-foreground/[0.04] px-7 py-8 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:max-w-[29rem] lg:px-8 lg:py-9"
          >
            <Link to="/" className="mb-6 inline-flex min-h-11 flex-col justify-center transition-colors hover:opacity-70 lg:hidden">
              <span className="block font-heading text-[17px] leading-none tracking-[0.22em] text-foreground">AVALON</span>
              <span className="mt-0.5 block font-body text-[7px] uppercase tracking-[0.38em] text-foreground/58">VITALITY</span>
            </Link>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 font-body text-[11px] uppercase tracking-[0.22em] text-foreground/45">
                  {eyebrow}
                </p>
                <h1 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground lg:text-5xl">
                  {heading}
                </h1>
              </div>
              <span className="hidden rounded-full border border-foreground/[0.12] px-3 py-1.5 font-body text-[9px] uppercase tracking-[0.18em] text-foreground/38 lg:inline-flex">
                Secure
              </span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                {tab === 'signin'  && <SignInTab onSwitchTab={setTab} />}
                {tab === 'create'  && <CreateAccountTab />}
                {tab === 'forgot'  && <ForgotPasswordTab onSwitchTab={setTab} />}
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex items-center justify-between border-t border-foreground/[0.08] pt-4">
              {TABS.filter((item) => item.id !== tab).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="inline-flex min-h-[44px] items-center font-body text-[10px] uppercase tracking-[0.18em] text-foreground/38 transition-colors hover:text-foreground/65"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </motion.div>
        </section>
      </main>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
        className="relative mt-5 text-center lg:hidden"
      >
        <Link to="/" className="inline-flex min-h-[44px] items-center font-body text-[10px] uppercase tracking-[0.2em] text-foreground/30 transition-colors hover:text-foreground/60">
          Back to Avalon
        </Link>
      </motion.div>
    </div>
  );
}
