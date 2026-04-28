import React from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

// Second full-bleed break — late-flow brand statement before Stay in the Loop.
// More restrained than ManifestoBleed; one statement, more whitespace, no eyebrow.
export default function CalloutBleed() {
  return (
    <section className="relative w-full py-20 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.9, ease: EASE }}
        className="max-w-4xl mx-auto px-6 md:px-12 text-center"
      >
        <p className="font-heading text-3xl md:text-5xl lg:text-6xl text-foreground tracking-tight leading-[1.1]">
          Built in California.
          <br />
          <span className="text-foreground/60">Built for the long game.</span>
        </p>
      </motion.div>
    </section>
  );
}
