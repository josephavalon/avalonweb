import { Minus, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { avalonFieldClass } from '@/components/ui/formStyles';
import { SHIFT_TYPES, findShiftType, formatCents } from '@/data/nurseInvoiceRates';

// avalonFieldClass is text-sm (14px); anything under 16px makes iOS zoom the
// viewport on focus, and this form is filled on a phone. cn() runs twMerge so
// the later size wins instead of both classes fighting.
export const invoiceFieldClass = cn(avalonFieldClass, 'text-base');

export const invoiceLabelClass =
  'av-mono text-[10px] tracking-[0.16em] uppercase text-foreground/55 mb-1.5 block';

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
export function CountField({ label, value, onChange, max = 99 }) {
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
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ''))}
          className={cn(invoiceFieldClass, 'av-mono h-11 px-2 py-0 text-center tabular-nums')}
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
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-[12px] text-foreground/45 transition-colors hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} />
      Remove
    </button>
  );
}

export function ShiftRow({ row, index, subtotalCents, onChange, onRemove }) {
  const type = findShiftType(row.typeKey);
  // Adder fields render only where the tier actually pays them, so a nurse
  // literally cannot enter an IV count on a small event.
  const hasAdders = Boolean(type && (type.perIvCents > 0 || type.perShotCents > 0));

  return (
    <div className={subCardClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="av-mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">
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
            value={row.date}
            onChange={(event) => onChange({ date: event.target.value })}
            className={cn(invoiceFieldClass, 'av-mono')}
          />
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
            onChange={(event) => onChange({ hours: event.target.value.replace(/[^0-9.]/g, '') })}
            className={cn(invoiceFieldClass, 'av-mono tabular-nums')}
          />
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
        <p className="mt-1.5 av-mono text-[11px] text-foreground/45">{type.hint}</p>
      ) : null}

      <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 sm:grid-cols-3">
        {hasAdders ? (
          <>
            <CountField
              label="IVs"
              value={row.ivCount}
              onChange={(ivCount) => onChange({ ivCount })}
            />
            <CountField
              label="Shots"
              value={row.shotCount}
              onChange={(shotCount) => onChange({ shotCount })}
            />
          </>
        ) : null}
        {/* GFE shows on every shift for every contractor. It was NP-only until
            2026-08-10; anyone may now claim it, and approval before payment is
            where it gets checked. */}
        <CountField
          label="GFE"
          value={row.gfeCount}
          onChange={(gfeCount) => onChange({ gfeCount })}
        />
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-foreground/10 pt-3">
        <span className="av-mono text-[10px] uppercase tracking-[0.16em] text-foreground/50">
          Shift total
        </span>
        <span className="av-price text-[17px] font-semibold tabular-nums text-foreground">
          {formatCents(subtotalCents)}
        </span>
      </div>
    </div>
  );
}

export function ExpenseRow({ row, index, onChange, onRemove }) {
  return (
    <div className={subCardClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="av-mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">
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
            onChange={(event) => onChange({ description: event.target.value })}
            className={invoiceFieldClass}
          />
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
            onChange={(event) => onChange({ amount: event.target.value.replace(/[^0-9.]/g, '') })}
            className={cn(invoiceFieldClass, 'av-mono tabular-nums')}
          />
        </div>
      </div>
    </div>
  );
}
