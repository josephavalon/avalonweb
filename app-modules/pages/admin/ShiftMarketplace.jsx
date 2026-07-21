/**
 * ShiftMarketplace — /admin/shift-marketplace
 *
 * READ-ONLY snapshot of the nurse shift marketplace. Pulls live open
 * appointments + nurse roster + inventory, hands them to the brain
 * (src/lib/shiftMarketplaceBrain.js → buildShiftMarketplaceSnapshot), and
 * renders one card per open request with the top 3 nurse offers.
 *
 * The "Send offer" button is PREVIEW MODE — it opens a mailto/SMS prefill
 * because the actual offer broadcast (Y/N reply, payroll, Acuity push) is not
 * built yet. See SHIFT_MARKETPLACE_RULES for the operating model.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD = 'hsl(var(--foreground) / 0.03)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';
const ACCENT = 'hsl(38 95% 60%)';
const DANGER = 'hsl(0 70% 62%)';
const SUCCESS = 'hsl(150 55% 55%)';

function stageColor(stage) {
  switch (stage) {
    case 'Accepted': return SUCCESS;
    case 'Send': return ACCENT;
    case 'Backup': return 'hsl(210 60% 65%)';
    case 'Hold': return DANGER;
    default: return DIM;
  }
}

function offerSubject(row, offer) {
  return `[Shift offer] ${row.client} — ${row.city} ${row.time}`;
}

function offerBody(row, offer) {
  const lines = [
    `${offer.nurseName}, you're up.`,
    '',
    `Client: ${row.client}`,
    `Service: ${row.service}`,
    `When: ${row.time}`,
    `Where: ${row.city}`,
    `Estimated pay: $${offer.shiftValue}`,
    '',
    'Reply Y to accept, N to decline.',
    '',
    `(Avalon shift broadcast preview — offer id ${offer.id})`,
  ];
  return lines.join('\n');
}

function previewOfferHrefs(row, offer, nursePhone) {
  const subject = encodeURIComponent(offerSubject(row, offer));
  const body = encodeURIComponent(offerBody(row, offer));
  const phone = (nursePhone || '').replace(/[^\d+]/g, '');
  return {
    sms: phone ? `sms:${phone}?&body=${body}` : '',
    email: `mailto:?subject=${subject}&body=${body}`,
  };
}

function StagePill({ stage }) {
  const color = stageColor(stage);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ color, borderColor: color, background: `${color.replace('hsl(', 'hsla(').replace(')', ' / 0.12)')}` }}
    >
      {stage}
    </span>
  );
}

function MetricTile({ label, value, sub, accent }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl border p-4"
      style={{ borderColor: BORDER, background: CARD }}
    >
      <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>{label}</span>
      <span className="font-heading text-2xl leading-none" style={{ color: accent || TEXT }}>{value}</span>
      {sub ? <span className="font-body text-[10px]" style={{ color: DIM }}>{sub}</span> : null}
    </div>
  );
}

function DataSourceBadge({ label, count, missing }) {
  const color = missing ? DANGER : count > 0 ? SUCCESS : DIM;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-body text-[10px] uppercase tracking-[0.14em]"
      style={{ borderColor: BORDER, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}: {missing ? 'missing' : count}
    </span>
  );
}

function NurseOfferRow({ row, offer, nurse }) {
  const links = previewOfferHrefs(row, offer, nurse?.phone);
  const canText = Boolean(links.sms);
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: BORDER, background: CARD }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{offer.nurseName}</span>
          <StagePill stage={offer.stage} />
          <span className="font-body text-[11px]" style={{ color: DIM }}>
            score {offer.score} · ETA ~{offer.etaEstimate || '—'}m
          </span>
        </div>
        <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>
          {offer.nextAction}
        </p>
        {offer.blockers?.length ? (
          <p className="mt-1 font-body text-[11px]" style={{ color: DANGER }}>
            Blocked: {offer.blockers.join(', ')}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-heading text-base" style={{ color: TEXT }}>${offer.shiftValue}</span>
        <a
          href={links.sms || links.email}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-foreground/[0.06]"
          style={{ borderColor: BORDER, color: TEXT, opacity: offer.stage === 'Do Not Send' ? 0.4 : 1 }}
          title={canText ? 'Preview: opens SMS draft' : 'Preview: opens email draft'}
        >
          <Send className="h-3 w-3" strokeWidth={2} />
          {canText ? 'Preview SMS' : 'Preview email'}
        </a>
      </div>
    </div>
  );
}

function RequestCard({ row, nursesById }) {
  const top3 = (row.offers || []).slice(0, 3);
  const ringColor = row.accepted ? SUCCESS : row.stale ? DANGER : BORDER;
  return (
    <article
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: ringColor, background: BG }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: BORDER, background: CARD }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base uppercase tracking-wide" style={{ color: TEXT }}>{row.client}</h3>
            {row.accepted ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: SUCCESS, borderColor: SUCCESS }}>
                Accepted · {row.accepted.nurseName}
              </span>
            ) : row.stale ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: DANGER, borderColor: DANGER }}>
                Stale
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-body text-xs" style={{ color: MUTED }}>{row.service}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-[11px]" style={{ color: DIM }}>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" strokeWidth={2} />{row.time}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" strokeWidth={2} />{row.city || 'Market pending'}</span>
            <span>Status: {row.status}</span>
          </div>
        </div>
      </div>

      {/* Top 3 offers */}
      <div className="space-y-2 px-5 py-4">
        {top3.length === 0 ? (
          <p className="rounded-xl border px-3 py-4 text-center font-body text-xs" style={{ borderColor: BORDER, color: DIM }}>
            No nurse offers — roster is empty or all candidates blocked.
          </p>
        ) : (
          top3.map((offer) => (
            <NurseOfferRow
              key={offer.id}
              row={row}
              offer={offer}
              nurse={nursesById.get(offer.nurseId)}
            />
          ))
        )}
        {row.offers && row.offers.length > 3 ? (
          <p className="px-1 font-body text-[10px]" style={{ color: DIM }}>
            +{row.offers.length - 3} more candidate{row.offers.length - 3 === 1 ? '' : 's'} (lower score)
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function ShiftMarketplace() {
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/api/admin/shift-marketplace');
      setSnap(data);
    } catch (err) {
      setError(err?.body?.error || err?.message || 'Could not load the marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build a quick lookup so each offer card can grab phone for the SMS preview.
  const nursesById = useMemo(() => {
    const map = new Map();
    for (const inbox of snap?.nurseInbox || []) {
      map.set(inbox.id, { name: inbox.nurse, phone: inbox.phone });
    }
    return map;
  }, [snap]);

  const rows = snap?.rows || [];
  const metrics = snap?.metrics || {};
  const unassigned = rows.filter((r) => !r.accepted).length;
  const ds = snap?.dataSources || {};
  const warnings = snap?.warnings || [];

  return (
    <AdminShell title="Shift marketplace" fullBleed>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-7 md:py-7">
        {/* Header strip */}
        <header
          className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-5 py-4"
          style={{ borderColor: BORDER, background: CARD }}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl uppercase tracking-wide" style={{ color: TEXT }}>Shift marketplace</h1>
              <span className="rounded-md border px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: ACCENT, borderColor: ACCENT }}>
                Preview mode
              </span>
            </div>
            <p className="mt-1 font-body text-xs" style={{ color: MUTED }}>
              Read-only nurse shift queue. SMS / Acuity / payroll handoffs are placeholders — no nurse offers actually broadcast yet.
            </p>
            <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
              Brain {snap?.version || 'loading…'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-foreground/[0.06] disabled:opacity-50"
              style={{ borderColor: BORDER, color: TEXT }}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <RefreshCw className="h-3 w-3" strokeWidth={2} />}
              Refresh
            </button>
          </div>
        </header>

        {/* Read-only banner */}
        <div
          className="mt-3 flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: ACCENT, background: 'hsla(38 95% 60% / 0.08)' }}
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} style={{ color: ACCENT }} />
          <div className="min-w-0">
            <p className="font-body text-xs font-semibold" style={{ color: TEXT }}>
              This surface does not send anything.
            </p>
            <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>
              "Preview SMS" / "Preview email" open a draft in your device — the real Y/N shift broadcast, Acuity push, and payroll wiring aren't built yet.
              The brain only ranks who you'd send to.
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <MetricTile label="Open visits" value={metrics.visits ?? 0} sub={`${unassigned} unassigned`} accent={unassigned ? DANGER : TEXT} />
          <MetricTile label="Nurses" value={metrics.nurses ?? 0} />
          <MetricTile label="Sendable" value={metrics.sendable ?? 0} sub="Stage: Send" accent={ACCENT} />
          <MetricTile label="Accepted" value={metrics.accepted ?? 0} accent={SUCCESS} />
          <MetricTile label="Backup" value={metrics.backup ?? 0} />
          <MetricTile label="Hold" value={metrics.hold ?? 0} accent={metrics.hold ? DANGER : TEXT} />
        </div>

        {/* Data source health */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DataSourceBadge label="Appointments" count={ds.appointments?.count || 0} missing={ds.appointments?.missing} />
          <DataSourceBadge label="Nurses" count={ds.nurses?.count || 0} missing={ds.nurses?.missing} />
          <DataSourceBadge label="Inventory" count={ds.inventory?.count || 0} missing={ds.inventory?.missing} />
          {snap?.horizonDays ? (
            <span className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
              · {snap.horizonDays}-day horizon
            </span>
          ) : null}
        </div>

        {/* Warnings */}
        {warnings.length ? (
          <div className="mt-3 space-y-1.5">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, color: MUTED, background: CARD }}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: DANGER }} />
                <span className="font-body text-[11px]">{w}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Escalations */}
        {(snap?.escalations || []).length ? (
          <section className="mt-6">
            <h2 className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Escalations</h2>
            <div className="space-y-1.5">
              {(snap?.escalations || []).map((esc) => (
                <div
                  key={esc.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 font-body text-xs"
                  style={{ borderColor: BORDER, background: CARD, color: MUTED }}
                >
                  <span className="rounded-md border px-2 py-0.5 font-bold uppercase tracking-[0.14em] text-[10px]"
                    style={{ color: esc.severity === 'High' ? DANGER : esc.severity === 'Action' ? ACCENT : DIM, borderColor: BORDER }}
                  >
                    {esc.severity}
                  </span>
                  <span className="font-semibold" style={{ color: TEXT }}>{esc.client}</span>
                  <span>{esc.reason}</span>
                  <span style={{ color: DIM }}>→ {esc.action}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Requests */}
        <section className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
              <Users className="-mt-0.5 mr-1 inline h-3 w-3" strokeWidth={2} />
              Open requests
            </h2>
            <span className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
              Top 3 candidate nurses per request
            </span>
          </div>

          {error ? (
            <div className="rounded-xl border px-4 py-3" style={{ borderColor: DANGER, color: DANGER, background: CARD }}>
              <p className="font-body text-xs">{error}</p>
            </div>
          ) : null}

          {loading && !snap ? (
            <div className="flex items-center gap-2 rounded-xl border px-4 py-8 font-body text-xs" style={{ borderColor: BORDER, color: DIM, justifyContent: 'center', background: CARD }}>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading marketplace…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border px-4 py-10 text-center" style={{ borderColor: BORDER, background: CARD }}>
              <Sparkles className="mx-auto mb-2 h-5 w-5" strokeWidth={1.6} style={{ color: DIM }} />
              <p className="font-body text-sm" style={{ color: MUTED }}>No open shifts in the {snap?.horizonDays || 14}-day window.</p>
              <p className="mt-1 font-body text-[11px]" style={{ color: DIM }}>
                {ds.appointments?.missing
                  ? 'Appointments table missing — wire that up to populate this queue.'
                  : 'New booking → new card. Re-check after a fresh visit is created.'}
              </p>
            </div>
          ) : (
            rows.map((row) => (
              <RequestCard key={row.requestId} row={row} nursesById={nursesById} />
            ))
          )}
        </section>

        {/* Rules footer */}
        {snap?.rules?.length ? (
          <section className="mt-8 rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
            <h2 className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
              Operating rules
            </h2>
            <ul className="space-y-1">
              {snap.rules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 font-body text-xs" style={{ color: MUTED }}>
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: DIM }} />
                  {rule}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {snap?.fetchedAt ? (
          <p className="mt-4 text-center font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
            Fetched {new Date(snap.fetchedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </div>
    </AdminShell>
  );
}
