import React from 'react';
import ServicePageLayout from '../../components/services/ServicePageLayout';

const treatments = [
  { name: 'CBD 33mg', price: '$250', desc: 'Entry dose for mild anti-inflammatory support, stress relief, and relaxation. Zero THC.', image: 'https://media.base44.com/images/public/69e5682f98e509792c71ef21/b77205eb6_dddd.png' },
  { name: 'CBD 66mg', price: '$300', desc: 'Mid-range dose for anxiety relief, post-workout recovery, and sleep support.', image: 'https://media.base44.com/images/public/69e5682f98e509792c71ef21/b77205eb6_dddd.png' },
  { name: 'CBD 99mg', price: '$350', desc: 'Higher dose for chronic inflammation, deeper relaxation, and enhanced recovery.', image: 'https://media.base44.com/images/public/69e5682f98e509792c71ef21/b77205eb6_dddd.png' },
  { name: 'CBD Vitality', price: '$350', desc: 'CBD combined with B vitamins and amino acids for full-body restoration.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
  { name: 'CBD 132mg', price: '$400', desc: 'Maximum dose for serious inflammatory conditions, pain management, and recovery.', image: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=600&q=80' },
];

export default function CBD() {
  return (
    <ServicePageLayout
      title="IV CBD"
      subtitle="Zero THC · Anti-Inflammatory · Recovery"
      badge="100% Zero THC — Pharmaceutical Grade"
      description="Our CBD IVs deliver pharmaceutical-grade cannabidiol directly to the bloodstream — zero THC, maximum bioavailability. Anti-inflammatory, stress-relieving, and profoundly calming. From 33mg to 132mg."
      treatments={treatments}
      heroImage="https://media.base44.com/images/public/69e5682f98e509792c71ef21/13b3b5f9f_ss.jpg"
    />
  );
}