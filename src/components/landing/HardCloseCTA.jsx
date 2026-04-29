import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EASE } from '@/lib/motion';

export default function HardCloseCTA() {
  return (
    <section className="py-16 md:py-32 px-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="max-w-3xl mx-auto text-center"
      >
        <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-4 md:mb-6">Apply Today</p>
        <h2 className="font-heading text-[10vw] md:text-7xl text-foreground tracking-tight leading-[1.05] uppercase mb-6 md:mb-8">
          Start before<br />everyone else does.
        </h2>
        <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mx-auto mb-8 md:mb-10">
          Locked-in presale pricing. First nurse pick. First protocol seat.
        </p>
        <Link
          to="/apply"
          className="apply-now-btn inline-flex items-center gap-2 px-12 py-5 bg-foreground text-background font-body text-xs tracking-[0.3em] uppercase font-semibold hover:bg-foreground/90 transition-colors whitespace-nowrap"
        >
          Start Now <span aria-hidden="true">&rarr;</span>
        </Link>
      </motion.div>
    </section>
  );
}
