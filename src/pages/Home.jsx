import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import TrustStrip from '../components/landing/TrustStrip';
import IntroSection from '../components/landing/IntroSection';
import HowItWorks from '../components/landing/HowItWorks';
import WhatIsIV from '../components/landing/WhatIsIV';
import OurDrips from '../components/landing/OurDrips';
import MembershipSection from '../components/landing/MembershipSection';
// GiftCertificates hidden for presale — Stripe integration deferred post-launch.
// import GiftCertificates from '../components/landing/GiftCertificates';
import EventsSection from '../components/landing/EventsSection';
import B2BSection from '../components/landing/B2BSection';
import Testimonials from '../components/landing/Testimonials';
import WaitlistSection from '../components/landing/WaitlistSection';
import Footer from '../components/landing/Footer';

// Section order is intentional — read as a VC funnel:
// 1. Hero: category promise
// 2. TrustStrip: operational credentials
// 3. IntroSection: platform thesis + roadmap with dated quarters
// 4. WhatIsIV / HowItWorks / OurDrips: product tour
// 5. MembershipSection: pricing ask
// 6. EventsSection + B2BSection (Partnerships): cultural + channel moats
// 7. Testimonials + FAQ: objections handled
// 8. WaitlistSection: secondary capture with waitlist count as proof
// Medical Direction: now lives at /medical-direction, linked from Footer.
export default function Home() {
  return (
    <div className="app-shell bg-background min-h-screen w-full" style={{ touchAction: 'pan-y' }}>
      <Navbar />
      <Hero />
      <TrustStrip />
      <IntroSection />
      <WhatIsIV />
      <HowItWorks />
      <OurDrips />
      <MembershipSection />
      {/* <GiftCertificates /> — hidden for presale */}
      <EventsSection />
      <B2BSection />
      <Testimonials />
      <WaitlistSection />
      <Footer />
    </div>
  );
}