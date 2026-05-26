import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  FileText,
  LogOut,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import { useAuthStore } from '@/lib/useAuthStore';
import { readLocal, writeLocal, appendActivity } from '@/lib/localOs';
import { readClientProfile, readSavedAddresses, saveClientProfile } from '@/lib/platformOps';
import { useAdminTheme } from '@/lib/adminCommandUi.jsx';

const BG = 'hsl(var(--background))';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const ACCENT = 'hsl(var(--accent))';

const DEFAULT_PREFS = {
  address: '',
  window: '',
  nurseNotes: '',
  communication: 'Text first',
};

const CONTACT_DEFAULTS = {
  phone: '',
  email: 'client.preview@avalon.local',
  emergency: '',
};

function SettingCard({ icon: Icon, eyebrow, title, value, action, onClick }) {
  const content = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: ACCENT }}>
        <Icon className="h-5 w-5" strokeWidth={1.65} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[9px] uppercase tracking-[0.22em]" style={{ color: DIM }}>{eyebrow}</span>
        <span className="mt-1 block font-body text-sm font-semibold" style={{ color: TEXT }}>{title}</span>
        {value && <span className="mt-1 block truncate font-body text-xs" style={{ color: MUTED }}>{value}</span>}
      </span>
      <span className="flex items-center gap-2 font-body text-[9px] uppercase tracking-[0.14em]" style={{ color: action ? ACCENT : DIM }}>
        {action || 'Set'} <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.7} />
      </span>
    </>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[76px] w-full items-center gap-3 rounded-[22px] p-3 text-left transition-transform active:scale-[0.98]"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      {content}
    </button>
  );
}

function ChoiceRow({ label, value, values, onChange }) {
  const rotate = () => {
    const index = values.indexOf(value);
    onChange(values[(index + 1) % values.length]);
  };

  return (
    <button
      type="button"
      onClick={rotate}
      className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl px-3 text-left"
      style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}
    >
      <span>
        <span className="block font-body text-[8px] uppercase tracking-[0.18em]" style={{ color: DIM }}>{label}</span>
        <span className="mt-1 block font-body text-sm" style={{ color: TEXT }}>{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
    </button>
  );
}

export default function MemberAccount() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const { cycle: cycleTheme, Icon: ThemeIcon, theme } = useAdminTheme();
  const [prefs, setPrefs] = useState(() => readLocal('clientPrefs', DEFAULT_PREFS));
  const [contact, setContact] = useState(() => readLocal('clientContactPrefs', CONTACT_DEFAULTS));
  const [profile, setProfile] = useState(() => readClientProfile());
  const addresses = readSavedAddresses();
  const subscription = profile.subscription || {
    plan: 'No plan',
    creditsAvailable: 0,
    creditsTotal: 0,
    renewal: 'No renewal',
    actions: ['View plans'],
  };

  const firstName = user?.name || 'Client';

  const updatePrefs = (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(writeLocal('clientPrefs', next));
    appendActivity(`Updated client account preference: ${key}`, { role: 'client' });
  };

  const rotateContact = (key, values) => {
    const index = values.indexOf(contact[key]);
    const next = { ...contact, [key]: values[(index + 1) % values.length] };
    setContact(writeLocal('clientContactPrefs', next));
    setProfile(saveClientProfile({ [key]: next[key] }));
    appendActivity(`Updated client contact setting: ${key}`, { role: 'client' });
  };

  const rotateProfileArray = (key, values) => {
    const current = profile[key]?.[0] || values[0];
    const index = values.indexOf(current);
    setProfile(saveClientProfile({ [key]: [values[(index + 1) % values.length]] }));
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-[calc(9rem+env(safe-area-inset-bottom))]" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 px-4 py-3 backdrop-blur-2xl" style={{ background: 'hsl(var(--background) / 0.86)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/members/dashboard" className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          </Link>
          <div className="text-center">
            <p className="font-body text-[9px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Client Portal</p>
            <h1 className="font-heading text-2xl uppercase tracking-[0.08em]">Account</h1>
          </div>
          <button type="button" onClick={cycleTheme} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label={`Theme: ${theme}`}>
            <ThemeIcon className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <section className="rounded-[28px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Signed in as</p>
              <h2 className="mt-2 font-heading text-5xl uppercase leading-none">{firstName}</h2>
              <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>Manage contact details, default visit preferences, documents, and notification behavior.</p>
            </div>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <UserRound className="h-6 w-6" style={{ color: ACCENT }} strokeWidth={1.6} />
            </span>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <SettingCard icon={UserRound} eyebrow="Contact" title="Phone & email" value={`${contact.phone || 'No phone'} · ${contact.email || 'No email'}`} action="Review" onClick={() => rotateContact('phone', ['Text first', 'Call first', 'Needs update'])} />
          <SettingCard icon={Bell} eyebrow="Notifications" title="Contact preference" value={prefs.communication} action="Change" onClick={() => updatePrefs('communication', prefs.communication === 'Text first' ? 'Call first' : prefs.communication === 'Call first' ? 'Email summary' : 'Text first')} />
          <SettingCard icon={MapPin} eyebrow="Default location" title={prefs.address || 'Not set'} value={addresses[0]?.address || 'No saved address'} action="Manage" onClick={() => updatePrefs('address', prefs.address ? '' : 'Needs address')} />
          <SettingCard icon={ShieldCheck} eyebrow="Medical profile" title="Intake, consent, emergency" value={contact.emergency || 'Not set'} action="View" onClick={() => rotateContact('emergency', ['Needs update', 'Verified today', ''])} />
        </section>

        <section className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Clinical File</p>
              <h2 className="mt-1 font-heading text-3xl uppercase leading-none">Profile + GFE</h2>
              <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: MUTED }}>DOB, allergies, meds, contraindications, emergency contact, and GFE validity.</p>
            </div>
            <span className="rounded-full px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
              {profile.gfe.status}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ChoiceRow label="DOB" value={profile.dob} values={[profile.dob, 'Needs update', 'Verified today']} onChange={(value) => setProfile(saveClientProfile({ dob: value }))} />
            <ChoiceRow label="GFE valid until" value={profile.gfe.validUntil} values={[profile.gfe.validUntil, 'Needs renewal', 'Pending review']} onChange={(value) => setProfile(saveClientProfile({ gfe: { validUntil: value, status: value === 'Needs renewal' ? 'Action' : profile.gfe.status } }))} />
            <ChoiceRow label="Allergies" value={profile.allergies?.[0] || 'None reported'} values={['Latex sensitivity', 'None reported', 'Needs review']} onChange={() => rotateProfileArray('allergies', ['Latex sensitivity', 'None reported', 'Needs review'])} />
            <ChoiceRow label="Medications" value={profile.medications?.[0] || 'None reported'} values={['None reported', 'Supplements only', 'Needs review']} onChange={() => rotateProfileArray('medications', ['None reported', 'Supplements only', 'Needs review'])} />
          </div>
        </section>

        <section className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Subscription</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ['Plan', subscription.plan],
              ['Credits', `${subscription.creditsAvailable}/${subscription.creditsTotal}`],
              ['Renewal', subscription.renewal],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[8px] uppercase tracking-[0.18em]" style={{ color: DIM }}>{label}</p>
                <p className="mt-2 font-body text-sm font-semibold" style={{ color: TEXT }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {subscription.actions.map((action) => (
              <button key={action} type="button" className="min-h-[42px] rounded-xl font-body text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}>
                {action}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Visit Defaults</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ChoiceRow label="Best window" value={prefs.window} values={['Afternoons', 'Morning', 'Evening']} onChange={(value) => updatePrefs('window', value)} />
            <ChoiceRow label="RN note" value={prefs.nurseNotes} values={['Prefers slower drip rate', 'Left arm preferred', 'Quiet visit']} onChange={(value) => updatePrefs('nurseNotes', value)} />
          </div>
        </section>

        <section className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Documents</p>
          <div className="mt-3 space-y-2">
            {profile.documents.map((item) => (
              <div key={item.label} className="flex min-h-[48px] items-center justify-between rounded-2xl px-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <span className="flex items-center gap-2 font-body text-sm" style={{ color: TEXT }}>
                  <FileText className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.6} />
                  {item.label}
                </span>
                <span className="flex items-center gap-2 font-body text-[9px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
                  {item.status} <Check className="h-4 w-4" strokeWidth={1.8} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Wallet</p>
          <div className="mt-3 space-y-2">
            {[...(profile.wallet.deposits || []), ...(profile.wallet.invoices || []), ...(profile.wallet.eventTickets || [])].map((item) => (
              <div key={item.id} className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <span className="min-w-0">
                  <span className="block truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{item.label || item.event}</span>
                  <span className="block truncate font-body text-xs" style={{ color: MUTED }}>{item.date || item.credential || item.amount}</span>
                </span>
                <span className="shrink-0 font-body text-[9px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl font-body text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ background: TEXT, color: INVERT }}
        >
          Sign Out <LogOut className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </main>

      <MemberBottomNav />
    </div>
  );
}
