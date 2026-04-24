import React from 'react';
import Navbar from '../components/landing/Navbar';
import FAQ from '../components/landing/FAQ';
import Footer from '../components/landing/Footer';

export default function FAQPage() {
  return (
    <div className="app-shell bg-background min-h-screen w-full" style={{ touchAction: 'pan-y' }}>
      <Navbar />
      <main className="pt-24 md:pt-28">
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
