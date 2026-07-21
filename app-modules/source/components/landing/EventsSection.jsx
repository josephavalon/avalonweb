import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { MapPin, Calendar, ChevronDown, ArrowRight, Users } from 'lucide-react';
import { fetchEventsFeed } from '@/lib/eventsApi';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const EASE = [0.16, 1, 0.3, 1];

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function EventRow({ event, index }) {
  const [open, setOpen] = useState(false);
  const desc = !Array.isArray(event.descriptionBlocks) ? event.descriptionBlocks?.description : '';

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
            <p className="font-heading text-lg tracking-[0.06em] text-foreground uppercase leading-none truncate">{event.name}</p>
            <p className="font-body text-[10px] text-accent tracking-[0.2em] uppercase mt-0.5">{formatEventDate(event.startsAt)}</p>
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 text-foreground/30 shrink-0 ml-4 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={2}
        />
      </button>

      {/* Expanded */}
      <SmoothDisclosure open={open}>
        <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 space-y-4">
              {desc ? <p className="font-body text-sm text-foreground/65 leading-relaxed">{desc}</p> : null}

              <div className="flex flex-col gap-2">
                {event.venue ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-foreground/30 shrink-0" strokeWidth={1.5} />
                    <span className="font-body text-xs text-foreground/50">{event.venue}</span>
                  </div>
                ) : null}
                {event.capacity ? (
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-foreground/30 shrink-0" strokeWidth={1.5} />
                    <span className="font-body text-xs text-foreground/50">{event.capacity} spots</span>
                  </div>
                ) : null}
              </div>

              <Link
                to={`/events/${event.slug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.05] border border-foreground/10 hover:bg-white/[0.10] hover:border-white/20 font-body text-[11px] tracking-[0.2em] uppercase text-foreground transition-all"
              >
                Event Details <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
        </div>
      </SmoothDisclosure>
    </motion.div>
  );
}

export default function EventsSection() {
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchEventsFeed()
      .then(({ upcoming: rows }) => { if (alive) setUpcoming(rows.slice(0, 4)); })
      .catch(() => { /* landing section simply hides when events are unavailable */ });
    return () => { alive = false; };
  }, []);

  if (!upcoming.length) return null;

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
          <h2 className="font-heading text-display text-foreground uppercase tracking-tight leading-[0.92]">
            EVENTS
          </h2>
          <div className="w-10 h-[2px] bg-accent mt-3" />
          <p className="font-body text-sm text-foreground/50 leading-relaxed max-w-2xl mt-3">
            Recovery lounges for parties, retreats, and venues. We deliver care.
          </p>
        </motion.div>

        {/* Event accordion rows */}
        <div className="space-y-2 mb-8">
          {upcoming.map((event, i) => (
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
