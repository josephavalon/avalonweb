// ── Avalon Vitality — Shared StatusPill ──────────────────────────────────────
// Single source of truth for all 21 pipeline statuses.
// Import this everywhere instead of redefining per page.

const TONES = {
  neutral: {
    bg: 'hsl(var(--foreground) / 0.045)',
    border: 'hsl(var(--foreground) / 0.12)',
    text: 'hsl(var(--foreground) / 0.58)',
    dot: 'hsl(var(--foreground) / 0.34)',
  },
  accent: {
    bg: 'hsl(var(--accent) / 0.08)',
    border: 'hsl(var(--accent) / 0.20)',
    text: 'hsl(var(--accent) / 0.86)',
    dot: 'hsl(var(--accent) / 0.72)',
  },
  caution: {
    bg: 'hsl(var(--foreground) / 0.06)',
    border: 'hsl(var(--foreground) / 0.16)',
    text: 'hsl(var(--foreground) / 0.72)',
    dot: 'hsl(var(--foreground) / 0.46)',
  },
  danger: {
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.28)',
    text: 'rgb(248,113,113)',
    dot: 'rgb(248,113,113)',
  },
};

const STATUS_TONE = {
  'New Request': 'neutral',
  Contacted: 'neutral',
  Confirmed: 'accent',
  'Intake Pending': 'caution',
  'Intake Received': 'accent',
  'Consent Pending': 'caution',
  'Consent Signed': 'accent',
  'GFE Pending': 'danger',
  Cleared: 'accent',
  Blocked: 'danger',
  'Nurse Needed': 'danger',
  'Nurse Assigned': 'accent',
  'Payment Pending': 'danger',
  'Payment Link Sent': 'neutral',
  Paid: 'accent',
  'Ready for Visit': 'accent',
  'In Progress': 'accent',
  Completed: 'neutral',
  'Follow-Up Due': 'caution',
  Cancelled: 'danger',
  Received: 'accent',
  Signed: 'accent',
  Pending: 'caution',
  'Link Sent': 'neutral',
  Done: 'accent',
};

const FALLBACK = {
  bg: 'hsl(var(--foreground) / 0.045)',
  border: 'hsl(var(--foreground) / 0.12)',
  text: 'hsl(var(--foreground) / 0.58)',
  dot: 'hsl(var(--foreground) / 0.34)',
};

/**
 * StatusPill — universal pipeline status badge.
 *
 * Props:
 *   status  {string}  — one of the 21 canonical statuses or pipeline aliases
 *   tiny    {boolean} — optional smaller variant (8px text, tighter padding)
 */
export default function StatusPill({ status, tiny = false }) {
  const c = TONES[STATUS_TONE[status]] || FALLBACK;
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
          background: c.dot || c.text,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}
