import React from 'react';
import { motion } from 'framer-motion';
import { Droplets, Zap, TestTube, Heart, Pill, Apple, Link as LinkIcon, Dumbbell, Lightbulb, Flame, CircleUser, Syringe, Atom, Scale, HeartPulse, Baby, Activity } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

const verticals = [
  { label: 'IV Vitamins', icon: Droplets, live: true },
  { label: 'NAD+ IV', icon: Zap, live: true },
  { label: 'CBD IV', icon: CannabisLeaf, live: true },
  { label: 'Diagnostics', icon: TestTube, live: false },
  { label: 'Peptides', icon: LinkIcon, live: false },
  { label: 'Hormone Optimization', icon: Heart, live: false },
  { label: 'Supplements', icon: Pill, live: false },
  { label: 'Biosensor Data', icon: Activity, live: false },
  { label: 'Nutrition', icon: Apple, live: false },
  { label: 'Contrast Therapy', icon: Flame, live: false, location: 'studio' },
  { label: 'Recovery Devices', icon: Lightbulb, live: false },
  { label: 'Personal Fitness', icon: Dumbbell, live: false },
  { label: 'Ketamine', icon: Syringe, live: false },
  { label: 'Exosomes', icon: Atom, live: false },
  { label: 'Weight Loss', icon: Scale, live: false },
  { label: 'Sexual Health', icon: HeartPulse, live: false },
  { label: 'Fertility', icon: Baby, live: false },
  { label: 'Regenerative Aesthetics', icon: CircleUser, live: false },
];

const EASE = [0.16, 1, 0.3, 1];

export default function IntroSection() {
  const liveItems = verticals.filter(v => v.live);
  const soonItems = verticals.filter(v => !v.live);

  return (
    <section className="py-8 md:py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-8 md:mb-10"
        >
          <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">The Platform</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
            Live Now
          </h2>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mt-4 md:mt-5">
            Three modalities live today. Every future modality is composable on top — every session compounds into one longitudinal record.
          </p>
        </motion.div>

        {/* LIVE NOW — 3 featured cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-5 mb-10 md:mb-14">
          {liveItems.map(({ label, icon: Icon }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              className="relative border border-white/15 bg-white/[0.06] backdrop-blur-md rounded-3xl p-5 md:p-7 flex flex-col items-center justify-center gap-3 md:gap-4 min-h-[140px] md:min-h-[180px]"
            >
              <span className="absolute top-3 right-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="font-body text-[10px] md:text-xs tracking-[0.25em] text-accent uppercase">Live</span>
              </span>
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full border border-accent/55 flex items-center justify-center text-accent">
                <Icon className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.5} />
              </div>
              <span className="font-heading text-base md:text-2xl text-foreground tracking-wide uppercase leading-tight text-center">
                {label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* COMING SOON — horizontal scroll row */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <p className="text-xs md:text-sm tracking-[0.3em] text-muted-foreground/80 font-body uppercase">
              Coming Soon
            </p>
            <p className="text-[10px] md:text-xs tracking-[0.25em] text-muted-foreground/60 font-body uppercase hidden sm:block">
              Swipe to explore
            </p>
          </div>

          <div
            className="overflow-x-auto overflow-y-visible py-2 no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex gap-3 md:gap-4 w-max pr-6">
              {soonItems.map(({ label, icon: Icon, location }, i) => (
                <div
                  key={label}
                  className="shrink-0 w-[140px] md:w-[170px] border border-white/10 bg-white/[0.02] backdrop-blur-sm rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center gap-2.5 md:gap-3 min-h-[120px] md:min-h-[140px]"
                >
                  <Icon className="w-5 h-5 md:w-5 md:h-5 text-muted-foreground/70" strokeWidth={1.5} />
                  <span className="font-body text-[11px] md:text-xs tracking-[0.15em] uppercase leading-tight text-center text-muted-foreground/85">
                    {label}
                  </span>
                  {location && (
                    <span className="font-body text-[9px] md:text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">In Studio</span>
                  )}
                  <span className="font-body text-[9px] md:text-[10px] tracking-[0.2em] text-muted-foreground/50 uppercase">Soon</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
