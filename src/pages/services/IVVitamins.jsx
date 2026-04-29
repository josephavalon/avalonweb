import React from 'react';
import { useSeo } from '@/lib/seo';
import ServicePageLayout from '../../components/services/ServicePageLayout';
import CuriositySection from '../../components/landing/CuriositySection';
import NewsletterSignup from '../../components/landing/NewsletterSignup';
import { productsByCategory } from '@/data/products';

export default function IVVitamins() {
  useSeo({
    title: 'IV Vitamins — Avalon Vitality',
    description: 'IV vitamin therapy formulas in the SF Bay Area — Myers, Recovery, Athletic, Glow, Immunity. RN-administered, MD-supervised.',
    path: '/services/iv-vitamins',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'IV Vitamins',
      provider: { '@type': 'MedicalBusiness', name: 'Avalon Vitality', url: 'https://avalonvitality.co' },
      areaServed: { '@type': 'City', name: 'San Francisco Bay Area' },
      description: 'IV vitamin therapy formulas in the SF Bay Area — Myers, Recovery, Athletic, Glow, Immunity. RN-administered, MD-supervised.',
    },
  });
  const cat = productsByCategory['iv-vitamins'];
  return (
    <>
      <ServicePageLayout
        title={cat.title}
        subtitle={cat.subtitle}
        description={cat.description}
        treatments={cat.treatments}
        heroImage={cat.heroImage}
        heroImgClassName={cat.heroImgClassName}
        categorySlug="iv-vitamins"
      />
      <CuriositySection />
      <NewsletterSignup />
    </>
  );
}
