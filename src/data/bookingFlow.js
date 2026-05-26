import {
  BatteryCharging,
  Building2,
  Dumbbell,
  HeartPulse,
  Home,
  Hotel,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { IV_ADDONS, IM_SHOTS } from '@/config/verticals';

export const BOOKING_STEPS = ['Goal', 'Protocol', 'Schedule', 'About You', 'Confirm'];

export const BOOKING_GOALS = [
  { key: 'recovery',    label: 'Recovery',       sub: 'Feel better fast',        icon: HeartPulse,   category: 'recovery' },
  { key: 'energy',      label: 'Energy',          sub: 'Boost and recharge',      icon: Zap,          category: 'energy'   },
  { key: 'immunity',    label: 'Immunity',        sub: 'Support your defense',    icon: ShieldCheck,  category: 'immunity' },
  { key: 'beauty',      label: 'Beauty / Glow',   sub: 'Radiate from within',     icon: Sparkles,     category: 'beauty'   },
  { key: 'performance', label: 'Performance',     sub: 'Optimize your edge',      icon: Dumbbell,     category: 'energy'   },
  { key: 'longevity',   label: 'Longevity',       sub: 'Invest in your future',   icon: BatteryCharging, category: 'energy' },
  { key: 'event',       label: 'Launch / Group',  sub: 'We come to you',          icon: Users,        category: 'recovery' },
];

export const BOOKING_LOCATIONS = [
  { key: 'home',   label: 'Home',          icon: Home      },
  { key: 'hotel',  label: 'Hotel',         icon: Hotel     },
  { key: 'office', label: 'Office',        icon: Building2 },
  { key: 'event',  label: 'Launch / Venue', icon: Users     },
  { key: 'other',  label: 'Other',         icon: MapPin    },
];

export const BOOKING_ADDON_GROUPS = [
  {
    key: 'iv',
    title: 'IV Add-Ons',
    sub: 'Boost your drip with fluids, antioxidants, and specialty pushes.',
    items: IV_ADDONS
      .filter((addon) => !addon.group)
      .map((addon) => ({ ...addon, cartKey: `iv-${addon.label}`, type: 'addon' })),
  },
  {
    key: 'im',
    title: 'IM Shots',
    sub: 'Fast intramuscular shots for targeted support.',
    items: IM_SHOTS.map((shot) => ({ ...shot, cartKey: `im-${shot.label}`, type: 'im' })),
  },
];

export const BOOKING_ADDONS_FLAT = BOOKING_ADDON_GROUPS.flatMap((group) => group.items);

const PROTOCOL_PARAM_ALIASES = {
  'myers-cocktail': 'myers',
  'post-night-out': 'postnight',
  'jet-lag': 'jetlag',
  'nad-250mg': 'nad',
  'cbd-33mg': 'cbd',
  'exosomes-30b-units': 'exosomes',
};

export function protocolFromParam(value) {
  if (!value) return null;
  return PROTOCOL_PARAM_ALIASES[value] || value;
}
