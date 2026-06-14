import React from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { EASE } from '@/lib/motion';

// Route crossfade. OPACITY ONLY on .av-page-stage.
//
// The fixed Navbar renders INSIDE this wrapper (every page mounts its own Navbar
// under .av-page-stage). Any non-`none` `transform`/`filter`/`perspective` here
// makes the stage a containing block for fixed descendants → the navbar un-pins,
// scrolls away, and its links die after scroll. So we never animate transform or
// filter on the stage — a pure opacity crossfade is the whole effect.
// (Guarded by `npm run test:navfix`. See avalon-fixed-nav-containing-block.)
//
// Exit/enter are driven by <AnimatePresence mode="wait" initial={false}> in
// App.jsx (AppRoutes), keyed by location.pathname. `initial={false}` means the
// first load does NOT fade in — hero first paint stays untouched; only subsequent
// navigations crossfade. Disabled entirely under prefers-reduced-motion.
const stageMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.26, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: EASE } },
};

export default function PageTransition({ children }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className="av-page-stage min-h-screen">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      variants={stageMotion}
      initial="initial"
      animate="animate"
      exit="exit"
      className="av-page-stage min-h-screen"
    >
      {children}
    </motion.div>
  );
}
