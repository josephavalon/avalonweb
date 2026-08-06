import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ArrowLeft, Check, Lock,
  Zap, Map as MapIcon, MapPin, DollarSign,
  Sparkles, Battery, Droplet, ShieldCheck,
  GlassWater, Moon, Plane,
  Layers,
} from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { useSeo } from '@/lib/seo';
import CognitoFormEmbed from '@/components/forms/CognitoFormEmbed';
import { IV_SESSIONS } from '@/config/verticals';

// Nurse Delivery — lightweight mobile-first intake.
// Landing → 2 goal selections → recommendation → Cognito form (which confirms
// on its own origin; this page has no 'thanks' step and never learns that a
// submit happened).
// All step transitions are in-page state — no route changes, no localStorage,
// no analytics beacons carrying answers. This page collects no name, phone, or
// any other identifier: the only intake surface is the sealed Cognito iframe,
// which must be on the HIPAA plan with a BAA before it accepts live PHI.

// Three broad support lanes keep the experience future-safe without asking a
// visitor to diagnose themselves. Do not add symptom or disease language here.
const Q1 = [
  {
    id: 'recovery',
    label: 'Recovery',
    hint: 'Hydration, travel, and getting back to routine.',
    icon: Droplet,
  },
  {
    id: 'optimization',
    label: 'Optimization',
    hint: 'Energy, performance, and everyday wellness.',
    icon: Zap,
  },
  {
    id: 'longevity',
    label: 'Longevity',
    hint: 'Weight management, cellular wellness, and healthy aging.',
    icon: ShieldCheck,
  },
];

const Q2_BY_GOAL = {
  recovery: [
    {
      id: 'hydration-support',
      label: 'Hydration Support',
      hint: 'Fluid replenishment and routine wellness.',
      icon: Droplet,
    },
    {
      id: 'travel-support',
      label: 'Travel Support',
      hint: 'Wellness support around demanding travel days.',
      icon: Plane,
    },
    {
      id: 'post-event-support',
      label: 'Post-Event Support',
      hint: 'Hydration and replenishment after high-output events.',
      icon: Moon,
    },
  ],
  optimization: [
    {
      id: 'energy-support',
      label: 'Energy Support',
      hint: 'Everyday energy and wellness routines.',
      icon: Battery,
    },
    {
      id: 'performance-support',
      label: 'Performance Support',
      hint: 'Support for high-output days.',
      icon: Zap,
    },
    {
      id: 'appearance-support',
      label: 'Appearance Support',
      hint: 'Hydration and nutrient-focused wellness.',
      icon: Sparkles,
    },
  ],
  longevity: [
    {
      id: 'weight-management',
      label: 'Weight Management',
      hint: 'A clinician-reviewed starting point.',
      icon: GlassWater,
    },
    {
      id: 'cellular-wellness',
      label: 'Cellular Wellness',
      hint: 'Advanced wellness options, including NAD+.',
      icon: Layers,
    },
    {
      id: 'healthy-aging',
      label: 'Healthy Aging',
      hint: 'Long-term wellness goals and clinician review.',
      icon: ShieldCheck,
    },
  ],
};

const SECOND_QUESTION = {
  recovery: 'What kind of recovery support?',
  optimization: 'What would you like to optimize?',
  longevity: 'What would you like to explore?',
};

// Each recommendation may point to a current service or to a future-safe
// clinician-reviewed category. The website recommends a starting point only;
// suitability and final selection remain inside the clinical intake.
const RECOMMENDATIONS = {
  'hydration-support': {
    serviceKey: 'hydration',
    name: 'Hydration Support',
    body: 'Designed to support fluid replenishment and help you return to your routine.',
  },
  'travel-support': {
    serviceKey: 'jetlag',
    name: 'Travel Support',
    body: 'Designed to support hydration and wellness around demanding travel days.',
  },
  'post-event-support': {
    serviceKey: 'postnight',
    name: 'Post-Event Support',
    body: 'Designed to support hydration and replenishment after high-output events.',
  },
  'energy-support': {
    serviceKey: 'energy',
    name: 'Energy Support',
    body: 'Designed around energy support and everyday wellness goals.',
  },
  'performance-support': {
    serviceKey: 'myers',
    name: 'Performance Support',
    body: 'Designed to support high-output days and performance-focused routines.',
  },
  'appearance-support': {
    serviceKey: 'beauty',
    name: 'Appearance Support',
    body: 'Hydration and nutrient support designed around appearance-focused wellness goals.',
  },
  'weight-management': {
    serviceKey: null,
    name: 'Weight Management',
    body: 'This category is not available for online recommendation yet. Explore current services or ask a concierge.',
    available: false,
  },
  'cellular-wellness': {
    serviceKey: 'nad',
    name: 'Cellular Wellness',
    body: 'A clinician-reviewed option designed around cellular wellness goals.',
  },
  'healthy-aging': {
    serviceKey: null,
    name: 'Healthy Aging',
    body: 'This category is not available for online recommendation yet. Explore current services or ask a concierge.',
    available: false,
  },
};

const BAG_IMAGE = {
  recovery:  '/bags/recovery.webp',
  energy:    '/bags/energy.webp',
  beauty:    '/bags/beauty.webp',
  myers:     '/bags/myers.webp',
  immunity:  '/bags/immunity.webp',
  hydration: '/bags/dehydration.webp',
  jetlag:    '/bags/jet-lag.webp',
  postnight: '/bags/night-out.webp',
  nad:       '/bags/nad.webp',
  cbd:       '/bags/cbd.webp',
};

function matchForKey(key) {
  const session = IV_SESSIONS.find((s) => s.key === key) || IV_SESSIONS[0];
  const dose = session.doses?.[0];
  const price = session.price ?? dose?.price;
  const duration = session.duration || dose?.duration;
  const ingredients = String(session.inside || '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    key,
    name: session.label,
    icon: session.icon,
    image: BAG_IMAGE[key] || `/bags/${key}.webp`,
    price,
    duration,
    ingredients,
    doseNote: dose ? `${dose.label} entry dose · higher doses available` : null,
  };
}

function getRecommendation(categoryId) {
  const recommendation = RECOMMENDATIONS[categoryId] || RECOMMENDATIONS['hydration-support'];
  const category = Object.values(Q2_BY_GOAL).flat().find((item) => item.id === categoryId);
  if (!recommendation.serviceKey) {
    return {
      key: categoryId,
      name: recommendation.name,
      body: recommendation.body,
      icon: category?.icon || ShieldCheck,
      image: null,
      price: null,
      duration: null,
      ingredients: [],
      doseNote: null,
      available: recommendation.available !== false,
    };
  }
  return {
    ...matchForKey(recommendation.serviceKey),
    name: recommendation.name,
    body: recommendation.body,
    icon: category?.icon,
    available: recommendation.available !== false,
  };
}

// No 'thanks' step: the Cognito iframe renders its own confirmation on its own
// origin. The host page must not react to submission — knowing a submit
// happened would mean listening to the frame that holds the PHI.
const STEPS = ['landing', 'choose', 'q1', 'q2', 'match', 'compare', 'form'];

function Progress({ index, total }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${i <= index ? 'bg-foreground' : 'bg-foreground/12'}`}
        />
      ))}
    </div>
  );
}

function OptionTile({ option, onSelect, selected = false }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      data-testid={`option-${option.id}`}
      aria-pressed={selected}
      className={`group flex w-full items-center gap-4 rounded-3xl border px-5 py-4 text-left transition-all duration-200 active:scale-[0.985] md:py-5 lg:min-h-[6.5rem] lg:px-6 ${
        selected
          ? 'border-foreground/35 bg-foreground/[0.08]'
          : 'border-foreground/[0.10] bg-foreground/[0.03] hover:border-foreground/30 hover:bg-foreground/[0.06]'
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.04]">
        <Icon className="nd-option-icon h-[18px] w-[18px]" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-[1.35rem] uppercase leading-none tracking-tight text-foreground">
          {option.label}
        </span>
        {option.hint && (
          <span className="mt-1.5 block max-w-md font-body text-[12px] font-medium leading-snug text-foreground/55 md:text-[13px]">
            {option.hint}
          </span>
        )}
      </span>
      {selected ? (
        <Check className="h-4 w-4 text-foreground/70" strokeWidth={2.25} />
      ) : (
        <ArrowRight className="h-4 w-4 text-foreground/25 transition-all duration-200 group-hover:translate-x-1 group-hover:text-foreground" strokeWidth={2} />
      )}
    </button>
  );
}

// "Help me choose" — one question, then out.
//
// This replaced a two-question funnel over nine categories, three of which
// answered "not available for online recommendation yet". It narrowed to a
// specific protocol the site cannot actually commit to, since eligibility is
// decided at clinical review, not by a picker.
//
// These are the three standalone IV lanes the menu actually sells. Picking one
// hands off to /start with ?therapy=, which the intake already renders as the
// service pill and the "Service" row in the request rail — so the choice
// carries through without asking for anything twice.
const CHOOSE_LANES = [
  {
    label: 'IV Vitamins',
    hint: 'Hydration, energy, recovery and everyday wellness.',
    icon: Droplet,
  },
  {
    label: 'IV NAD+',
    hint: 'Cellular wellness and longevity support.',
    icon: Layers,
  },
  {
    label: 'IV CBD',
    hint: 'Reviewed case by case before treatment.',
    icon: ShieldCheck,
  },
];

function LanePicker({ onPick }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="font-heading text-[3rem] uppercase leading-none tracking-tight text-foreground md:text-[4.5rem]">
        Help me choose
      </h1>
      <p className="mt-4 font-body text-base font-medium leading-relaxed text-foreground/65 md:text-lg">
        Pick the closest fit. A nurse confirms what is appropriate for you before
        any visit.
      </p>

      <div className="mt-8 grid gap-3">
        {CHOOSE_LANES.map((lane) => (
          <button
            key={lane.label}
            type="button"
            onClick={() => onPick(lane.label)}
            data-testid={`choose-lane-${lane.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
            className="group flex items-center gap-4 rounded-[1.5rem] border border-foreground/[0.12] px-5 py-5 text-left transition-colors duration-base ease-editorial hover:border-foreground/35 md:px-6 md:py-6"
          >
            <lane.icon className="h-6 w-6 shrink-0 text-foreground/70" strokeWidth={1.7} />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-[1.5rem] uppercase leading-none tracking-tight text-foreground md:text-[1.75rem]">
                {lane.label}
              </span>
              <span className="mt-1.5 block font-body text-sm font-medium leading-snug text-foreground/60">
                {lane.hint}
              </span>
            </span>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-foreground/40 transition-transform duration-base ease-editorial group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onPick('')}
        data-testid="choose-lane-unsure"
        className="mt-6 inline-flex items-center gap-2 border-b border-foreground/30 pb-1 font-body text-[15px] font-medium text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
      >
        Not sure yet — just start
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

function StepShell({ children, onBack, wide = false, extraWide = false }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto w-full ${extraWide ? 'max-w-7xl' : wide ? 'max-w-6xl' : 'max-w-[30rem] lg:max-w-6xl'}`}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-foreground/60 transition hover:border-foreground/40 hover:text-foreground md:mb-6 lg:mb-5"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
      {children}
    </motion.section>
  );
}

function Question({ index, total, title, options, onSelect, menuLabel = 'View menu' }) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(16rem,0.72fr)_minmax(35rem,1.5fr)] lg:items-start lg:gap-14 xl:gap-20">
      <div>
        <Progress index={index} total={total} />
        <h2 className="mt-5 font-heading text-[3rem] uppercase leading-[0.9] tracking-tight text-foreground md:mt-8 md:text-[3.75rem] lg:mt-7 lg:text-[4.5rem]">
          {title}
        </h2>
      </div>
      <div className="mt-6 lg:mt-0">
        <div className="grid gap-2.5 lg:gap-3">
          {options.map((o) => <OptionTile key={o.id} option={o} onSelect={onSelect} />)}
        </div>
        <Link
          to="/protocols"
          className="mt-5 inline-flex min-h-11 items-center gap-2 font-body text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/55 transition hover:text-foreground"
        >
          {menuLabel}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Zap,          label: 'Same day' },
  { icon: ShieldCheck,  label: 'Registered nurses' },
  { icon: MapPin,       label: 'SF Bay Area' },
  { icon: DollarSign,   label: 'No hidden fees' },
];

// What happens after Start. Timing copy is the real FAQ language (same-day,
// 90-minute arrival window) — do not promise a number we don't publish.
const NEXT_STEPS = [
  { n: '01', title: 'We call to confirm', hint: 'Same day • 8am–8pm' },
  { n: '02', title: 'You get a deposit link', hint: 'Applies to your visit' },
  { n: '03', title: 'A nurse arrives', hint: '90-minute arrival window' },
];

// The mono "true" voice per DESIGN.md — facts at rest, never persuasion.
// Service only appears when the visitor actually picked one (?therapy=);
// from the homepage hero they haven't, and an empty row reads like an error.
function requestRows({ therapyName, duration }) {
  return [
    ...(therapyName ? [{ label: 'Service', value: therapyName }] : []),
    { label: 'Deposit', value: '$50' },
    { label: 'Visit length', value: duration || '30–60 min' },
  ];
}

const BAY_AREA_REGIONS = 'San Francisco · Marin · East Bay · Peninsula · South Bay';

function MobileServiceCoverage() {
  return (
    <div className="nd-mobile-service-coverage" data-when="pre-submit" aria-label="Serving the entire Bay Area">
      <MapIcon aria-hidden="true" strokeWidth={1.45} />
      <span>Serving the entire Bay Area</span>
    </div>
  );
}

function DesktopServiceCoverage() {
  return (
    <div className="nd-desktop-service-coverage" aria-label={`The entire Bay Area, covered. ${BAY_AREA_REGIONS}`}>
      <div className="nd-desktop-service-coverage__copy">
        <p>The entire<br />Bay Area,<br />covered</p>
        <span>{BAY_AREA_REGIONS}</span>
      </div>
      <img src="/images/bay-area-service-map.png" alt="" aria-hidden="true" />
    </div>
  );
}

// Context rail for the focused booking screen. Desktop only.
//
// It used to collapse to a tappable "$50 deposit · 30-60 min · SF Bay Area"
// summary on mobile. That line has been removed: .nd-flow--focused-booking is a
// locked 100dvh column, so every element competes for the same fixed height,
// and the deposit and visit length are already covered by the microcopy under
// the button. Dropping it returns ~76px to the intake itself.
function RequestRail({ therapyName = '', duration = '' }) {
  const rows = requestRows({ therapyName, duration });

  return (
    <aside className="hidden lg:mt-0 lg:flex lg:h-full lg:flex-col" data-testid="landing-request-rail">
      <div className="lg:mt-0 lg:flex lg:flex-1 lg:flex-col lg:justify-start lg:pt-3">
        {/* The card hugs its rows — it must NOT stretch to eat the column's
            slack. It used to (`grow-[4]` + `justify-between` on the dl), which
            was tolerable at five rows but at four opened ~57px of dead air
            between 48px rows, so hairline-separated rows drifted apart inside a
            bordered box while the form beside them stayed dense.
            Slack now falls to the spacer below, which is whitespace BETWEEN two
            elements rather than inside one — and it bottom-aligns the steps with
            the form column. */}
        <div className="rounded-[2rem] border border-foreground/[0.10] px-6 py-5 md:px-8 md:py-7 lg:flex lg:flex-col">
          <p className="av-mono text-[11px] uppercase tracking-[0.12em] text-foreground/50">
            Your request
          </p>
          {/* Full row padding is intentional here: the approved spacing pass
              gives both facts the same calm 68–72px rhythm. */}
          <dl className="mt-7">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-t border-foreground/[0.10] py-3 lg:py-[1.375rem]"
              >
                <dt className="av-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50 md:text-[12px]">
                  {row.label}
                </dt>
                <dd className="av-mono text-right text-[13px] uppercase tracking-[0.04em] text-foreground md:text-[15px]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <DesktopServiceCoverage />
        </div>

        {/* Numerals are large and set in the body face, not av-mono: at this
            size the mono figures read as data rather than as a sequence, and
            the approved comp calls for weight. Columns are separated by hairline
            rules rather than each carrying a top border. */}
        {/* The steps use the card's full outer width in the approved reference.
            The middle track stays widest for "You get a deposit link"; the
            later tracks add their own inset after the separator. */}
        <ol className="mt-5 lg:mt-[2.3125rem] grid grid-cols-[1fr_1.2fr_1.04fr] border-l border-transparent">
          {NEXT_STEPS.map((s, i) => (
            <li
              key={s.n}
              className={i === 0 ? 'pr-3 lg:pr-2' : 'border-l border-foreground/[0.12] pl-3 lg:pl-6'}
            >
              <span className="block font-body text-[3rem] font-bold leading-none tracking-[-0.02em] text-foreground">
                {s.n}
              </span>
              {/* One line each, as in the comp. This fits naturally now the
                  columns are near-even; it needed a tracking hack back when the
                  rail was the narrower 0.88fr. */}
              <span className="mt-3 block font-body text-[15px] font-semibold leading-tight text-foreground">
                {s.title}
              </span>
              <span className="mt-1.5 block font-body text-[13px] font-medium leading-snug text-foreground/55">
                {s.hint}
              </span>
            </li>
          ))}
        </ol>

      </div>
    </aside>
  );
}

function Landing({
  onHelpMeDecide,
  focused = false,
  therapyName = '',
  duration = '',
}) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative mx-auto w-full ${focused ? 'max-w-xl lg:mx-0 lg:max-w-[76rem]' : 'max-w-xl'}${focused ? ' nd-focused-booking' : ''}`}
    >
      {/* The selected desktop reference uses near-even columns with a broad
          editorial gutter. The rail stretches with the row, then positions its
          card and steps from the top independently of the form rhythm. */}
      <div
        className={`relative${focused ? ' lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-[8.6875rem] xl:grid-cols-[33.5625rem_33.75rem]' : ''}`}
      >
        <div className={focused ? 'nd-focused-booking__form-column' : undefined}>
        {/* One h1, two labels. "START" is an instruction and reads as stale once
            the intake is in — the heading swaps to "RECEIVED" on Cognito's
            success class, same CSS-only mechanism as the microcopy below. Kept
            as spans inside a single h1 so the page never has two h1 elements. */}
        <h1 className={`font-heading uppercase tracking-tight text-foreground md:text-[8rem] ${focused ? 'whitespace-nowrap text-[4.25rem] leading-none' : 'text-[5rem] leading-[0.84]'}`}>
          <span data-when="pre-submit">Start</span>
          <span data-when="post-submit">Received</span>
        </h1>

        {/* Two hard lines, not a wrapped paragraph — the comp breaks after
            "started." and the rhythm goes if the browser chooses the break. */}
        <p
          data-when="pre-submit"
          className={`font-body font-medium text-foreground ${focused ? 'mt-4 text-[1.0625rem] leading-[1.45]' : 'mt-5 text-lg leading-[1.45]'}`}
        >
          Let&apos;s get your care started.
          <br />
          It only takes a few seconds.
        </p>

        {focused && <MobileServiceCoverage />}

        {therapyName && (
          <p className="mt-5 inline-flex rounded-full border border-foreground/15 px-4 py-2 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/65">
            {therapyName}
          </p>
        )}

        <div className={`${focused ? 'mt-6 gap-3.5' : 'mt-10 gap-5'} grid`} data-testid="landing-form">
          <CognitoFormEmbed compact tight={focused} />
          {/* data-when="pre-submit": both lines speak to a form that hasn't been sent
              yet ("we'll text you", "by submitting"), so they read as stale once
              Cognito swaps in its confirmation. Hidden by a :has() rule in
              index.css keyed on Cognito's own .is-success class — CSS only, so
              nothing here has to observe the form to know it was submitted. */}
          <p
            data-when="pre-submit"
            className={`font-body font-medium text-foreground/65 ${focused ? 'text-sm leading-[1.55]' : 'text-base leading-relaxed'}`}
          >
            We&apos;ll text a $50 deposit link after confirmation. Applied to your visit.
            Refunded if ineligible.
          </p>
          <p
            data-when="pre-submit"
            className={`flex items-start gap-2 font-body font-medium text-foreground/50 ${focused ? 'text-[11px] leading-[1.55]' : 'text-[12px] leading-relaxed'}`}
          >
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            By submitting, you consent to service-related SMS from Avalon Vitality. Reply STOP to opt out. Message and data rates may apply.
          </p>

          {/* The confirmation is a dead end otherwise — Cognito replaces the form
              in place, so there is nothing left to click. Shown only once the
              form succeeds, via the same .is-success rule that hides the
              pre-submit copy above. */}
          {/* Secondary paths belong AFTER the capture, not beside it. Before the
              form they compete with the one thing this screen exists to do;
              here the request is already in, so browsing is the natural next
              move. Revealed by the same .is-success rule as the copy above. */}
          <div
            data-when="post-submit"
            data-testid="landing-post-submit-paths"
            className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <Link
              to="/nurse-delivery?path=guided"
              data-testid="landing-help-me-choose"
              className="group inline-flex items-center gap-2 border-b border-foreground/30 pb-1 font-body text-[1.0625rem] font-medium text-foreground transition-colors duration-base ease-editorial hover:border-foreground"
            >
              Help me choose
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-base ease-editorial group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
            <Link
              to="/protocols"
              data-testid="landing-browse-menu-post"
              className="group inline-flex items-center gap-2 border-b border-foreground/30 pb-1 font-body text-[1.0625rem] font-medium text-foreground transition-colors duration-base ease-editorial hover:border-foreground"
            >
              Menu
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-base ease-editorial group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
            <Link
              to="/"
              data-testid="landing-return-home"
              className="group inline-flex items-center gap-2 font-body text-[1.0625rem] font-medium text-foreground/60 transition-colors duration-base ease-editorial hover:text-foreground"
            >
              Return home
            </Link>
          </div>
        </div>

        {!focused && (
          <>
            {/* Secondary + tertiary paths — quiet text links so the form leads */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <button
                type="button"
                onClick={onHelpMeDecide}
                data-testid="landing-help-me-decide"
                className="inline-flex items-center gap-1 font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/60 underline underline-offset-[6px] hover:text-foreground"
              >
                Help me decide
                <ArrowRight className="h-3 w-3" strokeWidth={2} />
              </button>
              <Link
                to="/protocols"
                data-testid="landing-browse-menu"
                className="inline-flex items-center gap-1 font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/60 underline underline-offset-[6px] hover:text-foreground"
              >
                Menu
                <ArrowRight className="h-3 w-3" strokeWidth={2} />
              </Link>
            </div>

            {/* Feature bar — 4-across on every viewport */}
            <div className="mt-14 grid grid-cols-4 gap-x-3 border-t border-foreground/[0.10] pt-8">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-2 text-center">
                  <f.icon className="h-6 w-6 text-foreground/85" strokeWidth={1.6} />
                  <span className="font-body text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-foreground/80 md:text-[11px]">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        </div>

        {focused && <RequestRail therapyName={therapyName} duration={duration} />}
      </div>
    </motion.section>
  );
}

// `entry` lets a route pin the starting screen without a ?path= query param,
// so /start renders the focused booking form under its own canonical URL.
export default function NurseDelivery({ entry = null }) {
  const [searchParams] = useSearchParams();
  const entryPath = searchParams.get('path') || entry;

  useSeo({
    title: entry === 'book' ? 'Start — Avalon Vitality' : 'Nurse Delivery — Avalon Vitality',
    description: entry === 'book'
      ? 'Start a mobile wellness visit. Leave your name and mobile — a registered nurse comes to you in the SF Bay Area.'
      : 'Wellness, delivered. Choose a goal and explore a clinician-reviewed starting point for mobile wellness care.',
    path: entry === 'book' ? '/start' : '/nurse-delivery',
  });

  const therapyName = searchParams.get('therapy') || '';
  const protocolKey = searchParams.get('protocol') || '';
  const focusedBooking = entryPath === 'book';
  // ProtocolPage deep-links with &protocol=<key>; use its real duration in the
  // request rail instead of the generic range.
  const protocolDuration = useMemo(
    () => (protocolKey ? matchForKey(protocolKey).duration || '' : ''),
    [protocolKey],
  );
  const [step, setStep] = useState(entryPath === 'guided' ? 'choose' : 'landing');
  const [answers, setAnswers] = useState({ goal: null, category: null, customize: null });

  useEffect(() => {
    if (step === 'landing') {
      setAnswers({ goal: null, category: null, customize: null });
    }
  }, [step]);

  useEffect(() => {
    if (entryPath === 'guided') setStep('choose');
    if (entryPath === 'book') setStep('landing');
  }, [entryPath]);

  const categoryOptions = Q2_BY_GOAL[answers.goal] || Q2_BY_GOAL.recovery;
  const selectedGoal = Q1.find((item) => item.id === answers.goal);
  const selectedCategory = categoryOptions.find((item) => item.id === answers.category);
  const match = useMemo(() => getRecommendation(answers.category), [answers.category]);
  const MatchIcon = match.icon || ShieldCheck;

  const advanceGoal = (value) => {
    setAnswers((current) => ({ ...current, goal: value, category: null }));
    setStep('q2');
  };
  const advanceCategory = (value) => {
    setAnswers((current) => ({ ...current, category: value }));
    setStep('match');
  };

  return (
    <div className={`nd-flow app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-background text-foreground${focusedBooking ? ' nd-flow--focused-booking' : ''}`}>
      <main className={`mx-auto min-h-[calc(100svh-3.75rem)] w-full px-5 md:px-8 ${focusedBooking ? 'max-w-[80.875rem] pb-6 pt-3 sm:pt-5 md:pb-24 md:pt-20' : 'max-w-6xl pb-24 pt-4 md:pt-[7rem] lg:pt-6'}`}>
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <StepShell key="landing" wide extraWide={focusedBooking}>
              <Landing
                focused={entryPath === 'book'}
                therapyName={therapyName}
                duration={protocolDuration}
                onHelpMeDecide={() => setStep('q1')}
              />
            </StepShell>
          )}

          {step === 'choose' && (
            <StepShell key="choose" wide>
              <LanePicker
                onPick={(lane) => {
                  window.location.assign(lane ? `/start?therapy=${encodeURIComponent(lane)}` : '/start');
                }}
              />
            </StepShell>
          )}

          {step === 'q1' && (
            <StepShell key="q1" onBack={() => setStep('landing')}>
              <Question
                index={0}
                total={2}
                title="What would you like to support?"
                options={Q1}
                onSelect={advanceGoal}
              />
            </StepShell>
          )}

          {step === 'q2' && (
            <StepShell key="q2" onBack={() => setStep('q1')}>
              <Question
                index={1}
                total={2}
                title={SECOND_QUESTION[answers.goal] || SECOND_QUESTION.recovery}
                options={categoryOptions}
                onSelect={advanceCategory}
              />
            </StepShell>
          )}

          {step === 'match' && (
            <StepShell key="match" onBack={() => setStep('q2')} wide>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/50">
                A starting point for review
              </p>

              <div className="mt-5 overflow-hidden rounded-[2rem] border border-foreground/[0.10] bg-foreground/[0.03] lg:grid lg:grid-cols-[0.85fr_1.15fr]">
                <div className="flex min-h-[13rem] items-center justify-center border-b border-foreground/[0.10] px-8 py-6 lg:min-h-[31rem] lg:border-b-0 lg:border-r lg:py-10">
                  {match.image ? (
                    <motion.img
                      key={match.image}
                      src={match.image}
                      alt={`${match.name} service`}
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="h-40 w-auto object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.28)] md:h-48 lg:h-80"
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <span className="flex h-24 w-24 items-center justify-center rounded-full border border-foreground/15 bg-foreground/[0.03]">
                      <MatchIcon className="h-9 w-9 text-foreground/70" strokeWidth={1.4} />
                    </span>
                  )}
                </div>

                <div className="flex flex-col justify-center px-6 py-6 md:px-10 lg:px-14 lg:py-12">
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/50">
                    {selectedGoal?.label || 'Recovery'} · {selectedCategory?.label || 'Hydration Support'}
                  </p>
                  <h2 className="mt-5 font-heading text-[3rem] uppercase leading-[0.88] tracking-tight text-foreground md:text-[4.25rem]">
                    {match.name}
                  </h2>
                  <p className="mt-5 max-w-lg font-body text-base font-medium leading-relaxed text-foreground/65 md:text-lg">
                    {match.body}
                  </p>

                  {(match.duration || match.price != null) && (
                    <p className="mt-5 font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                      {match.duration && match.duration}
                      {match.duration && match.price != null && ' · '}
                      {match.price != null && `Starting at $${match.price}`}
                    </p>
                  )}

                  <div className="mt-6 grid gap-3">
                    {match.available ? (
                      <button
                        type="button"
                        onClick={() => setStep('form')}
                        data-testid="match-continue"
                        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 font-heading text-lg uppercase tracking-tight text-background transition hover:opacity-90 active:scale-[0.99]"
                      >
                        Book
                        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStep('form')}
                        data-testid="match-concierge"
                        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 font-heading text-lg uppercase tracking-tight text-background transition hover:opacity-90 active:scale-[0.99]"
                      >
                        Ask a concierge
                        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStep('compare')}
                      data-testid="match-compare"
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-foreground/15 px-6 font-heading text-base uppercase tracking-tight text-foreground/85 transition hover:border-foreground/40"
                    >
                      Compare options
                    </button>
                    <Link
                      to="/protocols"
                      className="inline-flex min-h-11 items-center justify-center gap-2 font-body text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/50 transition hover:text-foreground"
                    >
                      View full menu
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  </div>

                  <p className="mt-5 font-body text-[11px] font-medium leading-relaxed text-foreground/45">
                    Booking submits a request. Final eligibility and service selection are determined through clinician review.
                    Your appointment is confirmed after the $50 deposit is paid.
                  </p>
                </div>
              </div>
            </StepShell>
          )}

          {step === 'compare' && (
            <StepShell key="compare" onBack={() => setStep('match')}>
              <div className="lg:grid lg:grid-cols-[minmax(16rem,0.72fr)_minmax(35rem,1.5fr)] lg:items-start lg:gap-14 xl:gap-20">
                <div>
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/50">
                    {selectedGoal?.label || 'Your goal'}
                  </p>
                  <h2 className="mt-4 font-heading text-[3rem] uppercase leading-[0.9] tracking-tight text-foreground md:text-[3.75rem] lg:text-[4.5rem]">
                    Compare options.
                  </h2>
                  <p className="mt-4 max-w-sm font-body text-sm font-medium leading-relaxed text-foreground/55">
                    Choose another starting point, or continue with your current selection.
                  </p>
                </div>
                <div className="mt-6 lg:mt-0">
                  <div className="grid gap-2.5 lg:gap-3">
                    {categoryOptions.map((option) => (
                      <OptionTile
                        key={option.id}
                        option={option}
                        selected={option.id === answers.category}
                        onSelect={(value) => {
                          setAnswers((current) => ({ ...current, category: value }));
                          setStep('match');
                        }}
                      />
                    ))}
                  </div>
                  <Link
                    to="/protocols"
                    className="mt-5 inline-flex min-h-11 items-center gap-2 font-body text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/55 transition hover:text-foreground"
                  >
                    View full menu
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </div>
              </div>
            </StepShell>
          )}

          {step === 'form' && (
            <StepShell key="form" onBack={() => setStep('match')}>
              <h2 className="font-heading text-[3.25rem] uppercase leading-[0.9] tracking-tight text-foreground md:text-[4rem]">
                One last thing.
              </h2>
              <p className="mt-4 max-w-md font-body text-lg font-medium text-foreground/60">
                {answers.customize === 'events'
                  ? 'Your name and mobile. We’ll be in touch to plan your event.'
                  : !match.available
                    ? 'Your name and mobile. A concierge will follow up about this category.'
                    : 'Your name and mobile. We’ll verify your request, then text you a $50 deposit link.'}
              </p>

              <div className="mt-10">
                <CognitoFormEmbed />
              </div>

              <p className="mt-6 font-body text-[12px] font-medium leading-relaxed text-foreground/40">
                By continuing, you consent to SMS from Avalon Vitality. Reply STOP to opt out.
                {answers.customize === 'events'
                  ? ' An event coordinator will follow up shortly.'
                  : !match.available
                    ? ' This request does not create an appointment or guarantee service availability.'
                    : ' Your appointment is confirmed after the $50 deposit is paid; the balance is due after care.'}
                {' '}A licensed provider reviews all requests before care.
              </p>
            </StepShell>
          )}

        </AnimatePresence>
      </main>

      {!focusedBooking && <ConsumerFooter />}
    </div>
  );
}

export const __NURSE_STEPS = STEPS;
