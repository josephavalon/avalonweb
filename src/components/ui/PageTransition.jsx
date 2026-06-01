import React from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { routeTransition } from '@/lib/motion';

export default function PageTransition({ children }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return children;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="av-page-stage min-h-screen"
        {...routeTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
