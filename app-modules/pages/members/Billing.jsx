import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  ChevronLeft,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';
import MemberSectionNav from './MemberSectionNav.jsx';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const GOOD = 'hsl(140 30% 60%)';
const WARN = 'hsl(38 92% 72%)';
const BAD = 'hsl(0 70% 62%)';

function money(value) {
  if (value == null) return '$0.00';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function brandLabel(brand) {
  const b = String(brand || '').toLowerCase();
  if (b === 'visa') return 'Visa';
  if (b === 'mastercard') return 'Mastercard';
  if (b === 'amex' || b === 'american_express') return 'Amex';
  if (b === 'discover') return 'Discover';
  if (b === 'diners') return 'Diners';
  if (b === 'jcb') return 'JCB';
  if (b === 'unionpay') return 'UnionPay';
  return brand ? String(brand).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Card';
}

function statusTone(status) {
  if (status === 'paid') return { color: GOOD, label: 'Paid' };
  if (status === 'open') return { color: WARN, label: 'Open' };
  if (status === 'uncollectible') return { color: BAD, label: 'Uncollectible' };
  if (status === 'void') return { color: DIM, label: 'Void' };
  if (status === 'draft') return { color: DIM, label: 'Draft' };
  return { color: MUTED, label: status ? String(status).replace(/_/g, ' ') : 'Unknown' };
}

function StatusPill({ status }) {
  const tone = statusTone(status);
  return (
    <span
      className="inline-flex w-fit items-center rounded-full px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ color: tone.color, background: CARD_STRONG, border: `1px solid ${BORDER}` }}
    >
      {tone.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="h-16 animate-pulse rounded-2xl" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }} />
  );
}

export default function Billing() {
  useSeo({
    title: 'Billing — Avalon Vitality',
    description: 'Your Avalon Vitality receipts, payment methods, and upcoming charges.',
    path: '/members/billing',
    robots: 'noindex, nofollow',
  });

  const [state, setState] = useState({
    loading: true,
    error: '',
    invoices: [],
    paymentMethods: [],
    nextChargeIso: null,
    nextChargeAmountDollars: null,
  });
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState('');

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [inv, pm] = await Promise.all([
        apiGet('/api/me/invoices').catch((err) => { throw err; }),
        apiGet('/api/me/payment-methods').catch(() => ({ paymentMethods: [] })),
      ]);
      setState({
        loading: false,
        error: '',
        invoices: Array.isArray(inv?.invoices) ? inv.invoices : [],
        paymentMethods: Array.isArray(pm?.paymentMethods) ? pm.paymentMethods : [],
        nextChargeIso: inv?.nextChargeIso || null,
        nextChargeAmountDollars: inv?.nextChargeAmountDollars ?? null,
      });
    } catch {
      setState((current) => ({ ...current, loading: false, error: 'Could not load your billing details.' }));
    }
  }, []);

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);
  useEffect(() => { load(); }, [load]);

  const openBillingPortal = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    setPortalError('');
    try {
      const data = await apiPost('/api/me/billing-portal');
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setPortalBusy(false);
      setPortalError('Could not open the billing portal.');
    } catch (err) {
      setPortalBusy(false);
      const code = err?.body?.code || '';
      if (code === 'no_customer') {
        setPortalError('Make your first purchase to enable the billing portal.');
      } else {
        setPortalError(err?.body?.error || err?.message || 'Could not open the billing portal.');
      }
    }
  };

  const { loading, error, invoices, paymentMethods, nextChargeIso, nextChargeAmountDollars } = state;
  const hasNextCharge = nextChargeIso || nextChargeAmountDollars != null;

  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/members/dashboard" className="inline-flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} /> Dashboard
          </Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Member · Billing</p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-45"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
            aria-label="Refresh billing"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pt-5 md:px-6 md:pt-7">
        <MemberSectionNav />
      </div>

      <section className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Members · Receipts &amp; Payment</p>
        <h1 className="mt-1 font-heading text-5xl uppercase leading-none md:text-6xl">Billing</h1>
        <p className="mt-3 max-w-2xl font-body text-sm" style={{ color: MUTED }}>
          Your receipts, the card we keep on file, and what's coming up next. Card changes happen in the secure Stripe portal.
        </p>
        {error ? (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'hsl(0 70% 62% / 0.10)', border: '1px solid hsl(0 70% 62% / 0.30)' }}
            role="alert"
          >
            <p className="font-body text-sm" style={{ color: BAD }}>{error}</p>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60"
              style={{ background: TEXT, color: INVERT }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} /> Try again
            </button>
          </div>
        ) : null}
      </section>

      {/* Next charge + Payment methods */}
      <section className="mx-auto mt-6 grid w-full max-w-5xl gap-4 px-4 md:grid-cols-2 md:px-6">
        {/* Next charge */}
        <div className="rounded-[24px] p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="flex items-center gap-2 font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.8} /> Next charge
          </p>
          {loading ? (
            <div className="mt-4 h-12 w-2/3 animate-pulse rounded-xl" style={{ background: CARD_STRONG }} />
          ) : hasNextCharge ? (
            <>
              <h3 className="mt-3 font-heading text-5xl uppercase leading-none">
                {nextChargeAmountDollars != null ? money(nextChargeAmountDollars) : '—'}
              </h3>
              <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>
                {nextChargeIso ? fmtDate(nextChargeIso) : 'Date to be confirmed'}
              </p>
            </>
          ) : (
            <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>
              No upcoming charge scheduled. You'll only be billed when you book a visit or renew a plan.
            </p>
          )}
        </div>

        {/* Payment methods */}
        <div className="rounded-[24px] p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.8} /> Payment method
            </p>
          </div>

          {loading ? (
            <div className="mt-4 h-12 animate-pulse rounded-xl" style={{ background: CARD_STRONG }} />
          ) : paymentMethods.length ? (
            <div className="mt-3">
              {paymentMethods.map((pm, idx) => (
                <div
                  key={pm.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                  style={{ borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}` }}
                >
                  <span className="grid h-8 w-12 shrink-0 place-items-center rounded font-heading text-[11px] uppercase tracking-[0.10em]" style={{ background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}>
                    {brandLabel(pm.brand).slice(0, 4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>
                      {brandLabel(pm.brand)} ending {pm.last4 || '••••'}
                    </p>
                    {pm.expMonth && pm.expYear ? (
                      <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>
                        Expires {String(pm.expMonth).padStart(2, '0')} / {pm.expYear}
                      </p>
                    ) : null}
                  </div>
                  {pm.isDefault ? (
                    <span className="rounded-full px-2.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: CARD_STRONG, color: GOOD, border: '1px solid hsl(140 30% 60% / 0.30)' }}>
                      Default
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>No card on file.</p>
          )}

          <button
            type="button"
            onClick={openBillingPortal}
            disabled={portalBusy}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60"
            style={{ background: TEXT, color: INVERT }}
          >
            {portalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />}
            {portalBusy ? 'Opening' : 'Manage payment methods'}
          </button>
          {portalError ? (
            <p className="mt-3 font-body text-[12px]" style={{ color: BAD }}>{portalError}</p>
          ) : null}
        </div>
      </section>

      {/* Invoices / receipts */}
      <section className="mx-auto mt-4 w-full max-w-5xl px-4 md:px-6">
        <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <h2 className="flex items-center gap-2 font-heading text-2xl uppercase leading-none">
            <Receipt className="h-5 w-5" strokeWidth={1.8} style={{ color: MUTED }} /> Receipts
          </h2>

          {loading ? (
            <div className="mt-4 grid gap-2">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : invoices.length ? (
            <div className="mt-3">
              {invoices.map((inv, idx) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center gap-3 py-3.5"
                  style={{ borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>
                        {money(inv.amountPaidDollars > 0 ? inv.amountPaidDollars : inv.amountDueDollars)}
                      </p>
                      <StatusPill status={inv.status} />
                    </div>
                    <p className="mt-0.5 truncate font-body text-[11px]" style={{ color: MUTED }}>
                      {fmtDate(inv.created)}
                      {inv.number ? ` · ${inv.number}` : ''}
                      {inv.description ? ` · ${inv.description}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
                      >
                        View <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                      </a>
                    ) : null}
                    {inv.invoicePdf ? (
                      <a
                        href={inv.invoicePdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}
                        aria-label="Download PDF receipt"
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={2} /> PDF
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl px-4 py-8 text-center" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <FileText className="mx-auto h-6 w-6" strokeWidth={1.5} style={{ color: DIM }} />
              <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>No invoices yet.</p>
              <Link
                to="/book"
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ background: TEXT, color: INVERT }}
              >
                Book a visit
              </Link>
            </div>
          )}
        </div>
      </section>

      <MemberBottomNav />
    </main>
  );
}
