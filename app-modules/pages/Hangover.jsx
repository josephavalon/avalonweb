import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { Droplets, Plus, ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const PROTOCOL_INGREDIENTS = [
  { name: 'Normal Saline', note: 'Rehydration base — 1L IV fluid' },
  { name: 'B-Vitamin Complex', note: 'Supports vitamin replenishment after alcohol use' },
  { name: 'Ondansetron (Zofran)', note: 'May help with nausea and stomach discomfort' },
  { name: 'Ketorolac (Toradol)', note: 'Available only when clinically appropriate and provider-reviewed' },
  { name: 'Vitamin C', note: 'Antioxidant support during recovery' },
];

const ADD_ONS = [
  { name: 'Glutathione Push', description: 'Antioxidant wellness support when clinically appropriate', price: '+$40' },
  { name: 'Extra B12', description: 'Additional energy-supporting vitamin replenishment', price: '+$25' },
  { name: 'Extra Fluids', description: 'Additional 500mL saline for deeper rehydration', price: '+$30' },
];

export default function Hangover() {
  useSeo({
    title: 'Hangover IV Support San Francisco — Avalon Vitality',
    description: "Same-day hydration support delivered to your home or hotel in San Francisco. Licensed RNs. Clinical review required before treatment.",
    path: '/hangover',
  });

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-4"
            >
              Hangover Support
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-3"
            >
              A licensed nurse. Your location. Same day.
            </motion.p>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
              className="font-body text-xs text-accent/80 tracking-[0.1em] uppercase mb-10"
            >
              Most appointments confirmed within 2 hours.
            </motion.p>

            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.34 }}
            >
              <Link
                to="/book"
                className="inline-flex items-center gap-2 bg-accent text-background font-body text-sm tracking-[0.15em] uppercase px-8 py-4 rounded-xl hover:bg-accent/90 transition-colors duration-200"
              >
                BUY NOW <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Recommended Protocol */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-4"
            >
              Hangover Recovery Support
            </motion.h2>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="font-body text-xs text-foreground/40 leading-relaxed max-w-2xl mb-10"
            >
              Educational information only. IV therapy is not a substitute for physician-directed medical treatment. Statements below reflect associated outcomes, not guaranteed results. Consult your physician about whether IV therapy is appropriate for you.
            </motion.p>

            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10"
            >
              <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Droplets className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl md:text-3xl text-foreground uppercase">Hangover Recovery</p>
                    <p className="font-body text-xs text-foreground/40 tracking-[0.15em] uppercase mt-1">Full IV Drip — 45–60 min</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-heading text-3xl text-accent">From $249</p>
                  <p className="font-body text-[10px] text-foreground/40 tracking-[0.2em] uppercase mt-1">Per session</p>
                </div>
              </div>

              <div className="space-y-4">
                {PROTOCOL_INGREDIENTS.map((item, i) => (
                  <motion.div
                    key={item.name}
                    {...REVEAL}
                    transition={{ duration: 0.6, ease: EASE, delay: i * 0.07 }}
                    className="flex items-start gap-4 py-4 border-b border-foreground/[0.06] last:border-0"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-2" />
                    <div>
                      <p className="font-body text-sm text-foreground/85">{item.name}</p>
                      <p className="font-body text-xs text-foreground/40 mt-0.5">{item.note}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8">
                <Link
                  to="/book"
                  className="inline-flex items-center gap-2 bg-accent text-background font-body text-sm tracking-[0.15em] uppercase px-7 py-3.5 rounded-xl hover:bg-accent/90 transition-colors duration-200"
                >
                  BUY NOW <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Add-Ons */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Add-Ons
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-6">
              {ADD_ONS.map((addon, i) => (
                <motion.div
                  key={addon.name}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <p className="font-heading text-lg text-foreground uppercase">{addon.name}</p>
                  </div>
                  <p className="font-body text-sm text-foreground/60 leading-relaxed mb-4">{addon.description}</p>
                  <p className="font-heading text-2xl text-accent">{addon.price}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
