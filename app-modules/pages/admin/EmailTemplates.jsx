// Admin → Email templates (/admin/email-templates). Admin/staff.
// Edit the subject + body of the five known customer emails (welcome, booking
// confirmed, payment receipt, plan renewed, payment failed) without a deploy.
// Live data via /api/admin/email-templates (GET list, PATCH save). Bodies are
// PHI-FREE: only {{firstName}} {{amount}} {{date}} {{planName}} placeholders.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Mail, RotateCcw, Save, Send, X } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { Button } from '@/components/ui/button';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/useAuthStore';

const FIELD = 'min-h-[46px] w-full rounded-2xl border border-foreground/10 bg-background/72 px-4 font-body text-base text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45';
const PLACEHOLDERS = ['{{firstName}}', '{{amount}}', '{{date}}', '{{planName}}'];

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

function Toggle({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${on ? 'border-foreground bg-foreground' : 'border-foreground/30 bg-foreground/[0.06]'}`}
    >
      <span className={`block h-3.5 w-3.5 rounded-full transition-transform ${on ? 'translate-x-[18px] bg-background' : 'translate-x-[3px] bg-foreground/60'}`} />
    </button>
  );
}

// Modal that renders the server-built HTML inside an iframe srcdoc so the
// preview uses a sandboxed document context (no leak into the admin shell's
// styles, no JS execution from the template).
function PreviewModal({ open, onClose, subject, html, busy }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-foreground/15 bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-5 py-4">
          <div className="min-w-0">
            <div className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Preview</div>
            <div className="mt-1 truncate font-body text-sm text-foreground">{subject || (busy ? 'Rendering…' : '(no subject)')}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-full p-1.5 text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-[300px] flex-1 overflow-hidden bg-white">
          {busy ? (
            <div className="flex h-full items-center justify-center text-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={`<!doctype html><html><body style="margin:0;background:#fff;">${html || ''}</body></html>`}
              className="h-[60vh] w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, defaultTestRecipient, onSaved, onErr }) {
  const [subject, setSubject] = useState(template.subject || '');
  const [bodyHtml, setBodyHtml] = useState(template.body_html || '');
  const [enabled, setEnabled] = useState(Boolean(template.enabled));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState({ open: false, busy: false, subject: '', html: '' });
  const [testTo, setTestTo] = useState(defaultTestRecipient || '');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // Keep the "send test to" input in sync with the logged-in staffer's email
    // once it arrives from the API.
    setTestTo((curr) => curr || defaultTestRecipient || '');
  }, [defaultTestRecipient]);

  // Re-sync local edit state if the parent reloads the list (e.g. after save).
  useEffect(() => {
    setSubject(template.subject || '');
    setBodyHtml(template.body_html || '');
    setEnabled(Boolean(template.enabled));
  }, [template.subject, template.body_html, template.enabled]);

  const dirty = subject !== (template.subject || '')
    || bodyHtml !== (template.body_html || '')
    || enabled !== Boolean(template.enabled);

  const save = async () => {
    setBusy(true);
    try {
      const res = await apiPatch('/api/admin/email-templates', {
        key: template.key,
        subject,
        body_html: bodyHtml,
        enabled,
      });
      onSaved(template.key, res?.template, `Saved “${template.label}”.`);
    } catch (err) {
      onErr(err?.message || 'Could not save the template.');
    } finally {
      setBusy(false);
    }
  };

  const resetToDefault = () => {
    setSubject(template.subject || '');
    setBodyHtml(template.body_html || '');
    setEnabled(Boolean(template.enabled));
  };

  // Preview renders against the server so the HTML wrapper matches what the
  // real senders use — what you see here is what the recipient gets.
  const openPreview = async () => {
    setPreview({ open: true, busy: true, subject: '', html: '' });
    try {
      const res = await apiPost('/api/admin/email-templates?action=preview', {
        key: template.key,
        subject,
        body_html: bodyHtml,
      });
      setPreview({
        open: true,
        busy: false,
        subject: res?.subject_rendered || '',
        html: res?.html_rendered || '',
      });
    } catch (err) {
      setPreview({ open: false, busy: false, subject: '', html: '' });
      onErr(err?.message || 'Could not render the preview.');
    }
  };

  const sendTest = async () => {
    const to = String(testTo || '').trim();
    if (!to) { onErr('Enter a recipient email to send a test.'); return; }
    setTesting(true);
    try {
      await apiPost('/api/admin/email-templates?action=send-test', {
        key: template.key,
        subject,
        body_html: bodyHtml,
        to,
      });
      onSaved(template.key, null, `Test "${template.label}" sent to ${to}.`);
    } catch (err) {
      onErr(err?.message || 'Could not send the test email.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-foreground/55" strokeWidth={1.8} />
            <h3 className="font-heading text-xl uppercase leading-none tracking-[0.04em] text-foreground">{template.label}</h3>
          </div>
          <p className="mt-1.5 font-body text-[12px] text-foreground/45">{template.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/45">
            {enabled ? 'Override on' : 'Default'}
          </span>
          <Toggle on={enabled} onToggle={() => setEnabled((v) => !v)} disabled={busy} />
        </div>
      </div>

      <div className="mb-3">
        <label className={LABEL}>Subject</label>
        <input className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" />
      </div>
      <div className="mb-3">
        <label className={LABEL}>Body (HTML)</label>
        <textarea
          className={`${FIELD} min-h-[150px] py-3 font-mono text-[13px] leading-relaxed`}
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          placeholder="<p>Hi {{firstName}}, …</p>"
        />
        <p className="mt-2 font-body text-[11px] text-foreground/40">
          Placeholders: {PLACEHOLDERS.map((p) => (
            <code key={p} className="mx-0.5 rounded bg-foreground/[0.06] px-1 py-0.5 text-foreground/60">{p}</code>
          ))}
          . Keep it PHI-free — no diagnoses, medications, conditions, or addresses.
        </p>
      </div>

      {/* Test-send row — staffer can ship a real branded email to themselves
          or any address. Rate-limited server-side (10/min/staff). */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.02] px-3 py-2.5">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Send test to</span>
        <input
          type="email"
          className="min-w-[200px] flex-1 rounded-xl border border-foreground/10 bg-background/72 px-3 py-1.5 font-body text-[13px] text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          placeholder="you@avalonvitality.co"
          disabled={testing}
        />
        <Button variant="ghost" size="sm" className="gap-1.5" disabled={testing || !testTo} onClick={sendTest}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="font-body text-[11px] text-foreground/35">
          {template.overridden
            ? (template.updated_at ? `Last saved ${new Date(template.updated_at).toLocaleString()}` : 'Saved')
            : 'Using the built-in default'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={openPreview}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          {dirty && (
            <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={resetToDefault}>
              <RotateCcw className="h-4 w-4" /> Revert
            </Button>
          )}
          <Button className="gap-2" disabled={busy || !dirty} onClick={save}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </div>

      <PreviewModal
        open={preview.open}
        busy={preview.busy}
        subject={preview.subject}
        html={preview.html}
        onClose={() => setPreview({ open: false, busy: false, subject: '', html: '' })}
      />
    </div>
  );
}

export default function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [tableMissing, setTableMissing] = useState(false);
  const { user } = useAuthStore();
  const defaultTestRecipient = user?.email || '';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet('/api/admin/email-templates');
      setTemplates(data?.templates || []);
      setTableMissing(Boolean(data?.tableMissing));
    } catch (err) {
      setError(err?.message || 'Could not load email templates.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaved = useCallback((key, saved, msg) => {
    setNotice(msg);
    if (saved) {
      setTemplates((prev) => prev.map((t) => (t.key === key ? { ...t, ...saved } : t)));
    }
  }, []);

  const subtitle = useMemo(
    () => 'Edit the customer emails Avalon sends. Changes apply within a minute — no deploy needed.',
    [],
  );

  return (
    <AdminShell title="Email templates">
      <PageShell embedded subtitle={subtitle}>
        {tableMissing && (
          <Banner kind="warn">
            The <code>email_templates</code> table hasn’t been created yet, so these show the built-in defaults and saving is disabled until the migration runs. Ask an engineer to apply the <code>email_templates</code> migration.
          </Banner>
        )}
        <Banner kind="error" onClose={() => setError(null)}>{error}</Banner>
        <Banner kind="success" onClose={() => setNotice(null)}>{notice}</Banner>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((t) => (
              <TemplateCard
                key={t.key}
                template={t}
                defaultTestRecipient={defaultTestRecipient}
                onSaved={onSaved}
                onErr={setError}
              />
            ))}
          </div>
        )}
      </PageShell>
    </AdminShell>
  );
}
