import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Crown,
  FileText,
  LogOut,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import ConsumerTruthLayer from '@/components/consumer/ConsumerTruthLayer';
import { useSeo } from '@/lib/seo';
import { appendActivity, readLastBooking } from '@/lib/localOs';
import { buildAvalonKernelSnapshot } from '@/lib/avalonKernel';
import { buildConsumerTruthLayer } from '@/lib/consumerTruth';
import { evaluateClinicalClearance } from '@/lib/clinicalClearance';
import {
  buildUnifiedOperationalTruth,
  syncLocalRepository,
} from '@/lib/localRepository';
import {
  buildClientAftercarePlan,
  buildClientCommandCenter,
  buildClientRouteBridge,
  buildLiveVisitTimeline,
  buildLocalLaunchReadiness,
  queueClientAftercare,
  readClientProfile,
  readSupportThread,
  readVisitPrep,
  saveVisitPrep,
  sendSupportMessage,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];
const BG = 'hsl(var(--background))';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const ACCENT = 'hsl(var(--accent))';

const MEMBER = {
  firstName: 'Sarah',
  tier: 'Inner Circle',
  credits: 2,
  creditsTotal: 4,
  plan: 'Inner Circle Monthly',
  renewal: 'June 1, 2026',
  discount: 25,
  cadence: '2 IV credits / month',
};

const UPCOMING = {
  drip: "Myers' Cocktail",
  when: 'Tomorrow, 2:00 PM',
  location: 'Location pending',
  nurse: 'Stephanie R.',
  status: 'Confirmed',
};

function messageSenderLabel(from = '') {
  if (from === 'client') return 'You';
  if (from === 'nurse') return 'Nurse';
  return 'Care Team';
}

function SectionHeading({ eyebrow, title, action = null, to = null }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <p className="font-body text-[10px] tracking-[0.3em] uppercase" style={{ color: DIM }}>{eyebrow}</p>
        <h2 className="font-heading text-3xl uppercase leading-none mt-1" style={{ color: TEXT }}>{title}</h2>
      </div>
      {action && (
        <Link to={to} className="inline-flex min-h-[44px] shrink-0 items-center font-body text-[10px] uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
          {action}
        </Link>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label, sub, to = null, href = null, onClick = null, primary = false }) {
  const className = "rounded-[22px] p-4 min-h-[112px] flex flex-col justify-between text-left transition-transform active:scale-[0.98]";
  const style = {
    background: primary ? TEXT : CARD,
    border: `1px solid ${primary ? TEXT : BORDER}`,
    color: primary ? INVERT : TEXT,
  };
  const content = (
    <>
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5" strokeWidth={1.7} />
        <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
      </div>
      <div>
        <p className="font-body text-xs tracking-[0.18em] uppercase font-semibold">{label}</p>
        {sub && <p className="font-body text-xs mt-1 leading-snug" style={{ color: primary ? 'rgba(8,8,7,0.62)' : MUTED }}>{sub}</p>}
      </div>
    </>
  );
  if (to) return <Link to={to} className={className} style={style}>{content}</Link>;
  if (href) return <a href={href} className={className} style={style}>{content}</a>;
  return <button type="button" onClick={onClick} className={className} style={style}>{content}</button>;
}

function Metric({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-[22px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <Icon className="w-5 h-5 mb-5" style={{ color: ACCENT }} strokeWidth={1.6} />
      <p className="font-heading text-4xl leading-none" style={{ color: TEXT }}>{value}</p>
      <p className="font-body text-[10px] tracking-[0.22em] uppercase mt-1" style={{ color: DIM }}>{label}</p>
      {sub && <p className="font-body text-xs mt-2 leading-snug" style={{ color: MUTED }}>{sub}</p>}
    </div>
  );
}

function MobileDrawer({ eyebrow, title, children, defaultOpen = false }) {
  return (
    <details
      open={defaultOpen}
      className="md:hidden rounded-[22px] overflow-hidden"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <summary className="min-h-[64px] cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <span>
          <span className="block font-body text-[9px] tracking-[0.24em] uppercase" style={{ color: DIM }}>{eyebrow}</span>
          <span className="block mt-1 font-heading text-2xl uppercase leading-none" style={{ color: TEXT }}>{title}</span>
        </span>
        <ChevronRight className="h-4 w-4 transition-transform details-open:rotate-90" style={{ color: DIM }} strokeWidth={1.7} />
      </summary>
      <div className="px-4 pb-4">
        {children}
      </div>
    </details>
  );
}

function StatusMiniCard({ item }) {
  const action = /action|pending|needed/i.test(`${item.status} ${item.value}`);
  return (
    <div className="rounded-[22px] p-4" style={{ background: CARD, border: `1px solid ${action ? 'hsl(var(--accent) / 0.24)' : BORDER}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.22em]" style={{ color: DIM }}>{item.label}</p>
          <p className="mt-2 font-heading text-3xl uppercase leading-none" style={{ color: TEXT }}>{item.value}</p>
        </div>
        <span className="rounded-full px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.14em]" style={{ color: action ? ACCENT : MUTED, background: action ? 'hsl(var(--accent) / 0.08)' : CARD_STRONG, border: `1px solid ${action ? 'hsl(var(--accent) / 0.18)' : BORDER}` }}>
          {item.status}
        </span>
      </div>
      <p className="mt-3 font-body text-xs leading-relaxed" style={{ color: MUTED }}>{item.detail}</p>
    </div>
  );
}

function IntakeChecklist({ items }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="flex min-h-[54px] items-center gap-2 rounded-2xl px-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: item.done ? ACCENT : DIM }} strokeWidth={1.8} />
          <span className="font-body text-[10px] uppercase tracking-[0.14em]" style={{ color: item.done ? TEXT : MUTED }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function WalletRows({ wallet }) {
  const rows = [
    ...(wallet.deposits || []).map((item) => ({ ...item, type: 'Deposit', icon: CreditCard })),
    ...(wallet.invoices || []).map((item) => ({ ...item, type: 'Invoice', icon: FileText })),
    ...(wallet.eventTickets || []).map((item) => ({ ...item, type: 'Event', icon: Sparkles, label: item.event })),
  ];
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {rows.slice(0, 3).map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between gap-3">
              <Icon className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.7} />
              <span className="font-body text-[8px] uppercase tracking-[0.14em]" style={{ color: DIM }}>{item.type}</span>
            </div>
            <p className="mt-3 truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{item.label || item.credential}</p>
            <p className="mt-1 truncate font-body text-xs" style={{ color: MUTED }}>{item.status}{item.amount ? ` · ${item.amount}` : ''}</p>
          </div>
        );
      })}
    </div>
  );
}

function LaunchChecklist({ items }) {
  return (
    <div className="grid gap-2 md:grid-cols-5">
      {items.map((item) => {
        const action = ['Action', 'Needed'].includes(item.status);
        return (
          <div
            key={item.key}
            className="rounded-2xl p-3"
            style={{
              background: action ? 'hsl(var(--accent) / 0.07)' : CARD,
              border: `1px solid ${action ? 'hsl(var(--accent) / 0.22)' : BORDER}`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: action ? ACCENT : MUTED }} strokeWidth={1.7} />
              <span className="rounded-full px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em]" style={{ color: action ? ACCENT : DIM, background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                {item.status}
              </span>
            </div>
            <p className="mt-3 font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: TEXT }}>{item.label}</p>
            <p className="mt-1 line-clamp-2 font-body text-[11px] leading-relaxed" style={{ color: MUTED }}>{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

function AftercarePanel({ plan, onQueue }) {
  const ready = plan.completed;
  return (
    <section>
      <SectionHeading eyebrow="After Visit" title="Aftercare" action="Rebook" to="/book" />
      <div className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: ready ? ACCENT : DIM, background: ready ? 'hsl(var(--accent) / 0.08)' : CARD_STRONG, border: `1px solid ${ready ? 'hsl(var(--accent) / 0.20)' : BORDER}` }}>
                {plan.careStatus}
              </span>
              <span className="rounded-full px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: MUTED, background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                {plan.service}
              </span>
            </div>
            <h2 className="font-heading text-4xl uppercase leading-none" style={{ color: TEXT }}>{plan.headline}</h2>
            <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed" style={{ color: MUTED }}>{plan.body}</p>
          </div>
          <button
            type="button"
            onClick={onQueue}
            disabled={!ready}
            className="min-h-[48px] shrink-0 rounded-2xl px-5 font-body text-[10px] font-semibold uppercase tracking-[0.18em] transition-transform active:scale-[0.98] disabled:cursor-not-allowed"
            style={{ background: ready ? TEXT : CARD_STRONG, color: ready ? INVERT : DIM, border: `1px solid ${ready ? TEXT : BORDER}` }}
          >
            {plan.record ? 'Resend' : ready ? 'Send' : 'Armed'}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {plan.steps.map((item) => (
            <div key={item.key} className="rounded-2xl p-3" style={{ background: item.done ? 'hsl(var(--accent) / 0.055)' : CARD_STRONG, border: `1px solid ${item.done ? 'hsl(var(--accent) / 0.18)' : BORDER}` }}>
              <div className="flex items-center justify-between gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: item.done ? ACCENT : DIM }} strokeWidth={1.7} />
                <span className="font-body text-[8px] uppercase tracking-[0.14em]" style={{ color: item.done ? ACCENT : DIM }}>{item.status}</span>
              </div>
              <p className="mt-3 font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: TEXT }}>{item.label}</p>
              <p className="mt-1 line-clamp-2 font-body text-[11px] leading-relaxed" style={{ color: MUTED }}>{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RouteBridgePanel({ bridge }) {
  return (
    <section>
      <SectionHeading eyebrow="Arrival" title="Nurse ETA" action="Message" to="/members/messages" />
      <div className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
                {bridge.status}
              </span>
              <span className="rounded-full px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: MUTED, background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                Nurse-controlled
              </span>
            </div>
            <h2 className="font-heading text-4xl uppercase leading-none" style={{ color: TEXT }}>{bridge.headline}</h2>
            <p className="mt-3 font-body text-sm leading-relaxed" style={{ color: MUTED }}>{bridge.body}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>ETA</p>
                <p className="mt-1 font-heading text-3xl uppercase leading-none" style={{ color: TEXT }}>{bridge.eta}</p>
              </div>
              <div className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>RN</p>
                <p className="mt-1 truncate font-heading text-3xl uppercase leading-none" style={{ color: TEXT }}>{bridge.nurseName}</p>
              </div>
            </div>
            {bridge.texts?.[0] && (
              <div className="mt-3 rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>Latest Text</p>
                <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: MUTED }}>{bridge.texts[0].text}</p>
              </div>
            )}
          </div>
          <div>
            <div className="grid gap-2 sm:grid-cols-5">
              {bridge.steps.map((item) => (
                <div key={item.key} className="rounded-2xl p-3" style={{ background: item.done ? 'hsl(var(--accent) / 0.055)' : CARD_STRONG, border: `1px solid ${item.done ? 'hsl(var(--accent) / 0.18)' : BORDER}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: item.done ? ACCENT : DIM }} strokeWidth={1.7} />
                    <span className="font-body text-[8px] uppercase tracking-[0.14em]" style={{ color: item.done ? ACCENT : DIM }}>{item.done ? 'Set' : 'Wait'}</span>
                  </div>
                  <p className="mt-3 font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: TEXT }}>{item.label}</p>
                  <p className="mt-1 line-clamp-2 font-body text-[11px] leading-relaxed" style={{ color: MUTED }}>{item.detail}</p>
                </div>
              ))}
            </div>
            {bridge.address && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <a href={bridge.maps.apple} className="min-h-[44px] rounded-2xl px-4 flex items-center justify-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
                  <MapPin className="h-4 w-4" strokeWidth={1.7} /> Apple
                </a>
                <a href={bridge.maps.google} className="min-h-[44px] rounded-2xl px-4 flex items-center justify-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
                  <MapPin className="h-4 w-4" strokeWidth={1.7} /> Google
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MemberDashboard() {
  useSeo({
    title: 'Client Dashboard - Avalon Vitality',
    description: 'Avalon client dashboard for bookings, preparation, visit status, support, and aftercare.',
    path: '/members/dashboard',
    robots: 'noindex, nofollow',
  });
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [prep, setPrep] = useState(() => readVisitPrep());
  const [lastBooking, setLastBooking] = useState(() => readLastBooking());
  const [profile, setProfile] = useState(() => readClientProfile());
  const [thread, setThread] = useState(() => readSupportThread());
  const [aftercare, setAftercare] = useState(() => buildClientAftercarePlan());
  const [routeBridge, setRouteBridge] = useState(() => buildClientRouteBridge());
  const [supportText, setSupportText] = useState('');
  const firstName = user?.name || MEMBER.firstName;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const onLocalChange = (event) => {
      if (event.detail?.key === 'lastBooking') setLastBooking(readLastBooking());
      if (event.detail?.key === 'visitPrep') setPrep(readVisitPrep());
      if (event.detail?.key === 'clientProfile') setProfile(readClientProfile());
      if (event.detail?.key === 'supportThread') setThread(readSupportThread());
      if (['lastBooking', 'clientProfile', 'fieldVisitStatus', 'opsMessages', 'assignmentBroadcasts'].includes(event.detail?.key)) {
        setRouteBridge(buildClientRouteBridge({ profile: readClientProfile(), latestBooking: readLastBooking() }));
      }
      if (['lastBooking', 'clientProfile', 'clientAftercareRecords', 'acuityCloseoutPackets', 'supportThread'].includes(event.detail?.key)) {
        setAftercare(buildClientAftercarePlan({ profile: readClientProfile(), latestBooking: readLastBooking() }));
      }
    };
    window.addEventListener('av.local.change', onLocalChange);
    window.addEventListener('storage', onLocalChange);
    return () => {
      window.removeEventListener('av.local.change', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    };
  }, []);

  const repositorySeed = {
    requests: lastBooking ? [lastBooking] : [],
    nurses: [],
    inventory: [],
    booking: lastBooking,
  };
  const operationalTruth = buildUnifiedOperationalTruth(repositorySeed);
  const clientTruth = operationalTruth.roleViews.find((roleView) => roleView.role === 'client');

  useEffect(() => {
    syncLocalRepository(repositorySeed, 'Client Dashboard');
  }, [lastBooking?.id, lastBooking?.status]);

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  const togglePrep = (index) => {
    const next = prep.map((item, i) => i === index ? { ...item, done: !item.done } : item);
    setPrep(saveVisitPrep(next));
    appendActivity(`${next[index].done ? 'Completed' : 'Reopened'} prep item: ${next[index].label}`, { role: 'client' });
  };

  const sendSupport = () => {
    if (!supportText.trim()) return;
    setThread(sendSupportMessage(supportText.trim()));
    setSupportText('');
  };

  const sendAftercare = () => {
    const next = queueClientAftercare({ profile, latestBooking: lastBooking });
    setAftercare(next);
    setThread(readSupportThread());
  };

  const upcoming = lastBooking ? {
    drip: lastBooking.service || UPCOMING.drip,
    when: [lastBooking.date, lastBooking.time].filter(Boolean).join(' · ') || UPCOMING.when,
    location: lastBooking.address || UPCOMING.location,
    nurse: lastBooking.nurse && lastBooking.nurse !== 'Unassigned' ? lastBooking.nurse : lastBooking.nextStep || 'RN assignment pending',
    status: lastBooking.status || UPCOMING.status,
  } : UPCOMING;
  const timeline = buildLiveVisitTimeline(lastBooking);
  const commandCenter = buildClientCommandCenter(profile, lastBooking);
  const localReadiness = buildLocalLaunchReadiness({ profile, latestBooking: lastBooking });
  const truthLayer = buildConsumerTruthLayer({ profile, booking: lastBooking, supportThread: thread });
  const clinicalGate = evaluateClinicalClearance(lastBooking || {}, { profile });
  const aftercarePlan = buildClientAftercarePlan({ profile, latestBooking: lastBooking });
  const kernel = buildAvalonKernelSnapshot({ booking: lastBooking, role: 'client' });

  return (
    <div className="min-h-screen pb-[calc(11rem+env(safe-area-inset-bottom))]" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 px-4 py-3 backdrop-blur-2xl" style={{ background: 'hsl(var(--background) / 0.86)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-heading text-2xl tracking-[0.2em]" style={{ color: TEXT }}>AV</span>
            <span className="hidden sm:inline font-body text-[11px] tracking-[0.18em] uppercase" style={{ color: DIM }}>Client Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" className="relative w-11 h-11 rounded-full flex items-center justify-center" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Notifications">
              <Bell className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.6} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full" style={{ background: ACCENT }} />
            </button>
            <button type="button" onClick={handleSignOut} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Sign out">
              <LogOut className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4 md:pt-6 space-y-4 md:space-y-7 pb-10">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="rounded-[30px] p-4 sm:p-7 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(var(--accent) / 0.10), hsl(var(--foreground) / 0.045) 50%, hsl(var(--foreground) / 0.025))', border: `1px solid ${BORDER}` }}
        >
          <div className="grid gap-4 md:gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="hidden md:block">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
                <Crown className="w-3.5 h-3.5" style={{ color: ACCENT }} strokeWidth={1.6} />
                <span className="font-body text-[11px] tracking-[0.18em] uppercase font-semibold" style={{ color: ACCENT }}>{MEMBER.tier}</span>
              </div>
              <h1 className="font-heading text-5xl sm:text-7xl uppercase leading-[0.9]">
                {greeting},<br />{firstName}.
              </h1>
              <p className="font-body text-base mt-4 max-w-xl leading-relaxed" style={{ color: MUTED }}>
                Your next visit, ready.
              </p>
            </div>
            <div className="rounded-[24px] p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-body text-[10px] tracking-[0.24em] uppercase mb-2" style={{ color: DIM }}>Next Visit</p>
                  <p className="font-heading text-3xl uppercase leading-none">{upcoming.drip}</p>
                </div>
                <span className="font-body text-[11px] tracking-[0.14em] uppercase rounded-full px-2.5 py-1" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>
                  {upcoming.status}
                </span>
              </div>
              <div className="space-y-2 font-body text-sm" style={{ color: MUTED }}>
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4" strokeWidth={1.5} />{upcoming.when}</p>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4" strokeWidth={1.5} />{upcoming.location}</p>
                <p className="flex items-center gap-2"><UserRound className="w-4 h-4" strokeWidth={1.5} />{upcoming.nurse}</p>
              </div>
              <Link to="/book" className="mt-4 md:mt-5 min-h-[52px] md:min-h-[58px] rounded-2xl flex items-center justify-center gap-2 font-body text-xs tracking-[0.2em] uppercase font-semibold" style={{ background: TEXT, color: INVERT }}>
                Manage Visit <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </motion.section>

        <section className="md:hidden grid grid-cols-2 gap-2">
          <Link to="/book" className="min-h-[58px] rounded-2xl flex items-center justify-center gap-2 font-body text-[11px] tracking-[0.18em] uppercase font-semibold" style={{ background: TEXT, color: INVERT }}>
            Start <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
          <a href="sms:+14155550101" className="min-h-[58px] rounded-2xl flex items-center justify-center gap-2 font-body text-[11px] tracking-[0.18em] uppercase font-semibold" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}>
            Message <MessageCircle className="w-4 h-4" strokeWidth={1.7} />
          </a>
        </section>

        <section className="md:hidden grid grid-cols-3 gap-2">
          {[
            ['Credits', `${MEMBER.credits}/${MEMBER.creditsTotal}`],
            ['Status', upcoming.status],
            ['Review', clinicalGate.dispatchAllowed ? 'Clear' : 'Pending'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="font-heading text-2xl leading-none truncate" style={{ color: TEXT }}>{value}</p>
              <p className="mt-1 font-body text-[10px] tracking-[0.12em] uppercase" style={{ color: DIM }}>{label}</p>
            </div>
          ))}
        </section>

        <section>
          <SectionHeading eyebrow="Command" title="Health File" action="Account" to="/members/account" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {commandCenter.cards.map((card) => <StatusMiniCard key={card.id} item={card} />)}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Launch OS" title="Visit Readiness" action="Message" to="/members/messages" />
          <LaunchChecklist items={localReadiness.client} />
        </section>

        <section>
          <ConsumerTruthLayer
            truth={truthLayer}
            eyebrow="Real Visit OS"
            title="Truth Center"
            intro="Only backed records: booking, deposit, annual GFE, nurse assignment, ETA, messages, wallet, events, aftercare."
          />
        </section>

        <section>
          <SectionHeading eyebrow="Record Spine" title="Backed State" />
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['Visible', `${clientTruth?.visibleCount || 0}`],
              ['Ledger', `${operationalTruth.ledger.eventCount}`],
              ['Status', operationalTruth.status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] tracking-[0.16em] uppercase" style={{ color: DIM }}>{label}</p>
                <p className="mt-1 truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Tracker" title="Real Status" />
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['Now', kernel.clientTracker.status],
              ['Next', kernel.clientTracker.next],
              ['GFE', kernel.clientTracker.gfe.status],
              ['ETA', kernel.clientTracker.eta?.eta || 'Nurse sets final ETA'],
              ['Deposit', kernel.scale.depositGate.status],
              ['Fit', kernel.scale.membershipFit.status],
              ['Friction', `${kernel.scale.checkoutFriction.score}/100`],
              ['Follow-Up', `${kernel.followUp.dueInDays}d`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] tracking-[0.16em] uppercase" style={{ color: DIM }}>{label}</p>
                <p className="mt-1 truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <RouteBridgePanel bridge={routeBridge} />

        <AftercarePanel plan={aftercare.record ? aftercare : aftercarePlan} onQueue={sendAftercare} />

        <section>
          <SectionHeading eyebrow="Clearance" title="Intake + Consent" action="Edit" to="/members/account" />
          <IntakeChecklist items={commandCenter.intake} />
        </section>

        <section>
          <SectionHeading eyebrow="Wallet" title="Payments + Events" action="Details" to="/members/account" />
          <WalletRows wallet={commandCenter.wallet} />
        </section>

        <section className="md:hidden space-y-3">
          <MobileDrawer eyebrow="Before Arrival" title="Prep" defaultOpen>
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              {prep.map((item, index) => (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => togglePrep(index)}
                  className="w-full min-h-[56px] px-3 flex items-center justify-between text-left"
                  style={{ borderTop: index ? `1px solid ${BORDER}` : 0 }}
                >
                  <span className="flex items-center gap-2.5 font-body text-sm" style={{ color: TEXT }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: item.done ? ACCENT : DIM }} strokeWidth={1.7} />
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </MobileDrawer>

          <MobileDrawer eyebrow="Care Team" title="Messages">
            <div className="space-y-2 max-h-44 overflow-auto pr-1">
              {thread.slice(-3).map((msg) => (
                <div key={msg.id} className={`rounded-2xl px-3 py-2 ${msg.from === 'client' ? 'ml-6' : 'mr-6'}`} style={{ background: msg.from === 'client' ? 'hsl(var(--accent) / 0.08)' : CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  <p className="font-body text-sm leading-relaxed" style={{ color: TEXT }}>{msg.text}</p>
                  <p className="mt-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: DIM }}>{messageSenderLabel(msg.from)} · {msg.at}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                aria-label="Message the care team"
                value={supportText}
                onChange={(event) => setSupportText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') sendSupport(); }}
                placeholder="Ask the care team..."
                className="min-h-[50px] min-w-0 flex-1 rounded-2xl border px-3 font-body text-sm outline-none"
                style={{ background: CARD_STRONG, borderColor: BORDER, color: TEXT }}
              />
              <button type="button" onClick={sendSupport} className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl" style={{ background: TEXT, color: INVERT }} aria-label="Send message">
                <Send className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </MobileDrawer>

          <MobileDrawer eyebrow="Visit Status" title="Timeline">
            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: item.done ? 'hsl(var(--accent) / 0.08)' : CARD_STRONG, border: `1px solid ${item.done ? 'hsl(var(--accent) / 0.20)' : BORDER}` }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: item.done ? ACCENT : DIM }} strokeWidth={1.7} />
                  </span>
                  <span className="font-body text-xs leading-snug" style={{ color: item.done ? TEXT : MUTED }}>{item.client || item.label}</span>
                </div>
              ))}
            </div>
          </MobileDrawer>

        </section>

        <section className="hidden md:grid grid-cols-2 gap-3">
          <Metric icon={Sparkles} label="Credits Left" value={`${MEMBER.credits}/${MEMBER.creditsTotal}`} sub={MEMBER.cadence} />
          <Metric icon={ShieldCheck} label="Review" value={clinicalGate.dispatchAllowed ? 'Clear' : clinicalGate.label} sub="Before RN dispatch" />
        </section>

        <section className="hidden md:block">
          <SectionHeading eyebrow="Care Command" title="Next Actions" />
          <div className="grid grid-cols-2 gap-3">
            <QuickAction icon={MessageCircle} label="Message" sub="Care team" href="sms:+14155550101" primary />
            <QuickAction icon={Calendar} label="Visit" sub="Manage timing" to="/book" />
          </div>
        </section>

        <section className="hidden md:block">
          <SectionHeading eyebrow="Before Arrival" title="Prep List" action="Update" to="/checkout" />
          <div className="rounded-[24px] overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {prep.map((item, index) => (
              <button
                type="button"
                key={item.label}
                onClick={() => togglePrep(index)}
                className="w-full min-h-[62px] px-4 flex items-center justify-between text-left"
                style={{ borderTop: index ? `1px solid ${BORDER}` : 0 }}
              >
                <span className="flex items-center gap-3 font-body text-sm" style={{ color: TEXT }}>
                  <CheckCircle2 className="w-5 h-5" style={{ color: item.done ? ACCENT : DIM }} strokeWidth={1.7} />
                  {item.label}
                </span>
                <ChevronRight className="w-4 h-4" style={{ color: DIM }} strokeWidth={1.7} />
              </button>
            ))}
          </div>
        </section>

        <section className="hidden md:block">
          <SectionHeading eyebrow="Care Team" title="Support Thread" />
          <div className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {thread.map((msg) => (
                <div key={msg.id} className={`rounded-2xl px-3 py-2 ${msg.from === 'client' ? 'ml-8' : 'mr-8'}`} style={{ background: msg.from === 'client' ? 'hsl(var(--accent) / 0.08)' : CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  <p className="font-body text-sm leading-relaxed" style={{ color: TEXT }}>{msg.text}</p>
                  <p className="mt-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: DIM }}>{messageSenderLabel(msg.from)} · {msg.at}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                aria-label="Message the care team"
                value={supportText}
                onChange={(event) => setSupportText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') sendSupport(); }}
                placeholder="Ask the care team..."
                className="min-h-[52px] min-w-0 flex-1 rounded-2xl border px-4 font-body text-sm outline-none"
                style={{ background: CARD_STRONG, borderColor: BORDER, color: TEXT }}
              />
              <button type="button" onClick={sendSupport} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl" style={{ background: TEXT, color: INVERT }} aria-label="Send message">
                <Send className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </section>

        <section className="hidden md:block">
          <SectionHeading eyebrow="Visit Status" title="Timeline" />
          <div className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {timeline.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: item.done ? 'hsl(var(--accent) / 0.08)' : CARD_STRONG, border: `1px solid ${item.done ? 'hsl(var(--accent) / 0.20)' : BORDER}` }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: item.done ? ACCENT : DIM }} strokeWidth={1.7} />
                  </span>
                  <span className="font-body text-xs leading-snug" style={{ color: item.done ? TEXT : MUTED }}>{item.client || item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <MemberBottomNav />
    </div>
  );
}
