import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, authedFetch } from '@/lib/apiClient';
import { assertApiResponse } from '@/lib/apiResponse';
import { useSeo } from '@/lib/seo';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TERMINAL_RUN_STATUSES = new Set(['completed', 'closed', 'time_submitted', 'paid', 'cancelled']);
const FIELD = 'mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base text-foreground outline-none focus:border-foreground/40';
const LABEL = 'block text-xs font-semibold text-foreground/75';
const EMPTY_FORMS = {
  business_profile: { display_name: '', business_name: '', work_email: '', work_phone: '', preferred_contact: 'email' },
  availability: { timezone: 'America/Los_Angeles', weekly: [], blackout_dates: [], max_daily_hours: '' },
  service_preferences: {
    service_codes: [],
    modalities: [],
    max_travel_minutes: '',
    max_daily_stops: '',
    preferred_visit_minutes: '',
    minimum_turnaround_minutes: '',
  },
  service_area: { home_market: '', cities: [], postal_codes: [], radius_miles: '' },
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const labelCase = (value, fallback = '') => text(value || fallback).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const listText = (value) => (Array.isArray(value) ? value.join(', ') : '');
const parseList = (value) => [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))];
const asNumber = (value) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const resourceState = () => ({ status: 'loading', error: '', version: null, updatedAt: '', saved: false });

function nurseNav(activeShiftId = '') {
  return [
    { label: 'Work', to: '/provider/shifts', icon: BriefcaseBusiness },
    ...(activeShiftId ? [{ label: 'Shift', to: `/provider/shifts/${encodeURIComponent(activeShiftId)}`, icon: Stethoscope, primary: true }] : []),
    { label: 'Time & Pay', to: '/provider/invoices', icon: FileText },
    { label: 'Me', to: '/provider/settings', icon: Settings, exact: true },
  ];
}

function resourceFrom(data, key) {
  assertApiResponse(data, { objects: [key] }, `${labelCase(key)} returned an invalid response.`);
  const value = data?.[key];
  if (!data || typeof data !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${labelCase(key)} returned an invalid response.`);
  }
  return {
    value,
    version: data.version ?? null,
    updatedAt: data.updated_at || '',
    provider: data.provider || null,
  };
}

function Section({ icon: Icon, title, description, resource, children, onRetry }) {
  if (resource.status === 'loading') {
    return <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-5"><p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading {title.toLowerCase()}</p></section>;
  }
  if (resource.status === 'unavailable') {
    return (
      <section className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.035] p-5">
        <div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" /><div><h2 className="text-base font-semibold">{title} unavailable</h2><p className="mt-1 text-sm leading-relaxed text-foreground/55">{description} No default or browser-only value is being substituted.</p></div></div>
        <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Retry</button>
      </section>
    );
  }
  return (
    <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-5">
      <div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-foreground/55">{description}</p></div></div>
      {resource.error ? <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-sm text-red-700">{resource.error} Nothing was changed.</p> : null}
      {resource.saved ? <p role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />Saved to your nurse profile.</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SaveButton({ saving, onClick, label }) {
  return <button type="button" disabled={saving} onClick={onClick} className="mt-5 min-h-11 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">{saving ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 inline h-3.5 w-3.5" />}{label}</button>;
}

export default function NurseWorkSettings() {
  useSeo({
    title: 'My Work Settings — Avalon Vitality',
    description: 'Manage persisted nurse work preferences and review engagement status.',
    path: '/provider/settings',
    robots: 'noindex, nofollow, noarchive',
  });
  const [resources, setResources] = useState({
    business_profile: resourceState(),
    availability: resourceState(),
    service_preferences: resourceState(),
    service_area: resourceState(),
    engagement_status: resourceState(),
  });
  const [forms, setForms] = useState(EMPTY_FORMS);
  const [provider, setProvider] = useState(null);
  const [activeShiftId, setActiveShiftId] = useState('');

  const loadOne = useCallback(async (key, path) => {
    setResources((current) => ({ ...current, [key]: { ...current[key], status: 'loading', error: '', saved: false } }));
    try {
      const data = await apiGet(path);
      const parsed = resourceFrom(data, key);
      setProvider((current) => parsed.provider || current);
      if (key !== 'engagement_status') {
        const editable = key === 'availability'
          ? { ...parsed.value, blackout_dates_text: listText(parsed.value.blackout_dates) }
          : key === 'service_area'
            ? { ...parsed.value, cities_text: listText(parsed.value.cities), postal_codes_text: listText(parsed.value.postal_codes) }
            : parsed.value;
        setForms((current) => ({ ...current, [key]: { ...current[key], ...editable } }));
      }
      setResources((current) => ({ ...current, [key]: { status: 'ready', error: '', version: parsed.version, updatedAt: parsed.updatedAt, value: parsed.value, saved: false, saving: false } }));
    } catch (error) {
      setResources((current) => ({ ...current, [key]: { ...current[key], status: 'unavailable', error: error.message || `${labelCase(key)} is unavailable.`, saving: false, saved: false } }));
    }
  }, []);

  const loadAll = useCallback(() => {
    loadOne('business_profile', '/api/me/business-profile');
    loadOne('availability', '/api/me/availability');
    loadOne('service_preferences', '/api/me/service-preferences');
    loadOne('service_area', '/api/me/service-area');
    loadOne('engagement_status', '/api/me/engagement-status');
    apiGet('/api/me/shifts').then((data) => {
      assertApiResponse(data, { arrays: ['shifts'] }, 'The active shift source returned an invalid response.');
      const active = Array.isArray(data?.shifts) ? data.shifts.find((shift) => {
        const status = text(shift?.run?.status || shift?.run?.workflow_status).toLowerCase();
        return status && !TERMINAL_RUN_STATUSES.has(status);
      }) : null;
      setActiveShiftId(active?.id || '');
    }).catch(() => setActiveShiftId(''));
  }, [loadOne]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const updateForm = (key, patch) => setForms((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  const save = async (key, path, value) => {
    setResources((current) => ({ ...current, [key]: { ...current[key], saving: true, error: '', saved: false } }));
    try {
      const data = await authedFetch(path, { method: 'PUT', body: JSON.stringify({ [key]: value, ...(resources[key].version != null ? { version: resources[key].version } : {}) }) });
      const parsed = resourceFrom(data, key);
      setForms((current) => ({ ...current, [key]: { ...current[key], ...parsed.value } }));
      setResources((current) => Object.fromEntries(Object.entries(current).map(([resourceKey, resource]) => [
        resourceKey,
        resourceKey === key
          ? { status: 'ready', error: '', version: parsed.version, updatedAt: parsed.updatedAt, value: parsed.value, saved: true, saving: false }
          : { ...resource, version: parsed.version },
      ])));
    } catch (error) {
      setResources((current) => ({ ...current, [key]: { ...current[key], saving: false, saved: false, error: error.message || 'Could not save this section.' } }));
    }
  };

  const availabilityByDay = useMemo(() => new Map((Array.isArray(forms.availability.weekly) ? forms.availability.weekly : []).map((row) => [Number(row.day), row])), [forms.availability.weekly]);
  const setDay = (day, patch) => {
    const weekly = Array.isArray(forms.availability.weekly) ? [...forms.availability.weekly] : [];
    const index = weekly.findIndex((row) => Number(row.day) === day);
    const existing = index >= 0 ? weekly[index] : { day, start: '09:00', end: '17:00' };
    const next = { ...existing, ...patch, day };
    if (patch.enabled === false) {
      if (index >= 0) weekly.splice(index, 1);
    } else if (index >= 0) weekly[index] = next;
    else weekly.push(next);
    updateForm('availability', { weekly: weekly.map(({ enabled, ...row }) => row).sort((a, b) => a.day - b.day) });
  };
  const serviceCodes = Array.isArray(forms.service_preferences.service_codes) ? forms.service_preferences.service_codes : [];
  const modalities = Array.isArray(forms.service_preferences.modalities) ? forms.service_preferences.modalities : [];
  const availableServiceCodes = [...new Set([
    ...(Array.isArray(resources.service_preferences.value?.available_service_codes) ? resources.service_preferences.value.available_service_codes : []),
    ...(Array.isArray(resources.service_preferences.value?.service_codes) ? resources.service_preferences.value.service_codes : []),
  ])];
  const availableModalities = [...new Set([
    ...(Array.isArray(resources.service_preferences.value?.available_modalities) ? resources.service_preferences.value.available_modalities : []),
    ...(Array.isArray(resources.service_preferences.value?.modalities) ? resources.service_preferences.value.modalities : []),
  ])];
  const navItems = nurseNav(activeShiftId);
  const allUnavailable = Object.values(resources).every((resource) => resource.status === 'unavailable');

  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
      <section className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Nurse portal</p><h1 className="font-heading text-5xl uppercase">Me</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/55">Set when and where you want work. Avalon still verifies scope, credentials, readiness, and each offer before assignment.</p></div>
          <button type="button" onClick={loadAll} className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15" aria-label="Refresh work settings"><RefreshCw className="h-4 w-4" /></button>
        </header>

        {provider ? <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-foreground/10 bg-foreground/[0.025] px-4 py-3 text-xs text-foreground/60"><span className="font-semibold text-foreground">{provider.display_name || labelCase(provider.provider_role, 'Nurse')}</span><span>Credentials: {labelCase(provider.credential_status, 'Unavailable')}</span><span>Nursys: {labelCase(provider.nursys_status, 'Unavailable')}</span></div> : null}

        {allUnavailable ? (
          <div className="mt-5">
            <OperationalSourceUnavailable
              title="Work settings unavailable"
              description="Your business profile, availability, service preferences, service area, and engagement status could not be verified. No browser-only defaults are shown or saved."
            />
            <button type="button" onClick={loadAll} className="mt-4 min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Retry all settings</button>
          </div>
        ) : <div className="mt-5 grid gap-4">
          <Section icon={UserRound} title="Business profile" description="Operational contact details used for work offers. Do not enter tax IDs, banking data, or clinical information." resource={resources.business_profile} onRetry={() => loadOne('business_profile', '/api/me/business-profile')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={LABEL}>Display name<input value={forms.business_profile.display_name || ''} onChange={(event) => updateForm('business_profile', { display_name: event.target.value.slice(0, 120) })} className={FIELD} autoComplete="name" /></label>
              <label className={LABEL}>Business name<input value={forms.business_profile.business_name || ''} onChange={(event) => updateForm('business_profile', { business_name: event.target.value.slice(0, 160) })} className={FIELD} /></label>
              <label className={LABEL}>Work email<input type="email" value={forms.business_profile.work_email || ''} onChange={(event) => updateForm('business_profile', { work_email: event.target.value.slice(0, 160) })} className={FIELD} autoComplete="email" /></label>
              <label className={LABEL}>Work phone<input type="tel" value={forms.business_profile.work_phone || ''} onChange={(event) => updateForm('business_profile', { work_phone: event.target.value.slice(0, 40) })} className={FIELD} autoComplete="tel" /></label>
              <label className={LABEL}>Preferred contact<select value={forms.business_profile.preferred_contact || 'email'} onChange={(event) => updateForm('business_profile', { preferred_contact: event.target.value })} className={FIELD}><option value="email">Email</option><option value="sms">SMS</option><option value="phone">Phone</option></select></label>
            </div>
            <SaveButton saving={resources.business_profile.saving} onClick={() => save('business_profile', '/api/me/business-profile', forms.business_profile)} label="Save profile" />
          </Section>

          <Section icon={CalendarDays} title="Availability" description="Your preferred work windows and blackout dates. Saving availability does not accept a shift." resource={resources.availability} onRetry={() => loadOne('availability', '/api/me/availability')}>
            <label className={LABEL}>Time zone<input value={forms.availability.timezone || ''} onChange={(event) => updateForm('availability', { timezone: event.target.value.slice(0, 80) })} className={FIELD} /></label>
            <div className="mt-4 grid gap-2">
              {DAYS.map((dayLabel, day) => {
                const row = availabilityByDay.get(day);
                return <div key={dayLabel} className="grid gap-2 rounded-2xl border border-foreground/10 bg-background/55 p-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] lg:items-end"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(row)} onChange={(event) => setDay(day, { enabled: event.target.checked })} className="h-5 w-5" />{dayLabel}</label><label className={LABEL}>Earliest<input type="time" disabled={!row} value={row?.start || '09:00'} onChange={(event) => setDay(day, { start: event.target.value })} className={`${FIELD} disabled:opacity-40`} /></label><label className={LABEL}>Latest<input type="time" disabled={!row} value={row?.end || '17:00'} onChange={(event) => setDay(day, { end: event.target.value })} className={`${FIELD} disabled:opacity-40`} /></label><label className={LABEL}>Break start<input type="time" disabled={!row} value={row?.break_start || ''} onChange={(event) => setDay(day, { break_start: event.target.value, ...(!event.target.value ? { break_end: '' } : {}) })} className={`${FIELD} disabled:opacity-40`} /></label><label className={LABEL}>Break end<input type="time" disabled={!row || !row?.break_start} value={row?.break_end || ''} onChange={(event) => setDay(day, { break_end: event.target.value })} className={`${FIELD} disabled:opacity-40`} /></label></div>;
              })}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className={LABEL}>Blackout dates, comma separated<input value={forms.availability.blackout_dates_text ?? listText(forms.availability.blackout_dates)} onChange={(event) => updateForm('availability', { blackout_dates_text: event.target.value })} className={FIELD} placeholder="2026-09-01, 2026-09-02" /></label>
              <label className={LABEL}>Maximum daily hours<input type="number" min="0.25" max="24" step="0.25" value={forms.availability.max_daily_hours ?? ''} onChange={(event) => updateForm('availability', { max_daily_hours: event.target.value })} className={FIELD} /></label>
            </div>
            <SaveButton saving={resources.availability.saving} onClick={() => save('availability', '/api/me/availability', { timezone: forms.availability.timezone, weekly: forms.availability.weekly, blackout_dates: parseList(forms.availability.blackout_dates_text ?? listText(forms.availability.blackout_dates)), max_daily_hours: asNumber(forms.availability.max_daily_hours) })} label="Save availability" />
          </Section>

          <Section icon={Stethoscope} title="Service preferences" description="Preferences can narrow your offers but never expand your approved credential scope." resource={resources.service_preferences} onRetry={() => loadOne('service_preferences', '/api/me/service-preferences')}>
            <p className="text-xs font-semibold text-foreground/75">Approved service preferences</p>
            <div className="mt-2 flex flex-wrap gap-2">{availableServiceCodes.map((code) => { const checked = serviceCodes.includes(code); return <label key={code} className="flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-3 text-xs font-semibold"><input type="checkbox" checked={checked} onChange={() => updateForm('service_preferences', { service_codes: checked ? serviceCodes.filter((item) => item !== code) : [...serviceCodes, code] })} className="h-4 w-4" />{labelCase(code)}</label>; })}{!availableServiceCodes.length ? <p className="text-xs leading-relaxed text-foreground/50">No approved service codes are available to select. Avalon must add scope before it can appear here.</p> : null}</div>
            <p className="mt-4 text-xs font-semibold text-foreground/75">Modalities</p>
            <div className="mt-2 flex flex-wrap gap-2">{availableModalities.map((modality) => { const checked = modalities.includes(modality); return <label key={modality} className="flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-3 text-xs font-semibold"><input type="checkbox" checked={checked} onChange={() => updateForm('service_preferences', { modalities: checked ? modalities.filter((item) => item !== modality) : [...modalities, modality] })} className="h-4 w-4" />{labelCase(modality)}</label>; })}{!availableModalities.length ? <p className="text-xs leading-relaxed text-foreground/50">No approved modalities are available to select.</p> : null}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className={LABEL}>Maximum travel minutes<input type="number" min="0" max="480" value={forms.service_preferences.max_travel_minutes ?? ''} onChange={(event) => updateForm('service_preferences', { max_travel_minutes: event.target.value })} className={FIELD} /></label>
              <label className={LABEL}>Maximum daily stops<input type="number" min="1" max="50" value={forms.service_preferences.max_daily_stops ?? ''} onChange={(event) => updateForm('service_preferences', { max_daily_stops: event.target.value })} className={FIELD} /></label>
              <label className={LABEL}>Preferred visit duration, minutes<input type="number" min="5" max="480" step="5" value={forms.service_preferences.preferred_visit_minutes ?? ''} onChange={(event) => updateForm('service_preferences', { preferred_visit_minutes: event.target.value })} className={FIELD} /></label>
              <label className={LABEL}>Minimum turnaround, minutes<input type="number" min="0" max="240" step="5" value={forms.service_preferences.minimum_turnaround_minutes ?? ''} onChange={(event) => updateForm('service_preferences', { minimum_turnaround_minutes: event.target.value })} className={FIELD} /></label>
            </div>
            <SaveButton saving={resources.service_preferences.saving} onClick={() => save('service_preferences', '/api/me/service-preferences', { ...forms.service_preferences, max_travel_minutes: asNumber(forms.service_preferences.max_travel_minutes), max_daily_stops: asNumber(forms.service_preferences.max_daily_stops), preferred_visit_minutes: asNumber(forms.service_preferences.preferred_visit_minutes), minimum_turnaround_minutes: asNumber(forms.service_preferences.minimum_turnaround_minutes) })} label="Save preferences" />
          </Section>

          <Section icon={MapPin} title="Service area" description="Set your preferred market and travel area. Exact visit addresses appear only after authorized assignment." resource={resources.service_area} onRetry={() => loadOne('service_area', '/api/me/service-area')}>
            <div className="grid gap-3 sm:grid-cols-2"><label className={LABEL}>Home market<input value={forms.service_area.home_market || ''} onChange={(event) => updateForm('service_area', { home_market: event.target.value.slice(0, 120) })} className={FIELD} /></label><label className={LABEL}>Travel radius, miles<input type="number" min="0" max="500" value={forms.service_area.radius_miles ?? ''} onChange={(event) => updateForm('service_area', { radius_miles: event.target.value })} className={FIELD} /></label><label className={LABEL}>Cities, comma separated<input value={forms.service_area.cities_text ?? listText(forms.service_area.cities)} onChange={(event) => updateForm('service_area', { cities_text: event.target.value })} className={FIELD} /></label><label className={LABEL}>Postal codes, comma separated<input value={forms.service_area.postal_codes_text ?? listText(forms.service_area.postal_codes)} onChange={(event) => updateForm('service_area', { postal_codes_text: event.target.value })} className={FIELD} inputMode="numeric" /></label></div>
            <SaveButton saving={resources.service_area.saving} onClick={() => save('service_area', '/api/me/service-area', { home_market: forms.service_area.home_market, cities: parseList(forms.service_area.cities_text ?? listText(forms.service_area.cities)), postal_codes: parseList(forms.service_area.postal_codes_text ?? listText(forms.service_area.postal_codes)), radius_miles: asNumber(forms.service_area.radius_miles) })} label="Save service area" />
          </Section>

          <Section icon={ShieldCheck} title="Engagement status" description="This is controlled by Avalon and human-approved policy. You cannot select or change your own employment classification here." resource={resources.engagement_status} onRetry={() => loadOne('engagement_status', '/api/me/engagement-status')}>
            <div className="grid gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/40">Classification</p><p className="mt-1 text-sm font-semibold">{labelCase(resources.engagement_status.value?.classification, 'Unavailable')}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/40">Approval</p><p className="mt-1 text-sm font-semibold">{resources.engagement_status.value?.approved === true ? 'Human approved' : resources.engagement_status.value?.approved === false ? 'Safe default — not separately approved' : 'Unavailable'}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/40">Source</p><p className="mt-1 text-sm">{labelCase(resources.engagement_status.value?.source, 'Unavailable')}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/40">Effective</p><p className="mt-1 text-sm">{resources.engagement_status.value?.effective_at ? new Date(resources.engagement_status.value.effective_at).toLocaleDateString() : 'Not separately effective-dated'}</p></div></div>
          </Section>
        </div>}
      </section>
      <MobileNavBar items={navItems} columns={navItems.length} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
    </main>
  );
}
