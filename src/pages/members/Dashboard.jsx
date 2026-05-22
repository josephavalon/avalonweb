import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Crown,
  FlaskConical,
  HeartPulse,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import { readLocal, writeLocal, appendActivity, readLastBooking } from '@/lib/localOs';
import { buildCreditLedger, buildLiveVisitTimeline, readSavedAddresses, readSupportThread, readVisitPrep, saveVisitPrep, sendSupportMessage } from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];
const BG = '#080807';
const CARD = 'rgba(255,255,255,0.045)';
const CARD_STRONG = 'rgba(255,255,255,0.075)';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT = '#F5EBDD';
const MUTED = 'rgba(245,235,221,0.62)';
const DIM = 'rgba(245,235,221,0.34)';
const GOLD = '#D3B15F';
const GREEN = '#52D28B';

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
  location: 'Home visit - 123 Main St',
  nurse: 'Stephanie R.',
  status: 'Confirmed',
};

const DEFAULT_PREFS = {
  address: '123 Main St',
  window: 'Afternoons',
  nurseNotes: 'Prefers slower drip rate',
  communication: 'Text first',
};

const HISTORY = [
  { drip: "Myers' Cocktail", date: 'May 6', detail: 'Completed', amount: '$0' },
  { drip: 'NAD+ Boost', date: 'Apr 22', detail: 'Completed', amount: '$0' },
  { drip: 'Immune Defense', date: 'Apr 8', detail: 'Completed', amount: '$0' },
];

function SectionHeading({ eyebrow, title, action, to }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <p className="font-body text-[10px] tracking-[0.3em] uppercase" style={{ color: DIM }}>{eyebrow}</p>
        <h2 className="font-heading text-3xl uppercase leading-none mt-1" style={{ color: TEXT }}>{title}</h2>
      </div>
      {action && (
        <Link to={to} className="font-body text-[10px] tracking-[0.18em] uppercase shrink-0" style={{ color: GOLD }}>
          {action}
        </Link>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label, sub, to, href, onClick, primary }) {
  const className = "rounded-[22px] p-4 min-h-[112px] flex flex-col justify-between text-left transition-transform active:scale-[0.98]";
  const style = {
    background: primary ? TEXT : CARD,
    border: `1px solid ${primary ? TEXT : BORDER}`,
    color: primary ? BG : TEXT,
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
      <Icon className="w-5 h-5 mb-5" style={{ color: GOLD }} strokeWidth={1.6} />
      <p className="font-heading text-4xl leading-none" style={{ color: TEXT }}>{value}</p>
      <p className="font-body text-[10px] tracking-[0.22em] uppercase mt-1" style={{ color: DIM }}>{label}</p>
      {sub && <p className="font-body text-xs mt-2 leading-snug" style={{ color: MUTED }}>{sub}</p>}
    </div>
  );
}

export default function MemberDashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [prep, setPrep] = useState(() => readVisitPrep());
  const [prefs, setPrefs] = useState(() => readLocal('clientPrefs', DEFAULT_PREFS));
  const [lastBooking, setLastBooking] = useState(() => readLastBooking());
  const [addresses] = useState(() => readSavedAddresses());
  const [thread, setThread] = useState(() => readSupportThread());
  const [supportText, setSupportText] = useState('');
  const firstName = user?.name || MEMBER.firstName;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const onLocalChange = (event) => {
      if (event.detail?.key === 'lastBooking') setLastBooking(readLastBooking());
      if (event.detail?.key === 'visitPrep') setPrep(readVisitPrep());
    };
    window.addEventListener('av.local.change', onLocalChange);
    window.addEventListener('storage', onLocalChange);
    return () => {
      window.removeEventListener('av.local.change', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    };
  }, []);

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

  const rotatePreference = (key, values) => {
    const current = prefs[key];
    const idx = values.indexOf(current);
    const nextPrefs = { ...prefs, [key]: values[(idx + 1) % values.length] };
    setPrefs(writeLocal('clientPrefs', nextPrefs));
    appendActivity(`Updated client preference: ${key}`, { role: 'client' });
  };

  const upcoming = lastBooking ? {
    drip: lastBooking.service || UPCOMING.drip,
    when: [lastBooking.date, lastBooking.time].filter(Boolean).join(' · ') || UPCOMING.when,
    location: lastBooking.address || UPCOMING.location,
    nurse: lastBooking.nurse && lastBooking.nurse !== 'Unassigned' ? lastBooking.nurse : lastBooking.nextStep || 'RN assignment pending',
    status: lastBooking.status || UPCOMING.status,
  } : UPCOMING;
  const timeline = buildLiveVisitTimeline(lastBooking);
  const ledger = buildCreditLedger(MEMBER, lastBooking);

  return (
    <div className="min-h-screen pb-[calc(11rem+env(safe-area-inset-bottom))]" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 px-4 py-3 backdrop-blur-2xl" style={{ background: 'rgba(8,8,7,0.86)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-heading text-2xl tracking-[0.2em]" style={{ color: GOLD }}>AV</span>
            <span className="hidden sm:inline font-body text-[10px] tracking-[0.22em] uppercase" style={{ color: DIM }}>Client Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" className="relative w-11 h-11 rounded-full flex items-center justify-center" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Notifications">
              <Bell className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.6} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full" style={{ background: GOLD }} />
            </button>
            <button type="button" onClick={handleSignOut} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Sign out">
              <LogOut className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-7 pb-10">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="rounded-[30px] p-5 sm:p-7 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(211,177,95,0.16), rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.025))', border: `1px solid ${BORDER}` }}
        >
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: 'rgba(211,177,95,0.10)', border: '1px solid rgba(211,177,95,0.28)' }}>
                <Crown className="w-3.5 h-3.5" style={{ color: GOLD }} strokeWidth={1.6} />
                <span className="font-body text-[9px] tracking-[0.24em] uppercase font-semibold" style={{ color: GOLD }}>{MEMBER.tier}</span>
              </div>
              <h1 className="font-heading text-5xl sm:text-7xl uppercase leading-[0.9]">
                {greeting},<br />{firstName}.
              </h1>
              <p className="font-body text-base mt-4 max-w-xl leading-relaxed" style={{ color: MUTED }}>
                Your visits, credits, care team, prep checklist, and subscription status are now one tap away.
              </p>
            </div>
            <div className="rounded-[24px] p-4" style={{ background: 'rgba(0,0,0,0.24)', border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-body text-[10px] tracking-[0.24em] uppercase mb-2" style={{ color: DIM }}>Next Visit</p>
                  <p className="font-heading text-3xl uppercase leading-none">{upcoming.drip}</p>
                </div>
                <span className="font-body text-[9px] tracking-[0.18em] uppercase rounded-full px-2.5 py-1" style={{ color: GREEN, background: 'rgba(82,210,139,0.12)', border: '1px solid rgba(82,210,139,0.28)' }}>
                  {upcoming.status}
                </span>
              </div>
              <div className="space-y-2 font-body text-sm" style={{ color: MUTED }}>
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4" strokeWidth={1.5} />{upcoming.when}</p>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4" strokeWidth={1.5} />{upcoming.location}</p>
                <p className="flex items-center gap-2"><UserRound className="w-4 h-4" strokeWidth={1.5} />{upcoming.nurse}</p>
              </div>
              <Link to="/book" className="mt-5 min-h-[58px] rounded-2xl flex items-center justify-center gap-2 font-body text-xs tracking-[0.2em] uppercase font-semibold" style={{ background: TEXT, color: BG }}>
                Adjust Visit <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric icon={Sparkles} label="Credits Left" value={`${MEMBER.credits}/${MEMBER.creditsTotal}`} sub={MEMBER.cadence} />
          <Metric icon={ShieldCheck} label="Plan" value="Active" sub={MEMBER.plan} />
          <Metric icon={CalendarClock} label="Renewal" value="Jun 1" sub="Credits roll while active" />
          <Metric icon={HeartPulse} label="Savings" value={`${MEMBER.discount}%`} sub="Subscriber add-on pricing" />
        </section>

        <section>
          <SectionHeading eyebrow="Fast Actions" title="What Next" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickAction icon={Calendar} label="Book" sub="Use a credit" to="/book" primary />
            <QuickAction icon={FlaskConical} label="Build" sub="Custom protocol" to="/custom" />
            <QuickAction icon={MessageCircle} label="Text" sub="Care team" href="sms:+14155550101" />
            <QuickAction icon={Phone} label="Call" sub="Support" href="tel:+14159807708" />
          </div>
        </section>

        <section>
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
                  <CheckCircle2 className="w-5 h-5" style={{ color: item.done ? GREEN : DIM }} strokeWidth={1.7} />
                  {item.label}
                </span>
                <ChevronRight className="w-4 h-4" style={{ color: DIM }} strokeWidth={1.7} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Care Team" title="Support Thread" />
          <div className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {thread.map((msg) => (
                <div key={msg.id} className={`rounded-2xl px-3 py-2 ${msg.from === 'client' ? 'ml-8' : 'mr-8'}`} style={{ background: msg.from === 'client' ? 'rgba(211,177,95,0.12)' : CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  <p className="font-body text-sm leading-relaxed" style={{ color: TEXT }}>{msg.text}</p>
                  <p className="mt-1 font-body text-[9px] uppercase tracking-[0.16em]" style={{ color: DIM }}>{msg.from === 'client' ? 'You' : 'Care Team'} · {msg.at}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={supportText}
                onChange={(event) => setSupportText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') sendSupport(); }}
                placeholder="Ask the care team..."
                className="min-h-[52px] min-w-0 flex-1 rounded-2xl border px-4 font-body text-sm outline-none"
                style={{ background: CARD_STRONG, borderColor: BORDER, color: TEXT }}
              />
              <button type="button" onClick={sendSupport} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl" style={{ background: TEXT, color: BG }} aria-label="Send message">
                <Send className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Visit Status" title="Timeline" />
          <div className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {timeline.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: item.done ? 'rgba(82,210,139,0.12)' : CARD_STRONG, border: `1px solid ${item.done ? 'rgba(82,210,139,0.28)' : BORDER}` }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: item.done ? GREEN : DIM }} strokeWidth={1.7} />
                  </span>
                  <span className="font-body text-xs leading-snug" style={{ color: item.done ? TEXT : MUTED }}>{item.client || item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Preferences" title="Care Defaults" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: 'address', label: 'Address', value: prefs.address, values: ['123 Main St', 'Office', 'Hotel'] },
              { key: 'window', label: 'Best Window', value: prefs.window, values: ['Afternoons', 'Morning', 'Evening'] },
              { key: 'nurseNotes', label: 'RN Note', value: prefs.nurseNotes, values: ['Prefers slower drip rate', 'Left arm preferred', 'Quiet visit'] },
              { key: 'communication', label: 'Contact', value: prefs.communication, values: ['Text first', 'Call first', 'Email summary'] },
            ].map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => rotatePreference(item.key, item.values)}
                className="rounded-[22px] p-4 text-left transition-transform active:scale-[0.98]"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
              >
                <p className="font-body text-[9px] tracking-[0.22em] uppercase" style={{ color: DIM }}>{item.label}</p>
                <p className="mt-3 font-body text-sm leading-snug" style={{ color: TEXT }}>{item.value}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Subscription" title="Plan Control" action="Plans" to="/subscription" />
          <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="font-heading text-3xl uppercase leading-none">{MEMBER.plan}</p>
                <p className="font-body text-sm mt-2" style={{ color: MUTED }}>Renews {MEMBER.renewal}. Unused credits roll forward while active.</p>
              </div>
              <span className="rounded-full px-3 py-1 font-body text-[9px] tracking-[0.18em] uppercase" style={{ color: GREEN, background: 'rgba(82,210,139,0.12)', border: '1px solid rgba(82,210,139,0.28)' }}>Active</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Credits', MEMBER.credits],
                ['Discount', `${MEMBER.discount}%`],
                ['Renewal', 'Jun 1'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                  <p className="font-heading text-2xl leading-none">{value}</p>
                  <p className="font-body text-[8px] tracking-[0.16em] uppercase mt-1" style={{ color: DIM }}>{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              {ledger.map((row, index) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5" style={{ borderTop: index ? `1px solid ${BORDER}` : 0 }}>
                  <span className="font-body text-xs" style={{ color: MUTED }}>{row.label}</span>
                  <span className="font-body text-xs font-semibold" style={{ color: row.tone === 'green' ? GREEN : row.tone === 'gold' ? GOLD : TEXT }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Saved Locations" title="Addresses" action="Book" to="/book" />
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-[22px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] tracking-[0.22em] uppercase" style={{ color: DIM }}>{address.label}</p>
                <p className="mt-3 font-body text-sm leading-snug" style={{ color: TEXT }}>{address.address}</p>
                <p className="mt-2 font-body text-xs" style={{ color: MUTED }}>{address.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="History" title="Recent Visits" action="All" to="/members/dashboard" />
          <div className="rounded-[24px] overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {HISTORY.map((visit, index) => (
              <div key={`${visit.drip}-${visit.date}`} className="px-4 py-4 flex items-center gap-3" style={{ borderTop: index ? `1px solid ${BORDER}` : 0 }}>
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: GOLD }} strokeWidth={1.6} />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm truncate" style={{ color: TEXT }}>{visit.drip}</p>
                  <p className="font-body text-xs mt-0.5" style={{ color: MUTED }}>{visit.date} · {visit.detail}</p>
                </div>
                <span className="font-body text-xs" style={{ color: DIM }}>{visit.amount}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <MemberBottomNav />
    </div>
  );
}
  useState;

  useState;

  useState;

  useState;

  useState;
