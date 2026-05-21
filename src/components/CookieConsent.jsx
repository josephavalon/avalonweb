import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE, premiumTap } from '@/lib/motion';

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);
  const suppressed = typeof window !== 'undefined' && window.location.pathname.startsWith('/b2b');

  useEffect(() => {
    if (suppressed) return;
    const consentGiven = localStorage.getItem('cookieConsent');
    if (!consentGiven) {
      setShowConsent(true);
    }
  }, [suppressed]);

  const handleAllow = () => {
    localStorage.setItem('cookieConsent', 'allowed');
    setShowConsent(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setShowConsent(false);
  };

  if (suppressed) return null;

  return (
    <AnimatePresence>
      {showConsent && (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.985, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24, scale: 0.985, filter: 'blur(8px)' }}
          transition={{ duration: 0.55, ease: EASE }}
          className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-4 sm:px-5 sm:pb-5 pointer-events-none"
        >
          <div className="max-w-xl ml-auto mr-auto sm:mr-0 border border-foreground/10 bg-background/88 backdrop-blur-2xl rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/35 pointer-events-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-heading text-2xl sm:text-3xl text-foreground tracking-[0.04em] uppercase leading-none">
                  Privacy
                </h2>
                <p className="font-body text-xs sm:text-sm text-foreground/65 leading-relaxed mt-2 max-w-md">
                  We use essential cookies and optional analytics to keep Avalon smooth. Read the{' '}
                  <a href="/privacy-policy" className="underline underline-offset-4 font-semibold hover:text-accent transition-colors duration-base ease-editorial">
                    Privacy Policy
                  </a>.
            </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-[220px] shrink-0">
                <motion.button
                  onClick={handleDecline}
                  whileTap={premiumTap}
                  className="px-4 py-3 border border-foreground/20 text-foreground font-body text-[10px] font-semibold uppercase tracking-[0.2em] rounded-full hover:bg-foreground/5 hover:border-foreground/35 transition-all duration-base ease-editorial"
                >
                  Decline
                </motion.button>
                <motion.button
                  onClick={handleAllow}
                  whileTap={premiumTap}
                  className="px-4 py-3 bg-foreground text-background font-body text-[10px] font-semibold uppercase tracking-[0.2em] rounded-full hover:bg-foreground/90 transition-colors duration-base ease-editorial"
                >
                  Allow
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
