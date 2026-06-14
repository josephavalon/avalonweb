import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Bell,
  BriefcaseMedical,
  ChevronDown,
  ChevronRight,
  Clock,
  Droplets,
  FlaskConical,
  Folder,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Plug,
  Plus,
  Search,
  Settings,
  Shield,
  Syringe,
  Tag,
  Trash2,
  X,
  Archive,
} from 'lucide-react';

export const EASE = [0.16, 1, 0.3, 1];
export const TODAY_STR = new Date().toISOString().slice(0, 10);

export function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date(TODAY_STR)) / 86400000);
}

export function expiryLabel(date) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days <= 0) return { text: 'Expired', cls: 'text-red-400' };
  if (days <= 7) return { text: `Exp ${days}d`, cls: 'text-red-400' };
  if (days <= 30) return { text: `Exp ${days}d`, cls: 'text-amber-400' };
  return null;
}

export function stockCls(qty, min) {
  if (qty <= 0) return 'text-red-400';
  if (qty <= min) return 'text-amber-400';
  return 'text-emerald-400';
}

export function fmt$(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

export const CAT_ICON = {
  IV: Droplets,
  Medication: FlaskConical,
  IM: Syringe,
  PPE: Shield,
  Emergency: AlertTriangle,
  Device: BriefcaseMedical,
  Sharps: Archive,
};

export const CAT_COLOR = {
  IV: 'hsl(var(--accent))',
  Medication: 'hsl(var(--foreground) / 0.70)',
  IM: 'hsl(158 64% 52%)',
  PPE: 'hsl(25 95% 65%)',
  Emergency: 'hsl(var(--destructive))',
  Device: 'hsl(198 93% 60%)',
  Sharps: 'hsl(var(--muted-foreground))',
};

export function StatusPill({ qty, minLevel }) {
  if (qty <= 0) return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20">Out of Stock</span>;
  if (qty <= minLevel) return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">Low Stock</span>;
  return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">In Stock</span>;
}

export function TagChip({ tag }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44` }}>
      {tag.name}
    </span>
  );
}

const FOLDER_MENU_ITEMS = ['Edit', 'Move to folder', 'History', 'Create Label', 'Set Alert', 'Export', 'Clone', 'Permissions', 'Delete'];
const ITEM_MENU_ITEMS = ['Edit', 'Move to folder', 'History', 'Create Label', 'Set Alert', 'Export', 'Clone', 'Delete'];

function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handle = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose(); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div ref={ref} className="fixed z-50 w-44 rounded-xl border border-foreground/10 bg-card py-1 shadow-xl" style={{ top: y, left: x }}>
      {items.map((item) => (
        <button key={item} onClick={onClose} className={`w-full px-4 py-2 text-left font-body text-xs transition-colors hover:bg-foreground/[0.06] ${item === 'Delete' ? 'text-red-400' : 'text-foreground/80'}`}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function FolderContextMenu({ x, y, onClose }) {
  return <ContextMenu x={x} y={y} items={FOLDER_MENU_ITEMS} onClose={onClose} />;
}

export function ItemContextMenu({ x, y, onClose }) {
  return <ContextMenu x={x} y={y} items={ITEM_MENU_ITEMS} onClose={onClose} />;
}

function FolderNode({ folder, allFolders, currentFolderId, onSelect, expandedFolders, toggleExpand, depth = 0 }) {
  const children = allFolders.filter((item) => item.parentId === folder.id);
  const isExpanded = expandedFolders.has(folder.id);
  const isActive = currentFolderId === folder.id;

  return (
    <div>
      <div
        className={`group flex cursor-pointer items-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors ${isActive ? 'bg-foreground/10 text-foreground' : 'text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground/90'}`}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: 8 }}
      >
        {children.length > 0 ? (
          <button onClick={(event) => { event.stopPropagation(); toggleExpand(folder.id); }} className="flex h-4 w-4 shrink-0 items-center justify-center">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button onClick={() => onSelect(folder.id)} className="flex flex-1 items-center gap-2 overflow-hidden text-left">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: folder.color }} />
          <span className="truncate font-body text-xs">{folder.name}</span>
          <span className="ml-auto shrink-0 font-body text-[10px] text-foreground/35">{folder.itemCount}</span>
        </button>
      </div>
      {isExpanded && children.map((child) => (
        <FolderNode key={child.id} folder={child} allFolders={allFolders} currentFolderId={currentFolderId} onSelect={onSelect} expandedFolders={expandedFolders} toggleExpand={toggleExpand} depth={depth + 1} />
      ))}
    </div>
  );
}

export function FolderSidebar({ folders, currentFolderId, onSelect, expandedFolders, toggleExpand, onAddFolder }) {
  const roots = folders.filter((folder) => folder.parentId === null);
  return (
    <div className="flex h-full flex-col border-r border-foreground/[0.08] bg-[hsl(var(--card))111]" style={{ width: 220 }}>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/35">Folders</span>
        <button onClick={onAddFolder} className="flex h-6 w-6 items-center justify-center rounded-md text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground/80">
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        <button
          onClick={() => onSelect(null)}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 font-body text-xs transition-colors ${currentFolderId === null ? 'bg-foreground/10 text-foreground' : 'text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground/90'}`}
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
          <span>All</span>
        </button>
        {roots.map((folder) => (
          <FolderNode key={folder.id} folder={folder} allFolders={folders} currentFolderId={currentFolderId} onSelect={onSelect} expandedFolders={expandedFolders} toggleExpand={toggleExpand} />
        ))}
      </div>
    </div>
  );
}

const NAV_TOP = [
  { id: 'items', Icon: LayoutGrid, label: 'All' },
  { id: 'tags', Icon: Tag, label: 'Tags' },
  { id: 'reports', Icon: BarChart3, label: 'Reports' },
];

const NAV_BOTTOM = [
  { id: 'integrations', Icon: Plug, label: 'Integrations', badge: true },
  { id: 'notif', Icon: Bell, label: 'Notifications' },
  { id: 'help', Icon: HelpCircle, label: 'Help' },
  { id: 'settings', Icon: Settings, label: 'Settings' },
];

export function IconNav({ section, onSection, onNotif, lowStockCount }) {
  return (
    <div className="flex h-full flex-col items-center border-r border-foreground/[0.08] bg-background py-3" style={{ width: 56 }}>
      <div className="flex flex-col items-center gap-1 pt-1">
        {NAV_TOP.map(({ id, Icon, label }) => (
          <button key={id} title={label} onClick={() => onSection(id)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${section === id ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground/70'}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <button title="Trash" onClick={() => onSection('trash')}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${section === 'trash' ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground/70'}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="my-3 w-6 border-t border-foreground/[0.08]" />

      <div className="flex flex-col items-center gap-1">
        {NAV_BOTTOM.map(({ id, Icon, label, badge }) => (
          <button key={id} title={label} onClick={() => id === 'notif' ? onNotif() : onSection(id)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${section === id ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground/70'}`}
          >
            <Icon className="h-4 w-4" />
            {badge && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />}
            {id === 'notif' && lowStockCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 font-body text-[9px] font-bold text-white">{lowStockCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <button className="flex h-6 w-9 items-center justify-center rounded-md border border-amber-400/40 bg-amber-400/10 font-body text-[9px] font-semibold uppercase tracking-wide text-amber-400 transition-colors hover:bg-amber-400/20">
          New
        </button>
      </div>
    </div>
  );
}

export function TableIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  );
}

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'updated', label: 'Updated At' },
  { key: 'qty', label: 'Quantity' },
  { key: 'price', label: 'Price' },
];

function SortMenu({ sortBy, sortDir, onChange, onToggleDir, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handle = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose(); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-foreground/10 bg-card py-1 shadow-xl">
      <div className="px-3 py-2">
        <p className="font-body text-[10px] uppercase tracking-wider text-foreground/35">Sort by</p>
      </div>
      {SORT_OPTIONS.map((option) => (
        <button key={option.key} onClick={() => { onChange(option.key); onClose(); }}
          className="flex min-h-[44px] w-full items-center justify-between px-4 py-2 font-body text-xs transition-colors hover:bg-foreground/[0.06]"
        >
          <span className={sortBy === option.key ? 'text-foreground' : 'text-foreground/60'}>{option.label}</span>
          {sortBy === option.key && <ArrowUpDown className="h-3 w-3 text-foreground/60" />}
        </button>
      ))}
      <div className="mx-3 my-1 border-t border-foreground/[0.08]" />
      <button onClick={() => { onToggleDir(); onClose(); }} className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2 font-body text-xs text-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/90">
        <ArrowUpDown className="h-3 w-3" />
        {sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
      </button>
    </div>
  );
}

export function InventoryToolbar({ layout, onLayout, sortBy, sortDir, onSort, onToggleSortDir, search, onSearch, showFolders, onToggleFolders, onAdd, onAddFolder, onImport }) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addRef = useRef(null);

  useEffect(() => {
    const handle = (event) => { if (addRef.current && !addRef.current.contains(event.target)) setShowAddMenu(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const currentSortLabel = SORT_OPTIONS.find((option) => option.key === sortBy)?.label || 'Name';

  return (
    <div className="flex min-h-[64px] shrink-0 flex-wrap items-center gap-2 border-b border-foreground/[0.08] px-3 py-3 sm:h-[52px] sm:flex-nowrap sm:px-4 sm:py-0">
      <div className="relative min-w-[180px] flex-[1_1_100%] sm:max-w-xs sm:flex-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35" />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search items..."
          className="h-11 w-full rounded-xl border border-foreground/[0.10] bg-foreground/[0.04] pl-9 pr-3 font-body text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/25 focus:outline-none sm:h-8 sm:rounded-lg sm:text-xs"
        />
      </div>

      <div className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-1.5 overflow-x-auto px-3 pb-0.5 scrollbar-none sm:mx-0 sm:ml-auto sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
        <div className="relative">
          <button onClick={() => setShowSortMenu((value) => !value)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-foreground/[0.10] bg-foreground/[0.04] px-3 font-body text-xs text-foreground/60 transition-colors hover:bg-foreground/[0.08] hover:text-foreground sm:h-8 sm:rounded-lg"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {currentSortLabel}
            <span className="text-foreground/30">{sortDir === 'asc' ? 'up' : 'down'}</span>
          </button>
          {showSortMenu && <SortMenu sortBy={sortBy} sortDir={sortDir} onChange={onSort} onToggleDir={onToggleSortDir} onClose={() => setShowSortMenu(false)} />}
        </div>

        <div className="flex h-11 shrink-0 items-center rounded-xl border border-foreground/[0.10] bg-foreground/[0.04] p-0.5 sm:h-8 sm:rounded-lg">
          {[['grid', LayoutGrid], ['list', ListIcon], ['table', TableIcon]].map(([id, Icon]) => (
            <button key={id} onClick={() => onLayout(id)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:h-7 sm:w-7 sm:rounded-md ${layout === id ? 'bg-foreground/15 text-foreground' : 'text-foreground/35 hover:text-foreground/70'}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <button onClick={onToggleFolders}
          className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 font-body text-[10px] uppercase tracking-[0.12em] transition-colors sm:h-8 sm:rounded-lg sm:px-2.5 sm:normal-case sm:tracking-normal ${showFolders ? 'border-foreground/[0.10] text-foreground/50 hover:text-foreground/80' : 'border-foreground/25 text-foreground'}`}
        >
          <Folder className="h-3.5 w-3.5" />
          {showFolders ? 'Hide' : 'Show'}
        </button>

        <div ref={addRef} className="relative flex">
          <button onClick={onAdd}
            className="flex h-11 items-center gap-1.5 rounded-l-xl bg-foreground px-3.5 font-body text-xs font-semibold uppercase tracking-wide text-background transition-colors hover:bg-foreground/90 sm:h-8 sm:rounded-l-lg sm:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
          <button onClick={() => setShowAddMenu((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-r-xl border-l border-background/20 bg-foreground text-background transition-colors hover:bg-foreground/90 sm:h-8 sm:w-7 sm:rounded-r-lg"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-40 rounded-xl border border-foreground/10 bg-card py-1 shadow-xl">
              {[['Item', onAdd], ['Import', onImport], ['Folder', onAddFolder]].map(([label, fn]) => (
                <button key={label} onClick={() => { fn?.(); setShowAddMenu(false); }}
                  className="w-full px-4 py-2 text-left font-body text-xs text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatsBar({ items, currentFolderId }) {
  const list = currentFolderId ? items.filter((item) => item.folderId === currentFolderId) : items;
  const totalVal = list.reduce((sum, item) => sum + item.qty * item.price, 0);
  const lowCount = list.filter((item) => item.qty > 0 && item.qty <= item.minLevel).length;
  const outCount = list.filter((item) => item.qty <= 0).length;
  const expCount = list.filter((item) => { const days = daysUntil(item.expirationDate); return days !== null && days <= 7; }).length;

  return (
    <div className="flex shrink-0 items-center gap-6 border-b border-foreground/[0.08] px-5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-body text-[10px] uppercase tracking-widest text-foreground/35">Items</span>
        <span className="font-heading text-base text-foreground">{list.length}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-body text-[10px] uppercase tracking-widest text-foreground/35">Value</span>
        <span className="font-heading text-base text-foreground">{fmt$(totalVal)}</span>
      </div>
      {lowCount > 0 && (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-body text-xs text-amber-400">{lowCount} low stock</span>
        </div>
      )}
      {outCount > 0 && (
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="font-body text-xs text-red-400">{outCount} out of stock</span>
        </div>
      )}
      {expCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-red-400" />
          <span className="font-body text-xs text-red-400">{expCount} expiring soon</span>
        </div>
      )}
    </div>
  );
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'new', label: 'New' },
];

export function FilterBar({ items, tags, filterStatus, onFilterStatus, filterTag, onFilterTag, filterCategory, onFilterCategory }) {
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const activeCount = (filterStatus !== 'all' ? 1 : 0) + (filterTag ? 1 : 0) + (filterCategory ? 1 : 0);

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-foreground/[0.08] px-3 py-2 scrollbar-none sm:px-4">
      <div className="flex items-center gap-1">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => onFilterStatus(key)}
            className={`min-h-[44px] whitespace-nowrap rounded-full px-3 font-body text-[10px] uppercase tracking-[0.1em] transition-colors sm:min-h-0 sm:px-2.5 sm:py-1 sm:normal-case sm:tracking-normal ${
              filterStatus === key
                ? 'bg-foreground text-background'
                : 'border border-foreground/[0.10] text-foreground/50 hover:border-foreground/25 hover:text-foreground/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tags.length > 0 || categories.length > 0) && <div className="h-4 w-px shrink-0 bg-foreground/10" />}

      {tags.length > 0 && (
        <select value={filterTag} onChange={(event) => onFilterTag(event.target.value)}
          className={`h-11 shrink-0 rounded-full border px-3 font-body text-[10px] uppercase tracking-[0.1em] focus:outline-none sm:h-auto sm:px-2.5 sm:py-1 sm:normal-case sm:tracking-normal ${filterTag ? 'border-foreground/40 bg-foreground/10 text-foreground' : 'border-foreground/[0.10] bg-transparent text-foreground/50'}`}
          style={{ appearance: 'none' }}
        >
          <option value="">All Tags</option>
          {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
      )}

      {categories.length > 0 && (
        <select value={filterCategory} onChange={(event) => onFilterCategory(event.target.value)}
          className={`h-11 shrink-0 rounded-full border px-3 font-body text-[10px] uppercase tracking-[0.1em] focus:outline-none sm:h-auto sm:px-2.5 sm:py-1 sm:normal-case sm:tracking-normal ${filterCategory ? 'border-foreground/40 bg-foreground/10 text-foreground' : 'border-foreground/[0.10] bg-transparent text-foreground/50'}`}
          style={{ appearance: 'none' }}
        >
          <option value="">All Categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      )}

      {activeCount > 0 && (
        <button
          onClick={() => { onFilterStatus('all'); onFilterTag(''); onFilterCategory(''); }}
          className="ml-1 flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-foreground/[0.10] px-3 font-body text-[10px] uppercase tracking-[0.1em] text-foreground/40 transition-colors hover:border-red-400/40 hover:text-red-400 sm:min-h-0 sm:px-2.5 sm:py-1 sm:normal-case sm:tracking-normal"
        >
          <X className="h-2.5 w-2.5" /> Clear ({activeCount})
        </button>
      )}
    </div>
  );
}

export function Breadcrumb({ folders, currentFolderId, onNavigate }) {
  if (!currentFolderId) return null;
  const path = [];
  let current = folders.find((folder) => folder.id === currentFolderId);
  while (current) {
    path.unshift(current);
    current = folders.find((folder) => folder.id === current.parentId);
  }
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-foreground/[0.08] px-5 py-2">
      <button onClick={() => onNavigate(null)} className="font-body text-[11px] text-foreground/40 transition-colors hover:text-foreground/70">All</button>
      {path.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <ChevronRight className="h-3 w-3 text-foreground/25" />
          <button onClick={() => onNavigate(folder.id)}
            className={`font-body text-[11px] transition-colors ${index === path.length - 1 ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
          >
            {folder.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export function FolderCard({ folder, items, onClick, onMenuOpen }) {
  const count = items.filter((item) => item.folderId === folder.id).length;
  return (
    <div onClick={() => onClick(folder.id)}
      className="group relative cursor-pointer rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4 transition-all hover:border-foreground/20 hover:bg-foreground/[0.06]"
    >
      <button
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100 hover:bg-foreground/10"
        onClick={(event) => { event.stopPropagation(); onMenuOpen(folder.id, event); }}
      >
        <MoreHorizontal className="h-3.5 w-3.5 text-foreground/50" />
      </button>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: folder.color + '22' }}>
        <FolderOpen className="h-5 w-5" style={{ color: folder.color }} />
      </div>
      <p className="truncate font-body text-sm font-semibold text-foreground">{folder.name}</p>
      <p className="mt-0.5 font-body text-xs text-foreground/40">{count} item{count !== 1 ? 's' : ''}</p>
    </div>
  );
}
