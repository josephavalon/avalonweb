import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { EASE } from '@/lib/motion';

// "Why Avalon" — explicit comparison vs alternatives.
// Reduces visitor mental friction by answering "why not just X?" inline.
const COLUMNS = [
  { label: 'Avalon', highlight: true },
  { label: 'Med-spa' },
  { label: 'Doctor' },
  { label: 'Doing nothing' },
];

const ROWS = [
  { feature: 'Comes to you',                      values: [true, false, false, false] },
  { feature: 'Personalized protocol',             values: [true, false, true, false] },
  { feature: 'Tracked over time',                 values: [true, false, false, false] },
  { feature: 'No insurance hassle',               values: [true, true, false, true] },
  { feature: 'Concierge response time',           values: [true, false, false, false] },
  { feature: 'Lowest cost, highest care',          values: [true, false, false, false] },
];

export default function WhyAvalon() {
  return (
    <section className="py-14 md:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">Why Avalon</p>
          <h2 className="font-heading text-[9vw] md:text-7xl text-foreground tracking-wide leading-[0.95] uppercase">
            How we compare
          </h2>
          <div className="w-12 md:w-16 h-[2px] bg-accent mt-3 md:mt-4" />
        </motion.div>

        <div className="border border-white/15 bg-white/[0.03] backdrop-blur-md rounded-3xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1.5fr_repeat(4,1fr)] gap-2 md:gap-4 px-3 md:px-6 py-4 md:py-5 border-b border-white/10">
            <span className="font-body text-[10px] md:text-xs tracking-[0.25em] uppercase text-muted-foreground">Feature</span>
            {COLUMNS.map((c) => (
              <span
                key={c.label}
                className={`font-heading text-xs md:text-base tracking-wide uppercase text-center ${
                  c.highlight ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                {c.label}
              </span>
            ))}
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => (
            <motion.div
              key={row.feature}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: EASE }}
              className="grid grid-cols-[1.5fr_repeat(4,1fr)] gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 border-b border-white/5 last:border-b-0 items-center"
            >
              <span className="font-body text-xs md:text-sm text-foreground/70 leading-relaxed">
                {row.feature}
              </span>
              {row.values.map((v, j) => (
                <span key={j} className="flex justify-center">
                  {v ? (
                    <Check className={`w-4 h-4 md:w-5 md:h-5 ${j === 0 ? 'text-accent' : 'text-foreground/50'}`} strokeWidth={2.5} aria-label="Yes" />
                  ) : (
                    <X className="w-4 h-4 md:w-5 md:h-5 text-foreground/25" strokeWidth={2} aria-label="No" />
                  )}
                </span>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
