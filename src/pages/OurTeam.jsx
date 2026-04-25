import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const EASE = [0.16, 1, 0.3, 1];

// Our Team page. Two stacked sections:
//   1. Clinical Team — Medical Director + Clinical Lead
//   2. Leadership — founders + operating team
// Text-only cards for launch. Headshots to come post-presale.
// Bios are a single paragraph where present; placeholder cards omit bio.

const CLINICAL = [
  {
    name: 'Dr. Jayson Weir',
    role: 'Medical Director',
    credentials: 'MD — Internal Medicine',
    bio: 'Internist with over a decade of hospital and concierge practice.',
    anchor: true,
  },
  {
    name: 'Stephanie Weeks',
    role: 'Director of Nursing',
    credentials: null,
    bio: "Veteran IV nurse. Sets Avalon's standards for safety, sterility, and bedside care — every session, every patient.",
  },
];

const LEADERSHIP = [
  {
    name: 'Joseph Litton',
    role: 'CEO',
    bio: 'Startup veteran across multiple Bay Area companies.',
  },
  {
    name: 'Joshua Goldbard',
    role: 'Strategic Advisor',
    bio: 'Founder of MobileCoin and Crypto Lotus. Co-founder of Fire Wallet.',
  },
  {
    name: 'Robert Decoito',
    role: 'Head of Business Development',
    bio: 'Veteran of Yelp and MobileCoin. Runs Avalon\u2019s partner and commercial channels.',
  },
  {
    name: 'Grady Brannan',
    role: 'Head of Partnerships',
    bio: 'Bay Area photography legend; credits include Rolling Stone, Billboard, and the SF Giants.',
  },
  {
    name: 'Corey Assibey',
    role: 'CFO',
    bio: 'Co-founder of PeteHealth, the mobile physical therapy company. UCLA Anderson MBA.',
  },
  {
    name: 'Manuel',
    role: 'Operations',
    bio: 'Co-founder of Fire Wallet. Runs day-to-day operations at Avalon.',
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
      <p className="font-body text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
        {person.role}
      </p>
      <h3 className="font-heading text-2xl md:text-3xl text-foreground tracking-wide mb-1 leading-tight">
        {person.name}
      </h3>
      {person.credentials && (
        <p className="font-body text-xs tracking-[0.25em] uppercase text-accent mb-5">
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

      {/* Clinical Team */}
      <section className="pt-32 md:pt-40 pb-8 md:pb-12 px-6 md:px-16">
        <div className="max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4"
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
            className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4"
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
