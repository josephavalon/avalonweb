import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { REVEAL } from '@/lib/motion';

export default function SectionTitle({
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
