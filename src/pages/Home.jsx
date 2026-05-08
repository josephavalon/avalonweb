// @push 1777082646030 — fix orphan trim
// @rev 1777073683808 — credits model
import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import TrustStrip from '../components/landing/TrustStrip';
import HowItWorks from '../components/landing/HowItWorks';
import WhatIsIV from '../components/landing/WhatIsIV';
import OurDrips from '../components/landing/OurDrips';
import MembershipSection from '../components/landing/MembershipSection';
import HomeFAQ from '../components/landing/HomeFAQ';
import HardCloseCTA from '../components/landing/HardCloseCTA';
// GiftCertificates hidden for presale — Stripe integration deferred post-launch.
// import GiftCertificates from '../components/landing/GiftCertificates';
import EventsSection from '../components/landing/EventsSection';
import Testimonials from '../components/landing/Testimonials';
import WaitlistSection from '../components/landing/WaitlistSection';
import Footer from '../components/landing/Footer';

// Section order — buy-first funnel:
// 1. Hero: category promise
// 2. HowItWorks: clarify the offer in three steps
// 3. OurDrips: Treatments (the menu, the buy)
// 4. MembershipSection: pricing ask
// 5. TrustStrip: operational credentials reassurance after the buy decision
// 6. WhatIsIV: deeper education for considerers
// 7. Testimonials + FAQ: objections handled
// 8. HardCloseCTA + WaitlistSection: secondary capture
// Medical Direction: lives at /medical-direction, linked from Footer.
export default function Home() {
  return (
    <div className="app-shell bg-background min-h-screen w-full" style={{ touchAction: 'pan-y' }}>
      <Navbar />
      <Hero />
      <HowItWorks />
      <OurDrips />
      <MembershipSection />
      <TrustStrip />
      <WhatIsIV />
      <Testimonials />
      <HomeFAQ />
      <HardCloseCTA />
      <WaitlistSection />
      <Footer />
    </div>
  );
}