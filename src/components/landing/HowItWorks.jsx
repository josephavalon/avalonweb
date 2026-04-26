import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, MapPin, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const steps = [
  {
    icon: CalendarCheck,
    title: 'Book in Minutes',
    desc: 'Online or by text.',
  },
  {
    icon: MapPin,
    title: 'We Come to You',
    desc: 'Home, office, hotel, event.',
  },
  {
    icon: Zap,
    title: 'Feel It Fast',
    desc: 'Refreshed in 30–60 minutes.',
  },
];

export default function HowItWorks() {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <section
      id="how-it-works"
      className="py-8 md:py-10 px-4 bg-secondary/40 scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4 md:mb-8"
        >
          <div className="text-left max-w-3xl">
            <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">The Process</p>
            <h2 className="font-heading text-foreground tracking-wide md:whitespace-nowrap text-[10vw] md:text-7xl lg:text-8xl">
              HOW IT WORKS
            </h2>
            <p className="font-body text-sm text-foreground mt-4 max-w-2xl">
              <a href="/#membership" className="text-accent hover:text-accent/80 underline">
                Apply for membership
              </a>{' '}
              now to secure your spot. Mobile platform launching soon — book, reorder, and track in one tap.
            </p>
          </div>

          {/* Desktop-hidden, mobile-visible carousel controls lifted above the cards
              so they don't overlap card content. */}
          <div className="hidden items-center gap-2 self-end">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-full border border-border bg-card hover:bg-secondary transition-colors"
              aria-label="Previous step"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-full border border-border bg-card hover:bg-secondary transition-colors"
              aria-label="Next step"
            >
              <ChevronRight className="w-4 h-4 text-foreground" strokeWidth={1.75} />
            </button>
          </div>
        </motion.div>

        {/* Carousel — snap-mandatory with peek on mobile, grid on desktop. */}
        <div
          ref={scrollRef}
          className="how-it-works-scroll -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible snap-x snap-mandatory"
          style={{
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-8 w-max md:w-full md:justify-start">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.7, ease: EASE }}
                className="shrink-0 w-[60vw] sm:w-[45vw] md:w-auto snap-start text-center p-4 md:p-5 border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-3xl"
              >
                <step.icon
                  className="w-6 h-6 text-accent mx-auto mb-2"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h3 className="font-heading text-lg md:text-xl text-foreground mb-1 tracking-wide">
                  {step.title}
                </h3>
                <p className="font-body text-xs md:text-sm text-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
            {/* End-of-list spacer keeps the last card from bumping the viewport edge
                so its right border is visible when snapped. */}
            <div aria-hidden="true" className="shrink-0 w-4 md:hidden" />
          </div>
        </div>
      </div>

      <style>{`.how-it-works-scroll::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}
