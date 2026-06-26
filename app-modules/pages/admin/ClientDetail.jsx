/**
 * Patient detail — /admin/clients/:id
 *
 * Staff/admin full view of a single patient. Mirrors the look-and-feel of the
 * member Account page (so the form maps 1:1 between what the patient sees and
 * what staff edits) and adds admin-only sections: plan & credits, payment
 * methods, appointment history, and the audit trail.
 *
 * Role gating:
 *  - Staff (non-admin): identity / emergency / PHI clinical fields / comms /
 *    plan / status / role are READ-ONLY. They can edit the "Nurse notes"
 *    textarea, and they can adjust credits (the make-good workflow).
 *  - Admin: every field is editable.
 *
 * The server (api/admin/clients/[id].js) enforces the same boundary — the UI
 * disable is defence-in-depth, not the security model.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { useAuthStore } from '@/lib/useAuthStore';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const GOOD = 'hsl(140 30% 60%)';
const WARN = 'hsl(38 92% 72%)';
const BAD = 'hsl(0 70% 62%)';

const CHANNEL_OPTIONS = ['Text first', 'Call first', 'Email summary'];
const PHI_POLICY_OPTIONS = ['Appointment time only', 'Time + service name', 'Full clinical detail OK'];
const COVID_OPTIONS = ['Yes', 'No', 'Prefer not to say'];
const INFECTIOUS_OPTIONS = ['Yes', 'No'];
const IV_HISTORY_OPTIONS = ['Yes, several times', 'Once or twice', 'Never'];
const STATUS_OPTIONS = ['active', 'inactive', 'archived'];
const ROLE_OPTIONS = ['client', 'staff', 'admin'];

// --- formatting --------------------------------------------------------------

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function money(value) {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function joinName(v) {
  return (v || '').toString().trim();
}

// Convert the server PHI shape to/from the form's flat strings, same as
// members/Account.jsx so the two surfaces stay aligned.
function phiArrayToText(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

function textToPhiArray(text) {
  return (text || '').split(/\n|,/).map((s) => s.trim()).filter(Boolean);
}

function buildFormFromClient(client) {
  const phi = client?.phi || {};
  const ec = client?.emergencyContact || {};
  const cp = client?.commPrefs || {};
  return {
    identity: {
      fullName: client?.fullName || '',
      preferredName: client?.preferredName || '',
      email: client?.email || '',
      phone: client?.phone || '',
      dateOfBirth: client?.dateOfBirth || '',
      address: client?.address || '',
    },
    emergency: {
      name: ec.name || '',
      relationship: ec.relationship || '',
      phone: ec.phone || '',
    },
    health: {
      allergies: phiArrayToText(phi.allergies),
      medications: phiArrayToText(phi.medications),
      conditions: phiArrayToText(phi.conditions),
      covid: phi.covidRecent || 'No',
      infectious: phi.infectiousIllness || 'No',
      ivHistory: phi.ivHistory || 'Yes, several times',
      nurseNotes: phi.nurseNotes || '',
      lastReviewedAt: phi.lastReviewedAt || null,
      lastReviewedBy: phi.lastReviewedBy || null,
    },
    comms: {
      channel: cp.channel || 'Text first',
      phiPolicy: cp.hipaaMention || 'Appointment time only',
      smsReminders: cp.smsReminders ?? true,
      emailSummaries: cp.emailSummaries ?? true,
      marketing: cp.marketing ?? false,
      quietHours: cp.quietHours ?? true,
    },
    admin: {
      status: client?.status || 'active',
      role: client?.role || 'client',
    },
  };
}

function diffFormToPatch(initialForm, currentForm, role) {
  const patch = {};
  if (!initialForm || !currentForm) return patch;

  const isStaff = role !== 'admin';

  // Identity / emergency / comms / admin — admin only.
  if (!isStaff) {
    if (currentForm.identity.fullName !== initialForm.identity.fullName) patch.fullName = currentForm.identity.fullName;
    if (currentForm.identity.preferredName !== initialForm.identity.preferredName) patch.preferredName = currentForm.identity.preferredName;
    if (currentForm.identity.phone !== initialForm.identity.phone) patch.phone = currentForm.identity.phone;
    if (currentForm.identity.address !== initialForm.identity.address) patch.address = currentForm.identity.address;
    if (currentForm.identity.dateOfBirth !== initialForm.identity.dateOfBirth) patch.dateOfBirth = currentForm.identity.dateOfBirth;
    const ecChanged = ['name', 'relationship', 'phone'].some(
      (k) => currentForm.emergency[k] !== initialForm.emergency[k]
    );
    if (ecChanged) {
      patch.emergencyContact = {
        name: currentForm.emergency.name,
        relationship: currentForm.emergency.relationship,
        phone: currentForm.emergency.phone,
      };
    }
    const commsChanged = ['channel', 'phiPolicy', 'smsReminders', 'emailSummaries', 'marketing', 'quietHours']
      .some((k) => currentForm.comms[k] !== initialForm.comms[k]);
    if (commsChanged) {
      patch.commPrefs = {
        channel: currentForm.comms.channel,
        hipaaMention: currentForm.comms.phiPolicy,
        smsReminders: !!currentForm.comms.smsReminders,
        emailSummaries: !!currentForm.comms.emailSummaries,
        marketing: !!currentForm.comms.marketing,
        quietHours: !!currentForm.comms.quietHours,
      };
    }
    if (currentForm.admin.status !== initialForm.admin.status) patch.status = currentForm.admin.status;
    if (currentForm.admin.role !== initialForm.admin.role) patch.role = currentForm.admin.role;
  }

  // PHI — admin gets all fields, staff gets nurseNotes only.
  const phiChanged = ['allergies', 'medications', 'conditions', 'covid', 'infectious', 'ivHistory', 'nurseNotes']
    .some((k) => currentForm.health[k] !== initialForm.health[k]);

  if (phiChanged) {
    if (isStaff) {
      // Staff: only nurseNotes; we send it via the convenience field.
      if (currentForm.health.nurseNotes !== initialForm.health.nurseNotes) {
        patch.nurseNotes = currentForm.health.nurseNotes;
      }
    } else {
      patch.phi = {
        allergies: textToPhiArray(currentForm.health.allergies),
        medications: textToPhiArray(currentForm.health.medications),
        conditions: textToPhiArray(currentForm.health.conditions),
        covidRecent: currentForm.health.covid,
        infectiousIllness: currentForm.health.infectious,
        ivHistory: currentForm.health.ivHistory,
        nurseNotes: currentForm.health.nurseNotes,
        lastReviewedAt: new Date().toISOString(),
      };
    }
  }

  return patch;
}

// --- primitives --------------------------------------------------------------

function Section({ title, desc, phi, right, children }) {
  return (
    <section className="border-t pt-7 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-7" style={{ borderColor: BORDER }}>
      <div className="mb-4 md:mb-0">
        <h2 className="font-heading text-2xl uppercase leading-none">{title}</h2>
        {desc ? <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>{desc}</p> : null}
        {phi ? (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
            <ShieldAlert className="h-3 w-3" strokeWidth={1.8} /> PHI · audited
          </span>
        ) : null}
        {right ? <div className="mt-3">{right}</div> : null}
      </div>
      <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
        {label}
        {hint ? <span className="font-body text-[10px] font-normal normal-case tracking-normal" style={{ color: DIM }}>— {hint}</span> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputStyle = {
  background: CARD_STRONG,
  border: `1px solid ${BORDER}`,
  color: TEXT,
};

function Text({ value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-xl px-3 py-2.5 font-body text-sm outline-none focus:ring-2 focus:ring-foreground/40 disabled:opacity-60"
      style={inputStyle}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3, disabled }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full rounded-xl px-3 py-2.5 font-body text-sm outline-none focus:ring-2 focus:ring-foreground/40 disabled:opacity-60"
      style={inputStyle}
    />
  );
}

function Pills({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => !disabled && onChange(opt)}
            disabled={disabled}
            className="rounded-full px-3.5 py-2 font-body text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: active ? TEXT : CARD_STRONG,
              color: active ? INVERT : TEXT,
              border: `1px solid ${active ? TEXT : BORDER}`,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, name, desc, disabled }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50"
        style={{ background: checked ? TEXT : CARD_STRONG, border: `1px solid ${BORDER}` }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
          style={{
            left: checked ? 'calc(100% - 1.125rem)' : '0.125rem',
            background: checked ? INVERT : TEXT,
          }}
        />
      </button>
      <div className="min-w-0">
        <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>{name}</p>
        {desc ? <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>{desc}</p> : null}
      </div>
    </div>
  );
}

// --- page --------------------------------------------------------------------

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const role = user?.role || 'client';
  const isAdmin = role === 'admin';
  const canEditPhi = role === 'admin' || role === 'staff';

  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [form, setForm] = useState(null);
  const initialRef = useRef(null);
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });

  // Credits form
  const [credits, setCredits] = useState({ units: '', note: '', status: 'idle', error: '' });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await apiGet(`/api/admin/clients/${encodeURIComponent(id)}`);
      const next = buildFormFromClient(data?.client);
      initialRef.current = JSON.stringify(next);
      setForm(next);
      setState({ loading: false, error: '', data });
    } catch (err) {
      setState({ loading: false, error: 'Could not load client. (' + (err?.message || 'unknown') + ')', data: null });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useMemo(() => initialRef.current && JSON.stringify(form) !== initialRef.current, [form]);

  const updateGroup = (group, key, value) => {
    setForm((prev) => prev ? ({ ...prev, [group]: { ...prev[group], [key]: value } }) : prev);
  };

  const handleSave = async () => {
    if (!form) return;
    const initial = initialRef.current ? JSON.parse(initialRef.current) : null;
    const patch = diffFormToPatch(initial, form, role);
    if (!Object.keys(patch).length) {
      setSaveState({ status: 'ok', message: 'Nothing to save.' });
      setTimeout(() => setSaveState({ status: 'idle', message: '' }), 1500);
      return;
    }
    setSaveState({ status: 'saving', message: 'Saving…' });
    try {
      const updated = await apiPatch(`/api/admin/clients/${encodeURIComponent(id)}`, patch);
      const next = buildFormFromClient(updated?.client);
      initialRef.current = JSON.stringify(next);
      setForm(next);
      setState((s) => ({ ...s, data: updated }));
      setSaveState({ status: 'ok', message: 'Saved.' });
      setTimeout(() => setSaveState({ status: 'idle', message: '' }), 1800);
    } catch (err) {
      setSaveState({ status: 'error', message: err?.message || 'Save failed.' });
    }
  };

  const handleRevert = () => {
    if (!initialRef.current) return;
    try { setForm(JSON.parse(initialRef.current)); } catch { /* noop */ }
    setSaveState({ status: 'idle', message: '' });
  };

  const submitCredit = async (e) => {
    e?.preventDefault?.();
    const units = parseInt(credits.units, 10);
    if (!Number.isFinite(units) || units === 0) {
      setCredits((s) => ({ ...s, error: 'Enter a non-zero whole number.' }));
      return;
    }
    if (!credits.note.trim()) {
      setCredits((s) => ({ ...s, error: 'A note is required.' }));
      return;
    }
    setCredits((s) => ({ ...s, status: 'saving', error: '' }));
    try {
      await apiPost(`/api/admin/clients/${encodeURIComponent(id)}/credits`, {
        units,
        note: credits.note.trim(),
      });
      setCredits({ units: '', note: '', status: 'idle', error: '' });
      await load();
    } catch (err) {
      setCredits((s) => ({ ...s, status: 'idle', error: err?.message || 'Could not adjust credits.' }));
    }
  };

  const { loading, error, data } = state;
  const client = data?.client;

  return (
    <AdminShell title="Patient detail">
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className="mx-auto max-w-5xl px-4 py-2 md:px-8 md:py-3">
          <button
            type="button"
            onClick={() => navigate('/admin/clients')}
            className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Patients
          </button>

          {loading ? (
            <p className="font-body text-sm" style={{ color: MUTED }}>Loading…</p>
          ) : null}

          {error ? (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: BAD }}>
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="font-body text-sm">{error}</span>
              <button type="button" onClick={load} className="ml-auto rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase" style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}>
                Retry
              </button>
            </div>
          ) : null}

          {!loading && !error && client && form ? (
            <>
              {/* Header */}
              <header className="flex flex-wrap items-start gap-4 rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  <User className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate font-heading text-3xl uppercase leading-none">{joinName(client.fullName) || client.email || 'Unknown'}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs" style={{ color: MUTED }}>
                    <span>{client.email || '—'}</span>
                    {client.phone ? <span>{client.phone}</span> : null}
                    <span>Joined {fmtDate(client.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
                      {client.role || 'client'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{
                        background: CARD_STRONG,
                        color: client.status === 'active' ? GOOD : (client.status === 'archived' ? BAD : WARN),
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      {client.status || 'unknown'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    disabled
                    title="Impersonation TBD — opens client portal as this user"
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-body text-[11px] font-bold uppercase tracking-[0.14em] opacity-50"
                    style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}`, cursor: 'not-allowed' }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} /> Open as client
                  </button>
                  <button
                    type="button"
                    onClick={load}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
                  >
                    <RefreshCw className="h-3 w-3" strokeWidth={2} /> Refresh
                  </button>
                </div>
              </header>

              {!isAdmin ? (
                <div className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: MUTED }}>
                  <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="font-body text-[12px]">
                    Read-only view (staff tier). You may update <strong style={{ color: TEXT }}>Nurse notes</strong> and adjust <strong style={{ color: TEXT }}>credits</strong>. Ask an admin to change identity, PHI, plan, or communication preferences.
                  </span>
                </div>
              ) : null}

              <div className="mt-8 grid gap-8">
                {/* Identity */}
                <Section title="Identity" desc="Legal name, contact, address, DOB.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full name">
                      <Text value={form.identity.fullName} onChange={(v) => updateGroup('identity', 'fullName', v)} disabled={!isAdmin} />
                    </Field>
                    <Field label="Preferred name">
                      <Text value={form.identity.preferredName} onChange={(v) => updateGroup('identity', 'preferredName', v)} disabled={!isAdmin} />
                    </Field>
                    <Field label="Email" hint="read-only">
                      <Text value={form.identity.email} onChange={() => { /* read-only */ }} disabled />
                    </Field>
                    <Field label="Phone">
                      <Text value={form.identity.phone} onChange={(v) => updateGroup('identity', 'phone', v)} disabled={!isAdmin} />
                    </Field>
                    <Field label="Date of birth">
                      <Text type="date" value={form.identity.dateOfBirth || ''} onChange={(v) => updateGroup('identity', 'dateOfBirth', v)} disabled={!isAdmin} />
                    </Field>
                    <Field label="Service address">
                      <Text value={form.identity.address} onChange={(v) => updateGroup('identity', 'address', v)} disabled={!isAdmin} />
                    </Field>
                  </div>
                  {isAdmin ? (
                    <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2" style={{ borderColor: BORDER }}>
                      <Field label="Status">
                        <Pills options={STATUS_OPTIONS} value={form.admin.status} onChange={(v) => updateGroup('admin', 'status', v)} />
                      </Field>
                      <Field label="Role">
                        <Pills options={ROLE_OPTIONS} value={form.admin.role} onChange={(v) => updateGroup('admin', 'role', v)} />
                      </Field>
                    </div>
                  ) : null}
                </Section>

                {/* Emergency contact */}
                <Section title="Emergency contact" phi>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Name">
                      <Text value={form.emergency.name} onChange={(v) => updateGroup('emergency', 'name', v)} disabled={!isAdmin} />
                    </Field>
                    <Field label="Relationship">
                      <Text value={form.emergency.relationship} onChange={(v) => updateGroup('emergency', 'relationship', v)} disabled={!isAdmin} />
                    </Field>
                    <Field label="Phone">
                      <Text value={form.emergency.phone} onChange={(v) => updateGroup('emergency', 'phone', v)} disabled={!isAdmin} />
                    </Field>
                  </div>
                </Section>

                {/* PHI */}
                <Section
                  title="Health record"
                  desc="PHI. Every edit emits an audit row."
                  phi
                  right={form.health.lastReviewedAt ? (
                    <p className="font-body text-[11px]" style={{ color: DIM }}>
                      Reviewed {fmtDateTime(form.health.lastReviewedAt)}{form.health.lastReviewedBy ? ` · ${form.health.lastReviewedBy}` : ''}
                    </p>
                  ) : null}
                >
                  <div className="grid gap-4">
                    <Field label="Allergies" hint="comma- or newline-separated">
                      <TextArea value={form.health.allergies} onChange={(v) => updateGroup('health', 'allergies', v)} disabled={!isAdmin} placeholder="Sulfa, latex…" />
                    </Field>
                    <Field label="Medications">
                      <TextArea value={form.health.medications} onChange={(v) => updateGroup('health', 'medications', v)} disabled={!isAdmin} placeholder="Levothyroxine 50mcg…" />
                    </Field>
                    <Field label="Conditions">
                      <TextArea value={form.health.conditions} onChange={(v) => updateGroup('health', 'conditions', v)} disabled={!isAdmin} placeholder="Hypothyroidism…" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="COVID-19 in last 14 days">
                        <Pills options={COVID_OPTIONS} value={form.health.covid} onChange={(v) => updateGroup('health', 'covid', v)} disabled={!isAdmin} />
                      </Field>
                      <Field label="Active infectious illness">
                        <Pills options={INFECTIOUS_OPTIONS} value={form.health.infectious} onChange={(v) => updateGroup('health', 'infectious', v)} disabled={!isAdmin} />
                      </Field>
                      <Field label="Prior IV therapy">
                        <Pills options={IV_HISTORY_OPTIONS} value={form.health.ivHistory} onChange={(v) => updateGroup('health', 'ivHistory', v)} disabled={!isAdmin} />
                      </Field>
                    </div>
                    <Field label="Nurse notes" hint="staff + admin">
                      <TextArea
                        value={form.health.nurseNotes}
                        onChange={(v) => updateGroup('health', 'nurseNotes', v)}
                        disabled={!canEditPhi}
                        rows={4}
                        placeholder="Visit observations, follow-up plan, IV preferences…"
                      />
                    </Field>
                  </div>
                </Section>

                {/* Communication prefs */}
                <Section title="Communications">
                  <Field label="Preferred channel">
                    <Pills options={CHANNEL_OPTIONS} value={form.comms.channel} onChange={(v) => updateGroup('comms', 'channel', v)} disabled={!isAdmin} />
                  </Field>
                  <div className="mt-4">
                    <Field label="HIPAA mention in SMS">
                      <Pills options={PHI_POLICY_OPTIONS} value={form.comms.phiPolicy} onChange={(v) => updateGroup('comms', 'phiPolicy', v)} disabled={!isAdmin} />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Toggle checked={!!form.comms.smsReminders} onChange={(v) => updateGroup('comms', 'smsReminders', v)} name="Appointment reminders" desc="Pre-visit text the day before." disabled={!isAdmin} />
                    <Toggle checked={!!form.comms.emailSummaries} onChange={(v) => updateGroup('comms', 'emailSummaries', v)} name="Visit summaries" desc="Receipt + visit notes after each session." disabled={!isAdmin} />
                    <Toggle checked={!!form.comms.marketing} onChange={(v) => updateGroup('comms', 'marketing', v)} name="Marketing / wellness tips" disabled={!isAdmin} />
                    <Toggle checked={!!form.comms.quietHours} onChange={(v) => updateGroup('comms', 'quietHours', v)} name="Respect quiet hours" desc="No SMS 9 PM – 8 AM local time." disabled={!isAdmin} />
                  </div>
                </Section>

                {/* Plan & credits */}
                <Section title="Plan & credits" desc="Stripe subscription + IV credit ledger.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                      <p className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Subscription</p>
                      {data?.subscription ? (
                        <div className="mt-2 grid gap-1">
                          <p className="font-heading text-lg uppercase">{data.subscription.priceNickname || data.subscription.priceId || 'Active plan'}</p>
                          <p className="font-body text-xs" style={{ color: MUTED }}>
                            {data.subscription.status} · {data.subscription.unitAmount != null ? `${money(data.subscription.unitAmount)} / ${data.subscription.interval || 'month'}` : '—'}
                          </p>
                          {data.subscription.currentPeriodEnd ? (
                            <p className="font-body text-xs" style={{ color: DIM }}>Renews {fmtDate(data.subscription.currentPeriodEnd)}</p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>No active subscription.</p>
                      )}
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                      <p className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Credit balance</p>
                      <p className="mt-2 font-heading text-3xl uppercase leading-none">{data?.creditBalance ?? 0}</p>
                      <p className="mt-1 font-body text-xs" style={{ color: MUTED }}>IV credits available · never expire</p>
                    </div>
                  </div>

                  <form onSubmit={submitCredit} className="mt-5 grid gap-3 rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                    <p className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Adjust credits</p>
                    <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                      <Text
                        value={credits.units}
                        onChange={(v) => setCredits((s) => ({ ...s, units: v.replace(/[^\-0-9]/g, '') }))}
                        placeholder="±units"
                      />
                      <Text
                        value={credits.note}
                        onChange={(v) => setCredits((s) => ({ ...s, note: v }))}
                        placeholder="Reason (required)"
                      />
                      <button
                        type="submit"
                        disabled={credits.status === 'saving'}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-[11px] font-bold uppercase tracking-[0.16em] disabled:opacity-50"
                        style={{ background: TEXT, color: INVERT, border: `1px solid ${TEXT}` }}
                      >
                        {credits.status === 'saving' ? 'Posting…' : 'Post adjustment'}
                      </button>
                    </div>
                    {credits.error ? <p className="font-body text-xs" style={{ color: BAD }}>{credits.error}</p> : null}
                  </form>

                  <div className="mt-5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Recent ledger</p>
                    <div className="mt-2 grid gap-1.5">
                      {(data?.creditLedger || []).length === 0 ? (
                        <p className="font-body text-xs" style={{ color: MUTED }}>No credit activity yet.</p>
                      ) : null}
                      {(data?.creditLedger || []).map((row) => (
                        <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                          <span className="font-body text-xs font-semibold" style={{ color: row.units > 0 ? GOOD : BAD }}>
                            {row.units > 0 ? '+' : ''}{row.units}
                          </span>
                          <span className="font-body text-xs flex-1 min-w-0 truncate" style={{ color: TEXT }}>
                            {row.description || row.source}
                          </span>
                          <span className="font-body text-[11px]" style={{ color: DIM }}>{fmtDateTime(row.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>

                {/* Payment methods */}
                <Section title="Payment methods" desc="Cards on file in Stripe.">
                  {(data?.paymentMethods || []).length === 0 ? (
                    <p className="font-body text-sm" style={{ color: MUTED }}>No cards on file.</p>
                  ) : (
                    <div className="grid gap-2">
                      {data.paymentMethods.map((pm) => (
                        <div key={pm.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                          <CreditCard className="h-4 w-4" strokeWidth={1.8} />
                          <span className="font-body text-sm font-semibold uppercase">{pm.brand}</span>
                          <span className="font-body text-sm">•••• {pm.last4}</span>
                          <span className="ml-auto font-body text-xs" style={{ color: DIM }}>{pm.expMonth?.toString().padStart(2, '0')}/{pm.expYear}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 font-body text-[11px]" style={{ color: DIM }}>
                    Card edits happen in the Stripe customer portal (link from the client's billing page).
                  </p>
                </Section>

                {/* Appointments */}
                <Section title="Appointments" desc="Recent 50 visits — newest first.">
                  {(data?.appointments || []).length === 0 ? (
                    <p className="font-body text-sm" style={{ color: MUTED }}>No appointments on record.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full font-body text-sm">
                        <thead>
                          <tr style={{ color: DIM }}>
                            <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.14em]">When</th>
                            <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.14em]">Service</th>
                            <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.14em]">Provider</th>
                            <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.14em]">Status</th>
                            <th className="text-right py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.14em]">Balance</th>
                            <th className="text-right py-2 text-[10px] font-bold uppercase tracking-[0.14em]">View</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.appointments.map((appt) => (
                            <tr key={appt.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                              <td className="py-2 pr-3 align-top">{fmtDateTime(appt.startsAt)}</td>
                              <td className="py-2 pr-3 align-top">{appt.service}</td>
                              <td className="py-2 pr-3 align-top" style={{ color: MUTED }}>{appt.provider || '—'}</td>
                              <td className="py-2 pr-3 align-top" style={{ color: MUTED }}>{appt.status}</td>
                              <td className="py-2 pr-3 align-top text-right" style={{ color: appt.balanceDue > 0 ? WARN : MUTED }}>{money(appt.balanceDue)}</td>
                              <td className="py-2 text-right">
                                <Link
                                  to={`/admin/bookings?focus=${encodeURIComponent(appt.id)}`}
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
                                  style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
                                >
                                  Open
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                {/* Audit trail */}
                <Section title="Audit trail" desc="Recent 20 events scoped to this profile.">
                  {(data?.auditTrail || []).length === 0 ? (
                    <p className="font-body text-sm" style={{ color: MUTED }}>No audit events on record.</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {data.auditTrail.map((ev) => (
                        <div key={ev.id} className="grid grid-cols-[140px_1fr_auto] gap-3 rounded-xl px-3 py-2 font-body text-xs" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                          <span style={{ color: DIM }}>{fmtDateTime(ev.occurredAt)}</span>
                          <span>
                            <strong style={{ color: TEXT }}>{ev.action}</strong>
                            {ev.fields?.length ? <span style={{ color: MUTED }}> · {ev.fields.join(', ')}</span> : null}
                          </span>
                          {ev.phiTouched ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: 'hsl(38 92% 72% / 0.15)', color: WARN, border: `1px solid hsl(38 92% 72% / 0.3)` }}>
                              <ShieldAlert className="h-2.5 w-2.5" strokeWidth={2.4} /> PHI
                            </span>
                          ) : <span />}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              {/* Sticky save bar */}
              {isDirty || saveState.status !== 'idle' ? (
                <div
                  className="sticky bottom-4 mt-8 flex items-center gap-3 rounded-full px-4 py-3 font-body text-sm shadow-2xl"
                  style={{ background: TEXT, color: INVERT, border: `1px solid ${TEXT}` }}
                >
                  <span className="flex-1">
                    {saveState.status === 'saving' ? saveState.message
                      : saveState.status === 'ok' ? (<><Check className="mr-1 inline h-4 w-4" /> {saveState.message}</>)
                      : saveState.status === 'error' ? (<><AlertCircle className="mr-1 inline h-4 w-4" /> {saveState.message}</>)
                      : 'Unsaved changes'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRevert}
                    disabled={!isDirty || saveState.status === 'saving'}
                    className="rounded-full px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] disabled:opacity-40"
                    style={{ background: 'transparent', color: INVERT, border: `1px solid ${INVERT}` }}
                  >
                    Revert
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || saveState.status === 'saving'}
                    className="rounded-full px-4 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] disabled:opacity-40"
                    style={{ background: INVERT, color: TEXT, border: `1px solid ${INVERT}` }}
                  >
                    {saveState.status === 'saving' ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
