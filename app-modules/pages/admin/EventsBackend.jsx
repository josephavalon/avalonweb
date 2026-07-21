import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpRight, Check, ChevronRight, CircleDollarSign, ClipboardCheck,
  FilePlus2, KeyRound, LockKeyhole, LogOut, Plus, Save, ShieldCheck, Stethoscope,
  Ticket, Users,
} from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';

const SURFACE = 'rounded-[1.35rem] border border-foreground/[0.12] bg-[rgba(13,13,13,0.94)]';
const FIELD = 'min-h-12 w-full rounded-xl border border-foreground/[0.14] bg-foreground/[0.045] px-4 font-body text-sm font-semibold text-foreground outline-none placeholder:text-foreground/30 focus:border-foreground/42';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/46';
const MONO = { fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: 'tabular-nums' };

const DEMO_EVENT = {
  id: 'demo-event-1', slug: 'after-hours-recovery-club', name: 'After Hours Recovery Club', status: 'presale',
  capacity: 220, startsAt: '2026-08-22T19:00:00-07:00', endsAt: '2026-08-23T01:00:00-07:00',
  venue: 'Fort Mason, San Francisco', exactAddress: '2 Marina Blvd, Building C', hostName: 'North Coast Social',
  organizerEmail: 'joseph@avalonvitality.co', organizerStatus: 'active', clinicalLead: 'Dr. Maya Chen',
  logistics: {
    eventType: 'venue_company', companyLegalName: 'North Coast Social LLC', venueLegalName: 'Fort Mason Center for Arts & Culture', coiRequested: true,
    expectedGuests: 220, requestedServiceCapacity: 36, furnitureNeeded: true, signageNeeded: true,
    avalonBringItems: ['Extension cords & power strips', 'Treatment recliners', 'Linens', 'Privacy dividers', 'Directional signage', 'Waste & sharps stations'],
  },
  documents: { coiCount: 1, coiStatus: 'pending', floorPlanCount: 1, venuePhotoCount: 4, venueRequirementCount: 1 },
  experienceTickets: [
    { id: 'demo-ticket-1', name: 'Early Entry', description: 'Event entry before 9 PM.', priceCents: 6500, allocation: 80, sold: 68, active: true, priceLocked: true },
    { id: 'demo-ticket-2', name: 'All Night Access', description: 'General event access and hospitality.', priceCents: 9500, allocation: 140, sold: 80, active: true, priceLocked: true },
  ],
  clinicalTickets: [
    { id: 'demo-clinical-1', name: 'Recovery IV', description: 'Clinician-reviewed hydration service.', priceCents: 22500, allocation: 24, sold: 0, serviceId: 'recovery-iv', requiresGfe: true, backOnFloorMinutes: 45, active: true },
  ],
};

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
}

function localDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function statusName(status) {
  return ({ draft: 'Needs review', presale: 'Approved · presale', public: 'Public sale', sold_out: 'Sold out', closed: 'Closed' })[status] || status;
}

function Metric({ label, value, detail, Icon }) {
  return (
    <div className={`${SURFACE} p-4`}>
      <div className="flex items-center justify-between gap-3"><p className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/42">{label}</p><Icon className="h-4 w-4 text-foreground/34" /></div>
      <p className="mt-3 font-mono text-2xl font-medium text-foreground md:text-3xl" style={MONO}>{value}</p>
      <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/42">{detail}</p>
    </div>
  );
}

function EventRail({ events, activeId, onSelect, onCreate }) {
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/38">Avalon Events</p><h2 className="mt-1 font-heading text-3xl uppercase">Pipeline</h2></div>
        <button type="button" onClick={onCreate} className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background" aria-label="Create event"><Plus className="h-4 w-4" /></button>
      </div>
      {events.map((event) => (
        <button key={event.id} type="button" onClick={() => onSelect(event.id)} className={`w-full rounded-[1.15rem] border p-4 text-left ${event.id === activeId ? 'border-foreground bg-foreground text-background' : 'border-foreground/[0.12] bg-foreground/[0.04] text-foreground'}`}>
          <span className="font-body text-[9px] font-bold uppercase tracking-[0.16em] opacity-55">{statusName(event.status)}</span>
          <span className="mt-2 block font-heading text-2xl uppercase leading-[0.92]">{event.name}</span>
          <span className="mt-3 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.12em] opacity-52"><span>{event.capacity || 'Open'} cap</span><ChevronRight className="h-3.5 w-3.5" /></span>
        </button>
      ))}
    </aside>
  );
}

function CreateEvent({ busy, onCancel, onCreate }) {
  const [form, setForm] = useState({ name: '', slug: '', venue: '', capacity: '', startsAt: '', endsAt: '', hostName: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const autoSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return (
    <form className={`${SURFACE} p-5 md:p-6`} onSubmit={(event) => { event.preventDefault(); onCreate({ ...form, capacity: Number(form.capacity) || null }); }}>
      <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">New event</p>
      <h1 className="mt-2 font-heading text-5xl uppercase leading-[0.86] md:text-7xl">Create the container.</h1>
      <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-foreground/54">Start in draft. Avalon reviews the public facts, ticket economics, clinical configuration, staffing, and private arrival details before organizer access can be issued.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label><span className={LABEL}>Event name</span><input className={FIELD} value={form.name} onChange={(e) => { set('name')(e); if (!form.slug) setForm((current) => ({ ...current, name: e.target.value, slug: autoSlug(e.target.value) })); }} required /></label>
        <label><span className={LABEL}>Public URL slug</span><input className={FIELD} value={form.slug} onChange={set('slug')} required /></label>
        <label><span className={LABEL}>Host organization</span><input className={FIELD} value={form.hostName} onChange={set('hostName')} /></label>
        <label><span className={LABEL}>Public venue area</span><input className={FIELD} value={form.venue} onChange={set('venue')} placeholder="Neighborhood or venue" /></label>
        <label><span className={LABEL}>Starts</span><input type="datetime-local" className={`${FIELD} [color-scheme:dark]`} value={form.startsAt} onChange={set('startsAt')} /></label>
        <label><span className={LABEL}>Ends</span><input type="datetime-local" className={`${FIELD} [color-scheme:dark]`} value={form.endsAt} onChange={set('endsAt')} /></label>
        <label><span className={LABEL}>Event capacity</span><input inputMode="numeric" className={FIELD} value={form.capacity} onChange={set('capacity')} /></label>
      </div>
      <div className="mt-6 flex flex-wrap gap-2"><button disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-background"><FilePlus2 className="h-4 w-4" />{busy ? 'Creating…' : 'Create draft'}</button><button type="button" onClick={onCancel} className="min-h-12 rounded-full border border-foreground/16 px-6 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/58">Cancel</button></div>
    </form>
  );
}

function TierEditor({ tier, clinical = false, busy, onSave }) {
  const [form, setForm] = useState(() => ({
    tierId: tier?.id || '', name: tier?.name || '', description: tier?.description || '',
    price: tier ? (tier.priceCents / 100).toFixed(2) : '', allocation: tier?.allocation ?? '',
    serviceId: tier?.serviceId || '', backOnFloorMinutes: tier?.backOnFloorMinutes ?? '',
    requiresGfe: clinical ? tier?.requiresGfe !== false : false, active: tier?.active !== false,
    priceLocked: clinical ? true : tier?.priceLocked !== false,
  }));
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  return (
    <form className={`${SURFACE} p-4`} onSubmit={(event) => { event.preventDefault(); onSave({ ...form, priceCents: Math.round(Number(form.price) * 100), allocation: form.allocation === '' ? null : Number(form.allocation), backOnFloorMinutes: form.backOnFloorMinutes === '' ? null : Number(form.backOnFloorMinutes), clinical }); }}>
      <div className="flex items-start justify-between gap-4"><div><p className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/40">{clinical ? 'Avalon clinical entity' : 'Experience commerce'}</p><h3 className="mt-1 font-heading text-3xl uppercase leading-none">{tier?.name || (clinical ? 'New service tier' : 'New admission tier')}</h3></div><LockKeyhole className={`h-4 w-4 ${clinical || form.priceLocked ? 'text-[#C8F135]' : 'text-foreground/30'}`} /></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label><span className={LABEL}>Name</span><input className={FIELD} value={form.name} onChange={set('name')} required /></label>
        <label><span className={LABEL}>Avalon-approved price</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-foreground/40">$</span><input className={`${FIELD} pl-8`} inputMode="decimal" value={form.price} onChange={set('price')} required /></div></label>
        <label><span className={LABEL}>Allocation</span><input className={FIELD} inputMode="numeric" value={form.allocation} onChange={set('allocation')} placeholder="Uses event capacity" /></label>
        {clinical ? <label><span className={LABEL}>Service ID</span><input className={FIELD} value={form.serviceId} onChange={set('serviceId')} placeholder="recovery-iv" required /></label> : null}
        {clinical ? <label><span className={LABEL}>Back on floor estimate</span><input className={FIELD} inputMode="numeric" value={form.backOnFloorMinutes} onChange={set('backOnFloorMinutes')} placeholder="45 minutes" /></label> : null}
        <label className={clinical ? '' : 'md:col-span-2'}><span className={LABEL}>Public description</span><input className={FIELD} value={form.description} onChange={set('description')} /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-foreground/[0.08] pt-4">
        {!clinical ? <label className="flex items-center gap-2 font-body text-xs text-foreground/62"><input type="checkbox" checked={form.priceLocked} onChange={set('priceLocked')} className="accent-white" /> Lock organizer price edits</label> : null}
        {clinical ? <label className="flex items-center gap-2 font-body text-xs text-foreground/62"><input type="checkbox" checked={form.requiresGfe} onChange={set('requiresGfe')} className="accent-white" /> Health check required</label> : null}
        <label className="flex items-center gap-2 font-body text-xs text-foreground/62"><input type="checkbox" checked={form.active} onChange={set('active')} className="accent-white" /> Active</label>
      </div>
      <button disabled={busy} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-bold uppercase tracking-[0.17em] text-background"><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save configuration'}</button>
    </form>
  );
}

function OrganizerAccess({ event, busy, onInvite }) {
  const [email, setEmail] = useState(event.organizerEmail || '');
  useEffect(() => setEmail(event.organizerEmail || ''), [event.id, event.organizerEmail]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <form className={`${SURFACE} p-5`} onSubmit={(e) => { e.preventDefault(); onInvite(email); }}>
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Scoped access</p><h2 className="mt-1 font-heading text-4xl uppercase">Issue Event Hub login.</h2>
        <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-foreground/54">Access can be issued only after Avalon approval. Existing Avalon accounts keep the same password and receive access to this event only.</p>
        <label className="mt-5 block"><span className={LABEL}>Organizer email</span><input type="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <button disabled={busy || event.status === 'draft'} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-background disabled:opacity-35"><KeyRound className="h-4 w-4" />{busy ? 'Issuing…' : event.organizerStatus === 'active' ? 'Reissue access' : 'Issue access'}</button>
      </form>
      <div className={`${SURFACE} p-5`}><ShieldCheck className="h-5 w-5 text-[#C8F135]" /><p className="mt-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/42">Enforced boundary</p><p className="mt-2 font-body text-sm leading-relaxed text-foreground/58">Organizers see aggregate admission sales and public event content. They never receive attendee health information, clinical eligibility, chart data, clinical revenue, protocols, or medical refunds.</p><div className="mt-5 border-t border-foreground/[0.08] pt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/42">{event.organizerStatus === 'active' ? `Active · ${event.organizerEmail}` : 'No organizer assigned'}</div></div>
    </div>
  );
}

export default function EventsBackend() {
  const { authBackend, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [events, setEvents] = useState([DEMO_EVENT]);
  const [activeId, setActiveId] = useState(DEMO_EVENT.id);
  const [tab, setTab] = useState('approval');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  useSeo({ title: 'Event Control — Avalon Vitality', description: 'Avalon event approval, pricing, clinical setup, and organizer access.', robots: 'noindex,nofollow,noarchive' });

  useEffect(() => {
    if (authBackend === 'demo') return;
    apiGet('/api/admin/events/management').then((data) => { setEvents(data.events || []); setActiveId((id) => data.events?.some((item) => item.id === id) ? id : data.events?.[0]?.id || ''); }).catch((error) => setNotice({ type: 'error', message: error.message }));
  }, [authBackend]);

  const active = useMemo(() => events.find((event) => event.id === activeId) || events[0], [events, activeId]);
  const updateDemo = (payload) => {
    if (payload.action === 'create_event') {
      const created = { ...DEMO_EVENT, ...payload, id: `demo-${Date.now()}`, status: 'draft', experienceTickets: [], clinicalTickets: [], organizerEmail: '', organizerStatus: 'none', logistics: {}, documents: {} };
      setEvents((current) => [...current, created]); setActiveId(created.id); setCreating(false); return;
    }
    setEvents((current) => current.map((event) => {
      if (event.id !== active.id) return event;
      if (payload.action === 'set_status') return { ...event, status: payload.status };
      if (payload.action === 'save_tier') {
        const key = payload.clinical ? 'clinicalTickets' : 'experienceTickets';
        const saved = { ...payload, id: payload.tierId || `tier-${Date.now()}`, sold: event[key].find((item) => item.id === payload.tierId)?.sold || 0 };
        return { ...event, [key]: payload.tierId ? event[key].map((item) => item.id === payload.tierId ? saved : item) : [...event[key], saved] };
      }
      if (payload.action === 'assign_organizer') return { ...event, organizerEmail: payload.email, organizerStatus: 'active' };
      return event;
    }));
  };
  const run = async (key, payload, success) => {
    setBusy(key); setNotice(null);
    try {
      if (authBackend === 'demo') updateDemo(payload);
      else {
        const data = payload.action === 'assign_organizer'
          ? await apiPost('/api/admin/events/organizer-invite', { containerId: active.id, email: payload.email })
          : await apiPost('/api/admin/events/management', { ...payload, containerId: active?.id });
        if (data.events) { setEvents(data.events); setActiveId((id) => data.events.some((item) => item.id === id) ? id : data.events[0]?.id || ''); }
      }
      setNotice({ type: 'success', message: success });
    } catch (error) { setNotice({ type: 'error', message: error.message || 'That event change could not be saved.' }); }
    finally { setBusy(''); }
  };

  const experienceRevenue = active?.experienceTickets.reduce((sum, item) => sum + item.priceCents * item.sold, 0) || 0;
  const sold = active?.experienceTickets.reduce((sum, item) => sum + item.sold, 0) || 0;
  const readiness = active ? [
    ['Public facts', Boolean(active.name && active.venue && active.startsAt)],
    ['Admission economics', active.experienceTickets.some((item) => item.active && item.priceLocked)],
    ['Clinical configuration', active.clinicalTickets.every((item) => item.serviceId && item.priceCents >= 0)],
    ['Venue handoff', Boolean(active.logistics?.expectedGuests && active.logistics?.requestedServiceCapacity && active.logistics?.avalonBringItems?.length)],
    ['Insurance / COI', active.logistics?.eventType === 'private_party' || !active.logistics?.coiRequested || active.documents?.coiCount > 0],
    ['Organizer access', active.organizerStatus === 'active'],
  ] : [];

  return (
    <main className="min-h-dvh bg-black pb-20 text-foreground">
      <header className="sticky top-0 z-40 border-b border-foreground/[0.10] bg-black px-4 py-3">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><Link to="/admin" className="flex min-h-11 items-center gap-3"><AvalonMark className="h-7 w-[18px]" /><span className="hidden font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/46 sm:inline">Avalon Admin</span></Link><div className="text-center"><p className="font-heading text-2xl uppercase leading-none">Event Control</p><p className="mt-1 font-body text-[9px] uppercase tracking-[0.2em] text-foreground/40">Approval · pricing · access</p></div><button onClick={async () => { await signOut(); navigate('/login?portal=admin', { replace: true }); }} className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.14] text-foreground/55" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-8">
        <EventRail events={events} activeId={activeId} onSelect={(id) => { setActiveId(id); setCreating(false); }} onCreate={() => setCreating(true)} />
        <section className="min-w-0">
          {creating ? <CreateEvent busy={busy === 'create'} onCancel={() => setCreating(false)} onCreate={(payload) => run('create', { action: 'create_event', ...payload }, 'Draft event created.')} /> : active ? <>
            <div className={`${SURFACE} p-5 md:p-6`}>
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.15em] ${active.status === 'draft' ? 'border-amber-300/25 text-amber-200' : 'border-[#C8F135]/30 text-[#C8F135]'}`}>{statusName(active.status)}</span><span className="font-body text-[10px] uppercase tracking-[0.17em] text-foreground/38">{active.hostName}</span></div><h1 className="mt-4 max-w-[16ch] font-heading text-5xl uppercase leading-[0.86] md:text-7xl">{active.name}</h1><p className="mt-4 font-body text-sm text-foreground/50">{active.venue} · {active.capacity} guests · {localDate(active.startsAt).replace('T', ' ')}</p></div><div className="flex flex-wrap gap-2"><Link to={`/events/${active.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/16 px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em]">Public page <ArrowUpRight className="h-4 w-4" /></Link>{active.status === 'draft' ? <button onClick={() => run('status', { action: 'set_status', status: 'presale' }, 'Event approved and moved to presale.')} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-background"><ClipboardCheck className="h-4 w-4" />Approve event</button> : <button onClick={() => run('status', { action: 'set_status', status: active.status === 'public' ? 'presale' : 'public' }, active.status === 'public' ? 'Event returned to presale.' : 'Public sale is live.')} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-background"><Check className="h-4 w-4" />{active.status === 'public' ? 'Pause public sale' : 'Publish sale'}</button>}</div></div>
            </div>

            {notice ? <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl border px-4 py-3 font-body text-sm ${notice.type === 'error' ? 'border-red-400/25 bg-red-500/[0.08] text-red-200' : 'border-[#C8F135]/25 bg-[#C8F135]/[0.06] text-[#C8F135]'}`}>{notice.message}</div> : null}

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Admission sold" value={sold} detail={`${Math.max(0, active.capacity - sold)} capacity open`} Icon={Ticket} /><Metric label="Experience sales" value={money(experienceRevenue)} detail="Gross admission revenue" Icon={CircleDollarSign} /><Metric label="Care capacity" value={active.clinicalTickets.reduce((sum, item) => sum + (item.allocation || 0), 0)} detail="Avalon-controlled inventory" Icon={Stethoscope} /><Metric label="Organizer" value={active.organizerStatus === 'active' ? '1' : '0'} detail={active.organizerEmail || 'Access not issued'} Icon={Users} /></div>

            <div className="no-scrollbar mt-5 overflow-x-auto" role="tablist" aria-label="Event administration"><div className="flex min-w-max gap-1 rounded-full border border-foreground/[0.12] bg-foreground/[0.035] p-1">{[['approval', 'Approval'], ['pricing', 'Ticket pricing'], ['clinical', 'Clinical setup'], ['access', 'Organizer access']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-11 rounded-full px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em] ${tab === key ? 'bg-foreground text-background' : 'text-foreground/52'}`}>{label}</button>)}</div></div>

            <div className="mt-5" role="tabpanel">
              {tab === 'approval' ? <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"><div className={`${SURFACE} p-5`}><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Release gate</p><h2 className="mt-1 font-heading text-4xl uppercase">Avalon signs off.</h2><div className="mt-5 divide-y divide-foreground/[0.08]">{readiness.map(([label, ready]) => <div key={label} className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full border ${ready ? 'border-[#C8F135]/30 text-[#C8F135]' : 'border-foreground/14 text-foreground/28'}`}>{ready ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span><span className="font-body text-sm font-semibold">{label}</span></div><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-foreground/38">{ready ? 'Ready' : 'Required'}</span></div>)}</div></div><div className={`${SURFACE} p-5`}><ShieldCheck className="h-5 w-5 text-[#C8F135]" /><p className="mt-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/42">Control plane</p><p className="mt-2 font-body text-sm leading-relaxed text-foreground/58">Avalon approves publishing, locks admission economics when needed, controls every clinical service and price, assigns clinical staff, and keeps private arrival and health workflows outside organizer access.</p><div className="mt-5 divide-y divide-foreground/[0.08] border-t border-foreground/[0.08]"><p className="py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/48">Clinical lead · {active.clinicalLead || 'Unassigned'}</p><p className="py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/48">Venue · {active.logistics?.venueLegalName || 'Not supplied'}</p><p className="py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/48">Capacity · {active.logistics?.expectedGuests || 0} expected / {active.logistics?.requestedServiceCapacity || 0} service</p><p className="py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/48">COI · {active.documents?.coiCount || 0} file / {active.documents?.coiStatus || 'not uploaded'}</p></div></div></div> : null}
              {tab === 'pricing' ? <div className="space-y-4"><div className="flex items-end justify-between gap-4"><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Admin approval</p><h2 className="mt-1 font-heading text-4xl uppercase">Admission economics.</h2></div></div><div className="grid gap-4 xl:grid-cols-2">{active.experienceTickets.map((tier) => <TierEditor key={tier.id} tier={tier} busy={busy === `tier-${tier.id}`} onSave={(payload) => run(`tier-${tier.id}`, { action: 'save_tier', ...payload }, 'Admission tier saved and locked.')} />)}<TierEditor busy={busy === 'tier-new'} onSave={(payload) => run('tier-new', { action: 'save_tier', ...payload }, 'Admission tier created.')} /></div></div> : null}
              {tab === 'clinical' ? <div className="space-y-4"><div className={`${SURFACE} flex items-start gap-3 p-4`}><Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-[#C8F135]" /><p className="font-body text-[12px] leading-relaxed text-foreground/56"><strong className="text-foreground">Avalon-only.</strong> These services, prices, eligibility rules, staffing requirements, clinical inventory, billing, and refunds are never editable by the organizer.</p></div><div className="grid gap-4 xl:grid-cols-2">{active.clinicalTickets.map((tier) => <TierEditor key={tier.id} tier={tier} clinical busy={busy === `clinical-${tier.id}`} onSave={(payload) => run(`clinical-${tier.id}`, { action: 'save_tier', ...payload }, 'Clinical service configuration saved.')} />)}<TierEditor clinical busy={busy === 'clinical-new'} onSave={(payload) => run('clinical-new', { action: 'save_tier', ...payload }, 'Clinical service tier created.')} /></div></div> : null}
              {tab === 'access' ? <OrganizerAccess event={active} busy={busy === 'invite'} onInvite={(email) => run('invite', { action: 'assign_organizer', email }, 'Organizer Event Hub access issued.')} /> : null}
            </div>
          </> : <div className={`${SURFACE} p-8 text-center`}><Ticket className="mx-auto h-7 w-7 text-foreground/35" /><p className="mt-4 font-heading text-4xl uppercase">Create the first event.</p></div>}
        </section>
      </div>
      <Link to="/admin" className="fixed bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.14] bg-black text-foreground/55" aria-label="Back to admin"><ArrowLeft className="h-4 w-4" /></Link>
    </main>
  );
}
