import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowRight,
  Calendar,
  Fingerprint,
  LogOut,
  MessageCircle,
  FileText,
  Crown,
  CreditCard,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { readLastBooking } from '@/lib/localOs';
import { apiGet } from '@/lib/apiClient';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';
import { authProviderConfig } from '@/lib/authProviderConfig';

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
  if (s.includes('nad')) return '/bags/nad.webp';
  if (s.includes('cbd')) return '/bags/cbd.webp';
  if (s.includes('hydrat') || s.includes('dehydr')) return '/bags/dehydration.webp';
  if (s.includes('energy')) return '/bags/energy.webp';
  if (s.includes('immun')) return '/bags/immunity.webp';
  if (s.includes('beauty') || s.includes('glow')) return '/bags/beauty.webp';
  if (s.includes('recover')) return '/bags/recovery.webp';
  if (s.includes('myers')) return '/bags/myers.webp';
  if (s.includes('night')) return '/bags/night-out.webp';
  if (s.includes('travel') || s.includes('jet')) return '/bags/jet-lag.webp';
  return '/bags/dehydration.webp';
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
const GOOD = 'hsl(140 30% 60%)';
const WARN = 'hsl(38 70% 60%)';
const BAD = 'hsl(0 70% 62%)';

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

// --- Expanded portal cards -------------------------------------------------

function PlanCard({ hasPlan, creditsAvailable, creditsTotal }) {
  // stub: tier + next charge — wire to Stripe subscription record later
  const tier = hasPlan ? 'Vitality Monthly' : 'No active plan';
  const nextCharge = hasPlan ? 'Jul 8 · $200' : '—';
  return (
    <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Active Plan</p>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: hasPlan ? 'hsl(140 30% 60% / 0.12)' : CARD_STRONG, color: hasPlan ? GOOD : MUTED, border: `1px solid ${hasPlan ? 'hsl(140 30% 60% / 0.25)' : BORDER}` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: hasPlan ? GOOD : DIM }} />
          {hasPlan ? 'Active' : 'Inactive'}
        </span>
      </div>
      <h3 className="mt-3 font-heading text-3xl uppercase leading-none md:text-4xl">{tier}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Credits</p>
          <p className="mt-1 font-heading text-2xl uppercase leading-none">{creditsAvailable} of {creditsTotal}</p>
          <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>remaining this cycle</p>
        </div>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Next charge</p>
          <p className="mt-1 font-heading text-2xl uppercase leading-none">{nextCharge}</p>
          <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>card ending 4242</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to="/members/memberships" className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: TEXT, color: INVERT }}>
          Manage plan
        </Link>
        <Link to="/members/memberships" className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
          Upgrade
        </Link>
      </div>
      <Link to="/members/memberships" className="mt-3 inline-block font-body text-[11px] underline underline-offset-4" style={{ color: MUTED, textDecorationColor: DIM }}>
        Pause or cancel
      </Link>
    </div>
  );
}

function BalanceCard({ amount }) {
  return (
    <div className="rounded-[24px] p-5" style={{ background: 'linear-gradient(160deg, hsl(0 70% 62% / 0.06), hsl(var(--foreground) / 0.045) 60%)', border: `1px solid hsl(0 70% 62% / 0.30)` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Outstanding balance</p>
        <Link to="/members/billing" className="font-body text-[10px] underline underline-offset-4" style={{ color: MUTED }}>Statements</Link>
      </div>
      <h3 className="mt-3 font-heading text-5xl uppercase leading-none">{money(amount)}</h3>
      <p className="mt-3 font-body text-[12px] leading-snug" style={{ color: MUTED }}>
        Posted after your provider reviewed and discharged you. Pay now or apply credits.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { /* stub: wire pay-balance flow */ }} className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: TEXT, color: INVERT }}>
          Pay {money(amount)} now
        </button>
        <button type="button" onClick={() => { /* stub: wire credit redemption */ }} className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
          Use credits
        </button>
      </div>
    </div>
  );
}

// stub: real inbox unread/preview will be wired once messaging service exists
const MESSAGE_STUBS = [
  { id: 'm1', initials: 'JO', who: 'Jules, your RN', body: "Just confirming Thursday's visit. Any new meds since May?", when: '2h', unread: true },
  { id: 'm2', initials: 'SN', who: 'Snooches', body: 'Your June statement is ready. You used 2 of 4 credits this cycle.', when: '1d', unread: true },
  { id: 'm3', initials: 'JO', who: 'Jules, your RN', body: 'Hydration tip: 80 oz water + electrolytes the day before.', when: '3d', unread: false },
];

function MessagesCard() {
  const unread = MESSAGE_STUBS.filter((m) => m.unread).length;
  return (
    <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Messages</p>
        <span className="font-body text-[10px]" style={{ color: MUTED }}>{unread} unread</span>
      </div>
      <div className="mt-3 grid gap-2">
        {MESSAGE_STUBS.map((m) => (
          <div key={m.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <span className="grid h-9 w-9 place-items-center rounded-full font-heading text-sm uppercase" style={{ background: 'hsl(var(--foreground) / 0.12)', color: TEXT }}>{m.initials}</span>
            <div className="min-w-0">
              <p className="truncate font-body text-[12px] font-semibold" style={{ color: TEXT }}>
                {m.who}{m.unread ? <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: TEXT }} /> : null}
              </p>
              <p className="mt-0.5 truncate font-body text-[11px]" style={{ color: MUTED }}>{m.body}</p>
            </div>
            <span className="shrink-0 font-body text-[10px]" style={{ color: DIM }}>{m.when}</span>
          </div>
        ))}
      </div>
      <Link to="/members/messages" className="mt-3 inline-flex items-center gap-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: TEXT }}>
        Open inbox <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </div>
  );
}

// stub: real documents list will come from /api/me/documents
const DOC_STUBS = [
  { id: 'd1', name: '2026 Consent Renewal', meta: 'Annual · required before next visit', badge: 'Sign' },
  { id: 'd2', name: 'HIPAA Privacy Notice', meta: 'Signed Jan 14, 2026', badge: 'PDF' },
  { id: 'd3', name: 'Treatment Summary — May 12', meta: 'From Jules Ortega, RN', badge: 'PDF' },
];

function DocumentsCard() {
  return (
    <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Documents</p>
        <Link to="/members/documents" className="font-body text-[10px] underline underline-offset-4" style={{ color: MUTED }}>View all</Link>
      </div>
      <div className="mt-3 divide-y" style={{ borderColor: BORDER }}>
        {DOC_STUBS.map((d) => {
          const isSign = d.badge === 'Sign';
          return (
            <div key={d.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span className="grid h-10 w-8 place-items-center rounded" style={{ background: CARD_STRONG, color: DIM }}>
                <FileText className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-body text-[13px] font-semibold" style={{ color: TEXT }}>{d.name}</p>
                <p className="mt-0.5 truncate font-body text-[11px]" style={{ color: DIM }}>{d.meta}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{
                background: isSign ? 'hsl(38 70% 60% / 0.14)' : CARD_STRONG,
                color: isSign ? WARN : MUTED,
                border: `1px solid ${isSign ? 'hsl(38 70% 60% / 0.30)' : BORDER}`,
              }}>{d.badge}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileCompleteness({ percent = 80 }) {
  return (
    <div className="rounded-2xl p-3.5 sm:min-w-[260px]" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
        <span>Profile</span>
        <span style={{ color: TEXT }}>{percent}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: CARD_STRONG }}>
        <div className="h-full" style={{ width: `${percent}%`, background: TEXT }} />
      </div>
      <Link to="/members/account" className="mt-2 inline-flex items-center gap-1 font-body text-[11px] underline underline-offset-4" style={{ color: TEXT, textDecorationColor: DIM }}>
        Add emergency contact <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </div>
  );
}

function QuickBookStrip({ creditsRemaining }) {
  return (
    <div className="mt-6 rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-2xl uppercase leading-none">Book another visit</h3>
          <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>
            {creditsRemaining > 0
              ? `You have ${creditsRemaining} credit${creditsRemaining === 1 ? '' : 's'} left this cycle.`
              : 'Pay-as-you-go or activate a plan for credits.'}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Link to="/book" className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] sm:flex-none" style={{ background: TEXT, color: INVERT }}>
            Book a visit
          </Link>
          <Link to="/store" className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] sm:flex-none" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
            Browse add-ons
          </Link>
        </div>
      </div>
    </div>
  );
}

// Shared dashboard body — expanded portal layout.
function DashboardBody({
  primary,
  balanceLabel,
  balanceTotal,
  planLabel,
  visitsCount,
  recent,
  emptyText,
  onSignOut,
  footer,
  hasPlan,
  creditsAvailable,
  creditsTotal,
}) {
  const visitStatus = primary ? 'Confirming after clinical review' : 'No visit scheduled';
  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center"><AvalonMark className="h-[22px] w-[14px] text-foreground" /></Link>
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
        {/* Greeting + profile completeness nudge */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Welcome back</p>
            <h1 className="mt-1 font-heading text-4xl uppercase leading-none md:text-5xl">Your portal</h1>
          </div>
          <ProfileCompleteness percent={80} />
        </div>

        {/* Next visit + summary rail */}
        <div className="overflow-hidden rounded-[30px]" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 md:p-7">
            <div className="min-w-0">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>
                {primary ? 'Your Next Visit' : 'No Upcoming Visit'}
              </p>
              <h2 className="mt-2 break-words font-heading text-[2.6rem] uppercase leading-[0.9] md:text-5xl">
                {primary ? primary.service : 'Book a visit'}
              </h2>
              <p className="mt-3 font-body text-sm leading-snug" style={{ color: MUTED }}>
                {primary ? primary.when : emptyText}
              </p>
              {primary?.location ? (
                <p className="mt-0.5 font-body text-xs leading-snug" style={{ color: DIM }}>{primary.location}</p>
              ) : null}
            </div>
            <img
              src={primary ? primary.img : '/bags/dehydration.webp'}
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

        <div className="mt-3 rounded-2xl px-4 py-3.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Visit Status</p>
          <p className="mt-1 font-body text-sm font-semibold leading-snug" style={{ color: MUTED }}>{visitStatus}</p>
        </div>

        {/* Plan + Balance */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <PlanCard hasPlan={hasPlan} creditsAvailable={creditsAvailable} creditsTotal={creditsTotal} />
          {balanceTotal > 0 ? <BalanceCard amount={balanceTotal} /> : (
            <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Account standing</p>
              <h3 className="mt-3 font-heading text-3xl uppercase leading-none md:text-4xl">All clear</h3>
              <p className="mt-3 font-body text-[12px]" style={{ color: MUTED }}>
                No outstanding balance. Plan renews on schedule.
              </p>
              <Link to="/members/billing" className="mt-4 inline-flex items-center gap-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: TEXT }}>
                <CreditCard className="h-3.5 w-3.5" strokeWidth={2} /> View statements
              </Link>
            </div>
          )}
        </div>

        {/* Messages + Documents */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MessagesCard />
          <DocumentsCard />
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

        {/* Quick-book strip */}
        <QuickBookStrip creditsRemaining={creditsAvailable} />

        {/* Quick links to portal sections — mirrors section nav as a bottom safety net */}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Action to="/members/memberships" icon={Crown} label="Plan" />
          <Action to="/members/billing" icon={CreditCard} label="Billing" />
          <Action to="/members/documents" icon={FileText} label="Docs" />
          <Action to="/members/account" icon={UserRound} label="Account" />
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
  const [credits, setCredits] = useState({ loading: true, balance: 0 });
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
      .catch(() => { if (active) setState({ loading: false, error: 'Could not load your visits.', visits: [] }); });
    apiGet('/api/me/credits')
      .then((data) => { if (active) setCredits({ loading: false, balance: Math.max(0, Number(data?.balance || 0)) }); })
      .catch(() => { if (active) setCredits({ loading: false, balance: 0 }); });
    return () => { active = false; };
  }, []);

  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  const { loading, visits } = state;
  const now = Date.now();
  const upcoming = visits.filter((v) => v.startsAt && new Date(v.startsAt).getTime() >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const next = upcoming[0] || null;
  const balanceTotal = visits.reduce((sum, v) => sum + (v.balanceDue || 0), 0);
  const hasPlan = visits.some((v) => v.isMembership);
  // stub: tier-derived totals — plan tier should drive this once subscription record is wired
  const creditsTotal = hasPlan ? 4 : 0;
  const creditsAvailable = credits.loading ? 0 : Math.min(credits.balance, creditsTotal || credits.balance);

  const primary = next ? {
    service: next.service,
    when: formatWhen(next.startsAt) || 'Time to be confirmed',
    location: next.address || '',
    img: bagForService(next.service),
  } : null;
  const recent = visits.slice(0, 4).map((v) => ({ service: v.service, when: formatWhen(v.startsAt) || 'Date to be confirmed', status: paymentLabel(v.paymentStatus) }));

  const footer = authProviderConfig.passkey ? (
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
        <p className="mt-3 font-body text-xs leading-relaxed" style={{ color: passkeyMsg.tone === 'err' ? BAD : passkeyMsg.tone === 'ok' ? ACCENT : MUTED }}>
          {passkeyMsg.text}
        </p>
      )}
    </div>
  ) : null;

  return (
    <DashboardBody
      primary={primary}
      balanceLabel={loading ? '—' : money(balanceTotal)}
      balanceTotal={balanceTotal}
      planLabel={hasPlan ? 'Active' : '—'}
      visitsCount={loading ? '—' : String(visits.length)}
      recent={recent}
      emptyText={loading ? 'Loading your visits…' : 'Book your next visit'}
      onSignOut={handleSignOut}
      footer={footer}
      hasPlan={hasPlan}
      creditsAvailable={creditsAvailable}
      creditsTotal={creditsTotal || 4}
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

  // stub: demo dashboard always shows an active plan with sample credits + balance
  const balanceTotal = 120;
  const balanceLabel = money(balanceTotal);

  return (
    <DashboardBody
      primary={primary}
      balanceLabel={balanceLabel}
      balanceTotal={balanceTotal}
      planLabel="Active"
      visitsCount={String(DEMO_RECENT.length + (booking ? 1 : 0))}
      recent={DEMO_RECENT}
      emptyText="Book your next visit — we come to you."
      onSignOut={handleSignOut}
      hasPlan
      creditsAvailable={2}
      creditsTotal={4}
    />
  );
}
