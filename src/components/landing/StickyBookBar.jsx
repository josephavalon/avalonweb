import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { ArrowRight } from 'lucide-react';

import { EASE, premiumTap } from '@/lib/motion';

const BOOK_URL = '/book?protocol=recovery&time=asap';

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
          initial={{ y: 72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 72, opacity: 0 }}
          transition={{ duration: 0.58, ease: EASE }}
          className="fixed bottom-0 inset-x-0 z-50 md:hidden"
          aria-label="Quick booking bar"
        >
          {/* Opaque frosted bar */}
          <div className="relative isolate mx-2 mb-1 flex items-center gap-2 overflow-hidden rounded-[18px] border border-foreground/[0.12] bg-[hsl(var(--background)/0.86)] px-2.5 py-1 shadow-[0_12px_34px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
            <div className="absolute inset-0 -z-10 bg-[hsl(var(--background))]" aria-hidden="true" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-foreground/[0.05]" aria-hidden="true" />
            {/* Label */}
            <div className="flex-1 min-w-0">
              <p className="font-body text-[9px] tracking-[0.22em] uppercase text-foreground/55">
                Book now
              </p>
              <p className="font-body text-[9px] tracking-[0.12em] uppercase text-foreground font-semibold truncate">
                Full checkout
              </p>
            </div>

            {/* Primary CTA */}
            <motion.div whileTap={premiumTap} className="shrink-0">
              <Link
                to={BOOK_URL}
                className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-background font-body text-[9px] font-semibold uppercase tracking-[0.15em] transition-colors duration-base ease-editorial hover:bg-foreground/85"
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
