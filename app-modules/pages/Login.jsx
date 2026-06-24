import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, ChevronRight, Eye, EyeOff, Fingerprint,
  LockKeyhole, Mail, MailCheck, ShieldCheck, Smartphone, Stethoscope, UserPlus,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/components/ui/PageTransitionMotion';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';
import NewCustomerPanel from '@/components/auth/NewCustomerPanel';
import AvalonMark from '@/components/AvalonMark';
import { isDemoAuthAllowed } from '@/lib/preApiSecurity';
import { authProviderConfig } from '@/lib/authProviderConfig';

const EASE = [0.16, 1, 0.3, 1];

export function safeLoginRedirectPath(requested) {
  const value = String(requested || '').trim();
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '';
  try {
    const url = new URL(value, 'https://avalon.local');
    if (url.origin !== 'https://avalon.local') return '';
    const decodedPath = decodeURIComponent(url.pathname);
    if (!decodedPath.startsWith('/') || decodedPath.startsWith('//')) return '';
    if (decodedPath.includes(':') || decodedPath.includes('\\') || /[\u0000-\u001f\u007f]/.test(decodedPath)) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.47c-.28 1.48-1.12 2.74-2.39 3.58v2.92h3.76c2.2-2.03 3.65-5.02 3.65-8.52z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.76-2.92c-1.04.7-2.37 1.11-4.18 1.11-3.12 0-5.76-2.11-6.71-4.94H1.4v3.01C3.36 21.24 7.38 24 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.34A7.22 7.22 0 0 1 4.91 12c0-.81.14-1.6.38-2.34V6.65H1.4A12 12 0 0 0 0 12c0 1.93.46 3.76 1.4 5.35l3.89-3.01z" />
      <path fill="#EA4335" d="M12 4.72c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.15 15.23 0 12 0 7.38 0 3.36 2.76 1.4 6.65l3.89 3.01C6.24 6.83 8.88 4.72 12 4.72z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-foreground" aria-hidden="true">
      <path d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.61 1.09zM15.53 3.83C16.37 2.82 16.93 1.4 16.78 0c-1.21.05-2.66.81-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.56-1.7z" />
    </svg>
  );
}

function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete, autoCapitalize = 'none', children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          className="min-h-[44px] w-full rounded-xl border border-foreground/14 bg-foreground/[0.045] px-4 py-2.5 font-body text-[15px] font-semibold text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] outline-none backdrop-blur-xl transition-colors placeholder:text-foreground/25 focus:border-foreground/42 focus:bg-foreground/[0.07] md:min-h-[40px] md:py-2"
        />
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p className="font-body text-sm font-medium leading-relaxed">{message}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SubmitButton({ loading, idle, busy }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={{ scale: 0.985 }}
      className="flex min-h-[46px] w-full items-center justify-between rounded-full bg-foreground px-5 font-body text-xs font-bold uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/88 disabled:cursor-wait disabled:opacity-45 md:min-h-[42px]"
    >
      <span>{loading ? busy : idle}</span>
      {loading ? (
        <span className="h-5 w-5 rounded-full border-2 border-background/25 border-t-background animate-spin" />
      ) : (
        <ArrowRight className="h-5 w-5" strokeWidth={2} />
      )}
    </motion.button>
  );
}

// Pill segmented control. Reused for the PATIENT/ADMIN audience switch.
function SegmentedToggle({ options, value, onChange }) {
  return (
    <div
      className="grid gap-1 rounded-full border border-foreground/[0.12] bg-foreground/[0.04] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-full font-body text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${value === key ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground'}`}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2} /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

// Full-width method pill. variant="primary" is the solid white CTA; "ghost" is
// the outlined glass row. `icon` is a node so SVG brand marks can be passed in.
function MethodButton({ icon, label, onClick, busy, variant = 'ghost' }) {
  const styles = variant === 'primary'
    ? 'bg-foreground text-background hover:bg-foreground/88'
    : 'border border-foreground/[0.16] bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.08]';
  const spinner = variant === 'primary'
    ? 'border-background/25 border-t-background'
    : 'border-foreground/25 border-t-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-full px-2 font-body text-[9px] font-bold uppercase tracking-[0.1em] transition-colors disabled:cursor-wait disabled:opacity-50 md:min-h-[40px] md:gap-2.5 md:text-[11px] md:tracking-[0.16em] ${styles}`}
    >
      {busy ? <span className={`h-4 w-4 rounded-full border-2 ${spinner} animate-spin`} /> : icon}
      {label}
    </button>
  );
}

function Divider({ label = 'or' }) {
  return (
    <div className="flex items-center gap-3 py-0">
      <span className="h-px flex-1 bg-foreground/10" />
      <span className="font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{label}</span>
      <span className="h-px flex-1 bg-foreground/10" />
    </div>
  );
}

function BackRow({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[34px] items-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/50 transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </button>
  );
}

function InboxPanel({ address, onReset }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/22 bg-emerald-500/[0.08] px-4 py-4 text-emerald-100">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
        <p className="font-body text-sm font-medium leading-relaxed">
          Check your inbox — we sent a secure sign-in link to <span className="font-bold">{address}</span>. Open it on this device to finish signing in.
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-[44px] items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
      >
        Use a different email
      </button>
    </div>
  );
}

export default function Login({ defaultAudience = 'patient' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user, signIn, signInWithEmail, signInWithPhone, verifyPhoneOtp, signInWithPasskey,
    signInWithOAuth, signOut, requestPasswordReset, authBackend, loading, error,
  } = useAuthStore();
  const supabaseMode = authBackend === 'supabase';
  const demoAuthAvailable = isDemoAuthAllowed();

  const [audience, setAudience] = useState(defaultAudience === 'admin' ? 'admin' : 'patient');
  const isAdmin = audience === 'admin';
  // Patient-facing tab: 'returning' (sign in) or 'new' (create account). The
  // 'nurse' tab is a nav action, not a persistent mode — it routes to /nurses.
  const [mode, setMode] = useState('returning');
  const isNew = !isAdmin && mode === 'new';
  const isNurse = !isAdmin && mode === 'nurse';

  // 'methods' is the passwordless launchpad; 'email'/'phone' are the expanded forms.
  const [view, setView] = useState('methods');
  const [identifier, setIdentifier] = useState(''); // demo client ID / admin operator ID
  const [email, setEmail] = useState('');           // supabase magic-link address
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [linkSent, setLinkSent] = useState('');
  const [resetSent, setResetSent] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState('');

  useSeo({
    title: isAdmin ? 'Admin Sign In - Avalon Vitality' : 'Client Sign In - Avalon Vitality',
    description: isAdmin
      ? 'Avalon operations sign-in.'
      : 'Client sign in for Avalon Vitality visits, preparation, and support.',
    path: isAdmin ? '/admin/login' : '/login',
    robots: isAdmin ? 'noindex, nofollow, noarchive' : undefined,
  });

  useEffect(() => {
    try {
      applyTheme();
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[login-theme]', err);
    }
  }, []);

  const destinationFor = (sessionUser) => {
    const localPath = safeLoginRedirectPath(searchParams.get('redirect'));
    if (localPath && sessionUser?.role === 'client') return localPath;
    return sessionUser?.redirect || '/members/dashboard';
  };

  // Reset transient state whenever the audience flips so the patient and admin
  // panels never leak each other's input or errors.
  const switchAudience = (next) => {
    if (next === audience) return;
    setAudience(next);
    setMode('returning');
    setView('methods');
    setFieldError('');
    setLinkSent('');
    setResetSent('');
    setOtpSent(false);
    setOtp('');
    setPassword('');
  };

  // Patient tab switch. Every tab — including 'nurse' (an in-card coming-soon
  // panel) — swaps the card body in place and clears any in-flight sign-in state.
  // Nothing navigates away, so the card never remounts/refreshes between tabs.
  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setView('methods');
    setFieldError('');
    setLinkSent('');
    setResetSent('');
    setOtpSent(false);
    setOtp('');
    setPassword('');
  };

  // Single redirect authority for every backend/audience combination. Admin
  // sessions are role-gated: a non-admin who lands here is bounced and signed
  // out, matching the legacy operations screen.
  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/admin', { replace: true });
      } else {
        setFieldError('This account is not an Avalon team account. Sign out and try the customer sign-in.');
        signOut().catch(() => {});
      }
      return;
    }
    navigate(destinationFor(user), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, audience]);

  // Supabase email magic-link (patient or admin).
  const handleEmailLink = async (event) => {
    event.preventDefault();
    setFieldError('');
    if (!email.trim()) {
      setFieldError(isAdmin ? 'Enter your admin email.' : 'Enter your email address.');
      return;
    }
    const result = await signInWithEmail(email.trim());
    if (result.ok) setLinkSent(email.trim());
    else setFieldError(result.error || 'Could not send the sign-in link.');
  };

  // Demo roster sign-in. Patient uses client ID/email; admin uses operator ID.
  // Both go through signIn(); the redirect effect resolves the destination.
  const handleDemoSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    if (!identifier.trim()) {
      setFieldError(isAdmin ? 'Enter your operator ID and passcode.' : 'Enter your client ID or email.');
      return;
    }
    if (!password) {
      setFieldError(isAdmin ? 'Enter your operator ID and passcode.' : 'Enter your password.');
      return;
    }
    const result = await signIn({ email: identifier.trim(), password });
    if (!result.ok) {
      setFieldError(result.error || (isAdmin ? 'Invalid operator ID or passcode.' : 'Those credentials did not match.'));
    }
    // success → redirect effect handles routing (and admin role bounce)
  };

  // Email + password (Supabase). Staff who set a password via the invite flow
  // sign in here; signIn() routes a supplied password to signInWithPassword.
  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    if (!email.trim() || !password) { setFieldError('Enter your email and password.'); return; }
    const result = await signIn({ email: email.trim(), password });
    if (!result.ok) setFieldError(result.error || 'That email or password was not correct.');
    // success → redirect effect handles routing
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setFieldError('');
    const cleanEmail = email.trim();
    if (!cleanEmail) { setFieldError('Enter your email address.'); return; }
    const result = await requestPasswordReset(cleanEmail);
    if (result.ok) setResetSent(cleanEmail);
    else setFieldError(result.error || 'Could not send the reset link.');
  };

  // Phone OTP: first submit sends the code, second verifies it.
  const handlePhone = async (event) => {
    event.preventDefault();
    setFieldError('');
    if (!authProviderConfig.phone) {
      setFieldError('Phone sign-in is not enabled for this environment.');
      return;
    }
    if (!otpSent) {
      if (!phone.trim()) { setFieldError('Enter your phone number.'); return; }
      const result = await signInWithPhone(phone.trim());
      if (result.ok) setOtpSent(true);
      else setFieldError(result.error || 'Could not send the code.');
      return;
    }
    if (!otp.trim()) { setFieldError('Enter the 6-digit code we texted you.'); return; }
    const result = await verifyPhoneOtp(phone.trim(), otp.trim());
    if (!result.ok) setFieldError(result.error || 'That code was not valid.');
  };

  const handlePasskey = async () => {
    setFieldError('');
    if (!authProviderConfig.passkey) {
      setFieldError('Passkey sign-in is not enabled for this environment.');
      return;
    }
    setPasskeyBusy(true);
    const result = await signInWithPasskey();
    setPasskeyBusy(false);
    if (!result.ok) setFieldError(result.error || 'Passkey sign-in failed.');
  };

  const handleOAuth = async (provider) => {
    setFieldError('');
    if (!authProviderConfig[provider]) {
      setFieldError(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in is not enabled for this environment.`);
      return;
    }
    setOauthBusy(provider);
    const result = await signInWithOAuth(provider);
    // On success Supabase redirects to the provider; on failure, surface it.
    if (!result.ok) { setOauthBusy(''); setFieldError(result.error || 'Could not start social sign-in.'); }
  };

  const displayError = fieldError || error;
  const heading = isAdmin
    ? ['Admin', 'Sign In']
    : isNurse
      ? ['Nurse', 'Portal']
      : isNew
        ? ['New', 'Customer']
        : ['Welcome', 'Back'];

  // Nurse tab: in-card coming-soon panel (mirrors /nurses copy) so switching to
  // it keeps the same card — no navigation, no remount.
  const nursePanel = (
    <div className="space-y-4 text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045] text-foreground/72">
        <Stethoscope className="h-6 w-6" strokeWidth={1.8} />
      </span>
      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/55">
        Coming Soon
      </p>
      <p className="mx-auto max-w-[30ch] font-body text-sm font-medium leading-relaxed text-foreground/55">
        The Avalon Vitality nurse portal is on the way. Registered nurses will manage visits, kits, and clinical reviews from here.
      </p>
    </div>
  );

  const emailForm = (
    <form onSubmit={handleEmailLink} className="space-y-4 md:space-y-3" noValidate>
      <Field
        id="login-email"
        label={isAdmin ? 'Admin email' : 'Email'}
        type="email"
        value={email}
        onChange={(event) => { setEmail(event.target.value); setFieldError(''); }}
        autoComplete="email"
        placeholder={isAdmin ? 'you@avalonvitality.co' : 'you@email.com'}
      />
      <ErrorBanner message={displayError} />
      <SubmitButton loading={loading} idle="Email Me A Link" busy="Sending Link" />
    </form>
  );

  const phoneForm = (
    <form onSubmit={handlePhone} className="space-y-4 md:space-y-3" noValidate>
      <Field
        id="login-phone"
        label="Phone"
        type="tel"
        value={phone}
        onChange={(event) => { setPhone(event.target.value); setFieldError(''); }}
        autoComplete="tel"
        placeholder="+1 (415) 555-0199"
      />
      {otpSent && (
        <Field
          id="login-otp"
          label="6-Digit Code"
          type="text"
          value={otp}
          onChange={(event) => { setOtp(event.target.value); setFieldError(''); }}
          autoComplete="one-time-code"
          placeholder="123456"
        />
      )}
      <ErrorBanner message={displayError} />
      <SubmitButton loading={loading} idle={otpSent ? 'Verify & Sign In' : 'Text Me A Code'} busy={otpSent ? 'Verifying' : 'Sending Code'} />
      {otpSent && (
        <button
          type="button"
          onClick={() => { setOtpSent(false); setOtp(''); setFieldError(''); }}
          className="inline-flex min-h-[44px] items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
        >
          Use a different number
        </button>
      )}
    </form>
  );

  // Demo (offline) roster form. Patient = Client ID + Password; admin = Operator
  // ID + Passcode. Passwordless methods can't reach a backend offline, so this
  // is the only path the beta surfaces.
  const demoForm = (
    <form onSubmit={handleDemoSubmit} className="space-y-4 md:space-y-3" noValidate>
      <Field
        id="login-identifier"
        label={isAdmin ? 'Operator ID' : 'Client ID or Email'}
        type="text"
        value={identifier}
        onChange={(event) => { setIdentifier(event.target.value); setFieldError(''); }}
        autoComplete="username"
        autoCapitalize={isAdmin ? 'characters' : 'none'}
        placeholder={isAdmin ? 'ADMIN001' : 'CLIENT0001'}
      />
      <Field
        id="login-password"
        label={isAdmin ? 'Passcode' : 'Password'}
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(event) => { setPassword(event.target.value); setFieldError(''); }}
        autoComplete="current-password"
        placeholder={isAdmin ? '••••••••' : 'Password'}
      >
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
        >
          {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.7} /> : <Eye className="h-5 w-5" strokeWidth={1.7} />}
        </button>
      </Field>
      <ErrorBanner message={displayError} />
      <SubmitButton loading={loading} idle={isAdmin ? 'Enter Operations' : 'Sign In'} busy="Signing In" />
    </form>
  );

  const passwordForm = (
    <form onSubmit={handlePasswordSubmit} className="space-y-4 md:space-y-3" noValidate>
      <Field
        id="login-pw-email"
        label="Email"
        type="email"
        value={email}
        onChange={(event) => { setEmail(event.target.value); setFieldError(''); }}
        autoComplete="email"
        placeholder={isAdmin ? 'you@avalonvitality.co' : 'you@email.com'}
      />
      <Field
        id="login-pw-password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(event) => { setPassword(event.target.value); setFieldError(''); }}
        autoComplete="current-password"
        placeholder="Your password"
      >
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
        >
          {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.7} /> : <Eye className="h-5 w-5" strokeWidth={1.7} />}
        </button>
      </Field>
      <ErrorBanner message={displayError} />
      <SubmitButton loading={loading} idle="Sign In" busy="Signing In" />
    </form>
  );

  const resetForm = resetSent ? (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/22 bg-emerald-500/[0.08] px-4 py-4 text-emerald-100">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
        <p className="font-body text-sm font-medium leading-relaxed">
          Check your inbox — we sent a password reset link to <span className="font-bold">{resetSent}</span>. Open it on this device to choose a new password.
        </p>
      </div>
      <button
        type="button"
        onClick={() => { setResetSent(''); setEmail(''); setView('methods'); }}
        className="inline-flex min-h-[44px] items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
      >
        Back to sign in
      </button>
    </div>
  ) : (
    <form onSubmit={handlePasswordReset} className="space-y-4 md:space-y-3" noValidate>
      <Field
        id="login-reset-email"
        label="Email"
        type="email"
        value={email}
        onChange={(event) => { setEmail(event.target.value); setFieldError(''); }}
        autoComplete="email"
        placeholder="you@avalonvitality.co"
      />
      <ErrorBanner message={displayError} />
      <SubmitButton loading={loading} idle="Send Reset Link" busy="Sending Link" />
    </form>
  );

  const patientMethodButtons = (
    <div className="grid grid-cols-2 gap-1.5 md:block md:space-y-2">
      {authProviderConfig.passkey && <MethodButton variant="primary" label="Continue With Passkey" busy={passkeyBusy} onClick={handlePasskey} icon={<Fingerprint className="h-4 w-4" strokeWidth={2} />} />}
      {authProviderConfig.google && <MethodButton label="Continue With Google" busy={oauthBusy === 'google'} onClick={() => handleOAuth('google')} icon={<GoogleMark />} />}
      {authProviderConfig.apple && <MethodButton label="Continue With Apple" busy={oauthBusy === 'apple'} onClick={() => handleOAuth('apple')} icon={<AppleMark />} />}
      {authProviderConfig.phone && <MethodButton label="Continue With Phone" onClick={() => { setView('phone'); setFieldError(''); }} icon={<Smartphone className="h-4 w-4" strokeWidth={2} />} />}
    </div>
  );

  let body;
  if (linkSent) {
    body = <InboxPanel address={linkSent} onReset={() => { setLinkSent(''); setEmail(''); setView('methods'); }} />;
  } else if (view === 'email') {
    body = (
      <div className="space-y-4 md:space-y-3">
        <BackRow label="All sign-in options" onClick={() => { setView('methods'); setFieldError(''); }} />
        {emailForm}
      </div>
    );
  } else if (view === 'phone') {
    body = (
      <div className="space-y-4 md:space-y-3">
        <BackRow label="All sign-in options" onClick={() => { setView('methods'); setOtpSent(false); setOtp(''); setFieldError(''); }} />
        {phoneForm}
      </div>
    );
  } else if (view === 'password') {
    body = (
      <div className="space-y-4 md:space-y-3">
        <BackRow label="All sign-in options" onClick={() => { setView('methods'); setPassword(''); setFieldError(''); }} />
        {passwordForm}
      </div>
    );
  } else if (view === 'reset') {
    body = (
      <div className="space-y-4 md:space-y-3">
        <BackRow label="All sign-in options" onClick={() => { setView('methods'); setResetSent(''); setFieldError(''); }} />
        {resetForm}
      </div>
    );
  } else if (isAdmin) {
    // Admin sign-in is deliberately just email + password — no magic link,
    // social, passkey, or operator-ID. Operations staff use their password
    // (Supabase signInWithPassword); the forgot-password reset stays for
    // lockout recovery.
    body = passwordForm;
  } else if (!supabaseMode) {
    // Offline beta keeps visible method choices while preserving the roster ID
    // sign-in as the working fallback.
    body = (
      <div className="space-y-3">
        {patientMethodButtons}
        <ErrorBanner message={displayError} />
        <Divider label="or client id" />
        {demoForm}
        <Divider />
        <button
          type="button"
          onClick={() => { setView('password'); setFieldError(''); }}
          className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-foreground/[0.12] bg-background/35 px-4 font-body text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/72 transition-colors hover:border-foreground/26 hover:text-foreground"
        >
          <span className="inline-flex items-center gap-2.5"><Mail className="h-4 w-4" strokeWidth={2} /> Login With Email</span>
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    );
  } else {
    // Patient, Supabase: email + password only. Passwordless methods (passkey,
    // Google/Apple, phone magic-link) are not in use right now, so the returning
    // tab shows the password form directly instead of a launchpad behind a
    // "Login With Email" click. The method-stack machinery (patientMethodButtons,
    // emailForm/phoneForm, view 'email'/'phone'/'password') stays defined so a
    // single line here re-enables it when those providers are turned on.
    body = passwordForm;
  }

  const footer = isAdmin ? (
    <div className="mt-4 grid gap-1.5 border-t border-foreground/[0.08] pt-3 md:mt-3 md:pt-3">
      <button
        type="button"
        onClick={() => { setView('reset'); setFieldError(''); setResetSent(''); }}
        className="inline-flex min-h-[32px] items-center justify-center rounded-full font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/42 transition-colors hover:text-foreground/72"
      >
        Reset staff password
      </button>
      <button
        type="button"
        onClick={() => switchAudience('patient')}
        className="inline-flex min-h-[32px] items-center justify-center rounded-full font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/42 transition-colors hover:text-foreground/72"
      >
        Customer sign-in instead
      </button>
    </div>
  ) : (
    <div className="mt-4 grid gap-1.5 border-t border-foreground/[0.08] pt-3 md:mt-3 md:pt-3">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {!isNew && (
          <button
            type="button"
            onClick={() => { setView('reset'); setFieldError(''); setResetSent(''); }}
            className="inline-flex min-h-[32px] items-center justify-center rounded-full font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/42 transition-colors hover:text-foreground/72"
          >
            Forgot? Email me a link
          </button>
        )}
        <a
          href="mailto:support@avalonvitality.co"
          className="inline-flex min-h-[32px] items-center justify-center rounded-full font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/42 transition-colors hover:text-foreground/72"
        >
          Need help?
        </a>
        <button
          type="button"
          onClick={() => switchAudience('admin')}
          className="inline-flex min-h-[32px] items-center justify-center rounded-full font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/42 transition-colors hover:text-foreground/72"
        >
          Avalon staff? Sign in
        </button>
      </div>
    </div>
  );

  return (
    // Top padding clears the fixed marketing navbar; scrollable so a tall card
    // is never clipped on short viewports.
    <div className="relative h-screen h-dvh overflow-y-auto px-3 py-2 text-foreground md:px-6 md:py-3">
      <main className="relative mx-auto grid min-h-full w-full max-w-5xl place-items-center pt-20 md:pt-24">
        {/* Card frame stays static — only the tab content below crossfades on
            selection. Top menu is global (MobileShell), so it never moves on a
            tab switch. */}
        <section className="flex min-h-[520px] w-full max-w-[340px] flex-col rounded-[1.5rem] border border-foreground/[0.12] bg-foreground/[0.045] p-4 shadow-[0_22px_90px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl sm:max-w-[360px] md:max-w-[360px] md:p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <Link
              to="/"
              aria-label="Avalon Vitality home"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center transition-opacity hover:opacity-70"
            >
              <AvalonMark className="h-10 w-[26px] text-foreground" />
            </Link>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045] text-foreground/72">
              {isAdmin ? <ShieldCheck className="h-4 w-4" strokeWidth={1.8} /> : isNurse ? <Stethoscope className="h-4 w-4" strokeWidth={1.8} /> : isNew ? <UserPlus className="h-4 w-4" strokeWidth={1.8} /> : <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />}
            </span>
          </div>

          {!isAdmin && (
            <div className="mb-3">
              <SegmentedToggle
                options={[
                  { key: 'returning', label: 'Returning' },
                  { key: 'new', label: 'New' },
                  { key: 'nurse', label: 'Nurse' },
                ]}
                value={mode}
                onChange={switchMode}
              />
            </div>
          )}

          {/* Heading + body crossfade together on every tab/view switch; keyed
              only on audience/mode/view so it never remounts mid-form (no focus
              loss while typing an OTP). initial={false} avoids a double-fade on
              first mount — the card itself already fades in above. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${audience}-${mode}-${view}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="flex-1"
            >
              <div className="mb-3">
                <h1 className="font-heading text-[1.9rem] uppercase leading-[0.86] tracking-tight text-foreground md:text-[1.65rem]">
                  {heading[0]} {heading[1]}
                </h1>
                {supabaseMode && isAdmin && (
                  <p className="mt-3 font-body text-sm font-medium leading-relaxed text-foreground/55 md:mt-2">
                    Sign in with your staff email and password.
                  </p>
                )}
              </div>

              {isNew ? <NewCustomerPanel showHeading={false} bordered={false} embedded /> : isNurse ? nursePanel : body}
            </motion.div>
          </AnimatePresence>
          {footer}
        </section>
      </main>
    </div>
  );
}
