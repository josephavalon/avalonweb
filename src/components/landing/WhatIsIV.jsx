import React from 'react';
import { motion } from 'framer-motion';

const stats = [
  { value: '100%', label: 'Bioavailability', sub: 'vs. ~10–20% from oral supplements' },
  { value: '30min', label: 'Time to Effect', sub: 'nutrients reach cells almost instantly' },
  { value: '0%', label: 'Digestive Loss', sub: 'bypasses the gut entirely' },
];

export default function WhatIsIV() {
  return (
    <section className="py-10 md:py-14 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">

          {/* Image with Title Overlay */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="hidden md:flex relative items-start justify-start pt-8"
          >
            <div className="relative w-full max-w-xs">
              <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">The Science</p>
              <h2 className="font-heading text-6xl md:text-7xl text-foreground tracking-wide mb-8">WHAT IS IV THERAPY?</h2>
              <div className="aspect-[3/4] rounded-3xl overflow-hidden w-full">
                <img
                  src="https://media.base44.com/images/public/69e5682f98e509792c71ef21/11af8bb23_ivtherapy.png"
                  alt="IV bag"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              </div>
              {/* Floating stat */}
              <div className="absolute bottom-6 left-6 right-6 border border-border/60 bg-background/80 backdrop-blur-sm rounded-2xl p-4">
                <p className="font-heading text-4xl text-foreground tracking-wide">100%</p>
                <p className="font-body text-xs text-accent tracking-widest uppercase mt-0.5">Absorption — Direct to Bloodstream</p>
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
            <div className="md:hidden mb-6">
              <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">The Science</p>
              <h2 className="font-heading text-6xl text-foreground tracking-wide mb-6">WHAT IS IV THERAPY?</h2>
            </div>

            <p className="font-body text-sm text-foreground leading-relaxed mb-5">
              IV therapy delivers vitamins and minerals <span className="text-foreground font-semibold">directly into your bloodstream</span> — bypassing digestion entirely. Your body absorbs <span className="text-foreground font-semibold">100% of every nutrient</span>, exactly as administered.
            </p>

            <p className="font-body text-sm text-foreground leading-relaxed mb-10">
              Oral supplements lose up to 90% through gut metabolism. IV bypasses that completely — effects you can <span className="text-foreground font-semibold">feel within 30 minutes</span>.
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-8">
              {stats.map((s) => (
                <div key={s.value}>
                  <p className="font-heading text-3xl md:text-4xl text-foreground tracking-wide">{s.value}</p>
                  <p className="font-body text-[10px] tracking-[0.15em] text-accent uppercase mt-1">{s.label}</p>
                  <p className="font-body text-[10px] text-foreground mt-1 leading-tight">{s.sub}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}