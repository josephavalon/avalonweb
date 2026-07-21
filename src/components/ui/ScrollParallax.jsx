import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from '@/components/ui/PageTransitionMotion';

/**
 * ScrollParallax — subtle scroll-linked vertical drift for depth.
 *
 * Extends the hero's scroll-recede feel to other elements (section headings):
 * the element drifts from +distance to -distance as it passes through the
 * viewport, so it moves at a slightly different rate than the page — cohesive
 * Apple-style depth. Driven by scroll POSITION (reversible), not a one-shot
 * trigger, so there's no "reveal" to miss on scroll-back.
 *
 * Safety: transform ONLY (no opacity-to-0, no blur/filter) → iOS-safe and never
 * eats touch on off-screen elements. Apply to LEAF content (a heading), never to
 * a full-section wrapper (clips children) or any ancestor of the fixed Navbar.
 * Fully disabled under prefers-reduced-motion.
 */
export default function ScrollParallax({ children, className, distance = 24, ...rest }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <motion.div ref={ref} className={className} style={reduceMotion ? undefined : { y }} {...rest}>
      {children}
    </motion.div>
  );
}
