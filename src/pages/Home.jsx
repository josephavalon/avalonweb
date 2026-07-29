import React from 'react';
import { useSeo } from '@/lib/seo';
import Hero from '../components/landing/Hero';

export default function Home() {
  useSeo({
    title: 'Avalon Vitality — Nurse-Delivered IV Therapy',
    description: 'Nurse-delivered IV therapy at your home, hotel, or office across the SF Bay Area.',
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
