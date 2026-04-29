// Motion primitives for Avalon Vitality.
// Project non-negotiable easing (brief §1.3): cubic-bezier(0.16, 1, 0.3, 1).
// Use named exports everywhere. Do NOT use springs or bounce — editorial feel only.

// === Canonical easing ===
// EASE is the short alias used by new components.
// EASE_OUT_EXPO is the legacy alias kept for backwards compatibility.
export const EASE = [0.16, 1, 0.3, 1];
export const EASE_OUT_EXPO = EASE;

// Standard durations — keep a small set.
export const DURATIONS = {
  fast: 0.3,
  base: 0.6,
  slow: 0.9,
  dramatic: 1.2,
};

// Common Framer Motion transition presets.
export const transitionBase = {
  duration: DURATIONS.base,
  ease: EASE,
};

export const transitionSlow = {
  duration: DURATIONS.slow,
  ease: EASE,
};

// Common variants.
export const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: transitionSlow,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: transitionBase,
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: transitionBase,
};

// Stagger helpers for list children.
export const staggerContainer = (stagger = 0.08, delayChildren = 0.1) => ({
  animate: {
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
});

// Standard reveal pattern for "fade up on scroll" sections.
// Spread it: <motion.div {...REVEAL} />
// Override a piece: <motion.div {...REVEAL} transition={{ ...REVEAL.transition, delay: 0.2 }} />
export const REVEAL = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-10%' },
  transition: { duration: 0.7, ease: EASE },
};
