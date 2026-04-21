import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import IntroSection from '../components/landing/IntroSection';
import HowItWorks from '../components/landing/HowItWorks';
import WhatIsIV from '../components/landing/WhatIsIV';
import OurDrips from '../components/landing/OurDrips';
import MembershipSection from '../components/landing/MembershipSection';
import GiftCertificates from '../components/landing/GiftCertificates';
import Testimonials from '../components/landing/Testimonials';
import FAQ from '../components/landing/FAQ';
import Footer from '../components/landing/Footer';

export default function Home() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <Hero />
      <IntroSection />
      <WhatIsIV />
      <HowItWorks />
      <OurDrips />
      <MembershipSection />
      <GiftCertificates />
      <Testimonials />
      <FAQ />
      <Footer />
    </div>
  );
}