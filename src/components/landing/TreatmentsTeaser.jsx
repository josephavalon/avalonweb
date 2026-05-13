import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, Zap, ShieldCheck, Sparkles, Heart, FlaskConical, Moon, Plane,
  ArrowRight, ChevronLeft, ChevronRight,
} from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];
const PER_PAGE = 4;

const TREATMENTS = [
  { icon: Droplets,     label: 'Hydration',       price: 150 },
  { icon: Zap,          label: 'Energy',           price: 250 },
  { icon: ShieldCheck,  label: 'Immunity',         price: 250 },
  { icon: FlaskConical, label: "Myers' Cocktail",  price: 250 },
  { icon: Heart,        label: 'Recovery',         price: 250 },
  { icon: Sparkles,     label: 'Beauty',           price: 250 },
  { icon: Moon,         label: 'Post-Night-Out',   price: 250 },
  { icon: Plane,        label: 'Jet Lag',          price: 250 },
];

const CARD = "flex flex-col gap-3 p-4 md:p-5 rounded-2xl border border-foreground/[0.1] hover:border-foreground/25 hover:bg-foreground/[0.02] transition-all duration-200 group h-full min-h-[160px]";

export default function TreatmentsTeaser() {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(TREATMENTS.length / PER_PAGE);
  const visible = TREATMENTS.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <section id="treatments" className="scroll-mt-20 md:scroll-mt-28 pt-6 pb-10 md:pt-10 md:pb-20 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5 md:mb-10">
          <div>
            <p className="font-body text-[11px] tracking-[0.3em] uppercase text-foreground/50 mb-2">Our Menu</p>
            <h2 className="font-heading text-[9vw] md:text-7xl text-foreground uppercase tracking-tight leading-[0.92]">Therapies</h2>
            <div className="w-10 h-[2px] bg-foreground mt-3" />
          </div>
          <Link to="/store" className="hidden md:flex items-center gap-2 font-body text-xs tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors">
            View Full Menu <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
        </div>

        {/* Desktop — paginated 4-col grid with side arrows */}
        <div className="hidden sm:block mb-8">
          <div className="relative px-10">

            {/* Prev */}
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/35 disabled:opacity-20 transition-all"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Cards */}
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="grid grid-cols-4 gap-2 md:gap-3"
              >
                {visible.map((t) => (
                  <Link key={t.label} to="/store" className={CARD}>
                    <t.icon className="w-5 h-5 text-foreground/40 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                    <div className="flex-1">
                      <p className="font-body text-sm font-semibold text-foreground tracking-[0.04em] leading-snug">{t.label}</p>
                    </div>
                    <p className="font-body text-sm text-foreground/60">From ${t.price}</p>
                  </Link>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Next */}
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/35 disabled:opacity-20 transition-all"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Page dots */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === page ? 'w-5 h-1.5 bg-foreground' : 'w-1.5 h-1.5 bg-foreground/20 hover:bg-foreground/40'
                }`}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Mobile — horizontal snap scroll */}
        <div className="sm:hidden -mx-4 px-4 mb-6">
          <div
            className="flex gap-2 overflow-x-auto pb-2 no-scrollbar"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              overscrollBehavior: 'contain',
              touchAction: 'pan-x',
              transform: 'translateZ(0)',
            }}
          >
            {TREATMENTS.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
                className="shrink-0"
                style={{ scrollSnapAlign: 'start' }}
              >
                <Link
                  to="/store"
                  className="flex flex-col gap-2.5 p-4 rounded-2xl border border-foreground/[0.1] active:border-foreground/25 active:bg-foreground/[0.02] transition-all duration-200 group"
                  style={{ width: '160px' }}
                >
                  <t.icon className="w-5 h-5 text-foreground/40" strokeWidth={1.5} />
                  <p className="font-body text-sm font-semibold text-foreground tracking-[0.02em] leading-tight">{t.label}</p>
                  <p className="font-body text-xs text-foreground/60">From ${t.price}</p>
                </Link>
              </motion.div>
            ))}
            <div aria-hidden="true" className="shrink-0 w-2" />
          </div>
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            to="/store"
            className="flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[240px] py-4 px-8 rounded-2xl bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
          >
            View Full Menu &amp; Book <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
          <p className="font-body text-[10px] tracking-[0.15em] uppercase text-foreground/35">
            IV Drips · IM Shots · Curated Packages · No membership required
          </p>
        </div>

      </div>
    </section>
  );
}
