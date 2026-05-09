import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Droplets,
  Zap,
  Sparkles,
  HeartPulse,
  HelpCircle,
  Battery,
  Leaf,
  Star,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import BookingDrawer from '@/components/store/BookingDrawer';
import StickyBookingBar from '@/components/store/StickyBookingBar';

const EASE = [0.16, 1, 0.3, 1];

// Intent → recommended treatment categories (highest-affinity first)
const INTENTS = [
  { id: 'hydration',  label: 'Hydration',  icon: Droplets,    matches: ['iv-vitamins'] },
  { id: 'energy',     label: 'Energy',     icon: Battery,     matches: ['iv-nad', 'iv-vitamins'] },
  { id: 'recovery',   label: 'Recovery',   icon: HeartPulse,  matches: ['iv-cbd', 'iv-vitamins'] },
  { id: 'longevity',  label: 'Longevity',  icon: Zap,         matches: ['iv-nad'] },
  { id: 'everything', label: 'Everything', icon: Star,        matches: ['everything'] },
  { id: 'unsure',     label: 'Not sure',   icon: HelpCircle,  matches: null /* show all */ },
];

// Treatment cards (4 — kept simple per spec)
const TREATMENTS = [
  {
    id: 'iv-vitamins',
    name: 'IV Vitamins',
    blurb: 'Hydration and vitamin support.',
    fromPrice: 150,
    cta: 'Book IV',
    drawerCategoryId: 'iv-vitamins',
    icon: Droplets,
  },
  {
    id: 'iv-nad',
    name: 'NAD+ IV',
    blurb: 'Premium energy and longevity support.',
    fromPrice: 350,
    cta: 'Book NAD+',
    drawerCategoryId: 'iv-nad',
    icon: Zap,
  },
  {
    id: 'iv-cbd',
    name: 'CBD IV',
    blurb: 'Recovery and relaxation support.',
    fromPrice: 250,
    cta: 'Book CBD',
    drawerCategoryId: 'iv-cbd',
    icon: Leaf,
  },
  {
    id: 'everything',
    name: 'Everything IV',
    blurb: 'Every IV med + every add-on. The Works.',
    fromPrice: 599,
    cta: 'Book the Works',
    drawerCategoryId: 'everything',
    icon: Star,
    featured: true,
  },
];

// =====================================================================
function Hero() {
  return (
    <section className="relative pt-28 md:pt-32 pb-12 md:pb-16 px-5 md:px-10">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <h1 className="font-display text-[44px] sm:text-[64px] md:text-[88px] lg:text-[104px] uppercase leading-[0.92] tracking-tight mb-7 md:mb-9">
            Book your<br />recovery.
          </h1>
          <p className="text-base md:text-xl text-foreground/75 max-w-2xl leading-relaxed">
            Choose a treatment, pick your time, complete clearance, and an Avalon RN comes to you.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
function IntentSelector({ active, onSelect }) {
  return (
    <section id="intent" className="px-5 md:px-10 py-12 md:py-16 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 md:mb-10">
          <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">Step one</p>
          <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">What do you need today?</h2>
        </header>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {INTENTS.map((it, i) => {
            const Icon = it.icon;
            const isActive = active === it.id;
            return (
              <motion.button
                type="button"
                key={it.id}
                onClick={() => onSelect(active === it.id ? null : it.id)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
                className={`intent-tile group flex flex-col items-center justify-center gap-3 px-4 py-7 md:py-9 rounded-2xl border transition-all ${isActive ? 'border-foreground bg-foreground text-background shadow-lg' : 'border-foreground/15 hover:border-foreground/45 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-8px_hsl(var(--foreground)/0.18)]'}`}
                aria-pressed={isActive}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-background' : 'text-foreground/75 group-hover:text-foreground'}`} strokeWidth={1.5} />
                <span className="font-body text-xs md:text-sm tracking-[0.3em] uppercase">{it.label}</span>
              </motion.button>
            );
          })}
        </div>
        <style>{`
          .intent-tile {
            background: hsl(var(--background) / 0.7);
            backdrop-filter: saturate(150%) blur(14px);
            -webkit-backdrop-filter: saturate(150%) blur(14px);
          }
          .intent-tile.border-foreground { background: hsl(var(--foreground)); }
        `}</style>
      </div>
    </section>
  );
}

// =====================================================================
function TreatmentGrid({ activeIntent, onBook }) {
  // When an intent is picked, sort matched treatments first; otherwise show natural order
  const intent = INTENTS.find(i => i.id === activeIntent);
  const ordered = useMemo(() => {
    if (!intent || !intent.matches) return TREATMENTS;
    const matchSet = new Set(intent.matches);
    return [...TREATMENTS].sort((a, b) => {
      const aMatch = matchSet.has(a.id) ? 0 : 1;
      const bMatch = matchSet.has(b.id) ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [intent]);

  const isMatched = (id) => !intent || !intent.matches || intent.matches.includes(id);

  return (
    <section id="treatments" className="px-5 md:px-10 py-12 md:py-16 border-t border-foreground/10 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 md:mb-10">
          <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">Step two</p>
          <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">
            {intent ? `Recommended for ${intent.label.toLowerCase()}` : 'Pick a treatment'}
          </h2>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {ordered.map((t, i) => {
            const Icon = t.icon;
            const matched = isMatched(t.id);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: EASE, delay: i * 0.04 }}
                className={`treatment-tile rounded-2xl border p-6 md:p-7 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_hsl(var(--foreground)/0.18)] ${matched ? 'border-foreground/25' : 'border-foreground/12 opacity-65'}`}
              >
                <div className="flex items-start justify-between mb-5">
                  <Icon className="w-5 h-5 text-foreground/70" strokeWidth={1.5} />
                  {intent && matched && (
                    <span className="font-body text-[9px] tracking-[0.3em] uppercase rounded-full border border-foreground/20 px-2 py-0.5 text-foreground/65">Recommended</span>
                  )}
                </div>
                <h3 className="font-display text-2xl md:text-3xl uppercase tracking-tight leading-none mb-2">{t.name}</h3>
                <p className="text-sm md:text-base text-foreground/65 leading-snug mb-5 min-h-[2.5rem]">{t.blurb}</p>
                <div className="flex items-center justify-between pt-4 border-t border-foreground/10">
                  <span className="font-body text-[10px] md:text-xs tracking-[0.32em] uppercase text-foreground/55">From ${t.fromPrice}</span>
                  <button
                    type="button"
                    onClick={() => onBook(t)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background font-body text-[10px] md:text-xs tracking-[0.3em] uppercase px-4 py-2.5 hover:opacity-85 transition-opacity"
                  >
                    {t.cta} <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
        <style>{`
          .treatment-tile {
            background: hsl(var(--background) / 0.7);
            backdrop-filter: saturate(150%) blur(14px);
            -webkit-backdrop-filter: saturate(150%) blur(14px);
          }
        `}</style>
      </div>
    </section>
  );
}

// =====================================================================
function HowItWorks() {
  const steps = [
    { n: '01', t: 'Choose what you need',     d: 'Pick the result you want — hydration, energy, recovery.' },
    { n: '02', t: 'Pick a treatment',          d: 'We surface the best fit. One tap to book.' },
    { n: '03', t: 'Schedule time and address', d: 'Pick a slot that works. Card authorized at booking.' },
    { n: '04', t: 'Complete clearance', d: 'Quick intake. We confirm contraindications.' },
    { n: '05', t: 'RN arrives',                d: 'Avalon RN at your door. 20–60 minutes start to finish.' },
  ];
  return (
    <section id="how-it-works" className="px-5 md:px-10 py-14 md:py-20 border-t border-foreground/10 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 md:mb-14">
          <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">The flow</p>
          <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">How Avalon works.</h2>
        </header>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-7 md:gap-8">
          {steps.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
            >
              <p className="font-display text-4xl md:text-5xl text-foreground/15 leading-none mb-3 select-none">{s.n}</p>
              <h3 className="font-display text-lg md:text-xl uppercase tracking-tight leading-tight mb-1.5">{s.t}</h3>
              <p className="text-xs md:text-sm text-foreground/60 leading-relaxed">{s.d}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// =====================================================================
function ClosingCTA({ onBook }) {
  return (
    <section className="px-5 md:px-10 py-14 md:py-20 border-t border-foreground/10">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-tight mb-5">Ready to recover?</h2>
        <p className="text-base md:text-lg text-foreground/65 mb-8 max-w-xl mx-auto">An Avalon RN can be at your door this week. Pick the treatment that fits.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={onBook}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-xs md:text-sm tracking-[0.3em] uppercase px-9 py-4 hover:opacity-85 transition-opacity"
          >
            Book now <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <Link to="/apply" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-foreground/35 font-body text-xs md:text-sm tracking-[0.3em] uppercase px-9 py-4 hover:border-foreground transition-colors">
            See memberships
          </Link>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
export default function Store() {
  const [activeIntent, setActiveIntent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategoryId, setDrawerCategoryId] = useState(null);

  useEffect(() => { document.title = 'Store — Avalon Vitality'; }, []);

  const openDrawer = (treatment) => {
    if (!treatment.drawerCategoryId) {
      // IM Shots — scroll to its anchor section instead (or open a dedicated flow later)
      // For now, route to /book#im-shots concept: open default first IV shot drawer? Better: just open IV Vitamins as default
      // Actually, for IM Shots, just route to /cart with a guidance state via cart helper for now: open IV Vitamins fallback
      setDrawerCategoryId('iv-vitamins');
      setDrawerOpen(true);
      return;
    }
    setDrawerCategoryId(treatment.drawerCategoryId);
    setDrawerOpen(true);
  };

  const openDefaultBooking = () => {
    setDrawerCategoryId(activeIntent === 'longevity' ? 'iv-nad' : activeIntent === 'recovery' ? 'iv-cbd' : 'iv-vitamins');
    setDrawerOpen(true);
  };

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <Hero />
      <IntentSelector active={activeIntent} onSelect={setActiveIntent} />
      <TreatmentGrid activeIntent={activeIntent} onBook={openDrawer} />
      <HowItWorks />
      <ClosingCTA onBook={openDefaultBooking} />
      <Footer />

      <StickyBookingBar onBookClick={openDefaultBooking} />
      <BookingDrawer
        open={drawerOpen}
        categoryId={drawerCategoryId}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
