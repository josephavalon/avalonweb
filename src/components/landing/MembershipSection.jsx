import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const APPLY_URL = '/apply';

const IV_TIERS = [
  {
    name: 'Essential',
    tagline: 'The Foundation',
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
    tagline: 'Maximum Protocol', noWrap: true,
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

// Each NAD tier has pricing/perks for 1x and 2x per month
const NAD_TIERS = [
  {
    name: 'NAD+ Starter',
    dose: '250mg',
    featured: false,
    options: {
      1: { price: 240, regularPrice: 300, perks: ['1 × 250mg NAD+ IV per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling'] },
      2: { price: 480, regularPrice: 600, perks: ['2 × 250mg NAD+ IVs per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling'] },
    },
  },
  {
    name: 'NAD+ Core',
    dose: '500mg',
    featured: true,
    options: {
      1: { price: 440, regularPrice: 550, perks: ['1 × 500mg NAD+ IV per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator'] },
      2: { price: 880, regularPrice: 1100, perks: ['2 × 500mg NAD+ IVs per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator'] },
    },
  },
  {
    name: 'NAD+ Elite',
    dose: '1000mg',
    featured: false,
    options: {
      1: { price: 720, regularPrice: 900, perks: ['1 × 1000mg NAD+ IV per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events'] },
      2: { price: 1440, regularPrice: 1800, perks: ['2 × 1000mg NAD+ IVs per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events'] },
    },
  },
];

const CBD_TIERS = [
  {
    name: 'CBD Relief',
    dose: '33mg',
    featured: false,
    options: {
      1: { price: 200, regularPrice: 250, perks: ['1 × 33mg IV CBD per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling'] },
      2: { price: 360, regularPrice: 450, perks: ['2 × 33mg IV CBD per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling'] },
    },
  },
  {
    name: 'CBD Balance',
    dose: '66mg',
    featured: true,
    options: {
      1: { price: 320, regularPrice: 400, perks: ['1 × 66mg IV CBD per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator'] },
      2: { price: 560, regularPrice: 700, perks: ['2 × 66mg IV CBD per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator'] },
    },
  },
  {
    name: 'CBD Restore',
    dose: '132mg',
    featured: false,
    options: {
      1: { price: 520, regularPrice: 650, perks: ['1 × 132mg IV CBD per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events'] },
      2: { price: 920, regularPrice: 1150, perks: ['2 × 132mg IV CBD per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events'] },
    },
  },
];

const EXOSOME_TIERS = [
  {
    name: 'Exosome Foundation',
    dose: '30B',
    featured: false,
    options: {
      1: { price: 560, regularPrice: 700, perks: ['1 × 30B Exosome IV per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling'] },
      2: { price: 1040, regularPrice: 1300, perks: ['2 × 30B Exosome IVs per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling'] },
    },
  },
  {
    name: 'Exosome Advanced',
    dose: '50B',
    featured: true,
    options: {
      1: { price: 680, regularPrice: 850, perks: ['1 × 50B Exosome IV per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator'] },
      2: { price: 1260, regularPrice: 1575, perks: ['2 × 50B Exosome IVs per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator'] },
    },
  },
  {
    name: 'Exosome Elite',
    dose: '90B',
    featured: false,
    options: {
      1: { price: 960, regularPrice: 1200, perks: ['1 × 90B Exosome IV per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events'] },
      2: { price: 1760, regularPrice: 2200, perks: ['2 × 90B Exosome IVs per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events'] },
    },
  },
];

// Card for IV Vitamins (simple, no frequency toggle)
function IVTierCard({ tier, i, billing }) {
  const displayPrice = billing === 'yearly' ? Math.round(tier.price * 12 * 0.7) : tier.price;
  const regularYearlyPrice = tier.regularPrice * 12;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.1, duration: 0.7 }}
      className={`relative border rounded p-8 flex flex-col ${tier.featured ? 'border-accent/60 bg-card' : 'border-border bg-card'}`}
    >
      {tier.featured && <div className="absolute -top-px left-0 right-0 h-px bg-accent" />}
      <p className={`text-[9px] tracking-[0.3em] font-body uppercase mb-4 whitespace-nowrap ${tier.featured ? 'text-accent' : 'text-muted-foreground'}`}>
        {tier.tagline}
      </p>
      <h3 className="font-heading text-3xl text-foreground tracking-wide mb-2">{tier.name}</h3>
      <div className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-5xl text-foreground">${displayPrice}</span>
          <span className="font-body text-xs text-muted-foreground">{billing === 'yearly' ? '/year' : '/month'}</span>
        </div>
        <p className="font-body text-[10px] text-muted-foreground mt-1">
          <span className="line-through">${billing === 'yearly' ? regularYearlyPrice : tier.regularPrice}</span>
          <span className="text-accent ml-2">{billing === 'yearly' ? 'save 30% annually' : '20% member discount'}</span>
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
      <a href={APPLY_URL} target="_blank" rel="noopener noreferrer"
        className={`block text-center py-3.5 font-body text-xs tracking-widest uppercase font-semibold rounded transition-colors ${
          tier.featured ? 'bg-foreground text-background hover:bg-foreground/90' : 'border border-foreground/30 text-foreground hover:border-foreground'
        }`}
      >
        Apply for Membership
      </a>
    </motion.div>
  );
}

// Card for NAD+ and CBD (with 1x / 2x frequency toggle)
function FrequencyTierCard({ tier, i, billing }) {
  const [freq, setFreq] = useState(1);
  const option = tier.options[freq];
  const displayPrice = billing === 'yearly' ? Math.round(option.price * 12 * 0.7) : option.price;
  const regularYearlyPrice = option.regularPrice * 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.1, duration: 0.7 }}
      className={`relative border rounded p-8 flex flex-col ${tier.featured ? 'border-accent/60 bg-card' : 'border-border bg-card'}`}
    >
      {tier.featured && <div className="absolute -top-px left-0 right-0 h-px bg-accent" />}

      <p className={`text-[9px] tracking-[0.3em] font-body uppercase mb-4 ${tier.featured ? 'text-accent' : 'text-muted-foreground'}`}>
        {tier.dose} per session
      </p>
      <h3 className="font-heading text-3xl text-foreground tracking-wide mb-4">{tier.name}</h3>

      {/* Frequency toggle */}
      <div className="flex gap-1 mb-6 bg-secondary/50 rounded p-1">
        {[1, 2].map((f) => (
          <button
            key={f}
            onClick={() => setFreq(f)}
            className={`flex-1 py-1.5 font-body text-[10px] tracking-widest uppercase rounded transition-colors ${
              freq === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f}× / month
          </button>
        ))}
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-5xl text-foreground">${displayPrice}</span>
          <span className="font-body text-xs text-muted-foreground">{billing === 'yearly' ? '/year' : '/month'}</span>
        </div>
        <p className="font-body text-[10px] text-muted-foreground mt-1">
          <span className="line-through">${billing === 'yearly' ? regularYearlyPrice : option.regularPrice}</span>
          <span className="text-accent ml-2">{billing === 'yearly' ? 'save 30% annually' : '20% member discount'}</span>
        </p>
      </div>

      <ul className="space-y-3 mb-10 flex-1">
        {option.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5">
            <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
            <span className="font-body text-xs text-muted-foreground leading-relaxed">{perk}</span>
          </li>
        ))}
      </ul>

      <a href={APPLY_URL} target="_blank" rel="noopener noreferrer"
        className={`block text-center py-3.5 font-body text-xs tracking-widest uppercase font-semibold rounded transition-colors ${
          tier.featured ? 'bg-foreground text-background hover:bg-foreground/90' : 'border border-foreground/30 text-foreground hover:border-foreground'
        }`}
      >
        Apply for Membership
      </a>
    </motion.div>
  );
}

const TABS = [
  { label: 'IV Vitamins', tiers: IV_TIERS, type: 'iv' },
  { label: 'NAD+', tiers: NAD_TIERS, type: 'frequency' },
  { label: 'CBD', tiers: CBD_TIERS, type: 'frequency' },
  { label: 'Exosomes', tiers: EXOSOME_TIERS, type: 'frequency' },
];

export default function MembershipSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [billing, setBilling] = useState('monthly');
  const tab = TABS[activeTab];

  const gridClass = tab.tiers.length === 5
    ? 'md:grid-cols-5'
    : tab.tiers.length === 4
    ? 'md:grid-cols-4'
    : 'md:grid-cols-3';

  return (
    <section id="membership" className="py-24 md:py-36 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">

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

        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center bg-secondary/50 rounded-full p-1 gap-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-6 py-2 font-body text-[10px] tracking-widest uppercase rounded-full transition-colors ${billing === 'monthly' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-6 py-2 font-body text-[10px] tracking-widest uppercase rounded-full transition-colors ${billing === 'yearly' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Yearly — Save 30%
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-1 mb-12">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActiveTab(i)}
              className={`px-6 py-2.5 font-body text-[10px] tracking-widest uppercase rounded transition-colors ${
                activeTab === i
                  ? 'bg-foreground text-background'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tiers */}
        <div className={`grid gap-4 ${gridClass}`}>
          {tab.tiers.map((tier, i) =>
            tab.type === 'frequency'
              ? <FrequencyTierCard key={tier.name} tier={tier} i={i} billing={billing} />
              : <IVTierCard key={tier.name} tier={tier} i={i} billing={billing} />
          )}
        </div>

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