import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Edit3, Loader2, Megaphone, Plus, RefreshCw, Users, X } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';

const FIELD = 'min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm outline-none focus:border-foreground/40';
const WEEKDAYS = [['1', 'M'], ['2', 'T'], ['3', 'W'], ['4', 'T'], ['5', 'F'], ['6', 'S'], ['0', 'S']];
const empty = () => ({
  title: '', startDate: new Date().toLocaleDateString('en-CA'), startTime: '09:00', endTime: '17:00',
  timezone: 'America/Los_Angeles', locationName: '', locationAddress: '', serviceArea: '', roleRequired: 'RN',
  slotsRequired: '1', status: 'open', instructions: '', eventContainerId: '', recurrenceMode: 'none',
  appointmentId: '', intervalWeeks: '1', weekdays: [], untilDate: '', assignedNurseIds: [],
});

function localFormValue(value) {
  const date = new Date(value);
  return { date: date.toLocaleDateString('en-CA'), time: date.toTimeString().slice(0, 5) };
}

function statusClass(status) {
  return status === 'completed' ? 'text-emerald-700' : status === 'cancelled' ? 'text-red-700' : status === 'open' ? 'text-amber-700' : 'text-foreground/65';
}

export default function SchedulingControl() {
  const [state, setState] = useState({ loading: true, error: '', shifts: [], nurses: [], events: [], appointments: [] });
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const from = new Date(Date.now() - 31 * 86400000).toISOString();
      const to = new Date(Date.now() + 366 * 86400000).toISOString();
      const data = await apiGet(`/api/admin/scheduling?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setState({ loading: false, error: '', shifts: data.shifts || [], nurses: data.nurses || [], events: data.events || [], appointments: data.appointments || [] });
    } catch (error) { setState((current) => ({ ...current, loading: false, error: error.message })); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const edit = (shift) => {
    const start = localFormValue(shift.starts_at); const end = localFormValue(shift.ends_at);
    setEditing(shift);
    setForm({ ...empty(), title: shift.title, startDate: start.date, startTime: start.time, endTime: end.time, timezone: shift.timezone, locationName: shift.location_name || '', locationAddress: shift.location_address || '', serviceArea: shift.service_area || '', roleRequired: shift.role_required, slotsRequired: String(shift.slots_required), status: shift.status, instructions: shift.instructions || '', eventContainerId: shift.event_container_id || '', appointmentId: shift.appointment_id || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    const payload = {
      ...form, slotsRequired: Number(form.slotsRequired), eventContainerId: form.eventContainerId || null, appointmentId: form.appointmentId || null,
      recurrence: { mode: editing ? 'none' : form.recurrenceMode, intervalWeeks: Number(form.intervalWeeks), weekdays: form.weekdays.map(Number), untilDate: form.untilDate || undefined },
    };
    try {
      if (editing) await apiPatch('/api/admin/scheduling', { action: 'update', shiftId: editing.id, version: editing.version, ...payload });
      else await apiPost('/api/admin/scheduling', { action: 'create', ...payload });
      setForm(empty()); setEditing(null); await load();
    } catch (error) { setState((current) => ({ ...current, error: error.message })); }
    finally { setSaving(false); }
  };
  const action = async (actionName, shiftId, nurseProfileId) => {
    try { await apiPost('/api/admin/scheduling', { action: actionName, shiftId, nurseProfileId }); await load(); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
  };
  const upcoming = useMemo(() => state.shifts.filter((row) => !['completed', 'cancelled'].includes(row.status)), [state.shifts]);
  return (
    <AdminShell title="Scheduling">
      <div className="space-y-5">
        <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">{editing ? 'Occurrence editor' : 'Workforce planning'}</p><h1 className="font-heading text-4xl uppercase">{editing ? 'Edit shift' : 'Create shifts'}</h1></div>{editing ? <button onClick={() => { setEditing(null); setForm(empty()); }} className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10" aria-label="Cancel editing"><X className="h-4 w-4" /></button> : null}</div>
          <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Shift title</span><input required className={FIELD} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Monday mobile coverage" /></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Date</span><input required type="date" className={FIELD} value={form.startDate} onChange={(e) => update('startDate', e.target.value)} /></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Status</span><select className={FIELD} value={form.status} onChange={(e) => update('status', e.target.value)}><option value="open">Open</option><option value="draft">Draft</option><option value="assigned">Assigned</option></select></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Start</span><input required type="time" className={FIELD} value={form.startTime} onChange={(e) => update('startTime', e.target.value)} /></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">End</span><input required type="time" className={FIELD} value={form.endTime} onChange={(e) => update('endTime', e.target.value)} /></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Role</span><input className={FIELD} value={form.roleRequired} onChange={(e) => update('roleRequired', e.target.value)} /></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Nurse slots</span><input min="1" max="100" type="number" className={FIELD} value={form.slotsRequired} onChange={(e) => update('slotsRequired', e.target.value)} /></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Location</span><input className={FIELD} value={form.locationName} onChange={(e) => update('locationName', e.target.value)} /></label>
            <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Service area</span><input className={FIELD} value={form.serviceArea} onChange={(e) => update('serviceArea', e.target.value)} /></label>
            <label className="grid gap-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Operational address</span><input className={FIELD} value={form.locationAddress} onChange={(e) => update('locationAddress', e.target.value)} /></label>
            <label className="grid gap-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Event</span><select className={FIELD} value={form.eventContainerId} onChange={(e) => update('eventContainerId', e.target.value)}><option value="">No linked event</option>{state.events.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="grid gap-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Acuity-backed appointment</span><select className={FIELD} value={form.appointmentId || ''} onChange={(e) => update('appointmentId', e.target.value)}><option value="">No linked appointment</option>{state.appointments.map((row) => <option key={row.id} value={row.id}>{row.order_number || row.id} · {row.protocol_key || 'visit'}{row.acuity_appointment_id ? ` · Acuity ${row.acuity_appointment_id}` : ''}</option>)}</select></label>
            {!editing ? <><label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Repeat</span><select className={FIELD} value={form.recurrenceMode} onChange={(e) => update('recurrenceMode', e.target.value)}><option value="none">Does not repeat</option><option value="weekly">Weekly</option><option value="weekdays">Weekdays</option><option value="biweekly">Every other week</option><option value="custom">Custom weekly</option></select></label>{form.recurrenceMode !== 'none' ? <label className="grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Repeat until</span><input required type="date" className={FIELD} value={form.untilDate} onChange={(e) => update('untilDate', e.target.value)} /></label> : <div />}{['weekly', 'biweekly', 'custom'].includes(form.recurrenceMode) ? <div className="flex items-end gap-1 lg:col-span-2">{WEEKDAYS.map(([value, label], index) => <button type="button" key={`${value}-${index}`} onClick={() => update('weekdays', form.weekdays.includes(value) ? form.weekdays.filter((day) => day !== value) : [...form.weekdays, value])} className={`h-11 w-11 rounded-full border text-xs font-bold ${form.weekdays.includes(value) ? 'bg-foreground text-background' : 'border-foreground/15'}`}>{label}</button>)}</div> : null}</> : null}
            <label className="grid gap-1 md:col-span-2 lg:col-span-4"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Operational instructions</span><textarea rows="3" className={`${FIELD} py-3`} value={form.instructions} onChange={(e) => update('instructions', e.target.value)} /></label>
            <div className="flex justify-end lg:col-span-4"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-6 text-xs font-bold uppercase tracking-[0.14em] text-background disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editing ? 'Save occurrence' : 'Create schedule'}</button></div>
          </form>
        </section>
        {state.error ? <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{state.error}</p> : null}
        <section>
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">{upcoming.length} active</p><h2 className="font-heading text-3xl uppercase">Shift instances</h2></div><button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button></div>
          <div className="mt-4 grid gap-3">{state.shifts.map((shift) => <article key={shift.id} className="rounded-2xl border border-foreground/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /><h3 className="font-semibold">{shift.title}</h3><span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass(shift.status)}`}>{shift.status}</span></div><p className="mt-1 text-sm text-foreground/55">{new Date(shift.starts_at).toLocaleString()} · {shift.location_name || 'Location pending'} · {shift.role_required}</p><p className="mt-1 text-xs text-foreground/45">{shift.assignments.filter((row) => ['assigned', 'claimed', 'completed'].includes(row.status)).length}/{shift.slots_required} assigned {shift.event ? `· ${shift.event.name}` : ''}{shift.appointment_id ? ' · Appointment linked' : ''}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => edit(shift)} className="min-h-9 rounded-full border border-foreground/10 px-3 text-[10px] font-bold uppercase"><Edit3 className="mr-1 inline h-3.5 w-3.5" />Edit</button>{!['completed', 'cancelled'].includes(shift.status) ? <><button onClick={() => action('broadcast', shift.id)} className="min-h-9 rounded-full border border-foreground/10 px-3 text-[10px] font-bold uppercase"><Megaphone className="mr-1 inline h-3.5 w-3.5" />Broadcast</button><button onClick={() => action('complete', shift.id)} className="min-h-9 rounded-full border border-foreground/10 px-3 text-[10px] font-bold uppercase">Complete</button><button onClick={() => action('cancel', shift.id)} className="min-h-9 rounded-full border border-red-500/20 px-3 text-[10px] font-bold uppercase text-red-700">Cancel</button></> : null}</div></div>{!['completed', 'cancelled'].includes(shift.status) ? <div className="mt-3 flex items-center gap-2"><Users className="h-4 w-4 text-foreground/45" /><select aria-label={`Assign nurse to ${shift.title}`} className={`${FIELD} max-w-xs`} defaultValue="" onChange={(e) => { if (e.target.value) action('assign', shift.id, e.target.value); e.target.value = ''; }}><option value="">Assign nurse…</option>{state.nurses.filter((nurse) => !shift.assignments.some((a) => a.nurse_profile_id === nurse.id && ['assigned', 'claimed', 'completed'].includes(a.status))).map((nurse) => <option key={nurse.id} value={nurse.id}>{nurse.full_name || nurse.email}</option>)}</select></div> : null}</article>)}{!state.loading && !state.shifts.length ? <p className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/45">No shifts yet.</p> : null}</div>
        </section>
      </div>
    </AdminShell>
  );
}
