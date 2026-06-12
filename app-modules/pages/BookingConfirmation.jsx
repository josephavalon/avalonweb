import React, { useState, useEffect, useCallback } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus,
  Droplets, Clock, MapPin, Hash, Loader2,
  CreditCard, Phone,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';
import { readLastBooking, saveLastBooking, appendActivity } from '@/lib/localOs';
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

function currentLocationCoordinates(value = '') {
  const match = String(value).match(/current location\s*[·-]\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return { lat: match[1], lng: match[2] };
}

function escapeIcsText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatIcsDateTime(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildIcsContent({ appointment }) {
  if (!appointment) return '';
  const start = new Date(appointment.datetime);
  if (Number.isNaN(start.getTime())) return '';
  const end = new Date(start.getTime() + (appointment.duration || 60) * 60000);
  const allDay = Boolean(appointment.allDay);
  const summary = appointment.summary || 'Avalon Vitality IV Session';
  const description = [
    `Confirmation #${appointment.id}`,
    appointment.type || 'Mobile IV Therapy',
    appointment.timePending ? 'Exact visit time is still being confirmed by Avalon.' : null,
  ].filter(Boolean).join(' — ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//Avalon Vitality//BookingConfirmation//EN',
    'BEGIN:VEVENT',
    `UID:avalon-${escapeIcsText(appointment.id || Date.now())}@avalonvitality.co`,
    `DTSTAMP:${formatIcsDateTime(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${formatIcsDate(start)}` : `DTSTART:${formatIcsDateTime(start)}`,
    allDay ? `DTEND;VALUE=DATE:${formatIcsDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1))}` : `DTEND:${formatIcsDateTime(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(appointment.location || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function calendarDateRange(appointment) {
  const start = new Date(appointment.datetime);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (appointment.duration || 60) * 60000);
  if (appointment.allDay) {
    return {
      google: `${formatIcsDate(start)}/${formatIcsDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1))}`,
    };
  }
  return {
    google: `${formatIcsDateTime(start)}/${formatIcsDateTime(end)}`,
  };
}

function calendarDescription(appointment) {
  return [
    `Confirmation #${appointment.id}`,
    appointment.type || 'Mobile IV Therapy',
    appointment.timePending ? 'Exact visit time is still being confirmed by Avalon.' : null,
  ].filter(Boolean).join(' - ');
}

function googleCalendarUrl(appointment) {
  const range = calendarDateRange(appointment);
  if (!range) return '';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: appointment.summary || 'Avalon Vitality IV Session',
    dates: range.google,
    details: calendarDescription(appointment),
    location: appointment.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

async function openCalendar(appointment, onError) {
  const target = googleCalendarUrl(appointment);
  if (target) {
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }

  const content = buildIcsContent({ appointment });
  if (!content) {
    onError?.('Calendar details are still being prepared.');
    return;
  }

  const fileName = `avalon-${String(appointment.id || 'session').replace(/[^a-z0-9-]+/gi, '-')}.ics`;
  const file = new File([content], fileName, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        title: appointment.summary || 'Avalon Vitality IV Session',
        text: calendarDescription(appointment),
        files: [file],
      });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  onError?.('Calendar could not be opened.');
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
    <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.035] p-3 text-left">
      <Icon className="h-4 w-4 text-accent/70" strokeWidth={1.7} />
      <p className="mt-3 break-words font-body text-sm font-black leading-tight text-foreground">{value}</p>
      <p className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/38">{label}</p>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function BookingConfirmation() {
  const [params] = useSearchParams();
  const initialAppointmentId = params.get('appointment');
  const sessionId = params.get('session_id');
  const paymentSuccess = params.get('payment') === 'success' || Boolean(sessionId);
  const [localBooking] = useState(() => readLastBooking());
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId);

  const [appt, setAppt] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(Boolean(sessionId && !initialAppointmentId));
  const [appointmentLoading, setAppointmentLoading] = useState(Boolean(initialAppointmentId));
  const [apptError, setApptError] = useState(null);
  const [fulfillmentPending, setFulfillmentPending] = useState(Boolean(sessionId && !initialAppointmentId));
  const [verification, setVerification] = useState(null);
  const [summaryToken, setSummaryToken] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const apptLoading = !paymentSuccess && (verifyLoading || appointmentLoading);

  useSeo({
    title: 'Session Confirmed — Avalon Vitality',
    description: 'Your IV wellness session has been confirmed. A licensed registered nurse will be in touch shortly.',
    path: '/booking/confirmation',
  });

  const retryAppointmentConfirmation = useCallback(async () => {
    if (!sessionId) return null;
    setVerifyLoading(true);
    setApptError(null);
    try {
      const res = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      setVerification(data);
      if (data.summaryToken) setSummaryToken(data.summaryToken);
      if (res.ok && data.paid) {
        if (data.appointmentId) {
          setAppointmentId(String(data.appointmentId));
          setFulfillmentPending(false);
          return data;
        }
        const failed = data.fulfillmentStatus === 'acuity_failed';
        setFulfillmentPending(Boolean(data.pendingFulfillment) && !failed);
        if (failed) {
          setApptError('Payment received. A nurse will confirm your appointment shortly.');
          track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
            funnel: localBooking?.source === 'Fast Hold' ? 'fast_hold' : 'webstore',
            reason: 'acuity_fulfillment_failed',
            provider: 'acuity',
            has_session: true,
          });
        }
        return data;
      }
      setApptError(data.error || 'Could not verify payment.');
      return data;
    } catch {
      setApptError('Could not verify payment.');
      return null;
    } finally {
      setVerifyLoading(false);
    }
  }, [localBooking?.source, sessionId]);

  useEffect(() => {
    if (!sessionId || initialAppointmentId) return;
    let cancelled = false;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      setVerifyLoading(true);
      setFulfillmentPending(true);
      for (let attempt = 0; attempt < 10 && !cancelled; attempt += 1) {
        try {
          const res = await fetch('/api/checkout/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          });
          const data = await res.json();
          if (!cancelled && res.ok && data.paid) {
            setVerification(data);
            if (data.summaryToken) setSummaryToken(data.summaryToken);
            if (data.appointmentId) {
              setAppointmentId(String(data.appointmentId));
              setFulfillmentPending(false);
              return;
            }
            const failed = data.fulfillmentStatus === 'acuity_failed';
            setFulfillmentPending(Boolean(data.pendingFulfillment) && !failed);
            if (failed) {
              setApptError('Payment received. A nurse will confirm your appointment shortly.');
              track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
                funnel: localBooking?.source === 'Fast Hold' ? 'fast_hold' : 'webstore',
                reason: 'acuity_fulfillment_failed',
                provider: 'acuity',
                has_session: true,
              });
              return;
            }
          } else if (!cancelled && !res.ok && attempt === 9) {
            setApptError(data.error || 'Could not verify payment');
          }
        } catch {
          if (!cancelled && attempt === 9) setApptError('Could not verify payment');
        }
        await wait(1200);
      }
    })().finally(() => {
      if (!cancelled) setVerifyLoading(false);
    });

    return () => { cancelled = true; };
  }, [localBooking?.source, sessionId, initialAppointmentId]);

  useEffect(() => {
    if (!appointmentId && !sessionId) return;
    if (sessionId && !summaryToken) return;
    let cancelled = false;
    (async () => {
      setAppointmentLoading(true);
      try {
        const query = new URLSearchParams();
        if (sessionId) {
          query.set('session_id', sessionId);
          query.set('summary_token', summaryToken);
        } else {
          query.set('appointment', appointmentId);
        }
        const res = await fetch(`/api/appointment-summary?${query}`);
        const data = await res.json();
        if (!cancelled) {
          if (res.ok) setAppt(data);
          else setApptError(data.error || 'Could not load booking details');
        }
      } catch {
        if (!cancelled) setApptError('Could not load booking details');
      } finally {
        if (!cancelled) setAppointmentLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appointmentId, sessionId, summaryToken]);

  useEffect(() => {
    const coords = currentLocationCoordinates(localBooking?.address);
    if (!coords) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(coords);
        const res = await fetch(`/api/reverse-geocode?${params}`);
        const data = await res.json();
        if (!cancelled && res.ok && data?.address) setResolvedAddress(data.address);
      } catch {
        // Keep the confirmation clean; do not show raw coordinates.
      }
    })();
    return () => { cancelled = true; };
  }, [localBooking?.address]);

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
        nextStep: localBooking?.manualReview ? 'Clinical review before registered nurse assignment' : 'registered nurse assignment and arrival text',
        gfe: localBooking?.gfe || 'Pending',
        nurse: localBooking?.nurse || 'Unassigned',
        payment: paymentSuccess ? 'Payment received' : localBooking?.payment || 'Pending',
        source: localBooking?.source || 'Website',
        reference: localBooking?.reference || appt.id,
      });
      appendActivity(`Booking confirmed: ${saved.service}`, { role: 'client', bookingId: String(appt.id) });
    }
  }, [appt, localBooking, paymentSuccess]);

  useEffect(() => {
    const bookingId = appt?.id || appointmentId || verification?.appointmentId;
    if (!bookingId) return;
    track(ANALYTICS_EVENTS.BOOKING_CONFIRMED, {
      funnel: localBooking?.source === 'Fast Hold' ? 'fast_hold' : 'webstore',
      booking_id: String(bookingId),
      order_type: localBooking?.orderType || 'recovery',
      product_family: localBooking?.productFamily || 'protocol',
      gfe_required: localBooking?.gfeRequired ?? true,
      has_appointment: Boolean(appt?.datetime || localBooking?.datetime || localBooking?.date),
    });
  }, [appt?.id, appt?.datetime, localBooking, appointmentId, verification?.appointmentId]);

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
  const rawLocalAddress = localBooking?.address || '';
  const localAddressIsCoordinates = Boolean(currentLocationCoordinates(rawLocalAddress));
  const apptAddress = appt?.location || resolvedAddress || (localAddressIsCoordinates ? null : rawLocalAddress) || null;
  const localTimeIsPending = /asap|soonest|today/i.test(String(localBooking?.time || localBooking?.timeIntent || ''));
  const calendarAppointment = appt?.datetime
    ? {
        ...appt,
        summary: 'Avalon Vitality IV Session',
      }
    : localBooking?.datetime
      ? {
          id: localBooking.id,
          datetime: localBooking.datetime,
          duration: localBooking.duration || 60,
          type: localBooking.service,
          location: apptAddress || localBooking.address,
          allDay: localTimeIsPending,
          timePending: localTimeIsPending,
          summary: localTimeIsPending ? 'Avalon Vitality Session - time pending' : 'Avalon Vitality IV Session',
        }
      : null;
  const titleText = paymentSuccess
    ? 'Thank you'
    : 'Request Received.';
  const acuityNeedsOps = paymentSuccess && verification?.fulfillmentStatus === 'acuity_failed';
  const statusText = acuityNeedsOps
    ? 'Payment received. A nurse will confirm shortly.'
    : fulfillmentPending
      ? 'Payment received. Confirming your appointment.'
      : paymentSuccess
        ? 'A nurse will text shortly.'
        : 'Review comes next.';
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-lg mx-auto px-5 md:px-8 pt-24 pb-24 space-y-5">

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
            <h1 className="font-heading text-5xl md:text-6xl text-foreground uppercase tracking-tight leading-none mb-3">
              {titleText}
            </h1>
            <p className="font-body text-base font-semibold text-foreground/68 leading-snug max-w-sm mx-auto mb-5">
              {statusText}
            </p>

            {/* Loading state */}
            {apptLoading && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-6 py-3.5">
                <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" strokeWidth={1.5} />
                <span className="font-body text-xs tracking-widest uppercase text-foreground/40">
                  {paymentSuccess ? 'Confirming your appointment...' : 'Loading your booking...'}
                </span>
              </div>
            )}

            {/* Real booking details */}
            {(referenceNum || apptDate) && (
              <div className="mx-auto grid grid-cols-2 gap-2 rounded-[1.5rem] border border-foreground/[0.08] bg-foreground/[0.03] p-2 backdrop-blur-xl">
                {serviceLabel && (
                  <DetailPill icon={Droplets} label="Service" value={serviceLabel} />
                )}
                {apptDate && apptTime && (
                  <DetailPill icon={Clock} label="When" value={`${apptDate} · ${apptTime}`} />
                )}
                {apptAddress && (
                  <DetailPill icon={MapPin} label="Where" value={apptAddress} />
                )}
                {localBooking?.depositAmount != null && (
                  <DetailPill icon={CreditCard} label="Today" value={`$${Number(localBooking.depositAmount).toLocaleString()} ${paymentSuccess ? 'paid' : 'due'}`} />
                )}
                {referenceNum && (
                  <DetailPill icon={Hash} label="ID" value={referenceNum} />
                )}
              </div>
            )}

            {paymentSuccess && (
              <div className="mt-3 rounded-[1.25rem] border border-foreground/[0.08] bg-foreground/[0.03] px-4 py-3 text-left backdrop-blur-xl">
                <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/38">Next</p>
                <p className="mt-1 font-body text-sm font-semibold leading-snug text-foreground/72">
                  Clinical review, registered nurse assignment, arrival text.
                </p>
              </div>
            )}

            {apptError && (
              <p className="mt-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.035] px-4 py-3 text-center font-body text-xs font-semibold leading-snug text-foreground/58">
                {apptError}
              </p>
            )}

            {/* Fallback if no appointment data and no error */}
            {!apptLoading && !appt && !apptError && !referenceNum && !localBooking && (
              <div className="inline-grid grid-cols-2 gap-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-2">
                <DetailPill icon={Phone} label="Nurse" value="Text" />
                <DetailPill icon={Clock} label="Timing" value="Soon" />
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* ── 3. Actions ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.72 }}
          className="space-y-3 pt-2"
        >
          {/* Open Calendar */}
          {calendarAppointment && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCalendarError('');
                  openCalendar(calendarAppointment, setCalendarError);
                }}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors px-5 py-3.5 group"
              >
                <CalendarPlus className="w-4 h-4 text-foreground/50 group-hover:text-accent transition-colors" strokeWidth={1.5} />
                <span className="font-body text-sm text-foreground/60 group-hover:text-foreground transition-colors tracking-wide">
                  Calendar
                </span>
              </button>
              {calendarError && (
                <p className="text-center font-body text-xs text-foreground/45">
                  {calendarError}
                </p>
              )}
            </>
          )}

          {paymentSuccess && sessionId && (fulfillmentPending || acuityNeedsOps || apptError) && (
            <button
              type="button"
              onClick={retryAppointmentConfirmation}
              disabled={verifyLoading}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-foreground/[0.16] bg-foreground/[0.055] px-5 font-body text-xs font-bold uppercase tracking-[0.14em] text-foreground/72 transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-wait disabled:opacity-60"
            >
              {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <CreditCard className="h-4 w-4" strokeWidth={1.8} />}
              Retry Confirmation
            </button>
          )}

          <a
            href={rescheduleUrl || 'sms:+14157070818'}
            target={rescheduleUrl ? '_blank' : undefined}
            rel={rescheduleUrl ? 'noopener noreferrer' : undefined}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] px-5 font-body text-xs font-bold uppercase tracking-[0.14em] text-foreground/64 transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <Phone className="h-4 w-4" strokeWidth={1.8} />
            Change
          </a>

          {/* Back home */}
          <Link
            to="/"
            className="flex items-center gap-1.5 min-h-[44px] font-body text-xs tracking-[0.18em] uppercase text-foreground/40 hover:text-foreground transition-colors justify-center pt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Home
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
