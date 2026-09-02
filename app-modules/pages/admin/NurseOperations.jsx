import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageSearch,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, apiPost } from '@/lib/apiClient';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const labelCase = (value, fallback = '') => text(value || fallback).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const requestKey = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.floor(Math.random() * 16);
  return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
});
const dateTime = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(date) : 'Not available';
};

const CONFIG = {
  dispatch: {
    title: 'Dispatch', eyebrow: 'Nurse marketplace', icon: Route,
    description: 'Readiness, offer waves, assignments, route release, and recovery from persisted operations.',
    empty: 'No mobile-service work requires dispatch review.',
  },
  inventory: {
    title: 'Inventory Routing', eyebrow: 'Nurse marketplace', icon: PackageSearch,
    description: 'Supply manifests, reservations, pickup tasks, and evidence conflicts for accepted work.',
    empty: 'No route inventory or pickup work requires review.',
  },
  guides: {
    title: 'Guide Publishing', eyebrow: 'Clinical governance', icon: BookOpenCheck,
    description: 'Versioned clinical review and publishing. Only approved source-of-record versions can enter a run.',
    empty: 'No guide version currently requires review.',
  },
};

function tone(status) {
  const value = text(status).toLowerCase();
  if (['ready', 'feasible', 'released', 'published', 'reserved', 'kit_ready', 'completed'].includes(value)) return 'border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200';
  if (['blocked', 'infeasible', 'conflict', 'unserviceable', 'stale', 'recovery_required', 'quarantined', 'recalled'].includes(value)) return 'border-red-300/20 bg-red-300/[0.05] text-red-200';
  return 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100';
}

function Status({ value }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 font-body text-[9px] font-semibold uppercase tracking-[0.13em] ${tone(value)}`}>{labelCase(value, 'Review')}</span>;
}

function Metric({ label, value, detail }) {
  return <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4"><p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{label}</p><p className="mt-3 font-heading text-4xl uppercase leading-none text-foreground">{value ?? '—'}</p>{detail ? <p className="mt-1 font-body text-[11px] text-foreground/42">{detail}</p> : null}</div>;
}

function RecordFacts({ row, view }) {
  const facts = view === 'dispatch' ? [
    ['Nurse', row.nurse_label || row.assignee_label],
    ['Start', row.starts_at ? dateTime(row.starts_at) : row.window_label],
    ['Readiness', row.readiness_status],
    ['Inventory', row.inventory_status],
    ['Route', row.route_status],
    ['Offer wave', row.offer_wave_label || row.wave_label],
  ] : view === 'inventory' ? [
    ['Manifest', row.manifest_name || row.manifest_version_label],
    ['Route day', row.route_date || row.service_date],
    ['Reservation', row.reservation_status],
    ['Pickup', row.pickup_status],
    ['Location', row.location_label],
    ['Evidence', row.evidence_status],
  ] : [
    ['Service', row.service_label || row.service_code],
    ['Version', row.version_label || row.version],
    ['Clinical review', row.clinical_review_status],
    ['Medical director', row.medical_director_status],
    ['Published', row.published_at ? dateTime(row.published_at) : null],
    ['Owner', row.owner_label || row.owner_role],
  ];
  return <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{facts.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => <div key={label} className="rounded-lg border border-foreground/8 bg-background/38 p-3"><dt className="font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/35">{label}</dt><dd className="mt-1 font-body text-[11px] text-foreground/65">{labelCase(value)}</dd></div>)}</dl>;
}

const ACTION_LABELS = {
  release_route: 'Release route', recover_route: 'Start recovery', recheck_readiness: 'Recheck readiness',
  recheck_inventory: 'Recheck inventory', resolve_pickup: 'Resolve pickup', release_reservation: 'Release reservation',
  submit_clinical_review: 'Submit review', submit_medical_director_review: 'Send to medical director', publish: 'Publish', retire: 'Retire',
};

function normalizeOperationsData(payload, view) {
  if (Array.isArray(payload?.records)) return payload;
  if (view === 'dispatch') {
    const routeDays = (payload?.route_days || []).map((row) => ({
      ...row, entity_type: 'route_day', title: `Route · ${row.route_date || 'Date pending'}`, route_status: row.status,
      summary: row.release_reason_code ? labelCase(row.release_reason_code) : 'Human-controlled route release and recovery.',
      allowed_actions: row.allowed_actions || (row.status === 'feasible' ? ['release_route'] : row.status === 'recovery_required' ? ['recover_route'] : []),
    }));
    const offers = (payload?.offers || []).map((row) => ({ ...row, entity_type: 'offer', title: 'Nurse offer', summary: `Offer wave ${row.wave_key || 'not assigned'} · ${labelCase(row.status)}`, allowed_actions: row.allowed_actions || [] }));
    const sourceEvents = (payload?.source_events || []).map((row) => ({ ...row, entity_type: 'source_event', title: `Appointment event · ${labelCase(row.event_type)}`, summary: `${labelCase(row.source_provider)} revision ${row.source_revision ?? '—'}`, allowed_actions: row.allowed_actions || [] }));
    const deadLetters = (payload?.dead_letters || []).map((row) => ({ ...row, entity_type: 'dead_letter', title: `Worker review · ${labelCase(row.job_type)}`, summary: labelCase(row.error_code, 'Dead letter requires review'), status: 'blocked', allowed_actions: row.allowed_actions || [] }));
    const records = [...routeDays, ...offers, ...sourceEvents, ...deadLetters];
    return { ...payload, records, metrics: payload?.metrics || [
      { key: 'route_days', label: 'Route days', value: routeDays.length },
      { key: 'open_offers', label: 'Open offers', value: offers.filter((row) => ['offered', 'delivered', 'viewed'].includes(text(row.status).toLowerCase())).length },
      { key: 'source_failures', label: 'Source failures', value: sourceEvents.filter((row) => ['failed', 'dead_letter'].includes(text(row.status).toLowerCase())).length },
      { key: 'dead_letters', label: 'Dead letters', value: deadLetters.length },
    ] };
  }
  if (view === 'inventory') {
    const pickups = (payload?.pickup_tasks || []).map((row) => ({ ...row, entity_type: 'pickup_task', title: 'Pickup task', pickup_status: row.status, summary: row.window_starts_at ? `Pickup window starts ${dateTime(row.window_starts_at)}` : 'Approved pickup evidence required.', allowed_actions: row.allowed_actions || (['pending', 'ready'].includes(text(row.status).toLowerCase()) ? ['resolve_pickup'] : []) }));
    const reservations = (payload?.reservations || []).map((row) => ({ ...row, entity_type: 'reservation', title: 'Inventory reservation', reservation_status: row.status, summary: row.release_code ? labelCase(row.release_code) : 'Inventory held for accepted work.', allowed_actions: row.allowed_actions || (['conflict', 'stale', 'evidence_stale'].includes(text(row.status).toLowerCase()) ? ['recheck_inventory'] : []) }));
    const manifests = (payload?.manifest_versions || []).map((row) => ({ ...row, entity_type: 'manifest_version', title: `Supply manifest · v${row.version ?? '—'}`, manifest_version_label: `Version ${row.version ?? '—'}`, summary: 'Versioned service requirements.', allowed_actions: row.allowed_actions || [] }));
    return { ...payload, records: [...pickups, ...reservations, ...manifests], metrics: payload?.metrics || [
      { key: 'pickups', label: 'Pickup tasks', value: pickups.length },
      { key: 'reservations', label: 'Reservations', value: reservations.length },
      { key: 'conflicts', label: 'Conflicts', value: reservations.filter((row) => ['conflict', 'stale', 'evidence_stale'].includes(text(row.status).toLowerCase())).length },
      { key: 'manifests', label: 'Manifest versions', value: manifests.length },
    ] };
  }
  const templates = new Map((payload?.templates || []).map((row) => [row.id, row]));
  const versions = (payload?.versions || []).map((row) => {
    const template = templates.get(row.template_id);
    const status = text(row.publication_status || row.status).toLowerCase();
    const candidates = status === 'draft' ? ['submit_clinical_review'] : status === 'published' ? ['retire'] : [];
    return { ...row, status, entity_type: 'guide_version', title: template?.name || 'Clinical guide', service_label: template?.work_kind, version_label: `Version ${row.version ?? '—'}`, summary: row.source_reference || 'Governed guide version.', allowed_actions: row.allowed_actions || candidates };
  });
  return { ...payload, records: versions, metrics: payload?.metrics || [
    { key: 'templates', label: 'Templates', value: templates.size },
    { key: 'review', label: 'In review', value: versions.filter((row) => ['clinical_review', 'medical_director_review'].includes(text(row.status).toLowerCase())).length },
    { key: 'published', label: 'Published', value: versions.filter((row) => text(row.status).toLowerCase() === 'published').length },
    { key: 'drafts', label: 'Drafts', value: versions.filter((row) => text(row.status).toLowerCase() === 'draft').length },
  ] };
}

function OperationsCard({ row, view, busy, onAction }) {
  const status = row.status || row.route_status || row.inventory_status || row.workflow_status || 'review';
  const actions = Array.isArray(row.allowed_actions) ? row.allowed_actions.filter((action) => ACTION_LABELS[action]) : [];
  return (
    <article className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><Status value={status} /><h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{row.title || row.operational_label || row.service_label || 'Operational record'}</h2><p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/45">{row.summary || row.reason || row.reason_code && labelCase(row.reason_code) || 'Persisted evidence is ready for authorized review.'}</p></div>
        {view === 'dispatch' ? <Truck className="h-5 w-5 text-foreground/35" /> : view === 'inventory' ? <PackageSearch className="h-5 w-5 text-foreground/35" /> : <ClipboardCheck className="h-5 w-5 text-foreground/35" />}
      </div>
      <RecordFacts row={row} view={view} />
      {Array.isArray(row.blockers) && row.blockers.length ? <div className="mt-3 rounded-lg border border-red-300/15 bg-red-300/[0.04] p-3"><p className="font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-red-200/75">Blocking evidence</p><ul className="mt-2 space-y-1">{row.blockers.map((blocker, index) => <li key={blocker.code || index} className="flex items-start gap-2 font-body text-[11px] text-foreground/48"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-200/65" />{blocker.label || blocker.reason || labelCase(blocker.code)}</li>)}</ul></div> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => <button key={action} type="button" disabled={Boolean(busy)} onClick={() => onAction(row, action)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/15 bg-background/45 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/65 disabled:opacity-40">{busy === `${row.id}:${action}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{ACTION_LABELS[action]}</button>)}
        {!actions.length ? <p className="font-body text-[10px] uppercase tracking-[0.13em] text-foreground/35">No authorized action available</p> : null}
      </div>
    </article>
  );
}

function cents(value) {
  const number = Number(value);
  return Number.isInteger(number) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number / 100) : 'Not approved';
}

function candidateTerms(context) {
  if (Array.isArray(context?.approved_contractor_terms)) return context.approved_contractor_terms;
  if (Array.isArray(context?.approved_terms)) return context.approved_terms;
  if (context?.approved_contractor_terms && typeof context.approved_contractor_terms === 'object') return [context.approved_contractor_terms];
  if (context?.approved_terms && typeof context.approved_terms === 'object') return [context.approved_terms];
  return [];
}

function approvedOptions(context, arrayKey, fallbackKey) {
  const values = Array.isArray(context?.[arrayKey]) ? context[arrayKey] : [];
  const fallback = text(context?.[fallbackKey]);
  return [...new Set([...values.map(text).filter(Boolean), ...(fallback ? [fallback] : [])])];
}

const termValue = (terms, snake, camel) => terms?.[camel] ?? terms?.[snake];

function OfferCandidatePreparation({ source, busy, onPrepare }) {
  const [shiftId, setShiftId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [termsKey, setTermsKey] = useState('');
  const [waveKey, setWaveKey] = useState('');
  const [cohortKey, setCohortKey] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const shifts = Array.isArray(source?.shifts) ? source.shifts : [];
  const providers = Array.isArray(source?.providers) ? source.providers : [];
  const policies = Array.isArray(source?.terms_policies) ? source.terms_policies : [];
  const selectedShift = shifts.find((row) => row.id === shiftId) || null;
  const selectedProvider = providers.find((row) => row.id === providerId) || null;
  const selectedPolicy = policies.find((row) => row.id === policyId) || null;
  const terms = Array.isArray(selectedPolicy?.terms) ? selectedPolicy.terms : candidateTerms(selectedPolicy);
  const selectedTerms = terms.find((row) => text(row.terms_key || row.termsKey) === termsKey) || null;
  const waves = Array.isArray(source?.allowed_wave_keys) ? source.allowed_wave_keys.map(text).filter(Boolean) : [];
  const cohorts = Array.isArray(source?.allowed_cohort_keys) ? source.allowed_cohort_keys.map(text).filter(Boolean) : [];
  const maxExpiryMinutes = Number(source?.max_expiry_minutes);
  const allowed = source?.available === true;
  const requiredNumbers = selectedTerms ? [
    termValue(selectedTerms, 'gross_pay_cents', 'grossPayCents'), termValue(selectedTerms, 'hourly_rate_cents', 'hourlyRateCents'),
    termValue(selectedTerms, 'estimated_work_minutes', 'estimatedWorkMinutes'), termValue(selectedTerms, 'estimated_travel_minutes', 'estimatedTravelMinutes'),
    termValue(selectedTerms, 'mileage_rate_cents', 'mileageRateCents'), termValue(selectedTerms, 'guaranteed_minimum_cents', 'guaranteedMinimumCents'),
  ] : [];
  const requiredCodes = selectedTerms ? [
    termValue(selectedTerms, 'currency', 'currency'), termValue(selectedTerms, 'cancellation_terms_code', 'cancellationTermsCode'),
    termValue(selectedTerms, 'expense_policy_code', 'expensePolicyCode'),
  ] : [];
  const exact = Boolean(
    selectedShift?.id && Number.isInteger(Number(selectedShift?.version)) && Number(selectedShift.version) > 0
    && selectedProvider?.id && selectedPolicy?.id && selectedTerms
    && Boolean(termsKey)
    && text(selectedTerms.engagement_model || selectedTerms.engagementModel) === 'approved_contractor'
    && requiredNumbers.length === 6 && requiredNumbers.every((entry) => Number.isInteger(Number(entry)) && Number(entry) >= 0)
    && requiredCodes.every((entry) => Boolean(text(entry)))
    && text(termValue(selectedTerms, 'currency', 'currency')).length === 3
    && Number(termValue(selectedTerms, 'estimated_work_minutes', 'estimatedWorkMinutes')) > 0
    && waveKey && cohortKey && expiresAt && Date.parse(expiresAt) > Date.now()
    && Number.isFinite(Date.parse(selectedShift?.starts_at)) && Date.parse(expiresAt) < Date.parse(selectedShift.starts_at)
    && Number.isInteger(maxExpiryMinutes) && maxExpiryMinutes > 0
    && Date.parse(expiresAt) <= Date.now() + (maxExpiryMinutes * 60000) + 5000
  );
  const resetApproval = () => setConfirmed(false);
  const selectPolicy = (value) => {
    setPolicyId(value); resetApproval();
    const next = policies.find((row) => row.id === value);
    setTermsKey(text(next?.terms?.[0]?.terms_key || next?.terms?.[0]?.termsKey));
  };
  const setMaximumExpiry = () => {
    if (!Number.isInteger(maxExpiryMinutes) || maxExpiryMinutes <= 0) return;
    const policyLimit = Date.now() + (maxExpiryMinutes * 60000);
    const shiftLimit = Date.parse(selectedShift?.starts_at || '') - 1000;
    const limit = Number.isFinite(shiftLimit) ? Math.min(policyLimit, shiftLimit) : policyLimit;
    setExpiresAt(limit > Date.now() ? new Date(limit).toISOString() : '');
    resetApproval();
  };
  const value = (snake, camel) => termValue(selectedTerms, snake, camel);
  const submit = () => onPrepare({
    action: 'prepare_offer_candidate', entityId: selectedShift.id, shiftId: selectedShift.id,
    expectedVersion: Number(selectedShift.version), expectedShiftVersion: Number(selectedShift.version),
    providerProfileId: selectedProvider.id, approvalPolicyId: selectedPolicy.id,
    termsKey, engagementModel: 'approved_contractor',
    grossPayCents: value('gross_pay_cents', 'grossPayCents'), hourlyRateCents: value('hourly_rate_cents', 'hourlyRateCents'),
    currency: value('currency', 'currency'), estimatedWorkMinutes: value('estimated_work_minutes', 'estimatedWorkMinutes'),
    estimatedTravelMinutes: value('estimated_travel_minutes', 'estimatedTravelMinutes'), mileageRateCents: value('mileage_rate_cents', 'mileageRateCents'),
    guaranteedMinimumCents: value('guaranteed_minimum_cents', 'guaranteedMinimumCents'),
    cancellationTermsCode: value('cancellation_terms_code', 'cancellationTermsCode'), expensePolicyCode: value('expense_policy_code', 'expensePolicyCode'),
    expiresAt, waveKey, cohortKey,
  });
  return (
    <section className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4" aria-labelledby="offer-preparation-heading">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-foreground/40" /><div><p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/40">Human governed</p><h2 id="offer-preparation-heading" className="font-heading text-3xl uppercase text-foreground">Prepare offer candidate</h2><p className="mt-1 max-w-2xl font-body text-[11px] leading-relaxed text-foreground/45">Choose only a server-approved shift, contractor, policy, and immutable terms package. This queues a readiness evaluation; it does not assign work or invent pay.</p></div></div>
      {!allowed ? <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-3 font-body text-[11px] text-amber-100">No approved offer-candidate context is available. Product/Ops and HR/Legal must approve policy and contractor terms before preparation.</p> : (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Approved shift<select value={shiftId} onChange={(event) => { setShiftId(event.target.value); resetApproval(); }} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/12 bg-background px-3 text-sm normal-case tracking-normal"><option value="">Select shift</option>{shifts.map((row) => <option key={row.id} value={row.id}>{row.label} · v{row.version}</option>)}</select></label>
            <label className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Approved contractor<select value={providerId} onChange={(event) => { setProviderId(event.target.value); resetApproval(); }} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/12 bg-background px-3 text-sm normal-case tracking-normal"><option value="">Select contractor</option>{providers.map((row) => <option key={row.id} value={row.id}>{row.label} · {labelCase(row.provider_role)}</option>)}</select></label>
            <label className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Approved terms policy<select value={policyId} onChange={(event) => selectPolicy(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/12 bg-background px-3 text-sm normal-case tracking-normal"><option value="">Select policy</option>{policies.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
          </div>
          {selectedShift && selectedProvider && selectedPolicy ? <>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[
              ['Shift', `${selectedShift.id} · v${selectedShift.version}`], ['Provider', selectedProvider.label || selectedProvider.id],
              ['Approval policy', selectedPolicy.label || selectedPolicy.id], ['Engagement', 'Approved contractor'],
            ].map(([label, detail]) => <div key={label} className="rounded-lg border border-foreground/8 bg-background/38 p-3"><dt className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/35">{label}</dt><dd className="mt-1 break-all font-body text-[11px] text-foreground/60">{detail}</dd></div>)}</dl>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Approved terms<select value={termsKey} onChange={(event) => { setTermsKey(event.target.value); setConfirmed(false); }} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/12 bg-background px-3 text-sm normal-case tracking-normal">{terms.map((row) => <option key={row.terms_key || row.termsKey} value={row.terms_key || row.termsKey}>{row.label || row.terms_key || row.termsKey}</option>)}</select></label>
              <label className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Wave<select value={waveKey} onChange={(event) => setWaveKey(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/12 bg-background px-3 text-sm normal-case tracking-normal">{waves.map((valueOption) => <option key={valueOption}>{valueOption}</option>)}</select></label>
              <label className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Cohort<select value={cohortKey} onChange={(event) => setCohortKey(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/12 bg-background px-3 text-sm normal-case tracking-normal">{cohorts.map((valueOption) => <option key={valueOption}>{valueOption}</option>)}</select></label>
              <div className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">Expiry<button type="button" onClick={setMaximumExpiry} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/12 bg-background px-3 text-left text-sm font-normal normal-case tracking-normal">{expiresAt ? dateTime(expiresAt) : `Set approved ${maxExpiryMinutes}-minute window`}</button></div>
            </div>
            {selectedTerms ? <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[
              ['Gross pay', cents(value('gross_pay_cents', 'grossPayCents'))], ['Hourly rate', cents(value('hourly_rate_cents', 'hourlyRateCents'))],
              ['Guaranteed minimum', cents(value('guaranteed_minimum_cents', 'guaranteedMinimumCents'))], ['Mileage', `${cents(value('mileage_rate_cents', 'mileageRateCents'))} / mile`],
              ['Work estimate', `${value('estimated_work_minutes', 'estimatedWorkMinutes')} min`], ['Travel estimate', `${value('estimated_travel_minutes', 'estimatedTravelMinutes')} min`],
              ['Cancellation', labelCase(value('cancellation_terms_code', 'cancellationTermsCode'))], ['Expenses', labelCase(value('expense_policy_code', 'expensePolicyCode'))],
            ].map(([label, detail]) => <div key={label} className="rounded-lg border border-foreground/8 bg-background/38 p-3"><dt className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/35">{label}</dt><dd className="mt-1 font-body text-[11px] text-foreground/60">{detail}</dd></div>)}</dl> : null}
            <label className="flex min-h-11 items-start gap-3 rounded-xl border border-foreground/10 p-3 font-body text-[11px] leading-relaxed text-foreground/60"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4" />I reviewed the exact shift/provider versions, active approval policy, contractor classification, terms, expiry, wave, and cohort shown above.</label>
            <button type="button" disabled={busy || !allowed || !exact || !confirmed} onClick={submit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background disabled:opacity-40">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}Prepare candidate</button>
            {!allowed || !exact ? <p className="font-body text-[11px] text-amber-100">Preparation remains disabled until the server returns a complete, authorized policy-bound candidate and approved terms package.</p> : null}
          </> : null}
        </div>
      )}
    </section>
  );
}

export default function NurseOperations({ view = 'dispatch' }) {
  const config = CONFIG[view] || CONFIG.dispatch;
  const Icon = config.icon;
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiGet(`/api/admin/nurse-marketplace?view=${encodeURIComponent(view)}`);
      const payload = response?.data && typeof response.data === 'object' ? response.data : response;
      const data = normalizeOperationsData(payload, view);
      if (!data || !Array.isArray(data.records)) throw new Error(`${config.title} returned an invalid persisted-source response.`);
      setState({ loading: false, error: '', data });
    } catch (error) { setState({ loading: false, error: error.message || `${config.title} is unavailable.`, data: null }); }
  }, [config.title, view]);
  useEffect(() => { load(); }, [load]);
  const records = state.data?.records || [];
  const metrics = useMemo(() => Array.isArray(state.data?.metrics) ? state.data.metrics : [], [state.data]);
  const act = async (row, action) => {
    const key = `${row.id}:${action}`;
    setBusy(key); setMessage({ type: '', text: '' });
    try {
      await apiPost('/api/admin/nurse-marketplace', { view, action, entityId: row.id, expectedVersion: row.version, idempotencyKey: requestKey() });
      setMessage({ type: 'success', text: 'The authorized action was saved to the operational source.' });
      await load();
    } catch (error) { setMessage({ type: 'error', text: error.message || 'The action was not saved. Nothing changed.' }); } finally { setBusy(''); }
  };
  const prepareCandidate = async (payload) => {
    setBusy('prepare_offer_candidate'); setMessage({ type: '', text: '' });
    try {
      await apiPost('/api/admin/nurse-marketplace', { ...payload, idempotencyKey: requestKey() });
      setMessage({ type: 'success', text: 'The approved offer candidate was saved and queued for readiness evaluation. No assignment was created.' });
      await load();
    } catch (error) { setMessage({ type: 'error', text: error.message || 'The offer candidate was not prepared. Nothing changed.' }); } finally { setBusy(''); }
  };
  if (!state.loading && state.error && !state.data) return <AdminShell title={config.title}><OperationalSourceUnavailable title={`${config.title} unavailable`} description="No sample or cached records are shown. Every operational action remains disabled until the tenant-scoped persisted source reconnects." /></AdminShell>;
  return (
    <AdminShell title={config.title}>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-5 md:flex-row md:items-end md:justify-between"><div><p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/40">{config.eyebrow}</p><div className="mt-2 flex items-center gap-3"><Icon className="h-5 w-5 text-foreground/40" /><p className="max-w-2xl font-body text-[12px] leading-relaxed text-foreground/50">{config.description}</p></div></div><button type="button" onClick={load} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/14 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/60"><RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />Refresh</button></header>
        {message.text ? <p role="status" className={`rounded-xl border p-3 font-body text-[12px] ${message.type === 'error' ? 'border-red-300/20 bg-red-300/[0.05] text-red-200' : 'border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200'}`}>{message.text}</p> : null}
        {state.data?.policy_status && state.data.policy_status !== 'active' ? <div className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-amber-100"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p className="font-body text-[11px] leading-relaxed">{state.data.policy_message || 'Required human-approved policy is not active. Actions remain unavailable.'}</p></div> : null}
        {metrics.length ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={`${config.title} metrics`}>{metrics.map((metric) => <Metric key={metric.key || metric.label} label={metric.label || labelCase(metric.key)} value={metric.value} detail={metric.detail} />)}</section> : null}
        {view === 'dispatch' ? <OfferCandidatePreparation source={state.data?.offer_candidate_contexts} busy={busy === 'prepare_offer_candidate'} onPrepare={prepareCandidate} /> : null}
        <section className="grid gap-3">{records.map((row) => <OperationsCard key={row.id} row={row} view={view} busy={busy} onAction={act} />)}{state.loading ? <p className="flex items-center gap-2 p-6 font-body text-[12px] text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" />Loading persisted records</p> : null}{!state.loading && !records.length ? <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center"><Icon className="mx-auto h-6 w-6 text-foreground/30" /><p className="mt-3 font-heading text-3xl uppercase text-foreground">Nothing to review</p><p className="mt-1 font-body text-[12px] text-foreground/42">{config.empty}</p></div> : null}</section>
        {state.data?.updated_at ? <p className="text-center font-body text-[9px] uppercase tracking-[0.15em] text-foreground/30">Last verified {dateTime(state.data.updated_at)}</p> : null}
      </div>
    </AdminShell>
  );
}
