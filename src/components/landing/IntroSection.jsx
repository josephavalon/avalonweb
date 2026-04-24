import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Zap, TestTube, Heart, Pill, Apple, Link, Dumbbell, Lightbulb, Flame, CircleUser , Syringe, Atom , Scale, HeartPulse, Baby, Activity } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

// Ordered for grid layout. Diagnostics sits immediately after the three
// live verticals because biomarkers are the foundation beneath every future
// Protocol — they're the primitive that makes personalization real.
// The Protocol registry (src/lib/protocol/verticals.js) is the data-level
// source of truth; this array is the presentation order for the grid.
// Launch quarters mirror src/lib/protocol/verticals.js — keep in sync. A
// change here is a public commitment change, so don't quietly edit quarters
// without also updating the Protocol registry and ensuring ops can ship.
const verticals = [
  { label: 'IV Vitamins', icon: Droplets, live: true },
  { label: 'NAD+', icon: Zap, live: true },
  { label: 'CBD', icon: CannabisLeaf, live: true },
  { label: 'Diagnostics', icon: TestTube, live: false },
  { label: 'Peptides', icon: Link, live: false },
  { label: 'Hormone Optimization', icon: Heart, live: false },
  { label: 'Supplements', icon: Pill, live: false },
  { label: 'Regenerative Aesthetics', icon: CircleUser, live: false },
  { label: 'Nutrition', icon: Apple, live: false },
  { label: 'Contrast Therapy', icon: Flame, live: false, location: 'studio' },
  { label: 'Recovery Devices', icon: Lightbulb, live: false },
  { label: 'Personal Fitness', icon: Dumbbell, live: false },
  { label: 'Ketamine', icon: Syringe, live: false },
  { label: 'Exosomes', icon: Atom, live: false },
  { label: 'Weight Loss', icon: Scale, live: false },
  { label: 'Sexual Health', icon: HeartPulse, live: false },
  { label: 'Fertility', icon: Baby, live: false },
  { label: 'Biosensor Data', icon: Activity, live: false },
];

export default function IntroSection() {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Live items
  const liveItems = verticals.filter(v => v.live);
  const soonItems = verticals.filter(v => !v.live);

  return (
    <section className="py-8 md:py-10 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-left"
        >
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            The Platform
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide mb-4 md:mb-8"
          >
            IV THERAPY IS THE BASE
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-body text-base md:text-lg text-foreground leading-relaxed max-w-2xl mb-5"
          >
            We operate at the protocol layer. IV therapy is the base — every modality is composable on top.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mb-12"
          >
            Every session compounds into a proprietary longitudinal biology record.
          </motion.p>

          {/* Mobile: horizontal scroll, 2 rows of 3 visible */}
          <div className="md:hidden overflow-x-auto py-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="grid grid-rows-2 grid-flow-col gap-3 w-max">
              {[...liveItems, ...soonItems].map(({ label, icon: Icon, live, location }) => (
                <div
                  key={label}
                  style={{ width: 'calc((100vw - 2rem) / 3)' }}
                  className={`relative flex flex-col items-center justify-center gap-2 border rounded-3xl p-4 min-h-[104px] transition-colors ${
                    live
                      ? 'border-foreground/25 bg-card text-foreground'
                      : 'border-border bg-card/40 text-muted-foreground/70'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${live ? 'text-accent' : 'text-muted-foreground/60'}`}
                    strokeWidth={1.5}
                  />
                  <span className="font-body text-xs tracking-[0.15em] uppercase leading-tight text-center">
                    {label}
                  </span>
                  {location && (
                    <span className="font-body text-xs tracking-widest text-muted-foreground uppercase">In Studio</span>
                  )}
                  {live && (
                    <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: original 6-col grid */}
          <div className="hidden md:grid gap-4 w-full md:grid-cols-6">
            {[...liveItems, ...soonItems].map(({ label, icon: Icon, live, location }) => (
              <div
                key={label}
                className={`relative flex flex-col items-center justify-center gap-2 border rounded-3xl p-4 min-h-[120px] transition-colors ${
                  live
                    ? 'border-foreground/25 bg-card text-foreground'
                    : 'border-border bg-card/40 text-muted-foreground/70'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${live ? 'text-accent' : 'text-muted-foreground/60'}`}
                  strokeWidth={1.5}
                />
                <span className="font-body text-xs tracking-[0.15em] uppercase leading-tight text-center">
                  {label}
                </span>
                {location && (
                  <span className="font-body text-xs tracking-widest text-muted-foreground uppercase">In Studio</span>
                )}
                {live && (
                  <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                )}
                {!live && (
                  <span className="mt-1 block font-body text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">Soon</span>
                )}
              </div>
            ))}
          </div>

          <p className="mt-6 text-center font-body text-xs tracking-widest text-muted-foreground/70 uppercase">
            <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 align-middle" />
            Live at launch
          </p>
          <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
          </motion.div>
          </div>
          </section>
  );
}