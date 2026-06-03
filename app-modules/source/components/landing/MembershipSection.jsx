import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import { Circle, CircleDot, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { EASE, premiumExpandTransition, premiumHover, premiumListContainer, premiumListItem, premiumTap } from '@/lib/motion';
import { BOOKABLE_SUBSCRIPTION_TIERS, FEATURED_SUBSCRIPTION_TIER_KEY } from '@/config/subscriptionTiers';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const MotionLink = motion.create(Link);

const ICONS = { starter: Circle, pro: CircleDot, vip: Sparkles };

const TIERS = BOOKABLE_SUBSCRIPTION_TIERS.map((tier) => ({
  ...tier,
  icon: ICONS[tier.key] || Circle,
  price: `$${tier.price.toLocaleString()}`,
  href: '/subscription',
}));

const COMPARE_ROWS = [
  { label: 'IV credits', values: ['Starter 1', 'Pro 2', 'VIP 4'] },
  { label: 'Add-ons', values: ['20%', '25%', '30%'] },
  { label: 'IM credits', values: ['Starter —', 'Pro 1/mo', 'VIP 2/mo'] },
  { label: 'Priority', values: ['All plans'] },
  { label: 'Dedicated RN', values: ['VIP'] },
  { label: 'Household', values: ['VIP'] },
];

function TierComparator() {
  const [open, setOpen] = useState(false);
  return (
    <div className="av-treatment-card mb-2 overflow-hidden rounded-[1.35rem] border">
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.99 }}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-foreground/[0.04]"
        aria-expanded={open}
      >
        <span className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/50">Compare tiers</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="text-foreground/30"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.span>
      </motion.button>

      <SmoothDisclosure open={open}>
        <motion.div
          initial={false}
          animate={open ? 'show' : 'hidden'}
          variants={premiumListContainer(0.025, 0.03)}
          className="border-t border-foreground/[0.07]"
        >
              <div className="grid gap-2 p-3 md:grid-cols-3">
              {COMPARE_ROWS.map(({ label, values }, i) => (
                <motion.div
                  key={label}
                  variants={premiumListItem}
                  className="relative min-h-[92px] overflow-hidden rounded-2xl border border-foreground/[0.07] bg-background/32 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl"
                >
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,hsl(var(--foreground)/0.07),transparent_34%),linear-gradient(135deg,hsl(var(--foreground)/0.035),transparent_55%)]" />
                  <div className="relative">
                    <p className="font-body text-[10px] font-black uppercase tracking-[0.16em] text-foreground/52">{label}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {values.map((value) => (
                        <span key={value} className={`rounded-full border px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em] ${value.includes('Pro') || value === '25%' ? 'border-accent/24 text-accent' : 'border-foreground/10 text-foreground/64'}`}>
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
              </div>
        </motion.div>
      </SmoothDisclosure>
    </div>
  );
}

function TierRow({ tier, index }) {
  const Icon = tier.icon;
  const featured = tier.key === FEATURED_SUBSCRIPTION_TIER_KEY;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.84, ease: EASE, delay: index * 0.18, layout: premiumExpandTransition }}
      whileHover={premiumHover}
      className={`av-treatment-card relative flex items-center justify-between overflow-hidden rounded-[1.55rem] border px-5 py-4 transition-colors duration-base ease-editorial ${featured ? 'is-open' : ''}`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,hsl(var(--foreground)/0.10),transparent_34%),radial-gradient(circle_at_90%_80%,hsl(var(--foreground)/0.045),transparent_32%)]" />
      {featured && (
        <motion.span
          className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-foreground/34 to-transparent"
          initial={{ opacity: 0, scaleX: 0.35 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
        />
      )}
      <div className="relative flex items-center gap-3">
        <div className="av-treatment-icon w-8 h-8 rounded-xl border flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-heading text-lg tracking-[0.08em] text-foreground uppercase leading-none">{tier.name}</p>
          <p className="font-body text-[10px] text-foreground/40 tracking-[0.1em] mt-0.5">{tier.note}</p>
        </div>
      </div>
      <div className="relative text-right">
        <span className="font-heading text-xl text-foreground tracking-wide">{tier.price}</span>
        {tier.unit && <span className="font-body text-[10px] text-foreground/30 ml-0.5">{tier.unit}</span>}
      </div>
    </motion.div>
  );
}

export default function MembershipSection() {
  return (
    <section id="subscription" className="pt-10 pb-10 md:pt-16 md:pb-16 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10"
        >
          <div>
            <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground tracking-tight leading-[0.92] uppercase">
              Plans
            </h2>
          </div>
        </motion.div>

        {/* Tier accordion rows */}
        <LayoutGroup id="membership-tiers">
          <div className="space-y-2 mb-4">
            {TIERS.map((tier, i) => (
              <TierRow key={tier.name} tier={tier} index={i} />
            ))}
          </div>
        </LayoutGroup>

        {/* Tier comparator */}
        <TierComparator />

        <div className="mt-6">
          <MotionLink
            to="/subscription"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group w-full flex items-center justify-center gap-2 py-4 rounded-full border border-foreground/20 text-foreground font-body text-xs tracking-[0.2em] uppercase hover:bg-white/[0.08] hover:border-foreground/35 transition-all duration-base ease-editorial"
          >
            Plans
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        </div>

        <p className="font-body text-[10px] text-foreground/30 tracking-[0.15em] mt-4">
          3-month minimum
        </p>

      </div>
    </section>
  );
}
