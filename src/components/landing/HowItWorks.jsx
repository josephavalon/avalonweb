import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, MapPin, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const steps = [
  {
    icon: CalendarCheck,
    title: 'Build Your Visit',
    desc: 'Choose your drip, drop location, pick a time.',
  },
  {
    icon: MapPin,
    title: 'Avalon Confirms',
    desc: 'We confirm and send your RN details. No surprises.',
  },
  {
    icon: Zap,
    title: 'We Come to You',
    desc: 'Licensed RN arrives to your home, hotel, or office.',
  },
];

export default function HowItWorks() {
  const scrollRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);

  const scrollTo = (index) => {
    const container = scrollRef.current;
    if (!container) return;
    const cardWidth = container.offsetWidth;
    container.scrollTo({ left: cardWidth * index, behavior: 'smooth' });
    setActiveStep(index);
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const index = Math.round(container.scrollLeft / container.offsetWidth);
    setActiveStep(index);
  };

  return (
    <section id="how-it-works" className="pt-16 pb-10 md:py-20 px-4 scroll-mt-20">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-6 md:mb-10"
        >
          <p className="text-[11px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3">The Process</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95]">
            HOW AVALON WORKS
          </h2>
        </motion.div>

        {/* ── Mobile: full-width one-card carousel with arrows ── */}
        <div className="md:hidden relative">
          {/* Scroll container — snaps one full card at a time */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-x-auto no-scrollbar w-full"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x',
              overscrollBehavior: 'contain',
            }}
          >
            <div className="flex w-full">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="flex-none w-full p-4 border border-foreground/15 bg-foreground/[0.03] rounded-2xl text-center"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <step.icon className="w-5 h-5 text-accent mx-auto mb-2" strokeWidth={1.5} aria-hidden="true" />
                  <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-1">Step {i + 1} of {steps.length}</p>
                  <h3 className="font-heading text-lg text-foreground mb-1.5 tracking-wide">{step.title}</h3>
                  <p className="font-body text-xs text-foreground/70 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow + dot controls */}
          <div className="flex items-center justify-between mt-4 px-1">
            <button
              onClick={() => scrollTo(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className="w-8 h-8 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/35 disabled:opacity-20 transition-all"
              aria-label="Previous step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeStep ? 'w-5 h-1.5 bg-foreground' : 'w-1.5 h-1.5 bg-foreground/20'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => scrollTo(Math.min(steps.length - 1, activeStep + 1))}
              disabled={activeStep === steps.length - 1}
              className="w-8 h-8 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/35 disabled:opacity-20 transition-all"
              aria-label="Next step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Desktop: 3-col grid ── */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
              className="text-center p-5 border border-foreground/15 bg-foreground/[0.03] rounded-3xl"
            >
              <step.icon className="w-6 h-6 text-accent mx-auto mb-3" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="font-heading text-xl text-foreground mb-2 tracking-wide">{step.title}</h3>
              <p className="font-body text-sm text-foreground/70 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>


      </div>
    </section>
  );
}
