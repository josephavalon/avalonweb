import React, { useMemo } from 'react';
import { useSeo } from '@/lib/seo';
import Navbar from '../components/landing/Navbar';
import FAQ from '../components/landing/FAQ';
import Footer from '../components/landing/Footer';

export default function FAQPage() {
  useSeo({
    title: 'FAQ — Avalon Vitality',
    description: 'Common questions about Avalon Vitality\'s mobile IV therapy in the San Francisco Bay Area.',
    path: '/faq',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Avalon Vitality?',
          acceptedAnswer: { '@type': 'Answer', text: 'Avalon Vitality is a mobile IV therapy and longevity service serving the San Francisco Bay Area. RN-administered, MD-supervised.' },
        },
        {
          '@type': 'Question',
          name: 'Is Avalon safe for everyone?',
          acceptedAnswer: { '@type': 'Answer', text: 'Avalon is safe for most people, but not suitable for those with certain medical conditions. Consult our clinical team.' },
        },
        {
          '@type': 'Question',
          name: 'Do you accept insurance?',
          acceptedAnswer: { '@type': 'Answer', text: 'No. Avalon is a private-pay concierge service. We do not bill insurance.' },
        },
      ],
    },
  });

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
