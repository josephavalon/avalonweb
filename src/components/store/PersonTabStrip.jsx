import React from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import { PEOPLE_MAX, personLabel } from '../../lib/peopleState.js';

/**
 * Tab strip for switching between people on a multi-person order.
 * Used on /book Steps 1-2 and /subscription builder.
 *
 * Props:
 *   people: [{ id, name, productKey?, therapyKey? }]
 *   activePersonId: string
 *   onSelect: (id) => void
 *   onAdd: () => void
 *   onRemove: (id) => void
 *   max?: number   defaults to PEOPLE_MAX
 *   addLabel?: string   defaults to 'Add person'
 */
export default function PersonTabStrip({
  people,
  activePersonId,
  onSelect,
  onAdd,
  onRemove,
  max = PEOPLE_MAX,
  addLabel = 'Add person',
}) {
  const list = Array.isArray(people) && people.length ? people : [];
  if (list.length === 0) return null;

  const activeIndex = Math.max(0, list.findIndex((p) => p.id === activePersonId));
  const active = list[activeIndex] || list[0];
  const activeFilled = Boolean(active?.productKey || active?.therapyKey);
  const atCap = list.length >= max;
  const canAdd = !atCap && activeFilled;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {list.map((person, index) => {
        const isActive = person.id === activePersonId;
        const filled = Boolean(person.productKey || person.therapyKey);
        const label = personLabel(person, index);
        return (
          <div key={person.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect?.(person.id)}
              className={`flex h-9 items-center gap-2 rounded-full border px-3 font-body text-xs font-black uppercase tracking-[0.08em] transition-colors ${
                isActive
                  ? 'border-foreground/40 bg-foreground/[0.14] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)]'
                  : 'border-foreground/14 bg-background/38 text-foreground/68 hover:text-foreground'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                  filled
                    ? 'border-emerald-300/50 bg-emerald-400/22 text-emerald-100'
                    : 'border-foreground/30 text-foreground/40'
                }`}
                aria-hidden
              >
                {filled ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
              </span>
              {label}
            </button>
            {list.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove?.(person.id)}
                className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
                aria-label={`Remove ${label}`}
                title={`Remove ${label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => canAdd && onAdd?.()}
        disabled={!canAdd}
        title={
          atCap
            ? `House calls cap at ${max} — contact us for larger groups.`
            : !activeFilled
              ? 'Pick this person’s IV first.'
              : addLabel
        }
        className={`flex h-9 items-center gap-2 rounded-full border border-dashed px-3 font-body text-xs font-black uppercase tracking-[0.08em] transition-colors ${
          canAdd
            ? 'border-foreground/32 text-foreground/80 hover:border-foreground/55 hover:text-foreground'
            : 'cursor-not-allowed border-foreground/14 text-foreground/35'
        }`}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
        {addLabel}
      </button>
    </div>
  );
}
