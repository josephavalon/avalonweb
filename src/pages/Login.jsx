import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Fingerprint, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { useToast } from '@/components/ui/use-toast';

const EASE = [0.16, 1, 0.3, 1];

const AppleLogo = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const GoogleLogo = (props) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// ── Reusable field ────────────────────────────────────────────────────────────
function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/40">
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
          className="w-full px-4 py-2.5 rounded-xl border border-foreground/15 bg-foreground/[0.03] font-body text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/40 transition-colors"
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
      className="w-full flex items-center justify-between px-6 py-3 rounded-2xl bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
  const { signIn, loading, error, user } = useAuthStore();
  const { toast } = useToast();
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [fieldError, setFieldError]     = useState('');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading]     = useState(false);
  const [passkeyError, setPasskeyError]         = useState('');

  useEffect(() => {
    if (user) navigate(user.redirect || '/members/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
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

  const handlePasskey = async () => {
    setPasskeyLoading(true); setPasskeyError('');
    try {
      await navigator.credentials.get({
        publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: window.location.hostname, userVerification: 'required', timeout: 60000 },
      });
      setPasskeyError('Passkey backend not yet configured — use username + password for now.');
    } catch (err) {
      if (err.name !== 'NotAllowedError') setPasskeyError('Passkey sign-in failed. Try username + password.');
    } finally { setPasskeyLoading(false); }
  };

  const displayError = fieldError || error;

  return (
    <div className="space-y-4">
      {/* SSO */}
      <div className="space-y-2">
        {passkeySupported && (
          <button type="button" onClick={handlePasskey} disabled={passkeyLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-foreground/15 bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-all font-body text-xs tracking-[0.15em] uppercase text-foreground disabled:opacity-40">
            {passkeyLoading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-foreground/30 border-t-foreground animate-spin" /> : <Fingerprint className="w-3.5 h-3.5 text-foreground/60" strokeWidth={1.5} />}
            {passkeyLoading ? 'Authenticating…' : 'Sign in with Passkey'}
          </button>
        )}
        <button type="button" onClick={() => toast({ title: 'Coming soon', description: 'Apple Sign In will be available at launch.' })}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-foreground/15 bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-all font-body text-xs tracking-[0.15em] uppercase text-foreground">
          <AppleLogo className="w-3.5 h-3.5" /> Sign in with Apple
        </button>
        <button type="button" onClick={() => toast({ title: 'Coming soon', description: 'Google Sign In will be available at launch.' })}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-foreground/15 bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-all font-body text-xs tracking-[0.15em] uppercase text-foreground">
          <GoogleLogo className="w-3.5 h-3.5" /> Sign in with Google
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-foreground/[0.08]" />
        <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/30">or</p>
        <div className="flex-1 h-px bg-foreground/[0.08]" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
        <Field id="username" label="Username or Email" value={username}
          onChange={(e) => { setUsername(e.target.value); setFieldError(''); }}
          autoComplete="username webauthn" placeholder="username or email" />

        <Field id="password" label="Password" type={showPw ? 'text' : 'password'} value={password}
          onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
          autoComplete="current-password" placeholder="••••••••">
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-foreground/30 hover:text-foreground/60 transition-colors">
            {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </Field>

        <div className="flex justify-end">
          <button type="button" onClick={() => onSwitchTab('forgot')}
            className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/35 hover:text-foreground/60 transition-colors">
            Forgot password?
          </button>
        </div>

        <ErrorBanner msg={passkeyError || displayError} />
        <SubmitBtn loading={loading} label="Sign In" loadingLabel="Signing in…" />
      </form>
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
        <button type="button" onClick={() => setShowPw(v => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-foreground/30 hover:text-foreground/60 transition-colors">
          {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
        </button>
      </Field>

      <Field id="reg-confirm" label="Confirm Password" type={showPw ? 'text' : 'password'} value={confirm}
        onChange={(e) => { setConfirm(e.target.value); setError(''); }}
        autoComplete="new-password" placeholder="••••••••" />

      <ErrorBanner msg={error} />
      <SuccessBanner msg={success} />
      <SubmitBtn loading={loading} label="Create Account" loadingLabel="Creating…" />

      <p className="font-body text-[9px] tracking-[0.1em] text-foreground/25 text-center leading-relaxed">
        By creating an account you agree to our{' '}
        <Link to="/safety" className="text-foreground/40 hover:text-foreground/60 transition-colors underline">Terms</Link>
        {' '}and{' '}
        <Link to="/safety" className="text-foreground/40 hover:text-foreground/60 transition-colors underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}

// ── Tab: Forgot Password ──────────────────────────────────────────────────────
function ForgotPasswordTab({ onSwitchTab }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email.trim()) { setError('Enter your email address.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
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
        className="w-full text-center font-body text-[9px] tracking-[0.2em] uppercase text-foreground/35 hover:text-foreground/60 transition-colors">
        ← Back to Sign In
      </button>
    </div>
  );
}

// ── Main Login page ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'signin',  label: 'Sign In' },
  { id: 'create',  label: 'Create Account' },
];

const TAB_TITLES = {
  signin:  { eyebrow: 'Welcome back',    heading: 'Sign In' },
  create:  { eyebrow: 'Join Avalon',     heading: 'Create Account' },
  forgot:  { eyebrow: 'Password reset',  heading: 'Forgot Password' },
};

export default function Login() {
  useSeo({ title: 'Sign In — Avalon Vitality', path: '/login' });
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin');

  useEffect(() => {
    if (user) navigate(user.redirect || '/members/dashboard', { replace: true });
  }, [user, navigate]);

  const { eyebrow, heading } = TAB_TITLES[tab];

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-6"
      style={{ background: 'var(--background)' }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-5 self-start w-full max-w-sm"
      >
        <Link to="/" className="font-heading text-base tracking-[0.3em] text-foreground/50 hover:text-foreground/80 transition-opacity">
          AVALON VITALITY
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="mb-5">
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-1">
            {eyebrow}
          </p>
          <h1 className="font-heading text-3xl text-foreground uppercase tracking-tight leading-none">
            {heading}
          </h1>
        </div>

        {/* Tabs — only show for non-forgot flow */}
        {tab !== 'forgot' && (
          <div className="flex gap-0 mb-5 border-b border-foreground/[0.08]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="relative pb-2.5 mr-5 font-body text-[10px] tracking-[0.2em] uppercase transition-colors"
                style={{ color: tab === t.id ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.35)' }}
              >
                {t.label}
                {tab === t.id && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground"
                    transition={{ duration: 0.25, ease: EASE }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <AnimatePresence mode="wait">
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

        <div className="mt-5 text-center">
          <Link to="/" className="inline-block font-body text-[10px] tracking-[0.2em] uppercase text-foreground/35 hover:text-foreground/60 transition-colors">
            ← Back to Avalon
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
