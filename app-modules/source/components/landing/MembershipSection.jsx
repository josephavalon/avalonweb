import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { EASE, premiumExpandTransition, premiumHover, premiumTap } from '@/lib/motion';
import { BOOKABLE_SUBSCRIPTION_TIERS } from '@/config/subscriptionTiers';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import ScrollParallax from '@/components/ui/ScrollParallax';
import { SUBSCRIPTION_COMMITMENT_COPY } from '@/lib/subscription';

const MotionLink = motion.create(Link);

// subscriptionTiers.js is the single source of truth for visit-credit
// pricing now (sessions × $250). Just format the numeric price for display
// and add the deep-link to the /subscription builder.
const TIERS = BOOKABLE_SUBSCRIPTION_TIERS.map((tier) => ({
  ...tier,
  priceLabel: typeof tier.price === 'number' ? `$${tier.price.toLocaleString()}` : tier.price,
  originalPriceLabel: typeof tier.originalPrice === 'number' ? `$${tier.originalPrice.toLocaleString()}` : null,
  href: '/subscription',
}));

function planDetails(tier) {
  const details = [
    `${tier.sessions} visit${tier.sessions === 1 ? '' : 's'} per month`,
    'Any therapy · add-ons a la carte',
    'Save up to 15% paying upfront',
    'Priority booking window',
  ];

  if (tier.key === 'vip') {
    details.push('Dedicated registered nurse');
    details.push('Household partner sharing');
  }

  return details;
}

function TierRow({ tier, index, open, onToggle }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.84, ease: EASE, delay: index * 0.18, layout: premiumExpandTransition }}
      whileHover={premiumHover}
      className={`av-treatment-card relative overflow-hidden rounded-[1.55rem] border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="relative flex min-h-[92px] w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-heading text-2xl uppercase leading-none tracking-[0.06em] text-foreground/72 md:text-3xl">{tier.name}</p>
          </div>
          <p className="mt-1 font-body text-[11px] uppercase tracking-[0.12em] text-foreground/42">{tier.note}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-right">
          <div>
            <span className="block font-body text-[11px] uppercase tracking-[0.12em] text-foreground/38">
              {tier.discountPercent ? `Save ${tier.discountPercent}%` : 'From'}
            </span>
            <span className="flex items-baseline justify-end gap-1.5">
              {tier.originalPriceLabel && (
                <span className="font-body text-[13px] tabular-nums text-foreground/35 line-through">{tier.originalPriceLabel}</span>
              )}
              <span className="font-heading text-2xl leading-none tracking-wide tabular-nums text-foreground/82">{tier.priceLabel}</span>
            </span>
            {tier.unit && <span className="ml-0.5 font-body text-[11px] tabular-nums text-foreground/32">{tier.unit}</span>}
          </div>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.06] text-foreground/52"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </motion.span>
        </div>
      </button>

      <SmoothDisclosure open={open}>
        <div className="border-t border-foreground/[0.08] px-5 pb-4 pt-1">
          <div className="grid gap-2 md:grid-cols-2">
            {planDetails(tier).map((detail) => (
              <div key={detail} className="flex min-h-[38px] items-center gap-2 rounded-xl border border-foreground/[0.07] bg-background/80 px-3">
                <Check className="h-3.5 w-3.5 shrink-0 text-foreground/54" strokeWidth={1.9} />
                <span className="font-body text-[11px] leading-snug text-foreground/58">{detail}</span>
              </div>
            ))}
          </div>

          <MotionLink
            to={`/subscription?sessions=${tier.sessions}`}
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 font-body text-sm uppercase tracking-[0.2em] text-background transition-colors duration-base ease-editorial"
          >
            Start {tier.name}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        </div>
      </SmoothDisclosure>
    </motion.div>
  );
}

export default function MembershipSection() {
  const [openTierKey, setOpenTierKey] = useState(null);

  return (
    <section id="subscription" className="pt-10 pb-10 md:pt-16 md:pb-16 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <ScrollParallax className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
          <div>
            <h2 className="font-heading text-display text-foreground tracking-tight leading-[0.92] uppercase">
              Plans
            </h2>
          </div>
        </ScrollParallax>

        {/* Tier accordion rows */}
        <LayoutGroup id="membership-tiers">
          <div className="space-y-2 mb-4">
            {TIERS.map((tier, i) => (
              <TierRow
                key={tier.name}
                tier={tier}
                index={i}
                open={openTierKey === tier.key}
                onToggle={() => setOpenTierKey((current) => (current === tier.key ? null : tier.key))}
              />
            ))}
          </div>
        </LayoutGroup>

        <div className="mt-6">
          <MotionLink
            to="/subscription"
            whileHover={premiumHover}
            whileTap={premiumTap}
            style={{ background: '#fff', color: '#000' }}
            className="group w-full flex items-center justify-center gap-3 py-4 md:py-5 rounded-full font-heading text-xl uppercase leading-none tracking-[0.08em] md:text-2xl lg:text-[1.7rem] transition-transform duration-base ease-editorial active:scale-[0.99]"
          >
            Build my plan
            <ArrowRight className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        </div>

        <p className="font-body text-[11px] text-foreground/30 tracking-[0.15em] mt-4">
          {SUBSCRIPTION_COMMITMENT_COPY}
        </p>

      </div>
    </section>
  );
}
