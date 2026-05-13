// @push 1777082646030 — fix orphan trim
// @rev 1777073683808 — credits model
import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import TrustStrip from '../components/landing/TrustStrip';
import HowItWorks from '../components/landing/HowItWorks';
import WhatIsIV from '../components/landing/WhatIsIV';
import TreatmentsTeaser from '../components/landing/TreatmentsTeaser';
import MembershipSection from '../components/landing/MembershipSection';
import HomeFAQ from '../components/landing/HomeFAQ';
import EventsSection from '../components/landing/EventsSection';
import WaitlistSection from '../components/landing/WaitlistSection';
import Footer from '../components/landing/Footer';
import Reviews from '../components/landing/Reviews';
import ChannelCards from '../components/landing/ChannelCards';
import { Reveal } from '../components/ui/Reveal';

// Section order — conversion funnel:
// 1. Hero: promise + social proof + dual CTA  (ATF — no reveal, fills 100svh)
// 2. TrustStrip: operational credentials ticker
// 3. HowItWorks: remove friction, explain the service
// 4. TreatmentsTeaser: product tour with pricing
// 5. MembershipSection: pricing ask
// 6. ChannelCards: corporate / events / hotel pathways
// 7. Reviews: earned trust
// 8. WhatIsIV: education for skeptics
// 9. EventsSection: cultural proof
// 10. HomeFAQ: objection handling
// 11. WaitlistSection: secondary capture
export default function Home() {
  return (
    <div className="app-shell bg-background min-h-screen w-full">
      <Navbar />

      {/* ── ATF — fills viewport, no reveal needed ── */}
      <Hero />

      {/* ── Below fold — each section materialises on scroll ── */}
      <Reveal delay={0}    duration={0.7} y={40} scale={0.98} blur={false}>
        <TrustStrip />
      </Reveal>

      <Reveal delay={0}    duration={0.85} blur={false}>
        <HowItWorks />
      </Reveal>

      <Reveal delay={0}    duration={0.85} blur={false}>
        <TreatmentsTeaser />
      </Reveal>

      <Reveal delay={0}    duration={0.9} blur={false}>
        <MembershipSection />
      </Reveal>

      <Reveal delay={0}    duration={0.85}>
        <ChannelCards />
      </Reveal>

      <Reveal delay={0}    duration={0.85}>
        <Reviews />
      </Reveal>

      <Reveal delay={0}    duration={0.85}>
        <WhatIsIV />
      </Reveal>

      <Reveal delay={0} duration={0.8}>
      </Reveal>

      <Reveal delay={0}    duration={0.8}>
        <HomeFAQ />
      </Reveal>

      <Reveal delay={0}    duration={0.8}>
        <WaitlistSection />
      </Reveal>

      <Reveal delay={0}    duration={0.75} y={32} scale={0.99} blur={false}>
        <div className="pb-24 md:pb-0">
          <Footer />
        </div>
      </Reveal>
    </div>
  );
}
