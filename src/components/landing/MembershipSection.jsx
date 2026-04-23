import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Circle, CircleDot, Sparkles } from 'lucide-react';

const TIER_ICON = {
  Starter: Circle,
  Premium: CircleDot,
  VIP: Sparkles,
};

const APPLY_URL = '/apply';

// Unified tier data. Each tier exposes three protocol options (Vitamins / NAD+ / CBD).
// Shared perks are deduplicated across the former per-category tables.
const TIERS = [
  {
    name: 'Starter',
    options: [
      { category: 'Vitamins', detail: '1 IV per month',        price: 200, regularPrice: 250 },
      { category: 'NAD+',     detail: '1 × 250mg IV per month', price: 240, regularPrice: 300 },
      { category: 'CBD',      detail: '1 × 33mg IV per month',  price: 200, regularPrice: 250 },
    ],
    perks: [
      '1 IM injection per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery — straight to your door',
    ],
  },
  {
    name: 'Premium',
    isMostPopular: true,
    options: [
      { category: 'Vitamins', detail: '2 IVs per month',        price: 400, regularPrice: 500 },
      { category: 'NAD+',     detail: '1 × 500mg IV per month', price: 440, regularPrice: 550 },
      { category: 'CBD',      detail: '1 × 66mg IV per month',  price: 240, regularPrice: 300 },
    ],
    perks: [
      '2 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery — straight to your door',
    ],
  },
  {
    name: 'VIP',
    options: [
      { category: 'Vitamins', detail: '4 IVs per month',         price: 700, regularPrice: 875 },
      { category: 'NAD+',     detail: '1 × 1000mg IV per month', price: 720, regularPrice: 900 },
      { category: 'CBD',      detail: '1 × 99mg IV per month',   price: 280, regularPrice: 350 },
    ],
    perks: [
      '4 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
      'Unlimited messaging with your care team',
      'Exclusive access and pricing on all products',
      'Fast, discreet delivery — straight to your door',
    ],
  },
];

function TierCard({ tier, i, billing }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePerks = 3;
  const hasMore = tier.perks.length > visiblePerks;
  const TierIcon = TIER_ICON[tier.name] || Circle;

  // Headline price = lowest option in the tier; shown as "from $X".
  const minPrice = Math.min(...tier.options.map((o) => o.price));
  const displayHeadline = billing === 'annual' ? minPrice * 12 : minPrice;

  const fmt = (n) => `$${n.toLocaleString()}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.1, duration: 0.7 }}
      className="flex-shrink-0 w-[calc(100vw-14rem)] sm:w-[280px] md:w-auto relative border rounded-3xl p-3 md:p-4 flex flex-col border-foreground bg-card"
    >
      {tier.isMostPopular && <div className="absolute -top-px left-6 right-6 h-px bg-accent" />}

      {/* Tier name row */}
      <div className="flex items-start justify-between gap-2 mb-2 md:mb-3">
        <div className="flex items-center gap-2.5">
          <TierIcon className="w-5 h-5 text-accent shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <h3 className="font-heading text-3xl md:text-4xl text-foreground tracking-wide">{tier.name}</h3>
        </div>
        {tier.isMostPopular && (
          <span className="text-accent text-[7px] tracking-[0.15em] uppercase whitespace-nowrap pt-0.5">
            Most Popular
          </span>
        )}
      </div>

      {/* Headline price */}
      <div className="mb-2">
        <p className="font-body text-[9px] tracking-[0.3em] text-muted-foreground uppercase mb-0.5">From</p>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-3xl md:text-4xl text-foreground">{fmt(displayHeadline)}</span>
          <span className="font-body text-xs text-muted-foreground">{billing === 'annual' ? '/year' : '/month'}</span>
        </div>
      </div>

      {/* Three protocol options */}
      <div className="mb-3 pt-3 border-t border-border/60 space-y-1.5">
        <p className="font-body text-[9px] tracking-[0.3em] text-muted-foreground uppercase mb-1.5">
          Choose your protocol
        </p>
        {tier.options.map((opt) => {
          const optPrice = billing === 'annual' ? opt.price * 12 : opt.price;
          const optRegular = billing === 'annual' ? opt.regularPrice * 12 : opt.regularPrice;
          return (
            <div key={opt.category} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-[12px] text-foreground leading-tight">{opt.category}</p>
                <p className="font-body text-[10px] text-muted-foreground truncate leading-tight">{opt.detail}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-body text-[13px] text-foreground leading-tight">
                  {fmt(optPrice)}<span className="text-muted-foreground text-[9px]">{billing === 'annual' ? '/yr' : '/mo'}</span>
                </p>
                <p className="font-body text-[10px] text-muted-foreground/80 line-through leading-tight">
                  {fmt(optRegular)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared perks */}
      <ul className="space-y-1.5 mb-2 pt-3 border-t border-border/60">
        {tier.perks.slice(0, expanded ? tier.perks.length : visiblePerks).map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="w-3 h-3 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
            <span className="font-body text-[12px] text-muted-foreground leading-tight">{perk}</span>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-accent text-[10px] font-body uppercase tracking-wider hover:text-accent/80 transition-colors mb-3"
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {!hasMore && <div className="mb-3" />}

      <a
        href={APPLY_URL}
        className={`block text-center py-2.5 font-body text-[11px] tracking-widest uppercase font-semibold rounded-full transition-colors md:mt-auto ${
          tier.isMostPopular
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
  const [billing, setBilling] = useState('monthly');

  return (
    <section id="membership" className="scroll-mt-20 md:scroll-mt-28 py-4 md:py-10 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="text-left mb-4 md:mb-8"
        >
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-2"
          >
            Presale — Limited Availability
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide md:whitespace-nowrap"
          >
            MEMBERSHIP
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-body text-sm text-muted-foreground max-w-xl leading-relaxed mt-3"
          >
            Membership by application only. Available soon in the San Francisco Bay Area.
          </motion.p>
        </motion.div>

        {/* Billing toggle — only remaining control */}
        <div className="flex justify-center mb-3">
          <div className="flex items-center bg-secondary/50 rounded-full p-1 gap-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-6 py-2 font-body text-[10px] tracking-widest uppercase rounded-full transition-colors ${billing === 'monthly' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-6 py-2 font-body text-[10px] tracking-widest uppercase rounded-full transition-colors ${billing === 'annual' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Annual — Save 20%
            </button>
          </div>
        </div>

        {/* Tiers — always all three, no category switching */}
        <div className="overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain md:overflow-visible md:touch-auto md:overscroll-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-3 w-fit md:w-full md:px-0 md:justify-center md:items-start">
            {TIERS.map((tier, i) => (
              <TierCard key={tier.name} tier={tier} i={i} billing={billing} />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-3 pt-2 text-center"
        >
          <p className="font-body text-[11px] text-muted-foreground tracking-wider max-w-lg mx-auto leading-relaxed">
            3-month minimum commitment. Credits roll over month-to-month as long as your membership remains active.
            Presale spots are limited — membership subject to approval.
          </p>
        </motion.div>
      </div>
      <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}
