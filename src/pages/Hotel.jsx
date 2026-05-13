import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const steps = [
  { number: '01', title: 'Guest books', body: 'Book online in under 2 minutes. Select your hotel, room number, and preferred arrival window.' },
  { number: '02', title: 'RN arrives at your room', body: 'No lobby pickup. No awkward waiting. Your nurse comes directly to your door at the scheduled time.' },
  { number: '03', title: 'In-room session', body: 'Settle in. Your RN handles everything. IV, monitoring, add-ons — all at your pace, in your space.' },
  { number: '04', title: 'Back to your day', body: 'Session ends. RN packs out cleanly. You\'re hydrated, replenished, and ready for whatever comes next.' },
];

const neighborhoods = [
  'Union Square',
  'SoMa',
  'Nob Hill',
  'Financial District',
  'Marina',
  'Pacific Heights',
  'Mission Bay',
  'Embarcadero',
  'Fisherman\'s Wharf',
  'Cow Hollow',
];

const popularFor = [
  {
    title: 'Business Travel Recovery',
    body: 'Cross-country red-eyes catch up with you. IV hydration and B-complex delivered directly — no waiting, no clinic, no detour.',
  },
  {
    title: 'Next-Morning Recovery',
    body: 'No judgment. Rapid hydration, B-complex, and electrolyte replenishment — delivered directly to your room.',
  },
  {
    title: 'Pre-Event Prep',
    body: 'Speaking, pitching, performing, shooting. Arrive primed. IV prep the morning of is a discipline, not a luxury.',
  },
  {
    title: 'Jet Lag',
    body: 'Reset circadian strain with targeted nutrient support. Our nurses are familiar with international schedules.',
  },
];

const faqs = [
  {
    q: 'Can the RN actually come to my hotel room?',
    a: 'Yes. We deliver to hotel rooms throughout the SF Bay Area. You do not need to come to a clinic or lobby. Notify your front desk if you prefer — most hotels accommodate without issue.',
  },
  {
    q: 'What do I need to provide?',
    a: 'Nothing. Your nurse brings all supplies including IV bags, tubing, medical-grade equipment, and a sharps container. A comfortable chair or place to sit is all that\'s needed.',
  },
  {
    q: 'How quickly can you arrive?',
    a: 'Same-day appointments are available subject to nurse availability. We recommend booking at least 2 hours in advance. Priority scheduling is available to members.',
  },
  {
    q: 'Is the visit discreet?',
    a: 'Completely. Our nurses arrive in professional attire with neutral carry cases. There is no branded vehicle or signage. The visit is as private as any in-room service.',
  },
];

export default function Hotel() {
  useSeo({ title: 'Hotel IV Delivery — Avalon Vitality', description: 'In-room IV therapy delivered to your hotel in San Francisco. No appointment needed.', path: '/hotel' });
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p
              className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              Hotel & Concierge
            </motion.p>
            <motion.h1
              className="font-heading text-6xl md:text-8xl lg:text-[9rem] text-foreground uppercase leading-[0.9] mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
            >
              In-Room<br />Delivery
            </motion.h1>
            <motion.p
              className="font-body text-base md:text-lg text-foreground/60 max-w-xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
            >
              Your RN comes to your hotel room. No lobby. No waiting.
            </motion.p>
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.24 }}
            >
              <Link
                to="/store"
                className="inline-block px-10 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
              >
                Book Now
              </Link>
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Process
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              How It Works
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                >
                  <p className="font-heading text-6xl text-foreground/10 mb-4">{step.number}</p>
                  <h3 className="font-heading text-2xl text-foreground uppercase mb-3">{step.title}</h3>
                  <p className="font-body text-sm text-foreground/60">{step.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* We Serve */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Coverage
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              We Serve<br />All SF Districts
            </motion.h2>
            <motion.div
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10"
              {...fadeUp}
            >
              <div className="flex flex-wrap gap-3">
                {neighborhoods.map((n) => (
                  <span
                    key={n}
                    className="font-body text-xs tracking-[0.15em] uppercase text-foreground/60 border border-foreground/[0.12] rounded-full px-4 py-2"
                  >
                    {n}
                  </span>
                ))}
              </div>
              <p className="font-body text-xs text-foreground/30 mt-6">
                Coverage extends to select Peninsula and East Bay hotels. Inquire at time of booking.
              </p>
            </motion.div>
          </div>
        </Reveal>

        {/* Popular For */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Use Cases
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Popular For
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {popularFor.map((item, i) => (
                <motion.div
                  key={item.title}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                >
                  <h3 className="font-heading text-2xl text-foreground uppercase mb-3">{item.title}</h3>
                  <p className="font-body text-sm text-foreground/60">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Concierge Note */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-6 md:p-10 flex flex-col md:flex-row md:items-center gap-6"
              {...fadeUp}
            >
              <div className="flex-1">
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-accent/60 mb-3">For Hotel Concierges</p>
                <h2 className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-snug mb-4">
                  Booking on Behalf of a Guest?
                </h2>
                <p className="font-body text-sm text-foreground/60 max-w-lg">
                  We work directly with hotel concierge teams. Email us with guest details, room number, preferred time, and any relevant notes. We handle the rest.
                </p>
              </div>
              <div className="flex-shrink-0">
                <a
                  href="mailto:concierge@avalonvitality.co"
                  className="inline-block px-8 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
                >
                  concierge@avalonvitality.co
                </a>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* FAQ */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Questions
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              In-Room FAQ
            </motion.h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] overflow-hidden"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                >
                  <button
                    className="w-full flex items-center justify-between p-6 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-body text-sm font-semibold text-foreground pr-4">{faq.q}</span>
                    <span className="text-foreground/40 flex-shrink-0 text-lg leading-none">
                      {openFaq === i ? '−' : '+'}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6">
                      <p className="font-body text-sm text-foreground/60">{faq.a}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Final CTA */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto text-center">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Book
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6" {...fadeUp}>
              Your Room.<br />Your Session.
            </motion.h2>
            <motion.p className="font-body text-sm text-foreground/50 mb-10 max-w-sm mx-auto" {...fadeUp}>
              Same-day availability in SF. Book online in under 2 minutes.
            </motion.p>
            <motion.div {...fadeUp}>
              <Link
                to="/store"
                className="inline-block px-10 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
              >
                Book a Session
              </Link>
            </motion.div>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
