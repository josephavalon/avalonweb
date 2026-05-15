/**
 * AppLoader — full-screen splash that plays once on cold load.
 * Theme-aware: reads stored theme from localStorage to match colors.
 * Shows AV logotype + flash + progress bar, then dissolves into the page.
 * Does NOT re-fire on route changes — tracked via sessionStorage.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE     = [0.16, 1, 0.3, 1];
const SEEN_KEY = 'avalon.loader.seen';

const THEME_PALETTES = {
  golden: { bg: '#261a0c', text: '#f5dea0', accent: '#e8a82a', sub: 'rgba(245,222,160,0.35)' },
  dark:   { bg: '#0a0a0a', text: '#f0ede6', accent: '#c9a84c', sub: 'rgba(240,237,230,0.35)' },
  dubs:   { bg: '#001428', text: '#e8f0fe', accent: '#c9a84c', sub: 'rgba(232,240,254,0.35)' },
  light:  { bg: '#f5f3ed', text: '#0a0a0a', accent: '#0a0a0a', sub: 'rgba(10,10,10,0.35)'   },
};

function getThemePalette() {
  try {
    const stored = window.localStorage.getItem('avalon.theme') || 'golden';
    return THEME_PALETTES[stored] ?? THEME_PALETTES.golden;
  } catch {
    return THEME_PALETTES.golden;
  }
}

export default function AppLoader() {
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(SEEN_KEY); } catch { return false; }
  });

  // Resolved once — palette never changes during the splash
  const [palette] = useState(getThemePalette);

  useEffect(() => {
    if (!visible) return;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch {}

    // Progress bar finishes ~1 100ms, loader exits at ~1 800ms
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ backgroundColor: palette.bg }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        >
          {/* AV logotype — animates in then flashes */}
          <motion.p
            initial={{ opacity: 0, y: 14, letterSpacing: '0.12em' }}
            animate={[
              // Step 1: reveal
              { opacity: 1, y: 0, letterSpacing: '0.32em', filter: 'brightness(1)' },
              // Step 2: flash bright
              { filter: 'brightness(2.2)', transition: { delay: 0.65, duration: 0.12, ease: 'easeIn' } },
              // Step 3: settle
              { filter: 'brightness(1)',   transition: { delay: 0.77, duration: 0.35, ease: EASE } },
            ]}
            transition={{ duration: 0.75, ease: EASE, delay: 0.05 }}
            style={{ color: palette.text, fontFamily: 'inherit' }}
            className="font-heading text-[18vw] sm:text-[12vw] md:text-[8vw] leading-none select-none"
          >
            AV
          </motion.p>

          {/* Wordmark */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
            style={{ color: palette.sub }}
            className="font-body text-[10px] tracking-[0.4em] uppercase mt-2 select-none"
          >
            Avalon Vitality
          </motion.p>

          {/* Flash overlay — briefly lights the whole screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.18, 0] }}
            transition={{ duration: 0.45, ease: 'easeInOut', delay: 0.72, times: [0, 0.3, 1] }}
            style={{ backgroundColor: palette.text }}
            className="absolute inset-0 pointer-events-none"
          />

          {/* Accent progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06]">
            <motion.div
              style={{ backgroundColor: palette.accent }}
              className="h-full"
              initial={{ scaleX: 0, transformOrigin: 'left' }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
