import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, MapPin, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

const steps = [
  {
    icon: CalendarCheck,
    title: 'Book online or by phone',
    desc: 'Reserve your treatment in minutes — online or via text.',
  },
  {
    icon: MapPin,
    title: 'We Come to You',
    desc: 'Our nurse arrives at your home, hotel, office, or event — fully equipped.',
  },
  {
    icon: Zap,
    title: 'Recover Fast',
    desc: 'Feel refreshed within 30–60 minutes of your infusion.',
  },
];

export default function HowItWorks() {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="how-it-works" className="py-8 md:py-10 px-4 border-t border-border bg-secondary/40 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide">HOW IT WORKS</h2>
          <p className="font-body text-sm text-muted-foreground mt-4 max-w-2xl mx-auto">
            <a href="#membership" className="text-accent hover:text-accent/80 underline">Apply for membership</a> now to secure your spot. On-demand service launching soon.
          </p>
        </motion.div>

        <div className="overflow-x-auto md:overflow-visible relative group">
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 md:hidden p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 md:hidden p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
          <div ref={scrollRef} className="flex md:grid md:grid-cols-3 gap-8 md:gap-8 w-full md:w-full px-16 md:px-0 justify-center md:justify-start snap-x snap-mandatory" style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex-shrink-0 w-[calc(100vw-8rem-2rem)] sm:w-[calc(50vw-3rem)] md:w-auto text-center p-8 border border-border rounded-3xl bg-card"
              >
              <step.icon className="w-8 h-8 text-accent mx-auto mb-5" strokeWidth={1.5} />
              <h3 className="font-heading text-2xl md:text-3xl text-foreground mb-3 tracking-wide">{step.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
            </div>
        </div>

      </div>
      <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}