import React from 'react';
import { useSeo } from '@/lib/seo';
import Hero from '../components/landing/Hero';

export default function Home() {
  useSeo({
    title: 'Avalon Vitality — Wellness Delivered.',
    description: 'IV therapies and more. Delivered to your home, hotel, or office by registered nurses across the SF Bay Area.',
    path: '/',
  });

  return (
    <div className="nd-home">
      <main id="home-main">
        <Hero />
      </main>
    </div>
  );
}
