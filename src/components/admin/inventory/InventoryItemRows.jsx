import { Bell, Check, Edit, MoreHorizontal, MoveRight, Package, Plus } from 'lucide-react';
import { CAT_COLOR, CAT_ICON, StatusPill, TagChip, expiryLabel, fmt$, stockCls } from './InventoryChrome.jsx';

export function ItemGridCard({ item, isSelected, onSelect, onOpen, onMenuOpen }) {
  const Icon = CAT_ICON[item.category] || Package;
  const color = CAT_COLOR[item.category] || 'hsl(220 9% 46%)';
  const exp = expiryLabel(item.expirationDate);

  return (
    <div className="group relative cursor-pointer rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] transition-all hover:border-foreground/20 hover:shadow-lg hover:shadow-black/20">
      <div className={`absolute left-2 top-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          onClick={(event) => { event.stopPropagation(); onSelect(item.id); }}
          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${isSelected ? 'border-foreground bg-foreground text-background' : 'border-foreground/40 bg-background/80 text-transparent hover:border-foreground/70'}`}
        >
          <Check className="h-3 w-3" />
        </button>
      </div>

      {item.isNew && (
        <div className="absolute right-2 top-2 z-10 rounded-full bg-amber-400 px-2 py-0.5 font-body text-[9px] font-bold uppercase tracking-wide text-black">New</div>
      )}

      <div
        className="relative flex aspect-square w-full items-center justify-center rounded-t-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}20 0%, ${color}08 100%)` }}
        onClick={() => onOpen(item)}
      >
        <Icon className="h-12 w-12 opacity-50" style={{ color }} />
        {item.refrigeration && (
          <div className="absolute bottom-2 right-2 rounded-md border border-sky-400/20 bg-background/80 px-1.5 py-0.5 font-body text-[9px] font-semibold text-sky-300 backdrop-blur-sm">cold</div>
        )}
      </div>

      <div className="absolute bottom-[72px] left-0 right-0 translate-y-1 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        <div className="mx-2 flex items-center justify-around rounded-xl border border-foreground/10 bg-card/95 p-1.5 backdrop-blur-sm">
          {[[Plus, 'Add sub-item'], [Edit, 'Edit'], [Bell, 'Set alert'], [MoveRight, 'Move'], [MoreHorizontal, 'More']].map(([Icon2, title]) => (
            <button key={title} title={title}
              onClick={(event) => { event.stopPropagation(); if (title === 'More') onMenuOpen(item.id, event); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <Icon2 className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-3 pt-2" onClick={() => onOpen(item)}>
        <p className="truncate font-body text-xs font-semibold text-foreground">{item.name}</p>
        <div className="mt-1 flex items-center justify-between">
          <span className={`font-body text-xs font-semibold ${stockCls(item.qty, item.minLevel)}`}>{item.qty} {item.unit}</span>
          {exp && <span className={`font-body text-[10px] ${exp.cls}`}>{exp.text}</span>}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-body text-[10px] text-foreground/35">{item.sortlyId}</span>
          <span className="font-body text-[10px] text-foreground/50">{fmt$(item.price)}</span>
        </div>
      </div>
    </div>
  );
}

export function ItemListRow({ item, tags, isSelected, onSelect, onOpen, onMenuOpen }) {
  const Icon = CAT_ICON[item.category] || Package;
  const color = CAT_COLOR[item.category] || 'hsl(220 9% 46%)';
  const exp = expiryLabel(item.expirationDate);
  const itemTags = tags.filter((tag) => item.tags.includes(tag.id));

  return (
    <div className="group flex cursor-pointer items-center gap-4 border-b border-foreground/[0.06] px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
      <button onClick={(event) => { event.stopPropagation(); onSelect(item.id); }}
        className={`shrink-0 flex h-4 w-4 items-center justify-center rounded border transition-colors ${isSelected ? 'border-foreground bg-foreground text-background' : 'border-foreground/25 text-transparent hover:border-foreground/50'}`}
      >
        <Check className="h-2.5 w-2.5" />
      </button>

      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: color + '18' }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden" onClick={() => onOpen(item)}>
        <div className="flex items-center gap-2">
          <span className="truncate font-body text-sm font-semibold text-foreground">{item.name}</span>
          {item.isNew && <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 font-body text-[9px] font-bold uppercase text-amber-400">New</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-body text-[10px] text-foreground/35">{item.sortlyId}</span>
          <span className="text-foreground/20">.</span>
          <span className="font-body text-[10px] text-foreground/35">{item.sku}</span>
          {itemTags.slice(0, 2).map((tag) => <TagChip key={tag.id} tag={tag} />)}
        </div>
      </div>

      <div className="w-24 shrink-0 text-right" onClick={() => onOpen(item)}>
        <StatusPill qty={item.qty} minLevel={item.minLevel} />
        <p className={`mt-0.5 font-body text-xs ${stockCls(item.qty, item.minLevel)}`}>{item.qty} {item.unit}</p>
      </div>

      <div className="w-20 shrink-0 text-right" onClick={() => onOpen(item)}>
        <p className="font-body text-xs text-foreground/70">{fmt$(item.price)}</p>
        {exp && <p className={`font-body text-[10px] ${exp.cls}`}>{exp.text}</p>}
      </div>

      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={(event) => { event.stopPropagation(); onMenuOpen(item.id, event); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ItemTableRow({ item, isSelected, onSelect, onOpen, onMenuOpen }) {
  const Icon = CAT_ICON[item.category] || Package;
  const color = CAT_COLOR[item.category] || 'hsl(220 9% 46%)';
  const exp = expiryLabel(item.expirationDate);

  return (
    <tr className="group border-b border-foreground/[0.05] transition-colors hover:bg-foreground/[0.03]">
      <td className="w-10 px-3 py-2.5">
        <button onClick={() => onSelect(item.id)}
          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${isSelected ? 'border-foreground bg-foreground text-background' : 'border-foreground/25 text-transparent hover:border-foreground/50'}`}
        >
          <Check className="h-2.5 w-2.5" />
        </button>
      </td>
      <td className="w-10 px-2 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: color + '18' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </td>
      <td className="cursor-pointer px-3 py-2.5" onClick={() => onOpen(item)}>
        <div className="flex items-center gap-2">
          <span className="font-body text-xs font-semibold text-foreground">{item.name}</span>
          {item.isNew && <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 font-body text-[9px] font-bold uppercase text-amber-400">New</span>}
        </div>
        <span className="font-body text-[10px] text-foreground/35">{item.sortlyId}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`font-body text-xs font-semibold ${stockCls(item.qty, item.minLevel)}`}>{item.qty}</span>
        <span className="ml-1 font-body text-[10px] text-foreground/40">{item.unit}</span>
      </td>
      <td className="px-3 py-2.5 font-body text-xs text-foreground/70">{fmt$(item.price)}</td>
      <td className="px-3 py-2.5"><StatusPill qty={item.qty} minLevel={item.minLevel} /></td>
      <td className="px-3 py-2.5">
        {exp ? <span className={`font-body text-[10px] ${exp.cls}`}>{exp.text}</span> : <span className="font-body text-[10px] text-foreground/25">-</span>}
      </td>
      <td className="w-10 px-2 py-2.5">
        <button onClick={(event) => { event.stopPropagation(); onMenuOpen(item.id, event); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 text-foreground/40 transition-all group-hover:opacity-100 hover:bg-foreground/[0.08] hover:text-foreground"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
