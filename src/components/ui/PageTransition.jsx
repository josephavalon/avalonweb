import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { EASE } from '@/lib/motion';

const RED_CARPET_MS = 1480;

function transitionKind(from, to) {
  if (from === '/' && to === '/book') return 'red-carpet';
  if (to === '/book') return 'booking-entry';
  return 'standard';
}

const stageMotion = {
  initial: (kind) => {
    if (kind === 'red-carpet') {
      return { opacity: 0, y: 54, scale: 0.984, filter: 'blur(18px)' };
    }
    if (kind === 'booking-entry') {
      return { opacity: 0, y: 28, scale: 0.992, filter: 'blur(10px)' };
    }
    return { opacity: 0, y: 12, filter: 'blur(4px)' };
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.92, ease: EASE },
  },
  exit: (kind) => ({
    opacity: kind === 'red-carpet' ? 0.24 : 0,
    y: kind === 'red-carpet' ? -18 : -8,
    scale: kind === 'red-carpet' ? 0.992 : 1,
    filter: kind === 'red-carpet' ? 'blur(10px)' : 'blur(4px)',
    transition: { duration: kind === 'red-carpet' ? 0.62 : 0.34, ease: EASE },
  }),
};

function RedCarpetOverlay({ id, reduceMotion, onComplete }) {
  if (reduceMotion) return null;

  return (
    <motion.div
      key={id}
      className="av-red-carpet pointer-events-none fixed inset-0 z-[8] overflow-hidden"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.48, times: [0, 0.2, 0.78, 1], ease: EASE }}
      onAnimationComplete={onComplete}
    >
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,hsl(var(--foreground)/0.14),transparent_34%),linear-gradient(180deg,hsl(var(--background)/0.10),hsl(var(--background)/0.42))] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.72, 0] }}
        transition={{ duration: 1.48, times: [0, 0.42, 1], ease: EASE }}
      />
      <motion.div
        className="absolute inset-y-6 left-1/2 w-[min(92vw,980px)] -translate-x-1/2 rounded-[2.4rem] border border-foreground/[0.12] bg-background/[0.10] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.14),0_40px_140px_hsl(var(--foreground)/0.18)] backdrop-blur-2xl backdrop-saturate-150 md:inset-y-8 md:rounded-[3rem]"
        initial={{ clipPath: 'inset(0 48% 0 48%)', opacity: 0.1, scaleY: 0.96 }}
        animate={{ clipPath: ['inset(0 48% 0 48%)', 'inset(0 0% 0 0%)', 'inset(0 0% 0 0%)'], opacity: [0.1, 1, 0.18], scaleY: [0.96, 1, 1.018] }}
        transition={{ duration: 1.32, times: [0, 0.62, 1], ease: EASE }}
      />
      <motion.div
        className="absolute left-1/2 top-24 h-px w-[min(76vw,760px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/36 to-transparent md:top-32"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 0.8], opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.18, delay: 0.12, ease: EASE }}
      />
      <motion.div
        className="absolute bottom-12 left-1/2 h-[42svh] w-[min(86vw,860px)] -translate-x-1/2 rounded-t-[2.2rem] border-x border-t border-foreground/[0.10] bg-[linear-gradient(180deg,hsl(var(--foreground)/0.055),transparent_62%)] backdrop-blur-xl md:bottom-16"
        initial={{ y: 64, opacity: 0, scaleX: 0.88 }}
        animate={{ y: [64, 0, -18], opacity: [0, 0.86, 0], scaleX: [0.88, 1, 1.04] }}
        transition={{ duration: 1.36, delay: 0.08, ease: EASE }}
      />
    </motion.div>
  );
}

export default function PageTransition({ children }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const previousPathRef = useRef(location.pathname);
  const calculatedKind = transitionKind(previousPathRef.current, location.pathname);
  const [activeStageKind, setActiveStageKind] = useState('standard');
  const kind = calculatedKind === 'red-carpet'
    ? 'red-carpet'
    : activeStageKind === 'red-carpet' && location.pathname === '/book'
      ? 'red-carpet'
      : calculatedKind;
  const [redCarpet, setRedCarpet] = useState(null);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const nextKind = transitionKind(previousPath, location.pathname);
    previousPathRef.current = location.pathname;

    if (nextKind !== 'red-carpet' || reduceMotion) {
      setActiveStageKind(nextKind);
      setRedCarpet(null);
      return undefined;
    }

    const id = `${Date.now()}-${location.pathname}`;
    setActiveStageKind('red-carpet');
    setRedCarpet({ id });
    const overlayTimer = window.setTimeout(() => setRedCarpet(null), RED_CARPET_MS);
    const stageTimer = window.setTimeout(() => setActiveStageKind('booking-entry'), RED_CARPET_MS);
    return () => {
      window.clearTimeout(overlayTimer);
      window.clearTimeout(stageTimer);
    };
  }, [location.pathname, reduceMotion]);

  if (reduceMotion) {
    return (
      <div key={location.pathname} className="av-page-stage min-h-screen">
        {children}
      </div>
    );
  }

  return (
    <>
      {redCarpet && (
        <RedCarpetOverlay
          id={redCarpet.id}
          reduceMotion={reduceMotion}
          onComplete={() => setRedCarpet(null)}
        />
      )}
      <AnimatePresence initial={false} mode="sync" custom={kind}>
        <motion.div
          key={location.pathname}
          custom={kind}
          variants={stageMotion}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`av-page-stage min-h-screen ${kind === 'red-carpet' ? 'av-page-stage-concierge' : ''}`}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
