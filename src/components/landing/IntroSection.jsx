import React from 'react';
import { motion } from 'framer-motion';

export default function IntroSection() {
  return (
    <section className="py-20 md:py-28 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide mb-8">AVALON VITALITY</h2>
          <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed mb-6">
            Our licensed medical team goes beyond IV therapy to deliver mobile recovery therapies wherever you are.
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            From backstage tents and private villas to hotel suites and corporate retreats, Avalon has built a new standard for mobile recovery. We're not just elevating hydration — we're redefining how people prepare, perform, and recover.
          </p>
        </motion.div>
      </div>
    </section>
  );
}