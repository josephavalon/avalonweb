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
    // surfaced read-only signals (not persisted from this form)
    plan: subscription.plan || 'Vitality Monthly',
    paymentCard: 'Visa ending 4242 · default',
    lastReviewedBy: 'Jules Ortega, RN',
    lastReviewedOn: 'May 12, 2026',
  };
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
    title: 'Account - Avalon Vitality',
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

  const handleSave = () => {
    // TODO(snooches): wire to Supabase profiles + phi_record tables — for now persist
    // to localStorage via saveClientProfile so the rest of the demo surface stays consistent.
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
    initialRef.current = JSON.stringify(form);
    setSaveState({ status: 'ok', message: 'Saved.' });
    setTimeout(() => setSaveState({ status: 'idle', message: '' }), 1800);
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

  const greetingName = form.identity.preferredName || form.identity.firstName || 'Member';

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
          <div className="mb-5 rounded-2xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[12px]" style={{ color: TEXT }}>
              <span className="font-semibold">Last reviewed by {form.lastReviewedBy} on {form.lastReviewedOn}.</span>
            </p>
            <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>
              If any answer below has changed since then, edit it and your provider will be notified.
            </p>
          </div>

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
            desc="Linked for faster return visits."
            action={<button type="button" className="font-body text-[11px] underline underline-offset-4" style={{ color: MUTED }}>Unlink</button>}
          />
          <AuthRow
            icon={<span className="font-heading text-[14px]">·</span>}
            name="Set a password"
            desc="Optional fallback if email and passkey are both unavailable while traveling."
            action={<button type="button" className="rounded-full px-3.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>Set password</button>}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} /> Sign out everywhere
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ background: 'transparent', color: BAD, border: `1px solid hsl(0 70% 62% / 0.40)` }}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Delete account
            </button>
          </div>
        </Section>

        {/* Payment quicklink */}
        <Section title="Payment" desc="Manage saved cards and plan billing on the Billing tab.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>{form.paymentCard}</p>
              <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>Expires 09/27 · used for plan renewals and visit balances</p>
            </div>
            <Link to="/members/billing" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.8} /> Manage payment methods <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
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
            <p className="min-w-0 truncate font-body text-[12px]" style={{ color: MUTED }}>
              You have <span className="font-semibold" style={{ color: TEXT }}>{changeCount} unsaved change{changeCount === 1 ? '' : 's'}</span>.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={handleDiscard} className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
                Discard
              </button>
              <button type="button" onClick={handleSave} className="rounded-xl px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: TEXT, color: INVERT }}>
                Save changes
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
