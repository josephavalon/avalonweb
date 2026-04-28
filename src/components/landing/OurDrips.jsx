import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Droplets, Zap, Plus } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

const EASE = [0.16, 1, 0.3, 1];

const treatments = [
  {
    label: 'IV Vitamins',
    href: '/services/iv-vitamins',
    icon: Droplets,
    price: 150,
    suffix: '/ session',
    tag: 'Wellness Foundation',
    perks: [
      'Dehydration · Myers’ Cocktail · Recovery',
      'Athletic · Glow · Immunity',
      'B-complex, magnesium, glutathione options',
      'In-home or concierge',
    ],
  },
  {
    label: 'NAD+ IV',
    href: '/services/nad',
    icon: Zap,
    price: 350,
    suffix: '/ session',
    tag: 'Cellular Repair',
    perks: [
      'Coenzyme found in every cell',
      '250mg → 1500mg dose-graded',
      'Avalon clinician on-site',
      'Pairs with peptide protocols',
    ],
  },
  {
    label: 'CBD IV',
    href: '/services/cbd',
    icon: CannabisLeaf,
    price: 250,
    suffix: '/ session',
    tag: 'Recovery & Calm',
    perks: [
      '33mg → 99mg formulas',
      'Zero THC, full bioavailability',
      'Delivered by Avalon’s nurses',
      'Same-day booking available',
    ],
  },
];

export default function OurDrips() {
  return (
    <section id="treatments" className="scroll-mt-20 md:scroll-mt-28 py-6 md:py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">Live Protocols</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
            Vitality Treatments
          </h2>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mt-3 md:mt-5">
            One-time sessions, delivered by Avalon&rsquo;s nurses across the San Francisco Bay Area. No insurance, no surprises.
          </p>
        </motion.div>

        <div
          className="overflow-x-auto overflow-y-visible no-scrollbar pb-3 -mx-4 px-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-3 md:gap-5 w-max snap-x snap-mandatory">
          {treatments.map((t, i) => {
            const Icon = t.icon;
            return (
              <div
                key={t.label}
                className="snap-start shrink-0 w-[260px] md:w-[300px] border border-white/10 bg-white/[0.04] backdrop-blur-md rounded-3xl p-5 md:p-6 flex flex-col"
              >
                {/* Tier name row */}
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
                  <h3 className="font-heading text-xl tracking-wide text-foreground uppercase">{t.label}</h3>
                </div>

                {/* Tag */}
                <p className="font-body text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-4">{t.tag}</p>

                {/* Price */}
                <div className="mb-5">
                  <div className="font-heading text-5xl md:text-6xl text-foreground leading-none tracking-tight">
                    ${t.price}
                  </div>
                  <div className="font-body text-xs tracking-widest uppercase text-muted-foreground mt-1">{t.suffix}</div>
                </div>

                {/* Perks */}
                <ul className="space-y-1.5 mb-5 flex-1">
                  {t.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Plus className="w-3 h-3 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className="font-body text-xs text-foreground leading-snug">{perk}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  to={t.href}
                  className="block text-center py-2.5 md:py-3 font-body text-sm tracking-widest uppercase font-semibold rounded-full transition-colors mt-auto border border-foreground/30 text-foreground hover:border-foreground"
                >
                  Book Now
                </Link>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
}
