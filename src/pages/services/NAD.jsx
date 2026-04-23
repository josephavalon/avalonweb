import React from 'react';
import ServicePageLayout from '../../components/services/ServicePageLayout';
import { productsByCategory } from '@/data/products';

export default function NAD() {
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
