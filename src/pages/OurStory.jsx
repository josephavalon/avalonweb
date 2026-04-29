import React from 'react';
import { useSeo } from '@/lib/seo';
import { motion } from 'framer-motion';
import {
  MapPin,
  Stethoscope,
  Shield,
  Home,
  Briefcase,
  Hotel,
  Users,
  Calendar,
  Star,
  HeartPulse,
  Sparkles,
} from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

// Editorial easing per non-negotiable #5.
const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease: EASE },
};

const MEET_YOU = [
  { icon: Home, label: 'At home' },
  { icon: Briefcase, label: 'At work' },
  { icon: Hotel, label: 'In hotels' },
  { icon: Users, label: 'Green rooms' },
  { icon: Calendar, label: 'Bay Area events' },
];

export default function OurStory() {
  useSeo({
    title: 'Our Story — Avalon Vitality',
    description: 'How Avalon Vitality is building the operating system for human performance — starting with mobile IV therapy in the SF Bay Area.',
    path: '/our-story',
  });
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-[72vh] flex items-end overflow-hidden pt-24">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&q=80&auto=format&fit=crop"
            alt="Golden Gate Bridge at dusk"
            className="w-full h-full object-cover opacity-50"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        </div>
        <div className="relative z-10 px-6 md:px-16 pb-12 md:pb-16 max-w-5xl">
          <motion.p
            {...REVEAL}
            className="text-eyebrow text-accent font-body uppercase mb-6"
          >
            Our Story
          </motion.p>
          <motion.h1
            {...REVEAL}
            transition={{ ...REVEAL.transition, delay: 0.1 }}
            className="font-heading text-display-xl text-foreground leading-none"
          >
            RECOVERY
            <br />
            ENGINEERED FOR
            <br />
            THE GOLDEN STATE
          </motion.h1>
        </div>
      </section>

      {/* What makes us different — 4-tile glass grid */}
      <section className="px-6 md:px-16 py-section-sm md:py-section">
        <div className="max-w-content mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-left mb-6 md:mb-10"
          >
            <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">Standards</p>
            <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
              What makes us different
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {[
              {
                Icon: Star,
                title: 'Endorsed by Diplo',
                desc: '5-star review from a Grammy-winning founder of culture.',
              },
              {
                Icon: Stethoscope,
                title: 'Expert medical team',
                desc: 'Board-certified clinicians, RNs, and longevity-trained nurses.',
              },
              {
                Icon: HeartPulse,
                title: 'Comprehensive care',
                desc: 'IV, IM, SC, NAD+, peptides, HRT, supplements, and diet — under one protocol.',
              },
              {
                Icon: Sparkles,
                title: 'Custom protocols',
                desc: 'Designed to your goals, your data, your biology — not a menu.',
              },
            ].map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-2xl p-5 md:p-7 flex flex-col items-start gap-4"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-accent/55 flex items-center justify-center text-accent shrink-0">
                  <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-heading text-base md:text-lg text-foreground tracking-wide uppercase leading-tight mb-2">
                    {title}
                  </p>
                  <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
                    {desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Thesis */}
      <section className="px-6 md:px-16 py-section-sm md:py-section border-t border-border">
        <div className="max-w-content mx-auto grid md:grid-cols-12 gap-rhythm-6">
          <motion.div {...REVEAL} className="md:col-span-5">
            <p className="text-eyebrow text-muted-foreground font-body uppercase mb-6">
              The Thesis
            </p>
            <h2 className="font-heading text-h1 text-foreground tracking-wide">
              California runs on ambition.
            </h2>
          </motion.div>
          <motion.div
            {...REVEAL}
            transition={{ ...REVEAL.transition, delay: 0.15 }}
            className="md:col-span-7 space-y-5 max-w-measure"
          >
            <p className="font-body text-body text-foreground leading-relaxed">
              Living in the Bay Area means operating at full velocity. High performers don't
              guess at recovery — they engineer it.
            </p>
            <p className="font-body text-body text-muted-foreground leading-relaxed">
              From late nights in Silicon Valley to weekends at BottleRock and Burning Man,
              the pace never stops. Recovery shouldn't either.
            </p>
            <p className="font-body text-body text-muted-foreground leading-relaxed">
              We built Avalon to bring clinician-delivered hydration and wellness protocols
              directly to you — so you can stay present for the life you've chosen.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why / Mission split */}
      <section className="px-6 md:px-16 py-section-sm md:py-section border-t border-border">
        <div className="max-w-content mx-auto grid md:grid-cols-2 gap-rhythm-4">
          <motion.div
            {...REVEAL}
            className="border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-2xl p-8 md:p-10"
          >
            <p className="text-eyebrow text-accent font-body uppercase mb-5">
              Why We Built Avalon
            </p>
            <h3 className="font-heading text-h3 text-foreground tracking-wide mb-6">
              The infrastructure never kept pace.
            </h3>
            <p className="font-body text-body-sm text-muted-foreground leading-relaxed mb-4">
              California builds everything at the frontier — but recovery was an
              afterthought. Walk-in waits. Generic menus. Nothing calibrated to how Bay
              Area professionals actually live.
            </p>
            <p className="font-body text-body-sm text-muted-foreground leading-relaxed">
              We believed you deserved something better: care that comes to you, informed by
              your intake assessment, delivered by clinicians who take outcomes as seriously
              as you take your work.
            </p>
          </motion.div>

          <motion.div
            {...REVEAL}
            transition={{ ...REVEAL.transition, delay: 0.15 }}
            className="border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-2xl p-8 md:p-10"
          >
            <p className="text-eyebrow text-accent font-body uppercase mb-5">Our Mission</p>
            <h3 className="font-heading text-h3 text-foreground tracking-wide mb-6">
              World-leading recovery at reasonable cost.
            </h3>
            <p className="font-body text-body-sm text-muted-foreground leading-relaxed">
              Clinician-supervised hydration and wellness therapies, delivered to you —
              priced to reward membership. Whether you're bouncing back from a pitch or
              recharging after a weekend on your feet.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Founded in San Francisco */}
      <section className="px-6 md:px-16 py-section-sm md:py-section border-t border-border">
        <div className="max-w-content mx-auto grid md:grid-cols-12 gap-rhythm-6 items-start">
          <motion.div {...REVEAL} className="md:col-span-5">
            <p className="text-eyebrow text-accent font-body uppercase mb-6 inline-flex items-center gap-2">
              <MapPin className="w-3 h-3" strokeWidth={2} />
              Founded in San Francisco
            </p>
            <h2 className="font-heading text-h2 text-foreground tracking-wide">
              Built by Bay Area natives for the lives we actually live.
            </h2>
          </motion.div>
          <motion.div
            {...REVEAL}
            transition={{ ...REVEAL.transition, delay: 0.15 }}
            className="md:col-span-7 max-w-measure"
          >
            <p className="font-body text-body-lg text-foreground leading-relaxed mb-5">
              Years of clinical and operational collaboration, pointed at one problem:
              world-class recovery that works when you need it and doesn't cost a fortune.
            </p>
            <p className="font-body text-body-sm text-muted-foreground leading-relaxed">
              We're here to support creators, founders, and performers with the kind of care
              that fits how they actually work.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Where we meet you */}
      <section className="px-6 md:px-16 py-section-sm md:py-section border-t border-border">
        <div className="max-w-content mx-auto">
          <motion.div {...REVEAL} className="mb-10">
            <p className="text-eyebrow text-accent font-body uppercase mb-4">
              Where We Meet You
            </p>
            <h2 className="font-heading text-h2 text-foreground tracking-wide">
              Your place. Your pace.
            </h2>
            <p className="font-body text-body text-muted-foreground leading-relaxed mt-4 max-w-measure">
              Under expert clinical guidance, licensed clinicians deliver hydration and
              wellness protocols wherever you are across the Bay Area.
            </p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {MEET_YOU.map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.6, ease: EASE }}
                className="flex flex-col items-center justify-center gap-3 border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-2xl p-5 md:p-6 min-h-[120px]"
              >
                <Icon className="w-5 h-5 text-accent" strokeWidth={1.5} />
                <span className="font-body text-micro uppercase text-foreground text-center">
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Clinical Leadership */}
      <section
        id="leadership"
        className="px-6 md:px-16 py-section-sm md:py-section border-t border-border"
      >
        <div className="max-w-content mx-auto">
          <motion.div {...REVEAL} className="mb-10 max-w-measure-lg">
            <p className="text-eyebrow text-accent font-body uppercase mb-4 inline-flex items-center gap-2">
              <Stethoscope className="w-3 h-3" strokeWidth={2} />
              Clinical Leadership
            </p>
            <h2 className="font-heading text-h1 text-foreground tracking-wide mb-4">
              Care that travels with credentials.
            </h2>
            <p className="font-body text-body text-muted-foreground leading-relaxed">
              Every visit is supervised by our medical director and delivered by a
              California-licensed clinician — at home, at work, in hotels, in green rooms,
              and at events across the Bay Area.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-rhythm-4">
            <motion.div
              {...REVEAL}
              className="border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-2xl p-8 md:p-10"
            >
              <div className="w-14 h-14 rounded-full border border-white/20 bg-white/[0.05] backdrop-blur-md flex items-center justify-center mb-6">
                <span className="font-heading text-xl text-accent tracking-wider">JW</span>
              </div>
              <h3 className="font-heading text-h4 text-foreground tracking-wide mb-1">
                Dr. Jayson Weir, MD
              </h3>
              <p className="text-micro tracking-[0.2em] text-accent font-body uppercase mb-5">
                Founder &amp; Medical Director
              </p>
              <p className="font-body text-body-sm text-muted-foreground leading-relaxed">
                Medical doctor with a background in internal medicine and performance-focused
                wellness. Dr. Weir built Avalon around a new standard: on-demand clinical
                care, tailored to the people who move the Bay Area forward.
              </p>
            </motion.div>

            <motion.div
              {...REVEAL}
              transition={{ ...REVEAL.transition, delay: 0.15 }}
              className="border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-2xl p-8 md:p-10"
            >
              <div className="w-14 h-14 rounded-full border border-white/20 bg-white/[0.05] backdrop-blur-md flex items-center justify-center mb-6">
                <span className="font-heading text-xl text-accent tracking-wider">SW</span>
              </div>
              <h3 className="font-heading text-h4 text-foreground tracking-wide mb-1">
                Stephanie Weeks, RN
              </h3>
              <p className="text-micro tracking-[0.2em] text-accent font-body uppercase mb-5">
                Lead Registered Nurse
              </p>
              <p className="font-body text-body-sm text-muted-foreground leading-relaxed">
                Veteran IV nurse and co-clinical lead. Stephanie sets Avalon's standards for
                safety, sterility, and bedside care — so every session meets the same bar,
                whether it's your first or your fortieth.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust trailer */}
      <section className="px-6 md:px-16 py-section-sm border-t border-border">
        <div className="max-w-content mx-auto grid grid-cols-1 md:grid-cols-3 gap-rhythm-4">
          <motion.div
            {...REVEAL}
            className="flex flex-col gap-2.5"
          >
            <Shield className="w-4 h-4 text-accent" strokeWidth={1.5} />
            <p className="text-micro uppercase text-foreground tracking-[0.2em]">
              Licensed Clinicians
            </p>
            <p className="font-body text-body-sm text-muted-foreground/85 leading-relaxed">
              Every Avalon visit is delivered by a California-licensed clinician under
              medical director oversight.
            </p>
          </motion.div>
          <motion.div
            {...REVEAL}
            transition={{ ...REVEAL.transition, delay: 0.1 }}
            className="flex flex-col gap-2.5"
          >
            <MapPin className="w-4 h-4 text-accent" strokeWidth={1.5} />
            <p className="text-micro uppercase text-foreground tracking-[0.2em]">
              Bay Area Coverage
            </p>
            <p className="font-body text-body-sm text-muted-foreground/85 leading-relaxed">
              San Francisco and the greater Bay Area at launch. Expanding methodically, not
              in a hurry.
            </p>
          </motion.div>
          <motion.div
            {...REVEAL}
            transition={{ ...REVEAL.transition, delay: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            <Stethoscope className="w-4 h-4 text-accent" strokeWidth={1.5} />
            <p className="text-micro uppercase text-foreground tracking-[0.2em]">
              Intake First
            </p>
            <p className="font-body text-body-sm text-muted-foreground/85 leading-relaxed">
              Every protocol begins with a clinical intake. No guesswork. No one-size-fits-all
              drip menus.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Close */}
      <section className="px-6 md:px-16 py-section border-t border-border">
        <motion.div {...REVEAL} className="max-w-content mx-auto text-center">
          <p className="text-eyebrow text-accent font-body uppercase mb-6">This is</p>
          <h2 className="font-heading text-display text-foreground tracking-wide leading-none">
            AVALON VITALITY
          </h2>
          <div className="h-px bg-foreground/20 w-24 mx-auto mt-8 mb-8" />
          <p className="font-body text-body text-muted-foreground/85 leading-relaxed max-w-measure mx-auto">
            Launching in San Francisco.
          </p>
          <a
            href="/apply"
            className="inline-block mt-8 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full px-10 py-4 hover:bg-foreground/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start Now
          </a>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
