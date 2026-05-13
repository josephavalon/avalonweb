import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

import SocialLinks from './SocialLinks';

export default function WaitlistSection() {
  const [form, setForm] = useState({ email: '', website: '' });
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setErrorMsg('');

    const email = form.email.trim();
    if (!email) {
      setErrorMsg('Please enter your email.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          website: form.website, // honeypot
          source: 'home-waitlist',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  return (
    <section
      id="waitlist"
      className="scroll-mt-20 md:scroll-mt-28 pt-6 pb-16 md:pt-8 md:pb-20 px-4"
    >
      <div className="max-w-6xl mx-auto text-left">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4"
        >
          Not Ready to Apply?
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="font-heading text-foreground tracking-wide mb-4 md:whitespace-nowrap text-[10vw] md:text-7xl lg:text-8xl"
        >
          STAY IN THE LOOP
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="font-body text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed mb-3"
        >
          Be first when we launch.
        </motion.p>

        <div className="mb-8" />

        {status === 'success' ? (
          <motion.div
            key="success-state"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-3 px-8 py-6 border border-accent/40 bg-accent/5 rounded-3xl max-w-md mx-auto"
          >
            <div className="flex items-center gap-3">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-background"
                aria-hidden="true"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <motion.path
                    d="M3.5 8.3 L6.8 11.5 L12.6 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
                  />
                </svg>
              </motion.span>
              <span className="font-body text-sm md:text-base text-foreground">
                You're on the list.
              </span>
            </div>
            <svg width="220" height="14" viewBox="0 0 220 14" className="mt-1" aria-hidden="true">
              <motion.path
                d="M 6 9 C 40 3, 92 14, 140 7 S 200 10, 214 7"
                stroke="hsl(var(--accent))"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.45, ease: EASE }}
              />
            </svg>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.3, ease: EASE }}
              className="font-body text-xs tracking-wide text-muted-foreground"
            >
              We'll review within 48 hours and reach out with launch details. Check your inbox for confirmation.
            </motion.span>
          </motion.div>
        ) : (
          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="max-w-xl mx-auto"
            noValidate
          >
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <label htmlFor="waitlist-email" className="sr-only">Email address</label>
              <input
                id="waitlist-email"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="flex-1 bg-transparent border border-foreground/30 rounded-full px-5 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
              />
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="px-8 py-3 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'submitting' ? 'Joining…' : 'Join Waitlist'}
              </button>
            </div>
            {/* Honeypot */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '-10000px',
                top: 'auto',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
              }}
            >
              <label htmlFor="waitlist-website">Website (leave blank)</label>
              <input
                id="waitlist-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>


            {status === 'error' && errorMsg && (
              <p
                role="alert"
                aria-live="assertive"
                className="mt-3 font-body text-xs text-destructive"
              >
                {errorMsg}
              </p>
            )}

            <p className="mt-4 font-body text-xs text-muted-foreground leading-relaxed">
              By joining, you agree to receive occasional updates from Avalon Vitality.
              Unsubscribe any time.
            </p>
          </motion.form>
        )}

        <SocialLinks />
      </div>
    </section>
  );
}
