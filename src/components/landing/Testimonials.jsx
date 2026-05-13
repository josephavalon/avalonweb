import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { testimonials } from '@/data/testimonials';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

// testimonials data lives in src/data/testimonials.js

const EASE = [0.16, 1, 0.3, 1];

// Convert "J.G." → "JG", "Larry June" → "LJ"
function getInitials(name) {
  const cleaned = name.replace(/\./g, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    // Single word like "Diplo" — take first 2 letters
    return cleaned.slice(0, 2).toUpperCase();
  }
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function TestimonialCard({ t, active = false }) {
  const initials = getInitials(t.name);
  return (
    <div className={`w-[280px] sm:w-[320px] md:w-[340px] border bg-white/[0.04] backdrop-blur-md rounded-3xl p-6 md:p-7 flex flex-col gap-5 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${active ? "border-accent/60" : "border-white/10"}`}>
      {/* Face bubble — circular avatar with gold accent ring */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-accent/60 bg-white/[0.08] flex items-center justify-center shrink-0">
          <span className="font-heading text-base md:text-lg text-foreground tracking-wide">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading text-base md:text-lg text-foreground tracking-wide leading-tight">{t.name}</p>
          <p className="font-body text-[10px] md:text-[11px] tracking-[0.25em] text-accent uppercase mt-1">{t.tag}</p>
        </div>
      </div>

      {/* Words — the quote, large and quotable */}
      <div className="relative pl-4">
        <span className="absolute left-0 top-1 text-accent/50 font-heading text-2xl leading-none">&ldquo;</span>
        <p className="font-body text-sm md:text-base text-foreground leading-relaxed">
          {t.quote}
        </p>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Force load on first card (J.G. / Diplo)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
  }, []);

  // Track active index by scroll position (for dot indicators).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cardW = el.firstElementChild?.firstElementChild?.getBoundingClientRect().width || 320;
        const gap = 16;
        const idx = Math.round(el.scrollLeft / (cardW + gap));
        setActiveIndex(Math.max(0, Math.min(testimonials.length - 1, idx)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    // Keyboard nav: left/right arrows scroll the carousel by one card
    const onKey = (e) => {
      if (!el.contains(document.activeElement) && document.activeElement !== el) return;
      const cardW = el.firstElementChild?.firstElementChild?.getBoundingClientRect().width || 320;
      const gap = 16;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        el.scrollBy({ left: cardW + gap, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        el.scrollBy({ left: -(cardW + gap), behavior: 'smooth' });
      }
    };
    el.tabIndex = 0;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Testimonials carousel — use arrow keys to navigate');
    el.addEventListener('keydown', onKey);

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('keydown', onKey);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Manual scroll only — testimonials should not auto-advance (UX audit: reading is the conversion event)

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    if (direction === 'left' && scrollRef.current.scrollLeft <= 0) return;
    const amt = scrollRef.current.clientWidth;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amt : amt, behavior: 'smooth' });
  };

  return (
    <section className="py-12 md:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">From our clients</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
            Real Results
          </h2>
        </motion.div>

        <div className="relative">
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="absolute left-2 md:-left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="absolute right-2 md:-right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>

          <div
            ref={scrollRef}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="overflow-x-auto no-scrollbar overflow-y-hidden snap-x snap-mandatory pb-3"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}
          >
            <div className="flex gap-4 md:gap-5 pr-4">
              {testimonials.map((t, i) => (
                <div key={i} className="snap-start shrink-0">
                  <TestimonialCard t={t} active={i === activeIndex} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pagination dots */}
        <div className="flex items-center justify-center gap-2 mt-5 md:mt-6">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to testimonial ${i + 1}`}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                const cardW = el.firstElementChild?.firstElementChild?.getBoundingClientRect().width || 320;
                const gap = 16;
                el.scrollTo({ left: i * (cardW + gap), behavior: 'smooth' });
              }}
              className={`h-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                i === activeIndex ? 'w-6 bg-accent' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <div className="mt-8 md:mt-10 max-w-2xl">
          <p className="font-body text-xs md:text-sm tracking-[0.05em] text-muted-foreground leading-relaxed">
            Testimonials reflect the individual experience of real Avalon clients. Names and handles may be initials or stage names at each client&rsquo;s request. Individual experiences vary; results are not typical and are not guaranteed. No clients were compensated in cash for these statements; some received complimentary sessions. Educational information only — not medical advice.
          </p>
        </div>
      </div>
    </section>
  );
}
