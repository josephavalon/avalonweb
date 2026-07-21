import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, Copy, ImagePlus,
  LogOut, MapPin, Package, Plus, RefreshCw, Save, ShieldCheck, Ticket, Truck, Users,
} from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';

const SURFACE = 'rounded-[1.35rem] border border-foreground/[0.12] bg-[rgba(13,13,13,0.94)]';
const FIELD = 'min-h-[48px] w-full rounded-xl border border-foreground/[0.14] bg-foreground/[0.045] px-4 font-body text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40';
const LABEL = 'mb-2 block font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/52';
const MONO = { fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: 'tabular-nums' };
const AVALON_BRING_OPTIONS = [
  'Extension cords & power strips', 'Treatment recliners', 'Linens', 'Privacy dividers',
  'Check-in table', 'Directional signage', 'Task lighting', 'Waste & sharps stations',
];

const DEMO_EVENTS = [{
  id: 'demo-event-1', slug: 'after-hours-recovery-club', name: 'After Hours Recovery Club',
  status: 'presale', capacity: 220, startsAt: '2026-08-22T19:00:00-07:00', endsAt: '2026-08-23T01:00:00-07:00',
  venue: 'Fort Mason, San Francisco', hostName: 'North Coast Social', cohosts: ['Avalon Vitality'],
  descriptionBlocks: { vibe: 'Late-night recovery, built into the room.', description: 'A private recovery lounge with music, hospitality, and optional care provided by Avalon’s independent clinical team.' },
  logistics: {
    eventType: 'venue_company', companyLegalName: 'North Coast Social LLC', venueLegalName: 'Fort Mason Center for Arts & Culture',
    onsiteContactName: 'Jordan Lee', onsiteContactPhone: '(415) 555-0148', coiRequested: true,
    certificateHolder: 'Fort Mason Center, 2 Marina Blvd, San Francisco, CA 94123',
    insuranceRequirements: '$1M per occurrence / $2M aggregate. Venue and landlord listed as additional insured. Primary and non-contributory wording requested.',
    coiDueDate: '2026-08-08', coiPolicyExpiresAt: '2027-01-01',
    expectedGuests: 220, requestedServiceCapacity: 36, loadInWindow: '4:30 PM – 6:00 PM',
    layoutNotes: 'Recovery lounge is planned for the southeast room beside the main floor. Guest entry is through the west corridor; keep a clear return path to the event.',
    venueProvides: 'Four 6-foot tables\nTwelve lounge chairs\nTwo dedicated 20A power drops\nWaste and linen pickup zone',
    avalonBringItems: ['Extension cords & power strips', 'Treatment recliners', 'Linens', 'Privacy dividers', 'Directional signage', 'Waste & sharps stations'],
    avalonBrings: 'Bring three 25-foot cable covers for every guest-facing cord run and one backup hotspot.',
    furnitureNeeded: true, signageNeeded: true,
    accessNotes: 'Use the south loading dock. Freight elevator is reserved from 4:30 PM. Venue lead will meet Avalon at security.',
    upgradeRequests: 'Price a second recovery station and an express check-in host. Confirm whether additional lounge seating is available.',
  },
  documents: { coiStatus: 'pending', coiCount: 1, floorPlanCount: 1, venuePhotoCount: 4, venueRequirementCount: 1 },
  ticketsSold: 148, paidOrders: 126, experienceSalesCents: 1845200, refundedOrders: 2,
  assets: { live: 5, pending: 2, pulled: 0 },
  tickets: [
    { id: 'demo-ticket-1', name: 'Early Entry', description: 'Event entry before 9 PM.', priceCents: 6500, allocation: 80, sold: 68, presaleOpensAt: '2026-07-20T09:00:00-07:00', publicOpensAt: '2026-07-24T09:00:00-07:00', experienceOnly: true, priceLocked: true, active: true },
    { id: 'demo-ticket-2', name: 'All Night Access', description: 'General event access and hospitality.', priceCents: 9500, allocation: 140, sold: 80, presaleOpensAt: '2026-07-20T09:00:00-07:00', publicOpensAt: '2026-07-24T09:00:00-07:00', experienceOnly: true, priceLocked: true, active: true },
  ],
}];

const EMPTY_HUB = { events: [], privacyMode: 'aggregate-only', clinicalCommerce: 'avalon-controlled' };

function dollars(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
}

function eventDate(iso) {
  if (!iso) return 'Date to be confirmed';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function inputDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function statusLabel(status) {
  return ({ draft: 'Avalon review', presale: 'Presale live', public: 'On sale', sold_out: 'Sold out', closed: 'Closed' })[status] || status;
}

function Stat({ label, value, detail, Icon }) {
  return (
    <div className={`${SURFACE} min-w-0 p-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/46">{label}</p>
        <Icon className="h-4 w-4 text-foreground/38" strokeWidth={1.7} />
      </div>
      <p className="mt-3 font-heading text-3xl uppercase leading-none text-foreground md:text-4xl" style={MONO}>{value}</p>
      <p className="mt-2 font-body text-[12px] text-foreground/48">{detail}</p>
    </div>
  );
}

function TrustBoundary() {
  return (
    <aside className={`${SURFACE} p-4`} aria-label="Organizer access boundary">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#C8F135]" strokeWidth={1.8} />
        <div>
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">Your lane: event commerce</p>
          <p className="mt-2 font-body text-[13px] leading-relaxed text-foreground/58">
            You control event details, experience tickets, sales windows, links, and brand uploads. Avalon’s clinical entity controls care, eligibility, protocols, medical staffing, clinical pricing, records, and refunds.
          </p>
          <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/42">
            This hub shows experience-ticket sales only—never attendee identity, health information, clinical status, or clinical-service revenue.
          </p>
        </div>
      </div>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className={`${SURFACE} mx-auto max-w-xl p-8 text-center`}>
      <Ticket className="mx-auto h-8 w-8 text-foreground/38" strokeWidth={1.5} />
      <h1 className="mt-5 font-heading text-5xl uppercase leading-none">Access is ready when your event is.</h1>
      <p className="mx-auto mt-4 max-w-md font-body text-sm leading-relaxed text-foreground/56">
        An Avalon admin must approve an event and assign it to this account before it appears here.
      </p>
      <a href="mailto:events@avalonvitality.co" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border border-foreground/18 px-6 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
        Contact Avalon Events
      </a>
    </div>
  );
}

function DetailsPanel({ event, busy, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    setForm({
      name: event.name || '', hostName: event.hostName || '', venue: event.venue || '',
      startsAt: inputDate(event.startsAt), endsAt: inputDate(event.endsAt),
      vibe: event.descriptionBlocks?.vibe || '', description: event.descriptionBlocks?.description || '',
      cohosts: (event.cohosts || []).join(', '),
    });
  }, [event.id, event.name, event.hostName, event.venue, event.startsAt, event.endsAt, event.descriptionBlocks, event.cohosts]);
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, cohosts: form.cohosts.split(',').map((value) => value.trim()).filter(Boolean) }); }} className={`${SURFACE} p-4 md:p-5`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Public event page</p>
          <h2 className="mt-1 font-heading text-3xl uppercase leading-none">Event details</h2>
        </div>
        <p className="max-w-[220px] text-right font-body text-[11px] leading-relaxed text-foreground/40">Use a neighborhood or venue name here. Keep private arrival details with Avalon.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label><span className={LABEL}>Event name</span><input className={FIELD} value={form.name || ''} onChange={set('name')} required /></label>
        <label><span className={LABEL}>Presented by</span><input className={FIELD} value={form.hostName || ''} onChange={set('hostName')} placeholder="Your organization" /></label>
        <label className="md:col-span-2"><span className={LABEL}>Public venue area</span><input className={FIELD} value={form.venue || ''} onChange={set('venue')} placeholder="Venue or neighborhood—no private arrival notes" /></label>
        <label><span className={LABEL}>Starts</span><input type="datetime-local" className={`${FIELD} [color-scheme:dark]`} value={form.startsAt || ''} onChange={set('startsAt')} /></label>
        <label><span className={LABEL}>Ends</span><input type="datetime-local" className={`${FIELD} [color-scheme:dark]`} value={form.endsAt || ''} onChange={set('endsAt')} /></label>
        <label className="md:col-span-2"><span className={LABEL}>Cohosts</span><input className={FIELD} value={form.cohosts || ''} onChange={set('cohosts')} placeholder="Comma-separated" /></label>
        <label className="md:col-span-2"><span className={LABEL}>One-line vibe</span><input className={FIELD} value={form.vibe || ''} onChange={set('vibe')} maxLength={320} /></label>
        <label className="md:col-span-2"><span className={LABEL}>Event description</span><textarea className={`${FIELD} min-h-32 py-3 leading-relaxed`} value={form.description || ''} onChange={set('description')} maxLength={1600} /></label>
      </div>
      <button disabled={busy} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-background disabled:opacity-50">
        <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save event details'}
      </button>
    </form>
  );
}

function TicketEditor({ ticket, busy, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    tierId: ticket?.id || '', name: ticket?.name || '', description: ticket?.description || '',
    price: ticket ? (ticket.priceCents / 100).toFixed(2) : '', allocation: ticket?.allocation ?? '',
    presaleOpensAt: inputDate(ticket?.presaleOpensAt), publicOpensAt: inputDate(ticket?.publicOpensAt), active: ticket?.active !== false,
  }));
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, priceCents: Math.round(Number(form.price) * 100) }); }} className={`${SURFACE} p-4`}>
      <div className="grid gap-4 md:grid-cols-2">
        <label><span className={LABEL}>Ticket name</span><input className={FIELD} value={form.name} onChange={set('name')} placeholder="General admission" required /></label>
        <label><span className={LABEL}>Price {ticket?.priceLocked ? '· Avalon locked' : ''}</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-body text-sm text-foreground/42">$</span><input disabled={ticket?.priceLocked} className={`${FIELD} pl-8 disabled:cursor-not-allowed disabled:opacity-55`} inputMode="decimal" value={form.price} onChange={set('price')} placeholder="0.00" required /></div></label>
        <label><span className={LABEL}>Allocation</span><input className={FIELD} inputMode="numeric" value={form.allocation} onChange={set('allocation')} placeholder="Unlimited" /></label>
        <label><span className={LABEL}>Description</span><input className={FIELD} value={form.description} onChange={set('description')} placeholder="What this ticket includes" /></label>
        <label><span className={LABEL}>Presale opens</span><input type="datetime-local" className={`${FIELD} [color-scheme:dark]`} value={form.presaleOpensAt} onChange={set('presaleOpensAt')} /></label>
        <label><span className={LABEL}>Public sale opens</span><input type="datetime-local" className={`${FIELD} [color-scheme:dark]`} value={form.publicOpensAt} onChange={set('publicOpensAt')} /></label>
      </div>
      <label className="mt-4 flex min-h-11 items-center gap-3 font-body text-sm text-foreground/70"><input type="checkbox" checked={form.active} onChange={set('active')} className="h-4 w-4 accent-white" /> Ticket is active</label>
      <div className="mt-4 rounded-xl border border-foreground/[0.10] bg-foreground/[0.03] p-3 font-body text-[12px] leading-relaxed text-foreground/50">
        Organizer tickets cover event access and hospitality only. Clinical services are configured and billed separately by Avalon.
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-background disabled:opacity-50"><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save ticket'}</button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-foreground/14 px-5 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/58">Cancel</button>
      </div>
    </form>
  );
}

function TicketsPanel({ event, busy, onSave }) {
  const [editing, setEditing] = useState(null);
  const commercial = event.tickets;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Organizer controlled</p><h2 className="mt-1 font-heading text-3xl uppercase">Experience tickets</h2></div>
        {!editing && <button onClick={() => setEditing({})} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-background"><Plus className="h-4 w-4" /> Add ticket</button>}
      </div>
      {editing && <TicketEditor key={editing.id || 'new'} ticket={editing.id ? editing : null} busy={busy} onCancel={() => setEditing(null)} onSave={async (payload) => { const ok = await onSave(payload); if (ok) setEditing(null); }} />}
      <div className="grid gap-3 lg:grid-cols-2">
        {commercial.map((ticket) => {
          const available = ticket.allocation == null ? 'Open' : Math.max(0, ticket.allocation - ticket.sold);
          return (
            <button key={ticket.id} onClick={() => setEditing(ticket)} className={`${SURFACE} min-h-32 p-4 text-left transition-colors hover:border-foreground/24`}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">{ticket.active ? 'On sale' : 'Paused'}</p><p className="mt-1 font-heading text-3xl uppercase leading-none">{ticket.name}</p></div><p className="font-heading text-2xl" style={MONO}>{dollars(ticket.priceCents)}</p></div>
              <div className="mt-4 grid grid-cols-2 gap-2 font-body text-[12px] text-foreground/54"><span><strong className="text-foreground" style={MONO}>{ticket.sold}</strong> sold</span><span><strong className="text-foreground" style={MONO}>{available}</strong> remaining</span></div>
            </button>
          );
        })}
        {!commercial.length && !editing && <div className={`${SURFACE} p-5 font-body text-sm text-foreground/54`}>No experience tickets yet. Add the first ticket to start your sale setup.</div>}
      </div>
    </div>
  );
}

function BrandPanel({ event, busy, onUpload }) {
  const inputRef = useRef(null);
  const [kind, setKind] = useState('hero');
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <div className={`${SURFACE} p-5`}>
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Organizer uploads</p>
        <h2 className="mt-1 font-heading text-4xl uppercase">Brand & gallery</h2>
        <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-foreground/56">Upload original event photography. Avalon strips metadata, creates web-ready sizes, and reviews organizer uploads before they go live.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[180px_1fr]">
          <label><span className={LABEL}>Asset type</span><select className={`${FIELD} appearance-none`} value={kind} onChange={(e) => setKind(e.target.value)}><option value="hero">Hero image</option><option value="gallery">Gallery image</option></select></label>
          <div><span className={LABEL}>Image</span><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file, kind); e.target.value = ''; }} /><button disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-background disabled:opacity-50"><ImagePlus className="h-4 w-4" />{busy ? 'Uploading…' : 'Choose image'}</button></div>
        </div>
        <p className="mt-3 font-body text-[11px] text-foreground/40">JPEG, PNG, WEBP, or HEIC · 12 MB max · uploads begin in review</p>
      </div>
      <div className={`${SURFACE} grid grid-cols-3 gap-2 p-4`}>
        {[['Live', event.assets.live], ['In review', event.assets.pending], ['Pulled', event.assets.pulled]].map(([label, value]) => <div key={label} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] p-3"><p className="font-heading text-3xl" style={MONO}>{value}</p><p className="mt-2 font-body text-[10px] uppercase tracking-[0.15em] text-foreground/42">{label}</p></div>)}
      </div>
    </div>
  );
}

function LogisticsPanel({ event, busy, onSave, onUploadDocument }) {
  const coiInputRef = useRef(null);
  const floorInputRef = useRef(null);
  const venuePhotoInputRef = useRef(null);
  const venueRequirementsInputRef = useRef(null);
  const [form, setForm] = useState({});
  useEffect(() => {
    setForm({
      eventType: event.logistics?.eventType || 'private_party',
      companyLegalName: event.logistics?.companyLegalName || '',
      venueLegalName: event.logistics?.venueLegalName || '',
      onsiteContactName: event.logistics?.onsiteContactName || '',
      onsiteContactPhone: event.logistics?.onsiteContactPhone || '',
      coiRequested: event.logistics?.coiRequested === true,
      certificateHolder: event.logistics?.certificateHolder || '',
      insuranceRequirements: event.logistics?.insuranceRequirements || '',
      coiDueDate: event.logistics?.coiDueDate || '',
      coiPolicyExpiresAt: event.logistics?.coiPolicyExpiresAt || '',
      expectedGuests: event.logistics?.expectedGuests ?? event.capacity ?? '',
      requestedServiceCapacity: event.logistics?.requestedServiceCapacity ?? '',
      loadInWindow: event.logistics?.loadInWindow || '',
      layoutNotes: event.logistics?.layoutNotes || '',
      venueProvides: event.logistics?.venueProvides || '',
      avalonBringItems: Array.isArray(event.logistics?.avalonBringItems) ? event.logistics.avalonBringItems : [],
      avalonBrings: event.logistics?.avalonBrings || '',
      furnitureNeeded: event.logistics?.furnitureNeeded === true,
      signageNeeded: event.logistics?.signageNeeded === true,
      accessNotes: event.logistics?.accessNotes || '',
      upgradeRequests: event.logistics?.upgradeRequests || '',
    });
  }, [event.id, event.capacity, event.logistics]);
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const isPrivateParty = form.eventType === 'private_party';
  const coiReady = isPrivateParty || event.documents?.coiCount > 0;
  const toggleBringItem = (item) => setForm((current) => ({ ...current, avalonBringItems: current.avalonBringItems?.includes(item) ? current.avalonBringItems.filter((value) => value !== item) : [...(current.avalonBringItems || []), item] }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <section className={`${SURFACE} p-5`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-start gap-3"><ClipboardList className="mt-0.5 h-5 w-5 text-[#C8F135]" /><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Event profile</p><h2 className="mt-1 font-heading text-4xl uppercase">Party, company, or venue?</h2><p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-foreground/52">Choose the structure first. Company and venue events open the insurance and certificate details Avalon needs; a private party stays fast.</p></div></div><div className="w-full lg:max-w-xs"><label><span className={LABEL}>Event structure</span><select className={`${FIELD} appearance-none`} value={form.eventType || 'private_party'} onChange={set('eventType')}><option value="private_party">Private party</option><option value="venue_company">Venue + company involved</option><option value="company_offsite">Company at a private location</option><option value="public_event">Public ticketed event</option></select></label></div></div>
        {!isPrivateParty ? <div className="mt-5 grid gap-4 border-t border-foreground/[0.08] pt-5 md:grid-cols-2 lg:grid-cols-4"><label><span className={LABEL}>Company legal name</span><input className={FIELD} value={form.companyLegalName || ''} onChange={set('companyLegalName')} /></label><label><span className={LABEL}>Venue legal name</span><input className={FIELD} value={form.venueLegalName || ''} onChange={set('venueLegalName')} /></label><label><span className={LABEL}>On-site contact</span><input className={FIELD} value={form.onsiteContactName || ''} onChange={set('onsiteContactName')} /></label><label><span className={LABEL}>Contact phone</span><input className={FIELD} value={form.onsiteContactPhone || ''} onChange={set('onsiteContactPhone')} /></label></div> : null}
      </section>

      {!isPrivateParty ? <section className={`${SURFACE} p-5`}>
        <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]"><div><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#C8F135]" /><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Insurance handoff</p><h2 className="mt-1 font-heading text-4xl uppercase">COI & venue terms.</h2></div></div><label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-foreground/[0.12] bg-foreground/[0.035] px-4 font-body text-sm text-foreground/68"><input type="checkbox" checked={Boolean(form.coiRequested)} onChange={set('coiRequested')} className="h-4 w-4 accent-white" /> Venue or company requested a COI</label><div className={`mt-3 rounded-xl border p-3 font-body text-[12px] ${coiReady ? 'border-[#C8F135]/25 bg-[#C8F135]/[0.05] text-[#C8F135]' : 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100'}`}>{coiReady ? `${event.documents?.coiCount || 0} COI file uploaded · ${event.documents?.coiStatus || 'Avalon review'}` : 'COI file still needed for Avalon review'}</div></div><div className="grid gap-4 md:grid-cols-2"><label><span className={LABEL}>Certificate holder</span><textarea className={`${FIELD} min-h-24 py-3 leading-relaxed`} value={form.certificateHolder || ''} onChange={set('certificateHolder')} placeholder="Legal name and mailing address" /></label><div className="grid gap-4"><label><span className={LABEL}>COI due date</span><input type="date" className={`${FIELD} [color-scheme:dark]`} value={form.coiDueDate || ''} onChange={set('coiDueDate')} /></label><label><span className={LABEL}>Policy expiration</span><input type="date" className={`${FIELD} [color-scheme:dark]`} value={form.coiPolicyExpiresAt || ''} onChange={set('coiPolicyExpiresAt')} /></label></div><label className="md:col-span-2"><span className={LABEL}>Coverage, additional insured, and venue wording</span><textarea className={`${FIELD} min-h-28 py-3 leading-relaxed`} value={form.insuranceRequirements || ''} onChange={set('insuranceRequirements')} placeholder="Paste the venue or company insurance requirements" /></label><div className="md:col-span-2 flex flex-wrap gap-2"><input ref={coiInputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadDocument(file, 'coi'); e.target.value = ''; }} /><button type="button" disabled={busy} onClick={() => coiInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/18 px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"><ImagePlus className="h-4 w-4" /> Upload COI</button><input ref={venueRequirementsInputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadDocument(file, 'venue_requirements'); e.target.value = ''; }} /><button type="button" disabled={busy} onClick={() => venueRequirementsInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/18 px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"><ImagePlus className="h-4 w-4" /> Venue requirements <span className="text-foreground/40">· {event.documents?.venueRequirementCount || 0}</span></button></div></div></div>
      </section> : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className={`${SURFACE} p-5`}>
          <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-[#C8F135]" /><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Room plan</p><h2 className="mt-1 font-heading text-4xl uppercase">Layout & access.</h2></div></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label><span className={LABEL}>Expected attendance</span><input className={FIELD} inputMode="numeric" value={form.expectedGuests ?? ''} onChange={set('expectedGuests')} /></label>
            <div><span className={LABEL}>Admin-approved event cap</span><div className="flex min-h-12 items-center rounded-xl border border-foreground/[0.10] bg-foreground/[0.025] px-4 font-mono text-sm text-foreground/64" style={MONO}>{event.capacity || 'Not set'}</div></div>
            <label><span className={LABEL}>Requested service capacity</span><input className={FIELD} inputMode="numeric" value={form.requestedServiceCapacity ?? ''} onChange={set('requestedServiceCapacity')} placeholder="Guests requesting Avalon services" /></label>
            <label><span className={LABEL}>Load-in window</span><input className={FIELD} value={form.loadInWindow || ''} onChange={set('loadInWindow')} placeholder="4:30 PM – 6:00 PM" /></label>
            <label className="md:col-span-2"><span className={LABEL}>Brief layout description</span><textarea className={`${FIELD} min-h-28 py-3 leading-relaxed`} value={form.layoutNotes || ''} onChange={set('layoutNotes')} placeholder="Which room, approximate footprint, guest entry and exit, privacy, power locations, and the path back to the event" /></label>
            <label className="md:col-span-2"><span className={LABEL}>Loading, parking, elevator, and venue access</span><textarea className={`${FIELD} min-h-24 py-3 leading-relaxed`} value={form.accessNotes || ''} onChange={set('accessNotes')} placeholder="Where Avalon unloads, who grants access, and any time restrictions" /></label>
            <div className="md:col-span-2 flex flex-wrap gap-2"><input ref={floorInputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadDocument(file, 'floor_plan'); e.target.value = ''; }} /><button type="button" disabled={busy} onClick={() => floorInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/18 px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"><ImagePlus className="h-4 w-4" /> Floor plan <span className="text-foreground/40">· {event.documents?.floorPlanCount || 0}</span></button><input ref={venuePhotoInputRef} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadDocument(file, 'venue_photo'); e.target.value = ''; }} /><button type="button" disabled={busy} onClick={() => venuePhotoInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/18 px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"><ImagePlus className="h-4 w-4" /> Venue photos <span className="text-foreground/40">· {event.documents?.venuePhotoCount || 0}</span></button></div>
          </div>
        </section>

        <section className={`${SURFACE} p-5`}>
          <div className="flex items-start gap-3"><Package className="mt-0.5 h-5 w-5 text-[#C8F135]" /><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Production split</p><h2 className="mt-1 font-heading text-4xl uppercase">Who brings what.</h2></div></div>
          <div className="mt-5 grid gap-4">
            <label><span className={LABEL}>Venue provides</span><textarea className={`${FIELD} min-h-28 py-3 leading-relaxed`} value={form.venueProvides || ''} onChange={set('venueProvides')} placeholder={'Tables\nChairs\nPower\nWaste'} /></label>
            <div><span className={LABEL}>What Avalon needs to thrive</span><div className="grid gap-2 sm:grid-cols-2">{AVALON_BRING_OPTIONS.map((item) => { const checked = form.avalonBringItems?.includes(item); return <button key={item} type="button" aria-pressed={checked} onClick={() => toggleBringItem(item)} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left font-body text-[12px] ${checked ? 'border-foreground/44 bg-foreground/[0.08] text-foreground' : 'border-foreground/[0.10] text-foreground/48'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-foreground bg-foreground text-background' : 'border-foreground/18'}`}>{checked ? <Check className="h-3 w-3" /> : null}</span>{item}</button>; })}</div><label className="mt-3 block"><span className={LABEL}>Other items, quantities, or constraints</span><textarea className={`${FIELD} min-h-24 py-3 leading-relaxed`} value={form.avalonBrings || ''} onChange={set('avalonBrings')} placeholder="Cable-run length, specific furniture quantities, backup Wi-Fi, or anything unusual" /></label></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-foreground/[0.12] bg-foreground/[0.035] px-4 font-body text-sm text-foreground/68"><input type="checkbox" checked={Boolean(form.furnitureNeeded)} onChange={set('furnitureNeeded')} className="h-4 w-4 accent-white" /> Avalon furniture needed</label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-foreground/[0.12] bg-foreground/[0.035] px-4 font-body text-sm text-foreground/68"><input type="checkbox" checked={Boolean(form.signageNeeded)} onChange={set('signageNeeded')} className="h-4 w-4 accent-white" /> Avalon signage needed</label>
            </div>
          </div>
        </section>
      </div>

      <section className={`${SURFACE} p-5`}>
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]"><div className="flex items-start gap-3"><Truck className="mt-0.5 h-5 w-5 text-[#C8F135]" /><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Request, then confirm</p><h2 className="mt-1 font-heading text-4xl uppercase">Service upgrades.</h2><p className="mt-3 font-body text-sm leading-relaxed text-foreground/52">Ask for added stations, extended hours, extra hosts, seating, or a larger service allocation. Avalon confirms feasibility, staffing, and price.</p></div></div><label><span className={LABEL}>Upgrade and support requests</span><textarea className={`${FIELD} min-h-32 py-3 leading-relaxed`} value={form.upgradeRequests || ''} onChange={set('upgradeRequests')} placeholder="Describe what you want Avalon to add or price" /></label></div>
        <button disabled={busy} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-background disabled:opacity-50"><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save venue & logistics'}</button>
      </section>
    </form>
  );
}

export default function OrganizerEventHub() {
  const { user, authBackend, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [hub, setHub] = useState(EMPTY_HUB);
  const [activeId, setActiveId] = useState('');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  useSeo({ title: 'Event Hub — Avalon Vitality', description: 'Secure Avalon organizer event and ticket sales portal.', path: '/organizer', robots: 'noindex,nofollow,noarchive' });

  const load = async () => {
    setLoading(true); setNotice(null);
    try {
      const data = authBackend === 'demo' ? { ...EMPTY_HUB, events: DEMO_EVENTS } : await apiGet('/api/events/organizer');
      setHub(data);
      setActiveId((current) => data.events.some((event) => event.id === current) ? current : data.events[0]?.id || '');
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'Could not load the Event Hub.' });
      setHub(EMPTY_HUB);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [authBackend]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = useMemo(() => hub.events.find((event) => event.id === activeId) || hub.events[0], [hub.events, activeId]);

  const runAction = async (name, payload, success) => {
    if (!active) return false;
    setBusy(name); setNotice(null);
    try {
      if (authBackend === 'demo') {
        setHub((current) => ({ ...current, events: current.events.map((event) => {
          if (event.id !== active.id) return event;
          if (payload.action === 'update_details') return { ...event, ...payload, descriptionBlocks: { ...(event.descriptionBlocks || {}), description: payload.description, vibe: payload.vibe } };
          if (payload.action === 'update_logistics') return { ...event, logistics: { ...payload } };
          if (payload.action === 'save_ticket') {
            const saved = { id: payload.tierId || `demo-ticket-${Date.now()}`, name: payload.name, description: payload.description, priceCents: payload.priceCents, allocation: payload.allocation === '' ? null : Number(payload.allocation), presaleOpensAt: payload.presaleOpensAt || null, publicOpensAt: payload.publicOpensAt || null, experienceOnly: true, active: payload.active, sold: payload.tierId ? event.tickets.find((ticket) => ticket.id === payload.tierId)?.sold || 0 : 0 };
            return { ...event, tickets: payload.tierId ? event.tickets.map((ticket) => ticket.id === payload.tierId ? saved : ticket) : [...event.tickets, saved] };
          }
          return event;
        }) }));
      } else {
        const data = await apiPost('/api/events/organizer', { ...payload, containerId: active.id });
        setHub(data);
      }
      setNotice({ type: 'success', message: success });
      return true;
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'That change could not be saved.' });
      return false;
    } finally { setBusy(''); }
  };

  const upload = async (file, kind) => {
    if (!active) return;
    if (file.size > 12 * 1024 * 1024) { setNotice({ type: 'error', message: 'Image must be 12 MB or smaller.' }); return; }
    if (authBackend === 'demo') {
      setBusy('upload');
      setTimeout(() => { setHub((current) => ({ ...current, events: current.events.map((event) => event.id === active.id ? { ...event, assets: { ...event.assets, pending: event.assets.pending + 1 } } : event) })); setBusy(''); setNotice({ type: 'success', message: 'Image uploaded for Avalon review.' }); }, 500);
      return;
    }
    setBusy('upload'); setNotice(null);
    try {
      const grant = await apiPost('/api/events/assets', { slug: active.slug, action: 'upload_url', kind, fileName: file.name });
      const uploaded = await fetch(grant.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!uploaded.ok) throw new Error('The image upload did not finish.');
      await apiPost('/api/events/assets', { slug: active.slug, action: 'finalize', path: grant.path, kind });
      await load();
      setNotice({ type: 'success', message: 'Image uploaded for Avalon review.' });
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Image upload failed.' }); }
    finally { setBusy(''); }
  };

  const uploadDocument = async (file, kind) => {
    if (!active) return;
    if (file.size > 20 * 1024 * 1024) { setNotice({ type: 'error', message: 'Document must be 20 MB or smaller.' }); return; }
    if (authBackend === 'demo') {
      setBusy('document');
      setTimeout(() => { setHub((current) => ({ ...current, events: current.events.map((event) => { if (event.id !== active.id) return event; const counts = kind === 'coi' ? { coiCount: (event.documents?.coiCount || 0) + 1, coiStatus: 'pending' } : kind === 'venue_photo' ? { venuePhotoCount: (event.documents?.venuePhotoCount || 0) + 1 } : kind === 'venue_requirements' ? { venueRequirementCount: (event.documents?.venueRequirementCount || 0) + 1 } : { floorPlanCount: (event.documents?.floorPlanCount || 0) + 1 }; return { ...event, documents: { ...(event.documents || {}), ...counts } }; }) })); setBusy(''); setNotice({ type: 'success', message: kind === 'coi' ? 'COI uploaded for Avalon review.' : kind === 'venue_photo' ? 'Venue photo uploaded.' : kind === 'venue_requirements' ? 'Venue requirements uploaded.' : 'Floor plan uploaded.' }); }, 450);
      return;
    }
    setBusy('document'); setNotice(null);
    try {
      const grant = await apiPost('/api/events/documents', { slug: active.slug, action: 'upload_url', kind, fileName: file.name });
      const uploaded = await fetch(grant.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!uploaded.ok) throw new Error('The document upload did not finish.');
      await apiPost('/api/events/documents', { slug: active.slug, action: 'finalize', path: grant.path, kind, fileName: file.name, contentType: file.type });
      await load(); setNotice({ type: 'success', message: kind === 'coi' ? 'COI uploaded for Avalon review.' : kind === 'venue_photo' ? 'Venue photo uploaded.' : kind === 'venue_requirements' ? 'Venue requirements uploaded.' : 'Floor plan uploaded.' });
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Document upload failed.' }); }
    finally { setBusy(''); }
  };

  const copySaleLink = async () => {
    if (!active) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/events/${active.slug}`); setNotice({ type: 'success', message: 'Ticket link copied.' }); }
    catch { setNotice({ type: 'error', message: 'Copy failed. Open the public page and copy its address.' }); }
  };

  const handleSignOut = async () => { await signOut(); navigate('/login?portal=organizer', { replace: true }); };
  const openCapacity = active ? Math.max(0, (active.capacity || 0) - active.ticketsSold) : 0;
  const tabs = [['overview', 'Overview'], ['details', 'Event details'], ['logistics', 'Venue & logistics'], ['tickets', 'Tickets'], ['brand', 'Brand']];

  return (
    <main className="min-h-dvh bg-black pb-16 text-foreground">
      <header className="sticky top-0 z-40 border-b border-foreground/[0.10] bg-black px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link to="/" aria-label="Avalon Vitality home" className="flex min-h-11 items-center gap-3"><AvalonMark className="h-7 w-[18px]" /><span className="hidden font-body text-xs font-semibold uppercase tracking-[0.24em] sm:inline">Avalon</span></Link>
          <div className="text-center"><p className="font-heading text-2xl uppercase leading-none">Event Hub</p><p className="mt-1 font-body text-[9px] uppercase tracking-[0.2em] text-foreground/40">Organizer portal</p></div>
          <button onClick={handleSignOut} aria-label="Sign out" className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.14] text-foreground/58"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">
        {loading ? <div className={`${SURFACE} flex min-h-64 items-center justify-center gap-3 font-body text-sm text-foreground/50`} aria-busy="true"><RefreshCw className="h-4 w-4 animate-spin" /> Loading your events…</div> : !active ? <EmptyState /> : (
          <>
            <section className={`${SURFACE} p-4 md:p-5`}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#C8F135]/30 px-3 py-1 font-body text-[9px] font-bold uppercase tracking-[0.16em] text-[#C8F135]">{statusLabel(active.status)}</span><span className="font-body text-[11px] text-foreground/40">Approved organizer access</span></div>
                  <h1 className="mt-4 break-words font-heading text-5xl uppercase leading-[0.9] md:text-7xl">{active.name}</h1>
                  <p className="mt-3 font-body text-sm text-foreground/54">{eventDate(active.startsAt)} · {active.venue || 'Venue to be confirmed'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={copySaleLink} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/16 px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em]"><Copy className="h-4 w-4" /> Copy ticket link</button>
                  <Link to={`/events/${active.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-background">Public page <ArrowUpRight className="h-4 w-4" /></Link>
                </div>
              </div>
              {hub.events.length > 1 && <label className="mt-5 block max-w-sm"><span className={LABEL}>Event</span><span className="relative block"><select value={active.id} onChange={(e) => setActiveId(e.target.value)} className={`${FIELD} appearance-none pr-10`}>{hub.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/42" /></span></label>}
            </section>

            {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-3 flex items-center gap-2 rounded-xl border px-4 py-3 font-body text-sm ${notice.type === 'error' ? 'border-red-400/25 bg-red-500/[0.08] text-red-200' : 'border-[#C8F135]/25 bg-[#C8F135]/[0.06] text-[#C8F135]'}`}><Check className="h-4 w-4" />{notice.message}</div>}

            <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Tickets sold" value={active.ticketsSold} detail={`${active.paidOrders} paid orders`} Icon={Ticket} />
              <Stat label="Experience sales" value={dollars(active.experienceSalesCents)} detail="Experience-only orders · before fees" Icon={CircleDollarSign} />
              <Stat label="Capacity open" value={openCapacity} detail={`${active.capacity || 'No'} total capacity`} Icon={Users} />
              <Stat label="Brand assets" value={active.assets.live} detail={`${active.assets.pending} awaiting review`} Icon={ImagePlus} />
            </section>

            <div className="no-scrollbar mt-5 overflow-x-auto" role="tablist" aria-label="Event Hub sections"><div className="flex min-w-max gap-1 rounded-full border border-foreground/[0.12] bg-foreground/[0.035] p-1">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-11 rounded-full px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em] ${tab === key ? 'bg-foreground text-background' : 'text-foreground/54'}`}>{label}</button>)}</div></div>

            <section className="mt-5" role="tabpanel">
              {tab === 'overview' && (
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className={`${SURFACE} p-5`}>
                    <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42">Event readiness</p><h2 className="mt-1 font-heading text-4xl uppercase">Run the room.</h2>
                    <div className="mt-5 divide-y divide-foreground/[0.08]">{[
                      ['Public event details', Boolean(active.name && active.venue && active.startsAt), 'Name, venue area, date, and story'],
                      ['Event structure', Boolean(active.logistics?.eventType), active.logistics?.eventType === 'private_party' ? 'Private party' : `${active.logistics?.companyLegalName || 'Company pending'} · ${active.logistics?.venueLegalName || 'Venue pending'}`],
                      ['Insurance / COI', active.logistics?.eventType === 'private_party' || !active.logistics?.coiRequested || active.documents?.coiCount > 0, active.logistics?.eventType === 'private_party' ? 'Not requested for this private party' : active.documents?.coiCount ? `${active.documents.coiCount} uploaded · ${active.documents.coiStatus || 'in review'}` : 'COI details or file needed'],
                      ['Layout & venue access', Boolean(active.logistics?.layoutNotes && active.logistics?.accessNotes), `Room plan, load-in, parking, and guest flow · ${active.documents?.floorPlanCount || 0} floor plan · ${active.documents?.venuePhotoCount || 0} photos`],
                      ['Furniture, power & signage', Boolean(active.logistics?.venueProvides && active.logistics?.avalonBringItems?.length), `${active.logistics?.avalonBringItems?.length || 0} Avalon bring items · ${active.logistics?.furnitureNeeded ? 'furniture requested' : 'no furniture request'} · ${active.logistics?.signageNeeded ? 'signage requested' : 'no signage request'}`],
                      ['Capacity plan', Boolean(active.logistics?.expectedGuests && active.logistics?.requestedServiceCapacity), `${active.logistics?.expectedGuests || 0} expected · ${active.logistics?.requestedServiceCapacity || 0} requested service spots · ${active.capacity || 0} approved cap`],
                      ['Upgrade requests', Boolean(active.logistics?.upgradeRequests), active.logistics?.upgradeRequests ? 'Awaiting Avalon confirmation' : 'No upgrades requested'],
                      ['Experience tickets', active.tickets.some((ticket) => ticket.active), 'Pricing, allocation, and sale windows'],
                      ['Brand approved', active.assets.live > 0, `${active.assets.live} live · ${active.assets.pending} in review`],
                      ['Ticket page', ['presale', 'public'].includes(active.status), active.status === 'draft' ? 'Avalon publishing approval required' : 'Ready to share'],
                    ].map(([label, ready, detail]) => <div key={label} className="flex items-center gap-3 py-4"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${ready ? 'border-[#C8F135]/30 text-[#C8F135]' : 'border-foreground/14 text-foreground/32'}`}>{ready ? <Check className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}</span><div><p className="font-body text-sm font-semibold">{label}</p><p className="mt-1 font-body text-[12px] text-foreground/44">{detail}</p></div></div>)}</div>
                  </div>
                  <TrustBoundary />
                </div>
              )}
              {tab === 'details' && <DetailsPanel event={active} busy={busy === 'details'} onSave={(payload) => runAction('details', { action: 'update_details', ...payload }, 'Event details saved.')} />}
              {tab === 'logistics' && <LogisticsPanel event={active} busy={busy === 'logistics' || busy === 'document'} onUploadDocument={uploadDocument} onSave={(payload) => runAction('logistics', { action: 'update_logistics', ...payload }, 'Venue and logistics plan saved for Avalon review.')} />}
              {tab === 'tickets' && <TicketsPanel event={active} busy={busy === 'ticket'} onSave={(payload) => runAction('ticket', { action: 'save_ticket', ...payload }, 'Ticket setup saved.')} />}
              {tab === 'brand' && <BrandPanel event={active} busy={busy === 'upload'} onUpload={upload} />}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
