import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { EASE } from '@/lib/motion';

function transitionKind(from, to) {
  if (to === '/book') return 'booking-entry';
  return 'standard';
}

// NOTE: do NOT animate `filter` here. A non-`none` filter (even blur(0px))
// makes .av-page-stage a containing block for position:fixed descendants,
// which un-pins the fixed Navbar so it scrolls away and its links die after
// scroll. The blur(0px) was a visual no-op anyway. Keep opacity/transform only.
const stageMotion = {
  initial: (kind) => {
    if (kind === 'booking-entry') {
      return { opacity: 1, y: 6, scale: 1 };
    }
    return { opacity: 1, y: 0 };
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: EASE },
  },
  exit: (kind) => ({
    opacity: 1,
    y: kind === 'booking-entry' ? -6 : -8,
    scale: 1,
    transition: { duration: 0.16, ease: EASE },
  }),
};

export default function PageTransition({ children }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const previousPathRef = useRef(location.pathname);
  const calculatedKind = transitionKind(previousPathRef.current, location.pathname);
  const kind = calculatedKind;

  useEffect(() => {
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  if (reduceMotion) {
    return (
      <div key={location.pathname} className="av-page-stage min-h-screen">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={location.pathname}
      custom={kind}
      variants={stageMotion}
      initial={kind === 'booking-entry' ? 'initial' : false}
      animate="animate"
      className="av-page-stage min-h-screen"
    >
      {children}
    </motion.div>
  );
}
