import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const EASE = [0.16, 1, 0.3, 1];

// Our Team page. Two stacked sections:
//   1. Clinical Team â Medical Director + Clinical Lead
//   2. Leadership â founders + operating team
// Text-only cards for launch. Headshots to come post-presale.
// Bios are a single paragraph where present; placeholder cards omit bio.

const CLINICAL = [
  {
    name: 'Dr. Jayson Weir',
    role: 'Medical Director',
    credentials: 'MD â Internal Medicine',
    bio: 'An internist with more than a decade of hospital and concierge practice, Dr. Weir oversees clinical standards across every Avalon Protocol. He reviews every formulation, signs off on every new modality before it reaches a member, and owns every clinical escalation from the field.',
    anchor: true,
  },
  {
    name: 'Stephanie Weeks',
    role: 'Clinical Lead',
    credentials: null,
    bio: null,
  },
];

const LEADERSHIP = [
  {
    name: 'Joseph Litton',
    role: 'Co-Founder',
    bio: 'Startup veteran across multiple Bay Area companies.',
  },
  {
    name: 'Joshua Goldbard',
    role: 'Co-Founder',
    bio: 'Founder of MobileCoin and Crypto Lotus. Co-founder of Fire Wallet.',
  },
  {
    name: 'Corey Assibey',
    role: 'CFO',
    bio: 'Co-founder of PeteHealth, the mobile physical therapy company. UCLA Anderson MBA.',
  },
  {
    name: 'Grady Brannan',
    role: 'Head of Partnerships',
    bio: 'Bay Area photography legend; credits include Rolling Stone, Billboard, and the SF Giants.',
  },
  {
    name: 'Robert Decoito',
    role: 'Head of Business Development',
    bio: 'Startup veteran running Avalon\u2019s partner and commercial channels.',
  },
  {
    name: 'Manuel',
    role: 'Operations',
    bio: 'Startup veteran running day-to-day operations.',
  },
  {
    name: 'Aaron',
    role: 'Head of Workforce Operations',
    bio: 'Startup veteran leading workforce operations.',
  },
];

function PersonCard({ person, i, anchor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: EASE }}
      className={`rounded-3xl p-6 md:p-8 flex flex-col ${
        anchor
          ? 'border border-foreground/25 bg-card'
          : 'border border-border bg-card/40'
      }`}
    >
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
        {person.role}
      </p>
      <h3 className="font-heading text-2xl md:text-3xl text-foreground tracking-wide mb-1 leading-tight">
        {person.name}
      </h3>
      {person.credentials && (
        <p className="font-body text-[11px] tracking-[0.25em] uppercase text-accent mb-5">
          {person.credentials}
        </p>
      )}
      {person.bio && (
        <p className={`font-body text-sm text-foreground/85 leading-relaxed ${person.credentials ? '' : 'mt-4'}`}>
          {person.bio}
        </p>
      )}
    </motion.div>
  );
}

export default function OurTeam() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <section className="pt-32 md:pt-40 pb-10 md:pb-12 px-6 md:px-16">
        <div className="max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            The Team
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="font-heading text-5xl md:text-7xl lg:text-8xl text-foreground tracking-wide leading-[0.95]"
          >
            OUR TEAM
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mt-6"
          >
            Clinicians, operators, and builders. Every Protocol at Avalon is designed, reviewed, and renewed under our Medical Director, Dr. Jayson Weir.
          </motion.p>
        </div>
      </section>

      {/* Clinical Team */}
      <section className="py-8 md:py-12 px-6 md:px-16 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            Clinical
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-8 md:mb-10"
          >
            CLINICAL TEAM
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 items-start">
            {CLINICAL.map((person, i) => (
              <PersonCard key={person.name} person={person} i={i} anchor={person.anchor} />
            ))}
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-8 md:py-12 px-6 md:px-16 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            Leadership
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-8 md:mb-10"
          >
            THE TEAM
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-start">
            {LEADERSHIP.map((person, i) => (
              <PersonCard key={person.name} person={person} i={i} anchor={false} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
