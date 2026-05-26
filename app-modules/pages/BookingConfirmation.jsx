import React, { useState, useEffect } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, User,
  Droplets, Clock, MapPin, Hash, Loader2,
  ShieldCheck, Shirt, CreditCard, Phone,
  ExternalLink,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import ConsumerTruthLayer from '@/components/consumer/ConsumerTruthLayer';
import ClinicalClearancePanel from '@/components/clinical/ClinicalClearancePanel';
import { useSeo } from '@/lib/seo';
import { readLastBooking, saveLastBooking, appendActivity } from '@/lib/localOs';
import { buildConsumerTruthLayer } from '@/lib/consumerTruth';
import { readVisitPrep, saveVisitPrep } from '@/lib/platformOps';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';

const EASE = [0.16, 1, 0.3, 1];
const TZ = 'America/Los_Angeles';

/* ─── Helpers ────────────────────────────────────────────────── */
function formatApptDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ,
  });
}

function formatApptTime(isoString, duration) {
  if (!isoString) return '';
  const start = new Date(isoString);
  const end = duration ? new Date(start.getTime() + duration * 60000) : null;
  const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function buildIcsContent({ appointment }) {
  if (!appointment) return '';
  const start = new Date(appointment.datetime);
  const end = new Date(start.getTime() + (appointment.duration || 60) * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Avalon Vitality//BookingConfirmation//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Avalon Vitality IV Session`,
    `DESCRIPTION:Confirmation #${appointment.id} — ${appointment.type || 'Mobile IV Therapy'}`,
    `LOCATION:${appointment.location || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(appointment) {
  const content = buildIcsContent({ appointment });
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'avalon-session.ics';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Animated check ─────────────────────────────────────────── */
function AnimatedCheck() {
  return (
    <div className="flex items-center justify-center mb-8">
      <svg viewBox="0 0 80 80" className="w-20 h-20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.circle
          cx="40" cy="40" r="36"
          stroke="currentColor" strokeWidth="2"
          className="text-accent"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        />
        <motion.path
          d="M24 40 L35 51 L56 30"
          stroke="currentColor" strokeWidth="2.5"
          className="text-accent"
          strokeLinecap="round" strokeLinejoin="round" fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.75 }}
        />
      </svg>
    </div>
  );
}

/* ─── Booking detail pill ────────────────────────────────────── */
function DetailPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-foreground/[0.06] last:border-b-0">
      <Icon className="w-4 h-4 text-accent/60 mt-0.5 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0">
        <p className="font-body text-[9px] tracking-[0.28em] uppercase text-foreground/35 mb-0.5">{label}</p>
        <p className="font-body text-sm text-foreground leading-snug">{value}</p>
      </div>
    </div>
  );
}

/* ─── Prep card ──────────────────────────────────────────────── */
const PREP_CARDS = [
  {
    icon: Droplets,
    title: 'Hydrate beforehand',
    body: 'Drink 16 oz of water before your nurse arrives. Well-hydrated veins make the process faster and more comfortable.',
  },
  {
    icon: Shirt,
    title: 'Wear comfortable clothing',
    body: 'Loose sleeves or a short-sleeved top gives easy access to your arm. No tight cuffs.',
  },
  {
    icon: CreditCard,
    title: 'Have your ID ready',
    body: 'Your RN will verify your identity on arrival. A government-issued ID or passport works.',
  },
  {
    icon: Phone,
    title: 'Your clinician will text on arrival',
    body: 'You\'ll get a text with your nurse\'s name and ETA 30 minutes before they arrive. Keep your phone nearby.',
  },
  {
    icon: ShieldCheck,
    title: 'Update us if anything changes',
    body: 'If your symptoms, medications, or health status change before the visit, let us know and we\'ll adjust.',
  },
];

/* ─── Timeline ───────────────────────────────────────────────── */
const TIMELINE = [
  {
    number: '01',
    title: 'Deposit Paid',
    body: 'Your $50 deposit holds the appointment while the care team prepares the visit.',
  },
  {
    number: '02',
    title: 'Appointment Booked',
    body: 'The visit is sent to Acuity scheduling and your confirmation details stay available here.',
  },
  {
    number: '03',
    title: 'GFE Check',
    body: 'New clients are routed for GFE review. Existing approvals are checked before dispatch.',
  },
  {
    number: '04',
    title: 'RN Assignment',
    body: 'Open shifts are offered to the on-call RN team. Your assigned nurse is confirmed by text.',
  },
  {
    number: '05',
    title: 'Visit',
    body: 'Your RN arrives with supplies, completes the session, and closes the balance after care.',
  },
];

const GFE_VALID_TIMELINE = [
  {
    number: '01',
    title: 'Deposit Held',
    body: 'Your $50 deposit holds the appointment while the care team prepares the visit.',
  },
  {
    number: '02',
    title: 'Appointment Booked',
    body: 'The visit is sent to Acuity scheduling and your confirmation details stay available here.',
  },
  {
    number: '03',
    title: 'GFE Valid',
    body: 'Your annual GFE is current. No repeat GFE is needed for this visit.',
  },
  {
    number: '04',
    title: 'RN Assignment',
    body: 'Open shifts are offered to the on-call RN team. Your assigned nurse confirms ETA.',
  },
  {
    number: '05',
    title: 'Visit',
    body: 'Your RN arrives with supplies, completes the session, and closes the balance after care.',
  },
];

const FAST_HOLD_TIMELINE = [
  {
    number: '01',
    title: 'Hold Received',
    body: 'Your request is saved.',
  },
  {
    number: '02',
    title: 'Deposit',
    body: 'The $50 hold confirms the appointment.',
  },
  {
    number: '03',
    title: 'Clearance',
    body: 'Clinical review happens before service.',
  },
  {
    number: '04',
    title: 'Nurse',
    body: 'A licensed RN accepts and sets ETA.',
  },
  {
    number: '05',
    title: 'Visit',
    body: 'Avalon comes to you.',
  },
];

function TimelineStep({ step, index, isLast }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.8 + index * 0.12 }}
      className="flex gap-4"
    >
      <div className="flex flex-col items-center shrink-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/24 bg-accent/[0.08] font-body text-[10px] font-semibold tracking-[0.12em] text-accent">
          {step.number}
        </span>
        {!isLast && <div className="w-px flex-1 mt-3 bg-gradient-to-b from-accent/35 to-foreground/[0.06]" style={{ minHeight: '2rem' }} />}
      </div>
      <div className={`flex-1 min-w-0 pt-1 ${isLast ? '' : 'pb-8'}`}>
        <p className="font-heading text-xl text-foreground tracking-wide mb-1 uppercase">{step.title}</p>
        <p className="font-body text-sm text-foreground/60 leading-relaxed">{step.body}</p>
      </div>
    </motion.div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function BookingConfirmation() {
  const [params] = useSearchParams();
  const appointmentId = params.get('appointment');
  const [localBooking] = useState(() => readLastBooking());

  const [appt, setAppt] = useState(null);
  const [apptLoading, setApptLoading] = useState(!!appointmentId);
  const [apptError, setApptError] = useState(null);
  const [prep, setPrep] = useState(() => readVisitPrep());
  const isFastHold = localBooking?.holdType === 'fast' || localBooking?.source === 'Fast Hold';

  useSeo({
    title: 'Session Confirmed — Avalon Vitality',
    description: 'Your IV wellness session has been confirmed. A licensed RN will be in touch shortly.',
    path: '/booking/confirmation',
  });

  useEffect(() => {
    if (!appointmentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/scheduling-appointment?id=${encodeURIComponent(appointmentId)}`);
        const data = await res.json();
        if (!cancelled) {
          if (res.ok) setAppt(data);
          else setApptError(data.error || 'Could not load booking details');
        }
      } catch {
        if (!cancelled) setApptError('Could not load booking details');
      } finally {
        if (!cancelled) setApptLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appointmentId]);

  useEffect(() => {
    if (appt?.id) {
      const saved = saveLastBooking({
        ...(localBooking || {}),
        id: appt.id,
        service: appt.type || localBooking?.service || 'IV Therapy Session',
        datetime: appt.datetime,
        time: appt.datetime ? formatApptTime(appt.datetime, appt.duration) : localBooking?.time,
        address: appt.location || localBooking?.address,
        contact: localBooking?.contact,
        addOns: localBooking?.addOns || [],
        items: localBooking?.items || [],
        subtotal: appt.price ?? localBooking?.subtotal,
        status: localBooking?.status || 'Scheduling received',
        nextStep: localBooking?.manualReview ? 'Clinical review before RN assignment' : 'RN assignment and arrival text',
        gfe: localBooking?.gfe || 'Pending',
        nurse: localBooking?.nurse || 'Unassigned',
        payment: localBooking?.payment || 'Pending',
        source: localBooking?.source || 'Website',
        reference: localBooking?.reference || appt.id,
      });
      appendActivity(`Booking confirmed: ${saved.service}`, { role: 'client', bookingId: String(appt.id) });
    }
  }, [appt, localBooking]);

  useEffect(() => {
    const bookingId = appt?.id || localBooking?.id || appointmentId;
    if (!bookingId) return;
    track(ANALYTICS_EVENTS.BOOKING_CONFIRMED, {
      funnel: localBooking?.source === 'Fast Hold' ? 'fast_hold' : 'webstore',
      booking_id: String(bookingId),
      order_type: localBooking?.orderType || 'recovery',
      product_family: localBooking?.productFamily || 'protocol',
      gfe_required: localBooking?.gfeRequired ?? true,
      has_appointment: Boolean(appt?.datetime || localBooking?.datetime || localBooking?.date),
    });
  }, [appt?.id, appt?.datetime, localBooking, appointmentId]);

  // Scheduling self-service reschedule/cancel links
  const rescheduleUrl = appt?.confirmationPage || null;
  // The confirmation page URL has cancel/reschedule links built in

  const referenceSource = appt?.id || localBooking?.id;
  const referenceNum = referenceSource
    ? `AV-${String(referenceSource).slice(-6).toUpperCase()}`
    : appointmentId
      ? `AV-${String(appointmentId).slice(-6).toUpperCase()}`
      : null;

  const serviceLabel = appt?.type || localBooking?.service || 'IV Therapy Session';
  const apptDate = appt?.datetime ? formatApptDate(appt.datetime) : localBooking?.date || null;
  const apptTime = appt?.datetime ? formatApptTime(appt.datetime, appt.duration) : localBooking?.time || null;
  const apptAddress = appt?.location || localBooking?.address || null;
  const confirmationBooking = (localBooking || appt?.id) ? {
    ...(localBooking || {}),
    id: appt?.id || localBooking?.id,
    service: serviceLabel,
    datetime: appt?.datetime || localBooking?.datetime,
    date: localBooking?.date || apptDate,
    time: appt?.datetime ? apptTime : localBooking?.time,
    address: apptAddress || localBooking?.address,
    reference: localBooking?.reference || appt?.id,
    status: localBooking?.status || (appt?.id ? 'Scheduling received' : undefined),
  } : null;
  const truthLayer = buildConsumerTruthLayer({ booking: confirmationBooking });
  const hasValidAnnualGfe = localBooking && localBooking.gfeRequired === false;
  const timelineSteps = isFastHold ? FAST_HOLD_TIMELINE : hasValidAnnualGfe ? GFE_VALID_TIMELINE : TIMELINE;
  const togglePrep = (index) => {
    const next = prep.map((item, i) => i === index ? { ...item, done: !item.done } : item);
    setPrep(saveVisitPrep(next));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-lg mx-auto px-5 md:px-8 pt-24 pb-32 space-y-10">

        {/* ── 1. Hero ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center pt-4"
        >
          <AnimatedCheck />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
          >
            <h1 className="font-heading text-5xl md:text-6xl text-foreground uppercase tracking-tight leading-none mb-4">
              {isFastHold ? 'Hold Received.' : 'Confirmed.'}
            </h1>
            <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-sm mx-auto mb-6">
              {isFastHold
                ? 'Complete the deposit. Clinical clearance comes next. RN dispatch waits until approved.'
                : 'Your RN will text arrival details. Keep your phone nearby.'}
            </p>

            {/* Loading state */}
            {apptLoading && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-6 py-3.5">
                <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" strokeWidth={1.5} />
                <span className="font-body text-xs tracking-widest uppercase text-foreground/40">Loading your booking…</span>
              </div>
            )}

            {/* Real booking details */}
            {!apptLoading && (referenceNum || apptDate) && (
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-5 py-4 text-left space-y-0 mx-auto">
                {referenceNum && (
                  <DetailPill icon={Hash} label="Confirmation" value={referenceNum} />
                )}
                {serviceLabel && (
                  <DetailPill icon={Droplets} label="Service" value={serviceLabel} />
                )}
                {apptDate && apptTime && (
                  <DetailPill icon={Clock} label="Scheduled" value={`${apptDate} · ${apptTime}`} />
                )}
                {apptAddress && (
                  <DetailPill icon={MapPin} label="Location" value={apptAddress} />
                )}
                {localBooking?.addOns?.length > 0 && (
                  <DetailPill icon={ShieldCheck} label="Add-ons" value={localBooking.addOns.join(' · ')} />
                )}
                {localBooking?.subtotal != null && (
                  <DetailPill icon={CreditCard} label="Estimated Total" value={`$${Number(localBooking.subtotal).toLocaleString()}`} />
                )}
                {localBooking?.depositAmount != null && (
                  <DetailPill icon={CreditCard} label="Deposit" value={`$${Number(localBooking.depositAmount).toLocaleString()} ${isFastHold ? 'pending' : 'due'}`} />
                )}
              </div>
            )}

            {/* Fallback if no appointment data and no error */}
            {!apptLoading && !appt && !apptError && (
              <div className="inline-flex items-center gap-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-6 py-3">
                <p className="font-body text-sm text-foreground/60">
                  Your confirmation details will arrive by text shortly.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>

        {confirmationBooking && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.58 }}
          >
            <ClinicalClearancePanel booking={confirmationBooking} title="Dispatch Gate" />
          </motion.div>
        )}

        {/* ── 2. What to Expect ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.65 }}
          className="space-y-4"
        >
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 px-1">Status</p>
          <div className="rounded-[1.35rem] border border-foreground/[0.12] bg-background/72 px-5 pt-5 pb-4 shadow-[0_24px_90px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
            {timelineSteps.map((step, i) => (
              <TimelineStep key={step.number} step={step} index={i} isLast={i === timelineSteps.length - 1} />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.82 }}
        >
          <ConsumerTruthLayer
            truth={truthLayer}
            eyebrow="Real Visit OS"
            title="Visit Truth"
            intro="Avalon tracks the parts that matter: payment, clearance, nurse, route, text."
            compact
            limit={5}
            showGroups={false}
          />
        </motion.div>

        {/* ── 3. Before Your Visit — premium cards ────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.0 }}
          className="space-y-3"
        >
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 px-1">Before Your Visit</p>
          <div className="grid grid-cols-1 gap-2.5">
            {PREP_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 1.05 + i * 0.07 }}
                  className="flex items-start gap-4 rounded-2xl border border-foreground/[0.08] bg-background/80 backdrop-blur-xl px-4 py-4"
                >
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-foreground mb-1">{card.title}</p>
                    <p className="font-body text-xs text-foreground/55 leading-relaxed">{card.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-foreground/[0.08] bg-background/80 backdrop-blur-xl">
            {prep.map((item, index) => (
              <button
                type="button"
                key={item.key || item.label}
                onClick={() => togglePrep(index)}
                className="flex min-h-[54px] w-full items-center justify-between gap-3 border-t border-foreground/[0.06] px-4 text-left first:border-t-0"
              >
                <span className="font-body text-sm text-foreground/70">{item.label}</span>
                <ShieldCheck className={`h-4 w-4 ${item.done ? 'text-accent' : 'text-foreground/25'}`} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── 4. Nurse card (local fixture until staff assignment) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.15 }}
          className="space-y-3"
        >
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 px-1">Your Nurse</p>
          <div className="rounded-2xl border border-foreground/[0.08] bg-background/80 backdrop-blur-xl px-5 py-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full border border-accent/30 bg-accent/5 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-accent/60" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-body text-sm text-foreground font-medium">Assignment Pending</p>
                <p className="font-body text-[11px] text-foreground/50 leading-relaxed">
                  Licensed RN · California-certified
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-accent/10 bg-accent/5 px-4 py-2.5">
              <p className="font-body text-[10px] text-accent/70 leading-relaxed tracking-wide">
                Nurse name, photo, and license number sent by text 30 minutes before arrival.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── 5. Actions ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.28 }}
          className="space-y-3 pt-2"
        >
          {/* Complete deposit */}
          {isFastHold && (
            <Link
              to="/checkout"
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-foreground px-5 py-4 font-body text-xs font-semibold uppercase tracking-[0.18em] text-background shadow-[0_16px_50px_hsl(var(--foreground)/0.14)] transition-opacity hover:opacity-88"
            >
              Complete Deposit <CreditCard className="h-4 w-4" strokeWidth={2} />
            </Link>
          )}

          {/* Add to Calendar */}
          {appt?.datetime && (
            <button
              type="button"
              onClick={() => downloadIcs(appt)}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors px-5 py-3.5 group"
            >
              <CalendarPlus className="w-4 h-4 text-foreground/50 group-hover:text-accent transition-colors" strokeWidth={1.5} />
              <span className="font-body text-sm text-foreground/60 group-hover:text-foreground transition-colors tracking-wide">
                Add to Calendar
              </span>
            </button>
          )}

          {/* Reschedule / Cancel */}
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] px-5 py-4 space-y-2.5">
            <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/35">Need to change your appointment?</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {rescheduleUrl ? (
                <>
                  <a
                    href={rescheduleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-foreground/[0.12] py-3.5 font-body text-xs tracking-widest uppercase text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    Reschedule <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  </a>
                  <a
                    href={rescheduleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-foreground/[0.12] py-3.5 font-body text-xs tracking-widest uppercase text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    Cancel <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  </a>
                </>
              ) : (
                <a
                  href="sms:+14157070818"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-foreground/[0.12] py-3.5 font-body text-xs tracking-widest uppercase text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Text Us to Reschedule
                </a>
              )}
            </div>
            <p className="font-body text-[9px] text-foreground/30 leading-relaxed">
              Changes requested less than 24 hours before your appointment may incur a rescheduling fee.
            </p>
          </div>

          {/* Back home */}
          <Link
            to="/"
            className="flex items-center gap-1.5 min-h-[44px] font-body text-xs tracking-[0.18em] uppercase text-foreground/40 hover:text-foreground transition-colors justify-center pt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Back to Avalon
          </Link>
        </motion.div>

      </div>
      <Footer />
    </div>
  );
}
