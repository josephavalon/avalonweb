import React from 'react';
import { Plus, Check, X } from 'lucide-react';
import { PEOPLE_MAX } from '../../lib/peopleState.js';

/**
 * Per-person protocol control — deliberately NOT a panel.
 *
 * Most bookings are for one person, so the default is a single small
 * "+ Add another person" ghost link that only shows once the current person's
 * protocol is picked. Booking for 2-4 people in one nurse visit collapses to a
 * compact inline pill strip (tap a number to switch who you're editing, × to
 * remove, + to add the next) — never a bordered "feature panel". Fast, small,
 * thumb-reachable. Used on /book (one-time) and /subscription (plans).
 *
 * `people` is the live roster: [{ id, index, label, productLabel, priceLabel, filled }].
 */
export default function SessionBuilder({
  people,
  activePersonId,
  onSelect,
  onAdd,
  onRemove,
  max = PEOPLE_MAX,
  addLabel = 'Add another person',
  hideAdd = false,
}) {
  const list = Array.isArray(people) && people.length ? people : [];
  if (list.length === 0) return null;

  const count = list.length;
  const lastFilled = Boolean(list[count - 1]?.filled);
  const canAdd = count < max && lastFilled;

  // One person (the common case): no switcher at all — just the small add chip,
  // always visible so the multi-person option is discoverable up front. When the
  // caller owns the add control (e.g. the order footer), hideAdd renders nothing.
  if (count === 1) {
    if (hideAdd) return null;
    return (
      <button
        type="button"
        onClick={() => onAdd?.()}
        title={addLabel}
        className="mt-1.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-foreground/28 bg-foreground/[0.05] px-3.5 font-body text-[11px] font-black uppercase tracking-[0.1em] text-foreground/85 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] transition-colors hover:border-foreground/55 hover:bg-foreground/[0.1] hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={3} />
        {addLabel}
      </button>
    );
  }

  // 2-4 people: a compact pill strip. Not a panel.
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {list.map((person) => {
        const isActive = person.id === activePersonId;
        const filled = Boolean(person.filled);
        return (
          <span
            key={person.id}
            className={`inline-flex items-center gap-1 rounded-full border py-1 pl-1.5 pr-1 transition-colors ${
              isActive
                ? 'border-foreground/45 bg-foreground/[0.14]'
                : 'border-foreground/16 bg-background/40'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect?.(person.id)}
              title={filled && person.productLabel ? `${person.label}: ${person.productLabel}` : person.label}
              className={`inline-flex items-center gap-1 font-body text-[10px] font-black uppercase tracking-[0.08em] transition-colors ${
                isActive ? 'text-foreground' : filled ? 'text-emerald-100/90 hover:text-foreground' : 'text-foreground/55 hover:text-foreground'
              }`}
            >
              {filled && <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} aria-hidden />}
              {person.index != null ? person.index + 1 : ''}
            </button>
            <button
              type="button"
              onClick={() => onRemove?.(person.id)}
              aria-label={`Remove ${person.label}`}
              title={`Remove ${person.label}`}
              className="flex h-4 w-4 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="h-3 w-3" strokeWidth={2.4} />
            </button>
          </span>
        );
      })}
      {canAdd && !hideAdd && (
        <button
          type="button"
          onClick={() => onAdd?.()}
          title={addLabel}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-foreground/30 py-1 pl-1.5 pr-2 font-body text-[10px] font-black uppercase tracking-[0.1em] text-foreground/70 transition-colors hover:border-foreground/55 hover:text-foreground"
        >
          <Plus className="h-3 w-3" strokeWidth={3} />
          Add
        </button>
      )}
    </div>
  );
}
