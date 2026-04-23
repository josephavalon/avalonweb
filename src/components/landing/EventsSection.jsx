import React from 'react';
import { motion } from 'framer-motion';

// Salon events are members-only. Field events are where we publicly appear.
// Quarterly salon frames the cultural layer; don't drop it even when field
// events pile up.
const events = [
  {
    date: 'Members Only',
    title: 'THE LONGEVITY SALON',
    location: 'San Francisco',
    desc: "Quarterly members' dinner with leading longevity clinicians. Closed invite, off the record. First salon summer 2026.",
    kind: 'salon',
  },
  {
    date: 'Coming Soon',
    title: 'RECOVERY DEVICES',
    location: 'San Francisco, CA',
    desc: 'Red light therapy, vagus nerve stimulation, and compression pants. Advanced recovery technology for members.',
  },
  {
    date: 'Coming Soon',
    title: 'BUILDER NIGHT',
    location: 'San Francisco, CA',
    desc: 'Mixer for founders and builders. Connect with fellow startup leaders over IV therapy and wellness expertise on-site.',
  },
  {
    date: 'Coming Soon',
    title: 'Bay 2 Breakers Expo',
    location: 'Sports Basement, San Francisco',
    desc: 'IM injections and exclusive merchandise sales. Pre-race hydration and IV therapy on-site.',
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
  return (
    <section id="events" className="py-6 md:py-8 px-4 border-t border-border scroll-mt-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-left mb-4 md:mb-8"
        >
          <motion.p
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            In the Field
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-[11vw] md:text-7xl lg:text-8xl text-foreground tracking-wide leading-[0.95]"
          >
            NEWS &amp; EVENTS
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mt-3"
          >
            Where you'll find us in the Bay — from members' dinners to finish lines and founder nights.
          </motion.p>
        </motion.div>

        <div className="overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain -mx-4 px-4 pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex gap-4 snap-x snap-mandatory w-max">
              {events.map((event, i) => (
                <motion.div
                  key={event.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex-shrink-0 w-[calc(100vw-5rem)] sm:w-[360px] md:w-[400px] border border-border rounded-3xl bg-card p-5 flex flex-col gap-3 snap-start"
                >
                <p className="text-[9px] tracking-[0.3em] text-accent font-body uppercase">{event.date}</p>
                <div>
                  <h3 className="font-heading text-2xl text-foreground tracking-wide mb-1">{event.title}</h3>
                  <p className="font-body text-[10px] tracking-widest text-foreground uppercase">{event.location}</p>
                </div>
                <p className="font-body text-[11px] text-foreground leading-relaxed flex-1">{event.desc}</p>
                <a
                  href="/#waitlist"
                  className="text-[10px] tracking-[0.2em] text-accent hover:text-accent/70 font-body uppercase transition-colors"
                >
                  Get Notified →
                </a>
                </motion.div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}