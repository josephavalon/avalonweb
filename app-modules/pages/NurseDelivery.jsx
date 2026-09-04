import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, Lock,
  Zap, MapPin, DollarSign,
  ShieldCheck,
} from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { useSeo } from '@/lib/seo';
import CognitoFormEmbed from '@/components/forms/CognitoFormEmbed';
import CognitoSubmitPing from '@/components/forms/CognitoSubmitPing';
import GuidedCommerce from '@/components/guided/GuidedCommerce';
import { resolveConsumerOffering } from '@/data/consumerOffering';
import './NurseDelivery.css';
import {
  getGuidedContext,
  getGuidedGoal,
  getGuidedOffering,
  getGuidedTiming,
} from '@/data/guidedCommerce';
import { ANALYTICS_EVENTS, trackConsented } from '@/lib/analytics';
import { clearGuidedFlow, readGuidedFlow, timestampGuidedFlow } from '@/lib/guidedSession';
import { CBD_HIDDEN, isCbdProtocolKey } from '@/lib/cbdVisibility';

// Nurse Delivery owns the unrestricted entry surface and the single intake.
// Guided commerce is route-state driven and hands its selection to /start.

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

const NEXT_STEPS = [
  { n: '01', title: 'Send your request', hint: 'Choose a preferred date and time.' },
  { n: '02', title: 'We confirm the details', hint: 'Our team confirms availability and clinical eligibility.' },
  { n: '03', title: 'Your nurse comes to you', hint: 'Your $50 deposit is credited toward your visit.' },
];

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

function RequestSummary({ therapyName, offering, timingLabel, mobile = false }) {
  const rows = [
    { label: 'Treatment', value: offering?.name || therapyName || 'Choose with our team' },
    { label: 'Visit price', value: offering?.priceLabel || 'Confirmed before payment' },
    { label: 'Visit length', value: offering?.duration || 'Depends on your treatment' },
    { label: 'Deposit', value: '$50 credited to your visit' },
    ...(timingLabel ? [{ label: 'Timing preference', value: timingLabel }] : []),
  ];

  return (
    <section className={`nd-request-summary${mobile ? ' nd-request-summary--mobile' : ''}`} aria-label="Your visit summary">
      <p className="nd-request-summary__eyebrow av-mono">Your visit</p>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className="av-mono">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="nd-request-summary__note">Any selected add-ons are extra and confirmed with you. The deposit is part of your visit price.</p>
      {mobile && (
        <p className="nd-request-summary__next">After you send this request, our team calls to confirm availability and clinical eligibility.</p>
      )}
    </section>
  );
}

function ServiceCoverage() {
  return (
    <div className="nd-request-coverage">
      <p><MapPin aria-hidden="true" size={18} /> Home, hotel or office in five Bay Area counties</p>
      <span>{BAY_AREA_REGIONS}</span>
      <Link to="/service-area" target="_blank" rel="noreferrer">View service area</Link>
    </div>
  );
}

function RequestRail({ therapyName, offering, timingLabel }) {
  return (
    <aside className="nd-request-rail" data-testid="landing-request-rail">
      <RequestSummary therapyName={therapyName} offering={offering} timingLabel={timingLabel} />
      <ol className="nd-request-steps" aria-label="What happens next">
        {NEXT_STEPS.map((step) => (
          <li key={step.n}>
            <span className="nd-request-steps__number av-mono">{step.n}</span>
            <div><strong>{step.title}</strong><p>{step.hint}</p></div>
          </li>
        ))}
      </ol>
      <ServiceCoverage />
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

  async function openCheckout() {
    if (state === 'pending') return;
    setState('pending');
    try {
      const res = await fetch('/api/deposit/create-session', {
        method: 'POST',
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
        {state === 'pending' ? 'Opening secure checkout…' : 'Pay your $50 deposit'}
        {state !== 'pending' && <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} />}
      </button>
      {state === 'error' ? (
        <p className="font-body text-[13px] font-medium leading-snug text-foreground/60">
          Couldn&apos;t open checkout. Call (415) 980-7708 and we&apos;ll take it from there.
        </p>
      ) : (
        <p className="font-body text-[13px] font-medium leading-snug text-foreground/55">
          Credited toward your visit. Refunded if ineligible. You can also wait for our call. Our team confirms your appointment.
        </p>
      )}
    </div>
  );
}

function Landing({
  onHelpMeDecide,
  focused = false,
  therapyName = '',
  offering = null,
  timingLabel = '',
  prefill = null,
}) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative mx-auto w-full ${focused ? 'max-w-xl lg:mx-0 lg:max-w-[76rem]' : 'max-w-xl'}${focused ? ' nd-focused-booking' : ''}`}
    >
      {/* Desktop pairs the form with visit details; mobile shows the same
          details before the form so they stay available while deciding. */}
      <div
        className={`relative${focused ? ' nd-request-layout' : ''}`}
      >
        <div className={focused ? 'nd-focused-booking__form-column' : undefined}>
        {/* Cognito's success class swaps the heading without inspecting fields. */}
        <h1 className={`font-heading uppercase tracking-tight text-foreground md:text-[8rem] ${focused ? 'whitespace-nowrap text-[4.25rem] leading-none' : 'text-[5rem] leading-[0.84]'}`}>
          <span data-when="pre-submit">Request a visit</span>
          <span data-when="post-submit">Received</span>
        </h1>

        <p
          data-when="pre-submit"
          className={`font-body font-medium text-foreground ${focused ? 'mt-4 text-[1.0625rem] leading-[1.45]' : 'mt-5 text-lg leading-[1.45]'}`}
        >
          Mobile IV therapy at your home, hotel or office. Our team calls to confirm your visit.
        </p>

        <div className="nd-request-inline-summary" data-when="pre-submit">
          <RequestSummary therapyName={therapyName} offering={offering} timingLabel={timingLabel} mobile={focused} />
        </div>

        {focused && <p className="nd-request-preferences" data-when="pre-submit">
          <strong>Choose your preferred date and time below.</strong>{' '}
          These are preferences; availability and clinical eligibility must be confirmed by our team.
          {timingLabel && <> Your timing preference is <strong>{timingLabel}</strong>; update the date and time fields to suit you.</>}
        </p>}

        <div className={`${focused ? 'mt-6 gap-3.5' : 'mt-10 gap-5'} grid`} data-testid="landing-form">
          <CognitoFormEmbed
            compact
            tight={focused}
            appointmentFields={focused}
            prefill={prefill}
          />
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
            className={`nd-focused-booking__deposit-note font-body font-medium text-foreground/65 ${focused ? 'text-sm leading-[1.55]' : 'text-base leading-relaxed'}`}
          >
            Your $50 deposit is credited toward your visit and refunded if you are ineligible.
            You can pay after submitting this request or wait for our call.
            Payment alone does not confirm your appointment.
          </p>
          <p
            data-when="pre-submit"
            className={`nd-focused-booking__sms-note flex items-start gap-2 font-body font-medium text-foreground/50 ${focused ? 'text-[11px] leading-[1.55]' : 'text-[12px] leading-relaxed'}`}
          >
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span>By submitting, you consent to service-related SMS from Avalon Vitality. Reply STOP to opt out. Message and data rates may apply. <Link to="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</Link> · <Link to="/terms-of-service" target="_blank" rel="noreferrer">Terms of Service</Link> · <Link to="/notice-of-privacy-practices" target="_blank" rel="noreferrer">Notice of Privacy Practices</Link></span>
          </p>

          {/* The confirmation is a dead end otherwise — Cognito replaces the form
              in place, so there is nothing left to click. Shown only once the
              form succeeds, via the same .is-success rule that hides the
              pre-submit copy above. */}
          {/* Secondary paths belong AFTER the capture, not beside it. Before the
              form they compete with the one thing this screen exists to do;
              here the request is already in, so browsing is the natural next
              move. Revealed by the same .is-success rule as the copy above. */}
          <p className="nd-request-safety" data-when="pre-submit"><ShieldCheck aria-hidden="true" size={18} /><Link to="/safety" target="_blank" rel="noreferrer">How we keep your care safe</Link></p>
          {focused && <div className="nd-request-mobile-coverage" data-when="pre-submit"><ServiceCoverage /></div>}
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

        {focused && <RequestRail therapyName={therapyName} offering={offering} timingLabel={timingLabel} />}
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
    title: entry === 'book' ? 'Request a visit — Avalon Vitality' : 'Nurse Delivery — Avalon Vitality',
    description: entry === 'book'
      ? 'Request mobile IV therapy at your home, hotel or office in the SF Bay Area. Our team confirms availability and clinical eligibility.'
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
  const doseKey = searchParams.get('dose') || guidedOffering?.doseKey || '';
  const offering = useMemo(
    () => resolveConsumerOffering({ protocolKey, doseKey, therapyName: guidedOffering?.name || therapyParam }),
    [protocolKey, doseKey, guidedOffering, therapyParam],
  );
  const timingLabel = guidedSource
    ? getGuidedTiming(guidedSelection?.answers?.timing)?.label || ''
    : homepagePickerSource ? HOMEPAGE_PICKER_LABELS[homepageTiming] || '' : '';
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
    <div className={`nd-flow app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-background text-foreground${focusedBooking ? ' nd-flow--focused-booking nd-request-page' : ' nd-request-page'}`}>
      <main className={`mx-auto min-h-[calc(100svh-3.75rem)] w-full px-5 md:px-8 ${focusedBooking ? 'max-w-[80.875rem] pb-6 pt-3 sm:pt-5 md:pb-24 md:pt-20' : 'max-w-6xl pb-24 pt-4 md:pt-[7rem] lg:pt-6'}`}>
        <StepShell wide extraWide={focusedBooking}>
          <Landing
            focused={entryPath === 'book'}
            therapyName={therapyName}
            offering={offering}
            timingLabel={timingLabel}
            prefill={guidedPrefill}
            onHelpMeDecide={() => navigate('/nurse-delivery?path=guided')}
          />
        </StepShell>
      </main>

      {!focusedBooking && <ConsumerFooter />}
    </div>
  );
}
