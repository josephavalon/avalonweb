import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { QRCodeSVG } from 'qrcode.react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useDropzone } from 'react-dropzone';
import AdminLayout from '@/layouts/AdminLayout';

const INVENTORY_CLINICAL_NOTE = 'Inventory records support operations only. Clinical use follows approved protocols.';
import {
  Breadcrumb,
  CAT_COLOR,
  CAT_ICON,
  EASE,
  FilterBar,
  FolderCard,
  FolderContextMenu,
  FolderSidebar,
  IconNav,
  InventoryToolbar,
  ItemContextMenu,
  StatusPill,
  StatsBar,
  TODAY_STR,
  TagChip,
  daysUntil,
  expiryLabel,
  fmt$,
  stockCls,
} from '@/components/admin/inventory/InventoryChrome.jsx';
import { ItemGridCard, ItemListRow, ItemTableRow } from '@/components/admin/inventory/InventoryItemRows.jsx';
import {
  Package, Tag,
  Bell, ChevronLeft, ChevronRight,
  Plus, Upload, FolderPlus, Trash2, Edit,
  MoreHorizontal, X, Check, ArrowLeft, Download, Printer,
  AlertTriangle, AlertCircle, Clock,
  ArrowUpDown, RefreshCw, User, FileText, TrendingUp,
  MoveRight, Barcode, Image as ImageIcon, Minus, Copy, Sparkles, Activity, Sliders,
} from 'lucide-react';

// ─── Notifications panel ──────────────────────────────────────────────────────
function NotificationsPanel({ items, onClose }) {
  const alerts = items.filter(i => {
    const n = daysUntil(i.expirationDate);
    return i.qty <= i.minLevel || (n !== null && n <= 7);
  });
  return (
    <motion.div initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }} transition={{ ease:EASE, duration:0.3 }}
      className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-foreground/[0.08] bg-card shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-foreground/[0.08] px-5 py-4">
        <h2 className="font-heading text-base text-foreground">Notifications</h2>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {alerts.length === 0 && (
          <p className="mt-8 text-center font-body text-xs text-foreground/35">No active alerts.</p>
        )}
        {alerts.map(item => {
          const n = daysUntil(item.expirationDate);
          const isLow = item.qty <= item.minLevel;
          const isExp = n !== null && n <= 7;
          return (
            <div key={item.id} className="mb-2 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] p-3">
              <div className="flex items-start gap-2">
                {isExp ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
                <div>
                  <p className="font-body text-xs font-semibold text-foreground">{item.name}</p>
                  {isLow && <p className="font-body text-[10px] text-amber-400">Stock low: {item.qty} / min {item.minLevel}</p>}
                  {isExp && <p className="font-body text-[10px] text-red-400">{n <= 0 ? 'Expired' : `Expires in ${n} day${n !== 1 ? 's' : ''}`}</p>}
                  <p className="font-body text-[10px] text-foreground/30">{item.sortlyId}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Add Folder modal ─────────────────────────────────────────────────────────
function AddFolderModal({ folders, onClose, onSave }) {
  const [name,     setName]     = useState('');
  const [parentId, setParentId] = useState(null);
  const [color,    setColor]    = useState('hsl(var(--chart-1))');
  const COLORS = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--success))','hsl(var(--warning))','hsl(var(--destructive))','hsl(var(--chart-3))','hsl(var(--accent))','hsl(var(--muted-foreground))'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Add folder" onClick={onClose}>
      <motion.div initial={{ scale:0.96, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.96, opacity:0 }} transition={{ ease:EASE, duration:0.2 }}
        className="w-80 rounded-2xl border border-foreground/10 bg-card p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-base text-foreground">Add Folder</h2>
          <button onClick={onClose} aria-label="Close add folder" className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Folder name"
              className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Parent Folder</label>
            <select value={parentId || ''} onChange={e => setParentId(e.target.value || null)}
              className="w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2.5 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
            >
              <option value="">None (root)</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-foreground/60 scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-foreground/[0.10] py-2.5 font-body text-xs text-foreground/60 transition-colors hover:bg-foreground/[0.05]">Cancel</button>
          <button
            onClick={() => { if (name.trim()) { onSave({ name: name.trim(), parentId, color }); onClose(); } }}
            className="flex-1 rounded-xl bg-foreground py-2.5 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            Add
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Field row helper ────────────────────────────────────────────────────────
function FieldRow({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">{label}</label>
      {children}
    </div>
  );
}

// ─── Barcode SVG (visual-only Code128 style) ─────────────────────────────────
const BarcodeSVG = React.forwardRef(function BarcodeSVG({ value = '', width = 200, height = 56 }, ref) {
  const bars = useMemo(() => {
    let seed = value.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    function rand() { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 0) / 0xffffffff; }
    const arr = [];
    let x = 8;
    arr.push({ x, w: 2, dark: true }); x += 3;
    arr.push({ x, w: 1, dark: true }); x += 2;
    arr.push({ x, w: 2, dark: true }); x += 3;
    for (let i = 0; i < 36; i++) {
      const w = rand() > 0.6 ? 2 : 1;
      arr.push({ x, w, dark: i % 2 === 0 });
      x += w + (rand() > 0.5 ? 2 : 1);
    }
    arr.push({ x, w: 2, dark: true }); x += 3;
    arr.push({ x, w: 1, dark: true }); x += 2;
    arr.push({ x, w: 2, dark: true });
    return arr;
  }, [value]);
  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-foreground">
      {bars.map((b, i) => b.dark && (
        <rect key={i} x={b.x} y={0} width={b.w} height={height - 16} fill="currentColor" />
      ))}
      <text x={width / 2} y={height - 2} textAnchor="middle" fontSize="8" fill="currentColor" fontFamily="monospace" opacity="0.5">
        {value}
      </text>
    </svg>
  );
});

// ─── Metric tile ──────────────────────────────────────────────────────────────
function MetricTile({ label, value, unit, sub, accent, onPlus, onMinus, onAlert, showAlert }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4 min-w-0">
      <span className="font-body text-[10px] uppercase tracking-wider text-foreground/35 truncate">{label}</span>
      <div className="flex items-end gap-1">
        <span className={`font-heading text-2xl leading-none truncate ${accent || 'text-foreground'}`}>{value}</span>
        {unit && <span className="mb-0.5 font-body text-xs text-foreground/40 shrink-0">{unit}</span>}
      </div>
      {sub && <span className="font-body text-[10px] text-foreground/40 truncate">{sub}</span>}
      {(onPlus || onMinus || onAlert) && (
        <div className="mt-1.5 flex items-center gap-1">
          {onMinus && (
            <button onClick={onMinus} className="flex h-6 w-6 items-center justify-center rounded-lg border border-foreground/[0.10] text-foreground/50 transition-colors hover:bg-foreground/[0.08] hover:text-foreground">
              <Minus className="h-3 w-3" />
            </button>
          )}
          {onPlus && (
            <button onClick={onPlus} className="flex h-6 w-6 items-center justify-center rounded-lg border border-foreground/[0.10] text-foreground/50 transition-colors hover:bg-foreground/[0.08] hover:text-foreground">
              <Plus className="h-3 w-3" />
            </button>
          )}
          {onAlert && (
            <button onClick={onAlert} title="Set alert" className="flex h-6 w-6 items-center justify-center rounded-lg border border-foreground/[0.10] transition-colors hover:bg-foreground/[0.08]">
              <Bell className={`h-3 w-3 ${showAlert ? 'text-amber-400' : 'text-foreground/35'}`} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Item modal (centered, quick form) ───────────────────────────────────
const UNITS = ['units','bags','vials','kits','sets','boxes','syringes','masks','bottles'];

function AddItemModal({ folders, onClose, onSave, onShowAll }) {
  const [name,        setName]        = useState('');
  const [qty,         setQty]         = useState('');
  const [unit,        setUnit]        = useState('units');
  const [minLvl,      setMinLvl]      = useState('');
  const [price,       setPrice]       = useState('');
  const [folderId,    setFolderId]    = useState('');
  const [photos,      setPhotos]      = useState([]);
  const [hasVariants, setHasVariants] = useState(false);

  function handleSave() {
    if (!name.trim() || !qty) return;
    onSave({
      id: `item-${Date.now()}`,
      sortlyId: `AVOT${String(Math.floor(Math.random() * 9000) + 1000)}`,
      name: name.trim(), sku: '', category: 'IV',
      folderId: folderId || null,
      qty: Number(qty), unit,
      minLevel: Number(minLvl) || 0,
      price: Number(price) || 0,
      supplier: '', expirationDate: null, refrigeration: false,
      notes: '', tags: [], photos, variants: [], customFields: {},
      isNew: true, updatedAt: TODAY_STR,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }} transition={{ ease: EASE, duration: 0.2 }}
        className="w-[440px] max-h-[90vh] overflow-y-auto rounded-2xl border border-foreground/10 bg-card p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-base text-foreground">Add Item</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4">
          <PhotoDropzone photos={photos} onChange={setPhotos} />
        </div>
        <div className="space-y-3">
          <FieldRow label="Name *">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Item name"
              className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
            />
          </FieldRow>
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldRow label="Quantity *">
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" min="0"
                  className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
                />
              </FieldRow>
            </div>
            <div className="flex-1">
              <FieldRow label="Unit">
                <select value={unit} onChange={e => setUnit(e.target.value)}
                  className="w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2.5 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
                >
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </FieldRow>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldRow label="Min Level">
                <input type="number" value={minLvl} onChange={e => setMinLvl(e.target.value)} placeholder="0" min="0"
                  className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
                />
              </FieldRow>
            </div>
            <div className="flex-1">
              <FieldRow label="Price ($)">
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" min="0" step="0.01"
                  className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
                />
              </FieldRow>
            </div>
          </div>
          <FieldRow label="Add to Folder">
            <select value={folderId} onChange={e => setFolderId(e.target.value)}
              className="w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2.5 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
            >
              <option value="">No folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FieldRow>
          <div className="flex items-center justify-between rounded-lg border border-foreground/[0.08] px-3 py-2.5">
            <span className="font-body text-sm text-foreground/70">This item has variants</span>
            <button onClick={() => setHasVariants(v => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${hasVariants ? 'bg-amber-500' : 'bg-foreground/20'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hasVariants ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onShowAll} className="flex-1 rounded-xl border border-foreground/[0.10] py-2.5 font-body text-xs text-foreground/60 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/80">
            Show All Fields
          </button>
          <button onClick={handleSave} disabled={!name.trim() || !qty}
            className="flex-1 rounded-xl bg-foreground py-2.5 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
          >
            Add Item
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Photo dropzone ───────────────────────────────────────────────────────────
const MAX_PHOTOS = 5;

function PhotoDropzone({ photos = [], onChange }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: MAX_PHOTOS - photos.length,
    disabled: photos.length >= MAX_PHOTOS,
    onDrop: (accepted) => {
      const news = accepted.map((file, i) => ({
        id:        'ph_' + Date.now() + i,
        url:       URL.createObjectURL(file),
        file,
        isPrimary: photos.length === 0 && i === 0,
      }));
      onChange([...photos, ...news]);
    },
  });

  function remove(id) {
    const next = photos.filter(p => p.id !== id);
    // If we removed the primary, auto-set first remaining as primary
    if (next.length > 0 && !next.some(p => p.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
  }

  function setPrimary(id) {
    onChange(photos.map(p => ({ ...p, isPrimary: p.id === id })));
  }

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map(p => (
            <div key={p.id} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-foreground/[0.12]">
              <img src={p.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              {p.isPrimary && (
                <span className="absolute bottom-0 left-0 right-0 bg-amber-400/80 py-0.5 text-center font-body text-[9px] font-bold uppercase text-black">
                  Primary
                </span>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                {!p.isPrimary && (
                  <button onClick={() => setPrimary(p.id)}
                    className="rounded px-2 py-0.5 font-body text-[9px] font-semibold text-white bg-white/20 hover:bg-white/30">
                    Set Primary
                  </button>
                )}
                <button onClick={() => remove(p.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {photos.length < MAX_PHOTOS && (
        <div {...getRootProps()}
          className={`flex h-20 cursor-pointer items-center justify-center rounded-xl border border-dashed transition-colors
            ${isDragActive
              ? 'border-foreground/40 bg-foreground/[0.08]'
              : 'border-foreground/[0.12] bg-foreground/[0.02] hover:bg-foreground/[0.04]'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <ImageIcon className="h-5 w-5 text-foreground/25" />
            <span className="font-body text-[11px] text-foreground/30">
              {isDragActive ? 'Drop to add' : photos.length === 0 ? 'Add Photo' : `Add More (${photos.length}/${MAX_PHOTOS})`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Barcode card (download + print) ─────────────────────────────────────────
function BarcodeCard({ item }) {
  const svgRef  = useRef(null);
  const qrRef   = useRef(null);
  const value   = item.sku || item.sortlyId || 'AVOT0000';
  const [mode, setMode] = useState('barcode'); // 'barcode' | 'qr'

  function handleDownload() {
    if (mode === 'barcode') {
      const node = svgRef.current;
      if (!node) return;
      const clone = node.cloneNode(true);
      clone.setAttribute('style', 'background:white;color:hsl(var(--background))');
      clone.querySelectorAll('rect').forEach(r => r.setAttribute('fill', 'hsl(var(--background))'));
      clone.querySelectorAll('text').forEach(t => t.setAttribute('fill', 'hsl(var(--background))'));
      const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `barcode-${value}.svg`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const node = qrRef.current;
      if (!node) return;
      const clone = node.cloneNode(true);
      clone.setAttribute('style', 'background:white');
      const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `qr-${value}.svg`; a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handlePrint() {
    let svgHTML = '';
    if (mode === 'barcode') {
      const node = svgRef.current;
      if (!node) return;
      const clone = node.cloneNode(true);
      clone.setAttribute('style', 'color:hsl(var(--background))');
      clone.querySelectorAll('rect').forEach(r => r.setAttribute('fill', 'hsl(var(--background))'));
      clone.querySelectorAll('text').forEach(t => t.setAttribute('fill', 'hsl(var(--background))'));
      svgHTML = clone.outerHTML;
    } else {
      const node = qrRef.current;
      if (!node) return;
      const clone = node.cloneNode(true);
      clone.setAttribute('style', 'background:white');
      svgHTML = clone.outerHTML;
    }
    const w = window.open('', '_blank', 'width=400,height=300');
    w.document.write(`<!DOCTYPE html><html><head>
<style>
  @page { size: 62mm 29mm; margin: 0; }
  body { margin: 0; padding: 3mm; display: flex; flex-direction: column; align-items: center;
         justify-content: center; width: 62mm; height: 29mm; background: white; box-sizing: border-box; }
  svg { width: 54mm; }
  .name { font-family: monospace; font-size: 7pt; text-align: center; margin-top: 1mm;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 54mm; }
</style></head><body>
  ${svgHTML}
  <div class="name">${item.name}</div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }<\/script>
</body></html>`);
    w.document.close();
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg border border-foreground/[0.08] p-0.5">
          {[['barcode', 'Barcode'], ['qr', 'QR']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 font-body text-[10px] uppercase tracking-wider transition-colors ${mode === m ? 'bg-foreground/10 text-foreground' : 'text-foreground/35 hover:text-foreground/60'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleDownload} title="Download SVG"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-foreground/30 transition-colors hover:bg-foreground/[0.08] hover:text-foreground/70">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={handlePrint} title="Print label"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-foreground/30 transition-colors hover:bg-foreground/[0.08] hover:text-foreground/70">
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex justify-center py-2">
        {mode === 'barcode'
          ? <BarcodeSVG ref={svgRef} value={value} width={220} height={64} />
          : <QRCodeSVG ref={qrRef} value={value} size={120} bgColor="transparent" fgColor="currentColor" level="M" />
        }
      </div>
      <p className="mt-1 text-center font-body text-[10px] text-foreground/30">
        {mode === 'barcode' ? 'Print opens a 62mm × 29mm Dymo-format label dialog' : `QR encodes: ${value}`}
      </p>
    </div>
  );
}

// ─── Variants Table ───────────────────────────────────────────────────────────
function VariantsTable({ variants, onAdd, onUpdate, onRemove, inputCls }) {
  const cls = inputCls || 'rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-2.5 py-1.5 font-body text-xs text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none';
  return (
    <div>
      {variants.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 grid grid-cols-[1fr_1fr_80px_32px] gap-2 px-1">
            {['Variant Name', 'SKU', 'Qty', ''].map(h => (
              <span key={h} className="font-body text-[10px] uppercase tracking-wider text-foreground/30">{h}</span>
            ))}
          </div>
          {variants.map(v => (
            <div key={v.id} className="mb-1.5 grid grid-cols-[1fr_1fr_80px_32px] items-center gap-2">
              <input
                value={v.name}
                onChange={e => onUpdate(v.id, 'name', e.target.value)}
                placeholder="e.g. 500mg"
                className={cls + ' w-full'}
              />
              <input
                value={v.sku}
                onChange={e => onUpdate(v.id, 'sku', e.target.value)}
                placeholder="SKU"
                className={cls + ' w-full'}
              />
              <input
                type="number" min="0"
                value={v.qty}
                onChange={e => onUpdate(v.id, 'qty', Number(e.target.value))}
                className={cls + ' w-full'}
              />
              <button onClick={() => onRemove(v.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/25 transition-colors hover:bg-foreground/[0.06] hover:text-red-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-foreground/[0.12] py-2 font-body text-xs text-foreground/40 transition-colors hover:border-foreground/25 hover:text-foreground/60"
      >
        <Plus className="h-3 w-3" /> Add Variant
      </button>
    </div>
  );
}

// ─── Custom Field Input (type-aware) ─────────────────────────────────────────
function CustomFieldInput({ def, value, onChange, inputCls }) {
  const cls = inputCls || 'w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none';
  if (def.fieldType === 'checkbox') {
    return (
      <button
        type="button"
        onClick={() => onChange(value === 'true' ? 'false' : 'true')}
        className={`relative h-5 w-9 rounded-full transition-colors ${value === 'true' ? 'bg-blue-500' : 'bg-foreground/20'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value === 'true' ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    );
  }
  if (def.fieldType === 'dropdown') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        className={cls.replace('bg-foreground/[0.04]', 'bg-muted')}
      >
        <option value="">— Select —</option>
        {(def.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (def.fieldType === 'date') {
    return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={cls} />;
  }
  if (def.fieldType === 'number') {
    return <input type="number" value={value} onChange={e => onChange(e.target.value)} className={cls} />;
  }
  // text (default)
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />;
}

// ─── Item Detail Page (full-page overlay) ────────────────────────────────────
function ItemDetailPage({ item, folders, tags, customFieldDefs = [], onClose, onEdit, onDuplicate, onUpdateQty, onFetchTransactions }) {
  const [activeTab,    setActiveTab]    = useState('info');
  const [transactions, setTransactions] = useState(null); // null = not yet loaded
  const [txLoading,    setTxLoading]    = useState(false);
  const [txError,      setTxError]      = useState('');

  const exp    = expiryLabel(item.expirationDate);
  const folder = folders.find(f => f.id === item.folderId);

  // Load transactions when Orders tab is activated
  useEffect(() => {
    if (activeTab === 'orders' && transactions === null && onFetchTransactions) {
      setTxLoading(true);
      setTxError('');
      onFetchTransactions(item.id).then(rows => {
        setTransactions(rows || []);
        setTxLoading(false);
      }).catch(err => {
        setTransactions([]);
        setTxError(err?.message || 'Could not load activity history.');
        setTxLoading(false);
      });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemTags = tags.filter(t => item.tags.includes(t.id));
  const Icon   = CAT_ICON[item.category] || Package;
  const color  = CAT_COLOR[item.category] || 'hsl(var(--muted-foreground))';

  return (
    <motion.div
      key="detail" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ ease: EASE, duration: 0.3 }}
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background text-foreground"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-foreground/[0.08] px-6 py-4">
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {folder && <span className="truncate font-body text-xs text-foreground/40">{folder.name}</span>}
          {folder && <ChevronRight className="h-3 w-3 shrink-0 text-foreground/25" />}
          <span className="truncate font-body text-xs text-foreground/60">{item.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={onDuplicate} title="Duplicate item"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 font-body text-xs text-foreground/50 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/80">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground" title="Move">
            <MoveRight className="h-4 w-4" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground" title="More">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <button onClick={onEdit} className="rounded-xl bg-foreground px-4 py-2 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90">
            Edit
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        {/* Title */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: color + '18' }}>
            <Icon className="h-7 w-7" style={{ color }} />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl text-foreground">{item.name}</h1>
              {item.isNew && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-body text-[10px] font-bold uppercase text-amber-400">New</span>}
              {exp && <span className={`rounded-full bg-red-500/10 px-2 py-0.5 font-body text-[10px] font-semibold ${exp.cls}`}>{exp.text}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-body text-xs text-foreground/35">{item.sortlyId}</span>
              <span className="font-body text-[10px] text-foreground/20">•</span>
              <span className="font-body text-xs text-foreground/35">Updated {item.updatedAt}</span>
              <span className="font-body text-[10px] text-foreground/20">•</span>
              <span className="font-body text-xs text-foreground/35">SKU: {item.sku || '—'}</span>
            </div>
          </div>
        </div>

        {/* Photos */}
        {item.photos && item.photos.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {item.photos.map((ph, i) => (
                <div key={ph.id || i} className="relative shrink-0">
                  <img
                    src={ph.url}
                    alt={`${item.name} photo ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="h-28 w-28 rounded-xl border border-foreground/[0.08] object-cover"
                  />
                  {ph.isPrimary && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-background/80 px-1.5 py-0.5 font-body text-[9px] text-foreground/60 backdrop-blur-sm">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metric tiles */}
        <div className="mb-6 flex gap-3">
          <MetricTile
            label="Quantity" value={item.qty} unit={item.unit}
            accent={stockCls(item.qty, item.minLevel)}
            onMinus={() => onUpdateQty(item.id, item.qty - 1)}
            onPlus={() => onUpdateQty(item.id, item.qty + 1)}
          />
          <MetricTile
            label="Min Level" value={item.minLevel} unit={item.unit}
            sub={item.qty <= item.minLevel ? 'Below minimum' : 'OK'}
            onAlert={() => {}} showAlert={item.qty <= item.minLevel}
          />
          <MetricTile label="Unit Price" value={fmt$(item.price)} sub={item.supplier || '—'} />
          <MetricTile label="Total Value" value={fmt$(item.qty * item.price)} sub={`${item.qty} × ${fmt$(item.price)}`} />
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-foreground/[0.08]">
          {[['info','Product Information'],['custom','Custom Fields'],['orders','Orders']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 pb-3 pt-1 font-body text-xs transition-colors ${activeTab === key ? 'border-b-2 border-foreground text-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Product Info */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
              <h3 className="mb-4 font-body text-[11px] uppercase tracking-wider text-foreground/35">Details</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                {[
                  ['Category',     item.category],
                  ['Supplier',     item.supplier || '—'],
                  ['Folder',       folder?.name || '—'],
                  ['Refrigeration',item.refrigeration ? 'Yes' : 'No'],
                  ['Expiration',   item.expirationDate || '—'],
                  ['Last Updated', item.updatedAt],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="font-body text-[10px] uppercase tracking-wider text-foreground/30">{k}</p>
                    <p className="mt-0.5 font-body text-sm text-foreground/80">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            {itemTags.length > 0 && (
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
                <h3 className="mb-3 font-body text-[11px] uppercase tracking-wider text-foreground/35">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {itemTags.map(t => <TagChip key={t.id} tag={t} />)}
                </div>
              </div>
            )}
            {item.notes && (
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
                <h3 className="mb-2 font-body text-[11px] uppercase tracking-wider text-foreground/35">Notes</h3>
                <p className="font-body text-sm text-foreground/70">{item.notes}</p>
              </div>
            )}
            {item.variants?.length > 0 && (
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
                <h3 className="mb-3 font-body text-[11px] uppercase tracking-wider text-foreground/35">Variants</h3>
                <div>
                  <div className="mb-1 grid grid-cols-[1fr_1fr_80px] gap-2 px-1">
                    {['Name', 'SKU', 'Qty'].map(h => (
                      <span key={h} className="font-body text-[10px] uppercase tracking-wider text-foreground/30">{h}</span>
                    ))}
                  </div>
                  {item.variants.map(v => (
                    <div key={v.id} className="grid grid-cols-[1fr_1fr_80px] gap-2 border-t border-foreground/[0.05] py-2">
                      <span className="font-body text-sm text-foreground/80">{v.name || '—'}</span>
                      <span className="font-body text-xs text-foreground/50">{v.sku || '—'}</span>
                      <span className="font-body text-sm text-foreground/80">{v.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <BarcodeCard item={item} />
          </div>
        )}

        {/* Custom Fields */}
        {activeTab === 'custom' && (
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
            <h3 className="mb-4 font-body text-[11px] uppercase tracking-wider text-foreground/35">Custom Fields</h3>
            {customFieldDefs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Sliders className="h-8 w-8 text-foreground/15" />
                <p className="font-body text-xs text-foreground/30">No custom fields defined.</p>
                <p className="font-body text-[10px] text-foreground/20">Define fields in Settings → Custom Fields.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customFieldDefs.map(def => {
                  const val = (item.customFields || {})[def.id];
                  return (
                    <div key={def.id} className="flex items-start justify-between gap-4 border-b border-foreground/[0.05] pb-3 last:border-0 last:pb-0">
                      <span className="font-body text-[11px] uppercase tracking-wider text-foreground/40 pt-0.5">{def.name}</span>
                      <span className="font-body text-sm text-foreground/80 text-right">
                        {def.fieldType === 'checkbox'
                          ? (val === 'true' || val === true ? '✓ Yes' : '— No')
                          : (val != null && val !== '' ? String(val) : <span className="text-foreground/25">—</span>)
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Orders / Activity History */}
        {activeTab === 'orders' && (
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
            <h3 className="mb-4 font-body text-[11px] uppercase tracking-wider text-foreground/35">Activity History</h3>
            {txLoading && (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/10 border-t-foreground/50" />
              </div>
            )}
            {!txLoading && txError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                <p className="font-body text-xs text-red-300">{txError}</p>
              </div>
            )}
            {!txLoading && transactions !== null && transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Activity className="h-8 w-8 text-foreground/15" />
                <p className="font-body text-xs text-foreground/30">No activity recorded yet.</p>
              </div>
            )}
            {!txLoading && transactions !== null && transactions.length > 0 && (
              <div className="space-y-2">
                {transactions.map(tx => {
                  const typeMap = {
                    check_in:  { label:'Stock In',  cls:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    check_out: { label:'Stock Out', cls:'text-red-400 bg-red-500/10 border-red-500/20' },
                    edit:      { label:'Edited',    cls:'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                    create:    { label:'Created',   cls:'text-foreground/50 bg-foreground/[0.06] border-foreground/10' },
                    move:      { label:'Moved',     cls:'text-purple-400 bg-purple-500/10 border-purple-500/20' },
                    delete:    { label:'Deleted',   cls:'text-red-400 bg-red-500/10 border-red-500/20' },
                    restore:   { label:'Restored',  cls:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  };
                  const t = typeMap[tx.type] || { label: tx.type, cls: 'text-foreground/50 bg-foreground/[0.06] border-foreground/10' };
                  const delta = tx.qtyDelta != null
                    ? (tx.qtyDelta >= 0 ? `+${tx.qtyDelta}` : String(tx.qtyDelta))
                    : null;
                  return (
                    <div key={tx.id} className="flex items-start gap-3 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
                      <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 font-body text-[10px] font-semibold ${t.cls}`}>{t.label}</span>
                      <div className="flex-1 min-w-0">
                        {tx.note && <p className="font-body text-xs text-foreground/70 truncate">{tx.note}</p>}
                        {delta && (
                          <p className="font-body text-xs text-foreground/45">
                            {tx.qtyBefore} → {tx.qtyAfter} ({delta})
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-body text-[10px] text-foreground/35">{tx.userName || 'System'}</p>
                        <p className="font-body text-[10px] text-foreground/25">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Fallback when Supabase not connected */}
            {!txLoading && transactions === null && !onFetchTransactions && (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Activity className="h-8 w-8 text-foreground/15" />
                <p className="font-body text-xs text-foreground/30">Activity history requires Supabase.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Item Edit Page (full-page overlay) ──────────────────────────────────────
function ItemEditPage({ item, folders, customFieldDefs = [], onClose, onSave }) {
  const [name,    setName]    = useState(item.name);
  const [qty,     setQty]     = useState(String(item.qty));
  const [unit,    setUnit]    = useState(item.unit);
  const [minLvl,  setMinLvl]  = useState(String(item.minLevel));
  const [price,   setPrice]   = useState(String(item.price));
  const [supplier,setSupplier]= useState(item.supplier || '');
  const [sku,     setSku]     = useState(item.sku || '');
  const [folderId,setFolderId]= useState(item.folderId || '');
  const [expDate, setExpDate] = useState(item.expirationDate || '');
  const [refrig,  setRefrig]  = useState(item.refrigeration);
  const [notes,        setNotes]        = useState(item.notes || '');
  const [photos,       setPhotos]       = useState(item.photos || []);
  const [customFields, setCustomFields] = useState(item.customFields || {});
  const [hasVariants,  setHasVariants]  = useState(!!(item.variants?.length));
  const [variants,     setVariants]     = useState(item.variants || []);

  function setCF(fieldId, value) {
    setCustomFields(prev => ({ ...prev, [fieldId]: value }));
  }
  function addVariant() {
    setVariants(v => [...v, { id: 'v-' + Date.now(), name: '', sku: '', qty: 0 }]);
  }
  function updateVariant(id, field, val) {
    setVariants(v => v.map(x => x.id === id ? { ...x, [field]: val } : x));
  }
  function removeVariant(id) {
    setVariants(v => v.filter(x => x.id !== id));
  }

  function handleSave() {
    onSave({ ...item, name: name.trim(), qty: Number(qty), unit, minLevel: Number(minLvl), price: Number(price), supplier, sku, folderId: folderId || null, expirationDate: expDate || null, refrigeration: refrig, notes, photos, customFields, variants: hasVariants ? variants : [], updatedAt: TODAY_STR });
  }

  const inputCls = 'w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none';
  const selectCls = 'w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none';

  return (
    <motion.div
      key="edit" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ ease: EASE, duration: 0.3 }}
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background text-foreground"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-foreground/[0.08] px-6 py-4">
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"><X className="h-4 w-4" /></button>
        <h1 className="flex-1 font-heading text-base text-foreground">Edit Item</h1>
        <button onClick={handleSave} className="rounded-xl bg-foreground px-5 py-2 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90">Save</button>
      </div>
      <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-8">
        <PhotoDropzone photos={photos} onChange={setPhotos} />
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Item Information</h3>
          <FieldRow label="Name *"><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></FieldRow>
          <FieldRow label="SKU"><input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. IV-NS-1L" className={inputCls} /></FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Quantity *"><input type="number" value={qty} onChange={e => setQty(e.target.value)} min="0" className={inputCls} /></FieldRow>
            <FieldRow label="Unit"><select value={unit} onChange={e => setUnit(e.target.value)} className={selectCls}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Min Level"><input type="number" value={minLvl} onChange={e => setMinLvl(e.target.value)} min="0" className={inputCls} /></FieldRow>
            <FieldRow label="Price ($)"><input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" className={inputCls} /></FieldRow>
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Sourcing & Location</h3>
          <FieldRow label="Supplier"><input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" className={inputCls} /></FieldRow>
          <FieldRow label="Folder">
            <select value={folderId} onChange={e => setFolderId(e.target.value)} className={selectCls}>
              <option value="">No folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FieldRow>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Storage & Compliance</h3>
          <FieldRow label="Expiration Date"><input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className={inputCls} /></FieldRow>
          <div className="flex items-center justify-between">
            <span className="font-body text-sm text-foreground/70">Refrigeration Required</span>
            <button onClick={() => setRefrig(v => !v)} className={`relative h-5 w-9 rounded-full transition-colors ${refrig ? 'bg-blue-500' : 'bg-foreground/20'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${refrig ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        {customFieldDefs.length > 0 && (
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
            <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Custom Fields</h3>
            {customFieldDefs.map(def => (
              <FieldRow key={def.id} label={def.name}>
                <CustomFieldInput def={def} value={customFields[def.id] ?? ''} onChange={v => setCF(def.id, v)} inputCls={inputCls} />
              </FieldRow>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Variants</h3>
              <p className="mt-0.5 font-body text-[10px] text-foreground/30">Track separate SKUs per size, strength, or format.</p>
            </div>
            <button
              onClick={() => { setHasVariants(v => !v); if (!hasVariants && variants.length === 0) addVariant(); }}
              className={`relative h-5 w-9 rounded-full transition-colors ${hasVariants ? 'bg-amber-500' : 'bg-foreground/20'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hasVariants ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {hasVariants && (
            <VariantsTable variants={variants} onAdd={addVariant} onUpdate={updateVariant} onRemove={removeVariant} inputCls={inputCls} />
          )}
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <h3 className="mb-3 font-body text-[11px] uppercase tracking-wider text-foreground/35">Notes</h3>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Internal notes..."
            className="w-full resize-none rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Add Item Full Page (all fields) ─────────────────────────────────────────
function AddItemFullPage({ folders, customFieldDefs = [], onClose, onSave }) {
  const [name,    setName]    = useState('');
  const [qty,     setQty]     = useState('');
  const [unit,    setUnit]    = useState('units');
  const [minLvl,  setMinLvl]  = useState('');
  const [price,   setPrice]   = useState('');
  const [sku,     setSku]     = useState('');
  const [supplier,setSupplier]= useState('');
  const [folderId,setFolderId]= useState('');
  const [expDate, setExpDate] = useState('');
  const [refrig,  setRefrig]  = useState(false);
  const [notes,   setNotes]   = useState('');
  const [customFields, setCustomFields] = useState({});
  const [photos,       setPhotos]       = useState([]);
  const [hasVariants,  setHasVariants]  = useState(false);
  const [variants,     setVariants]     = useState([]);

  function setCF(fieldId, value) {
    setCustomFields(prev => ({ ...prev, [fieldId]: value }));
  }
  function addVariant() {
    setVariants(v => [...v, { id: 'v-' + Date.now(), name: '', sku: '', qty: 0 }]);
  }
  function updateVariant(id, field, val) {
    setVariants(v => v.map(x => x.id === id ? { ...x, [field]: val } : x));
  }
  function removeVariant(id) {
    setVariants(v => v.filter(x => x.id !== id));
  }

  function handleSave() {
    if (!name.trim() || !qty) return;
    onSave({ id: `item-${Date.now()}`, sortlyId: `AVOT${String(Math.floor(Math.random() * 9000) + 1000)}`, name: name.trim(), sku, category: 'IV', folderId: folderId || null, qty: Number(qty), unit, minLevel: Number(minLvl) || 0, price: Number(price) || 0, supplier, expirationDate: expDate || null, refrigeration: refrig, notes, photos, customFields, variants: hasVariants ? variants : [], tags: [], isNew: true, updatedAt: TODAY_STR });
    onClose();
  }

  const inputCls = 'w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none';
  const selectCls = 'w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none';

  return (
    <motion.div
      key="add-full" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ ease: EASE, duration: 0.3 }}
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background text-foreground"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-foreground/[0.08] px-6 py-4">
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"><X className="h-4 w-4" /></button>
        <h1 className="flex-1 font-heading text-base text-foreground">Add Item — All Fields</h1>
        <button onClick={handleSave} disabled={!name.trim() || !qty} className="rounded-xl bg-foreground px-5 py-2 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40">Add Item</button>
      </div>
      <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-8">
        <PhotoDropzone photos={photos} onChange={setPhotos} />
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Item Information</h3>
          <FieldRow label="Name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Item name" className={inputCls} /></FieldRow>
          <FieldRow label="SKU / Barcode"><input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. IV-NS-1L" className={inputCls} /></FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Quantity *"><input type="number" value={qty} onChange={e => setQty(e.target.value)} min="0" className={inputCls} /></FieldRow>
            <FieldRow label="Unit of Measure"><select value={unit} onChange={e => setUnit(e.target.value)} className={selectCls}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Min Level"><input type="number" value={minLvl} onChange={e => setMinLvl(e.target.value)} min="0" className={inputCls} /></FieldRow>
            <FieldRow label="Price ($)"><input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" className={inputCls} /></FieldRow>
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Sourcing & Location</h3>
          <FieldRow label="Supplier"><input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" className={inputCls} /></FieldRow>
          <FieldRow label="Folder">
            <select value={folderId} onChange={e => setFolderId(e.target.value)} className={selectCls}>
              <option value="">No folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FieldRow>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Storage & Compliance</h3>
          <FieldRow label="Expiration Date"><input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className={inputCls} /></FieldRow>
          <div className="flex items-center justify-between">
            <span className="font-body text-sm text-foreground/70">Refrigeration Required</span>
            <button onClick={() => setRefrig(v => !v)} className={`relative h-5 w-9 rounded-full transition-colors ${refrig ? 'bg-blue-500' : 'bg-foreground/20'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${refrig ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">QR / Barcodes</h3>
            <span className="font-body text-[10px] text-foreground/25">Auto-generated on save</span>
          </div>
          <div className="flex items-center justify-center rounded-lg bg-foreground/[0.03] py-5 opacity-40">
            <Barcode className="h-10 w-10 text-foreground/30" />
          </div>
        </div>
        {customFieldDefs.length > 0 && (
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
            <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Custom Fields</h3>
            {customFieldDefs.map(def => (
              <FieldRow key={def.id} label={def.name}>
                <CustomFieldInput def={def} value={customFields[def.id] ?? ''} onChange={v => setCF(def.id, v)} inputCls={inputCls} />
              </FieldRow>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Variants</h3>
              <p className="mt-0.5 font-body text-[10px] text-foreground/30">Track separate SKUs per size, strength, or format.</p>
            </div>
            <button
              onClick={() => { setHasVariants(v => !v); if (!hasVariants && variants.length === 0) addVariant(); }}
              className={`relative h-5 w-9 rounded-full transition-colors ${hasVariants ? 'bg-amber-500' : 'bg-foreground/20'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hasVariants ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {hasVariants && (
            <VariantsTable variants={variants} onAdd={addVariant} onUpdate={updateVariant} onRemove={removeVariant} inputCls={inputCls} />
          )}
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <h3 className="mb-3 font-body text-[11px] uppercase tracking-wider text-foreground/35">Notes</h3>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Internal notes..."
            className="w-full resize-none rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Trash view ───────────────────────────────────────────────────────────────
function TrashView({ trashedItems, onRestore, onDeletePermanent }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-foreground/[0.08] px-5 py-4">
        <h2 className="flex-1 font-heading text-base text-foreground">Trash</h2>
        {trashedItems.length > 0 && (
          <button onClick={() => onDeletePermanent('all')} className="font-body text-xs text-red-400 transition-colors hover:text-red-300">
            Empty Trash
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {trashedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Trash2 className="h-10 w-10 text-foreground/15" />
            <p className="font-body text-sm text-foreground/30">Trash is empty.</p>
            <span className="font-body text-xs text-foreground/20">Items moved to trash appear here.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {trashedItems.map(item => {
              const Icon = CAT_ICON[item.category] || Package;
              const color = CAT_COLOR[item.category] || 'hsl(var(--muted-foreground))';
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: color + '15' }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm text-foreground/70">{item.name}</p>
                    <p className="font-body text-[10px] text-foreground/30">{item.sortlyId} · Deleted {item.deletedAt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => onRestore(item.id)} className="rounded-lg border border-foreground/[0.10] px-3 py-1.5 font-body text-xs text-foreground/60 transition-colors hover:bg-foreground/[0.05] hover:text-foreground">
                      Restore
                    </button>
                    <button onClick={() => onDeletePermanent(item.id)} className="rounded-lg border border-red-500/20 px-3 py-1.5 font-body text-xs text-red-400 transition-colors hover:bg-red-500/10">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tag edit modal ──────────────────────────────────────────────────────────
const TAG_COLORS = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--success))','hsl(var(--warning))','hsl(var(--destructive))','hsl(var(--chart-3))','hsl(var(--accent))','hsl(var(--muted-foreground))','hsl(var(--chart-4))','hsl(var(--chart-5))'];

function TagEditModal({ tag, onClose, onSave }) {
  const [name,  setName]  = useState(tag?.name  || '');
  const [color, setColor] = useState(tag?.color || TAG_COLORS[0]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ ease: EASE, duration: 0.2 }}
        className="w-72 rounded-2xl border border-foreground/10 bg-card p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-base text-foreground">{tag ? 'Edit Tag' : 'Add Tag'}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tag name"
              className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Color</label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-foreground/60 scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-foreground/[0.10] py-2.5 font-body text-xs text-foreground/60 transition-colors hover:bg-foreground/[0.05]">Cancel</button>
          <button onClick={() => { if (name.trim()) { onSave({ name: name.trim(), color }); onClose(); } }} disabled={!name.trim()}
            className="flex-1 rounded-xl bg-foreground py-2.5 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
          >{tag ? 'Save' : 'Add'}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Tags view ────────────────────────────────────────────────────────────────
function TagsView({ tags, items, onAddTag, onEditTag, onDeleteTag }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editTag, setEditTag] = useState(null);
  function tagCount(id) { return items.filter(i => i.tags.includes(id)).length; }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-foreground/[0.08] px-5 py-4">
        <h2 className="flex-1 font-heading text-base text-foreground">Tags</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90">
          <Plus className="h-3.5 w-3.5" /> Add Tag
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Tag className="h-10 w-10 text-foreground/15" />
            <p className="font-body text-sm text-foreground/30">No tags yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center gap-3 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: tag.color }} />
                <span className="flex-1 font-body text-sm text-foreground/80">{tag.name}</span>
                <span className="font-body text-xs text-foreground/35">{tagCount(tag.id)} item{tagCount(tag.id) !== 1 ? 's' : ''}</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditTag(tag)} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 transition-colors hover:bg-foreground/[0.08] hover:text-foreground/60"><Edit className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onDeleteTag(tag.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 transition-colors hover:bg-foreground/[0.08] hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {showAdd && <TagEditModal key="add" onClose={() => setShowAdd(false)} onSave={(d) => onAddTag({ id:`t${Date.now()}`, ...d })} />}
        {editTag && <TagEditModal key="edit" tag={editTag} onClose={() => setEditTag(null)} onSave={(d) => { onEditTag({ ...editTag, ...d }); setEditTag(null); }} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Reports view ─────────────────────────────────────────────────────────────
const REPORT_DEFS = [
  { id:'summary',  label:'Inventory Summary',    Icon:FileText },
  { id:'activity', label:'Activity History',      Icon:Clock },
  { id:'txn',      label:'Transactions',          Icon:ArrowUpDown },
  { id:'flow',     label:'Item Flow',             Icon:TrendingUp },
  { id:'moves',    label:'Move Summary',          Icon:MoveRight },
  { id:'users',    label:'User Activity Summary', Icon:User },
];

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(items, folders, tags) {
  const tagMap  = Object.fromEntries((tags   || []).map(t => [t.id,   t.name]));
  const folderMap = Object.fromEntries((folders || []).map(f => [f.id, f.name]));

  const cols = [
    'ID', 'Name', 'SKU', 'Category', 'Folder', 'Qty', 'Unit',
    'Min Level', 'Price', 'Supplier', 'Expiration Date',
    'Refrigeration', 'Tags', 'Notes', 'Updated At',
  ];

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = items.map(i => [
    i.sortlyId || i.id,
    i.name,
    i.sku,
    i.category,
    folderMap[i.folderId] || '',
    i.qty,
    i.unit,
    i.minLevel,
    i.price,
    i.supplier,
    i.expirationDate || '',
    i.refrigeration ? 'Yes' : 'No',
    (i.tags || []).map(tid => tagMap[tid] || tid).join('; '),
    i.notes,
    i.updatedAt || '',
  ].map(escape).join(','));

  const csv = [cols.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `avalon-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────

function ReportsView({ items, folders, tags }) {
  const [activeReport, setActiveReport] = useState('summary');
  const rDef = REPORT_DEFS.find(r => r.id === activeReport);
  const totalValue = items.reduce((s, i) => s + i.qty * i.price, 0);
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const lowStock   = items.filter(i => i.qty > 0 && i.qty <= i.minLevel).length;
  const outOfStock = items.filter(i => i.qty <= 0).length;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sub-nav */}
      <div className="w-52 shrink-0 overflow-y-auto border-r border-foreground/[0.08] bg-background">
        <div className="px-3 py-4">
          <p className="mb-2 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/30">Reports</p>
          {REPORT_DEFS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveReport(id)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-body text-xs transition-colors ${activeReport === id ? 'bg-foreground/10 text-foreground' : 'text-foreground/50 hover:bg-foreground/[0.05] hover:text-foreground/80'}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex shrink-0 items-center justify-between border-b border-foreground/[0.08] px-5 py-4">
          <h2 className="font-heading text-base text-foreground">{rDef?.label}</h2>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(items, folders, tags)} className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 font-body text-xs text-foreground/50 transition-colors hover:bg-foreground/[0.05]"><Download className="h-3.5 w-3.5" /> Export CSV</button>
            <button className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 font-body text-xs text-foreground/50 transition-colors hover:bg-foreground/[0.05]"><Printer className="h-3.5 w-3.5" /> Print</button>
          </div>
        </div>
        <div className="p-5">

          {/* ── Inventory Summary ── */}
          {activeReport === 'summary' && (
            <>
              <div className="mb-5 grid gap-3 md:grid-cols-2">
                {[
                  { label:'Total SKUs',  value:items.length,         unit:'' },
                  { label:'Total Units', value:totalUnits,            unit:'' },
                  { label:'Total Value', value:fmt$(totalValue),      unit:'' },
                  { label:'Alerts',      value:lowStock + outOfStock, unit:`${lowStock} low · ${outOfStock} out` },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
                    <p className="font-body text-[10px] uppercase tracking-wider text-foreground/30">{label}</p>
                    <p className="mt-1 font-heading text-xl text-foreground">{value}</p>
                    {unit && <p className="font-body text-[10px] text-foreground/35">{unit}</p>}
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto rounded-2xl border border-foreground/[0.08]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-foreground/[0.08] bg-foreground/[0.02]">
                      {['Name','SKU','Folder','Qty','Price','Total Value','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-body text-[10px] uppercase tracking-wider text-foreground/35">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const folder = folders.find(f => f.id === item.folderId);
                      return (
                        <tr key={item.id} className="border-b border-foreground/[0.05] hover:bg-foreground/[0.02]">
                          <td className="px-4 py-2.5 font-body text-xs text-foreground/80">{item.name}</td>
                          <td className="px-4 py-2.5 font-body text-xs text-foreground/40">{item.sku}</td>
                          <td className="px-4 py-2.5 font-body text-xs text-foreground/40">{folder?.name || '—'}</td>
                          <td className={`px-4 py-2.5 font-body text-xs font-semibold ${stockCls(item.qty, item.minLevel)}`}>{item.qty} {item.unit}</td>
                          <td className="px-4 py-2.5 font-body text-xs text-foreground/60">{fmt$(item.price)}</td>
                          <td className="px-4 py-2.5 font-body text-xs font-semibold text-foreground/80">{fmt$(item.qty * item.price)}</td>
                          <td className="px-4 py-2.5"><StatusPill qty={item.qty} minLevel={item.minLevel} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-foreground/[0.12] bg-foreground/[0.03]">
                      <td colSpan={3} className="px-4 py-3 font-body text-xs font-semibold text-foreground/50">Total</td>
                      <td className="px-4 py-3 font-body text-xs font-semibold text-foreground">{totalUnits}</td>
                      <td />
                      <td className="px-4 py-3 font-body text-xs font-semibold text-foreground">{fmt$(totalValue)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* ── Activity History ── */}
          {activeReport === 'activity' && (
            <div className="space-y-3">
              <p className="font-body text-[10px] uppercase tracking-[0.16em] text-foreground/30">
                {INVENTORY_CLINICAL_NOTE}
              </p>
              {[
                { action:'Qty updated',    item:'NAD+ 250mg vial',         detail:'Qty 10 → 8',                    by:'Joseph L.',    at:'2026-05-19 14:22', Icon:RefreshCw,  cls:'text-blue-400' },
                { action:'Item added',     item:'IV Start Kit',            detail:'Added to IV Supplies',           by:'Joseph L.',    at:'2026-05-19 09:14', Icon:Plus,       cls:'text-emerald-400' },
                { action:'Low stock',      item:'Vitamin C 50ml',          detail:'Qty 3 / Min 4',                  by:'System',       at:'2026-05-18 08:00', Icon:AlertTriangle, cls:'text-amber-400' },
                { action:'Expiry alert',   item:'Epinephrine 1mg/ml',      detail:'Exp 2026-05-18',                 by:'System',       at:'2026-05-17 08:00', Icon:AlertCircle, cls:'text-red-400' },
                { action:'Item edited',    item:'IV Bag — 1L Normal Saline', detail:'Supplier updated',             by:'Joseph L.',    at:'2026-05-16 16:45', Icon:Edit,       cls:'text-foreground/50' },
                { action:'Folder created', item:'IV Supplies',             detail:'Created under Avalon Vitality',  by:'Joseph L.',    at:'2026-05-14 11:30', Icon:FolderPlus, cls:'text-foreground/50' },
              ].map((ev, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] ${ev.cls}`}><ev.Icon className="h-3.5 w-3.5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-body text-xs font-semibold text-foreground/80">{ev.action} — <span className="text-foreground">{ev.item}</span></p>
                        <p className="font-body text-[11px] text-foreground/40">{ev.detail}</p>
                      </div>
                      <span className="shrink-0 font-body text-[10px] text-foreground/30">{ev.at}</span>
                    </div>
                    <p className="mt-1 font-body text-[10px] text-foreground/30">By {ev.by}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Transactions ── */}
          {activeReport === 'txn' && (
            <div className="overflow-x-auto rounded-2xl border border-foreground/[0.08]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-foreground/[0.08] bg-foreground/[0.02]">
                    {['Date','Item','Type','Qty Change','New Qty','User'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-body text-[10px] uppercase tracking-wider text-foreground/35">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { date:'2026-05-19', item:'NAD+ 250mg vial',        type:'Used',      delta:-2, newQty:8,  user:'Joseph L.' },
                    { date:'2026-05-19', item:'IV Start Kit',           type:'Received',  delta:+2, newQty:6,  user:'Joseph L.' },
                    { date:'2026-05-18', item:'Vitamin C 50ml',         type:'Used',      delta:-1, newQty:3,  user:'Stephanie W.' },
                    { date:'2026-05-17', item:'B12 IM vial',            type:'Received',  delta:+6, newQty:18, user:'Joseph L.' },
                    { date:'2026-05-16', item:'Epinephrine 1mg/ml',     type:'Used',      delta:-1, newQty:4,  user:'Stephanie W.' },
                    { date:'2026-05-15', item:'Glutathione 600mg vial', type:'Received',  delta:+8, newQty:14, user:'Joseph L.' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-foreground/[0.05] hover:bg-foreground/[0.02]">
                      <td className="px-4 py-2.5 font-body text-xs text-foreground/45">{row.date}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-foreground/80">{row.item}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${row.type === 'Received' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>{row.type}</span>
                      </td>
                      <td className={`px-4 py-2.5 font-body text-xs font-semibold ${row.delta > 0 ? 'text-emerald-400' : 'text-blue-400'}`}>{row.delta > 0 ? '+' : ''}{row.delta}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-foreground/60">{row.newQty}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-foreground/45">{row.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Item Flow ── */}
          {activeReport === 'flow' && (
            <div className="space-y-3">
              <p className="mb-4 font-body text-xs text-foreground/40">Items ranked by total value (qty × price)</p>
              {[...items].sort((a, b) => (b.qty * b.price) - (a.qty * a.price)).slice(0, 10).map((item, i) => {
                const maxVal = Math.max(...items.map(it => it.qty * it.price));
                const pct = Math.round(((item.qty * item.price) / maxVal) * 100);
                const Icon = CAT_ICON[item.category] || Package;
                const color = CAT_COLOR[item.category] || 'hsl(var(--muted-foreground))';
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-3">
                    <span className="w-5 shrink-0 text-right font-body text-[11px] text-foreground/30">{i + 1}</span>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: color + '18' }}>
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate font-body text-xs font-semibold text-foreground/80">{item.name}</p>
                        <span className="shrink-0 font-body text-xs text-foreground/50">{item.qty} {item.unit}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-foreground/[0.08]">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                    <span className="shrink-0 font-body text-xs text-foreground/40">{fmt$(item.qty * item.price)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Move Summary ── */}
          {activeReport === 'moves' && (
            <div className="space-y-3">
              {folders.map(folder => {
                const fi = items.filter(i => i.folderId === folder.id);
                if (fi.length === 0) return null;
                const val = fi.reduce((s, i) => s + i.qty * i.price, 0);
                return (
                  <div key={folder.id} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: folder.color }} />
                        <span className="font-body text-sm font-semibold text-foreground/80">{folder.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-body text-xs text-foreground/40">{fi.length} item{fi.length !== 1 ? 's' : ''}</span>
                        <span className="font-body text-xs font-semibold text-foreground/70">{fmt$(val)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {fi.map(item => (
                        <span key={item.id} className="rounded-full border border-foreground/[0.08] px-2 py-0.5 font-body text-[10px] text-foreground/50">{item.name}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── User Activity ── */}
          {activeReport === 'users' && (
            <div className="overflow-x-auto rounded-2xl border border-foreground/[0.08]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-foreground/[0.08] bg-foreground/[0.02]">
                    {['User','Actions','Items Edited','Last Active'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-body text-[10px] uppercase tracking-wider text-foreground/35">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name:'Joseph L.',   actions:12, edited:8, last:'2026-05-19' },
                    { name:'Stephanie W.',actions:7,  edited:4, last:'2026-05-18' },
                    { name:'System',      actions:6,  edited:0, last:'2026-05-19' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-foreground/[0.05] hover:bg-foreground/[0.02]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/[0.08] font-body text-[11px] text-foreground/60">{row.name[0]}</div>
                          <span className="font-body text-xs text-foreground/80">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-body text-xs text-foreground/60">{row.actions}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-foreground/60">{row.edited}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-foreground/45">{row.last}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Settings view ────────────────────────────────────────────────────────────
const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'checkbox', label: 'Checkbox (Yes/No)' },
  { value: 'dropdown', label: 'Dropdown' },
];

function SettingsView({ settings = {}, onSave, customFieldDefs = [], onAddFieldDef, onEditFieldDef, onDeleteFieldDef, tags = [], onAddTag, onEditTag, onDeleteTag }) {
  const [orgName,      setOrgName]      = useState(settings.orgName      || 'Avalon Vitality');
  const [currency,     setCurrency]     = useState(settings.currency     || 'USD');
  const [lowThresh,    setLowThresh]    = useState(settings.lowThreshold || 'auto');
  const [emailAlerts,  setEmailAlerts]  = useState(settings.emailAlerts  || false);
  const [alertEmail,   setAlertEmail]   = useState(settings.alertEmail   || '');
  const [saving,       setSaving]       = useState(false);
  const saveTimer = useRef(null);

  // Tag editing state
  const [addingTag,    setAddingTag]    = useState(false);
  const [editingTagId, setEditingTagId] = useState(null);
  const [tagName,      setTagName]      = useState('');
  const [tagColor,     setTagColor]     = useState('hsl(var(--chart-1))');
  const TAG_COLORS = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--success))','hsl(var(--warning))','hsl(var(--destructive))','hsl(var(--chart-3))','hsl(var(--accent))','hsl(var(--muted-foreground))','hsl(var(--chart-4))','hsl(var(--success))'];

  // Custom field definition editing state
  const [addingField,    setAddingField]    = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [fieldDraft,     setFieldDraft]     = useState({ name: '', fieldType: 'text', options: [] });
  const [optionInput,    setOptionInput]    = useState('');

  // Sync when settings prop changes (e.g. after DB load)
  useEffect(() => {
    if (settings.orgName)      setOrgName(settings.orgName);
    if (settings.currency)     setCurrency(settings.currency);
    if (settings.lowThreshold) setLowThresh(settings.lowThreshold);
    if (settings.emailAlerts != null) setEmailAlerts(settings.emailAlerts);
    if (settings.alertEmail)   setAlertEmail(settings.alertEmail);
  }, [settings.orgName, settings.currency, settings.lowThreshold, settings.emailAlerts, settings.alertEmail]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  function handleSave() {
    setSaving(true);
    onSave?.({ orgName, currency, lowThreshold: lowThresh, emailAlerts, alertEmail });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaving(false), 1500);
  }

  function openAddTag() { setTagName(''); setTagColor('hsl(var(--chart-1))'); setEditingTagId(null); setAddingTag(true); }
  function openEditTag(tag) { setTagName(tag.name); setTagColor(tag.color); setEditingTagId(tag.id); setAddingTag(true); }
  function commitTag() {
    if (!tagName.trim()) return;
    if (editingTagId) {
      onEditTag?.({ id: editingTagId, name: tagName.trim(), color: tagColor });
    } else {
      onAddTag?.({ name: tagName.trim(), color: tagColor });
    }
    setAddingTag(false); setEditingTagId(null);
  }

  function openAddField() {
    setFieldDraft({ name: '', fieldType: 'text', options: [] });
    setOptionInput('');
    setEditingFieldId(null);
    setAddingField(true);
  }

  function openEditField(def) {
    setFieldDraft({ name: def.name, fieldType: def.fieldType, options: def.options || [] });
    setOptionInput('');
    setEditingFieldId(def.id);
    setAddingField(true);
  }

  function commitField() {
    if (!fieldDraft.name.trim()) return;
    if (editingFieldId) {
      onEditFieldDef?.(editingFieldId, fieldDraft);
    } else {
      onAddFieldDef?.(fieldDraft);
    }
    setAddingField(false);
    setEditingFieldId(null);
  }

  function addOption() {
    const o = optionInput.trim();
    if (!o || fieldDraft.options.includes(o)) return;
    setFieldDraft(d => ({ ...d, options: [...d.options, o] }));
    setOptionInput('');
  }

  function removeOption(o) {
    setFieldDraft(d => ({ ...d, options: d.options.filter(x => x !== o) }));
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex shrink-0 items-center border-b border-foreground/[0.08] px-5 py-4">
        <h2 className="flex-1 font-heading text-base text-foreground">Settings</h2>
      </div>
      <div className="mx-auto w-full max-w-xl space-y-5 p-6">
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Organization</h3>
          <div>
            <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Name</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)}
              className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
            >
              {['USD','EUR','GBP','CAD','AUD'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Stock Alerts</h3>
          <div>
            <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Low Stock Threshold</label>
            <select value={lowThresh} onChange={e => setLowThresh(e.target.value)}
              className="w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
            >
              <option value="auto">Per-item Min Level (default)</option>
              <option value="5">Global: below 5 units</option>
              <option value="10">Global: below 10 units</option>
              <option value="20">Global: below 20 units</option>
            </select>
            <p className="mt-1.5 font-body text-[10px] text-foreground/30">Uses each item's own Min Level when set to Per-item.</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm text-foreground/80">Email Alerts</p>
              <p className="font-body text-[10px] text-foreground/35">Send low stock + expiry alerts by email</p>
            </div>
            <button onClick={() => setEmailAlerts(v => !v)} className={`relative h-5 w-9 rounded-full transition-colors ${emailAlerts ? 'bg-amber-500' : 'bg-foreground/20'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${emailAlerts ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {emailAlerts && (
            <div>
              <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Alert Email</label>
              <input
                type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)}
                placeholder="team@avalonvitality.co"
                className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Tags</h3>
            {!addingTag && (
              <button onClick={openAddTag} className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 py-1.5 font-body text-xs text-foreground/50 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/80">
                <Plus className="h-3 w-3" /> Add Tag
              </button>
            )}
          </div>

          {tags.length > 0 && !addingTag && (
            <div className="mb-3 space-y-1">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: tag.color }} />
                  <span className="flex-1 font-body text-sm text-foreground/80">{tag.name}</span>
                  <button onClick={() => openEditTag(tag)} className="flex h-6 w-6 items-center justify-center rounded text-foreground/30 transition-colors hover:text-foreground/70">
                    <Edit className="h-3 w-3" />
                  </button>
                  <button onClick={() => onDeleteTag?.(tag.id)} className="flex h-6 w-6 items-center justify-center rounded text-foreground/30 transition-colors hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {addingTag && (
            <div className="space-y-3 rounded-xl border border-foreground/[0.10] bg-foreground/[0.04] p-4">
              <div>
                <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Tag Name</label>
                <input
                  value={tagName} onChange={e => setTagName(e.target.value)}
                  placeholder="e.g. Controlled"
                  className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setTagColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform ${tagColor === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAddingTag(false)} className="rounded-lg px-4 py-2 font-body text-xs text-foreground/40 hover:text-foreground/70">Cancel</button>
                <button onClick={commitTag} disabled={!tagName.trim()} className="rounded-xl bg-foreground px-4 py-2 font-body text-xs font-semibold text-background disabled:opacity-40">
                  {editingTagId ? 'Save Tag' : 'Add Tag'}
                </button>
              </div>
            </div>
          )}

          {tags.length === 0 && !addingTag && (
            <p className="py-4 text-center font-body text-xs text-foreground/25">No tags yet. Click Add Tag to create one.</p>
          )}
        </div>

        {/* Custom Field Definitions */}
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Custom Fields</h3>
            {!addingField && (
              <button onClick={openAddField} className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 py-1.5 font-body text-xs text-foreground/50 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/80">
                <Plus className="h-3 w-3" /> Add Field
              </button>
            )}
          </div>

          {/* Existing defs list */}
          {customFieldDefs.length > 0 && !addingField && (
            <div className="mb-3 space-y-1">
              {customFieldDefs.map(def => (
                <div key={def.id} className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2">
                  <span className="flex-1 font-body text-sm text-foreground/80">{def.name}</span>
                  <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-body text-[10px] uppercase tracking-wide text-foreground/40">
                    {FIELD_TYPES.find(t => t.value === def.fieldType)?.label || def.fieldType}
                  </span>
                  <button onClick={() => openEditField(def)} className="flex h-6 w-6 items-center justify-center rounded text-foreground/30 transition-colors hover:text-foreground/70">
                    <Edit className="h-3 w-3" />
                  </button>
                  <button onClick={() => onDeleteFieldDef?.(def.id)} className="flex h-6 w-6 items-center justify-center rounded text-foreground/30 transition-colors hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inline add/edit form */}
          {addingField && (
            <div className="space-y-3 rounded-xl border border-foreground/[0.10] bg-foreground/[0.04] p-4">
              <div>
                <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Field Name</label>
                <input
                  value={fieldDraft.name}
                  onChange={e => setFieldDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Lot Number"
                  className="w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Type</label>
                <select
                  value={fieldDraft.fieldType}
                  onChange={e => setFieldDraft(d => ({ ...d, fieldType: e.target.value, options: [] }))}
                  className="w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
                >
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {fieldDraft.fieldType === 'dropdown' && (
                <div>
                  <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Options</label>
                  <div className="mb-2 flex gap-2">
                    <input
                      value={optionInput}
                      onChange={e => setOptionInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                      placeholder="Option value…"
                      className="flex-1 rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
                    />
                    <button onClick={addOption} className="rounded-lg border border-foreground/[0.10] px-3 py-2 font-body text-xs text-foreground/50 hover:bg-foreground/[0.05]">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fieldDraft.options.map(o => (
                      <span key={o} className="flex items-center gap-1 rounded-full border border-foreground/[0.10] px-2.5 py-0.5 font-body text-xs text-foreground/70">
                        {o}
                        <button onClick={() => removeOption(o)} className="ml-0.5 text-foreground/30 hover:text-red-400"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setAddingField(false)} className="rounded-lg px-4 py-2 font-body text-xs text-foreground/40 hover:text-foreground/70">Cancel</button>
                <button onClick={commitField} disabled={!fieldDraft.name.trim()} className="rounded-xl bg-foreground px-4 py-2 font-body text-xs font-semibold text-background disabled:opacity-40">
                  {editingFieldId ? 'Save Changes' : 'Add Field'}
                </button>
              </div>
            </div>
          )}

          {customFieldDefs.length === 0 && !addingField && (
            <p className="py-4 text-center font-body text-xs text-foreground/25">No custom fields yet. Click Add Field to create one.</p>
          )}
        </div>

        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-3">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-foreground/35">Item IDs</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm text-foreground/80">ID Prefix</p>
              <p className="font-body text-[10px] text-foreground/35">Items assigned IDs in format AVOT####</p>
            </div>
            <span className="rounded-lg border border-foreground/[0.10] px-3 py-1.5 font-body text-xs text-foreground/50">AVOT</span>
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <h3 className="mb-4 font-body text-[11px] uppercase tracking-wider text-foreground/35">Integrations</h3>
          {[
            { name:'Square POS',  desc:'Sync inventory with Square',  },
            { name:'Scheduling',  desc:'Auto-deduct on appointment',  },
            { name:'Bound Tree',  desc:'Auto-reorder from supplier',  },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-center justify-between border-b border-foreground/[0.05] py-3 last:border-0">
              <div>
                <p className="font-body text-sm text-foreground/80">{name}</p>
                <p className="font-body text-[10px] text-foreground/35">{desc}</p>
              </div>
              <button className="rounded-lg border border-foreground/[0.10] px-3 py-1.5 font-body text-xs text-foreground/50 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/80">Connect</button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={handleSave} className="rounded-xl bg-foreground px-6 py-2.5 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90">
            {saving ? '✓ Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Move folder modal ────────────────────────────────────────────────────────
function MoveFolderModal({ folders, selectedCount, onClose, onMove }) {
  const [destId, setDestId] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ ease: EASE, duration: 0.2 }}
        className="w-80 rounded-2xl border border-foreground/10 bg-card p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-base text-foreground">Move {selectedCount} item{selectedCount !== 1 ? 's' : ''}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-5">
          <label className="mb-1.5 block font-body text-[11px] uppercase tracking-wider text-foreground/40">Destination Folder</label>
          <select value={destId} onChange={e => setDestId(e.target.value)}
            className="w-full rounded-lg border border-foreground/[0.12] bg-muted px-3 py-2.5 font-body text-sm text-foreground focus:border-foreground/30 focus:outline-none"
          >
            <option value="">No folder (root)</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-foreground/[0.10] py-2.5 font-body text-xs text-foreground/60 transition-colors hover:bg-foreground/[0.05]">Cancel</button>
          <button onClick={() => { onMove(destId || null); onClose(); }} className="flex-1 rounded-xl bg-foreground py-2.5 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90">Move</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Placeholder views (Phase 2 / 3) ─────────────────────────────────────────
function PlaceholderView({ title, phase }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-foreground/[0.08] bg-foreground/[0.04]">
        <Sparkles className="h-7 w-7 text-foreground/25" />
      </div>
      <h2 className="font-heading text-lg text-foreground/60">{title}</h2>
      <span className="rounded-full border border-foreground/10 px-3 py-1 font-body text-[10px] uppercase tracking-widest text-foreground/30">Coming Phase {phase}</span>
    </div>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

const CSV_COL_OPTIONS = ['name','sku','category','qty','unit','minLevel','price','supplier','expirationDate','notes','-- ignore --'];

function CSVImportModal({ folders, onClose, onImport }) {
  const [step,     setStep]     = useState('upload');   // 'upload' | 'map' | 'preview'
  const [rows,     setRows]     = useState([]);          // raw string rows
  const [headers,  setHeaders]  = useState([]);          // CSV header row
  const [mapping,  setMapping]  = useState({});          // { csvCol: fieldKey }
  const [preview,  setPreview]  = useState([]);          // mapped items for confirmation
  const [folderId, setFolderId] = useState('');
  const [error,    setError]    = useState('');

  const fileRef = useRef(null);

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { setError('File must have a header row and at least one data row.'); return; }
    const splitLine = (line) => {
      const result = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
        else cur += c;
      }
      result.push(cur);
      return result;
    };
    const hdrs  = splitLine(lines[0]).map(h => h.trim());
    const data  = lines.slice(1).map(splitLine);
    setHeaders(hdrs);
    setRows(data);
    // Auto-map headers to fields by fuzzy name match
    const auto = {};
    const fieldMap = {
      name: ['name','item','item name','product','title'],
      sku:  ['sku','barcode','code','item code'],
      category: ['category','cat','type'],
      qty:  ['qty','quantity','stock','count','on hand'],
      unit: ['unit','units','uom'],
      minLevel: ['min','min level','minimum','reorder','reorder point'],
      price: ['price','cost','unit cost','unit price','value'],
      supplier: ['supplier','vendor','brand','manufacturer'],
      expirationDate: ['exp','expiry','expiration','expiration date','best by','use by'],
      notes: ['notes','note','description','details','comment'],
    };
    hdrs.forEach(h => {
      const hl = h.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(fieldMap)) {
        if (aliases.some(a => hl === a || hl.includes(a))) { auto[h] = field; break; }
      }
      if (!auto[h]) auto[h] = '-- ignore --';
    });
    setMapping(auto);
    setError('');
    setStep('map');
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target.result);
    reader.readAsText(file);
  }

  function buildPreview() {
    const mapped = rows.map(row => {
      const obj = { folderId: folderId || null, tags: [], isNew: true };
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (!field || field === '-- ignore --') return;
        const val = (row[i] || '').trim();
        if (field === 'qty' || field === 'minLevel') obj[field] = parseInt(val) || 0;
        else if (field === 'price') obj[field] = parseFloat(val) || 0;
        else obj[field] = val;
      });
      if (!obj.name) obj.name = '(unnamed)';
      obj.qty      = obj.qty      ?? 0;
      obj.minLevel = obj.minLevel ?? 0;
      obj.unit     = obj.unit     || 'units';
      obj.price    = obj.price    ?? 0;
      return obj;
    }).filter(o => o.name && o.name !== '(unnamed)');
    if (!mapped.length) { setError('No valid rows found — make sure "Name" column is mapped.'); return; }
    setPreview(mapped);
    setError('');
    setStep('preview');
  }

  function handleImport() {
    preview.forEach(item => onImport(item));
    onClose();
  }

  const inputCls = 'w-full rounded-lg border border-foreground/[0.12] bg-foreground/[0.04] px-2.5 py-1.5 font-body text-xs text-foreground focus:border-foreground/30 focus:outline-none';
  const btnCls   = 'rounded-xl bg-foreground px-4 py-2 font-body text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40';

  return (
    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="mx-4 w-full max-w-xl rounded-2xl border border-foreground/[0.12] bg-card shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ ease: EASE, duration: 0.2 }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/[0.08] px-5 py-4">
          <h2 className="font-heading text-base text-foreground">Import Items from CSV</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5">
          {/* Step indicator */}
          <div className="mb-5 flex items-center gap-2">
            {[['upload','1. Upload'],['map','2. Map Columns'],['preview','3. Confirm']].map(([s, label]) => (
              <React.Fragment key={s}>
                <span className={`font-body text-[11px] ${step === s ? 'text-foreground' : 'text-foreground/30'}`}>{label}</span>
                {s !== 'preview' && <span className="font-body text-[11px] text-foreground/20">→</span>}
              </React.Fragment>
            ))}
          </div>

          {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 font-body text-xs text-red-400">{error}</p>}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div onClick={() => fileRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-foreground/20 py-10 transition-colors hover:border-foreground/40 hover:bg-foreground/[0.02]">
                <Upload className="h-8 w-8 text-foreground/25" />
                <div className="text-center">
                  <p className="font-body text-sm text-foreground/60">Click to select a CSV file</p>
                  <p className="mt-1 font-body text-xs text-foreground/30">Header row required. UTF-8 encoding.</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </div>
          )}

          {/* Step 2: Map columns */}
          {step === 'map' && (
            <div className="flex flex-col gap-3">
              <p className="font-body text-xs text-foreground/50">Map each CSV column to an inventory field. Columns set to "ignore" will be skipped.</p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-foreground/[0.08]">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-3 border-b border-foreground/[0.06] px-3 py-2 last:border-0">
                    <span className="w-32 shrink-0 truncate font-body text-xs text-foreground/60" title={h}>{h}</span>
                    <span className="font-body text-xs text-foreground/25">→</span>
                    <select value={mapping[h] || '-- ignore --'} onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                      className={inputCls}>
                      {CSV_COL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1 block font-body text-[11px] text-foreground/40">Assign to folder (optional)</label>
                <select value={folderId} onChange={e => setFolderId(e.target.value)} className={inputCls}>
                  <option value="">No folder</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setStep('upload')} className="rounded-xl border border-foreground/[0.12] px-4 py-2 font-body text-xs text-foreground/60 hover:bg-foreground/[0.05]">Back</button>
                <button onClick={buildPreview} className={btnCls}>Preview →</button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="flex flex-col gap-3">
              <p className="font-body text-xs text-foreground/50">{preview.length} item{preview.length !== 1 ? 's' : ''} ready to import.</p>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-foreground/[0.08]">
                <table className="w-full">
                  <thead><tr className="border-b border-foreground/[0.08]">
                    {['Name','SKU','Qty','Category'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-body text-[10px] uppercase tracking-wider text-foreground/30">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {preview.slice(0, 50).map((item, i) => (
                      <tr key={i} className="border-b border-foreground/[0.05] last:border-0">
                        <td className="px-3 py-1.5 font-body text-xs text-foreground">{item.name}</td>
                        <td className="px-3 py-1.5 font-body text-xs text-foreground/50">{item.sku || '—'}</td>
                        <td className="px-3 py-1.5 font-body text-xs text-foreground/50">{item.qty}</td>
                        <td className="px-3 py-1.5 font-body text-xs text-foreground/50">{item.category || '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr><td colSpan={4} className="px-3 py-2 font-body text-[11px] text-foreground/30">…and {preview.length - 50} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setStep('map')} className="rounded-xl border border-foreground/[0.12] px-4 py-2 font-body text-xs text-foreground/60 hover:bg-foreground/[0.05]">Back</button>
                <button onClick={handleImport} className={btnCls}>Import {preview.length} Item{preview.length !== 1 ? 's' : ''}</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AdminInventory() {
  // ── Persistence layer (Supabase when creds set, seed data fallback) ──────────
  const {
    items, folders, tags, trashedItems, settings,
    customFieldDefs,
    loading, toasts, dismissToast,
    handleAddItem,
    handleSaveItem,
    handleUpdateQty,
    handleDeleteItem,
    handleRestoreItem,
    handleDeletePermanent,
    handleBulkDelete:  _handleBulkDelete,
    handleBulkMove:    _handleBulkMove,
    handleAddFolder,
    handleAddTag,
    handleEditTag,
    handleDeleteTag,
    handleAddFieldDef,
    handleEditFieldDef,
    handleDeleteFieldDef,
    handleUpdateSettings,
    fetchItemTransactions,
    isLive,
  } = useInventoryData();

  // ── View state — 'main' | 'detail' | 'edit' | 'add-modal' | 'add-full' ──────
  const [view,     setView]     = useState('main');
  const [viewItem, setViewItem] = useState(null);

  // Keep detail overlay in sync with live item updates
  useEffect(() => {
    if (viewItem) {
      const fresh = items.find(i => i.id === viewItem.id);
      if (fresh) setViewItem(fresh);
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [section,         setSection]         = useState('items');
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['f-root']));

  // ── Layout ───────────────────────────────────────────────────────────────────
  const [layout,      setLayout]      = useState('list');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showFolders, setShowFolders] = useState(true);

  // ── Search + sort + filter ───────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [sortBy,        setSortBy]        = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');
  const [filterStatus,  setFilterStatus]  = useState('all');   // all | low | out | expiring | new
  const [filterTag,     setFilterTag]     = useState('');      // tag id or ''
  const [filterCategory,setFilterCategory]= useState('');      // category string or ''

  // ── Selection ────────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ── Panels / menus ───────────────────────────────────────────────────────────
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showNotifications,  setShowNotifications]  = useState(false);
  const [showMoveModal,      setShowMoveModal]      = useState(false);
  const [showImportModal,    setShowImportModal]    = useState(false);
  const [showBulkTagMenu,    setShowBulkTagMenu]    = useState(false);
  const [folderMenu,         setFolderMenu]         = useState(null);
  const [itemMenu,           setItemMenu]           = useState(null);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [pageSize, setPageSize] = useState(20);
  const [page,     setPage]     = useState(1);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const lowStockCount = useMemo(() => items.filter(i => i.qty > 0 && i.qty <= i.minLevel).length, [items]);

  const visibleItems = useMemo(() => {
    let list = [...items];
    if (currentFolderId) list = list.filter(i => i.folderId === currentFolderId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.sortlyId || '').toLowerCase().includes(q) ||
        (i.supplier || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'low')      list = list.filter(i => i.qty > 0 && i.qty <= i.minLevel);
    if (filterStatus === 'out')      list = list.filter(i => i.qty <= 0);
    if (filterStatus === 'expiring') list = list.filter(i => { const n = daysUntil(i.expirationDate); return n !== null && n <= 14; });
    if (filterStatus === 'new')      list = list.filter(i => i.isNew);
    if (filterTag)                   list = list.filter(i => (i.tags || []).includes(filterTag));
    if (filterCategory)              list = list.filter(i => i.category === filterCategory);
    list.sort((a, b) => {
      let va, vb;
      if (sortBy === 'qty')          { va = a.qty;       vb = b.qty; }
      else if (sortBy === 'price')   { va = a.price;     vb = b.price; }
      else if (sortBy === 'updated') { va = a.updatedAt; vb = b.updatedAt; }
      else                           { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
      return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
    return list;
  }, [items, currentFolderId, search, sortBy, sortDir, filterStatus, filterTag, filterCategory]);

  const visibleFolders = useMemo(
    () => showFolders ? folders.filter(f => f.parentId === currentFolderId) : [],
    [folders, currentFolderId, showFolders]
  );

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleItems.slice(start, start + pageSize);
  }, [visibleItems, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, currentFolderId, sortBy, sortDir, pageSize]);

  const allSelected  = visibleItems.length > 0 && selectedIds.size === visibleItems.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // ── UI-only handlers ─────────────────────────────────────────────────────────
  function toggleExpand(id) {
    setExpandedFolders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === visibleItems.length ? new Set() : new Set(visibleItems.map(i => i.id)));
  }
  function openFolderMenu(folderId, e) {
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setFolderMenu({ folderId, x: r.right + 4, y: r.top });
  }
  function openItemMenu(itemId, e) {
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setItemMenu({ itemId, x: r.right + 4, y: r.top });
  }
  function navigateFolder(id) {
    setCurrentFolderId(id);
    setSelectedIds(new Set());
    setSearch('');
    if (id) setExpandedFolders(prev => new Set([...prev, id]));
  }
  function handleOpenItem(item) { setViewItem(item); setView('detail'); }

  // ── Wrapped handlers (data op + UI nav) ──────────────────────────────────────
  function handleSaveItemAndNav(updated) {
    handleSaveItem(updated);
    setViewItem(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
    setView('detail');
  }
  function handleAddItemAndNav(newItem) {
    handleAddItem(newItem);
    setView('main');
  }
  function handleUpdateQtyLocal(id, newQty) {
    const q = Math.max(0, newQty);
    handleUpdateQty(id, newQty);
    setViewItem(prev => prev && prev.id === id ? { ...prev, qty: q } : prev);
  }
  function handleBulkDeleteLocal() {
    _handleBulkDelete(selectedIds);
    setSelectedIds(new Set());
  }
  function handleBulkMoveLocal(destFolderId) {
    _handleBulkMove(selectedIds, destFolderId);
    setSelectedIds(new Set());
  }

  function handleBulkTagLocal(tagId) {
    setItems(prev => prev.map(i =>
      selectedIds.has(i.id)
        ? { ...i, tags: (i.tags || []).includes(tagId) ? i.tags : [...(i.tags || []), tagId] }
        : i
    ));
    setShowBulkTagMenu(false);
  }

  function handleDuplicateItem(item) {
    const copy = {
      ...item,
      id:        undefined,
      sortlyId:  undefined,
      name:      item.name + ' (Copy)',
      isNew:     true,
      updatedAt: undefined,
      tags:      [...(item.tags || [])],
    };
    handleAddItem(copy);
    setView('main');
    setViewItem(null);
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-10 w-10 animate-spin items-center justify-center rounded-xl border-2 border-foreground/10 border-t-foreground/60" />
            <p className="font-body text-xs text-foreground/30">
              {isLive ? 'Loading inventory…' : 'Starting inventory…'}
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout fullBleed>
    <div className="flex flex-col md:flex-row md:flex-1 md:overflow-hidden relative bg-background text-foreground">
      <h1 className="sr-only">Inventory</h1>

      {/* Icon nav — desktop only */}
      <div className="hidden md:flex h-full shrink-0">
        <IconNav section={section} onSection={setSection} onNotif={() => setShowNotifications(v => !v)} lowStockCount={lowStockCount} />
      </div>

      {/* Folder sidebar — desktop only */}
      <div className="hidden md:flex h-full">
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div key="sidebar" initial={{ width:0, opacity:0 }} animate={{ width:220, opacity:1 }} exit={{ width:0, opacity:0 }} transition={{ ease:EASE, duration:0.25 }} className="shrink-0 overflow-hidden">
              <FolderSidebar folders={folders} currentFolderId={currentFolderId} onSelect={navigateFolder} expandedFolders={expandedFolders} toggleExpand={toggleExpand} onAddFolder={() => setShowAddFolderModal(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar collapse tab — desktop only */}
      <button
        onClick={() => setSidebarOpen(v => !v)}
        title={sidebarOpen ? 'Collapse folders' : 'Expand folders'}
        style={{ left: sidebarOpen ? 271 : 51, top: '50%', transform: 'translateY(-50%)' }}
        className="hidden md:flex absolute z-10 h-10 w-5 items-center justify-center rounded-r-lg border border-l-0 border-foreground/[0.15] bg-muted text-foreground/50 shadow-sm transition-all hover:bg-muted/80 hover:text-foreground/90"
      >
        {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">

        {/* Mobile: folder chips — horizontal scroll row */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2.5 border-b border-foreground/[0.08] overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => navigateFolder(null)}
            className={`shrink-0 rounded-full px-3 py-1 font-body text-xs border transition-colors ${!currentFolderId ? 'bg-accent/15 text-accent border-accent/30' : 'text-foreground/50 border-foreground/[0.12]'}`}
          >
            All
          </button>
          {folders.filter(f => f.parentId === null).map(f => (
            <button
              key={f.id}
              onClick={() => navigateFolder(f.id)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs border transition-colors ${currentFolderId === f.id ? 'bg-accent/15 text-accent border-accent/30' : 'text-foreground/50 border-foreground/[0.12]'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.color }} />
              {f.name}
            </button>
          ))}
        </div>
        {/* ── Items section ─────────────────────────────────────── */}
        {section === 'items' && (
          <>
            <InventoryToolbar
              layout={layout} onLayout={setLayout}
              sortBy={sortBy} sortDir={sortDir}
              onSort={setSortBy} onToggleSortDir={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              search={search} onSearch={setSearch}
              showFolders={showFolders} onToggleFolders={() => setShowFolders(v => !v)}
              onAdd={() => setView('add-modal')} onAddFolder={() => setShowAddFolderModal(true)} onImport={() => setShowImportModal(true)}
            />

            <StatsBar items={items} currentFolderId={currentFolderId} />
            <FilterBar
              items={items} tags={tags}
              filterStatus={filterStatus}   onFilterStatus={v => { setFilterStatus(v); setPage(1); }}
              filterTag={filterTag}         onFilterTag={v => { setFilterTag(v); setPage(1); }}
              filterCategory={filterCategory} onFilterCategory={v => { setFilterCategory(v); setPage(1); }}
            />
            <Breadcrumb folders={folders} currentFolderId={currentFolderId} onNavigate={navigateFolder} />

            {/* Bulk action bar */}
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div key="bulk" initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ ease:EASE, duration:0.2 }}
                  className="flex shrink-0 items-center gap-3 border-b border-foreground/[0.08] bg-foreground/[0.04] px-5 py-2"
                >
                  <span className="font-body text-xs font-semibold text-foreground">{selectedIds.size} selected</span>
                  <div className="mx-2 h-4 w-px bg-foreground/15" />
                  <button onClick={() => setShowMoveModal(true)} className="font-body text-xs text-foreground/60 transition-colors hover:text-foreground">Move</button>
                  {/* Bulk Tag */}
                  <div className="relative">
                    <button onClick={() => setShowBulkTagMenu(v => !v)} className="font-body text-xs text-foreground/60 transition-colors hover:text-foreground">Tag</button>
                    {showBulkTagMenu && tags.length > 0 && (
                      <div className="absolute left-0 top-6 z-50 min-w-[140px] rounded-xl border border-foreground/[0.12] bg-card shadow-2xl py-1">
                        {tags.map(t => (
                          <button key={t.id} onClick={() => handleBulkTagLocal(t.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 font-body text-xs text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => exportToCSV([...items].filter(i => selectedIds.has(i.id)), folders, tags)} className="font-body text-xs text-foreground/60 transition-colors hover:text-foreground">Export</button>
                  <button onClick={handleBulkDeleteLocal} className="font-body text-xs text-red-400 transition-colors hover:text-red-300">Delete</button>
                  <button onClick={() => setSelectedIds(new Set())} className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
              {/* Folder cards row */}
              {visibleFolders.length > 0 && (
                <div className="px-5 pb-3 pt-5">
                  <p className="mb-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/30">Folders</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {visibleFolders.map(folder => (
                      <FolderCard key={folder.id} folder={folder} items={items} onClick={navigateFolder} onMenuOpen={openFolderMenu} />
                    ))}
                  </div>
                </div>
              )}

              {/* Items label */}
              {visibleFolders.length > 0 && (
                <p className="px-5 pb-2 pt-1 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/30">Items ({visibleItems.length})</p>
              )}

              {/* Empty state */}
              {visibleItems.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-24">
                  <Package className="h-10 w-10 text-foreground/15" />
                  <p className="font-body text-sm text-foreground/30">{search || filterStatus !== 'all' || filterTag || filterCategory ? 'No items match your filters.' : 'No items here.'}</p>
                </div>
              )}

              {/* Grid */}
              {layout === 'grid' && visibleItems.length > 0 && (
                <div className="grid gap-4 px-5 pb-6 md:grid-cols-2">
                  {pagedItems.map(item => (
                    <ItemGridCard key={item.id} item={item} tags={tags} isSelected={selectedIds.has(item.id)} onSelect={toggleSelect} onOpen={handleOpenItem} onMenuOpen={openItemMenu} />
                  ))}
                </div>
              )}

              {/* List */}
              {layout === 'list' && visibleItems.length > 0 && (
                <div className="pb-6">
                  <div className="flex items-center gap-4 border-b border-foreground/[0.08] px-4 py-2">
                    <button onClick={toggleSelectAll}
                      className={`shrink-0 flex h-4 w-4 items-center justify-center rounded border transition-colors ${allSelected ? 'border-foreground bg-foreground text-background' : someSelected ? 'border-foreground/50 bg-foreground/20' : 'border-foreground/25 text-transparent'}`}
                    >
                      {(allSelected || someSelected) && <Check className="h-2.5 w-2.5" />}
                    </button>
                    <span className="h-10 w-10 shrink-0" />
                    <span className="flex-1 font-body text-[10px] uppercase tracking-wider text-foreground/30">Name</span>
                    <span className="w-24 shrink-0 text-right font-body text-[10px] uppercase tracking-wider text-foreground/30">Stock</span>
                    <span className="w-20 shrink-0 text-right font-body text-[10px] uppercase tracking-wider text-foreground/30">Price</span>
                    <span className="w-7 shrink-0" />
                  </div>
                  {pagedItems.map(item => (
                    <ItemListRow key={item.id} item={item} tags={tags} isSelected={selectedIds.has(item.id)} onSelect={toggleSelect} onOpen={handleOpenItem} onMenuOpen={openItemMenu} />
                  ))}
                </div>
              )}

              {/* Table */}
              {layout === 'table' && visibleItems.length > 0 && (
                <div className="pb-6">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-foreground/[0.08] bg-foreground/[0.02]">
                        <th className="w-10 px-3 py-2.5">
                          <button onClick={toggleSelectAll}
                            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${allSelected ? 'border-foreground bg-foreground text-background' : someSelected ? 'border-foreground/50 bg-foreground/20' : 'border-foreground/25 text-transparent'}`}
                          >
                            {(allSelected || someSelected) && <Check className="h-2.5 w-2.5" />}
                          </button>
                        </th>
                        <th className="w-10 px-2 py-2.5" />
                        {['Name','Quantity','Price','Status','Expiry'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-body text-[10px] uppercase tracking-wider text-foreground/35">{h}</th>
                        ))}
                        <th className="w-10 px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedItems.map(item => (
                        <ItemTableRow key={item.id} item={item} tags={tags} isSelected={selectedIds.has(item.id)} onSelect={toggleSelect} onOpen={handleOpenItem} onMenuOpen={openItemMenu} />
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between border-t border-foreground/[0.08] px-5 py-3">
                    <span className="font-body text-xs text-foreground/35">
                      {visibleItems.length === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, visibleItems.length)}`} of {visibleItems.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-foreground/[0.10] text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-30">
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <span className="font-body text-xs text-foreground/40">{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-foreground/[0.10] text-foreground/40 transition-colors hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-30">
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      <div className="ml-2 flex items-center gap-1.5">
                        <span className="font-body text-xs text-foreground/35">Show</span>
                        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); }}
                          className="rounded-lg border border-foreground/[0.10] bg-muted px-2 py-1 font-body text-xs text-foreground focus:outline-none"
                        >
                          <option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {section === 'tags'     && <TagsView tags={tags} items={items} onAddTag={handleAddTag} onEditTag={handleEditTag} onDeleteTag={handleDeleteTag} />}
        {section === 'reports'  && <ReportsView items={items} folders={folders} tags={tags} />}
        {section === 'trash'    && <TrashView trashedItems={trashedItems} onRestore={handleRestoreItem} onDeletePermanent={handleDeletePermanent} />}
        {section === 'settings' && (
          <SettingsView
            settings={settings}
            onSave={handleUpdateSettings}
            customFieldDefs={customFieldDefs}
            onAddFieldDef={handleAddFieldDef}
            onEditFieldDef={handleEditFieldDef}
            onDeleteFieldDef={handleDeleteFieldDef}
            tags={tags}
            onAddTag={handleAddTag}
            onEditTag={handleEditTag}
            onDeleteTag={handleDeleteTag}
          />
        )}
      </div>

      {/* Full-page overlays (detail / edit / add) */}
      <AnimatePresence>
        {view === 'detail' && viewItem && (
          <ItemDetailPage key="detail" item={viewItem} folders={folders} tags={tags}
            customFieldDefs={customFieldDefs}
            onClose={() => { setView('main'); setViewItem(null); }}
            onEdit={() => setView('edit')}
            onDuplicate={() => handleDuplicateItem(viewItem)}
            onUpdateQty={handleUpdateQtyLocal}
            onFetchTransactions={fetchItemTransactions}
          />
        )}
        {view === 'edit' && viewItem && (
          <ItemEditPage key="edit" item={viewItem} folders={folders} tags={tags}
            customFieldDefs={customFieldDefs}
            onClose={() => setView('detail')}
            onSave={handleSaveItemAndNav}
          />
        )}
        {view === 'add-modal' && (
          <AddItemModal key="add-modal" folders={folders}
            onClose={() => setView('main')}
            onSave={handleAddItemAndNav}
            onShowAll={() => setView('add-full')}
          />
        )}
        {view === 'add-full' && (
          <AddItemFullPage key="add-full" folders={folders}
            customFieldDefs={customFieldDefs}
            onClose={() => setView('main')}
            onSave={handleAddItemAndNav}
          />
        )}
      </AnimatePresence>

      {/* Panel overlays */}
      <AnimatePresence>
        {showNotifications  && <NotificationsPanel key="notif" items={items} onClose={() => setShowNotifications(false)} />}
        {folderMenu         && <FolderContextMenu  key="fmenu" x={folderMenu.x} y={folderMenu.y} onClose={() => setFolderMenu(null)} />}
        {itemMenu           && <ItemContextMenu    key="imenu" x={itemMenu.x}   y={itemMenu.y}   onClose={() => setItemMenu(null)} />}
        {showAddFolderModal && <AddFolderModal     key="afm"   folders={folders} onClose={() => setShowAddFolderModal(false)} onSave={handleAddFolder} />}
        {showMoveModal      && <MoveFolderModal    key="move"  folders={folders} selectedCount={selectedIds.size} onClose={() => setShowMoveModal(false)} onMove={handleBulkMoveLocal} />}
        {showImportModal    && <CSVImportModal     key="import" folders={folders} onClose={() => setShowImportModal(false)} onImport={handleAddItem} />}
      </AnimatePresence>

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48, opacity: 0 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm font-body text-sm
                ${t.type === 'error'   ? 'border-red-500/20 bg-red-950/80 text-red-300' :
                  t.type === 'success' ? 'border-emerald-500/20 bg-emerald-950/80 text-emerald-300' :
                  'border-foreground/10 bg-muted/95 text-foreground/80'}`}
            >
              <span>{t.msg}</span>
              <button onClick={() => dismissToast(t.id)} className="ml-1 text-current/50 hover:text-current">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Live indicator — small badge when connected to Supabase */}
      {isLive && (
        <div className="pointer-events-none fixed bottom-6 left-16 z-[200]">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-950/60 px-2.5 py-1 font-body text-[10px] text-emerald-400/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
            Live
          </span>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
