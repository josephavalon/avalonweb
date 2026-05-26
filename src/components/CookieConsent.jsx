import React, { useState, useEffect } from 'react';

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
    <>
      {showConsent ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-4 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-reveal sm:px-5 sm:pb-5">
          <div className="max-w-xl ml-auto mr-auto sm:mr-0 border border-foreground/10 bg-background/88 backdrop-blur-2xl rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/35 pointer-events-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-heading text-2xl sm:text-3xl text-foreground tracking-[0.04em] uppercase leading-none">
                  Privacy
                </h2>
                <p className="font-body text-xs sm:text-sm text-foreground/65 leading-relaxed mt-2 max-w-md">
                  We use essential cookies and optional analytics to keep Avalon smooth. Read the{' '}
                  <a href="/privacy-policy" className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4 transition-colors duration-base ease-editorial hover:text-accent">
                    Privacy Policy
                  </a>.
            </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-[220px] shrink-0">
                <button
                  onClick={handleDecline}
                  className="px-4 py-3 border border-foreground/20 text-foreground font-body text-[10px] font-semibold uppercase tracking-[0.2em] rounded-full hover:bg-foreground/5 hover:border-foreground/35 active:scale-[0.99] transition-all duration-base ease-editorial"
                >
                  Decline
                </button>
                <button
                  onClick={handleAllow}
                  className="px-4 py-3 bg-foreground text-background font-body text-[10px] font-semibold uppercase tracking-[0.2em] rounded-full hover:bg-foreground/90 active:scale-[0.99] transition-all duration-base ease-editorial"
                >
                  Allow
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
