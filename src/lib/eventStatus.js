/**
 * ONE status-rendering source of truth for every events surface (trip page,
 * wallet pass, serve scanner, kiosk board, portals) — eng review 11A.
 *
 * DESIGN.md rules enforced here, in code, not by convention:
 *  - TRUE voice: statuses render in IBM Plex Mono. Mono never lies, never
 *    animates, never persuades.
 *  - `live` #C8F135 is INK ONLY and means exactly: cleared / you're up / now
 *    serving. Never a button fill, never a background, never marketing.
 *  - `stop` #F04438 is reserved for clinical stops. If a guest sees red, it
 *    means medicine.
 *  - Everything else renders in the monochrome ink tiers.
 */

export const EVENT_TONES = {
  live: '#C8F135',   // forward motion: cleared, now serving
  ink: '#FFFFFF',
  dim: '#CCCCCC',
  muted: '#8F8F8F',
  stop: '#F04438',   // clinical stops ONLY
};

export const MONO_STACK = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Visit lifecycle → guest-facing chip. */
const VISIT_STATUS = {
  held: { label: 'HOLDING YOUR SPOT', tone: 'dim' },
  pending: { label: 'PROCESSING', tone: 'dim' },
  confirmed: { label: 'CONFIRMED', tone: 'ink' },
  served: { label: 'SERVED', tone: 'live' },
  no_show: { label: 'MISSED', tone: 'muted' },
  canceled: { label: 'CANCELED', tone: 'muted' },
  refunded: { label: 'REFUNDED', tone: 'muted' },
};

/** GFE lifecycle → guest-facing chip. Never a reason, never content. */
const GFE_STATUS = {
  not_started: { label: 'HEALTH CHECK · NOT STARTED', tone: 'dim', action: 'start' },
  invited: { label: 'HEALTH CHECK · READY TO BOOK', tone: 'ink', action: 'book' },
  scheduled: { label: 'HEALTH CHECK · SCHEDULED', tone: 'dim', action: null },
  in_review: { label: 'HEALTH CHECK · IN REVIEW', tone: 'dim', action: null },
  cleared: { label: 'CLEARED ✓', tone: 'live', action: null },
  needs_followup: { label: 'SEE CLINICAL TEAM', tone: 'stop', action: 'contact' },
  declined_medical: { label: 'FULL REFUND ISSUED', tone: 'muted', action: null },
  // declined_medical deliberately reads as the refund, not the reason —
  // the reason lives only in the chart (blueprint 5.1.5).
};

const EVENT_STATE_CHIPS = {
  presale: { label: 'MEMBERS FIRST', tone: 'dim' },
  public: { label: 'OPEN', tone: 'ink' },
  sold_out: { label: "THIS ONE'S FULL", tone: 'muted' },
  closed: { label: 'PREVIOUSLY', tone: 'muted' },
};

export function visitStatusChip(status) {
  const chip = VISIT_STATUS[status] || { label: String(status || '').toUpperCase(), tone: 'muted' };
  return { ...chip, color: EVENT_TONES[chip.tone] };
}

export function gfeStatusChip(gfeStatus) {
  const chip = GFE_STATUS[gfeStatus] || { label: String(gfeStatus || '').toUpperCase(), tone: 'muted', action: null };
  return { ...chip, color: EVENT_TONES[chip.tone] };
}

export function eventStateChip(status) {
  const chip = EVENT_STATE_CHIPS[status] || { label: String(status || '').toUpperCase(), tone: 'muted' };
  return { ...chip, color: EVENT_TONES[chip.tone] };
}

/** The 30/5 promise, always phrased as an estimate (eng review T6). */
export function backOnFloorLabel(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hi = minutes <= 10 ? minutes + 5 : minutes + 15;
  return `BACK ON THE FLOOR ~${minutes}–${hi} MIN`;
}

/** Compact badge for feed cards / duration pills. */
export function backOnFloorBadge(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return `BACK IN ~${minutes}`;
}

export function formatPriceCents(cents) {
  if (!Number.isFinite(cents)) return '';
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}
