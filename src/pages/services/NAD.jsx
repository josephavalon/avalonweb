import React from 'react';
import ServicePageLayout from '../../components/services/ServicePageLayout';

const treatments = [
  { name: 'NAD+ 250mg', price: '$350', desc: 'Entry-level NAD+ replenishment for cellular energy and mental clarity.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'NAD+ 500mg', price: '$500', desc: 'Mid-range NAD+ for enhanced cognitive function, energy, and DNA repair.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'NAD+ 750mg', price: '$600', desc: 'Advanced dose for deeper cellular repair and sustained longevity benefits.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'NAD+ Vitality', price: '$700', desc: 'NAD+ combined with B vitamins and amino acids for peak performance and recovery.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'NAD+ 1000mg', price: '$800', desc: 'High-dose NAD+ for serious biohackers, founders, and peak performers.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'NAD+ 1250mg', price: '$950', desc: 'Elite dose for comprehensive cellular regeneration and neurological support.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'NAD+ 1500mg', price: '$1,100', desc: 'Maximum therapeutic dose — reserved for longevity protocols and advanced recovery.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
];

export default function NAD() {
  return (
    <ServicePageLayout
      title="IV NAD+"
      subtitle="The longevity molecule"
      badge="Cellular Energy · Cognitive Support · Anti-Aging"
      description="NAD+ (Nicotinamide Adenine Dinucleotide) is a coenzyme critical for cellular energy production, DNA repair, and cognitive function. Levels decline with age. IV NAD+ delivers it directly to your bloodstream — supporting energy, mental clarity, and longevity."
      treatments={treatments}
      heroImage="https://media.base44.com/images/public/69e5682f98e509792c71ef21/3a0a1cbc3_winner.png"
    />
  );
}