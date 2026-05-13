import React from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Clock, ShieldCheck, Stethoscope, SlidersHorizontal, UserCheck, TrendingUp, Minus } from 'lucide-react';

const ivStats = [
  { value: 'Full', label: 'Bioavailability', icon: FlaskConical },
  { value: '30min', label: 'Avg Session', icon: Clock },
  { value: '0%', label: 'Digestive Loss', icon: ShieldCheck },
  { value: 'MD', label: 'Supervised', icon: Stethoscope },
  { value: '100%', label: 'Customizable', icon: SlidersHorizontal },
  { value: 'RN', label: 'Licensed Nurses', icon: UserCheck },
];

const imStats = [
  { value: '~5min', label: 'Full Dose', icon: Clock },
  { value: 'High', label: 'Absorption', icon: TrendingUp },
  { value: 'No IV', label: 'Line Needed', icon: Minus },
  { value: 'B12', label: 'Most Popular', icon: FlaskConical },
];

const EASE = [0.16, 1, 0.3, 1];

export default function WhatIsIV() {
  return (
    <section className="py-16 md:py-20 px-4">
      <div className="max-w-6xl mx-auto space-y-12 md:space-y-16">

        {/* ── IV Therapy ── */}
        <div>
          <div className="mb-6 md:mb-10">
            <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">The Science</p>
            <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95]">WHAT IS IV THERAPY?</h2>
          </div>
          <div className="grid md:grid-cols-[minmax(320px,380px)_minmax(0,620px)] gap-8 md:gap-10 items-start">

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              className="hidden md:flex relative items-start justify-start pt-8"
            >
              <div className="relative w-full max-w-xs">
                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden w-full border border-white/20 bg-white/[0.03] ">
                  <img
                    src="/bags/immunity.png"
                    alt="Avalon Vitality vitamin IV bag"
                    className="w-full h-full object-contain object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
                </div>
                <div className="absolute bottom-8 left-6 right-6 border border-border/60 bg-background/80  rounded-2xl p-6">
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
              transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              className="text-left"
            >
              <p className="font-body text-base md:text-lg text-foreground leading-relaxed mb-8">
                Direct nutrient delivery. Faster recovery, energy, performance.
              </p>
              <div className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {ivStats.map((s) => (
                    <div key={s.label} className="flex flex-col items-center text-center gap-1 p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
                      <s.icon className="w-4 h-4 text-accent mb-1" strokeWidth={1.5} aria-hidden="true" />
                      <p className="font-heading text-2xl md:text-3xl text-foreground tracking-wide leading-none">{s.value}</p>
                      <p className="font-body text-[9px] tracking-[0.2em] text-accent uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── IM Injections ── */}
        <div>
          <div className="mb-6 md:mb-10">
            <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">The Add-On</p>
            <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95]">WHAT IS AN IM SHOT?</h2>
          </div>
          <div className="grid md:grid-cols-[minmax(0,620px)_minmax(320px,380px)] gap-8 md:gap-10 items-start">

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              className="text-left"
            >
              <p className="font-body text-base md:text-lg text-foreground leading-relaxed mb-8">
                Concentrated dose injected into muscle. No IV line. Under five minutes.
              </p>
              <div className="pt-6">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {imStats.map((s) => (
                    <div key={s.label} className="flex flex-col items-center text-center gap-1 p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
                      <s.icon className="w-4 h-4 text-accent mb-1" strokeWidth={1.5} aria-hidden="true" />
                      <p className="font-heading text-2xl md:text-3xl text-foreground tracking-wide leading-none">{s.value}</p>
                      <p className="font-body text-[9px] tracking-[0.2em] text-accent uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              className="hidden md:flex relative items-start justify-start pt-8"
            >
              <div className="relative w-full max-w-xs">
                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden w-full border border-white/20 bg-white/[0.03] ">
                  <img
                    src="/bags/nad-250.png"
                    alt="Avalon Vitality IM injection"
                    className="w-full h-full object-contain object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
                </div>
                <div className="absolute bottom-8 left-6 right-6 border border-border/60 bg-background/80  rounded-2xl p-6">
                  <p className="font-heading text-5xl text-foreground tracking-wide">~5min</p>
                  <p className="font-body text-xs text-accent tracking-widest uppercase mt-3">Full Dose — No IV Line Required</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

      </div>
    </section>
  );
}