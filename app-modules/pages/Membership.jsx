import React, { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Check } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const SubscriptionCheckoutDrawer = lazy(() => import('@/components/subscription/SubscriptionCheckoutDrawer'));
const SubscriptionFaq = lazy(() => import('@/components/subscription/SubscriptionFaq'));

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
      'Plan scheduling portal',
    ],
  },
  {
    name: 'Pro',
    sessions: 2,
    tagline: 'The sweet spot.',
    badge: 'Recommended',
    price: 389,
    unit: '/mo',
    perSessionNote: '$195 / session',
    perks: [
      '2 IV session credits per month',
      '25% off all add-ons',
      '1 complimentary IM shot per month',
      'Priority booking window',
      'Plan scheduling portal',
    ],
  },
  {
    name: 'VIP',
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
    name: 'Custom',
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
  const [selectedTier, setSelectedTier] = useState(null);
  const [activeTierName, setActiveTierName] = useState('Pro');
  const activeTier = tiers.find((tier) => tier.name === activeTierName) || tiers[1];
  const activeActionLabel = activeTier.custom ? 'Design Custom Protocol' : `Start ${activeTier.name}`;
  const switchTier = (tier) => setActiveTierName(tier.name);

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-[4.5rem] md:pt-24 pb-28 md:pb-0">

        {/* Tier Cards */}
        <section id="subscription-plans" className="scroll-mt-24 py-8 md:py-12 px-5 md:px-12 lg:px-20">
          <div className="max-w-6xl mx-auto">
            <motion.p className="font-body text-[11px] tracking-[0.28em] uppercase text-foreground/45 mb-3" {...fadeUp}>
              Plans
            </motion.p>
            <div className="grid gap-5 md:grid-cols-[0.92fr_1.08fr] md:items-center">
              <div>
                <motion.h1 className="font-heading text-5xl uppercase leading-[0.9] text-foreground md:text-7xl" {...fadeUp}>
                  Subscriptions
                </motion.h1>
                <motion.p className="mt-4 max-w-md font-body text-sm leading-relaxed text-foreground/58" {...fadeUp}>
                  Pick a tier. Switch instantly. Adjust anytime.
                </motion.p>
                <motion.div className="mt-6 flex flex-wrap gap-2" {...fadeUp}>
                  <span className="rounded-full border border-foreground/10 px-3 py-1.5 font-body text-[11px] text-foreground/55">Priority booking</span>
                  <span className="rounded-full border border-foreground/10 px-3 py-1.5 font-body text-[11px] text-foreground/55">Add-on savings</span>
                  <span className="rounded-full border border-foreground/10 px-3 py-1.5 font-body text-[11px] text-foreground/55">Pause anytime</span>
                </motion.div>
              </div>

              <div className="space-y-3">
                <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-4" {...fadeUp}>
                  {tiers.map((tier) => (
                    <TierSwitch key={tier.name} tier={tier} active={activeTier.name === tier.name} onSelect={switchTier} />
                  ))}
                </motion.div>
                <FeaturedTier tier={activeTier} onSelect={setSelectedTier} />
              </div>
            </div>
          </div>
        </section>

        {/* Pause / Cancel Policy */}
        <Reveal as="section" className="py-10 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              {...fadeUp}
            >
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">Flexibility</p>
                <p className="font-body text-sm text-foreground/60 max-w-xl">
                  Pause anytime. Cancel after 3 months with 7 days notice.
                </p>
              </div>
              <button
                onClick={() => setSelectedTier(activeTier)}
                className="flex-shrink-0 px-8 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors text-center"
              >
                {activeActionLabel}
              </button>
            </motion.div>
          </div>
        </Reveal>

        <Suspense fallback={null}>
          <SubscriptionFaq />
        </Suspense>

        {/* Bottom CTA */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto text-center">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Ready
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6" {...fadeUp}>
              {activeTier.custom ? 'Custom Plan' : `Start ${activeTier.name}`}
            </motion.h2>
            <motion.p className="font-body text-sm text-foreground/50 mb-10 max-w-sm mx-auto" {...fadeUp}>
              {activeTier.perSessionNote}
            </motion.p>
            <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6" {...fadeUp}>
              <button
                onClick={() => setSelectedTier(activeTier)}
                className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
              >
                {activeActionLabel} <ArrowRight className="w-3.5 h-3.5" />
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
        className="md:hidden fixed inset-x-0 z-40 px-2 pt-1 pointer-events-none"
        style={{ bottom: 'max(env(safe-area-inset-bottom), 0.2rem)' }}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
      >
        <div className="pointer-events-auto rounded-[1.1rem] border border-foreground/10 bg-background/85 backdrop-blur-2xl shadow-[0_-12px_36px_rgba(0,0,0,0.22)] p-1">
          <button
            onClick={() => setSelectedTier(activeTier)}
            className="min-h-[44px] w-full rounded-full bg-foreground px-3.5 font-body text-[9px] font-semibold tracking-[0.15em] uppercase text-background flex items-center justify-center gap-1.5"
          >
            {activeActionLabel} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Checkout Drawer */}
      <AnimatePresence>
        {selectedTier && (
          <Suspense fallback={null}>
            <SubscriptionCheckoutDrawer tier={selectedTier} onClose={() => setSelectedTier(null)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
