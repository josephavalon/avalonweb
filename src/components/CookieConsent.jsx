import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);
  const { pathname: path } = useLocation();
  // Consent banner appears ONLY on the landing page. Every other page
  // (booking, checkout, /plan, /subscription, products, b2b) stays clean.
  const suppressed = path !== '/';

  useEffect(() => {
    if (suppressed) return;
    const consentGiven = localStorage.getItem('cookieConsent');
    if (!consentGiven) {
      const delay = 8000;
      const timer = window.setTimeout(() => setShowConsent(true), delay);
      return () => window.clearTimeout(timer);
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
    <>
      {showConsent ? (
        <div
          className={`fixed left-2 right-2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-reveal sm:left-auto sm:right-3 sm:w-[360px] ${
            path.startsWith('/book')
              ? 'bottom-[calc(env(safe-area-inset-bottom)+5.75rem)]'
              : 'bottom-16 sm:bottom-3'
          }`}
        >
          <div className="ml-auto border border-foreground/10 bg-background/82 backdrop-blur-2xl rounded-[0.9rem] p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.18)] pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <h2 className="font-heading text-lg text-foreground tracking-[0.04em] uppercase leading-none">
                  Privacy
                </h2>
                <p className="font-body text-[9px] text-foreground/58 leading-snug mt-0.5 max-w-[13rem]">
                  Essential only unless allowed.
                </p>
              </div>
              <div className="ml-auto grid grid-cols-2 gap-1.5 shrink-0">
                <button
                  onClick={handleDecline}
                  className="min-h-[34px] px-2.5 py-1 border border-foreground/16 text-foreground/62 font-body text-[8px] font-semibold uppercase tracking-[0.14em] rounded-full hover:bg-foreground/5 hover:border-foreground/30 active:scale-[0.99] transition-all duration-base ease-editorial"
                >
                  No
                </button>
                <button
                  onClick={handleAllow}
                  className="min-h-[34px] px-2.5 py-1 bg-foreground text-background font-body text-[8px] font-semibold uppercase tracking-[0.14em] rounded-full hover:bg-foreground/90 active:scale-[0.99] transition-all duration-base ease-editorial"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
