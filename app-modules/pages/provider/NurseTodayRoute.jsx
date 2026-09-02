import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LocateFixed,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Route,
  ShieldCheck,
  SignalZero,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import NurseRouteMap from '@/components/provider/NurseRouteMap';
import { apiGet, apiPost } from '@/lib/apiClient';
import { nursePortalNav } from '@/lib/nursePortalNav';
import { useSeo } from '@/lib/seo';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const labelCase = (value, fallback = '') => text(value || fallback).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
const makeIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.floor(Math.random() * 16);
  return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
});

function normalizeRouteDay(data) {
  const capabilities = data?.capabilities && typeof data.capabilities === 'object' ? data.capabilities : null;
  if (data?.route_day && typeof data.route_day === 'object') return { ...data.route_day, capabilities };
  if (data?.routeDay && typeof data.routeDay === 'object') return { ...data.routeDay, capabilities };
  if (Array.isArray(data?.route_days)) return data.route_days[0] ? { ...data.route_days[0], capabilities } : null;
  if (Array.isArray(data?.routeDays)) return data.routeDays[0] ? { ...data.routeDays[0], capabilities } : null;
  return null;
}

function tone(status) {
  const value = text(status).toLowerCase();
  if (['feasible', 'released', 'acknowledged', 'active', 'completed', 'kit_ready', 'ready', 'arrived'].includes(value)) {
    return 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700';
  }
  if (['infeasible', 'cancelled', 'unserviceable', 'evidence_stale', 'recovery_required', 'blocked'].includes(value)) {
    return 'border-red-500/25 bg-red-500/[0.06] text-red-700';
  }
  return 'border-amber-500/25 bg-amber-500/[0.06] text-amber-800';
}

function StatusPill({ children, status }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${tone(status)}`}>{children}</span>;
}

function PickupTask({ task, capabilityEnabled, busy, unavailable, onComplete }) {
  const [confirmations, setConfirmations] = useState({ handoff: false, count: false, coldChain: false });
  const [mismatch, setMismatch] = useState(false);
  const [mismatchReason, setMismatchReason] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [temperatureRecordedAt, setTemperatureRecordedAt] = useState('');
  const location = task?.location && typeof task.location === 'object' ? task.location : {};
  const locationLabel = text(location.safe_label || location.name || task.location_label);
  const locationAddress = text(location.safe_address || location.address || task.location_address);
  const hours = text(location.hours_label || location.pickup_hours || task.location_hours || task.hours_label);
  const lines = Array.isArray(task.lines) ? task.lines : Array.isArray(task.reservation_lines) ? task.reservation_lines : [];
  const exactLines = lines.length > 0 && lines.every((line) => (
    Boolean(line.id || line.reservation_id)
    && Boolean(text(line.item_label || line.item_name))
    && Boolean(text(line.lot_label || line.lot_code))
    && Number.isFinite(Number(line.quantity))
    && Number(line.quantity) > 0
  ));
  const locationVerified = Boolean(locationLabel && hours);
  const allowed = Array.isArray(task.allowed_actions) && task.allowed_actions.includes('complete_pickup');
  const coldChainRequired = lines.some((line) => line.cold_chain_required);
  const lineEvidenceCurrent = exactLines && lines.every((line) => (
    ['available', 'not_lot_controlled'].includes(text(line.disposition_status).toLowerCase())
    && (!line.expires_on || Date.parse(`${line.expires_on}T23:59:59Z`) >= Date.now())
  ));
  const canReport = capabilityEnabled && allowed && exactLines && locationVerified && !unavailable && !busy;
  const canAct = canReport && lineEvidenceCurrent;
  const allConfirmed = confirmations.handoff && confirmations.count && confirmations.coldChain;
  const coldChainEvidenceReady = !coldChainRequired || (
    Number.isFinite(Number(temperatureC)) && Number(temperatureC) >= -100 && Number(temperatureC) <= 100
    && Number.isFinite(Date.parse(temperatureRecordedAt))
  );
  const mismatchReady = mismatch && ['count_mismatch', 'lot_mismatch', 'damaged', 'temperature_out_of_range', 'other'].includes(mismatchReason);
  const completed = text(task.status).toLowerCase() === 'completed';
  const submit = () => onComplete(task, {
    confirmations,
    mismatch,
    mismatchReason: mismatch ? mismatchReason : undefined,
    temperatureC: coldChainRequired ? Number(temperatureC) : undefined,
    temperatureRecordedAt: coldChainRequired && temperatureRecordedAt ? new Date(temperatureRecordedAt).toISOString() : undefined,
  });
  return (
    <article className="rounded-2xl border border-foreground/10 bg-background/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold">{locationLabel || 'Pickup location unavailable'}</p>{locationAddress ? <p className="mt-1 text-xs text-foreground/50">{locationAddress}</p> : null}<p className="mt-1 text-xs text-foreground/50">{hours || 'Approved pickup hours unavailable'}</p></div>
        <StatusPill status={task.status}>{labelCase(task.status, 'Pending')}</StatusPill>
      </div>
      {exactLines ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10">
          {lines.map((line, index) => (
            <div key={line.id || line.reservation_id} className={`grid gap-2 p-3 sm:grid-cols-[1fr_auto] ${index ? 'border-t border-foreground/10' : ''}`}>
              <div><p className="text-sm font-semibold">{line.item_label || line.item_name}</p>{line.variant_label ? <p className="mt-0.5 text-xs text-foreground/45">{line.variant_label}</p> : null}<p className="mt-1 font-mono text-[10px] text-foreground/45">Lot {line.lot_label || line.lot_code}</p></div>
              <div className="sm:text-right"><p className="text-sm font-semibold">{Number(line.quantity)} {line.unit_label || line.unit || 'unit'}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/40">{labelCase(line.disposition_status, 'Evidence unavailable')}{line.expires_on ? ` · Exp ${line.expires_on}` : ''}</p>{line.cold_chain_required ? <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-700">Cold chain</p> : null}</div>
            </div>
          ))}
        </div>
      ) : <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-700">Exact item, lot, and quantity evidence is incomplete. Do not accept this pickup; contact Inventory.</p>}
      {!locationVerified ? <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-700">Assigned pickup location or hours could not be verified. Pickup completion remains disabled.</p> : null}
      {exactLines && !lineEvidenceCurrent ? <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-700">Lot disposition or expiry evidence is not current. Report the mismatch and stop; do not take custody.</p> : null}
      {!completed && exactLines && locationVerified ? (
        <fieldset className="mt-4 space-y-2" disabled={unavailable || Boolean(busy) || !capabilityEnabled || !allowed}>
          <legend className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/45">Custody confirmation</legend>
          {[
            ['handoff', 'I received these exact sealed items from the assigned location.'],
            ['count', 'I counted every item and quantity shown above.'],
            ['coldChain', lines.some((line) => line.cold_chain_required) ? 'I verified required cold-chain evidence and accepted custody.' : 'I confirm no unlisted cold-chain requirement was presented.'],
          ].map(([key, label]) => <label key={key} className="flex min-h-11 items-start gap-3 rounded-xl border border-foreground/10 p-3 text-xs leading-relaxed"><input type="checkbox" checked={confirmations[key]} onChange={(event) => setConfirmations((current) => ({ ...current, [key]: event.target.checked }))} className="mt-0.5 h-4 w-4" />{label}</label>)}
          {coldChainRequired && !mismatch ? <div className="grid gap-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.035] p-3 sm:grid-cols-2"><label className="text-xs font-semibold">Observed temperature °C<input type="number" min="-100" max="100" step="0.1" inputMode="decimal" value={temperatureC} onChange={(event) => setTemperatureC(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" /></label><label className="text-xs font-semibold">Evidence recorded at<input type="datetime-local" value={temperatureRecordedAt} onChange={(event) => setTemperatureRecordedAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" /></label></div> : null}
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-red-500/15 p-3 text-xs leading-relaxed text-red-700"><input type="checkbox" checked={mismatch} onChange={(event) => { setMismatch(event.target.checked); if (event.target.checked) setConfirmations({ handoff: false, count: false, coldChain: false }); }} className="mt-0.5 h-4 w-4" />The handoff does not match the item, lot, quantity, or condition shown.</label>
          {mismatch ? <label className="block text-xs font-semibold text-red-700">Mismatch reason<select value={mismatchReason} onChange={(event) => setMismatchReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-red-500/20 bg-background px-3 text-base text-foreground"><option value="">Select reason</option><option value="count_mismatch">Count mismatch</option><option value="lot_mismatch">Lot mismatch</option><option value="damaged">Damaged</option><option value="temperature_out_of_range">Temperature out of range</option><option value="other">Other operational mismatch</option></select></label> : null}
          <button type="button" disabled={mismatch ? (!canReport || !mismatchReady) : (!canAct || !allConfirmed || !coldChainEvidenceReady)} onClick={submit} className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[10px] font-bold uppercase tracking-[0.13em] disabled:opacity-40 sm:w-auto ${mismatch ? 'border border-red-500/25 text-red-700' : 'bg-foreground text-background'}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mismatch ? <AlertTriangle className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}{mismatch ? 'Report mismatch & stop' : 'Confirm pickup custody'}
          </button>
          {!capabilityEnabled || !allowed ? <p className="text-xs text-amber-800">Nurse pickup completion is not enabled or authorized for this task.</p> : null}
        </fieldset>
      ) : null}
      {completed ? <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />Pickup custody recorded from persisted inventory evidence.</p> : null}
    </article>
  );
}

function InventoryPanel({ routeDay, busy, unavailable, onComplete }) {
  const inventory = routeDay?.inventory || routeDay?.inventory_readiness || {};
  const status = text(inventory.status || routeDay?.inventory_status).toLowerCase() || 'inventory_check';
  const pickupTasks = Array.isArray(routeDay?.pickup_tasks) ? routeDay.pickup_tasks : Array.isArray(inventory.pickup_tasks) ? inventory.pickup_tasks : [];
  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4 sm:p-5" aria-labelledby="inventory-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">Whole-day check</p>
          <h2 id="inventory-heading" className="mt-1 text-lg font-semibold">Kit & pickup</h2>
        </div>
        {status === 'kit_ready' ? <PackageCheck className="h-5 w-5 text-emerald-700" /> : <PackageOpen className="h-5 w-5 text-amber-700" />}
      </div>
      <div className="mt-3 flex items-center gap-2"><StatusPill status={status}>{labelCase(status)}</StatusPill></div>
      {inventory.reason || inventory.reason_code ? <p className="mt-3 text-xs leading-relaxed text-foreground/60">{inventory.reason || labelCase(inventory.reason_code)}</p> : null}
      {pickupTasks.length ? (
        <div className="mt-4 grid gap-2">
          {pickupTasks.map((task, index) => <PickupTask key={task.id || index} task={task} capabilityEnabled={routeDay?.capabilities?.pickup_routing === true} busy={busy === `pickup:${task.id}`} unavailable={unavailable} onComplete={onComplete} />)}
        </div>
      ) : <p className="mt-3 text-xs leading-relaxed text-foreground/50">No pickup task is currently attached to this route.</p>}
    </section>
  );
}

function OriginPanel({ routeDay, busy, unavailable, onSave }) {
  const [mode, setMode] = useState('current');
  const [typedOrigin, setTypedOrigin] = useState('');
  const [locationError, setLocationError] = useState('');
  const hasOrigin = Boolean(routeDay?.origin || routeDay?.origin_kind || routeDay?.origin_confirmed_at || routeDay?.origin_consent_at);
  const saveCurrent = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Current location is not supported in this browser. Use a typed starting point.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => onSave({ source: 'current', latitude: coords.latitude, longitude: coords.longitude, consent: true }),
      () => setLocationError('Current location was not shared. Nothing was saved; use a typed starting point or try again.'),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 12000 },
    );
  };
  if (hasOrigin) {
    return (
      <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.035] p-4 sm:p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" /><div><h2 className="text-lg font-semibold">Starting point confirmed</h2><p className="mt-1 text-xs leading-relaxed text-foreground/55">Your route uses the starting point approved for today. Live location is not tracked or stored in the browser.</p></div></div>
      </section>
    );
  }
  return (
    <section className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.035] p-4 sm:p-5" aria-labelledby="origin-heading">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">One-time consent</p>
      <h2 id="origin-heading" className="mt-1 text-lg font-semibold">Where are you starting?</h2>
      <p className="mt-2 text-xs leading-relaxed text-foreground/55">Used once to build today’s route. Avalon does not continuously track you. Do not enter patient information.</p>
      <div className="mt-4 grid grid-cols-2 rounded-xl border border-foreground/10 p-1">
        <button type="button" aria-pressed={mode === 'current'} onClick={() => setMode('current')} className={`min-h-11 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] ${mode === 'current' ? 'bg-foreground text-background' : 'text-foreground/55'}`}>Current location</button>
        <button type="button" aria-pressed={mode === 'typed'} onClick={() => setMode('typed')} className={`min-h-11 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] ${mode === 'typed' ? 'bg-foreground text-background' : 'text-foreground/55'}`}>Type a start</button>
      </div>
      {mode === 'typed' ? (
        <label className="mt-4 block text-xs font-semibold">Starting address or landmark
          <input value={typedOrigin} onChange={(event) => setTypedOrigin(event.target.value.slice(0, 240))} autoComplete="street-address" className="mt-1 min-h-12 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" placeholder="Your starting point — no patient information" />
        </label>
      ) : null}
      {locationError ? <p role="alert" className="mt-3 text-xs text-red-700">{locationError}</p> : null}
      <button type="button" disabled={unavailable || Boolean(busy) || (mode === 'typed' && !text(typedOrigin))} onClick={() => mode === 'current' ? saveCurrent() : onSave({ source: 'typed', typedOrigin: text(typedOrigin), consent: true })} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.13em] text-background disabled:opacity-40 sm:w-auto">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}{mode === 'current' ? 'Use location & plan route' : 'Use this starting point'}
      </button>
    </section>
  );
}

function RoutePlan({ routeDay, busy, unavailable, onAction, onPlan }) {
  const status = text(routeDay?.status).toLowerCase() || 'draft';
  const stops = Array.isArray(routeDay?.stops) ? routeDay.stops : Array.isArray(routeDay?.plan?.stops) ? routeDay.plan.stops : [];
  const currentStop = stops.find((stop) => ['current', 'active', 'en_route', 'arrived'].includes(text(stop.status).toLowerCase())) || stops.find((stop) => text(stop.status) && !['completed', 'cancelled', 'skipped'].includes(text(stop.status).toLowerCase())) || null;
  const released = ['released', 'acknowledged', 'active', 'paused', 'recovery_required', 'completed'].includes(status);
  const acknowledged = ['acknowledged', 'active', 'paused', 'recovery_required', 'completed'].includes(status) || routeDay?.acknowledged_at;
  const active = ['active', 'paused', 'recovery_required'].includes(status);
  const canPlan = Boolean(routeDay?.origin || routeDay?.origin_confirmed_at || routeDay?.origin_consent_at) && ['draft', 'origin_required', 'inventory_check', 'pickup_required', 'infeasible', 'recovery_required'].includes(status);
  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4 sm:p-5" aria-labelledby="route-heading">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">Version {routeDay?.plan_version || routeDay?.version || '—'}</p><h2 id="route-heading" className="mt-1 text-lg font-semibold">Today’s route</h2></div><StatusPill status={status}>{labelCase(status)}</StatusPill></div>
      {routeDay?.reason || routeDay?.reason_code ? <p role={status === 'infeasible' ? 'alert' : undefined} className="mt-3 rounded-xl border border-foreground/10 p-3 text-xs leading-relaxed text-foreground/60">{routeDay.reason || labelCase(routeDay.reason_code)}</p> : null}
      {stops.length ? (
        <ol className="mt-4 grid gap-2">
          {stops.map((stop, index) => {
            const stopStatus = text(stop.status).toLowerCase() || 'planned';
            const isCurrent = currentStop?.id === stop.id;
            return (
              <li key={stop.id || index} className={`rounded-2xl border p-3 ${isCurrent ? 'border-foreground/30 bg-foreground/[0.055]' : 'border-foreground/10 bg-background/55'}`}>
                <div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-[10px] font-bold">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{stop.label || stop.title || (stop.kind === 'pickup' ? 'Inventory pickup' : 'Scheduled stop')}</p><StatusPill status={stopStatus}>{labelCase(stopStatus)}</StatusPill></div><p className="mt-1 text-xs text-foreground/50">{stop.time_window_label || stop.eta_label || (stop.eta ? timeFormatter.format(new Date(stop.eta)) : 'Timing available after route release')}</p></div></div>
                {isCurrent && active ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stop.navigation?.apple_url || stop.navigation?.apple_maps_url || stop.apple_maps_url ? <a href={stop.navigation?.apple_url || stop.navigation?.apple_maps_url || stop.apple_maps_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-background"><Navigation className="h-3.5 w-3.5" />Apple Maps</a> : null}
                    {stop.navigation?.google_url || stop.navigation?.google_maps_url || stop.google_maps_url ? <a href={stop.navigation?.google_url || stop.navigation?.google_maps_url || stop.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><Route className="h-3.5 w-3.5" />Google Maps</a> : null}
                    {stopStatus !== 'arrived' && stop.id && text(stop.status) ? <button type="button" disabled={unavailable || Boolean(busy)} onClick={() => onAction('arrived', { stopId: stop.id, expectedStopVersion: stop.version })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-500/25 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 disabled:opacity-40"><MapPin className="h-3.5 w-3.5" />I’ve arrived</button> : null}
                    {stopStatus === 'arrived' && stop.shift_id ? <Link to={`/provider/shifts/${encodeURIComponent(stop.shift_id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-background">Open appointment<ChevronRight className="h-3.5 w-3.5" /></Link> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : <p className="mt-4 rounded-2xl border border-dashed border-foreground/15 p-5 text-center text-xs leading-relaxed text-foreground/50">No released stops are available. Planning never silently drops an accepted appointment.</p>}
      {active && stops.length && !currentStop ? <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-700">Current-stop status could not be verified. Navigation and arrival remain unavailable until the route refreshes.</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {canPlan ? <button type="button" disabled={unavailable || Boolean(busy)} onClick={onPlan} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}Plan route</button> : null}
        {released && !acknowledged ? <button type="button" disabled={unavailable || Boolean(busy)} onClick={() => onAction('acknowledge')} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Acknowledge route</button> : null}
        {acknowledged && !active && status !== 'completed' ? <button type="button" disabled={unavailable || Boolean(busy)} onClick={() => onAction('activate')} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40"><Navigation className="h-4 w-4" />Start route</button> : null}
        {status === 'recovery_required' ? <button type="button" disabled={unavailable || Boolean(busy)} onClick={() => onAction('recover')} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-500/25 px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800 disabled:opacity-40"><RefreshCw className="h-4 w-4" />Request recovery</button> : null}
      </div>
      {released && !acknowledged ? <p className="mt-3 text-xs text-foreground/50">Review every stop before acknowledging. Dispatch controls release during beta.</p> : null}
    </section>
  );
}

export default function NurseTodayRoute() {
  useSeo({ title: 'Today — Avalon Vitality', description: 'Prepare, acknowledge, and run today’s approved route.', path: '/provider/today', robots: 'noindex, nofollow, noarchive' });
  const [state, setState] = useState({ loading: true, error: '', routeDay: null });
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await apiGet(`/api/me/route-days?date=${encodeURIComponent(todayKey())}`);
      setState({ loading: false, error: '', routeDay: normalizeRouteDay(data) });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Today’s route could not be verified.' }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onOnline = () => { setOnline(true); load({ quiet: true }); };
    const onOffline = () => setOnline(false);
    const onVisibility = () => { if (document.visibilityState === 'visible') load({ quiet: true }); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) load({ quiet: true }); }, 20000);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); document.removeEventListener('visibilitychange', onVisibility); window.clearInterval(timer); };
  }, [load]);
  const routeDay = state.routeDay;
  const activeShiftId = useMemo(() => {
    const stops = routeDay?.stops || routeDay?.plan?.stops || [];
    return stops.find((stop) => ['active', 'arrived', 'in_progress'].includes(text(stop.status).toLowerCase()))?.shift_id || '';
  }, [routeDay]);
  const navItems = nursePortalNav(activeShiftId);
  const saveOrigin = async (origin) => {
    if (!routeDay?.id) return;
    setBusy('origin'); setActionError('');
    try {
      const current = origin.source === 'current';
      await apiPost(`/api/me/route-days/${encodeURIComponent(routeDay.id)}/origin`, {
        ...origin,
        kind: current ? 'current' : 'manual',
        address: current ? undefined : origin.typedOrigin,
        origin: current ? { kind: 'current', latitude: origin.latitude, longitude: origin.longitude } : { kind: 'manual' },
        plan: true,
        consent: true,
        consentTextVersion: 'route-origin-consent-v1',
        expectedVersion: routeDay.version,
        expectedRouteDayVersion: routeDay.version,
        idempotencyKey: makeIdempotencyKey(),
      });
      await load();
    } catch (error) { setActionError(origin.source === 'current' ? 'Location was not saved and no route was created. Fresh consent is required before trying again.' : (error.message || 'The starting point was not saved. Nothing changed.')); } finally { setBusy(''); }
  };
  const act = async (action, extra = {}) => {
    if (!routeDay?.id) return;
    setBusy(action); setActionError('');
    try {
      const path = action === 'plan' ? `/api/me/route-days/${encodeURIComponent(routeDay.id)}/plan` : `/api/me/route-days/${encodeURIComponent(routeDay.id)}/actions`;
      const serverAction = action === 'arrived' ? 'arrive' : action === 'recover' ? 'require_recovery' : action;
      await apiPost(path, { ...(action === 'plan' ? {} : { action: serverAction }), ...extra, entityId: extra.stopId || extra.pickupTaskId, expectedVersion: routeDay.version, expectedRouteDayVersion: routeDay.version, idempotencyKey: makeIdempotencyKey() });
      await load();
    } catch (error) { setActionError(error.message || 'That route action could not be saved. Nothing changed.'); } finally { setBusy(''); }
  };
  const completePickup = async (task, evidence) => {
    if (!routeDay?.id || !task?.id || !online) return;
    setBusy(`pickup:${task.id}`); setActionError('');
    try {
      await apiPost(`/api/me/route-days/${encodeURIComponent(routeDay.id)}/actions`, {
        action: 'complete_pickup',
        pickupTaskId: task.id,
        entityId: task.id,
        expectedPickupVersion: task.version,
        expectedRouteDayVersion: routeDay.version,
        idempotencyKey: makeIdempotencyKey(),
        countConfirmed: evidence.confirmations.count === true,
        handoffConfirmed: evidence.confirmations.handoff === true,
        confirmations: (task.reservation_lines || task.lines || []).map((line) => ({
          reservationId: line.reservation_id || line.id,
          itemId: line.item_id,
          variantId: line.variant_id || null,
          lotId: line.lot_id || null,
          quantity: Number(line.quantity),
          countVerified: evidence.confirmations.count === true,
        })),
        mismatch: evidence.mismatch === true,
        reason: evidence.mismatchReason,
        coldChainEvidence: task.cold_chain_required ? {
          temperatureC: evidence.temperatureC,
          recordedAt: evidence.temperatureRecordedAt,
        } : { notRequired: true },
      });
      await load();
    } catch (error) { setActionError(error.message || 'Pickup evidence was not saved. Do not proceed until Inventory resolves the handoff.'); } finally { setBusy(''); }
  };
  const planRoute = () => {
    if (routeDay?.origin_kind !== 'current') {
      act('plan', { consent: true, consentTextVersion: 'route-origin-consent-v1' });
      return;
    }
    setActionError('');
    if (!navigator.geolocation) {
      setActionError('Fresh location consent is required to replan. Current location is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => saveOrigin({ source: 'current', latitude: coords.latitude, longitude: coords.longitude, consent: true }),
      () => setActionError('Location was not shared and no route was created. Fresh consent is required before trying again.'),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 12000 },
    );
  };

  if (!state.loading && state.error && !routeDay) {
    return <main className="min-h-dvh bg-background px-4 pb-28 pt-8 text-foreground"><section className="mx-auto max-w-5xl"><OperationalSourceUnavailable title="Today’s route unavailable" description="Accepted work, inventory evidence, and route release could not be verified. Navigation and arrival actions remain disabled until the persisted source reconnects." /></section><MobileNavBar items={nursePortalNav()} columns={5} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" /></main>;
  }
  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Nurse portal</p><h1 className="font-heading text-5xl uppercase">Today</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/55">Prepare the whole day, then navigate one approved leg at a time.</p></div><button type="button" onClick={() => load()} className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15" aria-label="Refresh today’s route"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button></header>
        {!online ? <p role="status" className="mt-5 flex items-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-800"><SignalZero className="h-4 w-4" />Offline. Verified route details remain visible; actions wait until you reconnect.</p> : null}
        {actionError ? <p role="alert" className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-700">{actionError}</p> : null}
        {state.error && routeDay ? <p role="alert" className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-800">Today could not fully refresh. Confirm connectivity before taking an action.</p> : null}
        {state.loading && !routeDay ? <p className="mt-8 flex items-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading today’s persisted route</p> : null}
        {!state.loading && !routeDay ? <div className="mt-6 rounded-3xl border border-dashed border-foreground/15 p-10 text-center"><Clock3 className="mx-auto h-6 w-6 text-foreground/35" /><p className="mt-3 text-sm font-semibold">No accepted route today</p><p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground/45">Accepted mobile-service work will appear after Avalon verifies it and creates a route day.</p><Link to="/provider/shifts" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-foreground/15 px-5 text-[10px] font-bold uppercase tracking-[0.12em]">Open Work Queue</Link></div> : null}
        {routeDay ? <div className="mt-6 grid gap-4"><NurseRouteMap routeDay={routeDay} /><OriginPanel routeDay={routeDay} busy={busy === 'origin'} unavailable={!online} onSave={saveOrigin} /><InventoryPanel routeDay={routeDay} busy={busy} unavailable={!online} onComplete={completePickup} /><RoutePlan routeDay={routeDay} busy={busy} unavailable={!online} onAction={act} onPlan={planRoute} />{routeDay.updated_at ? <p className="text-center text-[10px] uppercase tracking-[0.12em] text-foreground/35">Last verified {timeFormatter.format(new Date(routeDay.updated_at))}</p> : null}</div> : null}
      </section>
      <MobileNavBar items={navItems} columns={navItems.length} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
    </main>
  );
}
