import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

const categories = [
  {
    label: 'IV Vitamins',
    href: '/services/iv-vitamins',
    tag: 'FROM $150',
    desc: 'Dehydration, Myers\' Cocktail, Hangover, Energy, Immunity, Beauty & more.',
    image: 'https://media.base44.com/images/public/69e5682f98e509792c71ef21/dc9537125_fffff.png',
  },
  {
    label: 'NAD+',
    href: '/services/nad',
    tag: 'FROM $350 — LONGEVITY MOLECULE',
    desc: 'Cellular energy, cognitive enhancement, and anti-aging from 250mg to 1500mg.',
    image: 'https://media.base44.com/images/public/69e5682f98e509792c71ef21/58e932da3_ddddd.png',
  },
  {
    label: 'IV CBD',
    href: '/services/cbd',
    tag: 'FROM $250 — ZERO THC',
    desc: 'Anti-inflammatory, stress relief, and recovery. 33mg to 132mg formulas.',
    image: 'https://media.base44.com/images/public/69e5682f98e509792c71ef21/cbe90ca8d_33.png',
  },
  {
    label: 'Exosomes',
    href: '/services/exosomes',
    tag: 'FROM $700 — CELLULAR SUPPORT',
    desc: 'Advanced cellular regeneration with 30B, 50B, and 90B exosome IV options.',
    image: 'https://media.base44.com/images/public/69e5682f98e509792c71ef21/e81e482a1_444.png',
  },
];

export default function OurDrips() {
  const [expanded, setExpanded] = useState({});

  return (
    <section id="treatments" className="py-8 md:py-10 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="font-heading text-6xl md:text-8xl text-foreground tracking-wide">VITALITY TREATMENTS</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative rounded overflow-hidden border border-border bg-card hover:border-accent/40 transition-all duration-500"
            >
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={cat.image}
                  alt={cat.label}
                  className="w-full h-full object-cover object-[center_70%] group-hover:scale-105 transition-transform duration-700 opacity-60 group-hover:opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              </div>
              <div className="p-6">
                <p className="text-[10px] tracking-[0.25em] text-accent font-body uppercase mb-1">{cat.tag}</p>
                <h3 className="font-heading text-3xl md:text-4xl text-foreground tracking-wide mb-2">{cat.label}</h3>
                <p className="font-body text-xs text-muted-foreground leading-relaxed">{cat.desc}</p>
                
                <div className="flex items-center gap-3 mt-4">
                  <Link
                    to={cat.href}
                    className="inline-block bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded px-6 py-2.5 hover:bg-foreground/90 transition-colors"
                  >
                    Order Now
                  </Link>
                  
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [cat.label]: !prev[cat.label] }))}
                    className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors text-xs font-body uppercase tracking-wider"
                  >
                    {expanded[cat.label] ? 'Less' : 'More'}
                    <ChevronDown className={`w-3 h-3 transition-transform ${expanded[cat.label] ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>


      </div>
    </section>
  );
}