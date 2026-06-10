import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  CreditCard,
  LogOut,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { readLastBooking } from '@/lib/localOs';
import { readVisitPrep, saveVisitPrep } from '@/lib/platformOps';
import { apiGet } from '@/lib/apiClient';
import MemberBottomNav from '@/components/landing/MemberBottomNav';

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

const PAYMENT_LABEL = {
  paid_in_full: 'Paid',
  deposit_paid: 'Deposit paid',
  pending: 'Pending',
};
function paymentLabel(status) {
  return PAYMENT_LABEL[status] || (status ? status.replace(/_/g, ' ') : 'Pending');
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

const DEFAULT_VISIT = {
  service: 'Choose your protocol',
  date: 'Ready when you are',
  time: '',
  address: 'Home, hotel, office, or event',
  status: 'Open',
  nurse: 'Assigned after clearance',
};

function statusFor(booking) {
  if (!booking) return 'Ready';
  if (/clear|assigned|route|complete/i.test(`${booking.status} ${booking.gfe}`)) return 'Clear';
  return 'Review';
}

function Action({ to, href, icon: Icon, label, primary = false }) {
  const className = 'flex min-h-[58px] items-center justify-between rounded-2xl px-4 font-body text-[11px] font-bold uppercase tracking-[0.18em] transition-transform active:scale-[0.98]';
  const style = {
    background: primary ? TEXT : CARD,
    color: primary ? INVERT : TEXT,
    border: `1px solid ${primary ? TEXT : BORDER}`,
  };
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
        {label}
      </span>
      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
    </>
  );
  if (href) return <a href={href} className={className} style={style}>{body}</a>;
  return <Link to={to} className={className} style={style}>{body}</Link>;
}

function Pill({ children, tone = ACCENT }) {
  return (
    <span
      className="inline-flex min-h-[30px] items-center rounded-full px-3 font-body text-[9px] font-bold uppercase tracking-[0.16em]"
      style={{ color: tone, background: 'hsl(var(--foreground) / 0.045)', border: `1px solid ${BORDER}` }}
    >
      {children}
    </span>
  );
}

function PrepItem({ item, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex min-h-[54px] w-full items-center justify-between rounded-2xl px-3 text-left transition-transform active:scale-[0.98]"
      style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: item.done ? 'hsl(var(--accent) / 0.10)' : CARD_STRONG,
            color: item.done ? ACCENT : DIM,
            border: `1px solid ${item.done ? 'hsl(var(--accent) / 0.22)' : BORDER}`,
          }}
        >
          <Check className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="truncate font-body text-sm">{item.label}</span>
      </span>
    </button>
  );
}

// Live dashboard — real visits from /api/me/appointments (Supabase mode).
function LiveClientDashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', visits: [] });

  useEffect(() => {
    let active = true;
    apiGet('/api/me/appointments')
      .then((data) => {
        if (active) setState({ loading: false, error: '', visits: Array.isArray(data?.appointments) ? data.appointments : [] });
      })
      .catch((err) => {
        if (active) setState({ loading: false, error: err.message || 'Could not load your visits.', visits: [] });
      });
    return () => { active = false; };
  }, []);

  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  const { loading, error, visits } = state;
  const now = Date.now();
  const upcoming = visits
    .filter((v) => v.startsAt && new Date(v.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const primary = upcoming[0] || visits[0] || null;
  const balanceTotal = visits.reduce((sum, v) => sum + (v.balanceDue || 0), 0);
  const hasPlan = visits.some((v) => v.isMembership);
  const clientName = (user?.name || 'Client').split(' ')[0];

  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/" className="font-heading text-2xl tracking-[0.2em]">AV</Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Client</p>
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

      <section className="mx-auto max-w-5xl px-4 pt-5 md:px-8 md:pt-8">
        <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr] md:gap-6">
          <div className="rounded-[30px] p-5 md:p-7" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-6 flex items-center justify-between gap-3">
              <Pill>{loading ? 'Loading' : `${visits.length} ${visits.length === 1 ? 'Visit' : 'Visits'}`}</Pill>
              <Sparkles className="h-5 w-5" style={{ color: ACCENT }} strokeWidth={1.5} />
            </div>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Avalon</p>
            <h1 className="mt-3 max-w-sm font-heading text-6xl uppercase leading-[0.88] md:text-7xl">
              {clientName}.<br />Ready.
            </h1>
            <p className="mt-4 max-w-sm font-body text-sm leading-relaxed" style={{ color: MUTED }}>
              Book, prep, and message the care team without hunting through a portal.
            </p>
            <div className="mt-6 grid gap-2">
              <Action to="/book" icon={Calendar} label="Book" primary />
              <Action href="sms:+14159807708" icon={MessageCircle} label="Message" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>
                    {primary && upcoming.length ? 'Next Visit' : 'Visit Status'}
                  </p>
                  <h2 className="mt-3 truncate font-heading text-4xl uppercase leading-none md:text-5xl">
                    {primary ? primary.service : (loading ? 'Loading…' : 'No visits yet')}
                  </h2>
                </div>
                {primary ? <Pill>{paymentLabel(primary.paymentStatus)}</Pill> : null}
              </div>
              <div className="mt-5 grid gap-2">
                <div className="flex min-h-[46px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG }}>
                  <Calendar className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
                  <span className="truncate text-sm" style={{ color: MUTED }}>
                    {primary && formatWhen(primary.startsAt) ? formatWhen(primary.startsAt) : 'Book your next visit'}
                  </span>
                </div>
                <div className="flex min-h-[46px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG }}>
                  <CreditCard className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
                  <span className="truncate text-sm" style={{ color: MUTED }}>
                    {primary && primary.balanceDue ? `${money(primary.balanceDue)} balance — collected at your visit` : 'Paid'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Calendar, label: 'Visits', value: loading ? '—' : String(visits.length) },
                { icon: CreditCard, label: 'Balance', value: money(balanceTotal) },
                { icon: Sparkles, label: 'Plan', value: hasPlan ? 'Active' : '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <Icon className="mx-auto h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.6} />
                  <p className="mt-3 truncate font-heading text-2xl uppercase leading-none">{value}</p>
                  <p className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
          <section className="rounded-[28px] p-4 md:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Your</p>
                <h2 className="mt-1 font-heading text-3xl uppercase leading-none">Visits</h2>
              </div>
              <Pill>{visits.length}</Pill>
            </div>
            {error ? (
              <p className="rounded-2xl px-3 py-3 font-body text-sm" style={{ background: CARD_STRONG, color: MUTED }}>{error}</p>
            ) : loading ? (
              <p className="rounded-2xl px-3 py-3 font-body text-sm" style={{ background: CARD_STRONG, color: MUTED }}>Loading your visits…</p>
            ) : visits.length === 0 ? (
              <div className="rounded-2xl px-3 py-5 text-center" style={{ background: CARD_STRONG }}>
                <p className="font-body text-sm" style={{ color: MUTED }}>No visits yet. Your booked visits will appear here.</p>
                <Link to="/book" className="mt-3 inline-flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
                  Book your first visit <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            ) : (
              <div className="grid gap-2">
                {visits.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-semibold">{v.service}</p>
                      <p className="truncate font-body text-xs" style={{ color: DIM }}>{formatWhen(v.startsAt) || 'Date to be confirmed'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-body text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>{paymentLabel(v.paymentStatus)}</p>
                      {v.balanceDue ? <p className="font-body text-xs" style={{ color: DIM }}>{money(v.balanceDue)} due</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] p-4 md:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Fast Actions</p>
            <div className="mt-4 grid gap-2">
              <Action to="/members/account" icon={UserRound} label="Profile" />
              <Action to="/subscription" icon={Sparkles} label="Plan" />
              <Action to="/members/messages" icon={MessageCircle} label="Inbox" />
            </div>
          </section>
        </div>
      </section>

      <MemberBottomNav />
    </main>
  );
}

function MemberDashboard() {
  useSeo({
    title: 'Client Dashboard - Avalon Vitality',
    description: 'Simple Avalon client dashboard for booking, visit status, prep, and care-team contact.',
    path: '/members/dashboard',
    robots: 'noindex, nofollow',
  });
  const { authBackend } = useAuthStore();
  return authBackend === 'supabase' ? <LiveClientDashboard /> : <DemoClientDashboard />;
}

export default MemberDashboard;

function DemoClientDashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const booking = readLastBooking();
  const [prep, setPrep] = useState(() => readVisitPrep().slice(0, 4));
  const visit = booking || DEFAULT_VISIT;
  const clientName = user?.name || 'Client';
  const status = statusFor(booking);
  const when = [visit.date, visit.time].filter(Boolean).join(' · ') || DEFAULT_VISIT.date;

  const togglePrep = (index) => {
    const next = prep.map((item, i) => i === index ? { ...item, done: !item.done } : item);
    setPrep(saveVisitPrep(next));
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/" className="font-heading text-2xl tracking-[0.2em]">AV</Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Client</p>
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

      <section className="mx-auto max-w-5xl px-4 pt-5 md:px-8 md:pt-8">
        <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr] md:gap-6">
          <div className="rounded-[30px] p-5 md:p-7" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-6 flex items-center justify-between gap-3">
              <Pill>{status}</Pill>
              <Sparkles className="h-5 w-5" style={{ color: ACCENT }} strokeWidth={1.5} />
            </div>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Avalon</p>
            <h1 className="mt-3 max-w-sm font-heading text-6xl uppercase leading-[0.88] md:text-7xl">
              {clientName.split(' ')[0]}.<br />Ready.
            </h1>
            <p className="mt-4 max-w-sm font-body text-sm leading-relaxed" style={{ color: MUTED }}>
              Book, prep, and message the care team without hunting through a portal.
            </p>
            <div className="mt-6 grid gap-2">
              <Action to="/book" icon={Calendar} label="Book" primary />
              <Action href="sms:+14159807708" icon={MessageCircle} label="Message" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Visit Status</p>
                  <h2 className="mt-3 truncate font-heading text-4xl uppercase leading-none md:text-5xl">
                    {visit.service || DEFAULT_VISIT.service}
                  </h2>
                </div>
                <Pill>{visit.status || status}</Pill>
              </div>
              <div className="mt-5 grid gap-2">
                <div className="flex min-h-[46px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG }}>
                  <Calendar className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
                  <span className="truncate text-sm" style={{ color: MUTED }}>{when}</span>
                </div>
                <div className="flex min-h-[46px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG }}>
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
                  <span className="truncate text-sm" style={{ color: MUTED }}>{visit.address || DEFAULT_VISIT.address}</span>
                </div>
                <div className="flex min-h-[46px] items-center gap-3 rounded-2xl px-3" style={{ background: CARD_STRONG }}>
                  <UserRound className="h-4 w-4 shrink-0" style={{ color: DIM }} strokeWidth={1.7} />
                  <span className="truncate text-sm" style={{ color: MUTED }}>{visit.nurse || DEFAULT_VISIT.nurse}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: ShieldCheck, label: 'Review', value: /clear/i.test(status) ? 'Clear' : 'Needed' },
                { icon: CreditCard, label: 'Deductible', value: booking?.payment || '$1' },
                { icon: MessageCircle, label: 'Text', value: 'On' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <Icon className="mx-auto h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.6} />
                  <p className="mt-3 truncate font-heading text-2xl uppercase leading-none">{value}</p>
                  <p className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
          <section className="rounded-[28px] p-4 md:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Before Arrival</p>
                <h2 className="mt-1 font-heading text-3xl uppercase leading-none">Prep</h2>
              </div>
              <Pill>4</Pill>
            </div>
            <div className="grid gap-2">
              {prep.map((item, index) => (
                <PrepItem key={item.label} item={item} onToggle={() => togglePrep(index)} />
              ))}
            </div>
          </section>

          <section className="rounded-[28px] p-4 md:p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Fast Actions</p>
            <div className="mt-4 grid gap-2">
              <Action to="/members/account" icon={UserRound} label="Profile" />
              <Action to="/subscription" icon={Sparkles} label="Plan" />
              <Action to="/members/messages" icon={MessageCircle} label="Inbox" />
            </div>
          </section>
        </div>
      </section>

      <MemberBottomNav />
    </main>
  );
}
