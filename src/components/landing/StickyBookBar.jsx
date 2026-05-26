import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { EASE, premiumTap } from '@/lib/motion';

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
          initial={{ y: 84, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 84, opacity: 0 }}
          transition={{ duration: 0.58, ease: EASE }}
          className="fixed bottom-0 inset-x-0 z-50 md:hidden"
          aria-label="Quick booking bar"
        >
          {/* Opaque frosted bar */}
          <div className="relative isolate mx-3 mb-3 flex items-center gap-3 overflow-hidden rounded-[24px] border border-foreground/[0.12] bg-[hsl(var(--background)/0.86)] px-4 py-3.5 shadow-[0_18px_70px_rgba(0,0,0,0.32)] backdrop-blur-3xl">
            <div className="absolute inset-0 -z-10 bg-[hsl(var(--background))]" aria-hidden="true" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-foreground/[0.05]" aria-hidden="true" />
            {/* Label */}
            <div className="flex-1 min-w-0">
              <p className="font-body text-[10px] tracking-[0.26em] uppercase text-foreground/55">
                Book now
              </p>
              <p className="font-body text-[11px] tracking-[0.16em] uppercase text-foreground font-semibold truncate">
                Recovery delivered
              </p>
            </div>

            {/* Primary CTA */}
            <motion.div whileTap={premiumTap} className="shrink-0">
            <Link
              to="/book"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-background font-body text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors duration-base ease-editorial hover:bg-foreground/85"
            >
              Book
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
