// @push 1777082646030 — fix orphan trim
// @rev 1777073683808 — credits model
import React, { lazy, Suspense } from 'react';
import { useSeo } from '@/lib/seo';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import StickyBookBar from '../components/landing/StickyBookBar';

const HowItWorks = lazy(() => import('../components/landing/HowItWorks'));
const TreatmentsTeaser = lazy(() => import('../components/landing/TreatmentsTeaser'));
const MembershipSection = lazy(() => import('../components/landing/MembershipSection'));
const Reviews = lazy(() => import('../components/landing/Reviews'));
const ChannelCards = lazy(() => import('../components/landing/ChannelCards'));
const Footer = lazy(() => import('../components/landing/Footer'));

// Section order — conversion funnel:
// 1. Hero: promise + social proof + dual CTA  (ATF — fills 100svh)
// 2. HowItWorks: remove friction, explain the service
// 3. TreatmentsTeaser: product tour with pricing
// 4. MembershipSection: subscription pricing ask
// 5. Reviews: earned trust
// 6. ChannelCards: corporate / events / hotel pathways
//
// Note: Reveal wrappers removed — each section owns its per-card whileInView
// animations. Stacking Reveal (opacity 0→1) on top of per-card (opacity 0→1)
// produces opacity multiplication (t²) which creates the visible flash highlight.
export default function Home() {
  useSeo({
    title: 'Avalon Vitality — Mobile Recovery Therapy',
    description: 'Avalon Vitality is a premium recovery platform for clinician-reviewed protocols across hydration, recovery, performance, longevity, launches, and mobile appointments.',
    path: '/',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent">
      <Navbar />

      {/* ── ATF — fills viewport ── */}
      <Hero />

      {/* ── Below fold — per-card whileInView animations handle entrance ── */}
      <div className="relative z-10">
        <Suspense fallback={null}>
          <HowItWorks />
          <TreatmentsTeaser />
          <MembershipSection />
          <Reviews />
          <ChannelCards />
        </Suspense>
      </div>
      <StickyBookBar />

      <div className="pb-24 md:pb-0">
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    </div>
  );
}
