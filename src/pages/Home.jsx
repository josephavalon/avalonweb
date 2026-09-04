import React from 'react';
import { useSeo } from '@/lib/seo';
import Hero from '../components/landing/Hero';
import HomepageV2 from '../components/landing/HomepageV2';

export default function Home() {
  useSeo({
    title: 'Mobile Wellness Therapy in the SF Bay Area | Avalon Vitality',
    description: 'IV therapy delivered to your home, hotel, or office by registered nurses. Physician reviewed. Daily 8AM to 8PM across the Bay Area.',
    path: '/',
  });

  return (
    <div className="nd-home">
      <main id="home-main">
        <Hero
          showTail={false}
          showPress
          enhanced
        />
        <HomepageV2 />
      </main>
    </div>
  );
}
