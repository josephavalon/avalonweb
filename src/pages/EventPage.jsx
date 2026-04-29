import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, MapPin, Users, Ticket } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { findEventBySlug } from '../data/events';

const EASE = [0.16, 1, 0.3, 1];

export default function EventPage() {
  const { slug } = useParams();
  const event = findEventBySlug(slug);

  if (!event) {
    return (
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar />
        <section className="flex-1 flex items-center justify-center px-6 py-24">
          <div className="max-w-xl text-center">
            <p className="font-body text-xs tracking-[0.35em] text-accent uppercase mb-4">404</p>
            <h1 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-6">Event not found</h1>
            <Link to="/#events" className="inline-flex items-center gap-2 text-accent hover:text-accent/70 font-body text-xs tracking-widest uppercase">
              <ArrowLeft className="w-4 h-4" /> Back to Launches
            </Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const cover = event.cover || '/backgrounds/iv-vitamins-hero.webp';

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Navbar />

      <section className="pt-28 md:pt-36 pb-12 md:pb-20 px-6 md:px-16">
        <div className="max-w-5xl mx-auto">
          <Link to="/#events" className="inline-flex items-center gap-2 text-accent hover:text-accent/70 font-body text-xs tracking-[0.25em] uppercase mb-8">
            <ArrowLeft className="w-3 h-3" /> Launches
          </Link>

          <div className="grid md:grid-cols-[1fr_360px] gap-8 md:gap-12">
            {/* LEFT: cover poster + body */}
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }} className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-md mb-8">
                <img src={cover} alt={event.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-2">{event.date}</p>
                  <h1 className="font-heading text-3xl md:text-5xl text-foreground tracking-wide leading-[0.95]">{event.title}</h1>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: EASE }}>
                <p className="font-body text-xs tracking-[0.35em] text-accent uppercase mb-3">About this event</p>
                <p className="font-body text-base md:text-lg text-foreground leading-relaxed">
                  {event.briefing || event.desc}
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: EASE }} className="mt-10 pt-8 border-t border-border">
                <p className="font-body text-xs tracking-[0.35em] text-accent uppercase mb-5">Hosted by</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md flex items-center justify-center">
                    <span className="font-heading text-sm text-accent tracking-widest">AV</span>
                  </div>
                  <div>
                    <p className="font-heading text-xl text-foreground tracking-wide leading-tight">{event.hostName || 'Avalon Vitality'}</p>
                    <p className="font-body text-xs tracking-[0.25em] text-muted-foreground uppercase mt-0.5">{event.hostRole || 'Host'}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* RIGHT: details card + CTA */}
            <motion.aside initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: EASE }} className="md:sticky md:top-28 self-start">
              <div className="border border-white/10 bg-white/[0.04] backdrop-blur-md rounded-3xl p-6 md:p-7">
                <div className="space-y-5 mb-6">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="font-body text-xs tracking-[0.3em] text-muted-foreground uppercase mb-1">When</p>
                      <p className="font-body text-sm text-foreground">{event.when || event.date}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="font-body text-xs tracking-[0.3em] text-muted-foreground uppercase mb-1">Where</p>
                      <p className="font-body text-sm text-foreground">{event.venue || event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="font-body text-xs tracking-[0.3em] text-muted-foreground uppercase mb-1">Capacity</p>
                      <p className="font-body text-sm text-foreground">{event.capacity || 'TBA'}</p>
                    </div>
                  </div>
                </div>

                <Link
                  to="/#waitlist"
                  className="group flex items-center justify-center gap-2 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full py-3.5 hover:bg-foreground/90 transition-colors"
                >
                  <Ticket className="w-4 h-4" strokeWidth={2} />
                  Get Notified
                </Link>
                <Link
                  to="/apply"
                  className="mt-3 block text-center border border-foreground/30 text-foreground font-body text-xs tracking-widest uppercase font-semibold rounded-full py-3.5 hover:border-foreground transition-colors"
                >
                  Start Now
                </Link>

                <p className="font-body text-xs text-muted-foreground leading-relaxed mt-5 text-center">
                  Member dinners and clinical salons are invitation-first. Join the waitlist for presale updates.
                </p>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
