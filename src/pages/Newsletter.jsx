import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

export default function Newsletter() {
  useSeo({
    title: 'Stay in the Loop — Avalon Vitality',
    description: 'Sign up for Avalon Vitality news — new therapies, launch updates, member exclusives, and more.',
    path: '/newsletter',
  });

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = (v) => {
    if (!v.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate(email);
    if (err) { setError(err); return; }
    setSubmitting(true);
    // Stub — wire to Klaviyo list subscribe endpoint when ready
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-24">
        <div className="w-full max-w-md">

          {!submitted ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <p className="font-body text-xs tracking-[0.3em] text-accent uppercase mb-4">
                Avalon Vitality
              </p>
              <h1 className="font-heading text-4xl md:text-5xl tracking-widest text-foreground uppercase mb-4 leading-tight">
                Stay in<br />the loop.
              </h1>
              <p className="font-body text-sm text-foreground/60 leading-relaxed mb-10">
                New therapies, launch updates, and member exclusives — delivered straight to your inbox. No spam. Unsubscribe any time.
              </p>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    onBlur={() => setError(validate(email))}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className={`w-full bg-transparent border rounded-full px-6 py-4 font-body text-sm text-foreground placeholder:text-foreground/30 focus:outline-none transition-colors ${
                      error ? 'border-red-400' : 'border-foreground/20 focus:border-foreground/50'
                    }`}
                  />
                  {error && (
                    <p className="mt-2 ml-4 font-body text-xs text-red-400">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.2em] uppercase font-semibold rounded-full bg-accent text-background hover:bg-accent/85 transition-colors disabled:opacity-60"
                >
                  <span>{submitting ? 'Subscribing…' : 'Subscribe'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="flex flex-col items-start gap-6"
            >
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-accent" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-heading text-3xl tracking-widest text-foreground uppercase mb-3">
                  You're in.
                </h2>
                <p className="font-body text-sm text-foreground/60 leading-relaxed">
                  We'll be in touch when it matters. Welcome to Avalon.
                </p>
              </div>
            </motion.div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
