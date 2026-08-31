import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Columns3,
  Command,
  ContactRound,
  FileText,
  GripVertical,
  LayoutDashboard,
  Link2,
  List,
  ListTodo,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { assertApiResponse, hasObjectRows, invalidApiResponse } from '@/lib/apiResponse';

const PIPELINE_STAGES = [
  'New',
  'Researching',
  'Approved',
  'Contacted',
  'Engaged',
  'Discovery',
  'Proposal',
  'Negotiation',
  'Won',
  'Lost',
];

const RELATIONSHIP_ROLES = [
  ['primary_contact', 'Primary contact'],
  ['decision_maker', 'Decision-maker'],
  ['champion', 'Champion'],
  ['influencer', 'Influencer'],
  ['stakeholder', 'Stakeholder'],
  ['blocker', 'Blocker'],
];

const RELATIONSHIP_STRENGTHS = [
  ['unknown', 'Unknown'], ['cold', 'Cold'], ['warm', 'Warm'], ['strong', 'Strong'],
];

const COMPANY_RELATIONSHIP_STATUSES = [
  ['unknown', 'Unknown'], ['cold', 'Cold'], ['warm', 'Warm'], ['active', 'Active'],
  ['partner', 'Partner'], ['dormant', 'Dormant'], ['do_not_contact', 'Do not contact'],
];

const DECISION_STATUSES = [
  ['unknown', 'Unknown'], ['influencer', 'Influencer'], ['decision_maker', 'Decision-maker'],
  ['champion', 'Champion'], ['blocker', 'Blocker'],
];

const COMPANY_TYPES = [
  'Venue', 'Festival', 'Hotel', 'Record Label', 'Corporate', 'Fitness', 'Wellness',
  'Hospitality', 'Sports', 'Brand', 'Agency', 'Healthcare', 'Other',
];

const OPPORTUNITY_TYPES = [
  'Event Wellness', 'Artist Wellness', 'Employee Wellness', 'Corporate Wellness',
  'Venue Partnership', 'Hospitality Partnership', 'Retainer', 'Activation',
  'Strategic Partnership', 'Other',
];

const BD_NAV = [
  { id: 'home', label: 'Home', icon: LayoutDashboard, to: '/admin/bd' },
  { id: 'pipeline', label: 'Pipeline', icon: Columns3, to: '/admin/bd/pipeline' },
  { id: 'companies', label: 'Companies', icon: Building2, to: '/admin/bd/companies' },
  { id: 'people', label: 'People', icon: ContactRound, to: '/admin/bd/people' },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, to: '/admin/bd/tasks' },
];

const VIEW_COPY = {
  home: { eyebrow: 'Good morning, Rob', title: 'What needs attention today?' },
  pipeline: { eyebrow: 'Revenue', title: 'Pipeline' },
  companies: { eyebrow: 'Relationships', title: 'Companies' },
  people: { eyebrow: 'Relationships', title: 'People' },
  tasks: { eyebrow: 'Execution', title: 'Tasks' },
};

function money(value, compact = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(Number(value) || 0);
}

function initials(value = '') {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AV';
}

function labelCase(value, fallback = '') {
  const source = String(value || fallback).replace(/_/g, ' ').trim();
  return source.replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateLabel(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateOnlyLabel(value, fallback = '—') {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateLabel(value, fallback);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateTimeLabel(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function normalizeCompanyRecord(item = {}) {
  return {
    ...item,
    id: item.id,
    name: item.name || 'Unnamed company',
    type: item.type || item.companyType || item.company_type || 'Other',
    website: item.website || item.websiteUrl || item.website_url || '',
    location: item.location || '',
    ownerProfileId: item.ownerProfileId || item.owner_profile_id || '',
    owner: item.owner || item.ownerName || item.owner_name || item.owner_profile?.full_name || 'Unassigned',
    relationshipStatus: item.relationshipStatus || item.relationship_status || 'unknown',
    stage: labelCase(item.stage || item.pipelineStage || item.pipeline_stage, 'New'),
    openValue: Number(item.openValue ?? item.open_value ?? ((item.openValueCents ?? item.open_value_cents ?? item.estimated_opportunity_value_cents ?? 0) / 100)) || 0,
    fitScore: Number(item.fitScore ?? item.fit_score) || 0,
    lastTouch: item.lastTouch || item.last_touch || dateLabel(item.last_touch_at, 'Not contacted'),
    nextAction: item.nextAction || item.next_action || 'Qualify relationship',
    nextActionDate: item.nextActionDate || dateLabel(item.next_action_date, 'Unscheduled'),
    nextActionDateValue: item.next_action_date || item.nextActionDateValue || '',
    primaryContact: item.primaryContact || item.primary_contact || item.primary_contact_name || 'Unassigned',
    description: item.description || '',
    source: item.source || 'manual',
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
}

function normalizePersonRecord(item = {}) {
  const decisionStatus = item.decisionMakerStatus || item.decision_maker_status;
  return {
    ...item,
    id: item.id,
    name: item.name || item.fullName || item.full_name || 'Unnamed person',
    companyId: item.companyId || item.company_id || item.company?.id || '',
    company: item.companyName || item.company_name || item.company?.name || 'Unlinked',
    title: item.title || '',
    relationshipStrength: item.relationshipStrength || item.relationship_strength || 'unknown',
    relationship: labelCase(item.relationship || item.relationshipStrength || item.relationship_strength, 'Unknown'),
    decisionMakerStatus: decisionStatus || 'unknown',
    decisionMaker: item.decisionMaker ?? item.decision_maker ?? ['decision_maker', 'champion'].includes(decisionStatus),
    ownerProfileId: item.ownerProfileId || item.owner_profile_id || '',
    owner: item.owner || item.ownerName || item.owner_name || item.owner_profile?.full_name || 'Unassigned',
    lastContact: item.lastContact || item.last_contact || dateLabel(item.last_contact_at, 'Not contacted'),
    nextAction: item.nextAction || item.next_action || 'Qualify contact',
    nextActionDateValue: item.next_action_date || item.nextActionDateValue || '',
    email: item.email || '',
    phone: item.phone || '',
    location: item.location || '',
    linkedinUrl: item.linkedinUrl || item.linkedin_url || '',
    notes: item.notes || item.notes_summary || '',
  };
}

function normalizeOpportunityRecord(item = {}) {
  const expectedValueCentsValue = Object.hasOwn(item, 'expectedValueCentsValue')
    ? item.expectedValueCentsValue
    : item.expectedValueCents ?? item.expected_value_cents
      ?? (item.value != null ? Math.round(Number(item.value) * 100) : null);
  const fitScoreValue = Object.hasOwn(item, 'fitScoreValue')
    ? item.fitScoreValue
    : item.fitScore ?? item.fit_score ?? null;
  return {
    ...item,
    id: item.id,
    name: item.name || 'Unnamed opportunity',
    companyId: item.companyId || item.company_id || item.company?.id || '',
    company: item.companyName || item.company_name || item.company?.name || 'Unlinked',
    contacts: item.contacts || [],
    ownerProfileId: item.ownerProfileId || item.owner_profile_id || '',
    owner: item.owner || item.ownerName || item.owner_name || item.owner_profile?.full_name || 'Unassigned',
    type: item.type || item.opportunityType || item.opportunity_type || 'Other',
    stage: labelCase(item.stage || item.pipelineStage || item.pipeline_stage, 'New'),
    expectedValueCentsValue: expectedValueCentsValue == null ? null : Number(expectedValueCentsValue),
    value: expectedValueCentsValue == null ? 0 : Number(expectedValueCentsValue) / 100,
    probability: Number(item.probability) || 0,
    fitScoreValue: fitScoreValue == null ? null : Number(fitScoreValue),
    fitScore: fitScoreValue == null ? 0 : Number(fitScoreValue),
    priority: labelCase(item.priority, 'Normal'),
    nextAction: item.nextAction || item.next_action || 'Qualify opportunity',
    nextActionDate: item.nextActionDate || dateLabel(item.next_action_date, 'Unscheduled'),
    nextActionDateValue: item.next_action_date || item.nextActionDateValue || '',
    source: item.source || 'manual',
  };
}

function normalizeTaskRecord(item = {}) {
  const rawStatus = String(item.status || 'open').toLowerCase();
  const status = rawStatus === 'done' ? 'completed' : ['open', 'in_progress', 'completed', 'cancelled'].includes(rawStatus) ? rawStatus : 'open';
  return {
    ...item,
    id: item.id,
    title: item.title || 'Untitled task',
    company: item.companyName || item.company_name || item.company?.name || 'Unlinked',
    opportunity: item.opportunityName || item.opportunity_name || item.opportunity?.name || '',
    owner: item.owner || item.ownerName || item.owner_name || item.owner_profile?.full_name || 'Unassigned',
    due: item.due || dateLabel(item.due_at, 'Unscheduled'),
    priority: labelCase(item.priority, 'Normal'),
    status,
    source: item.source || 'manual',
    createdBy: item.createdBy || item.created_by_name || '',
  };
}

function hydrateWorkspace(companyRows, peopleRows, opportunityRows, taskRows) {
  const normalizedCompanies = companyRows.map(normalizeCompanyRecord);
  const companyNames = new Map(normalizedCompanies.map((item) => [item.id, item.name]));
  const normalizedPeople = peopleRows.map((row) => {
    const person = normalizePersonRecord(row);
    return { ...person, company: companyNames.get(person.companyId) || person.company };
  });
  const normalizedOpportunities = opportunityRows.map((row) => {
    const opportunity = normalizeOpportunityRecord(row);
    return { ...opportunity, company: companyNames.get(opportunity.companyId) || opportunity.company };
  });
  const opportunityById = new Map(normalizedOpportunities.map((item) => [item.id, item]));
  const personById = new Map(normalizedPeople.map((item) => [item.id, item]));
  const normalizedTasks = taskRows.map((row) => {
    const task = normalizeTaskRecord(row);
    const opportunity = opportunityById.get(row.opportunity_id || row.opportunityId);
    const person = personById.get(row.person_id || row.personId);
    const companyId = row.company_id || row.companyId || opportunity?.companyId || person?.companyId;
    return {
      ...task,
      company: companyNames.get(companyId) || opportunity?.company || person?.company || task.company,
      opportunity: opportunity?.name || task.opportunity,
    };
  });
  const companies = normalizedCompanies.map((company) => {
    const companyOpportunities = normalizedOpportunities.filter((item) => item.companyId === company.id);
    const openOpportunities = companyOpportunities.filter((item) => !['Won', 'Lost'].includes(item.stage));
    const ranked = [...openOpportunities].sort((left, right) => {
      const stageDifference = PIPELINE_STAGES.indexOf(right.stage) - PIPELINE_STAGES.indexOf(left.stage);
      if (stageDifference) return stageDifference;
      return Date.parse(right.updated_at || 0) - Date.parse(left.updated_at || 0);
    });
    const companyPeople = normalizedPeople.filter((item) => item.companyId === company.id);
    const primary = companyPeople.find((item) => item.decisionMaker) || companyPeople[0];
    return {
      ...company,
      stage: ranked[0]?.stage || (companyOpportunities.length ? companyOpportunities[0].stage : 'No opportunity'),
      openValue: openOpportunities.reduce((sum, item) => sum + item.value, 0),
      primaryContact: primary?.name || 'Unassigned',
    };
  });
  return { companies, people: normalizedPeople, opportunities: normalizedOpportunities, tasks: normalizedTasks };
}

function deriveCompanyRollups(companies, people, opportunities) {
  return companies.map((company) => {
    const related = opportunities.filter((item) => item.companyId === company.id);
    const open = related.filter((item) => !['Won', 'Lost'].includes(item.stage));
    const ranked = [...open].sort((left, right) => PIPELINE_STAGES.indexOf(right.stage) - PIPELINE_STAGES.indexOf(left.stage));
    const contacts = people.filter((item) => item.companyId === company.id);
    const primary = contacts.find((item) => item.decisionMaker) || contacts[0];
    return {
      ...company,
      stage: ranked[0]?.stage || (related.length ? related[0].stage : 'No opportunity'),
      openValue: open.reduce((sum, item) => sum + item.value, 0),
      primaryContact: primary?.name || 'Unassigned',
    };
  });
}

function hydrateDashboard(payload = {}, workspace) {
  const companyNames = new Map(workspace.companies.map((item) => [item.id, item.name]));
  const opportunityById = new Map(workspace.opportunities.map((item) => [item.id, item]));
  const taskById = new Map(workspace.tasks.map((item) => [item.id, item]));
  const opportunities = (rows) => (Array.isArray(rows) ? rows : []).map((row) => {
    const existing = opportunityById.get(row.id);
    const normalized = existing || normalizeOpportunityRecord(row);
    return { ...normalized, company: companyNames.get(normalized.companyId) || normalized.company };
  });
  const tasks = (rows) => (Array.isArray(rows) ? rows : []).map((row) => taskById.get(row.id) || normalizeTaskRecord(row));
  return {
    summary: payload.summary || { openPipelineCents: 0, openOpportunities: 0, priorityOpportunities: 0, callsThisWeek: 0, actionsDueToday: 0 },
    priorityOpportunities: opportunities(payload.priorityOpportunities),
    repliesRequiringAction: Array.isArray(payload.repliesRequiringAction) ? payload.repliesRequiringAction : [],
    overdueTasks: tasks(payload.overdueTasks),
    followUpsDue: tasks(payload.followUpsDue),
    upcomingCalls: Array.isArray(payload.upcomingCalls) ? payload.upcomingCalls : [],
    newDiscoveries: Array.isArray(payload.newDiscoveries) ? payload.newDiscoveries : [],
    recentlyChangedOpportunities: opportunities(payload.recentlyChangedOpportunities),
    runtime: payload.runtime || {},
  };
}

function toneForStage(stage) {
  if (stage === 'Won') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
  if (stage === 'Lost') return 'bg-stone-100 text-stone-500 ring-stone-500/15';
  if (['Proposal', 'Negotiation', 'Discovery'].includes(stage)) return 'bg-violet-50 text-violet-700 ring-violet-600/15';
  if (['Engaged', 'Contacted'].includes(stage)) return 'bg-blue-50 text-blue-700 ring-blue-600/15';
  return 'bg-amber-50 text-amber-700 ring-amber-600/15';
}

function Pill({ children, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-600 ring-stone-500/10',
    dark: 'bg-[#1d1d1f] text-white ring-black/10',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/15',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tones[tone] || tones.neutral}`}>
      {Icon ? <Icon className="h-3 w-3" strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

function Avatar({ name, square = false }) {
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center border border-stone-200 bg-stone-100 text-[10px] font-semibold text-stone-600 ${square ? 'rounded-lg' : 'rounded-full'}`}>
      {initials(name)}
    </span>
  );
}

function IconButton({ label, children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20 ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function SourceNotice({ status }) {
  if (status === 'live') return <Pill tone="green" icon={CheckCircle2}>CRM connected</Pill>;
  if (status === 'checking') return <Pill icon={Circle}>Checking CRM</Pill>;
  return <Pill tone="amber" icon={AlertCircle}>CRM unavailable</Pill>;
}

function WorkspaceNav({ active }) {
  const navigate = useNavigate();
  return (
    <nav className="flex min-w-max items-center gap-1" aria-label="Avalon BD">
      {BD_NAV.map((item) => {
        const Icon = item.icon;
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.to)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20 ${selected ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function SectionHeader({ title, meta, action, onAction }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="truncate text-[13px] font-semibold text-stone-900">{title}</h3>
        {meta ? <span className="text-[11px] text-stone-400">{meta}</span> : null}
      </div>
      {action ? (
        <button type="button" onClick={onAction} className="text-[11px] font-medium text-stone-500 transition hover:text-stone-900">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function AttentionRow({ icon: Icon, tone, title, meta, action, onOpen }) {
  const iconTone = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    stone: 'bg-stone-100 text-stone-600',
  };
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 border-b border-stone-100 py-3.5 text-left last:border-b-0">
      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone[tone] || iconTone.stone}`}>
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-stone-900">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-stone-500">{meta}</span>
      </span>
      <span className="shrink-0 text-[11px] font-medium text-stone-400 transition group-hover:text-stone-900">{action}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-600" />
    </button>
  );
}

function LiveMetricStrip({ summary }) {
  const data = [
    { label: 'Open pipeline', value: money(Number(summary?.openPipelineCents || 0) / 100, true), note: `${Number(summary?.openOpportunities || 0)} opportunities` },
    { label: 'Priority opportunities', value: Number(summary?.priorityOpportunities || 0), note: 'Persisted CRM records' },
    { label: 'Calls this week', value: Number(summary?.callsThisWeek || 0), note: 'Scheduled meetings' },
    { label: 'Actions due today', value: Number(summary?.actionsDueToday || 0), note: 'Open or in progress' },
  ];
  return (
    <div className="grid divide-y divide-stone-200 border-y border-stone-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
      {data.map((item) => (
        <div key={item.label} className="px-1 py-4 sm:px-5 first:pl-1">
          <p className="text-[11px] font-medium text-stone-500">{item.label}</p>
          <div className="mt-1 flex items-baseline gap-2"><span className="text-[24px] font-semibold tracking-[-0.04em] text-stone-950">{item.value}</span><span className="text-[10px] text-stone-400">{item.note}</span></div>
        </div>
      ))}
    </div>
  );
}

function EmptyRows({ children }) {
  return <div className="py-8 text-center text-[11px] text-stone-400">{children}</div>;
}

function LiveHomeView({ dashboard, onOpen, onNavigate }) {
  const overdue = dashboard?.overdueTasks || [];
  const followUps = dashboard?.followUpsDue || [];
  const calls = dashboard?.upcomingCalls || [];
  const priority = dashboard?.priorityOpportunities || [];
  const recent = dashboard?.recentlyChangedOpportunities || [];
  const attentionCount = overdue.length + followUps.length;
  const openTaskRecord = (task) => {
    const opportunityId = task.opportunity_id || task.opportunityId;
    const personId = task.person_id || task.personId;
    const companyId = task.company_id || task.companyId;
    if (opportunityId) onOpen({ type: 'opportunity', id: opportunityId });
    else if (personId) onOpen({ type: 'person', id: personId });
    else if (companyId) onOpen({ type: 'company', id: companyId });
    else onNavigate('/admin/bd/tasks');
  };
  return (
    <div className="space-y-7">
      <LiveMetricStrip summary={dashboard?.summary} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section>
          <SectionHeader title="Needs attention" meta={`${attentionCount} connected`} action="View tasks" onAction={() => onNavigate('/admin/bd/tasks')} />
          <div>
            {overdue.slice(0, 4).map((task) => (
              <AttentionRow key={`overdue-${task.id}`} icon={AlertCircle} tone="red" title={`Overdue · ${task.title}`} meta={`${task.company || task.opportunity || 'Linked CRM record'} · Due ${task.due}`} action="Open record" onOpen={() => openTaskRecord(task)} />
            ))}
            {followUps.slice(0, 4).map((task) => (
              <AttentionRow key={`task-${task.id}`} icon={Clock3} tone="amber" title={`Due today · ${task.title}`} meta={`${task.company || task.opportunity || 'Linked CRM record'} · ${task.due}`} action="Open record" onOpen={() => openTaskRecord(task)} />
            ))}
            {attentionCount === 0 ? <EmptyRows>No overdue tasks or due-today follow-ups need attention.</EmptyRows> : null}
          </div>
        </section>
        <section>
          <SectionHeader title="Upcoming meetings" meta="Next 7 days" action="Open pipeline" onAction={() => onNavigate('/admin/bd/pipeline')} />
          <div>
            {calls.map((call) => {
              const scheduled = new Date(call.scheduled_at);
              const title = call.organization || call.contact_name || call.content || 'Scheduled meeting';
              const contact = call.organization && call.contact_name ? call.contact_name : '';
              const row = (
                <>
                  <span className="w-9 shrink-0 text-center"><span className="block text-[9px] font-semibold tracking-[0.12em] text-stone-400">{Number.isNaN(scheduled.getTime()) ? 'CALL' : scheduled.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span><span className="block text-[16px] font-semibold text-stone-900">{Number.isNaN(scheduled.getTime()) ? '—' : scheduled.getDate()}</span></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-stone-900">{title}</span><span className="block truncate text-[10px] text-stone-500">{contact ? `${contact} · ` : ''}{Number.isNaN(scheduled.getTime()) ? 'Time unavailable' : scheduled.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })} · {labelCase(call.provider, 'Calendar')}</span></span>
                  {call.opportunity_id ? <ArrowUpRight className="h-3.5 w-3.5 text-stone-300" /> : null}
                </>
              );
              return call.opportunity_id
                ? <button key={call.id} type="button" onClick={() => onOpen({ type: 'opportunity', id: call.opportunity_id })} className="flex w-full items-center gap-3 border-b border-stone-100 py-3 text-left last:border-b-0 hover:bg-stone-50">{row}</button>
                : <div key={call.id} className="flex items-center gap-3 border-b border-stone-100 py-3 last:border-b-0">{row}</div>;
            })}
            {calls.length === 0 ? <EmptyRows>No meetings are scheduled in the next 7 days.</EmptyRows> : null}
          </div>
        </section>
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section>
          <SectionHeader title="Priority opportunities" meta="Persisted high-priority records" action="View pipeline" onAction={() => onNavigate('/admin/bd/pipeline')} />
          {priority.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left"><thead><tr className="text-[10px] font-medium uppercase tracking-[0.08em] text-stone-400"><th className="py-3 pr-4">Opportunity</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Fit</th><th className="py-3 pl-4">Next action</th></tr></thead><tbody>{priority.map((item) => <tr key={item.id} onClick={() => onOpen({ type: 'opportunity', id: item.id })} className="cursor-pointer border-t border-stone-100 text-[12px] hover:bg-stone-50"><td className="py-3 pr-4"><span className="block font-medium text-stone-900">{item.name}</span><span className="text-[10px] text-stone-500">{item.company}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] ring-1 ring-inset ${toneForStage(item.stage)}`}>{item.stage}</span></td><td className="px-4 py-3 font-medium text-stone-800">{money(item.value)}</td><td className="px-4 py-3 text-stone-700">{item.fitScore || '—'}</td><td className="py-3 pl-4 text-stone-700">{item.nextAction}</td></tr>)}</tbody></table>
            </div>
          ) : <EmptyRows>No high-priority open opportunities are recorded.</EmptyRows>}
        </section>
        <section>
          <SectionHeader title="Recently changed" meta="Connected CRM" />
          <div>{recent.slice(0, 6).map((item) => <button key={item.id} type="button" onClick={() => onOpen({ type: 'opportunity', id: item.id })} className="flex w-full items-center justify-between gap-3 border-b border-stone-100 py-3 text-left last:border-b-0"><span className="min-w-0"><span className="block truncate text-[11px] font-medium text-stone-900">{item.name}</span><span className="block truncate text-[10px] text-stone-400">{item.company} · {item.stage}</span></span><span className="text-[9px] text-stone-400">{dateLabel(item.updated_at, 'Updated')}</span></button>)}{recent.length === 0 ? <EmptyRows>No opportunity changes recorded yet.</EmptyRows> : null}</div>
        </section>
      </div>
    </div>
  );
}

function PipelineCard({ opportunity, onOpen }) {
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', opportunity.id)}
      onClick={() => onOpen({ type: 'opportunity', id: opportunity.id })}
      className="group cursor-grab rounded-xl border border-stone-200 bg-white p-3.5 shadow-[0_1px_1px_rgba(0,0,0,0.02)] transition hover:-translate-y-px hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-stone-400">{opportunity.company}</p>
          <h4 className="mt-1 line-clamp-2 text-[12px] font-semibold leading-4 text-stone-900">{opportunity.name}</h4>
        </div>
        <GripVertical className="h-4 w-4 shrink-0 text-stone-200 transition group-hover:text-stone-400" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-stone-900">{money(opportunity.value)}</span>
        <span className="text-[10px] font-medium text-stone-500">Fit {opportunity.fitScore}</span>
      </div>
      <div className="mt-3 border-t border-stone-100 pt-3">
        <p className="truncate text-[10px] text-stone-500">{opportunity.nextAction}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px] font-medium text-stone-400">{opportunity.nextActionDate}</span>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[8px] font-semibold text-white">{initials(opportunity.owner)}</span>
        </div>
      </div>
    </article>
  );
}

function PipelineTable({ opportunities, onOpen }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead className="bg-stone-50 text-[10px] font-medium uppercase tracking-[0.08em] text-stone-400">
          <tr>
            <th className="px-4 py-3">Opportunity</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Probability</th><th className="px-4 py-3">Fit</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Next action</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((item) => (
            <tr key={item.id} onClick={() => onOpen({ type: 'opportunity', id: item.id })} className="cursor-pointer border-t border-stone-100 text-[12px] transition hover:bg-stone-50">
              <td className="px-4 py-3"><span className="block font-medium text-stone-900">{item.name}</span><span className="text-[10px] text-stone-400">{item.company}</span></td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] ring-1 ring-inset ${toneForStage(item.stage)}`}>{item.stage}</span></td>
              <td className="px-4 py-3 font-medium text-stone-800">{money(item.value)}</td>
              <td className="px-4 py-3 text-stone-600">{item.probability}%</td>
              <td className="px-4 py-3 font-medium text-stone-700">{item.fitScore}</td>
              <td className="px-4 py-3 text-stone-600">{item.owner}</td>
              <td className="px-4 py-3"><span className="block text-stone-700">{item.nextAction}</span><span className="text-[10px] text-stone-400">{item.nextActionDate}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PipelineView({ opportunities, onMove, onOpen }) {
  const [mode, setMode] = useState('board');
  const total = opportunities.filter((item) => !['Won', 'Lost'].includes(item.stage)).reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px] text-stone-500">
          <span><strong className="font-semibold text-stone-900">{money(total, true)}</strong> open</span>
          <span className="h-3 w-px bg-stone-200" />
          <span>{opportunities.length} opportunities</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-stone-200 bg-white p-0.5">
            <button type="button" onClick={() => setMode('board')} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium ${mode === 'board' ? 'bg-stone-900 text-white' : 'text-stone-500'}`}><Columns3 className="h-3.5 w-3.5" /> Board</button>
            <button type="button" onClick={() => setMode('table')} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium ${mode === 'table' ? 'bg-stone-900 text-white' : 'text-stone-500'}`}><List className="h-3.5 w-3.5" /> Table</button>
          </div>
        </div>
      </div>
      {opportunities.length === 0 ? <EmptyRows>No opportunities are recorded yet. Use New to create the first pipeline record.</EmptyRows> : mode === 'table' ? <PipelineTable opportunities={opportunities} onOpen={onOpen} /> : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-7 md:px-7">
          <div className="flex min-w-max items-start gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const items = opportunities.filter((item) => item.stage === stage);
              return (
                <section
                  key={stage}
                  className="w-[245px] shrink-0 rounded-xl bg-stone-100/70 p-2.5"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onMove(event.dataTransfer.getData('text/plain'), stage)}
                >
                  <header className="mb-2 flex items-center justify-between px-1 py-1">
                    <span className="flex items-center gap-2 text-[11px] font-semibold text-stone-700"><span className={`h-2 w-2 rounded-full ${stage === 'Won' ? 'bg-emerald-500' : stage === 'Lost' ? 'bg-stone-400' : 'bg-stone-300'}`} />{stage}</span>
                    <span className="text-[10px] font-medium text-stone-400">{items.length} · {money(items.reduce((sum, item) => sum + item.value, 0), true)}</span>
                  </header>
                  <div className="space-y-2">
                    {items.map((item) => <PipelineCard key={item.id} opportunity={item} onOpen={onOpen} />)}
                    {items.length === 0 ? <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-stone-200 text-[10px] text-stone-400">Drop here</div> : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TableToolbar({ label, count, search, onSearch }) {
  return (
    <div className="flex flex-col gap-3 border-b border-stone-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex h-8 shrink-0 items-center gap-1.5 text-[11px] font-medium text-stone-900">{label}<span className="text-stone-400">{count}</span></div>
      <div className="flex items-center gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 sm:w-48">
          <Search className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Filter this view" className="min-w-0 flex-1 bg-transparent text-[11px] text-stone-900 outline-none placeholder:text-stone-400" />
        </label>
      </div>
    </div>
  );
}

function CompaniesView({ companies, onOpen }) {
  const [search, setSearch] = useState('');
  const rows = companies.filter((item) => `${item.name} ${item.type} ${item.primaryContact}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <TableToolbar label="All companies" count={rows.length} search={search} onSearch={setSearch} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead><tr className="text-[10px] font-medium uppercase tracking-[0.08em] text-stone-400"><th className="py-3 pr-2">Company</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Primary contact</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Open value</th><th className="px-3 py-3">Fit</th><th className="px-3 py-3">Last touch</th><th className="py-3 pl-3">Next action</th></tr></thead>
          <tbody>
            {rows.map((company) => (
              <tr key={company.id} onClick={() => onOpen({ type: 'company', id: company.id })} className="cursor-pointer border-t border-stone-100 text-[11px] transition hover:bg-stone-50">
                <td className="py-3 pr-2"><div className="flex items-center gap-2.5"><Avatar name={company.name} square /><span><span className="block font-medium text-stone-900">{company.name}</span><span className="block text-[9px] text-stone-400">{company.location}</span></span></div></td>
                <td className="px-3 py-3 text-stone-600">{company.type}</td>
                <td className="px-3 py-3 font-medium text-stone-700">{company.primaryContact}</td>
                <td className="px-3 py-3 text-stone-600">{company.owner}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-medium ring-1 ring-inset ${toneForStage(company.stage)}`}>{company.stage}</span></td>
                <td className="px-3 py-3 font-medium text-stone-800">{money(company.openValue)}</td>
                <td className="px-3 py-3 font-semibold text-stone-700">{company.fitScore}</td>
                <td className="px-3 py-3 text-stone-500">{company.lastTouch}</td>
                <td className="py-3 pl-3"><span className="block text-stone-700">{company.nextAction}</span><span className="text-[9px] text-stone-400">{company.nextActionDate}</span></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan="9"><EmptyRows>No companies match this view.</EmptyRows></td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PeopleView({ people, onOpen }) {
  const [search, setSearch] = useState('');
  const rows = people.filter((item) => `${item.name} ${item.company} ${item.title} ${item.email}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <TableToolbar label="All people" count={rows.length} search={search} onSearch={setSearch} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="text-[10px] font-medium uppercase tracking-[0.08em] text-stone-400"><th className="py-3 pr-2">Name</th><th className="px-3 py-3">Company</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Relationship</th><th className="px-3 py-3">Decision maker</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Last contact</th><th className="py-3 pl-3">Next action</th></tr></thead>
          <tbody>
            {rows.map((person) => (
              <tr key={person.id} onClick={() => onOpen({ type: 'person', id: person.id })} className="cursor-pointer border-t border-stone-100 text-[11px] transition hover:bg-stone-50">
                <td className="py-3 pr-2"><div className="flex items-center gap-2.5"><Avatar name={person.name} /><span><span className="block font-medium text-stone-900">{person.name}</span><span className="block text-[9px] text-stone-400">{person.email}</span></span></div></td>
                <td className="px-3 py-3 font-medium text-stone-700">{person.company}</td>
                <td className="px-3 py-3 text-stone-600">{person.title}</td>
                <td className="px-3 py-3"><Pill tone={person.relationship === 'Warm' || person.relationship === 'Engaged' ? 'green' : 'neutral'}>{person.relationship}</Pill></td>
                <td className="px-3 py-3">{person.decisionMaker ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> Yes</span> : <span className="text-stone-400">No</span>}</td>
                <td className="px-3 py-3 text-stone-600">{person.owner}</td>
                <td className="px-3 py-3 text-stone-500">{person.lastContact}</td>
                <td className="py-3 pl-3 text-stone-700">{person.nextAction}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan="8"><EmptyRows>No people match this view.</EmptyRows></td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TasksView({ tasks, onToggle }) {
  const open = tasks.filter((task) => ['open', 'in_progress'].includes(task.status));
  const done = tasks.filter((task) => task.status === 'completed');
  const cancelled = tasks.filter((task) => task.status === 'cancelled');
  const inProgress = open.filter((task) => task.status === 'in_progress').length;
  const highPriority = open.filter((task) => task.priority === 'High').length;
  const render = (task) => (
    <div key={task.id} className="grid gap-3 border-b border-stone-100 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_170px_120px_80px] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <button type="button" onClick={() => onToggle(task.id)} className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${task.status === 'completed' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-transparent hover:border-stone-500'}`} aria-label={task.status === 'completed' ? `Reopen ${task.title}` : `Complete ${task.title}`}><Check className="h-3 w-3" /></button>
        <span className="min-w-0"><span className={`block truncate text-[12px] font-medium ${task.status === 'completed' ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{task.title}</span><span className="mt-0.5 block truncate text-[10px] text-stone-400">{task.company}{task.opportunity ? ` · ${task.opportunity}` : ''}{task.status === 'in_progress' ? ' · In progress' : ''}</span></span>
      </div>
      <span className="text-[11px] text-stone-500">{task.due}</span>
      <span><Pill tone={task.priority === 'High' ? 'amber' : 'neutral'}>{task.priority}</Pill></span>
      <span className="text-[11px] text-stone-500">{task.owner}</span>
    </div>
  );
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section>
        <SectionHeader title="Open tasks" meta={`${open.length} remaining`} />
        <div>{open.map(render)}</div>
        {tasks.length === 0 ? <EmptyRows>No tasks are recorded yet. Use New to create the first task.</EmptyRows> : null}
        {tasks.length > 0 && open.length === 0 && done.length === 0 ? <EmptyRows>No active tasks. Cancelled tasks are hidden from the action queue.</EmptyRows> : null}
        {done.length ? <><div className="mt-7"><SectionHeader title="Completed" meta={`${done.length}`} /></div><div>{done.map(render)}</div></> : null}
      </section>
      <aside className="border-l border-stone-200 pl-0 xl:pl-6">
        <SectionHeader title="Queue summary" />
        <div className="space-y-1 pt-2">
          {[['Open action queue', open.length], ['In progress', inProgress], ['High priority', highPriority], ['Completed', done.length]].map(([label, count]) => (
            <div key={label} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[11px] text-stone-500"><span>{label}</span><span className="text-stone-400">{count}</span></div>
          ))}
        </div>
        {cancelled.length ? <p className="mt-4 px-2.5 text-[9px] text-stone-400">{cancelled.length} cancelled task{cancelled.length === 1 ? '' : 's'} hidden from the action queue.</p> : null}
      </aside>
    </div>
  );
}

function FieldRow({ label, value, children }) {
  return (
    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-3 border-b border-stone-100 py-2.5 text-[11px]">
      <span className="text-stone-400">{label}</span>
      <span className="min-w-0 font-medium text-stone-700">{children || value || '—'}</span>
    </div>
  );
}

const CALL_LIST_FIELDS = [
  ['clientObjectives', 'Client objectives'],
  ['painPoints', 'Pain points'],
  ['requirements', 'Requirements'],
  ['decisionMakers', 'Decision makers'],
  ['stakeholders', 'Stakeholders'],
  ['servicesOfInterest', 'Services of interest'],
  ['objections', 'Objections'],
  ['requestedDeliverables', 'Requested deliverables'],
  ['recommendedNextSteps', 'Next steps'],
];

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function emptyCallForm() {
  return {
    occurredAt: localDateTimeValue(), summary: '', manualNotes: '', clientObjectives: '', painPoints: '', requirements: '',
    decisionMakers: '', stakeholders: '', servicesOfInterest: '', objections: '', requestedDeliverables: '',
    recommendedNextSteps: '', budgetMin: '', budgetMax: '', timing: '', dealProbability: '', recommendedFollowUp: '',
    followUpAt: '', expectedValue: '', expectedCloseDate: '', followUpTasks: '', applyOpportunityUpdates: false,
  };
}

function lines(value) {
  return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function optionalIso(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function CallIntelligenceForm({ company, opportunity, onSaved }) {
  const [form, setForm] = useState(emptyCallForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    setForm(emptyCallForm());
    setNotice('');
    setError('');
  }, [opportunity.id]);

  const submit = async (event) => {
    event.preventDefault();
    setNotice('');
    setError('');
    if (!form.summary.trim() && !form.manualNotes.trim()) {
      setError('Add a summary or manual notes before saving.');
      return;
    }
    const occurredAt = optionalIso(form.occurredAt);
    const followUpAt = optionalIso(form.followUpAt);
    if (occurredAt === null || followUpAt === null) {
      setError('Use a valid call and follow-up date/time.');
      return;
    }
    const budgetMin = form.budgetMin === '' ? undefined : Math.round(Number(form.budgetMin) * 100);
    const budgetMax = form.budgetMax === '' ? undefined : Math.round(Number(form.budgetMax) * 100);
    const expectedValue = form.expectedValue === '' ? undefined : Math.round(Number(form.expectedValue) * 100);
    const probability = form.dealProbability === '' ? undefined : Number(form.dealProbability);
    if ([budgetMin, budgetMax, expectedValue, probability].some((value) => value != null && (!Number.isFinite(value) || value < 0))) {
      setError('Budget, expected value, and probability must be valid positive numbers.');
      return;
    }
    if (budgetMin != null && budgetMax != null && budgetMax < budgetMin) {
      setError('Maximum budget must be at least the minimum budget.');
      return;
    }
    if (probability != null && (!Number.isInteger(probability) || probability > 100)) {
      setError('Deal probability must be a whole number from 0 to 100.');
      return;
    }
    const taskTitles = lines(form.followUpTasks);
    if (taskTitles.length > 10) {
      setError('Use at most 10 follow-up tasks.');
      return;
    }
    const hasOpportunityUpdate = expectedValue != null || probability != null || form.expectedCloseDate || form.recommendedFollowUp.trim() || followUpAt;
    if (form.applyOpportunityUpdates && !hasOpportunityUpdate) {
      setError('Enter at least one value, probability, close date, next action, or follow-up date to apply.');
      return;
    }
    if (form.applyOpportunityUpdates && !Number.isInteger(Number(opportunity.version))) {
      setError('Refresh this opportunity before applying field updates.');
      return;
    }
    const call = {
      companyId: opportunity.companyId || company?.id,
      opportunityId: opportunity.id,
      occurredAt,
      summary: form.summary.trim() || undefined,
      manualNotes: form.manualNotes.trim() || undefined,
      budgetMinCents: budgetMin,
      budgetMaxCents: budgetMax,
      timing: form.timing.trim() || undefined,
      dealProbability: probability,
      followUpAt,
      recommendedFollowUp: form.recommendedFollowUp.trim() || undefined,
      expectedValueCents: expectedValue,
      expectedCloseDate: form.expectedCloseDate || undefined,
      applyOpportunityUpdates: form.applyOpportunityUpdates,
      opportunityExpectedVersion: Number.isInteger(Number(opportunity.version)) ? Number(opportunity.version) : undefined,
      followUpTasks: taskTitles.map((title) => ({ title, dueAt: followUpAt, priority: 'normal' })),
    };
    for (const [key] of CALL_LIST_FIELDS) call[key] = lines(form[key]);
    setSaving(true);
    try {
      const response = await apiPost('/api/admin/bd', { action: 'record_call', call });
      onSaved(response);
      setForm(emptyCallForm());
      setNotice(`Call intelligence saved${response?.tasks?.length ? ` with ${response.tasks.length} follow-up task${response.tasks.length === 1 ? '' : 's'}` : ''}.`);
    } catch (requestError) {
      setError(requestError?.message || 'Call intelligence could not be saved. Refresh the record before retrying.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-[11px] text-stone-900 outline-none placeholder:text-stone-300 focus:border-stone-500';
  const areaClass = 'min-h-20 w-full resize-y rounded-lg border border-stone-200 bg-white p-3 text-[11px] leading-4 text-stone-900 outline-none placeholder:text-stone-300 focus:border-stone-500';
  return (
    <details className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"><span><span className="block text-[11px] font-semibold text-stone-900">Record call intelligence</span><span className="mt-0.5 block text-[9px] text-stone-500">Manual entry · saved as human-approved</span></span><Plus className="h-3.5 w-3.5 text-stone-400" /></summary>
      <form onSubmit={submit} className="space-y-5 border-t border-stone-200 px-4 py-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] leading-4 text-amber-800">Transcript extraction and call-recording storage are staged and not connected. Enter only the intelligence you reviewed yourself.</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Call date and time</span><input type="datetime-local" value={form.occurredAt} onChange={(event) => setField('occurredAt', event.target.value)} className={inputClass} /></label>
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Deal probability · optional</span><input type="number" min="0" max="100" step="1" value={form.dealProbability} onChange={(event) => setField('dealProbability', event.target.value)} placeholder="0–100" className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Summary</span><textarea value={form.summary} onChange={(event) => setField('summary', event.target.value)} placeholder="What was decided and why it matters" className={areaClass} /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Manual notes</span><textarea value={form.manualNotes} onChange={(event) => setField('manualNotes', event.target.value)} placeholder="Additional context from the human operator" className={areaClass} /></label>
        </div>

        <div><p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Buyer intelligence · one item per line</p><div className="grid gap-3 sm:grid-cols-2">{CALL_LIST_FIELDS.map(([key, label]) => <label key={key}><span className="mb-1.5 block text-[9px] font-medium text-stone-500">{label}</span><textarea value={form[key]} onChange={(event) => setField(key, event.target.value)} placeholder="One item per line" className={areaClass} /></label>)}</div></div>

        <div><p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Commercial and follow-up</p><div className="grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Budget minimum</span><input type="number" min="0" step="1" value={form.budgetMin} onChange={(event) => setField('budgetMin', event.target.value)} placeholder="$0" className={inputClass} /></label>
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Budget maximum</span><input type="number" min="0" step="1" value={form.budgetMax} onChange={(event) => setField('budgetMax', event.target.value)} placeholder="$0" className={inputClass} /></label>
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Timing</span><input value={form.timing} onChange={(event) => setField('timing', event.target.value)} placeholder="Pilot in Q4" className={inputClass} /></label>
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Follow-up date and time</span><input type="datetime-local" value={form.followUpAt} onChange={(event) => setField('followUpAt', event.target.value)} className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Recommended follow-up / next action</span><input value={form.recommendedFollowUp} onChange={(event) => setField('recommendedFollowUp', event.target.value)} placeholder="Send pilot scope and confirm buyer review" className={inputClass} /></label>
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Expected opportunity value</span><input type="number" min="0" step="1" value={form.expectedValue} onChange={(event) => setField('expectedValue', event.target.value)} placeholder={money(opportunity.value)} className={inputClass} /></label>
          <label><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Expected close date</span><input type="date" value={form.expectedCloseDate} onChange={(event) => setField('expectedCloseDate', event.target.value)} className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-[9px] font-medium text-stone-500">Follow-up tasks · maximum 10</span><textarea value={form.followUpTasks} onChange={(event) => setField('followUpTasks', event.target.value)} placeholder="Send proposal\nConfirm decision-maker review" className={areaClass} /><span className="mt-1 block text-[9px] text-stone-400">One task per line. The follow-up date above is used as the due date when provided.</span></label>
        </div></div>

        <label className="flex items-start gap-2 rounded-lg border border-stone-200 bg-white p-3"><input type="checkbox" checked={form.applyOpportunityUpdates} onChange={(event) => setField('applyOpportunityUpdates', event.target.checked)} className="mt-0.5" /><span><span className="block text-[10px] font-medium text-stone-800">Apply these value, probability, close-date, next-action, and follow-up fields to the opportunity</span><span className="mt-0.5 block text-[9px] leading-4 text-stone-400">Off by default. Saving call intelligence and tasks does not change the opportunity unless checked.</span></span></label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[9px] leading-4 text-stone-400">Submitting is the human approval. Writes occur in steps; refresh before retrying after an error.</p><button type="submit" disabled={saving} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-stone-950 px-4 text-[10px] font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save human-approved call'}</button></div>
        {notice ? <p role="status" className="text-[10px] font-medium text-emerald-700">{notice}</p> : null}
        {error ? <p role="alert" className="text-[10px] font-medium text-red-700">{error}</p> : null}
      </form>
    </details>
  );
}

const compactInputClass = 'h-9 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] text-stone-900 outline-none focus:border-stone-500';
const compactAreaClass = 'min-h-20 w-full resize-y rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11px] leading-4 text-stone-900 outline-none focus:border-stone-500';

function OwnerPicker({ value, owners, onChange, emptyLabel = 'Unassigned' }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)} className={compactInputClass}>
      <option value="">{emptyLabel}</option>
      {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {labelCase(owner.role)}</option>)}
    </select>
  );
}

function coreEditForm(recordType, record) {
  if (recordType === 'company') return {
    name: record.name || '', companyType: record.type || 'Other', website: record.website || '',
    location: record.location || '', relationshipStatus: record.relationshipStatus || 'unknown',
    ownerProfileId: record.ownerProfileId || '', nextAction: record.nextAction === 'Qualify relationship' ? '' : record.nextAction || '',
    nextActionDate: record.nextActionDateValue || '',
  };
  if (recordType === 'person') return {
    fullName: record.name || '', email: record.email || '', phone: record.phone || '', title: record.title || '',
    linkedinUrl: record.linkedinUrl || '', companyId: record.companyId || '',
    relationshipStrength: record.relationshipStrength || 'unknown', decisionMakerStatus: record.decisionMakerStatus || 'unknown',
    ownerProfileId: record.ownerProfileId || '', nextAction: record.nextAction === 'Qualify contact' ? '' : record.nextAction || '',
    nextActionDate: record.nextActionDateValue || '',
  };
  return {
    name: record.name || '', opportunityType: record.type || 'Other', priority: String(record.priority || 'Normal').toLowerCase(),
    expectedValue: record.expectedValueCentsValue == null ? '' : record.expectedValueCentsValue / 100,
    probability: record.probability || 0,
    fitScore: record.fitScoreValue == null ? '' : record.fitScoreValue,
    ownerProfileId: record.ownerProfileId || '', nextAction: record.nextAction === 'Qualify opportunity' ? '' : record.nextAction || '',
    nextActionDate: record.nextActionDateValue || '',
  };
}

function CoreRecordEditor({ recordType, record, companies, owners, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => coreEditForm(recordType, record));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setForm(coreEditForm(recordType, record)); setOpen(false); setNotice(''); setError(''); }, [record.id, record.version, recordType]);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const patch = recordType === 'company'
      ? {
          name: form.name, companyType: form.companyType, website: form.website || null,
          location: form.location || null, relationshipStatus: form.relationshipStatus,
          ownerProfileId: form.ownerProfileId || null, nextAction: form.nextAction || null,
          nextActionDate: form.nextActionDate || null,
        }
      : recordType === 'person'
        ? {
            fullName: form.fullName, email: form.email || null, phone: form.phone || null, title: form.title || null,
            linkedinUrl: form.linkedinUrl || null, companyId: form.companyId || null,
            relationshipStrength: form.relationshipStrength, decisionMakerStatus: form.decisionMakerStatus,
            ownerProfileId: form.ownerProfileId || null, nextAction: form.nextAction || null,
            nextActionDate: form.nextActionDate || null,
          }
        : {
            name: form.name, opportunityType: form.opportunityType, priority: form.priority,
            ...(form.expectedValue === ''
              ? (record.expectedValueCentsValue == null ? {} : { expectedValueCents: null })
              : { expectedValueCents: Math.round(Number(form.expectedValue) * 100) }),
            probability: Math.max(0, Math.min(100, Math.round(Number(form.probability) || 0))),
            ...(form.fitScore === ''
              ? (record.fitScoreValue == null ? {} : { fitScore: null })
              : { fitScore: Math.max(0, Math.min(100, Math.round(Number(form.fitScore)))) }),
            ownerProfileId: form.ownerProfileId || null, nextAction: form.nextAction || null,
            nextActionDate: form.nextActionDate || null,
          };
    try {
      const response = await apiPatch('/api/admin/bd', {
        action: `update_${recordType}`,
        id: record.id,
        expectedVersion: record.version,
        patch,
      });
      if (!response?.record) throw new Error('record_update_missing');
      onSaved(response.record);
      setNotice('Saved.');
      setOpen(false);
    } catch (requestError) {
      setError(requestError?.message || 'This record could not be saved. Refresh and try again.');
    } finally {
      setSaving(false);
    }
  };
  const label = (title, child) => <label><span className="mb-1 block text-[9px] font-medium text-stone-500">{title}</span>{child}</label>;
  return (
    <div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[10px] font-semibold text-stone-700 hover:border-stone-400">
        <Pencil className="h-3 w-3" /> {open ? 'Cancel edit' : 'Edit'}
      </button>
      {open ? (
        <form onSubmit={submit} className="mt-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {recordType === 'company' ? <>
              {label('Company name', <input required value={form.name} onChange={(event) => setField('name', event.target.value)} className={compactInputClass} />)}
              {label('Type', <select value={form.companyType} onChange={(event) => setField('companyType', event.target.value)} className={compactInputClass}>{COMPANY_TYPES.map((value) => <option key={value}>{value}</option>)}</select>)}
              {label('Website', <input value={form.website} onChange={(event) => setField('website', event.target.value)} placeholder="https://" className={compactInputClass} />)}
              {label('Location', <input value={form.location} onChange={(event) => setField('location', event.target.value)} className={compactInputClass} />)}
              {label('Relationship', <select value={form.relationshipStatus} onChange={(event) => setField('relationshipStatus', event.target.value)} className={compactInputClass}>{COMPANY_RELATIONSHIP_STATUSES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>)}
            </> : null}
            {recordType === 'person' ? <>
              {label('Full name', <input required value={form.fullName} onChange={(event) => setField('fullName', event.target.value)} className={compactInputClass} />)}
              {label('Title', <input value={form.title} onChange={(event) => setField('title', event.target.value)} className={compactInputClass} />)}
              {label('Email', <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} className={compactInputClass} />)}
              {label('Phone', <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} className={compactInputClass} />)}
              {label('LinkedIn', <input value={form.linkedinUrl} onChange={(event) => setField('linkedinUrl', event.target.value)} placeholder="https://linkedin.com/in/…" className={compactInputClass} />)}
              {label('Company', <select value={form.companyId} onChange={(event) => setField('companyId', event.target.value)} className={compactInputClass}><option value="">Unlinked</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>)}
              {label('Relationship strength', <select value={form.relationshipStrength} onChange={(event) => setField('relationshipStrength', event.target.value)} className={compactInputClass}>{RELATIONSHIP_STRENGTHS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>)}
              {label('Role', <select value={form.decisionMakerStatus} onChange={(event) => setField('decisionMakerStatus', event.target.value)} className={compactInputClass}>{DECISION_STATUSES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>)}
            </> : null}
            {recordType === 'opportunity' ? <>
              {label('Opportunity name', <input required value={form.name} onChange={(event) => setField('name', event.target.value)} className={compactInputClass} />)}
              {label('Type', <select value={form.opportunityType} onChange={(event) => setField('opportunityType', event.target.value)} className={compactInputClass}>{OPPORTUNITY_TYPES.map((value) => <option key={value}>{value}</option>)}</select>)}
              {label('Priority', <select value={form.priority} onChange={(event) => setField('priority', event.target.value)} className={compactInputClass}>{['low', 'normal', 'high', 'urgent'].map((value) => <option key={value} value={value}>{labelCase(value)}</option>)}</select>)}
              {label('Expected value', <input type="number" min="0" step="1" value={form.expectedValue} onChange={(event) => setField('expectedValue', event.target.value)} className={compactInputClass} />)}
              {label('Probability', <input type="number" min="0" max="100" value={form.probability} onChange={(event) => setField('probability', event.target.value)} className={compactInputClass} />)}
              {label('Fit score', <input type="number" min="0" max="100" value={form.fitScore} onChange={(event) => setField('fitScore', event.target.value)} className={compactInputClass} />)}
            </> : null}
            {label('Owner', <OwnerPicker value={form.ownerProfileId} owners={owners} onChange={(value) => setField('ownerProfileId', value)} />)}
            {label('Next action date', <input type="date" value={form.nextActionDate} onChange={(event) => setField('nextActionDate', event.target.value)} className={compactInputClass} />)}
            <label className="sm:col-span-2"><span className="mb-1 block text-[9px] font-medium text-stone-500">Next action</span><textarea value={form.nextAction} onChange={(event) => setField('nextAction', event.target.value)} className={compactAreaClass} /></label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[9px] text-stone-400">Human-approved CRM change.</span><button disabled={saving} type="submit" className="h-8 rounded-lg bg-stone-950 px-3 text-[10px] font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div>
          {notice ? <p role="status" className="mt-2 text-[10px] font-medium text-emerald-700">{notice}</p> : null}
          {error ? <p role="alert" className="mt-2 text-[10px] font-medium text-red-700">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

function ActivityEntryForm({ selection, company, onSaved }) {
  const [activityType, setActivityType] = useState('email');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError('');
    const relation = selection.type === 'company'
      ? { companyId: selection.id }
      : selection.type === 'person'
        ? { personId: selection.id, ...(company?.id ? { companyId: company.id } : {}) }
        : { opportunityId: selection.id, ...(company?.id ? { companyId: company.id } : {}) };
    try {
      const response = await apiPost('/api/admin/bd', {
        action: 'create_activity',
        activity: { activityType, content: content.trim(), ...relation },
      });
      if (!response?.record) throw new Error('activity_missing');
      onSaved(response.record);
      setContent('');
    } catch (requestError) {
      setError(requestError?.message || 'The activity could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
      <div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-stone-500" /><h4 className="text-[11px] font-semibold text-stone-900">Log communication</h4></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
        <label><span className="mb-1 block text-[9px] font-medium text-stone-500">Activity type</span><select value={activityType} onChange={(event) => setActivityType(event.target.value)} className={compactInputClass}>
          <option value="email">Email</option><option value="call">Call</option><option value="meeting">Meeting</option><option value="dm">Direct message</option>
        </select></label>
        <label><span className="mb-1 block text-[9px] font-medium text-stone-500">Activity details</span><textarea required value={content} onChange={(event) => setContent(event.target.value)} placeholder="What happened, who responded, and what comes next?" className={compactAreaClass} /></label>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[9px] text-stone-400">Saved to the relationship timeline.</span><button type="submit" disabled={saving || !content.trim()} className="h-8 rounded-lg bg-stone-950 px-3 text-[10px] font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save activity'}</button></div>
      {error ? <p role="alert" className="mt-2 text-[10px] font-medium text-red-700">{error}</p> : null}
    </form>
  );
}

function RelationshipManager({ selection, record, company, linkedPeople, linkedOpportunities, allPeople, companies, onRefresh, onRecordUpdated }) {
  const [adding, setAdding] = useState(false);
  const [personId, setPersonId] = useState('');
  const [companyId, setCompanyId] = useState(company?.id || '');
  const [role, setRole] = useState('stakeholder');
  const [strength, setStrength] = useState('unknown');
  const [decisionStatus, setDecisionStatus] = useState('unknown');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { setAdding(false); setPersonId(''); setCompanyId(company?.id || ''); setError(''); setNotice(''); }, [selection.type, selection.id, company?.id]);
  const run = async (action) => {
    setSaving(true); setError(''); setNotice('');
    try {
      await action();
      await onRefresh();
      setNotice('Relationships updated.');
      setAdding(false);
      setPersonId('');
    } catch (requestError) {
      setError(requestError?.message || 'The relationship could not be changed. Refresh and try again.');
    } finally {
      setSaving(false);
    }
  };
  const setOpportunityRole = (opportunityId, selectedPersonId, nextRole, expectedRole) => run(async () => {
    await apiPatch('/api/admin/bd', {
      action: 'set_opportunity_contact',
      relationship: { opportunityId, personId: selectedPersonId, relationshipRole: nextRole, ...(expectedRole ? { expectedRole } : {}) },
    });
  });
  const unlinkOpportunity = (opportunityId, selectedPersonId, expectedRole) => run(async () => {
    await apiPatch('/api/admin/bd', {
      action: 'remove_opportunity_contact',
      relationship: { opportunityId, personId: selectedPersonId, expectedRole },
    });
  });
  const updatePerson = (personRecord, patch) => run(async () => {
    const currentPayload = await apiGet(`/api/admin/bd?view=record&recordType=person&id=${encodeURIComponent(personRecord.id)}`);
    const currentPerson = currentPayload?.record;
    if (!currentPerson?.id || !currentPerson?.version) throw new Error('The current contact could not be loaded.');
    const response = await apiPatch('/api/admin/bd', {
      action: 'update_person', id: currentPerson.id, expectedVersion: currentPerson.version, patch,
    });
    if (response?.record) onRecordUpdated('person', response.record);
  });
  const addRelationship = (event) => {
    event.preventDefault();
    if (selection.type === 'opportunity' && personId) return setOpportunityRole(selection.id, personId, role);
    if (selection.type === 'company' && personId) {
      const selected = allPeople.find((item) => item.id === personId);
      if (selected) return updatePerson(selected, { companyId: selection.id, relationshipStrength: strength, decisionMakerStatus: decisionStatus });
    }
    if (selection.type === 'person' && companyId) return updatePerson(record, { companyId, relationshipStrength: strength, decisionMakerStatus: decisionStatus });
    return undefined;
  };
  const availablePeople = allPeople.filter((item) => {
    if (selection.type === 'opportunity') return !linkedPeople.some((linked) => linked.id === item.id);
    if (selection.type === 'company') return !item.companyId;
    return true;
  });
  return (
    <section>
      <div className="flex items-center justify-between gap-3"><SectionHeader title="Relationships" /><button type="button" onClick={() => setAdding((value) => !value)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[10px] font-semibold text-stone-700 hover:border-stone-400"><Link2 className="h-3 w-3" /> {adding ? 'Cancel' : 'Add relationship'}</button></div>
      {adding ? (
        <form onSubmit={addRelationship} className="mt-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {selection.type === 'person' ? <label className="sm:col-span-2"><span className="mb-1 block text-[9px] font-medium text-stone-500">Company</span><select required value={companyId} onChange={(event) => setCompanyId(event.target.value)} className={compactInputClass}><option value="">Choose company</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{company?.id ? <span className="mt-1 block text-[9px] text-stone-400">Choosing another company moves this contact from {company.name}.</span> : null}</label> : <label className="sm:col-span-2"><span className="mb-1 block text-[9px] font-medium text-stone-500">Contact</span><select required value={personId} onChange={(event) => setPersonId(event.target.value)} className={compactInputClass}><option value="">Choose contact</option>{availablePeople.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.company}</option>)}</select>{selection.type === 'company' ? <span className="mt-1 block text-[9px] text-stone-400">Only unlinked contacts are shown. Move an existing contact from that person’s record.</span> : null}</label>}
            {selection.type === 'opportunity' ? <label><span className="mb-1 block text-[9px] font-medium text-stone-500">Role</span><select value={role} onChange={(event) => setRole(event.target.value)} className={compactInputClass}>{RELATIONSHIP_ROLES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label> : null}
            {selection.type !== 'opportunity' ? <><label><span className="mb-1 block text-[9px] font-medium text-stone-500">Strength</span><select value={strength} onChange={(event) => setStrength(event.target.value)} className={compactInputClass}>{RELATIONSHIP_STRENGTHS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label><label><span className="mb-1 block text-[9px] font-medium text-stone-500">Role</span><select value={decisionStatus} onChange={(event) => setDecisionStatus(event.target.value)} className={compactInputClass}>{DECISION_STATUSES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label></> : null}
          </div>
          <div className="mt-3 flex justify-end"><button type="submit" disabled={saving} className="h-8 rounded-lg bg-stone-950 px-3 text-[10px] font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Add relationship'}</button></div>
        </form>
      ) : null}
      <div className="mt-3 space-y-2">
        {selection.type === 'opportunity' ? linkedPeople.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-2"><Avatar name={item.name} /><span className="min-w-0"><span className="block truncate text-[11px] font-medium text-stone-900">{item.name}</span><span className="block truncate text-[9px] text-stone-400">{item.title || item.company}</span></span></div><select aria-label={`Opportunity role for ${item.name}`} value={item.relationshipRole || 'stakeholder'} onChange={(event) => setOpportunityRole(selection.id, item.id, event.target.value, item.relationshipRole || 'stakeholder')} disabled={saving} className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[10px]">{RELATIONSHIP_ROLES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select><button aria-label={`Unlink ${item.name} from this opportunity`} type="button" onClick={() => unlinkOpportunity(selection.id, item.id, item.relationshipRole || 'stakeholder')} disabled={saving} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-200 px-2 text-[9px] font-medium text-red-700"><Trash2 className="h-3 w-3" /> Unlink</button></div>) : null}
        {selection.type === 'person' ? linkedOpportunities.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium text-stone-900">{item.name}</span><span className="block text-[9px] text-stone-400">{item.company} · {item.stage}</span></div><select aria-label={`Relationship role on ${item.name}`} value={item.relationshipRole || 'stakeholder'} onChange={(event) => setOpportunityRole(item.id, selection.id, event.target.value, item.relationshipRole || 'stakeholder')} disabled={saving} className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[10px]">{RELATIONSHIP_ROLES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select><button aria-label={`Unlink this contact from ${item.name}`} type="button" onClick={() => unlinkOpportunity(item.id, selection.id, item.relationshipRole || 'stakeholder')} disabled={saving} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-200 px-2 text-[9px] font-medium text-red-700"><Trash2 className="h-3 w-3" /> Unlink</button></div>) : null}
        {selection.type === 'company' ? linkedPeople.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-2"><Avatar name={item.name} /><span className="min-w-0"><span className="block truncate text-[11px] font-medium text-stone-900">{item.name}</span><span className="block truncate text-[9px] text-stone-400">{item.title || 'Contact'} · {item.relationship}</span></span></div><select aria-label={`Relationship strength for ${item.name}`} value={item.relationshipStrength || 'unknown'} onChange={(event) => updatePerson(item, { relationshipStrength: event.target.value })} disabled={saving} className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[10px]">{RELATIONSHIP_STRENGTHS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select><select aria-label={`Relationship role for ${item.name}`} value={item.decisionMakerStatus || 'unknown'} onChange={(event) => updatePerson(item, { decisionMakerStatus: event.target.value })} disabled={saving} className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[10px]">{DECISION_STATUSES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select><button aria-label={`Unlink ${item.name} from this company`} type="button" onClick={() => updatePerson(item, { companyId: null })} disabled={saving} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-200 px-2 text-[9px] font-medium text-red-700"><Trash2 className="h-3 w-3" /> Unlink</button></div>) : null}
        {selection.type === 'opportunity' && linkedPeople.length === 0 ? <EmptyRows>No contacts are linked to this opportunity.</EmptyRows> : null}
        {selection.type === 'person' && linkedOpportunities.length === 0 ? <EmptyRows>No opportunities are linked to this contact.</EmptyRows> : null}
        {selection.type === 'company' && linkedPeople.length === 0 ? <EmptyRows>No contacts are linked to this company.</EmptyRows> : null}
      </div>
      {notice ? <p role="status" className="mt-2 text-[10px] font-medium text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="mt-2 text-[10px] font-medium text-red-700">{error}</p> : null}
    </section>
  );
}

function RecordPanel({ selection, companies, people, opportunities, owners, activities, sourceStatus, onRecordUpdated, onOpportunityUpdated, onClose }) {
  const preview = sourceStatus === 'preview';
  const fallbackPerson = selection?.type === 'person' ? people.find((item) => item.id === selection.id) : null;
  const fallbackOpportunity = selection?.type === 'opportunity' ? opportunities.find((item) => item.id === selection.id) : null;
  const fallbackCompany = selection?.type === 'company'
    ? companies.find((item) => item.id === selection.id)
    : companies.find((item) => item.id === (fallbackPerson?.companyId || fallbackOpportunity?.companyId));
  const fallbackRecord = fallbackPerson || fallbackOpportunity || fallbackCompany;
  const [tab, setTab] = useState('overview');
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(sourceStatus === 'live');
  const [loadError, setLoadError] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    let active = true;
    setTab('overview');
    setContext(null);
    setLoadError('');
    setNoteDraft('');
    if (sourceStatus !== 'live' || !selection) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    apiGet(`/api/admin/bd?view=record&recordType=${encodeURIComponent(selection.type)}&id=${encodeURIComponent(selection.id)}`)
      .then((payload) => {
        assertApiResponse(payload, {
          objects: ['record', 'relationships', 'runtime'],
          arrays: [
            'relationships.companies', 'relationships.people', 'relationships.opportunities',
            'timeline', 'tasks', 'notes', 'files', 'callIntelligence', 'mutationHistory',
          ],
        }, 'Avalon BD returned an invalid record response.');
        if (active) setContext(payload);
      })
      .catch(() => { if (active) setLoadError('This connected CRM record could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selection, sourceStatus]);

  const refreshContext = async () => {
    const payload = await apiGet(`/api/admin/bd?view=record&recordType=${encodeURIComponent(selection.type)}&id=${encodeURIComponent(selection.id)}`);
    assertApiResponse(payload, {
      objects: ['record', 'relationships', 'runtime'],
      arrays: [
        'relationships.companies', 'relationships.people', 'relationships.opportunities',
        'timeline', 'tasks', 'notes', 'files', 'callIntelligence', 'mutationHistory',
      ],
    }, 'Avalon BD returned an invalid record response.');
    setContext(payload);
    return payload;
  };

  if (sourceStatus !== 'live' || !selection || (preview && !fallbackRecord)) return null;

  const relationshipCompanies = preview ? (fallbackCompany ? [fallbackCompany] : []) : (context?.relationships?.companies || []).map(normalizeCompanyRecord);
  const companyFromContext = selection.type === 'company' && context?.record
    ? {
        ...normalizeCompanyRecord(context.record),
        stage: fallbackCompany?.stage || 'No opportunity',
        openValue: fallbackCompany?.openValue || 0,
        primaryContact: fallbackCompany?.primaryContact || 'Unassigned',
      }
    : relationshipCompanies[0] || fallbackCompany;
  const companyName = companyFromContext?.name || fallbackCompany?.name || 'Unlinked';
  const person = preview
    ? fallbackPerson
    : selection.type === 'person' && context?.record
      ? { ...normalizePersonRecord(context.record), company: companyName }
      : null;
  const opportunity = preview
    ? fallbackOpportunity
    : selection.type === 'opportunity' && context?.record
      ? { ...normalizeOpportunityRecord(context.record), company: companyName }
      : null;
  const company = selection.type === 'company' ? companyFromContext : companyFromContext || fallbackCompany;
  const record = person || opportunity || company || fallbackRecord;
  const title = record?.name || 'CRM record';
  const subtitle = person ? `${person.title || 'Contact'} · ${person.company}` : opportunity ? opportunity.company : company ? `${company.type} · ${company.location || 'Location not set'}` : 'Connected record';
  const linkedPeople = preview
    ? people.filter((item) => item.companyId === company?.id)
    : (context?.relationships?.people || []).map((row) => ({ ...normalizePersonRecord(row), company: companyName }));
  const linkedOpportunities = preview
    ? opportunities.filter((item) => item.companyId === company?.id)
    : (context?.relationships?.opportunities || []).map((row) => ({ ...normalizeOpportunityRecord(row), company: companyName }));
  const linkedTasks = preview ? [] : (context?.tasks || []).map(normalizeTaskRecord);
  const notes = preview ? [] : (context?.notes || []);
  const files = preview ? [] : (context?.files || []);
  const calls = preview ? [] : (context?.callIntelligence || []);
  const mutations = preview ? [] : (context?.mutationHistory || []);
  const timeline = preview
    ? activities.map((item) => ({ ...item, occurredAt: item.time, isAgent: item.isAgent === true }))
    : [
        ...(context?.timeline || []).map((item) => ({
          id: `activity-${item.id}`,
          title: labelCase(item.activity_type, 'Activity'),
          detail: item.content || 'Activity recorded.',
          occurredAt: item.occurred_at,
          actor: item.actor_type === 'agent' ? `Agent${item.model_used ? ` · ${item.model_used}` : ''}` : item.actor_type === 'system' ? 'System' : 'Human operator',
          source: item.source,
          isAgent: item.actor_type === 'agent',
        })),
        ...mutations.map((item) => ({
          id: `mutation-${item.id}`,
          title: labelCase(item.action, 'Record mutation'),
          detail: `${labelCase(item.object_type, 'Record')} mutation · ${labelCase(item.approval_status, 'Approval unknown')}`,
          occurredAt: item.created_at,
          actor: item.actor_type === 'agent' || item.agent_identity_id ? `Agent${item.model_used ? ` · ${item.model_used}` : ''}` : 'Human operator',
          source: item.source,
          isAgent: Boolean(item.actor_type === 'agent' || item.agent_identity_id),
        })),
      ].sort((left, right) => Date.parse(right.occurredAt || 0) - Date.parse(left.occurredAt || 0));
  const latestMutation = mutations[0];
  const stageLabel = opportunity?.stage || (selection.type === 'company' ? company?.stage : null);

  const addNote = async (event) => {
    event.preventDefault();
    const content = noteDraft.trim();
    if (!content || preview || !context) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      const relationKey = `${selection.type}Id`;
      const response = await apiPost('/api/admin/bd', { action: 'add_note', note: { content, [relationKey]: selection.id, source: 'manual' } });
      if (response?.record) setContext((current) => ({ ...current, notes: [response.record, ...(current.notes || [])] }));
      setNoteDraft('');
    } catch {
      setNoteError('The note could not be saved. Try again.');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCallSaved = (response) => {
    setContext((current) => ({
      ...current,
      record: response?.opportunity || current.record,
      callIntelligence: response?.call ? [response.call, ...(current.callIntelligence || [])] : current.callIntelligence,
      timeline: response?.activity ? [response.activity, ...(current.timeline || [])] : current.timeline,
      tasks: response?.tasks?.length ? [...response.tasks, ...(current.tasks || [])] : current.tasks,
    }));
    if (response?.opportunity) onOpportunityUpdated?.(response.opportunity);
  };

  const applyRecordSaved = (recordType, row) => {
    setContext((current) => selection.type === recordType ? ({ ...current, record: row }) : current);
    onRecordUpdated?.(recordType, row);
  };

  const handleRecordSaved = (recordType, row) => {
    applyRecordSaved(recordType, row);
    refreshContext().catch(() => setLoadError('The saved record could not be refreshed.'));
  };

  const handleActivitySaved = (activity) => {
    setContext((current) => ({ ...current, timeline: [activity, ...(current?.timeline || [])] }));
  };

  return (
    <div className="avalon-bd-workspace fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={`${title} record`}>
      <button type="button" className="absolute inset-0 bg-stone-950/20 backdrop-blur-[1px]" onClick={onClose} aria-label="Close record" />
      <div className="relative flex h-full w-full max-w-[680px] flex-col bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.12)]">
        <header className="border-b border-stone-200 px-5 pb-0 pt-5 sm:px-7">
          <div className="flex items-start gap-3">
            <Avatar name={title} square={!person} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-[19px] font-semibold tracking-[-0.025em] text-stone-950">{title}</h2>{stageLabel ? <span className={`rounded-full px-2 py-1 text-[9px] font-medium ring-1 ring-inset ${toneForStage(stageLabel)}`}>{stageLabel}</span> : null}</div>
              <p className="mt-0.5 truncate text-[11px] text-stone-500">{subtitle}</p>
            </div>
            <IconButton label="Close record" onClick={onClose}><X className="h-4 w-4" /></IconButton>
          </div>
          <div className="mt-5 flex gap-4">{['overview', 'timeline', 'notes', 'files'].map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`border-b-2 pb-3 text-[11px] font-medium capitalize ${tab === item ? 'border-stone-950 text-stone-950' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>{item}</button>)}</div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading ? <div className="py-16 text-center text-[11px] text-stone-400">Loading connected record context…</div> : null}
          {!loading && loadError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[11px] text-red-700">{loadError} No preview data is substituted for a failed live record.</div> : null}
          {!loading && !loadError && tab === 'overview' ? (
            <div className="space-y-7">
              <section>
                <div className="flex items-center justify-between gap-3"><SectionHeader title="Core fields" /><CoreRecordEditor recordType={selection.type} record={record} companies={companies} owners={owners} onSaved={(row) => handleRecordSaved(selection.type, row)} /></div>
                {person ? <><FieldRow label="Email">{person.email ? <a href={`mailto:${person.email}`} className="text-stone-800 hover:underline">{person.email}</a> : '—'}</FieldRow><FieldRow label="Phone" value={person.phone} /><FieldRow label="Relationship" value={person.relationship} /><FieldRow label="Decision maker" value={person.decisionMaker ? 'Yes' : 'No'} /><FieldRow label="Owner" value={person.owner} /><FieldRow label="Next action" value={person.nextAction} /></> : opportunity ? <><FieldRow label="Company" value={opportunity.company} /><FieldRow label="Type" value={opportunity.type} /><FieldRow label="Stage" value={opportunity.stage} /><FieldRow label="Expected value" value={money(opportunity.value)} /><FieldRow label="Probability" value={`${opportunity.probability}%`} /><FieldRow label="Weighted value" value={money(opportunity.value * opportunity.probability / 100)} /><FieldRow label="Owner" value={opportunity.owner} /><FieldRow label="Next action" value={`${opportunity.nextAction} · ${opportunity.nextActionDate}`} /></> : company ? <><FieldRow label="Type" value={company.type} /><FieldRow label="Location" value={company.location} /><FieldRow label="Primary contact" value={company.primaryContact} /><FieldRow label="Owner" value={company.owner} /><FieldRow label="Source" value={company.source} /><FieldRow label="Open value" value={money(company.openValue)} /><FieldRow label="Next action" value={`${company.nextAction} · ${company.nextActionDate}`} /></> : null}
              </section>
              <RelationshipManager selection={selection} record={record} company={company} linkedPeople={linkedPeople} linkedOpportunities={linkedOpportunities} allPeople={people} companies={companies} onRefresh={refreshContext} onRecordUpdated={applyRecordSaved} />
              <section>
                <SectionHeader title="Related work" />
                <div className="grid gap-3 pt-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 p-3"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-stone-400">Opportunities</p>{linkedOpportunities.length ? linkedOpportunities.slice(0, 6).map((item) => <div key={item.id} className="mt-3"><span className="block text-[11px] font-medium text-stone-800">{item.name}</span><span className="mt-0.5 block text-[9px] text-stone-400">{item.stage} · {money(item.value)}</span></div>) : <p className="mt-3 text-[10px] text-stone-400">No linked opportunities</p>}</div>
                  <div className="rounded-xl border border-stone-200 p-3"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-stone-400">Tasks</p>{linkedTasks.length ? linkedTasks.filter((item) => item.status !== 'cancelled').slice(0, 6).map((item) => <div key={item.id} className="mt-3"><span className="block text-[11px] font-medium text-stone-800">{item.title}</span><span className="mt-0.5 block text-[9px] text-stone-400">{item.status === 'completed' ? 'Completed' : item.status === 'in_progress' ? `In progress · ${item.due}` : item.due}</span></div>) : <p className="mt-3 text-[10px] text-stone-400">No linked tasks</p>}</div>
                </div>
              </section>
              <ActivityEntryForm selection={selection} company={company} onSaved={handleActivitySaved} />
              {opportunity ? (
                <section>
                  <SectionHeader title="Call intelligence" meta={preview ? 'Preview unavailable' : `${calls.length} recorded`} />
                  {preview ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-800">Preview only · call intelligence cannot be entered or persisted until the CRM is connected.</div> : <CallIntelligenceForm company={company} opportunity={opportunity} onSaved={handleCallSaved} />}
                  {calls.length ? <div className="space-y-3 pt-4">{calls.map((call) => <div key={call.id} className="rounded-xl border border-stone-200 p-4"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-stone-900">{call.summary || 'Discovery call'}</p><Pill tone={call.approval_status === 'approved' ? 'green' : 'neutral'}>{labelCase(call.approval_status, 'Pending')}</Pill></div><p className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-stone-500">{call.manual_notes || 'No additional manual notes.'}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><FieldRow label="Budget" value={call.budget_min_cents || call.budget_max_cents ? `${money(Number(call.budget_min_cents || 0) / 100)}–${money(Number(call.budget_max_cents || 0) / 100)}` : 'Not captured'} /><FieldRow label="Timing" value={call.timing} /><FieldRow label="Probability" value={call.deal_probability == null ? 'Not captured' : `${call.deal_probability}%`} /><FieldRow label="Follow-up" value={dateTimeLabel(call.follow_up_at, 'Not scheduled')} /><FieldRow label="Expected value" value={call.expected_value_cents == null ? 'Not captured' : money(Number(call.expected_value_cents) / 100)} /><FieldRow label="Expected close" value={dateOnlyLabel(call.expected_close_date, 'Not captured')} /></div>{Array.isArray(call.requirements) && call.requirements.length ? <div className="mt-3"><p className="text-[9px] font-medium uppercase tracking-[0.08em] text-stone-400">Requirements</p><p className="mt-1 text-[10px] leading-4 text-stone-600">{call.requirements.join(' · ')}</p></div> : null}<p className="mt-3 text-[9px] text-amber-700">Transcript extraction and recording storage are not connected. This is persisted manual call intelligence.</p></div>)}</div> : <EmptyRows>No call intelligence is recorded for this opportunity.</EmptyRows>}
                </section>
              ) : null}
              <section className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-stone-900 text-white"><Sparkles className="h-3.5 w-3.5" /></span><div><h3 className="text-[12px] font-semibold text-stone-900">Audit context</h3><p className="text-[9px] text-stone-400">Persisted mutation attribution</p></div></div>{latestMutation?.confidence != null ? <Pill tone="green">{Math.round(Number(latestMutation.confidence) * 100)}% confidence</Pill> : null}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-[9px] font-medium uppercase tracking-[0.08em] text-stone-400">Next action</p><p className="mt-1 text-[11px] leading-5 text-stone-700">{company?.nextAction || opportunity?.nextAction || person?.nextAction || 'No next action recorded.'}</p></div><div><p className="text-[9px] font-medium uppercase tracking-[0.08em] text-stone-400">Latest mutation</p><p className="mt-1 text-[11px] leading-5 text-stone-700">{latestMutation ? `${labelCase(latestMutation.action)} · ${latestMutation.model_used || (latestMutation.agent_identity_id ? 'Agent' : 'Human operator')}` : 'No mutation attribution recorded.'}</p></div></div>
                <p className="mt-3 text-[10px] text-stone-500">This panel reports saved attribution only. It does not run automated work.</p>
              </section>
            </div>
          ) : null}
          {!loading && !loadError && tab === 'timeline' ? (
            <section><SectionHeader title="Relationship timeline" meta="Human + agent attributed" /><div className="pt-3">{timeline.map((activity) => <div key={activity.id} className="flex gap-3 border-b border-stone-100 py-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-stone-300" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-medium text-stone-900">{activity.title}</p>{activity.isAgent ? <Pill icon={Bot}>Agent</Pill> : null}</div><p className="mt-1 text-[10px] leading-4 text-stone-500">{activity.detail}</p><p className="mt-1.5 text-[9px] text-stone-400">{dateLabel(activity.occurredAt, activity.occurredAt)} · {activity.actor}{activity.source ? ` · ${labelCase(activity.source)}` : ''}</p></div></div>)}{timeline.length === 0 ? <EmptyRows>No timeline activities or mutations are recorded.</EmptyRows> : null}</div></section>
          ) : null}
          {!loading && !loadError && tab === 'notes' ? (
            <section>
              <SectionHeader title="Notes" meta={preview ? 'Preview only' : `${notes.length} saved`} />
              {preview ? <><textarea readOnly defaultValue={person?.notes || company?.description || 'Preview note — capture relationship context, decisions, and next steps here.'} className="mt-4 min-h-36 w-full resize-y rounded-xl border border-stone-200 bg-stone-50 p-3 text-[11px] leading-5 text-stone-700 outline-none" /><p className="mt-2 text-[9px] text-amber-700">Preview only · this example is not editable or persisted.</p></> : <><form onSubmit={addNote} className="mt-4"><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add relationship context, a decision, or next step…" className="min-h-24 w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-[11px] leading-5 text-stone-700 outline-none focus:border-stone-400" /><div className="mt-2 flex items-center justify-between gap-3"><p className="text-[9px] text-stone-400">Saved directly to this connected CRM record.</p><button type="submit" disabled={noteSaving || !noteDraft.trim()} className="inline-flex h-8 items-center rounded-lg bg-stone-900 px-3 text-[10px] font-medium text-white disabled:opacity-40">{noteSaving ? 'Saving…' : 'Save note'}</button></div>{noteError ? <p className="mt-2 text-[10px] text-red-700">{noteError}</p> : null}</form><div className="mt-5 space-y-3">{notes.map((note) => <article key={note.id} className="rounded-xl border border-stone-200 p-3"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold text-stone-900">{note.title || 'Note'}</p><span className="text-[9px] text-stone-400">{dateLabel(note.updated_at || note.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-stone-600">{note.content}</p><p className="mt-2 text-[9px] text-stone-400">{labelCase(note.source, 'Manual')}</p></article>)}{notes.length === 0 ? <EmptyRows>No notes are saved for this record.</EmptyRows> : null}</div></>}
            </section>
          ) : null}
          {!loading && !loadError && tab === 'files' ? (
            <section><SectionHeader title="Files" meta={preview ? 'Preview only' : `${files.length} metadata records`} />{files.length ? <div className="mt-4 space-y-2">{files.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100"><FileText className="h-4 w-4 text-stone-500" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium text-stone-900">{file.file_name}</span><span className="block text-[9px] text-stone-400">{labelCase(file.document_type, 'File')} · {labelCase(file.storage_status, 'Metadata only')}</span></span></div>)}</div> : <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 text-center"><FileText className="h-5 w-5 text-stone-300" /><p className="mt-2 text-[11px] font-medium text-stone-600">No file metadata recorded</p></div>}<p className="mt-3 text-[9px] text-amber-700">File storage and upload are staged; Avalon BD currently stores metadata only.</p></section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CREATE_FIELDS = {
  Company: [
    { key: 'name', label: 'Company name', placeholder: 'Company name', required: true },
    { key: 'type', label: 'Company type', options: COMPANY_TYPES },
    { key: 'website', label: 'Website', placeholder: 'https://' },
    { key: 'ownerProfileId', label: 'Owner', ownerSelector: true },
  ],
  Person: [
    { key: 'name', label: 'Full name', placeholder: 'First and last name', required: true },
    { key: 'email', label: 'Email', placeholder: 'name@company.com', type: 'email' },
    { key: 'phone', label: 'Phone', placeholder: '+1 415…' },
    { key: 'companyId', label: 'Company', companySelector: true },
    { key: 'title', label: 'Title', placeholder: 'Role or title' },
    { key: 'relationshipStrength', label: 'Relationship strength', options: RELATIONSHIP_STRENGTHS },
    { key: 'decisionMakerStatus', label: 'Role', options: DECISION_STATUSES },
    { key: 'ownerProfileId', label: 'Owner', ownerSelector: true },
  ],
  Opportunity: [
    { key: 'name', label: 'Opportunity name', placeholder: 'What could Avalon win?', required: true },
    { key: 'companyId', label: 'Company', companySelector: true, required: true },
    { key: 'primaryContactId', label: 'Primary contact', personSelector: true },
    { key: 'opportunityType', label: 'Opportunity type', options: OPPORTUNITY_TYPES },
    { key: 'value', label: 'Expected value', placeholder: '$0' },
    { key: 'ownerProfileId', label: 'Owner', ownerSelector: true },
  ],
  Task: [
    { key: 'name', label: 'Task', placeholder: 'What needs to happen?', required: true },
    { key: 'companyId', label: 'Company', companySelector: true, required: true },
    { key: 'due', label: 'Due date and time · optional', placeholder: '', type: 'datetime-local' },
    { key: 'ownerProfileId', label: 'Owner', ownerSelector: true },
  ],
  Note: [
    { key: 'name', label: 'Note', placeholder: 'Capture relationship context', required: true, multiline: true },
    { key: 'companyId', label: 'Company', companySelector: true, required: true },
  ],
};

function personCompanyOptions(companies = []) {
  const nameCounts = new Map();
  for (const company of companies) {
    const key = String(company.name || '').trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  return companies.map((company) => {
    const name = String(company.name || 'Unnamed company').trim();
    const duplicate = (nameCounts.get(name.toLowerCase()) || 0) > 1;
    const qualifiers = [company.normalized_domain || company.normalizedDomain, company.location]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const fallback = `ID ${String(company.id || '').slice(0, 8)}`;
    return {
      id: company.id,
      label: duplicate ? `${name} · ${(qualifiers.length ? qualifiers : [fallback]).join(' · ')}` : name,
    };
  }).sort((left, right) => left.label.localeCompare(right.label));
}

function CreatePanel({ initialType = 'Company', companies = [], people = [], owners = [], onClose, onCreate, sourceStatus }) {
  const [type, setType] = useState(initialType);
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState('');
  const companyOptions = useMemo(() => personCompanyOptions(companies), [companies]);
  useEffect(() => { setType(initialType); setForm({}); setNotice(''); }, [initialType]);
  const submit = (event) => {
    event.preventDefault();
    if (!String(form.name || '').trim()) return;
    Promise.resolve(onCreate(type, form)).then((created) => {
      if (created === false) {
        setNotice('This record could not be created. Try again.');
        return;
      }
      setNotice(sourceStatus === 'live' ? `${type} created.` : 'Connected CRM data is unavailable.');
      setForm({});
    });
  };
  return (
    <div className="avalon-bd-workspace fixed inset-0 z-[85] flex justify-end" role="dialog" aria-modal="true" aria-label="Create CRM record">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-stone-950/20" aria-label="Close create panel" />
      <div className="relative h-full w-full max-w-[460px] overflow-y-auto bg-white p-5 shadow-[-20px_0_60px_rgba(0,0,0,0.12)] sm:p-7">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Create</p><h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-stone-950">New {type.toLowerCase()}</h2></div><IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton></div>
        <div className="mt-6 flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
          {Object.keys(CREATE_FIELDS).map((item) => <button key={item} type="button" onClick={() => { setType(item); setForm({}); setNotice(''); }} className={`h-8 flex-1 rounded-lg px-2 text-[10px] font-medium ${type === item ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>{item}</button>)}
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {CREATE_FIELDS[type].map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1.5 block text-[10px] font-medium text-stone-500">{field.label}{field.required ? ' *' : ''}</span>
              {field.companySelector ? (
                <select
                  value={form.companyId || ''}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    companyId: event.target.value,
                    ...(type === 'Opportunity' ? { primaryContactId: '' } : {}),
                  }))}
                  required={field.required}
                  className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-[12px] text-stone-900 outline-none focus:border-stone-500"
                >
                  <option value="">Unlinked</option>
                  {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}
                </select>
              ) : field.personSelector ? (
                <select value={form.primaryContactId || ''} onChange={(event) => setForm((current) => ({ ...current, primaryContactId: event.target.value }))} className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-[12px] text-stone-900 outline-none focus:border-stone-500">
                  <option value="">No primary contact yet</option>
                  {people.filter((person) => !form.companyId || person.companyId === form.companyId).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.title || person.company}</option>)}
                </select>
              ) : field.ownerSelector ? (
                <OwnerPicker value={form.ownerProfileId || ''} owners={owners} emptyLabel="Me by default" onChange={(value) => setForm((current) => ({ ...current, ownerProfileId: value }))} />
              ) : field.options ? (
                <select value={form[field.key] || (Array.isArray(field.options[0]) ? field.options[0][0] : field.options[0])} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-[12px] text-stone-900 outline-none focus:border-stone-500">
                  {field.options.map((option) => Array.isArray(option) ? <option key={option[0]} value={option[0]}>{option[1]}</option> : <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field.multiline ? (
                <textarea value={form[field.key] || ''} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} required={field.required} className="min-h-28 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-900 outline-none placeholder:text-stone-300 focus:border-stone-500" />
              ) : (
                <input type={field.type || 'text'} value={form[field.key] || ''} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} required={field.required} className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-[12px] text-stone-900 outline-none placeholder:text-stone-300 focus:border-stone-500" />
              )}
            </label>
          ))}
          <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 text-[11px] font-semibold text-white transition hover:bg-black"><Plus className="h-3.5 w-3.5" /> Create {type.toLowerCase()}</button>
          {notice ? <p className="text-center text-[10px] font-medium text-emerald-700">{notice}</p> : null}
        </form>
      </div>
    </div>
  );
}

function SearchPalette({ companies, people, opportunities, sourceStatus, onClose, onOpen }) {
  const [query, setQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const localResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    const all = [
      ...companies.map((item) => ({ type: 'company', id: item.id, title: item.name, meta: `${item.type} · ${item.stage}`, icon: Building2 })),
      ...people.map((item) => ({ type: 'person', id: item.id, title: item.name, meta: `${item.title} · ${item.company}`, icon: UserRound })),
      ...opportunities.map((item) => ({ type: 'opportunity', id: item.id, title: item.name, meta: `${item.company} · ${item.stage}`, icon: Target })),
    ];
    if (!value) return all.slice(0, 7);
    return all.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(value)).slice(0, 10);
  }, [companies, opportunities, people, query]);

  useEffect(() => {
    if (sourceStatus !== 'live') return undefined;
    const value = query.trim();
    if (value.length < 2) {
      setLiveResults([]);
      setSearchStatus('idle');
      return undefined;
    }
    let active = true;
    setSearchStatus('loading');
    const timer = window.setTimeout(() => {
      apiGet(`/api/admin/bd?view=search&q=${encodeURIComponent(value)}`)
        .then((payload) => {
          if (!active) return;
          assertApiResponse(payload, {
            arrays: ['companies', 'people', 'opportunities', 'notes', 'activities', 'tasks'],
          }, 'Avalon BD returned an invalid search response.');
          const companyNames = new Map(companies.map((item) => [item.id, item.name]));
          const companyRows = payload.companies;
          const peopleRows = payload.people;
          const opportunityRows = payload.opportunities;
          const noteRows = payload.notes;
          const activityRows = payload.activities;
          const taskRows = payload.tasks;
          setLiveResults([
            ...companyRows.map((row) => {
              const item = normalizeCompanyRecord(row);
              return { type: 'company', id: item.id, title: item.name, meta: labelCase(item.type, 'Company'), icon: Building2 };
            }),
            ...peopleRows.map((row) => {
              const item = normalizePersonRecord(row);
              const company = companyNames.get(item.companyId) || 'Unlinked';
              return { type: 'person', id: item.id, title: item.name, meta: [item.title, company].filter(Boolean).join(' · '), icon: UserRound };
            }),
            ...opportunityRows.map((row) => {
              const item = normalizeOpportunityRecord(row);
              const company = companyNames.get(item.companyId) || 'Unlinked';
              return { type: 'opportunity', id: item.id, title: item.name, meta: `${company} · ${item.stage}`, icon: Target };
            }),
            ...noteRows.map((row) => {
              const type = row.opportunity_id ? 'opportunity' : row.person_id ? 'person' : 'company';
              const id = row.opportunity_id || row.person_id || row.company_id;
              const excerpt = String(row.content || '').replace(/\s+/g, ' ').trim();
              return { type, id, resultType: 'note', resultId: row.id, title: row.title || 'CRM note', meta: excerpt || 'Linked CRM note', icon: MessageSquare };
            }).filter((item) => item.id),
            ...activityRows.map((row) => {
              const type = row.opportunity_id ? 'opportunity' : row.primary_person_id ? 'person' : 'company';
              const id = row.opportunity_id || row.primary_person_id || row.company_id;
              const excerpt = String(row.content || '').replace(/\s+/g, ' ').trim();
              return { type, id, resultType: 'activity', resultId: row.id, title: labelCase(row.activity_type, 'CRM activity'), meta: excerpt || 'Linked CRM activity', icon: Clock3 };
            }).filter((item) => item.id),
            ...taskRows.map((row) => {
              const type = row.opportunity_id ? 'opportunity' : row.person_id ? 'person' : 'company';
              const id = row.opportunity_id || row.person_id || row.company_id;
              const details = [labelCase(row.status, 'Open'), dateLabel(row.due_at, '')].filter(Boolean).join(' · ');
              return { type, id, resultType: 'task', resultId: row.id, title: row.title || 'CRM task', meta: details || 'Linked CRM task', icon: ListTodo };
            }).filter((item) => item.id),
          ]);
          setSearchStatus('ready');
        })
        .catch(() => {
          if (!active) return;
          setLiveResults([]);
          setSearchStatus('error');
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [companies, query, sourceStatus]);

  const value = query.trim();
  const results = sourceStatus === 'live'
    ? value.length >= 2 ? liveResults : value.length === 0 ? localResults : []
    : localResults;
  const resultLabel = sourceStatus === 'live' && value.length < 2
    ? value.length ? 'Global CRM search' : 'Recent connected records'
    : value ? 'Global CRM results' : 'Recent records';
  return (
    <div className="avalon-bd-workspace fixed inset-0 z-[90] flex items-start justify-center bg-stone-950/25 px-4 pt-[12vh] backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="Search Avalon BD">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Close search" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.18)]">
        <label className="flex items-center gap-3 border-b border-stone-200 px-4"><Search className="h-4 w-4 text-stone-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies, people, opportunities, notes…" className="h-14 min-w-0 flex-1 bg-transparent text-[13px] text-stone-900 outline-none placeholder:text-stone-400" /><span className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-400">ESC</span></label>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          <p className="px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-400">{resultLabel}</p>
          {searchStatus === 'loading' && sourceStatus === 'live' && value.length >= 2 ? <div className="px-3 py-10 text-center text-[11px] text-stone-400">Searching the connected CRM…</div> : null}
          {searchStatus !== 'loading' ? results.map((item) => { const Icon = item.icon; return <button key={`${item.resultType || item.type}-${item.resultId || item.id}`} type="button" onClick={() => { onOpen({ type: item.type, id: item.id }); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-stone-100"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-stone-900">{item.title}</span><span className="block truncate text-[10px] text-stone-400">{item.resultType ? `${labelCase(item.resultType)} · ` : ''}{item.meta}</span></span><ChevronRight className="h-3.5 w-3.5 text-stone-300" /></button>; }) : null}
          {searchStatus === 'error' ? <div className="px-3 py-10 text-center text-[11px] text-red-600">Connected CRM search is unavailable. Try again.</div> : null}
          {searchStatus !== 'loading' && searchStatus !== 'error' && results.length === 0 ? <div className="px-3 py-10 text-center text-[11px] text-stone-400">{sourceStatus === 'live' && value.length < 2 ? 'Enter at least 2 characters to search the full CRM.' : 'No matching CRM records.'}</div> : null}
        </div>
        <div className="border-t border-stone-100 bg-stone-50 px-4 py-2 text-[9px] text-stone-400">{sourceStatus === 'live' ? 'Connected keyword search · records, notes, activities, and tasks' : 'Connected CRM search is unavailable.'}</div>
      </div>
    </div>
  );
}

function viewFromPath(pathname) {
  const child = pathname.replace(/^\/admin\/bd\/?/, '').split('/')[0];
  return ['pipeline', 'companies', 'people', 'tasks'].includes(child) ? child : 'home';
}

function recordFromPath(pathname) {
  const [section, id] = pathname.replace(/^\/admin\/bd\/?/, '').split('/').filter(Boolean);
  if (!id) return null;
  if (section === 'pipeline') return { type: 'opportunity', id };
  if (section === 'people') return { type: 'person', id };
  if (section === 'companies') return { type: 'company', id };
  return null;
}

async function fetchBdCollection(view, key) {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const payload = await apiGet(`/api/admin/bd?view=${encodeURIComponent(view)}&limit=200&offset=${offset}`);
    assertApiResponse(payload, {
      arrays: [key],
      objects: ['pagination'],
      booleans: ['pagination.hasMore'],
      numbers: ['pagination.limit', 'pagination.offset', 'pagination.total', 'pagination.nextOffset'],
    }, 'Avalon BD returned an invalid collection response.');
    if (!hasObjectRows(payload[key])) throw invalidApiResponse('Avalon BD returned invalid CRM records.');
    rows.push(...payload[key]);
    if (!payload.pagination?.hasMore) break;
  }
  return rows;
}

export default function AvalonBD() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const view = viewFromPath(pathname);
  const copy = VIEW_COPY[view];
  const [sourceStatus, setSourceStatus] = useState('checking');
  const [companies, setCompanies] = useState([]);
  const [people, setPeople] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [owners, setOwners] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selection, setSelection] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState('Company');

  useEffect(() => {
    const linkedRecord = recordFromPath(pathname);
    if (linkedRecord) setSelection(linkedRecord);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const markUnavailable = () => {
      if (!active) return;
      setCompanies([]);
      setPeople([]);
      setOpportunities([]);
      setTasks([]);
      setOwners([]);
      setActivities([]);
      setDashboard(null);
      setSourceStatus('error');
    };
    Promise.all([
      apiGet('/api/admin/bd?view=dashboard'),
      fetchBdCollection('companies', 'companies'),
      fetchBdCollection('people', 'people'),
      fetchBdCollection('pipeline', 'opportunities'),
      fetchBdCollection('tasks', 'tasks'),
    ])
      .then(([dashboardPayload, companyRows, peopleRows, opportunityRows, taskRows]) => {
        assertApiResponse(dashboardPayload, {
          objects: ['summary', 'runtime'],
          arrays: [
            'priorityOpportunities', 'repliesRequiringAction', 'overdueTasks', 'followUpsDue',
            'upcomingCalls', 'newDiscoveries', 'recentlyChangedOpportunities', 'owners',
          ],
          numbers: [
            'summary.openPipelineCents', 'summary.openOpportunities', 'summary.priorityOpportunities',
            'summary.callsThisWeek', 'summary.actionsDueToday', 'summary.overdueActions',
          ],
        }, 'Avalon BD returned an invalid dashboard response.');
        if (!hasObjectRows(dashboardPayload.owners)) throw invalidApiResponse('Avalon BD returned invalid owners.');
        const valid = Array.isArray(companyRows)
          && Array.isArray(peopleRows)
          && Array.isArray(opportunityRows)
          && Array.isArray(taskRows);
        if (!active || !valid) {
          markUnavailable();
          return;
        }
        const workspace = hydrateWorkspace(
          companyRows,
          peopleRows,
          opportunityRows,
          taskRows,
        );
        setCompanies(workspace.companies);
        setPeople(workspace.people);
        setOpportunities(workspace.opportunities);
        setTasks(workspace.tasks);
        setOwners(dashboardPayload.owners);
        setDashboard(hydrateDashboard(dashboardPayload, workspace));
        setActivities([]);
        setSourceStatus('live');
      })
      .catch(markUnavailable);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (sourceStatus === 'live') setSearchOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        if (sourceStatus === 'live') setCreateOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sourceStatus]);

  const moveOpportunity = async (id, stage) => {
    if (sourceStatus !== 'live') return;
    const current = opportunities.find((item) => item.id === id);
    if (!current || current.stage === stage) return;
    setOpportunities((items) => items.map((item) => item.id === id ? { ...item, stage } : item));
    setCompanies((items) => items.map((item) => item.id === current.companyId ? { ...item, stage } : item));
    setActivities((items) => [{ id: `activity-${Date.now()}`, time: 'Just now', type: 'Status Change', title: `${current.name} moved to ${stage}`, detail: `Pipeline stage changed from ${current.stage} to ${stage}.`, actor: 'Rob', record: current.company }, ...items]);
    try {
        const response = await apiPatch('/api/admin/bd', {
          action: 'change_pipeline_stage',
          id,
          expectedVersion: current.version,
          stage: stage.toLowerCase(),
          patch: { stage: stage.toLowerCase(), pipelineStage: stage.toLowerCase() },
        });
        const returned = response?.opportunity
          ? (() => {
            const normalized = normalizeOpportunityRecord(response.opportunity);
            return { ...normalized, company: current.company, owner: normalized.owner === 'Unassigned' ? current.owner : normalized.owner };
          })()
          : { ...current, stage };
        const nextOpportunities = opportunities.map((item) => item.id === id ? returned : item);
        setOpportunities(nextOpportunities);
        setCompanies((items) => deriveCompanyRollups(items, people, nextOpportunities));
    } catch {
      setOpportunities((items) => items.map((item) => item.id === id ? current : item));
      setCompanies((items) => deriveCompanyRollups(items, people, opportunities));
    }
  };

  const toggleTask = async (id) => {
    if (sourceStatus !== 'live') return;
    const current = tasks.find((item) => item.id === id);
    if (!current || current.status === 'cancelled') return;
    const nextStatus = current.status === 'completed' ? 'open' : 'completed';
    setTasks((items) => items.map((item) => item.id === id ? { ...item, status: nextStatus } : item));
    try {
        const response = await apiPatch('/api/admin/bd', { action: nextStatus === 'completed' ? 'complete_task' : 'update_task', id, expectedVersion: current.version, patch: { status: nextStatus } });
        if (response?.record) {
          const normalized = normalizeTaskRecord(response.record);
          const returned = {
            ...normalized,
            company: current.company,
            opportunity: current.opportunity,
            owner: normalized.owner === 'Unassigned' ? current.owner : normalized.owner,
            createdBy: normalized.createdBy || current.createdBy,
          };
          setTasks((items) => items.map((item) => item.id === id ? returned : item));
        }
    } catch {
      setTasks((items) => items.map((item) => item.id === id ? current : item));
    }
  };

  const createRecord = async (type, form) => {
    if (sourceStatus === 'live') {
      const selectedCompanyId = String(form.companyId || '').trim();
      const linkedCompany = companies.find((item) => item.id === selectedCompanyId);
      if (selectedCompanyId && !linkedCompany) return false;
      const numericValue = Number(String(form.value || '').replace(/[^0-9.]/g, '')) || 0;
      const dueDate = form.due ? new Date(form.due) : null;
      if (dueDate && Number.isNaN(dueDate.getTime())) return false;
      let request;
      if (type === 'Company') {
        request = {
          action: 'create_company',
          company: {
            name: form.name.trim(),
            companyType: COMPANY_TYPES.includes(form.type) ? form.type : 'Other',
            website: form.website || null,
            ownerProfileId: form.ownerProfileId || null,
            source: 'manual',
          },
        };
      } else if (type === 'Person') {
        request = {
          action: 'create_person',
          person: {
            fullName: form.name.trim(),
            email: form.email || null,
            phone: form.phone || null,
            companyId: selectedCompanyId || null,
            title: form.title || null,
            relationshipStrength: form.relationshipStrength || 'unknown',
            decisionMakerStatus: form.decisionMakerStatus || 'unknown',
            ownerProfileId: form.ownerProfileId || null,
            source: 'manual',
          },
        };
      } else if (type === 'Opportunity' && linkedCompany) {
        request = {
          action: 'create_opportunity',
          opportunity: {
            name: form.name.trim(),
            companyId: linkedCompany.id,
            opportunityType: OPPORTUNITY_TYPES.includes(form.opportunityType) ? form.opportunityType : 'Other',
            pipelineStage: 'new',
            expectedValueCents: Math.round(numericValue * 100),
            probability: 10,
            ownerProfileId: form.ownerProfileId || null,
            contactIds: form.primaryContactId ? [form.primaryContactId] : [],
            source: 'manual',
          },
        };
      } else if (type === 'Task' && linkedCompany) {
        request = {
          action: 'create_task',
          task: {
            title: form.name.trim(),
            companyId: linkedCompany.id,
            dueAt: dueDate?.toISOString(),
            ownerProfileId: form.ownerProfileId || null,
            source: 'manual',
          },
        };
      } else if (type === 'Note' && linkedCompany) {
        request = {
          action: 'add_note',
          note: {
            content: form.name.trim(),
            companyId: linkedCompany.id,
            source: 'manual',
          },
        };
      } else {
        return false;
      }
      try {
        const response = await apiPost('/api/admin/bd', request);
        if (type === 'Company' && response?.record) setCompanies((items) => [{ ...normalizeCompanyRecord(response.record), stage: 'No opportunity' }, ...items]);
        if (type === 'Person' && response?.record) {
          const created = { ...normalizePersonRecord(response.record), company: linkedCompany?.name || 'Unlinked' };
          const nextPeople = [created, ...people];
          setPeople(nextPeople);
          setCompanies((items) => deriveCompanyRollups(items, nextPeople, opportunities));
        }
        if (type === 'Opportunity' && response?.record) {
          const created = { ...normalizeOpportunityRecord(response.record), company: linkedCompany.name };
          const nextOpportunities = [created, ...opportunities];
          setOpportunities(nextOpportunities);
          setCompanies((items) => deriveCompanyRollups(items, people, nextOpportunities));
        }
        if (type === 'Task' && response?.record) setTasks((items) => [{ ...normalizeTaskRecord(response.record), company: linkedCompany.name }, ...items]);
        if (type === 'Note' && response?.record) setActivities((items) => [{ id: response.record.id, time: 'Just now', type: 'Note', title: 'Note added', detail: response.record.content, actor: 'Rob', record: linkedCompany.name }, ...items]);
      } catch {
        return false;
      }
      return true;
    }
    return false;
  };

  const startCreate = (type = 'Company') => {
    if (sourceStatus !== 'live') return;
    setCreateType(type);
    setCreateOpen(true);
  };

  const closeRecord = () => {
    const linkedRecord = recordFromPath(pathname);
    setSelection(null);
    if (linkedRecord) {
      const base = linkedRecord.type === 'opportunity' ? '/admin/bd/pipeline' : linkedRecord.type === 'person' ? '/admin/bd/people' : '/admin/bd/companies';
      navigate(base, { replace: true });
    }
  };

  const applyReturnedOpportunity = (row) => {
    const current = opportunities.find((item) => item.id === row?.id);
    if (!current) return;
    const normalized = normalizeOpportunityRecord(row);
    const returned = {
      ...normalized,
      company: current.company,
    };
    const nextOpportunities = opportunities.map((item) => item.id === returned.id ? returned : item);
    setOpportunities(nextOpportunities);
    setCompanies((items) => deriveCompanyRollups(items, people, nextOpportunities));
  };

  const applyReturnedRecord = (recordType, row) => {
    if (!row?.id) return;
    if (recordType === 'opportunity') {
      applyReturnedOpportunity(row);
      return;
    }
    if (recordType === 'company') {
      setCompanies((items) => items.map((item) => item.id === row.id
        ? {
            ...normalizeCompanyRecord(row),
            stage: item.stage,
            openValue: item.openValue,
            primaryContact: item.primaryContact,
          }
        : item));
      return;
    }
    if (recordType === 'person') {
      const normalized = normalizePersonRecord(row);
      const companyName = companies.find((item) => item.id === normalized.companyId)?.name || 'Unlinked';
      const nextPeople = people.map((item) => item.id === row.id ? { ...normalized, company: companyName } : item);
      setPeople(nextPeople);
      setCompanies((items) => deriveCompanyRollups(items, nextPeople, opportunities));
    }
  };

  if (sourceStatus !== 'live') {
    return (
      <AdminShell title="Avalon BD">
        {sourceStatus === 'checking' ? (
          <div className="mx-auto flex min-h-[28rem] max-w-2xl items-center justify-center px-5 py-12">
            <div className="av-glass-card w-full rounded-[1.75rem] border border-foreground/[0.12] bg-background/62 p-8 text-center backdrop-blur-2xl md:p-12">
              <p className="font-body text-sm text-foreground/50">Verifying the live Avalon BD source…</p>
            </div>
          </div>
        ) : (
          <OperationalSourceUnavailable
            title="Avalon BD source unavailable"
            description="Companies, people, opportunities, tasks, and dashboard totals could not be verified. No empty or sample CRM views are shown, and all search, create, edit, and pipeline actions remain disabled until the live source reconnects."
          />
        )}
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Avalon BD" fullBleed>
      <div className="avalon-bd-workspace flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-stone-900">
        <div className="av-bd-glass-rail border-b border-stone-200 bg-white px-4 md:px-7">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 overflow-x-auto"><WorkspaceNav active={view} /></div>
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <SourceNotice status={sourceStatus} />
              <button type="button" onClick={() => setSearchOpen(true)} disabled={sourceStatus !== 'live'} className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-medium text-stone-500 hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"><Search className="h-3.5 w-3.5" /> Search <span className="ml-1 rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-400"><Command className="-mt-px inline h-2.5 w-2.5" />K</span></button>
              <button type="button" onClick={() => startCreate(view === 'people' ? 'Person' : view === 'tasks' ? 'Task' : view === 'pipeline' ? 'Opportunity' : 'Company')} disabled={sourceStatus !== 'live'} className="inline-flex h-9 items-center gap-2 rounded-lg bg-stone-950 px-3.5 text-[11px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> New</button>
            </div>
          </div>
        </div>
        {sourceStatus === 'error' ? (
          <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-[10px] font-medium text-red-800 md:px-7">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Avalon BD could not load its connected records. No sample data has been substituted; create and edit actions are disabled.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-7 md:py-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{copy.eyebrow}</p><h2 className="mt-1 text-[26px] font-semibold tracking-[-0.045em] text-stone-950 md:text-[32px]">{copy.title}</h2></div>
              <div className="flex items-center gap-2 lg:hidden"><IconButton label="Search" onClick={() => { if (sourceStatus === 'live') setSearchOpen(true); }}><Search className="h-4 w-4" /></IconButton><button type="button" onClick={() => startCreate(view === 'people' ? 'Person' : view === 'tasks' ? 'Task' : view === 'pipeline' ? 'Opportunity' : 'Company')} disabled={sourceStatus !== 'live'} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-950 px-3 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> New</button></div>
            </div>

            {view === 'home' && sourceStatus === 'live' ? <LiveHomeView dashboard={dashboard} onOpen={setSelection} onNavigate={navigate} /> : null}
            {view === 'home' && sourceStatus === 'checking' ? <div className="border-y border-stone-200 py-16 text-center text-[11px] text-stone-400">Loading connected Avalon BD records…</div> : null}
            {view === 'home' && sourceStatus === 'error' ? <div className="border-y border-stone-200 py-16 text-center text-[11px] text-stone-500">Connected CRM data is unavailable. Retry after the database configuration is restored.</div> : null}
            {view === 'pipeline' ? <PipelineView opportunities={opportunities} onMove={moveOpportunity} onOpen={setSelection} /> : null}
            {view === 'companies' ? <CompaniesView companies={companies} onOpen={setSelection} /> : null}
            {view === 'people' ? <PeopleView people={people} onOpen={setSelection} /> : null}
            {view === 'tasks' ? <TasksView tasks={tasks} onToggle={toggleTask} /> : null}
          </div>
        </div>
      </div>

      {selection ? <RecordPanel selection={selection} companies={companies} people={people} opportunities={opportunities} owners={owners} activities={activities} sourceStatus={sourceStatus} onRecordUpdated={applyReturnedRecord} onOpportunityUpdated={applyReturnedOpportunity} onClose={closeRecord} /> : null}
      {createOpen ? <CreatePanel initialType={createType} companies={companies} people={people} owners={owners} sourceStatus={sourceStatus} onCreate={createRecord} onClose={() => setCreateOpen(false)} /> : null}
      {searchOpen ? <SearchPalette companies={companies} people={people} opportunities={opportunities} sourceStatus={sourceStatus} onClose={() => setSearchOpen(false)} onOpen={setSelection} /> : null}
    </AdminShell>
  );
}
