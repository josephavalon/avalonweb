import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Home, Hotel, Building2, Calendar,
  User, Phone, MessageSquare, CheckCircle, Clock,
  DollarSign, Users, ClipboardList, Shield, Zap,
  MapPin, Star, X, ChevronDown, Edit3, Send,
  Activity, Package, Heart, Syringe, RefreshCw,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import { useAuthStore } from '@/lib/useAuthStore';
import { REQUESTS } from '@/data/commandMockData';
import StatusPill from '@/components/ui/StatusPill';

const EASE = [0.16, 1, 0.3, 1];

const ACTIVITY = [
  { id: 1, text: 'Marcus T. marked Paid — Myers\' Cocktail', time: '8m ago', dot: 'bg-emerald-400' },
  { id: 2, text: 'Stephanie R. assigned to Elena V. — Beauty Drip', time: '22m ago', dot: 'bg-teal-400' },
  { id: 3, text: 'Intake received — Priya S.', time: '41m ago', dot: 'bg-blue-400' },
  { id: 4, text: 'GFE clearance pending — Serena W.', time: '1h ago', dot: 'bg-orange-400' },
  { id: 5, text: 'James L. event confirmed — 8 guests', time: '2h ago', dot: 'bg-emerald-400' },
  { id: 6, text: 'Payment link sent — James L.', time: '2h ago', dot: 'bg-blue-400' },
  { id: 7, text: 'New request — Sofia R., Marina', time: '3h ago', dot: 'bg-blue-400' },
  { id: 8, text: 'Ryan C. follow-up due', time: '4h ago', dot: 'bg-purple-400' },
];

const RISKS = [
  { text: '2 visits need GFE clearance', level: 'red' },
  { text: '3 nurses unassigned for today', level: 'red' },
  { text: '3 payments pending ($1,140)', level: 'amber' },
  { text: '1 consent pending — event visit', level: 'amber' },
];

const METRICS = [
  { label: 'New Requests',   value: '8',      sub: '3 same-day',          icon: ClipboardList, color: '#64a0ff', urgent: false },
  { label: 'Pending Confirm',value: '5',      sub: '2 need response',      icon: Clock,         color: '#fbbf24', urgent: false },
  { label: 'Visits Today',   value: '3',      sub: '1 in progress',        icon: Calendar,      color: '#34d399', urgent: false },
  { label: 'Needs Clearance',value: '4',      sub: '2 same-day',           icon: Shield,        color: '#f87171', urgent: true  },
  { label: 'Nurses Available',value: '4',     sub: '2 assigned today',     icon: Users,         color: '#34d399', urgent: false },
  { label: 'Payment Pending', value: '$660',  sub: '3 visits',             icon: DollarSign,    color: '#f87171', urgent: true  },
  { label: 'Follow-Ups Due',  value: '9',     sub: '3 overdue',            icon: Heart,         color: '#a78bfa', urgent: false },
  { label: 'Revenue Today',   value: '$1,280',sub: '3 paid visits',        icon: Activity,      color: 'hsl(var(--accent))', urgent: false },
];

const FILTER_TABS = ['All', 'New', 'Confirm', 'Clearance', 'Assign', 'Payment', 'Ready', 'Completed'];

const LocIcon = ({ type }) => {
  const map = { home: Home, hotel: Hotel, office: Building2, event: Calendar };
  const Icon = map[type] || MapPin;
  return <Icon className="w-3.5 h-3.5 shrink-0 text-foreground/40" strokeWidth={1.5} />;
};

// ─── Visit Detail Drawer ──────────────────────────────────────────────────────
function VisitDrawer({ req, onClose }) {
  const [status, setStatus] = useState(req.status);
  const STATUSES = [
    'New Request','Contacted','Confirmed','Intake Pending','Consent Pending',
    'GFE Pending','Cleared','Nurse Assigned','Payment Pending','Ready for Visit',
    'Completed','Follow-Up Due','Cancelled',
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end md:items-center justify-center md:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.38, ease: EASE }}
        className="w-full md:max-w-2xl bg-background border border-foreground/[0.1] rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-foreground/[0.07]">
          <div>
            <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-1">Visit Detail</p>
            <h3 className="font-heading text-2xl text-foreground uppercase">{req.client}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusPill status={status} />
              {req.priority && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent text-[8px] tracking-[0.15em] uppercase">
                  <Star className="w-2.5 h-2.5" /> Priority
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/50 hover:text-foreground transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Visit info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Location', req.location], ['Time', req.time],
              ['Therapy', req.therapy], ['Guests', req.guests],
              ['Total', `$${req.total.toLocaleString()}`], ['Source', req.source],
              ['Phone', req.phone], ['Email', req.email],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="font-body text-[8px] tracking-[0.25em] uppercase text-foreground/35 mb-0.5">{k}</p>
                <p className="font-body text-sm text-foreground">{v}</p>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          {req.addOns?.length > 0 && (
            <div>
              <p className="font-body text-[8px] tracking-[0.25em] uppercase text-foreground/35 mb-2">Add-ons</p>
              <div className="flex flex-wrap gap-1.5">
                {req.addOns.map((a) => (
                  <span key={a} className="font-body text-[10px] px-2 py-0.5 rounded-full border border-foreground/15 text-foreground/60">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Clinical pipeline */}
          <div>
            <p className="font-body text-[8px] tracking-[0.25em] uppercase text-foreground/35 mb-2">Clinical Pipeline</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['Intake', req.intake],
                ['Consent', req.consent],
                ['GFE', req.gfe],
                ['Payment', req.payment],
              ].map(([label, val]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <p className="font-body text-[8px] uppercase text-foreground/30">{label}</p>
                  <StatusPill status={val} tiny />
                </div>
              ))}
              <div className="flex flex-col gap-0.5">
                <p className="font-body text-[8px] uppercase text-foreground/30">Nurse</p>
                <span className="font-body text-[9px] text-foreground/60">{req.nurse || '— Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* Status picker — grouped */}
          <div>
            <p className="font-body text-[8px] tracking-[0.25em] uppercase text-foreground/35 mb-3">Update Status</p>
            {[
              { group: 'Scheduling',  statuses: ['New Request', 'Contacted', 'Confirmed'] },
              { group: 'Clearance',   statuses: ['Intake Pending', 'Consent Pending', 'GFE Pending', 'Cleared'] },
              { group: 'Assignment',  statuses: ['Nurse Assigned', 'Payment Pending', 'Paid'] },
              { group: 'Visit',       statuses: ['Ready for Visit', 'In Progress', 'Completed'] },
              { group: 'Post-Visit',  statuses: ['Follow-Up Due', 'Cancelled'] },
            ].map(({ group, statuses }) => (
              <div key={group} className="mb-3">
                <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/25 mb-1.5">{group}</p>
                <div className="flex flex-wrap gap-1">
                  {statuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className="px-2.5 py-1 rounded-full border text-[9px] tracking-[0.1em] uppercase font-medium transition-all"
                      style={
                        status === s
                          ? { background: 'rgba(201,168,76,0.15)', color: '#c9a84c', borderColor: 'rgba(201,168,76,0.4)' }
                          : { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.38)' }
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {req.notes && (
            <div>
              <p className="font-body text-[8px] tracking-[0.25em] uppercase text-foreground/35 mb-1.5">Internal Notes</p>
              <p className="font-body text-sm text-foreground/60 leading-relaxed">{req.notes}</p>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Text Client',   icon: MessageSquare, color: 'text-blue-300 border-blue-500/25 bg-blue-500/5' },
              { label: 'Assign Nurse',  icon: Users,         color: 'text-teal-300 border-teal-500/25 bg-teal-500/5' },
              { label: 'Mark Cleared',  icon: Shield,        color: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/5' },
              { label: 'Mark Paid',     icon: CheckCircle,   color: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/5' },
              { label: 'Complete',      icon: Zap,           color: 'text-accent border-accent/25 bg-accent/5' },
              { label: 'Add Note',      icon: Edit3,         color: 'text-foreground/60 border-foreground/15 bg-foreground/[0.03]' },
            ].map(({ label, icon: Icon, color }) => (
              <button
                key={label}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-center transition-colors hover:brightness-110 ${color}`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                <span className="font-body text-[9px] tracking-[0.1em] uppercase leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Manual mode notice */}
          <p className="font-body text-[9px] text-foreground/25 text-center tracking-[0.1em] uppercase pb-2">
            Manual Fulfillment Mode · Status changes are local until CRM sync
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({ req, onOpen }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] hover:bg-foreground/[0.04] transition-colors group"
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <LocIcon type={req.locType} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-body text-sm font-semibold text-foreground truncate">{req.client}</span>
                {req.priority && <Star className="w-3 h-3 text-accent shrink-0" />}
              </div>
              <p className="font-body text-[11px] text-foreground/45 truncate">{req.location} · {req.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-heading text-base text-foreground">${req.total.toLocaleString()}</span>
            <StatusPill status={req.status} />
          </div>
        </div>

        {/* Therapy + source */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="font-body text-[10px] text-foreground/60 px-2 py-0.5 rounded-full border border-foreground/[0.08] bg-foreground/[0.03]">
            {req.therapy}
          </span>
          {req.addOns.map((a) => (
            <span key={a} className="font-body text-[10px] text-foreground/40">{a}</span>
          ))}
          {req.guests > 1 && (
            <span className="font-body text-[10px] text-foreground/40">×{req.guests} guests</span>
          )}
          <span className="ml-auto font-body text-[9px] text-foreground/30 uppercase tracking-[0.15em]">{req.source}</span>
        </div>

        {/* Pipeline pills */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {[
            ['Intake', req.intake],
            ['Consent', req.consent],
            ['GFE', req.gfe],
            ['Payment', req.payment],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="font-body text-[8px] uppercase text-foreground/25">{label}</span>
              <StatusPill status={val} tiny />
            </div>
          ))}
          {req.nurse && (
            <span className="font-body text-[9px] text-teal-400 ml-1">· {req.nurse}</span>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpen(req)}
            className="flex-1 py-1.5 rounded-lg border border-foreground/10 text-foreground/60 hover:text-foreground hover:border-foreground/25 transition-colors font-body text-[10px] tracking-[0.15em] uppercase"
          >
            Open
          </button>
          {['Text', 'Assign', 'Mark Paid'].map((label) => (
            <button
              key={label}
              className="px-3 py-1.5 rounded-lg border border-foreground/10 text-foreground/50 hover:text-foreground hover:border-foreground/25 transition-colors font-body text-[10px] tracking-[0.15em] uppercase"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedReq, setSelectedReq] = useState(null);

  React.useEffect(() => {
    if (!user) navigate('/provider', { replace: true });
  }, [user, navigate]);

  const filterMap = {
    All: () => true,
    New: (r) => r.status === 'New Request' || r.status === 'Contacted',
    Confirm: (r) => r.status === 'Confirmed',
    Clearance: (r) => ['Intake Pending', 'Consent Pending', 'GFE Pending'].includes(r.status),
    Assign: (r) => r.status === 'Cleared' && !r.nurse,
    Payment: (r) => r.payment === 'Payment Pending',
    Ready: (r) => r.status === 'Ready for Visit',
    Completed: (r) => r.status === 'Completed',
  };

  const filtered = REQUESTS.filter(filterMap[activeFilter] || (() => true));

  return (
    <AdminLayout>
      {/* ── Header via PageShell ───────────────────────────────────────── */}
      <div className="mb-7">
        <PageShell
          eyebrow="SF Bay Area · Launch Ops"
          title="Command Center"
          subtitle="SF Bay Area · Manual Fulfillment Mode"
        />
      </div>

      {/* ── Metric tiles ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {METRICS.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
              className={`rounded-xl border p-4 ${m.urgent ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-foreground/[0.06] bg-foreground/[0.03]'}`}
            >
              <div className="flex items-start justify-between mb-2.5">
                <p className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/45 leading-tight max-w-[80%]">{m.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: m.color + '18' }}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: m.color }} />
                </div>
              </div>
              <p className="font-heading text-3xl text-foreground leading-none tracking-tight mb-1">{m.value}</p>
              <p className="font-body text-[10px] text-foreground/35">{m.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* ── Two-col layout ──────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Left: Request Queue ───────────────────────────────────────── */}
        <div>
          {/* Today's Risks */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
            className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4 mb-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" strokeWidth={2} />
              <p className="font-body text-[10px] tracking-[0.3em] uppercase text-red-400 font-medium">Today's Risks</p>
            </div>
            <div className="space-y-1.5">
              {RISKS.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.level === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <p className="font-body text-[11px] text-foreground/65">{r.text}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Request Queue header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg text-foreground uppercase tracking-wide">Request Queue</h2>
            <span className="font-body text-[10px] text-foreground/35 tracking-[0.15em] uppercase">{filtered.length} requests</span>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`shrink-0 px-3 py-1.5 rounded-full font-body text-[10px] tracking-[0.15em] uppercase transition-all border ${
                  activeFilter === tab
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-foreground/15 text-foreground/50 hover:border-foreground/30 hover:text-foreground/75'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((req) => (
                <RequestCard key={req.id} req={req} onOpen={setSelectedReq} />
              ))}
              {filtered.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-10 text-foreground/30 font-body text-sm"
                >
                  No requests in this queue
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right: Activity Feed ─────────────────────────────────────── */}
        <div>
          <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.025] sticky top-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.06]">
              <h2 className="font-body text-[11px] font-medium text-foreground tracking-wide uppercase">Activity</h2>
              <button className="text-foreground/30 hover:text-foreground transition-colors">
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="divide-y divide-foreground/[0.04]">
              {ACTIVITY.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${a.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[11px] text-foreground/75 leading-snug">{a.text}</p>
                    <p className="font-body text-[9px] mt-0.5 text-foreground/35">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-foreground/[0.06]">
              <p className="font-body text-[9px] text-foreground/25 text-center tracking-[0.1em] uppercase">
                Manual Fulfillment Mode · CRM Sync Pending
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Visit Detail Drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedReq && (
          <VisitDrawer req={selectedReq} onClose={() => setSelectedReq(null)} />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
