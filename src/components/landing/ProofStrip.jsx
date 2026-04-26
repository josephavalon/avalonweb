import React from 'react';
import { motion } from 'framer-motion';

// Three-stat traction signal. Placed high in the funnel so a visitor (and a
// VC) sees proof before they see pricing. Keep honest — if you don't have
// the number yet, replace the stat entirely rather than inflating.
//
// Source-of-truth should eventually be the member dashboard backend — see
// src/lib/analytics.js for the event taxonomy that feeds these.
const STATS = [
  { value: '94%',    label: 'Month-3 retention' },          // TODO(joseph): verify from beta cohort.
  { value: '1 in 3', label: 'From a member referral' },     // TODO(joseph): verify from referral funnel.
  { value: '4.9',    label: 'Member satisfaction' },        // TODO(joseph): swap to live NPS / rating.
];

const EASE = [0.16, 1, 0.3, 1];

export default function ProofStrip() {
  return (
    <section
      aria-label="Member traction signals"
      className="py-8 md:py-14 px-4"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-3 divide-x divide-border">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
              className="px-3 md:px-8 text-center"
            >
              <p className="font-heading text-4xl md:text-7xl text-foreground tracking-wide mb-2 md:mb-3 leading-none">
                {stat.value}
              </p>
              <p className="font-body text-xs md:text-xs tracking-[0.25em] uppercase text-muted-foreground leading-tight">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
