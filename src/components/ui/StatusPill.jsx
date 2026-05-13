// ── Avalon Vitality — Shared StatusPill ──────────────────────────────────────
// Single source of truth for all 21 pipeline statuses.
// Import this everywhere instead of redefining per page.

const STATUS_MAP = {
  'New Request':       { bg: 'rgba(59,130,246,0.12)',   border: '#3b82f6',              text: '#93c5fd' },
  'Contacted':         { bg: 'rgba(245,158,11,0.12)',   border: '#f59e0b',              text: '#fcd34d' },
  'Confirmed':         { bg: 'rgba(16,185,129,0.12)',   border: '#10b981',              text: '#6ee7b7' },
  'Intake Pending':    { bg: 'rgba(245,158,11,0.12)',   border: '#f59e0b',              text: '#fcd34d' },
  'Intake Received':   { bg: 'rgba(16,185,129,0.10)',   border: '#10b981',              text: '#6ee7b7' },
  'Consent Pending':   { bg: 'rgba(245,158,11,0.12)',   border: '#f59e0b',              text: '#fcd34d' },
  'Consent Signed':    { bg: 'rgba(16,185,129,0.10)',   border: '#10b981',              text: '#6ee7b7' },
  'GFE Pending':       { bg: 'rgba(239,68,68,0.12)',    border: '#ef4444',              text: '#fca5a5' },
  'Cleared':           { bg: 'rgba(16,185,129,0.12)',   border: '#10b981',              text: '#6ee7b7' },
  'Blocked':           { bg: 'rgba(239,68,68,0.12)',    border: '#ef4444',              text: '#fca5a5' },
  'Nurse Needed':      { bg: 'rgba(245,158,11,0.12)',   border: '#f59e0b',              text: '#fcd34d' },
  'Nurse Assigned':    { bg: 'rgba(20,184,166,0.12)',   border: '#14b8a6',              text: '#5eead4' },
  'Payment Pending':   { bg: 'rgba(239,68,68,0.12)',    border: '#ef4444',              text: '#fca5a5' },
  'Payment Link Sent': { bg: 'rgba(59,130,246,0.12)',   border: '#3b82f6',              text: '#93c5fd' },
  'Paid':              { bg: 'rgba(16,185,129,0.12)',   border: '#10b981',              text: '#6ee7b7' },
  'Ready for Visit':   { bg: 'rgba(74,222,128,0.12)',   border: '#4ade80',              text: '#86efac' },
  'In Progress':       { bg: 'rgba(168,85,247,0.12)',   border: '#a855f7',              text: '#d8b4fe' },
  'Completed':         { bg: 'rgba(255,255,255,0.05)',  border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.4)' },
  'Follow-Up Due':     { bg: 'rgba(168,85,247,0.12)',   border: '#a855f7',              text: '#d8b4fe' },
  'Cancelled':         { bg: 'rgba(239,68,68,0.06)',    border: 'rgba(239,68,68,0.25)', text: 'rgba(252,165,165,0.55)' },
  // Aliases used in pipeline sub-fields
  'Received':          { bg: 'rgba(16,185,129,0.10)',   border: '#10b981',              text: '#6ee7b7' },
  'Signed':            { bg: 'rgba(16,185,129,0.10)',   border: '#10b981',              text: '#6ee7b7' },
  'Pending':           { bg: 'rgba(245,158,11,0.12)',   border: '#f59e0b',              text: '#fcd34d' },
  'Link Sent':         { bg: 'rgba(59,130,246,0.12)',   border: '#3b82f6',              text: '#93c5fd' },
};

const FALLBACK = {
  bg: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.12)',
  text: 'rgba(255,255,255,0.4)',
};

/**
 * StatusPill — universal pipeline status badge.
 *
 * Props:
 *   status  {string}  — one of the 21 canonical statuses or pipeline aliases
 *   tiny    {boolean} — optional smaller variant (8px text, tighter padding)
 */
export default function StatusPill({ status, tiny = false }) {
  const c = STATUS_MAP[status] || FALLBACK;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-body)',
        fontSize: tiny ? 8 : 10,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 9999,
        padding: tiny ? '2px 7px' : '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: c.text,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}
