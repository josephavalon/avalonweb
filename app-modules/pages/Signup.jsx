import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, LockKeyhole, MailCheck, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from '@/components/ui/PageTransitionMotion';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';

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

export default function Signup() {
  useSeo({
    title: 'Create Account - Avalon Vitality',
    description: 'Create your Avalon Vitality client account.',
    path: '/signup',
  });

  const navigate = useNavigate();
  const { user, signUpWithEmail, authBackend, loading, error } = useAuthStore();
  const supabaseMode = authBackend === 'supabase';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);

  useEffect(() => {
    if (user) navigate(user.redirect || '/members/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    if (!supabaseMode) {
      setFieldError('Account creation is available once Supabase is configured. Use the demo sign-in for now.');
      return;
    }
    if (!fullName.trim()) { setFieldError('Enter your full name.'); return; }
    if (!email.trim())    { setFieldError('Enter your email address.'); return; }
    const result = await signUpWithEmail({ email: email.trim(), fullName: fullName.trim(), phone: phone.trim() });
    if (result.ok) setSentTo(email.trim());
    else setFieldError(result.error || 'Could not create your account.');
  };

  const displayError = fieldError || error;

  return (
    <div className="av-page-surface relative min-h-screen min-h-dvh overflow-hidden px-4 py-4 text-foreground md:px-8 md:py-8">
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
              <UserPlus className="h-4 w-4" strokeWidth={1.8} />
            </span>
          </div>

          <div className="mb-7">
            <h1 className="font-heading text-[3.15rem] uppercase leading-[0.86] tracking-tight text-foreground sm:text-[4rem]">
              Create<br />Account
            </h1>
            <p className="mt-3 font-body text-sm font-medium leading-relaxed text-foreground/55">
              {supabaseMode
                ? 'We email a confirmation link — no password to remember.'
                : 'Account creation comes online when Supabase keys are set.'}
            </p>
          </div>

          {sentTo ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/22 bg-emerald-500/[0.08] px-4 py-4 text-emerald-100">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
                <p className="font-body text-sm font-medium leading-relaxed">
                  Account requested — we sent a confirmation link to <span className="font-bold">{sentTo}</span>. Open it on this device to finish.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex min-h-[44px] items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
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
        </section>
      </main>
    </div>
  );
}
