import React, { useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { FEATURED_SUBSCRIPTION_TIER_KEY, SUBSCRIPTION_TIERS } from '@/config/subscriptionTiers';

const EASE = [0.16, 1, 0.3, 1];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const tiers = SUBSCRIPTION_TIERS.map((tier) => ({ ...tier, perks: tier.benefits }));

function PlanBuilder({ tier }) {
  const builder = [
    {
      label: 'Monthly visits',
      value: tier.custom ? 'Custom' : `${tier.sessions}`,
      sub: tier.custom ? 'Set cadence' : 'RN visits',
    },
    {
      label: 'Add-ons',
      value: tier.custom ? 'Custom' : tier.discount,
      sub: 'Eligible upgrades',
    },
    {
      label: 'Control',
      value: tier.custom ? 'Designed' : 'Flexible',
      sub: tier.custom ? 'Your schedule' : 'Pause with notice',
    },
  ];

  return (
    <motion.div className="mt-5 grid gap-2 sm:grid-cols-3" {...fadeUp}>
      {builder.map((item) => (
        <div key={item.label} className="rounded-[1rem] border border-foreground/10 bg-foreground/[0.025] p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/38">{item.label}</p>
          <p className="mt-2 font-heading text-3xl uppercase leading-none text-foreground">{item.value}</p>
          <p className="mt-1 font-body text-[11px] leading-snug text-foreground/48">{item.sub}</p>
        </div>
      ))}
    </motion.div>
  );
}

function FeaturedTier({ tier, onSelect }) {
  const concisePerks = tier.perks.slice(0, tier.custom ? 4 : 3);
  const actionLabel = tier.custom ? 'Design Custom' : `Start ${tier.name}`;

  return (
    <motion.div
      className="rounded-[1.5rem] border border-accent/35 bg-card/60 p-5 shadow-[0_24px_90px_hsl(var(--foreground)/0.14)] backdrop-blur-xl md:p-7"
      {...fadeUp}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">{tier.badge || tier.tagline}</p>
          <h3 className="mt-2 font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">{tier.name}</h3>
        </div>
        <div className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5">
          <span className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground">{tier.sessions ? `${tier.sessions}/mo` : 'Custom'}</span>
        </div>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className="font-heading text-6xl leading-none text-foreground">{tier.price ? `$${tier.price.toLocaleString()}` : 'Custom'}</span>
        <span className="mb-1 font-body text-sm text-foreground/45">{tier.unit}</span>
      </div>
      <p className="mt-1 font-body text-xs uppercase tracking-[0.14em] text-foreground/45">{tier.perSessionNote}</p>

      <div className="my-5 h-px bg-foreground/[0.08]" />

      <ul className="space-y-2.5">
        {concisePerks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} />
            <span className="font-body text-sm leading-snug text-foreground/68">{perk}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(tier)}
        className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-xs font-semibold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-85"
      >
        {actionLabel} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </motion.div>
  );
}

function TierSwitch({ tier, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tier)}
      aria-pressed={active}
      className={`min-h-[58px] rounded-2xl border px-3 text-left transition-colors ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-foreground/10 bg-foreground/[0.025] text-foreground hover:border-foreground/25 hover:bg-foreground/[0.045]'
      }`}
    >
      <span className="block font-body text-[9px] uppercase tracking-[0.2em] opacity-55">{tier.tagline}</span>
      <span className="mt-1 block font-body text-[11px] font-semibold uppercase tracking-[0.18em]">{tier.name}</span>
    </button>
  );
}

export default function Subscription() {
  useSeo({
    title: 'Subscriptions — Avalon Vitality',
    description: 'Monthly IV therapy subscriptions starting from $199/mo. Credits roll over, no long-term lock-in.',
    path: '/subscription',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Avalon Vitality Subscriptions',
      description: 'Monthly mobile IV therapy subscription plans with credits, rollover flexibility, and subscriber pricing across the SF Bay Area.',
      brand: {
        '@type': 'Brand',
        name: 'Avalon Vitality',
      },
      url: 'https://www.avalonvitality.co/subscription',
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '199',
        highPrice: '899',
        offerCount: '3',
        availability: 'https://schema.org/InStock',
      },
    },
  });
  const navigate = useNavigate();
  const [activeTierKey, setActiveTierKey] = useState(FEATURED_SUBSCRIPTION_TIER_KEY);
  const activeTier = tiers.find((tier) => tier.key === activeTierKey) || tiers[1];
  const activeActionLabel = activeTier.custom ? 'Design Custom Protocol' : `Start ${activeTier.name}`;
  const switchTier = (tier) => setActiveTierKey(tier.key);
  const selectTier = (tier) => {
    const outcome = tier.custom ? 'longevity' : 'recover';
    navigate(`/book?reset=1&outcome=${outcome}&subscription=${tier.key}`);
  };

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-[4.5rem] md:pt-24 pb-28 md:pb-0">

        {/* Tier Cards */}
        <section id="subscription-plans" className="scroll-mt-24 py-8 md:py-12 px-5 md:px-12 lg:px-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid gap-5 md:grid-cols-[0.92fr_1.08fr] md:items-center">
              <div>
                <motion.h1 className="font-heading text-5xl uppercase leading-[0.9] text-foreground md:text-7xl" {...fadeUp}>
                  Build your plan
                </motion.h1>
                <motion.p className="mt-4 max-w-md font-body text-sm leading-relaxed text-foreground/58" {...fadeUp}>
                  Monthly visits. Add-ons. Pause anytime.
                </motion.p>
              </div>

              <div className="space-y-3">
                <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-4" {...fadeUp}>
                  {tiers.map((tier) => (
                    <TierSwitch key={tier.key} tier={tier} active={activeTier.key === tier.key} onSelect={switchTier} />
                  ))}
                </motion.div>
                <PlanBuilder tier={activeTier} />
                <FeaturedTier tier={activeTier} onSelect={selectTier} />
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />

      <motion.div
        className="md:hidden fixed inset-x-0 z-40 px-2 pt-1 pointer-events-none"
        style={{ bottom: 'max(env(safe-area-inset-bottom), 0.2rem)' }}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
      >
        <div className="pointer-events-auto rounded-[1.1rem] border border-foreground/10 bg-background/85 backdrop-blur-2xl shadow-[0_-12px_36px_rgba(0,0,0,0.22)] p-1">
          <button
            onClick={() => selectTier(activeTier)}
            className="min-h-[44px] w-full rounded-full bg-foreground px-3.5 font-body text-[9px] font-semibold tracking-[0.15em] uppercase text-background flex items-center justify-center gap-1.5"
          >
            {activeActionLabel} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>

    </div>
  );
}
