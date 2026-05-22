import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Mail } from 'lucide-react';
import { useSeo } from '@/lib/seo';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const EASE = [0.16, 1, 0.3, 1];

export default function Newsletter() {
  useSeo({
    title: 'Early Access — Avalon Vitality',
    description: 'Sign up for early access, launch updates, and subscriber exclusives from Avalon Vitality in the SF Bay Area.',
    path: '/newsletter',
  });

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    // Save to localStorage until backend is wired
    try {
      const existing = JSON.parse(localStorage.getItem('avalon.waitlist') || '[]');
      if (!existing.includes(email)) {
        existing.push(email);
        localStorage.setItem('avalon.waitlist', JSON.stringify(existing));
      }
    } catch {}
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar showBack />
      <div className="flex min-h-screen items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <div className="mb-2 flex items-center justify-center w-11 h-11 rounded-xl border border-foreground/10 bg-white/[0.05]">
                  <Mail className="w-4.5 h-4.5 text-accent" strokeWidth={1.5} />
                </div>
                <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mt-6 mb-2">Stay in the Loop</p>
                <h1 className="font-heading text-5xl md:text-6xl uppercase leading-[0.9] text-foreground tracking-tight mb-4">
                  Early<br />Access
                </h1>
                <p className="font-body text-sm text-foreground/55 leading-relaxed mb-8">
                  Launch updates, subscriber exclusives, and first access to new protocols — delivered directly to you.
                </p>
                <form onSubmit={handleSubmit} noValidate className="space-y-3">
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      placeholder="your@email.com"
                      className="w-full rounded-xl border border-foreground/15 bg-white/[0.04] px-4 py-3.5 font-body text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/35 focus:outline-none transition-colors"
                    />
                    {error && (
                      <p className="mt-1.5 font-body text-[11px] text-red-400">{error}</p>
                    )}
                  </div>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    className="group w-full flex items-center justify-between px-5 py-3.5 rounded-xl bg-foreground text-background font-body text-xs font-semibold tracking-[0.18em] uppercase"
                  >
                    <span>Get Early Access</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
                  </motion.button>
                </form>
                <p className="mt-4 font-body text-[10px] text-foreground/30 text-center">
                  No spam. Unsubscribe anytime.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex items-center justify-center w-14 h-14 rounded-full border border-accent/30 bg-accent/10">
                  <Check className="w-6 h-6 text-accent" strokeWidth={2} />
                </div>
                <h2 className="font-heading text-4xl uppercase leading-[0.92] text-foreground tracking-tight mb-3">You're In</h2>
                <p className="font-body text-sm text-foreground/55 leading-relaxed max-w-xs mx-auto">
                  We'll reach out when early access opens. Keep an eye on your inbox.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Footer />
    </div>
  );
}
