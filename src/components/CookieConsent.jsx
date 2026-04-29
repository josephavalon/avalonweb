import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);
  const location = useLocation();
  // Suppress on B2B presale routes — friction-free purchase flow.
  const isB2BRoute = location.pathname.startsWith('/b2b');
  if (isB2BRoute) return null;

  useEffect(() => {
    const consentGiven = localStorage.getItem('cookieConsent');
    if (!consentGiven) {
      setShowConsent(true);
    }
  }, []);

  const handleAllow = () => {
    localStorage.setItem('cookieConsent', 'allowed');
    setShowConsent(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setShowConsent(false);
  };

  return (
    <AnimatePresence>
      {showConsent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="max-w-3xl mx-auto border border-white/20 bg-white/[0.06] backdrop-blur-xl rounded-lg p-8">
            <h2 className="font-heading text-4xl text-foreground mb-4">Your privacy matters</h2>
            <p className="font-body text-base text-foreground leading-relaxed mb-6">
              We use cookies to ensure the website functions properly and to improve your experience. You can accept or decline non-essential cookies. Learn more in our{' '}
              <a href="/privacy" className="underline font-semibold hover:text-accent transition-colors">Privacy Policy</a>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleDecline}
                className="px-8 py-3 border-2 border-foreground text-foreground font-body text-sm font-semibold uppercase tracking-wider rounded-full hover:bg-foreground/5 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAllow}
                className="px-8 py-3 bg-foreground text-background font-body text-sm font-semibold uppercase tracking-wider rounded-full hover:bg-foreground/90 transition-colors"
              >
                Allow
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}