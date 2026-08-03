import { FlaskConical, Sparkles, Zap } from 'lucide-react';

// IM shots are add-ons only. They attach to an IV visit and are never sold on
// their own — `addOnOnly` states that in data so a future surface can't render
// them as a standalone product by accident.
//
// `family` + `dose` let the menu group the dose ladders (Glutathione 200/400,
// NAD+ 50/100) into one row each instead of parsing them back out of `label`.
export const IM_SHOTS = [
  { label: 'B-12', family: 'B-12', dose: null, price: 40, max: 5, icon: Zap, addOnOnly: true, desc: 'Energy + metabolism support', img: '/addons/b12.png' },
  { label: 'B-Complex', family: 'B-Complex', dose: null, price: 40, max: 5, icon: Zap, addOnOnly: true, desc: 'Full-spectrum B vitamin support', img: '/addons/b-complex.png' },
  { label: 'Glutathione IM · 200mg', family: 'Glutathione', dose: '200mg', price: 80, max: 5, icon: Sparkles, addOnOnly: true, desc: 'Antioxidant + skin clarity', img: '/addons/glutathione.png' },
  { label: 'Glutathione IM · 400mg', family: 'Glutathione', dose: '400mg', price: 120, max: 5, icon: Sparkles, addOnOnly: true, desc: 'Higher-dose antioxidant support', img: '/addons/glutathione.png' },
  { label: 'NAD+ IM · 50mg', family: 'NAD+', dose: '50mg', price: 80, icon: FlaskConical, addOnOnly: true, desc: 'NAD+ support', img: '/addons/nad.png' },
  { label: 'NAD+ IM · 100mg', family: 'NAD+', dose: '100mg', price: 150, icon: FlaskConical, addOnOnly: true, desc: 'Higher-dose NAD+ support', img: '/addons/nad.png' },
];

// One entry per shot family, in catalog order, with its dose tiers cheapest
// first. Menu surfaces render these; the booking funnel still uses the flat
// IM_SHOTS list because it sells a specific dose, not a family.
export const IM_SHOT_FAMILIES = IM_SHOTS.reduce((families, shot) => {
  const name = shot.family || shot.label;
  const existing = families.find((family) => family.name === name);
  const tier = { dose: shot.dose, price: shot.price, label: shot.label };
  if (existing) existing.tiers.push(tier);
  else families.push({ name, desc: shot.desc, img: shot.img, tiers: [tier] });
  return families;
}, []);
