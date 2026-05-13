import React from 'react';
import { useSeo } from '@/lib/seo';
import { motion } from 'framer-motion';
import { Shield, Home, Zap } from 'lucide-react';
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
    credentials: 'BSN, RN — 12+ Years IV Therapy',
    bio: "Stephanie brings over a decade of IV therapy and critical care nursing to Avalon. She built our clinical protocols from the ground up, trains every nurse on the Avalon standard, and personally oversees quality assurance. Former ICU and infusion center RN.",
  },
];

const NURSING_TEAM = [
  {
    initials: 'MD',
    name: 'Dr. [Name Pending]',
    role: 'Medical Director',
    credential: 'Physician Oversight',
    specialty: null,
    experience: null,
    bio: 'Board-certified physician overseeing all Avalon clinical protocols, standing orders, and nurse credentialing. Clinical background in internal medicine with a focus on integrative health.',
    badge: 'Physician Oversight',
    avatarColor: '#1a1a2e',
    avatarText: '#C9A84C',
  },
  {
    initials: 'SK',
    name: 'Sarah K.',
    role: 'RN, BSN',
    credential: 'Registered Nurse',
    specialty: 'Critical Care & IV Therapy',
    experience: '8 years',
    bio: 'Former ICU nurse at UCSF Medical Center. Specializes in high-complexity IV protocols including NAD+ and high-dose vitamin C.',
    badge: null,
    avatarColor: '#0f2027',
    avatarText: '#C9A84C',
  },
  {
    initials: 'MT',
    name: 'Marcus T.',
    role: 'RN',
    credential: 'Registered Nurse',
    specialty: 'Emergency Medicine',
    experience: '6 years',
    bio: 'ER-trained nurse with extensive experience in rapid IV access and adverse event management. Based in the South Bay.',
    badge: null,
    avatarColor: '#0f2027',
    avatarText: '#C9A84C',
  },
  {
    initials: 'PL',
    name: 'Priya L.',
    role: 'RN, BSN',
    credential: 'Registered Nurse',
    specialty: 'Oncology & Wellness',
    experience: '5 years',
    bio: 'Background in oncology nursing with deep expertise in nutritional IV therapy. Serves clients across SF and Marin.',
    badge: null,
    avatarColor: '#0f2027',
    avatarText: '#C9A84C',
  },
  {
    initials: 'DC',
    name: 'David C.',
    role: 'RN',
    credential: 'Registered Nurse',
    specialty: 'Sports Medicine & Recovery',
    experience: '7 years',
    bio: 'Works with professional athletes and performance coaches. Specializes in recovery and performance IV protocols.',
    badge: null,
    avatarColor: '#0f2027',
    avatarText: '#C9A84C',
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

function NurseCard({ nurse, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.08 + i * 0.08, ease: EASE }}
      className="rounded-3xl p-6 md:p-8 flex flex-col border border-white/10 bg-white/[0.02] backdrop-blur-sm"
    >
      {/* Initials avatar */}
      <div className="flex items-start gap-4 mb-5">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 border border-white/10"
          style={{ backgroundColor: nurse.avatarColor }}
        >
          <span
            className="font-heading text-lg leading-none"
            style={{ color: nurse.avatarText }}
          >
            {nurse.initials}
          </span>
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="font-heading text-xl md:text-2xl text-foreground tracking-wide leading-tight">
              {nurse.name}
            </h3>
          </div>
          <p className="font-body text-xs tracking-[0.2em] uppercase text-muted-foreground">
            {nurse.role}
          </p>
        </div>
      </div>

      {/* Badge + specialty */}
      <div className="flex flex-wrap gap-2 mb-4">
        {nurse.badge && (
          <span className="font-body text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border border-accent/40 text-accent">
            {nurse.badge}
          </span>
        )}
        {nurse.specialty && (
          <span className="font-body text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 rounded-full border border-white/10 text-foreground/50">
            {nurse.specialty}
          </span>
        )}
        {nurse.experience && (
          <span className="font-body text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 rounded-full border border-white/10 text-foreground/40">
            {nurse.experience} exp.
          </span>
        )}
      </div>

      {/* Bio */}
      <p className="font-body text-sm text-foreground/65 leading-relaxed flex-1">
        {nurse.bio}
      </p>
    </motion.div>
  );
}

function PersonCard({ person, i, anchor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: EASE }}
      className={`rounded-3xl p-6 md:p-8 flex flex-col ${
        anchor
          ? 'border border-white/20 bg-white/[0.05] backdrop-blur-md'
          : 'border border-white/10 bg-white/[0.02] backdrop-blur-sm'
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
        <p className={`font-body text-sm text-foreground/70 leading-relaxed ${person.credentials ? '' : 'mt-4'}`}>
          {person.bio}
        </p>
      )}
    </motion.div>
  );
}

export default function OurTeam() {
  useSeo({
    title: 'Our Team — Avalon Vitality',
    description: 'Meet the clinicians and operators behind Avalon Vitality — California-licensed registered nurses, physicians, and longevity advisors.',
    path: '/team',
  });
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

      {/* Nursing Team */}
      <section className="py-8 md:py-12 px-6 md:px-16 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            Field Team
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-8 md:mb-10"
          >
            YOUR NURSES
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start">
            {NURSING_TEAM.map((nurse, i) => (
              <NurseCard key={nurse.name} nurse={nurse} i={i} />
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

      {/* Why Avalon */}
      <section className="py-8 md:py-16 px-6 md:px-16 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            WHY AVALON
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-8 md:mb-10"
          >
            CLINICAL BY DESIGN.{' '}
            <br className="hidden md:block" />
            CONCIERGE BY DELIVERY.
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            {[
              {
                Icon: Shield,
                title: 'Licensed & Supervised',
                body: 'Every nurse is a California-licensed RN with IV certification and 2+ years clinical experience. All protocols are physician-reviewed.',
              },
              {
                Icon: Home,
                title: 'Built for Real Life',
                body: 'Same-day booking. Your location. No clinic visits, waiting rooms, or insurance forms. IV therapy that fits your schedule.',
              },
              {
                Icon: Zap,
                title: 'Longevity-Forward',
                body: "We're not a hydration bar. Avalon is built as a longevity platform — starting with IV, expanding to peptides, diagnostics, and precision wellness.",
              },
            ].map(({ Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.1, ease: EASE }}
                className="border border-foreground/10 rounded-2xl p-6 flex flex-col"
              >
                <Icon className="w-5 h-5 text-accent mb-4 shrink-0" strokeWidth={1.5} />
                <h3 className="font-heading text-xl text-foreground tracking-wide leading-tight">
                  {title}
                </h3>
                <p className="font-body text-sm text-foreground/60 leading-relaxed mt-2 flex-1">
                  {body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
