import React from 'react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import B2BSection from '../components/landing/B2BSection';
import { useSeo } from '@/lib/seo';

export default function Partners() {
  useSeo({
    title: 'Partnerships — Avalon Vitality',
    description: 'Avalon Vitality partners with companies, festivals, hotels, and music venues. We don\'t plug in — we integrate.',
    path: '/partners',
  });
  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 md:pt-28">
        <B2BSection />
      </main>
      <Footer />
    </div>
  );
}
