import React from 'react';
import { motion } from 'framer-motion';

const events = [
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
  return (
    <section id="events" className="py-6 md:py-8 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-6 text-left"
        >
          <motion.p 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-2"
          >
            In the Field
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-6xl md:text-8xl text-foreground tracking-wide"
          >
            NEWS & EVENTS
          </motion.h2>
        </motion.div>

        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex gap-3 snap-x snap-mandatory w-fit md:w-full md:justify-center">
              {events.map((event, i) => (
                <motion.div
                  key={event.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex-shrink-0 w-[calc(100vw-10rem)] md:w-[450px] border border-border rounded-3xl bg-card p-5 flex flex-col gap-3 snap-center"
                >
                <p className="text-[9px] tracking-[0.3em] text-accent font-body uppercase">{event.date}</p>
                <div>
                  <h3 className="font-heading text-2xl text-foreground tracking-wide mb-1">{event.title}</h3>
                  <p className="font-body text-[10px] tracking-widest text-foreground uppercase">{event.location}</p>
                </div>
                <p className="font-body text-[11px] text-foreground leading-relaxed flex-1">{event.desc}</p>
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
    </section>
  );
}