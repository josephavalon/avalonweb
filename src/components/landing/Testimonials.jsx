import React from 'react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: "I was completely wiped after a red-eye flight. The nurse arrived at my hotel in 45 minutes. Within an hour I felt like a completely different person — hydrated, focused, and ready for my meetings.",
    name: "A.R.",
    tag: "Dehydration IV"
  },
  {
    quote: "I used to lose entire Saturdays recovering. Now I book a morning session and I'm back to 100% by lunch. Genuinely life-changing for my weekends.",
    name: "M.T.",
    tag: "Hangover IV"
  },
  {
    quote: "The NAD+ IV is next level. My mental clarity after a 1000mg session lasts for days. I do one before any big pitch or launch. It's become part of my founder toolkit.",
    name: "J.L.",
    tag: "NAD+ 1000mg"
  },
  {
    quote: "As a competitive athlete, recovery is everything. Since adding biweekly IVs my recovery time has cut in half. I'm hitting PRs I haven't seen in years.",
    name: "K.D.",
    tag: "Event Performance IV"
  },
  {
    quote: "We booked Avalon for our entire team during BottleRock. They set up a recovery lounge backstage — the whole crew was back on their feet same day.",
    name: "S.P.",
    tag: "Event Recovery IV"
  },
  {
    quote: "The CBD IV was something I'd never tried before. Zero THC, pure calm. Slept better than I have in months. Already scheduled my next session.",
    name: "D.K.",
    tag: "CBD IV"
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 md:py-28 px-4 bg-secondary/40">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide">REAL RESULTS</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="border border-border rounded p-6 bg-card"
            >
              <p className="font-body text-sm text-foreground/80 leading-relaxed mb-5 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center justify-between">
                <span className="font-body text-sm font-semibold text-foreground">{t.name}</span>
                <span className="text-[9px] tracking-[0.15em] text-accent font-body uppercase">{t.tag}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}