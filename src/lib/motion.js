// Shared animation tokens. Brief mandates a single easing curve site-wide:
// cubic-bezier(0.16, 1, 0.3, 1). Keep this file as the single source of truth.

export const EASE = [0.16, 1, 0.3, 1];

// Standard reveal pattern used by every "fade up on scroll" section.
// Spread it: <motion.div {...REVEAL} />
// Override a piece: <motion.div {...REVEAL} transition={{ ...REVEAL.transition, delay: 0.2 }} />
export const REVEAL = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-10%' },
  transition: { duration: 0.7, ease: EASE },
};
