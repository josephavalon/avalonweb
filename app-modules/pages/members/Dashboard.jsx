import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Fingerprint,
  LogOut,
  MessageCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { readLastBooking } from '@/lib/localOs';
import { apiGet } from '@/lib/apiClient';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';

function formatWhen(startsAt) {
  if (!startsAt) return '';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function money(value) {
  if (value == null) return '$0';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const PAYMENT_LABEL = { paid_in_full: 'Paid', deposit_paid: 'Deposit', pending: 'Pending' };
function paymentLabel(status) {
  return PAYMENT_LABEL[status] || (status ? status.replace(/_/g, ' ') : 'Pending');
}

// Pick a product bag image for a therapy name (mirrors the booking/menu mapping).
function bagForService(service = '') {
  const s = String(service).toLowerCase();
  if (s.includes('nad')) return '/bags/nad.png';
  if (s.includes('cbd')) return '/bags/cbd.png';
  if (s.includes('hydrat') || s.includes('dehydr')) return '/bags/dehydration.png';
  if (s.includes('energy')) return '/bags/energy.png';
  if (s.includes('immun')) return '/bags/immunity.png';
  if (s.includes('beauty') || s.includes('glow')) return '/bags/beauty.png';
  if (s.includes('recover')) return '/bags/recovery.png';
  if (s.includes('myers')) return '/bags/myers.png';
  if (s.includes('night')) return '/bags/night-out.png';
  if (s.includes('travel') || s.includes('jet')) return '/bags/jet-lag.png';
  return '/bags/dehydration.png';
}

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const ACCENT = 'hsl(var(--accent))';

function Action({ to, href, icon: Icon, label, primary = false }) {
  const className = 'flex min-h-[58px] items-center justify-between rounded-2xl px-4 font-body text-[11px] font-bold uppercase tracking-[0.18em] transition-transform active:scale-[0.98]';
  const style = {
    background: primary ? TEXT : CARD,
    color: primary ? INVERT : TEXT,
    border: `1px solid ${primary ? TEXT : BORDER}`,
  };
  const body = (
    <>
      <span className="flex items-center gap-2.5"><Icon className="h-4 w-4" strokeWidth={1.8} />{label}</span>
      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
    </>
  );
  if (href) return <a href={href} className={className} style={style}>{body}</a>;
  return <Link to={to} className={className} style={style}>{body}</Link>;
}

function StatCol({ label, value, divider }) {
  return (
    <div className="px-2 py-3.5 text-center" style={divider ? { borderRight: `1px solid ${BORDER}` } : undefined}>
      <p className="truncate font-heading text-2xl uppercase leading-none md:text-3xl">{value}</p>
      <p className="mt-1.5 font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>{label}</p>
    </div>
  );
}

function RecentRow({ service, when, status }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
      <span className="flex h-12 w-9 shrink-0 items-center justify-center">
        <img src={bagForService(service)} alt="" loading="lazy" className="h-full w-auto object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-lg uppercase leading-none">{service}</p>
        <p className="mt-0.5 font-body text-[11px]" style={{ color: DIM }}>{when}</p>
      </div>
      <span className="shrink-0 font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>{status}</span>
    </div>
  );
}

// Shared dashboard body — "Two-Up Rail" layout: next-visit card with the bag
// image + a Balance / Plan / Visits rail, Book + Message, then Recent visits.
function DashboardBody({ primary, balanceLabel, planLabel, visitsCount, recent, emptyText, onSignOut, footer }) {
  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="font-heading text-2xl tracking-[0.2em]">AV</Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Member</p>
          <button
            type="button"
            onClick={onSignOut}
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

      <section className="mx-auto max-w-3xl px-4 pt-4 md:px-6">
        {/* Next visit + summary rail */}
        <div className="overflow-hidden rounded-[30px]" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 md:p-7">
            <div className="min-w-0">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>
                {primary ? 'Your Next Visit' : 'No Upcoming Visit'}
              </p>
              <h1 className="mt-2 break-words font-heading text-[2.9rem] uppercase leading-[0.9] md:text-6xl">
                {primary ? primary.service : 'Book a visit'}
              </h1>
              <p className="mt-3 font-body text-sm leading-snug" style={{ color: MUTED }}>
                {primary ? primary.when : emptyText}
              </p>
              {primary?.location ? (
                <p className="mt-0.5 font-body text-xs leading-snug" style={{ color: DIM }}>{primary.location}</p>
              ) : null}
            </div>
            <img
              src={primary ? primary.img : '/bags/dehydration.png'}
              alt=""
              loading="lazy"
              className="h-28 w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] md:h-36"
              style={primary ? undefined : { opacity: 0.5 }}
            />
          </div>
          <div className="grid grid-cols-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <StatCol label="Balance" value={balanceLabel} divider />
            <StatCol label="Plan" value={planLabel} divider />
            <StatCol label="Visits" value={visitsCount} />
          </div>
        </div>

        {/* Primary actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Action to="/book" icon={Calendar} label="Book" primary />
          <Action to="/members/messages" icon={MessageCircle} label="Message" />
        </div>

        {/* Recent visits */}
        <div className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-heading text-3xl uppercase leading-none">Recent</h2>
            <Link to="/members/bookings" className="inline-flex items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
              All visits <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          {recent.length ? (
            <div className="grid gap-2">
              {recent.map((r, i) => <RecentRow key={`${r.service}-${i}`} service={r.service} when={r.when} status={r.status} />)}
            </div>
          ) : (
            <div className="rounded-2xl px-3 py-6 text-center" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-sm" style={{ color: MUTED }}>No visits yet. Your booked visits will appear here.</p>
              <Link to="/book" className="mt-3 inline-flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: TEXT }}>
                Book your first visit <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
          )}
        </div>

        {footer}
      </section>

      <MemberBottomNav />
    </main>
  );
}

// Live dashboard — real visits from /api/me/appointments (Supabase mode).
function LiveClientDashboard() {
  const { signOut, registerPasskey } = useAuthStore();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', visits: [] });
  const [passkeyMsg, setPasskeyMsg] = useState(null);

  const addPasskey = async () => {
    setPasskeyMsg({ tone: 'busy', text: 'Follow your device prompt to add a passkey…' });
    const result = await registerPasskey();
    setPasskeyMsg(result.ok
      ? { tone: 'ok', text: result.message || 'Passkey added — use it to sign in next time.' }
      : { tone: 'err', text: result.error || 'Could not add a passkey.' });
  };

  useEffect(() => {
    let active = true;
    apiGet('/api/me/appointments')
      .then((data) => { if (active) setState({ loading: false, error: '', visits: Array.isArray(data?.appointments) ? data.appointments : [] }); })
      .catch((err) => { if (active) setState({ loading: false, error: err.message || 'Could not load your visits.', visits: [] }); });
    return () => { active = false; };
  }, []);

  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  const { loading, visits } = state;
  const now = Date.now();
  const upcoming = visits.filter((v) => v.startsAt && new Date(v.startsAt).getTime() >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const next = upcoming[0] || null;
  const balanceTotal = visits.reduce((sum, v) => sum + (v.balanceDue || 0), 0);
  const hasPlan = visits.some((v) => v.isMembership);

  const primary = next ? {
    service: next.service,
    when: formatWhen(next.startsAt) || 'Time to be confirmed',
    location: next.address || '',
    img: bagForService(next.service),
  } : null;
  const recent = visits.slice(0, 4).map((v) => ({ service: v.service, when: formatWhen(v.startsAt) || 'Date to be confirmed', status: paymentLabel(v.paymentStatus) }));

  const footer = (
    <div className="mt-4 rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <button
        type="button"
        onClick={addPasskey}
        className="flex min-h-[52px] w-full items-center justify-between rounded-xl px-3 font-body text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
      >
        <span className="flex items-center gap-2.5"><Fingerprint className="h-4 w-4" strokeWidth={1.8} />Add a passkey</span>
        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
      </button>
      {passkeyMsg && (
        <p className="mt-3 font-body text-xs leading-relaxed" style={{ color: passkeyMsg.tone === 'err' ? 'hsl(0 70% 62%)' : passkeyMsg.tone === 'ok' ? ACCENT : MUTED }}>
          {passkeyMsg.text}
        </p>
      )}
    </div>
  );

  return (
    <DashboardBody
      primary={primary}
      balanceLabel={loading ? '—' : money(balanceTotal)}
      planLabel={hasPlan ? 'Active' : '—'}
      visitsCount={loading ? '—' : String(visits.length)}
      recent={recent}
      emptyText={loading ? 'Loading your visits…' : 'Book your next visit'}
      onSignOut={handleSignOut}
      footer={footer}
    />
  );
}

function MemberDashboard() {
  useSeo({
    title: 'Client Dashboard - Avalon Vitality',
    description: 'Your Avalon dashboard — next visit, balance, plan, and recent visits at a glance.',
    path: '/members/dashboard',
    robots: 'noindex, nofollow',
  });
  const { authBackend } = useAuthStore();
  return authBackend === 'supabase' ? <LiveClientDashboard /> : <DemoClientDashboard />;
}

export default MemberDashboard;

// Demo dashboard (local/beta simulation) — uses the last local booking plus a
// small sample history so the layout reads as a real, populated portal.
const DEMO_RECENT = [
  { service: 'Immunity IV', when: 'Thu, May 28 · 3:00 PM', status: 'Completed' },
  { service: 'Hydration IV', when: 'Wed, May 14 · 2:00 PM', status: 'Completed' },
];

function DemoClientDashboard() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const booking = readLastBooking();
  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  const primary = booking ? {
    service: booking.service || 'Hydration IV',
    when: [booking.date, booking.time].filter(Boolean).join(' · ') || 'Ready when you are',
    location: booking.address || 'Home, hotel, office, or event',
    img: bagForService(booking.service),
  } : null;

  const balanceLabel = booking?.balanceLabel || (booking?.payment ? String(booking.payment) : '$0');

  return (
    <DashboardBody
      primary={primary}
      balanceLabel={balanceLabel}
      planLabel="Active"
      visitsCount={String(DEMO_RECENT.length + (booking ? 1 : 0))}
      recent={DEMO_RECENT}
      emptyText="Book your next visit — we come to you."
      onSignOut={handleSignOut}
    />
  );
}
