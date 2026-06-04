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
  initial: { opacity: 1, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: EASE },
};

const tiers = SUBSCRIPTION_TIERS.map((tier) => ({ ...tier, perks: tier.benefits }));
const SUBSCRIPTION_TERMS = [
  { key: 'monthly', label: 'Monthly', detail: '3 mo min', multiplier: 1, discount: 0 },
  { key: 'six-month', label: '6 months', detail: '8% off', multiplier: 6, discount: 0.08 },
  { key: 'annual', label: '12 months', detail: '15% off', multiplier: 12, discount: 0.15 },
];

function termPrice(monthlyPrice, term) {
  if (!monthlyPrice || !term) return 0;
  return Math.max(0, Math.round(Number(monthlyPrice) * term.multiplier * (1 - term.discount)));
}

function planPriceLabel(tier, term) {
  if (tier.custom || !tier.price) return 'Custom';
  return `$${termPrice(tier.price, term).toLocaleString()}`;
}

function unitLabel(tier, term) {
  if (tier.custom) return 'Designed with Avalon';
  return term.key === 'monthly' ? '/mo' : 'due today';
}

function actionLabel(tier) {
  return tier.custom ? 'Design plan' : `Start ${tier.name}`;
}

function planCommitmentCopy(tier, term) {
  if (tier.custom) return 'Concierge plan design.';
  if (term.key === 'monthly') return 'First month due today. 3-month minimum.';
  return `${term.label} prepaid. ${term.detail}.`;
}

function SelectCheck({ active }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-base ease-editorial ${
        active ? 'border-foreground/35 bg-foreground/[0.1]' : 'border-foreground/14 bg-background/20'
      }`}
      aria-hidden="true"
    >
      {active && <Check className="h-3.5 w-3.5 text-foreground/74" strokeWidth={1.8} />}
    </span>
  );
}

function TierCard({ tier, active, onSelect, term }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tier)}
      aria-pressed={active}
      className={`av-treatment-card group relative flex min-h-[116px] w-full flex-col items-stretch justify-between gap-3 overflow-hidden rounded-[1.15rem] border px-4 py-4 text-left transition-colors duration-base ease-editorial md:min-h-[132px] md:flex-row md:items-center md:gap-4 md:px-5 ${
        active ? 'is-open' : ''
      }`}
    >
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 font-heading text-2xl uppercase leading-none tracking-[0.04em] text-foreground/76 md:text-3xl">
            {tier.name}
          </p>
          {tier.badge && (
            <span className="rounded-full border border-foreground/12 bg-background/24 px-2 py-1 font-body text-[8px] font-semibold uppercase tracking-[0.14em] text-foreground/46">
              {tier.badge}
            </span>
          )}
        </div>
        <p className="mt-2 font-body text-[11px] uppercase tracking-[0.12em] text-foreground/42">{tier.note}</p>
        <p className="mt-1 max-w-[17rem] font-body text-xs leading-snug text-foreground/52">{tier.tagline}</p>
      </div>

      <div className="relative flex min-w-0 shrink-0 items-center justify-between gap-3 md:justify-end">
        <SelectCheck active={active} />
        <div className="min-w-0 text-right">
          <p className="font-heading text-2xl leading-none text-foreground/72 md:text-3xl">{planPriceLabel(tier, term)}</p>
          <p className="mt-1 max-w-[8.5rem] font-body text-[9px] uppercase leading-snug tracking-[0.1em] text-foreground/38 md:max-w-none md:text-[10px] md:tracking-[0.12em]">
            {unitLabel(tier, term)}
          </p>
        </div>
      </div>
    </button>
  );
}

function TermCard({ term, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(term.key)}
      aria-pressed={active}
      className={`av-treatment-card relative flex min-h-[86px] w-full items-center justify-between gap-4 overflow-hidden rounded-[1.05rem] border px-4 py-3 text-left transition-colors duration-base ease-editorial md:min-h-[96px] ${
        active ? 'is-open' : ''
      }`}
    >
      <div>
        <p className="font-heading text-xl uppercase leading-none tracking-[0.04em] text-foreground/72">{term.label}</p>
        <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em] text-foreground/40">{term.detail}</p>
      </div>
      <SelectCheck active={active} />
    </button>
  );
}

function PlanSummary({ tier, term, onSelect, className = '' }) {
  return (
    <div className={`av-treatment-card overflow-hidden rounded-[1.15rem] border p-4 md:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/42">Due today</p>
          <p className="mt-1 font-heading text-4xl uppercase leading-none text-foreground/76">{planPriceLabel(tier, term)}</p>
        </div>
        <div className="max-w-[9.5rem] text-right">
          <p className="font-body text-[10px] uppercase tracking-[0.16em] text-foreground/42">{tier.name}</p>
          <p className="mt-1 font-body text-xs leading-snug text-foreground/54">{planCommitmentCopy(tier, term)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground/[0.09] px-5 font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground transition-colors duration-base ease-editorial hover:bg-foreground/[0.13]"
      >
        {actionLabel(tier)} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

export default function Subscription() {
  useSeo({
    title: 'Subscriptions - Avalon Vitality',
    description: 'Monthly IV therapy subscriptions starting from $199/mo. First month due now with a 3-month commitment. Prepay 6 or 12 months for savings.',
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
  const [activeTermKey, setActiveTermKey] = useState('monthly');
  const activeTier = tiers.find((tier) => tier.key === activeTierKey) || tiers[1];
  const activeTerm = SUBSCRIPTION_TERMS.find((term) => term.key === activeTermKey) || SUBSCRIPTION_TERMS[0];

  const switchTier = (tier) => setActiveTierKey(tier.key);
  const selectTier = () => {
    const params = new URLSearchParams({
      reset: '1',
      subscription: activeTier.key,
      term: activeTerm.key,
      protocol: 'recovery',
      time: 'asap',
    });
    navigate(`/book?${params.toString()}`);
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <Navbar />
      <main className="min-h-screen overflow-x-hidden pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[4.75rem] md:pb-16 md:pt-24">
        <section id="subscription-plans" className="mx-auto w-full max-w-[calc(100vw-2rem)] scroll-mt-24 py-4 md:max-w-6xl md:px-8 md:py-10">
          <motion.header className="mb-5 md:mb-8" {...fadeUp}>
            <p className="font-body text-[10px] uppercase tracking-[0.24em] text-foreground/38">Membership</p>
            <h1 className="mt-2 font-heading text-6xl uppercase leading-[0.85] text-foreground md:text-8xl">Plans</h1>
            <div className="mt-3 flex max-w-full flex-col gap-1 font-body text-xs uppercase tracking-[0.14em] text-foreground/44 md:flex-row md:flex-wrap md:items-center md:gap-x-3 md:gap-y-1 md:text-sm">
              <span>Choose your cadence.</span>
              <span className="hidden h-1 w-1 rounded-full bg-foreground/24 md:block" aria-hidden="true" />
              <span>First month due today.</span>
              <span className="hidden h-1 w-1 rounded-full bg-foreground/24 md:block" aria-hidden="true" />
              <span>3-month minimum.</span>
            </div>
          </motion.header>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)] md:gap-5">
            <motion.div className="space-y-2.5" {...fadeUp}>
              {tiers.map((tier) => (
                <TierCard
                  key={tier.key}
                  tier={tier}
                  active={activeTier.key === tier.key}
                  onSelect={switchTier}
                  term={activeTerm}
                />
              ))}
            </motion.div>

            <motion.aside className="space-y-2.5 md:sticky md:top-24 md:self-start" {...fadeUp}>
              <div className="space-y-2">
                {SUBSCRIPTION_TERMS.map((term) => (
                  <TermCard
                    key={term.key}
                    term={term}
                    active={activeTerm.key === term.key}
                    onSelect={setActiveTermKey}
                  />
                ))}
              </div>
              <PlanSummary tier={activeTier} term={activeTerm} onSelect={selectTier} className="hidden md:block" />
            </motion.aside>
          </div>
        </section>
      </main>
      <Footer />

      <motion.div
        className="pointer-events-none fixed inset-x-0 z-40 px-2 pt-1 md:hidden"
        style={{ bottom: 'max(env(safe-area-inset-bottom), 0.2rem)' }}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE, delay: 0.08 }}
      >
        <div className="av-treatment-card pointer-events-auto rounded-[1.1rem] border p-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 px-2">
              <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/40">Due today</p>
              <div className="flex items-baseline gap-2">
                <p className="font-heading text-2xl uppercase leading-none text-foreground/78">{planPriceLabel(activeTier, activeTerm)}</p>
                <p className="truncate font-body text-[10px] uppercase tracking-[0.1em] text-foreground/40">{activeTier.name}</p>
              </div>
            </div>
            <button
              onClick={selectTier}
              className="flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-foreground/18 bg-foreground/[0.09] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground"
            >
              {activeTier.custom ? 'Design' : 'Start'} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
