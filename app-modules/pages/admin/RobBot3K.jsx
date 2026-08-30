import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePause,
  ExternalLink,
  Filter,
  Gauge,
  ListChecks,
  Mail,
  Link2,
  MapPin,
  MessageCircleReply,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import PageShell from '@/components/admin/PageShell';
import { apiGet, apiPost } from '@/lib/apiClient';
import { assertApiResponse, hasObjectRows, invalidApiResponse } from '@/lib/apiResponse';

const TABS = [
  { key: 'research', label: 'Needs research' },
  { key: 'review', label: 'Ready for review' },
  { key: 'approved', label: 'Approved / active' },
  { key: 'stopped', label: 'Stopped' },
];

const PAGE_LIMIT = 100;

const DEFAULT_TOUCHES = [
  { order: 1, delayDays: 0, label: 'Introduction', subject: '', body: '' },
  { order: 2, delayDays: 3, label: 'Useful follow-up', subject: '', body: '' },
  { order: 3, delayDays: 7, label: 'Scheduling option', subject: '', body: '' },
  { order: 4, delayDays: 14, label: 'Close the loop', subject: '', body: '' },
];

const EMPTY_MANUAL_PROSPECT = {
  personName: '',
  company: '',
  title: '',
  email: '',
  website: '',
  sourceUrl: '',
  opportunityContext: '',
  notes: '',
  priority: 2,
  sourceVerified: false,
};

const BUTTON = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 font-body text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/55 disabled:cursor-not-allowed disabled:opacity-35';
const FIELD = 'min-h-11 w-full rounded-xl border border-foreground/12 bg-background/48 px-3 font-body text-[12px] text-foreground outline-none placeholder:text-foreground/30 focus:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/25';
const LABEL = 'mb-1.5 block font-body text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/45';

function text(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function dateTime(value) {
  if (!value) return 'Not scheduled';
  const valueAsDate = new Date(value);
  if (Number.isNaN(valueAsDate.getTime())) return text(value, 'Not scheduled');
  return valueAsDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function futureLocalDateTime(minutesAhead = 60) {
  const date = new Date(Date.now() + minutesAhead * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function stageFor(statusValue) {
  const status = text(statusValue).toLowerCase().replace(/[\s-]+/g, '_');
  if (['held', 'hold', 'rejected', 'revoked', 'suppressed', 'stopped', 'replied', 'reply', 'booked', 'completed', 'unsubscribed', 'bounced'].includes(status)) return 'stopped';
  if (['approved', 'active', 'outreach', 'sending', 'scheduled', 'awaiting_reply', 'in_sequence'].includes(status)) return 'approved';
  if (['ready', 'ready_for_review', 'review', 'draft_ready', 'pending_approval'].includes(status)) return 'review';
  return 'research';
}

function normalizedEvidence(item, index) {
  if (typeof item === 'string') return { label: item, source: 'Research note', url: '', official: false, id: `evidence-${index}` };
  return {
    id: item?.id || `evidence-${index}`,
    label: text(item?.label || item?.claim || item?.title, 'Research note'),
    source: text(item?.source || item?.publisher, 'Research note'),
    url: text(item?.url || item?.sourceUrl),
    official: item?.official === true || item?.isOfficial === true || text(item?.sourceType || item?.source_type).toLowerCase() === 'official',
  };
}

function normalizePriority(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && text(value).trim() !== '') {
    if (numeric >= 3) return 'High';
    if (numeric === 2) return 'Medium';
    return 'Low';
  }
  const label = text(value, 'Medium').trim();
  return label ? label.replace(/\b\w/g, (character) => character.toUpperCase()) : 'Medium';
}

function normalizeSenderSettings(value = {}) {
  const providerConnected = value.providerConnected ?? value.provider_connected;
  return {
    displayName: text(value.senderDisplayName || value.sender_display_name || value.displayName || value.display_name || value.senderName || value.sender_name, 'Avalon Vitality'),
    fromEmail: text(value.fromEmail || value.from_email),
    replyToEmail: text(value.replyToEmail || value.reply_to_email),
    calendlyUrl: text(value.calendlyUrl || value.calendly_url || value.bookingUrl || value.booking_url),
    postalAddress: text(value.physicalPostalAddress || value.physical_postal_address || value.postalAddress || value.postal_address || value.physicalAddress || value.physical_address),
    providerConnected: typeof providerConnected === 'boolean' ? providerConnected : undefined,
    providerStatus: text(value.providerStatus || value.provider_status),
    providerConnectUrl: text(value.providerConnectUrl || value.provider_connect_url),
    globalPause: value.globalPause ?? value.global_pause ?? true,
  };
}

function normalizeTouches(sequence) {
  const input = Array.isArray(sequence) ? sequence : [];
  return DEFAULT_TOUCHES.map((fallback, index) => {
    const item = input[index] || input.find((candidate) => Number(candidate?.order) === index + 1) || {};
    return {
      ...fallback,
      ...item,
      order: index + 1,
      delayDays: Number.isFinite(Number(item.delayDays ?? item.delay_days)) ? Number(item.delayDays ?? item.delay_days) : fallback.delayDays,
      label: text(item.label, fallback.label),
      subject: text(item.subject),
      body: text(item.body),
    };
  });
}

function normalizeProspect(item, index = 0) {
  const evidenceInput = Array.isArray(item?.evidence)
    ? item.evidence
    : Array.isArray(item?.publicSources || item?.public_sources)
      ? (item.publicSources || item.public_sources)
      : Array.isArray(item?.draftEvidence || item?.draft_evidence)
        ? (item.draftEvidence || item.draft_evidence)
        : Array.isArray(item?.research)
          ? item.research
          : [];
  const sourceValue = item?.source || {};
  const contactValue = item?.contact || {};
  const crmValue = item?.crm || {};
  const sourceKind = text(item?.sourceKind || item?.source_kind).toLowerCase();
  return {
    ...item,
    id: item?.id || item?.prospectId || `prospect-${index}`,
    organization: text(item?.organization || item?.organizationName || item?.company || item?.name, 'Unnamed organization'),
    segment: text(item?.segment || item?.category, 'Uncategorized'),
    priority: normalizePriority(item?.priority),
    status: text(item?.status || item?.stage, 'needs_research'),
    confidence: Math.max(0, Math.min(100, Number(item?.confidence ?? item?.confidenceScore) || 0)),
    evidence: evidenceInput.map(normalizedEvidence),
    officialEvidence: item?.officialEvidence === true
      || item?.hasOfficialEvidence === true
      || evidenceInput.some((evidence) => evidence?.official === true || evidence?.isOfficial === true || text(evidence?.sourceType || evidence?.source_type).toLowerCase() === 'official'),
    source: typeof sourceValue === 'string'
      ? { label: sourceValue, url: text(item?.sourceUrl) }
      : { label: text(sourceValue?.label || sourceValue?.name || item?.sourceKind || item?.source_kind, 'Atlas research').replace(/_/g, ' '), url: text(sourceValue?.url || item?.sourceUrl || item?.source_url) },
    sourceKind,
    manualEntry: item?.manualEntry === true || item?.manual_entry === true || sourceKind === 'manual',
    opportunityContext: text(item?.opportunityContext || item?.opportunity_context || item?.researchSummary || item?.research_summary),
    manualNotes: text(item?.manualNotes || item?.manual_notes),
    contact: {
      name: text(contactValue?.name || item?.contactName),
      role: text(contactValue?.role || item?.contactRole),
      email: text(contactValue?.email || item?.contactEmail),
    },
    emailStatus: text(item?.emailStatus || item?.email_status || item?.verification, 'Not verified').replace(/_/g, ' '),
    manualVerified: item?.manualVerified === true
      || item?.manuallyVerified === true
      || item?.emailVerification?.manual === true
      || ['manual_verified', 'manually_verified'].includes(text(item?.verification).toLowerCase()),
    sequence: normalizeTouches(item?.sequence || item?.draftSteps || item?.draft_steps || item?.drafts || item?.touches),
    nextAction: text(item?.nextAction || item?.next_action),
    nextDueAt: item?.nextDueAt || item?.next_due_at || item?.sequenceState?.nextDueAt || item?.sequence_state?.next_due_at || null,
    currentTouch: Number(item?.currentTouch ?? item?.current_touch ?? item?.sequenceState?.currentTouch ?? item?.sequence_state?.current_step) || 0,
    stopReason: text(item?.stopReason || item?.stop_reason || item?.sequenceState?.stopReason || item?.sequence_state?.stop_reason),
    companyId: item?.companyId || item?.company_id || crmValue.companyId || crmValue.company_id || null,
    personId: item?.personId || item?.person_id || crmValue.personId || crmValue.person_id || null,
    opportunityId: item?.opportunityId || item?.opportunity_id || crmValue.opportunityId || crmValue.opportunity_id || null,
  };
}

function countsFor(prospects) {
  const counts = { research: 0, review: 0, approved: 0, stopped: 0 };
  prospects.forEach((prospect) => { counts[stageFor(prospect.status)] += 1; });
  return counts;
}

function derivedStats(prospects) {
  const counts = countsFor(prospects);
  return {
    researchedToday: counts.research,
    readyForReview: counts.review,
    dueToday: prospects.filter((prospect) => stageFor(prospect.status) === 'approved' && prospect.nextDueAt).length,
    activeSequences: counts.approved,
    totalReplies: prospects.filter((prospect) => ['replied', 'reply'].includes(text(prospect.status).toLowerCase())).length,
    totalCallsBooked: prospects.filter((prospect) => text(prospect.status).toLowerCase() === 'booked').length,
  };
}

function mergeApiData(data, previous = []) {
  if (Array.isArray(data?.prospects)) return data.prospects.map(normalizeProspect);
  if (data?.prospect) {
    const next = normalizeProspect(data.prospect);
    return previous.some((item) => item.id === next.id)
      ? previous.map((item) => (item.id === next.id ? next : item))
      : [...previous, next];
  }
  return previous;
}

function statusLabel(prospect) {
  const status = text(prospect.status).toLowerCase().replace(/_/g, ' ');
  if (status === 'needs research') return 'Needs research';
  if (status === 'ready for review') return 'Ready for review';
  return status ? status.replace(/\b\w/g, (character) => character.toUpperCase()) : 'Unknown';
}

function priorityTone(priority) {
  const value = text(priority).toLowerCase();
  if (value === 'high' || value === 'urgent') return 'border-amber-300/25 bg-amber-300/[0.07] text-amber-200';
  if (value === 'low') return 'border-foreground/10 bg-background/45 text-foreground/45';
  return 'border-sky-300/20 bg-sky-300/[0.06] text-sky-200';
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <div className="av-glass rounded-xl border border-foreground/10 bg-background/58 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/45">{label}</p>
        <Icon className="h-4 w-4 text-foreground/35" strokeWidth={1.6} aria-hidden="true" />
      </div>
      <p className="mt-3 font-heading text-4xl uppercase leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-1 font-body text-[10px] leading-snug text-foreground/40">{detail}</p>
    </div>
  );
}

function EngineMap({ config }) {
  const providerConnected = config?.providerConnected === true;
  const stages = [
    ['Signals', 'Atlas connected', 'live'],
    ['Enrich', 'Source-backed now; web scouts staged', 'mixed'],
    ['Map', 'Human-verified decision maker', 'gate'],
    ['Score', 'Priority + confidence', 'live'],
    ['Outreach', providerConnected ? 'Provider connected' : 'Provider staged', providerConnected ? 'live' : 'staged'],
    ['Learn', 'Outcomes recorded; adaptive weights staged', 'mixed'],
  ];
  const tone = {
    live: 'border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-200',
    gate: 'border-sky-300/20 bg-sky-300/[0.045] text-sky-200',
    mixed: 'border-amber-300/18 bg-amber-300/[0.035] text-amber-100',
    staged: 'border-foreground/10 bg-background/45 text-foreground/48',
  };
  return (
    <section aria-labelledby="engine-map-title">
      <div className="mb-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/40">Event-driven engine</p>
        <h2 id="engine-map-title" className="mt-1 font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Signal to qualified call</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {stages.map(([label, detail, status], index) => (
          <div key={label} className={`rounded-xl border p-3 ${tone[status] || tone.staged}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-body text-[9px] font-semibold uppercase tracking-[0.17em]">{index + 1}. {label}</p>
              <span className="font-body text-[8px] font-bold uppercase tracking-[0.14em] opacity-60">{status}</span>
            </div>
            <p className="mt-2 font-body text-[10px] leading-relaxed text-foreground/52">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SafetyPanel({ config, run }) {
  const providerConnected = config?.providerConnected !== false;
  const live = providerConnected && (config?.liveSendEnabled === true || text(config?.sendMode).toLowerCase() === 'live');
  const globallyPaused = config?.globalPause !== false;
  const modeLabel = globallyPaused
    ? 'Globally paused · no sends'
    : !providerConnected
    ? 'Provider not connected · dry run'
    : live
      ? 'Live send enabled'
      : 'Dry run · live send off';
  return (
    <section className={`rounded-xl border p-4 ${live && !globallyPaused ? 'border-emerald-300/24 bg-emerald-300/[0.05]' : 'border-amber-300/24 bg-amber-300/[0.05]'}`} aria-label="Outreach safety status">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${live && !globallyPaused ? 'border-emerald-300/24 text-emerald-200' : 'border-amber-300/24 text-amber-200'}`}>
            <ShieldCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/50">Human-gated sending</p>
              <span className={`rounded-full border px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.16em] ${live && !globallyPaused ? 'border-emerald-300/25 text-emerald-200' : 'border-amber-300/25 text-amber-200'}`}>
                {modeLabel}
              </span>
            </div>
            <p className="mt-2 max-w-3xl font-body text-[12px] leading-relaxed text-foreground/62">
              {live && !globallyPaused
                ? 'Only individually approved prospects can send Monday-Friday, 9:00 AM-5:00 PM Pacific. Research, drafts, and verified contact details remain human decisions.'
                : 'RobBot3K can research, prepare exact drafts, and simulate due work. No email leaves Avalon until live sending is explicitly configured.'}
            </p>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 font-body text-[10px] lg:text-right">
          <div><dt className="uppercase tracking-[0.16em] text-foreground/35">Last Atlas refresh</dt><dd className="mt-0.5 text-foreground/68">{dateTime(run?.lastRefreshAt || run?.last_refreshed_at)}</dd></div>
          <div><dt className="uppercase tracking-[0.16em] text-foreground/35">Last execution</dt><dd className="mt-0.5 text-foreground/68">{dateTime(run?.lastExecuteAt || run?.last_executed_at)}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function validateSenderSettings(settings) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (settings.displayName.trim().length < 2) errors.displayName = 'Enter the sender name recipients should see.';
  if (!emailPattern.test(settings.fromEmail.trim())) errors.fromEmail = 'Enter a valid From email.';
  if (!emailPattern.test(settings.replyToEmail.trim())) errors.replyToEmail = 'Enter a valid Reply-to email.';
  try {
    const url = new URL(settings.calendlyUrl);
    if (url.protocol !== 'https:' || !/(^|\.)calendly\.com$/i.test(url.hostname)) throw new Error('invalid');
  } catch {
    errors.calendlyUrl = 'Use a complete https://calendly.com scheduling URL.';
  }
  if (settings.postalAddress.trim().length < 10) errors.postalAddress = 'Enter the physical postal address required in outreach.';
  return errors;
}

function SenderSettingsPanel({ settings, config, saving, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => normalizeSenderSettings(settings));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(normalizeSenderSettings(settings));
    setErrors({});
  }, [settings]);

  const providerConnected = settings?.providerConnected ?? config?.providerConnected ?? false;
  const configuredProviderStatus = text(settings?.providerStatus || config?.providerStatus);
  const providerStatus = providerConnected ? (configuredProviderStatus || 'Provider connected') : 'Provider disconnected';
  const connectUrl = text(settings?.providerConnectUrl || config?.providerConnectUrl);
  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validateSenderSettings(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave({
      senderDisplayName: form.displayName.trim(),
      fromEmail: form.fromEmail.trim().toLowerCase(),
      replyToEmail: form.replyToEmail.trim().toLowerCase(),
      calendlyUrl: form.calendlyUrl.trim(),
      physicalPostalAddress: form.postalAddress.trim(),
      globalPause: form.globalPause !== false,
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-foreground/10 bg-background/48" aria-labelledby="sender-settings-title">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/48">
            <Settings2 className="h-4 w-4 text-foreground/48" strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="sender-settings-title" className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Sender settings</h2>
              <span className={`rounded-full border px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.14em] ${providerConnected ? 'border-emerald-300/22 bg-emerald-300/[0.05] text-emerald-200' : 'border-amber-300/22 bg-amber-300/[0.05] text-amber-200'}`}>
                {providerConnected ? providerStatus : 'Provider disconnected'}
              </span>
            </div>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/46">
              {form.displayName || 'Sender not configured'} · {form.fromEmail || 'From email required'} · Replies to {form.replyToEmail || 'not configured'}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)} className={`${BUTTON} border-foreground/14 bg-background/52 text-foreground/62 hover:text-foreground`} aria-expanded={expanded} aria-controls="robbot-sender-settings-form">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
          {expanded ? 'Close settings' : 'Review sender'}
        </button>
      </div>

      {expanded ? (
        <form id="robbot-sender-settings-form" onSubmit={submit} className="border-t border-foreground/8 bg-foreground/[0.018] p-4 md:p-5" noValidate>
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="rounded-xl border border-amber-300/18 bg-amber-300/[0.04] p-3">
              <p className="font-body text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">Mailbox security</p>
              <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/55">Connect the sending mailbox through an approved OAuth/provider flow. RobBot3K never asks for or stores a mailbox password.</p>
            </div>
            {connectUrl ? (
              <a href={connectUrl} target="_blank" rel="noreferrer" className={`${BUTTON} border-sky-300/22 bg-sky-300/[0.07] text-sky-200`}>
                <Link2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />Connect via OAuth/provider<ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : (
              <button type="button" disabled className={`${BUTTON} border-foreground/12 bg-background/42 text-foreground/42`} title="No approved provider connection is configured yet.">
                <Link2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />Connect via OAuth/provider
              </button>
            )}
          </div>

          <label className="mb-4 flex min-h-12 cursor-pointer items-start gap-2 rounded-xl border border-amber-300/18 bg-amber-300/[0.04] px-3 py-3 font-body text-[10px] leading-relaxed text-foreground/55">
            <input type="checkbox" checked={form.globalPause !== false} onChange={(event) => setField('globalPause', event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
            <span><strong className="font-semibold text-foreground/72">Pause all outreach.</strong> Keep this checked until the sender, provider, approvals, and live-send gate are deliberately ready. Dry-run research remains available.</span>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={LABEL}>Sender display name</span>
              <input value={form.displayName} onChange={(event) => setField('displayName', event.target.value)} className={FIELD} placeholder="Avalon Vitality" aria-invalid={Boolean(errors.displayName)} />
              {errors.displayName ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.displayName}</span> : null}
            </label>
            <label>
              <span className={LABEL}>From email</span>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" aria-hidden="true" /><input type="email" value={form.fromEmail} onChange={(event) => setField('fromEmail', event.target.value)} className={`${FIELD} pl-9`} placeholder="outreach@avalonvitality.co" autoComplete="off" aria-invalid={Boolean(errors.fromEmail)} /></div>
              {errors.fromEmail ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.fromEmail}</span> : null}
            </label>
            <label>
              <span className={LABEL}>Reply-to email</span>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" aria-hidden="true" /><input type="email" value={form.replyToEmail} onChange={(event) => setField('replyToEmail', event.target.value)} className={`${FIELD} pl-9`} placeholder="team@avalonvitality.co" autoComplete="off" aria-invalid={Boolean(errors.replyToEmail)} /></div>
              {errors.replyToEmail ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.replyToEmail}</span> : null}
            </label>
            <label>
              <span className={LABEL}>Calendly URL</span>
              <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" aria-hidden="true" /><input type="url" value={form.calendlyUrl} onChange={(event) => setField('calendlyUrl', event.target.value)} className={`${FIELD} pl-9`} placeholder="https://calendly.com/avalon/..." autoComplete="off" aria-invalid={Boolean(errors.calendlyUrl)} /></div>
              {errors.calendlyUrl ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.calendlyUrl}</span> : null}
            </label>
            <label className="md:col-span-2">
              <span className={LABEL}>Physical postal address</span>
              <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3.5 h-3.5 w-3.5 text-foreground/30" aria-hidden="true" /><textarea value={form.postalAddress} onChange={(event) => setField('postalAddress', event.target.value)} rows={2} className={`${FIELD} min-h-[5rem] resize-y py-3 pl-9`} placeholder="Street, city, state, ZIP" aria-invalid={Boolean(errors.postalAddress)} /></div>
              {errors.postalAddress ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.postalAddress}</span> : null}
              <span className="mt-1 block font-body text-[9px] leading-relaxed text-foreground/36">Included in compliant outreach. Use Avalon's real business mailing address.</span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-[10px] text-foreground/40">Saving settings does not enable live outreach. Provider connection and the server-side live-send gate remain separate.</p>
            <button type="submit" disabled={saving} className={`${BUTTON} border-foreground bg-foreground text-background`}>
              <Save className="h-3.5 w-3.5" aria-hidden="true" />{saving ? 'Saving…' : 'Save sender settings'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function validateManualProspect(form) {
  const errors = {};
  if (form.company.trim().length < 2) errors.company = 'Enter the company name.';
  if (form.personName.trim() && form.personName.trim().length < 2) errors.personName = 'Enter the contact’s full name or leave it blank.';
  if (form.title.trim() && form.title.trim().length < 2) errors.title = 'Enter the contact’s role or leave it blank.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address or leave it blank for research.';
  if (!form.website.trim() && !form.sourceUrl.trim()) errors.website = 'Add a company website, domain, or public source URL.';
  if (form.opportunityContext.trim().length < 12) errors.opportunityContext = 'Add enough context for RobBot3K to research and personalize the outreach.';
  return errors;
}

function ManualProspectPanel({ saving, onCreate }) {
  const [expanded, setExpanded] = useState(true);
  const [form, setForm] = useState(EMPTY_MANUAL_PROSPECT);
  const [errors, setErrors] = useState({});
  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateManualProspect(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = await onCreate({
      ...form,
      personName: form.personName.trim(),
      company: form.company.trim(),
      title: form.title.trim(),
      email: form.email.trim().toLowerCase(),
      website: form.website.trim(),
      sourceUrl: form.sourceUrl.trim(),
      opportunityContext: form.opportunityContext.trim(),
      notes: form.notes.trim(),
    });
    if (result) {
      setForm(EMPTY_MANUAL_PROSPECT);
      setErrors({});
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-sky-300/16 bg-sky-300/[0.025]" aria-labelledby="manual-prospect-title">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-300/18 bg-sky-300/[0.05]">
            <UserPlus className="h-4 w-4 text-sky-200" strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="manual-prospect-title" className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Add a contact</h2>
              <span className="rounded-full border border-sky-300/22 px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-200">Manual source</span>
              <span className="rounded-full border border-amber-300/22 px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200">Never auto-sends</span>
            </div>
            <p className="mt-1 max-w-3xl font-body text-[11px] leading-relaxed text-foreground/48">Insert a person or company directly into the same research, draft, verification, and approval pipeline. Duplicate emails update the existing open record instead of creating another sequence.</p>
          </div>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)} className={`${BUTTON} border-foreground/14 bg-background/52 text-foreground/62 hover:text-foreground`} aria-expanded={expanded} aria-controls="robbot-manual-prospect-form">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
          {expanded ? 'Close form' : 'Add person or company'}
        </button>
      </div>

      {expanded ? (
        <form id="robbot-manual-prospect-form" onSubmit={submit} className="border-t border-foreground/8 bg-background/28 p-4 md:p-5" noValidate>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label>
              <span className={LABEL}>Person name · optional</span>
              <input value={form.personName} onChange={(event) => setField('personName', event.target.value)} className={FIELD} placeholder="Full name" maxLength={160} aria-invalid={Boolean(errors.personName)} />
              {errors.personName ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.personName}</span> : null}
            </label>
            <label>
              <span className={LABEL}>Company</span>
              <input value={form.company} onChange={(event) => setField('company', event.target.value)} className={FIELD} placeholder="Company name" maxLength={240} aria-invalid={Boolean(errors.company)} />
              {errors.company ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.company}</span> : null}
            </label>
            <label>
              <span className={LABEL}>Title / role · optional</span>
              <input value={form.title} onChange={(event) => setField('title', event.target.value)} className={FIELD} placeholder="CEO, People, Events…" maxLength={160} aria-invalid={Boolean(errors.title)} />
              {errors.title ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.title}</span> : null}
            </label>
            <label>
              <span className={LABEL}>Email · optional</span>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" aria-hidden="true" /><input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} className={`${FIELD} pl-9`} placeholder="name@company.com" maxLength={320} autoComplete="off" aria-invalid={Boolean(errors.email)} /></div>
              {errors.email ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.email}</span> : null}
            </label>
            <label>
              <span className={LABEL}>Company website / domain</span>
              <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" aria-hidden="true" /><input value={form.website} onChange={(event) => setField('website', event.target.value)} className={`${FIELD} pl-9`} placeholder="company.com" maxLength={2000} autoComplete="off" aria-invalid={Boolean(errors.website)} /></div>
              {errors.website ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.website}</span> : null}
            </label>
            <label>
              <span className={LABEL}>Additional source URL · optional</span>
              <div className="relative"><ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" aria-hidden="true" /><input type="url" value={form.sourceUrl} onChange={(event) => setField('sourceUrl', event.target.value)} className={`${FIELD} pl-9`} placeholder="https://company.com/team" maxLength={2000} autoComplete="off" /></div>
            </label>
            <label className="md:col-span-2 xl:col-span-3">
              <span className={LABEL}>Opportunity / context</span>
              <textarea value={form.opportunityContext} onChange={(event) => setField('opportunityContext', event.target.value)} rows={3} className={`${FIELD} min-h-[6.5rem] resize-y py-3 leading-relaxed`} placeholder="Why this person or company may be a fit, the signal you saw, and the outcome we should explore." maxLength={2000} aria-invalid={Boolean(errors.opportunityContext)} />
              {errors.opportunityContext ? <span className="mt-1 block font-body text-[10px] text-red-200">{errors.opportunityContext}</span> : null}
            </label>
            <label className="md:col-span-2 xl:col-span-3">
              <span className={LABEL}>Internal notes · optional</span>
              <textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} rows={2} className={`${FIELD} min-h-[5rem] resize-y py-3 leading-relaxed`} placeholder="Internal-only context. Never inserted into outreach automatically." maxLength={4000} />
            </label>
          </div>

          <div className="mt-4">
            <label className="flex min-h-12 cursor-pointer items-start gap-2 rounded-xl border border-foreground/10 bg-background/38 px-3 py-3 font-body text-[10px] leading-relaxed text-foreground/55">
              <input type="checkbox" checked={form.sourceVerified} onChange={(event) => setField('sourceVerified', event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
              <span><strong className="font-semibold text-foreground/72">Source checked.</strong> I reviewed the company or recipient’s first-party source. If unchecked, the record stays in Needs research and cannot be approved.</span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/8 pt-4">
            <p className="max-w-3xl font-body text-[10px] leading-relaxed text-foreground/42">A name can enter research before an email is known. Adding a contact only prepares research and draft copy; email verification and approval remain separate human actions, and this form cannot send.</p>
            <button type="submit" disabled={saving} className={`${BUTTON} border-foreground bg-foreground text-background`}>
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{saving ? 'Adding…' : 'Add to research queue'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ApprovalGate({ prospect, form, senderReady }) {
  const emailPresent = /.+@.+\..+/.test(form.contact.email.trim());
  const draftReady = form.sequence.length === 4 && form.sequence.every((touch) => touch.subject.trim() && touch.body.trim());
  const gates = [
    { label: 'Official evidence', ready: prospect.officialEvidence },
    { label: 'Contact email', ready: emailPresent },
    { label: 'Human verified', ready: prospect.manualVerified },
    { label: '4 exact drafts', ready: draftReady },
    { label: 'Sender settings', ready: senderReady },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Approval requirements">
      {gates.map((gate) => (
        <div key={gate.label} className={`rounded-lg border px-3 py-2 ${gate.ready ? 'border-emerald-300/18 bg-emerald-300/[0.045]' : 'border-foreground/10 bg-background/42'}`}>
          <div className="flex items-center gap-1.5">
            {gate.ready
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-200" strokeWidth={2} aria-hidden="true" />
              : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-200/70" strokeWidth={2} aria-hidden="true" />}
            <span className="font-body text-[9px] font-semibold uppercase tracking-[0.13em] text-foreground/58">{gate.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidencePanel({ prospect }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/38 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/42">Evidence used for personalization</p>
        <span className="font-body text-[9px] uppercase tracking-[0.14em] text-foreground/36">{prospect.evidence.length} source{prospect.evidence.length === 1 ? '' : 's'}</span>
      </div>
      {prospect.evidence.length ? (
        <ul className="mt-2 space-y-2">
          {prospect.evidence.map((evidence) => (
            <li key={evidence.id} className="flex items-start justify-between gap-3 rounded-lg border border-foreground/8 bg-background/45 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-body text-[11px] leading-snug text-foreground/70">{evidence.label}</span>
                  {evidence.official ? <span className="rounded-full border border-emerald-300/20 px-1.5 py-0.5 font-body text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Official</span> : null}
                </div>
                <p className="mt-0.5 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/34">{evidence.source}</p>
              </div>
              {evidence.url ? (
                <a href={evidence.url} target="_blank" rel="noreferrer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-foreground/42 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50" aria-label={`Open source for ${evidence.label}`}>
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 font-body text-[11px] text-foreground/40">No source-backed evidence yet. Approval stays locked.</p>}
    </div>
  );
}

function SequenceEditor({ sequence, onChange, disabled }) {
  const setTouch = (index, field, value) => onChange(sequence.map((touch, touchIndex) => (touchIndex === index ? { ...touch, [field]: value } : touch)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/42">Exact approved copy</p>
          <p className="mt-1 font-body text-[11px] leading-snug text-foreground/45">Four touches maximum. Edit every subject and body before approval.</p>
        </div>
        <span className="rounded-full border border-foreground/10 bg-background/45 px-3 py-1.5 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/48">Days 0 · 3 · 7 · 14</span>
      </div>
      {sequence.map((touch, index) => (
        <fieldset key={touch.order} className="rounded-xl border border-foreground/10 bg-background/40 p-3" disabled={disabled}>
          <legend className="px-1 font-body text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/52">Touch {index + 1} · Day {touch.delayDays} · {touch.label}</legend>
          <label className="mt-2 block">
            <span className={LABEL}>Subject</span>
            <input value={touch.subject} onChange={(event) => setTouch(index, 'subject', event.target.value)} className={FIELD} placeholder="Exact email subject" />
          </label>
          <label className="mt-3 block">
            <span className={LABEL}>Body</span>
            <textarea value={touch.body} onChange={(event) => setTouch(index, 'body', event.target.value)} rows={7} className={`${FIELD} min-h-[11rem] resize-y py-3 leading-relaxed`} placeholder="Exact email body, including the scheduling link token" />
          </label>
        </fieldset>
      ))}
    </div>
  );
}

function ProspectCard({ prospect, busy, onAction, settings }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [manualCheck, setManualCheck] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState(() => ({ scheduledAt: futureLocalDateTime(), bookingUrl: '' }));
  const [bookingError, setBookingError] = useState('');
  const [form, setForm] = useState(() => ({ contact: { ...prospect.contact }, sequence: normalizeTouches(prospect.sequence) }));

  useEffect(() => {
    setForm({ contact: { ...prospect.contact }, sequence: normalizeTouches(prospect.sequence) });
    setManualCheck(false);
    setBookingOpen(false);
    setBooking({ scheduledAt: futureLocalDateTime(), bookingUrl: '' });
    setBookingError('');
  }, [prospect]);

  const updateContact = (key, value) => setForm((current) => ({ ...current, contact: { ...current.contact, [key]: value } }));
  const updateSequence = (sequence) => setForm((current) => ({ ...current, sequence }));
  const draftReady = form.sequence.length === 4 && form.sequence.every((touch) => touch.subject.trim() && touch.body.trim());
  const emailPresent = /.+@.+\..+/.test(form.contact.email.trim());
  const senderReady = Boolean(
    settings?.displayName?.trim()
    && settings?.fromEmail?.trim()
    && settings?.replyToEmail?.trim()
    && settings?.calendlyUrl?.trim()
    && settings?.postalAddress?.trim()
  );
  const canApprove = prospect.officialEvidence && emailPresent && prospect.manualVerified && draftReady && senderReady;
  const stage = stageFor(prospect.status);
  const actionBusy = busy.startsWith(`${prospect.id}:`);
  const payload = { contact: form.contact, sequence: form.sequence };
  const crmTarget = prospect.opportunityId
    ? `/admin/bd/pipeline/${prospect.opportunityId}`
    : prospect.personId
      ? `/admin/bd/people/${prospect.personId}`
      : prospect.companyId
        ? `/admin/bd/companies/${prospect.companyId}`
        : '';
  const submitBooking = (event) => {
    event.preventDefault();
    setBookingError('');
    const scheduled = new Date(booking.scheduledAt);
    if (!booking.scheduledAt || Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
      setBookingError('Choose a future call date and time.');
      return;
    }
    onAction('mark_booked', prospect, {
      scheduledAt: scheduled.toISOString(),
      bookingUrl: booking.bookingUrl.trim() || undefined,
    });
  };

  return (
    <article className="av-glass overflow-hidden rounded-xl border border-foreground/10 bg-background/58">
      <div className="p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.15em] ${priorityTone(prospect.priority)}`}>{prospect.priority} priority</span>
              <span className="rounded-full border border-foreground/10 bg-background/45 px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/50">{statusLabel(prospect)}</span>
              <span className="rounded-full border border-foreground/10 bg-background/45 px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/50">{prospect.segment}</span>
              {prospect.manualEntry ? <span className="rounded-full border border-sky-300/20 bg-sky-300/[0.05] px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-200">Manual source</span> : null}
            </div>
            <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">{prospect.organization}</h2>
            <p className="mt-2 max-w-3xl font-body text-[11px] leading-relaxed text-foreground/48">{prospect.nextAction || (stage === 'research' ? 'Research the organization and relevant contact before review.' : 'Review the record and choose the next human-controlled action.')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 xl:text-right">
            <div>
              <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">{prospect.confidence}%</p>
              <p className="mt-1 font-body text-[9px] uppercase tracking-[0.17em] text-foreground/34">Confidence</p>
            </div>
            <Gauge className="h-5 w-5 text-foreground/28" strokeWidth={1.5} aria-hidden="true" />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.17em] text-foreground/34">Contact</p>
            <p className="mt-1 truncate font-body text-[11px] font-semibold text-foreground/68">{prospect.contact.name || 'Not identified'}</p>
            <p className="truncate font-body text-[10px] text-foreground/40">{prospect.contact.role || 'Role missing'}</p>
          </div>
          <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.17em] text-foreground/34">Email status</p>
            <p className="mt-1 truncate font-body text-[11px] font-semibold text-foreground/68">{prospect.emailStatus}</p>
            <p className="truncate font-body text-[10px] text-foreground/40">{prospect.contact.email || 'No address'}</p>
          </div>
          <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.17em] text-foreground/34">Source</p>
            {prospect.source.url ? <a href={prospect.source.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-6 items-center gap-1 font-body text-[11px] font-semibold text-foreground/68 underline decoration-foreground/20 underline-offset-4 hover:text-foreground">{prospect.source.label}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : <p className="mt-1 font-body text-[11px] font-semibold text-foreground/68">{prospect.source.label}</p>}
            <p className="font-body text-[10px] text-foreground/40">{prospect.officialEvidence ? 'Official evidence present' : 'Official evidence required'}</p>
          </div>
          <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.17em] text-foreground/34">Sequence</p>
            <p className="mt-1 font-body text-[11px] font-semibold text-foreground/68">{stage === 'approved' ? `Touch ${Math.max(1, prospect.currentTouch || 1)} of 4` : draftReady ? '4 drafts complete' : 'Draft incomplete'}</p>
            <p className="font-body text-[10px] text-foreground/40">{stage === 'approved' ? `Due ${dateTime(prospect.nextDueAt)}` : 'Nothing sends before approval'}</p>
          </div>
        </div>

        <div className="mt-4">
          <ApprovalGate prospect={prospect} form={form} senderReady={senderReady} />
        </div>

        {prospect.stopReason ? <div className="mt-4 rounded-lg border border-foreground/10 bg-background/40 px-3 py-2.5 font-body text-[11px] text-foreground/55"><Ban className="mr-2 inline h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />{prospect.stopReason}</div> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setExpanded((value) => !value)} className={`${BUTTON} border-foreground/14 bg-background/48 text-foreground/65 hover:text-foreground`} aria-expanded={expanded}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            {expanded ? 'Close review' : 'Review contact & exact copy'}
          </button>

          {crmTarget ? <button type="button" onClick={() => navigate(crmTarget)} className={`${BUTTON} border-violet-300/22 bg-violet-300/[0.06] text-violet-200`}><Link2 className="h-3.5 w-3.5" aria-hidden="true" />Open CRM record</button> : null}

          {!prospect.manualVerified && (
            <button type="button" onClick={() => onAction('update_prospect', prospect, { ...payload, updateKind: 'verify-email', manualConfirmation: true })} disabled={actionBusy || !emailPresent || !manualCheck} title={!manualCheck ? 'Confirm the manual email check first.' : undefined} className={`${BUTTON} border-sky-300/22 bg-sky-300/[0.07] text-sky-200`}>
              <UserCheck className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />Verify email
            </button>
          )}

          {stage === 'review' || stage === 'research' ? (
            <button type="button" onClick={() => onAction('approve', prospect, payload)} disabled={!canApprove || actionBusy} title={disabledTitle || (!canApprove ? 'Official evidence, sender settings, a contact email, human verification, and all four drafts are required.' : undefined)} className={`${BUTTON} border-emerald-300/24 bg-emerald-300/[0.09] text-emerald-200`}>
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />Approve 4-touch sequence
            </button>
          ) : null}

          {stage === 'approved' ? (
            <>
              <button type="button" onClick={() => onAction('revoke', prospect)} disabled={actionBusy} className={`${BUTTON} border-amber-300/22 bg-amber-300/[0.06] text-amber-200`}><CirclePause className="h-3.5 w-3.5" aria-hidden="true" />Revoke</button>
              <button type="button" onClick={() => onAction('mark_reply', prospect)} disabled={actionBusy} className={`${BUTTON} border-sky-300/22 bg-sky-300/[0.06] text-sky-200`}><MessageCircleReply className="h-3.5 w-3.5" aria-hidden="true" />Mark reply</button>
              <button type="button" onClick={() => { setBookingOpen((value) => !value); setBookingError(''); }} disabled={actionBusy} className={`${BUTTON} border-emerald-300/22 bg-emerald-300/[0.07] text-emerald-200`} aria-expanded={bookingOpen}><CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />Book call</button>
            </>
          ) : null}

          {stage !== 'stopped' ? (
            <>
              <button type="button" onClick={() => onAction('hold', prospect)} disabled={actionBusy} className={`${BUTTON} border-foreground/12 bg-background/42 text-foreground/55 hover:text-foreground`}><CirclePause className="h-3.5 w-3.5" aria-hidden="true" />Hold</button>
              <button type="button" onClick={() => onAction('reject', prospect)} disabled={actionBusy} className={`${BUTTON} border-foreground/12 bg-background/42 text-foreground/55 hover:text-foreground`}><XCircle className="h-3.5 w-3.5" aria-hidden="true" />Reject</button>
            </>
          ) : null}

          <button type="button" onClick={() => onAction('suppress', prospect)} disabled={actionBusy || text(prospect.status).toLowerCase() === 'suppressed'} className={`${BUTTON} border-red-300/20 bg-red-300/[0.05] text-red-200`}><Ban className="h-3.5 w-3.5" aria-hidden="true" />Suppress</button>
        </div>

        {stage === 'approved' && bookingOpen ? (
          <form onSubmit={submitBooking} className="mt-3 grid gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.045] p-3 sm:grid-cols-[minmax(190px,0.8fr)_minmax(220px,1.2fr)_auto] sm:items-end">
            <label><span className={`${LABEL} text-emerald-100/65`}>Call date and time *</span><input type="datetime-local" required min={futureLocalDateTime(1)} value={booking.scheduledAt} onChange={(event) => setBooking((current) => ({ ...current, scheduledAt: event.target.value }))} className={FIELD} /></label>
            <label><span className={`${LABEL} text-emerald-100/65`}>Booking URL · optional</span><input type="url" value={booking.bookingUrl} onChange={(event) => setBooking((current) => ({ ...current, bookingUrl: event.target.value }))} placeholder="https://calendly.com/…" className={FIELD} /></label>
            <button type="submit" disabled={actionBusy || !booking.scheduledAt} className={`${BUTTON} border-emerald-200 bg-emerald-200 text-stone-950`}>{actionBusy ? 'Saving…' : 'Confirm booking'}</button>
            {bookingError ? <p role="alert" className="font-body text-[10px] text-red-200 sm:col-span-3">{bookingError}</p> : <p className="font-body text-[9px] leading-relaxed text-emerald-100/55 sm:col-span-3">A required future time is saved to Home. Booking stops the remaining outreach sequence.</p>}
          </form>
        ) : null}

        {!prospect.manualVerified ? (
          <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-foreground/8 bg-background/35 px-3 py-2.5 font-body text-[10px] leading-relaxed text-foreground/52">
            <input type="checkbox" checked={manualCheck} onChange={(event) => setManualCheck(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
            <span>I personally checked this address against an official company source or a trusted first-party record. This confirmation is never selected automatically.</span>
          </label>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-foreground/8 bg-foreground/[0.018] p-4 md:p-5">
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-foreground/10 bg-background/42 p-3">
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/42">Human owner</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label><span className={LABEL}>Contact name</span><input value={form.contact.name} onChange={(event) => updateContact('name', event.target.value)} className={FIELD} placeholder="Full name" /></label>
                  <label><span className={LABEL}>Role</span><input value={form.contact.role} onChange={(event) => updateContact('role', event.target.value)} className={FIELD} placeholder="People, events, workplace…" /></label>
                  <label className="sm:col-span-2 xl:col-span-1"><span className={LABEL}>Contact email</span><input type="email" value={form.contact.email} onChange={(event) => updateContact('email', event.target.value)} className={FIELD} placeholder="name@company.com" autoComplete="off" /></label>
                </div>
                <button type="button" onClick={() => onAction('update_prospect', prospect, { ...payload, updateKind: 'draft' })} disabled={actionBusy} className={`${BUTTON} mt-3 w-full border-foreground/18 bg-foreground text-background`}><Save className="h-3.5 w-3.5" aria-hidden="true" />Save contact & drafts</button>
              </div>
              {prospect.manualNotes ? (
                <div className="rounded-xl border border-violet-300/14 bg-violet-300/[0.035] p-3">
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-violet-200/75">Internal manual notes</p>
                  <p className="mt-2 whitespace-pre-wrap font-body text-[11px] leading-relaxed text-foreground/56">{prospect.manualNotes}</p>
                </div>
              ) : null}
              <EvidencePanel prospect={prospect} />
              <div className="rounded-xl border border-amber-300/18 bg-amber-300/[0.045] p-3">
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-200/75">Bounded sequence</p>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/56">Maximum four touches over 14 days. Stop immediately on any reply, booking, unsubscribe, bounce, suppression, human revoke, or a conflicting CRM status. After touch four, the prospect closes with no automatic restart.</p>
              </div>
            </div>
            <SequenceEditor sequence={form.sequence} onChange={updateSequence} disabled={false} />
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function RobBot3K() {
  const [prospects, setProspects] = useState([]);
  const [stats, setStats] = useState({});
  const [stageCounts, setStageCounts] = useState(null);
  const [facets, setFacets] = useState({ segments: [], emailStatuses: ['Manually verified', 'Needs manual verification', 'Not found'] });
  const [config, setConfig] = useState({ liveSendEnabled: false, providerConnected: false });
  const [settings, setSettings] = useState(() => normalizeSenderSettings());
  const [run, setRun] = useState({});
  const [activeTab, setActiveTab] = useState('review');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [segment, setSegment] = useState('all');
  const [priority, setPriority] = useState('all');
  const [emailStatus, setEmailStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sourceReady, setSourceReady] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [pagination, setPagination] = useState({ limit: PAGE_LIMIT, offset: 0, total: 0, hasMore: false });

  const applyData = useCallback((data, { append = false } = {}) => {
    setProspects((current) => {
      if (Array.isArray(data?.prospects)) {
        const incoming = data.prospects.map(normalizeProspect);
        if (!append) return incoming;
        const deduped = new Map(current.map((prospect) => [prospect.id, prospect]));
        incoming.forEach((prospect) => deduped.set(prospect.id, prospect));
        return [...deduped.values()];
      }
      return mergeApiData(data, current);
    });
    if (data?.pagination) {
      setPagination({
        limit: Number(data.pagination.limit) || PAGE_LIMIT,
        offset: Number(data.pagination.offset) || 0,
        total: Math.max(0, Number(data.pagination.total) || 0),
        hasMore: data.pagination.hasMore === true,
      });
    } else if (Array.isArray(data?.prospects) && !append) {
      setPagination({ limit: PAGE_LIMIT, offset: 0, total: data.prospects.length, hasMore: false });
    }
    if (data?.stats) setStats(data.stats);
    if (data?.stageCounts) setStageCounts(data.stageCounts);
    if (data?.facets) {
      setFacets({
        segments: Array.isArray(data.facets.segments) ? data.facets.segments : [],
        emailStatuses: Array.isArray(data.facets.emailStatuses) ? data.facets.emailStatuses : ['Manually verified', 'Needs manual verification', 'Not found'],
      });
    }
    if (data?.settings) setSettings(normalizeSenderSettings(data.settings));
    if (data?.config || typeof data?.liveSendEnabled === 'boolean') {
      setConfig({
        ...(data?.config || {}),
        liveSendEnabled: data?.liveSendEnabled ?? data?.config?.liveSendEnabled ?? false,
        providerConnected: data?.providerConnected ?? data?.config?.providerConnected,
      });
    }
    if (data?.run) setRun(data.run);
    else if (Array.isArray(data?.runs) && data.runs.length) {
      const latestRefresh = data.runs.find((item) => item?.action === 'refresh' || item?.type === 'refresh' || item?.run_type === 'refresh');
      const latestExecution = data.runs.find((item) => item?.action === 'run_due_outreach' || item?.type === 'run_due_outreach' || item?.run_type === 'outreach');
      setRun({
        lastRefreshAt: latestRefresh?.completedAt || latestRefresh?.finished_at || latestRefresh?.started_at || latestRefresh?.createdAt || latestRefresh?.created_at || null,
        lastExecuteAt: latestExecution?.completedAt || latestExecution?.finished_at || latestExecution?.started_at || latestExecution?.createdAt || latestExecution?.created_at || null,
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async ({ quiet = false, offset = 0, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else if (!quiet) setLoading(true);
    if (!append) setError('');
    try {
      const params = new URLSearchParams({
        scope: 'all',
        stage: activeTab,
        limit: String(PAGE_LIMIT),
        offset: String(Math.max(0, Number(offset) || 0)),
      });
      if (debouncedQuery) params.set('search', debouncedQuery);
      if (segment !== 'all') params.set('segment', segment);
      if (priority !== 'all') params.set('priority', priority);
      if (emailStatus !== 'all') params.set('emailStatus', emailStatus);
      const data = await apiGet(`/api/admin/robbot3k?${params.toString()}`);
      assertApiResponse(data, {
        arrays: ['prospects', 'runs', 'facets.segments', 'facets.emailStatuses'],
        objects: ['pagination', 'stats', 'stageCounts', 'facets', 'run', 'config', 'settings'],
        booleans: ['pagination.hasMore', 'config.liveSendEnabled', 'config.providerConnected', 'settings.globalPause'],
        numbers: [
          'pagination.limit', 'pagination.offset', 'pagination.total',
          'stats.researchedToday', 'stats.readyForReview', 'stats.dueToday', 'stats.activeSequences',
          'stats.repliesToday', 'stats.totalReplies', 'stats.callsBookedToday', 'stats.totalCallsBooked',
          'stageCounts.research', 'stageCounts.review', 'stageCounts.approved', 'stageCounts.stopped',
        ],
      }, 'RobBot3K returned an invalid dashboard response.');
      if (!hasObjectRows(data.prospects) || !hasObjectRows(data.runs)) {
        throw invalidApiResponse('RobBot3K returned invalid queue records.');
      }
      applyData(data || {}, { append });
      setSourceReady(true);
    } catch (requestError) {
      if (append) {
        setNotice({ tone: 'error', message: requestError?.message || 'The next 100 prospects could not be loaded.' });
      } else {
        setSourceReady(false);
        setProspects([]);
        setStats({});
        setStageCounts({ research: 0, review: 0, approved: 0, stopped: 0 });
        setFacets({ segments: [], emailStatuses: [] });
        setPagination({ limit: PAGE_LIMIT, offset: 0, total: 0, hasMore: false });
        setError(requestError?.message || 'RobBot3K could not load its outreach queue.');
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [activeTab, applyData, debouncedQuery, emailStatus, priority, segment]);

  useEffect(() => { load(); }, [load]);

  const action = useCallback(async (actionName, prospect, payload = {}) => {
    const busyKey = prospect ? `${prospect.id}:${actionName}` : actionName;
    setBusy(busyKey);
    setNotice(null);
    try {
      const patch = actionName === 'update_prospect' && payload.updateKind === 'verify-email'
        ? { contact: payload.contact, sequence: payload.sequence, manualVerified: true, emailStatus: 'Manually verified' }
        : actionName === 'update_prospect'
          ? { contact: payload.contact, sequence: payload.sequence }
          : null;
      let expectedDraftHash = prospect?.draftHash || '';
      if (actionName === 'approve') {
        const updateResult = await apiPost('/api/admin/robbot3k', {
          action: 'update_prospect',
          prospectId: prospect.id,
          expectedDraftHash: prospect.draftHash,
          patch: { contact: payload.contact, sequence: payload.sequence },
        });
        // Approval must bind to the exact row returned after the save above.
        // Never approve against the stale hash that was displayed before the
        // server normalized and persisted the edited recipient/copy.
        expectedDraftHash = updateResult?.prospect?.draftHash || '';
        if (!expectedDraftHash) throw new Error('The saved draft could not be locked for approval. Reload and review it again.');
      }
      const data = await apiPost('/api/admin/robbot3k', {
        action: actionName,
        ...(prospect ? { prospectId: prospect.id } : {}),
        ...(actionName === 'approve' ? { expectedDraftHash } : {}),
        ...(actionName === 'update_prospect' ? { expectedDraftHash: prospect?.draftHash || '' } : {}),
        ...(patch ? { patch } : {}),
        ...(actionName === 'update_settings' ? { settings: payload.settings } : {}),
        ...(actionName === 'create_manual_prospect' ? { prospect: payload.prospect } : {}),
        ...(actionName === 'mark_booked' ? { scheduledAt: payload.scheduledAt, bookingUrl: payload.bookingUrl } : {}),
      });
      if (actionName === 'refresh') await load({ quiet: true, offset: 0, append: false });
      else if (data?.prospects || data?.prospect || data?.settings || data?.config) applyData(data, { append: Array.isArray(data?.prospects) && !data?.pagination });
      else await load({ quiet: true, offset: 0, append: false });
      if (actionName === 'create_manual_prospect' && data?.prospect) {
        setActiveTab(stageFor(data.prospect.status));
        if (data.created) setPagination((current) => ({ ...current, total: current.total + 1 }));
      } else if (data?.prospect) {
        await load({ quiet: true, offset: 0, append: false });
      }
      const messageByAction = {
        refresh: 'Atlas research refreshed. New findings remain unapproved.',
        run_due_outreach: config?.liveSendEnabled ? 'Due, approved outreach executed.' : 'Dry run complete. No email was sent.',
        create_manual_prospect: 'Manual contact added to research. No email was sent.',
        update_prospect: payload.updateKind === 'verify-email' ? 'Manual email verification recorded.' : 'Contact and exact drafts saved.',
        approve: 'Four-touch sequence approved. It can now run only within the configured safety rules.',
        hold: 'Prospect held. Nothing else will send.',
        reject: 'Prospect rejected and removed from the send queue.',
        revoke: 'Approval revoked. Remaining touches stopped.',
        mark_reply: 'Reply recorded. Automated follow-up stopped.',
        mark_booked: 'Call booked. Automated follow-up stopped.',
        suppress: 'Prospect suppressed. Future outreach is blocked.',
        update_settings: 'Sender settings saved. Live sending remains separately gated.',
      };
      setNotice({ tone: 'success', message: data?.message || messageByAction[actionName] || 'RobBot3K updated.' });
      return data;
    } catch (requestError) {
      setNotice({ tone: 'error', message: requestError?.message || 'That RobBot3K action could not be completed.' });
      return null;
    } finally {
      setBusy('');
    }
  }, [applyData, config?.liveSendEnabled, load]);

  const counts = useMemo(() => stageCounts || countsFor(prospects), [prospects, stageCounts]);
  const computedStats = useMemo(() => ({ ...derivedStats(prospects), ...stats }), [prospects, stats]);
  const segments = useMemo(() => facets.segments, [facets.segments]);
  const emailStatuses = useMemo(() => facets.emailStatuses, [facets.emailStatuses]);
  const visibleProspects = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return prospects.filter((prospect) => {
      if (stageFor(prospect.status) !== activeTab) return false;
      if (segment !== 'all' && prospect.segment !== segment) return false;
      if (priority !== 'all' && prospect.priority.toLowerCase() !== priority) return false;
      if (emailStatus !== 'all' && prospect.emailStatus !== emailStatus) return false;
      if (!lowered) return true;
      return [prospect.organization, prospect.segment, prospect.contact.name, prospect.contact.role, prospect.contact.email]
        .some((value) => text(value).toLowerCase().includes(lowered));
    });
  }, [activeTab, emailStatus, priority, prospects, query, segment]);

  const globalBusy = busy === 'refresh' || busy === 'run_due_outreach';
  const live = config?.providerConnected !== false && (config?.liveSendEnabled === true || text(config?.sendMode).toLowerCase() === 'live');

  if (!sourceReady) {
    return (
      <AdminShell title="RobBot3K">
        {loading ? (
          <div className="mx-auto flex min-h-[28rem] max-w-2xl items-center justify-center px-5 py-12">
            <div className="av-glass-card w-full rounded-[1.75rem] border border-foreground/[0.12] bg-background/62 p-8 text-center backdrop-blur-2xl md:p-12">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-foreground/35" strokeWidth={1.6} aria-hidden="true" />
              <p className="mt-4 font-body text-sm text-foreground/50">Verifying the live BD source…</p>
            </div>
          </div>
        ) : (
          <OperationalSourceUnavailable
            title="RobBot3K source unavailable"
            description="The live prospect queue, settings, provider status, safety state, and outcome metrics could not be verified. No zeroed engine state or default controls are shown, and all research and outreach actions remain disabled until the source reconnects."
          />
        )}
      </AdminShell>
    );
  }

  return (
    <AdminShell title="RobBot3K">
      <PageShell
        embedded
        eyebrow="Business development agent"
        title="Rob Bot 3000"
        subtitle="An event-driven BD engine that turns verified market signals into a ranked morning queue, human-approved outreach, and qualified discovery calls."
        action={(
          <div className="flex w-full flex-wrap gap-2 md:w-auto">
            <button type="button" onClick={() => action('refresh')} disabled={globalBusy} className={`${BUTTON} flex-1 border-foreground/16 bg-background/50 text-foreground/68 hover:text-foreground md:flex-none`}>
              <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} strokeWidth={1.8} aria-hidden="true" />
              {busy === 'refresh' ? 'Researching…' : 'Run research now'}
            </button>
            <button type="button" onClick={() => action('run_due_outreach')} disabled={globalBusy} className={`${BUTTON} flex-1 border-foreground bg-foreground text-background md:flex-none`}>
              <Play className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1.6} aria-hidden="true" />
              {busy === 'run_due_outreach' ? 'Running…' : live ? 'Run due outreach' : 'Run due dry test'}
            </button>
          </div>
        )}
      >
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.025] p-4 md:p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-background/52">
                  <Bot className="h-5 w-5 text-foreground/65" strokeWidth={1.6} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/40">Rob Bot 3000 · BD control plane</p>
                  <h2 className="mt-1 font-heading text-4xl uppercase leading-[0.9] tracking-tight text-foreground md:text-5xl">Turn signals into conversations.</h2>
                  <p className="mt-2 max-w-3xl font-body text-[11px] leading-relaxed text-foreground/48">RobBot3K scans for demand signals, enriches and ranks opportunities, and prepares personalized outreach. Humans verify the evidence, decision maker, and exact sequence before any live work begins.</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-full border border-foreground/10 bg-background/45 px-3 py-2 font-body text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/50">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                Daily · 6:00 AM Pacific · {prospects.length} loaded
              </div>
            </div>
          </section>

          {notice ? (
            <div role="status" className={`rounded-xl border px-4 py-3 font-body text-[11px] ${notice.tone === 'error' ? 'border-red-300/24 bg-red-300/[0.05] text-red-200' : 'border-emerald-300/24 bg-emerald-300/[0.05] text-emerald-200'}`}>
              {notice.message}
            </div>
          ) : null}

          <SafetyPanel config={config} run={run} />

          <EngineMap config={config} />

          <SenderSettingsPanel
            settings={settings}
            config={config}
            saving={busy === 'update_settings'}
            onSave={(nextSettings) => action('update_settings', null, { settings: nextSettings })}
          />

          <ManualProspectPanel
            saving={busy === 'create_manual_prospect'}
            onCreate={(prospect) => action('create_manual_prospect', null, { prospect })}
          />

          <section aria-labelledby="morning-stats-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/40">Pipeline</p><h2 id="morning-stats-title" className="mt-1 font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Morning control sheet</h2></div>
              <Target className="h-4 w-4 text-foreground/30" strokeWidth={1.6} aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <Metric label="Research" value={counts.research} detail="Needs enrichment" icon={Search} />
              <Metric label="Ready" value={computedStats.readyForReview ?? counts.review} detail="Needs a human decision" icon={ListChecks} />
              <Metric label="Due now" value={computedStats.dueToday ?? 0} detail="Approved touches ready" icon={Mail} />
              <Metric label="Active" value={computedStats.activeSequences ?? counts.approved} detail="Bounded sequences" icon={Play} />
              <Metric label="Replies" value={computedStats.totalReplies ?? 0} detail="Captured outcomes" icon={MessageCircleReply} />
              <Metric label="Calls" value={computedStats.totalCallsBooked ?? 0} detail="Booked outcomes" icon={CalendarCheck} />
            </div>
          </section>

          <section className="rounded-xl border border-foreground/10 bg-background/48 p-3" aria-label="Prospect list controls">
            <div role="tablist" aria-label="Outreach stages" className="flex gap-1 overflow-x-auto rounded-full border border-foreground/8 bg-background/52 p-1">
              {TABS.map((tab) => (
                <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} className={`min-h-11 shrink-0 rounded-full px-4 font-body text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 ${activeTab === tab.key ? 'bg-foreground text-background' : 'text-foreground/48 hover:text-foreground'}`}>
                  {tab.label} <span className="ml-1 opacity-60">{counts[tab.key]}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_150px_210px]">
              <label className="relative">
                <span className="sr-only">Search prospects</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/32" strokeWidth={1.8} aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${FIELD} pl-9`} placeholder="Search organization or contact" />
              </label>
              <label className="relative">
                <span className="sr-only">Filter by segment</span>
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/32" strokeWidth={1.8} aria-hidden="true" />
                <select value={segment} onChange={(event) => setSegment(event.target.value)} className={`${FIELD} pl-9`}><option value="all">All segments</option>{segments.map((value) => <option key={value} value={value}>{value}</option>)}</select>
              </label>
              <label><span className="sr-only">Filter by priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)} className={FIELD}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select></label>
              <label><span className="sr-only">Filter by email status</span><select value={emailStatus} onChange={(event) => setEmailStatus(event.target.value)} className={FIELD}><option value="all">All email statuses</option>{emailStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-foreground/8 pt-3 font-body text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/38">
              <span>{prospects.length.toLocaleString()} loaded of {Math.max(pagination.total, prospects.length).toLocaleString()}</span>
              <span>{PAGE_LIMIT} records per page · server-filtered queue</span>
            </div>
          </section>

          {loading ? (
            <div className="rounded-xl border border-dashed border-foreground/12 bg-background/38 p-10 text-center">
              <RefreshCw className="mx-auto h-5 w-5 animate-spin text-foreground/35" strokeWidth={1.6} aria-hidden="true" />
              <p className="mt-3 font-body text-[11px] text-foreground/45">Loading the morning outreach list…</p>
            </div>
          ) : error ? (
            <div role="alert" className="rounded-xl border border-red-300/22 bg-red-300/[0.045] p-5">
              <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-200" strokeWidth={1.8} aria-hidden="true" /><div><h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Queue unavailable</h2><p className="mt-2 font-body text-[11px] leading-relaxed text-red-100/75">{error}</p></div></div>
              <button type="button" onClick={() => load()} className={`${BUTTON} mt-4 border-foreground/18 bg-foreground text-background`}><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Try again</button>
            </div>
          ) : visibleProspects.length ? (
            <div className="space-y-3" role="tabpanel" aria-label={TABS.find((tab) => tab.key === activeTab)?.label}>
              {visibleProspects.map((prospect) => <ProspectCard key={prospect.id} prospect={prospect} busy={busy} onAction={action} settings={settings} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-foreground/12 bg-background/38 p-8 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-foreground/30" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">Nothing in this view.</h2>
              <p className="mt-2 font-body text-[11px] text-foreground/42">Change the filters or refresh the Atlas. New research never starts approved.</p>
            </div>
          )}

          {!loading && !error && pagination.hasMore ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-foreground/10 bg-background/32 p-4 text-center">
              <p className="font-body text-[10px] text-foreground/42">{prospects.length.toLocaleString()} of {Math.max(pagination.total, prospects.length).toLocaleString()} prospects are loaded.</p>
              <button
                type="button"
                onClick={() => load({ quiet: true, offset: prospects.length, append: true })}
                disabled={loadingMore}
                className={`${BUTTON} border-foreground/16 bg-background/52 text-foreground/65 hover:text-foreground`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingMore ? 'animate-spin' : ''}`} strokeWidth={1.8} aria-hidden="true" />
                {loadingMore ? 'Loading…' : 'Load 100 more'}
              </button>
            </div>
          ) : null}

          <section className="grid gap-3 lg:grid-cols-2" aria-label="RobBot3K execution rules">
            <div className="rounded-xl border border-foreground/10 bg-background/48 p-4">
              <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10"><ShieldCheck className="h-4 w-4 text-foreground/48" strokeWidth={1.7} aria-hidden="true" /></div><div><p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/42">Permission contract</p><h2 className="mt-1 font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Research is not approval.</h2></div></div>
              <p className="mt-3 font-body text-[11px] leading-relaxed text-foreground/52">Every prospect begins unapproved. Approval is record-specific and covers only the four visible drafts, the verified recipient, and the configured schedule. Any copy or recipient change requires a new human decision.</p>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-background/48 p-4">
              <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10"><CirclePause className="h-4 w-4 text-foreground/48" strokeWidth={1.7} aria-hidden="true" /></div><div><p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/42">Hard stop conditions</p><h2 className="mt-1 font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Reply, booked, or stop.</h2></div></div>
              <p className="mt-3 font-body text-[11px] leading-relaxed text-foreground/52">A reply, booked call, unsubscribe, bounce, suppression, revocation, or conflicting CRM state stops remaining touches immediately. No prospect is automatically recycled after the final message.</p>
            </div>
          </section>
        </div>
      </PageShell>
    </AdminShell>
  );
}
