import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Droplets, Zap, Gem, Leaf, FlaskConical, Sparkles } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const CATEGORIES = [
  {
    label: 'Hydration Base',
    icon: Droplets,
    ingredients: [
      {
        name: 'Normal Saline (0.9% NaCl)',
        description: 'Isotonic solution matching the body\'s natural fluid balance. The foundation of every Avalon IV session.',
      },
      {
        name: 'Lactated Ringer\'s',
        description: 'Electrolyte-balanced hydration solution. Contains sodium, potassium, calcium, and lactate.',
      },
    ],
  },
  {
    label: 'B Vitamins',
    icon: Zap,
    ingredients: [
      {
        name: 'Vitamin B1 (Thiamine)',
        description: 'Involved in carbohydrate metabolism and neurological function.',
      },
      {
        name: 'Vitamin B2 (Riboflavin)',
        description: 'Involved in energy production and cellular function.',
      },
      {
        name: 'Vitamin B3 (Niacin)',
        description: 'Involved in metabolism and skin health.',
      },
      {
        name: 'Vitamin B5 (Pantothenic Acid)',
        description: 'Involved in synthesis of coenzyme A and fatty acid metabolism.',
      },
      {
        name: 'Vitamin B6 (Pyridoxine)',
        description: 'Involved in amino acid metabolism and neurotransmitter synthesis.',
      },
      {
        name: 'Vitamin B12 (Methylcobalamin)',
        description: 'Involved in red blood cell formation and neurological function.',
      },
    ],
  },
  {
    label: 'Minerals & Electrolytes',
    icon: Gem,
    ingredients: [
      {
        name: 'Magnesium Chloride',
        description: 'Essential mineral involved in over 300 enzymatic reactions in the body.',
      },
      {
        name: 'Zinc',
        description: 'Trace mineral involved in immune function and wound healing.',
      },
      {
        name: 'Selenium',
        description: 'Antioxidant trace element involved in thyroid function.',
      },
      {
        name: 'Manganese',
        description: 'Involved in bone development and metabolic function.',
      },
    ],
  },
  {
    label: 'Antioxidants',
    icon: Leaf,
    ingredients: [
      {
        name: 'Glutathione',
        description: 'Tripeptide antioxidant naturally produced by the body. IV delivery bypasses digestive breakdown.',
      },
      {
        name: 'Vitamin C (Ascorbic Acid)',
        description: 'Water-soluble antioxidant vitamin involved in collagen synthesis and immune function.',
      },
      {
        name: 'Alpha Lipoic Acid',
        description: 'Antioxidant involved in energy metabolism.',
      },
    ],
  },
  {
    label: 'Amino Acids',
    icon: FlaskConical,
    ingredients: [
      {
        name: 'Taurine',
        description: 'Amino acid involved in cardiovascular function and electrolyte balance.',
      },
      {
        name: 'L-Carnitine',
        description: 'Amino acid involved in fatty acid transport and energy metabolism.',
      },
    ],
  },
  {
    label: 'Premium Add-ons',
    icon: Sparkles,
    ingredients: [
      {
        name: 'NAD+ (Nicotinamide Adenine Dinucleotide)',
        description: 'Coenzyme involved in cellular energy production and DNA repair processes.',
      },
      {
        name: 'CBD (Cannabidiol, 33mg, Zero THC)',
        description: 'Non-psychoactive cannabinoid. Zero THC. Full bioavailability via IV delivery.',
      },
    ],
  },
];

export default function Ingredients() {
  useSeo({ title: 'Ingredients & Formulations — Avalon Vitality', description: 'Full ingredient transparency for every Avalon IV drip and IM shot protocol.', path: '/ingredients' });
  const [activeCategory, setActiveCategory] = useState(null);

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Formulation Transparency
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              What's in Your Drip
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-4"
            >
              Every ingredient. Every source. No guessing.
            </motion.p>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
              className="font-body text-sm text-foreground/50 leading-relaxed max-w-2xl"
            >
              All Avalon formulations use pharmaceutical-grade ingredients sourced from FDA-registered compounding pharmacies and licensed distributors. Nothing proprietary. Nothing hidden.
            </motion.p>
          </div>
        </section>

        {/* Category Nav */}
        <section className="px-5 md:px-12 lg:px-20 pb-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`font-body text-xs tracking-[0.15em] uppercase px-4 py-2 rounded-full border transition-colors duration-200 ${
                  activeCategory === null
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-foreground/[0.12] text-foreground/50 hover:border-foreground/30 hover:text-foreground/80'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(activeCategory === cat.label ? null : cat.label)}
                  className={`font-body text-xs tracking-[0.15em] uppercase px-4 py-2 rounded-full border transition-colors duration-200 ${
                    activeCategory === cat.label
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-foreground/[0.12] text-foreground/50 hover:border-foreground/30 hover:text-foreground/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Ingredient Groups */}
        <section className="py-8 md:py-12 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto space-y-16">
            {CATEGORIES.filter(cat => activeCategory === null || cat.label === activeCategory).map((cat, ci) => {
              const Icon = cat.icon;
              return (
                <motion.div
                  key={cat.label}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: ci * 0.05 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40">{cat.label}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {cat.ingredients.map((ing, ii) => (
                      <motion.div
                        key={ing.name}
                        {...REVEAL}
                        transition={{ duration: 0.7, ease: EASE, delay: ci * 0.05 + ii * 0.06 }}
                        className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                      >
                        <p className="font-heading text-lg md:text-xl text-foreground uppercase leading-tight mb-3">
                          {ing.name}
                        </p>
                        <p className="font-body text-sm text-foreground/60 leading-relaxed">
                          {ing.description}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Sourcing Note */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row gap-6 md:gap-10 items-start"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">Sourcing</p>
                <h2 className="font-heading text-2xl md:text-3xl text-foreground uppercase leading-[0.95] mb-4">
                  Pharmaceutical Grade. Every Time.
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl">
                  All ingredients are sourced from FDA-registered facilities. Lot numbers and certificates of analysis are available upon request. If you have questions about a specific ingredient or formulation, contact us directly.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer links */}
        <section className="py-12 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-6">
            <Link to="/safety" className="font-body text-sm text-foreground/50 hover:text-foreground transition-colors duration-200">
              Safety Standards →
            </Link>
            <Link to="/medical-direction" className="font-body text-sm text-foreground/50 hover:text-foreground transition-colors duration-200">
              Medical Direction →
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
