import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const RNS = [
  {
    initials: 'A.R.',
    name: 'Alexandra R.',
    years: 8,
    specialties: ['Emergency Medicine', 'IV Therapy'],
    license: 'CA RN #[pending]',
  },
  {
    initials: 'M.T.',
    name: 'Marcus T.',
    years: 6,
    specialties: ['Critical Care', 'Sports Medicine'],
    license: 'CA RN #[pending]',
  },
  {
    initials: 'J.L.',
    name: 'Jessica L.',
    years: 5,
    specialties: ['Oncology', 'IV Therapy'],
    license: 'CA RN #[pending]',
  },
];

function RNCard({ rn, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: EASE, delay: index * 0.08 }}
      className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 flex flex-col items-center text-center gap-3"
    >
      {/* Avatar */}
      <div
        className="w-16 h-16 rounded-full bg-foreground/[0.08] border border-foreground/[0.12] flex items-center justify-center font-heading text-xl text-foreground/60"
        aria-hidden="true"
      >
        {rn.initials}
      </div>

      {/* Name */}
      <h3 className="font-heading text-2xl text-foreground uppercase leading-tight">
        {rn.name}
      </h3>

      {/* Experience */}
      <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">
        {rn.years} years experience
      </p>

      {/* Specialties */}
      <div className="flex flex-wrap justify-center gap-1.5" aria-label="Specialties">
        {rn.specialties.map((spec) => (
          <span
            key={spec}
            className="px-2.5 py-1 rounded-full bg-foreground/[0.05] font-body text-[9px] tracking-[0.15em] uppercase text-foreground/50"
          >
            {spec}
          </span>
        ))}
      </div>

      {/* License badge */}
      <div className="flex items-center gap-1 font-body text-[10px] text-foreground/35 mt-1">
        <Shield className="w-3 h-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span>{rn.license}</span>
      </div>
    </motion.div>
  );
}

export default function RNProfiles() {
  return (
    <section
      aria-label="Our registered nurses"
      className="py-16 md:py-24 px-5 md:px-12 lg:px-20 max-w-6xl mx-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mb-8 md:mb-10"
      >
        <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
          Our Team
        </p>
        <h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-none mb-4">
          The RNs
        </h2>
        <p className="font-body text-sm text-foreground/55 leading-relaxed max-w-xl">
          Licensed registered nurses. Emergency-trained. Background-checked. Dedicated to your care.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {RNS.map((rn, i) => (
          <RNCard key={rn.name} rn={rn} index={i} />
        ))}
      </div>
    </section>
  );
}
