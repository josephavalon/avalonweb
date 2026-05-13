import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap, RotateCcw, Activity, Users, Clock, MapPin, ArrowRight, Check } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const PROTOCOLS = [
  {
    icon: Zap,
    label: 'Pre-Event',
    headline: 'Day-Of Preparation',
    description: 'Hydration, electrolytes, and B vitamins. Educational framing: supports pre-performance nutritional status. Session timing is typically 2–4 hours before competition.',
    tags: ['Hydration Base', 'Electrolytes', 'B-Complex'],
  },
  {
    icon: RotateCcw,
    label: 'Post-Event',
    headline: 'Recovery Support',
    description: 'Rehydration, muscle support nutrients, and antioxidant ingredients. Designed to help replenish what was depleted during sustained physical output.',
    tags: ['Rehydration', 'Amino Acids', 'Antioxidants'],
  },
  {
    icon: Activity,
    label: 'Weekly Maintenance',
    headline: 'Training Load Management',
    description: 'Consistent micronutrient support for athletes managing high training loads. Regular sessions help maintain baseline nutritional status across training cycles.',
    tags: ['Micronutrients', 'B Vitamins', 'Minerals'],
  },
];

const SPORTS = [
  'Endurance Sports',
  'Team Sports',
  'Combat Sports',
  'CrossFit / HYROX',
  'Triathlon',
  'Weekend Warriors',
];

const STATS = [
  { value: 'On-site', label: 'RN comes to you' },
  { value: 'Zero', label: 'Waiting rooms' },
  { value: 'SF Bay Area', label: 'Service area' },
];

export default function Athlete() {
  useSeo({ title: 'Athletes & Performance — Avalon Vitality', description: 'IV therapy protocols designed for athletic recovery, performance, and competition prep.', path: '/athlete' });
  const [formData, setFormData] = useState({
    teamName: '',
    sport: '',
    contact: '',
    email: '',
    teamSize: '',
    location: '',
    timing: '',
  });
  const [submitted, setSubmitted] = useState(false);

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
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Athletic Recovery
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              For Athletes
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-8"
            >
              Recovery is training. Treat it that way.
            </motion.p>

            {/* Stats */}
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.24 }}
              className="flex flex-wrap gap-8"
            >
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="font-heading text-3xl md:text-4xl text-foreground">{stat.value}</p>
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Protocols */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Protocol Recommendations
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-4"
            >
              Recovery by Phase
            </motion.h2>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="font-body text-xs text-foreground/40 leading-relaxed max-w-2xl mb-10"
            >
              Educational information only. IV therapy is not a substitute for physician-directed medical treatment. Consult your physician about whether IV therapy is appropriate for you.
            </motion.p>

            <div className="grid md:grid-cols-3 gap-6">
              {PROTOCOLS.map((protocol, i) => {
                const Icon = protocol.icon;
                return (
                  <motion.div
                    key={protocol.label}
                    {...REVEAL}
                    transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                    className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-1">{protocol.label}</p>
                    <p className="font-heading text-xl text-foreground uppercase mb-3">{protocol.headline}</p>
                    <p className="font-body text-sm text-foreground/60 leading-relaxed mb-5">{protocol.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {protocol.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-body text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border border-foreground/[0.1] text-foreground/40"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Sports */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Who It's For
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Built for Every Sport
            </motion.h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SPORTS.map((sport, i) => (
                <motion.div
                  key={sport}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 flex items-center gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  <p className="font-body text-sm text-foreground/75">{sport}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Team Bookings */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start"
            >
              <div className="flex-1">
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">Team Bookings</p>
                <h2 className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-[0.95] mb-4">
                  We Come to You
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-6">
                  Book for your whole team. We come to your facility, hotel, or training site. RN-administered sessions run concurrently for groups. Ideal for pre-competition prep and post-event recovery.
                </p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { icon: Users, label: 'Group sessions' },
                    { icon: MapPin, label: 'Your location' },
                    { icon: Clock, label: 'Flexible timing' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-accent" />
                      <p className="font-body text-sm text-foreground/60">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Team Inquiry Form */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Team Inquiry
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Book for Your Team
            </motion.h2>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-10 max-w-lg"
              >
                <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mb-5">
                  <Check className="w-6 h-6 text-accent" />
                </div>
                <p className="font-heading text-2xl text-foreground uppercase mb-3">Inquiry Received</p>
                <p className="font-body text-sm text-foreground/60">We'll reach out within 24 hours to discuss scheduling and logistics.</p>
              </motion.div>
            ) : (
              <motion.form
                {...REVEAL}
                transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
                onSubmit={handleSubmit}
                className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 max-w-2xl space-y-6"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Team / Sport Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bay Area Triathlon Club"
                      value={formData.teamName}
                      onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Sport / Activity
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Triathlon"
                      value={formData.sport}
                      onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Team Size
                    </label>
                    <select
                      value={formData.teamSize}
                      onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors appearance-none"
                    >
                      <option value="" className="bg-background">Select team size</option>
                      <option value="2-5" className="bg-background">2–5 athletes</option>
                      <option value="6-15" className="bg-background">6–15 athletes</option>
                      <option value="16-30" className="bg-background">16–30 athletes</option>
                      <option value="30+" className="bg-background">30+ athletes</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Location / Venue
                    </label>
                    <input
                      type="text"
                      placeholder="City, facility, or hotel"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                    Preferred Timing / Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Event date, preferred time, any context..."
                    value={formData.timing}
                    onChange={(e) => setFormData({ ...formData, timing: e.target.value })}
                    className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-accent text-background font-body text-sm tracking-[0.15em] uppercase py-4 rounded-xl hover:bg-accent/90 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  Submit Inquiry <ArrowRight className="w-4 h-4" />
                </button>
              </motion.form>
            )}
          </div>
        </Reveal>

        {/* Individual CTA */}
        <Reveal as="section" className="py-12 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-6">
            <p className="font-body text-sm text-foreground/50">Booking for yourself?</p>
            <Link
              to="/store"
              className="font-body text-sm text-foreground/70 hover:text-foreground transition-colors duration-200 flex items-center gap-1"
            >
              Browse Sessions <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
