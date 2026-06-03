import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { EASE } from '@/lib/motion';

function transitionKind(from, to) {
  if (to === '/book') return 'booking-entry';
  return 'standard';
}

const stageMotion = {
  initial: (kind) => {
    if (kind === 'booking-entry') {
      return { opacity: 1, y: 6, scale: 1, filter: 'blur(0px)' };
    }
    return { opacity: 1, y: 0, filter: 'blur(0px)' };
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.32, ease: EASE },
  },
  exit: (kind) => ({
    opacity: 1,
    y: kind === 'booking-entry' ? -6 : -8,
    scale: 1,
    filter: 'blur(0px)',
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
