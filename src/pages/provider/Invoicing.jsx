import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import { REQUESTS } from '@/data/commandMockData';
import { ShieldCheck, AlertTriangle, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const EASE = [0.16, 1, 0.3, 1];

// ── Pipeline step colors ──────────────────────────────────────────────────────

function stepColor(val) {
  if (!val) return { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)', text: '#ffffff66' };
  const v = val.toLowerCase();
  if (v === 'received' || v === 'signed' || v === 'cleared') {
    return { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#10b981' };
  }
  if (v === 'pending') {
    return { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#f59e0b' };
  }
  if (v === 'blocked') {
    return { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#ef4444' };
  }
  return { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)', text: '#ffffff66' };
}

// ── Pipeline step badge ───────────────────────────────────────────────────────

function StepBadge({ label, value }) {
  const c = stepColor(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 9,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#ffffff',
        opacity: 0.45,
      }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 5,
        padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

// ── Overall clearance status ──────────────────────────────────────────────────

function overallStatus(item) {
  if (item.gfe === 'Blocked' || item.intake === 'Blocked' || item.consent === 'Blocked') return 'Blocked';
  if (item.gfe === 'Cleared' && (item.consent === 'Signed') && item.intake === 'Received') return 'Cleared';
  if (item.gfe === 'Pending') return 'GFE Pending';
  if (item.consent === 'Pending') return 'Consent Pending';
  if (item.intake === 'Pending') return 'Intake Pending';
  return 'Cleared';
}

// ── Summary tile ──────────────────────────────────────────────────────────────

function SummaryTile({ label, value, accent }) {
  return (
    <div style={{
      flex: '1 1 0',
      minWidth: 120,
      background: '#141414',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '18px 20px',
    }}>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#ffffff',
        opacity: 0.5,
        margin: '0 0 6px',
      }}>{label}</p>
      <p style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 30,
        color: accent || '#ffffff',
        margin: 0,
        lineHeight: 1,
        letterSpacing: '0.02em',
      }}>{value}</p>
    </div>
  );
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const TABS = ['All', 'Intake Pending', 'Consent Pending', 'GFE Pending', 'Cleared', 'Blocked'];

function FilterChips({ active, onChange, counts }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {TABS.map((t) => {
        const isActive = active === t;
        const count = counts[t] ?? 0;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#0A0A0A' : '#ffffffaa',
              background: isActive ? '#c9a84c' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isActive ? '#c9a84c' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 6,
              padding: '5px 14px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t}
            {count > 0 && (
              <span style={{
                background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
                color: isActive ? '#0A0A0A' : '#ffffffaa',
              }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────

function QBtn({ label, onClick, variant = 'ghost' }) {
  const styles = {
    ghost: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.10)',
      color: '#ffffffcc',
    },
    gold: {
      background: '#c9a84c',
      border: '1px solid #c9a84c',
      color: '#0A0A0A',
    },
    danger: {
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.35)',
      color: '#ef4444',
    },
    success: {
      background: 'rgba(16,185,129,0.10)',
      border: '1px solid rgba(16,185,129,0.35)',
      color: '#10b981',
    },
    amber: {
      background: 'rgba(245,158,11,0.10)',
      border: '1px solid rgba(245,158,11,0.35)',
      color: '#f59e0b',
    },
  };
  const s = styles[variant] || styles.ghost;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        borderRadius: 5,
        padding: '5px 12px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.12s',
        ...s,
      }}
    >
      {label}
    </button>
  );
}

// ── Overall status pill ───────────────────────────────────────────────────────

function OverallPill({ status }) {
  const map = {
    'Cleared':         { bg: 'rgba(16,185,129,0.12)', border: '#10b981',  text: '#10b981',  icon: <ShieldCheck size={11} /> },
    'Blocked':         { bg: 'rgba(239,68,68,0.12)',  border: '#ef4444',  text: '#ef4444',  icon: <XCircle size={11} /> },
    'Intake Pending':  { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b',  text: '#f59e0b',  icon: <Clock size={11} /> },
    'Consent Pending': { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b',  text: '#f59e0b',  icon: <Clock size={11} /> },
    'GFE Pending':     { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b',  text: '#f59e0b',  icon: <AlertTriangle size={11} /> },
  };
  const c = map[status] || map['Intake Pending'];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: c.text,
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 5,
      padding: '3px 10px',
    }}>
      {c.icon} {status}
    </span>
  );
}

// ── Clearance card ────────────────────────────────────────────────────────────

function ClearanceCard({ item, idx, onUpdate, toast }) {
  const [open, setOpen] = useState(false);
  const status = overallStatus(item);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.4, delay: idx * 0.04, ease: EASE }}
      style={{
        background: '#141414',
        border: `1px solid ${status === 'Blocked' ? 'rgba(239,68,68,0.25)' : status === 'Cleared' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* main row */}
      <div
        onClick={() => setOpen((p) => !p)}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '16px 20px',
          cursor: 'pointer',
        }}
      >
        {/* client + therapy */}
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 17,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '0.04em',
            }}>{item.client}</p>
            {item.isVIP && (
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: 9,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#c9a84c',
                border: '1px solid rgba(201,168,76,0.35)',
                borderRadius: 4,
                padding: '2px 6px',
              }}>VIP</span>
            )}
          </div>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: '#ffffffaa',
            margin: '2px 0 0',
          }}>{item.therapy} · {item.date} {item.time}</p>
        </div>

        {/* pipeline steps */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <StepBadge label="Intake" value={item.intake} />
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>→</span>
          <StepBadge label="Consent" value={item.consent} />
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>→</span>
          <StepBadge label="GFE" value={item.gfe} />
        </div>

        {/* overall status */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <OverallPill status={status} />
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {/* expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              padding: '20px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}>

              {/* detail grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                <Detail label="Location" value={item.location} />
                <Detail label="Nurse" value={item.nurse || 'Unassigned'} accent={!item.nurse ? '#f59e0b' : undefined} />
                <Detail label="Payment" value={item.payment} accent={item.payment === 'Pending' ? '#ef4444' : item.payment === 'Paid' ? '#10b981' : undefined} />
                <Detail label="Source" value={item.source} />
              </div>

              {item.notes && (
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff55', margin: '0 0 4px' }}>Notes</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#ffffffbb', margin: 0 }}>{item.notes}</p>
                </div>
              )}

              {/* quick actions */}
              <div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff55', margin: '0 0 10px' }}>Clinical Actions</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {item.intake !== 'Received' && (
                    <QBtn
                      label="✓ Mark Intake Received"
                      variant="success"
                      onClick={() => onUpdate(item.id, { intake: 'Received' })}
                    />
                  )}
                  {item.consent !== 'Signed' && (
                    <QBtn
                      label="✓ Mark Consent Signed"
                      variant="success"
                      onClick={() => onUpdate(item.id, { consent: 'Signed' })}
                    />
                  )}
                  {item.gfe === 'Pending' && (
                    <QBtn
                      label="Awaiting GFE"
                      variant="amber"
                      onClick={() => {}}
                    />
                  )}
                  {item.gfe !== 'Cleared' && (
                    <QBtn
                      label="✓ Mark GFE Cleared"
                      variant="success"
                      onClick={() => onUpdate(item.id, { gfe: 'Cleared' })}
                    />
                  )}
                  {item.gfe !== 'Blocked' && (
                    <QBtn
                      label="⊘ Mark Blocked"
                      variant="danger"
                      onClick={() => onUpdate(item.id, { gfe: 'Blocked' })}
                    />
                  )}
                  <QBtn
                    label="↑ Escalate"
                    variant="ghost"
                    onClick={() => toast({ title: 'Escalation', description: `${item.client} flagged for physician review.` })}
                  />
                  <QBtn
                    label="Contact Client"
                    variant="ghost"
                    onClick={() => toast({ title: 'Contact', description: `Contact flow for ${item.client} — coming soon.` })}
                  />
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Detail({ label, value, accent }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff44', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: accent || '#ffffffcc', margin: 0 }}>{value || '—'}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Invoicing() {
  const { toast } = useToast();
  const [items, setItems] = useState(REQUESTS);
  const [activeTab, setActiveTab] = useState('All');

  function handleUpdate(id, patch) {
    setItems((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  const filtered = useMemo(() => {
    if (activeTab === 'All') return items;
    return items.filter((r) => overallStatus(r) === activeTab);
  }, [items, activeTab]);

  const summary = useMemo(() => ({
    needs:   items.filter(r => overallStatus(r) !== 'Cleared').length,
    cleared: items.filter(r => overallStatus(r) === 'Cleared').length,
    blocked: items.filter(r => overallStatus(r) === 'Blocked').length,
    gfe:     items.filter(r => r.gfe === 'Pending').length,
  }), [items]);

  const counts = useMemo(() => {
    const c = { All: items.length };
    TABS.forEach(t => { if (t !== 'All') c[t] = items.filter(r => overallStatus(r) === t).length; });
    return c;
  }, [items]);

  return (
    <AdminLayout>
      <PageShell
        eyebrow="Avalon Vitality"
        title="Clearance Queue"
        subtitle="Clinical pipeline · Intake → Consent → GFE · Manual review"
      />
      <div style={{ padding: '0 32px 64px', maxWidth: 1100, margin: '0 auto' }}>

        {/* summary strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <SummaryTile label="Needs Attention" value={summary.needs} accent={summary.needs > 0 ? '#f59e0b' : '#ffffff'} />
          <SummaryTile label="Cleared" value={summary.cleared} accent="#10b981" />
          <SummaryTile label="Blocked" value={summary.blocked} accent={summary.blocked > 0 ? '#ef4444' : '#ffffff'} />
          <SummaryTile label="GFE Pending" value={summary.gfe} accent={summary.gfe > 0 ? '#f59e0b' : '#ffffff'} />
        </div>

        {/* filter chips */}
        <div style={{ marginBottom: 18 }}>
          <FilterChips active={activeTab} onChange={setActiveTab} counts={counts} />
        </div>

        {/* cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#ffffff55',
                  padding: '40px 0',
                  textAlign: 'center',
                }}
              >
                No requests match this filter.
              </motion.p>
            ) : (
              filtered.map((item, idx) => (
                <ClearanceCard
                  key={item.id}
                  item={item}
                  idx={idx}
                  onUpdate={handleUpdate}
                  toast={toast}
                />
              ))
            )}
          </AnimatePresence>
        </div>

      </div>
    </AdminLayout>
  );
}
