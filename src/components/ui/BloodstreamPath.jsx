import React from 'react';
import { motion } from 'framer-motion';

/**
 * Educational anatomy illustration — drop molecules traveling a vein path.
 * Comparison: IV route (all particles reach target) vs oral route (first-pass loss).
 * FDA-safe: purely educational representation, no efficacy claims.
 */
export default function BloodstreamPath() {
  const drops = [0, 1, 2, 3, 4];
  return (
    <div className="relative w-full max-w-md mx-auto h-48 md:h-56">
      <svg viewBox="0 0 400 220" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* IV route — clean straight line into bloodstream */}
        <text x="8" y="46" className="fill-accent" fontSize="11" letterSpacing="2" fontFamily="var(--font-body)">IV ROUTE</text>
        <path id="iv-path" d="M 30 70 L 360 70" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
        <circle cx="30" cy="70" r="5" fill="hsl(var(--accent))" />
        <circle cx="360" cy="70" r="5" fill="hsl(var(--accent))" />
        {drops.map(i => (
          <motion.circle
            key={'iv-' + i}
            r="3"
            cy="70"
            fill="hsl(var(--accent))"
            initial={{ cx: 30, opacity: 0 }}
            animate={{ cx: [30, 360], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 2.4,
              delay: i * 0.4,
              repeat: Infinity,
              ease: [0.16, 1, 0.3, 1]
            }}
          />
        ))}
        {/* Oral route — particles diminish (first-pass loss) */}
        <text x="8" y="166" className="fill-muted-foreground" fontSize="11" letterSpacing="2" fontFamily="var(--font-body)">ORAL ROUTE</text>
        <path d="M 30 190 L 360 190" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.35" />
        <circle cx="30" cy="190" r="5" fill="hsl(var(--muted-foreground))" opacity="0.7" />
        <circle cx="360" cy="190" r="5" fill="hsl(var(--muted-foreground))" opacity="0.5" />
        {drops.map(i => (
          <motion.circle
            key={'oral-' + i}
            r="3"
            cy="190"
            fill="hsl(var(--muted-foreground))"
            initial={{ cx: 30, opacity: 0 }}
            animate={{
              cx: [30, 120, 200, 280, 360],
              opacity: [0, 0.9, 0.6, 0.25, 0]
            }}
            transition={{
              duration: 2.8,
              delay: i * 0.45,
              repeat: Infinity,
              ease: [0.16, 1, 0.3, 1]
            }}
          />
        ))}
        {/* Divider axis */}
        <line x1="30" y1="125" x2="360" y2="125" stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.12" />
      </svg>
      <p className="absolute bottom-1 right-2 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-body">Educational</p>
    </div>
  );
}
