import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LockKeyhole, X } from 'lucide-react';

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);
  const [view, setView] = useState('notice');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const { pathname: path } = useLocation();
  // Consent banner appears ONLY on the landing page. Every other page
  // (booking, checkout, /plan, /subscription, products, b2b) stays clean.
  const suppressed = path !== '/';

  useEffect(() => {
    if (suppressed) return;
    const consentGiven = localStorage.getItem('cookieConsent');
    if (!consentGiven) {
      const delay = 1100;
      const timer = window.setTimeout(() => {
        setView('notice');
        setShowConsent(true);
      }, delay);
      return () => window.clearTimeout(timer);
    }
  }, [suppressed]);

  const saveConsent = (value) => {
    localStorage.setItem('cookieConsent', value);
    setShowConsent(false);
    window.dispatchEvent(new CustomEvent('avalon:consentChanged', { detail: { value } }));
  };

  const handleAllow = () => saveConsent('allowed');
  const handleDecline = () => saveConsent('declined');
  const handleSavePreferences = () => saveConsent(analyticsEnabled ? 'allowed' : 'declined');

  if (suppressed) return null;

  return (
    <>
      {showConsent ? (
        <div
          className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[60] animate-in fade-in slide-in-from-bottom-4 duration-reveal sm:left-auto sm:right-5 sm:w-[460px]"
        >
          <aside
            aria-labelledby="cookie-consent-title"
            role="dialog"
            className="pointer-events-auto relative ml-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.4rem] border border-[#d9d2c8] bg-[#f6f2eb] p-5 text-[#2b211b] shadow-[0_18px_56px_rgba(43,33,27,0.14)] sm:p-6"
          >
            <button
              type="button"
              aria-label="Close privacy notice"
              onClick={() => setShowConsent(false)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
            >
              <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </button>

            {view === 'notice' ? (
              <>
                <div className="flex items-start gap-3.5 pr-10">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d9d2c8]">
                    <LockKeyhole className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-[#6e6258]">
                      Privacy
                    </p>
                    <h2 id="cookie-consent-title" className="mt-1 font-body text-[22px] font-semibold leading-[1.2] tracking-[-0.02em]">
                      Your privacy
                    </h2>
                  </div>
                </div>

                <p className="mt-4 font-body text-[13px] font-medium leading-[1.6] text-[#4f453d]">
                  We use essential cookies to keep Avalon secure and working. With your permission,
                  we also use optional analytics cookies to understand site performance and improve
                  your experience. Optional analytics stay off until you choose. You can accept them,
                  reject them, or manage your preference at any time.
                </p>

                <Link
                  to="/cookie-policy"
                  className="mt-2 inline-flex min-h-7 items-center font-body text-[11px] font-semibold text-[#6e6258] underline underline-offset-4 hover:text-[#2b211b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                >
                  Read our cookie policy
                </Link>

                <div className="mt-4 grid gap-2.5">
                  <button
                    type="button"
                    onClick={handleAllow}
                    className="min-h-[46px] rounded-full bg-[#2b211b] px-4 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#fffdf8] transition-colors hover:bg-[#44372f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                  >
                    Accept all
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('preferences')}
                    className="min-h-[46px] rounded-full border border-[#bfb6aa] px-4 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                  >
                    Manage preferences
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    className="min-h-[46px] rounded-full border border-[#bfb6aa] px-4 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                  >
                    Reject all
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="pr-10">
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-[#6e6258]">
                    Privacy
                  </p>
                  <h2 id="cookie-consent-title" className="mt-1 font-body text-[22px] font-semibold leading-[1.2] tracking-[-0.02em]">
                    Manage preferences
                  </h2>
                  <p className="mt-3 font-body text-[13px] font-medium leading-[1.55] text-[#4f453d]">
                    Essential cookies are always active. Choose whether Avalon may also use optional analytics.
                  </p>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-[#d9d2c8] bg-[#faf7f1] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-body text-[13px] font-bold text-[#2b211b]">Essential cookies</p>
                        <p className="mt-1 font-body text-[11px] font-medium leading-[1.45] text-[#6e6258]">
                          Required for security, navigation, and your consent choice.
                        </p>
                      </div>
                      <span className="shrink-0 font-body text-[10px] font-bold uppercase tracking-[0.08em] text-[#6e6258]">
                        Always active
                      </span>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d9d2c8] bg-[#faf7f1] p-4">
                    <input
                      type="checkbox"
                      checked={analyticsEnabled}
                      onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#2b211b]"
                    />
                    <span>
                      <span className="block font-body text-[13px] font-bold text-[#2b211b]">Analytics cookies</span>
                      <span className="mt-1 block font-body text-[11px] font-medium leading-[1.45] text-[#6e6258]">
                        Help us understand aggregate traffic and improve site performance.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setView('notice')}
                    className="min-h-[46px] rounded-full border border-[#bfb6aa] px-4 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    className="min-h-[46px] rounded-full bg-[#2b211b] px-4 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#fffdf8] transition-colors hover:bg-[#44372f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                  >
                    Save preferences
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
