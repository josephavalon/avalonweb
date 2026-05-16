// @push 1777082646030 — fix orphan trim
// @rev 1777073683808 — credits model
import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import HowItWorks from '../components/landing/HowItWorks';
import WhatIsIV from '../components/landing/WhatIsIV';
import TreatmentsTeaser from '../components/landing/TreatmentsTeaser';
import MembershipSection from '../components/landing/MembershipSection';
import WaitlistSection from '../components/landing/WaitlistSection';
import Footer from '../components/landing/Footer';
import Reviews from '../components/landing/Reviews';
import ChannelCards from '../components/landing/ChannelCards';

// Section order — conversion funnel:
// 1. Hero: promise + social proof + dual CTA  (ATF — fills 100svh)
// 2. HowItWorks: remove friction, explain the service
// 3. MembershipSection: pricing ask
// 4. TreatmentsTeaser: product tour with pricing
// 5. ChannelCards: corporate / events / hotel pathways
// 6. Reviews: earned trust
// 7. WhatIsIV: education for skeptics
// 8. WaitlistSection: secondary capture
//
// Note: Reveal wrappers removed — each section owns its per-card whileInView
// animations. Stacking Reveal (opacity 0→1) on top of per-card (opacity 0→1)
// produces opacity multiplication (t²) which creates the visible flash highlight.
export default function Home() {
  return (
    <div className="app-shell bg-background min-h-screen w-full">
      <Navbar />

      {/* ── ATF — fills viewport ── */}
      <Hero />

      {/* ── Below fold — per-card whileInView animations handle entrance ── */}
      <HowItWorks />
      <MembershipSection />
      <TreatmentsTeaser />
      <ChannelCards />
      <Reviews />
      <WhatIsIV />
      <WaitlistSection />

      <div className="pb-24 md:pb-0">
        <Footer />
      </div>
    </div>
  );
}
