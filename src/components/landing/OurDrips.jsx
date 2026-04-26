import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

const categories = [
  {
    label: 'Vitamins',
    href: '/services/iv-vitamins',
    tag: 'FROM $150 — WELLNESS FOUNDATION',
    desc: 'Dehydration, Myers\' Cocktail, Recovery, Athletic, Glow & more.',
    image: '/bags/immunity.png',
  },
  {
    label: 'NAD+',
    href: '/services/nad',
    tag: 'FROM $350 — NAD+ INFUSION',
    desc: 'A coenzyme found in every cell. Dose-graded protocols from 250mg to 1500mg.',
    image: '/bags/nad-1000.png',
  },
  {
    label: 'CBD',
    href: '/services/cbd',
    tag: 'FROM $250 — ZERO THC',
    desc: 'A non-psychoactive cannabinoid infusion. 33mg to 99mg formulas.',
    image: '/bags/cbd-99.png',
  },
];

export default function OurDrips() {
  return (
    <section id="treatments" className="scroll-mt-20 md:scroll-mt-28 py-4 md:py-10 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-left mb-8 md:mb-12"
        >
          <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-5 md:mb-6">Live Protocols</p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-foreground tracking-wide md:whitespace-nowrap text-[10vw] md:text-7xl lg:text-8xl"
          >
            VITALITY TREATMENTS
          </motion.h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-3 md:gap-4">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6 }}
            >
              <Link
                to={cat.comingSoon ? '/apply' : cat.href}
                className="group relative block rounded-3xl overflow-hidden border border-border bg-card hover:border-accent/40 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                aria-label={`${cat.label} — ${cat.desc}`}
              >
                <div className="aspect-[5/2] md:aspect-[9/4] relative overflow-hidden">
                  <img
                    src={cat.image}
                    alt={cat.label}
                    className="w-full h-full object-cover object-[center_70%] group-hover:scale-105 transition-transform duration-700 opacity-60 group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-card/20" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="font-heading text-4xl md:text-5xl text-foreground tracking-wide mb-1">{cat.label}</h3>

                  <span className="inline-flex items-center gap-2 text-accent group-hover:text-accent/80 transition-colors text-sm md:text-base font-body uppercase tracking-wider mt-3">
                    {cat.comingSoon ? 'Apply Now' : 'More'}
                    <ChevronDown className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}