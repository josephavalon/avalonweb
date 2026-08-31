import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, FileText, Loader2, MapPin, RefreshCw, Route, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import { apiGet, apiPost } from '@/lib/apiClient';
import { INVOICE_DRAFT_KEY } from '@/lib/invoiceSession';
import { useSeo } from '@/lib/seo';

const FILTERS = [['today', 'Today'], ['upcoming', 'Upcoming'], ['events', 'Events'], ['open', 'Open'], ['history', 'History']];
const dayKey = (value) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const formatDate = (value) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(new Date(value));

function invoiceHours(shift) {
  const hours = Math.max(0.25, (Date.parse(shift.ends_at) - Date.parse(shift.starts_at)) / 3600000);
  return String(Math.round(hours * 4) / 4);
}

function statusTone(status) {
  if (status === 'completed') return 'border-emerald-500/30 text-emerald-700';
  if (status === 'cancelled') return 'border-red-500/30 text-red-700';
  if (status === 'open') return 'border-amber-500/30 text-amber-700';
  return 'border-foreground/15 text-foreground/60';
}

export default function NurseSchedule() {
  useSeo({ title: 'My Shifts — Avalon Vitality', description: 'Claim, complete, and invoice Avalon shifts.', path: '/provider/shifts', robots: 'noindex, nofollow' });
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', shifts: [] });
  const [filter, setFilter] = useState('today');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const from = new Date(Date.now() - 120 * 86400000).toISOString();
      const to = new Date(Date.now() + 366 * 86400000).toISOString();
      const data = await apiGet(`/api/me/shifts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setState({ loading: false, error: '', shifts: data.shifts || [] });
    } catch (error) { setState((current) => ({ ...current, loading: false, error: error.message })); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const today = dayKey(new Date());
    const now = Date.now();
    return state.shifts.filter((shift) => {
      const assigned = Boolean(shift.assignment && ['claimed', 'assigned', 'completed'].includes(shift.assignment.status));
      if (filter === 'today') return assigned && dayKey(shift.starts_at) === today && shift.status !== 'cancelled';
      if (filter === 'upcoming') return assigned && Date.parse(shift.starts_at) >= now && !['completed', 'cancelled'].includes(shift.status);
      if (filter === 'events') return assigned && Boolean(shift.event) && shift.status !== 'cancelled';
      if (filter === 'open') return shift.status === 'open' && !assigned;
      return assigned && (shift.status === 'completed' || shift.status === 'cancelled' || Date.parse(shift.ends_at) < now);
    });
  }, [filter, state.shifts]);

  const act = async (shift, action) => {
    setBusy(shift.id); setState((current) => ({ ...current, error: '' }));
    try { await apiPost('/api/me/shifts', { shiftId: shift.id, action }); await load(); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
    finally { setBusy(''); }
  };

  const invoice = (shift) => {
    try {
      const stored = window.sessionStorage.getItem(INVOICE_DRAFT_KEY);
      const draft = stored ? JSON.parse(stored) : {};
      const linked = {
        id: crypto.randomUUID?.() || `shift-${Date.now()}`,
        shiftId: shift.id,
        date: dayKey(shift.starts_at),
        typeKey: shift.event_container_id ? 'event' : 'mobile',
        hours: invoiceHours(shift), ivCount: '0', shotCount: '0', gfeCount: '0',
      };
      const shifts = Array.isArray(draft.shifts) ? draft.shifts.filter((row) => row?.date || row?.shiftId) : [];
      window.sessionStorage.setItem(INVOICE_DRAFT_KEY, JSON.stringify({ ...draft, shifts: [...shifts.filter((row) => row.shiftId !== shift.id), linked] }));
    } catch { /* the invoice form still opens with a blank row */ }
    navigate('/invoice');
  };

  const navItems = [
    { label: 'Shifts', to: '/provider/shifts', icon: CalendarDays },
    { label: 'Route', to: '/provider/shift', icon: Route },
    { label: 'Invoices', to: '/provider/invoices', icon: FileText },
  ];

  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Workforce schedule</p><h1 className="font-heading text-5xl uppercase">My shifts</h1></div><button type="button" onClick={load} className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15" aria-label="Refresh shifts"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button></header>
        <div className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-foreground/10 p-1">{FILTERS.map(([key, label]) => <button type="button" key={key} onClick={() => setFilter(key)} className={`min-h-10 shrink-0 rounded-xl px-4 text-[10px] font-bold uppercase tracking-[0.14em] ${filter === key ? 'bg-foreground text-background' : 'text-foreground/55'}`}>{label}</button>)}</div>
        {state.error ? <p className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{state.error}</p> : null}
        <div className="mt-5 grid gap-3">
          {rows.map((shift) => {
            const assignment = shift.assignment;
            const complete = shift.status === 'completed' || assignment?.status === 'completed';
            return <article key={shift.id} className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{shift.title}</h2><span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${statusTone(complete ? 'completed' : shift.status)}`}>{complete ? 'completed' : assignment?.status || shift.status}</span></div><p className="mt-2 text-sm text-foreground/60">{formatDate(shift.starts_at)} – {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(new Date(shift.ends_at))}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/45"><MapPin className="h-3.5 w-3.5" />{shift.location_name || shift.service_area || 'Location pending'}</p>{shift.event ? <p className="mt-1 text-xs text-foreground/45">Event: {shift.event.name}</p> : null}{shift.instructions ? <p className="mt-3 rounded-xl bg-foreground/[0.045] p-3 text-sm text-foreground/60">{shift.instructions}</p> : null}</div><div className="flex flex-wrap gap-2">{filter === 'open' && !assignment ? <button disabled={busy === shift.id} onClick={() => act(shift, 'claim')} className="min-h-11 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-background"><Users className="mr-1 inline h-3.5 w-3.5" />Claim shift</button> : null}{assignment && !complete && !['cancelled'].includes(shift.status) ? <button disabled={busy === shift.id} onClick={() => act(shift, 'complete')} className="min-h-11 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-background"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Complete</button> : null}{complete ? <button onClick={() => invoice(shift)} className="min-h-11 rounded-full border border-foreground/15 px-5 text-[10px] font-bold uppercase tracking-[0.14em]"><FileText className="mr-1 inline h-3.5 w-3.5" />Add to invoice</button> : null}</div></div></article>;
          })}
          {state.loading ? <p className="flex items-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading shifts</p> : null}
          {!state.loading && !rows.length ? <p className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/45">No shifts in this view.</p> : null}
        </div>
      </section>
      <MobileNavBar items={navItems} columns={3} maxWidth="shift" mobileOnly={false} ariaLabel="Provider operations" />
    </main>
  );
}
