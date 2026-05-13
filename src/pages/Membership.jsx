import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, ArrowRight, Check, ShieldCheck } from 'lucide-react';
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
    name: 'Member',
    sessions: 1,
    tagline: 'The foundation.',
    price: 199,
    unit: '/mo',
    perSessionNote: '$199 / session',
    perks: [
      '1 IV session credit per month',
      '20% off all add-ons',
      'Priority booking window',
      'Member scheduling portal',
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
      'Member scheduling portal',
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
          className="absolute top-4 right-4 w-8 h-8 rounded-full border border-foreground/[0.1] flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/30 transition-colors z-10"
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
                  className="w-full bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
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
                  className="w-full bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
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
                  className="w-full bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
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
                  className="w-full bg-foreground/[0.04] border border-foreground/[0.1] rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-full bg-foreground text-background font-body text-[10px] tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                3-month minimum · billing begins after clinical intake · cancel anytime after term
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
              We'll confirm your <span className="text-foreground">{tier.name}</span> membership and schedule your clinical intake within 24 hours.
            </p>
            <button
              onClick={onClose}
              className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors"
            >
              Back to Membership
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
      className={`flex-shrink-0 w-[78vw] md:w-auto snap-center md:snap-align-none rounded-2xl border p-5 flex flex-col ${
        tier.custom
          ? 'border-accent/25 bg-accent/[0.03]'
          : 'border-foreground/[0.12] bg-foreground/[0.03]'
      }`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: EASE, delay: index * 0.07 }}
    >
      {tier.badge && (
        <span className="self-start font-body text-[8px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border border-accent/40 text-accent mb-3">
          {tier.badge}
        </span>
      )}

      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-1">{tier.tagline}</p>
      <h3 className="font-heading text-3xl lg:text-4xl text-foreground uppercase leading-none mb-4">{tier.name}</h3>

      <div className="flex items-baseline gap-1 mb-0.5">
        {tier.price
          ? <><span className="font-heading text-4xl lg:text-5xl text-foreground">${tier.price.toLocaleString()}</span>
              <span className="font-body text-sm text-foreground/40">{tier.unit}</span></>
          : <span className="font-heading text-3xl text-foreground/50">Bespoke</span>
        }
      </div>
      <p className="font-body text-[9px] text-foreground/30 tracking-[0.12em] mb-4">{tier.perSessionNote}</p>

      <div className="h-px bg-foreground/[0.06] mb-4" />

      <ul className="space-y-2 flex-1 mb-5">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-[#c9a84c] mr-2 flex-shrink-0 mt-0.5" />
            <span className="font-body text-xs text-foreground/60 leading-snug">{perk}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier)}
        className={`block w-full text-center px-4 py-3 rounded-full font-body text-[10px] tracking-[0.2em] uppercase font-semibold transition-colors ${
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
    body: 'Pick Member, Inner Circle, or Elite. Upgrade anytime.',
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
    a: 'Credits are non-transferable and tied to your member account. Each guest must book under their own profile.',
  },
  {
    q: 'What counts as one credit?',
    a: 'One credit equals one standard IV session. IM shots, additional add-ons, and specialty drips may be purchased separately at your member discount.',
  },
  {
    q: 'How do I pause my membership?',
    a: 'Log in to your member portal and select Pause. Your billing cycle will pause immediately. Credits already issued remain valid.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancel anytime with 7 days notice before your next billing date. No cancellation fees. Sessions already booked are honored through the end of your paid period.',
  },
];

export default function Membership() {
  useSeo({ title: 'Membership — Avalon Vitality', description: 'Monthly IV therapy memberships starting from $199/mo. Credits roll over, no long-term lock-in.', path: '/membership' });
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-16 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p
              className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              Membership
            </motion.p>
            <motion.h1
              className="font-heading text-6xl md:text-8xl lg:text-[9rem] text-foreground uppercase leading-[0.9] mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
            >
              Recover<br />Consistently.
            </motion.h1>
            <motion.p
              className="font-body text-base md:text-lg text-foreground/60 max-w-xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
            >
              Save 20% on every session. Roll credits forward. Cancel after 3 months.
            </motion.p>
          </div>
        </section>

        {/* Tier Cards */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Plans
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Choose Your Tier
            </motion.h2>

            <div className="overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory md:snap-none -mx-5 md:mx-0 px-5 md:px-0">
              <div className="flex md:grid md:grid-cols-4 gap-3 md:gap-4 w-max md:w-auto">
                {tiers.map((tier, i) => (
                  <TierCard key={tier.name} tier={tier} index={i} onSelect={setSelectedTier} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Compare Plans
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Find Your Fit.
            </motion.h2>

            <motion.div {...fadeUp} className="overflow-x-auto -mx-5 md:mx-0 px-5 md:px-0">
              <table className="w-full min-w-[580px] border-collapse">
                <thead>
                  <tr>
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
                  {[
                    {
                      feature: 'Monthly Price',
                      starter: '$200',
                      inner: '$400',
                      private: '$800',
                    },
                    {
                      feature: 'IV Credits / month',
                      starter: '1',
                      inner: '2',
                      private: '4',
                    },
                    {
                      feature: 'Advanced Credit',
                      starter: '—',
                      inner: '1 (≤$399)',
                      private: '—',
                    },
                    {
                      feature: 'Elite Credit',
                      starter: '—',
                      inner: '—',
                      private: '1 (NAD+/Exosomes 30B)',
                    },
                    {
                      feature: 'Add-on Discount',
                      starter: '15%',
                      inner: '20%',
                      private: '25%',
                    },
                    {
                      feature: 'Free Add-on',
                      starter: '—',
                      inner: '1 per visit',
                      private: 'Unlimited at member rate',
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
                      private: 'With partner',
                    },
                    {
                      feature: 'Commitment',
                      starter: '3 months',
                      inner: '3 months',
                      private: '3 months',
                    },
                  ].map((row) => (
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

        {/* How Membership Works */}
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
                Start Membership
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
              Membership FAQ
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
                    className="w-full flex items-center justify-between p-6 text-left"
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
                3-month minimum commitment. Pause anytime after. Cancel with 30 days notice. No hidden fees.
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

      {/* Checkout Drawer */}
      <AnimatePresence>
        {selectedTier && (
          <CheckoutDrawer tier={selectedTier} onClose={() => setSelectedTier(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
