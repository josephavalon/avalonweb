import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { AnimatePresence, motion } from '@/components/ui/PageTransitionMotion';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';

const EASE = [0.16, 1, 0.3, 1];

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

export default function ForgotPassword() {
  useSeo({
    title: 'Reset Password - Avalon Vitality',
    description: 'Request a secure Avalon Vitality password reset link.',
    path: '/forgot',
  });

  const { requestPasswordReset, loading, error, authBackend } = useAuthStore();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFieldError('Enter your email address.');
      return;
    }
    if (authBackend !== 'supabase') {
      setFieldError('Email sign-in links are available once Supabase is configured. Contact Avalon for help.');
      return;
    }
    const result = await requestPasswordReset(cleanEmail);
    if (result.ok) setSentTo(cleanEmail);
    else setFieldError(result.error || 'Could not send the reset link.');
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
              <MailCheck className="h-4 w-4" strokeWidth={1.8} />
            </span>
          </div>

          <div className="mb-7">
            <h1 className="font-heading text-[3.15rem] uppercase leading-[0.86] tracking-tight text-foreground sm:text-[4rem]">
              Reset<br />Password
            </h1>
            <p className="mt-3 font-body text-sm font-medium leading-relaxed text-foreground/62">
              Forgot it happens. Drop your email and we'll send a one-time reset link. Open it on the same device you'll sign in from so your session sticks.
            </p>
          </div>

          {sentTo ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/22 bg-emerald-500/[0.08] px-4 py-4 text-emerald-100">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
                <p className="font-body text-sm font-medium leading-relaxed">
                  Sent. Check the inbox for <span className="font-bold">{sentTo}</span> — the link lands within a minute and expires after an hour. Spam folder if it's not there.
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
              <div className="space-y-2">
                <label htmlFor="forgot-email" className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58">
                  Email
                </label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setFieldError(''); }}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@email.com"
                  className="min-h-[58px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-5 py-4 font-body text-[17px] font-semibold text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] outline-none backdrop-blur-xl transition-colors placeholder:text-foreground/25 focus:border-foreground/42 focus:bg-foreground/[0.07]"
                />
              </div>
              <ErrorBanner message={displayError} />
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.985 }}
                className="flex min-h-[62px] w-full items-center justify-between rounded-full bg-foreground px-6 font-body text-sm font-bold uppercase tracking-[0.22em] text-background transition-colors hover:bg-foreground/88 disabled:cursor-wait disabled:opacity-45"
              >
                <span>{loading ? 'Sending Link' : 'Send Reset Link'}</span>
                {loading ? (
                  <span className="h-5 w-5 rounded-full border-2 border-background/25 border-t-background animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5" strokeWidth={2} />
                )}
              </motion.button>
            </form>
          )}

          <div className="mt-6 border-t border-foreground/[0.08] pt-5">
            <Link
              to="/login"
              className="inline-flex min-h-[44px] items-center gap-2 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Back to sign in
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
