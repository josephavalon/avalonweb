import { Heart, LayoutGrid, Plane, ShieldCheck, Sparkles, Zap } from 'lucide-react';

export const IV_CATEGORIES = [
  { key: 'all', label: 'Not Sure', icon: LayoutGrid },
  { key: 'recovery', label: 'Recovery', icon: Heart },
  { key: 'energy', label: 'Energy', icon: Zap },
  { key: 'beauty', label: 'Beauty', icon: Sparkles },
  { key: 'immunity', label: 'Immunity', icon: ShieldCheck },
  { key: 'travel', label: 'Travel', icon: Plane },
  { key: 'elite', label: 'Advanced', icon: Sparkles },
];

export const IV_GOAL_RECOMMENDATION = {
  recovery: 'recovery',
  energy: 'myers',
  beauty: 'beauty',
  packages: 'hangover',
};
