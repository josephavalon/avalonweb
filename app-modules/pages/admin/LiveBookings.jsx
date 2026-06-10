/**
 * Live Admin Bookings — /admin/bookings (Supabase mode)
 *
 * Reads real bookings from /api/admin/bookings (admin session) and lets an admin
 * collect each visit's remaining balance: charge the saved card off-session, or
 * copy a Stripe-hosted payment link to text the client. Backed by
 * /api/admin/collect-balance. Demo mode keeps the Acuity-based view.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calendar, Phone, Mail, CreditCard, Link2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
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

const PAYMENT_LABEL = { paid_in_full: 'Paid', deposit_paid: 'Deposit paid', pending: 'Pending' };
const paymentLabel = (status) => PAYMENT_LABEL[status] || (status ? status.replace(/_/g, ' ') : 'Pending');

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

function BookingRow({ booking, busy, result, onCharge, onLink }) {
  const collectable = booking.balanceDue > 0 && booking.paymentStatus !== 'paid_in_full';
  const canPay = booking.hasStripeCustomer; // link + charge both need a Stripe customer

  return (
    <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-xl uppercase leading-none">{booking.customerName}</h3>
            <StatusPill status={booking.paymentStatus} />
            {booking.isMembership ? (
              <span className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Plan</span>
            ) : null}
          </div>
          <p className="mt-1.5 truncate font-body text-sm" style={{ color: MUTED }}>{booking.service}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs" style={{ color: DIM }}>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" strokeWidth={1.7} />{fmtWhen(booking.startsAt)}</span>
            {booking.customerEmail ? <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" strokeWidth={1.7} />{booking.customerEmail}</span> : null}
            {booking.customerPhone ? <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" strokeWidth={1.7} />{booking.customerPhone}</span> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl uppercase leading-none">{collectable ? money(booking.balanceDue) : money(0)}</p>
          <p className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Balance Due</p>
        </div>
      </div>

      {collectable ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          ) : (
            <span className="font-body text-xs" style={{ color: DIM }}>No payment method on file — collect in person.</span>
          )}
        </div>
      ) : null}

      <ActionResult result={result} />
    </div>
  );
}

export default function LiveAdminBookings() {
  const [state, setState] = useState({ loading: true, error: '', bookings: [] });
  const [actions, setActions] = useState({}); // id -> { busy, message, tone, link }

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await apiGet('/api/admin/bookings');
      setState({ loading: false, error: '', bookings: Array.isArray(data?.bookings) ? data.bookings : [] });
    } catch (err) {
      setState({ loading: false, error: err.body?.error || err.message || 'Could not load bookings.', bookings: [] });
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
        setActions((m) => ({ ...m, [booking.id]: { busy: false, tone: 'error', message: res.error || 'Could not complete the charge.' } }));
      }
    } catch (err) {
      setActions((m) => ({ ...m, [booking.id]: { busy: false, tone: 'error', message: err.body?.error || err.message || 'Action failed.' } }));
    }
  }, [load]);

  const { loading, error, bookings } = state;
  const outstanding = bookings.filter((b) => b.balanceDue > 0 && b.paymentStatus !== 'paid_in_full');

  return (
    <AdminLayout>
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Admin</p>
              <h1 className="mt-2 font-heading text-5xl uppercase leading-[0.9] md:text-6xl">Bookings</h1>
              <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>
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
                result={actions[booking.id]}
                onCharge={(b) => runAction(b, 'charge')}
                onLink={(b) => runAction(b, 'link')}
              />
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
