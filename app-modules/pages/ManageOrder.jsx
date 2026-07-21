import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, Package, Receipt } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const money = (cents) => (cents == null ? null : `$${Math.round(Number(cents) / 100).toLocaleString()}`);

function prettyStatus(s) {
  const map = { pending: 'Pending', confirmed: 'Confirmed', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };
  return map[String(s || '').toLowerCase()] || (s ? String(s) : 'Pending');
}
function prettyDate(iso) {
  if (!iso) return 'To be scheduled';
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return String(iso); }
}

export default function ManageOrder() {
  useSeo({
    title: 'Manage Your Order — Avalon Vitality',
    description: 'Look up your Avalon booking with the order number from your confirmation text.',
    path: '/order',
    robots: 'noindex, nofollow',
  });

  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(() => (searchParams.get('ref') || '').toUpperCase());
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  const lookup = async (event) => {
    event?.preventDefault();
    setError('');
    setOrder(null);
    const code = orderNumber.trim().toUpperCase();
    if (!/^AV-[0-9A-Z]{6}$/.test(code)) { setError('Enter a valid order number, like AV-7K4M2Q.'); return; }
    if (!email.trim() || !phone.trim()) { setError('Enter both the email and phone on your booking.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/order-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: code, email: email.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not find that order.'); return; }
      setOrder(data);
    } catch {
      setError('Something went wrong. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const balance = order ? money(order.balanceDueCents) : null;
  const hasBalance = order && Number(order.balanceDueCents) > 0;

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />
      <main className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col justify-center px-4 pb-16 pt-[6.5rem] md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.05] text-foreground/80">
              <Package className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <div>
              <h1 className="font-heading text-[2.5rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[3rem]">Your order</h1>
              <p className="mt-1 font-body text-sm font-semibold text-foreground/56">Use the order number from your confirmation text.</p>
            </div>
          </div>

          <form onSubmit={lookup} className="av-glass-card rounded-[1.3rem] border bg-background/82 p-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="order-number" className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58">Order number</label>
                <input
                  id="order-number"
                  value={orderNumber}
                  onChange={(e) => { setOrderNumber(e.target.value.toUpperCase()); setError(''); }}
                  placeholder="AV-7K4M2Q"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-[54px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-4 font-body text-base font-bold uppercase tracking-[0.06em] text-foreground outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/42 focus:bg-foreground/[0.07]"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="order-email" className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58">Email</label>
                <input
                  id="order-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@email.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-[54px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-4 font-body text-base font-semibold text-foreground outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/42 focus:bg-foreground/[0.07]"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="order-phone" className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58">Phone</label>
                <input
                  id="order-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(''); }}
                  placeholder="(415) 555-0199"
                  autoComplete="tel"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-[54px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-4 font-body text-base font-semibold text-foreground outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/42 focus:bg-foreground/[0.07]"
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-400/22 bg-red-500/[0.08] px-3.5 py-2.5 text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <p className="font-body text-[13px] font-medium leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99] disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? <span className="h-4 w-4 rounded-full border-2 border-background/25 border-t-background animate-spin" /> : <>Find my order <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          {order && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mt-4 overflow-hidden rounded-[1.3rem] border border-foreground/12 bg-background/82 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-foreground/10 px-5 py-4">
                <div>
                  <p className="font-body text-[10px] font-black uppercase tracking-[0.18em] text-foreground/48">Order</p>
                  <p className="font-heading text-[1.6rem] uppercase leading-none tracking-normal text-foreground">{order.orderNumber}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/16 bg-foreground/[0.06] px-3 py-1.5 font-body text-[11px] font-black uppercase tracking-[0.08em] text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} /> {prettyStatus(order.status)}
                </span>
              </div>

              <dl className="grid gap-3 px-5 py-4 font-body text-sm">
                {order.protocol && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 font-bold text-foreground/60"><Package className="h-4 w-4" strokeWidth={2} /> Therapy</dt>
                    <dd className="font-black uppercase text-foreground">{order.protocol}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 font-bold text-foreground/60"><CalendarClock className="h-4 w-4" strokeWidth={2} /> Visit</dt>
                  <dd className="text-right font-black text-foreground">{prettyDate(order.startsAt)}</dd>
                </div>
                {balance != null && (
                  <div className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-3">
                    <dt className="flex items-center gap-2 font-bold text-foreground/60"><Receipt className="h-4 w-4" strokeWidth={2} /> Balance due</dt>
                    <dd className="font-black text-foreground">{hasBalance ? balance : 'Paid in full'}</dd>
                  </div>
                )}
              </dl>

              <div className="grid gap-2.5 border-t border-foreground/10 px-5 py-4 sm:grid-cols-2">
                {hasBalance ? (
                  <a
                    href={`mailto:hello@avalonvitality.co?subject=${encodeURIComponent(`Balance for order ${order.orderNumber}`)}`}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-xs font-black uppercase tracking-[0.08em] text-background transition-opacity hover:opacity-90"
                  >
                    Pay {balance} balance
                  </a>
                ) : (
                  <Link to="/book" className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-xs font-black uppercase tracking-[0.08em] text-background transition-opacity hover:opacity-90">
                    Book another visit
                  </Link>
                )}
                <a
                  href={`mailto:hello@avalonvitality.co?subject=${encodeURIComponent(`Reschedule order ${order.orderNumber}`)}`}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-foreground/16 bg-background/50 px-4 font-body text-xs font-black uppercase tracking-[0.06em] text-foreground transition-colors hover:border-foreground/30"
                >
                  Reschedule
                </a>
              </div>
            </motion.div>
          )}

          <p className="mt-5 text-center font-body text-[12px] font-semibold text-foreground/44">
            Can’t find your order? <a href="mailto:hello@avalonvitality.co" className="text-foreground/70 underline-offset-2 hover:underline">Email us</a> and we’ll sort it out.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
