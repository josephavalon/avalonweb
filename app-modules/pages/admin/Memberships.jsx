/**
 * Admin Memberships — /admin/memberships
 *
 * Master list of every patient on an active membership plan. Pulls every
 * Stripe subscription with status:active, joins to our profiles by
 * stripe_customer_id, sums member_credit_ledger for the per-member balance,
 * and exposes inline grant/revoke credit actions that POST to the existing
 * /api/admin/clients/[id]/credits endpoint.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Minus, Plus, RefreshCw } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useSeo } from '@/lib/seo';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const FAINT = 'hsl(var(--foreground) / 0.24)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';

const CACHE_KEY = 'av:admin:memberships:v1';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(value) {
  const n = Number(value || 0);
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function tierColor(tier) {
  if (tier === 'Concierge') return 'hsl(38 88% 60%)'; // warn / gold
  if (tier === 'Vitality') return 'hsl(150 60% 55%)'; // accent / green
  return MUTED; // Essentials → dim
}

function readCache() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.rows && Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch { return null; }
}

function writeCache(rows) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rows, savedAt: Date.now() }));
  } catch { /* quota or private mode — ignore */ }
}

function TierBadge({ tier }) {
  return (
    <span
      className="inline-flex min-h-[22px] items-center rounded-full px-2.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]"
      style={{
        color: tierColor(tier),
        background: CARD_STRONG,
        border: `1px solid ${BORDER}`,
      }}
    >
      {tier || 'Plan'}
    </span>
  );
}

function CreditAction({ row, mode, onClose, onApplied }) {
  const [units, setUnits] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const sign = mode === 'revoke' ? -1 : 1;
  const verb = mode === 'revoke' ? 'Revoke' : 'Grant';

  const submit = async (event) => {
    event.preventDefault();
    if (!row.profileId) {
      setError('No profile is linked to this Stripe subscription yet — cannot adjust credits.');
      return;
    }
    const n = Math.trunc(Number(units));
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a positive number of credits.');
      return;
    }
    if (!note.trim()) {
      setError('A reason is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/admin/clients/${row.profileId}/credits`, {
        units: sign * n,
        note: note.trim(),
      });
      onApplied(sign * n);
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not adjust credits.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-2 flex flex-col gap-2 rounded-xl px-3 py-3"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-2">
        <label className="font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>
          {verb} credits
        </label>
        <input
          type="number"
          min={1}
          step={1}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          className="w-20 rounded-lg px-2 py-1.5 font-body text-sm"
          style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }}
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={mode === 'revoke' ? 'Why are these credits being revoked?' : 'Why are credits being granted?'}
        rows={2}
        className="rounded-lg px-2.5 py-1.5 font-body text-sm"
        style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }}
      />
      {error && (
        <p className="font-body text-[11px]" style={{ color: 'hsl(0 70% 60%)' }}>{error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: MUTED, border: `1px solid ${BORDER}` }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ background: TEXT, color: BG, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Saving…' : verb}
        </button>
      </div>
    </form>
  );
}

function MembershipRow({ row, refetch }) {
  const [actionMode, setActionMode] = useState(null); // 'grant' | 'revoke' | null
  const [optimisticBalance, setOptimisticBalance] = useState(null);

  const balance = optimisticBalance ?? row.creditsBalance ?? 0;
  const tierAccent = tierColor(row.tier);
  const name = row.fullName || row.email || (row.orphan ? `(Unlinked · ${row.stripeCustomerId || row.stripeSubscriptionId})` : 'Patient');

  const onApplied = useCallback((delta) => {
    setOptimisticBalance((prev) => (prev ?? row.creditsBalance ?? 0) + delta);
    // Background refetch — no spinner needed.
    refetch({ silent: true });
  }, [row.creditsBalance, refetch]);

  return (
    <div
      className="grid grid-cols-1 gap-2 px-4 py-4 md:grid-cols-[1.4fr_1.6fr_0.7fr_0.6fr_0.7fr_0.9fr_auto] md:items-center md:gap-3"
      style={{ borderTop: `1px solid ${BORDER}` }}
    >
      <div>
        <p className="font-heading text-lg uppercase leading-none" style={{ color: TEXT }}>{name}</p>
        {row.orphan && (
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: FAINT }}>
            No matching profile
          </p>
        )}
      </div>
      <p className="truncate font-body text-sm" style={{ color: MUTED }}>{row.email || '—'}</p>
      <div className="flex items-center gap-2"><TierBadge tier={row.tier} /></div>
      <div>
        <p className="font-heading text-xl leading-none" style={{ color: tierAccent }}>{balance}</p>
        <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>credits</p>
      </div>
      <div>
        <p className="font-heading text-base leading-none" style={{ color: TEXT }}>+{row.monthlyGrant}/mo</p>
        <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>{fmtMoney(row.monthlyAmount)}/mo</p>
      </div>
      <div>
        <p className="font-body text-sm" style={{ color: TEXT }}>{fmtDate(row.nextRenewal)}</p>
        <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
          last {fmtDate(row.lastRenewal)}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setActionMode((m) => (m === 'grant' ? null : 'grant'))}
          disabled={!row.profileId}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
          style={{ color: TEXT, border: `1px solid ${BORDER}`, opacity: row.profileId ? 1 : 0.4 }}
          title={row.profileId ? 'Grant credits' : 'No profile linked'}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} /> Grant
        </button>
        <button
          type="button"
          onClick={() => setActionMode((m) => (m === 'revoke' ? null : 'revoke'))}
          disabled={!row.profileId}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
          style={{ color: TEXT, border: `1px solid ${BORDER}`, opacity: row.profileId ? 1 : 0.4 }}
          title={row.profileId ? 'Revoke credits' : 'No profile linked'}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.2} /> Revoke
        </button>
        {row.profileId && (
          <Link
            to={`/admin/clients/${row.profileId}`}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
            style={{ background: TEXT, color: BG }}
          >
            Profile <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Link>
        )}
      </div>
      {actionMode && (
        <div className="md:col-span-7">
          <CreditAction
            row={row}
            mode={actionMode}
            onClose={() => setActionMode(null)}
            onApplied={onApplied}
          />
        </div>
      )}
    </div>
  );
}

function HeaderRow() {
  return (
    <div
      className="hidden grid-cols-[1.4fr_1.6fr_0.7fr_0.6fr_0.7fr_0.9fr_auto] gap-3 px-4 py-2.5 font-body text-[9px] font-bold uppercase tracking-[0.16em] md:grid"
      style={{ color: DIM }}
    >
      <span>Name</span>
      <span>Email</span>
      <span>Tier</span>
      <span>Credits</span>
      <span>Monthly</span>
      <span>Next renewal</span>
      <span className="text-right">Actions</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-4 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="h-5 w-1/3 animate-pulse rounded" style={{ background: CARD_STRONG }} />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded" style={{ background: CARD_STRONG }} />
        </div>
      ))}
    </div>
  );
}

export default function AdminMemberships() {
  useSeo({
    title: 'Memberships - Avalon Admin',
    description: 'Active membership plans, credit balances, and grant/revoke controls.',
    robots: 'noindex,nofollow',
  });

  const [rows, setRows] = useState(() => readCache());
  const [loading, setLoading] = useState(!rows);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setError(null);
    try {
      const data = await apiGet('/api/admin/memberships');
      const next = Array.isArray(data?.rows) ? data.rows : [];
      setRows(next);
      writeCache(next);
    } catch (err) {
      if (!silent) setError(err?.message || 'Could not load memberships.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const summary = useMemo(() => {
    if (!rows || !rows.length) return null;
    const count = rows.length;
    const mrr = rows.reduce((sum, r) => sum + Number(r.monthlyAmount || 0), 0);
    return { count, mrr };
  }, [rows]);

  const empty = !loading && !error && (!rows || rows.length === 0);

  return (
    <AdminShell title="Memberships">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>All plan-holders</p>
          <div className="mt-1 flex items-center gap-2.5">
            <Crown className="h-5 w-5" strokeWidth={1.8} style={{ color: TEXT }} />
            <h2 className="font-heading text-2xl uppercase leading-none md:text-3xl" style={{ color: TEXT }}>
              {summary
                ? `${summary.count} active ${summary.count === 1 ? 'plan' : 'plans'}`
                : (loading ? 'Loading…' : '0 active plans')}
            </h2>
            {summary && (
              <span className="font-body text-sm" style={{ color: MUTED }}>· {fmtMoney(summary.mrr)}/mo MRR</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); fetchRows(); }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-body text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: MUTED, border: `1px solid ${BORDER}` }}
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} /> Refresh
        </button>
      </div>

      <section
        className="mt-5 overflow-hidden rounded-[1.2rem]"
        style={{ background: CARD, border: `1px solid ${BORDER}` }}
      >
        <HeaderRow />
        {loading && (!rows || rows.length === 0) && <SkeletonRows />}
        {error && (
          <div className="px-4 py-6 font-body text-sm" style={{ color: 'hsl(0 70% 65%)' }}>
            {error}
          </div>
        )}
        {empty && (
          <div className="px-4 py-10 text-center">
            <p className="font-heading text-xl uppercase" style={{ color: TEXT }}>No active plans yet</p>
            <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>
              When a patient subscribes to Essentials, Vitality, or Concierge they'll appear here.
            </p>
          </div>
        )}
        {rows && rows.map((row) => (
          <MembershipRow key={row.stripeSubscriptionId} row={row} refetch={fetchRows} />
        ))}
      </section>

      <p className="mt-5 font-body text-[11px]" style={{ color: FAINT }}>
        Source of truth: Stripe subscriptions joined to <code>profiles.stripe_customer_id</code>.
        Credit balance sums <code>member_credit_ledger.units</code> per profile.
      </p>
    </AdminShell>
  );
}
