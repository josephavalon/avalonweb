import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import {
  Droplets, Zap, ShieldCheck, Sparkles, FlaskConical,
  Star, ArrowRight, ChevronDown, ChevronRight,
} from 'lucide-react';
import { EASE, premiumExpandTransition, premiumHover, premiumListContainer, premiumListItem, premiumTap } from '@/lib/motion';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const MotionLink = motion.create(Link);
const FOLDOUT_TRANSITION = { ...premiumExpandTransition };

// ── Data ─────────────────────────────────────────────────────────────────────

const SPECIALTY_IVS = [
  {
    label: 'NAD+',
    icon: FlaskConical,
    treatments: [
      { icon: FlaskConical, label: 'NAD+ 250mg',   price: 350 },
      { icon: FlaskConical, label: 'NAD+ 500mg',   price: 500 },
      { icon: FlaskConical, label: 'NAD+ 1000mg',  price: 750 },
    ],
  },
  {
    label: 'CBD',
    icon: Star,
    treatments: [
      { icon: Star, label: 'CBD — Low Dose',  price: 350 },
      { icon: Star, label: 'CBD — High Dose', price: 450 },
    ],
  },
  {
    label: 'Exosomes',
    icon: Sparkles,
    treatments: [
      { icon: Sparkles, label: 'Exosomes 30B',  price: 800 },
      { icon: Sparkles, label: 'Exosomes 50B',  price: 1200 },
      { icon: Sparkles, label: 'Exosomes 90B',  price: 1800 },
    ],
  },
];

const TOP_CATEGORIES = [
  {
    key: 'vitamin',
    label: 'HYDRATION',
    icon: Droplets,
    type: 'flat-treatments',
    data: [
      { icon: Droplets,    label: 'Hydration IV',  price: 150 },
      { icon: Zap,         label: 'Energy IV',     price: 250 },
      { icon: ShieldCheck, label: 'Immunity IV',   price: 250 },
      { icon: Sparkles,    label: 'Beauty IV',     price: 250 },
      { icon: Star,        label: 'Custom Visit',  price: 150 },
    ],
  },
  {
    key: 'energy',
    label: 'ENERGY',
    icon: Zap,
    type: 'flat-treatments',
    data: [
      { icon: Zap,         label: 'Energy IV',     price: 250 },
      { icon: FlaskConical, label: "Myers' Cocktail", price: 250 },
      { icon: ShieldCheck, label: 'Immunity IV',   price: 250 },
    ],
  },
  {
    key: 'specialty',
    label: 'LONGEVITY',
    icon: FlaskConical,
    type: 'nested',
    data: SPECIALTY_IVS,
  },
  {
    key: 'all',
    label: 'ALL PROTOCOLS',
    icon: ArrowRight,
    type: 'link',
    href: '/protocols',
  },
];

// ── Sub-category row (inside Vitamin / Specialty) ─────────────────────────────
function SubRow({ sub }) {
  const [open, setOpen] = useState(false);
  const Icon = sub.icon;

  return (
    <div className="av-treatment-subcard overflow-hidden rounded-xl border">
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors duration-base ease-editorial [@media(hover:hover)]:hover:bg-foreground/[0.035]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5 text-accent/70" strokeWidth={1.5} />
          <span className="font-body text-xs font-semibold tracking-[0.15em] uppercase text-foreground/80">{sub.label}</span>
          <span className="font-body text-[9px] text-foreground/30 tracking-[0.1em]">{sub.treatments.length} options</span>
        </div>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={FOLDOUT_TRANSITION} className="shrink-0 text-foreground/25">
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
        </motion.span>
      </motion.button>

      <SmoothDisclosure open={open}>
        <motion.div
          initial={false}
          animate={open ? 'show' : 'hidden'}
          variants={premiumListContainer(0.025, 0.03)}
          className="grid grid-cols-2 gap-1.5 border-t border-foreground/[0.06] px-4 pb-4 pt-3"
        >
              {sub.treatments.map((t) => (
                <MotionLink
                  key={t.label}
                  to="/book"
                  variants={premiumListItem}
                  className="av-treatment-chip flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-base ease-editorial group"
                >
                  <t.icon className="w-3 h-3 text-foreground/30 group-hover:text-accent transition-colors shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="font-body text-[11px] text-foreground/80 leading-snug truncate">{t.label}</p>
                    <p className="font-body text-[9px] text-foreground/35">From ${t.price}</p>
                  </div>
                </MotionLink>
              ))}
        </motion.div>
      </SmoothDisclosure>
    </div>
  );
}

// ── Top-level category row ────────────────────────────────────────────────────
function CategoryRow({ cat, index, open, onToggle }) {
  const Icon = cat.icon;

  if (cat.type === 'link') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-12%' }}
        transition={{ duration: 0.84, delay: index * 0.18, ease: EASE }}
        whileHover={premiumHover}
        className="av-treatment-card rounded-2xl border transition-colors duration-base ease-editorial"
      >
        <MotionLink
          to={cat.href}
          whileTap={premiumTap}
          className="group flex min-h-[88px] w-full items-center justify-between px-5 transition-colors duration-base ease-editorial [@media(hover:hover)]:hover:bg-foreground/[0.025] md:min-h-[96px]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="av-treatment-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border md:h-14 md:w-14">
              <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
            </div>
            <p className="truncate font-heading text-xl uppercase leading-none tracking-[0.06em] text-foreground md:text-2xl">{cat.label}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-foreground/30 transition-all duration-base ease-editorial group-hover:translate-x-1 group-hover:text-foreground" strokeWidth={2} />
        </MotionLink>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.84, delay: index * 0.18, ease: EASE }}
      whileHover={premiumHover}
      className={`av-treatment-card rounded-2xl border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}
    >
      {/* Header */}
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="flex min-h-[88px] w-full items-center justify-between px-5 transition-colors duration-base ease-editorial [@media(hover:hover)]:hover:bg-foreground/[0.025] md:min-h-[96px]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="av-treatment-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border md:h-14 md:w-14">
            <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
          </div>
          <div className="text-left">
            <p className="font-heading text-xl tracking-[0.06em] text-foreground uppercase leading-none md:text-2xl">{cat.label}</p>
            {cat.sub ? (
              <p className="font-body text-[9px] text-foreground/35 tracking-[0.15em] uppercase mt-0.5">{cat.sub}</p>
            ) : null}
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-foreground/30 shrink-0"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.div>
      </motion.button>

      {/* Expanded body */}
      <SmoothDisclosure open={open}>
        <motion.div
          initial={false}
          animate={open ? 'show' : 'hidden'}
          variants={premiumListContainer(0.03, 0.04)}
          className="space-y-2 border-t border-foreground/[0.06] px-4 pb-4 pt-4"
        >
              {cat.type === 'nested' ? (
                // Sub-category rows
                cat.data.map((sub) => <SubRow key={sub.label} sub={sub} />)
              ) : (
                // Flat grid
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {cat.data.map((addon) => (
                    <MotionLink
                      key={addon.label}
                      to="/book"
                      variants={premiumListItem}
                      className="av-treatment-chip flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-base ease-editorial group"
                    >
                      <addon.icon className="w-3.5 h-3.5 text-foreground/30 group-hover:text-accent transition-colors shrink-0" strokeWidth={1.5} />
                      <div>
                        <p className="font-body text-xs text-foreground/80 leading-snug">{addon.label}</p>
                        <p className="font-body text-[9px] text-foreground/35">From ${addon.price}</p>
                      </div>
                    </MotionLink>
                  ))}
                </div>
              )}
        </motion.div>
      </SmoothDisclosure>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export default function TreatmentsTeaser() {
  const [openCategory, setOpenCategory] = useState(null);

  return (
    <section id="treatments" className="scroll-mt-20 md:scroll-mt-28 pt-10 pb-10 md:pt-16 md:pb-16 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6 md:mb-10"
        >
          <div>
            <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">Choose Your Protocol</h2>
          </div>
        </motion.div>

        {/* Category accordions */}
        <LayoutGroup id="treatment-teaser-accordion">
          <div className="space-y-2.5">
            {TOP_CATEGORIES.map((cat, i) => (
              <CategoryRow
                key={cat.key}
                cat={cat}
                index={i}
                open={openCategory === cat.key}
                onToggle={() => setOpenCategory(current => current === cat.key ? null : cat.key)}
              />
            ))}
          </div>
        </LayoutGroup>

      </div>
    </section>
  );
}
