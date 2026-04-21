import React from 'react';
import ServicePageLayout from '../../components/services/ServicePageLayout';
import CuriositySection from '../../components/landing/CuriositySection';
import NewsletterSignup from '../../components/landing/NewsletterSignup';

const treatments = [
  { name: 'Dehydration', oneTime: '$150', monthly: '$120', annual: '$1,080', desc: '1000ml saline with electrolytes. Rapid rehydration for fatigue, heat exposure, and daily recovery.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: "Myers' Cocktail", oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'The gold standard IV: B-complex, Vitamin C, magnesium, calcium, and zinc.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Event Recovery', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Post-event bounce-back with anti-nausea, anti-inflammatory, and hydration support.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Event Performance', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Pre-event energy and endurance support for performers, athletes, and creators.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Energy', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'B12, B-complex, and amino acids for sustained energy without the crash.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Hangover', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Rapid hangover relief — rehydration, anti-nausea, B vitamins, and glutathione.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Immunity', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'High-dose Vitamin C, zinc, and immune-boosting nutrients to fight illness fast.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Beauty', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Glutathione, biotin, Vitamin C, and collagen support for glowing skin and nails.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Food Poisoning', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Fast relief from food poisoning — anti-nausea, rehydration, and electrolytes.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Migraine', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Magnesium, anti-inflammatory agents, and hydration to break migraine fast.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Jet Lag', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Combat time zone fatigue with melatonin support, B vitamins, and full hydration.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'Flu Relief', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'High-dose Vitamin C, zinc, and anti-nausea for flu symptom relief and recovery.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
];

export default function IVVitamins() {
  return (
    <>
      <ServicePageLayout
        title="IV VITAMINS"
        subtitle="Medical-grade intravenous vitamin therapy"
        description="Every IV is customized and made fresh on-site with medical-grade ingredients — B-complex vitamins, glutathione, magnesium, zinc, and electrolytes. Tailored to your needs, administered by licensed RNs wherever you are."
        treatments={treatments}
        heroImage="https://images.unsplash.com/photo-1579154204601-01d3cc01d8e2?w=1200&q=80"
      />
      <CuriositySection />
      <NewsletterSignup />
    </>
  );
}