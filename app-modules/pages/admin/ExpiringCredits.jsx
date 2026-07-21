/**
 * Admin "Credits Expiring Soon" — /admin/expiring-credits
 *
 * Lists every member credit grant that will expire within the next 30 days
 * (and has not already been swept by the daily cron at /api/cron/expire-credits).
 * Staff use this to reach out to members BEFORE their visits vanish — there is
 * no auto-email; the "Email them" button just opens a mailto: so the member of
 * staff can compose the message and use judgment.
 *
 * Data: GET /api/admin/expiring-credits (requireStaff). The page renders the
 * full table; `CreditsExpiringSoon` is exported as a compact widget the admin
 * dashboard / Memberships sidebar can drop in.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Mail, RefreshCw, ArrowRight } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet } from '@/lib/apiClient';
import { useSeo } from '@/lib/seo';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const FAINT = 'hsl(var(--foreground) / 0.24)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';
const WARN = 'hsl(38 88% 60%)';
const DANGER = 'hsl(0 70% 60%)';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysLeftColor(days) {
  if (days <= 7) return DANGER;
  if (days <= 14) return WARN;
  return TEXT;
}

function mailtoFor(row) {
  if (!row.email) return null;
  const name = (row.fullName || '').split(' ')[0] || 'there';
  const expires = fmtDate(row.expiresAt);
  const subj = encodeURIComponent('Your Avalon visit credits expire soon');
  const body = encodeURIComponent(
    `Hi ${name},\n\n` +
    `A quick heads-up — you have ${row.units} visit ${row.units === 1 ? 'credit' : 'credits'} ` +
    `on your Avalon membership that expire on ${expires} (in ${row.daysLeft} day${row.daysLeft === 1 ? '' : 's'}).\n\n` +
    `If you'd like, reply with a few times that work and we'll get you on the books before then.\n\n` +
    `— The Avalon team`
  );
  return `mailto:${row.email}?subject=${subj}&body=${body}`;
}

function HeaderRow() {
  return (
    <div
      className="hidden grid-cols-[1.4fr_1.6fr_0.7fr_0.9fr_0.9fr_auto] gap-3 px-4 py-2.5 font-body text-[9px] font-bold uppercase tracking-[0.16em] md:grid"
      style={{ color: DIM }}
    >
      <span>Member</span>
      <span>Email</span>
      <span>Credits</span>
      <span>Expires</span>
      <span>Days left</span>
      <span className="text-right">Action</span>
    </div>
  );
}

function ExpiringRow({ row }) {
  const name = row.fullName || row.email || '(Unlinked)';
  const mailto = mailtoFor(row);
  const dayColor = daysLeftColor(row.daysLeft);
  return (
    <div
      className="grid grid-cols-1 gap-2 px-4 py-3.5 md:grid-cols-[1.4fr_1.6fr_0.7fr_0.9fr_0.9fr_auto] md:items-center md:gap-3"
      style={{ borderTop: `1px solid ${BORDER}` }}
    >
      <div>
        <p className="font-heading text-base uppercase leading-none" style={{ color: TEXT }}>{name}</p>
        {!row.email && (
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: FAINT }}>
            No email on file
          </p>
        )}
      </div>
      <p className="truncate font-body text-sm" style={{ color: MUTED }}>{row.email || '—'}</p>
      <div>
        <p className="font-heading text-xl leading-none" style={{ color: TEXT }}>{row.units}</p>
        <p className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
          {row.units === 1 ? 'visit' : 'visits'}
        </p>
      </div>
      <p className="font-body text-sm" style={{ color: TEXT }}>{fmtDate(row.expiresAt)}</p>
      <p className="font-heading text-lg leading-none" style={{ color: dayColor }}>
        {row.daysLeft}
        <span className="ml-1 font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
          {row.daysLeft === 1 ? 'day' : 'days'}
        </span>
      </p>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {mailto ? (
          <a
            href={mailto}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
            style={{ color: TEXT, border: `1px solid ${BORDER}` }}
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2.2} /> Email
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: FAINT, border: `1px solid ${BORDER}`, opacity: 0.5 }}
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2.2} /> Email
          </span>
        )}
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

// ── Hook: shared by the full page and the compact dashboard widget ───────────
function useExpiringCredits() {
  const [rows, setRows] = useState(null);
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setError(null);
    try {
      const data = await apiGet('/api/admin/expiring-credits');
      const next = Array.isArray(data?.rows) ? data.rows : [];
      setRows(next);
      if (Number.isFinite(data?.windowDays)) setWindowDays(data.windowDays);
    } catch (err) {
      if (!silent) setError(err?.message || 'Could not load expiring credits.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  return { rows, windowDays, loading, error, refetch: fetchRows };
}

// ── Compact widget for the admin dashboard / Memberships sidebar ─────────────
//
// Renders the top N soonest-to-expire grants in a small card. Drop into any
// admin surface as: <CreditsExpiringSoon limit={5} />.
export function CreditsExpiringSoon({ limit = 5 } = {}) {
  const { rows, windowDays, loading, error } = useExpiringCredits();
  const top = useMemo(() => (rows || []).slice(0, limit), [rows, limit]);

  return (
    <section
      className="rounded-[1.2rem] p-4"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" strokeWidth={1.8} style={{ color: WARN }} />
          <h3 className="font-heading text-base uppercase leading-none" style={{ color: TEXT }}>
            Credits expiring soon
          </h3>
        </div>
        <Link
          to="/admin/expiring-credits"
          className="inline-flex items-center gap-1 font-body text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: MUTED }}
        >
          View all <ArrowRight className="h-3 w-3" strokeWidth={2.2} />
        </Link>
      </header>
      {loading && (
        <p className="font-body text-[11px]" style={{ color: DIM }}>Loading…</p>
      )}
      {error && !loading && (
        <p className="font-body text-[11px]" style={{ color: DANGER }}>{error}</p>
      )}
      {!loading && !error && top.length === 0 && (
        <p className="font-body text-[11px]" style={{ color: MUTED }}>
          No credits expiring in the next {windowDays} days.
        </p>
      )}
      {!loading && !error && top.length > 0 && (
        <ul className="flex flex-col gap-2">
          {top.map((row) => {
            const name = row.fullName || row.email || '(Unlinked)';
            const mailto = mailtoFor(row);
            const dayColor = daysLeftColor(row.daysLeft);
            return (
              <li
                key={row.grantId}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                style={{ background: CARD_STRONG }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm font-semibold" style={{ color: TEXT }}>
                    {name}
                  </p>
                  <p className="font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: DIM }}>
                    {row.units} {row.units === 1 ? 'visit' : 'visits'} ·{' '}
                    <span style={{ color: dayColor }}>{row.daysLeft}d</span> · {fmtDate(row.expiresAt)}
                  </p>
                </div>
                {mailto && (
                  <a
                    href={mailto}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-body text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: TEXT, border: `1px solid ${BORDER}` }}
                    title="Email this member"
                  >
                    <Mail className="h-3 w-3" strokeWidth={2.2} /> Email
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Full page ────────────────────────────────────────────────────────────────
export default function AdminExpiringCredits() {
  useSeo({
    title: 'Expiring credits — Avalon Admin',
    description: 'Member visit credits expiring within 30 days; reach out before they vanish.',
    robots: 'noindex,nofollow',
  });

  const { rows, windowDays, loading, error, refetch } = useExpiringCredits();
  const empty = !loading && !error && (!rows || rows.length === 0);

  const totalUnits = useMemo(
    () => (rows || []).reduce((sum, r) => sum + Number(r.units || 0), 0),
    [rows]
  );

  return (
    <AdminShell title="Expiring credits">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
            Next {windowDays} days
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <Clock className="h-5 w-5" strokeWidth={1.8} style={{ color: WARN }} />
            <h2 className="font-heading text-2xl uppercase leading-none md:text-3xl" style={{ color: TEXT }}>
              {loading
                ? 'Loading…'
                : `${rows?.length || 0} ${(rows?.length || 0) === 1 ? 'grant' : 'grants'} expiring`}
            </h2>
            {!loading && (rows?.length || 0) > 0 && (
              <span className="font-body text-sm" style={{ color: MUTED }}>
                · {totalUnits} {totalUnits === 1 ? 'visit' : 'visits'}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
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
          <div className="px-4 py-6 font-body text-sm" style={{ color: DANGER }}>{error}</div>
        )}
        {empty && (
          <div className="px-4 py-10 text-center">
            <p className="font-heading text-xl uppercase" style={{ color: TEXT }}>Nothing expiring</p>
            <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>
              No member credits are scheduled to expire within the next {windowDays} days.
            </p>
          </div>
        )}
        {rows && rows.map((row) => (
          <ExpiringRow key={row.grantId} row={row} />
        ))}
      </section>

      <p className="mt-5 font-body text-[11px]" style={{ color: FAINT }}>
        Visit credits expire one year after they are issued. The daily cron at
        <code> /api/cron/expire-credits</code> sweeps stale grants automatically;
        this page is the head-start so staff can prompt a booking before that
        happens. "Email" opens a draft — nothing is sent automatically.
      </p>
    </AdminShell>
  );
}
