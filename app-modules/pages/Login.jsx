import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, ChevronRight, Eye, EyeOff, Fingerprint,
  LockKeyhole, Mail, MailCheck, ShieldCheck, Smartphone,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/components/ui/PageTransitionMotion';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';

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
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 5.9 12 5.9c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c5.3 0 8.8-3.7 8.8-8.9 0-.6-.06-1-.15-1.5H12z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-foreground" aria-hidden="true">
      <path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.15-2.8.85-3.5.85-.72 0-1.85-.83-3.05-.8-1.57.02-3 .9-3.82 2.3-1.63 2.83-.42 7 1.16 9.3.77 1.12 1.69 2.38 2.9 2.34 1.16-.05 1.6-.75 3-.75s1.8.75 3.03.72c1.25-.02 2.04-1.14 2.8-2.27.88-1.3 1.24-2.56 1.26-2.62-.03-.01-2.42-.93-2.45-3.68zM14.2 5.9c.64-.78 1.07-1.86.95-2.94-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.08-.52 2.72-1.3z" />
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
          className="min-h-[58px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-5 py-4 font-body text-[17px] font-semibold text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] outline-none backdrop-blur-xl transition-colors placeholder:text-foreground/25 focus:border-foreground/42 focus:bg-foreground/[0.07]"
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
      className="flex min-h-[62px] w-full items-center justify-between rounded-full bg-foreground px-6 font-body text-sm font-bold uppercase tracking-[0.22em] text-background transition-colors hover:bg-foreground/88 disabled:cursor-wait disabled:opacity-45"
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
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-full font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${value === key ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground'}`}
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
      className={`flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full font-body text-xs font-bold uppercase tracking-[0.18em] transition-colors disabled:cursor-wait disabled:opacity-50 ${styles}`}
    >
      {busy ? <span className={`h-4 w-4 rounded-full border-2 ${spinner} animate-spin`} /> : icon}
      {label}
    </button>
  );
}

function Divider({ label = 'or' }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
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
      className="inline-flex min-h-[44px] items-center gap-2 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
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
    signInWithOAuth, signOut, authBackend, loading, error,
  } = useAuthStore();
  const supabaseMode = authBackend === 'supabase';

  const [audience, setAudience] = useState(defaultAudience === 'admin' ? 'admin' : 'patient');
  const isAdmin = audience === 'admin';

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
    setView('methods');
    setFieldError('');
    setLinkSent('');
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
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        setFieldError('This account is not an Avalon admin. Sign out and try the customer sign-in.');
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

  // Phone OTP: first submit sends the code, second verifies it.
  const handlePhone = async (event) => {
    event.preventDefault();
    setFieldError('');
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
    setPasskeyBusy(true);
    const result = await signInWithPasskey();
    setPasskeyBusy(false);
    if (!result.ok) setFieldError(result.error || 'Passkey sign-in failed.');
  };

  const handleOAuth = async (provider) => {
    setFieldError('');
    setOauthBusy(provider);
    const result = await signInWithOAuth(provider);
    // On success Supabase redirects to the provider; on failure, surface it.
    if (!result.ok) { setOauthBusy(''); setFieldError(result.error || 'Could not start social sign-in.'); }
  };

  const displayError = fieldError || error;
  const heading = isAdmin ? ['Admin', 'Sign In'] : ['Welcome', 'Back'];

  const emailForm = (
    <form onSubmit={handleEmailLink} className="space-y-4" noValidate>
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
    <form onSubmit={handlePhone} className="space-y-4" noValidate>
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
    <form onSubmit={handleDemoSubmit} className="space-y-4" noValidate>
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

  let body;
  if (linkSent) {
    body = <InboxPanel address={linkSent} onReset={() => { setLinkSent(''); setEmail(''); setView('methods'); }} />;
  } else if (!supabaseMode) {
    // Offline beta: ID + password only (no live passwordless backend).
    body = demoForm;
  } else if (view === 'email') {
    body = (
      <div className="space-y-4">
        <BackRow label="All sign-in options" onClick={() => { setView('methods'); setFieldError(''); }} />
        {emailForm}
      </div>
    );
  } else if (view === 'phone') {
    body = (
      <div className="space-y-4">
        <BackRow label="All sign-in options" onClick={() => { setView('methods'); setOtpSent(false); setOtp(''); setFieldError(''); }} />
        {phoneForm}
      </div>
    );
  } else if (isAdmin) {
    // Admin, Supabase: operations-only — passkey + email link, no social.
    body = (
      <div className="space-y-4">
        <MethodButton variant="primary" label="Continue With Passkey" busy={passkeyBusy} onClick={handlePasskey} icon={<Fingerprint className="h-4 w-4" strokeWidth={2} />} />
        <Divider />
        {emailForm}
      </div>
    );
  } else {
    // Patient, Supabase: full passwordless method stack.
    body = (
      <div className="space-y-3">
        <MethodButton variant="primary" label="Continue With Passkey" busy={passkeyBusy} onClick={handlePasskey} icon={<Fingerprint className="h-4 w-4" strokeWidth={2} />} />
        <MethodButton label="Continue With Google" busy={oauthBusy === 'google'} onClick={() => handleOAuth('google')} icon={<GoogleMark />} />
        <MethodButton label="Continue With Apple" busy={oauthBusy === 'apple'} onClick={() => handleOAuth('apple')} icon={<AppleMark />} />
        <MethodButton label="Continue With Phone" onClick={() => { setView('phone'); setFieldError(''); }} icon={<Smartphone className="h-4 w-4" strokeWidth={2} />} />
        <ErrorBanner message={displayError} />
        <Divider />
        <button
          type="button"
          onClick={() => { setView('email'); setFieldError(''); }}
          className="flex min-h-[54px] w-full items-center justify-between rounded-2xl border border-foreground/[0.12] bg-background/35 px-5 font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground/72 transition-colors hover:border-foreground/26 hover:text-foreground"
        >
          <span className="inline-flex items-center gap-2.5"><Mail className="h-4 w-4" strokeWidth={2} /> Email Me A Link</span>
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

  const footer = isAdmin ? (
    <div className="mt-6 grid gap-3 border-t border-foreground/[0.08] pt-5">
      <button
        type="button"
        onClick={() => switchAudience('patient')}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/42 transition-colors hover:text-foreground/72"
      >
        Customer sign-in instead
      </button>
    </div>
  ) : (
    <div className="mt-6 grid gap-3 border-t border-foreground/[0.08] pt-5">
      <Link
        to="/signup"
        className="flex min-h-[54px] items-center justify-between rounded-2xl border border-foreground/[0.12] bg-background/35 px-5 font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground/72 transition-colors hover:border-foreground/26 hover:text-foreground"
      >
        <span>Create Account</span>
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </Link>
      <Link
        to="/book"
        className="flex min-h-[54px] items-center justify-between rounded-2xl border border-foreground/[0.12] bg-background/35 px-5 font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground/72 transition-colors hover:border-foreground/26 hover:text-foreground"
      >
        <span>Book A Visit</span>
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </Link>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link
          to="/forgot"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/42 transition-colors hover:text-foreground/72"
        >
          Forgot? Email me a link
        </Link>
        <a
          href="mailto:support@avalonvitality.co"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/42 transition-colors hover:text-foreground/72"
        >
          Need help?
        </a>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen min-h-dvh overflow-hidden bg-background px-4 py-4 text-foreground md:px-8 md:py-8">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--foreground)/0.10),transparent_30%),linear-gradient(180deg,hsl(var(--foreground)/0.035),transparent_42%)]" />
      </div>

      <main className="relative mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-5xl place-items-center">
        <section className="w-full max-w-[440px] rounded-[2rem] border border-foreground/[0.12] bg-foreground/[0.045] p-5 shadow-[0_28px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex min-h-11 flex-col justify-center leading-none transition-opacity hover:opacity-70">
              <span className="block font-heading text-[19px] leading-none tracking-[0.24em] text-foreground">AVALON</span>
              <span className="mt-1 block font-body text-[8px] uppercase tracking-[0.38em] text-foreground/58">
                {isAdmin ? 'OPERATIONS' : 'VITALITY'}
              </span>
            </Link>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045] text-foreground/72">
              {isAdmin ? <ShieldCheck className="h-4 w-4" strokeWidth={1.8} /> : <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />}
            </span>
          </div>

          <div className="mb-5">
            <SegmentedToggle
              options={[{ key: 'patient', label: 'Patient' }, { key: 'admin', label: 'Admin' }]}
              value={audience}
              onChange={switchAudience}
            />
          </div>

          <div className="mb-6">
            <h1 className="font-heading text-[3.15rem] uppercase leading-[0.86] tracking-tight text-foreground sm:text-[3.6rem]">
              {heading[0]}<br />{heading[1]}
            </h1>
            {supabaseMode && (
              <p className="mt-3 font-body text-sm font-medium leading-relaxed text-foreground/55">
                {isAdmin
                  ? 'Operations-only. Use your passkey or a secure email link.'
                  : 'Passwordless — a passkey, a magic link, or your phone.'}
              </p>
            )}
          </div>

          {body}
          {footer}
        </section>
      </main>
    </div>
  );
}
