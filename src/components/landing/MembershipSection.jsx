import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleDot, Sparkles, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

const TIER_ICON = {
  Starter: Circle,
  Premium: CircleDot,
  VIP: Sparkles,
  Custom: Wrench,
};

const APPLY_URL = '/apply';

// Credits model — flat monthly price unlocks a credit pool that redeems against any protocol
// (Vitamins / NAD+ / CBD today; Peptides, TRT, Aesthetics as they launch). Customer picks the
// protocol at every booking. Annual prices apply 25% off. Custom tier routes to concierge.
const TIERS = [
  {
    name: 'Starter',
    price: 200,
    perks: [
      '1 IV credit per month (any protocol)',
      '1 IM injection per month',
      '20% off à la carte treatments',
      'Credits roll over (membership must be active)',
      'Fast, discreet delivery — straight to your door',
    ],
  },
  {
    name: 'Premium',
    isMostPopular: true,
    price: 450,
    perks: [
      '2 IV credits per month (any protocol)',
      '2 IM injections per month',
      '25% off à la carte treatments',
      'Credits roll over (membership must be active)',
      'Priority appointment booking',
      'Fast, discreet delivery — straight to your door',
    ],
  },
  {
    name: 'VIP',
    price: 800,
    perks: [
      '4 IV credits per month (any protocol)',
      '4 IM injections per month',
      '30% off à la carte treatments',
      'Credits roll over (membership must be active)',
      'Priority appointment booking',
      'Dedicated member concierge',
      'Fast, discreet delivery — straight to your door',
    ],
  },
  {
    name: 'Custom',
    isCustom: true,
    tagline: 'Build your own protocol',
    description: "A modular membership designed around your routine. Choose protocols, frequencies, and add-ons with our concierge team.",
    perks: [
      'Tailored credit mix (IV, IM, NAD+, CBD)',
      'Custom delivery cadence',
      'Add diagnostics, peptides, and future protocols',
      'Dedicated membership architect',
    ],
  },
];

const ANNUAL_DISCOUNT = 0.75; // 25% off annual

function TierCard({ tier, billing }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePerks = 3;
  const hasMore = tier.perks.length > visiblePerks;
  const TierIcon = TIER_ICON[tier.name] || Circle;

  // Price shown depends on billing toggle. Custom tier has no price.
  const displayPrice = tier.price
    ? (billing === 'annual' ? Math.round(tier.price * 12 * ANNUAL_DISCOUNT) : tier.price)
    : null;
  const priceSuffix = tier.price ? (billing === 'annual' ? '/year' : '/mo') : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`flex-shrink-0 w-[85vw] max-w-[340px] sm:w-[280px] md:w-auto relative border rounded-3xl p-4 md:p-5 flex flex-col ${tier.isMostPopular ? 'border-foreground bg-card' : 'border-border bg-card'}`}
    >
      {tier.isMostPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-foreground text-background text-[10px] tracking-[0.25em] uppercase font-semibold">
          Most Popular
        </div>
      )}

      {/* Tier name row */}
      <div className="flex items-center gap-2 mb-3">
        <TierIcon className="w-4 h-4 text-accent" strokeWidth={1.5} />
        <h3 className="font-heading text-xl tracking-wide text-foreground uppercase">{tier.name}</h3>
      </div>

      {/* Price or tagline */}
      {tier.price ? (
        <div className="mb-4">
          <div className="font-heading text-5xl md:text-6xl text-foreground leading-none tracking-tight">
            <AnimatedNumber value={displayPrice} prefix="$" duration={0.9} />
          </div>
          <div className="font-body text-xs tracking-widest uppercase text-muted-foreground mt-1">{priceSuffix}</div>
        </div>
      ) : (
        <div className="mb-4">
          <p className="font-heading text-2xl md:text-3xl text-foreground leading-tight tracking-wide">{tier.tagline}</p>
          <p className="font-body text-xs md:text-sm text-muted-foreground mt-2 leading-relaxed">{tier.description}</p>
        </div>
      )}

      {/* Perks */}
      <div className="mb-3 pt-3 border-t border-border/60">
        <ul className="space-y-1.5">
          {tier.perks.slice(0, visiblePerks).map((perk) => (
            <li key={perk} className="flex items-start gap-2">
              <Plus className="w-3 h-3 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
              <span className="font-body text-xs text-foreground leading-snug">{perk}</span>
            </li>
          ))}
        </ul>
        <AnimatePresence initial={false}>
          {expanded && hasMore && (
            <motion.ul
              key="more-perks"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-1.5 overflow-hidden"
            >
              {tier.perks.slice(visiblePerks).map((perk) => (
                <li key={perk} className="flex items-start gap-2 pt-1.5">
                  <Plus className="w-3 h-3 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="font-body text-xs text-foreground leading-snug">{perk}</span>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {!hasMore && <div className="mb-3" />}

      <Link
        to={tier.isCustom ? '/apply?tier=custom' : APPLY_URL}
        className={`block text-center py-3 font-body text-sm tracking-widest uppercase font-semibold rounded-full transition-colors mt-auto ${tier.isMostPopular ? 'bg-foreground text-background hover:bg-foreground/90' : 'border border-foreground/30 text-foreground hover:border-foreground'}`}
      >
        {tier.isCustom ? 'Design Your Protocol' : 'Apply for Membership'}
      </Link>
    </motion.div>
  );
}

export default function MembershipSection() {
  const [billing, setBilling] = useState('monthly');
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'right' ? delta : -delta, behavior: 'smooth' });
  };

  return (
    <section id="membership" className="py-8 md:py-6 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-4 md:mb-8"
        >
          <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4">Presale — Limited Availability</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide md:whitespace-nowrap">MEMBERSHIP</h2>
          <p className="font-body text-sm md:text-base text-foreground/85 mt-4 max-w-xl">
            One membership. Pick your protocol at every booking. Credits roll over. Apply-only — available soon in the San Francisco Bay Area.
          </p>
        </motion.div>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 rounded-full text-xs tracking-widest uppercase font-body transition-colors ${billing === 'monthly' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className={`px-4 py-2 rounded-full text-xs tracking-widest uppercase font-body transition-colors ${billing === 'annual' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Annual — Save 25%
            </button>
          </div>
        </div>

        {/* Tier cards — horizontal scroll on mobile, 4-col grid on desktop */}
        <div className="relative">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/70 backdrop-blur-md border border-border"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/70 backdrop-blur-md border border-border"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
          <div
            ref={scrollRef}
            className="overflow-x-auto overflow-y-visible no-scrollbar md:overflow-visible md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 lg:gap-6 flex gap-4 pb-3 px-4 md:px-0"
          >
            {TIERS.map((tier) => (
              <TierCard key={tier.name} tier={tier} billing={billing} />
            ))}
          </div>
        </div>

        <p className="font-body text-xs text-muted-foreground/80 text-center mt-6 md:mt-8 max-w-2xl mx-auto leading-relaxed">
          3-month minimum commitment. Credits roll over month-to-month as long as your membership remains active. Presale spots are limited — membership subject to approval.
        </p>
      </div>
    </section>
  );
}
