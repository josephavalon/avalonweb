import React, { useState } from 'react';
import { motion } from 'framer-motion';
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

const eventTypes = [
  { name: 'Corporate Retreats', desc: 'Reward teams. Signal investment in their wellbeing.' },
  { name: 'Product Launches', desc: 'Stand-out activations that guests remember.' },
  { name: 'Wellness Festivals', desc: 'On-brand, medically credible, high-engagement.' },
  { name: 'Private Parties', desc: 'Recovery-forward hospitality. Elevated hosting.' },
  { name: 'Athletic Events', desc: 'Pre-race hydration. Post-event recovery. On-site.' },
  { name: 'Film & Music Productions', desc: 'Keep cast and crew performing through long days.' },
];

const whatWeBring = [
  { title: 'RN Team', body: 'Licensed registered nurses only. Every session is medically supervised.' },
  { title: 'Medical-Grade Setup', body: 'IV poles, sterile supplies, full clinical kit. We handle logistics end to end.' },
  { title: 'Branded Experience', body: 'Avalon\'s aesthetic travels. Clean, dark, luxe. Photographs well.' },
  { title: 'Express Sessions', body: 'Faster IV formats optimized for event pacing. Guests are in and out.' },
];

const pastActivations = [
  {
    type: 'Corporate Retreat',
    size: '28 guests',
    location: 'Napa Valley, CA',
    note: 'Two-day executive offsite. Avalon delivered AM recovery sessions both mornings.',
  },
  {
    type: 'Product Launch',
    size: '60 guests',
    location: 'SoMa, San Francisco',
    note: 'Pre-event prep sessions for key stakeholders. 3 RNs on-site for 4 hours.',
  },
  {
    type: 'Private Party',
    size: '18 guests',
    location: 'Pacific Heights, San Francisco',
    note: 'Morning-after recovery activation. Full team staffed by 9 AM.',
  },
];

export default function Events() {
  useSeo({ title: 'Events & Experiences — Avalon Vitality', description: 'IV therapy for events, activations, and group recovery in San Francisco.', path: '/events' });
  const [formState, setFormState] = useState({
    eventName: '',
    eventType: '',
    date: '',
    guestCount: '',
    location: '',
    email: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

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
              Events
            </motion.p>
            <motion.h1
              className="font-heading text-6xl md:text-8xl lg:text-[9rem] text-foreground uppercase leading-[0.9] mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
            >
              For Events
            </motion.h1>
            <motion.p
              className="font-body text-base md:text-lg text-foreground/60 max-w-xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
            >
              IV therapy activations for conferences, launches, and private events.
            </motion.p>
          </div>
        </section>

        {/* Event Types */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Event Types
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              We Work<br />All Formats
            </motion.h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {eventTypes.map((type, i) => (
                <motion.div
                  key={type.name}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.07 }}
                >
                  <h3 className="font-heading text-xl text-foreground uppercase mb-2">{type.name}</h3>
                  <p className="font-body text-sm text-foreground/55">{type.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* What We Bring */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              What We Bring
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Turnkey.<br />No Setup Required.
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {whatWeBring.map((item, i) => (
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

        {/* Capacity + Minimum */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              {...fadeUp}
            >
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10">
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">Capacity</p>
                <p className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-snug mb-4">
                  1 RN Serves<br />6–8 Guests/Hour
                </p>
                <p className="font-body text-sm text-foreground/60">
                  Scale your activation by adding nurses. We coordinate staffing based on your guest count and session window.
                </p>
              </div>
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10">
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">Minimum</p>
                <p className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-snug mb-4">
                  Events from<br />10 Guests
                </p>
                <p className="font-body text-sm text-foreground/60">
                  SF Bay Area only. Minimum 10 participants per activation. Travel to select Peninsula and East Bay venues — inquire for details.
                </p>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Past Activations */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Past Activations
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              In The Field
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastActivations.map((act, i) => (
                <motion.div
                  key={i}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                >
                  <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-3">{act.type}</p>
                  <p className="font-heading text-2xl text-foreground uppercase mb-1">{act.size}</p>
                  <p className="font-body text-xs text-foreground/40 mb-4">{act.location}</p>
                  <p className="font-body text-sm text-foreground/60">{act.note}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Inquiry Form */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Book
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Book Your<br />Activation
            </motion.h2>

            {submitted ? (
              <motion.div
                className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-8 md:p-12 text-center"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <p className="font-heading text-4xl text-foreground uppercase mb-4">Inquiry Received</p>
                <p className="font-body text-sm text-foreground/60">
                  Our events team will follow up within one business day with availability and a custom quote.
                </p>
              </motion.div>
            ) : (
              <motion.form
                className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 space-y-5"
                onSubmit={handleSubmit}
                {...fadeUp}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Event Name</label>
                    <input
                      type="text"
                      name="eventName"
                      value={formState.eventName}
                      onChange={handleChange}
                      placeholder="Q3 All-Hands Retreat"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Event Type</label>
                    <select
                      name="eventType"
                      value={formState.eventType}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground font-body text-sm focus:outline-none focus:border-accent/50 transition-colors appearance-none"
                    >
                      <option value="" disabled>Select event type</option>
                      <option value="corporate-retreat">Corporate Retreat</option>
                      <option value="product-launch">Product Launch</option>
                      <option value="wellness-festival">Wellness Festival</option>
                      <option value="private-party">Private Party</option>
                      <option value="athletic-event">Athletic Event</option>
                      <option value="film-music">Film / Music Production</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Event Date</label>
                    <input
                      type="date"
                      name="date"
                      value={formState.date}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Guest Count</label>
                    <input
                      type="number"
                      name="guestCount"
                      value={formState.guestCount}
                      onChange={handleChange}
                      placeholder="e.g. 40"
                      min="10"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Event Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formState.location}
                      onChange={handleChange}
                      placeholder="Venue name or address"
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Contact Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleChange}
                      placeholder="you@company.com"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Tell us more</label>
                  <textarea
                    name="message"
                    value={formState.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Session timing, goals, special logistics, budget range…"
                    className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors resize-none"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-8 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
                  >
                    Book Your Activation
                  </button>
                </div>
              </motion.form>
            )}
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
