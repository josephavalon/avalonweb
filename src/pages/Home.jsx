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

// Note: Reveal wrappers removed — each section owns its per-card whileInView
// animations. Stacking Reveal (opacity 0→1) on top of per-card (opacity 0→1)
// produces opacity multiplication (t²) which creates the visible flash highlight.
export default function Home() {
  useSeo({
    title: 'Avalon Vitality — Mobile IV Therapy in the SF Bay Area',
    description: 'Avalon Vitality delivers mobile IV therapy at home, hotel, office, or event with registered nurses, clinical review, and fast SF Bay Area booking.',
    path: '/',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent">
      <header>
        <Navbar />
      </header>

      {/* ── ATF — fills viewport ── */}
      <main>
        <Hero />

        {/* ── Below fold — per-card whileInView animations handle entrance ── */}
        <div className="relative z-10">
          <Suspense fallback={null}>
            <HowItWorks />
            <TreatmentsTeaser />
            <MembershipSection />
          </Suspense>
        </div>
      </main>
      <div className="pb-24 md:pb-0">
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    </div>
  );
}
