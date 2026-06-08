import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';

const EASE = [0.16, 1, 0.3, 1];

export default function RNProfiles() {
  return (
    <section
      aria-label="Our registered nurses"
      className="py-16 md:py-24 px-5 md:px-12 lg:px-20 max-w-6xl mx-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mb-8 md:mb-10"
      >
        <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
          Our Team
        </p>
        <h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-none mb-4">
          Registered Nurses
        </h2>
        <p className="font-body text-sm text-foreground/55 leading-relaxed max-w-xl">
          Avalon is finalizing the public nurse roster.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
        className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
      >
        <p className="font-heading text-4xl md:text-6xl text-foreground uppercase leading-none">
          Coming soon!
        </p>
        <p className="mt-4 max-w-2xl font-body text-sm text-foreground/55 leading-relaxed">
          Every Avalon visit is administered by a California-licensed registered nurse after intake and clinical review.
        </p>
      </motion.div>
    </section>
  );
}
