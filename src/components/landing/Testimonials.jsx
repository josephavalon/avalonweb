import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  { quote: "I’m a founder who codes 20hrs a day now. NAD+ makes it happen.", name: "J.G.", tag: "NAD+ IV" },
  { quote: "That was awesome.", name: "Diplo", tag: "ENERGY IV" },
  { quote: "I love NAD+. I knock one out before any big pitch. It's part of my routine now.", name: "R.D.", tag: "NAD+ 1000MG" },
  { quote: "That IV did digits.", name: "Larry June", tag: "RECOVERY IV" },
  { quote: "I'm an AI founder. Every day I gain new abilities. Avalon holds me down through the storm.", name: "J.L.", tag: "PERFORMANCE IV" },
  { quote: "Beauty IV is my weekly. Glutathione drip, every time.", name: "A.G.", tag: "BEAUTY IV" },
  { quote: "Booked Avalon for a festival. Green room was lit. They set up an entire recovery lounge backstage. Artists and crew loved it.", name: "G.B.", tag: "EVENT RECOVERY" },
  { quote: "Who knew CBD IVs were a thing? Zero THC. The most relaxing drip experience I've had. Already booked my next bag.", name: "C.A.", tag: "CBD IV" },
].sort((a, b) => {
  const order = { 'J.G.': 0, 'Diplo': 1, 'R.D.': 2 };
  return (order[a.name] ?? 999) - (order[b.name] ?? 999);
});

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

function TestimonialCard({ t }) {
  const initials = getInitials(t.name);
  return (
    <div className="w-[280px] sm:w-[320px] md:w-[340px] border border-white/10 bg-white/[0.04] backdrop-blur-md rounded-3xl p-6 md:p-7 flex flex-col gap-5">
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
        <p className="font-body text-sm md:text-base text-foreground/90 leading-relaxed">
          {t.quote}
        </p>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);

  // Force load on first card (J.G. / Diplo)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
  }, []);

  // Auto-advance every 4.5s
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el || document.hidden) return;
      const cardW = el.firstElementChild?.firstElementChild?.getBoundingClientRect().width || 320;
      const gap = 16;
      const maxLeft = el.scrollWidth - el.clientWidth;
      const next = Math.abs(el.scrollLeft - maxLeft) < 8 ? 0 : el.scrollLeft + cardW + gap;
      el.scrollTo({ left: next, behavior: 'smooth' });
    }, 4500);
    return () => clearInterval(id);
  }, [paused]);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    if (direction === 'left' && scrollRef.current.scrollLeft <= 0) return;
    const amt = scrollRef.current.clientWidth;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amt : amt, behavior: 'smooth' });
  };

  return (
    <section className="py-8 md:py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">From our clients</p>
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
                  <TestimonialCard t={t} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 md:mt-10 max-w-2xl">
          <p className="font-body text-xs md:text-sm tracking-[0.05em] text-muted-foreground/80 leading-relaxed">
            Testimonials reflect the individual experience of real Avalon clients. Names and handles may be initials or stage names at each client&rsquo;s request. Individual experiences vary; results are not typical and are not guaranteed. No clients were compensated in cash for these statements; some received complimentary sessions. Educational information only — not medical advice.
          </p>
        </div>
      </div>
    </section>
  );
}
