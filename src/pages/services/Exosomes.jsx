import React from 'react';
import ServicePageLayout from '../../components/services/ServicePageLayout';

const treatments = [
  {
    name: 'Exosomes 30B IV',
    price: '$700',
    desc: '30 billion exosomes. Entry-level cellular support for tissue repair, inflammation reduction, and regenerative health.',
    image: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&q=80',
  },
  {
    name: 'Exosomes 50B IV',
    price: '$1,200',
    desc: '50 billion exosomes. Mid-range cellular regeneration for deeper tissue repair and systemic anti-inflammatory response.',
    image: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&q=80',
  },
  {
    name: 'Exosomes 90B IV',
    price: '$1,800',
    desc: '90 billion exosomes. Maximum-dose cellular support — the frontier of regenerative IV therapy for longevity and performance.',
    image: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&q=80',
  },
];

export default function Exosomes() {
  return (
    <ServicePageLayout
      title="IV EXOSOMES"
      subtitle="Cellular Support · Regenerative Therapy"
      badge="Frontier Cellular Regeneration"
      description="Exosomes are extracellular vesicles that carry biological signals between cells, activating repair and regeneration. Our Exosome IVs — ranging from 30B to 90B particles — represent the most advanced cellular recovery therapy available in mobile format."
      treatments={treatments}
      heroImage="https://images.unsplash.com/photo-1576086213369-97a306d36557?w=1920&q=80"
    />
  );
}