// Admin → Account deletion requests (/admin/deletion-requests). Admin/staff.
// Lists member-initiated deletion requests (see api/me/account/delete-request.js
// + migration 022). Medical-record retention forbids hard-delete, so the staff
// action is ANONYMIZE (scrub identifying PII + revoke auth) or DENY. Clinical,
// appointment, charge and ledger rows are NEVER touched.
// Live data via /api/admin/deletion-requests (GET list, POST resolve).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldOff, UserX, X } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/apiClient';

const FIELD = 'min-h-[46px] w-full rounded-2xl border border-foreground/10 bg-background/72 px-4 py-3 font-body text-base text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45';
const CONFIRM_PHRASE = 'ANONYMIZE';

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
  { key: 'open', label: 'Open requests' },
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

function RequestCard({ row, onAct }) {
  const isResolved = Boolean(row.resolved_at);
  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-body text-base font-semibold text-foreground">{row.full_name || row.email || row.id}</p>
          <p className="truncate font-body text-[12px] text-foreground/45">{row.email || 'no email on file'}</p>
        </div>
        <div className="text-right">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/40">Requested</p>
          <p className="font-body text-[12px] text-foreground/65">{formatDate(row.requested_at)}</p>
        </div>
      </div>
      {row.reason && (
        <div className="mt-3 rounded-2xl border border-foreground/[0.08] bg-background/40 px-3 py-2.5">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/35">Reason given</p>
          <p className="mt-1 whitespace-pre-line font-body text-sm text-foreground/80">{row.reason}</p>
        </div>
      )}
      <div className="my-4 border-t border-foreground/[0.08]" />
      {isResolved ? (
        <div className="space-y-1 font-body text-[12px] text-foreground/55">
          <p><span className="text-foreground/40">Resolved</span> · {formatDate(row.resolved_at)}</p>
          {row.resolution_note && <p className="text-foreground/70">Note: {row.resolution_note}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-red-500/30 text-red-200 hover:bg-red-500/[0.08]"
            onClick={() => onAct(row, 'anonymize')}
          >
            <UserX className="h-4 w-4" /> Anonymize
          </Button>
          <Button
            variant="ghost"
            className="gap-2 text-foreground/75 hover:bg-foreground/[0.05]"
            onClick={() => onAct(row, 'deny')}
          >
            <ShieldOff className="h-4 w-4" /> Deny
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ open, row, action, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const isAnonymize = action === 'anonymize';
  const canSubmit = isAnonymize ? confirmText.trim().toUpperCase() === CONFIRM_PHRASE : true;

  useEffect(() => {
    if (!open) { setNote(''); setConfirmText(''); setBusy(false); }
  }, [open]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ profileId: row.id, action, note: note.trim() || undefined });
    } finally {
      setBusy(false);
    }
  };

  if (!open || !row) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-2xl uppercase tracking-[0.04em]">
            <AlertTriangle className={`h-5 w-5 ${isAnonymize ? 'text-red-300' : 'text-amber-300'}`} />
            {isAnonymize ? 'Anonymize account?' : 'Deny deletion request?'}
          </DialogTitle>
          <DialogDescription>
            {row.full_name || row.email || row.id} · {row.email || 'no email'}
          </DialogDescription>
        </DialogHeader>

        {isAnonymize ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 font-body text-sm text-red-100">
              <p className="mb-2 font-semibold uppercase tracking-[0.12em] text-red-200">This will permanently:</p>
              <ul className="list-disc space-y-1 pl-5 text-red-100/95">
                <li>Overwrite name, email, and phone with anonymized placeholders.</li>
                <li>Ban the auth user and sign them out of every active session.</li>
                <li>Stamp the request as resolved. There is no undo.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 py-3 font-body text-sm text-foreground/75">
              <p className="mb-2 font-semibold uppercase tracking-[0.12em] text-foreground/55">What is preserved (legal retention):</p>
              <ul className="list-disc space-y-1 pl-5 text-foreground/70">
                <li>Clinical / visit records and chart notes.</li>
                <li>Appointments, dispatch history, and Acuity links.</li>
                <li>Charges, invoices, ledger rows, and Stripe references.</li>
                <li>Audit trail of this resolution.</li>
              </ul>
            </div>
            <div>
              <label className={LABEL}>Internal note (optional)</label>
              <textarea
                className={FIELD}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Verified identity via support email thread #1234."
              />
            </div>
            <div>
              <label className={LABEL}>Type <span className="text-red-200">{CONFIRM_PHRASE}</span> to confirm</label>
              <input
                className={FIELD}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 font-body text-sm text-amber-100">
              The request will be marked resolved with no PII change. The member's account stays fully active. Tell them why via a separate message.
            </div>
            <div>
              <label className={LABEL}>Reason for denial (optional)</label>
              <textarea
                className={FIELD}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Active care plan in progress; member contacted to reconfirm."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            type="button"
            onClick={submit}
            disabled={busy || !canSubmit}
            className={`gap-2 ${isAnonymize ? 'bg-red-500/90 text-white hover:bg-red-500' : ''}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAnonymize ? <UserX className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />)}
            {isAnonymize ? 'Anonymize account' : 'Mark request denied'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DeletionRequests() {
  const [tab, setTab] = useState('open');
  const [rows, setRows] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [target, setTarget] = useState(null); // { row, action }

  const load = useCallback(async (which) => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet(`/api/admin/deletion-requests?status=${which}`);
      setRows(data?.requests || []);
      setMigrationMissing(data?.resolutionColumnsPresent === false);
      // Keep an authoritative open-count for the tab badge regardless of view.
      if (which === 'open') {
        setOpenCount((data?.requests || []).length);
      } else {
        try {
          const openData = await apiGet('/api/admin/deletion-requests?status=open');
          setOpenCount((openData?.requests || []).length);
        } catch { /* badge is cosmetic */ }
      }
    } catch (err) {
      setError(err?.message || 'Could not load deletion requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const onAct = useCallback((row, action) => {
    setTarget({ row, action });
  }, []);

  const confirm = useCallback(async ({ profileId, action, note }) => {
    setError(null);
    try {
      const res = await apiPost('/api/admin/deletion-requests', { profileId, action, note });
      if (res?.status === 'already_resolved') {
        setNotice('That request was already resolved.');
      } else {
        setNotice(action === 'anonymize'
          ? 'Account anonymized. Auth revoked; clinical and financial records preserved.'
          : 'Request denied. Account is unchanged.');
      }
      setTarget(null);
      load(tab);
    } catch (err) {
      setError(err?.message || 'Could not action the request.');
    }
  }, [load, tab]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  return (
    <AdminShell title="Deletion requests">
      <PageShell embedded subtitle="Member-initiated account deletion. Clinical and financial records are retained by law.">
        {migrationMissing && (
          <Banner kind="warn">
            The resolution columns aren't on <code>profiles</code> yet. Apply the pending migration (see release notes) before actioning any request.
          </Banner>
        )}
        <Banner kind="error" onClose={() => setError(null)}>{error}</Banner>
        <Banner kind="success" onClose={() => setNotice(null)}>{notice}</Banner>

        <TabToggle value={tab} onChange={setTab} openCount={openCount} />

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading deletion requests…</div>
        ) : empty ? (
          <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center">
            <p className="font-body text-sm text-foreground/55">
              {tab === 'open' ? 'No open deletion requests.' : 'No resolved requests to show.'}
            </p>
            <p className="mt-1 font-body text-[12px] text-foreground/35">
              {tab === 'open'
                ? "When a member submits a deletion request from their account, it'll appear here."
                : 'Resolved requests stay on the audit record.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((row) => (
              <RequestCard key={row.id} row={row} onAct={onAct} />
            ))}
          </div>
        )}
      </PageShell>

      <ConfirmDialog
        open={Boolean(target)}
        row={target?.row || null}
        action={target?.action || 'deny'}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
      />
    </AdminShell>
  );
}
