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
  slow: 1.18,
  dramatic: 1.58,
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
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { ...transitionDramatic, delay },
});

export const premiumCard = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-32px' },
  transition: { duration: 1.16, delay, ease: EASE },
});

export const premiumHover = {
  y: -3,
  scale: 1.006,
  transition: { duration: DURATIONS.fast, ease: EASE },
};

export const premiumTap = {
  scale: 0.97,
  transition: { duration: DURATIONS.quick, ease: EASE },
};

export const premiumLayoutTransition = {
  duration: 0.58,
  ease: EASE,
};

export const premiumExpandTransition = {
  duration: 0.56,
  ease: EASE,
};

export const premiumSelectionTransition = {
  duration: 0.52,
  ease: EASE,
};

export const premiumListContainer = (stagger = 0.07, delayChildren = 0.12) => ({
  hidden: {
    transition: { staggerChildren: stagger * 0.65, staggerDirection: -1 },
  },
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const premiumListItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: EASE },
  },
};

export const routeTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.24, ease: EASE },
};

export const premiumStaggerItem = {
  hidden: { opacity: 0, y: 16, scale: 0.992 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.64, ease: EASE },
  },
};

export const premiumSheetTransition = {
  duration: 0.68,
  ease: EASE,
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
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-10%' },
  transition: { duration: 1.05, ease: EASE },
};
