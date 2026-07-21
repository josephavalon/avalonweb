// Admin → Support tickets (/admin/support-tickets). Admin/staff.
// Moderates the public support queue (see api/support.js + migration 033). The
// full message body is BAA-covered (Supabase), so it's safe to read here.
// Live data via /api/admin/support-tickets (GET list, POST resolve/reopen).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, RotateCcw, X, Mail } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/apiClient';

const FIELD = 'min-h-[46px] w-full rounded-2xl border border-foreground/10 bg-background/72 px-4 py-3 font-body text-base text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45';

const CATEGORY_LABEL = {
  general: 'General', booking: 'Booking', billing: 'Billing', feedback: 'Feedback', other: 'Other',
};

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

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
];

function TabToggle({ value, onChange, openCount }) {
  return (
    <div className="mb-5 flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
      {TABS.map((t) => {
        const active = t.key === value;
        const badge = t.key === 'open' && openCount > 0;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex-1 truncate rounded-full px-3 py-2 text-center font-body text-[12px] font-semibold transition-colors ${
              active ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'
            }`}
          >
            {t.label}{badge ? ` · ${openCount}` : ''}
          </button>
        );
      })}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function TicketCard({ row, onAct }) {
  const isResolved = row.status === 'resolved';
  const shortId = String(row.id || '').slice(0, 8);
  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full border border-foreground/15 px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.16em] text-foreground/55">
              {CATEGORY_LABEL[row.category] || row.category || 'General'}
            </span>
            <span className="font-body text-[11px] text-foreground/30">#{shortId}</span>
          </div>
          <p className="truncate font-body text-base font-semibold text-foreground">{row.subject || '(no subject)'}</p>
          <p className="truncate font-body text-[12px] text-foreground/45">
            {row.is_anonymous
              ? 'Anonymous'
              : <>{row.name || 'No name'} · {row.email || 'no email'}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/40">Received</p>
          <p className="font-body text-[12px] text-foreground/65">{formatDate(row.created_at)}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-foreground/[0.08] bg-background/40 px-3 py-2.5">
        <p className="whitespace-pre-line font-body text-sm text-foreground/80 leading-relaxed">{row.message}</p>
      </div>

      <div className="my-4 border-t border-foreground/[0.08]" />

      {isResolved ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 font-body text-[12px] text-foreground/55">
            <p><span className="text-foreground/40">Resolved</span> · {formatDate(row.resolved_at)}</p>
            {row.resolution_note && <p className="text-foreground/70">Note: {row.resolution_note}</p>}
          </div>
          <Button variant="ghost" className="gap-2 text-foreground/75 hover:bg-foreground/[0.05]" onClick={() => onAct(row, 'reopen')}>
            <RotateCcw className="h-4 w-4" /> Reopen
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button className="gap-2" onClick={() => onAct(row, 'resolve')}>
            <CheckCircle2 className="h-4 w-4" /> Mark resolved
          </Button>
          {!row.is_anonymous && row.email && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: your Avalon support ticket #${shortId}`)}`}>
                <Mail className="h-4 w-4" /> Reply by email
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ResolveDialog({ open, row, action, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isResolve = action === 'resolve';

  useEffect(() => {
    if (!open) { setNote(''); setBusy(false); }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({ ticketId: row.id, action, note: note.trim() || undefined });
    } finally {
      setBusy(false);
    }
  };

  if (!open || !row) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase tracking-[0.04em]">
            {isResolve ? 'Resolve ticket?' : 'Reopen ticket?'}
          </DialogTitle>
          <DialogDescription>
            #{String(row.id || '').slice(0, 8)} · {row.subject || '(no subject)'}
          </DialogDescription>
        </DialogHeader>

        {isResolve ? (
          <div>
            <label className={LABEL}>Resolution note (optional)</label>
            <textarea
              className={FIELD}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Replied by email; refund processed."
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 py-3 font-body text-sm text-foreground/75">
            This moves the ticket back to the Open queue and clears the resolution stamp.
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isResolve ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />)}
            {isResolve ? 'Mark resolved' : 'Reopen ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupportTickets() {
  const [tab, setTab] = useState('open');
  const [rows, setRows] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [target, setTarget] = useState(null); // { row, action }

  const load = useCallback(async (which) => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet(`/api/admin/support-tickets?status=${which}`);
      setRows(data?.tickets || []);
      setTableMissing(data?.tablePresent === false);
      if (which === 'open') {
        setOpenCount((data?.tickets || []).length);
      } else {
        try {
          const openData = await apiGet('/api/admin/support-tickets?status=open');
          setOpenCount((openData?.tickets || []).length);
        } catch { /* badge is cosmetic */ }
      }
    } catch (err) {
      setError(err?.message || 'Could not load support tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const onAct = useCallback((row, action) => { setTarget({ row, action }); }, []);

  const confirm = useCallback(async ({ ticketId, action, note }) => {
    setError(null);
    try {
      await apiPost('/api/admin/support-tickets', { ticketId, action, note });
      setNotice(action === 'resolve' ? 'Ticket resolved.' : 'Ticket reopened.');
      setTarget(null);
      load(tab);
    } catch (err) {
      setError(err?.message || 'Could not update the ticket.');
    }
  }, [load, tab]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  return (
    <AdminShell title="Support tickets">
      <PageShell embedded subtitle="Public support requests from /support. Messages are stored securely — reply by email or phone.">
        {tableMissing && (
          <Banner kind="warn">
            The <code>support_tickets</code> table isn't present yet. Apply migration 033 before tickets can be received.
          </Banner>
        )}
        <Banner kind="error" onClose={() => setError(null)}>{error}</Banner>
        <Banner kind="success" onClose={() => setNotice(null)}>{notice}</Banner>

        <TabToggle value={tab} onChange={setTab} openCount={openCount} />

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading support tickets…</div>
        ) : empty ? (
          <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center">
            <p className="font-body text-sm text-foreground/55">
              {tab === 'open' ? 'No open tickets.' : 'No resolved tickets to show.'}
            </p>
            <p className="mt-1 font-body text-[12px] text-foreground/35">
              {tab === 'open'
                ? 'New tickets submitted from /support will appear here.'
                : 'Resolved tickets stay on record.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((row) => (
              <TicketCard key={row.id} row={row} onAct={onAct} />
            ))}
          </div>
        )}
      </PageShell>

      <ResolveDialog
        open={Boolean(target)}
        row={target?.row || null}
        action={target?.action || 'resolve'}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
      />
    </AdminShell>
  );
}
