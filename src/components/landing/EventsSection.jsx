import React from 'react';
import { motion } from 'framer-motion';

const events = [
  {
    date: 'Coming Soon',
    title: 'Recovery Night',
    location: 'San Francisco, CA',
    desc: 'An intimate evening of IV therapy, wellness education, and community. Limited spots.',
  },
  {
    date: 'Coming Soon',
    title: 'NAD+ Longevity Workshop',
    location: 'San Francisco, CA',
    desc: 'Deep dive into cellular health, NAD+ science, and what optimization actually looks like.',
  },
  {
    date: 'Coming Soon',
    title: 'Members-Only Drip Night',
    location: 'Private Venue, SF',
    desc: 'Exclusive member event. Network, recover, and experience new protocols before public launch.',
  },
];

export default function EventsSection() {
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

        <div className="grid md:grid-cols-3 gap-4">
          {events.map((event, i) => (
            <motion.div
              key={event.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-border rounded bg-card p-6 flex flex-col gap-4"
            >
              <p className="text-[9px] tracking-[0.3em] text-accent font-body uppercase">{event.date}</p>
              <div>
                <h3 className="font-heading text-2xl text-foreground tracking-wide mb-1">{event.title}</h3>
                <p className="font-body text-[10px] tracking-widest text-muted-foreground uppercase">{event.location}</p>
              </div>
              <p className="font-body text-xs text-muted-foreground leading-relaxed flex-1">{event.desc}</p>
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
    </section>
  );
}