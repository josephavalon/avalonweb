// Admin → Reconciliation (/admin/reconciliation). Admin/staff.
// Three tabs surface the operational "silent failure" signals:
//   1. Renewals — active plan subs whose period ended but didn't credit
//   2. Acuity sync — paid checkouts with no Acuity appointment id
//   3. Payment failures — open Stripe payment_failed cases needing recovery
//
// READ + ACK ONLY. Nothing here retries a charge, books an appointment, or
// issues a refund. "Mark resolved" writes a `reconciliation_marked_resolved`
// audit event so the row drops from the default view — humans then act in
// Stripe / Acuity / the customer's mailbox.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarX2, CheckCircle2, ExternalLink, Loader2, RefreshCw,
  ShieldAlert, Wallet, X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/apiClient';

const TABS = [
  { key: 'renewals', label: 'Plan renewals', icon: RefreshCw, hint: 'Period ended, no credit recorded' },
  { key: 'acuity_sync', label: 'Acuity sync', icon: CalendarX2, hint: 'Paid but no appointment id' },
  { key: 'payment_failures', label: 'Payment failures', icon: ShieldAlert, hint: 'Open Stripe recovery cases' },
];

const FIELD = 'min-h-[46px] w-full rounded-2xl border border-foreground/10 bg-background/72 px-4 font-body text-base text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45';

function formatMoney(cents) {
  const n = Number(cents || 0) / 100;
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}

function formatDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString(); } catch { return String(value); }
}

function shortDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
}

function Banner({ kind, children, onClose }) {
  if (!children) return null;
  const tone = kind === 'error'
    ? 'border-red-500/30 bg-red-500/10 text-red-200'
    : kind === 'warn'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 font-body text-sm ${tone}`}>
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function CountPill({ value, dim }) {
  return (
    <span className={`ml-1.5 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 font-body text-[11px] font-semibold ${
      dim
        ? 'bg-foreground/[0.08] text-foreground/55'
        : value > 0 ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/15 text-emerald-200'
    }`}>
      {value}
    </span>
  );
}

function TabBar({ value, onChange, counts }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.key === value;
        const count = counts?.[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 truncate rounded-full px-3 py-2 text-center font-body text-[12px] font-semibold transition-colors ${
              active ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{tab.label}</span>
            {typeof count === 'number' && <CountPill value={count} dim={active} />}
          </button>
        );
      })}
    </div>
  );
}

function AgeBadge({ days }) {
  if (days == null) return null;
  const tone = days >= 14
    ? 'bg-red-500/15 text-red-200 border-red-500/30'
    : days >= 3 ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
      : 'bg-foreground/[0.08] text-foreground/65 border-foreground/15';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-body text-[11px] font-semibold ${tone}`}>
      {days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`}
    </span>
  );
}

function ResolvedPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-body text-[11px] font-semibold text-emerald-200">
      <CheckCircle2 className="h-3 w-3" /> Acknowledged
    </span>
  );
}

function EmptyState({ kind }) {
  const copy = {
    renewals: 'All active plans renewed on time.',
    acuity_sync: 'Every paid checkout has an Acuity appointment.',
    payment_failures: 'No unresolved Stripe payment failures.',
  };
  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-emerald-300" />
      <p className="font-body text-sm text-foreground/65">{copy[kind] || 'Nothing to reconcile right now.'}</p>
    </div>
  );
}

// ── Row renderers (one per kind) ─────────────────────────────────────────────
function RenewalRow({ issue, onResolve }) {
  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-base font-semibold text-foreground">
            {issue.memberName || issue.memberEmail || issue.stripeCustomerId || 'Unknown member'}
          </p>
          {issue.memberEmail && (
            <p className="truncate font-body text-[12px] text-foreground/45">{issue.memberEmail}</p>
          )}
          <p className="mt-1 font-body text-[12px] text-foreground/55">
            {issue.planName} · {formatMoney(issue.planMonthlyCents)}/mo · {issue.stripeSubscriptionId}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AgeBadge days={issue.daysOverdue} />
          {issue.resolved && <ResolvedPill />}
        </div>
      </div>
      <div className="my-4 border-t border-foreground/[0.08]" />
      <div className="grid gap-2 font-body text-[12px] text-foreground/55 md:grid-cols-3">
        <div>
          <p className="text-foreground/35">Period ended</p>
          <p className="text-foreground/80">{shortDate(issue.currentPeriodEnd)}</p>
        </div>
        <div>
          <p className="text-foreground/35">Last successful renewal</p>
          <p className="text-foreground/80">{shortDate(issue.lastSuccessfulRenewalAt)}</p>
        </div>
        <div>
          <p className="text-foreground/35">Stripe customer</p>
          <p className="truncate text-foreground/80">{issue.stripeCustomerId || '—'}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {issue.stripeSubscriptionId && (
          <a
            href={`https://dashboard.stripe.com/subscriptions/${issue.stripeSubscriptionId}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-body text-[12px] font-semibold text-foreground/65 hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in Stripe
          </a>
        )}
        {!issue.resolved && (
          <Button variant="outline" size="sm" onClick={() => onResolve(issue)} className="gap-1.5 border-foreground/20">
            <CheckCircle2 className="h-4 w-4" /> Mark resolved
          </Button>
        )}
      </div>
    </div>
  );
}

function AcuitySyncRow({ issue, onResolve }) {
  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-base font-semibold text-foreground">
            {issue.memberName || issue.memberEmail || 'Unknown member'}
          </p>
          {issue.memberEmail && (
            <p className="truncate font-body text-[12px] text-foreground/45">{issue.memberEmail}</p>
          )}
          <p className="mt-1 font-body text-[12px] text-foreground/55">
            {issue.primaryService} · paid {formatMoney(issue.amountCents)} · {issue.paymentStatus}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AgeBadge days={issue.ageDays} />
          {issue.resolved && <ResolvedPill />}
        </div>
      </div>
      <div className="my-4 border-t border-foreground/[0.08]" />
      <div className="grid gap-2 font-body text-[12px] text-foreground/55 md:grid-cols-3">
        <div>
          <p className="text-foreground/35">Created</p>
          <p className="text-foreground/80">{formatDate(issue.createdAt)}</p>
        </div>
        <div>
          <p className="text-foreground/35">Deposit paid</p>
          <p className="text-foreground/80">{formatDate(issue.depositPaidAt)}</p>
        </div>
        <div>
          <p className="text-foreground/35">Stripe session</p>
          <p className="truncate text-foreground/80">{issue.stripeCheckoutSessionId || '—'}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {issue.stripeCheckoutSessionId && (
          <a
            href={`https://dashboard.stripe.com/payments/${issue.stripeCheckoutSessionId}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-body text-[12px] font-semibold text-foreground/65 hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Stripe
          </a>
        )}
        <a
          href={`/admin/bookings`}
          className="inline-flex items-center gap-1.5 font-body text-[12px] font-semibold text-foreground/65 hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Booking
        </a>
        {!issue.resolved && (
          <Button variant="outline" size="sm" onClick={() => onResolve(issue)} className="gap-1.5 border-foreground/20">
            <CheckCircle2 className="h-4 w-4" /> Mark resolved
          </Button>
        )}
      </div>
    </div>
  );
}

function PaymentFailureRow({ issue, onResolve }) {
  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-base font-semibold text-foreground">
            {issue.planName || 'Plan recurring charge'} · {formatMoney(issue.amountDueCents)}
          </p>
          <p className="mt-1 truncate font-body text-[12px] text-foreground/55">
            Invoice {issue.stripeInvoiceId || '—'} · attempt {issue.attemptCount || '—'}
          </p>
          {issue.errorCode && (
            <p className="mt-1 font-body text-[12px] text-amber-200/80">{issue.errorCode}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <AgeBadge days={issue.ageDays} />
          {issue.resolved && <ResolvedPill />}
        </div>
      </div>
      <div className="my-4 border-t border-foreground/[0.08]" />
      <div className="grid gap-2 font-body text-[12px] text-foreground/55 md:grid-cols-3">
        <div>
          <p className="text-foreground/35">Opened</p>
          <p className="text-foreground/80">{formatDate(issue.createdAt)}</p>
        </div>
        <div>
          <p className="text-foreground/35">Next auto-attempt</p>
          <p className="text-foreground/80">{formatDate(issue.nextPaymentAttempt)}</p>
        </div>
        <div>
          <p className="text-foreground/35">Stripe customer</p>
          <p className="truncate text-foreground/80">{issue.stripeCustomerId || '—'}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {issue.stripeInvoiceId && (
          <a
            href={`https://dashboard.stripe.com/invoices/${issue.stripeInvoiceId}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-body text-[12px] font-semibold text-foreground/65 hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open invoice
          </a>
        )}
        {issue.stripeSubscriptionId && (
          <a
            href={`https://dashboard.stripe.com/subscriptions/${issue.stripeSubscriptionId}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-body text-[12px] font-semibold text-foreground/65 hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Subscription
          </a>
        )}
        {!issue.resolved && (
          <Button variant="outline" size="sm" onClick={() => onResolve(issue)} className="gap-1.5 border-foreground/20">
            <CheckCircle2 className="h-4 w-4" /> Mark resolved
          </Button>
        )}
      </div>
    </div>
  );
}

function IssueList({ kind, issues, onResolve }) {
  if (!issues?.length) return <EmptyState kind={kind} />;
  return (
    <div className="grid gap-3">
      {issues.map((issue) => {
        const key = `${kind}:${issue.entityId}`;
        if (kind === 'renewals') return <RenewalRow key={key} issue={issue} onResolve={onResolve} />;
        if (kind === 'acuity_sync') return <AcuitySyncRow key={key} issue={issue} onResolve={onResolve} />;
        if (kind === 'payment_failures') return <PaymentFailureRow key={key} issue={issue} onResolve={onResolve} />;
        return null;
      })}
    </div>
  );
}

function ResolveDialog({ issue, busy, onCancel, onConfirm }) {
  const [note, setNote] = useState('');
  useEffect(() => { setNote(''); }, [issue?.entityId]);
  if (!issue) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase tracking-[0.04em]">Mark resolved</DialogTitle>
          <DialogDescription>
            This records an audit-event acknowledgement. It does <strong>not</strong> retry a charge,
            create an Acuity appointment, or refund anything. Resolve the underlying issue in Stripe
            or Acuity first, then acknowledge here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-3 font-body text-[12px] text-foreground/70">
            <p className="font-semibold text-foreground">{issue.memberName || issue.memberEmail || issue.planName || issue.entityId}</p>
            <p className="mt-1 truncate text-foreground/55">{issue.entityId}</p>
          </div>
          <div>
            <label htmlFor="recon-note" className={LABEL}>Note (optional, stored in the audit trail)</label>
            <textarea
              id="recon-note"
              className={`${FIELD} min-h-[88px] py-3`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Customer updated card in Stripe; invoice retried OK."
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={() => onConfirm(note)} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Acknowledge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Reconciliation() {
  const [tab, setTab] = useState('renewals');
  const [showResolved, setShowResolved] = useState(false);

  // Per-tab data + state. Keeping it in a single object means a refetch of one
  // tab doesn't wipe another tab's count badge.
  const [byKind, setByKind] = useState({
    renewals: { issues: [], loading: false, error: null, meta: null },
    acuity_sync: { issues: [], loading: false, error: null, meta: null },
    payment_failures: { issues: [], loading: false, error: null, meta: null },
  });

  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const setKindState = useCallback((kind, patch) => {
    setByKind((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  }, []);

  const loadKind = useCallback(async (kind, opts = {}) => {
    const wantResolved = opts.showResolved ?? showResolved;
    setKindState(kind, { loading: true, error: null });
    try {
      const data = await apiGet(`/api/admin/reconciliation?kind=${encodeURIComponent(kind)}${wantResolved ? '&showResolved=1' : ''}`);
      setKindState(kind, {
        issues: data?.issues || [],
        meta: {
          configured: data?.configured,
          reason: data?.reason,
          tableMissing: data?.tableMissing,
        },
        loading: false,
      });
    } catch (err) {
      setKindState(kind, { loading: false, error: err?.message || 'Could not load.' });
    }
  }, [setKindState, showResolved]);

  // Initial load — every tab so the count badges are accurate.
  useEffect(() => {
    loadKind('renewals');
    loadKind('acuity_sync');
    loadKind('payment_failures');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch all tabs when the resolved toggle changes — counts have to match.
  useEffect(() => {
    loadKind('renewals', { showResolved });
    loadKind('acuity_sync', { showResolved });
    loadKind('payment_failures', { showResolved });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResolved]);

  const counts = useMemo(() => ({
    renewals: (byKind.renewals.issues || []).filter((i) => !i.resolved).length,
    acuity_sync: (byKind.acuity_sync.issues || []).filter((i) => !i.resolved).length,
    payment_failures: (byKind.payment_failures.issues || []).filter((i) => !i.resolved).length,
  }), [byKind]);

  const active = byKind[tab];

  const handleResolve = useCallback((issue) => setResolveTarget(issue), []);

  const confirmResolve = useCallback(async (note) => {
    if (!resolveTarget) return;
    setResolveBusy(true);
    try {
      await apiPost('/api/admin/reconciliation', {
        kind: tab,
        entityId: resolveTarget.entityId,
        note,
      });
      setNotice('Acknowledged. Row will drop from the open list.');
      setResolveTarget(null);
      await loadKind(tab, { showResolved });
    } catch (err) {
      setNotice(null);
      setKindState(tab, { error: err?.message || 'Could not record acknowledgement.' });
    } finally {
      setResolveBusy(false);
    }
  }, [resolveTarget, tab, loadKind, showResolved, setKindState]);

  const actions = (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 font-body text-[12px] text-foreground/60">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
          className="h-4 w-4 rounded border-foreground/30 bg-background/60"
        />
        Show acknowledged
      </label>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-foreground/20"
        onClick={() => loadKind(tab, { showResolved })}
        disabled={active.loading}
      >
        {active.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Refresh
      </Button>
    </div>
  );

  return (
    <AdminShell title="Reconciliation">
      <PageShell
        embedded
        subtitle="Silent-failure signals across plan renewals, Acuity fulfillment, and Stripe payment recovery. Read-only acknowledgement — fix the underlying issue in Stripe or Acuity first, then mark resolved."
        action={actions}
      >
        <Banner kind="warn">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This dashboard <strong>does not auto-fix anything</strong>. It surfaces issues so a human can
              recover the payment, create the missing appointment, or refund the customer in the correct
              tool. "Mark resolved" only writes an audit-event acknowledgement.
            </span>
          </span>
        </Banner>
        <Banner kind="success" onClose={() => setNotice(null)}>{notice}</Banner>
        <Banner kind="error" onClose={() => setKindState(tab, { error: null })}>{active.error}</Banner>

        <TabBar value={tab} onChange={setTab} counts={counts} />

        <p className="mb-3 font-body text-[12px] text-foreground/45">
          {TABS.find((t) => t.key === tab)?.hint}
        </p>

        {tab === 'renewals' && active.meta?.configured === false && (
          <Banner kind="warn">
            Stripe is not configured in this environment ({active.meta?.reason || 'stripe_not_configured'}).
            Plan renewals can't be checked.
          </Banner>
        )}
        {active.meta?.tableMissing && (
          <Banner kind="warn">
            The backing table for this view isn't migrated yet. Run the corresponding migration to populate.
          </Banner>
        )}

        {active.loading && !active.issues?.length ? (
          <div className="flex items-center gap-2 py-12 text-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <IssueList kind={tab} issues={active.issues || []} onResolve={handleResolve} />
        )}
      </PageShell>

      {resolveTarget && (
        <ResolveDialog
          issue={resolveTarget}
          busy={resolveBusy}
          onCancel={() => setResolveTarget(null)}
          onConfirm={confirmResolve}
        />
      )}
    </AdminShell>
  );
}

// Re-export so Wallet/lucide tree-shaking doesn't complain about unused import
// when the linter is strict; keeps a placeholder for future "next payment due"
// surfacing on the renewals row.
// eslint-disable-next-line no-unused-vars
const _walletReserved = Wallet;
