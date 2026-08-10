#!/usr/bin/env node
/**
 * Pay-math regression check for the nurse invoice page.
 *
 * This is the one part of /invoice that can silently pay someone the wrong
 * amount, so it gets a test with no browser and no network. Run it before any
 * UI work: `npm run verify:invoice-math`.
 *
 * node:assert/strict rather than Vitest — Vitest is not installed in this repo
 * (CLAUDE.md says otherwise; the code disagrees). Same shape as
 * scripts/admin-cross-portal-qa.mjs.
 */
import assert from 'node:assert/strict';
import {
  computeInvoice,
  GFE_CENTS,
  MAX_EXPENSE_CENTS,
  MAX_SHIFT_ROWS,
  formatCentsPlain,
} from '../src/data/nurseInvoiceRates.js';
import {
  NURSE_ROSTER,
  findNurse,
  matchNurseByName,
  nurseInitials,
  roleForName,
} from '../src/data/nurseRoster.js';
import {
  buildInvoiceCsv,
  buildInvoiceDocumentHtml,
  buildInvoiceFileHtml,
} from '../src/data/invoiceDocument.js';

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}\n    ${error.message.split('\n').join('\n    ')}`);
  }
}

const shift = (over = {}) => ({
  date: '2026-08-02',
  typeKey: 'mobile',
  hours: 8,
  ivCount: 0,
  shotCount: 0,
  gfeCount: 0,
  ...over,
});

// --- Tiers -------------------------------------------------------------------

check('mobile visit pays $90/hr', () => {
  const out = computeInvoice({ role: 'RN', shifts: [shift({ typeKey: 'mobile', hours: 8 })] });
  assert.deepEqual(out.errors, []);
  assert.equal(out.wagesCents, 72000);
});

check('large event pays $50/hr plus $40/IV and $10/shot', () => {
  const out = computeInvoice({
    role: 'RN',
    shifts: [shift({ typeKey: 'large_event', hours: 6, ivCount: 12, shotCount: 5 })],
  });
  assert.deepEqual(out.errors, []);
  // 6h * $50 = $300, 12 IV * $40 = $480, 5 shots * $10 = $50
  assert.equal(out.shiftLines[0].hourlyCents, 30000);
  assert.equal(out.shiftLines[0].adderCents, 53000);
  assert.equal(out.wagesCents, 83000);
});

check('small event pays $90/hr flat with NO adders', () => {
  const out = computeInvoice({
    role: 'RN',
    shifts: [shift({ typeKey: 'small_event', hours: 3, ivCount: 99, shotCount: 99 })],
  });
  // The counts are refused rather than quietly priced.
  assert.ok(out.errors.some((e) => e.code === 'adders_not_permitted'));
  assert.equal(out.shiftLines[0].adderCents, 0);
  assert.equal(out.wagesCents, 27000);
});

check('mobile visit ignores IV/shot counts too', () => {
  const out = computeInvoice({
    role: 'RN',
    shifts: [shift({ typeKey: 'mobile', hours: 1, ivCount: 4 })],
  });
  assert.equal(out.wagesCents, 9000);
});

// --- GFE ---------------------------------------------------------------------

check('NP bills GFE at $20 each', () => {
  const out = computeInvoice({
    role: 'NP',
    shifts: [shift({ typeKey: 'mobile', hours: 2, gfeCount: 3 })],
  });
  assert.deepEqual(out.errors, []);
  assert.equal(out.shiftLines[0].gfeCents, 3 * GFE_CENTS);
  assert.equal(out.wagesCents, 18000 + 6000);
});

check('RN GFE is rejected AND zeroed', () => {
  const out = computeInvoice({
    role: 'RN',
    shifts: [shift({ typeKey: 'mobile', hours: 2, gfeCount: 50 })],
  });
  assert.ok(out.errors.some((e) => e.code === 'gfe_not_permitted'));
  assert.equal(out.shiftLines[0].gfeCents, 0);
  assert.equal(out.wagesCents, 18000);
});

check('Manager GFE is rejected AND zeroed', () => {
  const out = computeInvoice({
    role: 'Manager',
    shifts: [shift({ typeKey: 'mobile', hours: 1, gfeCount: 1 })],
  });
  assert.ok(out.errors.some((e) => e.code === 'gfe_not_permitted'));
  assert.equal(out.wagesCents, 9000);
});

// --- Float drift -------------------------------------------------------------

check('7.25 hours lands on exact cents (no float drift)', () => {
  const out = computeInvoice({ role: 'RN', shifts: [shift({ hours: 7.25 })] });
  assert.deepEqual(out.errors, []);
  assert.equal(out.wagesCents, 65250);
  assert.equal(formatCentsPlain(out.wagesCents), '652.50');
});

check('14.56 hours is refused — not a quarter-hour increment', () => {
  // The real Gusto payment for Tiffany Ward was 14.56 @ $90; our form only
  // accepts quarter hours, so this must fail loudly rather than round.
  const out = computeInvoice({ role: 'NP', shifts: [shift({ hours: 14.56 })] });
  assert.ok(out.errors.some((e) => e.code === 'invalid_hours'));
});

check('14.5 hours at $90 is exact', () => {
  const out = computeInvoice({ role: 'NP', shifts: [shift({ hours: 14.5 })] });
  assert.deepEqual(out.errors, []);
  assert.equal(out.wagesCents, 130500);
});

// --- Clamps ------------------------------------------------------------------

check('zero, negative and over-cap hours are refused', () => {
  for (const hours of [0, -4, 25, 'eight', null]) {
    const out = computeInvoice({ role: 'RN', shifts: [shift({ hours })] });
    assert.ok(out.errors.some((e) => e.code === 'invalid_hours'), `hours=${hours}`);
  }
});

check('non-integer and over-cap counts are refused', () => {
  const out = computeInvoice({
    role: 'RN',
    shifts: [shift({ typeKey: 'large_event', ivCount: 2.5, shotCount: 100 })],
  });
  assert.equal(out.errors.filter((e) => e.code === 'invalid_count').length, 2);
});

check('unknown shift type is refused and prices nothing', () => {
  const out = computeInvoice({ role: 'RN', shifts: [shift({ typeKey: 'helicopter' })] });
  assert.ok(out.errors.some((e) => e.code === 'unknown_shift_type'));
  assert.equal(out.wagesCents, 0);
});

check('malformed date is refused', () => {
  const out = computeInvoice({ role: 'RN', shifts: [shift({ date: '08/02/2026' })] });
  assert.ok(out.errors.some((e) => e.code === 'invalid_date'));
});

check('an empty invoice is refused', () => {
  const out = computeInvoice({ role: 'RN', shifts: [], expenses: [] });
  assert.ok(out.errors.some((e) => e.code === 'no_shifts'));
});

check('more than MAX_SHIFT_ROWS shifts is refused', () => {
  const out = computeInvoice({
    role: 'RN',
    shifts: Array.from({ length: MAX_SHIFT_ROWS + 1 }, () => shift()),
  });
  assert.ok(out.errors.some((e) => e.code === 'too_many_shifts'));
});

// --- Expenses ----------------------------------------------------------------

check('expenses total into reimbursements, not wages', () => {
  const out = computeInvoice({
    role: 'RN',
    shifts: [shift({ hours: 4 })],
    expenses: [
      { description: 'Parking garage', amountCents: 4200 },
      { description: 'Gloves and tubing', amountCents: 2040 },
    ],
  });
  assert.deepEqual(out.errors, []);
  assert.equal(out.wagesCents, 36000);
  assert.equal(out.reimbursementsCents, 6240);
  assert.equal(out.grandTotalCents, 42240);
});

check('expense amounts must be positive integer cents under the cap', () => {
  for (const amountCents of [0, -100, 12.5, MAX_EXPENSE_CENTS + 1, 'ten']) {
    const out = computeInvoice({
      role: 'RN',
      shifts: [shift()],
      expenses: [{ description: 'Thing', amountCents }],
    });
    assert.ok(out.errors.some((e) => e.code === 'invalid_amount'), `amount=${amountCents}`);
  }
});

check('expense description is required and length-capped', () => {
  const blank = computeInvoice({
    role: 'RN',
    shifts: [shift()],
    expenses: [{ description: '   ', amountCents: 500 }],
  });
  assert.ok(blank.errors.some((e) => e.code === 'missing_description'));

  const long = computeInvoice({
    role: 'RN',
    shifts: [shift()],
    expenses: [{ description: 'x'.repeat(81), amountCents: 500 }],
  });
  assert.ok(long.errors.some((e) => e.code === 'description_too_long'));
});

// --- Invariant ---------------------------------------------------------------

check('grand total always equals wages plus reimbursements', () => {
  const out = computeInvoice({
    role: 'NP',
    shifts: [
      shift({ typeKey: 'mobile', hours: 7.25 }),
      shift({ typeKey: 'large_event', hours: 5.5, ivCount: 9, shotCount: 3, gfeCount: 2 }),
      shift({ typeKey: 'small_event', hours: 2.75 }),
    ],
    expenses: [{ description: 'Parking', amountCents: 3500 }],
  });
  assert.deepEqual(out.errors, []);
  assert.equal(out.grandTotalCents, out.wagesCents + out.reimbursementsCents);
  // 652.50 + (275.00 + 360.00 + 30.00 + 40.00) + 247.50 + 35.00
  assert.equal(out.grandTotalCents, 164000);
});

// --- Roster ------------------------------------------------------------------

check('roster has exactly two NPs and no unpaid staff', () => {
  const nps = NURSE_ROSTER.filter((n) => n.role === 'NP').map((n) => n.name);
  assert.deepEqual(nps.sort(), ['Angela Solleder', 'Tiffany Ward']);
  for (const excluded of ['Corey Assibey', 'Aaron Goldbard']) {
    assert.ok(!NURSE_ROSTER.some((n) => n.name === excluded), `${excluded} must not be billable`);
  }
});

check('every roster id resolves and every role is known', () => {
  const ids = new Set();
  for (const nurse of NURSE_ROSTER) {
    assert.equal(findNurse(nurse.id)?.name, nurse.name);
    assert.ok(['NP', 'RN', 'Manager'].includes(nurse.role), `bad role: ${nurse.role}`);
    assert.ok(!ids.has(nurse.id), `duplicate id: ${nurse.id}`);
    ids.add(nurse.id);
  }
  assert.equal(findNurse('nobody'), null);
});

// The name is typed, not picked, so name->role matching is now what keeps GFE
// NP-only. If this loosens, any nurse can bill the $20 fee by typing anything.
check('a typed name resolves to the roster role, whitespace and case aside', () => {
  assert.equal(roleForName('Tiffany Ward'), 'NP');
  assert.equal(roleForName('  tiffany   WARD '), 'NP');
  assert.equal(roleForName('Robert Sloan'), 'RN');
  assert.equal(roleForName('Stephanie Weeks'), 'Manager');
  assert.equal(matchNurseByName('Angela Solleder')?.id, 'angela-solleder');
});

check('an unrecognised name gets the most restrictive role, never NP', () => {
  for (const typed of ['', '   ', 'Somebody Else', 'T. Ward', 'Tiffany', 'NP']) {
    assert.equal(roleForName(typed), 'RN', `typed=${JSON.stringify(typed)}`);
    assert.equal(matchNurseByName(typed), null);
  }
  // ...and that means the fee is simply not payable to them.
  const out = computeInvoice({
    role: roleForName('Somebody Else'),
    shifts: [shift({ typeKey: 'mobile', hours: 2, gfeCount: 4 })],
  });
  assert.ok(out.errors.some((e) => e.code === 'gfe_not_permitted'));
  assert.equal(out.wagesCents, 18000);
});

check('initials build the Gusto invoice suffix', () => {
  assert.equal(nurseInitials('Tiffany Ward'), 'TW');
  assert.equal(nurseInitials('Rowieh Schabert'), 'RS');
});

// --- The document -------------------------------------------------------------
// One builder feeds the approvers' email, the print/PDF copy and the Word
// download. If it ever disagrees with the computation, a nurse's saved record
// and the payment made against it diverge silently.

check('document carries the Gusto fields, the invoice number and the right money', () => {
  const nurse = findNurse('tiffany-ward');
  const computed = computeInvoice({
    role: nurse.role,
    shifts: [
      { date: '2026-08-02', typeKey: 'large_event', hours: 6, ivCount: 12, shotCount: 5, gfeCount: 3 },
      { date: '2026-08-05', typeKey: 'mobile', hours: 7.25, ivCount: 0, shotCount: 0, gfeCount: 0 },
    ],
    expenses: [{ description: 'Parking garage', amountCents: 4200 }],
  });
  assert.deepEqual(computed.errors, []);

  const html = buildInvoiceDocumentHtml({
    nurse,
    invoiceNumber: 'AV-20260815-TW-4K2P',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-15',
    computed,
    submittedAt: '2026-08-10T18:30:00.000Z',
  });

  for (const field of ['Contractor', 'Invoice', 'Wage', 'Reimbursement', 'Total']) {
    assert.ok(html.includes(field), `Gusto field missing from document: ${field}`);
  }
  assert.ok(html.includes('AV-20260815-TW-4K2P'), 'invoice number missing');
  assert.ok(html.includes('Tiffany Ward'), 'contractor name missing');

  // Gusto's inputs reject "$1,542.50" — the paste-ready figures must be bare.
  assert.ok(html.includes(formatCentsPlain(computed.wagesCents)), 'plain wage figure missing');
  assert.ok(
    html.includes(formatCentsPlain(computed.reimbursementsCents)),
    'plain reimbursement figure missing',
  );
  assert.equal(computed.grandTotalCents, computed.wagesCents + computed.reimbursementsCents);
});

check('document escapes anything a nurse typed', () => {
  const nurse = findNurse('robert-sloan');
  const computed = computeInvoice({
    role: nurse.role,
    shifts: [{ date: '2026-08-02', typeKey: 'mobile', hours: 2, ivCount: 0, shotCount: 0, gfeCount: 0 }],
    expenses: [{ description: '<script>alert(1)</script>', amountCents: 500 }],
  });
  const html = buildInvoiceDocumentHtml({
    nurse,
    invoiceNumber: 'AV-20260815-RS-TEST',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-15',
    computed,
    submittedAt: '2026-08-10T18:30:00.000Z',
  });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'expense description was not escaped');
  assert.ok(html.includes('&lt;script&gt;'), 'expected the escaped form');
});

check('the downloadable file is a complete standalone document', () => {
  const nurse = findNurse('anna-holder');
  const computed = computeInvoice({
    role: nurse.role,
    shifts: [{ date: '2026-08-02', typeKey: 'mobile', hours: 4, ivCount: 0, shotCount: 0, gfeCount: 0 }],
    expenses: [],
  });
  const file = buildInvoiceFileHtml({
    nurse,
    invoiceNumber: 'AV-20260815-AH-TEST',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-15',
    computed,
    submittedAt: '2026-08-10T18:30:00.000Z',
  });
  assert.ok(file.startsWith('<!DOCTYPE html>'), 'download must be a full document, not a fragment');
  assert.ok(file.includes('charset="utf-8"'), 'download needs an explicit charset for Word');
  assert.ok(file.includes('AV-20260815-AH-TEST'));
});

check('CSV itemises the invoice and neutralises formula injection', () => {
  const nurse = findNurse('tiffany-ward');
  const computed = computeInvoice({
    role: nurse.role,
    shifts: [{ date: '2026-08-02', typeKey: 'large_event', hours: 6, ivCount: 12, shotCount: 5, gfeCount: 3 }],
    // A description opening with '=' is executed as a formula by Excel and
    // Sheets when the file is opened.
    expenses: [{ description: '=cmd|calc', amountCents: 4200 }],
  });
  assert.deepEqual(computed.errors, []);

  const csv = buildInvoiceCsv({
    nurse,
    invoiceNumber: 'AV-20260815-TW-4K2P',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-15',
    computed,
    submittedAt: '2026-08-10T18:30:00.000Z',
  });

  assert.ok(csv.startsWith('\uFEFF'), 'needs a BOM so Excel on Windows reads UTF-8');
  assert.ok(csv.includes('\r\n'), 'needs CRLF line endings');
  assert.ok(csv.includes('AV-20260815-TW-4K2P'));
  assert.ok(csv.includes('Tiffany Ward'));
  assert.ok(csv.includes('Large event'), 'shift rows missing');
  assert.ok(csv.includes(formatCentsPlain(computed.grandTotalCents)), 'total missing');
  assert.ok(!/(^|,)=cmd/m.test(csv), 'formula injection was not neutralised');
  assert.ok(csv.includes("'=cmd|calc"), 'expected the apostrophe-prefixed form');
});

// --- Report ------------------------------------------------------------------

if (failures.length) {
  console.error(`\n✗ invoice math: ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}\n`);
  process.exit(1);
}
console.log(`✓ invoice math: ${passed} checks passed`);
