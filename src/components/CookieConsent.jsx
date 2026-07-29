import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

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
      const delay = 1100;
      const timer = window.setTimeout(() => setShowConsent(true), delay);
      return () => window.clearTimeout(timer);
    }
  }, [suppressed]);

  const handleAllow = () => {
    localStorage.setItem('cookieConsent', 'allowed');
    setShowConsent(false);
    window.dispatchEvent(new CustomEvent('avalon:consentChanged', { detail: { value: 'allowed' } }));
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setShowConsent(false);
    window.dispatchEvent(new CustomEvent('avalon:consentChanged', { detail: { value: 'declined' } }));
  };

  if (suppressed) return null;

  return (
    <>
      {showConsent ? (
        <div
          className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[60] animate-in fade-in slide-in-from-bottom-4 duration-reveal sm:left-auto sm:right-5 sm:w-[430px]"
        >
          <aside
            aria-labelledby="cookie-consent-title"
            className="pointer-events-auto relative ml-auto rounded-[1.4rem] border border-[#d9d2c8] bg-[#f6f2eb] p-5 text-[#2b211b] shadow-[0_18px_56px_rgba(43,33,27,0.14)]"
          >
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d9d2c8]">
                <LockKeyhole className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-[#6e6258]">
                  Privacy
                </p>
                <h2 id="cookie-consent-title" className="mt-1 font-body text-[15px] font-semibold leading-[1.45] tracking-[-0.01em]">
                  Allow optional analytics to help improve Avalon?
                </h2>
                <Link
                  to="/cookie-policy"
                  className="mt-2 inline-flex min-h-7 items-center font-body text-[11px] font-semibold text-[#6e6258] underline underline-offset-4 hover:text-[#2b211b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                >
                  Cookie policy
                </Link>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDecline}
                className="min-h-[46px] rounded-full border border-[#bfb6aa] px-3 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={handleAllow}
                className="min-h-[46px] rounded-full bg-[#2b211b] px-3 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#fffdf8] transition-colors hover:bg-[#44372f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
              >
                Allow analytics
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
