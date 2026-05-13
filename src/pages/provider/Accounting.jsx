import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, CreditCard, CheckCircle, Send,
  AlertTriangle, FileText, X, RefreshCw, Clock,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { PAYMENTS } from '@/data/commandMockData';

// ── Constants ─────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1];

const STATUS_MAP = {
  'Payment Pending':    { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.25)'   },
  'Link Sent':          { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.25)'  },
  'Deposit Received':   { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.25)'  },
  'Paid':               { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.25)'  },
  'Refunded':           { bg: 'rgba(148,163,184,0.10)', color: '#94a3b8', border: 'rgba(148,163,184,0.20)' },
  'Comped':             { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
};

const FILTERS = ['All', 'Pending', 'Link Sent', 'Deposit', 'Paid', 'Refunded', 'Comped'];

const FILTER_MAP = {
  'All':      null,
  'Pending':  'Payment Pending',
  'Link Sent':'Link Sent',
  'Deposit':  'Deposit Received',
  'Paid':     'Paid',
  'Refunded': 'Refunded',
  'Comped':   'Comped',
};

function getStatusStyle(status) {
  return STATUS_MAP[status] || { bg: 'rgba(148,163,184,0.10)', color: '#94a3b8', border: 'rgba(148,163,184,0.20)' };
}

function formatCurrency(n) {
  if (n == null) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isToday(str) {
  if (!str) return false;
  const d = new Date(str);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

// ── StatusPill ────────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const s = getStatusStyle(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.18em] uppercase font-medium px-2.5 py-1 rounded-full border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'currentColor' }} />
      {status}
    </span>
  );
}

// ── PaymentCard ───────────────────────────────────────────────────────────────

function PaymentCard({ payment: initialPayment, index }) {
  const [payment, setPayment] = useState(initialPayment);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');

  function setStatus(status) {
    setPayment(p => ({ ...p, status }));
  }

  function saveNote() {
    if (!noteText.trim()) return;
    setPayment(p => ({ ...p, notes: noteText.trim() }));
    setNoteText('');
    setShowNoteInput(false);
  }

  const s = getStatusStyle(payment.status);

  return (
    <motion.div
      key={payment.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: EASE, delay: index * 0.05 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: '#111114', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      {/* Card header */}
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-medium text-[15px] truncate">
                {payment.client || payment.clientName}
              </h3>
              <StatusPill status={payment.status} />
            </div>
          </div>
          <p
            className="font-heading text-2xl tracking-widest shrink-0"
            style={{ color: '#c9a84c' }}
          >
            {formatCurrency(payment.amount)}
          </p>
        </div>

        {/* Therapy + Date */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 shrink-0" style={{ color: '#c9a84c' }} strokeWidth={1.5} />
            <span className="text-[12px] text-white">{payment.therapy}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} strokeWidth={1.5} />
            <span className="text-[11px] text-white opacity-50">{formatDate(payment.date)}</span>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 space-y-3">
        {/* Method badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} strokeWidth={1.5} />
            <span className="text-[11px] text-white opacity-50">Method:</span>
            <span
              className="inline-block text-[10px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 rounded border"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.10)',
              }}
            >
              {payment.method || 'Square Link'}
            </span>
          </div>

          {/* Due before visit indicator */}
          <div className="flex items-center gap-1.5">
            {payment.dueBeforeVisit ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} strokeWidth={1.5} />
                <span className="text-[10px] font-medium" style={{ color: '#fbbf24' }}>Due before visit</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} strokeWidth={1.5} />
                <span className="text-[10px] text-white opacity-40">No pre-payment required</span>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {payment.notes && (
          <div
            className="rounded-lg px-3 py-2 border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <p className="text-[11px] text-white opacity-60 italic">{payment.notes}</p>
          </div>
        )}

        {/* Note input */}
        <AnimatePresence>
          {showNoteInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') setShowNoteInput(false); }}
                  placeholder="Add a note…"
                  className="flex-1 text-[12px] rounded-lg px-3 py-2 text-white placeholder-white/30 outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                  autoFocus
                />
                <button
                  onClick={saveNote}
                  className="px-3 py-2 rounded-lg text-[11px] font-semibold"
                  style={{ background: '#c9a84c', color: '#0A0A0A' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setShowNoteInput(false)}
                  className="px-2 py-2 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <X className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick actions */}
      <div
        className="px-5 py-3 border-t flex flex-wrap items-center gap-2"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {payment.status !== 'Link Sent' && payment.status !== 'Paid' && (
          <button
            onClick={() => setStatus('Link Sent')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-[0.1em] uppercase font-medium transition-colors"
            style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}
          >
            <Send className="w-3 h-3" strokeWidth={1.5} />
            Link Sent
          </button>
        )}

        {payment.status !== 'Paid' && (
          <button
            onClick={() => setStatus('Paid')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-[0.1em] uppercase font-medium transition-colors"
            style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}
          >
            <CheckCircle className="w-3 h-3" strokeWidth={1.5} />
            Mark Paid
          </button>
        )}

        {payment.status !== 'Deposit Received' && payment.status !== 'Paid' && (
          <button
            onClick={() => setStatus('Deposit Received')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-[0.1em] uppercase font-medium transition-colors"
            style={{ background: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.20)' }}
          >
            <DollarSign className="w-3 h-3" strokeWidth={1.5} />
            Deposit
          </button>
        )}

        {payment.status !== 'Refunded' && (
          <button
            onClick={() => setStatus('Refunded')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-[0.1em] uppercase font-medium transition-colors"
            style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.18)' }}
          >
            <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
            Refund
          </button>
        )}

        <button
          onClick={() => setShowNoteInput(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-[0.1em] uppercase font-medium transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <FileText className="w-3 h-3" strokeWidth={1.5} />
          Note
        </button>
      </div>
    </motion.div>
  );
}

// ── Summary Tile ──────────────────────────────────────────────────────────────

function SummaryTile({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className="rounded-xl border p-4 flex items-center gap-3"
      style={{ background: '#111114', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: color + '18' }}
      >
        <Icon className="w-4.5 h-4.5" style={{ color }} strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] tracking-[0.25em] uppercase text-white opacity-50">{label}</p>
        <p className="text-xl font-light text-white" style={{ color }}>{value}</p>
        {sub && <p className="text-[10px] text-white opacity-40">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Accounting() {
  const [activeFilter, setActiveFilter] = useState('All');

  // ── Summary calculations ───────────────────────────────────────────────────

  const pending = PAYMENTS.filter(p => p.status === 'Payment Pending');
  const paidPayments = PAYMENTS.filter(p => p.status === 'Paid');
  const paidToday = paidPayments.filter(p => isToday(p.date));
  const linkSent = PAYMENTS.filter(p => p.status === 'Link Sent');

  const totalPending     = pending.reduce((s, p) => s + (p.amount || 0), 0);
  const collectedToday   = paidToday.reduce((s, p) => s + (p.amount || 0), 0);
  const avgPerVisit      = PAYMENTS.length > 0
    ? Math.round(PAYMENTS.reduce((s, p) => s + (p.amount || 0), 0) / PAYMENTS.length)
    : 0;

  // ── Filter logic ──────────────────────────────────────────────────────────

  const statusFilter = FILTER_MAP[activeFilter];
  const filtered = statusFilter
    ? PAYMENTS.filter(p => p.status === statusFilter)
    : PAYMENTS;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">

        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mb-8"
        >
          <p className="text-[10px] tracking-[0.35em] uppercase mb-1.5 font-medium" style={{ color: '#c9a84c' }}>
            Manual Payment Tracker
          </p>
          <h1 className="font-heading text-5xl tracking-widest text-white">PAYMENTS</h1>
          <p className="text-[11px] text-white mt-2 opacity-40">
            Payment handled manually during launch.
          </p>
        </motion.div>

        {/* ── Summary Tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <SummaryTile
            icon={AlertTriangle}
            label="Total Pending"
            value={formatCurrency(totalPending)}
            sub={`${pending.length} payment${pending.length !== 1 ? 's' : ''}`}
            color="#ef4444"
            delay={0}
          />
          <SummaryTile
            icon={CheckCircle}
            label="Collected Today"
            value={formatCurrency(collectedToday)}
            sub={`${paidToday.length} today`}
            color="#34d399"
            delay={0.05}
          />
          <SummaryTile
            icon={Send}
            label="Link Sent"
            value={linkSent.length}
            sub="awaiting payment"
            color="#60a5fa"
            delay={0.1}
          />
          <SummaryTile
            icon={DollarSign}
            label="Avg per Visit"
            value={formatCurrency(avgPerVisit)}
            sub="all statuses"
            color="#c9a84c"
            delay={0.15}
          />
        </div>

        {/* ── Filter Chips ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.18, ease: EASE }}
          className="flex flex-wrap gap-2 mb-6"
        >
          {FILTERS.map(f => {
            const active = activeFilter === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className="px-3 py-1.5 rounded-full text-[11px] tracking-[0.12em] uppercase font-medium transition-all"
                style={{
                  background: active ? '#c9a84c' : 'rgba(255,255,255,0.05)',
                  color:      active ? '#0A0A0A' : 'rgba(255,255,255,0.6)',
                  border:     active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.10)',
                }}
              >
                {f}
              </button>
            );
          })}
        </motion.div>

        {/* ── Payment Cards ── */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="text-center py-20 rounded-2xl border"
            style={{ background: '#111114', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <CheckCircle className="w-10 h-10 mx-auto mb-4" style={{ color: '#34d399' }} strokeWidth={1} />
            <p className="text-white opacity-50 text-sm max-w-xs mx-auto">
              No payments in this queue. All collections are current or handled manually.
            </p>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((payment, i) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
