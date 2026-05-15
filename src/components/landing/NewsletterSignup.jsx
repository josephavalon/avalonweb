import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || status === 'submitting') return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'newsletter-signup' }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="py-16 md:py-20 px-6 md:px-16">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl mx-auto border border-foreground/10 bg-white/[0.04] backdrop-blur-md rounded-3xl p-8 md:p-12"
      >
        <h2 className="font-heading text-2xl md:text-3xl text-foreground tracking-wide mb-8 text-center">
          SIGN UP FOR EXCLUSIVE EVENTS & UPDATES
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 justify-center">
          <input
            type="email"
            placeholder="ENTER YOUR EMAIL"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 bg-transparent border border-foreground/30 rounded-full px-6 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="px-10 py-3.5 bg-foreground text-background font-body text-sm tracking-widest uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors whitespace-nowrap disabled:opacity-60"
          >
            {status === 'submitting' ? 'Joining…' : status === 'success' ? 'You\'re in.' : status === 'error' ? 'Try again' : 'Submit'}
          </button>
        </form>
      </motion.div>
    </section>
  );
}