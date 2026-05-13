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

const benefits = [
  {
    title: 'A Benefit They\'ll Remember',
    body: 'IV therapy as a workplace perk is memorable. It signals real investment in your team\'s wellbeing — and it gets talked about.',
    icon: '↓',
  },
  {
    title: 'Faster Than a Doctor Visit',
    body: 'An in-office session fits into a lunch break. No commute, no waiting room, no half-day lost.',
    icon: '↑',
  },
  {
    title: 'Retain Top Talent',
    body: 'Competitive benefits attract competitive people. Avalon gives your team something most companies don\'t offer — and won\'t easily replicate.',
    icon: '→',
  },
];

const volumePricing = [
  { range: '5–10 people', price: '$280', unit: 'per session' },
  { range: '11–25 people', price: '$250', unit: 'per session' },
  { range: '25+ people', price: 'Custom', unit: 'contact us' },
];

const howItWorks = [
  { step: '01', title: 'Schedule on-site', body: 'Choose a date and time. We work around your team\'s calendar — mornings, lunch, or afternoons.' },
  { step: '02', title: 'RN arrives fully equipped', body: 'Our registered nurses bring all medical-grade supplies. No prep required from your team or facilities.' },
  { step: '03', title: 'In-office sessions', body: 'Employees receive individual IV infusions in a quiet space you designate — a conference room works perfectly.' },
  { step: '04', title: 'Invoiced monthly', body: 'One clean invoice per month based on sessions delivered. No per-employee complexity.' },
];

export default function Corporate() {
  useSeo({ title: 'Corporate Wellness — Avalon Vitality', description: 'On-site IV therapy for teams and events in the San Francisco Bay Area.', path: '/corporate' });
  const [formState, setFormState] = useState({
    company: '',
    contact: '',
    email: '',
    phone: '',
    teamSize: '',
    frequency: '',
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
              Corporate Wellness
            </motion.p>
            <motion.h1
              className="font-heading text-6xl md:text-8xl lg:text-[9rem] text-foreground uppercase leading-[0.9] mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
            >
              For Teams
            </motion.h1>
            <motion.p
              className="font-body text-base md:text-lg text-foreground/60 max-w-xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
            >
              Bring Avalon to your office. IV therapy as a workplace benefit.
            </motion.p>
          </div>
        </section>

        {/* Trusted By Strip */}
        <Reveal as="section" className="py-10 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-col items-center gap-5">
            <motion.p
              className="font-body text-[9px] tracking-[0.45em] uppercase text-foreground/20"
              {...fadeUp}
            >
              Trusted By Leading Teams
            </motion.p>
            <motion.div
              className="flex flex-wrap justify-center items-center gap-x-8 gap-y-3"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            >
              {['Tech Co.', 'Consulting Co.', 'Finance Co.', 'Media Co.', 'Healthcare Co.', 'Startup Co.'].map((name) => (
                <span
                  key={name}
                  className="font-body text-xs tracking-[0.3em] text-foreground/20 uppercase select-none"
                >
                  {name}
                </span>
              ))}
            </motion.div>
          </div>
        </Reveal>

        {/* Why Section */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Why It Works
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              A Benefit<br />That Performs
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                >
                  <p className="font-heading text-5xl text-accent/40 mb-4">{b.icon}</p>
                  <h3 className="font-heading text-2xl text-foreground uppercase mb-3">{b.title}</h3>
                  <p className="font-body text-sm text-foreground/60">{b.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ROI Teaser */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="rounded-2xl border border-accent/20 bg-foreground/[0.03] p-8 md:p-12"
              {...fadeUp}
            >
              <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
                By The Numbers
              </motion.p>
              <motion.h2 className="font-heading text-4xl md:text-5xl text-foreground uppercase leading-[0.9] mb-10" {...fadeUp}>
                The ROI Of Employee Wellness
              </motion.h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {[
                  {
                    stat: '4.5x',
                    label: 'Return on every $1 invested in employee wellness programs',
                    source: 'American Journal of Health Promotion',
                  },
                  {
                    stat: '28%',
                    label: 'Reduction in sick days reported by teams with regular wellness access',
                    source: null,
                  },
                  {
                    stat: '2.3x',
                    label: 'Higher productivity scores for employees with on-site wellness access',
                    source: null,
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.stat}
                    className="flex flex-col"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                  >
                    <p className="font-heading text-5xl text-accent">{item.stat}</p>
                    <p className="font-body text-xs text-foreground/60 mt-1 leading-snug">{item.label}</p>
                  </motion.div>
                ))}
              </div>
              <motion.p className="font-body text-[10px] text-foreground/25 mt-8 tracking-[0.05em]" {...fadeUp}>
                Statistics are industry benchmarks. Individual results vary.
              </motion.p>
            </motion.div>
          </div>
        </Reveal>

        {/* Case Study Teaser */}
        <Reveal as="section" className="py-4 md:py-8 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
              {...fadeUp}
            >
              <div className="flex flex-col gap-3">
                <p className="font-body text-[9px] tracking-[0.4em] uppercase text-accent/60">Case Study</p>
                <h3 className="font-heading text-2xl md:text-3xl text-foreground uppercase leading-[1]">
                  A Bay Area Tech Team of 200
                </h3>
                <p className="font-body text-sm text-foreground/60 max-w-lg">
                  Reduced average sick day usage by 31% in Q1 following Avalon's corporate wellness program rollout.
                </p>
              </div>
              <div className="shrink-0">
                <button
                  disabled
                  className="px-6 py-3 rounded-full border border-foreground/20 text-foreground/30 font-body text-xs tracking-[0.2em] uppercase opacity-50 cursor-default select-none"
                >
                  Read More
                </button>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* How It Works */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Process
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              How It Works<br />For Teams
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {howItWorks.map((item, i) => (
                <motion.div
                  key={item.step}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                >
                  <p className="font-heading text-6xl text-foreground/10 mb-4">{item.step}</p>
                  <h3 className="font-heading text-2xl text-foreground uppercase mb-3">{item.title}</h3>
                  <p className="font-body text-sm text-foreground/60">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Volume Pricing */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Pricing
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Volume Rates
            </motion.h2>
            <motion.div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] overflow-hidden" {...fadeUp}>
              {volumePricing.map((row, i) => (
                <div
                  key={row.range}
                  className={`flex items-center justify-between p-6 md:p-8 ${
                    i < volumePricing.length - 1 ? 'border-b border-foreground/[0.06]' : ''
                  }`}
                >
                  <div>
                    <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-1">Team size</p>
                    <p className="font-heading text-2xl md:text-3xl text-foreground uppercase">{row.range}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-4xl md:text-5xl text-foreground">{row.price}</p>
                    <p className="font-body text-xs text-foreground/40">{row.unit}</p>
                  </div>
                </div>
              ))}
            </motion.div>
            <motion.p className="font-body text-xs text-foreground/30 mt-4" {...fadeUp}>
              Pricing reflects per-session rate. Sessions are 45 minutes. Travel fee may apply outside core SF Bay Area coverage.
            </motion.p>
          </div>
        </Reveal>

        {/* Testimonial Placeholder */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-8 md:p-12 text-center"
              {...fadeUp}
            >
              <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-6">What Teams Say</p>
              <p className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-snug mb-8 max-w-2xl mx-auto">
                "Our quarterly offsites now include an Avalon session. The team looks forward to it. Recovery built into the culture."
              </p>
              <div>
                <p className="font-body text-sm text-foreground/60">Director of People Operations</p>
                <p className="font-body text-xs text-foreground/30">Series B Technology Company, San Francisco</p>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Proposal Form */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
              Get Started
            </motion.p>
            <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
              Request a Proposal
            </motion.h2>

            {submitted ? (
              <motion.div
                className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-8 md:p-12 text-center"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <p className="font-heading text-4xl text-foreground uppercase mb-4">Request Received</p>
                <p className="font-body text-sm text-foreground/60">
                  Our corporate wellness team will reach out within one business day with a tailored proposal.
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
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Company Name</label>
                    <input
                      type="text"
                      name="company"
                      value={formState.company}
                      onChange={handleChange}
                      placeholder="Acme Corp"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Contact Name</label>
                    <input
                      type="text"
                      name="contact"
                      value={formState.contact}
                      onChange={handleChange}
                      placeholder="Jane Smith"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Work Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleChange}
                      placeholder="jane@company.com"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formState.phone}
                      onChange={handleChange}
                      placeholder="(415) 000-0000"
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Team Size</label>
                    <select
                      name="teamSize"
                      value={formState.teamSize}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground font-body text-sm focus:outline-none focus:border-accent/50 transition-colors appearance-none"
                    >
                      <option value="" disabled>Select team size</option>
                      <option value="5-10">5–10 people</option>
                      <option value="11-25">11–25 people</option>
                      <option value="25+">25+ people</option>
                      <option value="custom">Custom / Ongoing</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Preferred Frequency</label>
                    <input
                      type="text"
                      name="frequency"
                      value={formState.frequency}
                      onChange={handleChange}
                      placeholder="Monthly, quarterly, one-time…"
                      className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">Anything else we should know?</label>
                  <textarea
                    name="message"
                    value={formState.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Office location, goals, timing, special considerations…"
                    className="w-full px-4 py-3 rounded-xl bg-foreground/[0.05] border border-foreground/[0.12] text-foreground placeholder:text-foreground/30 font-body text-sm focus:outline-none focus:border-accent/50 transition-colors resize-none"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-8 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
                  >
                    Request a Proposal
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
