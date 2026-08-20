import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Link2, ShieldCheck, X } from 'lucide-react';

import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { isPublicChromeRoute } from '@/lib/publicChrome';

const CONSENT_KEY = 'cookieConsent';
const NOTICE_DELAY_MS = 800;
const ROOT_OFFSET_PROPERTY = '--av-cookie-banner-offset';
const ROOT_HEIGHT_PROPERTY = '--av-cookie-banner-height';

function readStoredConsent() {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'allowed' || value === 'declined' ? value : null;
  } catch {
    return null;
  }
}

function writeStoredConsent(value) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);
  const [storedConsent, setStoredConsent] = useState(undefined);
  const [view, setView] = useState('notice');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const bannerRef = useRef(null);
  const compactTitleRef = useRef(null);
  const { pathname } = useLocation();
  const suppressed = !isPublicChromeRoute(pathname);

  useEffect(() => {
    if (suppressed) {
      setShowConsent(false);
      setStoredConsent(undefined);
      setPreferencesOpen(false);
      setView('notice');
      return undefined;
    }

    const consent = readStoredConsent();
    setStoredConsent(consent);
    setAnalyticsEnabled(consent === 'allowed');

    if (consent) return undefined;

    const timer = window.setTimeout(() => {
      setView('notice');
      setAnalyticsEnabled(false);
      setShowConsent(true);
    }, NOTICE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [suppressed]);

  useEffect(() => {
    const root = document.documentElement;
    const banner = bannerRef.current;

    if (!showConsent || suppressed || !banner) {
      delete root.dataset.avCookieNotice;
      root.style.removeProperty(ROOT_OFFSET_PROPERTY);
      root.style.removeProperty(ROOT_HEIGHT_PROPERTY);
      return undefined;
    }

    const syncOffset = () => {
      const height = Math.ceil(banner.getBoundingClientRect().height);
      root.dataset.avCookieNotice = 'visible';
      root.style.setProperty(ROOT_HEIGHT_PROPERTY, `${height}px`);
      root.style.setProperty(ROOT_OFFSET_PROPERTY, `${height + 32}px`);
    };

    syncOffset();
    window.addEventListener('resize', syncOffset, { passive: true });

    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(syncOffset)
      : null;
    observer?.observe(banner);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncOffset);
      delete root.dataset.avCookieNotice;
      root.style.removeProperty(ROOT_OFFSET_PROPERTY);
      root.style.removeProperty(ROOT_HEIGHT_PROPERTY);
    };
  }, [showConsent, suppressed, view]);

  const saveConsent = (value) => {
    writeStoredConsent(value);
    setStoredConsent(value);
    setAnalyticsEnabled(value === 'allowed');
    setShowConsent(false);
    setPreferencesOpen(false);
    setView('notice');
    window.dispatchEvent(new CustomEvent('avalon:consentChanged', { detail: { value } }));
  };

  const handleSavePreferences = () => {
    saveConsent(analyticsEnabled ? 'allowed' : 'declined');
  };

  const handlePreferencesOpenChange = (open) => {
    setPreferencesOpen(open);
    if (open) setAnalyticsEnabled(storedConsent === 'allowed');
  };

  if (suppressed) return null;

  if (!showConsent && storedConsent) {
    return (
      <div
        className="av-cookie-control pointer-events-none fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-4 z-[80] sm:left-5"
        data-testid="cookie-preferences-control"
      >
        <Popover open={preferencesOpen} onOpenChange={handlePreferencesOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open cookie preferences"
              className="pointer-events-auto grid h-[52px] w-[52px] place-items-center rounded-full border border-[#4a3b32] bg-[#2b211b] text-[#fffdf8] shadow-[0_10px_28px_rgba(43,33,27,0.28)] transition-[transform,background-color] duration-200 hover:scale-[1.03] hover:bg-[#382b24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2b211b] active:scale-95"
            >
              <Link2 className="h-[25px] w-[25px] -rotate-45" strokeWidth={2.1} aria-hidden="true" />
            </button>
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="start"
            sideOffset={12}
            collisionPadding={16}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              compactTitleRef.current?.focus();
            }}
            aria-labelledby="compact-cookie-title"
            className="av-cookie-preferences-popover pointer-events-auto !w-[min(19.5rem,calc(100vw-2.5rem))] !overflow-hidden !rounded-[17px] !border-[#4a3b32] !p-0 !text-[#fffdf8] !shadow-[0_24px_70px_rgba(43,33,27,0.34)] sm:!w-[min(22rem,calc(100vw-2rem))] sm:!rounded-[20px]"
            style={{ background: '#2b211b', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            <div className="relative z-[1]">
              <header className="flex min-h-12 items-center justify-between border-b border-[#5b4b41] px-4 sm:min-h-14 sm:px-5">
                <div>
                  <p className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-[#cfc6bb]">Privacy</p>
                  <h2
                    ref={compactTitleRef}
                    id="compact-cookie-title"
                    tabIndex={-1}
                    className="mt-0.5 font-body text-[15px] font-semibold leading-tight text-[#fffdf8] outline-none sm:text-base"
                  >
                    Cookie preferences
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPreferencesOpen(false)}
                  aria-label="Close cookie preferences"
                  className="grid h-8 w-8 place-items-center rounded-full text-[#d9d2c8] transition-colors hover:bg-[#382b24] hover:text-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6f2eb] sm:h-9 sm:w-9"
                >
                  <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </button>
              </header>

              <div className="space-y-2.5 px-4 py-3 sm:space-y-3.5 sm:px-5 sm:py-4">
                <p className="font-body text-[11px] font-medium leading-relaxed text-[#d9d2c8] sm:text-xs">
                  Essential cookies keep Avalon secure. Choose whether to allow anonymous analytics.
                </p>

                <div className="overflow-hidden rounded-[12px] border border-[#5b4b41] bg-[#382b24] sm:rounded-[14px]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#5b4b41] px-3 py-2.5 sm:gap-4 sm:px-3.5 sm:py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-[#f6f2eb] sm:h-[18px] sm:w-[18px]" strokeWidth={1.9} aria-hidden="true" />
                      <span>
                        <span className="block font-body text-xs font-semibold text-[#fffdf8] sm:text-[13px]">Essential</span>
                        <span className="block font-body text-[9px] font-medium text-[#cfc6bb] sm:text-[10px]">Security and core site functions</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-body text-[8px] font-bold uppercase tracking-[0.08em] text-[#cfc6bb] sm:text-[9px]">Always on</span>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 sm:gap-4 sm:px-3.5 sm:py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <BarChart3 className="h-4 w-4 shrink-0 text-[#f6f2eb] sm:h-[18px] sm:w-[18px]" strokeWidth={1.9} aria-hidden="true" />
                      <span>
                        <span className="block font-body text-xs font-semibold text-[#fffdf8] sm:text-[13px]">Analytics</span>
                        <span className="block font-body text-[9px] font-medium text-[#cfc6bb] sm:text-[10px]">Anonymous site performance</span>
                      </span>
                    </span>
                    <span className="relative inline-flex shrink-0">
                      <input
                        type="checkbox"
                        checked={analyticsEnabled}
                        onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="h-6 w-10 rounded-full border border-[#817267] bg-[#211914] transition-colors peer-checked:border-[#f6f2eb] peer-checked:bg-[#f6f2eb] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#f6f2eb]" />
                      <span className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-[#fffdf8] shadow-sm transition-transform peer-checked:translate-x-4 peer-checked:bg-[#2b211b]" />
                    </span>
                  </label>
                </div>

                <Link
                  to="/cookie-policy"
                  onClick={() => setPreferencesOpen(false)}
                  className="inline-flex min-h-6 items-center font-body text-[10px] font-semibold text-[#d9d2c8] underline decoration-[#d9d2c8]/50 underline-offset-4 transition-colors hover:text-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6f2eb] sm:text-[11px]"
                >
                  Read our cookie policy
                </Link>
              </div>

              <footer className="grid grid-cols-[0.9fr_1.1fr] gap-2 border-t border-[#5b4b41] px-4 py-3 sm:gap-2.5 sm:px-5 sm:py-4">
                <button
                  type="button"
                  onClick={() => saveConsent('declined')}
                  className="min-h-10 rounded-full border border-[#817267] px-3 font-body text-[10px] font-bold uppercase tracking-[0.07em] text-[#fffdf8] transition-colors hover:bg-[#382b24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6f2eb]"
                >
                  Essential only
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="min-h-10 rounded-full bg-[#f6f2eb] px-3 font-body text-[10px] font-bold uppercase tracking-[0.07em] text-[#2b211b] transition-colors hover:bg-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6f2eb]"
                >
                  Save preferences
                </button>
              </footer>
            </div>
            <PopoverArrow className="fill-[#2b211b]" height={10} width={18} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (!showConsent) return null;

  return (
    <div
      ref={bannerRef}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] animate-in fade-in slide-in-from-bottom-4 duration-reveal"
      data-testid="cookie-consent-bar"
    >
      <aside
        aria-labelledby="cookie-consent-title"
        role="region"
        className="pointer-events-auto max-h-[100dvh] overflow-y-auto border-x-0 border-b-0 border-t border-[#44372f] bg-[#2b211b] pb-[env(safe-area-inset-bottom)] text-[#fffdf8] shadow-[0_-16px_60px_rgba(43,33,27,0.22)]"
      >
        {view === 'notice' ? (
          <div className="grid items-center gap-3 px-5 py-3 sm:px-7 md:flex md:min-h-9 md:justify-between md:gap-7 md:px-10 md:py-0 lg:px-[5vw]">
            <div className="md:flex md:items-center md:gap-5">
              <h2 id="cookie-consent-title" className="font-body text-[15px] font-medium leading-relaxed text-[#fffdf8] sm:text-base md:text-xs md:leading-tight">
                We use essential cookies to keep Avalon secure and working.
              </h2>
              <button
                type="button"
                onClick={() => setView('preferences')}
                className="mt-0.5 inline-flex min-h-6 items-center font-body text-[13px] font-semibold text-[#d9d2c8] underline decoration-[#d9d2c8]/55 underline-offset-4 transition-colors hover:text-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f6f2eb] sm:text-sm md:mt-0 md:min-h-0 md:text-xs"
              >
                Manage cookie preferences
              </button>
            </div>

            <button
              type="button"
              onClick={() => saveConsent('declined')}
              className="min-h-10 w-full rounded-full bg-[#f6f2eb] px-8 font-body text-sm font-bold uppercase tracking-[0.08em] text-[#2b211b] transition-colors hover:bg-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f6f2eb] md:min-h-7 md:w-auto md:min-w-[6rem] md:px-6 md:text-xs"
            >
              OK
            </button>
          </div>
        ) : (
          <div className="grid gap-5 px-5 py-5 sm:px-7 md:px-10 md:py-6 lg:grid-cols-[minmax(15rem,0.85fr)_minmax(22rem,1.35fr)_auto] lg:items-center lg:gap-7 lg:px-[5vw]">
            <div>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9d2c8]">Privacy</p>
              <h2 id="cookie-consent-title" className="mt-1 font-body text-xl font-semibold leading-tight text-[#fffdf8]">
                Manage preferences
              </h2>
              <p className="mt-2 max-w-md font-body text-xs font-medium leading-relaxed text-[#d9d2c8]">
                Essential cookies are always active. Optional analytics stay off unless you enable them.
              </p>
              <Link
                to="/cookie-policy"
                className="mt-2 inline-flex min-h-7 items-center font-body text-xs font-semibold text-[#fffdf8] underline decoration-[#d9d2c8]/55 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f6f2eb]"
              >
                Read our cookie policy
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#6e6258] bg-[#382b24] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-body text-sm font-bold text-[#fffdf8]">Essential cookies</p>
                    <p className="mt-1 font-body text-xs font-medium leading-relaxed text-[#d9d2c8]">
                      Security, navigation, and your consent choice.
                    </p>
                  </div>
                  <span className="shrink-0 font-body text-[9px] font-bold uppercase tracking-[0.08em] text-[#d9d2c8]">
                    Always active
                  </span>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#6e6258] bg-[#382b24] p-4">
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#f6f2eb]"
                />
                <span>
                  <span className="block font-body text-sm font-bold text-[#fffdf8]">Analytics cookies</span>
                  <span className="mt-1 block font-body text-xs font-medium leading-relaxed text-[#d9d2c8]">
                    Aggregate traffic and site performance.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:min-w-[15rem]">
              <button
                type="button"
                onClick={() => setView('notice')}
                className="min-h-12 rounded-full border border-[#8b7d72] px-5 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#fffdf8] transition-colors hover:bg-[#382b24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f6f2eb]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSavePreferences}
                className="min-h-12 rounded-full bg-[#f6f2eb] px-5 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-[#2b211b] transition-colors hover:bg-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f6f2eb]"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
