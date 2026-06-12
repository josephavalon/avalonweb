import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function CBD() {
  useSeo({
    title: 'CBD IV Review — Avalon Vitality',
    description: 'CBD IV service information is held for clinical and legal approval. Public availability depends on Avalon physician-owned clinical approval and compliance review.',
    path: '/services/cbd',
    robots: 'noindex, nofollow',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'CBD IV Review',
      url: 'https://www.avalonvitality.co/services/cbd',
      description: 'CBD IV service information is held for clinical and legal approval before public indexing.',
    },
  });
  return (
    <div className="av-page-surface min-h-screen text-foreground">
      <Navbar />
      <main className="px-5 pb-16 pt-32 md:px-12 lg:px-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="mt-5 font-heading text-6xl uppercase leading-[0.88] tracking-tight text-foreground md:text-8xl">
            CBD IV Review
          </h1>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
            CBD IV information is held from public indexing until Avalon confirms physician-owned clinical approval, legal review, and compliance-approved copy.
          </p>
          <div className="mt-8 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-5 font-body text-sm leading-relaxed text-amber-100/78">
            No public CBD IV service claims should be used until the service is approved by the clinical entity and counsel. Avalon pages must avoid disease-treatment claims, guaranteed outcomes, or self-directed medication selection.
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/protocols" className="rounded-full border border-foreground/15 px-5 py-3 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:border-foreground/35 hover:text-foreground">
              View approved protocols
            </Link>
            <Link to="/product-disclaimer" className="rounded-full border border-foreground/15 px-5 py-3 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:border-foreground/35 hover:text-foreground">
              Product disclaimer
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
