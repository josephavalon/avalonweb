import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, ChevronRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { CATEGORIES, ALL_TREATMENTS, buildAcuityUrl, ACUITY_OWNER_ID } from '@/data/acuityCatalog';

const EASE = [0.16, 1, 0.3, 1];

function TreatmentCard({ treatment }) {
  const url = buildAcuityUrl(treatment.appointmentTypeId);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block rounded-2xl border border-foreground/15 bg-background p-6 md:p-7 transition-colors hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/40"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-display text-2xl md:text-3xl uppercase tracking-tight leading-none">{treatment.name}</h3>
        <ArrowRight className="w-5 h-5 text-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-foreground shrink-0 mt-1" strokeWidth={1.5} />
      </div>
      <p className="text-sm md:text-base text-foreground/75 mb-5 leading-snug min-h-[2.75rem]">{treatment.blurb}</p>
      <div className="flex items-end justify-between pt-4 border-t border-foreground/10">
        <div className="flex flex-col gap-1">
          <span className="font-display text-3xl md:text-4xl leading-none">${treatment.price}</span>
          <span className="text-xs uppercase tracking-[0.2em] text-foreground/50">/ session</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-foreground/60">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
          {treatment.duration}
        </span>
      </div>
    </a>
  );
}

function CategoryBlock({ category, index }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.05 }}
      id={category.id}
      className="scroll-mt-32"
    >
      <header className="mb-6 md:mb-8">
        <p className="font-body text-xs tracking-[0.3em] uppercase text-accent mb-2">{category.eyebrow}</p>
        <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight leading-none mb-3">{category.name}</h2>
        <p className="text-base md:text-lg text-foreground/70 max-w-2xl">{category.description}</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {category.treatments.map((t) => <TreatmentCard key={t.id} treatment={t} />)}
      </div>
    </motion.section>
  );
}

export default function Book() {
  const [generalUrl] = useState(() => buildAcuityUrl());
  const isConfigured = Boolean(ACUITY_OWNER_ID);

  useEffect(() => {
    document.title = 'Book — Avalon Vitality';
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 md:pt-36 pb-12 md:pb-16 px-5 md:px-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <p className="font-body text-xs md:text-sm tracking-[0.3em] uppercase text-accent mb-4">Book your visit</p>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl uppercase tracking-tight leading-[0.9] mb-5">
              The menu.<br />Pick what fits.
            </h1>
            <p className="text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
              Tap a treatment to schedule. Pick a date and time. Pay at booking. RN arrives at the address you provide.
              Add-ons can stack with any IV — choose them at checkout.
            </p>
          </motion.div>
          {!isConfigured && (
            <motion.aside
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8 inline-flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-xs md:text-sm text-foreground/70"
            >
              <span className="font-body uppercase tracking-[0.2em] text-accent shrink-0">Setup</span>
              <span>
                Acuity catalog placeholders active. Replace <code className="font-mono">ACUITY_OWNER_ID</code> and each <code className="font-mono">appointmentTypeId</code> in
                <code className="font-mono"> src/data/acuityCatalog.js</code> to wire real schedules.
              </span>
            </motion.aside>
          )}
        </div>
      </section>

      {/* Quick category jumper */}
      <section className="px-5 md:px-10 pb-10 md:pb-14">
        <div className="max-w-6xl mx-auto">
          <nav aria-label="Treatment categories" className="flex flex-wrap gap-2 md:gap-3 border-y border-foreground/10 py-4">
            {CATEGORIES.map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-foreground/20 text-xs md:text-sm font-body uppercase tracking-[0.2em] text-foreground/80 hover:border-foreground/60 hover:text-foreground transition-colors"
              >
                {c.name}
                <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Treatment categories */}
      <section className="px-5 md:px-10 pb-16 md:pb-24">
        <div className="max-w-6xl mx-auto space-y-16 md:space-y-24">
          {CATEGORIES.map((c, i) => <CategoryBlock key={c.id} category={c} index={i} />)}
        </div>
      </section>

      {/* How booking works */}
      <section className="px-5 md:px-10 py-16 md:py-24 border-t border-foreground/10">
        <div className="max-w-6xl mx-auto">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-accent mb-3">Booking</p>
          <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-none mb-10 md:mb-14">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            <div>
              <p className="font-display text-5xl md:text-6xl text-accent leading-none mb-3">01</p>
              <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight leading-tight mb-2">Pick</h3>
              <p className="text-sm md:text-base text-foreground/70 leading-relaxed">Choose a treatment from the menu above. Tap the card to open scheduling.</p>
            </div>
            <div>
              <p className="font-display text-5xl md:text-6xl text-accent leading-none mb-3">02</p>
              <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight leading-tight mb-2">Schedule</h3>
              <p className="text-sm md:text-base text-foreground/70 leading-relaxed">Pick a date and time that works. Add your address, add any IM shots or compression. Pay at booking.</p>
            </div>
            <div>
              <p className="font-display text-5xl md:text-6xl text-accent leading-none mb-3">03</p>
              <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight leading-tight mb-2">Recover</h3>
              <p className="text-sm md:text-base text-foreground/70 leading-relaxed">RN arrives within your booked window. 20–60 minutes from start to finish. You go back to your day.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-5 md:px-10 py-16 md:py-24 border-t border-foreground/10">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-tight mb-5">
            Don't see what you need?
          </h2>
          <p className="text-base md:text-lg text-foreground/70 mb-8 max-w-xl mx-auto">
            Membership unlocks bigger doses, smaller per-session pricing, and priority booking. Or open the full Acuity scheduler to browse every appointment type.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link to="/apply" className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-sm md:text-base tracking-[0.2em] uppercase px-7 py-3.5 hover:opacity-85 transition-opacity">
              See memberships <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
            <a href={generalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-foreground/40 font-body text-sm md:text-base tracking-[0.2em] uppercase px-7 py-3.5 hover:border-foreground transition-colors">
              Browse all in Acuity
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
