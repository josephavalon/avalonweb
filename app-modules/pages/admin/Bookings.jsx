/**
 * Admin Booking Intake — /admin/bookings
 *
 * Pulls recent scheduling appointments and displays them in a live table.
 * No database required — reads directly from the scheduling API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import {
  RefreshCw, Calendar, Clock, MapPin, Phone, Mail, Hash, AlertCircle,
  ChevronDown, ExternalLink,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import QuickPatientAdd from '@/components/ops/QuickPatientAdd';
import { patientToAppointmentPreview } from '@/lib/clientIntakeStore';

const EASE = [0.16, 1, 0.3, 1];
const TZ = 'America/Los_Angeles';

const fallbackDate = (days, hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const LOCAL_PREVIEW_APPOINTMENTS = [
  {
    id: 'local-101',
    firstName: 'Avery',
    lastName: 'Stone',
    type: 'Recovery IV',
    datetime: fallbackDate(0, 14, 30),
    duration: 60,
    location: 'San Francisco · Hotel visit',
    email: 'client.preview@avalon.local',
    phone: '(415) 555-0101',
    price: 250,
    notes: 'Local preview appointment. Replace with scheduling API when live.',
  },
  {
    id: 'local-102',
    firstName: 'Maya',
    lastName: 'Patel',
    type: 'Hydration IV',
    datetime: fallbackDate(1, 10, 0),
    duration: 45,
    location: 'Marin · Home visit',
    email: 'client.two@avalon.local',
    phone: '(415) 555-0102',
    price: 150,
  },
  {
    id: 'local-103',
    firstName: 'Jordan',
    lastName: 'Reed',
    type: 'Launch / Group',
    datetime: fallbackDate(2, 16, 0),
    duration: 120,
    location: 'Oakland · Office',
    email: 'events@avalon.local',
    phone: '(415) 555-0103',
    price: 900,
  },
];

/* ─── Helpers ─────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ,
  });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  });
}

function statusBadge(appt) {
  if (appt.canceled) return { label: 'Canceled', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  const apptDate = new Date(appt.datetime);
  const now = new Date();
  if (apptDate < now) return { label: 'Completed', cls: 'bg-foreground/10 text-foreground/50 border-foreground/15' };
  const hoursOut = (apptDate - now) / 3600000;
  if (hoursOut < 2) return { label: 'Imminent', cls: 'bg-accent/15 text-accent border-accent/25' };
  return { label: 'Upcoming', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
}

/* ─── Appointment row ─────────────────────────────────────────── */
function ApptRow({ appt, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const badge = statusBadge(appt);
  const isTest = appt.notes?.includes('[TEST BOOKING') || appt.notes?.includes('[TEST]');

  return (
    <div className={`rounded-2xl border bg-card/50 overflow-hidden transition-colors ${
      isTest ? 'border-yellow-500/25' : 'border-foreground/[0.08]'
    }`}>
      {/* Row header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-foreground/[0.02] transition-colors"
      >
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          appt.canceled ? 'bg-red-400' :
          new Date(appt.datetime) < new Date() ? 'bg-foreground/25' :
          'bg-emerald-400'
        }`} />

        {/* Main info */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-0.5 sm:gap-4">
          <div className="min-w-0">
            <p className="font-body text-sm font-semibold text-foreground truncate">
              {appt.firstName} {appt.lastName}
              {isTest && <span className="ml-2 font-body text-[9px] tracking-widest uppercase text-yellow-500/80 border border-yellow-500/30 rounded px-1 py-0.5">TEST</span>}
            </p>
            <p className="font-body text-[10px] text-foreground/45 truncate">{appt.type || 'IV Therapy'}</p>
          </div>
          <div className="hidden sm:block">
            <p className="font-body text-xs text-foreground/70">{fmtDate(appt.datetime)}</p>
            <p className="font-body text-[10px] text-foreground/40">{fmtTime(appt.datetime)}</p>
          </div>
          <div className="hidden sm:block">
            <span className={`inline-flex font-body text-[9px] tracking-[0.15em] uppercase px-2 py-1 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
        </div>

        {/* Confirmation # */}
        <span className="font-body text-[10px] text-foreground/30 shrink-0 hidden md:block">#{appt.id}</span>

        <ChevronDown
          className={`w-4 h-4 text-foreground/30 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.8}
        />
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-foreground/[0.06] px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Contact */}
              <div className="space-y-2">
                <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/35 mb-3">Contact</p>
                {appt.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
                    <a href={`mailto:${appt.email}`} className="font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                      {appt.email}
                    </a>
                  </div>
                )}
                {appt.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
                    <a href={`tel:${appt.phone}`} className="font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                      {appt.phone}
                    </a>
                  </div>
                )}
              </div>

              {/* Appointment details */}
              <div className="space-y-2">
                <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/35 mb-3">Appointment</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
                  <span className="font-body text-xs text-foreground/70">{fmtDate(appt.datetime)} at {fmtTime(appt.datetime)}</span>
                </div>
                {appt.duration && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
                    <span className="font-body text-xs text-foreground/70">{appt.duration} min</span>
                  </div>
                )}
                {appt.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
                    <span className="font-body text-xs text-foreground/70">{appt.location}</span>
                  </div>
                )}
                {appt.price != null && (
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-foreground/30" strokeWidth={1.5} />
                    <span className="font-body text-xs text-foreground/70">${appt.price} · Conf #{appt.id}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {appt.notes && (
                <div className="sm:col-span-2">
                  <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/35 mb-2">Appointment Notes</p>
                  <pre className={`font-body text-xs leading-relaxed whitespace-pre-wrap rounded-xl border px-3 py-3 ${
                    isTest
                      ? 'border-yellow-500/20 bg-yellow-500/[0.04] text-yellow-400/70'
                      : 'border-foreground/[0.06] bg-foreground/[0.03] text-foreground/55'
                  }`}>
                    {appt.notes}
                  </pre>
                </div>
              )}

              {/* Scheduling link */}
              {appt.confirmationPage && (
                <div className="sm:col-span-2">
                  <a
                    href={appt.confirmationPage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-body text-[10px] tracking-widest uppercase text-foreground/40 hover:text-foreground transition-colors"
                  >
                    Open appointment <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function AdminBookings() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'all'

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ max: '100', direction: 'asc' });
      const res = await fetch(`/api/scheduling-appointments?${params}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setAppointments(LOCAL_PREVIEW_APPOINTMENTS);
        setLastRefreshed(new Date());
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load appointments');
      setAppointments(Array.isArray(data) ? data : []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = appointments.filter((a) => {
    if (filter === 'upcoming') return !a.canceled && new Date(a.datetime) >= new Date();
    return true;
  });

  const upcomingCount = appointments.filter((a) => !a.canceled && new Date(a.datetime) >= new Date()).length;
  const handleQuickPatient = (patient) => {
    setAppointments((current) => [patientToAppointmentPreview(patient), ...current]);
    setFilter('all');
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6">

        {/* Summary bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/36">Admin</p>
            <h1 className="mt-2 font-heading text-4xl uppercase leading-none tracking-wide text-foreground md:text-5xl">Visits</h1>
            {!loading && (
              <p className="font-body text-xs text-foreground/40 mt-1">
                {upcomingCount} upcoming · {appointments.length} total loaded
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {lastRefreshed && (
              <span className="hidden font-body text-[9px] text-foreground/30 sm:block">
                Updated {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <QuickPatientAdd
                context="admin"
                source="Admin visits"
                triggerLabel="Add Client"
                triggerClassName="flex min-h-10 items-center gap-1.5 rounded-full bg-foreground px-3 font-body text-[10px] font-bold uppercase tracking-widest text-background transition-transform active:scale-[0.98]"
                onCreated={handleQuickPatient}
              />
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="flex min-h-10 items-center gap-1.5 rounded-full border border-foreground/[0.10] bg-foreground/[0.045] px-3 font-body text-[10px] uppercase tracking-widest text-foreground/56 transition-colors hover:text-foreground disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex w-full gap-1 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-1 sm:w-fit">
          {['upcoming', 'all'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
              className={`min-h-10 flex-1 rounded-xl px-4 font-body text-[10px] uppercase tracking-widest transition-all sm:flex-none ${
                  filter === f
                    ? 'bg-foreground text-background'
                    : 'text-foreground/50 hover:text-foreground'
                }`}
              >
                {f}
              </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl border border-foreground/[0.06] bg-card/30 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-5 py-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="font-body text-sm text-red-400 mb-1">Could not load appointments</p>
              <p className="font-body text-xs text-red-400/60 mb-3">{error}</p>
              <button
                type="button"
                onClick={load}
                className="font-body text-[10px] tracking-widest uppercase text-foreground/50 hover:text-foreground transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && displayed.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-8 h-8 text-foreground/20 mx-auto mb-4" strokeWidth={1.2} />
            <p className="font-body text-sm text-foreground/40">
              {filter === 'upcoming' ? 'No upcoming bookings' : 'No appointments found'}
            </p>
          </div>
        )}

        {/* Appointment list */}
        {!loading && displayed.length > 0 && (
          <div className="space-y-2">
            {displayed.map((appt) => (
              <ApptRow key={appt.id} appt={appt} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
