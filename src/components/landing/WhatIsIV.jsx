import React from 'react';
import { motion } from 'framer-motion';

const stats = [
  { value: '100%', label: 'Bioavailability', sub: 'vs. ~10–20% from oral supplementation' },
  { value: '30min', label: 'Average Session', sub: 'typical infusion time, door-to-door' },
  { value: '0%', label: 'Digestive Loss', sub: 'bypasses the gut entirely' },
  { value: 'MD', label: 'Physician Supervised', sub: 'all protocols reviewed by a licensed physician' },
  { value: '100%', label: 'Customizable', sub: 'formulas tailored to your preferences' },
  { value: 'RN', label: 'Licensed Nurses', sub: 'every drip administered by a registered nurse' },
];

export default function WhatIsIV() {
  return (
    <section className="py-10 md:py-14 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 md:mb-10">
          <p className="text-xs tracking-[0.3em] text-accent font-body uppercase mb-4">The Science</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide md:whitespace-nowrap">WHAT IS IV THERAPY?</h2>
        </div>
        <div className="grid md:grid-cols-[minmax(320px,380px)_minmax(0,620px)] gap-8 md:gap-10 items-start">

          {/* Image with Title Overlay */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="hidden md:flex relative items-start justify-start pt-8"
          >
            <div className="relative w-full max-w-xs">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden w-full bg-card">
                <img
                  src="/bags/immunity.png"
                  alt="Avalon Vitality vitamin IV bag"
                  className="w-full h-full object-contain object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
              </div>
              {/* Floating stat */}
              <div className="absolute bottom-8 left-6 right-6 border border-border/60 bg-background/80 backdrop-blur-sm rounded-2xl p-6">
                <p className="font-heading text-5xl text-foreground tracking-wide">100%</p>
                <p className="font-body text-xs text-accent tracking-widest uppercase mt-3">Absorption — Direct to Bloodstream</p>
              </div>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-left"
          >
            <p className="font-body text-sm text-foreground leading-relaxed mb-8">
              IV therapy delivers vitamins and minerals <span className="text-foreground font-semibold">directly into your bloodstream</span>, bypassing the digestive tract entirely. Full bioavailability in a single <span className="text-foreground font-semibold">30–60 minute</span> session — no absorption losses from gut metabolism.
            </p>

            {/* Stats grid */}
            <div className="border-t border-border pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {stats.map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="font-heading text-3xl md:text-4xl text-foreground tracking-wide">{s.value}</p>
                    <p className="font-body text-xs tracking-[0.15em] text-accent uppercase mt-2">{s.label}</p>
                    <p className="font-body text-xs text-foreground mt-2 leading-tight">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}