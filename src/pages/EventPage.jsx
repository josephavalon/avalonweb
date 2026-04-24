import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
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
            <p className="font-body text-[10px] tracking-[0.35em] text-accent uppercase mb-4">404</p>
            <h1 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-6">Event not found</h1>
            <Link to="/#events" className="inline-flex items-center gap-2 text-accent hover:text-accent/70 font-body text-xs tracking-widest uppercase">
              <ArrowLeft className="w-4 h-4" /> Back to News &amp; Events
            </Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Navbar />
      <section className="pt-32 md:pt-40 pb-10 md:pb-16 px-6 md:px-16">
        <div className="max-w-3xl mx-auto">
          <Link to="/#events" className="inline-flex items-center gap-2 text-accent hover:text-accent/70 font-body text-[10px] tracking-[0.25em] uppercase mb-8">
            <ArrowLeft className="w-3 h-3" /> News &amp; Events
          </Link>

          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">
            {event.date}
          </motion.p>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }} className="font-heading text-4xl md:text-6xl text-foreground tracking-wide leading-[0.95] mb-4">
            {event.title}
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: EASE }} className="font-body text-[10px] tracking-widest text-foreground uppercase mb-10">
            {event.location}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: EASE }} className="border-t border-border pt-8 mb-10">
            <p className="font-body text-base md:text-lg text-foreground leading-relaxed">
              {event.briefing || event.desc}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: EASE }} className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/#waitlist"
              className="inline-block text-center bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full px-8 py-3.5 hover:bg-foreground/90 transition-colors"
            >
              Get Notified
            </Link>
            <Link
              to="/apply"
              className="inline-block text-center border border-foreground/30 text-foreground font-body text-xs tracking-widest uppercase font-semibold rounded-full px-8 py-3.5 hover:border-foreground transition-colors"
            >
              Apply for Membership
            </Link>
          </motion.div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
