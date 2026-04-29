import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

const MEMBERSHIP_CATEGORIES = [
  {
    category: 'STARTER (1 IV per month)',
    tiers: [
      { id: 'starter-cbd', name: 'CBD', price: '$200/mo' },
      { id: 'starter-vitamins', name: 'Vitamins', price: '$200/mo' },
      { id: 'starter-nad', name: 'NAD+', price: '$280/mo' },
    ],
  },
  {
    category: 'PREMIUM (2 IVs per month)',
    tiers: [
      { id: 'premium-cbd', name: 'CBD', price: '$400/mo' },
      { id: 'premium-vitamins', name: 'Vitamins', price: '$400/mo' },
      { id: 'premium-nad', name: 'NAD+', price: '$560/mo' },
    ],
  },
  {
    category: 'VIP (4 IVs per month)',
    tiers: [
      { id: 'vip-cbd', name: 'CBD', price: '$800/mo' },
      { id: 'vip-vitamins', name: 'Vitamins', price: '$800/mo' },
      { id: 'vip-nad', name: 'NAD+', price: '$1,120/mo' },
    ],
  },
  {
    category: 'CUSTOM',
    tiers: [
      { id: 'custom', name: 'Build your own protocol', price: 'Concierge-designed' },
    ],
  },
];

// Validation rules. Kept as pure functions so they're easy to test and reuse.
const validators = {
  firstName: (v) => (!v.trim() ? 'First name is required.' : ''),
  lastName: (v) => (!v.trim() ? 'Last name is required.' : ''),
  email: (v) => {
    if (!v.trim()) return 'Email is required.';
    // Pragmatic email regex — accepts everything RFC-valid that end users actually type.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
    return '';
  },
  phone: (v) => {
    if (!v.trim()) return ''; // optional
    const digits = v.replace(/\D/g, '');
    if (digits.length < 10) return 'Enter a valid phone number.';
    return '';
  },
  state: () => '',
};

export default function Apply() {
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedMemberships, setSelectedMemberships] = useState({});
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', state: '',
    // Honeypot — hidden from real users, filled by bots. If this is non-empty
    // at submit time the server silently discards the submission.
    website: '',
  });
  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const updateField = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
    // Re-validate on change only if field was already touched — avoids error flash on first focus.
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!validateAll()) {
      setError('Please correct the highlighted fields.');
      // Focus first invalid field for screen-reader + keyboard users.
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector('[aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          state: form.state,
          goals: selectedGoals,
          memberships: selectedMemberships,
          website: form.website, // honeypot — should always be '' from real users
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed. Please try again.');
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (name) => {
    const hasError = touched[name] && fieldErrors[name];
    return `w-full bg-transparent border rounded-full px-6 py-4 font-body text-sm text-foreground placeholder:text-muted-foreground/75 focus:outline-none transition-colors ${
      hasError
        ? 'border-destructive/70 focus:border-destructive'
        : 'border-white/15 focus:border-white/35'
    }`;
  };

  const FieldError = ({ name }) => {
    if (!touched[name] || !fieldErrors[name]) return null;
    return (
      <p
        id={`${name}-error`}
        role="alert"
        className="mt-1.5 px-2 font-body text-xs text-destructive/90"
      >
        {fieldErrors[name]}
      </p>
    );
  };

  const ariaProps = (name) => ({
    'aria-invalid': touched[name] && !!fieldErrors[name],
    'aria-describedby': touched[name] && fieldErrors[name] ? `${name}-error` : undefined,
  });

  if (submitted) {
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
            {/* Animated check icon */}
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
              THANK YOU
            </h1>
            <div className="h-px bg-foreground/20 w-24 mx-auto mb-6" />
            <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-3 max-w-md mx-auto">
              We've received your application. Our team will review it and reach out within
              48 hours to confirm your presale membership.
            </p>
            <p className="font-body text-xs text-muted-foreground/75 leading-relaxed mb-10 max-w-md mx-auto">
              Check your inbox (and spam) for a confirmation from{' '}
              <span className="text-foreground/70">team@avalonvitality.co</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/"
                className="inline-block border border-foreground/30 text-foreground font-body text-xs tracking-widest uppercase font-semibold rounded-full px-8 py-3 hover:border-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Return Home
              </Link>
              <Link
                to="/our-story"
                className="inline-block text-muted-foreground font-body text-xs tracking-widest uppercase font-semibold rounded-full px-8 py-3 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Read Our Story
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
          <h1 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-2">
            APPLY FOR MEMBERSHIP
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            Start your personalized wellness journey with Avalon Vitality.
          </p>
        </motion.div>
      </section>

      {/* Form Section */}
      <section className="py-4 md:py-6 px-4 md:px-16">
        <div className="max-w-2xl mx-auto">

          <form onSubmit={handleSubmit} className="w-full space-y-3" noValidate>

        {/* Honeypot — visually hidden, not reachable by keyboard, ignored by
            screen readers. Real users never see or fill it; bots that blindly
            fill all inputs will populate it and trip the server-side filter. */}
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

        {/* Name row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="sr-only">First name</label>
            <input
              id="firstName"
              type="text"
              placeholder="First name"
              value={form.firstName}
              onChange={e => updateField('firstName', e.target.value)}
              onBlur={() => handleBlur('firstName')}
              autoComplete="given-name"
              className={inputClass('firstName')}
              {...ariaProps('firstName')}
            />
            <FieldError name="firstName" />
          </div>
          <div>
            <label htmlFor="lastName" className="sr-only">Last name</label>
            <input
              id="lastName"
              type="text"
              placeholder="Last name"
              value={form.lastName}
              onChange={e => updateField('lastName', e.target.value)}
              onBlur={() => handleBlur('lastName')}
              autoComplete="family-name"
              className={inputClass('lastName')}
              {...ariaProps('lastName')}
            />
            <FieldError name="lastName" />
          </div>
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
            placeholder="Phone number"
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

        {/* State select */}
        <div className="relative">
          <label htmlFor="state" className="sr-only">State</label>
          <select
            id="state"
            value={form.state}
            onChange={e => updateField('state', e.target.value)}
            className={`${inputClass('state')} appearance-none pr-10 cursor-pointer`}
            style={{ background: 'transparent' }}
          >
            <option value="" disabled className="bg-background text-muted-foreground">Select your state</option>
            {US_STATES.map(s => (
              <option key={s} value={s} className="bg-background text-foreground">{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Membership tier selection */}
            <div className="pt-2">
              <p className="font-body text-xs tracking-[0.25em] text-muted-foreground uppercase mb-1 px-1" id="tier-label">
                Select your preferred tier(s) — optional
              </p>
              <p className="font-body text-xs text-muted-foreground/75 mb-3 px-1 leading-snug">
                You can pick one protocol or combine across Vitamins, NAD+, and CBD. We'll confirm on your intake call.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2" role="group" aria-labelledby="tier-label">
                {MEMBERSHIP_CATEGORIES.map(category => {
                  const val = selectedMemberships[category.category] || '';
                  return (
                    <div key={category.category} className="relative">
                      <label htmlFor={`tier-${category.category}`} className="sr-only">
                        {category.category} tier
                      </label>
                      <select
                        id={`tier-${category.category}`}
                        value={val}
                        onChange={e => setSelectedMemberships(prev => ({ ...prev, [category.category]: e.target.value }))}
                        className={`w-full appearance-none bg-transparent border rounded-full px-4 py-3 pr-8 font-body text-xs cursor-pointer transition-colors focus:outline-none ${
                          val ? 'border-white/40 text-foreground' : 'border-white/15 text-muted-foreground'
                        }`}
                        style={{ background: 'transparent' }}
                      >
                        <option value="" className="bg-background text-muted-foreground">{category.category}</option>
                        {category.tiers.map(tier => (
                          <option key={tier.id} value={tier.id} className="bg-background text-foreground">
                            {tier.name} — {tier.price}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>
                  );
                })}
              </div>
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
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>

            <p className="text-center font-body text-xs text-muted-foreground/75 pt-1">
              Membership by application only. You'll be contacted within 48 hours.
            </p>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
}
