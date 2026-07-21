// Admin → Refunds (/admin/refunds). Admin/staff.
// Action members' self-serve refund requests (filed via /api/me/refund-request).
// Cards show member + appointment + amount paid + reason. Approve issues a real
// Stripe refund (full amount paid, or a partial via the optional cents field);
// Deny records the rejection with a note. Live data via /api/admin/refunds
// (GET list, POST { id, action }).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Loader2, Receipt, ShieldCheck, ThumbsDown, X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/apiClient';

const FIELD = 'min-h-[46px] w-full rounded-2xl border border-foreground/10 bg-background/72 px-4 font-body text-base text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45';

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
];

function formatMoney(cents, currency = 'usd') {
  const n = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
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
        <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    requested: { label: 'Open', color: 'hsl(38 92% 55%)', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' },
    approved:  { label: 'Approved', color: 'hsl(152 60% 45%)', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)' },
    denied:    { label: 'Denied', color: 'hsl(0 70% 60%)',     bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)' },
  };
  const s = map[status] || map.requested;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {s.label}
    </span>
  );
}

function TabBar({ value, onChange }) {
  return (
    <div className="mb-5 flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
      {TABS.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex-1 rounded-full px-3 py-2 text-center font-body text-[12px] font-semibold transition-colors ${
              active ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function RequestCard({ request, onAction, busyId }) {
  const a = request.appointment;
  const m = request.member || {};
  const paid = a?.paid_cents ?? 0;
  const refundable = a?.can_refund_via_stripe;
  const isBusy = busyId === request.id;
  const isOpen = request.status === 'requested';

  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-foreground/55" strokeWidth={1.8} />
            <h3 className="font-heading text-xl uppercase leading-none tracking-[0.04em] text-foreground">
              {m.name || m.email || 'Unknown member'}
            </h3>
          </div>
          {m.email && (
            <p className="mt-1.5 truncate font-body text-[12px] text-foreground/45">{m.email}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={request.status} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-3">
        <div>
          <div className={LABEL}>Visit</div>
          <div className="font-body text-sm text-foreground/80">
            {a?.starts_at ? formatDate(a.starts_at) : '—'}
          </div>
          {a?.protocol_key && (
            <div className="font-body text-[11px] text-foreground/45">{a.protocol_key}</div>
          )}
        </div>
        <div>
          <div className={LABEL}>Amount paid</div>
          <div className="font-body text-sm text-foreground">{formatMoney(paid, a?.currency)}</div>
          {a && (
            <div className="font-body text-[11px] text-foreground/45">
              {a.payment_status || '—'}
            </div>
          )}
        </div>
        <div>
          <div className={LABEL}>Filed</div>
          <div className="font-body text-sm text-foreground/80">{formatDate(request.created_at)}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className={LABEL}>Member's reason</div>
        <p className="whitespace-pre-wrap rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-3 font-body text-sm text-foreground/80">
          {request.reason || '—'}
        </p>
      </div>

      {request.status === 'approved' && (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 font-body text-[12px] text-emerald-200/90">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          Refunded {formatMoney(request.refund_amount_cents ?? paid, a?.currency)}
          {request.refund_id && <> · Stripe <code className="text-emerald-100/80">{request.refund_id}</code></>}
          {request.resolved_at && <> · {formatDate(request.resolved_at)}</>}
        </div>
      )}
      {request.status === 'denied' && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 font-body text-[12px] text-red-200/90">
          <ThumbsDown className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          Denied{request.resolved_at && <> · {formatDate(request.resolved_at)}</>}
          {request.note && <div className="mt-1 text-red-200/75">Staff note: {request.note}</div>}
        </div>
      )}

      {isOpen && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="font-body text-[11px] text-foreground/40">
            {refundable
              ? <>Approve will refund <strong>{formatMoney(paid, a?.currency)}</strong> via Stripe.</>
              : <span className="text-amber-300/80"><AlertTriangle className="mr-1 inline h-3 w-3 align-[-2px]" /> No Stripe payment intent on file — refund must be issued in Stripe directly, then Deny here.</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-red-300 hover:text-red-200"
              disabled={isBusy}
              onClick={() => onAction(request, 'deny')}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
              Deny
            </Button>
            <Button
              className="gap-2"
              disabled={isBusy}
              onClick={() => onAction(request, 'approve')}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Approve & refund
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ open, action, request, onClose, onConfirm, busy }) {
  const [note, setNote] = useState('');
  const [cents, setCents] = useState('');

  useEffect(() => {
    if (open) { setNote(''); setCents(''); }
  }, [open, request?.id]);

  if (!open || !request) return null;
  const isApprove = action === 'approve';
  const a = request.appointment;
  const paid = a?.paid_cents ?? 0;
  const canStripe = a?.can_refund_via_stripe;

  const submit = () => {
    const payload = { id: request.id, action };
    if (note.trim()) payload.note = note.trim();
    if (isApprove && cents.trim()) payload.cents = Math.round(Number(cents) * 100);
    onConfirm(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase tracking-[0.04em]">
            {isApprove ? 'Approve refund' : 'Deny request'}
          </DialogTitle>
          <DialogDescription>
            {request.member?.email || 'Member'} · {formatMoney(paid, a?.currency)} paid · visit {a?.starts_at ? formatDate(a.starts_at) : '—'}
          </DialogDescription>
        </DialogHeader>

        {isApprove ? (
          <div className="space-y-4">
            {!canStripe && (
              <Banner kind="warn">
                No Stripe payment intent is on file for this appointment. Approve will fail — refund in Stripe manually, then use Deny to close this request with a note.
              </Banner>
            )}
            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-3 font-body text-sm text-foreground/80">
              This will charge a real Stripe refund of <strong className="text-foreground">{formatMoney(cents.trim() ? Math.round(Number(cents) * 100) : paid, a?.currency)}</strong> against the original payment. Idempotent — clicking twice will not double-refund.
            </div>
            <div>
              <label className={LABEL}>Partial refund amount (USD, optional)</label>
              <input
                className={FIELD}
                inputMode="decimal"
                placeholder={`Leave empty to refund full ${formatMoney(paid, a?.currency)}`}
                value={cents}
                onChange={(e) => setCents(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
            <div>
              <label className={LABEL}>Internal note (optional)</label>
              <textarea
                className={`${FIELD} min-h-[80px] py-3`}
                placeholder="Why approved — for the audit trail."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-3 font-body text-sm text-foreground/80">
              The member will see this request as denied. No money moves.
            </div>
            <div>
              <label className={LABEL}>Reason for denial (recommended)</label>
              <textarea
                className={`${FIELD} min-h-[100px] py-3`}
                placeholder="Brief explanation for the audit log."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            type="button"
            onClick={submit}
            disabled={busy}
            className={`gap-2 ${isApprove ? '' : 'bg-red-500/90 hover:bg-red-500 text-white'}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isApprove ? <ShieldCheck className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />)}
            {isApprove ? 'Approve & refund' : 'Deny request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Refunds() {
  const [tab, setTab] = useState('open');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, action: null, request: null });
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async (which = tab) => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet(`/api/admin/refunds?status=${encodeURIComponent(which)}`);
      setRequests(data?.requests || []);
      setTableMissing(Boolean(data?.tableMissing));
    } catch (err) {
      setError(err?.message || 'Could not load refund requests.');
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(tab); }, [load, tab]);

  const onAction = (request, action) => {
    setConfirm({ open: true, action, request });
  };

  const submitAction = async (payload) => {
    setBusyId(payload.id);
    try {
      const res = await apiPost('/api/admin/refunds', payload);
      const isApprove = payload.action === 'approve';
      if (res?.already) {
        setNotice(isApprove ? 'Already approved — Stripe refund was already issued.' : 'Already denied.');
      } else if (isApprove) {
        const amt = res?.refundAmountCents != null
          ? formatMoney(res.refundAmountCents)
          : '';
        setNotice(`Refund issued${amt ? ` for ${amt}` : ''}. Stripe id: ${res?.refundId || '—'}.`);
      } else {
        setNotice('Request denied.');
      }
      setConfirm({ open: false, action: null, request: null });
      await load(tab);
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally { setBusyId(''); }
  };

  const empty = useMemo(() => {
    if (loading) return null;
    if (requests.length) return null;
    if (tab === 'open') return 'No open refund requests. You\'re clear.';
    if (tab === 'approved') return 'No approved refunds yet.';
    return 'No denied requests.';
  }, [loading, requests.length, tab]);

  return (
    <AdminShell title="Refunds">
      <PageShell embedded subtitle="Action members' refund requests. Approving issues a real Stripe refund.">
        {tableMissing && (
          <Banner kind="warn">
            The <code>refund_requests</code> table has not been created yet — saved requests will appear once migration 024 is applied. Members' filed requests are still preserved in the audit log.
          </Banner>
        )}
        <Banner kind="error" onClose={() => setError(null)}>{error}</Banner>
        <Banner kind="success" onClose={() => setNotice(null)}>{notice}</Banner>

        <TabBar value={tab} onChange={setTab} />

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading refund requests…
          </div>
        ) : empty ? (
          <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center font-body text-sm text-foreground/55">
            {empty}
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} onAction={onAction} busyId={busyId} />
            ))}
          </div>
        )}
      </PageShell>

      <ConfirmDialog
        open={confirm.open}
        action={confirm.action}
        request={confirm.request}
        busy={Boolean(busyId)}
        onClose={() => setConfirm({ open: false, action: null, request: null })}
        onConfirm={submitAction}
      />
    </AdminShell>
  );
}
