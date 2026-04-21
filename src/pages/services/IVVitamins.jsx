import React from 'react';
import ServicePageLayout from '../../components/services/ServicePageLayout';

const treatments = [
  { name: 'Dehydration', price: '$150', desc: '1000ml saline with electrolytes. Rapid rehydration for fatigue, heat exposure, and daily recovery.', image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600&q=80' },
  { name: "Myers' Cocktail", price: '$250', desc: 'The gold standard IV: B-complex, Vitamin C, magnesium, calcium, and zinc.', image: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&q=80' },
  { name: 'Event Recovery', price: '$250', desc: 'Post-event bounce-back with anti-nausea, anti-inflammatory, and hydration support.', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80' },
  { name: 'Event Performance', price: '$250', desc: 'Pre-event energy and endurance support for performers, athletes, and creators.', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80' },
  { name: 'Energy', price: '$250', desc: 'B12, B-complex, and amino acids for sustained energy without the crash.', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80' },
  { name: 'Hangover', price: '$250', desc: 'Rapid hangover relief — rehydration, anti-nausea, B vitamins, and glutathione.', image: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=600&q=80' },
  { name: 'Immunity', price: '$250', desc: 'High-dose Vitamin C, zinc, and immune-boosting nutrients to fight illness fast.', image: 'https://images.unsplash.com/photo-1505576399279-0d754c0d8e7e?w=600&q=80' },
  { name: 'Beauty', price: '$250', desc: 'Glutathione, biotin, Vitamin C, and collagen support for glowing skin and nails.', image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80' },
  { name: 'Food Poisoning', price: '$250', desc: 'Fast relief from food poisoning — anti-nausea, rehydration, and electrolytes.', image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80' },
  { name: 'Migraine', price: '$250', desc: 'Magnesium, anti-inflammatory agents, and hydration to break migraine fast.', image: 'https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=600&q=80' },
  { name: 'Jet Lag', price: '$250', desc: 'Combat time zone fatigue with melatonin support, B vitamins, and full hydration.', image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80' },
  { name: 'Flu Relief', price: '$250', desc: 'High-dose Vitamin C, zinc, and anti-nausea for flu symptom relief and recovery.', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' },
];

export default function IVVitamins() {
  return (
    <ServicePageLayout
      title="IV VITAMINS"
      subtitle="Medical-grade intravenous vitamin therapy"
      description="Every IV is customized and made fresh on-site with medical-grade ingredients — B-complex vitamins, glutathione, magnesium, zinc, and electrolytes. Tailored to your needs, administered by licensed RNs wherever you are."
      treatments={treatments}
      heroImage="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1920&q=80"
    />
  );
}