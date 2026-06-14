// Motion primitives for Avalon Vitality.
// Project non-negotiable easing (brief §1.3): cubic-bezier(0.16, 1, 0.3, 1).
// Use named exports everywhere. Do NOT use springs or bounce — editorial feel only.
//
// iOS safety contract (every reveal preset below honors it):
//   - transform (y/scale) + opacity ONLY. No `filter`/`blur` — blur forces a WebKit
//     compositing layer that eats touch/scroll on off-screen elements.
//   - `pointerEvents: 'none'` in the hidden/initial state, `'auto'` once shown. An
//     opacity:0 section below the fold can otherwise intercept scroll gestures on iOS.
//     With `once:true` the element flips to 'auto' as it enters and never re-hides.
//   - Never scale a full-section WRAPPER (clips children top/bottom edges). Scale is
//     reserved for item-level cards where the bounding box has padding to spare.
//   - These presets are spread onto section/card divs — NOT onto `.av-page-stage` or
//     any ancestor of the fixed Navbar. Page-stage transitions stay opacity-only and
//     live in PageTransition.jsx (see avalon-fixed-nav-containing-block constraint).

// === Canonical easing ===
// EASE is the short alias used by new components.
// EASE_OUT_EXPO is the legacy alias kept for backwards compatibility.
export const EASE = [0.16, 1, 0.3, 1];
export const EASE_OUT_EXPO = EASE;

// Standard durations — keep a small set.
export const DURATIONS = {
  quick: 0.25,
  crisp: 0.32,
  fast: 0.36,
  base: 0.52,
  slow: 0.72,
  dramatic: 0.88,
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

// Common variants — on-mount fade/rise.
export const fadeUp = {
  initial: { opacity: 0, y: 20, pointerEvents: 'none' },
  animate: { opacity: 1, y: 0, pointerEvents: 'auto' },
  transition: transitionSlow,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: transitionBase,
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: transitionBase,
};

export const premiumFadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24, pointerEvents: 'none' },
  animate: { opacity: 1, y: 0, pointerEvents: 'auto' },
  transition: { ...transitionDramatic, delay },
});

// Scroll-in card reveal (whileInView, plays once).
export const premiumCard = (delay = 0) => ({
  initial: { opacity: 0, y: 24, pointerEvents: 'none' },
  whileInView: { opacity: 1, y: 0, pointerEvents: 'auto' },
  viewport: { once: true, margin: '-32px' },
  transition: { duration: 0.58, delay, ease: EASE },
});

// Tactile card/button lift. Transform-only (GPU, nav-safe). Snappy in (~0.2s) for a
// Linear/Raycast feel. Apply only to elements whose CSS uses transition-colors (NOT
// transition-all) so the browser doesn't also transition this transform → jitter.
export const premiumHover = {
  y: -3,
  scale: 1.01,
  transition: { duration: 0.22, ease: EASE },
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

// Intentionally IDENTITY (not a reveal). Dropdown/accordion list items reveal via
// the height disclosure (SmoothDisclosure) only. Animating opacity/y here runs at
// the same time as the height-clip AND the chips' CSS `transition-all`, producing a
// visible flash/flutter on expand (the documented opacity-multiplication issue). Keep flat.
export const premiumListItem = {
  hidden: { opacity: 1, y: 0 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE },
  },
};

export const routeTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.24, ease: EASE },
};

// Identity for the same reason as premiumListItem — avoid the expand-time flash.
export const premiumStaggerItem = {
  hidden: { opacity: 1, y: 0, scale: 1 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: EASE },
  },
};

export const premiumSheetTransition = {
  duration: 0.68,
  ease: EASE,
};

export const checkoutStageTransition = {
  duration: DURATIONS.crisp,
  ease: EASE,
};

export const checkoutStage = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: checkoutStageTransition,
};

export const selectionCheck = {
  initial: { opacity: 0, scale: 0.86 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: DURATIONS.crisp, ease: EASE },
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
  initial: { opacity: 0, y: 16, pointerEvents: 'none' },
  whileInView: { opacity: 1, y: 0, pointerEvents: 'auto' },
  viewport: { once: true, margin: '-10%' },
  transition: { duration: 0.52, ease: EASE },
};
