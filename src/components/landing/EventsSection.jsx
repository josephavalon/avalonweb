import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, ChevronDown, ArrowRight, Users } from 'lucide-react';
import { events } from '../../data/events';

const EASE = [0.16, 1, 0.3, 1];

function EventRow({ event, index }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: EASE }}
      className="rounded-2xl border border-foreground/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden"
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-foreground/10 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-accent" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg tracking-[0.06em] text-foreground uppercase leading-none truncate">{event.title}</p>
            <p className="font-body text-[10px] text-accent tracking-[0.2em] uppercase mt-0.5">{event.date}</p>
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 text-foreground/30 shrink-0 ml-4 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={2}
        />
      </button>

      {/* Expanded */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 space-y-4">
              <p className="font-body text-sm text-foreground/65 leading-relaxed">{event.desc}</p>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-foreground/30 shrink-0" strokeWidth={1.5} />
                  <span className="font-body text-xs text-foreground/50">{event.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-foreground/30 shrink-0" strokeWidth={1.5} />
                  <span className="font-body text-xs text-foreground/50">{event.capacity}</span>
                </div>
              </div>

              <Link
                to={`/events/${event.slug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.05] border border-foreground/10 hover:bg-white/[0.10] hover:border-white/20 font-body text-[11px] tracking-[0.2em] uppercase text-foreground transition-all"
              >
                Event Details <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function EventsSection() {
  return (
    <section id="events" className="py-12 md:py-20 px-4 scroll-mt-24">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">
            In the Field
          </p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            AVALON LAUNCHES
          </h2>
          <div className="w-10 h-[2px] bg-accent mt-3" />
          <p className="font-body text-sm text-foreground/50 leading-relaxed max-w-2xl mt-3">
            Where you'll find us in the Bay — from finish lines to founder nights.
          </p>
        </motion.div>

        {/* Event accordion rows */}
        <div className="space-y-2 mb-8">
          {events.map((event, i) => (
            <EventRow key={event.slug} event={event} index={i} />
          ))}
        </div>

        {/* CTA */}
        <Link
          to="/events"
          className="inline-flex items-center gap-2 font-body text-[11px] tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors"
        >
          All Events <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </Link>

      </div>
    </section>
  );
}
