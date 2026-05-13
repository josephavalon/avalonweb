import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const DRIPS = [
  { name: 'Dehydration', price: '$179' },
  { name: "Myers' Cocktail", price: '$229' },
  { name: 'Immunity', price: '$229' },
  { name: 'Energy', price: '$219' },
  { name: 'Beauty', price: '$229' },
  { name: 'Hangover Recovery', price: '$249' },
  { name: 'Jet Lag', price: '$229' },
  { name: 'Migraine Relief', price: '$239' },
  { name: 'Flu Relief', price: '$229' },
  { name: 'Food Poisoning', price: '$249' },
  { name: 'Event Recovery', price: '$249' },
  { name: 'Event Performance', price: '$259' },
  { name: 'CBD Infusion', price: '$279–$399' },
  { name: 'NAD+ (250mg)', price: '$399' },
  { name: 'NAD+ (500mg)', price: '$599' },
  { name: 'Exosomes 30B', price: '$799' },
  { name: 'Exosomes 50B', price: '$1,200' },
  { name: 'Exosomes 90B', price: '$1,800' },
];

const ADDONS = [
  { name: 'B12 Shot', price: '+$25' },
  { name: 'Glutathione Push', price: '+$40' },
  { name: 'Toradol', price: '+$35' },
  { name: 'Zofran', price: '+$35' },
  { name: 'Biotin', price: '+$30' },
  { name: 'Extra Fluids', price: '+$30' },
  { name: 'High-Dose Vitamin C', price: '+$45' },
];

const TIERS = [
  {
    name: 'Starter',
    price: '$200/mo',
    highlight: false,
    features: [
      '1 IV credit/month',
      '15% off add-ons',
      'Same-day priority scheduling',
      '3-month minimum',
    ],
  },
  {
    name: 'Inner Circle',
    price: '$400/mo',
    highlight: true,
    features: [
      '2 IV credits/month',
      '1 credit may be Advanced tier (≤$399)',
      '20% off add-ons',
      '1 free add-on per visit',
      '90-min arrival window',
      '3-month minimum',
    ],
  },
  {
    name: 'Private Client',
    price: '$800/mo',
    highlight: false,
    features: [
      '4 IV credits/month',
      '1 credit may be NAD+ 500mg or Exosomes 30B',
      '25% off add-ons',
      'Unlimited add-ons at member rate',
      'Dedicated nurse',
      'Shareable with partner',
      '3-month minimum',
    ],
  },
];

const FAQS = [
  {
    q: 'Do credits roll over?',
    a: 'Yes. Unused credits roll to the following month.',
  },
  {
    q: 'Can I pause?',
    a: 'Yes. Members may pause once per 3-month term with 7 days notice.',
  },
  {
    q: 'What if I want more?',
    a: 'Additional sessions beyond your credits are available at the member-discounted rate.',
  },
];

export default function Pricing() {
  useSeo({
    title: 'Pricing — Avalon Vitality',
    description:
      'Transparent pricing for mobile IV therapy in San Francisco. Single sessions from $179. Membership plans from $200/mo.',
    path: '/pricing',
  });

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Transparent Pricing
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              What you pay is what you pay.
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-10"
            >
              No hidden fees. No surprise charges. Every ingredient listed.
            </motion.p>
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.24 }}
              className="flex flex-wrap gap-4"
            >
              <Link
                to="/store"
                className="inline-flex items-center gap-2 bg-accent text-background font-body text-sm tracking-[0.15em] uppercase px-6 py-3.5 rounded-xl hover:bg-accent/90 transition-colors duration-200"
              >
                Book a Session <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/membership"
                className="inline-flex items-center gap-2 border border-foreground/20 text-foreground font-body text-sm tracking-[0.15em] uppercase px-6 py-3.5 rounded-xl hover:border-foreground/50 transition-colors duration-200"
              >
                View Membership <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Single Sessions */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Single Sessions
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Book once. No commitment.
            </motion.h2>

            {/* Drip grid — two columns desktop, one mobile */}
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="grid md:grid-cols-2 gap-x-12"
            >
              {DRIPS.map((drip, i) => (
                <div
                  key={drip.name}
                  className="flex items-center justify-between py-3.5 border-b border-foreground/[0.07]"
                >
                  <span className="font-body text-sm text-foreground/80">{drip.name}</span>
                  <span className="font-body text-sm text-accent font-medium tabular-nums">{drip.price}</span>
                </div>
              ))}
            </motion.div>

            {/* Add-ons */}
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
              className="mt-10"
            >
              <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-4">
                Add-ons
              </p>
              <div className="flex flex-wrap gap-3">
                {ADDONS.map((addon) => (
                  <div
                    key={addon.name}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-foreground/[0.10] bg-foreground/[0.03]"
                  >
                    <span className="font-body text-xs text-foreground/70">{addon.name}</span>
                    <span className="font-body text-xs text-accent">{addon.price}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Membership */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Membership
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Save more. Every session.
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-6">
              {TIERS.map((tier, i) => (
                <motion.div
                  key={tier.name}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                  className={`rounded-2xl border p-6 flex flex-col ${
                    tier.highlight
                      ? 'border-accent/30 bg-accent/[0.04]'
                      : 'border-foreground/[0.08] bg-foreground/[0.03]'
                  }`}
                >
                  {tier.highlight && (
                    <span className="self-start font-body text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full bg-accent/15 text-accent mb-4">
                      Most Popular
                    </span>
                  )}
                  <p className="font-heading text-2xl text-foreground uppercase mb-1">{tier.name}</p>
                  <p className="font-body text-xl text-accent mb-6">{tier.price}</p>
                  <ul className="space-y-3 flex-1 mb-8">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        <span className="font-body text-sm text-foreground/65 leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/apply"
                    className={`w-full text-center font-body text-sm tracking-[0.15em] uppercase py-3.5 rounded-xl transition-colors duration-200 ${
                      tier.highlight
                        ? 'bg-accent text-background hover:bg-accent/90'
                        : 'border border-foreground/20 text-foreground hover:border-foreground/50'
                    }`}
                  >
                    Get Started
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* FAQ strip */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {FAQS.map((faq, i) => (
                <motion.div
                  key={faq.q}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                >
                  <p className="font-heading text-lg text-foreground uppercase leading-snug mb-3">{faq.q}</p>
                  <p className="font-body text-sm text-foreground/55 leading-relaxed">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Bottom CTA */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto text-center">
            <motion.h2
              {...REVEAL}
              className="font-heading text-4xl md:text-6xl text-foreground uppercase leading-[0.95] mb-8"
            >
              Ready to start?
            </motion.h2>
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <Link
                to="/store"
                className="inline-flex items-center gap-2 bg-accent text-background font-body text-sm tracking-[0.15em] uppercase px-6 py-3.5 rounded-xl hover:bg-accent/90 transition-colors duration-200"
              >
                Book One Session <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/apply"
                className="inline-flex items-center gap-2 border border-foreground/20 text-foreground font-body text-sm tracking-[0.15em] uppercase px-6 py-3.5 rounded-xl hover:border-foreground/50 transition-colors duration-200"
              >
                Join Membership <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
