import React from 'react';
import { Plus, Check, Trash2, Pencil } from 'lucide-react';
import { PEOPLE_MAX } from '../../lib/peopleState.js';

/**
 * "YOUR SESSION" per-person protocol builder.
 *
 * Surfaces the multi-person capability (book/plan up to PEOPLE_MAX people in one
 * nurse visit, each with their own custom protocol) directly in the order
 * summary instead of a row of numbered pills. Used on /book (one-time) and
 * /subscription (plans) — copy + price suffix are caller-supplied so the same
 * component reads "$200" for a visit and "$389/mo" for a plan.
 *
 * `people` is the live roster: [{ id, label, productLabel, priceLabel, filled }].
 * Empty slots up to `max` are rendered as dashed "+ add" rows; only the first
 * one is enabled, and only once the current people all have a protocol (mirrors
 * the old PersonTabStrip canAdd rule).
 */
export default function SessionBuilder({
  people,
  activePersonId,
  onSelect,
  onAdd,
  onRemove,
  max = PEOPLE_MAX,
  compact = false,
  title = 'Your Session',
  subline = 'One custom protocol per person',
  footer = 'Up to 4 people · one nurse visit',
  addLabel = "Add a person's protocol",
  emptyHint = 'Choose a protocol below',
}) {
  const list = Array.isArray(people) && people.length ? people : [];
  if (list.length === 0) return null;

  const count = list.length;
  const lastFilled = Boolean(list[count - 1]?.filled);
  const atCap = count >= max;
  const canAdd = !atCap && lastFilled;
  const emptyCount = Math.max(0, max - count);

  const titleClass = compact ? 'text-[11px]' : 'text-[11px] 2xl:text-xs';
  const rowPad = compact ? 'px-2.5 py-2' : 'px-2.5 py-2 2xl:py-2.5';
  const nameClass = compact ? 'text-[11px]' : 'text-[11px] 2xl:text-xs';

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2">
        {title ? (
          <p className={`font-body font-black uppercase tracking-[0.18em] text-foreground/72 ${titleClass}`}>{title}</p>
        ) : <span />}
        <p className="font-body text-[9px] font-black uppercase tracking-[0.12em] text-foreground/45 2xl:text-[10px]">
          Person {count} of {max}
        </p>
      </div>
      {subline ? (
        <p className="mt-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-foreground/45 2xl:text-[10px]">{subline}</p>
      ) : null}

      <div className="mt-2 space-y-1.5">
        {list.map((person) => {
          const isActive = person.id === activePersonId;
          const filled = Boolean(person.filled);
          return (
            <div
              key={person.id}
              className={`flex items-center gap-2 rounded-[1rem] border ${rowPad} transition-colors ${
                isActive
                  ? 'border-foreground/40 bg-foreground/[0.12] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)]'
                  : 'border-foreground/12 bg-background/40'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-black ${
                  filled
                    ? 'border-emerald-300/50 bg-emerald-400/22 text-emerald-100'
                    : 'border-foreground/30 text-foreground/45'
                }`}
                aria-hidden
              >
                {filled ? <Check className="h-3 w-3" strokeWidth={3} /> : person.index != null ? person.index + 1 : ''}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-[8px] font-black uppercase tracking-[0.14em] text-foreground/50">{person.label}</p>
                <p className={`truncate font-body font-black uppercase tracking-[0.02em] ${filled ? 'text-foreground/88' : 'text-foreground/55'} ${nameClass}`}>
                  {filled ? person.productLabel : emptyHint}
                </p>
              </div>
              {filled && person.priceLabel ? (
                <span className="shrink-0 font-body text-[10px] font-black text-foreground/70 2xl:text-[11px]">{person.priceLabel}</span>
              ) : null}
              {filled && !isActive && (
                <button
                  type="button"
                  onClick={() => onSelect?.(person.id)}
                  className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-body text-[9px] font-black uppercase tracking-[0.08em] text-foreground/50 transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2.4} />
                  Edit
                </button>
              )}
              {list.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove?.(person.id)}
                  aria-label={`Remove ${person.label}`}
                  title={`Remove ${person.label}`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground/35 transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          );
        })}

        {Array.from({ length: emptyCount }).map((_, i) => {
          const isFirstEmpty = i === 0;
          const enabled = isFirstEmpty && canAdd;
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => enabled && onAdd?.()}
              disabled={!enabled}
              title={
                atCap
                  ? `House calls cap at ${max} — contact us for larger groups.`
                  : !lastFilled
                    ? 'Pick this person’s protocol first.'
                    : addLabel
              }
              className={`flex w-full items-center justify-center gap-2 rounded-[1rem] border border-dashed ${rowPad} font-body text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                enabled
                  ? 'border-foreground/32 text-foreground/80 hover:border-foreground/55 hover:text-foreground'
                  : 'cursor-not-allowed border-foreground/14 text-foreground/35'
              }`}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              {addLabel}
            </button>
          );
        })}
      </div>

      {footer && (
        <p className="mt-1.5 font-body text-[9px] font-bold uppercase tracking-[0.08em] text-foreground/40 2xl:text-[10px]">{footer}</p>
      )}
    </div>
  );
}
