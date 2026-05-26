import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from '@/components/ui/PageTransitionMotion';
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

const EASE = [0.16, 1, 0.3, 1];
const DEPOSIT_DUE = getDepositAmountDollars(import.meta.env);
const TZ = 'America/Los_Angeles';
const DEFAULT_TIME = 'ASAP';
const STEPS = ['Goal', 'Visit', 'Protocol', 'Where', 'When', 'Confirm'];

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

const MEMBERSHIP_OPTIONS = [
  { key: 'monthly-one', label: 'Monthly Protocol', price: 199, sub: '1 visit/mo · priority booking' },
  { key: 'monthly-two', label: 'Recovery Plus', price: 389, sub: '2 visits/mo · preferred pricing' },
  { key: 'concierge', label: 'Concierge', price: 899, sub: '4 visits/mo · VIP coordination' },
];

const EVENT_TYPES = ['Private', 'Hotel', 'Office', 'Festival', 'Venue'];
const CLIENT_TYPES = [
  { key: 'new', label: 'New', sub: 'GFE needed before first treatment.' },
  { key: 'returning', label: 'Returning', sub: 'Annual GFE checked before dispatch.' },
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
  return IV_SESSIONS.find((item) => item.key === key) || IV_SESSIONS[0];
}

function safeProtocol(protocol) {
  if (!protocol) return getProductByKey('recovery');
  if (protocol.key === 'cbd') return { ...protocol, label: 'CBD Review', tagline: 'Held for clinical and legal approval.' };
  return protocol;
}

function buildSlot(date, timeIntent, customTime) {
  const rawDate = date || todayDate();
  const time = customTime || (timeIntent === 'tomorrow' ? '11:00' : '15:00');
  return {
    datetime: `${rawDate}T${time}:00`,
    timezone: TZ,
    timeLabel: timeIntent === 'today' ? 'Today · ASAP' : timeIntent === 'tomorrow' ? 'Tomorrow · 11:00 AM' : `${rawDate} · ${time}`,
    appointmentTypeID: `ACUITY-${timeIntent || 'manual'}`,
  };
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

function SummaryRail({ state, product, subtotal, canSubmit, onSubmit }) {
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
              ['Acuity', 'Queued'],
              ['GFE', 'Before visit'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/8 bg-foreground/[0.035] p-3">
                <p className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-body text-xs font-semibold text-foreground/72">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-foreground/8 pt-4 font-body text-xs text-foreground/52">
            <p>{state.address || 'Address pending'}</p>
            <p>{state.timeIntent === 'today' ? 'Today · ASAP' : state.timeIntent === 'tomorrow' ? 'Tomorrow · 11:00 AM' : state.customDate || 'Time pending'}</p>
            {state.addOns.length > 0 && <p>{state.addOns.length} add-on{state.addOns.length > 1 ? 's' : ''} selected</p>}
          </div>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-background disabled:opacity-35"
          >
            Hold Visit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

const defaultState = {
  outcome: 'recover',
  visitType: 'one-time',
  productKey: 'recovery',
  planKey: 'monthly-one',
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
};

export default function BookNow() {
  useSeo({
    title: 'Choose Protocol — Avalon Vitality',
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
  const [state, setState] = useState(() => ({
    ...defaultState,
    clientType: profileGfe.required ? 'new' : 'returning',
    ...(readBookingDraft()?.webstore || {}),
  }));
  const [error, setError] = useState('');

  useEffect(() => {
    const outcomeParam = searchParams.get('outcome');
    const protocolParam = searchParams.get('protocol');
    const nextOutcome = OUTCOMES.find((item) => item.key === outcomeParam);
    if (protocolParam && IV_SESSIONS.some((item) => item.key === protocolParam)) {
      setState((current) => ({
        ...current,
        ...(nextOutcome ? { outcome: nextOutcome.key } : {}),
        productKey: protocolParam,
      }));
      setStep(2);
    } else if (nextOutcome) {
      setState((current) => ({
        ...current,
        outcome: nextOutcome.key,
        productKey: nextOutcome.productKeys[0],
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
  const product = safeProtocol(getProductByKey(state.productKey)) || productOptions[0];
  const plan = MEMBERSHIP_OPTIONS.find((item) => item.key === state.planKey) || MEMBERSHIP_OPTIONS[0];
  const isReturningClient = state.clientType === 'returning';
  const bookingGfeRequirement = resolveGfeRequirement({
    isNewClient: !isReturningClient,
    visitCount: isReturningClient ? Math.max(1, Number(clientProfile.visitCount || 1)) : 0,
    gfe: isReturningClient ? clientProfile.gfe : {},
    gfeExpiresAt: isReturningClient ? clientProfile.gfe?.validUntil : '',
  });
  const selectedAddons = useMemo(() => {
    const pool = [
      ...IV_ADDONS.slice(0, 8).map((item) => ({ ...item, type: 'addon', cartKey: `addon-${item.label}` })),
      ...IM_SHOTS.slice(0, 6).map((item) => ({ ...item, type: 'im', cartKey: `im-${item.label}` })),
    ];
    return pool.filter((item) => state.addOns.includes(item.label));
  }, [state.addOns]);
  const subtotal = protocolPrice(product) + selectedAddons.reduce((sum, item) => sum + Number(item.price || 0), 0);

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
      productKey: nextOutcome.productKeys[0],
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

  const toggleAddon = (label) => {
    setState((current) => ({
      ...current,
      addOns: current.addOns.includes(label)
        ? current.addOns.filter((item) => item !== label)
        : [...current.addOns, label],
    }));
  };

  const canAdvance = () => {
    if (step === 3) return Boolean(state.address.trim() && String(state.zip).trim().length === 5);
    if (step === 4) return Boolean(state.timeIntent !== 'choose' || (state.customDate && state.customTime));
    return true;
  };

  const next = () => {
    if (!canAdvance()) {
      setError(step === 3 ? 'Add address and ZIP.' : 'Choose a date and time.');
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'webstore',
        step_index: step,
        step_name: STEPS[step],
        reason: step === 3 ? 'address_zip_missing' : 'time_missing',
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
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const back = () => setStep((current) => Math.max(current - 1, 0));

  const buildBooking = () => {
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
      nextStep: gfeRequirement.required
        ? 'Clinical review, annual GFE, $50 hold, and Acuity scheduling handoff'
        : 'Annual GFE valid. Clinical review, $50 hold, and Acuity scheduling handoff',
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
        'Acuity scheduling handoff is represented locally until connected.',
        !COVERED_ZIPS.has(String(state.zip || '').trim()) && 'Service-area review required.',
        state.visitType === 'event' && 'Pre-launch GFE coordination required.',
      ].filter(Boolean),
    };
  };

  const canSubmit = Boolean(state.name.trim() && state.email.includes('@') && state.phone.replace(/\D/g, '').length >= 10 && state.address.trim() && String(state.zip).trim().length === 5);

  const submit = () => {
    if (!canSubmit) {
      setError('Add name, phone, email, address, and ZIP.');
      setStep(5);
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'webstore',
        step_index: 5,
        step_name: STEPS[5],
        reason: 'required_fields_missing',
      });
      return;
    }
    const candidate = buildBooking();
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
      stack: ['Avalon OS', 'Acuity placeholder', 'GFE routing', 'Nurse dispatch', 'Inventory deduction', 'CRM-safe follow-up'],
      noThirdPartyCalls: true,
      updatedAt: new Date().toISOString(),
    });
    if (localBooking.subscription) writeLocal('webstore.subscriptionPlan', localBooking.subscription);
    if (localBooking.event) writeLocal('webstore.eventRequest', localBooking.event);
    appendActivity(`Webstore hold received: ${localBooking.service}`, { role: 'client', bookingId: localBooking.id, orderType: localBooking.orderType });
    clearBookingDraft();
    navigate('/booking/confirmation');
  };

  const addonPool = [
    ...IV_ADDONS.filter((item) => !item.group).slice(0, 4),
    ...IM_SHOTS.slice(0, 4),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar showBack />
      <main className="mx-auto max-w-6xl px-4 pb-32 pt-20 md:px-8 md:pt-28 lg:pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <section className="min-w-0">
            <StepProgress step={step} />
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                transition={{ duration: 0.42, ease: EASE }}
              >
                {step === 0 && (
                  <>
                    <SectionTitle kicker="Book in under 60 seconds" title="Choose protocol." sub="No menu hell. Pick the outcome. Avalon handles the rest." />
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
                    <SectionTitle kicker={outcome.label} title="Pick the protocol." sub="Curated. Flat. Clinician-reviewed before treatment." />
                    <div className="grid gap-3">
                      {productOptions.map((item) => (
                        <ProductCard
                          key={item.key}
                          product={item}
                          active={product.key === item.key}
                          onClick={() => {
                            setValue('productKey', item.key);
                            setStep(3);
                          }}
                          onPlan={() => {
                            setState((current) => ({ ...current, productKey: item.key, visitType: 'subscription' }));
                            setStep(3);
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-5 rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.03] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="font-body text-[10px] uppercase tracking-[0.24em] text-foreground/42">Optional add-ons</p>
                        <p className="font-body text-[10px] text-foreground/45">{state.addOns.length} selected</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {addonPool.map((item) => {
                          const active = state.addOns.includes(item.label);
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => toggleAddon(item.label)}
                              className={`flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border px-3 text-left font-body text-xs transition-colors ${
                                active ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 text-foreground/62'
                              }`}
                            >
                              <span>{item.label}</span>
                              <span className="flex items-center gap-2 font-semibold">{currency(item.price)} {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <SectionTitle kicker="Location" title="Where should we come?" sub="Home, hotel, office, or launch. The stack stays invisible." />
                    <div className="grid gap-2 sm:grid-cols-4">
                      {LOCATION_TYPES.map((item) => (
                        <SelectCard key={item.key} item={{ ...item, sub: item.placeholder }} active={state.locationType === item.key} onClick={() => setValue('locationType', item.key)} className="min-h-[132px]" />
                      ))}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px]">
                      <TextInput label={LOCATION_TYPES.find((item) => item.key === state.locationType)?.placeholder || 'Address'} value={state.address} onChange={(value) => setValue('address', value)} placeholder="Street, unit, city" required />
                      <TextInput label="ZIP" value={state.zip} onChange={(value) => setValue('zip', value.replace(/\D/g, '').slice(0, 5))} placeholder="94107" required />
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

                {step === 4 && (
                  <>
                    <SectionTitle kicker="Timing" title="When do you want us?" sub="Acuity will own live scheduling. This creates the Avalon handoff." />
                    <div className="grid gap-3 sm:grid-cols-3">
                      {TIME_INTENTS.map((item) => (
                        <SelectCard key={item.key} item={{ ...item, sub: item.window, icon: Clock }} active={state.timeIntent === item.key} onClick={() => setValue('timeIntent', item.key)} />
                      ))}
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

                {step === 5 && (
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
                      {['Secure checkout placeholder', 'Flat transparent pricing', 'No hidden fees'].map((item) => (
                        <div key={item} className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-3 font-body text-xs text-foreground/55">{item}</div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {error && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/8 px-4 py-3 font-body text-xs text-red-300">{error}</p>}

            <div className="mt-7 hidden gap-3 lg:flex">
              {step > 0 && (
                <button type="button" onClick={back} aria-label="Go back one booking step" className="min-h-[52px] rounded-full border border-foreground/12 px-6 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">
                  Back
                </button>
              )}
              {step < 5 ? (
                <button type="button" onClick={next} aria-label={`Continue from ${STEPS[step]}`} className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-foreground px-8 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-background">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" disabled={!canSubmit} onClick={submit} aria-label="Hold visit and continue to checkout" className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-foreground px-8 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-background disabled:opacity-35">
                  Hold Visit <CreditCard className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>

          <SummaryRail state={state} product={product} subtotal={subtotal} canSubmit={canSubmit} onSubmit={submit} />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3 rounded-[1.35rem] border border-foreground/10 bg-background/86 p-2 shadow-[0_-18px_80px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl">
          {step > 0 && (
            <button type="button" onClick={back} aria-label="Go back one booking step" className="min-h-[52px] rounded-full border border-foreground/12 px-5 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/62">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={step < 5 ? next : submit}
            disabled={step === 5 && !canSubmit}
            aria-label={step < 5 ? `Continue from ${STEPS[step]}` : 'Hold visit and continue to checkout'}
            className="flex min-h-[52px] flex-1 items-center justify-between rounded-full bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-35"
          >
            <span>{step < 5 ? 'Continue' : `Hold ${currency(DEPOSIT_DUE)}`}</span>
            <span>{currency(subtotal)}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
