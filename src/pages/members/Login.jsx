import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';

const EASE = [0.16, 1, 0.3, 1];

export default function ClientLogin() {
  const { signIn, requestPasswordReset, loading } = useAuthStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'sent'
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(null);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm();

  const fieldClass = "w-full bg-white/[0.04] border border-white/12 text-foreground font-body text-sm rounded-2xl px-4 py-3.5 placeholder:text-foreground/25 focus:outline-none focus:border-foreground/35 transition-colors";
  const labelClass = "font-body text-[10px] tracking-[0.25em] uppercase text-foreground/45 mb-2 block";
  const errClass   = "font-body text-[10px] text-red-400 mt-1.5";

  const onSignIn = async (data) => {
    setServerError(null);
    const result = await signIn({ email: data.username, password: data.password });
    if (result.ok) navigate(result.user.redirect || '/members/dashboard');
    else setServerError(result.error);
  };

  const onForgot = async ({ email }) => {
    await requestPasswordReset({ email });
    setMode('sent');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Ambient gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-accent/[0.06] blur-3xl" />
      </div>

      {/* Nav strip */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4">
        <Link to="/" className="font-heading text-[15px] tracking-[0.25em] text-foreground">AV</Link>
        <Link to="/apply" className="font-body text-xs tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors">
          Not a member? Apply
        </Link>
      </div>

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="w-full max-w-md"
        >
          <AnimatePresence mode="wait">

            {/* ── Login form ── */}
            {mode === 'login' && (
              <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: EASE }}>
                <div className="mb-8">
                  <p className="font-body text-[10px] tracking-[0.35em] uppercase text-accent mb-3">My Avalon</p>
                  <h1 className="font-heading text-5xl md:text-6xl text-foreground tracking-wide uppercase leading-[0.95]">
                    Welcome<br />Back.
                  </h1>
                  <p className="font-body text-sm text-foreground/50 mt-3">Sign in to manage your sessions, credits, and protocols.</p>
                </div>

                <form onSubmit={handleSubmit(onSignIn)} className="space-y-4">
                  <div>
                    <label className={labelClass}>Username</label>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder="ADMIN001 / CLIENT001 / NURSE001"
                      {...register('username', { required: 'Username required' })}
                      className={fieldClass}
                    />
                    {errors.username && <p className={errClass}>{errors.username.message}</p>}
                  </div>

                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                        className={`${fieldClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {errors.password && <p className={errClass}>{errors.password.message}</p>}
                  </div>

                  <div className="flex justify-end">
                    <button type="button" onClick={() => { setMode('forgot'); setServerError(null); }} className="font-body text-[11px] tracking-widest uppercase text-foreground/35 hover:text-foreground transition-colors">
                      Forgot password?
                    </button>
                  </div>

                  {serverError && (
                    <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3">
                      <p className="font-body text-xs text-red-400">{serverError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2.5 w-full py-4 mt-2 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                  >
                    {loading ? (
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full" />
                    ) : (
                      <>Sign In <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
                    )}
                  </button>
                </form>

                {/* Demo credential hint */}
                <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                  <p className="font-body text-[9px] tracking-[0.25em] uppercase text-accent/70 mb-2">Demo Access</p>
                  <div className="space-y-1">
                    {[['ADMIN001','Admin'],['CLIENT001','Client'],['NURSE001','Nurse']].map(([u,r]) => (
                      <div key={u} className="flex items-center justify-between">
                        <span className="font-body text-[11px] text-foreground/60 font-mono">{u}</span>
                        <span className="font-body text-[10px] text-foreground/30 tracking-wide">{r}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] mt-1">
                      <span className="font-body text-[10px] text-foreground/35">Password (all):</span>
                      <span className="font-body text-[11px] text-foreground/55 font-mono">JonJones1986</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/8 flex items-center justify-between">
                  <p className="font-body text-[11px] text-foreground/30">Provider or admin?</p>
                  <Link to="/provider" className="font-body text-[11px] tracking-widest uppercase text-foreground/40 hover:text-foreground transition-colors">
                    Provider Login →
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── Forgot password ── */}
            {mode === 'forgot' && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: EASE }}>
                <button type="button" onClick={() => setMode('login')} className="font-body text-[11px] tracking-widest uppercase text-foreground/35 hover:text-foreground transition-colors mb-8 flex items-center gap-1.5">
                  ← Back
                </button>
                <div className="mb-8">
                  <p className="font-body text-[10px] tracking-[0.35em] uppercase text-accent mb-3">Password Reset</p>
                  <h1 className="font-heading text-5xl text-foreground tracking-wide uppercase leading-[0.95]">Forgot<br />Password?</h1>
                  <p className="font-body text-sm text-foreground/50 mt-3">Enter your email and we'll send a reset link.</p>
                </div>
                <form onSubmit={handleSubmit(onForgot)} className="space-y-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" defaultValue={getValues('email')} placeholder="you@example.com"
                      {...register('email', { required: 'Email required' })} className={fieldClass} />
                    {errors.email && <p className={errClass}>{errors.email.message}</p>}
                  </div>
                  <button type="submit" disabled={loading} className="flex items-center justify-center gap-2.5 w-full py-4 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors">
                    {loading ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full" /> : <>Send Reset Link <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Email sent confirmation ── */}
            {mode === 'sent' && (
              <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: EASE }} className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-6 h-6 text-accent" strokeWidth={2.5} />
                </div>
                <h2 className="font-heading text-4xl text-foreground tracking-wide uppercase mb-3">Check<br />Your Email</h2>
                <p className="font-body text-sm text-foreground/50 mb-8">If an account exists, a reset link is on its way.</p>
                <button type="button" onClick={() => setMode('login')} className="font-body text-xs tracking-widest uppercase text-foreground/40 hover:text-foreground transition-colors">
                  ← Back to sign in
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
