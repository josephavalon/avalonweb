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
  quick: 0.22,
  fast: 0.36,
  base: 0.72,
  slow: 1,
  dramatic: 1.35,
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

export const transitionDramatic = {
  duration: DURATIONS.dramatic,
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

export const premiumFadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { ...transitionDramatic, delay },
});

export const premiumCard = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-32px' },
  transition: { duration: 0.95, delay, ease: EASE },
});

export const premiumHover = {
  y: -3,
  scale: 1.006,
  transition: { duration: DURATIONS.fast, ease: EASE },
};

export const premiumTap = {
  scale: 0.992,
  transition: { duration: DURATIONS.quick, ease: EASE },
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
