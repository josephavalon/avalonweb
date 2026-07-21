import { FlaskConical, Flame, Shield, Sparkles, Zap } from 'lucide-react';

export const IM_SHOTS = [
  { label: 'B12', price: 40, max: 5, icon: Zap, desc: 'Energy + metabolism support', img: '/addons/b12.png' },
  { label: 'MIC', price: 50, icon: Flame, desc: 'Metabolism support', img: '/addons/mic.png' },
  { label: 'NAD+', price: 80, icon: FlaskConical, desc: 'Clinician-reviewed NAD+ support', img: '/addons/nad.png' },
  { label: 'Glutathione IM · 200mg', price: 50, max: 5, icon: Sparkles, desc: 'Antioxidant + skin clarity', img: '/addons/glutathione.png' },
  { label: 'Glutathione IM · 400mg', price: 80, max: 5, icon: Sparkles, desc: 'Higher-dose antioxidant support', img: '/addons/glutathione.png' },
  { label: 'Vitamin C IM · 500mg', price: 30, icon: Shield, desc: 'Immune + antioxidant support', img: '/addons/vitamin-c.png' },
  { label: 'Vitamin C IM · 1000mg', price: 45, icon: Shield, desc: 'Higher-dose vitamin C support', img: '/addons/vitamin-c.png' },
  { label: 'Vitamin D', price: 35, icon: Zap, desc: 'Vitamin D support', img: '/addons/vitamin-d.png' },
  { label: 'Biotin', price: 35, icon: Sparkles, desc: 'Hair, skin & nail support', img: '/addons/biotin.png' },
];
