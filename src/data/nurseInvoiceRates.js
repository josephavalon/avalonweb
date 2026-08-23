/**
 * Nurse invoice pay rules — the single source of truth for what a shift is worth.
 *
 * This module is imported from BOTH sides of the app:
 *   client  →  app-modules/pages/NurseInvoice.jsx via '@/data/nurseInvoiceRates'
 *   server  →  api/invoice/submit.js via '../../src/data/nurseInvoiceRates.js'
 *
 * That dual life is why it must stay PURE: no '@/' alias imports, no
 * import.meta.env, no browser globals, explicit .js extensions. Same discipline
 * as src/data/catalog.js, which api/_lib/catalog-pricing.js imports the same way.
 *
 * The client renders a live preview from computeInvoice(). The server calls the
 * SAME function on the raw inputs and pays out its own answer — the client's
 * total is never transmitted, so it can never be dictated.
 *
 * MONEY IS INTEGER CENTS, ALWAYS. 9000 * 7.25 === 65250 exactly, while
 * 90 * 7.25 === 652.5000000000001. Round once, at the hourly line, and never on
 * an intermediate sum.
 */

export const SHIFT_TYPES = Object.freeze([
  Object.freeze({
    key: 'mobile',
    label: 'Mobile visit',
    hint: '90/per',
    hourlyCents: 9000,
    perIvCents: 0,
    perShotCents: 0,
  }),
  Object.freeze({
    key: 'mobile_nad_iv',
    label: 'Mobile NAD+ IV',
    hint: '$90/hr + $40/IV + $10/shot',
    hourlyCents: 9000,
    perIvCents: 4000,
    perShotCents: 1000,
  }),
  Object.freeze({
    key: 'event',
    label: 'Event',
    hint: 'More than 2 people · $50/hr + $40/IV + $10/shot',
    hourlyCents: 5000,
    perIvCents: 4000,
    perShotCents: 1000,
  }),
]);

// Flat-rate tiers express their lack of per-IV or per-shot adders as zero rates
// in the table rather than a type-key branch, so the table stays the only place
// the tier rules live.
export const SHIFT_TYPE_KEYS = Object.freeze(SHIFT_TYPES.map((t) => t.key));

// 2026-08-10: the small/large split was dropped — there are only events, and an
// event is more than two people. Both old keys resolve to the one event tier so
// a draft saved mid-shift, or a request from a tab open across the deploy, still
// prices instead of failing as an unknown type. Note this DOES reprice a former
// small event from $90/hr flat to $50/hr plus adders, which is the intent.
const LEGACY_SHIFT_TYPE_KEYS = Object.freeze({
  large_event: 'event',
  small_event: 'event',
});

export function resolveShiftTypeKey(key) {
  return LEGACY_SHIFT_TYPE_KEYS[key] || key;
}

// Billable by anyone on the roster. This was NP-only until 2026-08-10; the rule
// was relaxed deliberately, not lost. If it is ever reinstated, the gate belongs
// HERE and on the server, keyed off a role the request body cannot set.
export const GFE_CENTS = 2000;

export const MAX_SHIFT_ROWS = 40;
export const MAX_EXPENSE_ROWS = 20;
export const MAX_HOURS_PER_SHIFT = 24;
export const MAX_HOURS_PER_DAY = 24;
export const MAX_COUNT_PER_SHIFT = 99;
export const MAX_EXPENSE_CENTS = 200000; // $2,000
export const MAX_DESCRIPTION_LENGTH = 80;

export function findShiftType(key) {
  const resolved = resolveShiftTypeKey(key);
  return SHIFT_TYPES.find((t) => t.key === resolved) || null;
}

export function shiftTypeHasAdders(key) {
  const type = findShiftType(key);
  return Boolean(type && (type.perIvCents > 0 || type.perShotCents > 0));
}

export function formatCents(cents) {
  const value = Number.isFinite(cents) ? cents : 0;
  return `$${(value / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Bare decimal for pasting into Gusto's Wage / Reimbursement boxes — no $, no commas. */
export function formatCentsPlain(cents) {
  const value = Number.isFinite(cents) ? cents : 0;
  return (value / 100).toFixed(2);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_COUNT_PER_SHIFT;
}

function isValidHours(value) {
  if (!Number.isFinite(value)) return false;
  if (value <= 0 || value > MAX_HOURS_PER_SHIFT) return false;
  // Quarter-hour increments only. Multiply before comparing so 7.25 -> 29 is exact.
  return Math.round(value * 4) === value * 4;
}

/**
 * Price a whole invoice from raw inputs.
 *
 * Returns { shiftLines, expenseLines, wagesCents, reimbursementsCents,
 *           grandTotalCents, errors }. `errors` is authoritative: a non-empty
 *           array means the caller must reject, not round or coerce.
 */
export function computeInvoice({ shifts = [], expenses = [] } = {}) {
  const errors = [];
  const shiftRows = Array.isArray(shifts) ? shifts : [];
  const expenseRows = Array.isArray(expenses) ? expenses : [];

  if (shiftRows.length === 0) {
    errors.push({ scope: 'shift', index: -1, field: 'shifts', code: 'no_shifts' });
  }
  if (shiftRows.length > MAX_SHIFT_ROWS) {
    errors.push({ scope: 'shift', index: -1, field: 'shifts', code: 'too_many_shifts' });
  }
  if (expenseRows.length > MAX_EXPENSE_ROWS) {
    errors.push({ scope: 'expense', index: -1, field: 'expenses', code: 'too_many_expenses' });
  }

  const shiftLines = shiftRows.slice(0, MAX_SHIFT_ROWS).map((raw, index) => {
    const fail = (field, code) => errors.push({ scope: 'shift', index, field, code });

    const type = findShiftType(raw?.typeKey);
    if (!type) fail('typeKey', 'unknown_shift_type');

    const date = String(raw?.date || '');
    if (!DATE_RE.test(date)) fail('date', 'invalid_date');

    const hours = Number(raw?.hours);
    if (!isValidHours(hours)) fail('hours', 'invalid_hours');

    const ivCount = Number(raw?.ivCount ?? 0);
    const shotCount = Number(raw?.shotCount ?? 0);
    const gfeCount = Number(raw?.gfeCount ?? 0);
    if (!isValidCount(ivCount)) fail('ivCount', 'invalid_count');
    if (!isValidCount(shotCount)) fail('shotCount', 'invalid_count');
    if (!isValidCount(gfeCount)) fail('gfeCount', 'invalid_count');

    // A tier without adders must not accrue them even if counts arrive anyway —
    // the UI hides those fields, so a nonzero count here means a stale client
    // state or a hand-crafted POST. Zero it out AND say so.
    const billableIv = type && type.perIvCents > 0 ? ivCount : 0;
    const billableShot = type && type.perShotCents > 0 ? shotCount : 0;
    if (type && type.perIvCents === 0 && ivCount > 0) fail('ivCount', 'adders_not_permitted');
    if (type && type.perShotCents === 0 && shotCount > 0) fail('shotCount', 'adders_not_permitted');

    const safeHours = isValidHours(hours) ? hours : 0;
    const hourlyCents = type ? Math.round(type.hourlyCents * safeHours) : 0;
    const adderCents = type
      ? billableIv * type.perIvCents + billableShot * type.perShotCents
      : 0;
    const gfeCents = gfeCount * GFE_CENTS;

    return {
      index,
      date,
      typeKey: type ? type.key : '',
      typeLabel: type ? type.label : '',
      hours: safeHours,
      ivCount: billableIv,
      shotCount: billableShot,
      gfeCount,
      hourlyCents,
      adderCents,
      gfeCents,
      subtotalCents: hourlyCents + adderCents + gfeCents,
    };
  });

  const expenseLines = expenseRows.slice(0, MAX_EXPENSE_ROWS).map((raw, index) => {
    const fail = (field, code) => errors.push({ scope: 'expense', index, field, code });

    const description = String(raw?.description || '').trim();
    if (!description) fail('description', 'missing_description');
    if (description.length > MAX_DESCRIPTION_LENGTH) fail('description', 'description_too_long');

    const amountCents = Number(raw?.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > MAX_EXPENSE_CENTS) {
      fail('amountCents', 'invalid_amount');
    }

    return {
      index,
      description,
      amountCents: Number.isInteger(amountCents) && amountCents > 0 ? amountCents : 0,
    };
  });

  // Each row is capped at 24 hours, which does nothing to stop three rows on the
  // same date totalling thirty. Quarter hours sum exactly in binary (0.25 is a
  // clean power of two), so this needs no epsilon.
  const hoursByDate = new Map();
  for (const line of shiftLines) {
    if (!line.date) continue;
    hoursByDate.set(line.date, (hoursByDate.get(line.date) || 0) + line.hours);
  }
  for (const line of shiftLines) {
    if (line.date && hoursByDate.get(line.date) > MAX_HOURS_PER_DAY) {
      // Flagged on every row for that date — the nurse decides which to trim.
      errors.push({ scope: 'shift', index: line.index, field: 'hours', code: 'hours_exceed_day' });
    }
  }

  const wagesCents = shiftLines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const reimbursementsCents = expenseLines.reduce((sum, line) => sum + line.amountCents, 0);

  return {
    shiftLines,
    expenseLines,
    wagesCents,
    reimbursementsCents,
    grandTotalCents: wagesCents + reimbursementsCents,
    errors,
  };
}
