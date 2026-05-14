import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function StickyBookBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after scrolling past ~40vh — appears as soon as user shows scroll intent
      setVisible(window.scrollY > window.innerHeight * 0.4);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="fixed bottom-[76px] inset-x-0 z-50 md:hidden"
          aria-label="Quick booking bar"
        >
          {/* Glass bar */}
          <div className="mx-3 mb-3 px-4 py-3 rounded-2xl bg-background/85 backdrop-blur-2xl border border-foreground/[0.08] shadow-2xl shadow-black/40 flex items-center gap-3">
            {/* Label */}
            <div className="flex-1 min-w-0">
              <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/50">
                Available today
              </p>
              <p className="font-body text-[11px] tracking-[0.15em] uppercase text-foreground font-semibold truncate">
                60–90 min · SF Bay Area
              </p>
            </div>

            {/* Primary CTA */}
            <Link
              to="/store"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background font-body text-[11px] tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
            >
              BUY NOW
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
