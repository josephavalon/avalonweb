import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, Zap, ShieldCheck, Sparkles, FlaskConical,
  Syringe, Star, Plus, ArrowRight, ChevronDown, ChevronRight,
} from 'lucide-react';
import { EASE, premiumCard, premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion(Link);

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
    label: 'CBD IV',
    icon: Star,
    treatments: [
      { icon: Star, label: 'CBD IV — Low Dose',  price: 350 },
      { icon: Star, label: 'CBD IV — High Dose', price: 450 },
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

const ADDONS = [
  { icon: Syringe,     label: 'B12',          price: 35 },
  { icon: Sparkles,    label: 'Glutathione',   price: 45 },
  { icon: Zap,         label: 'Toradol',       price: 45 },
  { icon: ShieldCheck, label: 'Zofran',        price: 45 },
  { icon: Star,        label: 'Biotin',        price: 35 },
  { icon: FlaskConical, label: 'Taurine',      price: 35 },
];

const TOP_CATEGORIES = [
  {
    key: 'vitamin',
    label: 'Vitamin IVs',
    sub: 'Hydration · Energy · Immunity · Beauty',
    preview: 'From $150 · 5 core protocols',
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
    key: 'specialty',
    label: 'Specialty IVs',
    sub: 'NAD+ · CBD · Exosomes',
    preview: 'From $350 · longevity stack',
    icon: FlaskConical,
    type: 'nested',
    data: SPECIALTY_IVS,
  },
  {
    key: 'addons',
    label: 'Add-Ons',
    sub: 'IM shots & boosters — from $35',
    preview: 'From $35 · add to any visit',
    icon: Plus,
    type: 'flat',
    data: ADDONS,
  },
];

// ── Sub-category row (inside Vitamin / Specialty) ─────────────────────────────
function SubRow({ sub }) {
  const [open, setOpen] = useState(false);
  const Icon = sub.icon;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between px-4 py-3 [@media(hover:hover)]:hover:bg-white/[0.08] transition-colors duration-base ease-editorial"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5 text-accent/70" strokeWidth={1.5} />
          <span className="font-body text-xs font-semibold tracking-[0.15em] uppercase text-foreground/80">{sub.label}</span>
          <span className="font-body text-[9px] text-foreground/30 tracking-[0.1em]">{sub.treatments.length} drips</span>
        </div>
        <ChevronRight
          className="w-3 h-3 text-foreground/25 shrink-0 transition-transform duration-250"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          strokeWidth={2}
        />
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
            <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 grid grid-cols-2 gap-1.5">
              {sub.treatments.map((t) => (
                <Link
                  key={t.label}
                  to="/book"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.08] border border-white/[0.06] hover:bg-white/[0.09] hover:border-white/20 transition-all duration-base ease-editorial group"
                >
                  <t.icon className="w-3 h-3 text-foreground/30 group-hover:text-accent transition-colors shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="font-body text-[11px] text-foreground/80 leading-snug truncate">{t.label}</p>
                    <p className="font-body text-[9px] text-foreground/35">From ${t.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Top-level category row ────────────────────────────────────────────────────
function CategoryRow({ cat, index, open, onToggle }) {
  const Icon = cat.icon;

  return (
    <motion.div
      {...premiumCard(index * 0.11)}
      whileHover={premiumHover}
      className={`rounded-2xl border backdrop-blur-xl overflow-hidden shadow-[0_18px_70px_hsl(var(--foreground)/0.035)] transition-all duration-base ease-editorial ${
        open
          ? 'border-accent/35 bg-white/[0.12]'
          : 'border-foreground/10 bg-white/[0.08] hover:border-foreground/20 hover:bg-white/[0.105]'
      }`}
    >
      {/* Header */}
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between px-5 py-4 [@media(hover:hover)]:hover:bg-white/[0.08] transition-colors duration-base ease-editorial"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-foreground/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <p className="font-heading text-xl tracking-[0.06em] text-foreground uppercase leading-none">{cat.label}</p>
            <p className="font-body text-[9px] text-foreground/35 tracking-[0.15em] uppercase mt-0.5">{cat.sub}</p>
            <p className="font-body text-[9px] text-accent/70 tracking-[0.15em] uppercase mt-1">{cat.preview}</p>
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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.42, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-white/[0.06] px-4 pb-4 pt-4 space-y-2">
              {cat.type === 'nested' ? (
                // Sub-category rows
                cat.data.map((sub) => <SubRow key={sub.label} sub={sub} />)
              ) : (
                // Flat grid (add-ons and flat-treatments)
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {cat.data.map((addon) => (
                    <Link
                      key={addon.label}
                      to="/book"
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.06] hover:bg-white/[0.09] hover:border-white/20 transition-all duration-base ease-editorial group"
                    >
                      <addon.icon className="w-3.5 h-3.5 text-foreground/30 group-hover:text-accent transition-colors shrink-0" strokeWidth={1.5} />
                      <div>
                        <p className="font-body text-xs text-foreground/80 leading-snug">{addon.label}</p>
                        <p className="font-body text-[9px] text-foreground/35">From ${addon.price}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">Our Menu</p>
            <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">Therapies</h2>
            <p className="font-body text-sm text-foreground/55 leading-relaxed mt-3 max-w-md">
              Start with a core drip, step up to specialty protocols, then layer in boosters as needed.
            </p>
          </div>
        </motion.div>

        {/* Category accordions */}
        <div className="space-y-2 mb-8">
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

        {/* CTA card */}
        <motion.div
          {...premiumCard(0.32)}
          whileHover={premiumHover}
        >
          <MotionLink
            to="/menu"
            whileTap={premiumTap}
            className="flex items-center justify-between px-5 py-4 rounded-2xl border border-foreground/10 bg-white/[0.08] backdrop-blur-xl hover:bg-white/[0.105] hover:border-foreground/20 transition-all duration-base ease-editorial group shadow-[0_18px_70px_hsl(var(--foreground)/0.035)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-foreground/10 flex items-center justify-center shrink-0">
                <ArrowRight className="w-4 h-4 text-accent" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <p className="font-heading text-xl tracking-[0.06em] text-foreground uppercase leading-none">View Full Menu</p>
                <p className="font-body text-[9px] text-foreground/35 tracking-[0.15em] uppercase mt-0.5">Browse all drips & pricing</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-foreground/30 group-hover:text-foreground transition-all duration-base ease-editorial group-hover:translate-x-1 shrink-0" strokeWidth={2} />
          </MotionLink>
        </motion.div>

      </div>
    </section>
  );
}
