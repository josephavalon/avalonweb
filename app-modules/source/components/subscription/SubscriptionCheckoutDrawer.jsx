import React, { useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Check, X } from 'lucide-react';
import { createAssignmentBroadcast } from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

export default function SubscriptionCheckoutDrawer({ tier, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', zip: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    createAssignmentBroadcast({
      id: `SUB-${Date.now().toString().slice(-6)}`,
      service: `${tier.name} Subscription`,
      plan: tier.name,
      date: 'First visit pending',
      time: 'Intake',
      address: form.zip ? `ZIP ${form.zip}` : 'Service area pending',
      contact: { name: form.name, email: form.email, phone: form.phone },
      nurse: 'Unassigned',
      status: 'Subscription intake',
      source: 'Subscription',
      subscription: true,
    }, { source: 'subscription', type: 'Subscription', scope: 'All subscription dates' });
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Subscription request"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="av-glass-card relative w-full overflow-hidden rounded-t-3xl border md:max-w-md md:rounded-3xl max-h-[90vh] overflow-y-auto"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-11 h-11 md:w-8 md:h-8 rounded-full border border-foreground/[0.1] flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/30 transition-colors z-10"
          aria-label="Close subscription form"
        >
          <X className="w-4 h-4" />
        </button>

        {!submitted ? (
          <div className="p-6 md:p-8">
            <div className={`rounded-2xl p-4 mb-6 ${tier.custom ? 'border border-accent/25 bg-accent/[0.05]' : 'border border-foreground/[0.1] bg-foreground/[0.03]'}`}>
              <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/40 mb-0.5">{tier.tagline}</p>
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-2xl text-foreground uppercase">{tier.name}</h3>
                <span className="font-heading text-xl text-foreground">
                  {tier.price ? `$${tier.price.toLocaleString()}${tier.unit}` : 'Custom'}
                </span>
              </div>
              {tier.perSessionNote && (
                <p className="font-body text-[9px] text-foreground/30 tracking-[0.12em] mt-0.5">{tier.perSessionNote}</p>
              )}
              <div className="mt-3 space-y-1">
                {tier.perks.slice(0, 3).map(p => (
                  <div key={p} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="font-body text-[10px] text-foreground/50">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                ['name', 'Full Name', 'text', 'Jane Smith', 'name'],
                ['email', 'Email', 'email', 'jane@example.com', 'email'],
                ['phone', 'Phone', 'tel', '(415) 000-0000', 'tel'],
                ['zip', 'Service ZIP Code', 'text', '94102', 'numeric'],
              ].map(([key, label, type, placeholder, inputMode]) => (
                <div key={key}>
                  <label className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40 block mb-1">{label}</label>
                  <input
                    required
                    type={type}
                    inputMode={inputMode === 'numeric' ? 'numeric' : undefined}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full min-h-[52px] bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-base md:text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
                  />
                </div>
              ))}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[56px] py-4 rounded-full bg-foreground text-background font-body text-[10px] tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  ) : (
                    <>
                      Request
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              <p className="font-body text-[9px] text-foreground/25 text-center tracking-[0.12em] leading-relaxed">
                3-month minimum · billing starts after intake
              </p>
            </form>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-foreground/[0.06] border border-foreground/[0.1] flex items-center justify-center mx-auto mb-6">
              <Check className="w-5 h-5 text-foreground" />
            </div>
            <h3 className="font-heading text-3xl text-foreground uppercase mb-3">Thank you.</h3>
            <p className="font-body text-sm text-foreground/50 mb-6 max-w-xs mx-auto">
              A nurse will be in touch shortly.
            </p>
            <button
              onClick={onClose}
              className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
