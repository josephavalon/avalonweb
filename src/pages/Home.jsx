// @push 1777082646030 — fix orphan trim
// @rev 1777073683808 — credits model
import React, { lazy, Suspense } from 'react';
import { useSeo } from '@/lib/seo';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';

const HowItWorks = lazy(() => import('../components/landing/HowItWorks'));
const TreatmentsTeaser = lazy(() => import('../components/landing/TreatmentsTeaser'));
const MembershipSection = lazy(() => import('../components/landing/MembershipSection'));
const Footer = lazy(() => import('../components/landing/Footer'));

const MOBILE_SCROLL_PANELS = [
  { key: 'hero', label: 'hero' },
  { key: 'how-it-works', label: 'how-it-works' },
  { key: 'treatments', label: 'treatments' },
  { key: 'subscription', label: 'subscription' },
  { key: 'footer', label: 'footer' },
];

function MobileScrollPanel({ name, children }) {
  return (
    <div className="mobile-scroll-panel" data-mobile-scroll-panel={name}>
      <div className="mobile-scroll-panel__inner">
        {children}
      </div>
    </div>
  );
}

function useMobileScrollFocus() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia('(max-width: 767px)');
    let observer;
    let mutationObserver;

    const setActive = () => {
      const panels = Array.from(document.querySelectorAll('[data-mobile-scroll-panel]'));
      if (!media.matches || panels.length === 0) {
        panels.forEach((panel) => panel.classList.remove('is-mobile-scroll-active'));
        return;
      }

      const focusLine = window.innerHeight * 0.5;
      let activePanel = panels[0];
      let activeDistance = Number.POSITIVE_INFINITY;
      panels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - focusLine);
        if (distance < activeDistance) {
          activeDistance = distance;
          activePanel = panel;
        }
      });

      panels.forEach((panel) => {
        panel.classList.toggle('is-mobile-scroll-active', panel === activePanel);
      });
    };

    const startObserver = () => {
      const panels = Array.from(document.querySelectorAll('[data-mobile-scroll-panel]'));
      observer?.disconnect();
      document.documentElement.classList.toggle('avalon-mobile-scroll-home', media.matches);
      if (!media.matches || panels.length === 0) {
        setActive();
        return;
      }

      observer = new IntersectionObserver(setActive, {
        root: null,
        threshold: [0.15, 0.35, 0.5, 0.65, 0.85],
      });
      panels.forEach((panel) => observer.observe(panel));
      setActive();
    };

    startObserver();
    const stage = document.querySelector('.mobile-scroll-stage');
    mutationObserver = new MutationObserver(startObserver);
    if (stage) {
      mutationObserver.observe(stage, { childList: true, subtree: true });
    }
    window.addEventListener('scroll', setActive, { passive: true });
    window.addEventListener('resize', startObserver);
    media.addEventListener?.('change', startObserver);

    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
      document.documentElement.classList.remove('avalon-mobile-scroll-home');
      window.removeEventListener('scroll', setActive);
      window.removeEventListener('resize', startObserver);
      media.removeEventListener?.('change', startObserver);
    };
  }, []);
}

// Note: Reveal wrappers removed — each section owns its per-card whileInView
// animations. Stacking Reveal (opacity 0→1) on top of per-card (opacity 0→1)
// produces opacity multiplication (t²) which creates the visible flash highlight.
export default function Home() {
  useMobileScrollFocus();

  useSeo({
    title: 'Avalon Vitality — Mobile Recovery Therapy',
    description: 'Avalon Vitality is a premium recovery platform for clinician-reviewed protocols across hydration, recovery, performance, longevity, launches, and mobile appointments.',
    path: '/',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent">
      <Navbar />

      {/* ── ATF — fills viewport ── */}
      <div className="mobile-scroll-stage">
        <MobileScrollPanel name={MOBILE_SCROLL_PANELS[0].label}>
          <Hero />
        </MobileScrollPanel>

        {/* ── Below fold — per-card whileInView animations handle entrance ── */}
        <Suspense fallback={null}>
          <MobileScrollPanel name={MOBILE_SCROLL_PANELS[1].label}>
            <HowItWorks />
          </MobileScrollPanel>
          <MobileScrollPanel name={MOBILE_SCROLL_PANELS[2].label}>
            <TreatmentsTeaser />
          </MobileScrollPanel>
          <MobileScrollPanel name={MOBILE_SCROLL_PANELS[3].label}>
            <MembershipSection />
          </MobileScrollPanel>
        </Suspense>
        <Suspense fallback={null}>
          <MobileScrollPanel name={MOBILE_SCROLL_PANELS[4].label}>
            <Footer />
          </MobileScrollPanel>
        </Suspense>
      </div>
    </div>
  );
}
