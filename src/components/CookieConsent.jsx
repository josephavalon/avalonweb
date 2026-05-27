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
        <div className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-2 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-reveal sm:px-3 sm:pb-3">
          <div className="max-w-md ml-auto mr-auto sm:mr-0 border border-foreground/10 bg-background/88 backdrop-blur-2xl rounded-[1rem] p-2.5 sm:p-3 shadow-[0_-12px_36px_rgba(0,0,0,0.24)] pointer-events-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-heading text-xl sm:text-2xl text-foreground tracking-[0.04em] uppercase leading-none">
                  Privacy
                </h2>
                <p className="font-body text-[10px] sm:text-[11px] text-foreground/65 leading-snug mt-1 max-w-sm">
                  Essential cookies keep Avalon running. Analytics are optional.{' '}
                  <a href="/privacy-policy" className="inline-flex min-h-10 items-center font-semibold underline underline-offset-4 transition-colors duration-base ease-editorial hover:text-accent">
                    Privacy Policy
                  </a>.
            </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:w-[176px] shrink-0">
                <button
                  onClick={handleDecline}
                  className="min-h-[40px] px-2.5 py-1.5 border border-foreground/20 text-foreground font-body text-[8px] font-semibold uppercase tracking-[0.16em] rounded-full hover:bg-foreground/5 hover:border-foreground/35 active:scale-[0.99] transition-all duration-base ease-editorial"
                >
                  Decline
                </button>
                <button
                  onClick={handleAllow}
                  className="min-h-[40px] px-2.5 py-1.5 bg-foreground text-background font-body text-[8px] font-semibold uppercase tracking-[0.16em] rounded-full hover:bg-foreground/90 active:scale-[0.99] transition-all duration-base ease-editorial"
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
