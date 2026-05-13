import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, LogOut, Calendar, FlaskConical, UserPlus, Phone,
  MapPin, ChevronRight, CheckCircle2, ArrowRight, Crown, CalendarClock,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useToast } from '@/components/ui/use-toast';
import MemberBottomNav from '@/components/landing/MemberBottomNav';

const EASE = [0.16, 1, 0.3, 1];

// ── Design tokens ─────────────────────────────────────────────────
const BG     = '#0a0a08';
const CARD   = '#111110';
const CARD2  = '#141412';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER2 = 'rgba(255,255,255,0.12)';
const TEXT   = '#F0EDE4';
const MUTED  = 'rgba(240,237,228,0.55)';
const DIMMER = 'rgba(240,237,228,0.28)';
const GOLD   = '#C9A84C';
const GOLDBG = 'rgba(201,168,76,0.08)';
const GOLDBR = 'rgba(201,168,76,0.3)';

// ── Static placeholder data ───────────────────────────────────────
const MEMBER = {
  firstName: 'Sarah',
  tier: 'Inner Circle Member',
  credits: 2,
  creditsTotal: 4,
  plan: 'Inner Circle — Monthly',
  renewal: 'June 1, 2026',
  discount: 15,
};

const UPCOMING = {
  drip: "Myers' Cocktail",
  when: 'Tomorrow, 2:00 PM',
  location: 'Your Home — 123 Main St',
  status: 'CONFIRMED',
};

const HISTORY = [
  { drip: "Myers' Cocktail",      date: 'May 6, 2026',   status: 'Completed', amount: '$0' },
  { drip: 'NAD+ Boost',           date: 'Apr 22, 2026',  status: 'Completed', amount: '$0' },
  { drip: 'Immune Defense',       date: 'Apr 8, 2026',   status: 'Completed', amount: '$0' },
];

// ── Quick Action cards ────────────────────────────────────────────
const QUICK_ACTIONS = [
  { key: 'book',     icon: Calendar,    label: 'Book Session',    href: '/store' },
  { key: 'protocol', icon: FlaskConical,label: 'Membership',      href: '/membership' },
  { key: 'refer',    icon: UserPlus,    label: 'Refer a Friend',  href: '#' },
  { key: 'nurse',    icon: Phone,       label: 'Contact Nurse',   href: 'tel:+14155550101' },
];

// BottomNav is extracted to MemberBottomNav component

// ── Section label ─────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="font-body text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: DIMMER }}>
      {children}
    </p>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function MemberDashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [referToast, setReferToast] = useState(false);
  const [nurseToast, setNurseToast] = useState(false);

  const handleSignOut = () => { signOut(); navigate('/members'); };

  const handleQuickAction = (key) => {
    if (key === 'refer') {
      toast({ title: 'Coming Soon', description: 'Referral program launches with membership.' });
      setReferToast(true); setTimeout(() => setReferToast(false), 2800);
    }
    if (key === 'nurse') { setNurseToast(true); setTimeout(() => setNurseToast(false), 2800); }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen pb-32" style={{ background: BG }}>

      {/* ── Top Bar ───────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5"
        style={{
          background: 'rgba(10,10,8,0.95)',
          borderBottom: `1px solid ${BORDER}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <span className="font-heading text-[22px] tracking-[0.2em] leading-none" style={{ color: TEXT }}>AV</span>
          <span className="font-body text-[10px] tracking-[0.22em] uppercase" style={{ color: DIMMER }}>Avalon Vitality</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}` }}
            >
              <Bell className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.5} />
            </button>
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: GOLD }} />
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full font-body text-[10px] tracking-[0.18em] uppercase transition-opacity hover:opacity-75"
            style={{ border: `1px solid ${BORDER}`, color: MUTED }}
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-8">

        {/* ── HEADER: Greeting + Credits ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {/* Tier badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
            style={{ background: GOLDBG, border: `1px solid ${GOLDBR}` }}>
            <Crown className="w-3 h-3" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="font-body text-[9px] tracking-[0.25em] uppercase font-semibold" style={{ color: GOLD }}>
              {MEMBER.tier}
            </span>
          </div>

          {/* Greeting */}
          <h1 className="font-heading text-5xl sm:text-6xl uppercase leading-none tracking-tight mb-5" style={{ color: TEXT }}>
            {greeting},<br />{MEMBER.firstName}.
          </h1>

          {/* Credits display */}
          <div
            className="rounded-2xl p-5 flex items-center justify-between"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <div>
              <p className="font-body text-[10px] tracking-[0.28em] uppercase mb-1" style={{ color: MUTED }}>
                Credits Remaining This Month
              </p>
              <div className="flex items-end gap-2">
                <span className="font-heading text-[56px] leading-none tracking-tight" style={{ color: GOLD, lineHeight: 1 }}>
                  {MEMBER.credits}
                </span>
                <span className="font-heading text-2xl leading-none mb-2" style={{ color: DIMMER }}>
                  / {MEMBER.creditsTotal}
                </span>
              </div>
            </div>
            <Link
              to="/store"
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-body text-xs tracking-[0.2em] uppercase font-semibold transition-opacity hover:opacity-80"
              style={{ background: TEXT, color: BG }}
            >
              Book <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </motion.div>

        {/* ── QUICK ACTIONS ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.08 }}
        >
          <SectionLabel>Quick Actions</SectionLabel>
          {/* Horizontal scroll on mobile, 4-col on md+ */}
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4">
            {QUICK_ACTIONS.map((action) => {
              const isNav = Boolean(action.href) && action.key !== 'refer';
              const El = isNav ? Link : 'button';
              return (
                <El
                  key={action.key}
                  to={isNav ? action.href : undefined}
                  href={!isNav && action.href && action.key !== 'refer' ? action.href : undefined}
                  type={isNav ? undefined : 'button'}
                  onClick={action.key === 'refer' ? (e) => { e.preventDefault(); handleQuickAction(action.key); } : (!isNav ? () => handleQuickAction(action.key) : undefined)}
                  className="flex flex-col items-start gap-3 p-4 rounded-2xl transition-opacity active:opacity-60 hover:opacity-80 shrink-0 w-36 md:w-auto"
                  style={{ background: CARD, border: `1px solid ${BORDER2}` }}
                >
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    <action.icon className="w-4 h-4" style={{ color: MUTED }} strokeWidth={1.5} />
                  </div>
                  <p
                    className="font-body text-[11px] tracking-wide leading-snug whitespace-pre-line"
                    style={{ color: TEXT }}
                  >
                    {action.label}
                  </p>
                </El>
              );
            })}
          </div>
        </motion.div>

        {/* ── UPCOMING VISIT ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.14 }}
        >
          <SectionLabel>Upcoming Visit</SectionLabel>
          <div
            className="rounded-2xl p-5"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            {/* Status badge + drip name */}
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-heading text-2xl uppercase tracking-tight leading-none" style={{ color: TEXT }}>
                {UPCOMING.drip}
              </h2>
              <span
                className="font-body text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full shrink-0 ml-3"
                style={{ background: GOLDBG, border: `1px solid ${GOLDBR}`, color: GOLD }}
              >
                {UPCOMING.status}
              </span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: DIMMER }} strokeWidth={1.5} />
              <p className="font-body text-sm" style={{ color: MUTED }}>{UPCOMING.when}</p>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: DIMMER }} strokeWidth={1.5} />
              <p className="font-body text-sm" style={{ color: MUTED }}>{UPCOMING.location}</p>
            </div>

            {/* Divider */}
            <div className="mb-4" style={{ height: '1px', background: BORDER }} />

            <button
              className="font-body text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-75"
              style={{ color: GOLD }}
            >
              View Details
            </button>
          </div>
        </motion.div>

        {/* ── VISIT HISTORY ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Visit History</SectionLabel>
            <button
              className="font-body text-[10px] tracking-[0.2em] uppercase transition-opacity hover:opacity-75 -mt-3"
              style={{ color: GOLD }}
            >
              View All
            </button>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            {HISTORY.map((visit, i) => (
              <div key={i}>
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Timeline dot */}
                  <div className="relative flex flex-col items-center self-stretch">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                    {i < HISTORY.length - 1 && (
                      <div className="flex-1 w-px mt-1" style={{ background: BORDER, minHeight: '20px' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium" style={{ color: TEXT }}>{visit.drip}</p>
                    <p className="font-body text-xs mt-0.5" style={{ color: MUTED }}>{visit.date}</p>
                  </div>

                  {/* Right side */}
                  <div className="text-right shrink-0">
                    <span
                      className="font-body text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER2}`, color: MUTED }}
                    >
                      {visit.status}
                    </span>
                    <p className="font-body text-xs mt-1.5" style={{ color: DIMMER }}>{visit.amount}</p>
                  </div>
                </div>
                {i < HISTORY.length - 1 && (
                  <div style={{ height: '1px', background: BORDER, marginLeft: '57px', marginRight: '20px' }} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── MEMBERSHIP SUMMARY ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.26 }}
        >
          <SectionLabel>Membership</SectionLabel>
          <div
            className="rounded-2xl p-5"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            {/* Plan + renewal */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="font-body text-xs tracking-wide font-medium mb-0.5" style={{ color: TEXT }}>
                  {MEMBER.plan}
                </p>
                <p className="font-body text-xs" style={{ color: MUTED }}>
                  Renews {MEMBER.renewal}
                </p>
              </div>
              <div
                className="px-2.5 py-1 rounded-full"
                style={{ background: GOLDBG, border: `1px solid ${GOLDBR}` }}
              >
                <span className="font-body text-[9px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>Active</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Next Renewal',    value: MEMBER.renewal, icon: CalendarClock },
                { label: 'Credits Left',    value: String(MEMBER.credits) },
                { label: 'Member Discount', value: `${MEMBER.discount}%` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}
                >
                  {stat.icon && <stat.icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: GOLD }} strokeWidth={1.5} />}
                  <p className="font-heading text-xl leading-none mb-1" style={{ color: TEXT }}>{stat.value}</p>
                  <p className="font-body text-[8px] tracking-[0.12em] uppercase leading-snug" style={{ color: DIMMER }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="mb-4" style={{ height: '1px', background: BORDER }} />

            <Link
              to="/membership"
              className="flex items-center justify-between w-full font-body text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-75"
              style={{ color: GOLD }}
            >
              Manage Membership
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </motion.div>

      </div>

      {/* ── Bottom Nav ───────────────────────────────────────────── */}
      <MemberBottomNav />

      {/* ── Toast notifications ───────────────────────────────────── */}
      <AnimatePresence>
        {(referToast || nurseToast) && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-body text-sm tracking-wide whitespace-nowrap"
            style={{ background: CARD2, border: `1px solid ${BORDER2}`, color: TEXT }}
          >
            {referToast ? 'Referral link coming soon.' : 'Your nurse will be in touch shortly.'}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
