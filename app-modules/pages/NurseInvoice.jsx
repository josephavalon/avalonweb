import { useEffect, useMemo, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, CheckCircle2, Download, Loader2, LogOut, Plus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSeo } from '@/lib/seo';
import { matchNurseByName, roleForName } from '@/data/nurseRoster';
import {
  MAX_EXPENSE_ROWS,
  MAX_SHIFT_ROWS,
  computeInvoice,
  formatCents,
  formatCentsPlain,
  shiftTypeHasAdders,
} from '@/data/nurseInvoiceRates';
import {
  ExpenseRow,
  FieldError,
  ShiftRow,
  fieldErrorClass,
  invoiceFieldClass,
  invoiceLabelClass,
} from './invoice/InvoiceRows';
import {
  MAX_TOTAL_RECEIPT_BYTES,
  formatBytes,
  prepareReceipt,
  totalReceiptBytes,
} from './invoice/receiptFile';
import {
  INVOICE_DRAFT_KEY,
  clearInvoiceSession,
  readInvoiceToken,
} from '@/lib/invoiceSession';
import { buildInvoiceCsv, buildInvoiceDocumentHtml } from '@/data/invoiceDocument';
import { DOCX_MIME, buildInvoiceDocx } from '@/data/invoiceDocx';

/**
 * /invoice — the contractor pay form.
 *
 * ── THIS PAGE IS DELIBERATELY PHI-FREE ──────────────────────────────────────
 * It collects hours, counts and dollar amounts, and nothing else. There is no
 * name-of-the-person-treated field, no event name, no location, no notes box.
 * The one free-text input (expense description) is validated against the PHI
 * block-list server-side in api/invoice/submit.js.
 *
 * That absence is what keeps /invoice off the front-door PHI guard and out of
 * HIPAA scope, and scripts/front-door-qa.mjs asserts it. If someone asks for a
 * free-text field here, the answer is a server-side enum, not a text input.
 *
 * Totals shown here are a preview. api/invoice/submit.js recomputes from the
 * same module and pays out its own answer — this page never sends a total.
 */

const CARD_CLASS =
  'rounded-[2rem] border border-foreground/[0.10] bg-background px-5 py-6 shadow-[0_20px_60px_-30px_rgba(43,33,27,0.35)] md:px-8 md:py-8';

const ERROR_CLASS = 'font-body text-[13px] text-red-600 mt-1';

// The server enforces the same closed state. Turn this on only in the code
// change that connects the approved receipt-scanner worker end to end.
const EXPENSE_REIMBURSEMENT_ENABLED = false;

// computeInvoice reports codes, not prose. Anything unmapped falls back to a
// plain instruction rather than leaking an identifier at a nurse.
const ERROR_MESSAGES = {
  invalid_date: 'Pick a date.',
  invalid_hours: 'Hours must be between 0 and 24, in quarter hours (7, 7.25, 7.5).',
  hours_exceed_day: 'Shifts on this date add up to more than 24 hours.',
  invalid_count: 'Use a whole number from 0 to 99.',
  adders_not_permitted: 'This shift type does not pay per IV or shot.',
  unknown_shift_type: 'Choose a shift type.',
  missing_description: 'Say what the expense was for.',
  description_too_long: 'Keep the description under 80 characters.',
  invalid_amount: 'Enter an amount above $0.00.',
};

// Deliberately loose: it exists to catch a typo, not to adjudicate RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const messageFor = (code) => ERROR_MESSAGES[code] || 'Check this field.';

/** computeInvoice errors -> { shifts: { [index]: {field: msg} }, expenses: {...}, form: [...] } */
function groupErrors(errors) {
  const grouped = { shifts: {}, expenses: {}, form: [] };
  for (const item of errors) {
    if (item.index < 0) {
      grouped.form.push(item.code);
      continue;
    }
    const bucket = item.scope === 'expense' ? grouped.expenses : grouped.shifts;
    bucket[item.index] = { ...bucket[item.index], [item.field]: messageFor(item.code) };
  }
  return grouped;
}
function rowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function newSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

const emptyShift = () => ({
  id: rowId(),
  date: '',
  typeKey: 'mobile',
  hours: '',
  ivCount: '0',
  shotCount: '0',
  gfeCount: '0',
});

const emptyExpense = () => ({ id: rowId(), description: '', amount: '', receipt: null });

const initialState = {
  submissionId: newSubmissionId(),
  step: 'locked',
  token: '',
  nurseName: '',
  nurseEmail: '',
  periodStart: '',
  periodEnd: '',
  shifts: [emptyShift()],
  expenses: [],
  confirmed: false,
  status: 'idle',
  error: '',
  result: null,
  attachErrors: {},
  // Errors stay hidden until the first attempt to move on — nobody wants to be
  // corrected while still typing the first character.
  showErrors: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'restore':
      return { ...state, ...action.value };

    case 'unlocked':
      return { ...state, token: action.token, step: 'form', status: 'idle', error: '' };

    case 'setNurseName':
      return { ...state, nurseName: action.value, error: '' };

    case 'setField':
      return { ...state, [action.field]: action.value, error: '' };

    case 'addShift':
      return state.shifts.length >= MAX_SHIFT_ROWS
        ? state
        : { ...state, shifts: [...state.shifts, emptyShift()] };

    case 'updateShift':
      return {
        ...state,
        error: '',
        shifts: state.shifts.map((row) => {
          if (row.id !== action.id) return row;
          const next = { ...row, ...action.patch };
          // Same reasoning as the GFE zeroing above: leaving a tier that pays
          // adders must clear them, or the counts survive invisibly.
          if (action.patch.typeKey && !shiftTypeHasAdders(action.patch.typeKey)) {
            next.ivCount = '0';
            next.shotCount = '0';
          }
          return next;
        }),
      };

    case 'removeShift':
      return { ...state, shifts: state.shifts.filter((row) => row.id !== action.id) };

    case 'addExpense':
      return state.expenses.length >= MAX_EXPENSE_ROWS
        ? state
        : { ...state, expenses: [...state.expenses, emptyExpense()] };

    case 'updateExpense':
      return {
        ...state,
        error: '',
        attachErrors: { ...state.attachErrors, [action.id]: '' },
        expenses: state.expenses.map((row) =>
          row.id === action.id ? { ...row, ...action.patch } : row,
        ),
      };

    case 'removeExpense':
      return { ...state, expenses: state.expenses.filter((row) => row.id !== action.id) };

    case 'attachError':
      return { ...state, attachErrors: { ...state.attachErrors, [action.id]: action.message } };

    case 'goto':
      return { ...state, step: action.step, error: '' };

    case 'showErrors':
      return { ...state, showErrors: true, error: action.error || '' };

    case 'status':
      return { ...state, status: action.status, error: action.error || '' };

    case 'sent':
      return { ...state, step: 'sent', status: 'idle', result: action.result };

    case 'relock':
      // Keep everything the nurse typed — only the door closed.
      return { ...state, token: '', step: 'locked', status: 'idle', error: action.error || '' };

    case 'reset':
      return { ...initialState, submissionId: newSubmissionId(), shifts: [emptyShift()], token: state.token, step: 'form' };

    default:
      return state;
  }
}

/** Form rows hold strings (that's what inputs give you); the math wants numbers. */
function toComputeInput(state) {
  return {
    shifts: state.shifts.map((row) => ({
      date: row.date,
      typeKey: row.typeKey,
      hours: Number(row.hours),
      ivCount: Number(row.ivCount || 0),
      shotCount: Number(row.shotCount || 0),
      gfeCount: Number(row.gfeCount || 0),
    })),
    expenses: (EXPENSE_REIMBURSEMENT_ENABLED ? state.expenses : []).map((row) => ({
      description: row.description,
      amountCents: Math.round(Number(row.amount || 0) * 100),
    })),
  };
}

function StepSummary({ label, value, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/[0.10] bg-background px-5 py-3.5">
      <div className="min-w-0">
        <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/70">
          {label}
        </p>
        <p className="truncate font-body text-[15px] font-medium text-foreground">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 border-b border-foreground/30 pb-0.5 font-body text-[13px] text-foreground transition-colors hover:border-foreground"
      >
        Edit
      </button>
    </div>
  );
}

export default function NurseInvoice() {
  useSeo({
    title: 'Invoice — Avalon Vitality',
    description: 'Contractor invoice submission for the Avalon clinical team.',
    path: '/invoice',
    robots: 'noindex, nofollow, noarchive',
  });

  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  // Role is a label resolved from the roster, matching what the server records.
  // It no longer gates anything — GFE is billable by everyone.
  const matchedNurse = matchNurseByName(state.nurseName);
  const nurse = { name: state.nurseName.trim(), role: roleForName(state.nurseName) };

  // Restore token + draft. sessionStorage (not local) so a shared iPad doesn't
  // stay unlocked, and not memory-only so an accidental refresh mid-form on a
  // phone doesn't throw away twenty minutes of typing.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const token = readInvoiceToken();
      const draftRaw = window.sessionStorage.getItem(INVOICE_DRAFT_KEY);
      const draft = draftRaw ? JSON.parse(draftRaw) : null;
      if (!token) {
        navigate('/nurse-login', { replace: true });
        return;
      }
      dispatch({
        type: 'restore',
        value: {
          token,
          step: 'form',
          submissionId: draft?.submissionId || newSubmissionId(),
          nurseName: draft?.nurseName || '',
          periodStart: draft?.periodStart || '',
          periodEnd: draft?.periodEnd || '',
          shifts: Array.isArray(draft?.shifts) && draft.shifts.length ? draft.shifts : [emptyShift()],
          nurseEmail: draft?.nurseEmail || '',
          expenses: EXPENSE_REIMBURSEMENT_ENABLED && Array.isArray(draft?.expenses)
            ? draft.expenses.map((row) => ({ ...row, receipt: null }))
            : [],
        },
      });
    } catch {
      /* a corrupt draft is not worth a broken page */
    }
  }, [navigate]);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.token) return;
    try {
      window.sessionStorage.setItem(
        INVOICE_DRAFT_KEY,
        JSON.stringify({
          submissionId: state.submissionId,
          nurseName: state.nurseName,
          periodStart: state.periodStart,
          periodEnd: state.periodEnd,
          shifts: state.shifts,
          expenses: EXPENSE_REIMBURSEMENT_ENABLED
            ? state.expenses.map(({ receipt, ...rest }) => rest)
            : [],
          nurseEmail: state.nurseEmail,
        }),
      );
    } catch {
      /* storage full or blocked — the form still works */
    }
  }, [
    state.submissionId,
    state.token,
    state.nurseName,
    state.nurseEmail,
    state.periodStart,
    state.periodEnd,
    state.shifts,
    state.expenses,
  ]);

  const computed = useMemo(
    () => computeInvoice(toComputeInput(state)),
    [state],
  );

  // Errors are computed continuously but only rendered once the nurse has tried
  // to move on, so corrections appear live from then on without anyone being
  // scolded mid-keystroke.
  const fieldErrors = useMemo(
    () => (state.showErrors ? groupErrors(computed.errors) : { shifts: {}, expenses: {}, form: [] }),
    [state.showErrors, computed.errors],
  );

  const nameError = state.showErrors && state.nurseName.trim().length < 2 ? 'Enter your name.' : '';
  const emailError = state.showErrors && !EMAIL_RE.test(state.nurseEmail.trim())
    ? 'Enter the work email used for your contractor profile.'
    : '';
  const periodStartError = state.showErrors && !state.periodStart ? 'Pick a start date.' : '';
  const periodEndError = state.showErrors && !state.periodEnd ? 'Pick an end date.' : '';

  function handleReview() {
    const problems = [];
    if (state.nurseName.trim().length < 2) problems.push('invoice-nurse');
    if (!EMAIL_RE.test(state.nurseEmail.trim())) problems.push('invoice-email');
    if (!state.periodStart) problems.push('period-start');
    if (!state.periodEnd) problems.push('period-end');

    // Field-level messages are already rendered from `computed.errors`; this only
    // decides whether to reveal them and where to send the cursor.
    for (const item of computed.errors) {
      if (item.index < 0) continue;
      const row = item.scope === 'expense' ? state.expenses[item.index] : state.shifts[item.index];
      if (!row) continue;
      const prefix = item.scope === 'expense'
        ? { description: 'expense-desc', amountCents: 'expense-amount' }[item.field]
        : { date: 'shift-date', hours: 'shift-hours', ivCount: 'shift-iv', shotCount: 'shift-shot', gfeCount: 'shift-gfe' }[item.field];
      if (prefix) problems.push(`${prefix}-${row.id}`);
    }

    if (problems.length || computed.errors.length) {
      const count = problems.length;
      dispatch({
        type: 'showErrors',
        error: count === 1
          ? 'One field needs attention — it is marked in red below.'
          : `${count || 'Some'} fields need attention — they are marked in red below.`,
      });
      // Put the cursor on the first thing that is wrong rather than leaving
      // someone to hunt for the red on a forty-row invoice.
      const target = document.getElementById(problems[0]);
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target.focus({ preventScroll: true });
      }
      return;
    }
    dispatch({ type: 'goto', step: 'review' });
  }

  // Built from the server's computation, not this page's preview, so the saved
  // copy and the approvers' email can never show different money.
  const documentParams = useMemo(() => {
    if (!state.result?.invoiceNumber || !state.result?.computed) return null;
    return {
      nurse,
      invoiceNumber: state.result.invoiceNumber,
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      computed: state.result.computed,
      submittedAt: state.result.submittedAt || '',
    };
  }, [state.result, state.periodStart, state.periodEnd, nurse.name, nurse.role]);

  const invoiceDocument = useMemo(
    () => (documentParams ? buildInvoiceDocumentHtml(documentParams) : ''),
    [documentParams],
  );

  async function handleAttach(rowId, file) {
    try {
      const receipt = await prepareReceipt(file);
      const others = state.expenses.filter((row) => row.id !== rowId);
      if (totalReceiptBytes(others) + receipt.bytes > MAX_TOTAL_RECEIPT_BYTES) {
        dispatch({
          type: 'attachError',
          id: rowId,
          message: `Receipts total more than ${formatBytes(MAX_TOTAL_RECEIPT_BYTES)}. Remove one first.`,
        });
        return;
      }
      dispatch({ type: 'updateExpense', id: rowId, patch: { receipt } });
    } catch (error) {
      dispatch({ type: 'attachError', id: rowId, message: error.message });
    }
  }

  function handleLogout() {
    // Clear the draft too — on a shared phone the next person must not inherit
    // a half-filled invoice with someone else's shifts in it.
    clearInvoiceSession();
    navigate('/nurse-login', { replace: true });
  }

  function handlePrint() {
    window.print();
  }

  function saveBlob(contents, mime, extension) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `avalon-invoice-${state.result.invoiceNumber}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadCsv() {
    if (!documentParams) return;
    saveBlob(buildInvoiceCsv(documentParams), 'text/csv;charset=utf-8', 'csv');
  }

  function handleDownloadDocx() {
    if (!documentParams) return;
    // A genuine .docx rather than HTML wearing a Word MIME type. Word tolerated
    // the old trick; LibreOffice showed the nurse a page of raw markup.
    saveBlob(
      buildInvoiceDocx({ ...documentParams, money: formatCents, moneyPlain: formatCentsPlain }),
      DOCX_MIME,
      'docx',
    );
  }

  async function handleSubmit() {
    dispatch({ type: 'status', status: 'submitting' });
    const payload = toComputeInput(state);
    try {
      const response = await fetch('/api/invoice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: state.token,
          submissionId: state.submissionId,
          nurseName: state.nurseName,
          periodStart: state.periodStart,
          periodEnd: state.periodEnd,
          shifts: payload.shifts,
          expenses: payload.expenses,
          nurseEmail: state.nurseEmail.trim(),
          receipts: EXPENSE_REIMBURSEMENT_ENABLED
            ? state.expenses
                .map((row, index) => (row.receipt ? { index, ...row.receipt } : null))
                .filter(Boolean)
            : [],
          confirmed: true,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        clearInvoiceSession();
        navigate('/nurse-login', { replace: true });
        return;
      }
      if (!response.ok) {
        dispatch({
          type: 'status',
          status: 'idle',
          error: data?.error || 'Could not submit. Please try again.',
        });
        return;
      }
      if (response.status === 202 || data?.fullyDelivered !== true) {
        // The invoice row and the same submission UUID remain in the draft so a
        // receipt-storage retry cannot accidentally create a duplicate invoice.
        dispatch({
          type: 'status',
          status: 'idle',
          error: data?.warning || 'Your invoice is stored for Finance review, but one delivery step still needs attention.',
        });
        return;
      }
      try {
        window.sessionStorage.removeItem(INVOICE_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      dispatch({ type: 'sent', result: data });
    } catch {
      dispatch({ type: 'status', status: 'idle', error: 'Network error. Please try again.' });
    }
  }

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden text-foreground">
      <main className="mx-auto w-full max-w-3xl px-4 pb-8 pt-28 md:px-6 md:pb-10 md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-4 av-print-hide"
        >
          {state.step === 'form' ? (
            <>
              <div className={CARD_CLASS}>
                <p className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  Who is invoicing?
                </p>
                <div className="mt-4">
                  <label className={invoiceLabelClass} htmlFor="invoice-nurse">
                    Name
                  </label>
                  <input
                    id="invoice-nurse"
                    type="text"
                    autoComplete="name"
                    autoCapitalize="words"
                    maxLength={60}
                    placeholder="First and last name"
                    value={state.nurseName}
                    aria-invalid={nameError ? 'true' : undefined}
                    onChange={(event) =>
                      dispatch({ type: 'setNurseName', value: event.target.value })
                    }
                    className={cn(invoiceFieldClass, nameError && fieldErrorClass)}
                  />
                  <FieldError>{nameError}</FieldError>
                </div>
                <div className="mt-4">
                  <label className={invoiceLabelClass} htmlFor="invoice-email">
                    Work email
                  </label>
                  <input
                    id="invoice-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    maxLength={120}
                    placeholder="you@example.com"
                    required
                    value={state.nurseEmail}
                    aria-invalid={emailError ? 'true' : undefined}
                    onChange={(event) =>
                      dispatch({ type: 'setField', field: 'nurseEmail', value: event.target.value })
                    }
                    className={cn(invoiceFieldClass, emailError && fieldErrorClass)}
                  />
                  <FieldError>{emailError}</FieldError>
                  <p className="mt-2 font-body text-[14px] leading-[1.5] text-foreground/75">
                    Used to match your contractor profile. Invoice details stay in Avalon Finance for admin review.
                  </p>
                </div>
              </div>

              <div className={CARD_CLASS}>
                <p className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  Pay period
                </p>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className={invoiceLabelClass} htmlFor="period-start">
                      Start
                    </label>
                    <input
                      id="period-start"
                      type="date"
                      value={state.periodStart}
                      aria-invalid={periodStartError ? 'true' : undefined}
                      onChange={(event) =>
                        dispatch({ type: 'setField', field: 'periodStart', value: event.target.value })
                      }
                      className={cn(invoiceFieldClass, 'av-mono', periodStartError && fieldErrorClass)}
                    />
                    <FieldError>{periodStartError}</FieldError>
                  </div>
                  <div className="min-w-0">
                    <label className={invoiceLabelClass} htmlFor="period-end">
                      End
                    </label>
                    <input
                      id="period-end"
                      type="date"
                      value={state.periodEnd}
                      aria-invalid={periodEndError ? 'true' : undefined}
                      onChange={(event) =>
                        dispatch({ type: 'setField', field: 'periodEnd', value: event.target.value })
                      }
                      className={cn(invoiceFieldClass, 'av-mono', periodEndError && fieldErrorClass)}
                    />
                    <FieldError>{periodEndError}</FieldError>
                  </div>
                </div>
              </div>

              <div className={CARD_CLASS}>
                <p className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  Shifts
                </p>
                <div className="mt-4 grid gap-3">
                  {state.shifts.map((row, index) => (
                    <ShiftRow
                      key={row.id}
                      row={row}
                      index={index}
                      subtotalCents={computed.shiftLines[index]?.subtotalCents || 0}
                      errors={fieldErrors.shifts[index] || {}}
                      onChange={(patch) => dispatch({ type: 'updateShift', id: row.id, patch })}
                      onRemove={
                        state.shifts.length > 1
                          ? () => dispatch({ type: 'removeShift', id: row.id })
                          : null
                      }
                    />
                  ))}
                </div>
                {state.shifts.length < MAX_SHIFT_ROWS ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="mt-3 w-full gap-2"
                    onClick={() => dispatch({ type: 'addShift' })}
                  >
                    <Plus className="h-4 w-4" /> Add shift
                  </Button>
                ) : null}
              </div>

              {EXPENSE_REIMBURSEMENT_ENABLED ? (
                <div className={CARD_CLASS}>
                  <p className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">
                    Expenses
                  </p>
                <p className="mt-2 font-body text-[14px] leading-[1.5] text-foreground/75">
                  Reimbursed separately from your shift pay. Attach a receipt where you have one.
                  Descriptions and receipts should show the purchase only — no personal names or
                  health details. Files are stored privately and remain quarantined until an
                  approved scanner clears them for Finance review.
                </p>
                {state.expenses.length ? (
                  <div className="mt-4 grid gap-3">
                    {state.expenses.map((row, index) => (
                      <ExpenseRow
                        key={row.id}
                        row={row}
                        index={index}
                        onChange={(patch) => dispatch({ type: 'updateExpense', id: row.id, patch })}
                        onRemove={() => dispatch({ type: 'removeExpense', id: row.id })}
                        onAttach={(file) => handleAttach(row.id, file)}
                        attachError={state.attachErrors[row.id] || ''}
                        errors={fieldErrors.expenses[index] || {}}
                      />
                    ))}
                  </div>
                ) : null}
                {state.expenses.length < MAX_EXPENSE_ROWS ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="mt-3 w-full gap-2"
                    onClick={() => dispatch({ type: 'addExpense' })}
                  >
                    <Plus className="h-4 w-4" /> Add expense
                  </Button>
                ) : null}
                </div>
              ) : (
                <div className={CARD_CLASS}>
                  <p className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">
                    Expense reimbursement
                  </p>
                  <p className="mt-2 font-body text-[14px] leading-[1.5] text-foreground/75">
                    Receipt reimbursement is not available in this portal yet because the private
                    receipt-scanning workflow is not connected. Submit shift pay only and contact
                    Avalon Finance separately about an expense.
                  </p>
                </div>
              )}

              {fieldErrors.form.includes('no_shifts') ? (
                <p className={ERROR_CLASS}>Add at least one shift before reviewing.</p>
              ) : null}
              {state.error ? (
                <p role="alert" className={ERROR_CLASS}>
                  {state.error}
                </p>
              ) : null}

              <Button type="button" size="lg" className="w-full" onClick={handleReview}>
                Review invoice
              </Button>
            </>
          ) : null}

          {state.step === 'review' ? (
            <>
              <StepSummary
                label="Invoicing as"
                value={matchedNurse ? `${nurse.name} · ${nurse.role}` : nurse.name}
                onEdit={() => dispatch({ type: 'goto', step: 'form' })}
              />

              <div className={CARD_CLASS}>
                <p className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  Review
                </p>
                <div className="mt-3 h-[3px] w-14 rounded-full bg-foreground/25" aria-hidden="true" />
                <p className="mt-4 av-mono text-[13px] text-foreground/60">
                  {state.periodStart} → {state.periodEnd}
                </p>

                <div className="mt-5 grid gap-2">
                  {computed.shiftLines.map((line) => (
                    <div
                      key={`${line.date}-${line.index}`}
                      className="flex items-baseline justify-between gap-4 border-b border-foreground/10 pb-2"
                    >
                      <div className="min-w-0">
                        <p className="av-mono text-[13px] text-foreground">{line.date}</p>
                        <p className="font-body text-[13px] text-foreground/60">
                          {line.typeLabel} · {line.hours.toFixed(2)}h
                          {line.ivCount ? ` · ${line.ivCount} IV` : ''}
                          {line.shotCount ? ` · ${line.shotCount} shot` : ''}
                          {line.gfeCount ? ` · ${line.gfeCount} GFE` : ''}
                        </p>
                      </div>
                      <span className="av-price shrink-0 text-[15px] tabular-nums text-foreground">
                        {formatCents(line.subtotalCents)}
                      </span>
                    </div>
                  ))}
                  {computed.expenseLines.map((line) => (
                    <div
                      key={`expense-${line.index}`}
                      className="flex items-baseline justify-between gap-4 border-b border-foreground/10 pb-2"
                    >
                      <p className="min-w-0 truncate font-body text-[13px] text-foreground/70">
                        {line.description}
                      </p>
                      <span className="av-price shrink-0 text-[15px] tabular-nums text-foreground">
                        {formatCents(line.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-baseline justify-between border-t-2 border-foreground pt-4">
                  <span className="font-heading uppercase tracking-tight text-[1.5rem] text-foreground">
                    Total
                  </span>
                  <span className="av-price text-[2rem] font-semibold tabular-nums text-foreground">
                    {formatCents(computed.grandTotalCents)}
                  </span>
                </div>

                {/* Custom box, not a native checkbox: the global cream overrides
                    paint an unchecked native box solid dark, which reads as
                    already-confirmed — the one control here that must never lie. */}
                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/[0.10] bg-[#fffdf8] px-4 py-4">
                  <input
                    type="checkbox"
                    checked={state.confirmed}
                    onChange={(event) =>
                      dispatch({ type: 'setField', field: 'confirmed', value: event.target.checked })
                    }
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      state.confirmed
                        ? 'border-foreground bg-foreground'
                        : 'border-foreground/35 bg-background',
                    )}
                  >
                    {state.confirmed ? (
                      <Check className="h-3.5 w-3.5 text-background" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className="font-body text-[14px] leading-[1.5] text-foreground">
                    I confirm this invoice is accurate and complete.
                  </span>
                </label>

                {state.error ? <p className={ERROR_CLASS}>{state.error}</p> : null}

                <Button
                  type="button"
                  size="lg"
                  className="mt-5 w-full gap-2"
                  disabled={!state.confirmed || state.status === 'submitting'}
                  onClick={handleSubmit}
                >
                  {state.status === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    'Submit invoice'
                  )}
                </Button>
              </div>
            </>
          ) : null}

          {state.step === 'sent' ? (
            <div className={CARD_CLASS}>
              <CheckCircle2 className="h-10 w-10 text-emerald-600" strokeWidth={1.75} />
              <h2 className="mt-4 font-heading uppercase tracking-tight text-foreground text-[3rem] leading-[0.9]">
                {state.result?.deliveryStatus === 'sent' ? 'Invoice sent' : 'Invoice saved'}
              </h2>
              <p className="mt-4 av-mono text-[13px] text-foreground/60">
                {state.result?.invoiceNumber}
              </p>
              <p className="mt-1 av-price text-[2rem] font-semibold tabular-nums text-foreground">
                {formatCents(state.result?.grandTotalCents || 0)}
              </p>
              <p className="mt-4 font-body text-[14px] leading-[1.55] text-foreground/70">
                {state.result?.warning
                  || "Your invoice is stored in Avalon Finance and the internal review team was notified. Because this portal uses a shared door, an admin verifies identity before approval."}
              </p>

              <p className="mt-7 font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">
                Keep a copy
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Button type="button" variant="outline" size="lg" className="w-full gap-2" disabled={!invoiceDocument} onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> PDF
                </Button>
                <Button type="button" variant="outline" size="lg" className="w-full gap-2" disabled={!invoiceDocument} onClick={handleDownloadDocx}>
                  <Download className="h-4 w-4" /> Word
                </Button>
                <Button type="button" variant="outline" size="lg" className="w-full gap-2" disabled={!invoiceDocument} onClick={handleDownloadCsv}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </div>
              <p className="mt-2 font-body text-[13px] leading-[1.5] text-foreground/70">
                Save as PDF opens your browser's print dialog — choose "Save as PDF" as the
                destination.
              </p>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-7 w-full"
                onClick={() => dispatch({ type: 'reset' })}
              >
                Submit another invoice
              </Button>
            </div>
          ) : null}
        </motion.div>

        <div className="mt-6 flex justify-end av-print-hide">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-body text-[14px] text-foreground/70 transition-colors hover:text-foreground"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Log out
          </button>
        </div>

        {state.step === 'sent' && invoiceDocument ? (
          <div
            className="hidden av-print-only"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: invoiceDocument }}
          />
        ) : null}
      </main>

      {/* On a 40-row invoice the total is otherwise four screens away, and
          "what am I at?" is the only question being asked the whole time. */}
      {state.step === 'form' ? (
        <div className="sticky bottom-0 z-10 border-t border-foreground/10 bg-background/95 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-4 px-4 py-3">
            <span className="av-mono text-[12px] text-foreground/75">
              {EXPENSE_REIMBURSEMENT_ENABLED
                ? `${formatCents(computed.wagesCents)} + ${formatCents(computed.reimbursementsCents)} exp`
                : `${formatCents(computed.wagesCents)} wages`}
            </span>
            <span className="av-price text-[19px] font-semibold tabular-nums text-foreground">
              {formatCents(computed.grandTotalCents)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
