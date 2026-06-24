/**
 * Live Admin Bookings — /admin/bookings (Supabase mode)
 *
 * Reads real bookings from /api/admin/bookings (admin session) and lets an admin
 * collect each visit's remaining balance: charge the saved card off-session, or
 * copy a Stripe-hosted payment link to text the client. Backed by
 * /api/admin/collect-balance. Demo mode keeps the Acuity-based view.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calendar, Phone, Mail, CreditCard, Link2, Loader2, AlertCircle, CheckCircle2, MapPin, AlertTriangle, Sparkles, Trash2, Pencil, X, Save } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPost } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';

function money(value) {
  if (value == null) return '$0';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso) {
  if (!iso) return 'Date to be confirmed';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ISO → value for <input type="datetime-local"> in the admin's local time.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PAYMENT_LABEL = { paid_in_full: 'Paid', partial_payment: 'Partial', deposit_paid: 'Deposit paid', pending: 'Pending' };
const paymentLabel = (status) => PAYMENT_LABEL[status] || (status ? status.replace(/_/g, ' ') : 'Pending');

const APPOINTMENT_LABEL = {
  single: 'One-time',
  payment: 'One-time',
  event: 'Event',
  subscription: 'Subscription',
};

const PAYMENT_TYPE_LABEL = {
  one_time_deposit: '$50 upfront',
  event_half_upfront: '50% upfront',
  subscription_first_month: 'First month paid',
};

function titleize(value = '') {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatusPill({ status }) {
  const paid = status === 'paid_in_full';
  return (
    <span
      className="inline-flex min-h-[26px] items-center rounded-full px-2.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]"
      style={{
        color: paid ? 'hsl(150 60% 45%)' : MUTED,
        background: CARD_STRONG,
        border: `1px solid ${BORDER}`,
      }}
    >
      {paymentLabel(status)}
    </span>
  );
}

function ActionResult({ result }) {
  if (!result?.message) return null;
  const tone = result.tone || 'info';
  const color = tone === 'error' ? 'hsl(0 70% 62%)' : tone === 'success' ? 'hsl(150 60% 45%)' : MUTED;
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Link2;
  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-xl px-3 py-2" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
      <span className="flex items-center gap-2 font-body text-xs" style={{ color }}>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {result.message}
      </span>
      {result.link ? (
        <a href={result.link} target="_blank" rel="noopener noreferrer" className="truncate font-body text-[11px] underline" style={{ color: DIM }}>
          {result.link}
        </a>
      ) : null}
    </div>
  );
}

const FIELD_STYLE = {
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--foreground) / 0.16)',
};

function EditField({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[40px] rounded-xl px-3 font-body text-sm outline-none focus:ring-1"
        style={FIELD_STYLE}
      />
    </label>
  );
}

function EditForm({ booking, busy, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: booking.customerName === '—' ? '' : (booking.customerName || ''),
    email: booking.customerEmail || '',
    phone: booking.customerPhone || '',
    address: booking.address || '',
    service: booking.service || '',
    startsAt: toLocalInput(booking.startsAt),
  });
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="mt-3 rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
      <p className="mb-3 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Edit booking details</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <EditField label="Client name" value={form.name} onChange={set('name')} placeholder="Full name" />
        <EditField label="Email" type="email" value={form.email} onChange={set('email')} placeholder="name@email.com" />
        <EditField label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="(415) 555-0100" />
        <EditField label="Date & time" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />
        <EditField label="Service" value={form.service} onChange={set('service')} placeholder="Avalon Visit" />
        <EditField label="Address" value={form.address} onChange={set('address')} placeholder="Service address" />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-50"
          style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} /> Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(booking, form)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-50"
          style={{ background: TEXT, color: INVERT }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
          Save changes
        </button>
      </div>
    </div>
  );
}

function BookingRow({ booking, busy, retryBusy, deleteBusy, saveBusy, editing, result, onCharge, onLink, onRetryAcuity, onDelete, onEdit, onSave, onCancelEdit }) {
  const collectable = booking.balanceDue > 0 && booking.paymentStatus !== 'paid_in_full';
  const canPay = booking.hasStripeCustomer; // link + charge both need a Stripe customer
  const appointmentLabel = APPOINTMENT_LABEL[booking.appointmentType] || titleize(booking.appointmentType || 'One-time');
  const paymentTypeLabel = PAYMENT_TYPE_LABEL[booking.paymentType] || titleize(booking.paymentType || '');
  const needsScheduling = booking.reconciliationStatus === 'action_required' && !booking.acuityAppointmentId;

  return (
    <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-xl uppercase leading-none">{booking.customerName}</h3>
            <StatusPill status={booking.paymentStatus} />
            {needsScheduling ? (
              <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-2.5 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200">
                <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                Needs scheduling
              </span>
            ) : null}
            {booking.isMembership ? (
              <span className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Plan</span>
            ) : null}
            {booking.comped ? (
              <span className="inline-flex min-h-[26px] items-center rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-2.5 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                Comped{booking.discountCode ? ` · ${booking.discountCode}` : ''}
              </span>
            ) : null}
            {booking.creditRedeemed ? (
              <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-300/[0.08] px-2.5 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-sky-200">
                <Sparkles className="h-3 w-3" strokeWidth={2} />
                Credit · {booking.creditUnitsRedeemed || 1}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 truncate font-body text-sm" style={{ color: MUTED }}>{booking.service}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs" style={{ color: DIM }}>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" strokeWidth={1.7} />{fmtWhen(booking.startsAt)}</span>
            <span>{appointmentLabel}</span>
            {booking.customerEmail ? <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" strokeWidth={1.7} />{booking.customerEmail}</span> : null}
            {booking.customerPhone ? <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" strokeWidth={1.7} />{booking.customerPhone}</span> : null}
            {booking.address ? <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" strokeWidth={1.7} />{booking.address}</span> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl uppercase leading-none">{collectable ? money(booking.balanceDue) : money(0)}</p>
          <p className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Balance Due</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-3" style={{ borderColor: BORDER }}>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Visit Total</p>
          <p className="mt-1 font-body text-sm font-semibold">{money(booking.visitSubtotal || 0)}</p>
        </div>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Paid Upfront</p>
          <p className="mt-1 font-body text-sm font-semibold">{money(booking.depositAmount || 0)}</p>
        </div>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Payment Rule</p>
          <p className="mt-1 font-body text-sm font-semibold">{paymentTypeLabel || 'Standard'}</p>
        </div>
      </div>

      {(collectable || needsScheduling) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {needsScheduling ? (
            <button
              type="button"
              disabled={retryBusy}
              onClick={() => onRetryAcuity(booking)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-50"
              style={{ background: 'rgba(245,158,11,0.12)', color: 'hsl(38 92% 72%)', border: '1px solid rgba(245,158,11,0.28)' }}
            >
              {retryBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
              Retry Acuity
            </button>
          ) : null}
          {canPay ? (
            <>
              {booking.hasSavedCard ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCharge(booking)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-50"
                  style={{ background: TEXT, color: INVERT }}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <CreditCard className="h-3.5 w-3.5" strokeWidth={2} />}
                  Collect {money(booking.balanceDue)}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => onLink(booking)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-50"
                style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Link2 className="h-3.5 w-3.5" strokeWidth={2} />}
                Copy payment link
              </button>
            </>
          ) : collectable ? (
            <span className="font-body text-xs" style={{ color: DIM }}>No payment method on file — collect in person.</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3" style={{ borderColor: BORDER }}>
        <button
          type="button"
          disabled={saveBusy}
          onClick={() => (editing ? onCancelEdit() : onEdit(booking))}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 font-body text-[10px] font-bold uppercase tracking-[0.16em] transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ color: MUTED }}
        >
          {editing ? <X className="h-3.5 w-3.5" strokeWidth={2} /> : <Pencil className="h-3.5 w-3.5" strokeWidth={2} />}
          {editing ? 'Close' : 'Edit'}
        </button>
        <button
          type="button"
          disabled={deleteBusy}
          onClick={() => onDelete(booking)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 font-body text-[10px] font-bold uppercase tracking-[0.16em] transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ color: 'hsl(0 70% 62%)' }}
        >
          {deleteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
          Delete
        </button>
      </div>

      {editing ? <EditForm booking={booking} busy={saveBusy} onSave={onSave} onCancel={onCancelEdit} /> : null}

      <ActionResult result={result} />
    </div>
  );
}

export default function LiveAdminBookings() {
  const [state, setState] = useState({ loading: true, error: '', bookings: [] });
  const [actions, setActions] = useState({}); // id -> { busy, message, tone, link }
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await apiGet('/api/admin/bookings');
      setState({ loading: false, error: '', bookings: Array.isArray(data?.bookings) ? data.bookings : [] });
    } catch (err) {
      setState({ loading: false, error: 'Could not load bookings.', bookings: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = useCallback(async (booking, mode) => {
    setActions((m) => ({ ...m, [booking.id]: { busy: true } }));
    try {
      const res = await apiPost('/api/admin/collect-balance', { appointmentId: booking.id, mode });
      if (res.url) {
        let copied = false;
        try { await navigator.clipboard.writeText(res.url); copied = true; } catch { /* clipboard blocked → show link */ }
        const message = res.requiresAction
          ? `Card needs verification — ${copied ? 'copied' : 'use'} a payment link to send instead.`
          : `Payment link ${copied ? 'copied — text it to the client.' : 'ready (copy below).'}`;
        setActions((m) => ({ ...m, [booking.id]: { busy: false, tone: 'info', message, link: res.url } }));
      } else if (res.ok) {
        setActions((m) => ({ ...m, [booking.id]: { busy: false, tone: 'success', message: `Charged ${money(booking.balanceDue)} to the saved card.` } }));
        load();
      } else {
        setActions((m) => ({ ...m, [booking.id]: { busy: false, tone: 'error', message: 'Could not complete the charge.' } }));
      }
    } catch (err) {
      setActions((m) => ({ ...m, [booking.id]: { busy: false, tone: 'error', message: 'Action failed.' } }));
    }
  }, [load]);

  const retryAcuity = useCallback(async (booking) => {
    setActions((m) => ({ ...m, [booking.id]: { busyRetry: true } }));
    try {
      const res = await apiPost('/api/admin/bookings/retry-acuity', { appointmentId: booking.id });
      if (res.ok) {
        setActions((m) => ({ ...m, [booking.id]: { tone: 'success', message: `Acuity appointment created: ${res.acuityAppointmentId}` } }));
        load();
      } else {
        setActions((m) => ({ ...m, [booking.id]: { tone: 'error', message: 'Could not create the Acuity appointment.' } }));
      }
    } catch (err) {
      setActions((m) => ({ ...m, [booking.id]: { tone: 'error', message: 'Acuity retry failed.' } }));
    }
  }, [load]);

  const deleteBooking = useCallback(async (booking) => {
    if (!window.confirm(`Delete this booking${booking.customerName ? ` for ${booking.customerName}` : ''}? This permanently removes it and cannot be undone.`)) return;
    setActions((m) => ({ ...m, [booking.id]: { busyDelete: true } }));
    try {
      const res = await apiPost('/api/admin/bookings/delete', { appointmentId: booking.id });
      if (res?.ok) { load(); }
      else { setActions((m) => ({ ...m, [booking.id]: { busyDelete: false, tone: 'error', message: 'Could not delete this booking.' } })); }
    } catch (err) {
      setActions((m) => ({ ...m, [booking.id]: { busyDelete: false, tone: 'error', message: 'Delete failed.' } }));
    }
  }, [load]);

  const saveBooking = useCallback(async (booking, form) => {
    setActions((m) => ({ ...m, [booking.id]: { busySave: true } }));
    try {
      const res = await apiPost('/api/admin/bookings/update', {
        appointmentId: booking.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        service: form.service,
        // datetime-local is local time; convert to a real ISO instant so the
        // server stores the correct moment regardless of its timezone.
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
      });
      if (res?.ok) {
        setEditingId(null);
        setActions((m) => ({ ...m, [booking.id]: { busySave: false, tone: 'success', message: 'Booking details updated.' } }));
        load();
      } else {
        setActions((m) => ({ ...m, [booking.id]: { busySave: false, tone: 'error', message: 'Could not save changes.' } }));
      }
    } catch (err) {
      setActions((m) => ({ ...m, [booking.id]: { busySave: false, tone: 'error', message: 'Save failed.' } }));
    }
  }, [load]);

  const { loading, error, bookings } = state;
  const outstanding = bookings.filter((b) => b.balanceDue > 0 && b.paymentStatus !== 'paid_in_full');

  return (
    <AdminShell title="Live Bookings">
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-body text-sm" style={{ color: MUTED }}>
                {loading ? 'Loading…' : `${bookings.length} booking${bookings.length === 1 ? '' : 's'} · ${outstanding.length} with a balance due`}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-50"
              style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: 'hsl(0 70% 62%)' }}>
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="font-body text-sm">{error}</span>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {!loading && bookings.length === 0 && !error ? (
              <div className="rounded-2xl px-4 py-10 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-sm" style={{ color: MUTED }}>No bookings yet. New checkouts will appear here automatically.</p>
              </div>
            ) : null}
            {bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                busy={!!actions[booking.id]?.busy}
                retryBusy={!!actions[booking.id]?.busyRetry}
                result={actions[booking.id]}
                onCharge={(b) => runAction(b, 'charge')}
                onLink={(b) => runAction(b, 'link')}
                onRetryAcuity={retryAcuity}
                deleteBusy={!!actions[booking.id]?.busyDelete}
                onDelete={deleteBooking}
                editing={editingId === booking.id}
                saveBusy={!!actions[booking.id]?.busySave}
                onEdit={(b) => setEditingId(b.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={saveBooking}
              />
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
