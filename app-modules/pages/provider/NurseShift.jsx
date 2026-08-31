import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, FileText, House, LocateFixed, LogOut, MapPin, Navigation, RefreshCw, Route, X } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import NurseRouteMap from '@/components/provider/NurseRouteMap';
import AddressAutocomplete from '@/components/store/AddressAutocomplete';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { hasSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { buildFixedAppointmentRoute, formatMinutesUntil, haversineMeters, previewRoadLeg, ROUTE_OMISSION_REASONS } from '@/lib/nurseRoute';
import { DEMO_ASSIGNED_APPOINTMENTS, DEMO_ROUTE_ORIGINS } from '@/data/nurseRouteDemo';

const INK = '#090909';
const PAPER = '#f4f4f2';
const LINE = '#d4d4d0';
const SOFT = '#e9e9e6';
const MUTED = '#6d6d69';
const ROUTE_UI_ENABLED = import.meta.env.DEV || /^(1|true|yes)$/i.test(String(import.meta.env.VITE_NURSE_ROUTE_ENABLED || ''));
const BAY_AREA_ADDRESS_SUGGESTIONS = Object.freeze([
  { street: '24327 Alves St', city: 'Hayward', state: 'CA', zip: '94544', label: '24327 Alves St, Hayward, CA 94544', latitude: 37.6556, longitude: -122.0826 },
  { street: '1 Ferry Building', city: 'San Francisco', state: 'CA', zip: '94111', label: '1 Ferry Building, San Francisco, CA 94111', latitude: 37.7955, longitude: -122.3937 },
  { street: '1 Market St', city: 'San Francisco', state: 'CA', zip: '94105', label: '1 Market St, San Francisco, CA 94105', latitude: 37.7936, longitude: -122.3948 },
  { street: '1900 Broadway', city: 'Oakland', state: 'CA', zip: '94612', label: '1900 Broadway, Oakland, CA 94612', latitude: 37.8077, longitude: -122.2697 },
  { street: '60 E 3rd Ave', city: 'San Mateo', state: 'CA', zip: '94401', label: '60 E 3rd Ave, San Mateo, CA 94401', latitude: 37.5633, longitude: -122.3239 },
  { street: '3000 El Camino Real', city: 'Palo Alto', state: 'CA', zip: '94306', label: '3000 El Camino Real, Palo Alto, CA 94306', latitude: 37.4217, longitude: -122.1419 },
]);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const time = (value) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(new Date(value));
const dayLabel = (value) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }).format(new Date(`${value}T12:00:00-07:00`));
const miles = (meters) => `${(Number(meters || 0) / 1609.344).toFixed(1)} mi`;
const maneuverDistance = (meters) => Number(meters || 0) < 805 ? `${Math.max(50, Math.round(Number(meters || 0) * 3.28084 / 50) * 50)} ft` : miles(meters);

function StatusPill({ children }) {
  return <span className="inline-flex items-center rounded-full border border-black/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em]">{children}</span>;
}

function OriginOption({ selected, icon: Icon, label, detail, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="flex min-h-[76px] w-full items-center gap-4 rounded-[22px] border px-4 text-left transition active:scale-[0.99]" style={{ borderColor: selected ? INK : LINE, background: selected ? INK : '#fff', color: selected ? '#fff' : INK }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border" style={{ borderColor: selected ? '#555' : LINE }}><Icon className="h-4 w-4" strokeWidth={1.7} /></span>
      <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block truncate text-xs opacity-60">{detail}</span></span>
      {selected && <Check className="ml-auto h-4 w-4" />}
    </button>
  );
}

function AppointmentCard({ stop, onToggle, onOmission }) {
  const omitted = stop.eligible && !stop.selected;
  return (
    <article className="rounded-[24px] border p-4" style={{ background: '#fff', borderColor: stop.selected ? INK : LINE, opacity: stop.eligible ? 1 : 0.58 }}>
      <div className="flex gap-4">
        <button type="button" disabled={!stop.eligible} onClick={() => onToggle(stop.appointmentId)} className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border disabled:cursor-not-allowed" style={{ background: stop.selected ? INK : '#fff', borderColor: stop.eligible ? INK : LINE }} aria-label={`${stop.selected ? 'Omit' : 'Include'} ${stop.clientDisplayName}`}>
          {stop.selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">{time(stop.scheduledAt)} · {stop.durationMinutes} min{stop.durationAssumed ? '*' : ''}</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">{stop.clientDisplayName}</h3></div>
            <StatusPill>{stop.eligible ? (stop.selected ? 'Included' : 'Omitted') : stop.blocker || 'Blocked'}</StatusPill>
          </div>
          <p className="mt-2 text-sm text-black/60">{stop.service}</p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-black/45"><MapPin className="h-3 w-3" />{stop.neighborhood}</p>
        </div>
      </div>
      {omitted && (
        <div className="mt-4 border-t border-black/10 pt-4">
          <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/45">Omission reason</label>
          <select value={stop.omissionReason || ''} onChange={(event) => onOmission(stop.appointmentId, { reason: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-black/20 bg-white px-3 text-sm">
            <option value="">Choose a reason</option>
            {ROUTE_OMISSION_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
          </select>
          {stop.omissionReason === 'other' && <input value={stop.omissionNote || ''} onChange={(event) => onOmission(stop.appointmentId, { note: event.target.value })} placeholder="Required note" className="mt-2 min-h-11 w-full rounded-xl border border-black/20 px-3 text-sm" />}
        </div>
      )}
    </article>
  );
}

function DayOverview({ plan, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/50" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Day overview" onMouseDown={(event) => event.stopPropagation()} className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[32px] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4" style={{ background: '#fff', color: '#000' }}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-black/20" />
        <div className="mx-auto max-w-[620px]">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Fixed schedule</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Day Overview</h2></div><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-black/15" aria-label="Close overview"><X className="h-4 w-4" /></button></div>
          <div className="mt-6 space-y-0">
            {(plan?.stops || []).map((stop, index) => {
              const leg = plan.legs[index];
              return <div key={stop.appointmentId} className="grid grid-cols-[42px_1fr] gap-3"><div className="flex flex-col items-center"><span className="grid h-8 w-8 place-items-center rounded-full border border-black bg-black text-[10px] font-bold text-white">{index + 1}</span>{index < plan.stops.length - 1 && <span className="min-h-16 w-px flex-1 bg-black/20" />}</div><div className="pb-6"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{time(stop.scheduledAt)} · {stop.clientDisplayName}</strong><StatusPill>{leg?.feasibility?.replace('_', ' ') || 'Pending'}</StatusPill></div><p className="mt-1 text-xs text-black/50">{stop.neighborhood} · {stop.durationMinutes} min</p>{leg && <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Leave {time(leg.requiredDepartureAt)} · {miles(leg.distanceMeters)}</p>}</div></div>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function RouteTimeline({ plan, activeIndex }) {
  return (
    <section className="border-y border-white/15 py-5" aria-label="Today’s stops">
      {(plan.stops || []).slice(0, 4).map((stop, index) => {
        const leg = plan.legs[index];
        const active = index === activeIndex;
        return (
          <div key={stop.appointmentId} className="grid grid-cols-[42px_62px_1fr] gap-3">
            <div className="flex flex-col items-center"><span className="grid h-9 w-9 place-items-center rounded-full border text-xs font-bold" style={{ background: active ? '#fff' : '#080808', borderColor: active ? '#fff' : '#555', color: active ? '#080808' : '#777' }}>{index + 1}</span>{index < Math.min(plan.stops.length, 4) - 1 && <span className="h-14 w-px bg-white/20" />}</div>
            <div className="pt-1"><strong className="block font-heading text-2xl uppercase tracking-[0.02em]">{time(stop.scheduledAt)}</strong></div>
            <div className="min-w-0 border-b border-white/10 pb-5 pt-1"><strong className="block truncate font-heading text-xl uppercase tracking-[0.08em]">{stop.clientDisplayName}</strong><span className="mt-1 block truncate text-[10px] uppercase tracking-[0.15em] text-white/45">{stop.neighborhood}</span><span className="mt-2 inline-flex rounded border border-white/25 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-white/60">{leg?.feasibility?.replace('_', ' ') || 'Pending'}</span></div>
          </div>
        );
      })}
    </section>
  );
}

function TurnByTurn({ leg, activeIndex }) {
  const steps = leg?.steps || [];
  const current = steps[Math.min(activeIndex, Math.max(0, steps.length - 1))];
  const trafficLive = leg?.provider === 'mapbox';
  return (
    <section className="border-y border-white/15 py-5" aria-label="Turn-by-turn directions">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">Next maneuver</p>
        <span className="rounded-full border border-white/25 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-white/65">{trafficLive ? `Live · ${leg.trafficLevel || 'current'} traffic` : 'Road route · no live traffic'}</span>
      </div>
      {current ? (
        <>
          <div className="mt-4 grid grid-cols-[46px_1fr] gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-white/25"><Navigation className="h-5 w-5" strokeWidth={1.8} /></span>
            <div><h2 className="text-2xl font-semibold leading-tight tracking-[-0.035em]">{current.instruction}</h2><p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-white/45">{maneuverDistance(current.distanceMeters)} · {Math.max(1, Math.round(current.durationSeconds / 60))} min</p></div>
          </div>
          {steps.length > activeIndex + 1 && <ol className="mt-5 border-t border-white/10 pt-2">{steps.slice(activeIndex + 1, activeIndex + 4).map((step, offset) => <li key={`${step.instruction}-${offset}`} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-white/10 py-3 text-xs"><span className="grid h-6 w-6 place-items-center rounded-full border border-white/20 text-[9px] font-bold">{activeIndex + offset + 2}</span><span className="truncate text-white/75">{step.instruction}</span><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">{maneuverDistance(step.distanceMeters)}</span></li>)}</ol>}
        </>
      ) : <p className="mt-4 text-sm leading-6 text-white/60">Road maneuvers are unavailable. Use Apple Maps for turn-by-turn navigation; the appointment schedule remains fixed.</p>}
    </section>
  );
}

export default function NurseShift() {
  useSeo({ title: 'Nurse Route — Avalon Vitality', description: 'Build and run a fixed-appointment Bay Area nurse route.', path: '/provider/shift', robots: 'noindex, nofollow' });
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [date, setDate] = useState(today());
  const [appointments, setAppointments] = useState(DEMO_ASSIGNED_APPOINTMENTS);
  const [origins, setOrigins] = useState(DEMO_ROUTE_ORIGINS);
  const [origin, setOrigin] = useState(DEMO_ROUTE_ORIGINS[0]);
  const [manualAddress, setManualAddress] = useState('');
  const [saveAsHome, setSaveAsHome] = useState(false);
  const [plan, setPlan] = useState(null);
  const [mission, setMission] = useState(false);
  const [overview, setOverview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationState, setLocationState] = useState('idle');
  const [assignmentChange, setAssignmentChange] = useState(null);
  const [maneuverIndex, setManeuverIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const lastLocationRef = useRef(null);
  const lastRefreshRef = useRef(0);

  const loadDay = useCallback(async ({ silent = false } = {}) => {
    if (!hasSupabase || !ROUTE_UI_ENABLED) return;
    if (!silent) setLoading(true);
    try {
      const result = await apiGet(`/api/provider/route/day?date=${encodeURIComponent(date)}`);
      setAppointments(result.appointments || []);
      setOrigins(result.origins || []);
      setOrigin((current) => (result.origins || []).find((item) => item.id === current?.id) || result.origins?.[0] || current);
      setAssignmentChange(result.assignmentChange?.needsAcknowledgement ? result.assignmentChange : null);
      setError('');
    } catch (requestError) { if (!silent) setError(requestError.message); }
    finally { if (!silent) setLoading(false); }
  }, [date]);

  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => {
    if (!mission || !hasSupabase) return undefined;
    const poll = window.setInterval(() => loadDay({ silent: true }), 30000);
    return () => window.clearInterval(poll);
  }, [mission, loadDay]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (mission) window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [mission]);

  const updateStop = (id, patch) => setAppointments((items) => items.map((item) => item.appointmentId === id ? { ...item, ...patch } : item));
  const toggleStop = (id) => setAppointments((items) => items.map((item) => item.appointmentId === id ? { ...item, selected: !item.selected, omissionReason: item.selected ? item.omissionReason : '', omissionNote: item.selected ? item.omissionNote : '' } : item));
  const omissionValid = appointments.every((item) => !item.eligible || item.selected || (item.omissionReason && (item.omissionReason !== 'other' || item.omissionNote?.trim())));
  const selectedCount = appointments.filter((item) => item.eligible && item.selected).length;
  const manualOriginConfirmed = origin?.kind !== 'manual' || (Number.isFinite(origin?.latitude) && Number.isFinite(origin?.longitude));

  const recalculatePlan = useCallback(async (originOverride) => {
    if (!mission || assignmentChange) return;
    const liveOrigin = originOverride || (origin?.kind === 'current' && lastLocationRef.current ? { ...origin, ...lastLocationRef.current } : origin);
    if (!liveOrigin) return;
    try {
      if (hasSupabase) {
        const omissions = Object.fromEntries(appointments.filter((item) => item.eligible && !item.selected).map((item) => [item.appointmentId, { reason: item.omissionReason, note: item.omissionNote }]));
        const result = await apiPost('/api/provider/route/build', { date, origin: liveOrigin, selectedAppointmentIds: appointments.filter((item) => item.selected).map((item) => item.appointmentId), omissions });
        setPlan(result.plan);
      } else {
        setPlan(await buildFixedAppointmentRoute({ routeDate: date, origin: liveOrigin, stops: appointments, routeLeg: previewRoadLeg }));
      }
    } catch (requestError) {
      setPlan((current) => current ? { ...current, trafficState: 'stale' } : current);
      setError(requestError.message);
    }
  }, [mission, assignmentChange, origin, appointments, date]);

  useEffect(() => {
    if (!mission) return undefined;
    const focus = async () => {
      if (document.visibilityState !== 'visible') return;
      await loadDay({ silent: true });
      await recalculatePlan();
    };
    document.addEventListener('visibilitychange', focus);
    return () => document.removeEventListener('visibilitychange', focus);
  }, [mission, loadDay, recalculatePlan]);

  const chooseCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationState('denied'); return; }
    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { kind: 'current', label: 'Current Location', address: 'Live foreground position', latitude: position.coords.latitude, longitude: position.coords.longitude, persisted: false };
      setOrigin(next); setLocationState('ready');
    }, () => setLocationState('denied'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };

  const buildRoute = async () => {
    if (!selectedCount || !omissionValid || !origin) return;
    setLoading(true); setError('');
    try {
      let nextPlan;
      let buildOrigin = origin;
      if (origin.kind === 'manual' && saveAsHome) {
        if (hasSupabase) {
          const saved = await apiPost('/api/provider/route/origin', { address: manualAddress });
          buildOrigin = saved.origin;
          setOrigins((items) => [saved.origin, ...items.filter((item) => item.kind !== 'home')]);
          setOrigin(saved.origin);
        } else {
          buildOrigin = { ...origin, id: 'home-preview', kind: 'home', label: 'Home', address: manualAddress, persisted: true };
        }
      }
      if (hasSupabase) {
        const omissions = Object.fromEntries(appointments.filter((item) => item.eligible && !item.selected).map((item) => [item.appointmentId, { reason: item.omissionReason, note: item.omissionNote }]));
        const result = await apiPost('/api/provider/route/build', { date, origin: buildOrigin.kind === 'manual' ? { ...buildOrigin, address: manualAddress, label: manualAddress } : buildOrigin, selectedAppointmentIds: appointments.filter((item) => item.selected).map((item) => item.appointmentId), omissions });
        nextPlan = result.plan;
      } else {
        nextPlan = await buildFixedAppointmentRoute({ routeDate: date, origin: buildOrigin, stops: appointments, routeLeg: previewRoadLeg });
      }
      setPlan(nextPlan); setMission(true);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };

  const activeIndex = useMemo(() => Math.max(0, plan?.stops?.findIndex((stop) => !['completed'].includes(stop.status)) || 0), [plan]);
  const activeStop = plan?.stops?.[activeIndex];
  const activeLeg = plan?.legs?.[activeIndex];
  const activeMapPlan = plan && activeStop && activeLeg ? { ...plan, legs: [activeLeg], stops: [activeStop] } : plan;
  const leaveMinutes = activeLeg ? formatMinutesUntil(activeLeg.requiredDepartureAt, new Date(now)) : 0;
  useEffect(() => { setManeuverIndex(0); }, [activeStop?.appointmentId]);

  useEffect(() => {
    if (!mission || !navigator.geolocation) return undefined;
    const watch = navigator.geolocation.watchPosition(async (position) => {
      const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setManeuverIndex((current) => {
        const next = activeLeg?.steps?.[current + 1];
        return next?.coordinate && haversineMeters(coordinate, next.coordinate) <= 45 ? current + 1 : current;
      });
      const elapsed = Date.now() - lastRefreshRef.current;
      const moved = lastLocationRef.current ? haversineMeters(lastLocationRef.current, coordinate) : Infinity;
      lastLocationRef.current = coordinate;
      if (elapsed < 120000 && moved < 250) return;
      lastRefreshRef.current = Date.now();
      await recalculatePlan({ ...origin, ...coordinate });
    }, () => setLocationState('denied'), { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [mission, origin, recalculatePlan, activeLeg]);

  const acknowledge = async () => {
    if (assignmentChange?.activeStopRemoved) return;
    setLoading(true);
    try { if (hasSupabase) await apiPost('/api/provider/route/acknowledge', { date }); setAssignmentChange(null); await loadDay({ silent: true }); setMission(false); setPlan(null); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  const advance = async (status) => {
    try { if (hasSupabase) await apiPatch('/api/provider/route/stop', { appointmentId: activeStop.appointmentId, routeDayId: plan.id, status }); updateStop(activeStop.appointmentId, { status }); setPlan((current) => ({ ...current, stops: current.stops.map((stop) => stop.appointmentId === activeStop.appointmentId ? { ...stop, status } : stop) })); if (status === 'completed' && activeIndex === plan.stops.length - 1) { setMission(false); setPlan(null); } }
    catch (requestError) { setError(requestError.message); }
  };
  const nextAction = activeStop?.status === 'en_route'
    ? ['arrived', 'Mark Arrived']
    : activeStop?.status === 'arrived'
      ? ['started', 'Start Treatment']
      : ['started', 'in_treatment'].includes(activeStop?.status)
        ? ['completed', 'Complete Visit']
        : ['en_route', 'Start Route'];

  const handleSignOut = async () => { await signOut(); navigate('/login', { replace: true }); };

  if (!ROUTE_UI_ENABLED) {
    return (
      <main className="nurse-route-light min-h-dvh px-5 py-[calc(2rem+env(safe-area-inset-top))] font-body text-black" style={{ background: PAPER }}>
        <section className="mx-auto max-w-[620px]"><AvalonMark className="h-7 w-5 text-black" /><p className="mt-14 text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Nurse route</p><h1 className="mt-3 font-heading text-7xl uppercase leading-[0.82]">Awaiting approval</h1><p className="mt-6 max-w-md text-sm leading-6 text-black/55">Coordinate processing is disabled until privacy and security approval is recorded. Dispatch assignments remain available to administrators.</p><button type="button" onClick={handleSignOut} className="mt-8 min-h-12 rounded-full border border-black px-5 text-[10px] font-bold uppercase tracking-[0.16em]">Sign out</button></section>
      </main>
    );
  }

  if (mission && plan && activeStop) {
    return (
      <main className="nurse-route-dark min-h-dvh bg-[#080808] pb-[calc(6.5rem+env(safe-area-inset-bottom))] font-body text-white">
        <header className="px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]"><div className="mx-auto flex max-w-[620px] items-center justify-between"><button type="button" onClick={() => setMission(false)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20" aria-label="Back to route builder"><ArrowLeft className="h-4 w-4" /></button><div className="flex items-center gap-2"><AvalonMark className="h-5 w-3 text-white" /><span className="text-[10px] font-bold uppercase tracking-[0.2em]">{dayLabel(date)}</span></div><button type="button" onClick={() => setOverview(true)} className="min-h-11 rounded-full border border-white/20 px-4 text-[9px] font-bold uppercase tracking-[0.16em]">Day Overview</button></div></header>
        {assignmentChange && <section className="mx-auto mb-4 max-w-[620px] px-5"><div className="rounded-[22px] border border-white p-4" style={{ background: '#fff', color: '#000' }}><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong className="text-sm">Route changed by Dispatch</strong><p className="mt-1 text-xs text-black/60">Route actions are paused until this change is handled.</p><div className="mt-3 space-y-1 text-xs">{(assignmentChange.addedAppointments || []).map((item) => <p key={`added-${item.appointmentId}`}><strong>Added</strong> · {time(item.scheduledAt)} {item.clientDisplayName}</p>)}{(assignmentChange.removedAppointments || []).map((item) => <p key={`removed-${item.appointmentId}`}><strong>Removed</strong> · {time(item.scheduledAt)} {item.clientDisplayName}{assignmentChange.activeStopRemoved && item.appointmentId === activeStop?.appointmentId ? ' · active stop' : ''}</p>)}</div>{assignmentChange.activeStopRemoved ? <a href={`sms:+14159807708?body=${encodeURIComponent('My active Avalon appointment was reassigned. Please review my route.')}`} className="mt-3 inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.15em] underline">Text Dispatch</a> : <button type="button" onClick={acknowledge} className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] underline">Review and rebuild</button>}</div></div></div></section>}
        <section className="mx-auto max-w-[620px] px-5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45"><House className="h-3.5 w-3.5" />Starting from {plan.origin.label}</div>
          <div className="mt-6 border-b border-white/15 pb-7"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/42">Next action</p>{leaveMinutes > 0 ? <><h1 className="mt-3 font-heading text-7xl uppercase leading-[0.82] tracking-[-0.025em]">Leave in</h1><p className="mt-2 flex items-end font-heading text-[8.5rem] uppercase leading-[0.72]"><span>{leaveMinutes}</span><span className="mb-2 ml-3 text-4xl">min</span></p></> : <h1 className="mt-3 font-heading text-[clamp(4.8rem,23vw,8rem)] uppercase leading-[0.78] tracking-[-0.025em]">Leave now</h1>}</div>
          <div className="grid grid-cols-2 border-b border-white/15 py-5"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/38">Projected arrival</p><p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{activeLeg ? time(activeLeg.projectedArrivalAt) : '—'}</p></div><div className="border-l border-white/15 pl-5"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/38">Arrival target</p><p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{activeLeg ? `${Math.abs(activeLeg.bufferMinutes)} min ${activeLeg.bufferMinutes < 0 ? 'late' : 'early'}` : '—'}</p></div></div>
          <TurnByTurn leg={activeLeg} activeIndex={maneuverIndex} />
          <div className="py-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Appointment {activeIndex + 1} of {plan.stops.length}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{activeStop.clientDisplayName}</h2><p className="mt-2 text-sm text-white/55">{time(activeStop.scheduledAt)} · {activeStop.service}</p></div><StatusPill>{activeLeg?.feasibility?.replace('_', ' ') || 'Stale'}</StatusPill></div><p className="mt-4 flex items-center gap-2 text-xs text-white/45"><MapPin className="h-3.5 w-3.5" />{activeStop.neighborhood}</p></div>
          {error && <p className="mb-4 rounded-xl border border-white/30 p-3 text-xs text-white/75">{error} ETA is stale; appointment times are unchanged.</p>}
          <button type="button" disabled={Boolean(assignmentChange)} onClick={() => advance(nextAction[0])} className="flex w-full items-center justify-between rounded-full px-6 text-[11px] font-bold uppercase tracking-[0.2em] disabled:opacity-40" style={{ minHeight: 62, background: '#fff', color: '#000' }}><span>{nextAction[1]}</span><Navigation className="h-4 w-4 fill-black" /></button>
          <div className="mt-7"><RouteTimeline plan={plan} activeIndex={activeIndex} /></div>
        </section>
        <section className="mx-auto mt-7 max-w-[620px]"><NurseRouteMap plan={activeMapPlan} className="h-[310px] w-full border-y border-white/10 grayscale" /><div className="flex items-center justify-between px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35"><span>{plan.trafficState === 'live' ? `Live traffic · ${activeLeg?.trafficLevel || 'current'}` : 'Road route · traffic unavailable'}</span><a href={`https://maps.apple.com/?daddr=${encodeURIComponent(activeStop.address)}`} className="underline">Open in Apple Maps</a></div></section>
        {overview && <DayOverview plan={plan} onClose={() => setOverview(false)} />}
      </main>
    );
  }

  return (
    <main className="nurse-route-light min-h-dvh pb-[calc(7rem+env(safe-area-inset-bottom))] font-body text-black" style={{ background: PAPER }}>
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f4f4f2]/95 px-5 py-3"><div className="mx-auto flex max-w-[620px] items-center justify-between"><Link to="/" aria-label="Avalon home"><AvalonMark className="h-6 w-4 text-black" /></Link><div className="text-center"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-black/40">Nurse route</p><p className="mt-0.5 text-xs font-semibold">{user?.name || 'Today'}</p></div><button type="button" onClick={handleSignOut} className="grid h-11 w-11 place-items-center rounded-full border border-black/15" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></div></header>
      <section className="mx-auto max-w-[620px] px-5 pb-8 pt-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">{dayLabel(date)}</p><h1 className="mt-3 font-heading text-[clamp(4.5rem,21vw,7.5rem)] uppercase leading-[0.78] tracking-[-0.02em]">Build Today’s Route</h1><p className="mt-5 max-w-md text-sm leading-6 text-black/55">Assigned visits stay fixed by appointment time. We plan each departure to arrive 15 minutes early.</p>
        <label className="mt-6 block text-[10px] font-bold uppercase tracking-[0.16em] text-black/45" htmlFor="route-date">Route date</label><input id="route-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-black/15 bg-white px-4 text-sm" />
        <div className="mt-9 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">Assigned by admin</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{appointments.length} appointments</h2></div><span className="text-xs text-black/45">{selectedCount} selected</span></div>
        <div className="mt-4 space-y-3">{appointments.map((stop) => <AppointmentCard key={stop.appointmentId} stop={stop} onToggle={toggleStop} onOmission={(id, patchValue) => updateStop(id, patchValue.reason !== undefined ? { omissionReason: patchValue.reason } : { omissionNote: patchValue.note })} />)}</div>
        {!appointments.length && !loading && <div className="mt-4 rounded-[24px] border border-black/15 bg-white p-6 text-sm text-black/55">No appointments are assigned to you for this day.</div>}
        <div className="mt-10"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">Starting location</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Choose your origin</h2><div className="mt-4 space-y-3">{origins.map((item) => <OriginOption key={item.id} selected={origin?.id === item.id} icon={item.kind === 'home' ? House : MapPin} label={item.label} detail={item.address} onClick={() => setOrigin(item)} />)}<OriginOption selected={origin?.kind === 'current'} icon={LocateFixed} label={locationState === 'requesting' ? 'Locating…' : 'Current Location'} detail={locationState === 'denied' ? 'Location permission denied' : 'Foreground GPS · never saved'} onClick={chooseCurrentLocation} /><OriginOption selected={origin?.kind === 'manual'} icon={Navigation} label="Manual address" detail={manualAddress || 'Enter a one-time starting point'} onClick={() => setOrigin({ kind: 'manual', label: manualAddress || 'Manual address', address: manualAddress, persisted: false })} /></div>{origin?.kind === 'manual' && <div className="mt-3 rounded-2xl border border-black/20 p-3" style={{ background: '#fff' }}><AddressAutocomplete value={manualAddress} fallbackResults={BAY_AREA_ADDRESS_SUGGESTIONS} onChange={(value) => { setManualAddress(value); setOrigin((current) => ({ ...current, label: value || 'Manual address', address: value, latitude: undefined, longitude: undefined })); }} onSelect={(item) => { setManualAddress(item.label); setOrigin({ kind: 'manual', label: item.label, address: item.label, latitude: item.latitude, longitude: item.longitude, persisted: false }); }} placeholder="Start typing a Bay Area address" aria-label="Starting address" className="min-h-12 w-full rounded-xl border border-black/15 px-4 text-sm" /><p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-black/40">Select a suggestion to confirm the route origin</p><label className="mt-2 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={saveAsHome} onChange={(event) => setSaveAsHome(event.target.checked)} className="h-4 w-4 accent-black" />Save this as my private Home origin</label></div>}</div>
        {appointments.some((item) => item.durationAssumed) && <p className="mt-5 text-xs leading-5 text-black/45">* Service duration unavailable; using a flagged 60-minute planning fallback.</p>}
        {error && <div className="mt-5 flex gap-3 rounded-[20px] border border-black p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}
        {!omissionValid && <p className="mt-4 text-xs font-semibold">Choose a reason for every omitted appointment.</p>}
        <button type="button" disabled={loading || !selectedCount || !origin || !omissionValid || !manualOriginConfirmed} onClick={buildRoute} className="mt-7 flex min-h-[64px] w-full items-center justify-between rounded-full bg-black px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-white disabled:opacity-30"><span>{loading ? 'Calculating route…' : 'Build route'}</span>{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}</button>
      </section>
      <MobileNavBar
        items={[
          { label: 'Shifts', to: '/provider/shifts', icon: CalendarDays },
          { label: 'Route', to: '/provider/shift', icon: Route },
          { label: 'Invoices', to: '/provider/invoices', icon: FileText },
        ]}
        columns={3}
        maxWidth="shift"
        mobileOnly={false}
        ariaLabel="Provider operations"
      />
    </main>
  );
}
