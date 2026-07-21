import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, MailCheck, RefreshCw, UserPlus } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { AnimatePresence, motion } from '@/components/ui/PageTransitionMotion';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';
import NewCustomerPanel from '@/components/auth/NewCustomerPanel';
import { authProviderConfig, socialAuthEnabled } from '@/lib/authProviderConfig';
import { newCustomerDestinationForUser } from '@/lib/portalAccess';

const EASE = [0.16, 1, 0.3, 1];

function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58">
        {label}
      </label>
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

function SocialButton({ icon, label, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex min-h-[54px] w-full items-center justify-center gap-3 rounded-full border border-foreground/[0.16] bg-foreground/[0.04] font-body text-xs font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-foreground/[0.08] disabled:cursor-wait disabled:opacity-50"
    >
      {busy ? <span className="h-4 w-4 rounded-full border-2 border-foreground/25 border-t-foreground animate-spin" /> : icon}
      {label}
    </button>
  );
}

function Divider({ label = 'or' }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-foreground/10" />
      <span className="font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{label}</span>
      <span className="h-px flex-1 bg-foreground/10" />
    </div>
  );
}

export default function Signup() {
  useSeo({
    title: 'Create Account — Avalon Vitality',
    description: 'Create your Avalon Vitality client account.',
    path: '/signup',
  });

  const navigate = useNavigate();
  const { user, signUpWithEmail, signInWithOAuth, resendConfirmationEmail, authBackend, loading, error } = useAuthStore();
  const supabaseMode = authBackend === 'supabase';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [oauthBusy, setOauthBusy] = useState('');
  // Resend-confirmation state for the "check your email" screen.
  const [resendBusy, setResendBusy] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);

  // Referral capture: a `?ref=<code>` in the landing URL means the visitor
  // came via someone's share link. We stash the code in localStorage so it
  // survives the email-confirmation round-trip; the Dashboard posts it to
  // /api/me/redeem-referral on first authed load to record the attribution.
  // Idempotent on the server (unique on referee_profile_id) so a stale code
  // can only ever attribute once.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('ref');
      if (!raw) return;
      const code = raw.trim().toUpperCase().slice(0, 32);
      if (!code) return;
      window.localStorage.setItem('avalon.referralCode', code);
    } catch { /* localStorage may be unavailable (private mode) — referrals are best-effort */ }
  }, []);

  useEffect(() => {
    if (user) navigate(newCustomerDestinationForUser(user), { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    if (!supabaseMode) {
      setFieldError('Sign-up is temporarily unavailable. Please try again shortly or contact support@avalonvitality.co.');
      return;
    }
    if (!fullName.trim()) { setFieldError('Enter your full name.'); return; }
    if (!email.trim())    { setFieldError('Enter your email address.'); return; }
    const result = await signUpWithEmail({ email: email.trim(), fullName: fullName.trim(), phone: phone.trim() });
    if (result.ok) setSentTo(email.trim());
    else setFieldError(result.error || 'Could not create your account.');
  };

  const handleOAuth = async (provider) => {
    setFieldError('');
    if (!supabaseMode) {
      setFieldError('Sign-up is temporarily unavailable. Please try again shortly.');
      return;
    }
    if (!authProviderConfig[provider]) {
      setFieldError(`${provider === 'apple' ? 'Apple' : 'Google'} sign-up is not enabled for this environment.`);
      return;
    }
    setOauthBusy(provider);
    const result = await signInWithOAuth(provider);
    if (!result.ok) {
      setOauthBusy('');
      setFieldError(result.error || 'Could not start social sign-up.');
    }
  };

  const handleResend = async () => {
    setResendError('');
    setResendDone(false);
    setResendBusy(true);
    const result = await resendConfirmationEmail(sentTo);
    setResendBusy(false);
    if (result.ok) setResendDone(true);
    else setResendError(result.error || 'Could not resend the confirmation email.');
  };

  const displayError = fieldError || error;

  return (
    <div className="relative h-screen h-dvh overflow-y-auto px-3 py-2 text-foreground md:px-6 md:py-3">
      <main className="relative mx-auto grid min-h-full w-full max-w-5xl place-items-center pt-20 md:pt-24">
        <section className="w-full max-w-[440px] rounded-[2rem] border border-foreground/[0.12] bg-foreground/[0.045] p-5 shadow-[0_28px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl sm:p-7">
          <div className="mb-7 flex items-center justify-between gap-4">
            {/* Audit finding K1: match login's drop-mark chip so both auth
                surfaces share one eyebrow treatment. */}
            <Link to="/" className="av-icon-chip transition-opacity hover:opacity-70" aria-label="Avalon Vitality">
              <AvalonMark className="h-6 w-4 text-foreground" />
            </Link>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045] text-foreground/72">
              <UserPlus className="h-4 w-4" strokeWidth={1.8} />
            </span>
          </div>

          <div className="mb-7">
            <h1 className="font-heading text-display uppercase leading-[0.86] tracking-tight text-foreground [text-wrap:balance]">
              Create Account
            </h1>
            <p className="mt-3 font-body text-sm font-medium leading-relaxed text-foreground/55">
              We email a confirmation link — no password to remember.
            </p>
          </div>

          {sentTo ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/22 bg-emerald-500/[0.08] px-4 py-4 text-emerald-100">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
                <div className="space-y-1.5">
                  <p className="font-body text-sm font-bold uppercase tracking-[0.14em] text-emerald-50">
                    Check your email to confirm your account
                  </p>
                  <p className="font-body text-sm font-medium leading-relaxed">
                    We sent a confirmation link to <span className="font-bold">{sentTo}</span>. Open it to verify your address and finish setting up your account.
                  </p>
                </div>
              </div>

              <p className="font-body text-[11px] font-medium leading-relaxed text-foreground/45">
                Didn’t get it? Check your spam folder. The link can expire — if it’s been a while, send a fresh one below.
              </p>

              {resendError ? <ErrorBanner message={resendError} /> : null}

              <button
                type="button"
                onClick={handleResend}
                disabled={resendBusy}
                className="flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-full border border-foreground/[0.16] bg-foreground/[0.04] font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-foreground/[0.08] disabled:cursor-wait disabled:opacity-60"
              >
                {resendBusy ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-foreground/25 border-t-foreground animate-spin" />
                    Sending
                  </>
                ) : resendDone ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-300" strokeWidth={2.4} />
                    Sent ✓
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" strokeWidth={2} />
                    Resend confirmation email
                  </>
                )}
              </button>

              <Link
                to="/login"
                className="inline-flex min-h-[44px] items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {socialAuthEnabled && (
                <>
                  <div className="space-y-3">
                    {authProviderConfig.google && <SocialButton label="Continue With Google" busy={oauthBusy === 'google'} onClick={() => handleOAuth('google')} icon={<GoogleMark />} />}
                    {authProviderConfig.apple && <SocialButton label="Continue With Apple" busy={oauthBusy === 'apple'} onClick={() => handleOAuth('apple')} icon={<AppleMark />} />}
                  </div>
                  <Divider />
                </>
              )}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Field id="signup-name"  label="Full name" type="text"  value={fullName} onChange={(e) => { setFullName(e.target.value); setFieldError(''); }} autoComplete="name"  placeholder="Your name" />
                <Field id="signup-email" label="Email"     type="email" value={email}    onChange={(e) => { setEmail(e.target.value); setFieldError(''); }}    autoComplete="email" placeholder="you@email.com" />
                <Field id="signup-phone" label="Phone (optional)" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setFieldError(''); }}  autoComplete="tel"   placeholder="+1 (415) 555-0199" />
                <ErrorBanner message={displayError} />
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.985 }}
                  className="flex min-h-[62px] w-full items-center justify-between rounded-full bg-foreground px-6 font-body text-sm font-bold uppercase tracking-[0.22em] text-background transition-colors hover:bg-foreground/88 disabled:cursor-wait disabled:opacity-45"
                >
                  <span>{loading ? 'Creating Account' : 'Create Account'}</span>
                  {loading ? (
                    <span className="h-5 w-5 rounded-full border-2 border-background/25 border-t-background animate-spin" />
                  ) : (
                    <ArrowRight className="h-5 w-5" strokeWidth={2} />
                  )}
                </motion.button>
              </form>
            </div>
          )}

          <div className="mt-6 grid gap-3 border-t border-foreground/[0.08] pt-5">
            <Link
              to="/login"
              className="flex min-h-[54px] items-center justify-between rounded-2xl border border-foreground/[0.12] bg-background/35 px-5 font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground/72 transition-colors hover:border-foreground/26 hover:text-foreground"
            >
              <span>Already a member? Sign In</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <a
              href="mailto:support@avalonvitality.co"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/42 transition-colors hover:text-foreground/72"
            >
              Need help getting started?
            </a>
          </div>
          {!sentTo && <NewCustomerPanel showCta={false} showHeading={false} />}
        </section>
      </main>
    </div>
  );
}
