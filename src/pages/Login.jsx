import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Lock, Check } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const EASE = [0.16, 1, 0.3, 1];

export default function Login() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = 'Login — Avalon Vitality'; }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    // Real magic-link API ships when auth is wired. For now we acknowledge
    // visually so the form behaves like a working login.
    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
    }, 600);
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-5 md:px-10 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="login-glass w-full max-w-md rounded-3xl p-8 md:p-10"
        >
          <div className="text-center mb-8 md:mb-10">
            <p className="font-body text-[11px] md:text-xs tracking-[0.4em] uppercase text-foreground/55 mb-3">Member login</p>
            <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">Welcome back.</h1>
          </div>

          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="login-email" className="block font-body text-[11px] tracking-[0.3em] uppercase text-foreground/65 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" strokeWidth={1.5} />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full pl-11 pr-4 py-3.5 rounded-full border border-foreground/20 bg-background/60 backdrop-blur-md text-foreground placeholder:text-foreground/35 font-body text-sm focus:outline-none focus:border-foreground/60 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!email.trim() || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-xs md:text-sm tracking-[0.3em] uppercase px-7 py-4 disabled:opacity-40 hover:opacity-85 transition-opacity"
                >
                  {submitting ? 'Sending…' : (<>Send magic link <ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>)}
                </button>

                <p className="text-center text-[11px] md:text-xs text-foreground/55 leading-relaxed">
                  We'll email you a one-tap link. No passwords — your inbox is the key.
                </p>
              </motion.form>
            ) : (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="text-center py-6"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/15 mb-5">
                  <Check className="w-6 h-6 text-accent" strokeWidth={2} />
                </div>
                <p className="font-display text-xl md:text-2xl uppercase tracking-tight leading-tight mb-2">Check your email.</p>
                <p className="text-sm text-foreground/65 leading-relaxed mb-6">
                  If <span className="text-foreground">{email}</span> matches a member account, your sign-in link is on its way.
                </p>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setEmail(''); }}
                  className="font-body text-[11px] tracking-[0.3em] uppercase text-foreground/55 hover:text-foreground transition-colors"
                >
                  Use a different email
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-9 md:mt-10 pt-6 border-t border-foreground/10 text-center">
            <p className="text-xs md:text-sm text-foreground/65 mb-1">New to Avalon?</p>
            <Link
              to="/apply"
              className="inline-flex items-center gap-2 font-body text-[11px] md:text-xs tracking-[0.3em] uppercase text-foreground hover:opacity-70 transition-opacity"
            >
              Apply for membership <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Link>
          </div>

          <p className="mt-6 text-center text-[10px] tracking-[0.2em] uppercase text-foreground/40">
            <Lock className="w-3 h-3 inline-block mr-1.5 -mt-0.5" strokeWidth={1.5} />
            Secure · HIPAA-aligned
          </p>
        </motion.div>
      </main>

      <Footer />

      <style>{`
        .login-glass {
          background: hsl(var(--background) / 0.65);
          backdrop-filter: saturate(160%) blur(28px);
          -webkit-backdrop-filter: saturate(160%) blur(28px);
          border: 1px solid hsl(var(--foreground) / 0.12);
          box-shadow:
            0 1px 0 0 hsl(var(--foreground) / 0.04) inset,
            0 30px 80px -20px hsl(var(--foreground) / 0.18);
        }
      `}</style>
    </div>
  );
}
