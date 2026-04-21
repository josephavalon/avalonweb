import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const APPLY_URL = 'https://placeholder-square-presale.com'; // replace with Square link

const IV_TIERS = [
  {
    name: 'Essential',
    tagline: 'The Foundation',
    ivs: 1, ims: 1,
    price: 200, regularPrice: 250,
    perks: [
      '1 IV drip per month',
      '1 IM injection per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
    ],
  },
  {
    name: 'Performance',
    tagline: 'Most Popular',
    ivs: 2, ims: 2,
    price: 400, regularPrice: 500,
    featured: true,
    perks: [
      '2 IV drips per month',
      '2 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
    ],
  },
  {
    name: 'Elite',
    tagline: 'Full Protocol',
    ivs: 3, ims: 3,
    price: 600, regularPrice: 750,
    perks: [
      '3 IV drips per month',
      '3 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
    ],
  },
  {
    name: 'Vital',
    tagline: 'Maximum Protocol',
    ivs: 4, ims: 4,
    price: 800, regularPrice: 1000,
    perks: [
      '4 IV drips per month',
      '4 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'White-glove concierge service',
    ],
  },
];

const NAD_TIERS = [
  {
    name: 'NAD+ Starter',
    tagline: '2 × 250mg Monthly',
    price: 480, regularPrice: 600,
    perks: [
      '2 × 250mg NAD+ IVs per month',
      '20% off all à la carte NAD+',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
    ],
  },
  {
    name: 'NAD+ Core',
    tagline: '2 × 500mg Monthly',
    price: 880, regularPrice: 1100,
    featured: true,
    perks: [
      '2 × 500mg NAD+ IVs per month',
      '20% off all à la carte NAD+',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
    ],
  },
  {
    name: 'NAD+ Elite',
    tagline: '2 × 1000mg Monthly',
    price: 1440, regularPrice: 1800,
    perks: [
      '2 × 1000mg NAD+ IVs per month',
      '20% off all à la carte NAD+',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
    ],
  },
  {
    name: 'NAD+ Protocol',
    tagline: '2 × 1250mg Monthly',
    price: 1760, regularPrice: 2200,
    perks: [
      '2 × 1250mg NAD+ IVs per month',
      '20% off all à la carte NAD+',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
    ],
  },
  {
    name: 'NAD+ Vital',
    tagline: '2 × 1500mg Monthly',
    price: 2080, regularPrice: 2600,
    perks: [
      '2 × 1500mg NAD+ IVs per month',
      '20% off all à la carte NAD+',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'White-glove concierge service',
    ],
  },
];

const CBD_TIERS = [
  {
    name: 'CBD Relief',
    tagline: '1 × 33mg Monthly',
    price: 200, regularPrice: 250,
    perks: [
      '1 × 33mg IV CBD per month',
      '20% off all à la carte CBD',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
    ],
  },
  {
    name: 'CBD Balance',
    tagline: '1 × 66mg Monthly',
    price: 320, regularPrice: 400,
    featured: true,
    perks: [
      '1 × 66mg IV CBD per month',
      '20% off all à la carte CBD',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
    ],
  },
  {
    name: 'CBD Restore',
    tagline: '1 × 132mg Monthly',
    price: 520, regularPrice: 650,
    perks: [
      '1 × 132mg IV CBD per month',
      '20% off all à la carte CBD',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
    ],
  },
  {
    name: 'CBD Double Relief',
    tagline: '2 × 33mg Monthly',
    price: 360, regularPrice: 450,
    perks: [
      '2 × 33mg IV CBD per month',
      '20% off all à la carte CBD',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
    ],
  },
  {
    name: 'CBD Double Balance',
    tagline: '2 × 66mg Monthly',
    price: 560, regularPrice: 700,
    perks: [
      '2 × 66mg IV CBD per month',
      '20% off all à la carte CBD',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
    ],
  },
  {
    name: 'CBD Double Restore',
    tagline: '2 × 132mg Monthly',
    price: 920, regularPrice: 1150,
    perks: [
      '2 × 132mg IV CBD per month',
      '20% off all à la carte CBD',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
    ],
  },
];

const TABS = [
  { label: 'IV Vitamins', tiers: IV_TIERS },
  { label: 'NAD+', tiers: NAD_TIERS },
  { label: 'CBD', tiers: CBD_TIERS },
];

function TierCard({ tier, i }) {
  return (
    <motion.div
      key={tier.name}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.1, duration: 0.7 }}
      className={`relative border rounded p-8 flex flex-col ${
        tier.featured ? 'border-accent/60 bg-card' : 'border-border bg-card'
      }`}
    >
      {tier.featured && <div className="absolute -top-px left-0 right-0 h-px bg-accent" />}
      <p className={`text-[9px] tracking-[0.3em] font-body uppercase mb-4 ${tier.featured ? 'text-accent' : 'text-muted-foreground'}`}>
        {tier.tagline}
      </p>
      <h3 className="font-heading text-3xl text-foreground tracking-wide mb-2">{tier.name}</h3>

      <div className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-5xl text-foreground">${tier.price}</span>
          <span className="font-body text-xs text-muted-foreground">/month</span>
        </div>
        <p className="font-body text-[10px] text-muted-foreground mt-1">
          <span className="line-through">${tier.regularPrice}</span>
          <span className="text-accent ml-2">20% member discount</span>
        </p>
      </div>

      <ul className="space-y-3 mb-10 flex-1">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5">
            <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
            <span className="font-body text-xs text-muted-foreground leading-relaxed">{perk}</span>
          </li>
        ))}
      </ul>

      <a
        href={APPLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`block text-center py-3.5 font-body text-xs tracking-widest uppercase font-semibold rounded transition-colors ${
          tier.featured
            ? 'bg-foreground text-background hover:bg-foreground/90'
            : 'border border-foreground/30 text-foreground hover:border-foreground'
        }`}
      >
        Apply for Membership
      </a>
    </motion.div>
  );
}

export default function MembershipSection() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section id="membership" className="py-24 md:py-36 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="text-center mb-10"
        >
          <p className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">Presale — Limited Availability</p>
          <h2 className="font-heading text-6xl md:text-8xl text-foreground tracking-wide mb-6">MEMBERSHIP</h2>
          <p className="font-body text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Membership by application only. Lock in presale pricing and secure your spot before we go live.
            All plans include a <span className="text-foreground">20% discount</span>, rollover credits, and a 3-month minimum.
          </p>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-1 mb-12">
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={`px-6 py-2.5 font-body text-[10px] tracking-widest uppercase rounded transition-colors ${
                activeTab === i
                  ? 'bg-foreground text-background'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tiers */}
        <div className={`grid gap-4 ${TABS[activeTab].tiers.length === 6 ? 'md:grid-cols-3' : TABS[activeTab].tiers.length === 5 ? 'md:grid-cols-5' : TABS[activeTab].tiers.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {TABS[activeTab].tiers.map((tier, i) => (
            <TierCard key={tier.name} tier={tier} i={i} />
          ))}
        </div>

        {/* Fine print */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-10 text-center"
        >
          <p className="font-body text-[10px] text-muted-foreground/50 tracking-wider max-w-lg mx-auto leading-relaxed">
            3-month minimum commitment. Credits roll over month-to-month as long as your membership remains active.
            Presale spots are limited — membership subject to approval.
          </p>
        </motion.div>
      </div>
    </section>
  );
}