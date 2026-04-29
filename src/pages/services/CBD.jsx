import React from 'react';
import { useSeo } from '@/lib/seo';
import ServicePageLayout from '../../components/services/ServicePageLayout';
import { productsByCategory } from '@/data/products';

export default function CBD() {
  useSeo({
    title: 'CBD IV Therapy — Avalon Vitality',
    description: 'Zero-THC CBD IV therapy formulas from 33mg to 99mg. Mobile delivery in the SF Bay Area.',
    path: '/services/cbd',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'CBD IV Therapy',
      provider: { '@type': 'MedicalBusiness', name: 'Avalon Vitality', url: 'https://avalonvitality.co' },
      areaServed: { '@type': 'City', name: 'San Francisco Bay Area' },
      description: 'Zero-THC CBD IV therapy formulas from 33mg to 99mg. Mobile delivery in the SF Bay Area.',
    },
  });
  const cat = productsByCategory.cbd;
  return (
    <ServicePageLayout
      title={cat.title}
      subtitle={cat.subtitle}
      badge={cat.badge}
      description={cat.description}
      treatments={cat.treatments}
      heroImage={cat.heroImage}
      categorySlug="cbd"
    />
  );
}
