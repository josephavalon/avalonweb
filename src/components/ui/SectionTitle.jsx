import React from 'react';
import { motion } from 'framer-motion';
import { REVEAL } from '@/lib/motion';

// Single source of truth for the section title block:
// eyebrow (gold tracking caps) + canonical h2 + optional tagline.
// Used across every editorial landing section.
//
// Usage:
//   <SectionTitle eyebrow="Live Protocols" title="Vitality Treatments" />
//   <SectionTitle eyebrow="From our clients" title="Real Results" tagline="..." />
export default function SectionTitle({
  eyebrow,
  title,
  tagline,
  className = '',
  align = 'left',
  as: Heading = 'h2',
}) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left';
  return (
    <motion.div
      {...REVEAL}
      className={`${alignClass} mb-6 md:mb-10 ${className}`}
    >
      {eyebrow && (
        <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">
          {eyebrow}
        </p>
      )}
      <Heading className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
        {title}
      </Heading>
      {tagline && (
        <p className={`font-body text-sm md:text-base text-muted-foreground leading-relaxed mt-3 md:mt-5 ${align === 'center' ? 'mx-auto' : ''} max-w-xl`}>
          {tagline}
        </p>
      )}
    </motion.div>
  );
}
