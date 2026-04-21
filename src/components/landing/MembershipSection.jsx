import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const APPLY_URL = '/apply';

const IV_TIERS = [
  {
    name: 'Core',
    category: 'VITAMINS',
    price: 200, regularPrice: 250,
    perks: [
      '1 of vitamin IVs per month',
      '1 IM injection per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
  {
    name: 'Pro',
    category: 'VITAMINS',
    price: 400, regularPrice: 500,
    isMostPopular: true,
    perks: [
      '2 of vitamin IVs per month',
      '2 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
  {
    name: 'Vital',
    category: 'VITAMINS',
    price: 600, regularPrice: 750,
    perks: [
      '3 of vitamin IVs per month',
      '3 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
  {
    name: 'Max',
    category: 'VITAMINS',
    price: 800, regularPrice: 1000,
    perks: [
      '4 of vitamin IVs per month',
      '4 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'White-glove concierge service',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
];

// Each NAD tier has pricing/perks for 1x and 2x per month
const NAD_TIERS = [
  {
    name: 'Core',
    category: 'NAD+',
    dose: '250mg',
    price: 240, regularPrice: 300,
    perks: ['1 × 250mg NAD+ IV per month', '1 IM injection per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Pro',
    category: 'NAD+',
    dose: '500mg',
    isMostPopular: true,
    price: 440, regularPrice: 550,
    perks: ['1 × 500mg NAD+ IV per month', '1 IM injection per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Vital',
    category: 'NAD+',
    dose: '750mg',
    price: 580, regularPrice: 725,
    perks: ['1 × 750mg NAD+ IV per month', '1 IM injection per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Max',
    category: 'NAD+',
    dose: '1000mg',
    price: 720, regularPrice: 900,
    perks: ['1 × 1000mg NAD+ IV per month', '1 IM injection per month', '20% off all à la carte NAD+', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
];

const CBD_TIERS = [
  {
    name: 'Core',
    category: 'CBD',
    dose: '33mg',
    price: 120, regularPrice: 150,
    perks: ['1 × 33mg CBD IV per month', '1 IM injection per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Pro',
    category: 'CBD',
    dose: '66mg',
    isMostPopular: true,
    price: 160, regularPrice: 200,
    perks: ['1 × 66mg CBD IV per month', '1 IM injection per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Vital',
    category: 'CBD',
    dose: '99mg',
    price: 200, regularPrice: 250,
    perks: ['1 × 99mg CBD IV per month', '1 IM injection per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Max',
    category: 'CBD',
    dose: '132mg',
    price: 240, regularPrice: 300,
    perks: ['1 × 132mg CBD IV per month', '1 IM injection per month', '20% off all à la carte add-ons', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
];

const EXOSOME_TIERS = [
  {
    name: 'Core',
    category: 'EXOSOMES',
    dose: '30B',
    price: 560, regularPrice: 700,
    perks: ['1 × 30B Exosome IV per month', '1 IM injection per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Pro',
    category: 'EXOSOMES',
    dose: '50B',
    isMostPopular: true,
    price: 960, regularPrice: 1200,
    perks: ['1 × 50B Exosome IV per month', '1 IM injection per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
  {
    name: 'Vital',
    category: 'EXOSOMES',
    dose: '90B',
    price: 1440, regularPrice: 1800,
    perks: ['1 × 90B Exosome IV per month', '1 IM injection per month', '20% off all à la carte regeneration', 'Credits roll over (membership must be active)', '3-month minimum commitment', 'Priority scheduling', 'Dedicated care coordinator', 'Exclusive member events', 'Unlimited messaging with your care team', 'Exclusive access and pricing on all products', 'Fast, discreet delivery - straight to your door'],
  },
];

const VITAL_ICE_SF_TIERS = [
  {
    name: 'Essential — Community',
    category: 'VITAL ICE SF',
    tagline: 'Fire & Ice Partner',
    locationNote: 'Studio Only - Marina District SF',
    community: true,
    visiblePerks: 4,
    price: 300, regularPrice: 375,
    perks: [
      '1 IV drip per month',
      '1 IM injection per month',
      'Unlimited cold plunge access',
      'Unlimited sauna access',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Unlimited messaging with your care team',
    ],
  },
  {
    name: 'Essential — Private',
    category: 'VITAL ICE SF',
    tagline: 'Fire & Ice Partner',
    locationNote: 'Studio Only - Marina District SF',
    community: false,
    visiblePerks: 4,
    price: 360, regularPrice: 450,
    perks: [
      '1 IV drip per month',
      '1 IM injection per month',
      'Unlimited cold plunge access',
      'Unlimited sauna access',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Unlimited messaging with your care team',
    ],
  },
  {
    name: 'Plus — Community',
    category: 'VITAL ICE SF',
    tagline: 'Most Popular',
    locationNote: 'Studio Only - Marina District SF',
    community: true,
    visiblePerks: 4,
    price: 480, regularPrice: 600,
    featured: true,
    perks: [
      '2 IV drips per month',
      '2 IM injections per month',
      'Unlimited cold plunge access',
      'Unlimited sauna access',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Unlimited messaging with your care team',
    ],
  },
  {
    name: 'Plus — Private',
    category: 'VITAL ICE SF',
    tagline: 'Most Popular',
    locationNote: 'Studio Only - Marina District SF',
    community: false,
    visiblePerks: 4,
    price: 576, regularPrice: 720,
    featured: true,
    perks: [
      '2 IV drips per month',
      '2 IM injections per month',
      'Unlimited cold plunge access',
      'Unlimited sauna access',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Unlimited messaging with your care team',
    ],
  },
];

// Card for IV Vitamins (simple, no frequency toggle)
function IVTierCard({ tier, i, billing }) {
  const displayPrice = billing === 'yearly' ? tier.price * 12 : tier.price;
  const regularYearlyPrice = tier.regularPrice * 12;
  const [expanded, setExpanded] = useState(false);
  const visiblePerks = tier.visiblePerks || 3;
  const hasMore = tier.perks.length > visiblePerks;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.1, duration: 0.7 }}
      className={`flex-shrink-0 w-[90vw] sm:w-[340px] md:w-auto relative border rounded-3xl p-6 flex flex-col ${tier.featured || tier.isMostPopular ? 'border-accent/60 bg-card' : 'border-border bg-card'}`}
    >
      {(tier.featured || tier.isMostPopular) && <div className="absolute -top-px left-0 right-0 h-px bg-accent" />}
      <p className="text-[8px] tracking-[0.3em] font-body uppercase mb-1.5 text-muted-foreground">
        {tier.category}
      </p>
      <p className={`text-[8px] tracking-[0.3em] font-body uppercase mb-3 whitespace-nowrap ${tier.featured || tier.isMostPopular ? 'text-accent' : 'text-muted-foreground'}`}>
        {tier.tagline || ''}
      </p>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-heading text-4xl md:text-5xl text-foreground tracking-wide">{tier.name}</h3>
        {tier.isMostPopular && <span className="text-accent text-[7px] tracking-[0.15em] uppercase whitespace-nowrap pt-0.5">Most Popular</span>}
      </div>
      <div className="mb-6 relative">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-6xl md:text-7xl text-foreground">${displayPrice}</span>
          <span className="font-body text-xs text-muted-foreground">{billing === 'yearly' ? '/year' : '/month'}</span>
        </div>
        <p className="font-body text-[9px] text-muted-foreground mt-0.5">
          <span className="line-through">${billing === 'yearly' ? regularYearlyPrice : tier.regularPrice}</span>
          <span className="text-accent ml-2">{billing === 'yearly' ? 'save 20% annually' : '20% member discount'}</span>
          {tier.locationNote && <div className="text-[7px] text-muted-foreground/60 mt-0.5">{tier.locationNote}</div>}
        </p>
      </div>

      {/* Side scroll arrows - visible on desktop only */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:flex">
        <button
          onClick={() => scroll('left')}
          className="p-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex">
        <button
          onClick={() => scroll('right')}
          className="p-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <ul className="space-y-2.5 mb-3 flex-1">
        {tier.perks.slice(0, expanded ? tier.perks.length : visiblePerks).map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="w-3 h-3 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
            <span className="font-body text-[13px] text-muted-foreground leading-tight">{perk}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-accent text-[11px] font-body uppercase tracking-wider hover:text-accent/80 transition-colors mb-4"
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {!hasMore && <div className="mb-4" />}
      <a href={APPLY_URL} target="_blank" rel="noopener noreferrer"
        className={`block text-center py-3 font-body text-[12px] tracking-widest uppercase font-semibold rounded transition-colors md:mt-auto ${
          tier.featured ? 'bg-foreground text-background hover:bg-foreground/90' : 'border border-foreground/30 text-foreground hover:border-foreground'
        }`}
      >
        Apply for Membership
      </a>
    </motion.div>
  );
}

// Card for NAD+, CBD, and Exosomes (single frequency)
function SimpleTierCard({ tier, i, billing }) {
      const displayPrice = billing === 'yearly' ? tier.price * 12 : tier.price;
      const regularYearlyPrice = tier.regularPrice * 12;
      const [expanded, setExpanded] = useState(false);
      const visiblePerks = 3;
      const hasMore = tier.perks.length > visiblePerks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.1, duration: 0.7 }}
      className={`flex-shrink-0 w-[90vw] sm:w-[340px] md:w-auto relative border rounded-3xl p-6 flex flex-col text-center ${tier.featured || tier.isMostPopular ? 'border-accent/60 bg-card' : 'border-border bg-card'}`}
    >
      {(tier.featured || tier.isMostPopular) && <div className="absolute -top-px left-0 right-0 h-px bg-accent" />}

      <p className="text-[8px] tracking-[0.3em] font-body uppercase mb-1.5 text-muted-foreground">
        {tier.category}
      </p>
      <p className="text-[8px] tracking-[0.3em] font-body uppercase mb-3 text-muted-foreground whitespace-nowrap">
        {tier.dose} per session
      </p>
      <div className="flex items-start justify-center gap-2 mb-4">
        <h3 className="font-heading text-2xl md:text-3xl text-foreground tracking-wide">{tier.name}</h3>
        {tier.isMostPopular && <span className="text-accent text-[7px] tracking-[0.15em] uppercase whitespace-nowrap pt-0.5">Most Popular</span>}
      </div>

      <div className="mb-6">
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-heading text-4xl md:text-5xl text-foreground">${displayPrice}</span>
          <span className="font-body text-xs text-muted-foreground">/month</span>
        </div>
        <p className="font-body text-[9px] text-muted-foreground text-center mt-0.5">
          <span className="line-through">${billing === 'yearly' ? regularYearlyPrice : tier.regularPrice}</span>
          <span className="text-accent ml-2">20% member discount</span>
        </p>
      </div>

      <ul className="space-y-2.5 mb-3 flex-1">
        {tier.perks.slice(0, expanded ? tier.perks.length : visiblePerks).map((perk) => (
          <li key={perk} className="flex items-center justify-center gap-2">
            <Check className="w-3 h-3 text-accent shrink-0" strokeWidth={2.5} />
            <span className="font-body text-[13px] text-muted-foreground leading-tight">{perk}</span>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-accent text-[11px] font-body uppercase tracking-wider hover:text-accent/80 transition-colors mb-4"
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {!hasMore && <div className="mb-4" />}

      <a href={APPLY_URL} target="_blank" rel="noopener noreferrer"
        className={`block text-center py-3 font-body text-[12px] tracking-widest uppercase font-semibold rounded transition-colors md:mt-auto ${
          tier.featured ? 'bg-foreground text-background hover:bg-foreground/90' : 'border border-foreground/30 text-foreground hover:border-foreground'
        }`}
      >
        Apply for Membership
      </a>
    </motion.div>
  );
}

const FLUID_TIERS = [
  {
    name: 'Core',
    category: 'FLUID',
    price: 120, regularPrice: 150,
    perks: [
      '1 dehydration IV per month',
      '1 IM injection per month',
      '10% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
  {
    name: 'Pro',
    category: 'FLUID',
    price: 240, regularPrice: 300,
    isMostPopular: true,
    perks: [
      '2 dehydration IVs per month',
      '2 IM injections per month',
      '10% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
  {
    name: 'Vital',
    category: 'FLUID',
    price: 360, regularPrice: 450,
    perks: [
      '3 dehydration IVs per month',
      '3 IM injections per month',
      '10% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
  {
    name: 'Max',
    category: 'FLUID',
    price: 480, regularPrice: 600,
    perks: [
      '4 dehydration IVs per month',
      '4 IM injections per month',
      '10% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'White-glove concierge service',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery - straight to your door',
    ],
  },
];

const TABS = [
  { label: 'Fluid', tiers: FLUID_TIERS, type: 'iv' },
  { label: 'Vitamins', tiers: IV_TIERS, type: 'iv' },
  { label: 'NAD+', tiers: NAD_TIERS, type: 'simple' },
  { label: 'CBD', tiers: CBD_TIERS, type: 'simple' },
  { label: 'Exosomes', tiers: EXOSOME_TIERS, type: 'simple' },
  { label: 'Vital Ice SF', tiers: VITAL_ICE_SF_TIERS, type: 'iv' },
];

export default function MembershipSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [billing, setBilling] = useState('monthly');
  const scrollRef = useRef(null);
  const tab = TABS[activeTab];

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const gridClass = tab.tiers.length === 5
    ? 'md:grid-cols-5'
    : tab.tiers.length === 4
    ? 'md:grid-cols-4'
    : 'md:grid-cols-3';

  return (
    <section id="membership" className="py-8 md:py-10 px-4 border-t border-border">
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
            Membership by application only. Available in the San Francisco Bay Area. Lock in presale pricing and secure your spot before we go live.
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
              Yearly — Save 20%
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-1 mb-12 flex-wrap">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActiveTab(i)}
              className={`px-3 md:px-6 py-2 md:py-2.5 font-body text-[8px] md:text-[10px] tracking-widest uppercase rounded-full transition-colors shrink-0 ${
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
        <div className="overflow-x-auto md:overflow-visible relative group">
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 md:hidden p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 md:hidden p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
          <div ref={scrollRef} className={`flex md:grid gap-4 w-fit md:w-full ${gridClass}`} style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tab.tiers.map((tier, i) =>
              tab.type === 'iv'
                ? <IVTierCard key={tier.name} tier={tier} i={i} billing={billing} />
                : <SimpleTierCard key={tier.name} tier={tier} i={i} billing={billing} />
            )}
            </div>
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
      <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}