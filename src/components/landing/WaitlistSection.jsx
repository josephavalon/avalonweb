import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

export default function WaitlistSection() {
  const [form, setForm] = useState({ firstName: '', email: '', website: '' });
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
          firstName: form.firstName.trim(),
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
      className="scroll-mt-20 md:scroll-mt-28 py-12 md:py-16 px-4 border-t border-border"
    >
      <div className="max-w-3xl mx-auto text-left">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4"
        >
          Not Ready to Apply?
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide mb-4 md:whitespace-nowrap"
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
          Presale updates, launch details, and early access to new protocols.
        </motion.p>

        <div className="mb-8" />

        {status === 'success' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-3 px-6 py-4 border border-accent/40 bg-accent/5 rounded-md"
          >
            <Check className="w-4 h-4 text-accent shrink-0" strokeWidth={2.5} aria-hidden="true" />
            <span className="font-body text-sm text-foreground">
              You're on the list. Check your inbox for confirmation.
            </span>
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

            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="waitlist-firstName" className="sr-only">First name (optional)</label>
              <input
                id="waitlist-firstName"
                type="text"
                name="firstName"
                autoComplete="given-name"
                placeholder="First name (optional)"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                disabled={status === 'submitting'}
                className="flex-1 sm:max-w-[40%] bg-transparent border border-border rounded-md px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground transition-colors disabled:opacity-50"
              />
              <label htmlFor="waitlist-email" className="sr-only">Email address</label>
              <input
                id="waitlist-email"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={status === 'submitting'}
                className="flex-1 bg-transparent border border-border rounded-full px-5 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="inline-flex items-center justify-center gap-2 bg-foreground text-background font-body text-[11px] tracking-widest uppercase font-semibold px-6 py-3 rounded-full hover:bg-foreground/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Joining</span>
                  </>
                ) : (
                  <span>Join Waitlist</span>
                )}
              </button>
            </div>

            {status === 'error' && errorMsg && (
              <p
                role="alert"
                className="mt-3 font-body text-[11px] text-destructive"
              >
                {errorMsg}
              </p>
            )}

            <p className="mt-4 font-body text-[10px] text-muted-foreground/80 leading-relaxed">
              By joining, you agree to receive occasional updates from Avalon Vitality.
              Unsubscribe any time.
            </p>
          </motion.form>
        )}
      </div>
    </section>
  );
}
