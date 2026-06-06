import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { motion, LayoutGroup, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  CreditCard,
  Droplets,
  Flame,
  Home,
  Hotel,
  Leaf,
  MapPin,
  Mail,
  Moon,
  Minus,
  Navigation,
  Pencil,
  Phone,
  Plane,
  Plus,
  ShieldCheck,
  Sparkles,
  Syringe,
  User,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';

import Navbar from '@/components/landing/Navbar';
import { useCart } from '@/context/CartContext';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';
import { COVERED_ZIPS, extractZip } from '@/lib/serviceArea';
import { useSeo } from '@/lib/seo';
import {
  appendActivity,
  clearBookingDraft,
  readBookingDraft,
  readLastBooking,
  saveBookingDraft,
  saveLastBooking,
  writeLocal,
} from '@/lib/localOs';
import { createBookingRecord, resolveGfeRequirement, validateBookingForCheckout } from '@/lib/bookingLifecycle';
import { orchestrateOrderHandoff, readClientProfile } from '@/lib/platformOps';
import { ANALYTICS_EVENTS, getAttribution, track } from '@/lib/analytics';
import { FEATURED_SUBSCRIPTION_TIER_KEY, SUBSCRIPTION_TIERS } from '@/config/subscriptionTiers';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import { useAuthStore } from '@/lib/useAuthStore';

const EASE = [0.16, 1, 0.3, 1];
const CHECKOUT_MOTION = { duration: 0.28, ease: EASE };
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;
const CARD_REVEAL = {
  hidden: { opacity: 1, y: 6, scale: 1 },
  show: (index = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.22,
      delay: Math.min(index, 4) * 0.015,
      ease: EASE,
    },
  }),
};
const TZ = 'America/Los_Angeles';
const DEFAULT_TIME = 'ASAP';
const STEPS = ['Therapy', 'Add-ons', 'Date & Time', 'Location', 'Review'];
const STEP_ICONS = [Droplets, Plus, Calendar, MapPin, Check];
const LAST_STEP = STEPS.length - 1;
const BOOKING_DRAFT_VERSION = 2;
const PRIMARY_OUTCOME_KEYS = ['recover', 'perform', 'performance', 'longevity'];
const SAFETY_FLAGS = [
  'Pregnant',
  'Heart or kidney disease',
  'Allergy to IV ingredients',
  'Chest pain or shortness of breath',
  'Currently intoxicated or unable to consent',
];

const OUTCOMES = [
		  {
		    key: 'hydrate',
		    label: 'Hydration',
		    sub: 'Replenish.',
		    icon: Droplets,
		    productKeys: ['hydration', 'recovery', 'myers'],
		  },
		  {
		    key: 'recover',
		    label: 'Recovery',
		    sub: 'Bounce back.',
		    icon: Droplets,
		    productKeys: ['recovery', 'postnight', 'hydration'],
		  },
		  {
		    key: 'perform',
		    label: 'Energy',
		    sub: 'Feel sharp.',
		    icon: Zap,
		    productKeys: ['energy', 'myers', 'nad'],
		  },
		  {
		    key: 'performance',
		    label: 'Performance',
		    sub: 'Output.',
		    icon: Flame,
		    productKeys: ['myers', 'energy', 'nad'],
		  },
		  {
		    key: 'travel',
		    label: 'Travel',
		    sub: 'Arrival support.',
		    icon: Plane,
		    productKeys: ['jetlag', 'hydration', 'energy'],
		  },
		  {
		    key: 'wellness',
		    label: 'Wellness',
		    sub: 'Daily support.',
		    icon: ShieldCheck,
		    productKeys: ['immunity', 'myers', 'beauty'],
		  },
		  {
		    key: 'glow',
		    label: 'Glow',
		    sub: 'Beauty support.',
		    icon: Sparkles,
		    productKeys: ['beauty', 'immunity', 'myers'],
		  },
		  {
		    key: 'nad',
		    label: 'NAD+',
		    sub: 'Advanced.',
		    icon: BatteryCharging,
		    productKeys: ['nad', 'myers', 'energy'],
		  },
		  {
		    key: 'cbd',
		    label: 'CBD',
		    sub: 'Review gated.',
		    icon: Leaf,
		    productKeys: ['cbd', 'recovery', 'hydration'],
		  },
		  {
		    key: 'longevity',
		    label: 'Custom',
		    sub: 'Build yours.',
		    icon: Moon,
		    productKeys: ['nad', 'cbd', 'myers'],
		  },
	];

const OTHER_PROTOCOL_KEYS = ['hydration', 'recovery', 'energy', 'myers', 'postnight', 'jetlag', 'immunity', 'beauty', 'nad', 'cbd'];
const BOOKING_THERAPY_KEYS = [
  'hydration',
  'myers',
  'postnight',
  'immunity',
  'energy',
  'recovery',
  'performance',
  'jetlag',
  'food-poisoning',
  'cbd-33mg',
  'cbd-66mg',
  'cbd-99mg',
  'cbd-132mg',
  'nad-250mg',
  'nad-500mg',
  'nad-750mg',
  'nad-1000mg',
  'nad-1250mg',
  'nad-1500mg',
];
const THERAPY_GROUPS = [
  {
    key: 'vitamin',
    label: 'IV Therapy',
    sub: '9 therapies',
    icon: Droplets,
    keys: ['hydration', 'myers', 'postnight', 'immunity', 'energy', 'recovery', 'performance', 'jetlag', 'food-poisoning'],
  },
  {
    key: 'cbd',
    label: 'CBD IV Therapy',
    sub: '4 therapies',
    icon: Leaf,
    keys: ['cbd-33mg', 'cbd-66mg', 'cbd-99mg', 'cbd-132mg'],
  },
  {
    key: 'nad',
    label: 'NAD+ IV Therapy',
    sub: '6 therapies',
    icon: BatteryCharging,
    keys: ['nad-250mg', 'nad-500mg', 'nad-750mg', 'nad-1000mg', 'nad-1250mg', 'nad-1500mg'],
  },
];
const DESKTOP_THERAPY_MENU_KEYS = ['energy', 'recovery', 'jetlag', 'postnight', 'myers', 'hydration', 'immunity', 'nad-250mg', 'cbd-33mg'];
const STACK_LAYERS = [
  { key: 'iv', label: 'IVs', status: 'Base', icon: Droplets, active: true },
  { key: 'addons', label: 'Add-ons', status: 'Step 2', icon: Plus, active: true },
  { key: 'shots', label: 'Shots', status: 'Step 2', icon: Syringe, active: true },
  { key: 'peptides', label: 'Peptides', status: 'Soon', icon: Sparkles },
  { key: 'hrt', label: 'HRT', status: 'Soon', icon: ShieldCheck },
  { key: 'aesthetics', label: 'Aesthetics', status: 'Soon', icon: Sparkles },
  { key: 'supplements', label: 'Supplements', status: 'Soon', icon: Leaf },
  { key: 'diet', label: 'Diet', status: 'Soon', icon: Zap },
];

const CUSTOM_BASE_OPTIONS = [
  { key: 'hydration', label: 'Hydration IV', productKey: 'hydration', icon: Droplets },
  { key: 'recovery', label: 'Recovery IV', productKey: 'recovery', icon: ShieldCheck },
  { key: 'energy', label: 'Energy IV', productKey: 'energy', icon: Zap },
  { key: 'myers', label: "Myers' Cocktail", productKey: 'myers', icon: Syringe, badge: 'Popular' },
  { key: 'immunity', label: 'Immunity IV', productKey: 'immunity', icon: ShieldCheck },
  { key: 'beauty', label: 'Glow IV', productKey: 'beauty', icon: Sparkles },
  { key: 'postnight', label: 'Post-Night-Out IV', productKey: 'postnight', icon: Moon },
  { key: 'travel', label: 'Travel IV', productKey: 'jetlag', icon: Plane },
  { key: 'advanced', label: 'NAD+ IV', productKey: 'nad', icon: BatteryCharging },
  { key: 'cbd', label: 'CBD IV', productKey: 'cbd', icon: Leaf, badge: 'Review' },
];

const CUSTOM_SUBSCRIPTION_VISITS = [
  { key: 1, label: '1x', icon: Calendar },
  { key: 2, label: '2x', icon: Sparkles },
  { key: 4, label: '4x', icon: ShieldCheck },
  { key: 6, label: '6x', icon: Zap },
];

const VISIT_TYPES = [
  {
    key: 'one-time',
    label: 'One-Time Visit',
    sub: 'Book once.',
    icon: Calendar,
    orderType: 'recovery',
  },
  {
    key: 'subscription',
    label: 'Subscribe & Save',
    sub: 'Monthly recovery.',
    icon: Sparkles,
    orderType: 'subscription',
  },
  {
    key: 'event',
    label: 'Launch / Group',
    sub: 'Venue, office, hotel, private.',
    icon: Users,
    orderType: 'event',
  },
];

const LOCATION_TYPES = [
  { key: 'home', label: 'Home', icon: Home, placeholder: 'Address' },
  { key: 'hotel', label: 'Hotel', icon: Hotel, placeholder: 'Hotel + room' },
  { key: 'office', label: 'Office', icon: Building2, placeholder: 'Office' },
  { key: 'event', label: 'Venue', icon: Users, placeholder: 'Venue' },
];

const WHO_OPTIONS = [
  { key: 'me', label: 'Me', icon: User },
  { key: 'other', label: 'Other', icon: UserPlus },
  { key: 'group', label: 'Group', icon: Users },
];

const MEMBERSHIP_OPTIONS = SUBSCRIPTION_TIERS.map((tier) => ({
  key: tier.key,
  label: tier.name,
  price: tier.price,
  sessions: tier.sessions,
  discount: tier.discount,
  custom: Boolean(tier.custom),
  sub: tier.custom
    ? 'Build your monthly protocol.'
    : `${tier.sessions} session${tier.sessions === 1 ? '' : 's'}/mo · ${tier.discount} off add-ons`,
}));

const EVENT_TYPES = ['Private', 'Hotel', 'Office', 'Festival', 'Venue'];
const CLIENT_TYPES = [
  { key: 'new', label: 'New', sub: 'First visit.', icon: Sparkles },
  { key: 'returning', label: 'Return', sub: 'Use saved info.', icon: Check },
];

const BOOKING_DEPOSIT_AMOUNT = 50;
const SUBSCRIPTION_TERMS = [
  { key: 'monthly', label: 'Monthly', months: 1, discount: 0, billing: 'monthly', commitmentMonths: 3 },
  { key: 'six-month', label: '6 months', months: 6, discount: 0.08, billing: 'six-month' },
  { key: 'annual', label: '12 months', months: 12, discount: 0.15, billing: 'annual' },
];

const PUBLIC_BOOKING_PROTOCOL_KEYS = new Set([...OUTCOMES.flatMap((item) => item.productKeys), ...BOOKING_THERAPY_KEYS]);

// Canned demo address suggestions removed — clients enter their own address.
const ADDRESS_SUGGESTIONS = [];

function scoreAddressSuggestion(item, rawQuery) {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (!query) return 0;
  const haystack = `${item.label} ${item.address} ${item.zip}`.toLowerCase();
  const address = item.address.toLowerCase();
  const digits = query.replace(/\D/g, '');
  const streetDigits = item.address.replace(/\D/g, '');
  if (digits && (streetDigits.startsWith(digits) || item.zip.startsWith(digits))) return 0;
  if (address.startsWith(query)) return 1;
  if (haystack.includes(query)) return 2;
  return Number.POSITIVE_INFINITY;
}

function locationLabelForKey(key) {
  return LOCATION_TYPES.find((item) => item.key === key)?.label || 'Home';
}

function normalizeTypedStreet(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

function buildTypedAddressSuggestion(address, zip, locationType = 'home') {
  const typed = normalizeTypedStreet(address);
  if (typed.length < 3) return null;
  if (!/\d/.test(typed)) return null;
  const inferredZip = extractZip(typed);
  const typedAddress = normalizeTypedStreet(typed.replace(/\b\d{5}(?:-\d{4})?\b/g, ''));
  const completedAddress = /,\s*[A-Za-z]/.test(typedAddress)
    ? typedAddress
    : `${typedAddress}, San Francisco, CA`;
  return {
    label: `${locationLabelForKey(locationType)} · Suggested`,
    address: completedAddress,
    zip: inferredZip || String(zip || '').replace(/\D/g, '').slice(0, 5),
    locationType,
    generated: true,
  };
}

const BOOKING_DAYS = 30;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 20;
const DEFAULT_EXACT_TIME = '10:00';

const TIME_INTENTS = [
  { key: 'asap', label: 'ASAP', icon: Zap },
  { key: 'choose', label: 'Pick date', icon: Calendar },
];

function todayDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

function buildDateOptions() {
  return Array.from({ length: BOOKING_DAYS }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      value: todayDate(index),
      label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }),
      day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }),
    };
  });
}

function buildTimeSlots() {
  const slots = [];
  for (let hour = OPEN_HOUR; hour <= CLOSE_HOUR; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === CLOSE_HOUR && minute > 0) continue;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push({ key: time, time, display: formatTimeLabel(time) });
    }
  }
  return slots;
}

function splitName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || 'Client' };
}

function realValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/pending|unknown|missing|preview|avalon\.local/i.test(text)) return '';
  return text;
}

function realAddress(value) {
  const text = realValue(value);
  if (!text || /address pending|client address|2100\s+webster/i.test(text)) return '';
  return text;
}

function currency(value) {
  if (value === null || value === undefined || value === '') return 'Custom';
  return `$${Number(value || 0).toLocaleString()}`;
}

function subscriptionTermForKey(key) {
  return SUBSCRIPTION_TERMS.find((item) => item.key === key) || SUBSCRIPTION_TERMS[0];
}

function subscriptionTermPrice(monthlyPrice, termKey) {
  const term = subscriptionTermForKey(termKey);
  const raw = Number(monthlyPrice || 0) * term.months * (1 - term.discount);
  return Math.max(0, Math.round(raw));
}

function protocolPrice(protocol) {
  return Number(protocol?.price || protocol?.doses?.[0]?.price || 250);
}

function protocolDuration(protocol) {
  return protocol?.duration || protocol?.doses?.[0]?.duration || '45-60 min';
}

function getCatalogProductByKey(key) {
  return IV_SESSIONS.find((item) => item.key === key) || null;
}

function buildDoseProduct(parentKey, key, label) {
  const parent = getCatalogProductByKey(parentKey);
  const doseAmount = String(key || '').replace(`${parentKey}-`, '').replace(/mg$/i, '');
  const dose = parent?.doses?.find((item) => item.key === `${parentKey}_${doseAmount}`);
  if (!parent || !dose) return null;
  return {
    ...parent,
    ...dose,
    key,
    label,
    tabLabel: label,
    category: parent.category,
    icon: parent.icon,
    tagline: parent.tagline,
    inside: parent.inside,
    features: parent.features,
    desc: parent.desc || parent.tagline,
    parentProtocolKey: parent.key,
    doseKey: dose.key,
  };
}

function getBookingTherapyByKey(key) {
  const overrides = {
    hydration: { source: 'hydration', label: 'Hydration' },
    myers: { source: 'myers', label: "Myers' Cocktail" },
    postnight: { source: 'postnight', label: 'Night Out' },
    immunity: { source: 'immunity', label: 'Immunity' },
    energy: { source: 'energy', label: 'Energy' },
    recovery: { source: 'recovery', label: 'Recovery' },
    performance: { source: 'energy', label: 'Performance', tagline: 'Performance-focused hydration support.' },
    jetlag: { source: 'jetlag', label: 'Jet Lag' },
    'food-poisoning': { source: 'recovery', label: 'Food Poisoning', tagline: 'Hydration support after GI distress.' },
  };

  if (key?.startsWith('cbd-')) return buildDoseProduct('cbd', key, `CBD ${key.replace('cbd-', '').toUpperCase()}`);
  if (key?.startsWith('nad-')) return buildDoseProduct('nad', key, `NAD+ ${key.replace('nad-', '').toUpperCase()}`);

  const override = overrides[key];
  if (!override) return null;
  const source = getCatalogProductByKey(override.source);
  if (!source) return null;
  return {
    ...source,
    key,
    label: override.label,
    tabLabel: override.label,
    tagline: override.tagline || source.tagline,
    parentProtocolKey: source.key,
  };
}

function getProductByKey(key) {
  return getBookingTherapyByKey(key) || getCatalogProductByKey(key);
}

function therapyGroupForKey(key) {
  return THERAPY_GROUPS.find((group) => group.keys.includes(key))?.key || 'vitamin';
}

function safeProtocol(protocol) {
  if (!protocol) return null;
  if (protocol.key === 'cbd') return { ...protocol, label: 'CBD Review', tagline: 'Held for clinical and legal approval.' };
  return protocol;
}

function uniqueProtocols(keys) {
  const seen = new Set();
  return keys
    .map((key) => safeProtocol(getProductByKey(key)))
    .filter((item) => {
      if (!item || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
}

function productOptionsForOutcome(outcome) {
  const primaryKeys = Array.isArray(outcome?.productKeys) ? outcome.productKeys : [];
  return uniqueProtocols([...primaryKeys, ...OTHER_PROTOCOL_KEYS]);
}

function formatTimeLabel(time) {
  const [rawHours, rawMinutes] = String(time || '15:00').split(':').map(Number);
  const hours = Number.isFinite(rawHours) ? rawHours : 15;
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = ((hours + 11) % 12) + 1;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function buildSlot(date, timeIntent, customTime) {
  const rawDate = date || todayDate();
  const time = customTime || (timeIntent === 'asap' || timeIntent === 'today' || timeIntent === 'soonest' ? '08:00' : '15:00');
  return {
    datetime: `${rawDate}T${time}:00`,
    timezone: TZ,
    timeLabel: timeIntent === 'asap' || timeIntent === 'today' || timeIntent === 'soonest' ? 'ASAP' : formatTimeLabel(time),
    appointmentTypeID: `ACUITY-${timeIntent || 'manual'}`,
  };
}

function safeAcuityTypeId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function canUseStaticPreviewFallback() {
  if (typeof window === 'undefined') return false;
  const localHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return localHost && ['4173', '4174'].includes(window.location.port);
}

async function createCheckoutSession(payload) {
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok || !body) {
    const error = new Error(body?.error || 'Checkout is unavailable.');
    error.code = body?.code || (!body ? 'checkout_api_unavailable' : 'checkout_failed');
    error.body = body;
    throw error;
  }
  return body;
}

async function reverseGeocodeLocation({ latitude, longitude }) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  const response = await fetch(`/api/reverse-geocode?${params}`);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.address) {
    throw new Error(body?.error || 'Address lookup failed.');
  }
  return body;
}

function bookingTimeSummary(state) {
  if (state.timeIntent === 'asap' || state.timeIntent === 'today' || state.timeIntent === 'soonest') return 'ASAP';
  if (state.customDate && state.customTime) return `${formatDateShort(state.customDate)} · ${formatTimeLabel(state.customTime)}`;
  return 'Pick time';
}

function formatDateShort(value) {
  if (!value) return 'Pick date';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });
}

function oneYearFromNowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 365);
  return date.toISOString();
}

function SectionTitle({ title, sub, icon: Icon }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="mb-4 md:mb-6"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE }}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <motion.span
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-foreground/14 bg-background/42 text-foreground/88 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_16px_52px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl md:hidden"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : CHECKOUT_MOTION}
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--foreground)/0.18),transparent_55%)]" />
            <Icon className="h-4 w-4" strokeWidth={2.35} />
          </motion.span>
        )}
      </div>
      <h1 className="mt-1 font-heading text-[2.85rem] uppercase leading-[0.86] tracking-0 text-foreground md:mt-0 md:text-[4rem]">
        {title}
      </h1>
      {sub && <p className="mt-2 max-w-xl font-body text-base font-medium leading-snug text-foreground/72 md:mt-3 md:text-xl">{sub}</p>}
    </motion.div>
  );
}

function TrustSpeedStrip() {
  return (
    <div className="relative overflow-hidden rounded-[1.15rem] border border-foreground/12 bg-background/42 px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl">
      <div className="grid grid-cols-3 divide-x divide-foreground/10">
        {[
          { icon: ShieldCheck, title: 'Clinically supervised', body: 'RN oversight for every treatment' },
          { icon: Calendar, title: 'Flexible scheduling', body: 'Book at your convenience' },
          { icon: CreditCard, title: 'Secure booking', body: 'Your health is protected' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex min-w-0 items-center gap-3 px-4 first:pl-0 last:pr-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground">
                <Icon className="h-6 w-6" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-body text-xs font-black uppercase tracking-[0.1em] text-foreground/78">{item.title}</span>
                <span className="mt-1 block truncate font-body text-sm font-semibold text-foreground/58">{item.body}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingMobileHeader() {
  return null;
}

function StepProgress({ step, onStepSelect, displayStepIndex = step, displayTitle = STEPS[step], progressIndex = displayStepIndex }) {
  const reduceMotion = useReducedMotion();
  const CurrentIcon = STEP_ICONS[step] || Check;
  return (
    <div className="relative mb-2 shrink-0 px-1 pt-0.5 md:mb-3 md:pt-1">
      <div className="relative">
        <div className="flex items-center justify-between gap-2.5 md:gap-3">
          <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
            <motion.span
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/42 bg-background/30 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)] backdrop-blur-xl min-[390px]:h-12 min-[390px]:w-12 md:h-14 md:w-14"
              key={step}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0.72, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : CHECKOUT_MOTION}
            >
              <CurrentIcon className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2.7} />
            </motion.span>
            <div className="min-w-0">
              <p className="font-heading text-[1.3rem] uppercase leading-[0.92] tracking-normal text-foreground min-[390px]:text-[1.42rem] md:text-[1.55rem]">
                {displayStepIndex + 1} OF {STEPS.length} • {displayTitle}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            {STEPS.map((item, index) => {
              const active = index === step;
              const complete = index < step;
              const reachable = index <= step + 1;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => reachable && onStepSelect(index)}
                  disabled={!reachable}
                  aria-label={`Go to ${item}`}
                  aria-current={active ? 'step' : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border font-body text-base font-black transition-all ${
                    active
                      ? 'border-foreground/30 bg-foreground/[0.12] text-foreground shadow-[0_10px_28px_hsl(var(--foreground)/0.10)] backdrop-blur-xl'
                      : complete
                        ? 'border-foreground/26 bg-foreground/[0.10] text-foreground'
                        : reachable
                          ? 'border-foreground/14 bg-background/40 text-foreground/56'
                          : 'border-foreground/8 bg-background/20 text-foreground/24'
                  }`}
                >
                  {complete ? <Check className="h-4 w-4" strokeWidth={2.8} /> : index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full border border-foreground/18 bg-background/52 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)] md:mt-3 md:h-3">
        <motion.div
          className="relative h-full overflow-hidden rounded-full bg-foreground shadow-[0_0_28px_hsl(var(--foreground)/0.32)]"
          initial={false}
          animate={{ width: `${((progressIndex + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.56, ease: EASE }}
        >
        </motion.div>
      </div>
    </div>
  );
}

function UniversalBookingFrame({
  step,
  total,
  dueNow,
  dueAfter,
  displayStepIndex,
  displayTitle,
  progressIndex,
  canGoNext,
  actionLabel,
  checkoutLoading,
  error,
  canGoBack,
  onBack,
  onNext,
  onStepSelect,
  children,
}) {
  return (
    <section className="mx-auto flex h-full max-h-full min-h-0 w-full max-w-lg flex-col overflow-hidden px-0 pb-[var(--av-booking-footer-reserve)] pt-0 md:h-auto md:max-h-none md:max-w-4xl md:pb-4">
      <StepProgress
        step={step}
        onStepSelect={onStepSelect}
        displayStepIndex={displayStepIndex}
        displayTitle={displayTitle}
        progressIndex={progressIndex}
      />
      {error && (
        <div role="alert" className="mb-2 flex min-h-[42px] items-center justify-between gap-3 rounded-2xl border border-amber-300/22 bg-amber-300/[0.07] px-3 py-2 text-amber-100">
          <p className="truncate font-body text-sm font-black">{error}</p>
          <a href="sms:+14159807708" className="shrink-0 rounded-full border border-amber-200/24 px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em]">
            Text
          </a>
        </div>
      )}
      <motion.div
        key={step}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-0 pb-1 [-webkit-overflow-scrolling:touch] md:overflow-hidden md:pb-0"
        initial={{ opacity: 1, y: 0, scale: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: EASE }}
      >
        <div className="relative h-full min-h-full">
          {children}
        </div>
      </motion.div>
      <div className="fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),0.5rem)] z-40 px-2 pb-0 pt-1 md:sticky md:bottom-4 md:mt-3 md:px-0">
        <div className="mx-auto max-w-lg overflow-hidden rounded-[1rem] border border-foreground/14 bg-background/82 p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_-14px_56px_hsl(var(--foreground)/0.14)] backdrop-blur-2xl md:max-w-4xl md:p-2">
          <div className="grid grid-cols-[76px_minmax(0,114px)_1fr] items-center gap-1.5 md:flex md:gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            aria-label="Go back"
            className="flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-foreground/14 bg-background/30 px-2 font-body text-[10px] font-black uppercase tracking-[0.06em] text-foreground/80 disabled:opacity-25 min-[390px]:text-[11px] md:min-h-[64px] md:w-[92px] md:px-3 md:text-xs"
          >
            Back
          </button>
          <div className="min-w-0 shrink-0 border-r border-foreground/12 px-1 md:min-w-[142px] md:px-2">
            <p className="font-body text-[7px] font-black uppercase tracking-[0.08em] text-foreground/62 min-[390px]:text-[8px] md:text-[10px] md:tracking-[0.12em]">Reservation Deposit</p>
            <p className="mt-0.5 font-body text-[1.2rem] font-black leading-none text-foreground min-[390px]:text-[1.28rem] md:mt-1 md:text-[1.45rem]">{dueNow}</p>
            <p className="mt-0.5 truncate font-body text-[9px] font-semibold text-foreground/62 min-[390px]:text-[10px]">Due after visit {dueAfter}</p>
          </div>
          <button
            type="button"
            onClick={onNext}
            aria-label={actionLabel}
            className={`relative flex min-h-[44px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border px-3 font-body text-xs font-black uppercase tracking-[0.06em] shadow-[0_-8px_38px_hsl(var(--foreground)/0.18),inset_0_1px_0_hsl(var(--foreground)/0.12)] transition-transform active:scale-[0.985] min-[390px]:text-sm md:min-h-[56px] md:gap-3 md:px-4 ${
              canGoNext ? 'border-foreground/82 bg-foreground text-background' : 'border-foreground/18 bg-background/42 text-foreground/58'
            }`}
          >
            {checkoutLoading && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-background/35 to-transparent"
                animate={{ x: ['0%', '420%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: EASE }}
              />
            )}
            <span>{actionLabel}</span>
            <ArrowRight className="h-4.5 w-4.5 md:h-5 md:w-5" strokeWidth={2.7} />
          </button>
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-1.5 font-body text-[9px] font-semibold text-foreground/56 min-[390px]:text-[10px]">
            <ShieldCheck className="h-2.5 w-2.5 min-[390px]:h-3 min-[390px]:w-3" strokeWidth={2.2} />
            Secure booking
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopStepRail({ displayStepIndex = 0 }) {
  return (
    <div className="mt-4 flex max-w-xl items-center">
      {STEPS.map((item, index) => {
        const active = index === displayStepIndex;
        const complete = index < displayStepIndex;
        const reachable = index <= displayStepIndex + 1;
        return (
          <React.Fragment key={item}>
            <span
              aria-label={`Go to ${item}`}
              aria-current={active ? 'step' : undefined}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-body text-xs font-black transition-colors ${
                active
                  ? 'border-foreground bg-foreground text-background shadow-[0_0_26px_hsl(var(--foreground)/0.24)]'
                  : complete
                    ? 'border-foreground/34 bg-foreground/12 text-foreground'
                    : reachable
                      ? 'border-foreground/24 bg-background/34 text-foreground/66'
                      : 'border-foreground/14 bg-background/24 text-foreground/36'
              }`}
            >
              {index + 1}
            </span>
            {index < STEPS.length - 1 && (
              <span className="mx-0 h-px flex-1 bg-foreground/16">
                <span className={`block h-full bg-foreground/70 ${index < displayStepIndex ? 'w-full' : 'w-0'}`} />
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DesktopOrderRail({
  state,
  product,
  selectedAddons,
  subtotal,
  dueNow,
  balanceDue,
  totalLabel,
  displayStepIndex,
  actionLabel,
  canGoNext,
  checkoutLoading,
  canGoBack,
  onBack,
  onNext,
}) {
  const hasTherapySelection = Boolean(product);
  const displaySubtotal = hasTherapySelection ? subtotal : 0;
  const displayDueNow = hasTherapySelection ? dueNow : BOOKING_DEPOSIT_AMOUNT;
  const displayBalanceDue = hasTherapySelection ? balanceDue : 200;
  const selectedIvAddons = selectedAddons.filter((item) => item.type !== 'im');
  const selectedImAddons = selectedAddons.filter((item) => item.type === 'im');
  const dateLabel = displayStepIndex >= 2 && state.timeIntent === 'choose' && state.customDate ? formatDateShort(state.customDate) : 'Not selected';
  const timeLabel = displayStepIndex >= 2 && state.timeIntent === 'choose' && state.customTime ? formatTimeLabel(state.customTime) : 'Not selected';

  const rows = [
    ['Therapy', hasTherapySelection ? product.label : 'Not selected'],
    ['IV Add-ons', hasTherapySelection && selectedIvAddons.length ? selectedIvAddons.map((item) => item.label).join(', ') : 'None'],
    ['IM Add-ons', hasTherapySelection && selectedImAddons.length ? selectedImAddons.map((item) => item.label).join(', ') : 'None'],
    ['Date', dateLabel],
    ['Time', timeLabel],
  ];

  return (
    <aside className="relative h-full min-h-0 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/58 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_28px_96px_hsl(var(--foreground)/0.16)] backdrop-blur-2xl lg:p-5 2xl:p-7">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,hsl(var(--foreground)/0.105),transparent_38%),linear-gradient(145deg,hsl(var(--foreground)/0.055),transparent_62%)]" />
      <div className="relative flex h-full min-h-0 flex-col">
        <p className="font-body text-sm font-black uppercase tracking-[0.18em] text-foreground/78 2xl:text-lg">Your Order</p>
        <div className="mt-3 divide-y divide-foreground/10 border-t border-foreground/10 2xl:mt-6">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[104px_1fr] gap-3 py-2.5 2xl:grid-cols-[120px_1fr] 2xl:py-4">
              <p className="font-body text-sm font-black text-foreground/66 2xl:text-base">{label}</p>
              <p className="text-right font-body text-sm font-bold leading-snug text-foreground/86 2xl:text-base">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-foreground/10 pt-4 2xl:mt-5 2xl:pt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-sm font-black uppercase tracking-[0.12em] text-foreground/66 2xl:text-base">Subtotal</p>
            <p className="font-body text-lg font-black text-foreground 2xl:text-xl">{hasTherapySelection ? totalLabel || currency(displaySubtotal) : currency(0)}</p>
          </div>
          <div className="mt-4 2xl:mt-6">
            <p className="font-body text-sm font-black uppercase tracking-[0.12em] text-foreground/66 2xl:text-base">Reservation Deposit</p>
            <p className="mt-1 font-body text-[2.35rem] font-black leading-none text-foreground 2xl:mt-2 2xl:text-[3.1rem]">{currency(displayDueNow)}</p>
            <p className="mt-1 font-body text-sm font-semibold text-foreground/66 2xl:mt-2 2xl:text-base">Secure your booking</p>
            {displayBalanceDue > 0 && <p className="mt-2 font-body text-xs font-bold text-foreground/52 2xl:mt-3 2xl:text-sm">Balance {hasTherapySelection ? currency(displayBalanceDue) : 'due after visit $200'}</p>}
          </div>
        </div>
        <div className={`mt-auto grid gap-3 pt-4 2xl:gap-4 2xl:pt-7 ${canGoBack ? 'grid-cols-[112px_1fr] 2xl:grid-cols-[148px_1fr]' : 'grid-cols-1'}`}>
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex min-h-[52px] items-center justify-center rounded-xl border border-foreground/14 bg-background/34 px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-foreground/78 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] transition-colors hover:border-foreground/30 hover:text-foreground 2xl:min-h-[70px] 2xl:text-base"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext || checkoutLoading}
            className={`relative flex min-h-[52px] w-full items-center justify-center gap-4 overflow-hidden rounded-xl border px-5 font-body text-base font-black uppercase tracking-[0.08em] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)] transition-transform active:scale-[0.985] 2xl:min-h-[70px] 2xl:gap-5 2xl:px-6 2xl:text-lg ${
              canGoNext ? 'border-foreground bg-foreground text-background' : 'border-foreground/18 bg-background/36 text-foreground/46'
            }`}
          >
            {checkoutLoading && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-background/35 to-transparent"
                animate={{ x: ['0%', '420%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: EASE }}
              />
            )}
            <span>{actionLabel}</span>
            <ArrowRight className="h-5 w-5 2xl:h-7 2xl:w-7" strokeWidth={2.6} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 font-body text-xs font-semibold text-foreground/56 2xl:mt-6 2xl:text-sm">
          <ShieldCheck className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" strokeWidth={2.2} />
          Secure booking
        </div>
      </div>
    </aside>
  );
}

function DesktopBookingFrame({
  step,
  displayStepIndex,
  displayTitle,
  canGoNext,
  actionLabel,
  checkoutLoading,
  error,
  canGoBack,
  state,
  product,
  selectedAddons,
  subtotal,
  dueNow,
  balanceDue,
  totalLabel,
  onBack,
  onNext,
  onStepSelect,
  children,
}) {
  return (
    <section className="mx-auto hidden h-[calc(100svh-7.25rem)] max-h-[760px] min-h-[520px] w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.35rem] border border-foreground/18 bg-background/74 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_34px_130px_hsl(var(--foreground)/0.18)] backdrop-blur-2xl md:block 2xl:max-w-[1540px]">
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(330px,420px)] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:gap-7 lg:p-5 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,450px)] 2xl:gap-10 2xl:p-8">
        <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)]">
          <h1 className="font-body text-xl font-black uppercase tracking-[0.08em] text-foreground">
            {displayStepIndex + 1} OF {STEPS.length} • {displayTitle}
          </h1>
          <DesktopStepRail displayStepIndex={displayStepIndex} />
          <div className="my-3 h-px bg-foreground/10 2xl:my-5" />
          {error && (
            <div role="alert" className="mb-4 flex min-h-[42px] items-center justify-between gap-3 rounded-xl border border-amber-300/22 bg-amber-300/[0.07] px-4 py-2 text-amber-100">
              <p className="font-body text-sm font-black">{error}</p>
              <a href="sms:+14159807708" className="shrink-0 rounded-full border border-amber-200/24 px-3 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em]">
                Text
              </a>
            </div>
          )}
          <motion.div
            key={step}
            className="relative min-h-0 overflow-hidden"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: EASE }}
          >
            {children}
          </motion.div>
        </div>
        <DesktopOrderRail
          state={state}
          product={product}
          selectedAddons={selectedAddons}
          subtotal={subtotal}
          dueNow={dueNow}
          balanceDue={balanceDue}
          totalLabel={totalLabel}
          displayStepIndex={displayStepIndex}
          actionLabel={actionLabel}
          canGoNext={canGoNext}
          checkoutLoading={checkoutLoading}
          canGoBack={canGoBack}
          onBack={onBack}
          onNext={onNext}
        />
      </div>
    </section>
  );
}

function StepControls({ step, canGoNext, nextLabel, total, onBack, onNext }) {
  const compactNextLabel = nextLabel;
  return (
    <div className="mb-4 hidden items-center gap-2 md:mb-3 md:flex">
      <button
        type="button"
        onClick={onBack}
        disabled={step === 0}
        className={`flex min-h-[52px] w-[112px] shrink-0 items-center justify-center gap-1.5 rounded-full border bg-background/45 px-3 font-body text-sm font-black uppercase tracking-[0.06em] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl transition-colors md:min-h-[48px] md:w-[112px] md:gap-2 md:text-xs ${
          step === 0
            ? 'cursor-not-allowed border-foreground/8 text-foreground/22'
            : 'border-foreground/14 text-foreground/66 hover:border-foreground/32 hover:text-foreground'
        }`}
      >
        <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        className="relative flex min-h-[52px] min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden rounded-full border border-foreground/36 bg-foreground/[0.18] px-5 font-body text-sm font-black uppercase tracking-[0.06em] text-foreground shadow-[0_18px_58px_hsl(var(--foreground)/0.18),inset_0_1px_0_hsl(var(--foreground)/0.12)] backdrop-blur-2xl transition-transform active:scale-[0.985] md:min-h-[48px] md:gap-4 md:px-5 md:text-xs"
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-foreground/[0.04] via-foreground/[0.14] to-foreground/[0.04] opacity-80" />
        <span className="truncate">{canGoNext ? compactNextLabel : 'Finish step'}</span>
        <span className="flex shrink-0 items-center gap-2">
          {total}
          <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </span>
      </button>
    </div>
  );
}

function SelectCard({ item, active, onClick, children, className = '', index = 0 }) {
  const Icon = item.icon;
  return (
    <motion.button
      type="button"
      layout
      custom={index}
      variants={CARD_REVEAL}
      initial="hidden"
      animate="show"
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.72, ease: EASE }}
      onClick={onClick}
      className={`av-glass-card relative isolate grid min-h-[112px] grid-rows-[3rem_2.75rem_auto] gap-y-5 overflow-hidden rounded-[1.25rem] border p-4 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_20px_80px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl transition-colors ${
        active
          ? 'border-foreground/42 bg-foreground/[0.14] text-foreground shadow-[0_22px_80px_hsl(var(--foreground)/0.14)]'
          : 'border-foreground/12 bg-background/48 text-foreground hover:border-foreground/24 hover:bg-background/62'
      } ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-foreground/[0.10] via-transparent to-transparent opacity-80" />
      {active && (
        <motion.span layoutId="active-booking-card" className="absolute inset-0 -z-10 bg-foreground/[0.10]" transition={{ duration: 0.42, ease: EASE }} />
      )}
      <div className="flex h-12 items-start justify-between gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            active ? 'border-foreground/28 bg-foreground/[0.10] text-foreground' : 'border-foreground/24 bg-foreground/[0.08] text-foreground/82'
          }`}
        >
          {Icon && <Icon className="h-6 w-6" strokeWidth={2.45} />}
        </div>
        {active && (
          <motion.span initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={CHECKOUT_MOTION}>
            <Check className="h-5 w-5" strokeWidth={2.55} />
          </motion.span>
        )}
      </div>
      <p className="flex h-11 items-end font-heading text-[2.05rem] uppercase leading-none tracking-normal md:text-[2.35rem]">{item.label}</p>
      <p className={`font-body text-lg font-bold leading-snug ${active ? 'text-foreground/78' : 'text-foreground/72'}`}>{item.sub}</p>
      {children}
    </motion.button>
  );
}

function OutcomeCard({ item, active, onClick, index = 0 }) {
  const Icon = item.icon;
  return (
    <motion.button
      type="button"
      layout
      initial={CARD_REVEAL.hidden}
      animate={{
        scale: active ? 1.012 : 1,
        opacity: active ? 1 : 0.92,
        y: 0,
      }}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2, scale: active ? 1.008 : 1.003 }}
      transition={{ duration: 0.42, delay: Math.min(index, 8) * 0.035, ease: EASE }}
      onClick={onClick}
      className={`av-glass-card group relative flex min-h-[96px] flex-col items-start justify-between gap-2 overflow-hidden rounded-[1.2rem] border p-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.13),0_24px_95px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl transition-colors md:min-h-[126px] md:flex-row md:items-center md:gap-4 md:rounded-[1.85rem] md:p-5 ${
        active
          ? 'border-foreground/40 bg-foreground/[0.13] text-foreground shadow-[0_28px_105px_hsl(var(--foreground)/0.18)]'
          : 'border-foreground/9 bg-background/30 text-foreground hover:border-foreground/20 hover:bg-background/48'
      }`}
      aria-pressed={active}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,hsl(var(--foreground)/0.15),transparent_34%),radial-gradient(circle_at_90%_80%,hsl(var(--foreground)/0.055),transparent_32%),linear-gradient(145deg,hsl(var(--foreground)/0.06),transparent_52%,hsl(var(--foreground)/0.026))] opacity-95" />
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-foreground/24 to-transparent" />
      {active && (
        <motion.span
          layoutId="active-outcome-card"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_50%,hsl(var(--foreground)/0.18),transparent_42%),linear-gradient(135deg,hsl(var(--foreground)/0.11),transparent_60%)]"
          transition={{ duration: 0.42, ease: EASE }}
        />
      )}
      {active && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-foreground/26" />}
      <span
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-16 md:w-16 md:rounded-2xl ${
          active ? 'border-foreground/34 bg-foreground/[0.13] text-foreground shadow-[0_0_38px_hsl(var(--foreground)/0.20)]' : 'border-foreground/14 bg-foreground/[0.055] text-foreground/90'
        }`}
      >
        <Icon className="h-5 w-5 md:h-7 md:w-7" strokeWidth={2.45} />
      </span>
      <span className="relative w-full min-w-0 pr-10 md:flex-1 md:pr-0">
        <span className="block break-normal font-heading text-[1.46rem] uppercase leading-[0.86] tracking-normal min-[420px]:text-[1.62rem] md:text-[2.35rem]">
          {item.label}
        </span>
      </span>
      <span
        className={`absolute right-3 top-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] transition-colors md:relative md:right-auto md:top-auto md:h-12 md:w-12 ${
          active ? 'border-foreground/28 bg-foreground/[0.14] text-foreground shadow-[0_0_32px_hsl(var(--foreground)/0.20)]' : 'border-foreground/14 bg-background/38 text-foreground/48 group-hover:text-foreground'
        }`}
      >
        {active ? (
          <motion.span initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={CHECKOUT_MOTION}>
            <Check className="h-5 w-5" strokeWidth={2.8} />
          </motion.span>
        ) : <ArrowRight className="h-5 w-5" strokeWidth={2.4} />}
      </span>
    </motion.button>
  );
}

function MoreGoalsAccordion({ items, activeKey, onChoose }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <div className="relative overflow-hidden rounded-[1.55rem] border border-foreground/12 bg-background/28 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_20px_80px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[72px] w-full items-center justify-between gap-4 px-4 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/14 bg-foreground/[0.055] text-foreground">
            <Plus className="h-5 w-5" strokeWidth={2.45} />
          </span>
          <span className="font-heading text-[2rem] uppercase leading-none tracking-normal">More</span>
        </span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-background/38 text-foreground/58">
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.4} />
        </span>
      </button>
      {open && (
        <SmoothDisclosure open>
          <div className="grid gap-2 border-t border-foreground/8 p-2.5 sm:grid-cols-2">
            {items.map((item, index) => (
              <OutcomeCard
                key={item.key}
                item={item}
                index={index}
                active={activeKey === item.key}
                onClick={() => onChoose(item.key)}
              />
            ))}
          </div>
        </SmoothDisclosure>
      )}
    </div>
  );
}

function ProductCard({ product, active, onSelect, onPrimary, recommendation = '', index = 0 }) {
  const Icon = product.icon || Droplets;
  const price = protocolPrice(product);
  return (
    <motion.div
      layout
      initial={CARD_REVEAL.hidden}
      animate={{
        scale: active ? 1.008 : 1,
        opacity: active ? 1 : 0.92,
        y: 0,
      }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.42, delay: Math.min(index, 8) * 0.035, ease: EASE }}
      className={`av-glass-card relative overflow-hidden rounded-[1.35rem] border p-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_24px_95px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl transition-colors md:rounded-[1.35rem] md:p-2.5 ${
        active ? 'border-foreground/40 bg-foreground/[0.13] text-foreground shadow-[0_28px_110px_hsl(var(--foreground)/0.16)]' : 'border-foreground/9 bg-background/30 text-foreground'
      }`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,hsl(var(--foreground)/0.16),transparent_38%),radial-gradient(circle_at_90%_80%,hsl(var(--foreground)/0.06),transparent_35%),linear-gradient(145deg,hsl(var(--foreground)/0.065),transparent_55%,hsl(var(--foreground)/0.026))]" />
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-foreground/24 to-transparent" />
      <button type="button" onClick={onSelect} aria-label={`Select ${product.label}`} className="block min-h-[60px] w-full text-left md:min-h-[64px]">
        <div className="flex items-center justify-between gap-3 md:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-10 md:w-10 md:rounded-xl ${
                active ? 'border-foreground/30 bg-foreground/[0.105] text-foreground' : 'border-foreground/16 bg-foreground/[0.055] text-foreground/86'
              }`}
            >
              <Icon className="h-5 w-5 md:h-4.5 md:w-4.5" strokeWidth={2.45} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-[1.65rem] uppercase leading-none tracking-normal md:text-[1.85rem]">{product.label}</p>
              <p className={`mt-0.5 font-body text-sm font-bold md:mt-1 md:text-sm ${active ? 'text-foreground/78' : 'text-foreground/72'}`}>{protocolDuration(product)}</p>
            </div>
          </div>
          <div className="flex min-w-[68px] shrink-0 flex-col items-end justify-center text-right md:min-w-[72px]">
            {recommendation && (
              <span className="mb-1 rounded-full border border-foreground/12 bg-background/38 px-1.5 py-0.5 font-body text-[9px] font-black uppercase leading-none tracking-[0.08em] text-foreground/66 backdrop-blur-2xl md:text-[9px]">
                {recommendation}
              </span>
            )}
            <p className="font-body text-[1.55rem] font-black leading-none md:text-2xl">{currency(price)}</p>
          </div>
        </div>
      </button>
      <div className="hidden">
        <button
          type="button"
          onClick={onPrimary}
          className={`min-h-[56px] w-full rounded-full font-body text-sm font-black uppercase tracking-[0.08em] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)] ${
            active ? 'border border-foreground/24 bg-foreground text-background' : 'border border-foreground/24 bg-foreground/[0.13] text-foreground backdrop-blur-2xl'
          }`}
        >
          Select
        </button>
      </div>
    </motion.div>
  );
}

function TherapyChoicePanel({ productOptions, activeKey, onSelect, onPrimary }) {
  const [openOther, setOpenOther] = useState(false);
  const activeOption = productOptions.find((item) => item.key === activeKey) || productOptions[0];
  const otherOptions = productOptions.filter((item) => item.key !== activeOption?.key);

  useEffect(() => {
    setOpenOther(false);
  }, [activeKey]);

  if (!activeOption) return null;

  return (
    <div className="grid gap-2 md:gap-2">
      <ProductCard
        key={activeOption.key}
        product={activeOption}
        index={0}
        active
        onSelect={() => onSelect(activeOption.key)}
        onPrimary={() => onPrimary(activeOption.key)}
        recommendation="Selected"
      />
      {otherOptions.length > 0 && (
        <div className="overflow-hidden rounded-[1.25rem] border border-foreground/12 bg-background/30 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl md:rounded-[1.1rem]">
          <button
            type="button"
            onClick={() => setOpenOther((value) => !value)}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 px-3 text-left md:min-h-[58px] md:px-3"
            aria-expanded={openOther}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.055] text-foreground/86 md:h-9 md:w-9 md:rounded-xl">
                <Plus className="h-4 w-4 md:h-4 md:w-4" strokeWidth={2.45} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-heading text-[1.55rem] uppercase leading-none tracking-normal md:text-[1.55rem]">Change therapy</span>
                <span className="mt-0.5 block font-body text-xs font-bold text-foreground/62 md:mt-1 md:text-xs">{otherOptions.length} alternatives</span>
              </span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-background/38 text-foreground/58 md:h-8 md:w-8">
              <ChevronDown className={`h-4 w-4 transition-transform md:h-4 md:w-4 ${openOther ? 'rotate-180' : ''}`} strokeWidth={2.35} />
            </span>
          </button>
          <SmoothDisclosure open={openOther}>
            <div className="grid gap-2 border-t border-foreground/8 p-2.5">
              {otherOptions.map((item, index) => (
                <ProductCard
                  key={item.key}
                  product={item}
                  index={index + 1}
                  active={activeKey === item.key}
                  onSelect={() => onSelect(item.key)}
                  onPrimary={() => onPrimary(item.key)}
                  recommendation="Alternative"
                />
              ))}
            </div>
          </SmoothDisclosure>
        </div>
      )}
    </div>
  );
}

function CustomTreatmentBuilder({
  baseKey,
  onBase,
}) {
  const activeBase = CUSTOM_BASE_OPTIONS.find((item) => item.key === baseKey) || CUSTOM_BASE_OPTIONS[0];
  const activeProtocol = safeProtocol(getProductByKey(activeBase.productKey));

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-[1rem] border border-foreground/12 bg-background/50 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-foreground/68">Base IV</p>
            <p className="mt-1 truncate font-heading text-3xl uppercase leading-none">{activeBase.label}</p>
          </div>
          <p className="shrink-0 font-heading text-3xl leading-none">{currency(protocolPrice(activeProtocol))}</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[1rem] border border-foreground/12 bg-background/50 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
        <p className="relative font-body text-xs font-bold uppercase tracking-[0.16em] text-foreground/68">Choose IV</p>
        <div className="relative mt-3 grid gap-2 md:grid-cols-2">
          {CUSTOM_BASE_OPTIONS.map((item) => {
            const Icon = item.icon;
            const protocol = safeProtocol(getProductByKey(item.productKey));
            const active = baseKey === item.key;
            return (
              <motion.button
                key={item.key}
                type="button"
                layout
                whileTap={{ scale: 0.985 }}
                onClick={() => onBase(item.key)}
                aria-pressed={active}
                className={`relative flex min-h-[86px] items-center gap-3 overflow-hidden rounded-2xl border px-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl transition-colors ${
                  active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/12 bg-background/45 text-foreground hover:border-foreground/24'
                }`}
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
                <span
                  className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                    active ? 'border-foreground/28 bg-foreground/[0.10]' : 'border-foreground/14 bg-foreground/[0.05]'
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.45} />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-heading text-3xl uppercase leading-none">{item.label}</span>
                  <span className={`mt-1 block font-body text-sm font-bold ${active ? 'text-foreground/72' : 'text-foreground/62'}`}>
                    {currency(protocolPrice(protocol))}{item.badge ? ` · ${item.badge}` : ''}
                  </span>
                </span>
                {active && <Check className="relative h-5 w-5 shrink-0" strokeWidth={2.8} />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CustomSubscriptionBuilder({ sessions, estimate, serviceLabel, onSessions }) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-[1rem] border border-foreground/12 bg-background/50 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-foreground/68">Times per month</p>
          <p className="mt-1 truncate font-heading text-3xl uppercase leading-none">{serviceLabel}</p>
        </div>
        <p className="shrink-0 text-right font-heading text-3xl leading-none">{currency(estimate)}<span className="font-body text-xs font-bold uppercase tracking-[0.1em] text-foreground/58"> / mo</span></p>
      </div>
      <div className="relative mt-3 grid gap-2 md:grid-cols-2">
        {CUSTOM_SUBSCRIPTION_VISITS.map((item) => {
          const Icon = item.icon;
          const active = Number(sessions) === item.key;
          return (
            <motion.button
              key={item.key}
              type="button"
              layout
              whileTap={{ scale: 0.985 }}
              onClick={() => onSessions(item.key)}
              aria-pressed={active}
              className={`flex min-h-[66px] items-center justify-between gap-3 rounded-2xl border px-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl transition-colors ${
                active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/12 bg-background/45 text-foreground hover:border-foreground/24'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    active ? 'border-foreground/24 bg-foreground/[0.08]' : 'border-foreground/12 bg-foreground/[0.05]'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.45} />
                </span>
                <span className="truncate font-heading text-[1.55rem] uppercase leading-none tracking-normal">{item.label}</span>
              </span>
              {active && <Check className="h-5 w-5 shrink-0" strokeWidth={2.8} />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function buildAddonCatalog(product) {
  const allowAdvanced = product?.key !== 'nad';
  const ivAddons = IV_ADDONS
    .filter((item) => item.group !== 'cbd')
    .filter((item) => allowAdvanced || item.group !== 'nad')
    .map((item) => ({ ...item, type: 'addon', cartKey: `addon-${item.label}` }));
  const imShots = IM_SHOTS.map((item) => ({ ...item, type: 'im', cartKey: `im-${item.label}` }));
  const byLabel = new Map([...ivAddons, ...imShots].map((item) => [item.label, item]));

  const toChoice = ({ source, label, desc, icon }) => ({
    ...source,
    label,
    desc: desc || source.desc,
    icon: icon || source.icon || Plus,
    originalLabel: source.label,
    cartKey: source.cartKey || `${source.type}-${source.label}`,
  });

  const ivChoices = [
    { source: byLabel.get('Extra Fluid'), label: 'Extra fluids', desc: 'More fluid', icon: Droplets },
    { source: byLabel.get('Glutathione Push · 600mg'), label: 'Glutathione IV', desc: 'IV push', icon: ShieldCheck },
    allowAdvanced && { source: byLabel.get('NAD+ (250mg)'), label: 'NAD+ IV', desc: 'Longer visit', icon: BatteryCharging },
  ]
    .filter((item) => item?.source)
    .map(toChoice);

  const imChoices = [
    { source: byLabel.get('B12'), label: 'B12 shot', desc: 'Quick shot', icon: Zap },
    { source: byLabel.get('MIC'), label: 'MIC shot', desc: 'Metabolic support', icon: Flame },
    allowAdvanced && { source: byLabel.get('NAD+'), label: 'NAD+ IM', desc: 'Quick NAD+', icon: BatteryCharging },
    { source: byLabel.get('Glutathione IM · 200mg'), label: 'Glutathione IM', desc: 'Quick antioxidant', icon: Sparkles },
  ]
    .filter((item) => item?.source)
    .map(toChoice);

  const groups = [
    {
      key: 'iv',
      label: 'IV add-ons',
      sub: 'IV',
      icon: Droplets,
      items: ivChoices,
    },
    {
      key: 'im',
      label: 'IM add-ons',
      sub: 'IM',
      icon: Syringe,
      items: imChoices,
    },
  ];

  return {
    all: [...ivChoices, ...imChoices],
    groups,
  };
}

function AddOnGroup({ group, defaultOpen = false, selectedCount, selectedLabels, onToggle }) {
  const [open, setOpen] = useState(defaultOpen || selectedCount > 0);

  useEffect(() => {
    if (selectedCount > 0) setOpen(true);
  }, [selectedCount]);

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.035]"
      >
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-foreground/80">{group.label}</p>
          <p className="mt-1 font-body text-sm font-medium text-foreground/62">{group.sub}</p>
        </div>
        <span className="shrink-0 rounded-full border border-foreground/10 px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/68">
          {selectedCount ? `${selectedCount} picked` : open ? 'Hide' : 'Show'}
        </span>
      </button>
      <SmoothDisclosure open={open}>
        <div className="grid gap-2 border-t border-foreground/8 p-3 sm:grid-cols-2">
          {group.items.map((item) => {
            const active = selectedLabels.includes(item.label);
            return (
              <button
                key={`${group.key}-${item.label}`}
                type="button"
                onClick={() => onToggle(item.label)}
                className={`flex min-h-[62px] items-center justify-between gap-3 rounded-2xl border px-3 text-left transition-colors ${
                  active ? 'border-foreground/40 bg-foreground/[0.14] text-foreground' : 'border-foreground/10 bg-background/35 text-foreground hover:border-foreground/22'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-heading text-[1.25rem] uppercase leading-none tracking-normal">{item.label}</span>
                  <span className={`mt-1 block truncate font-body text-xs font-medium ${active ? 'text-foreground/68' : 'text-foreground/58'}`}>{item.desc || item.type}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 font-body text-sm font-bold">
                  {currency(item.price)}
                  {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      </SmoothDisclosure>
    </div>
  );
}

function AddOnDecisionPanel({ groups, state, selectedAddons, subtotal, onNone, onToggle }) {
  const selectedRevenue = selectedAddons.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const hasDecision = Boolean(state.addOnDecision);
  const noAddonsSelected = hasDecision && selectedAddons.length === 0;
  const [openGroups, setOpenGroups] = useState(() => (
    groups.reduce((next, group) => {
      next[group.key] = group.items.some((item) => state.addOns.includes(item.label));
      return next;
    }, {})
  ));

  const toggleGroup = (key) => {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="grid gap-2.5">
      <button
        type="button"
        onClick={onNone}
        className={`group relative flex min-h-[78px] items-center justify-between gap-4 overflow-hidden rounded-[1.35rem] border px-4 py-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_20px_80px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl transition-colors ${
          noAddonsSelected
            ? 'border-foreground/42 bg-foreground/[0.16] text-foreground shadow-[0_22px_80px_hsl(var(--foreground)/0.14)]'
            : 'border-foreground/12 bg-background/50 text-foreground hover:border-foreground/24'
        }`}
      >
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.13),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.07),transparent_55%,hsl(var(--foreground)/0.03))]" />
        <span className="relative flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
            noAddonsSelected ? 'border-foreground/24 bg-foreground/[0.08]' : 'border-foreground/10 bg-background/30 group-hover:border-foreground/24'
          }`}>
            {noAddonsSelected ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </span>
          <span className="block font-heading text-[2rem] uppercase leading-none tracking-normal">No extras</span>
        </span>
        <span className="relative rounded-full border border-foreground/12 bg-background/34 px-3 py-1.5 font-body text-xs font-black uppercase tracking-[0.1em] text-foreground/72">
          Fast
        </span>
      </button>

      <div className="grid gap-2.5">
        {groups.map((group) => {
          const selectedCount = group.items.filter((item) => state.addOns.includes(item.label)).length;
          const open = Boolean(openGroups[group.key] || selectedCount > 0);
          return (
            <section
              key={group.key}
              className="relative overflow-hidden rounded-[1.15rem] border border-foreground/12 bg-background/40 p-2.5 pt-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_16px_60px_hsl(var(--foreground)/0.055)] backdrop-blur-2xl"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent" />
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="relative flex min-h-[62px] w-full items-center justify-between gap-3 px-1 text-left"
                aria-expanded={open}
              >
                <span className="truncate font-body text-sm font-black uppercase tracking-[0.14em] text-foreground/70">
                  {group.label}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {selectedCount > 0 && (
                    <span className="rounded-full border border-foreground/12 px-2.5 py-1 font-body text-[11px] font-black uppercase tracking-[0.08em] text-foreground/70">
                      {selectedCount}
                    </span>
                  )}
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/12 bg-background/38 text-foreground/58">
                    <ChevronDown className={`h-4.5 w-4.5 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.4} />
                  </span>
                </span>
              </button>
              <SmoothDisclosure open={open}>
                <div className="relative grid grid-cols-2 gap-1.5 border-t border-foreground/8 pt-2.5 sm:grid-cols-1 md:grid-cols-2">
                  {group.items.map((item) => {
                    const active = state.addOns.includes(item.label);
                    const Icon = item.icon || Plus;
                    return (
                      <button
                        key={`${group.key}-${item.label}`}
                        type="button"
                        onClick={() => onToggle(item.label)}
                        className={`relative flex min-h-[96px] flex-col justify-between overflow-hidden rounded-[0.875rem] border p-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl transition-colors ${
                          active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/12 bg-background/48 text-foreground hover:border-foreground/24'
                        }`}
                      >
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent" />
                        <span className="relative flex items-center justify-between gap-2">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                            active ? 'border-foreground/24 bg-foreground/[0.08]' : 'border-foreground/12 bg-foreground/[0.05]'
                          }`}>
                            <Icon className="h-4.5 w-4.5" strokeWidth={2.45} />
                          </span>
                          {active ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.7} /> : <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />}
                        </span>
                        <span className="relative mt-2 min-w-0">
                          <span className="block truncate font-heading text-[1.45rem] uppercase leading-none tracking-normal md:text-[1.6rem]">{item.label}</span>
                          <span className={`mt-0.5 block truncate font-body text-base font-black ${active ? 'text-foreground/80' : 'text-foreground/72'}`}>
                            {currency(item.price)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SmoothDisclosure>
            </section>
          );
        })}
      </div>
      <div className="relative overflow-hidden rounded-[1rem] border border-foreground/12 bg-background/44 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-xl">
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-transparent to-transparent" />
        <div className="relative grid gap-2 font-body text-base font-bold">
          {selectedAddons.length > 0 && (
            <div className="flex items-center justify-between gap-3 text-foreground/66">
              <span>Extras</span>
              <span>{selectedAddons.length} / {currency(selectedRevenue)}</span>
            </div>
          )}
          <div className={`flex items-center justify-between gap-3 ${selectedAddons.length > 0 ? 'mt-1 border-t border-foreground/10 pt-3' : ''}`}>
            <span className="font-body text-base font-black text-foreground/72">Total</span>
            <span className="font-body text-[2.5rem] font-black leading-none text-foreground">{currency(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function outcomeForProtocol(protocolKey) {
  return OUTCOMES.find((item) => item.productKeys.includes(protocolKey)) || OUTCOMES[0];
}

function formatGfeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatContactLine({ name = '', phone = '', email = '' } = {}) {
  return [name, phone, email].filter(Boolean).join(', ');
}

function formatDobInput(value = '') {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDob(value = '') {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function hasFullName(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length >= 2;
}

function hasDob(value) {
  const date = parseDob(value);
  return Boolean(date) && !Number.isNaN(date.getTime()) && date < new Date();
}

function TextInput({ label, value, onChange, onKeyDown, placeholder, type = 'text', required = false, autoComplete, inputMode, autoFocus = false, actionLabel, onAction, compact = false }) {
  return (
    <div className="block">
      <div className="flex min-h-[18px] items-center justify-between gap-2 md:min-h-[22px]">
        <span className={`font-body font-extrabold tracking-[0.02em] text-foreground/76 ${compact ? 'text-[11px] md:text-xs' : 'text-sm'}`}>{label}</span>
        {actionLabel && onAction && !value && (
          <button
            type="button"
            onClick={(event) => {
              onAction();
            }}
            className="rounded-full border border-foreground/12 px-3 py-1 font-body text-[11px] font-black uppercase tracking-[0.08em] text-foreground/72"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <input
        aria-label={label}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoFocus={autoFocus}
        className={`mt-0.5 w-full rounded-2xl border border-foreground/14 bg-foreground/[0.04] px-3.5 font-body font-semibold text-foreground placeholder:text-foreground/52 outline-none transition-colors focus:border-foreground/40 md:mt-1 md:min-h-[50px] md:px-4 md:text-lg ${
          compact ? 'min-h-[40px] text-sm md:min-h-[44px] md:text-base' : 'min-h-[52px] text-lg'
        }`}
      />
    </div>
  );
}

function AddressPrediction({ suggestion, onUse, compact = false }) {
  if (!suggestion) return null;
  const Icon = LOCATION_TYPES.find((type) => type.key === suggestion.locationType)?.icon || MapPin;
  return (
    <button
      type="button"
      onClick={() => onUse(suggestion)}
      className={`relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-foreground/28 bg-foreground/[0.13] px-3 text-left text-foreground shadow-[0_18px_70px_hsl(var(--foreground)/0.10),inset_0_1px_0_hsl(var(--foreground)/0.10)] backdrop-blur-2xl transition-transform active:scale-[0.99] md:px-3 ${
        compact ? 'min-h-[54px]' : 'min-h-[64px]'
      }`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,hsl(var(--foreground)/0.13),transparent_36%),linear-gradient(135deg,hsl(var(--foreground)/0.06),transparent_58%,hsl(var(--foreground)/0.03))]" />
      <span className="relative flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/16 bg-foreground/[0.06] text-foreground/88 md:h-9 md:w-9">
          <Icon className="h-4 w-4 md:h-4 md:w-4" strokeWidth={2.35} />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-foreground/64">
            Use this address
          </span>
          <span className="mt-1 block truncate font-body text-base font-black leading-tight md:text-base">{suggestion.address}</span>
        </span>
      </span>
      {suggestion.zip && (
        <span className="relative shrink-0 rounded-full border border-foreground/18 bg-background/24 px-3 py-1.5 font-body text-sm font-black uppercase tracking-[0.08em] text-foreground/84">
          {suggestion.zip}
        </span>
      )}
    </button>
  );
}

function ClientReusePanel({ signedIn, lastBooking, savedContact, savedAddress, onRepeat, onSavedInfo }) {
  if (!signedIn) return null;
  const canRepeat = Boolean(lastBooking?.protocolKey || lastBooking?.service);
  const canUseSaved = Boolean(savedContact?.name || savedContact?.email || savedContact?.phone || savedAddress?.address);
  if (!canRepeat && !canUseSaved) return null;

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      {canRepeat && (
        <button
          type="button"
          onClick={onRepeat}
          className="relative flex min-h-[64px] items-center justify-between gap-3 overflow-hidden rounded-2xl border border-foreground/12 bg-background/48 px-4 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-2xl transition-colors hover:border-foreground/24"
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent" />
          <span className="relative min-w-0">
            <span className="block font-body text-sm font-black text-foreground">Repeat last visit</span>
            <span className="mt-0.5 block truncate font-body text-xs font-bold text-foreground/62">{lastBooking.service || 'Saved protocol'}</span>
          </span>
          <ArrowRight className="relative h-4.5 w-4.5 shrink-0" />
        </button>
      )}
      {canUseSaved && (
        <button
          type="button"
          onClick={onSavedInfo}
          className="relative flex min-h-[64px] items-center justify-between gap-3 overflow-hidden rounded-2xl border border-emerald-300/16 bg-emerald-300/[0.055] px-4 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-2xl transition-colors hover:border-emerald-200/28"
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-200/[0.06] via-transparent to-transparent" />
          <span className="relative min-w-0">
            <span className="block font-body text-sm font-black text-foreground">Use saved info</span>
            <span className="mt-0.5 block truncate font-body text-xs font-bold text-foreground/62">{savedAddress?.address || savedContact?.name || 'Saved profile'}</span>
          </span>
          <Check className="relative h-4.5 w-4.5 shrink-0" />
        </button>
      )}
    </div>
  );
}

function ClientPathHint({ signedIn, hasSavedVisit, gfeReady, onSignIn }) {
  if (signedIn) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/16 bg-emerald-300/[0.055] px-3 py-2.5">
        <div className="min-w-0">
          <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-emerald-100/82">Signed in</p>
          <p className="mt-0.5 truncate font-body text-sm font-medium text-foreground/72">
            {hasSavedVisit ? 'Saved.' : gfeReady ? 'Review valid.' : 'Review needed.'}
          </p>
        </div>
        <Check className="h-4 w-4 shrink-0 text-emerald-100/72" strokeWidth={2.5} />
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-body text-sm font-bold text-foreground/76">Returning?</p>
      </div>
      <button
        type="button"
        onClick={onSignIn}
        className="min-h-[44px] shrink-0 rounded-full border border-foreground/14 px-4 font-body text-xs font-bold uppercase tracking-[0.1em] text-foreground/76"
      >
        Sign in
      </button>
    </div>
  );
}

function SavedAddressShortcut({ signedIn, savedAddress, onUse, onSignIn }) {
  if (signedIn && savedAddress?.address) {
    return (
      <button
        type="button"
        onClick={() => onUse(savedAddress)}
        className="mb-3 flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border border-emerald-300/16 bg-emerald-300/[0.055] px-4 text-left transition-colors hover:border-emerald-200/28"
      >
        <span className="min-w-0">
          <span className="block font-body text-xs font-bold uppercase tracking-[0.14em] text-emerald-100/82">Saved address</span>
          <span className="mt-1 block truncate font-body text-base font-medium text-foreground/82">{savedAddress.address}</span>
        </span>
        <span className="shrink-0 rounded-full border border-emerald-200/16 px-3 py-1.5 font-body text-xs font-bold uppercase tracking-[0.1em] text-emerald-100/82">
          Use
        </span>
      </button>
    );
  }

  if (!signedIn) {
    return null;
  }

  return (
    <div className="mb-3 rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.045] px-4 py-3">
      <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-emerald-100/82">Signed in</p>
      <p className="mt-1 font-body text-sm font-medium text-foreground/70">Saved next time.</p>
    </div>
  );
}

function ClientFastLane({ state, profileGfe, hasSavedVisit, signedIn, onChoose }) {
  return (
    <div className="mb-4 inline-grid grid-cols-2 gap-1 rounded-full border border-foreground/10 bg-foreground/[0.025] p-1">
      {CLIENT_TYPES.map((item) => {
        const returning = item.key === 'returning';
        const active = returning ? signedIn && state.clientType === item.key : state.clientType === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChoose(item.key)}
            aria-label={`${item.label} client`}
            className={`min-h-[42px] rounded-full px-4 text-center transition-colors ${
              active
                ? 'border border-foreground/28 bg-foreground/[0.14] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)] backdrop-blur-xl'
                : 'text-foreground/58 hover:text-foreground'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5 font-body text-xs font-bold uppercase tracking-[0.1em]">
              <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
              {item.label}
            </span>
            <span className={`mt-0.5 block font-body text-[11px] font-semibold uppercase tracking-[0.08em] ${active ? 'text-foreground/66' : 'text-foreground/58'}`}>
              {returning ? (signedIn ? (hasSavedVisit ? 'Saved' : profileGfe.required ? 'Review' : 'Ready') : 'Sign in') : 'First'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function VisitForSelector({ value, onChoose }) {
  const activeOption = WHO_OPTIONS.find((item) => item.key === value) || WHO_OPTIONS[0];
  const copy = {
    me: 'You',
    other: 'Someone else',
    group: 'Group',
  };

  return (
    <div className="mb-2 rounded-[1rem] border border-foreground/12 bg-background/48 p-1.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl md:mb-2 md:p-2">
      <div className="hidden">
        <div className="min-w-0">
          <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-foreground/62">Who</p>
          <p className="mt-1 truncate font-heading text-[1.45rem] uppercase leading-none tracking-normal text-foreground">{copy[value] || activeOption.label}</p>
        </div>
        <span className="rounded-full border border-foreground/12 px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/68">
          {activeOption.label}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-1.5">
        {WHO_OPTIONS.map((item) => {
          const Icon = item.icon;
          const active = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChoose(item.key)}
              aria-pressed={active}
              className={`relative flex min-h-[42px] flex-row items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-2 text-center shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl transition-colors active:scale-[0.985] md:min-h-[44px] md:gap-1.5 ${
                active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/14 bg-background/45 text-foreground/72 hover:border-foreground/24'
              }`}
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent" />
              <Icon className="relative h-4 w-4 md:h-4 md:w-4" strokeWidth={2.55} />
              <span className="relative font-body text-[11px] font-extrabold uppercase tracking-[0.1em]">{item.label}</span>
              {active && <Check className="hidden" strokeWidth={2.8} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LocationTypeDropdown({ value, onChange }) {
  const selected = LOCATION_TYPES.find((item) => item.key === value) || LOCATION_TYPES[0];
  const Icon = selected.icon || Home;

  return (
    <label className="relative mb-2 flex min-h-[48px] cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl border border-foreground/12 bg-background/46 px-3 text-left text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl transition-colors hover:border-foreground/24 hover:bg-background/58 md:mb-2 md:min-h-[50px] md:rounded-xl md:px-3">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.075] via-transparent to-transparent" />
      <span className="relative flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.055] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-9 md:w-9 md:rounded-xl">
          <Icon className="h-4 w-4 md:h-4 md:w-4" strokeWidth={2.45} />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/58">Place</span>
          <span className="mt-0.5 block truncate font-heading text-[1.45rem] uppercase leading-none tracking-normal md:mt-1 md:text-[1.55rem]">{selected.label}</span>
        </span>
      </span>
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-background/42 text-foreground/84 md:h-8 md:w-8">
        <ChevronDown className="h-4 w-4 md:h-4 md:w-4" strokeWidth={2.4} />
      </span>
      <select
        aria-label="Choose visit place"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      >
        {LOCATION_TYPES.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RetentionChoice({ state, plan, term, termPrice, monthlyPrice, customSessions, customEstimate, serviceLabel, onType, onPlan, onTerm, onCustomSessions }) {
  const [openPlans, setOpenPlans] = useState(false);
  const choices = [
    { key: 'one-time', label: 'One visit', value: 'Full checkout', icon: Calendar },
    { key: 'subscription', label: 'Membership', value: `${currency(monthlyPrice)}/mo · 3 mo min`, icon: Sparkles },
  ];

  return (
    <div className="mb-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((item) => {
          const active = state.visitType === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onType(item.key)}
              className={`min-h-[72px] rounded-[1rem] border px-4 py-3 text-left transition-colors ${
                active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/10 bg-background/35 text-foreground hover:border-foreground/24'
              }`}
            >
              <span className={`flex items-center gap-1.5 font-body text-xs font-bold uppercase tracking-[0.1em] ${active ? 'text-foreground/66' : 'text-foreground/62'}`}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2.35} />
                {item.value}
              </span>
              <span className="mt-1 block font-heading text-[2.45rem] uppercase leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
      {state.visitType === 'subscription' && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-foreground/12 bg-background/45 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-body text-sm font-extrabold text-foreground/76">Plan</p>
              <p className="mt-1 truncate font-heading text-3xl uppercase leading-none text-foreground">
                {plan.label} · {term.key === 'monthly' ? `${currency(monthlyPrice)}/mo` : `${currency(termPrice)} today`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenPlans((value) => !value)}
              className="min-h-[48px] shrink-0 rounded-full border border-foreground/14 px-4 font-body text-xs font-bold uppercase tracking-[0.08em] text-foreground/76"
            >
              Change
            </button>
          </div>
          <SmoothDisclosure open={openPlans}>
            <div className="mt-3 grid gap-2 sm:grid-cols-1 md:grid-cols-2">
              {MEMBERSHIP_OPTIONS.map((item) => {
                const active = state.planKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onPlan(item.key);
                      setOpenPlans(false);
                    }}
                    className={`min-h-[58px] rounded-2xl border px-3 text-left transition-colors ${
                    active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/10 text-foreground/64 hover:border-foreground/24'
                    }`}
                  >
                    <span className="block truncate font-body text-xs font-bold uppercase tracking-[0.08em]">{item.label}</span>
                    <span className={`mt-1 block font-body text-xs font-semibold ${active ? 'text-foreground/70' : 'text-foreground/62'}`}>{item.custom ? `${currency(customEstimate)}/mo` : `${currency(item.price)}/mo`}</span>
                  </button>
                );
              })}
            </div>
          </SmoothDisclosure>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {SUBSCRIPTION_TERMS.map((item) => {
              const active = state.subscriptionTerm === item.key;
              const price = subscriptionTermPrice(monthlyPrice, item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTerm(item.key)}
                  className={`min-h-[58px] rounded-2xl border px-2 text-left transition-colors ${
                    active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/10 text-foreground/64 hover:border-foreground/24'
                  }`}
                >
                  <span className="block truncate font-body text-[10px] font-black uppercase tracking-[0.08em]">{item.label}</span>
                  <span className="mt-1 block font-body text-xs font-black">{item.key === 'monthly' ? `${currency(monthlyPrice)}/mo` : currency(price)}</span>
                  <span className="mt-0.5 block truncate font-body text-[9px] font-bold uppercase tracking-[0.08em] text-foreground/48">
                    {item.key === 'monthly' ? '3 mo min' : `${Math.round(item.discount * 100)}% off`}
                  </span>
                </button>
              );
            })}
          </div>
          {plan.custom && (
            <CustomSubscriptionBuilder
	              sessions={customSessions}
	              estimate={customEstimate}
	              serviceLabel={serviceLabel}
	              onSessions={onCustomSessions}
	            />
          )}
        </div>
      )}
    </div>
  );
}

function ClinicalReviewCard({ bookingGfeRequirement }) {
  const valid = !bookingGfeRequirement.required;
  return (
    <div className="relative mb-3 overflow-hidden rounded-2xl border border-foreground/12 bg-background/50 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
      <div className="relative flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${valid ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100' : 'border-amber-300/24 bg-amber-300/[0.06] text-amber-200'}`}>
          <ShieldCheck className="h-6 w-6" strokeWidth={2.35} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading text-3xl uppercase leading-none text-foreground">Clinical Review</p>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 font-body text-xs font-bold uppercase tracking-[0.08em] ${valid ? 'border-emerald-300/20 text-emerald-100' : 'border-amber-300/24 text-amber-200'}`}>
              {valid ? 'Valid' : 'Needed'}
            </span>
          </div>
          <p className="mt-1 font-body text-base font-semibold leading-snug text-foreground/72">
            {valid
              ? (bookingGfeRequirement.expiresAt ? `Valid through ${formatGfeDate(bookingGfeRequirement.expiresAt)}.` : 'Valid.')
              : 'Needed.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FastHoldPanel({ product, serviceLabel, subtotal, balanceDue, onContinue, onChange }) {
  const Icon = product?.icon || Droplets;
  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={onContinue}
        className="group relative overflow-hidden rounded-[1.45rem] border border-foreground/18 bg-foreground/[0.11] p-4 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_22px_82px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl transition-colors hover:border-foreground/34"
      >
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--foreground)/0.16),transparent_38%),linear-gradient(145deg,hsl(var(--foreground)/0.07),transparent_58%,hsl(var(--foreground)/0.025))]" />
        <div className="relative flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/18 bg-foreground/[0.07] text-foreground">
            <Icon className="h-6 w-6" strokeWidth={2.45} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-xs font-black uppercase tracking-[0.16em] text-foreground/62">Checkout</span>
            <span className="mt-2 block font-heading text-[2.6rem] uppercase leading-none tracking-normal text-foreground">{serviceLabel}</span>
            <span className="mt-2 block font-body text-base font-bold text-foreground/70">ASAP</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-body text-xs font-black uppercase tracking-[0.12em] text-foreground/58">Due today</span>
            <span className="mt-1 block font-heading text-4xl leading-none text-foreground">{currency(subtotal)}</span>
          </span>
        </div>
        <div className="relative mt-4 grid gap-2 rounded-2xl border border-foreground/10 bg-background/34 p-3 font-body text-sm font-bold text-foreground/68">
          <div className="flex items-center justify-between gap-3">
            <span>Secure checkout</span>
            <span>{currency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Due at visit</span>
            <span>{currency(0)}</span>
          </div>
        </div>
        <p className="relative mt-3 font-body text-xs font-semibold leading-snug text-foreground/56">
          Clinical review required.
        </p>
      </button>
      <button
        type="button"
        onClick={onChange}
        className="min-h-[48px] rounded-full border border-foreground/12 px-4 font-body text-xs font-black uppercase tracking-[0.12em] text-foreground/68"
      >
        Change therapy
      </button>
    </div>
  );
}

function ContactConfirmCard({ state, onChange, savedContact }) {
  const hasContact = Boolean(hasFullName(state.name) && hasDob(state.dob) && state.email.includes('@') && state.phone.replace(/\D/g, '').length >= 10);
  const [editing, setEditing] = useState(!hasContact);
  const hasSavedContact = Boolean(savedContact?.name || savedContact?.email || savedContact?.phone);

  useEffect(() => {
    if (!hasContact) setEditing(true);
  }, [hasContact]);

  const updateContactField = (field, value) => {
    const next = { name: state.name, phone: state.phone, email: state.email, [field]: value };
    onChange(field, value);
    onChange('contactLine', formatContactLine(next));
  };

  const useSavedContact = () => {
    const next = {
      name: savedContact?.name || '',
      phone: formatPhoneNumber(savedContact?.phone || ''),
      email: savedContact?.email || '',
    };
    onChange('name', next.name);
    onChange('phone', next.phone);
    onChange('email', next.email);
    onChange('contactLine', formatContactLine(next));
  };

  if (!editing) {
    return (
      <div className="relative mb-3 overflow-hidden rounded-2xl border border-foreground/12 bg-background/50 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-3xl uppercase leading-none text-foreground">You</p>
            <div className="mt-3 grid gap-2 font-body text-base font-semibold text-foreground/76">
              <span className="flex min-w-0 items-center gap-2"><User className="h-4.5 w-4.5 shrink-0" /> <span className="truncate">{state.name}</span></span>
              <span className="flex min-w-0 items-center gap-2"><Calendar className="h-4.5 w-4.5 shrink-0" /> <span className="truncate">{state.dob}</span></span>
              <span className="flex min-w-0 items-center gap-2"><Phone className="h-4.5 w-4.5 shrink-0" /> <span className="truncate">{state.phone}</span></span>
              <span className="flex min-w-0 items-center gap-2"><Mail className="h-4.5 w-4.5 shrink-0" /> <span className="truncate">{state.email}</span></span>
              {state.emergencyContact && (
                <span className="flex min-w-0 items-center gap-2"><UserPlus className="h-4.5 w-4.5 shrink-0" /> <span className="truncate">{state.emergencyContact}</span></span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-full border border-foreground/14 px-4 font-body text-xs font-bold uppercase tracking-[0.08em] text-foreground/76"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-3 overflow-hidden rounded-2xl border border-foreground/12 bg-background/50 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
      <p className="relative mb-3 font-body text-sm font-semibold leading-snug text-foreground/68">
        Used for receipt and nurse follow-up.
      </p>
      <div className="relative grid gap-2 md:grid-cols-2 md:gap-3">
        <div className="col-span-2">
          <TextInput
            label="Name"
            value={state.name}
            onChange={(value) => updateContactField('name', value)}
            placeholder="Alex Morgan"
            autoComplete="name"
            actionLabel={hasSavedContact ? 'Saved' : ''}
            onAction={useSavedContact}
            compact
            required
          />
        </div>
        <TextInput
          label="Phone"
          value={state.phone}
          onChange={(value) => updateContactField('phone', value)}
          placeholder="(415) 555-0123"
          autoComplete="tel"
          inputMode="tel"
          type="tel"
          compact
          required
        />
        <TextInput
          label="DOB"
          value={state.dob}
          onChange={(value) => onChange('dob', formatDobInput(value))}
          placeholder="MM/DD/YYYY"
          autoComplete="bday"
          inputMode="numeric"
          compact
          required
        />
        <div className="col-span-2">
          <TextInput
            label="Email"
            value={state.email}
            onChange={(value) => updateContactField('email', value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            type="email"
            compact
            required
          />
        </div>
      </div>
      {hasContact && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="relative mt-3 min-h-[48px] rounded-full border border-foreground/34 bg-foreground/[0.16] px-5 font-body text-xs font-bold uppercase tracking-[0.08em] text-foreground shadow-[0_14px_44px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl"
        >
          Done
        </button>
      )}
    </div>
  );
}

function SafetyFlagChoice({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mb-3 overflow-hidden rounded-2xl border border-foreground/12 bg-background/50 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="font-body text-sm font-black uppercase tracking-[0.12em] text-foreground/68">Safety</p>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="min-h-[38px] rounded-full border border-foreground/12 px-3 font-body text-[11px] font-black uppercase tracking-[0.1em] text-foreground/62"
        >
          {open ? 'Hide' : 'View'}
        </button>
      </div>
      <div className="relative mt-3 grid gap-2 md:grid-cols-2">
        {[
          { key: 'none', label: 'No' },
          { key: 'call', label: 'Yes' },
        ].map((item) => {
          const active = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-pressed={active}
              className={`min-h-[58px] rounded-2xl border px-3 text-left font-body text-sm font-black shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] transition-colors ${
                active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/12 bg-background/42 text-foreground/72'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <SmoothDisclosure open={open}>
        <div className="relative mt-3 rounded-2xl border border-foreground/10 bg-background/38 p-3">
          <ul className="grid gap-1.5 font-body text-sm font-semibold leading-snug text-foreground/64">
            {SAFETY_FLAGS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </SmoothDisclosure>
    </div>
  );
}

function FastContactSafetyCard({ state, onChange, savedContact }) {
  const [open, setOpen] = useState(false);
  const hasSavedContact = Boolean(savedContact?.name || savedContact?.email || savedContact?.phone);

  const updateContactField = (field, value) => {
    const next = { name: state.name, phone: state.phone, email: state.email, [field]: value };
    onChange(field, value);
    onChange('contactLine', formatContactLine(next));
  };

  const useSavedContact = () => {
    const next = {
      name: savedContact?.name || '',
      phone: formatPhoneNumber(savedContact?.phone || ''),
      email: savedContact?.email || '',
    };
    onChange('name', next.name);
    onChange('phone', next.phone);
    onChange('email', next.email);
    onChange('contactLine', formatContactLine(next));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-foreground/12 bg-background/50 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
      <div className="relative grid gap-3">
        <div className="grid gap-2 md:grid-cols-2 md:gap-3">
          <div className="col-span-2">
            <TextInput
              label="Name"
              value={state.name}
              onChange={(value) => updateContactField('name', value)}
              placeholder="Alex Morgan"
              autoComplete="name"
              actionLabel={hasSavedContact ? 'Saved' : ''}
              onAction={useSavedContact}
              compact
              required
            />
          </div>
          <TextInput
            label="Phone"
            value={state.phone}
            onChange={(value) => updateContactField('phone', value)}
            placeholder="(415) 555-0123"
            autoComplete="tel"
            inputMode="tel"
            type="tel"
            compact
            required
          />
          <TextInput
            label="DOB"
            value={state.dob}
            onChange={(value) => onChange('dob', formatDobInput(value))}
            placeholder="MM/DD/YYYY"
            autoComplete="bday"
            inputMode="numeric"
            compact
            required
          />
          <div className="col-span-2">
            <TextInput
              label="Email"
              value={state.email}
              onChange={(value) => updateContactField('email', value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              type="email"
              compact
              required
            />
          </div>
        </div>

        <div className="border-t border-foreground/10 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-body text-sm font-black uppercase tracking-[0.12em] text-foreground/68">Safety</p>
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="min-h-[34px] rounded-full border border-foreground/12 px-3 font-body text-[11px] font-black uppercase tracking-[0.1em] text-foreground/62"
            >
              {open ? 'Hide' : 'View'}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {[
              { key: 'none', label: 'No' },
              { key: 'call', label: 'Yes' },
            ].map((item) => {
              const active = state.safetyFlag === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange('safetyFlag', item.key)}
                  aria-pressed={active}
                  className={`min-h-[52px] rounded-2xl border px-3 text-left font-body text-sm font-black shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] transition-colors ${
                    active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/12 bg-background/42 text-foreground/72'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <SmoothDisclosure open={open}>
            <div className="relative mt-3 rounded-2xl border border-foreground/10 bg-background/38 p-3">
              <ul className="grid gap-1.5 font-body text-sm font-semibold leading-snug text-foreground/64">
                {SAFETY_FLAGS.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </SmoothDisclosure>
        </div>
      </div>
    </div>
  );
}

function FastReviewSurface({
  product,
  serviceLabel,
  balanceDue,
  state,
  resolvedZip,
  topAddressSuggestion,
  savedVisitAddress,
  savedContactProfile,
  locationLoading,
  checkoutLoading,
  error,
  onAddress,
  onAddressKeyDown,
  onAddressSuggestion,
  onValue,
  onUseCurrentLocation,
  onChangeTherapy,
  onSubmit,
}) {
  const Icon = product?.icon || Droplets;
  const canPay = Boolean(hasFullName(state.name) && hasDob(state.dob) && state.email.includes('@') && state.phone.replace(/\D/g, '').length >= 10 && state.address.trim() && resolvedZip.length === 5 && state.safetyFlag);

  return (
    <section className="mx-auto max-w-3xl scroll-mt-28 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] md:pb-6">
      {error && (
        <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/22 bg-amber-300/[0.07] px-4 py-3 text-amber-100">
          <p className="font-body text-sm font-black">{error}</p>
          <a href="sms:+14159807708" className="shrink-0 rounded-full border border-amber-200/24 px-3 py-1.5 font-body text-xs font-black uppercase tracking-[0.08em]">
            Text us
          </a>
        </div>
      )}

      <div className="grid gap-3">
        <div className="relative overflow-hidden rounded-[1.45rem] border border-foreground/18 bg-foreground/[0.11] p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_22px_82px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl">
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--foreground)/0.16),transparent_38%),linear-gradient(145deg,hsl(var(--foreground)/0.07),transparent_58%,hsl(var(--foreground)/0.025))]" />
          <p className="relative mb-3 font-body text-xs font-black uppercase tracking-[0.18em] text-foreground/58">Pay</p>
          <div className="relative flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/18 bg-foreground/[0.07] text-foreground">
              <Icon className="h-6 w-6" strokeWidth={2.45} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-xs font-black uppercase tracking-[0.16em] text-foreground/62">Checkout</span>
              <span className="mt-2 block font-heading text-[2.55rem] uppercase leading-none tracking-normal text-foreground">{serviceLabel}</span>
              <span className="mt-2 block font-body text-base font-bold text-foreground/70">Review required</span>
            </span>
            <button
              type="button"
              onClick={onChangeTherapy}
              className="min-h-[42px] shrink-0 rounded-full border border-foreground/14 px-3 font-body text-[11px] font-black uppercase tracking-[0.1em] text-foreground/68"
            >
              Change
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-foreground/12 bg-background/50 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
          <div className="relative mb-3 flex items-center justify-between gap-3">
            <p className="font-body text-sm font-black uppercase tracking-[0.12em] text-foreground/68">Address</p>
            {resolvedZip && <span className="rounded-full border border-foreground/12 px-3 py-1 font-body text-[11px] font-black uppercase tracking-[0.1em] text-foreground/58">{resolvedZip}</span>}
          </div>
          <div className="relative grid gap-2">
            <button
              type="button"
              onClick={onUseCurrentLocation}
              disabled={locationLoading}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-foreground/12 bg-background/44 px-4 font-body text-sm font-black text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)]"
            >
              <span className="flex items-center gap-2">
                <Navigation className="h-4.5 w-4.5" strokeWidth={2.4} />
                {locationLoading ? 'Finding address' : 'Use location'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <TextInput
              label="Street address"
              value={state.address}
              onChange={onAddress}
              onKeyDown={onAddressKeyDown}
              placeholder="Address"
              autoComplete="street-address"
              autoFocus={!state.address}
              actionLabel={savedVisitAddress?.address ? 'Saved' : ''}
              onAction={() => onAddressSuggestion(savedVisitAddress)}
              required
            />
            <AddressPrediction suggestion={topAddressSuggestion} onUse={onAddressSuggestion} compact />
            {state.address.trim() && !resolvedZip && (
              <TextInput
                label="ZIP"
                value={state.zip}
                onChange={(value) => onValue('zip', value.replace(/\D/g, '').slice(0, 5))}
                onKeyDown={onAddressKeyDown}
                placeholder="94107"
                autoComplete="postal-code"
                inputMode="numeric"
                actionLabel={savedVisitAddress?.zip ? 'Saved' : ''}
                onAction={() => onValue('zip', savedVisitAddress?.zip || '')}
                required
              />
            )}
          </div>
        </div>

        <FastContactSafetyCard state={state} onChange={onValue} savedContact={savedContactProfile} />

        <p className="rounded-2xl border border-foreground/10 bg-background/38 px-4 py-3 font-body text-xs font-semibold leading-snug text-foreground/58">
          By paying, you consent to intake and privacy terms. Treatment requires clinical approval.
        </p>

      </div>

      <div className="fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),0.5rem)] z-40 px-2 pb-0 pt-1 md:sticky md:bottom-4 md:mt-4 md:px-0">
        <div className="mx-auto flex max-w-3xl items-center gap-1.5 overflow-hidden rounded-[1.1rem] border border-foreground/14 bg-background/86 p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_-18px_76px_hsl(var(--foreground)/0.16)] backdrop-blur-2xl md:rounded-[1.25rem]">
          <div className="hidden min-w-0 flex-1 px-4 md:block">
            <p className="font-body text-xs font-black uppercase tracking-[0.14em] text-foreground/58">Checkout</p>
            <p className="mt-0.5 truncate font-body text-sm font-semibold text-foreground/70">Apple Pay, Google Pay, Link, or card</p>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={checkoutLoading}
            aria-label="Continue to secure payment"
            className={`relative flex min-h-[48px] flex-1 items-center justify-between overflow-hidden rounded-full border px-4 font-body text-xs font-black uppercase tracking-[0.06em] shadow-[0_-8px_38px_hsl(var(--foreground)/0.18),inset_0_1px_0_hsl(var(--foreground)/0.12)] backdrop-blur-2xl transition-transform active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-[56px] md:text-sm ${
              canPay ? 'border-foreground/34 bg-foreground/[0.18] text-foreground' : 'border-foreground/14 bg-background/42 text-foreground/58'
            }`}
          >
            {checkoutLoading && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-foreground/16 to-transparent"
                animate={{ x: ['0%', '420%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: EASE }}
              />
            )}
            <span>{checkoutLoading ? 'Opening' : 'Checkout'}</span>
            <span>Full amount</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function ClinicalReviewChoice({ value, onChange, allowOnFile = false }) {
  const options = [
    { key: false, label: 'Need review', icon: ShieldCheck },
    { key: true, label: 'On file', icon: Check },
  ];

  return (
    <div className="relative mb-3 overflow-hidden rounded-2xl border border-foreground/12 bg-background/42 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="font-body text-sm font-black uppercase tracking-[0.12em] text-foreground/68">Clinical review</p>
      </div>
      <div className="relative mt-3 grid gap-2 md:grid-cols-2">
        {options.map((item) => {
          const active = Boolean(value) === item.key;
          const disabled = item.key === true && !allowOnFile;
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onChange(disabled ? false : item.key)}
              disabled={disabled}
              aria-pressed={active}
              className={`flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border px-3 text-left font-body text-base font-black shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                active ? 'border-foreground/42 bg-foreground/[0.14] text-foreground' : 'border-foreground/12 bg-background/42 text-foreground/72'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${active ? 'border-foreground/24 bg-foreground/[0.08]' : 'border-foreground/12 bg-foreground/[0.05]'}`}>
                  <Icon className="h-5 w-5" strokeWidth={2.45} />
                </span>
                <span className="truncate">{disabled ? 'Sign in required' : item.label}</span>
              </span>
              {active && <Check className="h-4.5 w-4.5 shrink-0" strokeWidth={2.8} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OptionalNotes({ value, onChange }) {
  const [open, setOpen] = useState(Boolean(value));
  return (
    <div className="mb-2 md:mb-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[42px] w-full items-center justify-between rounded-xl border border-foreground/12 bg-background/45 px-3 font-body text-xs font-extrabold text-foreground/76 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl md:min-h-[44px] md:rounded-xl md:px-3 md:text-xs"
      >
        <span>{open ? 'Hide nurse instructions' : 'Nurse instructions'}</span>
        <Plus className={`h-4 w-4 transition-transform ${open ? 'rotate-45' : ''}`} strokeWidth={2.4} />
      </button>
      <SmoothDisclosure open={open}>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Gate code, parking, hotel room, concierge."
          className="mt-2 min-h-[72px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.04] p-3 font-body text-base font-semibold text-foreground placeholder:text-foreground/52 outline-none transition-colors focus:border-foreground/40 md:min-h-[72px] md:text-base"
        />
      </SmoothDisclosure>
    </div>
  );
}

function ConfirmSummary({ state, product, bookingGfeRequirement, subtotal = 0, dueNow = 0, balanceDue = 0 }) {
  const isCustom = state.outcome === 'longevity';
  const customBase = CUSTOM_BASE_OPTIONS.find((item) => item.key === state.customBase) || CUSTOM_BASE_OPTIONS[1];
  const serviceLabel = isCustom ? `Custom ${customBase.label}` : product?.label || 'Therapy';
  const items = [
    { label: state.visitType === 'subscription' ? 'Monthly' : 'Visit', value: bookingTimeSummary(state), icon: Calendar },
    { label: 'Clinical review', value: state.clinicalReviewOnFile ? 'On file' : bookingGfeRequirement.required ? 'Needed' : 'Ready', icon: ShieldCheck },
    { label: 'Due now', value: currency(dueNow), icon: Check },
    { label: 'Upon completion', value: currency(balanceDue), icon: CreditCard },
  ];

  return (
    <div className="relative mb-3 overflow-hidden rounded-[1.6rem] border border-foreground/12 bg-background/40 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.10),transparent_38%),linear-gradient(145deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.026))]" />
      <div className="relative flex items-center justify-between gap-3 border-b border-foreground/10 pb-3">
        <div className="min-w-0">
          <p className="font-body text-xs font-black uppercase tracking-[0.14em] text-foreground/60">Ready</p>
          <p className="mt-1 truncate font-heading text-[2rem] uppercase leading-none tracking-normal text-foreground">{serviceLabel}</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-foreground/16 bg-foreground/[0.07] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
          <Check className="h-5 w-5" strokeWidth={2.8} />
        </span>
      </div>
      <div className="relative mt-1 divide-y divide-foreground/8">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={`${item.label}-${item.value}`} className="flex min-h-[58px] items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.055] text-foreground">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.35} />
                </span>
                <span className="truncate font-body text-base font-extrabold text-foreground">{item.label}</span>
              </span>
              <span className="shrink-0 font-body text-base font-black text-foreground/72">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupPricingPanel({ baseTotal, guestCount, contactRequired, eventType, onGuests, onEventType }) {
  const safeCount = Math.max(2, Math.min(5, Number(guestCount || 2)));
  const canDecrease = safeCount > 2;
  const canIncrease = safeCount < 5;

  return (
    <div className="relative mt-4 overflow-hidden rounded-[1.25rem] border border-foreground/12 bg-background/50 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-foreground/70">Group</p>
          <p className="mt-1 font-body text-sm font-medium text-foreground/64">2-4 book. 5+ plan.</p>
        </div>
        {contactRequired && (
          <span className="rounded-full border border-amber-300/24 bg-amber-300/[0.07] px-3 py-1.5 font-body text-xs font-bold uppercase tracking-[0.1em] text-amber-200">
            Contact
          </span>
        )}
      </div>
      <div className="relative mt-3 flex items-center gap-2 rounded-2xl border border-foreground/12 bg-background/45 p-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => onGuests(Math.max(2, safeCount - 1))}
          disabled={!canDecrease}
          aria-label="Decrease guest count"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.05] text-foreground disabled:opacity-35"
        >
          <Minus className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-heading text-5xl uppercase leading-none">{safeCount >= 5 ? '5+' : safeCount}</p>
          <p className="mt-1 font-body text-sm font-black text-foreground/66">{safeCount >= 5 ? 'Contact us' : currency(baseTotal * safeCount)}</p>
        </div>
        <button
          type="button"
          onClick={() => onGuests(Math.min(5, safeCount + 1))}
          disabled={!canIncrease}
          aria-label="Increase guest count"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.05] text-foreground disabled:opacity-35"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>
      <label className="relative mt-3 block">
        <span className="font-body text-xs font-bold uppercase tracking-[0.16em] text-foreground/62">Type</span>
        <select
          aria-label="Group type"
          value={eventType}
          onChange={(event) => onEventType(event.target.value)}
          className="mt-2 min-h-[56px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.04] px-4 font-body text-lg font-medium text-foreground outline-none"
        >
          {EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
    </div>
  );
}

function SummaryRail({
  state,
  product,
  plan,
  subtotal,
  totalLabel,
  dueNow,
  balanceDue,
  groupContactRequired,
  guestCount,
  serviceLabel,
  actionLabel,
  actionDetail,
  actionDisabled = false,
  showAction = false,
  onAction,
}) {
  const isSubscription = state.visitType === 'subscription';
  const subscriptionPrice = Number(plan.price || 0);
  const [open, setOpen] = useState(false);
  return (
    <aside className="hidden lg:block">
      <div className="av-glass-card sticky top-28 overflow-hidden rounded-[1.5rem] border border-foreground/12 bg-background/58 p-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_30px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl">
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.11),transparent_38%),linear-gradient(145deg,hsl(var(--foreground)/0.055),transparent_58%)]" />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="relative flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <span>
            <span className="block font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground/62">Visit</span>
            <span className="mt-2 block truncate font-heading text-3xl uppercase leading-none">{serviceLabel || product?.label || 'Select protocol'}</span>
          </span>
          <span className="rounded-full border border-foreground/12 px-3 py-1.5 font-body text-xs font-black uppercase tracking-[0.08em] text-foreground/74">
            {open ? 'Hide' : totalLabel}
          </span>
        </button>
        <SmoothDisclosure open={open}>
        <div className="relative mt-5 space-y-4">
          <div>
            <p className="font-heading text-4xl uppercase leading-none">{serviceLabel || product?.label || 'Select protocol'}</p>
            <p className="mt-1 font-body text-base font-medium text-foreground/64">{state.visitType === 'subscription' ? 'Monthly' : state.visitType === 'event' ? 'Group' : 'One-time'}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {[
              ['Due now', isSubscription ? currency(subscriptionPrice) : currency(dueNow)],
              [groupContactRequired ? 'Group' : isSubscription ? 'Therapy' : 'Estimate', groupContactRequired ? 'Contact' : totalLabel || currency(subtotal)],
              isSubscription ? ['Plan', plan.label] : ['Upon completion', currency(balanceDue)],
              ['Time', bookingTimeSummary(state)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/8 bg-foreground/[0.035] p-3">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/58">{label}</p>
                <p className="mt-1 font-body text-sm font-bold text-foreground/82">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-foreground/8 pt-4 font-body text-sm font-medium text-foreground/66">
            <p>{state.address || 'Address pending'}</p>
            {(state.who === 'group' || state.visitType === 'event') && (
              <p>{groupContactRequired ? `${guestCount}+ guests` : `${guestCount} guests`}</p>
            )}
            {state.addOns.length > 0 && <p>{state.addOns.length} add-on{state.addOns.length > 1 ? 's' : ''} selected</p>}
          </div>
          {showAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              className="relative flex min-h-[56px] w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-foreground/36 bg-foreground/[0.18] px-5 font-body text-xs font-bold uppercase tracking-[0.12em] text-foreground shadow-[0_18px_62px_hsl(var(--foreground)/0.17),inset_0_1px_0_hsl(var(--foreground)/0.12)] backdrop-blur-2xl disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-foreground/[0.04] via-foreground/[0.13] to-foreground/[0.04]" />
              {actionDisabled && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-foreground/16 to-transparent"
                  animate={{ x: ['0%', '420%'] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: EASE }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {actionLabel} <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          ) : (
            <p className="rounded-2xl border border-foreground/10 bg-background/34 px-4 py-3 font-body text-xs font-bold uppercase tracking-[0.1em] text-foreground/58">
              Finish the steps to unlock payment.
            </p>
          )}
          {actionDetail && (
            <p className="text-center font-body text-[11px] font-semibold text-foreground/52">{actionDetail}</p>
          )}
        </div>
        </SmoothDisclosure>
      </div>
    </aside>
  );
}

const defaultState = {
  draftVersion: BOOKING_DRAFT_VERSION,
  outcome: 'recover',
  visitType: 'one-time',
  productKey: '',
  planKey: FEATURED_SUBSCRIPTION_TIER_KEY,
  subscriptionTerm: 'monthly',
  clientType: 'new',
  eventType: 'Private',
  locationType: 'home',
  address: '',
  zip: '',
  who: 'me',
  guests: 1,
  timeIntent: 'asap',
  customDate: todayDate(),
  customTime: '',
  name: '',
  contactLine: '',
  email: '',
  phone: '',
  dob: '',
  emergencyContact: '',
  safetyFlag: '',
  notes: '',
  addOns: [],
  addOnDecision: true,
  clinicalReviewOnFile: false,
  customBase: 'advanced',
  customPlanSessions: 2,
};

const EMPTY_CLIENT_PROFILE = {
  name: '',
  email: '',
  phone: '',
  address: '',
  zip: '',
  locationType: 'home',
};

export default function BookNow() {
  useSeo({
    title: 'Book — Avalon Vitality',
    description: 'Book mobile IV therapy with licensed clinicians and clinical review.',
    path: '/book',
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fastMode = false;
  const { clearItems, addItem, setMembershipTier, clearMembership } = useCart();
  const { user } = useAuthStore();
  const signedInClient = user?.role === 'client';
  const clientProfile = useMemo(() => readClientProfile(), []);
  const lastBooking = useMemo(() => readLastBooking(), []);
  const savedContactProfile = useMemo(() => {
    const savedContact = lastBooking?.contact || {};
    const fallback = signedInClient ? EMPTY_CLIENT_PROFILE : {};
    return {
      name: realValue(savedContact.name) || realValue([clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(' ')) || fallback.name || '',
      email: realValue(savedContact.email) || realValue(clientProfile.email) || fallback.email || '',
      phone: realValue(savedContact.phone) || realValue(clientProfile.phone) || fallback.phone || '',
      dob: realValue(savedContact.dob) || realValue(clientProfile.dob) || '',
      emergencyContact: realValue(savedContact.emergencyContact) || realValue(clientProfile.emergencyContact) || '',
    };
  }, [clientProfile, lastBooking, signedInClient]);
  const savedVisitAddress = useMemo(() => {
    const fallback = signedInClient ? EMPTY_CLIENT_PROFILE : {};
    const address = realAddress(lastBooking?.address) || realAddress(clientProfile.defaultAddress) || realAddress(fallback.address);
    if (!address) return null;
    return {
      label: 'Saved address',
      address,
      zip: realValue(lastBooking?.zip) || realValue(clientProfile.zip) || fallback.zip || '',
      locationType: lastBooking?.locationType || clientProfile.locationType || fallback.locationType || 'home',
    };
  }, [clientProfile, lastBooking, signedInClient]);
  const profileGfe = useMemo(() => resolveGfeRequirement({
    isNewClient: false,
    visitCount: Math.max(1, Number(clientProfile.visitCount || 1)),
    gfe: clientProfile.gfe,
    gfeExpiresAt: clientProfile.gfe?.validUntil,
  }), [clientProfile]);
  const canUseClinicalReviewOnFile = signedInClient && !profileGfe.required;
  const reduceMotion = useReducedMotion();
  const shouldResetDraft = searchParams.get('reset') === '1';
  const shouldResumeDraft = searchParams.get('resume') === '1';
  const initialProtocolParam = searchParams.get('protocol');
  const initialProtocolKey = PUBLIC_BOOKING_PROTOCOL_KEYS.has(initialProtocolParam) ? initialProtocolParam : '';
  const initialSubscriptionParam = searchParams.get('subscription');
  const initialSubscriptionPlan = MEMBERSHIP_OPTIONS.find((item) => item.key === initialSubscriptionParam);
  const initialSubscriptionTerm = subscriptionTermForKey(searchParams.get('term'));
  const initialOutcome = initialProtocolKey ? outcomeForProtocol(initialProtocolKey) : null;
  const [step, setStep] = useState(0);
  const stepShellRef = useRef(null);
  const hasMountedStepRef = useRef(false);
  const [state, setState] = useState(() => {
    const draft = shouldResetDraft || !shouldResumeDraft ? {} : readBookingDraft()?.webstore || {};
    const savedWebstoreRaw = draft.draftVersion === BOOKING_DRAFT_VERSION ? draft : {};
    const savedWebstoreAddress = realAddress(savedWebstoreRaw.address);
    const savedWebstore = {
      ...savedWebstoreRaw,
      address: savedWebstoreAddress,
      zip: savedWebstoreAddress ? realValue(savedWebstoreRaw.zip) : '',
    };
    const savedProductKey = PUBLIC_BOOKING_PROTOCOL_KEYS.has(savedWebstore.productKey) ? savedWebstore.productKey : '';
    const savedContact = shouldResetDraft ? {} : lastBooking?.contact || {};
    const fallback = signedInClient ? EMPTY_CLIENT_PROFILE : {};
    const savedAddress = shouldResetDraft
      ? realAddress(fallback.address)
      : savedWebstoreAddress || realAddress(lastBooking?.address) || realAddress(clientProfile.defaultAddress) || realAddress(fallback.address);
    const returningClient = signedInClient;
    return {
      ...defaultState,
      clientType: returningClient ? 'returning' : 'new',
      clinicalReviewOnFile: returningClient && !profileGfe.required,
      address: savedAddress || defaultState.address,
      zip: savedAddress ? realValue(lastBooking?.zip) || realValue(clientProfile.zip) || fallback.zip || defaultState.zip : defaultState.zip,
      locationType: lastBooking?.locationType || fallback.locationType || defaultState.locationType,
      name: realValue(savedContact.name) || realValue([clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(' ')) || fallback.name || defaultState.name,
      email: realValue(savedContact.email) || realValue(clientProfile.email) || fallback.email || defaultState.email,
      phone: realValue(savedContact.phone) || realValue(clientProfile.phone) || fallback.phone || defaultState.phone,
      dob: realValue(savedContact.dob) || realValue(clientProfile.dob) || defaultState.dob,
      emergencyContact: realValue(savedContact.emergencyContact) || realValue(clientProfile.emergencyContact) || defaultState.emergencyContact,
      ...savedWebstore,
      outcome: initialOutcome?.key || savedWebstore.outcome || defaultState.outcome,
      productKey: initialProtocolKey || (shouldResumeDraft ? savedProductKey : '') || defaultState.productKey,
      visitType: initialSubscriptionPlan ? 'subscription' : savedWebstore.visitType || defaultState.visitType,
      planKey: initialSubscriptionPlan?.key || savedWebstore.planKey || defaultState.planKey,
      subscriptionTerm: initialSubscriptionPlan ? initialSubscriptionTerm.key : savedWebstore.subscriptionTerm || defaultState.subscriptionTerm,
      addOns: initialProtocolKey ? [] : shouldResumeDraft && savedProductKey ? (savedWebstore.addOns || []) : [],
      addOnDecision: true,
    };
  });
  const [error, setError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [embeddedCheckoutSession, setEmbeddedCheckoutSession] = useState(null);
  const [therapyCategoryScreen, setTherapyCategoryScreen] = useState(true);
  const [activeTherapyGroup, setActiveTherapyGroup] = useState(() => therapyGroupForKey(defaultState.productKey));
  const [activeAddonGroup, setActiveAddonGroup] = useState('');

  useEffect(() => {
    if (shouldResetDraft) clearBookingDraft();
  }, [shouldResetDraft]);

  const scrollStepIntoView = (behavior = 'smooth') => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(max-width: 767px)')?.matches) return;
    window.setTimeout(() => {
      const target = stepShellRef.current;
      if (!target) return;
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 96);
      window.scrollTo({ top, behavior: prefersReduced ? 'auto' : behavior });
      target.focus({ preventScroll: true });
    }, 50);
  };

  useEffect(() => {
    if (!hasMountedStepRef.current) {
      hasMountedStepRef.current = true;
      return;
    }
    scrollStepIntoView();
  }, [step]);

  useEffect(() => {
    const outcomeParam = searchParams.get('outcome');
    const protocolParam = searchParams.get('protocol');
    const subscriptionParam = searchParams.get('subscription');
    const subscriptionTermParam = searchParams.get('term');
    const timeParam = searchParams.get('time');
    const selectedSubscriptionPlan = MEMBERSHIP_OPTIONS.find((item) => item.key === subscriptionParam);
    const selectedSubscriptionTerm = subscriptionTermForKey(subscriptionTermParam);
    const wantsSubscription = Boolean(selectedSubscriptionPlan);
    const nextOutcome = OUTCOMES.find((item) => item.key === outcomeParam);
    if (protocolParam && PUBLIC_BOOKING_PROTOCOL_KEYS.has(protocolParam)) {
      const inferredOutcome = nextOutcome || outcomeForProtocol(protocolParam);
      setState((current) => ({
        ...current,
        outcome: inferredOutcome.key,
        productKey: protocolParam,
        visitType: wantsSubscription ? 'subscription' : current.visitType,
        planKey: selectedSubscriptionPlan?.key || current.planKey,
        subscriptionTerm: wantsSubscription ? selectedSubscriptionTerm.key : current.subscriptionTerm,
        timeIntent: timeParam === 'asap' ? 'asap' : current.timeIntent,
        addOns: [],
        addOnDecision: true,
      }));
      setStep(0);
    } else if (nextOutcome) {
      const isCustom = nextOutcome.key === 'longevity';
      const base = CUSTOM_BASE_OPTIONS.find((item) => item.key === 'advanced') || CUSTOM_BASE_OPTIONS[1];
      setState((current) => {
        const selectedBase = CUSTOM_BASE_OPTIONS.find((item) => item.key === current.customBase) || base;
        return {
          ...current,
          outcome: nextOutcome.key,
          productKey: isCustom ? selectedBase.productKey : nextOutcome.productKeys[0] || 'recovery',
          visitType: wantsSubscription ? 'subscription' : current.visitType,
          planKey: selectedSubscriptionPlan?.key || current.planKey,
          subscriptionTerm: wantsSubscription ? selectedSubscriptionTerm.key : current.subscriptionTerm,
          timeIntent: timeParam === 'asap' ? 'asap' : current.timeIntent,
          addOns: [],
          addOnDecision: true,
          customBase: isCustom ? selectedBase.key : current.customBase,
        };
      });
      setStep(0);
    } else if (wantsSubscription) {
      const fallbackProtocol = 'recovery';
      const inferredOutcome = outcomeForProtocol(fallbackProtocol);
      setState((current) => ({
        ...current,
        outcome: inferredOutcome.key,
        productKey: fallbackProtocol,
        visitType: 'subscription',
        planKey: selectedSubscriptionPlan.key,
        subscriptionTerm: selectedSubscriptionTerm.key,
        timeIntent: timeParam === 'asap' ? 'asap' : current.timeIntent,
        addOns: [],
        addOnDecision: true,
      }));
      setStep(0);
    }
  }, [searchParams]);

  const outcome = OUTCOMES.find((item) => item.key === state.outcome) || OUTCOMES[0];
  const isCustomTreatment = state.outcome === 'longevity';
  const customBase = CUSTOM_BASE_OPTIONS.find((item) => item.key === state.customBase) || CUSTOM_BASE_OPTIONS[1];
  const visitType = VISIT_TYPES.find((item) => item.key === state.visitType) || VISIT_TYPES[0];
  const productOptions = useMemo(
    () => productOptionsForOutcome(outcome),
    [outcome]
  );
  const product = state.productKey ? safeProtocol(getProductByKey(state.productKey)) : null;
  const serviceLabel = isCustomTreatment ? customBase.label : product?.label || 'Therapy';
  const plan = MEMBERSHIP_OPTIONS.find((item) => item.key === state.planKey) || MEMBERSHIP_OPTIONS[0];
  const compressedFlow = Boolean(searchParams.get('protocol') || searchParams.get('subscription'));
  const isReturningClient = state.clientType === 'returning';
  const clinicalReviewOnFile = Boolean(state.clinicalReviewOnFile);
  const bookingGfeRecord = clinicalReviewOnFile
    ? {
      ...(clientProfile.gfe || {}),
      status: 'Valid',
      validUntil: clientProfile.gfe?.validUntil || oneYearFromNowIso(),
      source: 'client_selected_on_file',
    }
    : (isReturningClient ? clientProfile.gfe : {});
  const bookingGfeRequirement = resolveGfeRequirement({
    isNewClient: !isReturningClient && !clinicalReviewOnFile,
    visitCount: isReturningClient || clinicalReviewOnFile ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
    gfe: bookingGfeRecord,
    gfeExpiresAt: bookingGfeRecord?.validUntil || '',
  });
  const addonCatalog = useMemo(() => buildAddonCatalog(product), [product]);
  const selectedAddons = useMemo(
    () => addonCatalog.all.filter((item) => state.addOns.includes(item.label)),
    [addonCatalog, state.addOns]
  );
  const baseSubtotal = (product ? protocolPrice(product) : 0) + selectedAddons.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const customPlanSessions = Math.max(1, Number(state.customPlanSessions || 2));
  const customPlanEstimate = Math.max(150, baseSubtotal || protocolPrice(product) || 250) * customPlanSessions;
  const activePlanMonthlyPrice = plan.custom ? customPlanEstimate : Number(plan.price || 0);
  const activeSubscriptionTerm = subscriptionTermForKey(state.subscriptionTerm);
  const activePlanPrice = subscriptionTermPrice(activePlanMonthlyPrice, activeSubscriptionTerm.key);
  const activePlanSessions = plan.custom ? customPlanSessions : Number(plan.sessions || 0);
  const isGroupVisit = state.who === 'group' || state.visitType === 'event';
  const guestCount = isGroupVisit ? Math.max(2, Number(state.guests || 2)) : 1;
  const pricedGuestCount = isGroupVisit ? Math.min(guestCount, 4) : 1;
  const groupContactRequired = isGroupVisit && guestCount >= 5;
  const subtotal = isGroupVisit ? baseSubtotal * pricedGuestCount : baseSubtotal;
  const totalLabel = !product ? 'Select' : groupContactRequired ? 'Contact' : currency(subtotal);
  const dueNowAmount = state.visitType === 'subscription' ? activePlanPrice : groupContactRequired ? 0 : Math.min(BOOKING_DEPOSIT_AMOUNT, subtotal || 0);
  const balanceDue = state.visitType === 'subscription' ? 0 : Math.max(0, subtotal - dueNowAmount);
  const dueNowLabel = !product && step === 0 ? currency(BOOKING_DEPOSIT_AMOUNT) : state.visitType === 'subscription' ? `${currency(activePlanPrice)} ${activeSubscriptionTerm.key === 'monthly' ? 'today' : 'prepaid'}` : currency(dueNowAmount);
  const dueAfterLabel = !product && step === 0 ? currency(200) : groupContactRequired ? 'Quote' : currency(balanceDue);
  const dateOptions = useMemo(() => buildDateOptions(), []);
  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const resolvedZip = useMemo(
    () => String(state.zip || extractZip(state.address) || '').replace(/\D/g, '').slice(0, 5),
    [state.address, state.zip]
  );
  const typedAddressSuggestion = useMemo(
    () => buildTypedAddressSuggestion(state.address, resolvedZip, state.locationType),
    [state.address, resolvedZip, state.locationType]
  );
  const addressSuggestions = useMemo(() => {
    const query = `${state.address} ${state.zip}`.trim();
    const scored = !query
      ? ADDRESS_SUGGESTIONS.slice(0, 3)
      : ADDRESS_SUGGESTIONS
      .map((item) => ({ ...item, score: scoreAddressSuggestion(item, query) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
      .slice(0, 3);
    if (!typedAddressSuggestion) return scored;
    return [
      typedAddressSuggestion,
      ...scored.filter((item) => item.address !== typedAddressSuggestion.address),
    ].slice(0, 3);
  }, [state.address, state.zip, typedAddressSuggestion]);
  const addressQuery = `${state.address} ${state.zip}`.trim();
  const topAddressSuggestion = addressQuery.length >= 2 ? addressSuggestions[0] : null;

  useEffect(() => {
    saveBookingDraft({ webstore: { ...state, customPlanEstimate }, step, subtotal, updatedAt: new Date().toISOString() });
  }, [state, step, subtotal, customPlanEstimate]);

  useEffect(() => {
    if (
      !compressedFlow ||
      step !== 3 ||
      groupContactRequired ||
      !state.address.trim() ||
      resolvedZip.length !== 5 ||
      (state.timeIntent === 'choose' && (!state.customDate || !state.customTime))
    ) {
      return undefined;
    }

    return undefined;
  }, [
    compressedFlow,
    step,
    groupContactRequired,
    state.address,
    resolvedZip,
    state.timeIntent,
    state.customDate,
    state.customTime,
  ]);

  useEffect(() => {
    track(ANALYTICS_EVENTS.STEP_VIEWED, {
      funnel: 'webstore',
      step_index: step,
      step_name: STEPS[step],
      outcome: state.outcome,
      visit_type: state.visitType,
      protocol_key: state.productKey,
      attribution: getAttribution(),
    });
  }, [step, state.outcome, state.visitType, state.productKey]);

  const setValue = (key, value) => {
    setError('');
    setState((current) => ({ ...current, [key]: value }));
  };

  const setSubscriptionTerm = (key) => {
    setError('');
    setState((current) => ({ ...current, subscriptionTerm: key }));
  };

  const setAddressValue = (value) => {
    setError('');
    const nextZip = extractZip(value);
    setState((current) => ({
      ...current,
      address: value,
      zip: nextZip || current.zip,
    }));
  };

  useEffect(() => {
    if (!canUseClinicalReviewOnFile && state.clinicalReviewOnFile) {
      setState((current) => ({ ...current, clinicalReviewOnFile: false }));
    }
  }, [canUseClinicalReviewOnFile, state.clinicalReviewOnFile]);

  const chooseWho = (key) => {
    setError('');
    setState((current) => ({
      ...current,
      who: key,
      visitType: key === 'group' ? 'event' : current.visitType === 'event' ? 'one-time' : current.visitType,
      guests: key === 'group' ? Math.max(2, Number(current.guests || 2)) : 1,
    }));
  };

  const routeGroupContact = () => {
    writeLocal('webstore.groupLead', {
      protocol: serviceLabel || 'Protocol pending',
      protocolKey: isCustomTreatment ? `custom-${customBase.key}` : product?.key || '',
      customTreatment: isCustomTreatment ? {
        base: customBase.label,
        baseKey: customBase.key,
        estimate: baseSubtotal,
      } : null,
      addOns: selectedAddons.map((item) => item.type === 'im' ? `IM · ${item.label}` : item.label),
      baseSubtotal,
      requestedGuests: guestCount,
      locationType: state.locationType,
      address: state.address,
      zip: state.zip,
      eventType: state.eventType,
      time: bookingTimeSummary(state),
      contact: {
        name: state.name,
        email: state.email,
        phone: state.phone,
      },
      status: 'Group planning required',
      updatedAt: new Date().toISOString(),
    });
    appendActivity(`Group planning requested: ${guestCount}+ guests · ${serviceLabel || 'Protocol'}`, {
      role: 'client',
      orderType: 'event',
      protocolKey: isCustomTreatment ? `custom-${customBase.key}` : product?.key,
    });
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: step,
      step_name: STEPS[step],
      order_type: 'group_contact',
      guest_count: guestCount,
      protocol_key: isCustomTreatment ? `custom-${customBase.key}` : product?.key,
    });
    clearBookingDraft();
    navigate('/launches#inquiry');
  };

  const goToReturningSignIn = () => {
    saveBookingDraft({ webstore: { ...state, clientType: 'new' }, step, subtotal, updatedAt: new Date().toISOString() });
    navigate(`/login?redirect=${encodeURIComponent('/book?returning=1')}`);
  };

  const chooseOutcome = (key) => {
    const nextOutcome = OUTCOMES.find((item) => item.key === key) || OUTCOMES[0];
    const isCustom = key === 'longevity';
    const base = CUSTOM_BASE_OPTIONS.find((item) => item.key === (isCustom ? 'advanced' : state.customBase)) || CUSTOM_BASE_OPTIONS[1];
    const recommendedProductKey = isCustom ? base.productKey : nextOutcome.productKeys[0] || '';
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 0,
      step_name: STEPS[0],
      outcome: key,
      protocol_key: recommendedProductKey,
    });
    setState((current) => {
      const existingCustomBase = CUSTOM_BASE_OPTIONS.find((item) => item.key === current.customBase);
      const nextCustomBase = current.outcome === 'longevity' && existingCustomBase ? existingCustomBase : base;
      return {
        ...current,
        outcome: key,
        productKey: isCustom ? nextCustomBase.productKey : recommendedProductKey,
        addOns: [],
        addOnDecision: true,
        customBase: isCustom ? nextCustomBase.key : current.customBase,
      };
    });
  };

  const chooseClientType = (key) => {
    setError('');
    if (key === 'returning' && !signedInClient) {
      goToReturningSignIn();
      return;
    }
    setState((current) => {
      if (key !== 'returning') return { ...current, clientType: 'new' };
      const savedContact = lastBooking?.contact || {};
      const savedAddress = realAddress(lastBooking?.address) || realAddress(clientProfile.defaultAddress);
      return {
        ...current,
        clientType: 'returning',
        address: current.address || savedAddress || '',
        zip: current.zip || (savedAddress ? realValue(lastBooking?.zip) || realValue(clientProfile.zip) : '') || '',
        locationType: lastBooking?.locationType || clientProfile.locationType || current.locationType,
        name: current.name || realValue(savedContact.name) || realValue([clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(' ')) || '',
        email: current.email || realValue(savedContact.email) || realValue(clientProfile.email) || '',
        phone: current.phone || realValue(savedContact.phone) || realValue(clientProfile.phone) || '',
      };
    });
  };

  const useSavedInfo = () => {
    setError('');
    setState((current) => ({
      ...current,
      clientType: signedInClient ? 'returning' : current.clientType,
      name: current.name || savedContactProfile.name || '',
      email: current.email || savedContactProfile.email || '',
      phone: current.phone || savedContactProfile.phone || '',
      address: current.address || savedVisitAddress?.address || '',
      zip: current.zip || savedVisitAddress?.zip || '',
      locationType: savedVisitAddress?.locationType || current.locationType,
    }));
  };

  const repeatLastVisit = () => {
    if (!lastBooking) return;
    const protocolKey = String(lastBooking.protocolKey || '').replace(/^custom-/, '');
    const nextProduct = PUBLIC_BOOKING_PROTOCOL_KEYS.has(protocolKey) ? protocolKey : state.productKey;
    setError('');
    setState((current) => ({
      ...current,
      clientType: signedInClient ? 'returning' : current.clientType,
      productKey: nextProduct,
      outcome: outcomeForProtocol(nextProduct).key,
      visitType: lastBooking.subscription ? 'subscription' : current.visitType,
      address: realAddress(lastBooking.address) || current.address,
      zip: realValue(lastBooking.zip) || current.zip,
      locationType: lastBooking.locationType || current.locationType,
      name: current.name || savedContactProfile.name || '',
      email: current.email || savedContactProfile.email || '',
      phone: current.phone || savedContactProfile.phone || '',
      addOns: Array.isArray(lastBooking.addOns)
        ? lastBooking.addOns.map((item) => String(item).replace(/^IM · /, '')).filter(Boolean)
        : current.addOns,
      addOnDecision: true,
    }));
    setStep(0);
  };

  const chooseProduct = (key, overrides = {}) => {
    setError('');
    setActiveTherapyGroup(therapyGroupForKey(key));
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 0,
      step_name: STEPS[0],
      protocol_key: key,
    });
    setState((current) => ({
      ...current,
      productKey: key,
      addOns: [],
      addOnDecision: true,
      ...overrides,
    }));
  };

  const chooseProductAndContinue = (key, overrides = {}) => {
    chooseProduct(key, overrides);
  };

  const chooseCustomBase = (key) => {
    const base = CUSTOM_BASE_OPTIONS.find((item) => item.key === key) || CUSTOM_BASE_OPTIONS[1];
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 0,
      step_name: STEPS[0],
      protocol_key: `custom-${base.key}`,
    });
    setError('');
    setState((current) => ({
      ...current,
      outcome: 'longevity',
      customBase: base.key,
      productKey: base.productKey,
      addOns: [],
      addOnDecision: true,
    }));
  };

  const chooseCustomPlanSessions = (sessions) => {
    setError('');
    setState((current) => ({
      ...current,
      visitType: 'subscription',
      planKey: 'custom',
      customPlanSessions: Number(sessions) || 2,
    }));
  };

  const chooseAddressSuggestion = (item) => {
    const nextZip = item.zip || extractZip(item.address) || state.zip;
    setError('');
    setState((current) => ({
      ...current,
      address: item.address,
      zip: nextZip || current.zip,
      locationType: item.locationType,
    }));
    if (
      step === 3 &&
      !groupContactRequired &&
      String(nextZip || '').replace(/\D/g, '').length === 5 &&
      (state.timeIntent !== 'choose' || (state.customDate && state.customTime))
    ) {
      setStep(LAST_STEP);
    }
  };

  const useCurrentLocation = () => {
    setError('');
    if (locationLoading) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is unavailable. Add address.');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await reverseGeocodeLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          setState((current) => ({
            ...current,
            address: result.address,
            zip: result.zip || current.zip,
          }));
          if (
            step === 3 &&
            !groupContactRequired &&
            String(result.zip || '').replace(/\D/g, '').length === 5 &&
            (state.timeIntent !== 'choose' || (state.customDate && state.customTime))
          ) {
            setStep(LAST_STEP);
          }
        } catch (err) {
          setError(err.message || 'Address lookup failed. Add street address.');
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLoading(false);
        setError('Location blocked. Add address.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleAddressKeyDown = (event) => {
    if (event.key !== 'Enter' || !topAddressSuggestion) return;
    event.preventDefault();
    chooseAddressSuggestion(topAddressSuggestion);
  };

  const chooseAvailabilityWindow = (slot, date = state.customDate || todayDate()) => {
    setError('');
    setState((current) => ({
      ...current,
      timeIntent: 'choose',
      customDate: date,
      customTime: slot.time,
      availabilityWindow: `${date}-${slot.time}`,
    }));
  };

  const chooseTimeIntent = (key) => {
    setError('');
    setState((current) => {
      const nextDate = key === 'choose' ? current.customDate || todayDate() : todayDate();
      const nextTime = key === 'choose' ? current.customTime || DEFAULT_EXACT_TIME : '';
      return {
        ...current,
        timeIntent: key,
        customDate: nextDate,
        customTime: nextTime,
        availabilityWindow: key === 'choose' ? `${nextDate}-${nextTime}` : key,
      };
    });
  };

  const toggleAddon = (label) => {
    setError('');
    setState((current) => ({
      ...current,
      addOnDecision: true,
      addOns: current.addOns.includes(label)
        ? current.addOns.filter((item) => item !== label)
        : [...current.addOns, label],
    }));
  };

  const chooseNoAddons = () => {
    setError('');
    setActiveAddonGroup('');
    setState((current) => ({
      ...current,
      addOns: [],
      addOnDecision: true,
    }));
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 1,
      step_name: STEPS[1],
      protocol_key: state.productKey,
      addon_count: 0,
      addon_revenue: 0,
      addon_decision: 'none',
    });
  };

  const canAdvance = () => {
    if (step === 0 && isCustomTreatment) return Boolean(state.productKey && state.customBase);
    if (step === 0 && therapyCategoryScreen) return true;
    if (step === 0) return Boolean(state.productKey);
    if (step === 1) return true;
    if (step === 2) return Boolean(state.timeIntent !== 'choose' || (state.customDate && state.customTime));
    if (step === 3) return Boolean(state.address.trim() && resolvedZip.length === 5);
    return true;
  };

  const next = () => {
    if (step === 0 && therapyCategoryScreen) {
      setError('');
      setTherapyCategoryScreen(false);
      return;
    }
    if (step === 3 && groupContactRequired) {
      routeGroupContact();
      return;
    }
    if (!canAdvance()) {
      const reason = step === 0 ? 'Choose therapy.' : step === 2 ? 'Choose date and time.' : step === 3 ? 'Add address and ZIP.' : 'Finish this step.';
      setError(reason);
      scrollStepIntoView();
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'webstore',
        step_index: step,
        step_name: STEPS[step],
        reason,
      });
      return;
    }
    setError('');
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: step,
      step_name: STEPS[step],
      outcome: state.outcome,
      visit_type: state.visitType,
      protocol_key: state.productKey,
    });
    setStep((current) => Math.min(current + 1, LAST_STEP));
  };

  const back = () => {
    if (step === 0 && !therapyCategoryScreen) {
      setError('');
      setTherapyCategoryScreen(true);
      return;
    }
    if (step === 1 && activeAddonGroup) {
      setError('');
      setActiveAddonGroup('');
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const goToStep = (targetStep) => {
    if (targetStep === step) return;
    if (targetStep < step) {
      setError('');
      setTherapyCategoryScreen(targetStep === 0);
      if (targetStep !== 1) setActiveAddonGroup('');
      setStep(targetStep);
      return;
    }
    if (targetStep === step + 1 && canAdvance()) {
      setError('');
      setStep(targetStep);
      return;
    }
    setError('Finish this step first.');
  };

	  const primaryActionLabel = () => {
	    if (checkoutLoading) return 'OPENING';
	    if (embeddedCheckoutSession) return 'PAYMENT READY';
	    if (step === LAST_STEP && groupContactRequired) return 'CONTACT US';
	    return step < LAST_STEP ? 'NEXT' : 'CONFIRM & PAY';
	  };

	  const buildBooking = () => {
	    if (!product) return null;
	    const { firstName, lastName } = splitName(state.name);
	    const date = state.timeIntent === 'choose' ? state.customDate : todayDate();
	    const slot = buildSlot(date, state.timeIntent, state.customTime);
	    const service = `${serviceLabel}${state.visitType === 'subscription' ? ` · ${plan.label}` : ''}`;
	    const guests = isGroupVisit ? pricedGuestCount : 1;
	    const returningClient = state.clientType === 'returning';
	    const clinicalReviewClaimedOnFile = Boolean(state.clinicalReviewOnFile);
	    const profileGfeRecord = clinicalReviewClaimedOnFile
	      ? {
	        ...(clientProfile.gfe || {}),
	        status: 'Valid',
	        validUntil: clientProfile.gfe?.validUntil || oneYearFromNowIso(),
	        source: 'client_selected_on_file',
	      }
	      : (returningClient ? clientProfile.gfe : {});
	    const customTreatment = isCustomTreatment ? {
	      base: customBase.label,
	      baseKey: customBase.key,
	      estimate: baseSubtotal,
	      sourceProtocolKey: product.key,
	      clinicalReviewRequired: true,
	    } : null;
	    const gfeRequirement = resolveGfeRequirement({
      isNewClient: !returningClient && !clinicalReviewClaimedOnFile,
      visitCount: returningClient || clinicalReviewClaimedOnFile ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
      gfe: profileGfeRecord,
      gfeExpiresAt: profileGfeRecord?.validUntil || '',
    });
    return {
	      id: `AV-${Date.now().toString().slice(-6)}`,
	      reference: `WEB-${Date.now().toString().slice(-6)}`,
	      service,
	      protocolKey: isCustomTreatment ? `custom-${customBase.key}` : product.key,
      date,
      time: slot.timeLabel,
      datetime: slot.datetime,
      timezone: TZ,
      address: state.address,
      zip: resolvedZip,
      locationType: state.locationType,
      guests,
	      notes: [
	        state.notes,
	        fastMode && `Hold. Safety: ${state.safetyFlag === 'none' ? 'No' : state.safetyFlag === 'call' ? 'Yes - nurse call requested' : 'Not answered'}. Balance due: ${currency(balanceDue)}.`,
	      ].filter(Boolean).join('\n'),
      contact: {
        name: state.name.trim(),
        firstName,
        lastName,
        email: state.email.trim(),
        phone: state.phone.trim(),
        dob: state.dob,
        emergencyContact: state.emergencyContact.trim(),
        clientType: state.clientType,
        visitCount: returningClient || clinicalReviewClaimedOnFile ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
      },
      dob: state.dob,
      emergencyContact: state.emergencyContact.trim(),
		      addOns: selectedAddons.map((item) => item.type === 'im' ? `IM · ${item.label}` : item.label),
		      items: [
	        { cartKey: isCustomTreatment ? `custom-${customBase.key}` : product.key, label: serviceLabel, price: protocolPrice(product), type: isCustomTreatment ? 'custom-treatment' : 'iv' },
	        ...selectedAddons.map((item) => ({
          cartKey: item.cartKey,
          label: item.type === 'im' ? `IM · ${item.label}` : item.label,
          price: Number(item.price || 0),
          type: item.type,
        })),
      ],
      subtotal,
      depositAmount: dueNowAmount,
      balanceDue,
      payment: `${currency(dueNowAmount)} due today · ${currency(balanceDue)} after visit`,
      status: 'Payment received',
      holdType: 'paid',
      nextStep: 'Clinical review and scheduling handoff',
      intake: 'Needed',
      consent: 'Needed',
      gfe: clinicalReviewClaimedOnFile ? 'On file' : gfeRequirement.required ? 'Pending' : 'Cleared',
      gfeRecord: profileGfeRecord,
      gfeRequired: gfeRequirement.required,
      gfeExpiresAt: gfeRequirement.expiresAt || '',
      gfeStatusReason: clinicalReviewClaimedOnFile ? 'Client selected clinical review on file. Verify before dispatch.' : gfeRequirement.reason,
      clinicalReviewOnFile: clinicalReviewClaimedOnFile,
      nurse: 'Unassigned',
      source: 'Avalon Webstore',
      orderType: isGroupVisit ? 'event' : visitType.orderType,
      productFamily: isGroupVisit ? 'launch' : state.visitType === 'subscription' ? 'subscription' : 'protocol',
      appointmentChannel: state.locationType === 'event' ? 'venue' : 'mobile',
      appointmentTypeId: slot.appointmentTypeID,
      acuitySlot: slot,
      isNewClient: !returningClient && !clinicalReviewClaimedOnFile,
      visitCount: returningClient || clinicalReviewClaimedOnFile ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
      manualReview: true,
	      clientType: state.clientType,
	      customTreatment,
	      subscription: state.visitType === 'subscription' ? { ...plan, frequency: activeSubscriptionTerm.key, term: activeSubscriptionTerm, monthlyPrice: activePlanMonthlyPrice, price: activePlanPrice, preferredOutcome: outcome.label, preferredProtocol: serviceLabel, customTreatment } : null,
      event: isGroupVisit ? { type: state.eventType, guestCount: guests, gfeTiming: 'Before launch' } : null,
      lifecycleWarnings: [
        clinicalReviewClaimedOnFile
          ? 'Clinical review on file selected. Avalon verifies before dispatch.'
          : gfeRequirement.required
          ? 'Clinical review required before dispatch.'
          : `Clinical review ready${gfeRequirement.expiresAt ? ` through ${formatGfeDate(gfeRequirement.expiresAt)}` : ''}.`,
        'Final eligibility verified before registered nurse dispatch.',
        'Scheduling handoff is represented locally until connected.',
        !COVERED_ZIPS.has(resolvedZip) && 'Service-area review required.',
        isGroupVisit && 'Pre-launch nurse coordination required.',
      ].filter(Boolean),
      notificationPreview: {
        sms: state.phone.trim() ? `Confirmation text queued to ${state.phone.trim()}` : 'Phone required before SMS confirmation.',
        calendar: 'Calendar invite generated locally until Apple/Google calendar is connected.',
        availability: state.availabilityWindow ? 'registered nurse availability window selected locally.' : 'registered nurse availability will be confirmed before dispatch.',
      },
    };
  };

  const canSubmit = Boolean(hasFullName(state.name) && hasDob(state.dob) && state.email.includes('@') && state.phone.replace(/\D/g, '').length >= 10 && state.address.trim() && resolvedZip.length === 5 && (!fastMode || state.safetyFlag));

  const persistLocalBooking = (localBooking, scopeLabel) => {
    clearItems();
    localBooking.items.forEach(addItem);
    saveLastBooking(localBooking);
    orchestrateOrderHandoff(localBooking, {
      source: 'avalon-webstore',
      type: visitType.label,
      scope: scopeLabel,
      depositAmount: localBooking.depositAmount,
    });
    writeLocal('webstore.latestHandoff', {
      bookingId: localBooking.id,
      stack: ['Avalon OS', 'Acuity scheduling', 'Stripe checkout', 'Clinical review', 'registered nurse dispatch', 'Inventory deduction'],
      noThirdPartyCalls: false,
      updatedAt: new Date().toISOString(),
    });
    if (localBooking.subscription) writeLocal('webstore.subscriptionPlan', localBooking.subscription);
    if (localBooking.event) writeLocal('webstore.eventRequest', localBooking.event);
    appendActivity(`Webstore payment started: ${localBooking.service}`, { role: 'client', bookingId: localBooking.id, orderType: localBooking.orderType });
  };

  const checkoutPayloadFor = (localBooking, membershipOverride = null) => {
    const [firstName, ...rest] = String(localBooking.contact?.name || state.name || '').trim().split(/\s+/).filter(Boolean);
    const appointmentTypeId = safeAcuityTypeId(localBooking.appointmentTypeId || localBooking.acuitySlot?.appointmentTypeID);
    return {
      mode: localBooking.subscription || membershipOverride ? 'subscription' : 'payment',
      checkoutUiMode: 'embedded',
      items: (localBooking.items || []).map((item) => ({
        key: item.cartKey,
        cartKey: item.cartKey,
        label: item.label,
        price: item.price,
        type: item.type,
      })),
      membership: membershipOverride || (localBooking.subscription ? {
        key: localBooking.subscription.key,
        name: localBooking.subscription.label || localBooking.subscription.name || plan.label,
        billing: activeSubscriptionTerm.billing,
        price: localBooking.subscription.price || activePlanPrice,
        term: activeSubscriptionTerm.key,
        commitmentMonths: activeSubscriptionTerm.commitmentMonths || activeSubscriptionTerm.months,
      } : null),
      contact: {
        name: localBooking.contact?.name || state.name.trim(),
        firstName: localBooking.contact?.firstName || firstName || state.name.trim(),
        lastName: localBooking.contact?.lastName || rest.join(' '),
        email: localBooking.contact?.email || state.email.trim(),
        phone: localBooking.contact?.phone || state.phone.trim(),
        dob: localBooking.contact?.dob || localBooking.dob || state.dob,
        emergencyContact: localBooking.contact?.emergencyContact || localBooking.emergencyContact || state.emergencyContact.trim(),
      },
      appointment: {
        localBookingId: localBooking.id,
        reference: localBooking.reference,
        acuityDatetime: localBooking.datetime,
        acuityTimezone: localBooking.timezone || TZ,
        acuityTypeId: appointmentTypeId,
        timeLabel: localBooking.time,
        address: localBooking.address,
        zip: localBooking.zip,
        guests: String(localBooking.guests || 1),
        locationType: localBooking.locationType,
        notes: localBooking.notes,
        clinicalReviewOnFile: localBooking.clinicalReviewOnFile,
        gfeRequired: localBooking.gfeRequired,
        depositAmount: localBooking.depositAmount,
        balanceDue: localBooking.balanceDue,
        clientType: localBooking.clientType,
        dob: localBooking.dob || localBooking.contact?.dob || state.dob,
        emergencyContact: localBooking.emergencyContact || localBooking.contact?.emergencyContact || state.emergencyContact.trim(),
      },
    };
  };

  const openCheckout = async (localBooking, membershipOverride = null) => {
    setCheckoutLoading(true);
    setEmbeddedCheckoutSession(null);
    try {
      if (!stripePromise) {
        throw Object.assign(new Error('Embedded checkout is not configured.'), { code: 'stripe_publishable_key_missing' });
      }
      const session = await createCheckoutSession(checkoutPayloadFor(localBooking, membershipOverride));
      track(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
        funnel: 'webstore',
        provider: session.provider,
        booking_id: localBooking.id,
        preview_only: Boolean(session.previewOnly),
      });

      if (session.previewOnly) {
        clearBookingDraft();
        navigate(session.url || `/booking/confirmation?appointment=${encodeURIComponent(localBooking.id)}&preapi=1`);
        return;
      }

      if (!session.clientSecret || session.checkoutUiMode !== 'embedded') {
        throw Object.assign(new Error('Embedded checkout is unavailable.'), { code: 'embedded_checkout_unavailable' });
      }

      clearBookingDraft();
      setEmbeddedCheckoutSession({
        clientSecret: session.clientSecret,
        sessionId: session.sessionId,
        bookingId: localBooking.id,
        service: localBooking.service,
        totalLabel: currency(subtotal),
      });
      setCheckoutLoading(false);
      setError('');
      window.setTimeout(() => scrollStepIntoView(), 50);
    } catch (err) {
      if (err.code === 'checkout_api_unavailable' && canUseStaticPreviewFallback()) {
        clearBookingDraft();
        navigate(`/booking/confirmation?appointment=${encodeURIComponent(localBooking.id)}&preapi=1`);
        return;
      }
      setCheckoutLoading(false);
      setError(err.message || 'Checkout is unavailable. Try again.');
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'webstore',
        booking_id: localBooking.id,
        reason: err.code || 'checkout_failed',
      });
    }
  };

  const submit = async () => {
    if (checkoutLoading) return;
    if (!product) {
      setError('Choose therapy.');
      setStep(0);
      return;
    }
    if (groupContactRequired) {
      routeGroupContact();
      return;
    }
	    if (!canSubmit) {
      setError(fastMode ? 'Add contact, date of birth, address, and safety response.' : 'Add contact, date of birth, and service address with ZIP.');
      setStep(LAST_STEP);
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'webstore',
        step_index: LAST_STEP,
        step_name: STEPS[LAST_STEP],
        reason: 'required_fields_missing',
      });
      return;
    }
    const candidate = buildBooking();
    if (!candidate) return;
    const check = validateBookingForCheckout(candidate, { coveredZips: COVERED_ZIPS });
    const localBooking = createBookingRecord({
      ...candidate,
      manualReview: true,
      lifecycleWarnings: [...new Set([...(candidate.lifecycleWarnings || []), ...(check.warnings || [])])],
    });

    if (state.visitType === 'subscription') {
      const subscriptionPlan = {
	        key: plan.key,
	        name: plan.label,
	        billing: activeSubscriptionTerm.billing,
	        term: activeSubscriptionTerm.key,
	        commitmentMonths: activeSubscriptionTerm.commitmentMonths || activeSubscriptionTerm.months,
	        monthlyPrice: activePlanMonthlyPrice,
	        price: activePlanPrice,
		        ivCount: activePlanSessions,
		        discount: plan.discount,
		        preferredOutcome: outcome.label,
		        preferredProtocol: serviceLabel,
		        custom: Boolean(plan.custom),
		        customPlan: plan.custom ? {
		          visitsPerMonth: customPlanSessions,
		          estimatedMonthly: customPlanEstimate,
		          baseSubtotal,
		          service: serviceLabel,
		          addOns: selectedAddons.map((item) => item.type === 'im' ? `IM · ${item.label}` : item.label),
			        } : null,
			        customTreatment: isCustomTreatment ? {
			          base: customBase.label,
			          baseKey: customBase.key,
			          estimate: baseSubtotal,
			        } : null,
	        addOns: selectedAddons.map((item) => item.type === 'im' ? `IM · ${item.label}` : item.label),
        intake: {
          name: state.name.trim(),
          email: state.email.trim(),
          phone: state.phone.trim(),
          dob: state.dob,
          emergencyContact: state.emergencyContact.trim(),
          address: state.address.trim(),
          zip: String(state.zip || '').trim(),
          locationType: state.locationType,
          timeIntent: state.timeIntent,
          customDate: state.customDate,
          customTime: state.customTime,
          notes: state.notes,
          clientType: state.clientType,
        },
      };

      persistLocalBooking(localBooking, 'Subscription checkout');
      clearMembership?.();
      setMembershipTier?.(subscriptionPlan);
	      writeLocal('webstore.subscriptionIntake', {
	        ...subscriptionPlan,
	        subtotal,
	        customPlanEstimate,
	        updatedAt: new Date().toISOString(),
	      });
	      appendActivity(`Subscription checkout started: ${plan.label} · ${serviceLabel}`, {
	        role: 'client',
	        orderType: 'subscription',
	        protocolKey: isCustomTreatment ? `custom-${customBase.key}` : product.key,
	      });
      track(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
        funnel: 'webstore',
        order_type: 'subscription',
        product_family: 'subscription',
	        protocol_key: isCustomTreatment ? `custom-${customBase.key}` : product.key,
        plan_key: plan.key,
        addon_count: selectedAddons.length,
        subtotal,
      });
      await openCheckout(localBooking, {
        key: subscriptionPlan.key,
        name: subscriptionPlan.name,
        billing: subscriptionPlan.billing,
        term: subscriptionPlan.term,
        commitmentMonths: subscriptionPlan.commitmentMonths,
        price: subscriptionPlan.price,
      });
      return;
    }

    track(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
      funnel: 'webstore',
      booking_id: localBooking.id,
      order_type: localBooking.orderType,
      product_family: localBooking.productFamily,
      protocol_key: localBooking.protocolKey,
      addon_count: localBooking.addOns?.length || 0,
      subtotal,
      amount_due: subtotal,
      gfe_required: localBooking.gfeRequired,
    });

    persistLocalBooking(localBooking, state.visitType === 'event' ? 'Launch/group checkout' : 'One-time checkout');
    await openCheckout(localBooking);
  };

  const embeddedCheckoutOptions = useMemo(() => {
    if (!embeddedCheckoutSession?.clientSecret) return null;
    return {
      clientSecret: embeddedCheckoutSession.clientSecret,
      onComplete: () => {
        navigate(`/booking/confirmation?session_id=${encodeURIComponent(embeddedCheckoutSession.sessionId)}&payment=success`);
      },
    };
  }, [embeddedCheckoutSession?.clientSecret, embeddedCheckoutSession?.sessionId, navigate]);

  const menuTherapies = useMemo(() => {
    return BOOKING_THERAPY_KEYS.map((key) => safeProtocol(getProductByKey(key))).filter(Boolean);
  }, []);
  const therapyGroups = useMemo(() => (
    THERAPY_GROUPS.map((group) => ({
      ...group,
      items: group.keys.map((key) => safeProtocol(getProductByKey(key))).filter(Boolean),
    }))
  ), []);
  const activeTherapyGroupData = therapyGroups.find((group) => group.key === activeTherapyGroup) || therapyGroups[0];
  const activeTherapies = activeTherapyGroupData?.items || [];
  const desktopTherapyMenu = useMemo(() => {
    return DESKTOP_THERAPY_MENU_KEYS.map((key) => safeProtocol(getProductByKey(key))).filter(Boolean);
  }, []);
  const activeTherapyDisplayTitle = activeTherapyGroupData?.key === 'vitamin'
    ? 'IV THERAPY'
    : activeTherapyGroupData?.key === 'cbd'
      ? 'CBD IV THERAPY'
      : 'NAD+ IV THERAPY';
  const progressDisplay = {
    index: step === 0
      ? 0
      : step === 1
        ? 1
        : step === 2
          ? 2
          : step === 3
            ? 3
            : 4,
    title: step === 0
      ? (therapyCategoryScreen ? 'THERAPY BASE' : activeTherapyDisplayTitle)
      : step === 1
        ? 'ADD-ONS'
      : STEPS[step].toUpperCase(),
  };
  const canGoBack = step > 0 || (step === 0 && !therapyCategoryScreen);

  const compactAddons = useMemo(() => addonCatalog.all.slice(0, 4), [addonCatalog]);

  const compactProtocolCopy = (item) => {
    const overrides = {
      recovery: { label: 'Recovery', line: 'Hydration support.' },
      postnight: { label: 'Night Out', line: 'After-hours reset.' },
      hydration: { label: 'Hydration', line: 'Fluids + electrolytes.' },
      energy: { label: 'Energy', line: 'Nutrients + focus.' },
      immunity: { label: 'Immunity', line: 'Vitamin support.' },
      myers: { label: "Myers' Cocktail", line: 'Core nutrient blend.' },
      performance: { label: 'Performance', line: 'High-output support.' },
      jetlag: { label: 'Jet Lag', line: 'Arrival support.' },
      'food-poisoning': { label: 'Food Poisoning', line: 'GI hydration support.' },
      beauty: { label: 'Glow', line: 'Beauty support.' },
    };
    if (overrides[item?.key]) return overrides[item.key];
    if (item?.parentProtocolKey === 'nad') return { label: item.label, line: 'Advanced protocol.' };
    if (item?.parentProtocolKey === 'cbd') return { label: item.label, line: 'Clinical review.' };
    return { label: item?.tabLabel || item?.label || 'Therapy', line: 'Clinical review.' };
  };

  const hasSavedContactProfile = Boolean(savedContactProfile?.name || savedContactProfile?.email || savedContactProfile?.phone);

  const updateInlineContactField = (field, value) => {
    const next = { name: state.name, phone: state.phone, email: state.email, [field]: value };
    setValue(field, value);
    setValue('contactLine', formatContactLine(next));
  };

  const useSavedContactProfile = () => {
    const next = {
      name: savedContactProfile?.name || '',
      phone: formatPhoneNumber(savedContactProfile?.phone || ''),
      email: savedContactProfile?.email || '',
    };
    setValue('name', next.name);
    setValue('phone', next.phone);
    setValue('email', next.email);
    setValue('contactLine', formatContactLine(next));
  };

  const panelCardClass = 'relative overflow-hidden rounded-[1.15rem] border border-foreground/12 bg-background/42 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl';
  const microLabelClass = 'font-body text-[9px] font-black uppercase tracking-[0.13em] text-foreground/58 md:text-[10px]';

  const renderUniversalStep = () => {
    if (step === 3) {
      return (
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-1.5 md:gap-2">
          <div className={`${panelCardClass} p-2`}>
            <LocationTypeDropdown value={state.locationType} onChange={(value) => setValue('locationType', value)} />
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locationLoading}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-foreground/12 bg-background/44 px-3 font-body text-xs font-black text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)]"
            >
              <span className="flex items-center gap-2">
                <Navigation className="h-4 w-4" strokeWidth={2.4} />
                {locationLoading ? 'Finding address' : 'Use current location'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className={`${panelCardClass} p-2.5 md:p-3`}>
            <div className="grid gap-2">
              <TextInput
                label={LOCATION_TYPES.find((item) => item.key === state.locationType)?.placeholder || 'Address'}
                value={state.address}
                onChange={setAddressValue}
                onKeyDown={handleAddressKeyDown}
                placeholder="Street address"
                autoComplete="street-address"
                actionLabel={savedVisitAddress?.address ? 'Saved' : ''}
                onAction={() => chooseAddressSuggestion(savedVisitAddress)}
                required
              />
              {state.address.trim() && !resolvedZip && (
                <TextInput
                  label="ZIP"
                  value={state.zip}
                  onChange={(value) => setValue('zip', value.replace(/\D/g, '').slice(0, 5))}
                  onKeyDown={handleAddressKeyDown}
                  placeholder="94107"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  required
                />
              )}
            </div>
          </div>
          <div className="min-h-0">
            <AddressPrediction suggestion={topAddressSuggestion} onUse={chooseAddressSuggestion} compact />
            {!topAddressSuggestion && (
              <div className={`${panelCardClass} mt-0 flex min-h-[66px] items-center gap-2.5 p-2.5 md:min-h-[76px] md:gap-3 md:p-3`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.055] text-foreground/80">
                  <MapPin className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className={microLabelClass}>Coverage</p>
                  <p className="mt-1 font-body text-sm font-bold leading-snug text-foreground/72">Enter your street address. Avalon checks the ZIP before payment.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (step === 0) {
      if (therapyCategoryScreen) {
        return (
          <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-2 md:gap-3">
            <p className={`${microLabelClass} pt-0.5 text-center tracking-[0.22em] md:pt-1`}>Choose a therapy base</p>
            <div className="grid min-h-0 grid-rows-3 gap-1.5 md:h-full md:grid-rows-3 md:gap-2.5 2xl:gap-4">
              {therapyGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      setActiveTherapyGroup(group.key);
                      setTherapyCategoryScreen(false);
                    }}
                    className={`${panelCardClass} grid min-h-0 grid-cols-[62px_1fr_24px] items-center gap-2.5 px-3 text-left transition-colors hover:border-foreground/24 min-[390px]:grid-cols-[68px_1fr_26px] min-[390px]:px-3.5 md:grid-cols-[82px_1fr_28px] md:gap-3 md:px-5 2xl:grid-cols-[112px_1fr_34px] 2xl:px-8`}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-foreground min-[390px]:h-12 min-[390px]:w-12 md:h-12 md:w-12 2xl:h-20 2xl:w-20">
                      <GroupIcon className="h-6 w-6 min-[390px]:h-7 min-[390px]:w-7 md:h-7 md:w-7 2xl:h-12 2xl:w-12" strokeWidth={2.05} />
                    </span>
                    <span className="relative min-w-0 border-l border-foreground/10 pl-3 md:pl-4 2xl:pl-7">
                      <span className="block font-heading text-[1.42rem] uppercase leading-none tracking-normal text-foreground min-[390px]:text-[1.55rem] md:text-[1.45rem] 2xl:text-[2.35rem]">{group.label}</span>
                      <span className="mt-0.5 block font-body text-xs font-bold text-foreground/62 md:mt-1 md:text-xs 2xl:text-base">{group.sub}</span>
                    </span>
                    <span className="relative flex justify-end text-foreground/84">
                      <ArrowRight className="h-5 w-5 2xl:h-7 2xl:w-7" strokeWidth={2.5} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      const isDoseTherapyGroup = ['cbd', 'nad'].includes(activeTherapyGroupData?.key);
      const denseTherapyGrid = !isDoseTherapyGroup && activeTherapies.length > 6;
      const renderTherapyCard = (item, { desktopMenu = false } = {}) => {
        const Icon = item.icon || Droplets;
        const active = state.productKey === item.key;
        const copy = compactProtocolCopy(item);
        const menuLabel = desktopMenu && item.parentProtocolKey === 'nad'
          ? 'NAD+'
          : desktopMenu && item.parentProtocolKey === 'cbd'
            ? 'CBD'
            : copy.label;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => chooseProduct(item.key)}
            aria-pressed={active}
            className={`${panelCardClass} relative min-h-0 transition-colors ${
              active ? 'border-foreground/70 bg-foreground/[0.14] ring-1 ring-inset ring-foreground/46 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_0_34px_hsl(var(--foreground)/0.12)]' : 'hover:border-foreground/24'
            } ${isDoseTherapyGroup ? 'grid grid-cols-[42px_1fr_auto] items-center gap-3 px-3 py-2 text-left' : denseTherapyGrid ? 'flex flex-col items-center justify-center gap-1 px-1.5 py-1 text-center md:gap-1.5 md:px-2 md:py-2' : 'flex flex-col items-center justify-center gap-2 p-2 text-center'}`}
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
            {active && !isDoseTherapyGroup && (
              <span className={`${denseTherapyGrid ? 'right-1 top-1 h-5 w-5 md:right-1.5 md:top-1.5 md:h-6 md:w-6' : 'right-2 top-2 h-7 w-7'} absolute flex items-center justify-center rounded-full border border-foreground/24 bg-foreground/[0.10] text-foreground`}>
                <Check className={`${denseTherapyGrid ? 'h-3 w-3 md:h-3.5 md:w-3.5' : 'h-4 w-4'}`} strokeWidth={2.7} />
              </span>
            )}
            <span className={`${isDoseTherapyGroup ? 'h-10 w-10' : denseTherapyGrid ? 'h-7 w-7 md:h-16 md:w-16' : 'h-10 w-10'} relative flex shrink-0 items-center justify-center rounded-xl text-foreground`}>
              <Icon className={`${denseTherapyGrid && !isDoseTherapyGroup ? 'h-4 w-4 md:h-12 md:w-12' : 'h-6 w-6'}`} strokeWidth={2.15} />
            </span>
            <span className={`relative min-w-0 ${isDoseTherapyGroup ? 'pr-1' : ''}`}>
              <span className={`block break-words font-heading uppercase tracking-normal text-foreground ${
                isDoseTherapyGroup
                  ? 'text-[1.15rem] leading-none min-[390px]:text-[1.25rem] md:text-[1.75rem]'
                  : denseTherapyGrid
                    ? 'text-[0.72rem] leading-[0.9] min-[390px]:text-[0.78rem] md:text-[1.85rem] md:leading-none lg:text-[2rem]'
                  : 'text-[1rem] leading-[0.9] min-[390px]:text-[1.08rem] md:text-[1.75rem]'
              }`}>{menuLabel}</span>
              {isDoseTherapyGroup && (
                <span className="mt-0.5 block truncate font-body text-[10px] font-black uppercase tracking-[0.08em] text-foreground/58">
                  {protocolDuration(item)} · {currency(protocolPrice(item))}
                </span>
              )}
              {!isDoseTherapyGroup && active && <span className={`${denseTherapyGrid ? 'mt-0.5 text-[8px] md:text-[9px]' : 'mt-1 text-[10px]'} block font-body font-black uppercase tracking-[0.08em] text-foreground/62`}>{currency(protocolPrice(item))}</span>}
            </span>
            {isDoseTherapyGroup && (
              <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                active ? 'border-foreground/26 bg-foreground/[0.10] text-foreground' : 'border-foreground/14 bg-background/28 text-foreground/62'
              }`}>
                {active ? <Check className="h-4 w-4" strokeWidth={2.7} /> : <ArrowRight className="h-4 w-4" strokeWidth={2.4} />}
              </span>
            )}
          </button>
        );
      };

      return (
        <div className={`${denseTherapyGrid ? 'md:grid-rows-[auto_1fr_auto]' : 'md:grid-rows-[auto_1fr]'} grid h-full min-h-0 grid-rows-[auto_1fr] gap-2 md:gap-4`}>
          <p className={`${microLabelClass} pt-0.5 text-center tracking-[0.22em] md:pt-1 md:text-left`}>
            {isDoseTherapyGroup ? 'Choose dose' : `Choose your ${activeTherapyDisplayTitle.toLowerCase()}`}
          </p>
          {denseTherapyGrid ? (
            <>
              <div className="grid min-h-0 auto-rows-[4.2rem] grid-cols-3 content-start gap-1.5 overflow-hidden min-[390px]:auto-rows-[4.35rem] md:hidden">
                {activeTherapies.map((item) => renderTherapyCard(item))}
              </div>
              <div className="hidden min-h-0 content-start overflow-hidden md:grid md:auto-rows-[7.25rem] md:grid-cols-3 md:gap-2.5 [@media_(min-height:900px)]:md:auto-rows-[8.15rem] [@media_(min-height:900px)]:md:gap-3">
                {desktopTherapyMenu.map((item) => renderTherapyCard(item, { desktopMenu: true }))}
              </div>
            </>
          ) : (
            <div className={`grid min-h-0 content-start gap-1.5 md:gap-2 ${
              isDoseTherapyGroup
                ? 'grid-cols-1 auto-rows-[3.85rem] min-[390px]:auto-rows-[4rem]'
                : activeTherapies.length <= 4
                ? 'grid-cols-1 md:grid-cols-2 auto-rows-[8.2rem] min-[390px]:auto-rows-[8.75rem] md:auto-rows-[9.4rem]'
                : activeTherapies.length <= 6
                  ? 'grid-cols-1 md:grid-cols-2 auto-rows-[7.9rem] min-[390px]:auto-rows-[8.4rem] md:auto-rows-[9rem]'
                  : 'grid-cols-1 auto-rows-[5rem] overflow-y-auto pr-1 md:grid-cols-2 md:auto-rows-[6.75rem]'
            }`}>
              {activeTherapies.map((item) => renderTherapyCard(item))}
            </div>
          )}
          {denseTherapyGrid && <div className="hidden [@media_(min-height:900px)]:md:block"><TrustSpeedStrip /></div>}
        </div>
      );
    }

    if (step === 1) {
      const selectedAddonGroup = addonCatalog.groups.find((group) => group.key === activeAddonGroup);

      if (!selectedAddonGroup) {
        return (
          <div className="h-full min-h-0">
            <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-2 md:hidden">
            <p className={`${microLabelClass} pt-0.5 text-center tracking-[0.22em]`}>Choose add-ons</p>
              <div className="grid min-h-0 content-start gap-1.5 overflow-y-auto pb-2 pr-1">
                <button
                  type="button"
                  onClick={chooseNoAddons}
                  className={`${panelCardClass} grid min-h-[74px] grid-cols-[48px_1fr_24px] items-center gap-2.5 px-3 text-left transition-colors hover:border-foreground/24 ${
                    state.addOnDecision && state.addOns.length === 0 ? 'border-foreground/42 bg-foreground/[0.14]' : ''
                  }`}
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-xl text-foreground">
                    <Check className="h-5 w-5" strokeWidth={2.3} />
                  </span>
                  <span className="relative min-w-0 border-l border-foreground/10 pl-3">
                    <span className="block font-heading text-[1.35rem] uppercase leading-none tracking-normal text-foreground">No add-ons</span>
                    <span className="mt-0.5 block font-body text-xs font-bold text-foreground/62">Fastest checkout</span>
                  </span>
                  <span className="relative flex justify-end text-foreground/84">
                    <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                </button>
              {addonCatalog.groups.map((group) => {
                const GroupIcon = group.key === 'iv' ? Plus : group.icon;
                const selectedCount = group.items.filter((item) => state.addOns.includes(item.label)).length;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setActiveAddonGroup(group.key)}
                    className={`${panelCardClass} grid min-h-[84px] grid-cols-[52px_1fr_24px] items-center gap-2.5 px-3 text-left transition-colors hover:border-foreground/24`}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-foreground">
                      <GroupIcon className="h-6 w-6" strokeWidth={2.05} />
                    </span>
                    <span className="relative min-w-0 border-l border-foreground/10 pl-3">
                      <span className="block font-heading text-[1.42rem] uppercase leading-none tracking-normal text-foreground">{group.label}</span>
                      <span className="mt-0.5 block font-body text-xs font-bold text-foreground/62">
                        {selectedCount ? `${selectedCount} selected` : group.key === 'iv' ? 'Enhance your IV therapy' : 'Enhance with IM injections'}
                      </span>
                    </span>
                    <span className="relative flex justify-end text-foreground/84">
                      <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
            <div className="hidden h-full min-h-0 content-start gap-4 md:grid">
              <p className={`${microLabelClass} pt-1 tracking-[0.22em]`}>Choose your add-ons</p>
              <div className="grid min-h-0 gap-4">
                {addonCatalog.groups.map((group) => (
                  <section key={group.key} className="min-h-0">
                    <p className="mb-2 font-body text-xs font-black uppercase tracking-[0.14em] text-foreground/72">{group.label}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {group.items.map((item) => {
                        const Icon = item.icon || Plus;
                        const active = state.addOns.includes(item.label);
                        return (
                          <button
                            key={`${group.key}-${item.label}`}
                            type="button"
                            onClick={() => toggleAddon(item.label)}
                            aria-pressed={active}
                            className={`${panelCardClass} flex min-h-[82px] flex-col justify-between p-3 text-left transition-colors ${
                              active ? 'border-foreground/58 bg-foreground/[0.14] ring-1 ring-inset ring-foreground/32' : 'hover:border-foreground/24'
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span className="flex h-5 w-5 items-center justify-center rounded border border-foreground/20 bg-background/32 text-foreground/82">
                                {active ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />}
                              </span>
                              <span className="h-4 w-4 rounded border border-foreground/20 bg-background/32" />
                            </span>
                            <span>
                              <span className="block font-body text-sm font-black leading-tight text-foreground">{item.label}</span>
                              <span className="mt-1 block font-body text-xs font-bold text-foreground/64">+ {currency(item.price)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="grid h-full min-h-0 content-start gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => setActiveAddonGroup('')}
            className={`${panelCardClass} flex min-h-[48px] items-center justify-between gap-2.5 px-2.5 text-left md:min-h-[58px] md:gap-3 md:px-3`}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.055] md:h-10 md:w-10">
                <ArrowLeft className="h-4 w-4" />
              </span>
              <span className="font-heading text-[1.32rem] uppercase leading-none tracking-normal md:text-[1.55rem]">{selectedAddonGroup.label}</span>
            </span>
            <span className="font-body text-xs font-black uppercase tracking-[0.1em] text-foreground/62">Category</span>
          </button>
          <div className="grid min-h-0 content-start gap-1.5 grid-cols-2 md:grid-cols-3 md:gap-2">
            {selectedAddonGroup.items.map((item) => {
              const active = state.addOns.includes(item.label);
              const Icon = item.icon || Plus;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => toggleAddon(item.label)}
                  className={`${panelCardClass} flex min-h-[72px] flex-col justify-between p-2 text-left transition-colors md:min-h-[96px] md:p-2.5 ${active ? 'border-foreground/42 bg-foreground/[0.14]' : ''}`}
                >
                  <span className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.055] md:h-9 md:w-9">
                      <Icon className="h-3.5 w-3.5 md:h-[18px] md:w-[18px]" strokeWidth={2.45} />
                    </span>
                    {active ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                  <span>
                    <span className="block font-heading text-[0.92rem] uppercase leading-none tracking-normal md:text-[1.18rem]">{item.label}</span>
                    <span className="mt-0.5 block font-body text-xs font-black md:text-base">{currency(item.price)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-1.5 md:gap-2">
          <div className="grid gap-1.5 md:grid-cols-2 md:gap-2">
            {TIME_INTENTS.map((item) => {
              const active = state.timeIntent === item.key || (item.key === 'asap' && ['today', 'soonest'].includes(state.timeIntent));
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => chooseTimeIntent(item.key)}
                  className={`${panelCardClass} flex min-h-[72px] flex-col justify-between p-2.5 text-left md:min-h-[86px] md:p-3 ${active ? 'border-foreground/42 bg-foreground/[0.14]' : ''}`}
                >
                  <span className="flex items-center justify-between">
                    <Icon className="h-5 w-5" strokeWidth={2.45} />
                    {active && <Check className="h-4 w-4" />}
                  </span>
                  <span className="font-heading text-[1.55rem] uppercase leading-none tracking-normal md:text-[1.9rem]">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className={`${panelCardClass} grid min-h-0 grid-rows-[auto_auto_1fr] gap-2 p-2.5 md:gap-3 md:p-3`}>
            <div className="flex items-center justify-between">
              <p className={microLabelClass}>Arrival</p>
              <p className="font-body text-sm font-black text-foreground/76">{bookingTimeSummary(state)}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block rounded-2xl border border-foreground/12 bg-foreground/[0.04] p-2.5 md:p-3">
                <span className={microLabelClass}>Date</span>
                <select
                  aria-label="Choose date"
                  value={state.customDate}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    const nextTime = state.customTime || DEFAULT_EXACT_TIME;
                    setState((current) => ({
                      ...current,
                      customDate: nextDate,
                      customTime: nextTime,
                      availabilityWindow: `${nextDate}-${nextTime}`,
                      timeIntent: 'choose',
                    }));
                  }}
                  className="mt-0.5 min-h-[30px] w-full bg-transparent font-body text-sm font-black text-foreground outline-none [color-scheme:dark] md:mt-1 md:min-h-[34px] md:text-base"
                >
                  {dateOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label} · {option.day}</option>
                  ))}
                </select>
              </label>
              <label className="block rounded-2xl border border-foreground/12 bg-foreground/[0.04] p-2.5 md:p-3">
                <span className={microLabelClass}>Time</span>
                <select
                  aria-label="Choose time"
                  value={state.customTime || DEFAULT_EXACT_TIME}
                  onChange={(event) => chooseAvailabilityWindow({ key: event.target.value, time: event.target.value, display: formatTimeLabel(event.target.value) })}
                  className="mt-0.5 min-h-[30px] w-full bg-transparent font-body text-sm font-black text-foreground outline-none [color-scheme:dark] md:mt-1 md:min-h-[34px] md:text-base"
                >
                  {timeSlots.map((slot) => (
                    <option key={slot.key} value={slot.time}>{slot.display}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex min-h-0 items-center rounded-2xl border border-foreground/10 bg-background/30 px-3 font-body text-xs font-semibold leading-snug text-foreground/62 md:text-sm">
              Earliest available Registered Nurse window.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid h-full min-h-0 content-start gap-1.5 md:gap-2">
        <div className={`${panelCardClass} p-2 md:p-2.5`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={microLabelClass}>Ready</p>
              <p className="mt-0.5 truncate font-heading text-[1.35rem] uppercase leading-none tracking-normal md:mt-1 md:text-[1.7rem]">{serviceLabel}</p>
            </div>
            <p className="shrink-0 font-body text-[1.32rem] font-black md:text-[1.55rem]">{currency(subtotal)}</p>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1 md:mt-2 md:grid-cols-2 md:gap-1.5">
            {[
              ['Where', resolvedZip || 'ZIP'],
              ['When', bookingTimeSummary(state)],
              ['Review', state.clinicalReviewOnFile ? 'On file' : 'Needed'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/10 bg-foreground/[0.035] p-1.5">
                <p className="font-body text-[8px] font-black uppercase tracking-[0.1em] text-foreground/52 md:text-[9px]">{label}</p>
                <p className="mt-0.5 truncate font-body text-[10px] font-black text-foreground/78 md:mt-1 md:text-xs">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`${panelCardClass} grid min-h-0 content-start gap-1.5 p-2 md:gap-2 md:p-2.5`}>
          <div className="grid grid-cols-2 gap-1.5 md:gap-2">
            <div className="col-span-2">
              <TextInput
                label="Name"
                value={state.name}
                onChange={(value) => updateInlineContactField('name', value)}
                placeholder="Alex Morgan"
                autoComplete="name"
                compact
                actionLabel={hasSavedContactProfile ? 'Saved' : ''}
                onAction={useSavedContactProfile}
                required
              />
            </div>
            <TextInput
              label="Phone"
              value={state.phone}
              onChange={(value) => updateInlineContactField('phone', value)}
              placeholder="(415) 555-0123"
              autoComplete="tel"
              inputMode="tel"
              type="tel"
              compact
              required
            />
            <TextInput
              label="DOB"
              value={state.dob}
              onChange={(value) => setValue('dob', formatDobInput(value))}
              placeholder="MM/DD/YYYY"
              autoComplete="bday"
              inputMode="numeric"
              compact
              required
            />
            <div className="col-span-2">
              <TextInput
                label="Email"
                value={state.email}
                onChange={(value) => updateInlineContactField('email', value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                type="email"
                compact
                required
              />
            </div>
          </div>
          <p className="rounded-xl border border-foreground/10 bg-background/30 px-2.5 py-1.5 font-body text-[9px] font-semibold leading-snug text-foreground/52 md:px-3 md:py-2 md:text-[10px]">
            By paying, I consent to intake, privacy terms, and clinical review. Treatment is subject to approval.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell relative isolate min-h-[100dvh] w-full overflow-x-hidden bg-transparent text-foreground md:min-h-screen">
      <BookingMobileHeader />
      <div className="hidden md:block">
        <Navbar />
      </div>
      <main
        className="mx-auto h-[100dvh] max-h-[100dvh] min-h-[100svh] w-full max-w-[calc(100vw-2rem)] overflow-hidden px-0 pb-0 pt-[var(--av-booking-mobile-header)] md:flex md:h-auto md:max-h-none md:min-h-screen md:max-w-none md:items-center md:px-4 md:pb-4 md:pt-24"
        style={{
          '--av-booking-mobile-header': 'calc(env(safe-area-inset-top, 0px) + 4.45rem)',
          '--av-booking-footer-reserve': 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)',
        }}
      >
        {embeddedCheckoutSession && embeddedCheckoutOptions && (
          <motion.section
            className="mx-auto max-w-3xl"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE }}
          >
            <div className="av-glass-card relative overflow-hidden rounded-[1.75rem] border border-foreground/10 bg-background/38 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_30px_120px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-4">
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,hsl(var(--foreground)/0.095),transparent_30%),radial-gradient(circle_at_95%_100%,hsl(var(--foreground)/0.045),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.04),transparent_55%,hsl(var(--foreground)/0.025))]" />
              <div className="relative">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <SectionTitle icon={ShieldCheck} title="SECURE PAYMENT" sub={`${embeddedCheckoutSession.service} · ${dueNowLabel}`} />
                  <button
                    type="button"
                    onClick={() => {
                      setEmbeddedCheckoutSession(null);
                      setCheckoutLoading(false);
                      setStep(LAST_STEP);
                    }}
                    className="min-h-[44px] shrink-0 rounded-full border border-foreground/14 px-4 font-body text-xs font-bold uppercase tracking-[0.1em] text-foreground/76 transition-colors hover:border-foreground/28 hover:text-foreground"
                  >
                    Edit Booking
                  </button>
                </div>
                <div className="overflow-hidden rounded-[1.35rem] border border-foreground/10 bg-background shadow-[0_24px_90px_hsl(var(--foreground)/0.12)]">
                  <div className="border-b border-foreground/8 px-4 py-3">
                    <p className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/60">Secure checkout ready</p>
                    <div className="mt-2 h-px overflow-hidden bg-foreground/10">
                      <motion.div
                        className="h-full bg-foreground"
                        initial={reduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE }}
                        style={{ originX: 0 }}
                      />
                    </div>
                  </div>
                  <EmbeddedCheckoutProvider
                    key={embeddedCheckoutSession.clientSecret}
                    stripe={stripePromise}
                    options={embeddedCheckoutOptions}
                  >
                    <EmbeddedCheckout className="min-h-[calc(100dvh-250px)]" />
                  </EmbeddedCheckoutProvider>
                </div>
              </div>
            </div>
          </motion.section>
        )}
        {!embeddedCheckoutSession && (
          <>
            <div className="h-full min-h-0 md:hidden">
              <UniversalBookingFrame
                step={step}
                total={totalLabel}
                dueNow={dueNowLabel}
                dueAfter={dueAfterLabel}
                displayStepIndex={progressDisplay.index}
                displayTitle={progressDisplay.title}
                progressIndex={progressDisplay.index}
                canGoNext={step < LAST_STEP ? canAdvance() : canSubmit}
                actionLabel={primaryActionLabel()}
                checkoutLoading={checkoutLoading}
                error={error}
                canGoBack={canGoBack}
                onBack={back}
                onNext={step < LAST_STEP ? next : submit}
                onStepSelect={goToStep}
              >
                {renderUniversalStep()}
              </UniversalBookingFrame>
            </div>
            <DesktopBookingFrame
              step={step}
              displayStepIndex={progressDisplay.index}
              displayTitle={progressDisplay.title}
              canGoNext={step < LAST_STEP ? canAdvance() : canSubmit}
              actionLabel={step === LAST_STEP ? `CONFIRM & PAY ${currency(dueNowAmount)}` : primaryActionLabel()}
              checkoutLoading={checkoutLoading}
              error={error}
              canGoBack={canGoBack}
              state={state}
              product={product}
              selectedAddons={selectedAddons}
              subtotal={subtotal}
              dueNow={dueNowAmount}
              balanceDue={balanceDue}
              totalLabel={totalLabel}
              onBack={back}
              onNext={step < LAST_STEP ? next : submit}
              onStepSelect={goToStep}
            >
              {renderUniversalStep()}
            </DesktopBookingFrame>
          </>
        )}
        {false && !embeddedCheckoutSession && fastMode ? (
          <FastReviewSurface
            product={product}
            serviceLabel={serviceLabel}
            balanceDue={balanceDue}
            state={state}
            resolvedZip={resolvedZip}
            topAddressSuggestion={topAddressSuggestion}
            savedVisitAddress={savedVisitAddress}
            savedContactProfile={savedContactProfile}
            locationLoading={locationLoading}
            checkoutLoading={checkoutLoading}
            error={error}
            onAddress={setAddressValue}
            onAddressKeyDown={handleAddressKeyDown}
            onAddressSuggestion={chooseAddressSuggestion}
            onValue={setValue}
            onUseCurrentLocation={useCurrentLocation}
            onChangeTherapy={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('fast');
              const query = next.toString();
              navigate(query ? `/book?${query}` : '/book');
            }}
            onSubmit={submit}
          />
        ) : (
        <div className="hidden">
          <section ref={stepShellRef} tabIndex={-1} className="min-w-0 scroll-mt-28 outline-none">
            {fastMode ? (
              <div className="mb-3 rounded-2xl border border-foreground/10 bg-background/34 px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-2xl">
                <p className="font-body text-xs font-black uppercase tracking-[0.18em] text-foreground/58">
                  {step === 1 ? '1 of 3 · Therapy' : step === 3 ? '2 of 3 · Address' : '3 of 3 · Patient'}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-foreground transition-all duration-500"
                    style={{ width: step === 1 ? '33%' : step === 3 ? '66%' : '100%' }}
                  />
                </div>
              </div>
            ) : compressedFlow && step >= 3 ? (
              <div className="mb-3 rounded-2xl border border-foreground/10 bg-background/34 px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-2xl">
                <p className="font-body text-xs font-black uppercase tracking-[0.18em] text-foreground/58">
                  {step === 3 ? '1 of 2 · Visit' : '2 of 2 · Patient'}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-foreground transition-all duration-500"
                    style={{ width: step === 3 ? '50%' : '100%' }}
                  />
                </div>
              </div>
            ) : step > 0 ? (
              <>
                <StepProgress step={step} onStepSelect={goToStep} />
                <StepControls
                  step={step}
                  canGoNext={canAdvance()}
                  nextLabel={primaryActionLabel()}
                  total={totalLabel}
                  onBack={back}
                  onNext={step < LAST_STEP ? next : submit}
                />
              </>
            ) : null}
            {error && (
              <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/22 bg-amber-300/[0.07] px-4 py-3 text-amber-100">
                <p className="font-body text-sm font-black">{error}</p>
                <a href="sms:+14159807708" className="shrink-0 rounded-full border border-amber-200/24 px-3 py-1.5 font-body text-xs font-black uppercase tracking-[0.08em]">
                  Text us
                </a>
              </div>
            )}
            <motion.div
              key={step}
              className="av-glass-card relative overflow-hidden rounded-[1.75rem] border border-foreground/10 bg-background/32 p-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_30px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl md:p-4"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 4, scale: 1 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: EASE }}
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,hsl(var(--foreground)/0.095),transparent_30%),radial-gradient(circle_at_95%_100%,hsl(var(--foreground)/0.045),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.04),transparent_55%,hsl(var(--foreground)/0.025))]" />
              <div className="relative">
                {step === 0 && (
                  <>
                    <SectionTitle icon={Sparkles} title="CHOOSE YOUR GOAL" />
                    <LayoutGroup id="outcomes">
                      <div className="grid gap-2 md:grid-cols-2 md:gap-3">
                        {OUTCOMES.filter((item) => PRIMARY_OUTCOME_KEYS.includes(item.key)).map((item, index) => (
                          <OutcomeCard key={item.key} item={item} index={index} active={state.outcome === item.key} onClick={() => chooseOutcome(item.key)} />
                        ))}
                      </div>
                      <div className="mt-3">
                        <MoreGoalsAccordion
                          items={OUTCOMES.filter((item) => !PRIMARY_OUTCOME_KEYS.includes(item.key))}
                          activeKey={state.outcome}
                          onChoose={chooseOutcome}
                        />
                      </div>
                    </LayoutGroup>
                  </>
                )}

	                {step === 1 && (
	                  <>
                    {fastMode ? (
                      <>
                        <SectionTitle icon={Droplets} title="Checkout" sub="Clinical review before treatment." />
                        <FastHoldPanel
                          product={product}
                          serviceLabel={serviceLabel}
                          subtotal={subtotal}
                          balanceDue={balanceDue}
                          onContinue={() => setStep(3)}
                          onChange={() => {
                            const next = new URLSearchParams(searchParams);
                            next.delete('fast');
                            navigate(`/book?${next.toString()}`);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <SectionTitle icon={isCustomTreatment ? BatteryCharging : Droplets} title={isCustomTreatment ? 'Custom' : 'Therapy'} />
		                    {isCustomTreatment ? (
		                      <CustomTreatmentBuilder
		                        baseKey={state.customBase}
		                        onBase={chooseCustomBase}
		                      />
		                    ) : (
	                      <TherapyChoicePanel
	                        productOptions={productOptions}
	                        activeKey={state.productKey}
	                        onSelect={chooseProductAndContinue}
	                        onPrimary={chooseProductAndContinue}
	                      />
	                    )}
                      </>
                    )}
	                  </>
	                )}

                {step === 2 && (
                  <>
                    <h1 className="sr-only">Extras</h1>
                    <AddOnDecisionPanel
                      groups={addonCatalog.groups}
                      state={state}
                      selectedAddons={selectedAddons}
                      subtotal={subtotal}
                      onNone={chooseNoAddons}
                      onToggle={toggleAddon}
                    />
                  </>
                )}

                {step === 3 && (
                  <>
                    <SectionTitle icon={Home} title={fastMode ? 'Address' : 'Visit'} sub={fastMode ? 'Street address with ZIP.' : compressedFlow ? 'Address only. ASAP is selected.' : ''} />
                    {!fastMode && !compressedFlow && <VisitForSelector value={state.who} onChoose={chooseWho} />}
                    {!fastMode && (state.who === 'group' || state.visitType === 'event') && (
                      <GroupPricingPanel
                        baseTotal={baseSubtotal}
                        guestCount={guestCount}
                        contactRequired={groupContactRequired}
                        eventType={state.eventType}
                        onGuests={(value) => setValue('guests', value)}
                        onEventType={(value) => setValue('eventType', value)}
                      />
                    )}
                    {!fastMode && !compressedFlow && <LocationTypeDropdown value={state.locationType} onChange={(value) => setValue('locationType', value)} />}
                    <div className="mt-3 md:mt-2">
                      <SavedAddressShortcut
                        signedIn={signedInClient}
                        savedAddress={savedVisitAddress}
                        onUse={chooseAddressSuggestion}
                        onSignIn={goToReturningSignIn}
                      />
                      <button
                        type="button"
                        onClick={useCurrentLocation}
                        disabled={locationLoading}
                        className="mb-2 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-foreground/12 bg-background/44 px-3 font-body text-xs font-black text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl md:mb-2 md:min-h-[46px] md:rounded-xl md:px-3 md:text-xs"
                      >
                        <span className="flex items-center gap-2">
                          <Navigation className="h-4 w-4" strokeWidth={2.4} />
                          {locationLoading ? 'Finding address' : 'Use location'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 md:mt-2 md:gap-2">
                      <div className="grid gap-2">
                        <TextInput
                          label={LOCATION_TYPES.find((item) => item.key === state.locationType)?.placeholder || 'Address'}
                          value={state.address}
                          onChange={setAddressValue}
                          onKeyDown={handleAddressKeyDown}
                          placeholder="Address"
                          autoComplete="street-address"
                          actionLabel={savedVisitAddress?.address ? 'Saved' : ''}
                          onAction={() => chooseAddressSuggestion(savedVisitAddress)}
                          required
                        />
                        <AddressPrediction suggestion={topAddressSuggestion} onUse={chooseAddressSuggestion} compact />
                        {state.address.trim() && !resolvedZip && (
                          <TextInput
                            label="ZIP"
                            value={state.zip}
                            onChange={(value) => setValue('zip', value.replace(/\D/g, '').slice(0, 5))}
                            onKeyDown={handleAddressKeyDown}
                            placeholder="94107"
                            autoComplete="postal-code"
                            inputMode="numeric"
                            actionLabel={savedVisitAddress?.zip ? 'Saved' : ''}
                            onAction={() => setValue('zip', savedVisitAddress?.zip || '')}
                            required
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-1 md:grid-cols-2">
                    {addressSuggestions.filter((item) => item.address !== topAddressSuggestion?.address).map((item) => (
                        (() => {
                          const Icon = LOCATION_TYPES.find((type) => type.key === item.locationType)?.icon || MapPin;
                          return (
                            <button
                              key={item.address}
                              type="button"
                              onClick={() => chooseAddressSuggestion(item)}
                              className="relative flex min-h-[72px] items-center gap-3 overflow-hidden rounded-2xl border border-foreground/12 bg-background/45 px-3 text-left font-body text-base font-bold text-foreground/72 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl transition-colors hover:border-foreground/24 hover:bg-background/58 hover:text-foreground md:min-h-[52px] md:rounded-xl md:text-sm"
                            >
                              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-transparent to-transparent" />
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.05] text-foreground/82">
                                <Icon className="h-5 w-5" strokeWidth={2.35} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-bold text-foreground/82">{item.label}</span>
                                <span className="mt-1 block truncate">{item.address}</span>
                              </span>
                            </button>
                          );
                        })()
                      ))}
                    </div>
                    <div className="mt-2">
                      {!fastMode && !compressedFlow && <OptionalNotes value={state.notes} onChange={(value) => setValue('notes', value)} />}
                    </div>
                    {compressedFlow && !fastMode && (
                      <div className="relative mt-3 flex min-h-[56px] items-center justify-between gap-3 overflow-hidden rounded-[1.15rem] border border-foreground/12 bg-background/42 px-3 py-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl md:mt-2">
                        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.13),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.025))]" />
                        <span className="relative flex min-w-0 items-center gap-2 font-body text-sm font-black text-foreground">
                          <Calendar className="h-4 w-4" strokeWidth={2.35} />
                          {state.timeIntent === 'choose' ? 'Scheduled' : 'ASAP selected'}
                        </span>
                        <button
                          type="button"
                          onClick={() => chooseTimeIntent(state.timeIntent === 'choose' ? 'asap' : 'choose')}
                          className="relative min-h-[44px] shrink-0 rounded-full border border-foreground/14 bg-background/40 px-3 font-body text-[10px] font-black uppercase tracking-[0.1em] text-foreground/72"
                        >
                          {state.timeIntent === 'choose' ? 'ASAP' : 'Pick time'}
                        </button>
                      </div>
                    )}
                    {compressedFlow && state.timeIntent === 'choose' && (
                      <motion.div
                        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE }}
                        className="mt-3 grid gap-2 sm:grid-cols-2"
                      >
                        <label className="relative flex min-h-[66px] flex-col justify-center overflow-hidden rounded-2xl border border-foreground/12 bg-background/42 px-3 py-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl">
                          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-transparent to-transparent" />
                          <span className="relative block font-body text-sm font-black text-foreground/68">Date</span>
                          <select
                            aria-label="Choose date"
                            value={state.customDate}
                            onChange={(event) => {
                              const nextDate = event.target.value;
                              const nextTime = state.customTime || DEFAULT_EXACT_TIME;
                              setState((current) => ({
                                ...current,
                                customDate: nextDate,
                                customTime: nextTime,
                                availabilityWindow: `${nextDate}-${nextTime}`,
                                timeIntent: 'choose',
                              }));
                            }}
                            className="relative mt-1 min-h-[34px] w-full bg-transparent font-body text-xl font-black leading-none text-foreground outline-none [color-scheme:dark] light:[color-scheme:light]"
                          >
                            {dateOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label} · {option.day}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="relative flex min-h-[66px] flex-col justify-center overflow-hidden rounded-2xl border border-foreground/12 bg-background/42 px-3 py-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl">
                          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-transparent to-transparent" />
                          <span className="relative block font-body text-sm font-black text-foreground/68">Time</span>
                          <select
                            aria-label="Choose time"
                            value={state.customTime || DEFAULT_EXACT_TIME}
                            onChange={(event) => chooseAvailabilityWindow({ key: event.target.value, time: event.target.value, display: formatTimeLabel(event.target.value) })}
                            className="relative mt-1 min-h-[34px] w-full bg-transparent font-body text-xl font-black leading-none text-foreground outline-none [color-scheme:dark] light:[color-scheme:light]"
                          >
                            {timeSlots.map((slot) => (
                              <option key={slot.key} value={slot.time}>
                                {slot.display}
                              </option>
                            ))}
                          </select>
                        </label>
                      </motion.div>
                    )}
		                    {!fastMode && !compressedFlow && <div className="relative mt-3 overflow-hidden rounded-[1.15rem] border border-foreground/12 bg-background/42 p-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl md:mt-2 md:rounded-[1.15rem] md:p-2.5">
	                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.13),transparent_38%),radial-gradient(circle_at_92%_95%,hsl(var(--foreground)/0.055),transparent_36%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.025))]" />
		                      <div className="mb-2 flex items-center justify-between gap-3 md:mb-2">
		                        <span className="relative flex items-center gap-2 font-body text-base font-black text-foreground md:text-base">
                            <Calendar className="h-4 w-4" strokeWidth={2.35} />
                            When
                          </span>
	                        <span className="relative truncate font-body text-xs font-bold text-foreground/72 md:text-sm">{bookingTimeSummary(state)}</span>
	                      </div>
		                      <div className="grid gap-2 md:grid-cols-2 md:gap-1.5">
	                        {TIME_INTENTS.map((item) => {
	                          const active = state.timeIntent === item.key || (item.key === 'asap' && (state.timeIntent === 'today' || state.timeIntent === 'soonest'));
	                          const Icon = item.icon;
	                          return (
	                            <button
	                              key={item.key}
	                              type="button"
	                              onClick={() => chooseTimeIntent(item.key)}
		                              className={`relative flex min-h-[54px] items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-xl transition-all active:scale-[0.98] md:min-h-[54px] md:rounded-xl md:px-2.5 ${
	                                active ? 'border-foreground/42 bg-foreground/[0.16] text-foreground shadow-[0_18px_58px_hsl(var(--foreground)/0.14)]' : 'border-foreground/10 bg-background/36 text-foreground hover:border-foreground/22'
	                              }`}
	                            >
	                              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent" />
                                {item.key === 'asap' && (
                                  <span
                                    aria-hidden="true"
                                    className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-foreground shadow-[0_0_24px_hsl(var(--foreground)/0.42)]"
                                  />
                                )}
		                              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.05] md:h-9 md:w-9">
		                                <Icon className="h-4 w-4 md:h-4 md:w-4" strokeWidth={2.4} />
	                              </span>
	                              <span className="relative min-w-0">
		                                <span className="block font-heading text-[1.35rem] uppercase leading-none tracking-normal text-foreground md:text-[1.35rem]">{item.label}</span>
		                                {active && <span className="mt-0.5 block font-body text-xs font-bold text-foreground/62">{item.key === 'choose' ? '30 days' : 'Fastest'}</span>}
	                              </span>
	                            </button>
	                          );
	                        })}
	                      </div>
	                      {state.timeIntent === 'choose' && (
	                        <motion.div
	                          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
	                          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
	                          transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE }}
	                          className="mt-3 grid gap-2"
	                        >
                            <div className="grid gap-2 sm:grid-cols-2">
	                          <label className="relative flex min-h-[66px] flex-col justify-center overflow-hidden rounded-2xl border border-foreground/12 bg-background/42 px-3 py-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl">
	                            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-transparent to-transparent" />
	                            <span className="relative block font-body text-sm font-black text-foreground/68">Date</span>
	                            <select
	                              aria-label="Choose date"
	                              value={state.customDate}
	                              onChange={(event) => {
	                                const nextDate = event.target.value;
	                                const nextTime = state.customTime || DEFAULT_EXACT_TIME;
	                                setState((current) => ({
	                                  ...current,
	                                  customDate: nextDate,
	                                  customTime: nextTime,
	                                  availabilityWindow: `${nextDate}-${nextTime}`,
	                                  timeIntent: 'choose',
	                                }));
	                              }}
	                              className="relative mt-1 min-h-[34px] w-full bg-transparent font-body text-xl font-black leading-none text-foreground outline-none [color-scheme:dark] light:[color-scheme:light]"
	                            >
	                              {dateOptions.map((option) => (
	                                <option key={option.value} value={option.value}>
	                                  {option.label} · {option.day}
	                                </option>
	                              ))}
	                            </select>
	                          </label>
	                          <label className="relative flex min-h-[66px] flex-col justify-center overflow-hidden rounded-2xl border border-foreground/12 bg-background/42 px-3 py-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)] backdrop-blur-xl">
	                            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-transparent to-transparent" />
	                            <span className="relative block font-body text-sm font-black text-foreground/68">Time</span>
	                            <select
	                              aria-label="Choose time"
	                              value={state.customTime || DEFAULT_EXACT_TIME}
	                              onChange={(event) => chooseAvailabilityWindow({ key: event.target.value, time: event.target.value, display: formatTimeLabel(event.target.value) })}
	                              className="relative mt-1 min-h-[34px] w-full bg-transparent font-body text-xl font-black leading-none text-foreground outline-none [color-scheme:dark] light:[color-scheme:light]"
	                            >
	                              {timeSlots.map((slot) => (
	                                <option key={slot.key} value={slot.time}>
	                                  {slot.display}
	                                </option>
	                              ))}
	                            </select>
	                          </label>
                            </div>
	                        </motion.div>
	                      )}
	                    </div>}
                  </>
                )}

                {step === 4 && (
                  <>
                    <SectionTitle icon={Check} title={fastMode ? 'Patient' : 'Confirm'} sub={fastMode ? 'Required before payment.' : ''} />
                    <ConfirmSummary
                      state={state}
                      product={product}
                      bookingGfeRequirement={bookingGfeRequirement}
                      subtotal={subtotal}
                      dueNow={dueNowAmount}
                      balanceDue={balanceDue}
                    />
                    {canUseClinicalReviewOnFile && (
	                    <ClinicalReviewChoice
	                      value={state.clinicalReviewOnFile}
	                      onChange={(value) => setValue('clinicalReviewOnFile', value)}
	                      allowOnFile={canUseClinicalReviewOnFile}
	                    />
                    )}
                    <ContactConfirmCard state={state} onChange={setValue} savedContact={savedContactProfile} />
                    {fastMode && <SafetyFlagChoice value={state.safetyFlag} onChange={(value) => setValue('safetyFlag', value)} />}
                    {fastMode && (
                      <p className="rounded-2xl border border-foreground/10 bg-background/38 px-4 py-3 font-body text-xs font-semibold leading-snug text-foreground/58">
                        By paying, I consent to telehealth review, medical intake, and privacy terms. Treatment is subject to clinical approval.
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>

          </section>

	          {!fastMode && step > 0 && <SummaryRail
	            state={state}
	            product={product}
	            plan={{ ...plan, price: activePlanPrice }}
	            subtotal={subtotal}
	            dueNow={dueNowAmount}
	            balanceDue={balanceDue}
		            totalLabel={totalLabel}
		            groupContactRequired={groupContactRequired}
		            guestCount={guestCount}
		            serviceLabel={serviceLabel}
		            actionLabel={primaryActionLabel()}
		            actionDetail={
		              step === LAST_STEP && !groupContactRequired && state.visitType !== 'subscription'
		                ? ''
		                : ''
		            }
		            actionDisabled={checkoutLoading}
		            showAction={step === LAST_STEP}
		            onAction={submit}
		          />}
        </div>
        )}
      </main>

      {false && !fastMode && step > 0 && <div className="fixed inset-x-0 bottom-0 z-40 px-2.5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 md:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-1.5 overflow-hidden rounded-[1.25rem] border border-foreground/14 bg-background/72 p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_-18px_76px_hsl(var(--foreground)/0.16)] backdrop-blur-2xl">
          {step > 0 && !(compressedFlow && step === 3) && (
            <button type="button" onClick={back} aria-label="Go back one booking step" className="min-h-[54px] rounded-full border border-foreground/14 bg-background/30 px-4 font-body text-sm font-black uppercase tracking-[0.06em] text-foreground/80 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07)]">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={step < LAST_STEP ? next : submit}
            aria-label={step < LAST_STEP ? `Continue from ${STEPS[step]}` : `${primaryActionLabel()} and continue to checkout`}
	            className="relative flex min-h-[54px] flex-1 items-center justify-between overflow-hidden rounded-full border border-foreground/34 bg-foreground/[0.18] px-4 font-body text-sm font-black uppercase tracking-[0.06em] text-foreground shadow-[0_-8px_38px_hsl(var(--foreground)/0.18),inset_0_1px_0_hsl(var(--foreground)/0.12)] backdrop-blur-2xl transition-transform active:scale-[0.985]"
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-foreground/[0.04] via-foreground/[0.14] to-foreground/[0.04]" />
            {checkoutLoading && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-foreground/16 to-transparent"
                animate={{ x: ['0%', '420%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: EASE }}
              />
            )}
            <span>{primaryActionLabel()}</span>
            <span>{totalLabel}</span>
	          </button>
        </div>
      </div>}

    </div>
  );
}
