import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowRight,
  AtSign,
  Check,
  CreditCard,
  Fingerprint,
  LogOut,
  Mail,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { readClientProfile, saveClientProfile } from '@/lib/platformOps';
import { authProviderConfig } from '@/lib/authProviderConfig';
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
const BAD = 'hsl(0 70% 62%)';

const CHANNEL_OPTIONS = ['Text first', 'Call first', 'Email summary'];
const PHI_POLICY_OPTIONS = ['Appointment time only', 'Time + service name', 'Full clinical detail OK'];
const COVID_OPTIONS = ['Yes', 'No', 'Prefer not to say'];
const INFECTIOUS_OPTIONS = ['Yes', 'No'];
const IV_HISTORY_OPTIONS = ['Yes, several times', 'Once or twice', 'Never'];

// Merge a server-side /api/me/profile payload into the localStorage-style shape
// readClientProfile() returns. Server values win over locally cached ones for
// the fields the server is now authoritative for (identity + PHI + comms);
// anything the server doesn't track (e.g. subscription stub) falls through.
function mergeServerProfile(local, server) {
  if (!server) return local;
  const merged = { ...(local || {}) };
  const phi = server.phi || {};
  const ec = server.emergencyContact || {};
  const cp = server.commPrefs || {};
  if (server.fullName != null) {
    const parts = String(server.fullName).trim().split(/\s+/);
    if (parts.length) {
      merged.firstName = parts[0] || merged.firstName || '';
      merged.lastName = parts.slice(1).join(' ') || merged.lastName || '';
    }
  }
  if (server.preferredName != null) merged.preferredName = server.preferredName || '';
  if (server.email != null) merged.email = server.email || merged.email || '';
  if (server.phone != null) merged.phone = server.phone || merged.phone || '';
  if (server.dateOfBirth != null) merged.dob = server.dateOfBirth || merged.dob || '';
  if (server.address != null) merged.defaultAddress = server.address || merged.defaultAddress || '';
  if (ec.name != null) merged.emergencyName = ec.name || '';
  if (ec.relationship != null) merged.emergencyRelationship = ec.relationship || '';
  if (ec.phone != null) merged.emergencyContact = ec.phone || '';
  if (phi.allergies != null) merged.allergies = phi.allergies;
  if (phi.medications != null) merged.medications = phi.medications;
  if (phi.conditions != null) merged.medicalConditions = phi.conditions;
  if (phi.covidRecent != null) merged.covidStatus = phi.covidRecent;
  if (phi.infectiousIllness != null) merged.infectiousStatus = phi.infectiousIllness;
  if (phi.ivHistory != null) merged.ivHistory = phi.ivHistory;
  if (phi.nurseNotes != null) merged.nurseNotes = phi.nurseNotes;
  // Clinical-review metadata is set by the RN/admin side, not editable here.
  if (phi.lastReviewedBy != null) merged.lastReviewedBy = phi.lastReviewedBy;
  if (phi.lastReviewedAt != null) merged.lastReviewedAt = phi.lastReviewedAt;
  if (cp.channel != null) merged.smsPreference = cp.channel;
  if (cp.hipaaMention != null) merged.phiPolicy = cp.hipaaMention;
  if (cp.smsReminders != null) merged.appointmentReminders = cp.smsReminders;
  if (cp.emailSummaries != null) merged.visitSummaries = cp.emailSummaries;
  if (cp.marketing != null) merged.wellnessTips = cp.marketing;
  if (cp.quietHours != null) merged.quietHours = cp.quietHours;
  return merged;
}

// Map the form (group/key shape) back to the snake-flavoured camelCase the
// /api/me/profile PATCH endpoint accepts.
function formToServerPayload(form) {
  const allergies = form.health.allergies ? form.health.allergies.split(/\n|,/).map((s) => s.trim()).filter(Boolean) : [];
  const medications = form.health.medications ? form.health.medications.split(/\n|,/).map((s) => s.trim()).filter(Boolean) : [];
  const conditions = form.health.conditions ? form.health.conditions.split(/\n|,/).map((s) => s.trim()).filter(Boolean) : [];
  const fullName = [form.identity.firstName, form.identity.lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ');
  return {
    fullName,
    preferredName: form.identity.preferredName || '',
    address: form.identity.serviceAddress || '',
    dateOfBirth: form.identity.dob || null,
    phone: form.identity.mobile || '',
    emergencyContact: {
      name: form.emergency.name || '',
      relationship: form.emergency.relationship || '',
      phone: form.emergency.phone || '',
    },
    phi: {
      allergies,
      medications,
      conditions,
      covidRecent: form.health.covid || null,
      infectiousIllness: form.health.infectious || null,
      ivHistory: form.health.ivHistory || null,
      nurseNotes: form.health.nurseNotes || '',
    },
    commPrefs: {
      channel: form.comms.channel,
      hipaaMention: form.comms.phiPolicy,
      smsReminders: !!form.comms.appointmentReminders,
      emailSummaries: !!form.comms.visitSummaries,
      marketing: !!form.comms.wellnessTips,
      quietHours: !!form.comms.quietHours,
    },
  };
}

// Build the local form state from the saved client profile (and reasonable stubs).
function buildInitialState(profile, user) {
  const subscription = profile.subscription || {};
  const allergiesText = Array.isArray(profile.allergies) ? profile.allergies.join(', ') : (profile.allergies || '');
  const medsText = Array.isArray(profile.medications) ? profile.medications.join(', ') : (profile.medications || '');
  const conditionsText = Array.isArray(profile.medicalConditions) ? profile.medicalConditions.join(', ') : (profile.medicalConditions || '');
  return {
    identity: {
      firstName: profile.firstName || (user?.name || '').split(' ')[0] || '',
      lastName: profile.lastName || (user?.name || '').split(' ').slice(1).join(' ') || '',
      preferredName: profile.preferredName || '',
      email: profile.email || user?.email || '',
      mobile: profile.phone || '',
      dob: profile.dob || '',
      serviceAddress: profile.defaultAddress || '',
    },
    emergency: {
      name: profile.emergencyName || '',
      relationship: profile.emergencyRelationship || '',
      phone: typeof profile.emergencyContact === 'string' && profile.emergencyContact.match(/\d/) ? profile.emergencyContact : '',
    },
    health: {
      allergies: allergiesText,
      medications: medsText,
      conditions: conditionsText,
      covid: profile.covidStatus || 'No',
      infectious: profile.infectiousStatus || 'No',
      ivHistory: profile.ivHistory || 'Yes, several times',
      nurseNotes: profile.nurseNotes || '',
    },
    comms: {
      channel: profile.smsPreference || 'Text first',
      phiPolicy: profile.phiPolicy || 'Appointment time only',
      appointmentReminders: profile.appointmentReminders ?? true,
      visitSummaries: profile.visitSummaries ?? true,
      wellnessTips: profile.wellnessTips ?? false,
      quietHours: profile.quietHours ?? true,
    },
    // surfaced read-only signals (not persisted from this form). These come from
    // the real record when present; the UI hides any line we don't actually have
    // rather than showing a placeholder.
    plan: subscription.plan || 'Vitality Monthly',
    lastReviewedBy: profile.lastReviewedBy || '',
    lastReviewedAt: profile.lastReviewedAt || '',
  };
}

// Format an ISO date (or pass-through string) for the "last reviewed" line.
function formatReviewDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

// --- Small primitives -----------------------------------------------------

function Section({ title, desc, phi, children }) {
  return (
    <section className="border-t pt-7 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-7" style={{ borderColor: BORDER }}>
      <div className="mb-4 md:mb-0">
        <h2 className="font-heading text-2xl uppercase leading-none">{title}</h2>
        {desc ? <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>{desc}</p> : null}
        {phi ? (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
            <ShieldAlert className="h-3 w-3" strokeWidth={1.8} /> PHI · encrypted
          </span>
        ) : null}
      </div>
      <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, verified, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
        {label}
        {verified ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: 'hsl(140 30% 60% / 0.14)', color: GOOD, border: `1px solid hsl(140 30% 60% / 0.30)` }}>
            <Check className="h-2.5 w-2.5" strokeWidth={2.4} /> Verified
          </span>
        ) : null}
        {hint ? <span className="font-body text-[10px] font-normal normal-case tracking-normal" style={{ color: DIM }}>— {hint}</span> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function inputStyle() {
  return {
    background: CARD_STRONG,
    border: `1px solid ${BORDER}`,
    color: TEXT,
  };
}

function Text({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-3 py-2.5 font-body text-sm outline-none focus:ring-2 focus:ring-foreground/40"
      style={inputStyle()}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl px-3 py-2.5 font-body text-sm outline-none focus:ring-2 focus:ring-foreground/40"
      style={inputStyle()}
    />
  );
}

function Pills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="rounded-full px-3.5 py-2 font-body text-[12px] font-semibold transition-colors"
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

function Toggle({ checked, onChange, name, desc }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors"
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

function AuthRow({ icon, name, desc, action }) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: MUTED }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[13px] font-semibold" style={{ color: TEXT }}>{name}</p>
        {desc ? <p className="mt-0.5 truncate font-body text-[11px]" style={{ color: MUTED }}>{desc}</p> : null}
      </div>
      {action}
    </div>
  );
}

// --- Page ----------------------------------------------------------------

export default function MemberAccount() {
  useSeo({
    title: 'Account — Avalon Vitality',
    description: 'Your account: identity, emergency contact, health record, communication preferences, sign-in, and payment.',
    path: '/members/account',
    robots: 'noindex, nofollow',
  });

  const { user, signOut, registerPasskey, authBackend } = useAuthStore();
  const navigate = useNavigate();

  const initialRef = useRef(null);
  const [form, setForm] = useState(() => {
    const profile = readClientProfile();
    const initial = buildInitialState(profile, user);
    initialRef.current = JSON.stringify(initial);
    return initial;
  });
  const [passkeyState, setPasskeyState] = useState({ busy: false, message: '', error: '' });
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });

  // Default payment method, fetched from /api/me/payment-methods if that
  // endpoint exists. status: 'loading' | 'ready' | 'none' | 'unavailable'.
  const [paymentMethod, setPaymentMethod] = useState({ status: 'loading', card: null });

  // Set-a-password flow (passwordless members can add a fallback password).
  const [pwState, setPwState] = useState({ open: false, value: '', confirm: '', busy: false, message: '', error: '' });
  // Unlink Google identity.
  const [unlinkState, setUnlinkState] = useState({ busy: false, done: false, message: '', error: '' });
  // Account-deletion request.
  const [deleteState, setDeleteState] = useState({ busy: false, done: false, message: '', error: '' });

  // Hydrate from /api/me/profile when we're on the real auth backend so the
  // form reflects the patient's server-side record (the localStorage cache is
  // best-effort — it can be wiped or stale across devices). Demo / passwordless
  // sessions skip this and stay on localStorage only.
  useEffect(() => {
    if (authBackend !== 'supabase') return;
    let cancelled = false;
    apiGet('/api/me/profile')
      .then((res) => {
        if (cancelled) return;
        const server = res?.profile;
        if (!server) return;
        const merged = mergeServerProfile(readClientProfile(), server);
        const next = buildInitialState(merged, user);
        initialRef.current = JSON.stringify(next);
        setForm(next);
      })
      .catch(() => { /* keep the localStorage fallback already in state */ });
    return () => { cancelled = true; };
  }, [authBackend, user]);

  // Fetch the default saved card. /api/me/payment-methods is owned by another
  // surface and may not exist yet — degrade gracefully on 404 to "No card on
  // file" with a link to Billing. Demo sessions skip it entirely.
  useEffect(() => {
    if (authBackend !== 'supabase') { setPaymentMethod({ status: 'unavailable', card: null }); return; }
    let cancelled = false;
    apiGet('/api/me/payment-methods')
      .then((res) => {
        if (cancelled) return;
        const methods = res?.paymentMethods || res?.methods || (res?.card ? [res.card] : []);
        const def = (Array.isArray(methods) ? methods : []).find((m) => m?.isDefault || m?.default) || (Array.isArray(methods) ? methods[0] : null);
        if (def) {
          setPaymentMethod({ status: 'ready', card: def });
        } else {
          setPaymentMethod({ status: 'none', card: null });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 (endpoint not built yet) or any other failure → show the safe
        // "no card on file" state rather than a fake card.
        setPaymentMethod({ status: err?.status === 404 ? 'none' : 'unavailable', card: null });
      });
    return () => { cancelled = true; };
  }, [authBackend, user]);

  const isDirty = useMemo(() => initialRef.current !== JSON.stringify(form), [form]);

  // For change-counter shown in the savebar.
  const changeCount = useMemo(() => {
    if (!initialRef.current) return 0;
    let initial;
    try { initial = JSON.parse(initialRef.current); } catch { return 0; }
    let n = 0;
    const walk = (a, b) => {
      if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        if (a !== b) n += 1;
        return;
      }
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a?.[k], b?.[k]);
    };
    walk(initial, form);
    return n;
  }, [form]);

  const update = (group, key, value) => {
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  };

  // Persist a local cache no matter which backend we're on — keeps BookNow's
  // returning-client prefill working offline, and is the source of truth for
  // demo / passwordless sessions that don't have a Supabase row to PATCH.
  const persistLocal = () => {
    const allergies = form.health.allergies ? form.health.allergies.split(/\n|,/).map((s) => s.trim()).filter(Boolean) : [];
    const medications = form.health.medications ? form.health.medications.split(/\n|,/).map((s) => s.trim()).filter(Boolean) : [];
    const medicalConditions = form.health.conditions ? form.health.conditions.split(/\n|,/).map((s) => s.trim()).filter(Boolean) : [];
    saveClientProfile({
      firstName: form.identity.firstName,
      lastName: form.identity.lastName,
      preferredName: form.identity.preferredName,
      email: form.identity.email,
      phone: form.identity.mobile,
      dob: form.identity.dob,
      defaultAddress: form.identity.serviceAddress,
      emergencyName: form.emergency.name,
      emergencyRelationship: form.emergency.relationship,
      emergencyContact: form.emergency.phone,
      allergies,
      medications,
      medicalConditions,
      covidStatus: form.health.covid,
      infectiousStatus: form.health.infectious,
      ivHistory: form.health.ivHistory,
      nurseNotes: form.health.nurseNotes,
      smsPreference: form.comms.channel,
      phiPolicy: form.comms.phiPolicy,
      appointmentReminders: form.comms.appointmentReminders,
      visitSummaries: form.comms.visitSummaries,
      wellnessTips: form.comms.wellnessTips,
      quietHours: form.comms.quietHours,
    });
  };

  const handleSave = async () => {
    // Demo / passwordless sessions never had a Supabase row — keep them on the
    // localStorage path so the demo surface stays editable without a backend.
    if (authBackend !== 'supabase') {
      persistLocal();
      initialRef.current = JSON.stringify(form);
      setSaveState({ status: 'ok', message: 'Saved.' });
      setTimeout(() => setSaveState({ status: 'idle', message: '' }), 1800);
      return;
    }
    setSaveState({ status: 'saving', message: 'Saving…' });
    try {
      const payload = formToServerPayload(form);
      await apiPatch('/api/me/profile', payload);
      // Mirror to localStorage so BookNow / consumerTruth still see the fresh
      // data without re-fetching, and so the form stays populated if the user
      // navigates away before the next mount fetch resolves.
      persistLocal();
      initialRef.current = JSON.stringify(form);
      setSaveState({ status: 'ok', message: 'Saved.' });
      setTimeout(() => setSaveState({ status: 'idle', message: '' }), 1800);
    } catch (err) {
      setSaveState({ status: 'error', message: err?.message || 'Could not save changes. Please try again.' });
    }
  };

  const handleDiscard = () => {
    if (!initialRef.current) return;
    try { setForm(JSON.parse(initialRef.current)); } catch { /* noop */ }
  };

  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  const handleRegisterPasskey = async () => {
    setPasskeyState({ busy: true, message: '', error: '' });
    const result = await registerPasskey();
    setPasskeyState({
      busy: false,
      message: result.ok ? (result.message || 'Passkey added.') : '',
      error: result.ok ? '' : (result.error || 'Could not add a passkey.'),
    });
  };

  // --- Set a password -----------------------------------------------------
  const handleSetPassword = async () => {
    if (authBackend !== 'supabase') {
      setPwState((s) => ({ ...s, error: 'Available once you sign in with your real account.' }));
      return;
    }
    const value = pwState.value || '';
    if (value.length < 8) {
      setPwState((s) => ({ ...s, error: 'Password must be at least 8 characters.', message: '' }));
      return;
    }
    if (value !== pwState.confirm) {
      setPwState((s) => ({ ...s, error: 'Passwords do not match.', message: '' }));
      return;
    }
    setPwState((s) => ({ ...s, busy: true, error: '', message: '' }));
    try {
      await apiPost('/api/me/account/password', { password: value, mode: 'set' });
      setPwState({ open: false, value: '', confirm: '', busy: false, message: 'Password set. You can now sign in with it.', error: '' });
    } catch (err) {
      setPwState((s) => ({ ...s, busy: false, error: err?.message || 'Could not set your password.', message: '' }));
    }
  };

  // --- Unlink Google ------------------------------------------------------
  const handleUnlinkGoogle = async () => {
    if (authBackend !== 'supabase') {
      setUnlinkState({ busy: false, done: false, message: '', error: 'Available once you sign in with your real account.' });
      return;
    }
    if (!window.confirm('Unlink Google sign-in from your account? You’ll need your magic link or password to sign in next time.')) return;
    setUnlinkState({ busy: true, done: false, message: '', error: '' });
    try {
      await apiPost('/api/me/account/unlink', { provider: 'google' });
      setUnlinkState({ busy: false, done: true, message: 'Google sign-in unlinked.', error: '' });
    } catch (err) {
      setUnlinkState({ busy: false, done: false, message: '', error: err?.message || 'Could not unlink Google.' });
    }
  };

  // --- Delete-account request --------------------------------------------
  const handleDeleteAccount = async () => {
    if (authBackend !== 'supabase') {
      setDeleteState({ busy: false, done: false, message: '', error: 'Available once you sign in with your real account.' });
      return;
    }
    if (!window.confirm('Request deletion of your account? Your clinical records are retained as required by law; our team will follow up to confirm what can be removed.')) return;
    setDeleteState({ busy: true, done: false, message: '', error: '' });
    try {
      const res = await apiPost('/api/me/account/delete-request', {});
      setDeleteState({ busy: false, done: true, message: res?.message || 'Your deletion request has been received.', error: '' });
    } catch (err) {
      setDeleteState({ busy: false, done: false, message: '', error: err?.message || 'Could not submit your request.' });
    }
  };

  const greetingName = form.identity.preferredName || form.identity.firstName || 'Member';

  // Real "last reviewed" line, only when the record actually has it.
  const reviewedBy = form.lastReviewedBy || '';
  const reviewedOn = formatReviewDate(form.lastReviewedAt);
  const hasReviewLine = Boolean(reviewedBy && reviewedOn);

  return (
    <main className="min-h-dvh pb-[calc(9rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center"><AvalonMark className="h-[22px] w-[14px] text-foreground" /></Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Member · Account</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-5 md:px-6 md:pt-7">
        <MemberSectionNav />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-6">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Welcome back, {greetingName}</p>
        <h1 className="mt-1 font-heading text-5xl uppercase leading-none md:text-6xl">Your account</h1>
        <p className="mt-3 max-w-2xl font-body text-sm" style={{ color: MUTED }}>
          Everything we know about you, in one place. Edits save to your medical record and are shared with the providers who see you.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pt-8 md:px-6">

        {/* Identity */}
        <Section title="Identity" desc="Your name, where to reach you, and where we send the nurse.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal first name"><Text value={form.identity.firstName} onChange={(v) => update('identity', 'firstName', v)} /></Field>
            <Field label="Last name"><Text value={form.identity.lastName} onChange={(v) => update('identity', 'lastName', v)} /></Field>
          </div>
          <div className="mt-4">
            <Field label="Preferred name" hint="what your provider calls you"><Text value={form.identity.preferredName} onChange={(v) => update('identity', 'preferredName', v)} placeholder="Optional" /></Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Email" verified={!!form.identity.email}><Text value={form.identity.email} onChange={(v) => update('identity', 'email', v)} type="email" /></Field>
            <Field label="Mobile" verified={!!form.identity.mobile}><Text value={form.identity.mobile} onChange={(v) => update('identity', 'mobile', v)} type="tel" /></Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth"><Text value={form.identity.dob} onChange={(v) => update('identity', 'dob', v)} type="date" /></Field>
            <Field label="Service address" hint="where the RN comes to you"><Text value={form.identity.serviceAddress} onChange={(v) => update('identity', 'serviceAddress', v)} /></Field>
          </div>
        </Section>

        {/* Emergency contact */}
        <Section title="Emergency contact" desc="Who we call if something goes wrong during a visit. Required by your provider before next infusion.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Text value={form.emergency.name} onChange={(v) => update('emergency', 'name', v)} placeholder="e.g. Mara Chen" /></Field>
            <Field label="Relationship"><Text value={form.emergency.relationship} onChange={(v) => update('emergency', 'relationship', v)} placeholder="e.g. Partner, sister" /></Field>
          </div>
          <div className="mt-4">
            <Field label="Phone"><Text value={form.emergency.phone} onChange={(v) => update('emergency', 'phone', v)} type="tel" placeholder="(555) 555-5555" /></Field>
          </div>
        </Section>

        {/* Health record (PHI) */}
        <Section
          title="Health record"
          desc="Your screening answers, kept on file so we don't ask again every visit. Updates are reviewed by your RN before your next appointment."
          phi
        >
          {hasReviewLine ? (
            <div className="mb-5 rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[12px]" style={{ color: TEXT }}>
                <span className="font-semibold">Last reviewed by {reviewedBy} on {reviewedOn}.</span>
              </p>
              <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>
                If any answer below has changed since then, edit it and your provider will be notified.
              </p>
            </div>
          ) : (
            <div className="mb-5 rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[11px]" style={{ color: MUTED }}>
                Your RN reviews this record once a year and before your next visit. Keep your answers current — edits are flagged for your provider.
              </p>
            </div>
          )}

          <Field label="Known allergies" hint="drug, food, environmental">
            <TextArea value={form.health.allergies} onChange={(v) => update('health', 'allergies', v)} placeholder="Penicillin (hives, age 22). Latex (skin contact)." />
          </Field>
          <div className="mt-4">
            <Field label="Current medications & supplements">
              <TextArea value={form.health.medications} onChange={(v) => update('health', 'medications', v)} placeholder="Atorvastatin 10mg daily. Methylated B-complex 1x daily." />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Active medical conditions">
              <TextArea value={form.health.conditions} onChange={(v) => update('health', 'conditions', v)} placeholder="Hypertension (controlled)." />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Tested positive for COVID-19 in the last 10 days?">
              <Pills options={COVID_OPTIONS} value={form.health.covid} onChange={(v) => update('health', 'covid', v)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Any other active infectious illness (flu, strep, gastro)?">
              <Pills options={INFECTIOUS_OPTIONS} value={form.health.infectious} onChange={(v) => update('health', 'infectious', v)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Have you had IV therapy before?">
              <Pills options={IV_HISTORY_OPTIONS} value={form.health.ivHistory} onChange={(v) => update('health', 'ivHistory', v)} />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Anything else your nurse should know">
              <TextArea value={form.health.nurseNotes} onChange={(v) => update('health', 'nurseNotes', v)} placeholder="Vein access notes, fainting history, preferred arm, etc." />
            </Field>
          </div>
        </Section>

        {/* Communication preferences */}
        <Section title="Communication" desc="How we reach you, and what we're allowed to say in a text or voicemail (HIPAA).">
          <Field label="Preferred channel">
            <Pills options={CHANNEL_OPTIONS} value={form.comms.channel} onChange={(v) => update('comms', 'channel', v)} />
          </Field>
          <div className="mt-4">
            <Field label="What we can mention in a message" hint="PHI policy">
              <Pills options={PHI_POLICY_OPTIONS} value={form.comms.phiPolicy} onChange={(v) => update('comms', 'phiPolicy', v)} />
            </Field>
          </div>
          <div className="mt-5">
            <Toggle name="Appointment reminders (SMS)" desc="24h and 1h before your visit." checked={form.comms.appointmentReminders} onChange={(v) => update('comms', 'appointmentReminders', v)} />
            <Toggle name="Visit summaries (email)" desc="Post-visit notes and balance receipts." checked={form.comms.visitSummaries} onChange={(v) => update('comms', 'visitSummaries', v)} />
            <Toggle name="Wellness tips & new services" desc="Occasional product news, never more than 1×/month." checked={form.comms.wellnessTips} onChange={(v) => update('comms', 'wellnessTips', v)} />
            <Toggle name="Quiet hours: 9pm → 8am" desc="No non-urgent messages outside these hours." checked={form.comms.quietHours} onChange={(v) => update('comms', 'quietHours', v)} />
          </div>
        </Section>

        {/* Sign-in */}
        <Section title="Sign-in" desc="How you get in. Snooches uses passwordless sign-in by default — no password to forget.">
          <AuthRow
            icon={<AtSign className="h-4 w-4" strokeWidth={1.8} />}
            name={`Magic link · ${form.identity.email || 'no email on file'}`}
            desc="Primary method. Sent on each new sign-in."
            action={<span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: 'hsl(140 30% 60% / 0.14)', color: GOOD, border: `1px solid hsl(140 30% 60% / 0.30)` }}>Active</span>}
          />
          {authProviderConfig.passkey ? (
            <AuthRow
              icon={<Fingerprint className="h-4 w-4" strokeWidth={1.8} />}
              name="Passkey · this device"
              desc={passkeyState.message || passkeyState.error || 'Use Face ID, Touch ID, or a device passkey next time you sign in.'}
              action={
                <button
                  type="button"
                  onClick={handleRegisterPasskey}
                  disabled={authBackend !== 'supabase' || passkeyState.busy}
                  className="rounded-full px-3.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-45"
                  style={{ background: TEXT, color: INVERT }}
                >
                  {passkeyState.busy ? 'Adding…' : 'Add passkey'}
                </button>
              }
            />
          ) : null}
          <AuthRow
            icon={<Mail className="h-4 w-4" strokeWidth={1.8} />}
            name="Google · one-tap sign-in"
            desc={unlinkState.done ? 'Unlinked.' : (unlinkState.error || unlinkState.message || 'Linked for faster return visits.')}
            action={unlinkState.done ? (
              <span className="font-body text-[11px]" style={{ color: MUTED }}>Removed</span>
            ) : (
              <button
                type="button"
                onClick={handleUnlinkGoogle}
                disabled={unlinkState.busy}
                className="font-body text-[11px] underline underline-offset-4 disabled:opacity-45"
                style={{ color: unlinkState.error ? BAD : MUTED }}
              >
                {unlinkState.busy ? 'Unlinking…' : 'Unlink'}
              </button>
            )}
          />
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            <AuthRow
              icon={<span className="font-heading text-[14px]">·</span>}
              name="Set a password"
              desc={pwState.message || pwState.error || 'Optional fallback if email and passkey are both unavailable while traveling.'}
              action={
                <button
                  type="button"
                  onClick={() => setPwState((s) => ({ ...s, open: !s.open, error: '', message: '' }))}
                  className="rounded-full px-3.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
                >
                  {pwState.open ? 'Cancel' : 'Set password'}
                </button>
              }
            />
            {pwState.open ? (
              <div className="mb-1 ml-12 mr-1 rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="New password">
                    <Text type="password" value={pwState.value} onChange={(v) => setPwState((s) => ({ ...s, value: v }))} placeholder="At least 8 characters" />
                  </Field>
                  <Field label="Confirm password">
                    <Text type="password" value={pwState.confirm} onChange={(v) => setPwState((s) => ({ ...s, confirm: v }))} placeholder="Re-enter password" />
                  </Field>
                </div>
                {pwState.error ? <p className="mt-2 font-body text-[11px]" style={{ color: BAD }}>{pwState.error}</p> : null}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleSetPassword}
                    disabled={pwState.busy}
                    className="rounded-xl px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-45"
                    style={{ background: TEXT, color: INVERT }}
                  >
                    {pwState.busy ? 'Saving…' : 'Save password'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} /> Sign out everywhere
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteState.busy || deleteState.done}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.16em] disabled:opacity-45"
              style={{ background: 'transparent', color: BAD, border: `1px solid hsl(0 70% 62% / 0.40)` }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> {deleteState.busy ? 'Requesting…' : deleteState.done ? 'Request received' : 'Delete account'}
            </button>
          </div>
          {deleteState.message ? (
            <p className="mt-3 font-body text-[11px]" style={{ color: MUTED }}>{deleteState.message}</p>
          ) : null}
          {deleteState.error ? (
            <p className="mt-3 font-body text-[11px]" style={{ color: BAD }}>{deleteState.error}</p>
          ) : null}
        </Section>

        {/* Payment quicklink */}
        <Section title="Payment" desc="Manage saved cards and plan billing on the Billing tab.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {paymentMethod.status === 'loading' ? (
                <div aria-busy="true">
                  <span
                    aria-hidden="true"
                    className="block h-4 w-40 animate-pulse rounded-md"
                    style={{ background: CARD_STRONG }}
                  />
                  <span
                    aria-hidden="true"
                    className="mt-2 block h-3 w-56 animate-pulse rounded-md"
                    style={{ background: CARD_STRONG }}
                  />
                </div>
              ) : paymentMethod.status === 'ready' ? (
                <>
                  <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>
                    {[
                      paymentMethod.card?.brand || paymentMethod.card?.cardBrand || 'Card',
                      'ending',
                      paymentMethod.card?.last4 || paymentMethod.card?.last_four || '••••',
                    ].join(' ')}
                    {(paymentMethod.card?.isDefault || paymentMethod.card?.default) ? ' · default' : ''}
                  </p>
                  {(paymentMethod.card?.expMonth || paymentMethod.card?.exp_month) ? (
                    <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>
                      Expires {String(paymentMethod.card.expMonth || paymentMethod.card.exp_month).padStart(2, '0')}/{String(paymentMethod.card.expYear || paymentMethod.card.exp_year || '').slice(-2)} · used for plan renewals and visit balances
                    </p>
                  ) : (
                    <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>Used for plan renewals and visit balances</p>
                  )}
                </>
              ) : paymentMethod.status === 'unavailable' ? (
                <>
                  <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>Couldn't load your card</p>
                  <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>We hit a snag fetching your saved card. Check it on the Billing tab.</p>
                </>
              ) : (
                <>
                  <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>No card on file</p>
                  <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>Add a card on the Billing tab to cover plan renewals and visit balances.</p>
                </>
              )}
            </div>
            <Link to="/members/billing" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.8} /> {paymentMethod.status === 'ready' ? 'Manage payment methods' : 'Add a card'} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Link>
          </div>
        </Section>
      </div>

      {/* Sticky save bar */}
      {isDirty ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-2xl"
          style={{ background: 'hsl(var(--background) / 0.92)', borderColor: BORDER, paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-6">
            <p className="min-w-0 truncate font-body text-[12px]" style={{ color: saveState.status === 'error' ? BAD : MUTED }}>
              {saveState.status === 'error'
                ? saveState.message
                : (<>You have <span className="font-semibold" style={{ color: TEXT }}>{changeCount} unsaved change{changeCount === 1 ? '' : 's'}</span>.</>)}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={handleDiscard} disabled={saveState.status === 'saving'} className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-45" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
                Discard
              </button>
              <button type="button" onClick={handleSave} disabled={saveState.status === 'saving'} className="rounded-xl px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-45" style={{ background: TEXT, color: INVERT }}>
                {saveState.status === 'saving' ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : saveState.status === 'ok' ? (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-3xl px-4 md:bottom-24 md:px-6">
          <p className="rounded-xl px-3 py-2 text-center font-body text-[11px]" style={{ background: 'hsl(140 30% 60% / 0.14)', color: GOOD, border: `1px solid hsl(140 30% 60% / 0.30)` }}>
            {saveState.message}
          </p>
        </div>
      ) : null}

      <MemberBottomNav />
    </main>
  );
}
