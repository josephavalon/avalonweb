import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

const categories = [
  {
    label: 'Vitamins',
    href: '/services/iv-vitamins',
    tag: 'FROM $150 — WELLNESS FOUNDATION',
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
    label: 'CBD',
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
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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

        <div className="relative group">
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto" style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-3xl overflow-hidden border border-border bg-card hover:border-accent/40 transition-all duration-500 cursor-pointer flex-shrink-0 w-80"
              >
                <Link to={cat.href} className="aspect-video relative overflow-hidden block">
                  <img
                    src={cat.image}
                    alt={cat.label}
                    className="w-full h-full object-cover object-[center_70%] group-hover:scale-105 transition-transform duration-700 opacity-60 group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </Link>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="text-[10px] tracking-[0.25em] text-accent font-body uppercase mb-1">{cat.tag}</p>
                  <h3 className="font-heading text-3xl md:text-4xl text-foreground tracking-wide mb-2">{cat.label}</h3>
                  <p className="font-body text-xs text-muted-foreground leading-relaxed">{cat.desc}</p>
                  
                  <Link
                    to={cat.href}
                    className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition-colors text-xs font-body uppercase tracking-wider mt-3"
                  >
                    More
                    <ChevronDown className="w-3 h-3" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>

      </div>
      <style>{`.grid::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}