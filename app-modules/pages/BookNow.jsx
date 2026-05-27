import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import {
  ArrowRight,
  BatteryCharging,
  Building2,
  Calendar,
  Check,
  Clock,
  CreditCard,
  Droplets,
  Home,
  Hotel,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

import Navbar from '@/components/landing/Navbar';
import { useCart } from '@/context/CartContext';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';
import { COVERED_ZIPS } from '@/lib/serviceArea';
import { useSeo } from '@/lib/seo';
import {
  appendActivity,
  clearBookingDraft,
  readBookingDraft,
  saveBookingDraft,
  saveLastBooking,
  writeLocal,
} from '@/lib/localOs';
import { createBookingRecord, resolveGfeRequirement, validateBookingForCheckout } from '@/lib/bookingLifecycle';
import { orchestrateOrderHandoff, readClientProfile } from '@/lib/platformOps';
import { getDepositAmountDollars } from '@/lib/checkoutConfig';
import { ANALYTICS_EVENTS, getAttribution, track } from '@/lib/analytics';
import { BOOKABLE_SUBSCRIPTION_TIERS, FEATURED_SUBSCRIPTION_TIER_KEY } from '@/config/subscriptionTiers';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const EASE = [0.16, 1, 0.3, 1];
const DEPOSIT_DUE = getDepositAmountDollars(import.meta.env);
const TZ = 'America/Los_Angeles';
const DEFAULT_TIME = 'ASAP';
const STEPS = ['Goal', 'Visit', 'Protocol', 'Add-ons', 'Where', 'When', 'Confirm'];
const LAST_STEP = STEPS.length - 1;
const BOOKING_DRAFT_VERSION = 2;

const OUTCOMES = [
  {
    key: 'recover',
    label: 'Recover',
    sub: 'Hydration, fatigue, post-night-out.',
    icon: Droplets,
    productKeys: ['recovery', 'hydration', 'postnight'],
  },
  {
    key: 'perform',
    label: 'Perform',
    sub: 'Energy, focus, travel, work output.',
    icon: Zap,
    productKeys: ['energy', 'myers', 'jetlag'],
  },
  {
    key: 'restore',
    label: 'Restore',
    sub: 'Immune support, wellness, replenishment.',
    icon: ShieldCheck,
    productKeys: ['immunity', 'myers', 'beauty'],
  },
  {
    key: 'longevity',
    label: 'Longevity',
    sub: 'NAD+, advanced recovery, premium protocols.',
    icon: BatteryCharging,
    productKeys: ['nad', 'myers', 'recovery'],
  },
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
  { key: 'home', label: 'Home', icon: Home, placeholder: 'Home address' },
  { key: 'hotel', label: 'Hotel', icon: Hotel, placeholder: 'Hotel name and room if known' },
  { key: 'office', label: 'Office', icon: Building2, placeholder: 'Office address' },
  { key: 'event', label: 'Launch', icon: Users, placeholder: 'Venue address' },
];

const TIME_INTENTS = [
  { key: 'today', label: 'Today', window: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow', window: 'Tomorrow' },
  { key: 'choose', label: 'Choose Time', window: 'Preferred window' },
];

const WHO_OPTIONS = [
  { key: 'me', label: 'Me' },
  { key: 'other', label: 'Someone Else' },
  { key: 'group', label: 'Group' },
];

const MEMBERSHIP_OPTIONS = BOOKABLE_SUBSCRIPTION_TIERS.map((tier) => ({
  key: tier.key,
  label: tier.name,
  price: tier.price,
  sub: `${tier.sessions} session${tier.sessions === 1 ? '' : 's'}/mo · ${tier.discount} off add-ons`,
}));

const EVENT_TYPES = ['Private', 'Hotel', 'Office', 'Festival', 'Venue'];
const CLIENT_TYPES = [
  { key: 'new', label: 'New', sub: 'GFE needed before first treatment.' },
  { key: 'returning', label: 'Returning', sub: 'Annual GFE checked before dispatch.' },
];

const PUBLIC_BOOKING_PROTOCOL_KEYS = new Set(OUTCOMES.flatMap((item) => item.productKeys));

const ADDRESS_SUGGESTIONS = [
  { label: 'Home · Pacific Heights', address: '2100 Webster St, San Francisco, CA', zip: '94115', locationType: 'home' },
  { label: 'Hotel · Union Square', address: '335 Powell St, San Francisco, CA', zip: '94102', locationType: 'hotel' },
  { label: 'Office · SoMa', address: '535 Mission St, San Francisco, CA', zip: '94105', locationType: 'office' },
  { label: 'Venue · Oakland', address: '517 8th St, Oakland, CA', zip: '94607', locationType: 'event' },
  { label: 'Hotel · Napa', address: '1300 1st St, Napa, CA', zip: '94559', locationType: 'hotel' },
];

const AVAILABILITY_WINDOWS = [
  { key: 'today-3', label: 'Today', time: '15:00', display: '3:00 PM', nurse: '2 RNs available', eta: '90 min window' },
  { key: 'today-5', label: 'Today', time: '17:00', display: '5:00 PM', nurse: '1 RN available', eta: '120 min window' },
  { key: 'tomorrow-11', label: 'Tomorrow', time: '11:00', display: '11:00 AM', nurse: '3 RNs available', eta: 'Priority window' },
];

function todayDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

function splitName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || 'Client' };
}

function currency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function protocolPrice(protocol) {
  return Number(protocol?.price || protocol?.doses?.[0]?.price || 250);
}

function protocolDuration(protocol) {
  return protocol?.duration || protocol?.doses?.[0]?.duration || '45-60 min';
}

function getProductByKey(key) {
  return IV_SESSIONS.find((item) => item.key === key) || null;
}

function safeProtocol(protocol) {
  if (!protocol) return null;
  if (protocol.key === 'cbd') return { ...protocol, label: 'CBD Review', tagline: 'Held for clinical and legal approval.' };
  return protocol;
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
  const time = customTime || (timeIntent === 'tomorrow' ? '11:00' : '15:00');
  return {
    datetime: `${rawDate}T${time}:00`,
    timezone: TZ,
    timeLabel: timeIntent === 'today' ? 'Today · ASAP' : timeIntent === 'tomorrow' ? 'Tomorrow · 11:00 AM' : formatTimeLabel(time),
    appointmentTypeID: `ACUITY-${timeIntent || 'manual'}`,
  };
}

function bookingTimeSummary(state) {
  if (state.timeIntent === 'today') return 'Today · ASAP';
  if (state.timeIntent === 'tomorrow') return 'Tomorrow · 11:00 AM';
  if (state.customDate && state.customTime) return `${state.customDate} · ${formatTimeLabel(state.customTime)}`;
  return 'Time pending';
}

function SectionTitle({ kicker, title, sub }) {
  return (
    <div className="mb-5">
      <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">{kicker}</p>
      <h1 className="mt-2 font-heading text-5xl uppercase leading-[0.86] tracking-tight text-foreground md:text-7xl">
        {title}
      </h1>
      {sub && <p className="mt-3 max-w-xl font-body text-sm leading-snug text-foreground/58 md:text-base">{sub}</p>}
    </div>
  );
}

function StepProgress({ step }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {STEPS.map((item, index) => (
        <React.Fragment key={item}>
          <div className={`h-2.5 w-2.5 rounded-full border transition-colors ${index <= step ? 'border-foreground bg-foreground' : 'border-foreground/18'}`} />
          {index < STEPS.length - 1 && (
            <div className="h-px flex-1 bg-foreground/12">
              <motion.div
                className="h-full bg-foreground/48"
                initial={false}
                animate={{ scaleX: index < step ? 1 : 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                style={{ originX: 0 }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
      <span className="ml-2 shrink-0 font-body text-[10px] uppercase tracking-[0.18em] text-foreground/45">
        {STEPS[step]}
      </span>
    </div>
  );
}

function SelectCard({ item, active, onClick, children, className = '' }) {
  const Icon = item.icon;
  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`relative isolate min-h-[112px] overflow-hidden rounded-[1.25rem] border p-4 text-left transition-colors ${
        active
          ? 'border-foreground bg-foreground text-background shadow-[0_22px_80px_hsl(var(--foreground)/0.18)]'
          : 'border-foreground/10 bg-foreground/[0.035] text-foreground hover:border-foreground/22 hover:bg-foreground/[0.055]'
      } ${className}`}
    >
      {active && (
        <motion.span layoutId="active-booking-card" className="absolute inset-0 -z-10 bg-foreground" transition={{ duration: 0.42, ease: EASE }} />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${active ? 'border-background/18 bg-background/10' : 'border-foreground/10 bg-background/35'}`}>
          {Icon && <Icon className="h-4 w-4" strokeWidth={1.8} />}
        </div>
        {active && <Check className="h-4 w-4" strokeWidth={2.2} />}
      </div>
      <p className="mt-4 font-heading text-3xl uppercase leading-none tracking-[0.03em]">{item.label}</p>
      <p className={`mt-2 font-body text-xs leading-snug ${active ? 'text-background/68' : 'text-foreground/50'}`}>{item.sub}</p>
      {children}
    </motion.button>
  );
}

function ProductCard({ product, active, onClick, onPlan }) {
  const Icon = product.icon || Droplets;
  const price = protocolPrice(product);
  return (
    <motion.div
      layout
      className={`rounded-[1.25rem] border p-4 transition-colors ${
        active ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 bg-foreground/[0.03] text-foreground'
      }`}
    >
      <button type="button" onClick={onClick} aria-label={`Select ${product.label}`} className="block min-h-[44px] w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${active ? 'border-background/18 bg-background/10' : 'border-foreground/10 bg-background/35'}`}>
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-3xl uppercase leading-none tracking-[0.03em]">{product.label}</p>
              <p className={`mt-1 font-body text-xs ${active ? 'text-background/62' : 'text-foreground/45'}`}>{protocolDuration(product)}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-heading text-3xl leading-none">{currency(price)}</p>
            <p className={`font-body text-[9px] uppercase tracking-[0.16em] ${active ? 'text-background/52' : 'text-foreground/45'}`}>flat</p>
          </div>
        </div>
        <p className={`mt-4 font-body text-sm leading-snug ${active ? 'text-background/72' : 'text-foreground/58'}`}>
          Includes fluids, vitamins, medications when clinically appropriate, licensed RN visit, and clinical oversight.
        </p>
        <p className={`mt-2 font-body text-xs leading-snug ${active ? 'text-background/58' : 'text-foreground/45'}`}>
          Best for: {product.tagline || product.desc || 'hydration, recovery, wellness support.'}
        </p>
      </button>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClick}
          className={`min-h-[46px] rounded-full font-body text-[10px] font-semibold uppercase tracking-[0.16em] ${
            active ? 'bg-background text-foreground' : 'bg-foreground text-background'
          }`}
        >
          Choose
        </button>
        <button
          type="button"
          onClick={onPlan}
          className={`min-h-[46px] rounded-full border font-body text-[10px] font-semibold uppercase tracking-[0.16em] ${
            active ? 'border-background/18 text-background/78' : 'border-foreground/12 text-foreground/58'
          }`}
        >
          Add to Plan
        </button>
      </div>
    </motion.div>
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

  const coreLabels = ['Extra Fluid', 'Extra Ingredients', 'Magnesium Support', 'Glutathione Push · 600mg', 'Glutathione Push · 1200mg'];
  const advancedLabels = ['Vitamin C IV Push · 5g', 'Vitamin C IV Push · 10g', 'Vitamin C IV Push · 15g', 'NAD+ (250mg)', 'NAD+ (500mg)', 'NAD+ (1000mg)'];
  const shotLabels = ['B12', 'MIC', 'NAD+', 'Glutathione IM · 200mg', 'Glutathione IM · 400mg', 'Vitamin C IM · 500mg', 'Vitamin D', 'Biotin'];

  const groups = [
    {
      key: 'core',
      label: 'Core enhancements',
      sub: 'Fast protocol options the nurse can deploy with the IV.',
      items: coreLabels.map((label) => byLabel.get(label)).filter(Boolean),
    },
    {
      key: 'advanced',
      label: 'Advanced IV',
      sub: product?.key === 'nad' ? 'NAD+ is already the protocol. Vitamin support stays optional.' : 'Higher-ticket IV add-ons when clinically appropriate.',
      items: advancedLabels.map((label) => byLabel.get(label)).filter(Boolean),
    },
    {
      key: 'shots',
      label: 'IM shots',
      sub: 'Quick intramuscular add-ons for extra visit value.',
      items: shotLabels.map((label) => byLabel.get(label)).filter(Boolean),
    },
  ].filter((group) => group.items.length);

  return {
    all: [...byLabel.values()],
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
          <p className="font-body text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/72">{group.label}</p>
          <p className="mt-1 font-body text-xs text-foreground/45">{group.sub}</p>
        </div>
        <span className="shrink-0 rounded-full border border-foreground/10 px-3 py-1.5 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/52">
          {selectedCount ? `${selectedCount} on` : open ? 'Close' : 'Open'}
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
                  active ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 bg-background/35 text-foreground hover:border-foreground/22'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-body text-xs font-semibold">{item.label}</span>
                  <span className={`mt-1 block truncate font-body text-[10px] ${active ? 'text-background/58' : 'text-foreground/42'}`}>{item.desc || item.type}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 font-body text-xs font-semibold">
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

function AddOnDecisionPanel({ product, groups, state, selectedAddons, subtotal, onNone, onToggle, onContinue }) {
  const selectedRevenue = selectedAddons.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const protocolTotal = product ? protocolPrice(product) : 0;
  const hasDecision = Boolean(state.addOnDecision);
  const noAddonsSelected = hasDecision && selectedAddons.length === 0;

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={onNone}
        className={`group flex min-h-[78px] items-center justify-between gap-4 rounded-[1.25rem] border px-4 py-3 text-left transition-colors ${
          noAddonsSelected
            ? 'border-foreground bg-foreground text-background'
            : 'border-foreground/10 bg-foreground/[0.035] text-foreground hover:border-foreground/24'
        }`}
      >
        <span className="min-w-0">
          <span className={`block font-body text-[9px] font-semibold uppercase tracking-[0.2em] ${noAddonsSelected ? 'text-background/56' : 'text-foreground/42'}`}>
            Fast path
          </span>
          <span className="mt-1 block font-heading text-[2rem] uppercase leading-none">No add-ons</span>
          <span className={`mt-1 block truncate font-body text-xs ${noAddonsSelected ? 'text-background/62' : 'text-foreground/48'}`}>
            Continue with {product?.label || 'your protocol'} only.
          </span>
        </span>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
          noAddonsSelected ? 'border-background/18 bg-background/10' : 'border-foreground/10 bg-background/30 group-hover:border-foreground/24'
        }`}>
          {noAddonsSelected ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </span>
      </button>

      <div className="space-y-2">
        {groups.map((group, index) => {
          const selectedInGroup = group.items.filter((item) => state.addOns.includes(item.label)).length;
          return (
            <AddOnGroup
              key={group.key}
              group={group}
              defaultOpen={index === 0}
              selectedCount={selectedInGroup}
              selectedLabels={state.addOns}
              onToggle={onToggle}
            />
          );
        })}
      </div>
      <div className="rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.025] p-3">
        <div className="grid gap-2 font-body text-xs">
          <div className="flex items-center justify-between gap-3 text-foreground/50">
            <span>Protocol</span>
            <span>{currency(protocolTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-foreground/50">
            <span>Add-ons</span>
            <span>{selectedAddons.length ? `${selectedAddons.length} selected / ${currency(selectedRevenue)}` : currency(0)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3">
            <span className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/42">Total</span>
            <span className="font-heading text-[2.15rem] uppercase leading-none text-foreground">{currency(subtotal)}</span>
          </div>
        </div>
        <button
          type="button"
          disabled={!hasDecision}
          onClick={onContinue}
          className={`mt-3 flex min-h-[50px] w-full items-center justify-between gap-3 rounded-full px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] transition-opacity ${
            hasDecision
              ? 'bg-foreground text-background hover:opacity-90'
              : 'cursor-not-allowed border border-foreground/10 text-foreground/34'
          }`}
        >
          <span>
            {selectedAddons.length
              ? `Continue with ${selectedAddons.length} add-on${selectedAddons.length === 1 ? '' : 's'}`
              : noAddonsSelected
                ? 'Continue with no add-ons'
                : 'Choose a path'}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
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

function TextInput({ label, value, onChange, placeholder, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-[48px] w-full rounded-2xl border border-foreground/12 bg-foreground/[0.035] px-4 font-body text-base text-foreground placeholder:text-foreground/45 outline-none transition-colors focus:border-foreground/32"
      />
    </label>
  );
}

function SummaryRail({ state, product, subtotal, onSubmit }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28 rounded-[1.5rem] border border-foreground/10 bg-background/70 p-5 shadow-[0_28px_100px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
        <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">Your Visit</p>
        <div className="mt-5 space-y-4">
          <div>
            <p className="font-heading text-4xl uppercase leading-none">{product?.label || 'Select protocol'}</p>
            <p className="mt-1 font-body text-sm text-foreground/50">{state.visitType === 'subscription' ? 'Monthly plan' : state.visitType === 'event' ? 'Launch/group visit' : 'One-time visit'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Due now', currency(DEPOSIT_DUE)],
              ['Estimate', currency(subtotal)],
              ['Scheduling', 'Queued'],
              ['Clearance', 'Before visit'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/8 bg-foreground/[0.035] p-3">
                <p className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-body text-xs font-semibold text-foreground/72">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-foreground/8 pt-4 font-body text-xs text-foreground/52">
            <p>{state.address || 'Address pending'}</p>
            <p>{bookingTimeSummary(state)}</p>
            {state.addOns.length > 0 && <p>{state.addOns.length} add-on{state.addOns.length > 1 ? 's' : ''} selected</p>}
          </div>
          <button
            type="button"
            onClick={onSubmit}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-background"
          >
            Hold Visit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
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
  clientType: 'new',
  eventType: 'Private',
  locationType: 'home',
  address: '',
  zip: '',
  who: 'me',
  guests: 1,
  timeIntent: 'today',
  customDate: todayDate(),
  customTime: '',
  name: '',
  email: '',
  phone: '',
  notes: '',
  addOns: [],
  addOnDecision: false,
};

export default function BookNow() {
  useSeo({
    title: 'Choose Your Protocol — Avalon Vitality',
    description: 'Book a premium mobile recovery protocol in the Bay Area with flat pricing, licensed clinicians, and clinical clearance before treatment.',
    path: '/book',
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearItems, addItem } = useCart();
  const clientProfile = useMemo(() => readClientProfile(), []);
  const profileGfe = useMemo(() => resolveGfeRequirement({
    isNewClient: false,
    visitCount: Math.max(1, Number(clientProfile.visitCount || 1)),
    gfe: clientProfile.gfe,
    gfeExpiresAt: clientProfile.gfe?.validUntil,
  }), [clientProfile]);
  const [step, setStep] = useState(0);
  const stepShellRef = useRef(null);
  const hasMountedStepRef = useRef(false);
  const shouldResetDraft = searchParams.get('reset') === '1';
  const [state, setState] = useState(() => {
    const draft = shouldResetDraft ? {} : readBookingDraft()?.webstore || {};
    const savedWebstore = draft.draftVersion === BOOKING_DRAFT_VERSION ? draft : {};
    const savedProductKey = PUBLIC_BOOKING_PROTOCOL_KEYS.has(savedWebstore.productKey) ? savedWebstore.productKey : '';
    return {
      ...defaultState,
      clientType: profileGfe.required ? 'new' : 'returning',
      ...savedWebstore,
      productKey: savedProductKey,
      addOns: savedProductKey ? (savedWebstore.addOns || []) : [],
      addOnDecision: savedProductKey ? Boolean(savedWebstore.addOnDecision || savedWebstore.addOns?.length) : false,
    };
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (shouldResetDraft) clearBookingDraft();
  }, [shouldResetDraft]);

  const scrollStepIntoView = (behavior = 'smooth') => {
    if (typeof window === 'undefined') return;
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
    const nextOutcome = OUTCOMES.find((item) => item.key === outcomeParam);
    if (protocolParam && PUBLIC_BOOKING_PROTOCOL_KEYS.has(protocolParam)) {
      const inferredOutcome = nextOutcome || outcomeForProtocol(protocolParam);
      setState((current) => ({
        ...current,
        outcome: inferredOutcome.key,
        productKey: protocolParam,
        addOns: [],
        addOnDecision: false,
      }));
      setStep(3);
    } else if (nextOutcome) {
      setState((current) => ({
        ...current,
        outcome: nextOutcome.key,
        productKey: '',
        addOns: [],
        addOnDecision: false,
      }));
      setStep(1);
    }
  }, [searchParams]);

  const outcome = OUTCOMES.find((item) => item.key === state.outcome) || OUTCOMES[0];
  const visitType = VISIT_TYPES.find((item) => item.key === state.visitType) || VISIT_TYPES[0];
  const productOptions = useMemo(
    () => outcome.productKeys.map((key) => safeProtocol(getProductByKey(key))).filter(Boolean).slice(0, 3),
    [outcome]
  );
  const product = state.productKey ? safeProtocol(getProductByKey(state.productKey)) : null;
  const plan = MEMBERSHIP_OPTIONS.find((item) => item.key === state.planKey) || MEMBERSHIP_OPTIONS[0];
  const isReturningClient = state.clientType === 'returning';
  const bookingGfeRequirement = resolveGfeRequirement({
    isNewClient: !isReturningClient,
    visitCount: isReturningClient ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
    gfe: isReturningClient ? clientProfile.gfe : {},
    gfeExpiresAt: isReturningClient ? clientProfile.gfe?.validUntil : '',
  });
  const addonCatalog = useMemo(() => buildAddonCatalog(product), [product]);
  const selectedAddons = useMemo(
    () => addonCatalog.all.filter((item) => state.addOns.includes(item.label)),
    [addonCatalog, state.addOns]
  );
  const subtotal = (product ? protocolPrice(product) : 0) + selectedAddons.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const addressSuggestions = useMemo(() => {
    const query = `${state.address} ${state.zip}`.trim().toLowerCase();
    if (!query) return ADDRESS_SUGGESTIONS.slice(0, 3);
    return ADDRESS_SUGGESTIONS
      .filter((item) => `${item.label} ${item.address} ${item.zip}`.toLowerCase().includes(query))
      .slice(0, 3);
  }, [state.address, state.zip]);

  useEffect(() => {
    saveBookingDraft({ webstore: state, step, subtotal, updatedAt: new Date().toISOString() });
  }, [state, step, subtotal]);

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

  const chooseOutcome = (key) => {
    const nextOutcome = OUTCOMES.find((item) => item.key === key) || OUTCOMES[0];
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 0,
      step_name: STEPS[0],
      outcome: key,
    });
    setState((current) => ({
      ...current,
      outcome: key,
      productKey: '',
      addOns: [],
      addOnDecision: false,
    }));
    setStep(1);
  };

  const chooseVisitType = (key) => {
    const next = key === 'event' ? { who: 'group', locationType: 'event', guests: Math.max(2, Number(state.guests || 2)) } : {};
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 1,
      step_name: STEPS[1],
      visit_type: key,
    });
    setState((current) => ({ ...current, visitType: key, ...next }));
    setStep(2);
  };

  const chooseProduct = (key, overrides = {}) => {
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 2,
      step_name: STEPS[2],
      protocol_key: key,
    });
    setState((current) => ({
      ...current,
      productKey: key,
      addOns: [],
      addOnDecision: false,
      ...overrides,
    }));
    setStep(3);
  };

  const chooseAddressSuggestion = (item) => {
    setError('');
    setState((current) => ({
      ...current,
      address: item.address,
      zip: item.zip,
      locationType: item.locationType,
    }));
  };

  const chooseAvailabilityWindow = (slot) => {
    const dayOffset = slot.label === 'Tomorrow' ? 1 : 0;
    setError('');
    setState((current) => ({
      ...current,
      timeIntent: 'choose',
      customDate: todayDate(dayOffset),
      customTime: slot.time,
      availabilityWindow: slot.key,
    }));
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
    setState((current) => ({
      ...current,
      addOns: [],
      addOnDecision: true,
    }));
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'webstore',
      step_index: 3,
      step_name: STEPS[3],
      protocol_key: state.productKey,
      addon_count: 0,
      addon_revenue: 0,
      addon_decision: 'none',
    });
    setStep(4);
  };

  const canAdvance = () => {
    if (step === 2) return Boolean(state.productKey);
    if (step === 3) return Boolean(state.productKey && state.addOnDecision);
    if (step === 4) return Boolean(state.address.trim() && String(state.zip).trim().length === 5);
    if (step === 5) return Boolean(state.timeIntent !== 'choose' || (state.customDate && state.customTime));
    return true;
  };

  const next = () => {
    if (!canAdvance()) {
      const reason = step === 2 ? 'Choose your protocol.' : step === 3 ? 'Choose add-ons or none.' : step === 4 ? 'Add address and ZIP.' : 'Choose a date and time.';
      setError(reason);
      scrollStepIntoView();
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'webstore',
        step_index: step,
        step_name: STEPS[step],
        reason: step === 3 ? 'addon_decision_missing' : step === 4 ? 'address_zip_missing' : 'time_missing',
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

  const back = () => setStep((current) => Math.max(current - 1, 0));

  const primaryActionLabel = () => {
    if (step === 2) return 'Add-ons next';
    if (step === 3) return state.addOnDecision ? 'Location next' : 'Choose a path';
    if (step === 4 && !canAdvance()) return 'Add location';
    if (step === 5 && !canAdvance()) return 'Pick time';
    return step < LAST_STEP ? 'Continue' : `Hold ${currency(DEPOSIT_DUE)}`;
  };

  const buildBooking = () => {
    if (!product) return null;
    const { firstName, lastName } = splitName(state.name);
    const date = state.timeIntent === 'tomorrow' ? todayDate(1) : state.timeIntent === 'choose' ? state.customDate : todayDate();
    const slot = buildSlot(date, state.timeIntent, state.customTime);
    const service = `${product.label}${state.visitType === 'subscription' ? ` · ${plan.label}` : ''}`;
    const guests = state.visitType === 'event' ? Math.max(2, Number(state.guests || 2)) : Math.max(1, Number(state.guests || 1));
    const returningClient = state.clientType === 'returning';
    const profileGfeRecord = returningClient ? clientProfile.gfe : {};
    const gfeRequirement = resolveGfeRequirement({
      isNewClient: !returningClient,
      visitCount: returningClient ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
      gfe: profileGfeRecord,
      gfeExpiresAt: returningClient ? profileGfeRecord?.validUntil : '',
    });
    return {
      id: `AV-${Date.now().toString().slice(-6)}`,
      reference: `WEB-${Date.now().toString().slice(-6)}`,
      service,
      protocolKey: product.key,
      date,
      time: slot.timeLabel,
      datetime: slot.datetime,
      timezone: TZ,
      address: state.address,
      zip: String(state.zip || '').trim(),
      locationType: state.locationType,
      guests,
      notes: state.notes,
      contact: {
        name: state.name.trim(),
        firstName,
        lastName,
        email: state.email.trim(),
        phone: state.phone.trim(),
        clientType: state.clientType,
        visitCount: returningClient ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
      },
      addOns: selectedAddons.map((item) => item.type === 'im' ? `IM · ${item.label}` : item.label),
      items: [
        { cartKey: product.key, label: product.label, price: protocolPrice(product), type: 'iv' },
        ...selectedAddons.map((item) => ({
          cartKey: item.cartKey,
          label: item.type === 'im' ? `IM · ${item.label}` : item.label,
          price: Number(item.price || 0),
          type: item.type,
        })),
      ],
      subtotal,
      depositAmount: DEPOSIT_DUE,
      payment: `$${DEPOSIT_DUE} hold pending`,
      status: 'Scheduling received',
      holdType: 'fast',
      nextStep: gfeRequirement.required
        ? 'Clinical review, annual GFE, deposit hold, and scheduling handoff'
        : 'Annual GFE valid. Clinical review, deposit hold, and scheduling handoff',
      intake: 'Needed',
      consent: 'Needed',
      gfe: gfeRequirement.required ? 'Pending' : 'Cleared',
      gfeRecord: profileGfeRecord,
      gfeRequired: gfeRequirement.required,
      gfeExpiresAt: gfeRequirement.expiresAt || '',
      gfeStatusReason: gfeRequirement.reason,
      nurse: 'Unassigned',
      source: 'Avalon Webstore',
      orderType: visitType.orderType,
      productFamily: state.visitType === 'event' ? 'launch' : state.visitType === 'subscription' ? 'subscription' : 'protocol',
      appointmentChannel: state.locationType === 'event' ? 'venue' : 'mobile',
      appointmentTypeId: slot.appointmentTypeID,
      acuitySlot: slot,
      isNewClient: !returningClient,
      visitCount: returningClient ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
      manualReview: true,
      clientType: state.clientType,
      subscription: state.visitType === 'subscription' ? { ...plan, frequency: 'monthly', preferredOutcome: outcome.label } : null,
      event: state.visitType === 'event' ? { type: state.eventType, guestCount: guests, gfeTiming: 'Before launch' } : null,
      lifecycleWarnings: [
        gfeRequirement.required
          ? 'Annual GFE required before dispatch.'
          : `Annual GFE valid${gfeRequirement.expiresAt ? ` through ${formatGfeDate(gfeRequirement.expiresAt)}` : ''}.`,
        'Clinical review required before treatment.',
        'Scheduling handoff is represented locally until connected.',
        !COVERED_ZIPS.has(String(state.zip || '').trim()) && 'Service-area review required.',
        state.visitType === 'event' && 'Pre-launch GFE coordination required.',
      ].filter(Boolean),
      notificationPreview: {
        sms: state.phone.trim() ? `Confirmation text queued to ${state.phone.trim()}` : 'Phone required before SMS confirmation.',
        calendar: 'Calendar invite generated locally until Apple/Google calendar is connected.',
        availability: state.availabilityWindow ? 'RN availability window selected locally.' : 'RN availability will be confirmed before dispatch.',
      },
    };
  };

  const canSubmit = Boolean(state.name.trim() && state.email.includes('@') && state.phone.replace(/\D/g, '').length >= 10 && state.address.trim() && String(state.zip).trim().length === 5);

  const submit = () => {
    if (!product) {
      setError('Choose your protocol.');
      setStep(2);
      return;
    }
    if (!canSubmit) {
      setError('Add name, phone, email, address, and ZIP.');
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

    track(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
      funnel: 'webstore',
      booking_id: localBooking.id,
      order_type: localBooking.orderType,
      product_family: localBooking.productFamily,
      protocol_key: localBooking.protocolKey,
      addon_count: localBooking.addOns?.length || 0,
      subtotal,
      deposit_due: DEPOSIT_DUE,
      gfe_required: localBooking.gfeRequired,
    });

    clearItems();
    localBooking.items.forEach(addItem);
    saveLastBooking(localBooking);
    orchestrateOrderHandoff(localBooking, {
      source: 'avalon-webstore',
      type: visitType.label,
      scope: state.visitType === 'event' ? 'Launch/group local handoff' : state.visitType === 'subscription' ? 'Subscription local handoff' : 'One-time local handoff',
      depositAmount: DEPOSIT_DUE,
    });
    writeLocal('webstore.latestHandoff', {
      bookingId: localBooking.id,
      stack: ['Avalon OS', 'Scheduling placeholder', 'Clearance routing', 'Nurse dispatch', 'Inventory deduction', 'CRM-safe follow-up'],
      noThirdPartyCalls: true,
      updatedAt: new Date().toISOString(),
    });
    if (localBooking.subscription) writeLocal('webstore.subscriptionPlan', localBooking.subscription);
    if (localBooking.event) writeLocal('webstore.eventRequest', localBooking.event);
    appendActivity(`Webstore hold received: ${localBooking.service}`, { role: 'client', bookingId: localBooking.id, orderType: localBooking.orderType });
    clearBookingDraft();
    navigate('/booking/confirmation');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar showBack />
      <main className="mx-auto max-w-6xl px-4 pb-32 pt-20 md:px-8 md:pt-28 lg:pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <section ref={stepShellRef} tabIndex={-1} className="min-w-0 scroll-mt-28 outline-none">
            <StepProgress step={step} />
            {error && (
              <p role="alert" className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/8 px-4 py-3 font-body text-xs text-red-300">
                {error}
              </p>
            )}
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.28, ease: EASE }}
            >
                {step === 0 && (
                  <>
                    <SectionTitle kicker="Book in under 60 seconds" title="Choose your protocol." sub="No menu hell. Pick the outcome. Avalon handles the rest." />
                    <LayoutGroup id="outcomes">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {OUTCOMES.map((item) => (
                          <SelectCard key={item.key} item={item} active={state.outcome === item.key} onClick={() => chooseOutcome(item.key)} />
                        ))}
                      </div>
                    </LayoutGroup>
                  </>
                )}

                {step === 1 && (
                  <>
                    <SectionTitle kicker="Appointment type" title="How should this work?" sub="One visit, monthly recovery, or a launch." />
                    <div className="grid gap-3 sm:grid-cols-3">
                      {VISIT_TYPES.map((item) => (
                        <SelectCard key={item.key} item={item} active={state.visitType === item.key} onClick={() => chooseVisitType(item.key)} className="sm:min-h-[160px]" />
                      ))}
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <SectionTitle kicker={outcome.label} title="Choose your protocol." sub="Curated. Flat. Clinician-reviewed before treatment." />
                    <div className="grid gap-3">
                      {productOptions.map((item) => (
                        <ProductCard
                          key={item.key}
                          product={item}
                          active={product?.key === item.key}
                          onClick={() => chooseProduct(item.key)}
                          onPlan={() => chooseProduct(item.key, { visitType: 'subscription' })}
                        />
                      ))}
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <SectionTitle kicker={product?.label || 'Protocol'} title="Add-ons." sub="Start with no. Add only what should ride with the nurse." />
                    <AddOnDecisionPanel
                      product={product}
                      groups={addonCatalog.groups}
                      state={state}
                      selectedAddons={selectedAddons}
                      subtotal={subtotal}
                      onNone={chooseNoAddons}
                      onToggle={toggleAddon}
                      onContinue={next}
                    />
                  </>
                )}

                {step === 4 && (
                  <>
                    <SectionTitle kicker="Location" title="Where should we come?" sub="Home, hotel, office, or launch." />
                    <div className="grid gap-2 sm:grid-cols-4">
                      {LOCATION_TYPES.map((item) => (
                        <SelectCard key={item.key} item={{ ...item, sub: item.placeholder }} active={state.locationType === item.key} onClick={() => setValue('locationType', item.key)} className="min-h-[132px]" />
                      ))}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px]">
                      <TextInput label={LOCATION_TYPES.find((item) => item.key === state.locationType)?.placeholder || 'Address'} value={state.address} onChange={(value) => setValue('address', value)} placeholder="Street, unit, city" required />
                      <TextInput label="ZIP" value={state.zip} onChange={(value) => setValue('zip', value.replace(/\D/g, '').slice(0, 5))} placeholder="94107" required />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {addressSuggestions.map((item) => (
                        <button
                          key={item.address}
                          type="button"
                          onClick={() => chooseAddressSuggestion(item)}
                          className="min-h-[58px] rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-3 text-left font-body text-xs text-foreground/58 transition-colors hover:border-foreground/24 hover:text-foreground"
                        >
                          <span className="block font-semibold text-foreground/72">{item.label}</span>
                          <span className="mt-1 block truncate">{item.address}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      {WHO_OPTIONS.map((item) => (
                        <button key={item.key} type="button" onClick={() => setValue('who', item.key)} className={`min-h-[48px] rounded-full border px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] ${state.who === item.key ? 'border-foreground bg-foreground text-background' : 'border-foreground/12 text-foreground/58'}`}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                    {(state.who === 'group' || state.visitType === 'event') && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <TextInput label="Guests" type="number" value={state.guests} onChange={(value) => setValue('guests', value)} placeholder="8" />
                        <label>
                          <span className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Launch Type</span>
                      <select aria-label="Event type" value={state.eventType} onChange={(event) => setValue('eventType', event.target.value)} className="mt-2 min-h-[48px] w-full rounded-2xl border border-foreground/12 bg-foreground/[0.035] px-4 font-body text-base text-foreground outline-none">
                            {EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </label>
                      </div>
                    )}
                  </>
                )}

                {step === 5 && (
                  <>
                    <SectionTitle kicker="Timing" title="When do you want us?" sub="Pick a window. Avalon confirms before dispatch." />
                    <div className="grid gap-3 sm:grid-cols-3">
                      {TIME_INTENTS.map((item) => (
                        <SelectCard key={item.key} item={{ ...item, sub: item.window, icon: Clock }} active={state.timeIntent === item.key} onClick={() => setValue('timeIntent', item.key)} />
                      ))}
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      {AVAILABILITY_WINDOWS.map((slot) => {
                        const active = state.availabilityWindow === slot.key;
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => chooseAvailabilityWindow(slot)}
                            className={`min-h-[76px] rounded-[1rem] border p-3 text-left transition-colors ${
                              active ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 bg-foreground/[0.03] text-foreground'
                            }`}
                          >
                            <span className="block font-body text-[10px] font-semibold uppercase tracking-[0.18em]">{slot.label}</span>
                            <span className="mt-1 block font-heading text-2xl uppercase leading-none">{slot.display}</span>
                            <span className={`mt-1 block font-body text-[10px] leading-snug ${active ? 'text-background/62' : 'text-foreground/45'}`}>
                              {slot.nurse} · {slot.eta}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {state.timeIntent === 'choose' && (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <TextInput label="Date" type="date" value={state.customDate} onChange={(value) => setValue('customDate', value)} />
                        <TextInput label="Time" type="time" value={state.customTime} onChange={(value) => setValue('customTime', value)} />
                      </div>
                    )}
                    {state.visitType === 'subscription' && (
                      <div className="mt-5 grid gap-2 sm:grid-cols-3">
                        {MEMBERSHIP_OPTIONS.map((item) => (
                          <button key={item.key} type="button" onClick={() => setValue('planKey', item.key)} className={`min-h-[92px] rounded-[1rem] border p-3 text-left ${state.planKey === item.key ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 bg-foreground/[0.03]'}`}>
                            <p className="font-body text-xs font-semibold">{item.label}</p>
                            <p className="mt-1 font-heading text-2xl">{currency(item.price)}/mo</p>
                            <p className={`mt-1 font-body text-[10px] leading-snug ${state.planKey === item.key ? 'text-background/62' : 'text-foreground/42'}`}>{item.sub}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {step === 6 && (
                  <>
                    <SectionTitle kicker="Secure hold" title="Avalon is coming." sub="Clinical clearance is required before treatment. If you are not eligible, the visit is adjusted or refunded according to policy." />
                    <div className="mb-4 rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.03] p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Annual GFE</p>
                          <p className="mt-1 font-body text-sm leading-snug text-foreground/58">
                            Returning clients only need a new GFE when the annual clearance is missing or expired.
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 font-body text-[8px] font-semibold uppercase tracking-[0.14em] ${bookingGfeRequirement.required ? 'border-amber-300/24 text-amber-200' : 'border-emerald-300/20 text-emerald-200'}`}>
                          {bookingGfeRequirement.required ? 'Needed' : 'Valid'}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {CLIENT_TYPES.map((item) => {
                          const active = state.clientType === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setValue('clientType', item.key)}
                              className={`min-h-[76px] rounded-2xl border p-3 text-left transition-colors ${
                                active ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 text-foreground/62'
                              }`}
                            >
                              <span className="block font-body text-[10px] font-semibold uppercase tracking-[0.16em]">{item.label}</span>
                              <span className={`mt-2 block font-body text-xs leading-snug ${active ? 'text-background/62' : 'text-foreground/45'}`}>{item.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 font-body text-[11px] leading-relaxed text-foreground/45">
                        {bookingGfeRequirement.required
                          ? bookingGfeRequirement.reason
                          : `GFE on file. ${bookingGfeRequirement.expiresAt ? `Valid through ${formatGfeDate(bookingGfeRequirement.expiresAt)}.` : bookingGfeRequirement.reason}`}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <TextInput label="Name" value={state.name} onChange={(value) => setValue('name', value)} placeholder="Alex Morgan" required />
                      <TextInput label="Phone" value={state.phone} onChange={(value) => setValue('phone', value)} placeholder="(415) 555-0123" required />
                      <TextInput label="Email" type="email" value={state.email} onChange={(value) => setValue('email', value)} placeholder="you@example.com" required />
                    </div>
                    <label className="mt-3 block">
                      <span className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Notes</span>
                      <textarea
                        value={state.notes}
                        onChange={(event) => setValue('notes', event.target.value)}
                        placeholder="Gate code, hotel room, group details, timing notes."
                        className="mt-2 min-h-[96px] w-full rounded-2xl border border-foreground/12 bg-foreground/[0.035] p-4 font-body text-sm text-foreground placeholder:text-foreground/45 outline-none transition-colors focus:border-foreground/32"
                      />
                    </label>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {['Secure hold', 'Flat transparent pricing', 'No hidden fees'].map((item) => (
                        <div key={item} className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-3 font-body text-xs text-foreground/55">{item}</div>
                      ))}
                    </div>
                  </>
                )}
            </motion.div>

            <div className="mt-7 hidden gap-3 lg:flex">
              {step > 0 && (
                <button type="button" onClick={back} aria-label="Go back one booking step" className="min-h-[52px] rounded-full border border-foreground/12 px-6 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">
                  Back
                </button>
              )}
              {step < LAST_STEP ? (
                <button type="button" onClick={next} aria-label={`Continue from ${STEPS[step]}`} className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-foreground px-8 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-background">
                  {primaryActionLabel()} <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={submit} aria-label="Hold visit and continue to checkout" className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-foreground px-8 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-background">
                  Hold Visit <CreditCard className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>

          <SummaryRail state={state} product={product} subtotal={subtotal} onSubmit={submit} />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-2.5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-1.5 rounded-[1rem] border border-foreground/10 bg-background/86 p-1 shadow-[0_-12px_40px_hsl(var(--foreground)/0.09)] backdrop-blur-2xl">
          {step > 0 && (
            <button type="button" onClick={back} aria-label="Go back one booking step" className="min-h-[44px] rounded-full border border-foreground/12 px-3.5 font-body text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground/62">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={step < LAST_STEP ? next : submit}
            aria-label={step < LAST_STEP ? `Continue from ${STEPS[step]}` : 'Hold visit and continue to checkout'}
            className="flex min-h-[44px] flex-1 items-center justify-between rounded-full bg-foreground px-3.5 font-body text-[9px] font-semibold uppercase tracking-[0.13em] text-background"
          >
            <span>{primaryActionLabel()}</span>
            <span>{currency(subtotal)}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
