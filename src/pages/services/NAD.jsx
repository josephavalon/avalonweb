import React from 'react';
import { useSeo } from '@/lib/seo';
import ServicePageLayout from '../../components/services/ServicePageLayout';
import { productsByCategory } from '@/data/products';

export default function NAD() {
  useSeo({
    title: 'NAD+ IV Therapy — Avalon Vitality',
    description: 'Clinician-reviewed NAD+ IV appointments with mobile delivery in San Francisco after clinical approval.',
    path: '/services/nad',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'NAD+ IV Therapy',
      provider: { '@type': 'MedicalBusiness', name: 'Avalon Vitality', url: 'https://www.avalonvitality.co' },
      areaServed: { '@type': 'City', name: 'San Francisco Bay Area' },
      description: 'Clinician-reviewed NAD+ IV appointments with mobile delivery in San Francisco after clinical approval.',
    },
  });
  const cat = productsByCategory.nad;
  return (
    <ServicePageLayout
      title={cat.title}
      subtitle={cat.subtitle}
      badge={cat.badge}
      description={cat.description}
      treatments={cat.treatments}
      heroImage={cat.heroImage}
      categorySlug="nad"
    />
  );
}
