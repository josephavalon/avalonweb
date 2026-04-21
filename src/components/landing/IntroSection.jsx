import React from 'react';
import { motion } from 'framer-motion';
import { Droplets, Zap, Sparkles, TestTube, Heart, Scissors, Pill, Apple, Link, Leaf, MapPin, Dumbbell, Lightbulb, Flame, CircleUser } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

const verticals = [
  { label: 'IV Vitamins', icon: Droplets, live: true },
  { label: 'NAD+', icon: Zap, live: true },
  { label: 'CBD', icon: CannabisLeaf, live: true },
  { label: 'Exosomes', icon: Sparkles, live: true },
  { label: 'Contrast Therapy', icon: Flame, live: true, location: 'Vital Ice SF' },
  { label: 'Peptides', icon: Link, live: false },
  { label: 'Recovery Devices', icon: Lightbulb, live: false },
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
  return (
    <section className="py-8 md:py-10 px-4 border-t border-border">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">The Foundation</p>
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide mb-8">IV THERAPY IS THE BASE</h2>
          <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-12">
            IV therapy is the bedrock. Every other modality builds on top — delivered by licensed clinicians, wherever you are, or visit us in San Francisco.
          </p>

          {/* Vertical grid - 5 visible on desktop, horizontal scroll on mobile/tablet */}
          <div className="overflow-x-auto md:overflow-visible relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 md:hidden pointer-events-none">
              <div className="flex items-center gap-1 text-muted-foreground/40">
                <span className="text-[10px] tracking-widest uppercase">←</span>
              </div>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 md:hidden pointer-events-none">
              <div className="flex items-center gap-1 text-muted-foreground/40">
                <span className="text-[10px] tracking-widest uppercase">→</span>
              </div>
            </div>
            <div className="flex gap-3 w-fit md:grid md:grid-cols-8 md:max-w-7xl md:mx-auto">
              {verticals.slice(0, 8).map(({ label, icon: Icon, live, location, isLocation }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className={`flex-shrink-0 w-[calc(50vw-1rem)] sm:w-[calc(33.333vw-1rem)] md:w-auto relative flex flex-col items-center gap-2 border rounded-3xl p-4 transition-colors ${
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
                {live && !isLocation && (
                  <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                )}
                {!live && (
                  <span className="font-body text-[8px] tracking-widest text-muted-foreground/30 uppercase">Soon</span>
                )}
              </motion.div>
            ))}
            </div>
          </div>

          <p className="mt-6 font-body text-[10px] tracking-widest text-muted-foreground/40 uppercase">
            <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 align-middle" />
            Live at launch
          </p>
        </motion.div>
      </div>
    </section>
  );
}