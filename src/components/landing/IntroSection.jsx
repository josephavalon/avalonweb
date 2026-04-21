import React from 'react';
import { motion } from 'framer-motion';
import { Droplets, Zap, Sparkles, TestTube, Heart, Scissors, Pill, Apple, Link, Leaf } from 'lucide-react';

const verticals = [
  { label: 'IV Vitamins', icon: Droplets, live: true },
  { label: 'NAD+', icon: Zap, live: true },
  { label: 'Exosomes', icon: Sparkles, live: true },
  { label: 'CBD', icon: Leaf, live: true },
  { label: 'Peptides', icon: Link, live: false },
  { label: 'Aesthetics', icon: Sparkles, live: false },
  { label: 'Weight Loss', icon: Apple, live: false },
  { label: 'Blood Testing', icon: TestTube, live: false },
  { label: 'Genetic Testing', icon: TestTube, live: false },
  { label: 'Optimization Data', icon: Zap, live: false },
  { label: 'Sexual Wellness', icon: Heart, live: false },
  { label: 'Hair', icon: Scissors, live: false },
  { label: 'HRT', icon: Pill, live: false },
  { label: 'Supplements', icon: Pill, live: false },
  { label: 'Diet', icon: Apple, live: false },
];

export default function IntroSection() {
  return (
    <section className="py-20 md:py-28 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">The Foundation</p>
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide mb-8">IV THERAPY IS THE BASE</h2>
          <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed mb-6">
            We started with IV therapy because it's the most direct, science-backed way to deliver nutrients at 100% absorption. It's the bedrock every other modality builds on.
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-12">
            From that foundation, we're building Avalon into a full-stack optimization platform — each vertical layered on top of our mobile clinical infrastructure, delivered by licensed clinicians wherever you are.
          </p>

          {/* Vertical grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-3xl mx-auto">
            {verticals.map(({ label, icon: Icon, live }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className={`relative flex flex-col items-center gap-2 border rounded p-4 transition-colors ${
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
                {live && (
                  <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                )}
                {!live && (
                  <span className="font-body text-[8px] tracking-widest text-muted-foreground/30 uppercase">Soon</span>
                )}
              </motion.div>
            ))}
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