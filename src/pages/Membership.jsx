import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Check, ShieldCheck, CalendarDays, RotateCcw, Droplets, UserRound } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const tiers = [
  {
    name: 'Starter',
    sessions: 1,
    tagline: 'The foundation.',
    price: 199,
    unit: '/mo',
    perSessionNote: '$199 / session',
    perks: [
      '1 IV session credit per month',
      '20% off all add-ons',
      'Priority booking window',
      'Subscriber scheduling portal',
    ],
  },
  {
    name: 'Inner Circle',
    sessions: 2,
    tagline: 'The sweet spot.',
    price: 389,
    unit: '/mo',
    perSessionNote: '$195 / session',
    perks: [
      '2 IV session credits per month',
      '25% off all add-ons',
      '1 complimentary IM shot per month',
      'Priority booking window',
      'Subscriber scheduling portal',
    ],
  },
  {
    name: 'Elite',
    sessions: 4,
    tagline: 'Full access.',
    price: 899,
    unit: '/mo',
    perSessionNote: '$225 / session',
    perks: [
      '4 IV session credits per month',
      '30% off all add-ons',
      '2 complimentary IM shots per month',
      'Dedicated registered nurse',
      'Custom protocol design',
      'Household partner sharing',
    ],
  },
  {
    name: 'Private Client',
    sessions: null,
    tagline: 'Fully bespoke.',
    price: null,
    unit: '',
    perSessionNote: 'Bespoke pricing',
    custom: true,
    perks: [
      'Any protocol, any frequency',
      'Add IM shots à la carte',
      'Designed with medical director',
      'Adjust anytime',
      'No commitment to inquire',
    ],
  },
];

// ─── Checkout Drawer ──────────────────────────────────────────────────────────
function CheckoutDrawer({ tier, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', zip: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="relative w-full md:max-w-md bg-background border border-foreground/[0.12] rounded-t-3xl md:rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-11 h-11 md:w-8 md:h-8 rounded-full border border-foreground/[0.1] flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/30 transition-colors z-10"
          aria-label="Close subscription form"
        >
          <X className="w-4 h-4" />
        </button>

        {!submitted ? (
          <div className="p-6 md:p-8">
            {/* Tier summary */}
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
                    <Check className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />
                    <span className="font-body text-[10px] text-foreground/50">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40 block mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full min-h-[52px] bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-base md:text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
                />
              </div>
              <div>
                <label className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40 block mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="w-full min-h-[52px] bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-base md:text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
                />
              </div>
              <div>
                <label className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40 block mb-1">Phone</label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(415) 000-0000"
                  className="w-full min-h-[52px] bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-base md:text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
                />
              </div>
              <div>
                <label className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40 block mb-1">Service ZIP Code</label>
                <input
                  required
                  type="text"
                  value={form.zip}
                  onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                  placeholder="94102"
                  className="w-full min-h-[52px] bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-base md:text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
                />
              </div>

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
                      {tier.custom ? 'Request My Protocol' : `Start ${tier.name}`}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              <p className="font-body text-[9px] text-foreground/25 text-center tracking-[0.12em] leading-relaxed">
                3-month minimum · billing begins after clinical intake · cancel with 7 days notice after term
              </p>
            </form>
          </div>
        ) : (
          /* Success state */
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-foreground/[0.06] border border-foreground/[0.1] flex items-center justify-center mx-auto mb-6">
              <Check className="w-5 h-5 text-foreground" />
            </div>
            <h3 className="font-heading text-3xl text-foreground uppercase mb-3">You're In.</h3>
            <p className="font-body text-sm text-foreground/50 mb-6 max-w-xs mx-auto">
              We'll confirm your <span className="text-foreground">{tier.name}</span> subscription and schedule your clinical intake within 24 hours.
            </p>
            <button
              onClick={onClose}
              className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors"
            >
              Back to Subscription
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── TierCard ─────────────────────────────────────────────────────────────────
function TierCard({ tier, index, onSelect }) {
  return (
    <motion.div
      className={`group relative flex-shrink-0 w-[min(86vw,350px)] sm:w-[310px] md:w-auto md:h-full snap-center md:snap-align-none rounded-[1.35rem] border p-5 md:p-5 lg:p-6 flex flex-col backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 ${
        tier.custom
          ? 'border-accent/30 bg-card/45'
          : tier.badge
            ? 'border-accent/45 bg-card/55 shadow-[0_20px_80px_rgba(0,0,0,0.18)]'
            : 'border-foreground/[0.12] bg-card/35'
      }`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: EASE, delay: index * 0.07 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {tier.badge && (
              <span className="font-body text-[8px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border border-accent/40 text-accent">
                {tier.badge}
              </span>
            )}
            <p className="font-body text-[9px] tracking-[0.26em] uppercase text-foreground/35">{tier.tagline}</p>
          </div>
          <h3 className="font-heading text-3xl lg:text-[2rem] text-foreground uppercase leading-none [overflow-wrap:normal] [word-break:normal]">{tier.name}</h3>
        </div>
        {tier.sessions && (
          <div className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 shrink-0">
            <span className="font-body text-[9px] tracking-[0.18em] uppercase text-foreground">{tier.sessions}/mo</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1 mb-1">
        {tier.price
          ? <><span className="font-heading text-4xl lg:text-[2.8rem] text-foreground">${tier.price.toLocaleString()}</span>
              <span className="font-body text-sm text-foreground/40">{tier.unit}</span></>
          : <span className="font-heading text-3xl lg:text-[2.35rem] text-foreground/70">Bespoke</span>
        }
      </div>
      <p className="font-body text-[9px] text-foreground/30 tracking-[0.12em] mb-3">{tier.perSessionNote}</p>

      <div className="h-px bg-foreground/[0.08] mb-3" />

      <ul className="space-y-1.5 mb-4">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-[#c9a84c] mr-1.5 flex-shrink-0 mt-0.5" />
            <span className="font-body text-[11px] lg:text-xs text-foreground/60 leading-snug">{perk}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier)}
        className={`mt-auto block w-full min-h-[48px] text-center px-4 py-3 rounded-full font-body text-[10px] tracking-[0.2em] uppercase font-semibold transition-colors ${
          tier.custom
            ? 'border border-accent/40 text-accent hover:bg-accent/10'
            : 'bg-foreground text-background hover:bg-foreground/85'
        }`}
      >
        {tier.custom ? 'Design My Protocol' : `Select ${tier.name}`}
      </button>
    </motion.div>
  );
}

const steps = [
  {
    number: '01',
    title: 'Choose your tier',
    body: 'Pick Starter, Inner Circle, or Elite. Upgrade anytime.',
  },
  {
    number: '02',
    title: 'Schedule sessions',
    body: 'Book online. Choose home, hotel, or office. RN arrives.',
  },
  {
    number: '03',
    title: 'Credits auto-apply',
    body: 'No codes. Credits deducted at checkout automatically.',
  },
];

const faqs = [
  {
    q: 'Do unused credits expire?',
    a: 'Up to 1 unused credit rolls over per billing month. Rolled-over credits never expire — use them anytime.',
  },
  {
    q: 'Can I share credits with someone else?',
    a: 'Credits are non-transferable and tied to your subscriber account. Each guest must book under their own profile.',
  },
  {
    q: 'What counts as one credit?',
    a: 'One credit equals one standard IV session. IM shots, additional add-ons, and specialty drips may be purchased separately at your subscriber discount.',
  },
  {
    q: 'How do I pause my subscription?',
    a: 'Log in to your subscriber portal and select Pause. Your billing cycle will pause immediately. Credits already issued remain valid.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancel anytime with 7 days notice before your next billing date. No cancellation fees. Sessions already booked are honored through the end of your paid period.',
  },
];

const comparisonRows = [
  {
    feature: 'Monthly Price',
    starter: '$199',
    inner: '$389',
    private: '$899',
  },
  {
    feature: 'IV Credits / month',
    starter: '1',
    inner: '2',
    private: '4',
  },
  {
    feature: 'Add-on Discount',
    starter: '20%',
    inner: '25%',
    private: '30%',
  },
  {
    feature: 'Complimentary IM shots',
    starter: '—',
    inner: '1 / month',
    private: '2 / month',
  },
  {
    feature: 'Arrival Window',
    starter: 'Priority',
    inner: '90 min',
    private: '90 min + dedicated nurse',
  },
  {
    feature: 'Shareable',
    starter: '—',
    inner: '—',
    private: 'Household partner',
  },
  {
    feature: 'Commitment',
    starter: '3 months',
    inner: '3 months',
    private: '3 months',
  },
];

export default function Subscription() {
  useSeo({ title: 'Subscription — Avalon Vitality', description: 'Monthly IV therapy subscriptions starting from $199/mo. Credits roll over, no long-term lock-in.', path: '/subscription' });
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const scrollToPlans = () => {
    document.getElementById('subscription-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const heroStats = [
    { icon: Droplets, label: 'Monthly IV credits', value: '1-4' },
    { icon: RotateCcw, label: 'Credit rollover', value: 'Included' },
    { icon: CalendarDays, label: 'Minimum term', value: '3 months' },
    { icon: UserRound, label: 'RN administered', value: 'Bay Area' },
  ];

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-[4.5rem] md:pt-24 pb-28 md:pb-0">

        {/* Hero */}
        <section className="px-4 md:px-12 lg:px-20 pb-5 md:pb-12">
          <div className="max-w-6xl mx-auto rounded-[2rem] border border-foreground/[0.1] bg-card/35 backdrop-blur-2xl overflow-hidden">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-5 sm:p-8 md:p-10 lg:p-12">
                <motion.p
                  className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                >
                  Subscription
                </motion.p>
                <motion.h1
                  className="font-heading text-5xl sm:text-7xl md:text-[6.5rem] lg:text-[clamp(5.75rem,6.4vw,7.35rem)] text-foreground uppercase leading-[0.88] mb-4 md:mb-5 [overflow-wrap:normal] [word-break:normal]"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
                >
                  Recover<br />Consistently.
                </motion.h1>
                <motion.p
                  className="font-body text-sm md:text-lg text-foreground/65 max-w-2xl leading-relaxed"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
                >
                  Monthly mobile IV credits with subscriber pricing, rollover flexibility, and priority scheduling across the SF Bay Area.
                </motion.p>

                <motion.div
                  className="mt-4 flex flex-wrap gap-2 sm:hidden"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
                >
                  {['1-4 credits', 'Rollover', '3 months', 'Bay Area RN'].map((item) => (
                    <span key={item} className="rounded-full border border-foreground/10 bg-background/35 px-3 py-2 font-body text-[9px] uppercase tracking-[0.18em] text-foreground">
                      {item}
                    </span>
                  ))}
                </motion.div>

                <motion.div
                  className="mt-5 md:mt-7 flex flex-col sm:flex-row gap-3"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
                >
                  <button
                    onClick={() => setSelectedTier(tiers[1])}
                    className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-foreground px-7 py-4 font-body text-[11px] font-semibold tracking-[0.22em] uppercase text-background transition-opacity hover:opacity-85"
                  >
                    Start Inner Circle <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={scrollToPlans}
                    className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-foreground/15 px-7 py-4 font-body text-[11px] font-semibold tracking-[0.22em] uppercase text-foreground transition-colors hover:bg-foreground/10"
                  >
                    View Plans
                  </button>
                </motion.div>
              </div>

              <motion.div
                className="hidden sm:grid border-t lg:border-t-0 lg:border-l border-foreground/[0.08] p-4 sm:p-6 md:p-8 grid-cols-2 content-start gap-2.5 md:gap-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.85, ease: EASE, delay: 0.18 }}
              >
                {heroStats.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-background/35 p-3 md:p-4 min-h-20 md:min-h-32 flex flex-col justify-between gap-3">
                    <Icon className="w-4 h-4 md:w-5 md:h-5 text-foreground/60" strokeWidth={1.7} />
                    <div>
                      <p className="font-heading text-xl md:text-2xl text-foreground uppercase leading-none">{value}</p>
                      <p className="mt-1 font-body text-[8px] md:text-[9px] tracking-[0.16em] uppercase text-foreground/45 leading-relaxed">{label}</p>
                    </div>
                  </div>
                ))}
                <div className="hidden sm:block col-span-2 rounded-2xl border border-accent/25 bg-accent/[0.07] p-4 md:p-5">
                  <p className="font-body text-[10px] tracking-[0.26em] uppercase text-foreground/50 mb-2">Subscriber Terms</p>
                  <p className="font-body text-sm text-foreground/65 leading-relaxed">
                    Save on every visit. Roll unused credits forward while active. Cancel after the initial 3-month term.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Tier Cards */}
        <section id="subscription-plans" className="scroll-mt-24 py-8 md:py-12 px-5 md:px-12 lg:px-20">
          <div className="max-w-6xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Plans
            </motion.p>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
              <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9]" {...fadeUp}>
                Choose Your Tier
              </motion.h2>
              <motion.p className="font-body text-sm text-foreground/55 max-w-sm md:text-right leading-relaxed" {...fadeUp}>
                Inner Circle is the cleanest cadence for most clients: two monthly sessions, add-on savings, and priority booking.
              </motion.p>
            </div>

            <div
              className="overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory md:snap-none -mx-5 md:mx-0 px-5 md:px-0 touch-pan-x"
              aria-label="Subscription tiers"
            >
              <div className="flex md:grid md:grid-cols-4 md:items-stretch gap-3 md:gap-4 w-max md:w-auto pb-2 pr-5 md:pr-0">
                {tiers.map((tier, i) => (
                  <TierCard key={tier.name} tier={tier} index={i} onSelect={setSelectedTier} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <Reveal as="section" className="py-12 md:py-16 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-6xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Compare Plans
            </motion.p>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
              <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9]" {...fadeUp}>
                Find Your Fit.
              </motion.h2>
              <motion.p className="font-body text-sm text-foreground/55 max-w-md md:text-right leading-relaxed" {...fadeUp}>
                Credits apply to standard IV sessions. Specialty therapies and add-ons stay available at subscriber pricing.
              </motion.p>
            </div>

            <motion.div {...fadeUp} className="space-y-3 md:hidden">
              {comparisonRows.map((row) => (
                <div key={row.feature} className="rounded-2xl border border-foreground/[0.08] bg-card/35 p-4">
                  <p className="font-body text-[10px] tracking-[0.22em] uppercase text-foreground/45 mb-3">{row.feature}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['Starter', row.starter],
                      ['Inner', row.inner],
                      ['Private', row.private],
                    ].map(([label, value], index) => (
                      <div key={label} className={`rounded-xl border border-foreground/[0.06] bg-background/35 px-2.5 py-3 text-center ${index === 1 ? 'border-accent/25 bg-accent/[0.06]' : ''}`}>
                        <p className="font-body text-[8px] tracking-[0.14em] uppercase text-foreground/45 mb-1">{label}</p>
                        <p className={`font-body text-sm leading-tight ${index === 1 ? 'text-accent' : 'text-foreground'}`}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div {...fadeUp} className="hidden md:block">
              <table className="w-full border-collapse rounded-[1.75rem] overflow-hidden">
                <thead>
                  <tr className="bg-card/40">
                    <th className="text-left pb-4 pr-6 font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 font-normal w-[30%]">
                      Feature
                    </th>
                    <th className="pb-4 px-4 font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 font-normal text-center">
                      Starter
                    </th>
                    <th className="pb-4 px-4 font-body text-[10px] tracking-[0.25em] uppercase text-accent font-normal text-center">
                      Inner Circle
                    </th>
                    <th className="pb-4 px-4 font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 font-normal text-center">
                      Private Client
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature}>
                      <td className="font-body text-xs tracking-wide text-foreground/50 py-3 px-0 pr-6 border-b border-foreground/[0.06]">
                        {row.feature}
                      </td>
                      {[row.starter, row.inner, row.private].map((val, j) => (
                        <td key={j} className="font-body text-sm text-foreground/70 py-3 px-4 border-b border-foreground/[0.06] text-center">
                          {val === '—' ? (
                            <span className="text-foreground/25">—</span>
                          ) : val === '✓' ? (
                            <span className="text-accent">✓</span>
                          ) : (
                            <span className={j === 1 ? 'text-accent/80' : ''}>{val}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
        </Reveal>

        {/* How Subscription Works */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Process
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              How It Works
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                >
                  <p className="font-heading text-6xl text-foreground/10 mb-4">{step.number}</p>
                  <h3 className="font-heading text-2xl text-foreground uppercase mb-3">{step.title}</h3>
                  <p className="font-body text-sm text-foreground/60">{step.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Pause / Cancel Policy */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
              {...fadeUp}
            >
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">Flexibility</p>
                <h2 className="font-heading text-4xl md:text-5xl text-foreground uppercase leading-[0.9] mb-4">
                  Pause Anytime.<br />Cancel After 3 Months.
                </h2>
                <p className="font-body text-sm text-foreground/60 max-w-lg">
                  Pause anytime — rolled-over credits never expire, so nothing is lost. After your 3-month commitment, cancel with 7 days notice before your next billing date. No fees. No questions.
                </p>
              </div>
              <button
                onClick={() => setSelectedTier(tiers[1])}
                className="flex-shrink-0 px-8 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors text-center"
              >
                Start Subscription
              </button>
            </motion.div>
          </div>
        </Reveal>

        {/* FAQ */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Questions
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Subscription FAQ
            </motion.h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] overflow-hidden"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                >
                  <button
                    className="w-full min-h-[64px] flex items-center justify-between p-6 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-body text-sm font-semibold text-foreground pr-4">{faq.q}</span>
                    <span className="text-foreground/40 flex-shrink-0 text-lg leading-none">
                      {openFaq === i ? '−' : '+'}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6">
                      <p className="font-body text-sm text-foreground/60">{faq.a}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Bottom CTA */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto text-center">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Ready
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6" {...fadeUp}>
              Start Recovering<br />On Your Schedule
            </motion.h2>
            <motion.p className="font-body text-sm text-foreground/50 mb-10 max-w-sm mx-auto" {...fadeUp}>
              Select a tier above and start today.
            </motion.p>
            <motion.div
              className="border-t border-foreground/[0.08] pt-4 mt-4 flex items-center justify-center gap-2"
              {...fadeUp}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
              <p className="font-body text-xs text-foreground/40 text-center tracking-wide">
                3-month minimum commitment. Pause anytime. Cancel with 7 days notice after term. No hidden fees.
              </p>
            </motion.div>

            <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6" {...fadeUp}>
              <button
                onClick={() => setSelectedTier(tiers[1])}
                className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
              >
                Start Inner Circle <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedTier(tiers[3])}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-foreground/20 text-foreground/60 font-body text-xs tracking-[0.2em] uppercase font-semibold hover:border-foreground/40 hover:text-foreground transition-colors"
              >
                Design Custom Protocol
              </button>
            </motion.div>
          </div>
        </Reveal>

      </main>
      <Footer />

      <motion.div
        className="md:hidden fixed inset-x-0 z-40 px-3 pt-2 pointer-events-none"
        style={{ bottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
      >
        <div className="pointer-events-auto rounded-[1.75rem] border border-foreground/10 bg-background/85 backdrop-blur-2xl shadow-[0_-18px_70px_rgba(0,0,0,0.28)] p-2">
          <button
            onClick={() => setSelectedTier(tiers[1])}
            className="min-h-[58px] w-full rounded-full bg-foreground px-5 font-body text-[11px] font-semibold tracking-[0.2em] uppercase text-background flex items-center justify-center gap-2"
          >
            Start Inner Circle <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Checkout Drawer */}
      <AnimatePresence>
        {selectedTier && (
          <CheckoutDrawer tier={selectedTier} onClose={() => setSelectedTier(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
