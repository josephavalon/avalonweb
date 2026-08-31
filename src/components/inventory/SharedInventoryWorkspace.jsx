import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Grid2X2,
  List,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

function cents(value) {
  try {
    const amount = BigInt(String(value || '0'));
    const sign = amount < BigInt(0) ? '-' : '';
    const absolute = amount < BigInt(0) ? -amount : amount;
    return `${sign}$${(absolute / BigInt(100)).toLocaleString()}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
  } catch { return '—'; }
}

function isExpiring(date, days = 30) {
  if (!date) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && time <= Date.now() + days * 86400000;
}

function isExpired(date) {
  if (!date) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && time < Date.parse(new Date().toISOString().slice(0, 10));
}

function quantityLabel(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? number.toLocaleString(undefined, { maximumFractionDigits: 3 })
    : String(value || '0');
}

function InventoryCard({ item, mode, onUseOne, onRequestRestock, onAdjust, onTransfer, onSetPar, actionsDisabled, restockPending }) {
  const expiring = isExpiring(item.expiresOn);
  const expired = isExpired(item.expiresOn);
  return (
    <article className="rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.035] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.07]">
            <Package className="h-5 w-5 text-foreground/60" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
            <p className="mt-0.5 truncate text-[11px] text-foreground/45">
              {[item.variantName, item.sku ? `SKU ${item.sku}` : '', item.barcode ? `Barcode ${item.barcode}` : ''].filter(Boolean).join(' · ') || 'Avalon inventory'}
            </p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${expired ? 'border-red-500/25 bg-red-500/10 text-red-700' : item.lowStock ? 'border-amber-500/25 bg-amber-500/10 text-amber-700' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700'}`}>
          {expired ? 'Expired' : item.lowStock ? 'Restock' : 'Ready'}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-background/55 p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/35">On hand</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{quantityLabel(item.quantityOnHand)}</p>
          <p className="text-[10px] text-foreground/45">{item.unit}</p>
        </div>
        <div className="rounded-2xl bg-background/55 p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/35">Target</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{quantityLabel(item.parQuantity)}</p>
          <p className="text-[10px] text-foreground/45">restock at {quantityLabel(item.reorderQuantity)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] text-foreground/50">
        {item.lotCode && <p>Lot <span className="font-semibold text-foreground/70">{item.lotCode}</span></p>}
        {item.expiresOn && (
          <p className={expired ? 'font-semibold text-red-700' : expiring ? 'font-semibold text-amber-700' : ''}>
            {expired ? 'Expired' : expiring ? 'Check expiry' : 'Expires'} · {item.expiresOn}
          </p>
        )}
        {mode === 'admin' && (
          <p>Unit cost <span className="font-semibold text-foreground/70">{cents(item.unitCostCents)}</span></p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {mode === 'nurse' ? (
          <>
            <button type="button" onClick={() => onUseOne?.(item)} disabled={actionsDisabled || expired || Number(item.quantityOnHand) < 1} className="min-h-10 flex-1 rounded-full bg-foreground px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-35">Used 1</button>
            <button type="button" onClick={() => onRequestRestock?.(item)} disabled={actionsDisabled || restockPending} className="min-h-10 flex-1 rounded-full border border-foreground/12 px-3 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-35">{restockPending ? 'Requested' : 'Restock'}</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onAdjust?.(item)} className="min-h-10 flex-1 rounded-full border border-foreground/12 px-3 text-[10px] font-bold uppercase tracking-[0.12em]">Movement</button>
            <button type="button" onClick={() => onTransfer?.(item)} disabled={Number(item.quantityOnHand) <= 0} className="min-h-10 flex-1 rounded-full border border-foreground/12 px-3 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-35">Transfer</button>
            <button type="button" onClick={() => onSetPar?.(item)} className="min-h-10 flex-1 rounded-full border border-foreground/12 px-3 text-[10px] font-bold uppercase tracking-[0.12em]">Par</button>
          </>
        )}
      </div>
    </article>
  );
}

export default function SharedInventoryWorkspace({
  mode = 'admin',
  title,
  subtitle,
  locations = [],
  selectedLocationId = '',
  onSelectLocation,
  items = [],
  loading = false,
  onRefresh,
  onUseOne,
  onRequestRestock,
  onAdjust,
  onTransfer,
  onSetPar,
  headerActions,
  sourceMessage,
  actionsDisabled = false,
  pendingRestockKeys = new Set(),
}) {
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState('grid');
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.name} ${item.variantName || ''} ${item.sku || ''} ${item.barcode || ''} ${item.lotCode || ''}`.toLowerCase().includes(needle));
  }, [items, search]);
  const metrics = useMemo(() => ({
    lines: items.length,
    units: items.reduce((sum, item) => sum + Number(item.quantityOnHand || 0), 0),
    low: new Set(items.filter((item) => item.lowStock).map((item) => `${item.itemId}:${item.variantId || ''}`)).size,
    expiring: items.filter((item) => isExpiring(item.expiresOn)).length,
  }), [items]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/50">
            <ShieldCheck className="h-3.5 w-3.5" /> Typed inventory source
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/55">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {headerActions}
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-45">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {sourceMessage && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3 text-xs leading-relaxed text-amber-800">{sourceMessage}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Item lines', metrics.lines, Boxes],
          ['Units on hand', quantityLabel(metrics.units), Package],
          ['Restock', metrics.low, AlertTriangle],
          ['Expiry check', metrics.expiring, ShieldCheck],
        ].map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
            <div className="flex items-center justify-between text-foreground/40"><p className="text-[9px] font-bold uppercase tracking-[0.14em]">{label}</p><Icon className="h-4 w-4" /></div>
            <p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {locations.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Inventory locations">
          {locations.map((location) => (
            <button key={location.id} type="button" onClick={() => onSelectLocation?.(location.id)} className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] ${selectedLocationId === location.id ? 'border-foreground bg-foreground text-background' : 'border-foreground/12 bg-foreground/[0.035] text-foreground/60'}`}>
              {location.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-3 sm:flex-row sm:items-center">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-foreground/10 bg-background/65 px-3">
          <Search className="h-4 w-4 text-foreground/35" />
          <span className="sr-only">Search inventory</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, SKU, or lot" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30" />
        </label>
        <div className="flex rounded-xl border border-foreground/10 bg-background/65 p-1">
          <button type="button" onClick={() => setLayout('grid')} aria-label="Grid view" className={`flex h-9 w-10 items-center justify-center rounded-lg ${layout === 'grid' ? 'bg-foreground text-background' : 'text-foreground/45'}`}><Grid2X2 className="h-4 w-4" /></button>
          <button type="button" onClick={() => setLayout('list')} aria-label="List view" className={`flex h-9 w-10 items-center justify-center rounded-lg ${layout === 'list' ? 'bg-foreground text-background' : 'text-foreground/45'}`}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {filtered.length ? (
        <div className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-3'}>
          {filtered.map((item) => (
            <InventoryCard
              key={`${item.itemId}:${item.variantId || ''}:${item.lotId || ''}`}
              item={item}
              mode={mode}
              onUseOne={onUseOne}
              onRequestRestock={onRequestRestock}
              onAdjust={onAdjust}
              onTransfer={onTransfer}
              onSetPar={onSetPar}
              actionsDisabled={actionsDisabled}
              restockPending={pendingRestockKeys.has(`${item.itemId}:${item.variantId || ''}`)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-foreground/15 py-16 text-center">
          <Package className="mx-auto h-8 w-8 text-foreground/25" />
          <p className="mt-4 text-sm font-semibold">{search ? 'No matching inventory' : 'No stock assigned here yet'}</p>
          <p className="mt-1 text-xs text-foreground/45">{mode === 'nurse' ? 'Request a kit assignment or restock from Avalon Operations.' : 'Create a location and receive or transfer stock into it.'}</p>
        </div>
      )}
    </div>
  );
}
