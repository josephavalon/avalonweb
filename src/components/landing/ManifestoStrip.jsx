import React from 'react';
import { motion } from 'framer-motion';
import { EASE } from '@/lib/motion';

// Single-line manifesto strip. Sits between sections to break the rhythm.
// Brand polish: Aesop/Loro Piana editorial pause.
export default function ManifestoStrip() {
  return (
    <section className="py-14 md:py-24 px-4">
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.9, ease: EASE }}
        className="max-w-4xl mx-auto text-center font-heading text-2xl md:text-4xl lg:text-5xl text-foreground tracking-wide leading-[1.05] uppercase"
      >
        Wellness <span className="text-accent">Operating System</span>
      </motion.p>
    </section>
  );
}
