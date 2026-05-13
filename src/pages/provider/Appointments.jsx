import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Home, Hotel, Building2, Calendar, Star, X,
  MapPin, Phone, MessageSquare, Users, Shield, CheckCircle,
  Clock, DollarSign, AlertTriangle, Edit3, Zap, Heart,
  ChevronRight, Activity, Droplets, Syringe, Package,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import {
  REQUESTS, ALL_STATUSES,
} from '@/data/commandMockData';
import StatusPill from '@/components/ui/StatusPill';

// ── Constants ─────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1];

// ── LocIcon ───────────────────────────────────────────────────────────────────

function LocIcon({ locType, className }) {
  const cls = className || 'w-4 h-4';
  if (locType === 'home')   return <Home    className={cls} />;
  if (locType === 'hotel')  return <Hotel   className={cls} />;
  if (locType === 'office') return <Building2 className={cls} />;
  if (locType === 'event')  return <Calendar className={cls} />;
  return <MapPin className={cls} />;
}

// Derives service-type icon from therapy name string — IV · IM · Package
function TherapyBadge({ therapy }) {
  const t = (therapy || '').toLowerCase();
  if (/package|kit|bundle/i.test(t)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] tracking-[0.12em] uppercase font-semibold border border-white/10 text-white/45">
        <Package className="w-2.5 h-2.5" strokeWidth={2} />PKG
      </span>
    );
  }
  if (/shot|push|injection|im\b|b12|mic|glutathione|biotin|vitamin d|vitamin c shot/i.test(t)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] tracking-[0.12em] uppercase font-semibold border border-white/10 text-white/45">
        <Syringe className="w-2.5 h-2.5" strokeWidth={2} />IM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] tracking-[0.12em] uppercase font-semibold border border-white/10 text-white/45">
      <Droplets className="w-2.5 h-2.5" strokeWidth={2} />IV
    </span>
  );
}

// ── FilterChips ───────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'new',       label: 'New' },
  { key: 'sameday',   label: 'Same-Day' },
  { key: 'confirm',   label: 'Confirm' },
  { key: 'clearance', label: 'Clearance' },
  { key: 'assign',    label: 'Assign' },
  { key: 'payment',   label: 'Payment' },
  { key: 'ready',     label: 'Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'followup',  label: 'Follow-Up' },
  { key: 'cancelled', label: 'Cancelled' },
];

const TODAY_DATE = '2026-05-12';

function filterRequests(requests, tab) {
  switch (tab) {
    case 'new':       return requests.filter(r => r.status === 'New Request' || r.status === 'Contacted');
    case 'sameday':   return requests.filter(r => r.date === TODAY_DATE);
    case 'confirm':   return requests.filter(r => ['New Request', 'Contacted', 'Confirmed'].includes(r.status));
    case 'clearance': return requests.filter(r => r.intake === 'Pending' || r.consent === 'Pending' || r.gfe === 'Pending' || r.gfe === 'Blocked');
    case 'assign':    return requests.filter(r => !r.nurse || r.status === 'Nurse Needed');
    case 'payment':   return requests.filter(r => r.payment === 'Payment Pending' || r.payment === 'Link Sent');
    case 'ready':     return requests.filter(r => r.status === 'Ready for Visit' || r.status === 'In Progress');
    case 'completed': return requests.filter(r => r.status === 'Completed');
    case 'followup':  return requests.filter(r => r.status === 'Follow-Up Due');
    case 'cancelled': return requests.filter(r => r.status === 'Cancelled');
    default:          return requests;
  }
}

function FilterChips({ active, onChange, requests }) {
  const counts = useMemo(() => {
    const out = {};
    FILTER_TABS.forEach(t => {
      out[t.key] = filterRequests(requests, t.key).length;
    });
    return out;
  }, [requests]);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {FILTER_TABS.map(tab => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
            style={{
              background: isActive ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.05)',
              border: isActive ? '1px solid rgba(201,168,76,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: isActive ? '#c9a84c' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{
                background: isActive ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.1)',
                color: isActive ? '#c9a84c' : 'rgba(255,255,255,0.4)',
              }}
            >
              {counts[tab.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── SearchBar ─────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      />
      <input
        type="text"
        placeholder="Search client…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-xl text-sm placeholder-white/30"
        style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.08)',
          outline: 'none',
          fontFamily: 'inherit',
          color: '#ffffff',
        }}
      />
    </div>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────

function QBtn({ label, color, onClick }) {
  const colors = {
    gold:    { border: '#c9a84c', text: '#c9a84c', bg: 'rgba(201,168,76,0.08)' },
    emerald: { border: '#34d399', text: '#34d399', bg: 'rgba(52,211,153,0.08)' },
    blue:    { border: '#60a5fa', text: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
    red:     { border: '#f87171', text: '#f87171', bg: 'rgba(248,113,113,0.08)' },
    amber:   { border: '#fbbf24', text: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
    muted:   { border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.04)' },
  };
  const c = colors[color] || colors.muted;
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap"
      style={{
        border: `1px solid ${c.border}`,
        color: c.text,
        background: c.bg,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

// ── RequestCard ───────────────────────────────────────────────────────────────

function RequestCard({ req, index, onOpen, onStatusChange }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.38, ease: EASE, delay: index * 0.04 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        background: '#141414',
        borderColor: req.priority ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.07)',
      }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
        >
          <LocIcon locType={req.locType} className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{req.client}</span>
            {(req.isVIP || req.priority) && (
              <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c9a84c', fill: '#c9a84c' }} />
            )}
            <TherapyBadge therapy={req.therapy} />
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {req.date} · {req.time} · {req.guests > 1 ? `${req.guests} guests` : '1 guest'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            ${req.total.toLocaleString()}
          </span>
          <StatusPill status={req.status} />
        </div>
      </div>

      {/* Therapy + addOns row */}
      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-medium text-white/80">{req.therapy}</span>
        {req.addOns.map(a => (
          <span
            key={a}
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {a}
          </span>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {req.source}
        </span>
      </div>

      {/* Pipeline pills row */}
      <div
        className="mx-4 mb-3 px-3 py-2 rounded-xl flex items-center gap-3 flex-wrap"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <PipelineItem label="Intake" value={req.intake} />
        <PipelineItem label="Consent" value={req.consent} />
        <PipelineItem label="GFE" value={req.gfe} />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] tracking-[0.1em] uppercase font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Nurse
          </span>
          {req.nurse ? (
            <span className="text-[10px] font-medium" style={{ color: '#34d399' }}>{req.nurse}</span>
          ) : (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              Needed
            </span>
          )}
        </div>
        <PipelineItem label="Payment" value={req.payment} />
      </div>

      {/* Quick actions */}
      <div
        className="flex items-center gap-2 px-4 pb-4 flex-wrap border-t pt-3"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <QBtn label="Open" color="gold" onClick={() => onOpen(req)} />
        <QBtn label="Text" color="blue" onClick={() => {}} />
        {req.status === 'New Request' || req.status === 'Contacted'
          ? <QBtn label="Confirm" color="emerald" onClick={() => onStatusChange(req.id, 'Confirmed')} />
          : null
        }
        {!req.nurse
          ? <QBtn label="Assign Nurse" color="amber" onClick={() => {}} />
          : null
        }
        {req.payment === 'Payment Pending' || req.payment === 'Link Sent'
          ? <QBtn label="Mark Paid" color="emerald" onClick={() => onStatusChange(req.id, 'Paid', 'payment')} />
          : null
        }
        {req.status !== 'Completed' && req.status !== 'Cancelled'
          ? <QBtn label="Complete" color="muted" onClick={() => onStatusChange(req.id, 'Completed')} />
          : null
        }
      </div>
    </motion.div>
  );
}

function PipelineItem({ label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] tracking-[0.1em] uppercase font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {label}
      </span>
      <StatusPill status={value} tiny />
    </div>
  );
}

// ── VisitDetailDrawer ─────────────────────────────────────────────────────────

const TIMELINE_PLACEHOLDER = [
  { text: 'Status updated to Ready for Visit', time: '9:42 AM' },
  { text: 'Payment confirmed — Square Link', time: '9:15 AM' },
  { text: 'Nurse assigned — Stephanie R.', time: '8:55 AM' },
  { text: 'GFE cleared by supervising physician', time: '8:40 AM' },
  { text: 'Consent form signed digitally', time: '8:20 AM' },
];

const DRAWER_ACTIONS = [
  { label: 'Text Client',           color: 'blue',    field: null },
  { label: 'Confirm Visit',         color: 'emerald', status: 'Confirmed' },
  { label: 'Assign Nurse',          color: 'amber',   field: null },
  { label: 'Mark Intake Received',  color: 'emerald', intake: 'Received' },
  { label: 'Mark Consent Signed',   color: 'emerald', consent: 'Signed' },
  { label: 'Mark GFE Pending',      color: 'amber',   gfe: 'Pending' },
  { label: 'Mark Cleared',          color: 'emerald', gfe: 'Cleared' },
  { label: 'Mark Blocked',          color: 'red',     gfe: 'Blocked' },
  { label: 'Mark Link Sent',        color: 'amber',   payment: 'Link Sent' },
  { label: 'Mark Paid',             color: 'emerald', payment: 'Paid' },
  { label: 'Mark Ready',            color: 'emerald', status: 'Ready for Visit' },
  { label: 'Complete Visit',        color: 'emerald', status: 'Completed' },
  { label: 'Add Note',              color: 'muted',   field: null },
  { label: 'Flag Issue',            color: 'red',     field: null },
  { label: 'Cancel Visit',          color: 'red',     status: 'Cancelled' },
];

function VisitDetailDrawer({ req, onClose, onUpdate }) {
  const [localReq, setLocalReq] = useState(req);
  const [notes, setNotes] = useState(req.notes || '');

  function applyAction(action) {
    const patch = {};
    if (action.status)  patch.status  = action.status;
    if (action.intake)  patch.intake  = action.intake;
    if (action.consent) patch.consent = action.consent;
    if (action.gfe)     patch.gfe     = action.gfe;
    if (action.payment) patch.payment = action.payment;
    if (Object.keys(patch).length > 0) {
      const updated = { ...localReq, ...patch };
      setLocalReq(updated);
      onUpdate(req.id, patch);
    }
  }

  function applyStatus(status) {
    const updated = { ...localReq, status };
    setLocalReq(updated);
    onUpdate(req.id, { status });
  }

  // Ready check
  const checks = {
    confirmed:   ['Confirmed','Cleared','Nurse Assigned','Nurse Needed','In Progress','Ready for Visit','Completed'].includes(localReq.status),
    intake:      localReq.intake === 'Received',
    consent:     localReq.consent === 'Signed',
    gfe:         localReq.gfe === 'Cleared',
    nurse:       !!localReq.nurse,
    payment:     localReq.payment !== 'Payment Pending',
  };
  const checkLabels = {
    confirmed:  'Visit confirmed',
    intake:     'Intake received',
    consent:    'Consent signed',
    gfe:        'GFE cleared',
    nurse:      'Nurse assigned',
    payment:    'Payment not pending',
  };
  const allReady = Object.values(checks).every(Boolean);
  const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => checkLabels[k]);

  const infoGrid = [
    { label: 'Location',  value: localReq.location },
    { label: 'Date',      value: localReq.date },
    { label: 'Time',      value: localReq.time },
    { label: 'Therapy',   value: localReq.therapy },
    { label: 'Guests',    value: String(localReq.guests) },
    { label: 'Total',     value: `$${localReq.total.toLocaleString()}` },
    { label: 'Source',    value: localReq.source },
    { label: 'Phone',     value: localReq.phone },
    { label: 'Email',     value: localReq.email },
  ];

  return (
    <motion.div
      key="drawer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 md:flex md:justify-end"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        key="drawer-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-0 z-50 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[440px] md:max-h-screen border overflow-hidden flex flex-col md:rounded-none md:border-t-0 md:border-l md:border-r-0"
        style={{
          background: '#141414',
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '90dvh',
        }}
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden w-10 h-1 rounded-full bg-white/15 mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Visit Detail
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-2xl text-white leading-none">{localReq.client}</h2>
              <StatusPill status={localReq.status} />
              {(localReq.isVIP || localReq.priority) && (
                <span
                  className="flex items-center gap-1 text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' }}
                >
                  <Star className="w-2.5 h-2.5" style={{ fill: '#c9a84c' }} />
                  VIP
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 mt-0.5 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">

          {/* ── 1. Visit Details (info grid + add-ons) ── */}
          <section>
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Visit Details
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-4">
              {infoGrid.map(row => (
                <div key={row.label} className="flex flex-col gap-0.5">
                  <span className="text-[9px] tracking-[0.15em] uppercase font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {row.label}
                  </span>
                  <span className="text-[13px] text-white/90 leading-tight break-words">{row.value}</span>
                </div>
              ))}
            </div>
            {localReq.addOns.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {localReq.addOns.map(a => (
                  <span
                    key={a}
                    className="text-[11px] px-3 py-1 rounded-full font-medium"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* ── 2. Clearance (ready check + clinical pipeline) ── */}
          <section>
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Clearance
            </p>
            <div
              className="rounded-xl p-4 mb-3"
              style={{
                background: allReady ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.07)',
                border: `1px solid ${allReady ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.2)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {allReady
                  ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                  : <AlertTriangle className="w-4 h-4 text-red-400" />
                }
                <span
                  className="text-sm font-semibold tracking-wide"
                  style={{ color: allReady ? '#34d399' : '#f87171' }}
                >
                  {allReady ? 'READY FOR VISIT' : 'BLOCKED'}
                </span>
              </div>
              {!allReady && (
                <ul className="space-y-1">
                  {missing.map(m => (
                    <li key={m} className="flex items-center gap-2 text-[12px]" style={{ color: 'rgba(248,113,113,0.9)' }}>
                      <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              )}
              {allReady && (
                <p className="text-[12px]" style={{ color: 'rgba(52,211,153,0.7)' }}>
                  All clearance items complete. Visit is clear to proceed.
                </p>
              )}
            </div>
            <div className="space-y-2">
              {[
                { label: 'Intake Form', value: localReq.intake },
                { label: 'Consent',     value: localReq.consent },
                { label: 'GFE Status',  value: localReq.gfe },
                { label: 'Payment',     value: localReq.payment },
                { label: 'Nurse',       value: localReq.nurse || 'Needed' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{row.label}</span>
                  <StatusPill status={row.value} small />
                </div>
              ))}
            </div>
          </section>

          {/* ── 3. Actions (status picker + quick actions) ── */}
          <section>
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Actions
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {DRAWER_ACTIONS.map(action => (
                <QBtn
                  key={action.label}
                  label={action.label}
                  color={action.color}
                  onClick={() => applyAction(action)}
                />
              ))}
            </div>
            {[
              { group: 'Scheduling',   statuses: ['New Request', 'Contacted', 'Confirmed'] },
              { group: 'Clearance',    statuses: ['Intake Pending', 'Intake Received', 'Consent Pending', 'Consent Signed', 'GFE Pending', 'Cleared', 'Blocked'] },
              { group: 'Assignment',   statuses: ['Nurse Needed', 'Nurse Assigned', 'Payment Pending', 'Payment Link Sent', 'Paid'] },
              { group: 'Visit',        statuses: ['Ready for Visit', 'In Progress', 'Completed'] },
              { group: 'Post-Visit',   statuses: ['Follow-Up Due', 'Cancelled'] },
            ].map(({ group, statuses }) => (
              <div key={group} className="mb-3">
                <p className="text-[8px] tracking-[0.25em] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {group}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {statuses.map(s => {
                    const isActive = localReq.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => applyStatus(s)}
                        className="px-2 py-1.5 rounded-lg text-[9px] font-medium text-left transition-all"
                        style={{
                          background: isActive ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                          border: isActive ? '1px solid rgba(201,168,76,0.4)' : '1px solid rgba(255,255,255,0.06)',
                          color: isActive ? '#c9a84c' : 'rgba(255,255,255,0.5)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* Activity timeline */}
          <section>
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Activity
            </p>
            <div className="space-y-3">
              {TIMELINE_PLACEHOLDER.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center flex-shrink-0 mt-1">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: i === 0 ? '#c9a84c' : 'rgba(255,255,255,0.2)' }}
                    />
                    {i < TIMELINE_PLACEHOLDER.length - 1 && (
                      <span className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,0.08)', minHeight: 16 }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-[12px] text-white/80 leading-snug">{item.text}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Internal notes */}
          <section>
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Internal Notes
            </p>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add internal notes…"
              className="w-full rounded-xl text-sm resize-none"
              style={{
                background: '#0f0f0f',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '10px 12px',
                outline: 'none',
                fontFamily: 'inherit',
                minHeight: 88,
              }}
            />
          </section>

          {/* Footer note */}
          <p className="text-[10px] text-center pb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Manual Fulfillment Mode · Changes are local
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab, search }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Activity className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
      <p className="text-base font-semibold text-white mb-1">
        {search ? 'No results' : 'Queue clear'}
      </p>
      <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {search
          ? `No requests match "${search}"`
          : `No requests in the ${tab} queue.`}
      </p>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Appointments() {
  const [requests, setRequests] = useState(REQUESTS);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openReq, setOpenReq] = useState(null);

  const filtered = useMemo(() => {
    let list = filterRequests(requests, activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.client.toLowerCase().includes(q));
    }
    return list;
  }, [requests, activeFilter, search]);

  function handleStatusChange(id, newStatus, field) {
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        if (field === 'payment') return { ...r, payment: newStatus };
        return { ...r, status: newStatus };
      })
    );
  }

  function handleUpdate(id, patch) {
    setRequests(prev =>
      prev.map(r => r.id === id ? { ...r, ...patch } : r)
    );
    // keep drawer in sync
    setOpenReq(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }

  return (
    <AdminLayout>
      <PageShell
        eyebrow="Request Queue"
        title="REQUESTS"
        subtitle={`${requests.length} total`}
        action={<SearchBar value={search} onChange={setSearch} />}
      >
        <div className="max-w-3xl mx-auto" style={{ paddingBottom: 80 }}>

          {/* Sticky filter chips */}
          <div
            className="sticky top-0 z-10 py-3 -mx-4 px-4 mb-4"
            style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)' }}
          >
            <FilterChips active={activeFilter} onChange={setActiveFilter} requests={requests} />
          </div>

          {/* Cards list */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <EmptyState key="empty" tab={activeFilter} search={search} />
              ) : (
                filtered.map((req, i) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    index={i}
                    onOpen={r => setOpenReq(r)}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          {filtered.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-xs mt-10"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              {filtered.length} request{filtered.length !== 1 ? 's' : ''}
            </motion.p>
          )}
        </div>
      </PageShell>

      {/* Visit detail drawer */}
      <AnimatePresence>
        {openReq && (
          <VisitDetailDrawer
            key="drawer"
            req={openReq}
            onClose={() => setOpenReq(null)}
            onUpdate={handleUpdate}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
