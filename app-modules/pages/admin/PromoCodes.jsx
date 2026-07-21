// Admin → Promo codes (/admin/promo-codes). Admin/staff.
// Create + archive Stripe-of-record promotion codes. No DB row: every value
// shown here is read straight from Stripe via /api/admin/promo-codes. Hosted
// Checkout already passes `allow_promotion_codes: true` (see
// api/create-checkout-session.js), so any code created here is immediately
// redeemable at the Stripe checkout input field — no other wiring needed.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, Loader2, Percent, Plus, RefreshCw, Tag, X,
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

function formatDiscount(coupon) {
  if (coupon?.percent_off != null) return `${coupon.percent_off}% off`;
  if (coupon?.amount_off_dollars != null) {
    return `$${Number(coupon.amount_off_dollars).toFixed(2)} off`;
  }
  return '—';
}

function formatDuration(coupon) {
  if (!coupon?.duration) return '—';
  if (coupon.duration === 'once') return 'One charge';
  if (coupon.duration === 'forever') return 'Forever';
  if (coupon.duration === 'repeating') {
    const m = coupon.duration_in_months;
    return m ? `${m} ${m === 1 ? 'month' : 'months'}` : 'Repeating';
  }
  return coupon.duration;
}

function formatExpiry(iso) {
  if (!iso) return 'No expiry';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'No expiry';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return 'No expiry'; }
}

function formatUsage(promo) {
  const used = promo?.times_redeemed ?? 0;
  if (promo?.max_redemptions != null) return `${used} / ${promo.max_redemptions}`;
  return `${used} / ∞`;
}

function CodeChip({ code }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 bg-foreground/[0.06] px-2 py-1 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground">
      <Tag className="h-3 w-3 text-foreground/55" strokeWidth={2} />
      {code}
    </span>
  );
}

function PromoCard({ promo, onArchive, busyId }) {
  const isBusy = busyId === promo.id;
  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <CodeChip code={promo.code} />
            <span className="font-heading text-2xl uppercase leading-none tracking-[0.04em] text-foreground">
              {formatDiscount(promo.coupon)}
            </span>
          </div>
          <p className="mt-2 font-body text-[12px] text-foreground/45">
            {formatDuration(promo.coupon)} · expires {formatExpiry(promo.expires_at)}
          </p>
        </div>
        <Button
          variant="ghost" size="sm" disabled={isBusy}
          className="gap-1.5 text-red-300 hover:text-red-200"
          onClick={() => onArchive(promo)}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archive
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-foreground/[0.08] pt-4 font-body text-[12px] text-foreground/55 md:grid-cols-3">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Redeemed</p>
          <p className="mt-0.5 text-foreground/80">{formatUsage(promo)}</p>
        </div>
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Created</p>
          <p className="mt-0.5 text-foreground/80">{promo.created_at ? new Date(promo.created_at).toLocaleDateString() : '—'}</p>
        </div>
        <div className="col-span-2 md:col-span-1">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Stripe ID</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-foreground/55">{promo.id}</p>
        </div>
      </div>
    </div>
  );
}

function CreateDialog({ open, onClose, onDone, onErr }) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'amount'
  const [percentOff, setPercentOff] = useState('10');
  const [amountOff, setAmountOff] = useState('');
  const [duration, setDuration] = useState('once');
  const [durationMonths, setDurationMonths] = useState('3');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCode(''); setDiscountType('percent'); setPercentOff('10'); setAmountOff('');
    setDuration('once'); setDurationMonths('3'); setMaxRedemptions(''); setExpiresAt('');
    setBusy(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        code,
        duration,
      };
      if (discountType === 'percent') payload.percent_off = Number(percentOff);
      else payload.amount_off = Number(amountOff);
      if (duration === 'repeating') payload.duration_in_months = Number(durationMonths);
      if (maxRedemptions) payload.max_redemptions = Number(maxRedemptions);
      // <input type="date"> gives YYYY-MM-DD; turn it into end-of-day UTC so a
      // 2026-07-04 expiry doesn't blow up at midnight UTC for a Pacific user.
      if (expiresAt) payload.expires_at = new Date(`${expiresAt}T23:59:59Z`).toISOString();

      const res = await apiPost('/api/admin/promo-codes', payload);
      onDone(`Promo code ${res?.promo?.code || payload.code} created.`);
      reset();
    } catch (err) {
      onErr(err?.message || 'Could not create the promo code.');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase tracking-[0.04em]">Create promo code</DialogTitle>
          <DialogDescription>
            Customers type this at the Stripe checkout discount field. Codes are letters and digits only.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Code</label>
            <input
              className={`${FIELD} font-mono uppercase tracking-[0.06em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              maxLength={50}
              required
            />
            <p className="mt-1.5 font-body text-[11px] text-foreground/40">4–50 characters, A–Z and 0–9 only.</p>
          </div>

          <div>
            <label className={LABEL}>Discount</label>
            <div className="mb-2 flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
              {[{ k: 'percent', l: 'Percent off' }, { k: 'amount', l: 'Amount off ($)' }].map((opt) => {
                const active = discountType === opt.k;
                return (
                  <button
                    key={opt.k} type="button" onClick={() => setDiscountType(opt.k)}
                    className={`flex-1 rounded-full px-3 py-2 text-center font-body text-[12px] font-semibold transition-colors ${
                      active ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'
                    }`}
                  >{opt.l}</button>
                );
              })}
            </div>
            {discountType === 'percent' ? (
              <div className="relative">
                <input
                  className={FIELD} type="number" min="1" max="100" step="0.5"
                  value={percentOff} onChange={(e) => setPercentOff(e.target.value)}
                  placeholder="10" required
                />
                <Percent className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              </div>
            ) : (
              <input
                className={FIELD} type="number" min="0.5" step="0.01"
                value={amountOff} onChange={(e) => setAmountOff(e.target.value)}
                placeholder="25.00" required
              />
            )}
          </div>

          <div>
            <label className={LABEL}>Duration (subscriptions)</label>
            <select className={FIELD} value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="once">Once — apply to the first charge only</option>
              <option value="repeating">Repeating — apply for N months</option>
              <option value="forever">Forever — every renewal</option>
            </select>
            {duration === 'repeating' && (
              <div className="mt-3">
                <label className={LABEL}>Months</label>
                <input
                  className={FIELD} type="number" min="1" max="60" step="1"
                  value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)}
                  required
                />
              </div>
            )}
            <p className="mt-1.5 font-body text-[11px] text-foreground/40">
              For one-time checkouts this is always a single discount on the cart.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Max redemptions</label>
              <input
                className={FIELD} type="number" min="1" step="1"
                value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="No limit"
              />
            </div>
            <div>
              <label className={LABEL}>Expires on</label>
              <input
                className={FIELD} type="date"
                value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create code
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PromoCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet('/api/admin/promo-codes');
      setCodes(Array.isArray(data?.codes) ? data.codes : []);
    } catch (err) {
      setError(err?.message || 'Could not load promo codes.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setBusyId(archiveTarget.id);
    try {
      await apiPost('/api/admin/promo-codes?action=archive', { id: archiveTarget.id });
      setNotice(`Promo code ${archiveTarget.code} archived.`);
      setArchiveTarget(null);
      load();
    } catch (err) {
      setError(err?.message || 'Could not archive the code.');
    } finally {
      setBusyId('');
    }
  };

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
      </Button>
      <Button onClick={() => setCreateOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Create code
      </Button>
    </div>
  );

  const subtitle = useMemo(
    () => 'Stripe is the source of truth. Codes are immediately redeemable at the Stripe checkout discount field.',
    [],
  );

  return (
    <AdminShell title="Promo codes">
      <PageShell embedded subtitle={subtitle} action={actions}>
        <Banner kind="error" onClose={() => setError(null)}>{error}</Banner>
        <Banner kind="success" onClose={() => setNotice(null)}>{notice}</Banner>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading promo codes…
          </div>
        ) : codes.length === 0 ? (
          <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center">
            <p className="font-body text-sm text-foreground/55">No active promo codes.</p>
            <p className="mt-1 font-body text-[12px] text-foreground/35">Create one to share a discount with customers.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {codes.map((promo) => (
              <PromoCard key={promo.id} promo={promo} onArchive={setArchiveTarget} busyId={busyId} />
            ))}
          </div>
        )}
      </PageShell>

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={(msg) => { setCreateOpen(false); setNotice(msg); load(); }}
        onErr={setError}
      />

      {archiveTarget && (
        <Dialog open onOpenChange={(v) => !v && setArchiveTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl uppercase tracking-[0.04em]">Archive {archiveTarget.code}?</DialogTitle>
              <DialogDescription>
                The code stops redeeming immediately. Existing redemptions stay on the Stripe account but the code disappears from this list.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setArchiveTarget(null)} disabled={!!busyId}>Cancel</Button>
              <Button
                onClick={confirmArchive}
                disabled={!!busyId}
                className="gap-2 bg-red-500/20 text-red-100 hover:bg-red-500/30"
              >
                {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archive
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
