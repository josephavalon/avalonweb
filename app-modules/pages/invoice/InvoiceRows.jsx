import { Minus, Paperclip, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { avalonFieldClass } from '@/components/ui/formStyles';
import { SHIFT_TYPES, findShiftType, formatCents } from '@/data/nurseInvoiceRates';
import { RECEIPT_ACCEPT_ATTR, formatBytes } from './receiptFile';

// avalonFieldClass is text-sm (14px); anything under 16px makes iOS zoom the
// viewport on focus, and this form is filled on a phone. cn() runs twMerge so
// the later size wins instead of both classes fighting.
export const invoiceFieldClass = cn(avalonFieldClass, 'text-base');

// Body font at full contrast, not 10px mono at 55% opacity. Mono is for numbers
// at rest; a field label is something a nurse has to read in a car at night, and
// on cream a faded uppercase mono simply is not legible.
export const invoiceLabelClass =
  'font-body text-[13px] font-semibold tracking-[0.08em] uppercase text-foreground mb-2 block';

// A red ring as well as a red border: the ring reads louder, and the border
// keeps its weight so nothing shifts by a pixel when an error appears.
//
// focus:border-red-500 is the load-bearing part. avalonFieldClass carries
// focus:border-foreground/40, which would otherwise repaint the border grey the
// moment the field takes focus — and the first invalid field is exactly the one
// that gets focused, so the highlight would vanish from the field it matters on.
// The ! matters. avalonFieldClass sets its border with an arbitrary value
// (border-foreground/[0.10]) which twMerge does not recognise as a border-colour
// utility, so it never drops it and CSS order decides — grey wins. It also
// carries focus:border-foreground/40, and the first invalid field is exactly the
// one that gets focused, so without this the highlight vanishes where it matters
// most.
export const fieldErrorClass = '!border-red-500 focus:!border-red-500 ring-1 ring-red-500';

export const fieldErrorTextClass = 'mt-1.5 font-body text-[13px] text-red-600';

export function FieldError({ children }) {
  if (!children) return null;
  return <p className={fieldErrorTextClass}>{children}</p>;
}

export const subCardClass =
  'rounded-2xl border border-foreground/[0.10] bg-[#fffdf8] px-4 py-4 md:px-5 md:py-5';

export function SegmentedControl({ label, options, value, onChange, className }) {
  return (
    <div className={className}>
      {label ? <span className={invoiceLabelClass}>{label}</span> : null}
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-3 gap-1 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-1"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-xl px-2 py-2.5 font-body text-[13px] font-medium leading-tight transition-colors',
                active
                  ? 'bg-foreground text-background'
                  : 'text-foreground/70 hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Stepper + numeric input. Steppers exist because thumbs beat tiny keyboards. */
export function CountField({ label, value, onChange, max = 99, id, error }) {
  const clamp = (next) => Math.max(0, Math.min(max, next));
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;

  return (
    <div>
      <span className={invoiceLabelClass}>{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(String(clamp(numeric - 1)))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-foreground/15 text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <Minus className="h-4 w-4" strokeWidth={2} />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          aria-invalid={error ? 'true' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ''))}
          className={cn(
            invoiceFieldClass,
            'av-mono h-11 px-2 py-0 text-center tabular-nums',
            error && fieldErrorClass,
          )}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(String(clamp(numeric + 1)))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-foreground/15 text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function RemoveButton({ onClick, label }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-[13px] text-foreground/60 transition-colors hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} />
      Remove
    </button>
  );
}

export function ShiftRow({ row, index, subtotalCents, onChange, onRemove, errors = {} }) {
  const type = findShiftType(row.typeKey);
  // Adder fields render only where the tier actually pays them, so a nurse
  // literally cannot enter an IV count on a small event.
  const hasAdders = Boolean(type && (type.perIvCents > 0 || type.perShotCents > 0));
  const hasError = Object.values(errors).some(Boolean);

  return (
    <div className={cn(subCardClass, hasError && 'border-red-400')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p
          className={cn(
            'font-body text-[12px] font-semibold uppercase tracking-[0.12em]',
            hasError ? 'text-red-600' : 'text-foreground/70',
          )}
        >
          Shift {index + 1}
        </p>
        <RemoveButton onClick={onRemove} label={`Remove shift ${index + 1}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={invoiceLabelClass} htmlFor={`shift-date-${row.id}`}>
            Date
          </label>
          <input
            id={`shift-date-${row.id}`}
            type="date"
            aria-invalid={errors.date ? 'true' : undefined}
            value={row.date}
            onChange={(event) => onChange({ date: event.target.value })}
            className={cn(invoiceFieldClass, 'av-mono', errors.date && fieldErrorClass)}
          />
          <FieldError>{errors.date}</FieldError>
        </div>
        <div>
          <label className={invoiceLabelClass} htmlFor={`shift-hours-${row.id}`}>
            Hours
          </label>
          <input
            id={`shift-hours-${row.id}`}
            type="text"
            inputMode="decimal"
            placeholder="7.5"
            value={row.hours}
            aria-invalid={errors.hours ? 'true' : undefined}
            onChange={(event) => onChange({ hours: event.target.value.replace(/[^0-9.]/g, '') })}
            className={cn(invoiceFieldClass, 'av-mono tabular-nums', errors.hours && fieldErrorClass)}
          />
          <FieldError>{errors.hours}</FieldError>
        </div>
      </div>

      <SegmentedControl
        label="Type"
        className="mt-3"
        value={row.typeKey}
        onChange={(typeKey) => onChange({ typeKey })}
        options={SHIFT_TYPES.map((option) => ({ value: option.key, label: option.label }))}
      />
      {type ? (
        <p className="mt-2 font-body text-[13px] text-foreground/70">{type.hint}</p>
      ) : null}
      <FieldError>{errors.typeKey}</FieldError>

      <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 sm:grid-cols-3">
        {hasAdders ? (
          <>
            <CountField
              id={`shift-iv-${row.id}`}
              label="IVs"
              value={row.ivCount}
              error={errors.ivCount}
              onChange={(ivCount) => onChange({ ivCount })}
            />
            <CountField
              id={`shift-shot-${row.id}`}
              label="Shots"
              value={row.shotCount}
              error={errors.shotCount}
              onChange={(shotCount) => onChange({ shotCount })}
            />
          </>
        ) : null}
        {/* GFE shows on every shift for every contractor. It was NP-only until
            2026-08-10; anyone may now claim it, and approval before payment is
            where it gets checked. */}
        <CountField
          id={`shift-gfe-${row.id}`}
          label="GFE"
          value={row.gfeCount}
          error={errors.gfeCount}
          onChange={(gfeCount) => onChange({ gfeCount })}
        />
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-foreground/10 pt-3">
        <span className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/70">
          Shift total
        </span>
        <span className="av-price text-[17px] font-semibold tabular-nums text-foreground">
          {formatCents(subtotalCents)}
        </span>
      </div>
    </div>
  );
}

export function ExpenseRow({ row, index, onChange, onRemove, onAttach, attachError, errors = {} }) {
  const hasError = Object.values(errors).some(Boolean);
  return (
    <div className={cn(subCardClass, hasError && 'border-red-400')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p
          className={cn(
            'font-body text-[12px] font-semibold uppercase tracking-[0.12em]',
            hasError ? 'text-red-600' : 'text-foreground/70',
          )}
        >
          Expense {index + 1}
        </p>
        <RemoveButton onClick={onRemove} label={`Remove expense ${index + 1}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div>
          <label className={invoiceLabelClass} htmlFor={`expense-desc-${row.id}`}>
            Description
          </label>
          <input
            id={`expense-desc-${row.id}`}
            type="text"
            maxLength={80}
            placeholder="Parking at the venue"
            value={row.description}
            aria-invalid={errors.description ? 'true' : undefined}
            onChange={(event) => onChange({ description: event.target.value })}
            className={cn(invoiceFieldClass, errors.description && fieldErrorClass)}
          />
          <FieldError>{errors.description}</FieldError>
        </div>
        <div>
          <label className={invoiceLabelClass} htmlFor={`expense-amount-${row.id}`}>
            Amount
          </label>
          <input
            id={`expense-amount-${row.id}`}
            type="text"
            inputMode="decimal"
            placeholder="42.00"
            value={row.amount}
            aria-invalid={errors.amountCents ? 'true' : undefined}
            onChange={(event) => onChange({ amount: event.target.value.replace(/[^0-9.]/g, '') })}
            className={cn(invoiceFieldClass, 'av-mono tabular-nums', errors.amountCents && fieldErrorClass)}
          />
          <FieldError>{errors.amountCents}</FieldError>
        </div>
      </div>

      <div className="mt-3 border-t border-foreground/10 pt-3">
        {row.receipt ? (
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <Paperclip className="h-4 w-4 shrink-0 text-foreground/50" strokeWidth={1.75} />
              <span className="truncate font-body text-[14px]">{row.receipt.fileName}</span>
              <span className="av-mono shrink-0 text-[12px] text-foreground/70">
                {formatBytes(row.receipt.bytes)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ receipt: null })}
              className="shrink-0 font-body text-[12px] text-foreground/45 transition-colors hover:text-foreground"
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 font-body text-[14px] text-foreground/70 transition-colors hover:text-foreground">
            <Paperclip className="h-4 w-4" strokeWidth={1.75} />
            Attach receipt
            <input
              type="file"
              accept={RECEIPT_ACCEPT_ATTR}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Reset so picking the same file twice still fires a change.
                event.target.value = '';
                if (file) onAttach(file);
              }}
            />
          </label>
        )}
        {attachError ? (
          <p className="mt-2 font-body text-[13px] text-red-600">{attachError}</p>
        ) : null}
      </div>
    </div>
  );
}
