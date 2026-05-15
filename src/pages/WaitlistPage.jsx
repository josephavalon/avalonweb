import React from 'react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import WaitlistSection from '../components/landing/WaitlistSection';
import { useSeo } from '@/lib/seo';

export default function WaitlistPage() {
  useSeo({
    title: 'Stay in the Loop — Avalon Vitality',
    description: 'Sign up for early access, launch updates, and member exclusives from Avalon Vitality.',
    path: '/newsletter',
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col justify-center pt-32 pb-16">
        <WaitlistSection />
      </main>
      <Footer />
    </div>
  );
}
