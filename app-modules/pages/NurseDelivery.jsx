import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, Lock,
  Zap, Map as MapIcon, MapPin, DollarSign,
  ShieldCheck,
} from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { useSeo } from '@/lib/seo';
import CognitoFormEmbed from '@/components/forms/CognitoFormEmbed';
import CognitoSubmitPing from '@/components/forms/CognitoSubmitPing';
import GuidedCommerce from '@/components/guided/GuidedCommerce';
import { IV_SESSIONS } from '@/config/verticals';
import {
  getGuidedContext,
  getGuidedGoal,
  getGuidedOffering,
  getGuidedTiming,
} from '@/data/guidedCommerce';
import { ANALYTICS_EVENTS, trackConsented } from '@/lib/analytics';
import { newNonce } from '@/lib/intakeAlert';
import { clearGuidedFlow, readGuidedFlow, timestampGuidedFlow } from '@/lib/guidedSession';
import { CBD_HIDDEN, isCbdProtocolKey } from '@/lib/cbdVisibility';

// Nurse Delivery owns the unrestricted entry surface and the single intake.
// Guided commerce is route-state driven and hands its selection to /start.

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

function StepShell({ children, wide = false, extraWide = false }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto w-full ${extraWide ? 'max-w-7xl' : wide ? 'max-w-6xl' : 'max-w-[30rem] lg:max-w-6xl'}`}
    >
      {children}
    </motion.section>
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
  { n: '02', title: 'You reserve with $50', hint: 'Applies to your visit' },
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

const BAY_AREA_REGIONS = 'San Francisco · San Mateo · Santa Clara · Alameda · Contra Costa';

const HOMEPAGE_PICKER_LABELS = Object.freeze({
  hydration: 'Rehydrate',
  recover: 'Recover',
  immunity: 'Immune support',
  energy: 'Energy',
  beauty: 'Skin and hair',
  travel: 'Travel reset',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  home: 'Home',
  hotel: 'Hotel',
  office: 'Office',
  other: 'Somewhere else',
});

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

// The deposit is the one action worth taking the moment a request is in, so it
// gets a solid surface rather than a fourth underlined link in the paths row
// below. Posts nothing: api/deposit/create-session.js refuses a body outright
// and mints its own reference, so this button cannot leak what the visitor
// typed even if someone later wires it to a form.
function ReserveDepositButton() {
  const [state, setState] = useState('idle');
  // One nonce per mount, not per click: it is what makes Stripe's idempotency
  // key engage, so a double-click opens ONE session instead of two. Scoped to
  // the component rather than sessionStorage on purpose — a session expires
  // after 30 minutes but a Stripe idempotency key lives 24 hours, so a
  // persisted nonce would hand a returning visitor a dead checkout URL.
  const nonceRef = useRef(null);
  if (nonceRef.current === null) nonceRef.current = newNonce();

  async function openCheckout() {
    if (state === 'pending') return;
    setState('pending');
    try {
      const res = await fetch('/api/deposit/create-session', {
        method: 'POST',
        headers: { 'x-avalon-deposit-nonce': nonceRef.current },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.code || 'deposit_unavailable');
      // assign, not replace: Back from Stripe should return here, not to the
      // empty form the visitor already submitted.
      window.location.assign(data.url);
    } catch {
      setState('error');
    }
  }

  return (
    <div data-when="post-submit" data-testid="landing-deposit-cta" className="mt-2 grid gap-2">
      <button
        type="button"
        onClick={openCheckout}
        disabled={state === 'pending'}
        className="inline-flex items-center justify-between gap-4 rounded-2xl bg-foreground px-5 py-4 font-body text-[1.0625rem] font-semibold text-background transition-opacity duration-base ease-editorial hover:opacity-90 disabled:opacity-60 md:px-8 md:py-5"
      >
        {state === 'pending' ? 'Opening secure checkout…' : 'Reserve your spot — $50'}
        {state !== 'pending' && <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} />}
      </button>
      {state === 'error' ? (
        <p className="font-body text-[13px] font-medium leading-snug text-foreground/60">
          Couldn&apos;t open checkout. Call (415) 980-7708 and we&apos;ll take it from there.
        </p>
      ) : (
        <p className="font-body text-[13px] font-medium leading-snug text-foreground/55">
          Applied to your visit. Refunded if ineligible. Or wait for our call — either works.
        </p>
      )}
    </div>
  );
}

function Landing({
  onHelpMeDecide,
  focused = false,
  therapyName = '',
  duration = '',
  prefill = null,
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
          <CognitoFormEmbed compact tight={focused} prefill={prefill} />
          <CognitoSubmitPing source="start" />
          {/* data-when="pre-submit": both lines speak to a form that hasn't been sent
              yet ("we'll text you", "by submitting"), so they read as stale once
              Cognito swaps in its confirmation. Hidden by a :has() rule in
              index.css keyed on Cognito's own .is-success class, so the copy
              swap itself needs no JS. CognitoSubmitPing above watches that same
              class to fire the admin SMS alert — it reads class attributes only
              and never touches a field value. */}
          <p
            data-when="pre-submit"
            className={`font-body font-medium text-foreground/65 ${focused ? 'text-sm leading-[1.55]' : 'text-base leading-relaxed'}`}
          >
            A $50 deposit holds your spot — applied to your visit, refunded if
            ineligible. You can pay it as soon as this is sent, or wait for our call.
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
          <ReserveDepositButton />

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
  const navigate = useNavigate();
  const location = useLocation();
  const entryPath = searchParams.get('path') || entry;

  useSeo({
    title: entry === 'book' ? 'Start — Avalon Vitality' : 'Nurse Delivery — Avalon Vitality',
    description: entry === 'book'
      ? 'Start a mobile wellness visit. Leave your name and mobile — a registered nurse comes to you in the SF Bay Area.'
      : 'Wellness, delivered. Choose a goal and explore a clinician-reviewed starting point for mobile wellness care.',
    path: entry === 'book' ? '/start' : '/nurse-delivery',
  });

  const rawTherapyParam = searchParams.get('therapy') || '';
  const therapyParam = CBD_HIDDEN && /(^|[-_\s])cbd($|[-_\s])/i.test(rawTherapyParam)
    ? ''
    : rawTherapyParam;
  const guidedSource = searchParams.get('source') === 'guided';
  const homepagePickerSource = searchParams.get('source') === 'homepage-v2';
  const guidedSelection = guidedSource ? location.state?.guided : null;
  const guidedOffering = guidedSource || homepagePickerSource ? getGuidedOffering(therapyParam) : null;
  const therapyName = guidedOffering?.name || therapyParam;
  const rawProtocolKey = searchParams.get('protocol') || '';
  const protocolKey = CBD_HIDDEN
    && (isCbdProtocolKey(rawProtocolKey) || rawProtocolKey.toLowerCase().startsWith('cbd-'))
    ? ''
    : rawProtocolKey;
  const homepageGoal = searchParams.get('goal') || '';
  const homepageTiming = searchParams.get('timing') || '';
  const homepageLocation = searchParams.get('location') || '';
  const focusedBooking = entryPath === 'book';
  // ProtocolPage deep-links with &protocol=<key>; use its real duration in the
  // request rail instead of the generic range.
  const protocolDuration = useMemo(
    () => (protocolKey ? matchForKey(protocolKey).duration || '' : ''),
    [protocolKey],
  );
  const guidedPrefill = useMemo(() => {
    if (homepagePickerSource && guidedOffering) {
      return {
        GuidedSource: 'Homepage picker',
        GuidedTherapy: guidedOffering.name,
        GuidedGoal: HOMEPAGE_PICKER_LABELS[homepageGoal] || homepageGoal,
        GuidedContext: HOMEPAGE_PICKER_LABELS[homepageLocation] || homepageLocation,
        GuidedTiming: HOMEPAGE_PICKER_LABELS[homepageTiming] || homepageTiming,
      };
    }
    const selectedAnswers = guidedSelection?.answers;
    const goal = getGuidedGoal(selectedAnswers?.goal);
    const context = getGuidedContext(selectedAnswers?.goal, selectedAnswers?.context);
    const timing = getGuidedTiming(selectedAnswers?.timing);
    if (!guidedOffering || !goal || !context || !timing) return null;
    return {
      GuidedSource: 'Guided commerce',
      GuidedTherapy: guidedOffering.name,
      GuidedGoal: goal.label,
      GuidedContext: context.label,
      GuidedTiming: timing.label,
    };
  }, [guidedOffering, guidedSelection, homepageGoal, homepageLocation, homepagePickerSource, homepageTiming]);
  useEffect(() => {
    if (focusedBooking && !guidedSource) clearGuidedFlow();
  }, [focusedBooking, guidedSource]);

  useEffect(() => {
    const flowId = guidedSelection?.flowId;
    if (!focusedBooking || !guidedSource || !flowId || !guidedOffering) return;
    const flow = readGuidedFlow();
    if (flow?.id !== flowId || flow.startOpenedAt) return;
    const tracked = trackConsented(ANALYTICS_EVENTS.START_FLOW_OPENED, {
      flow_id: flowId,
      therapy_id: guidedOffering.id,
      goal: guidedSelection.answers?.goal,
      context: guidedSelection.answers?.context,
      timing: guidedSelection.answers?.timing,
      screen: 'start',
      elapsed_ms: Math.max(0, Date.now() - Number(guidedSelection.startedAt || Date.now())),
    });
    if (tracked) timestampGuidedFlow(flowId, 'startOpenedAt');
  }, [focusedBooking, guidedOffering, guidedSelection, guidedSource]);

  if (entryPath === 'guided') return <GuidedCommerce />;

  return (
    <div className={`nd-flow app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-background text-foreground${focusedBooking ? ' nd-flow--focused-booking' : ''}`}>
      <main className={`mx-auto min-h-[calc(100svh-3.75rem)] w-full px-5 md:px-8 ${focusedBooking ? 'max-w-[80.875rem] pb-6 pt-3 sm:pt-5 md:pb-24 md:pt-20' : 'max-w-6xl pb-24 pt-4 md:pt-[7rem] lg:pt-6'}`}>
        <StepShell wide extraWide={focusedBooking}>
          <Landing
            focused={entryPath === 'book'}
            therapyName={therapyName}
            duration={protocolDuration}
            prefill={guidedPrefill}
            onHelpMeDecide={() => navigate('/nurse-delivery?path=guided')}
          />
        </StepShell>
      </main>

      {!focusedBooking && <ConsumerFooter />}
    </div>
  );
}
