import React from 'react';
import ServicePageLayout from '../../components/services/ServicePageLayout';
import CuriositySection from '../../components/landing/CuriositySection';
import NewsletterSignup from '../../components/landing/NewsletterSignup';
import { productsByCategory } from '@/data/products';

export default function IVVitamins() {
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
