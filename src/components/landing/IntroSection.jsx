import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Zap, Sparkles, TestTube, Heart, Scissors, Pill, Apple, Link, Leaf, MapPin, Dumbbell, Lightbulb, Flame, CircleUser, ChevronLeft, ChevronRight } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

const verticals = [
  { label: 'IV Vitamins', icon: Droplets, live: true },
  { label: 'NAD+', icon: Zap, live: true },
  { label: 'Exosomes', icon: Sparkles, live: true },
  { label: 'CBD', icon: CannabisLeaf, live: true },
  { label: 'Contrast Therapy', icon: Flame, live: true, location: 'Vital Ice SF' },
  { label: 'Recovery Devices', icon: Lightbulb, live: false },
  { label: 'Peptides', icon: Link, live: false },
  { label: 'Personalized Protocols', icon: Zap, live: false },
  { label: 'Blood & Genetic Testing', icon: TestTube, live: false },
  { label: 'Sexual Wellness', icon: Heart, live: false },
  { label: 'Personal Fitness', icon: Dumbbell, live: false },
  { label: 'HRT', icon: Pill, live: false },
  { label: 'Supplements', icon: Pill, live: false },
  { label: 'Diet', icon: Apple, live: false },
  { label: 'Aesthetics', icon: CircleUser, live: false },
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
      <div className="max-w-4xl mx-auto text-center">
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
            className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4"
          >
            The Foundation
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-5xl md:text-7xl text-foreground tracking-wide mb-8"
          >
            IV THERAPY IS THE BASE
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-body text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-12"
          >
            IV therapy is the bedrock. Every other modality builds on top — delivered by licensed clinicians, wherever you are, or visit us in San Francisco.
          </motion.p>

          {/* Mobile: horizontal scroll, 2 rows of 3 visible */}
          <div className="md:hidden overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="grid grid-rows-2 grid-flow-col gap-3 w-max">
              {[...liveItems, ...soonItems].map(({ label, icon: Icon, live, location }) => (
                <div
                  key={label}
                  style={{ width: 'calc((100vw - 2rem) / 3)' }}
                  className={`relative flex flex-col items-center justify-center gap-2 border rounded-3xl p-4 transition-colors ${
                    live
                      ? 'border-foreground/25 bg-card text-foreground'
                      : 'border-border bg-card/40 text-muted-foreground/40'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${live ? 'text-accent' : 'text-muted-foreground/30'}`}
                    strokeWidth={1.5}
                  />
                  <span className="font-body text-[9px] tracking-[0.15em] uppercase leading-tight text-center">
                    {label}
                  </span>
                  {location && (
                    <span className="font-body text-[7px] tracking-widest text-accent uppercase">In Studio</span>
                  )}
                  {live && (
                    <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                  )}
                  {!live && (
                    <span className="font-body text-[8px] tracking-widest text-muted-foreground/30 uppercase">Soon</span>
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
                className={`relative flex flex-col items-center justify-center gap-2 border rounded-3xl p-4 transition-colors ${
                  live
                    ? 'border-foreground/25 bg-card text-foreground'
                    : 'border-border bg-card/40 text-muted-foreground/40'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${live ? 'text-accent' : 'text-muted-foreground/30'}`}
                  strokeWidth={1.5}
                />
                <span className="font-body text-[9px] tracking-[0.15em] uppercase leading-tight text-center">
                  {label}
                </span>
                {location && (
                  <span className="font-body text-[7px] tracking-widest text-accent uppercase">In Studio</span>
                )}
                {live && (
                  <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                )}
                {!live && (
                  <span className="font-body text-[8px] tracking-widest text-muted-foreground/30 uppercase">Soon</span>
                )}
              </div>
            ))}
          </div>

          <p className="mt-6 text-center font-body text-[10px] tracking-widest text-muted-foreground/40 uppercase">
            <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 align-middle" />
            Live at launch
          </p>
          <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
          </motion.div>
          </div>
          </section>
  );
}