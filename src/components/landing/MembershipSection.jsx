import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle, CircleDot, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion(Link);

const TIERS = [
  {
    icon: Circle,
    name: 'Starter',
    price: '$200',
    unit: '/mo',
    note: '1 IV per month',
    benefits: [
      '1 core IV credit per month',
      '15% off add-ons & extras',
      'Same-day priority booking',
      '3-month minimum commitment',
    ],
    href: '/subscription',
  },
  {
    icon: CircleDot,
    name: 'Premium',
    price: '$400',
    unit: '/mo',
    note: '2 IVs per month',
    benefits: [
      '2 IV credits per month',
      '1 advanced drip credit (up to $250 value)',
      '20% off add-ons & extras',
      '1 free add-on per visit',
      '90-minute guaranteed arrival window',
    ],
    href: '/subscription',
  },
  {
    icon: Sparkles,
    name: 'VIP',
    price: '$800',
    unit: '/mo',
    note: '4 IVs per month',
    benefits: [
      '4 IV credits per month',
      '1 NAD+ 500mg or Exosomes 30B credit',
      '25% off add-ons & extras',
      'Unlimited add-ons at subscriber rate',
      'Dedicated nurse — 90-min window',
      'Shareable with one designated partner',
    ],
    href: '/subscription',
  },
];

const COMPARE_ROWS = [
  { label: 'Monthly IV credits',       starter: '1',     premium: '2',      vip: '4'    },
  { label: 'Advanced drip credit',     starter: '—',     premium: '1×/mo',  vip: '1×/mo' },
  { label: 'NAD+ / Exosomes credit',   starter: '—',     premium: '—',      vip: '1×/mo' },
  { label: 'Add-on discount',          starter: '15%',   premium: '20%',    vip: '25%'  },
  { label: 'Free add-on per visit',    starter: '—',     premium: '1',      vip: 'Unlimited' },
  { label: 'Arrival window',           starter: 'Standard', premium: '90 min', vip: '90 min' },
  { label: 'Dedicated nurse',          starter: '—',     premium: '—',      vip: '✓'    },
  { label: 'Share with partner',       starter: '—',     premium: '—',      vip: '✓'    },
];

function TierComparator() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-foreground/[0.08] overflow-hidden mb-2">
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.99 }}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white/[0.03] hover:bg-white/[0.055] transition-colors"
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

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-foreground/[0.07]">
              {/* Header */}
              <div className="grid grid-cols-[1fr_60px_60px_60px] md:grid-cols-[1fr_80px_80px_80px] border-b border-foreground/[0.07] bg-white/[0.02]">
                <div className="px-4 py-2.5" />
                {['Starter', 'Premium', 'VIP'].map((t) => (
                  <div key={t} className="py-2.5 text-center">
                    <span className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40">{t}</span>
                  </div>
                ))}
              </div>
              {/* Rows */}
              {COMPARE_ROWS.map(({ label, starter, premium, vip }, i) => (
                <div
                  key={label}
                  className={`grid grid-cols-[1fr_60px_60px_60px] md:grid-cols-[1fr_80px_80px_80px] border-b border-foreground/[0.05] last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                >
                  <div className="px-4 py-3 flex items-center">
                    <span className="font-body text-[11px] text-foreground/60">{label}</span>
                  </div>
                  {[starter, premium, vip].map((val, j) => (
                    <div key={j} className="py-3 flex items-center justify-center">
                      <span className={`font-body text-[11px] text-center ${val === '—' ? 'text-foreground/20' : j === 2 ? 'text-accent' : 'text-foreground/75'}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TierRow({ tier, index }) {
  const Icon = tier.icon;
  return (
    <motion.div
      whileHover={premiumHover}
      className="rounded-2xl border border-foreground/10 bg-white/[0.08] px-5 py-4 flex items-center justify-between shadow-[0_18px_70px_hsl(var(--foreground)/0.035)] transition-colors duration-base ease-editorial hover:border-foreground/20 hover:bg-white/[0.105]"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-foreground/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-heading text-lg tracking-[0.08em] text-foreground uppercase leading-none">{tier.name}</p>
          <p className="font-body text-[10px] text-foreground/40 tracking-[0.1em] mt-0.5">{tier.note}</p>
        </div>
      </div>
      <div className="text-right">
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
            <p className="font-body text-[11px] tracking-[0.3em] text-accent uppercase mb-2">Vitality Tiers</p>
            <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground tracking-tight leading-[0.92] uppercase">
              Subscriptions
            </h2>
            <p className="font-body text-sm text-foreground/55 leading-relaxed mt-3 max-w-md">
              Built for people who want recovery to be part of the calendar, not another errand.
            </p>
          </div>
        </motion.div>

        {/* Tier accordion rows */}
        <div className="space-y-2 mb-4">
          {TIERS.map((tier, i) => (
            <TierRow key={tier.name} tier={tier} index={i} />
          ))}
        </div>

        {/* Tier comparator */}
        <TierComparator />

        <div className="mt-6">
          <MotionLink
            to="/subscription"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group w-full flex items-center justify-center gap-2 py-4 rounded-full border border-foreground/20 text-foreground font-body text-xs tracking-[0.2em] uppercase hover:bg-white/[0.08] hover:border-foreground/35 transition-all duration-base ease-editorial"
          >
            VIEW SUBSCRIPTIONS
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        </div>

        <p className="font-body text-[10px] text-foreground/30 tracking-[0.15em] mt-4">
          3-month minimum · credits roll over · subject to clinical approval
        </p>

      </div>
    </section>
  );
}
