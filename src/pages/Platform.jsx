import React from 'react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import AvalonOSPreview from '../components/landing/AvalonOSPreview';
import { useSeo } from '@/lib/seo';

export default function Platform() {
  useSeo({
    title: 'Avalon OS — The Platform',
    description: 'Avalon OS is the operating system for human performance. Coming soon to iOS and Android. The intelligent layer behind every Avalon protocol.',
    path: '/platform',
  });
  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 md:pt-28">
        <AvalonOSPreview />
      </main>
      <Footer />
    </div>
  );
}
