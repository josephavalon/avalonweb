// Admin → Reviews (/admin/reviews). Admin/staff.
// Moderation queue for the post-visit NPS + review capture. Lists submitted
// reviews newest-first; each row shows the score, member, visit date, the
// free-text body, whether the customer opted in to public sharing, and
// approve/hide toggles. Approved + allow_public + score ≥ 8 + !hidden is the
// pool that a future public testimonials endpoint will read from — that
// endpoint isn't built yet.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, EyeOff, Loader2, RefreshCw, Star } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost } from '@/lib/apiClient';

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
        <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">✕</button>
      )}
    </div>
  );
}

function ScoreBadge({ score }) {
  const band =
    score == null ? 'border-foreground/15 text-foreground/45'
    : score <= 6 ? 'border-red-500/40 text-red-200 bg-red-500/10'
    : score <= 8 ? 'border-amber-500/40 text-amber-200 bg-amber-500/10'
    : 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10';
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full border font-heading text-base font-bold ${band}`}>
      {score == null ? '–' : score}
    </span>
  );
}

function Chip({ children, tone = 'neutral' }) {
  const palette = {
    neutral: 'border-foreground/15 text-foreground/65',
    success: 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10',
    warn:    'border-amber-500/40 text-amber-200 bg-amber-500/10',
    danger:  'border-red-500/40 text-red-200 bg-red-500/10',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[11px] font-semibold ${palette}`}>
      {children}
    </span>
  );
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return String(iso); }
}

const SCOPES = [
  { key: 'submitted', label: 'All submitted' },
  { key: 'public-candidates', label: 'Public candidates' },
  { key: 'all', label: 'Everything' },
];

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scope, setScope] = useState('submitted');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiGet(`/api/admin/reviews?scope=${encodeURIComponent(scope)}`);
      setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
    } catch (err) {
      const msg = err?.message || 'Could not load reviews.';
      // Surface the migration_required code with a friendly nudge.
      if (/migration_required|not been created/i.test(msg)) {
        setError('The reviews table has not been created yet. Apply migration 027 and refresh.');
      } else {
        setError(msg);
      }
    } finally { setLoading(false); }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    setBusyId(`${id}:${action}`);
    setError(''); setNotice('');
    try {
      const res = await apiPost('/api/admin/reviews', { id, action });
      // Replace the row in place to avoid a full reload jitter.
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...res?.review } : r)));
      const msg =
        action === 'approve' ? 'Review approved.' :
        action === 'unapprove' ? 'Approval cleared.' :
        action === 'hide' ? 'Review hidden.' :
        'Review unhidden.';
      setNotice(msg);
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally { setBusyId(''); }
  };

  const stats = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter((r) => r.approved).length;
    const candidates = reviews.filter((r) => r.approved && r.allowPublic && !r.hidden && r.npsScore >= 8).length;
    const avg = total
      ? Math.round((reviews.reduce((s, r) => s + (Number(r.npsScore) || 0), 0) / total) * 10) / 10
      : null;
    return { total, approved, candidates, avg };
  }, [reviews]);

  return (
    <AdminShell title="Reviews">
      <PageShell
        embedded
        subtitle="Post-visit NPS scores + customer reviews. Approve to mark eligible for public testimonials; hide to drop from the queue."
        action={
          <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
        }
      >
        <Banner kind="error" onClose={() => setError('')}>{error}</Banner>
        <Banner kind="success" onClose={() => setNotice('')}>{notice}</Banner>

        {/* Scope toggle */}
        <div className="mb-5 flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={`flex-1 truncate rounded-full px-3 py-2 text-center font-body text-[12px] font-semibold transition-colors ${scope === s.key ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="In view" value={stats.total} />
          <Stat label="Avg NPS" value={stats.avg == null ? '—' : stats.avg.toFixed(1)} />
          <Stat label="Approved" value={stats.approved} />
          <Stat label="Public-eligible" value={stats.candidates} />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center font-body text-sm text-foreground/50">
            No reviews to moderate yet.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const approveKey = `${r.id}:approve`;
              const unapproveKey = `${r.id}:unapprove`;
              const hideKey = `${r.id}:hide`;
              const unhideKey = `${r.id}:unhide`;
              return (
                <div key={r.id} className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <ScoreBadge score={r.npsScore} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm text-foreground">
                        <span className="truncate font-semibold">{r.customerName || '—'}</span>
                        <span className="text-foreground/30">·</span>
                        <span className="truncate font-body text-[12px] text-foreground/55">{r.customerEmail || r.email}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-body text-[12px] text-foreground/45">
                        <span>{r.visitService || 'Avalon Visit'}</span>
                        <span>·</span>
                        <span>Visit {formatWhen(r.visitStartsAt)}</span>
                        <span>·</span>
                        <span>Submitted {formatWhen(r.submittedAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.allowPublic ? <Chip tone="success">Allow public</Chip> : <Chip>Private</Chip>}
                      {r.approved ? <Chip tone="success">Approved</Chip> : null}
                      {r.hidden ? <Chip tone="danger">Hidden</Chip> : null}
                    </div>
                  </div>

                  {r.text && (
                    <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3 font-body text-sm text-foreground/85">
                      {r.text}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.approved ? (
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        disabled={busyId === unapproveKey}
                        onClick={() => act(r.id, 'unapprove')}
                      >
                        {busyId === unapproveKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                        Unapprove
                      </Button>
                    ) : (
                      <Button
                        size="sm" className="gap-1.5"
                        disabled={busyId === approveKey || r.hidden}
                        onClick={() => act(r.id, 'approve')}
                      >
                        {busyId === approveKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </Button>
                    )}
                    {r.hidden ? (
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        disabled={busyId === unhideKey}
                        onClick={() => act(r.id, 'unhide')}
                      >
                        {busyId === unhideKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                        Unhide
                      </Button>
                    ) : (
                      <Button
                        variant="ghost" size="sm" className="gap-1.5 text-red-300 hover:text-red-200"
                        disabled={busyId === hideKey}
                        onClick={() => act(r.id, 'hide')}
                      >
                        {busyId === hideKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                        Hide
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageShell>
    </AdminShell>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-foreground/[0.10] bg-foreground/[0.02] px-4 py-3">
      <div className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">{label}</div>
      <div className="mt-1 font-heading text-2xl text-foreground">{value}</div>
    </div>
  );
}
