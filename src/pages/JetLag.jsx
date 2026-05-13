import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plane, Plus, ArrowRight, Clock, MapPin, Shield } from 'lucide-react';
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
  { name: 'Normal Saline', note: 'Rehydration base — 1L IV fluid to counter cabin dehydration' },
  { name: 'B-Complex Vitamins', note: 'Supports energy metabolism and may help with fatigue associated with travel' },
  { name: 'Magnesium', note: 'Supports muscle relaxation and sleep quality' },
  { name: 'Vitamin C', note: 'Antioxidant replenishment after long-haul travel' },
  { name: 'Electrolytes', note: 'Restores mineral balance depleted during flight' },
];

const ADD_ONS = [
  { name: 'Melatonin IM Shot', description: 'Intramuscular melatonin to support circadian rhythm reset', price: '+$35' },
  { name: 'B12 Shot', description: 'High-dose B12 injection associated with energy and alertness support', price: '+$25' },
  { name: 'Glutathione Push', description: 'Antioxidant support after radiation exposure at altitude', price: '+$40' },
];

const STEPS = [
  {
    number: '01',
    headline: 'Book on Arrival',
    description: 'Schedule from the plane or as soon as you land at SFO. Same-day appointments available.',
  },
  {
    number: '02',
    headline: 'Your Nurse Arrives',
    description: 'A licensed RN comes to your hotel, residence, or office — no clinic visit required.',
  },
  {
    number: '03',
    headline: 'Reset and Recover',
    description: 'Relax during your 45–60 minute drip. Recover in hours instead of days.',
  },
];

const STATS = [
  { value: 'Same Day', label: 'Scheduling available' },
  { value: 'RN', label: 'Licensed nurse every visit' },
  { value: 'SFO Area', label: 'Service area' },
];

export default function JetLag() {
  useSeo({
    title: 'Jet Lag IV Therapy San Francisco — Avalon Vitality',
    description: 'Recover from jet lag faster with mobile IV therapy in San Francisco. Delivered to your hotel or home by licensed RNs.',
    path: '/jet-lag',
  });

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Jet Lag Recovery
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-4"
            >
              Jet Lag Recovery
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-3"
            >
              Reset your internal clock. Recover in hours, not days.
            </motion.p>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
              className="font-body text-xs text-foreground/50 leading-relaxed max-w-xl mb-10"
            >
              Popular with international travelers, business executives, and frequent flyers arriving at SFO.
            </motion.p>

            {/* Stats */}
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.28 }}
              className="flex flex-wrap gap-8 mb-10"
            >
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="font-heading text-3xl md:text-4xl text-foreground">{stat.value}</p>
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>

            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.34 }}
            >
              <Link
                to="/store"
                className="inline-flex items-center gap-2 bg-accent text-background font-body text-sm tracking-[0.15em] uppercase px-8 py-4 rounded-xl hover:bg-accent/90 transition-colors duration-200"
              >
                Book Now <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Recommended Protocol */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Recommended Protocol
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-4"
            >
              Jet Lag Drip
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
                    <Plane className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl md:text-3xl text-foreground uppercase">Jet Lag</p>
                    <p className="font-body text-xs text-foreground/40 tracking-[0.15em] uppercase mt-1">Full IV Drip — 45–60 min</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-heading text-3xl text-accent">From $229</p>
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
                  to="/store"
                  className="inline-flex items-center gap-2 bg-accent text-background font-body text-sm tracking-[0.15em] uppercase px-7 py-3.5 rounded-xl hover:bg-accent/90 transition-colors duration-200"
                >
                  Book Now <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Add-Ons */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Optional Enhancements
            </motion.p>
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

        {/* How It Works */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              How It Works
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Three Simple Steps
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-6">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.number}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                >
                  <p className="font-heading text-4xl text-foreground/10 mb-4">{step.number}</p>
                  <p className="font-heading text-xl text-foreground uppercase mb-3">{step.headline}</p>
                  <p className="font-body text-sm text-foreground/60 leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Trust bar */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start"
            >
              <div className="flex-1">
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">Built for Travelers</p>
                <h2 className="font-heading text-2xl md:text-3xl text-foreground uppercase leading-[0.95] mb-4">
                  We Come to Your Hotel
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl">
                  Whether you've just landed at SFO or checked into a downtown hotel, Avalon sends a licensed RN directly to you. No clinic. No commute. No waiting.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { icon: Shield, label: 'RN-administered' },
                  { icon: Clock, label: 'Same-day availability' },
                  { icon: MapPin, label: 'Hotel & home visits' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-accent" />
                    <p className="font-body text-sm text-foreground/60">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Bottom CTA */}
        <Reveal as="section" className="py-12 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-6">
            <p className="font-body text-sm text-foreground/50">Ready to reset?</p>
            <Link
              to="/store"
              className="font-body text-sm text-foreground/70 hover:text-foreground transition-colors duration-200 flex items-center gap-1"
            >
              Book Now <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
