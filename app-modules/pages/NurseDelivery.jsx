import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ArrowLeft, Check, Lock, ChevronDown, Phone,
  Zap, MapPin, DollarSign,
  Sparkles, Battery, Droplet, ShieldCheck,
  GlassWater, Moon, Plane,
  Layers,
} from 'lucide-react';
import Footer from '@/components/landing/Footer';
import AsSeenAt from '@/components/landing/AsSeenAt';
import { useSeo } from '@/lib/seo';
import CognitoFormEmbed from '@/components/forms/CognitoFormEmbed';
import { IV_SESSIONS } from '@/config/verticals';

// Nurse Delivery — lightweight mobile-first intake.
// Landing → 2 goal selections → recommendation → Cognito form → thanks.
// All step transitions are in-page state — no route changes, no localStorage,
// no analytics beacons carrying answers. Cognito form must be on the HIPAA
// plan with a BAA before this page accepts live PHI.

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

const STEPS = ['landing', 'q1', 'q2', 'match', 'compare', 'form', 'thanks'];

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

function StepShell({ children, onBack, wide = false }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-[30rem] lg:max-w-6xl'}`}
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

const PHONE_DISPLAY = '(415) 980-7708';
const PHONE_URL = 'tel:+14159807708';

// What happens after Start. Timing copy is the real FAQ language (same-day,
// 90-minute arrival window) — do not promise a number we don't publish.
const NEXT_STEPS = [
  { n: '01', title: 'We call to confirm', hint: 'Same day · 8am–8pm' },
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
    { label: 'Applied to', value: 'Your visit' },
    { label: 'Visit length', value: duration || '30–60 min' },
    { label: 'Area', value: 'SF Bay Area' },
    { label: 'Nurse', value: 'Registered' },
  ];
}

// Context rail for the focused booking screen. Desktop: always-open card in
// the empty right half. Mobile: collapsed to one summary line, because
// .nd-flow--focused-booking is a locked 100dvh column (src/index.css).
function RequestRail({ therapyName = '', duration = '' }) {
  const [open, setOpen] = useState(false);
  const rows = requestRows({ therapyName, duration });

  return (
    <aside className="mt-8 lg:mt-0" data-testid="landing-request-rail">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="nd-request-body"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-foreground/[0.10] px-4 py-3 text-left lg:hidden"
      >
        <span className="av-mono whitespace-nowrap text-[10px] uppercase tracking-[0.04em] text-foreground/70 sm:text-[11px] sm:tracking-[0.08em]">
          $50 deposit · {duration || '30–60 min'} · SF Bay Area
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-foreground/50 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      <div id="nd-request-body" className={`${open ? 'mt-3 block' : 'hidden'} lg:mt-0 lg:block`}>
        <div className="rounded-[2rem] border border-foreground/[0.10] px-6 py-5 md:px-8 md:py-7">
          <p className="av-mono text-[11px] uppercase tracking-[0.12em] text-foreground/50">
            Your request
          </p>
          <dl className="mt-4">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-t border-foreground/[0.10] py-3"
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
        </div>

        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {NEXT_STEPS.map((s) => (
            <li key={s.n} className="border-t border-foreground/[0.10] pt-3">
              <span className="av-mono block text-[13px] text-foreground/35">{s.n}</span>
              <span className="mt-1.5 block font-body text-[13px] font-semibold leading-tight text-foreground">
                {s.title}
              </span>
              <span className="mt-1 block font-body text-[12px] font-medium leading-tight text-foreground/50">
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
  onBook,
  onHelpMeDecide,
  name,
  setName,
  phone,
  setPhone,
  focused = false,
  therapyName = '',
  duration = '',
}) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative mx-auto w-full ${focused ? 'max-w-xl lg:max-w-5xl' : 'max-w-xl'}${focused ? ' nd-focused-booking' : ''}`}
    >
      <div
        className={`relative${focused ? ' lg:grid lg:grid-cols-[1.12fr_0.88fr] lg:items-start lg:gap-12 xl:gap-16' : ''}`}
      >
        <div>
        <h1 className={`font-heading uppercase tracking-tight text-foreground md:text-[8rem] ${focused ? 'whitespace-nowrap text-[4.25rem] leading-none' : 'text-[5rem] leading-[0.84]'}`}>
          Start
        </h1>

        {therapyName && (
          <p className="mt-5 inline-flex rounded-full border border-foreground/15 px-4 py-2 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/65">
            {therapyName}
          </p>
        )}

        <div className={`${focused ? 'mt-6 gap-3.5' : 'mt-10 gap-5'} grid`} data-testid="landing-form">
          <CognitoFormEmbed
            compact
            tight={focused}
            name={name}
            phone={phone}
            onNameChange={setName}
            onPhoneChange={setPhone}
            onSubmit={onBook}
            buttonLabel="Start"
            nameTestId="landing-name"
            phoneTestId="landing-phone"
            submitTestId="landing-book-now"
          />
          <p className={`font-body font-medium text-foreground/65 ${focused ? 'text-sm leading-[1.55]' : 'text-base leading-relaxed'}`}>
            We&apos;ll text a $50 deposit link after confirmation. Applied to your visit.
            Refunded if ineligible.
          </p>
          <p className={`flex items-start gap-2 font-body font-medium text-foreground/50 ${focused ? 'text-[11px] leading-[1.55]' : 'text-[12px] leading-relaxed'}`}>
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            By submitting, you consent to service-related SMS from Avalon Vitality. Reply STOP to opt out. Message and data rates may apply.
          </p>
        </div>

        {/* Focused mode used to dead-end on a single Submit. These are the same
            escape hatches the full landing has, kept as visible controls. */}
        {focused && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onHelpMeDecide}
              data-testid="landing-help-me-decide"
              className="inline-flex min-h-11 items-center rounded-full border border-foreground/15 px-3.5 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-foreground/75 transition hover:border-foreground/40 hover:text-foreground"
            >
              Help me choose
            </button>
            <Link
              to="/protocols"
              data-testid="landing-browse-menu"
              className="inline-flex min-h-11 items-center rounded-full border border-foreground/15 px-3.5 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-foreground/75 transition hover:border-foreground/40 hover:text-foreground"
            >
              View full menu
            </Link>
            <a
              href={PHONE_URL}
              data-testid="landing-call"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-3.5 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-foreground/75 transition hover:border-foreground/40 hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
              Call
              <span className="hidden sm:inline">{PHONE_DISPLAY}</span>
            </a>
          </div>
        )}

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

            {/* Press marquee */}
            <div className="mt-10 border-t border-foreground/[0.10] pt-6 [&_.av-asa]:!px-0 [&_.av-asa>div:first-child]:!px-0">
              <AsSeenAt />
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
  const [step, setStep] = useState(entryPath === 'guided' ? 'q1' : 'landing');
  const [answers, setAnswers] = useState({ goal: null, category: null, customize: null });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (step === 'landing') {
      setAnswers({ goal: null, category: null, customize: null });
    }
  }, [step]);

  useEffect(() => {
    if (entryPath === 'guided') setStep('q1');
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
      <main className={`mx-auto min-h-[calc(100svh-3.75rem)] w-full max-w-6xl px-5 md:px-8 ${focusedBooking ? 'pb-6 pt-3 sm:pt-5 md:pb-24 md:pt-20' : 'pb-24 pt-4 md:pt-[7rem] lg:pt-6'}`}>
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <StepShell key="landing" wide>
              <Landing
                name={name}
                setName={setName}
                phone={phone}
                setPhone={setPhone}
                focused={entryPath === 'book'}
                therapyName={therapyName}
                duration={protocolDuration}
                onBook={() => setStep('thanks')}
                onHelpMeDecide={() => setStep('q1')}
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
                <CognitoFormEmbed onSubmit={() => setStep('thanks')} />
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

          {step === 'thanks' && (
            <StepShell key="thanks">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-foreground/25">
                <Check className="h-6 w-6 text-foreground" strokeWidth={2} />
              </span>
              <h2 className="mt-10 font-heading text-[3.5rem] uppercase leading-[0.9] tracking-tight text-foreground md:text-[4.5rem]">
                Thank you.
              </h2>
              <p className="mt-5 max-w-md font-body text-lg font-medium text-foreground/60">
                {answers.customize === 'events'
                  ? 'We’ll be in touch shortly to plan your event.'
                  : !match.available
                    ? 'A real member of our team will follow up about this category. This request does not create an appointment or guarantee service availability.'
                    : `${therapyName ? `${therapyName}: ` : ''}A real member of our team will verify your request. Once accepted, we’ll send a $50 deposit link. It applies to your visit and is refunded if you’re not clinically eligible.`}
              </p>

              <Link
                to="/"
                className="mt-12 inline-flex min-h-12 items-center gap-2 font-heading text-base uppercase tracking-tight text-foreground/70 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                Back to home
              </Link>
            </StepShell>
          )}
        </AnimatePresence>
      </main>

      {!focusedBooking && <Footer />}
    </div>
  );
}

export const __NURSE_STEPS = STEPS;
