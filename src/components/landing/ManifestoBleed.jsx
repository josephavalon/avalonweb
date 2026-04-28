import React from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

// Full-bleed manifesto break. No max-width container — sits edge to edge.
// Used to break the rhythm between contained marketing sections.
export default function ManifestoBleed() {
  return (
    <section className="relative w-full py-24 md:py-40 overflow-hidden">
      {/* Subtle radial gradient wash — pulls focus to center without changing bg color */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[700px] rounded-full bg-accent/[0.03] blur-3xl" />
      </div>

      <div className="relative z-10 px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1.0, ease: EASE }}
          className="max-w-5xl mx-auto text-center"
        >
          <p className="text-xs md:text-sm tracking-[0.4em] text-accent font-body uppercase mb-6 md:mb-10">
            The Thesis
          </p>
          <h2 className="font-heading text-[12vw] md:text-[7rem] lg:text-[9rem] text-foreground tracking-[-0.01em] leading-[0.92] uppercase">
            Wellness becomes
            <br />
            <span className="text-accent">operating&nbsp;system.</span>
          </h2>
          <p className="font-body text-base md:text-xl lg:text-2xl text-foreground/75 leading-[1.55] max-w-3xl mx-auto mt-8 md:mt-12">
            Avalon is the operating system for human performance. IV today. Peptides, hormone optimization, recovery, diagnostics next. One protocol, every modality, every member.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
