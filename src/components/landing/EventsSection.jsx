import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { events } from '../../data/events';

// Salon events are members-only. Field events are where we publicly appear.
// Quarterly salon frames the cultural layer; don't drop it even when field
// events pile up.


export default function EventsSection() {
  return (
    <section id="events" className="py-12 md:py-20 px-4 scroll-mt-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-6 md:mb-10"
        >
          <motion.p
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4"
          >
            In the Field
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="font-heading text-foreground tracking-wide md:whitespace-nowrap text-[10vw] md:text-7xl lg:text-8xl"
          >
            AVALON LAUNCHES
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mt-3"
          >
            Where you'll find us in the Bay — from finish lines to founder nights.
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
                  transition={{ delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-shrink-0 w-[calc(100vw-5rem)] sm:w-[360px] md:w-[400px] border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-3xl p-5 flex flex-col gap-3 snap-start"
                >
                <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">{event.date}</p>
                <div>
                  <h3 className="font-heading text-3xl md:text-4xl text-foreground tracking-wide mb-1">{event.title}</h3>
                  <p className="font-body text-xs tracking-widest text-foreground uppercase">{event.location}</p>
                </div>
                <p className="font-body text-sm md:text-base text-foreground leading-relaxed flex-1">{event.desc}</p>
                <Link
                  to={`/events/${event.slug}`}
                  className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4"
                >
                  Details →
                </Link>
                </motion.div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}