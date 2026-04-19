import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import IntroSection from '../components/landing/IntroSection';
import WhatAreIVs from '../components/landing/WhatAreIVs';
import WhyIVTherapy from '../components/landing/WhyIVTherapy';
import HowItWorks from '../components/landing/HowItWorks';
import Membership from '../components/landing/Membership';
import OurDrips from '../components/landing/OurDrips';
import Testimonials from '../components/landing/Testimonials';
import FAQ from '../components/landing/FAQ';
import Footer from '../components/landing/Footer';

export default function Home() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <Hero />
      <IntroSection />
      <WhatAreIVs />
      <WhyIVTherapy />
      <HowItWorks />
      <OurDrips />
      <Membership />
      <Testimonials />
      <FAQ />
      <Footer />
    </div>
  );
}