import React, { useState } from 'react';
import { useSeo } from '@/lib/seo';
import { Check, Home, Hotel, Building2, CalendarDays, Zap, CalendarCheck, Clock, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const LOCATION_TYPES = [
  { id: 'home',   label: 'Home',   icon: Home      },
  { id: 'hotel',  label: 'Hotel',  icon: Hotel     },
  { id: 'office', label: 'Office', icon: Building2 },
  { id: 'event',  label: 'Event',  icon: CalendarDays },
];

const TIMING_OPTIONS = [
  { id: 'asap',      label: 'ASAP',           icon: Zap          },
  { id: 'today',     label: 'Today',          icon: CalendarCheck },
  { id: 'tomorrow',  label: 'Tomorrow',       icon: Clock        },
  { id: 'scheduled', label: 'Schedule Later', icon: Calendar     },
];

// Validation rules. Kept as pure functions so they're easy to test and reuse.
const validators = {
  fullName: (v) => {
    if (!v.trim()) return 'Name is required.';
    if (v.trim().split(/\s+/).length < 2) return 'Please enter your first and last name.';
    return '';
  },
  email: (v) => {
    if (!v.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
    return '';
  },
  phone: (v) => {
    if (!v.trim()) return 'Phone is required — we confirm by text.';
    const digits = v.replace(/\D/g, '');
    if (digits.length < 10) return 'Enter a valid phone number.';
    return '';
  },
};

export default function Apply() {
  useSeo({
    title: 'Request a Visit — Avalon Vitality',
    description: 'Request an Avalon mobile IV therapy visit in the SF Bay Area. RN-administered, MD-supervised. No payment until confirmed.',
    path: '/apply',
  });

  const [locationType, setLocationType] = useState(null);
  const [timing, setTiming] = useState(null);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '',
    // Honeypot — hidden from real users, filled by bots.
    website: '',
  });
  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const updateField = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: validators[name]?.(value) || '' }));
    }
  };

  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({ ...prev, [name]: validators[name]?.(form[name]) || '' }));
  };

  const validateAll = () => {
    const errors = {};
    Object.keys(validators).forEach(k => {
      const msg = validators[k](form[k]);
      if (msg) errors[k] = msg;
    });
    setFieldErrors(errors);
    setTouched(Object.keys(validators).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!validateAll()) {
      setError('Please correct the highlighted fields.');
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector('[aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
      });
      return;
    }

    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const inputClass = (name) => {
    const hasError = touched[name] && fieldErrors[name];
    return `w-full bg-transparent border rounded-full px-6 py-4 font-body text-sm text-foreground placeholder:text-muted-foreground/75 focus:outline-none transition-colors ${
      hasError
        ? 'border-destructive/70 focus:border-destructive'
        : 'border-foreground/20 focus:border-foreground/50'
    }`;
  };

  const FieldError = ({ name }) => {
    if (!touched[name] || !fieldErrors[name]) return null;
    return (
      <p id={`${name}-error`} role="alert" className="mt-1.5 px-2 font-body text-xs text-destructive/90">
        {fieldErrors[name]}
      </p>
    );
  };

  const ariaProps = (name) => ({
    'aria-invalid': touched[name] && !!fieldErrors[name],
    'aria-describedby': touched[name] && fieldErrors[name] ? `${name}-error` : undefined,
  });

  if (submitted) {
    const queuePosition = Math.floor(Math.random() * 150 + 75);
    return (
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar />
        <section className="flex-1 flex items-start justify-center px-4 pt-32 md:pt-40 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-xl"
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-16 h-16 rounded-full border border-accent/40 mx-auto mb-8 flex items-center justify-center"
            >
              <Check className="w-6 h-6 text-accent" strokeWidth={2.5} />
            </motion.div>

            <p className="font-body text-xs tracking-[0.35em] text-accent uppercase mb-6">
              Application Received
            </p>
            <h1 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide mb-6">
              You're on the list.
            </h1>
            <div className="h-px bg-foreground/20 w-24 mx-auto mb-6" />
            <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-3 max-w-md mx-auto">
              We review applications weekly and will reach out within 5 business days.
            </p>
            <p className="font-body text-xs text-muted-foreground/75 leading-relaxed mb-6 max-w-md mx-auto">
              Your position: <span className="text-accent font-semibold">#{queuePosition}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/"
                className="inline-block border border-foreground/30 text-foreground font-body text-xs tracking-widest uppercase font-semibold rounded-full px-8 py-3 hover:border-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Back to Home
              </Link>
            </div>
          </motion.div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 md:pt-28 pb-4 md:pb-6 px-4 md:px-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/[0.06] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-body text-[10px] tracking-[0.3em] uppercase text-accent">
              SF Bay Area · No Payment Today
            </span>
          </div>
          <h1 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-3">
            REQUEST A VISIT
          </h1>
          <p className="font-body text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Tell us where and when. We'll text you to confirm your RN and arrival window.
          </p>
          <p className="font-body text-xs text-muted-foreground/60 mt-2">
            No charge until your appointment is confirmed.
          </p>
        </motion.div>
      </section>

      {/* Form Section */}
      <section className="py-4 md:py-6 px-4 md:px-16">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>

            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}>
              <label htmlFor="website">Website (leave blank)</label>
              <input
                id="website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={e => updateField('website', e.target.value)}
              />
            </div>

            {/* Location type */}
            <div>
              <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/50 mb-3">
                Where are we coming?
              </p>
              <div className="flex flex-wrap gap-2">
                {LOCATION_TYPES.map((loc) => {
                  const Icon = loc.icon;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setLocationType(loc.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full font-body text-xs tracking-[0.12em] border transition-all duration-200 ${
                        locationType === loc.id
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground/80'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      {loc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timing */}
            <div>
              <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/50 mb-3">
                When do you need us?
              </p>
              <div className="flex flex-wrap gap-2">
                {TIMING_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTiming(opt.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full font-body text-xs tracking-[0.12em] border transition-all duration-200 ${
                        timing === opt.id
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground/80'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-foreground/[0.08]" />

            {/* Full name */}
            <div>
              <label htmlFor="fullName" className="sr-only">Full name</label>
              <input
                id="fullName"
                type="text"
                placeholder="Full name"
                value={form.fullName}
                onChange={e => updateField('fullName', e.target.value)}
                onBlur={() => handleBlur('fullName')}
                autoComplete="name"
                className={inputClass('fullName')}
                {...ariaProps('fullName')}
              />
              <FieldError name="fullName" />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                autoComplete="email"
                inputMode="email"
                className={inputClass('email')}
                {...ariaProps('email')}
              />
              <FieldError name="email" />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="sr-only">Phone number</label>
              <input
                id="phone"
                type="tel"
                placeholder="Phone number (we confirm by text)"
                value={form.phone}
                onChange={e => updateField('phone', e.target.value)}
                onBlur={() => handleBlur('phone')}
                className={inputClass('phone')}
                autoComplete="tel"
                inputMode="tel"
                {...ariaProps('phone')}
              />
              <FieldError name="phone" />
            </div>

            {/* Form-level error */}
            {error && (
              <p className="text-center font-body text-xs text-destructive/90 pt-1" role="alert" aria-live="polite">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full py-4 hover:bg-foreground/90 transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {submitting ? 'Sending request…' : 'Request a Visit'}
            </button>

            <p className="text-center font-body text-xs text-muted-foreground/75 pt-1">
              No charge today. We'll text you to confirm availability and schedule your RN.
            </p>

            <p className="text-center font-body text-[10px] text-muted-foreground/50 leading-relaxed max-w-sm mx-auto">
              Avalon Vitality provides wellness and recovery support. This is not emergency medical care. If you are experiencing a medical emergency, call 911.
            </p>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
}
