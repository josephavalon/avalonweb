/**
 * AppLoader — full-screen splash that plays once on cold load.
 * Theme-aware: reads stored theme from localStorage to match colors.
 * AV logotype fades in slowly, then the whole loader fades out.
 * Does NOT re-fire on route changes — tracked via sessionStorage.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE     = [0.16, 1, 0.3, 1];
const SEEN_KEY = 'avalon.loader.seen';

const THEME_PALETTES = {
  golden: { bg: '#261a0c', text: '#f5dea0', accent: '#e8a82a', sub: 'rgba(245,222,160,0.35)' },
  dark:   { bg: '#0a0a0a', text: '#f0ede6', accent: '#c9a84c', sub: 'rgba(240,237,230,0.35)' },
  dubs:   { bg: '#162240', text: '#fef0b0', accent: '#ffca2c', sub: 'rgba(255,202,44,0.35)'  },
  light:  { bg: '#f5f3ed', text: '#0a0a0a', accent: '#0a0a0a', sub: 'rgba(10,10,10,0.35)'   },
};

function getThemePalette() {
  try {
    const stored = window.localStorage.getItem('avalon.theme') || 'dark';
    return THEME_PALETTES[stored] ?? THEME_PALETTES.dark;
  } catch {
    return THEME_PALETTES.dark;
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

    // Hold for 2.2s — content fully reveals around 1.4s, then exit begins
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: EASE }}
          style={{ backgroundColor: palette.bg }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        >
          {/* AV logotype — slow, weighted fade-in with gentle lift */}
          <motion.p
            initial={{ opacity: 0, y: 18, letterSpacing: '0.08em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.32em' }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.1 }}
            style={{ color: palette.text, fontFamily: 'inherit' }}
            className="font-heading text-[18vw] sm:text-[12vw] md:text-[8vw] leading-none select-none"
          >
            AV
          </motion.p>

          {/* Wordmark — follows the logotype */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.55 }}
            style={{ color: palette.sub }}
            className="font-body text-[10px] tracking-[0.4em] uppercase mt-2 select-none"
          >
            Avalon Vitality
          </motion.p>

          {/* Accent progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06]">
            <motion.div
              style={{ backgroundColor: palette.accent }}
              className="h-full"
              initial={{ scaleX: 0, transformOrigin: 'left' }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.6, ease: EASE, delay: 0.1 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
