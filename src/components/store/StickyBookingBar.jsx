import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// Mobile-only "Ready to recover? BOOK NOW" sticky bar at the bottom of /store.
// Desktop hides it (the inline CTAs + drawer are enough).
export default function StickyBookingBar({ onBookClick }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show after scrolling past the hero (~400px)
    const handler = () => setVisible(window.scrollY > 380);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="md:hidden fixed bottom-3 left-3 right-3 z-30"
        >
          <button
            type="button"
            onClick={onBookClick}
            className="w-full sticky-book-bar flex items-center justify-between gap-3 rounded-full px-5 py-3.5"
          >
            <span className="font-body text-[11px] tracking-[0.3em] uppercase text-foreground/85">Ready to recover?</span>
            <span className="inline-flex items-center gap-1.5 font-body text-xs tracking-[0.3em] uppercase">
              Book now <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </span>
          </button>
          <style>{`
            .sticky-book-bar {
              background: hsl(var(--background) / 0.85);
              backdrop-filter: saturate(160%) blur(20px);
              -webkit-backdrop-filter: saturate(160%) blur(20px);
              border: 1px solid hsl(var(--foreground) / 0.18);
              box-shadow: 0 18px 40px -10px hsl(var(--foreground) / 0.18);
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
