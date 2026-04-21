import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const events = [
  {
    date: 'Coming Soon',
    title: 'BUILDER NIGHT',
    location: 'San Francisco, CA',
    desc: 'Mixer for founders and builders. Connect, recover, and optimize with fellow startup leaders. IV therapy and wellness expertise at your service.',
  },
  {
    date: 'Coming Soon',
    title: 'Bay 2 Breakers Expo',
    location: 'Sports Basement, San Francisco',
    desc: 'IM injections and exclusive merchandise sales. Optimize your performance before the race.',
  },
  {
    date: 'Coming Soon',
    title: 'Bay 2 Breakers Finish Line',
    location: 'Near Finish Line, San Francisco',
    desc: 'Exclusive IVs heavily discounted for race participants. Recovery and hydration right at the finish line.',
  },
  {
    date: 'Coming Soon',
    title: 'Vital Ice SF Influencer Night',
    location: 'Marina District, San Francisco',
    desc: 'Exclusive event for creators and influencers. Experience cold plunge, sauna, and IV therapy in our studio.',
  },
  {
    date: 'June',
    title: 'PRIDE Parade',
    location: 'San Francisco, CA',
    desc: 'Wellness recovery station at Pride. IV hydration and recovery support for all participants.',
  },
];

export default function EventsSection() {
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
    <section id="events" className="py-8 md:py-10 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <p className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">In the Field</p>
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide">EVENTS</h2>
        </motion.div>

        <div className="overflow-x-auto md:overflow-visible relative group">
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
          <div ref={scrollRef} className="flex gap-4 w-fit md:w-full px-16 md:px-0" style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {events.map((event, i) => (
              <motion.div
                key={event.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex-shrink-0 w-[85vw] md:w-[calc(33.333%-1rem)] border border-border rounded-3xl bg-card p-6 flex flex-col gap-4 max-h-screen md:max-h-none overflow-y-auto"
              >
              <p className="text-[9px] tracking-[0.3em] text-accent font-body uppercase">{event.date}</p>
              <div>
                <h3 className="font-heading text-2xl text-foreground tracking-wide mb-1">{event.title}</h3>
                <p className="font-body text-[10px] tracking-widest text-muted-foreground uppercase">{event.location}</p>
              </div>
              <p className="font-body text-[11px] text-muted-foreground leading-relaxed flex-1">{event.desc}</p>
              <a
                href="#membership"
                className="text-[10px] tracking-[0.2em] text-accent hover:text-accent/70 font-body uppercase transition-colors"
              >
                Get Notified →
              </a>
              </motion.div>
            ))}
            </div>
        </div>
      </div>
      <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}