import { FlaskConical, Sparkles, Zap } from 'lucide-react';

// IM shots are add-ons only. They attach to an IV visit and are never sold on
// their own — `addOnOnly` states that in data so a future surface can't render
// them as a standalone product by accident.
export const IM_SHOTS = [
  { label: 'B-12', price: 40, max: 5, icon: Zap, addOnOnly: true, desc: 'Energy + metabolism support', img: '/addons/b12.png' },
  { label: 'B-Complex', price: 40, max: 5, icon: Zap, addOnOnly: true, desc: 'Full-spectrum B vitamin support', img: '/addons/b-complex.png' },
  { label: 'Glutathione IM · 200mg', price: 80, max: 5, icon: Sparkles, addOnOnly: true, desc: 'Antioxidant + skin clarity', img: '/addons/glutathione.png' },
  { label: 'Glutathione IM · 400mg', price: 120, max: 5, icon: Sparkles, addOnOnly: true, desc: 'Higher-dose antioxidant support', img: '/addons/glutathione.png' },
  { label: 'NAD+ IM · 50mg', price: 80, icon: FlaskConical, addOnOnly: true, desc: 'NAD+ support', img: '/addons/nad.png' },
  { label: 'NAD+ IM · 100mg', price: 150, icon: FlaskConical, addOnOnly: true, desc: 'Higher-dose NAD+ support', img: '/addons/nad.png' },
];

