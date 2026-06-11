import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Fingerprint, LockKeyhole, Mail, MailCheck, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from '@/components/ui/PageTransitionMotion';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';

const EASE = [0.16, 1, 0.3, 1];

function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete, children }) {
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
          autoCapitalize="none"
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

export default function Login() {
  useSeo({
    title: 'Client Sign In - Avalon Vitality',
    description: 'Client sign in for Avalon Vitality visits, preparation, and support.',
    path: '/login',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user, signIn, signInWithEmail, signInWithPhone, verifyPhoneOtp, signInWithPasskey,
    authBackend, loading, error,
  } = useAuthStore();
  const supabaseMode = authBackend === 'supabase';
  const [method, setMethod] = useState('email'); // 'email' | 'phone'
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [linkSent, setLinkSent] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    try {
      applyTheme();
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[login-theme]', err);
    }
  }, []);

  const destinationFor = (sessionUser) => {
    const requested = searchParams.get('redirect');
    const localPath = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : '';
    if (localPath && sessionUser?.role === 'client') return localPath;
    return sessionUser?.redirect || '/members/dashboard';
  };

  // Once a session exists, leave the login page. Covers both the magic-link
  // return (Supabase sets the session async) and demo sign-in.
  useEffect(() => {
    if (user) navigate(destinationFor(user), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    setLinkSent('');

    if (!clientId.trim()) {
      setFieldError(supabaseMode ? 'Enter your email address.' : 'Enter your client ID or email.');
      return;
    }

    if (supabaseMode) {
      const result = await signInWithEmail(clientId.trim());
      if (result.ok) setLinkSent(clientId.trim());
      else setFieldError(result.error || 'Could not send the sign-in link.');
      return;
    }

    if (!password) {
      setFieldError('Enter your password.');
      return;
    }
    const result = await signIn({ email: clientId.trim(), password });
    if (result.ok && result.user) navigate(destinationFor(result.user), { replace: true });
  };

  // Phone OTP: first submit sends the code, second submit verifies it.
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
    // success → the user effect redirects
  };

  const handlePasskey = async () => {
    setFieldError('');
    setPasskeyBusy(true);
    const result = await signInWithPasskey();
    setPasskeyBusy(false);
    if (!result.ok) setFieldError(result.error || 'Passkey sign-in failed.');
    // success → the user effect redirects
  };

  const displayError = fieldError || error;

  return (
    <div className="relative min-h-screen min-h-dvh overflow-hidden bg-background px-4 py-4 text-foreground md:px-8 md:py-8">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--foreground)/0.10),transparent_30%),linear-gradient(180deg,hsl(var(--foreground)/0.035),transparent_42%)]" />
      </div>

      <main className="relative mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-5xl place-items-center">
        <section className="w-full max-w-[440px] rounded-[2rem] border border-foreground/[0.12] bg-foreground/[0.045] p-5 shadow-[0_28px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl sm:p-7">
          <div className="mb-7 flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex min-h-11 flex-col justify-center leading-none transition-opacity hover:opacity-70">
              <span className="block font-heading text-[19px] leading-none tracking-[0.24em] text-foreground">AVALON</span>
              <span className="mt-1 block font-body text-[8px] uppercase tracking-[0.38em] text-foreground/58">VITALITY</span>
            </Link>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045] text-foreground/72">
              <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />
            </span>
          </div>

          <div className="mb-7">
            <h1 className="font-heading text-[3.15rem] uppercase leading-[0.86] tracking-tight text-foreground sm:text-[4rem]">
              Client<br />Sign In
            </h1>
            {supabaseMode && (
              <p className="mt-3 font-body text-sm font-medium leading-relaxed text-foreground/55">
                Passwordless sign-in — a magic link, a text code, or your passkey.
              </p>
            )}
          </div>

          {linkSent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/22 bg-emerald-500/[0.08] px-4 py-4 text-emerald-100">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
                <p className="font-body text-sm font-medium leading-relaxed">
                  Check your inbox — we sent a secure sign-in link to <span className="font-bold">{linkSent}</span>. Open it on this device to finish signing in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setLinkSent(''); setClientId(''); }}
                className="inline-flex min-h-[44px] items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          ) : supabaseMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1 rounded-full border border-foreground/[0.12] bg-foreground/[0.04] p-1">
                {[['email', 'Email', Mail], ['phone', 'Phone', Smartphone]].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setMethod(key); setFieldError(''); }}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-full font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${method === key ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground'}`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    {label}
                  </button>
                ))}
              </div>

              {method === 'email' ? (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <Field
                    id="client-id"
                    label="Email"
                    type="email"
                    value={clientId}
                    onChange={(event) => { setClientId(event.target.value); setFieldError(''); }}
                    autoComplete="email"
                    placeholder="you@email.com"
                  />
                  <ErrorBanner message={displayError} />
                  <SubmitButton loading={loading} idle="Email Me A Link" busy="Sending Link" />
                </form>
              ) : (
                <form onSubmit={handlePhone} className="space-y-4" noValidate>
                  <Field
                    id="client-phone"
                    label="Phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => { setPhone(event.target.value); setFieldError(''); }}
                    autoComplete="tel"
                    placeholder="+1 (415) 555-0199"
                  />
                  {otpSent && (
                    <Field
                      id="client-otp"
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
              )}

              <div className="flex items-center gap-3 py-0.5">
                <span className="h-px flex-1 bg-foreground/10" />
                <span className="font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">or</span>
                <span className="h-px flex-1 bg-foreground/10" />
              </div>

              <button
                type="button"
                onClick={handlePasskey}
                disabled={passkeyBusy}
                className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full border border-foreground/[0.16] bg-foreground/[0.04] font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-foreground/[0.08] disabled:cursor-wait disabled:opacity-50"
              >
                {passkeyBusy ? (
                  <span className="h-4 w-4 rounded-full border-2 border-foreground/25 border-t-foreground animate-spin" />
                ) : (
                  <Fingerprint className="h-4 w-4" strokeWidth={2} />
                )}
                Sign in with a passkey
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field
                id="client-id"
                label="Client ID or Email"
                type="text"
                value={clientId}
                onChange={(event) => { setClientId(event.target.value); setFieldError(''); }}
                autoComplete="username"
                placeholder="CLIENT0001"
              />
              <Field
                id="client-password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setFieldError(''); }}
                autoComplete="current-password"
                placeholder="Password"
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
          )}

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
        </section>
      </main>
    </div>
  );
}
