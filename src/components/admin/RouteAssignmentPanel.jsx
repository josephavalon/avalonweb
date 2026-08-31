import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Loader2, RefreshCw, Route, UserRoundCheck } from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/apiClient';

const fmt = (value) => value ? new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time pending';

export default function RouteAssignmentPanel() {
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selected, setSelected] = useState([]);
  const [providerId, setProviderId] = useState('');
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [bookingData, rosterData] = await Promise.all([apiGet('/api/admin/bookings?scope=upcoming'), apiGet('/api/admin/bookings/assign')]);
      setBookings((bookingData.bookings || []).slice(0, 30));
      setProviders(rosterData.providers || []);
      setState('ready');
    } catch (error) { setMessage(error.message); setState('error'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selectedBookings = useMemo(() => bookings.filter((booking) => selected.includes(booking.id)), [bookings, selected]);
  const apply = async () => {
    if (!selectedBookings.length) return;
    setState('saving'); setMessage('');
    try {
      await apiPatch('/api/admin/bookings/assign', { changes: selectedBookings.map((booking) => ({ appointmentId: booking.id, providerProfileId: providerId || null, expectedUpdatedAt: booking.updatedAt })) });
      setMessage(`${selectedBookings.length} appointment${selectedBookings.length === 1 ? '' : 's'} updated.`);
      setSelected([]);
      await load();
    } catch (error) { setMessage(error.message); setState('error'); }
  };

  return (
    <section className="rounded-xl border border-foreground/12 bg-background p-4 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/38">Authoritative assignment</p><h2 className="mt-1 font-heading text-3xl uppercase leading-none">Route Assignments</h2><p className="mt-2 font-body text-xs text-foreground/48">Assign coverage here; nurses decide route inclusion separately.</p></div><button type="button" onClick={load} className="grid h-10 w-10 place-items-center rounded-full border border-foreground/15" aria-label="Refresh assignments"><RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} /></button></div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {bookings.map((booking) => {
          const isSelected = selected.includes(booking.id);
          return <button type="button" key={booking.id} onClick={() => setSelected((current) => isSelected ? current.filter((id) => id !== booking.id) : [...current, booking.id])} className="flex min-h-[74px] items-center gap-3 rounded-xl border p-3 text-left" style={{ borderColor: isSelected ? 'currentColor' : 'hsl(var(--foreground) / 0.1)', background: isSelected ? 'hsl(var(--foreground) / 0.08)' : 'transparent' }}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${isSelected ? 'bg-foreground text-background' : 'border-foreground/20'}`}>{isSelected && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate font-body text-sm font-semibold">{booking.customerName}</span><span className="mt-1 flex items-center gap-1.5 truncate font-body text-[10px] text-foreground/45"><CalendarClock className="h-3 w-3" />{fmt(booking.startsAt)} · {booking.service}</span></span><span className="max-w-[110px] truncate rounded-full border border-foreground/12 px-2 py-1 font-body text-[8px] font-bold uppercase tracking-[0.1em] text-foreground/45">{booking.assignedNurse || 'Unassigned'}</span></button>;
        })}
      </div>
      {bookings.length === 0 && state !== 'loading' && <p className="mt-4 rounded-xl border border-foreground/10 p-5 text-center font-body text-sm text-foreground/45">No upcoming appointments.</p>}
      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-foreground/[0.05] p-3 md:flex-row md:items-center"><div className="flex items-center gap-2 font-body text-[10px] font-bold uppercase tracking-[0.14em]"><Route className="h-4 w-4" />{selected.length} selected</div><label className="flex min-w-0 flex-1 items-center gap-2"><UserRoundCheck className="h-4 w-4 text-foreground/45" /><select value={providerId} onChange={(event) => setProviderId(event.target.value)} className="min-h-[42px] w-full rounded-xl border border-foreground/15 bg-background px-3 font-body text-sm"><option value="">Unassign</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {String(provider.role).toUpperCase()}</option>)}</select></label><button type="button" disabled={!selected.length || state === 'saving'} onClick={apply} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-35">{state === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Apply</button></div>
      {message && <p className="mt-3 font-body text-xs text-foreground/55">{message}</p>}
    </section>
  );
}
