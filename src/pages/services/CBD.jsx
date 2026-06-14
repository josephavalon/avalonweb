import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function CBD() {
  useSeo({
    title: 'CBD IV Therapy — Avalon Vitality',
    description: 'Clinician-reviewed CBD IV therapy options from Avalon Vitality. Eligibility and dosing are confirmed before treatment.',
    path: '/services/cbd',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'CBD IV Therapy',
      url: 'https://www.avalonvitality.co/services/cbd',
      description: 'Clinician-reviewed CBD IV therapy options with eligibility confirmed before treatment.',
    },
  });
  return (
    <div className="av-page-surface min-h-screen text-foreground">
      <Navbar />
      <main className="px-5 pb-16 pt-32 md:px-12 lg:px-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="mt-5 font-heading text-6xl uppercase leading-[0.88] tracking-tight text-foreground md:text-8xl">
            CBD IV Therapy
          </h1>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
            CBD IV appointments are clinician-reviewed wellness visits. Avalon confirms eligibility, dose, and timing before treatment.
          </p>
          <div className="mt-8 rounded-2xl border border-foreground/15 bg-foreground/[0.045] p-5 font-body text-sm leading-relaxed text-foreground/68">
            This service does not diagnose, treat, cure, or prevent disease. Final protocol eligibility is determined through intake and clinical review before registered nurse dispatch.
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/protocols" className="rounded-full border border-foreground/15 px-5 py-3 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:border-foreground/35 hover:text-foreground">
              View protocols
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
