import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, Loader2, PackageCheck,
  RefreshCw, Search, Stethoscope,
} from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet } from '@/lib/apiClient';
import { useSeo } from '@/lib/seo';

const PROVIDER_NAV_ITEMS = [
  { label: 'Shifts', to: '/provider/shifts', icon: CalendarDays },
  { label: 'Services', to: '/provider/services', icon: Stethoscope },
  { label: 'Invoices', to: '/provider/invoices', icon: FileText },
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCKED_MARKER = /(?:^|[\s_-])(demo|draft|fixture|sample|test)(?:$|[\s_-])/i;
const SAFE_RESPONSE_KEYS = new Set(['source', 'generated_at', 'offerings']);
const SAFE_NURSE_KEYS = new Set([
  'id', 'public_name', 'type', 'status', 'version', 'estimated_duration_minutes',
  'nurse_instructions', 'required_supplies', 'availability', 'category',
  'protocol_reference', 'allowed_addons', 'inventory_requirements',
]);
const SAFE_CATEGORY_KEYS = new Set(['key', 'name', 'display_order']);
const SAFE_AVAILABILITY_KEYS = new Set(['available']);
const SAFE_ADDON_KEYS = new Set(['id', 'public_name']);
const SAFE_REQUIREMENT_KEYS = new Set(['item_name', 'quantity', 'unit']);

function objectOnly(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowlist) {
  return objectOnly(value)
    && Object.keys(value).length === allowlist.size
    && Object.keys(value).every((key) => allowlist.has(key));
}

function safeText(value, max = 2000) {
  if (value == null) return '';
  const text = String(value).trim();
  return text.length <= max ? text : '';
}

function safeStringArray(value, max = 60) {
  if (!Array.isArray(value) || value.length > max) return null;
  if (value.some((item) => typeof item !== 'string')) return null;
  const rows = value.map((item) => safeText(item, 240));
  return rows.every(Boolean) ? rows : null;
}

function normalizeNurseOffering(row) {
  if (!exactKeys(row, SAFE_NURSE_KEYS)) return null;
  if (!exactKeys(row.category, SAFE_CATEGORY_KEYS)) return null;
  if (!exactKeys(row.availability, SAFE_AVAILABILITY_KEYS) || row.availability.available !== true) return null;
  if (!Array.isArray(row.allowed_addons) || row.allowed_addons.some((item) => !exactKeys(item, SAFE_ADDON_KEYS))) return null;
  if (!Array.isArray(row.inventory_requirements) || row.inventory_requirements.some((item) => !exactKeys(item, SAFE_REQUIREMENT_KEYS))) return null;
  if (['id', 'public_name', 'type', 'status', 'nurse_instructions'].some((key) => typeof row[key] !== 'string')) return null;
  if (row.protocol_reference != null && typeof row.protocol_reference !== 'string') return null;
  if (typeof row.category.key !== 'string' || typeof row.category.name !== 'string') return null;

  const id = safeText(row.id, 120);
  const publicName = safeText(row.public_name, 160);
  const type = safeText(row.type, 60);
  const categoryKey = safeText(row.category.key, 120);
  const categoryName = safeText(row.category.name, 160);
  const instructions = safeText(row.nurse_instructions, 5000);
  const protocolReference = safeText(row.protocol_reference, 240);
  const requiredSupplies = safeStringArray(row.required_supplies);
  const version = Number(row.version);
  const duration = row.estimated_duration_minutes == null ? null : Number(row.estimated_duration_minutes);
  const categoryDisplayOrder = Number(row.category.display_order);

  if (!id || UUID_RE.test(id) || !/^[a-z0-9][a-z0-9_-]+$/i.test(id)) return null;
  if (!publicName || !type || !categoryKey || !categoryName || !instructions || row.status !== 'active') return null;
  if (UUID_RE.test(categoryKey) || !/^[a-z0-9][a-z0-9_-]+$/i.test(categoryKey)) return null;
  if (protocolReference && UUID_RE.test(protocolReference)) return null;
  if (BLOCKED_MARKER.test(`${id} ${publicName} ${categoryKey} ${row.status}`)) return null;
  if (typeof row.version !== 'number' || !Number.isInteger(version) || version < 1 || !requiredSupplies) return null;
  if (typeof row.category.display_order !== 'number' || !Number.isInteger(categoryDisplayOrder)) return null;
  if (duration != null && (typeof row.estimated_duration_minutes !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 1440)) return null;

  const allowedAddons = row.allowed_addons.map((addon) => {
    if (typeof addon.id !== 'string' || typeof addon.public_name !== 'string') return null;
    const addonId = safeText(addon.id, 120);
    const addonName = safeText(addon.public_name, 160);
    return addonId && addonName && !UUID_RE.test(addonId) && /^[a-z0-9][a-z0-9_-]+$/i.test(addonId)
      ? { id: addonId, publicName: addonName }
      : null;
  });
  if (allowedAddons.some((item) => !item)) return null;

  const inventoryRequirements = row.inventory_requirements.map((requirement) => {
    if (typeof requirement.item_name !== 'string' || typeof requirement.unit !== 'string') return null;
    const itemName = safeText(requirement.item_name, 200);
    const unit = safeText(requirement.unit, 60);
    const quantity = Number(requirement.quantity);
    return itemName && unit && typeof requirement.quantity === 'number' && Number.isFinite(quantity) && quantity > 0
      ? { itemName, unit, quantity }
      : null;
  });
  if (inventoryRequirements.some((item) => !item)) return null;

  return {
    id,
    publicName,
    type,
    version,
    duration,
    instructions,
    protocolReference,
    requiredSupplies,
    allowedAddons,
    inventoryRequirements,
    category: {
      key: categoryKey,
      name: categoryName,
      displayOrder: categoryDisplayOrder,
    },
  };
}

function normalizeNurseCatalog(payload) {
  if (!exactKeys(payload, SAFE_RESPONSE_KEYS)
    || payload.source !== 'live'
    || typeof payload.generated_at !== 'string'
    || Number.isNaN(Date.parse(payload.generated_at))
    || !Array.isArray(payload.offerings)) {
    throw new Error('The live service menu is not ready.');
  }
  const offerings = payload.offerings.map(normalizeNurseOffering);
  if (offerings.some((item) => !item) || offerings.length !== payload.offerings.length) {
    throw new Error('The service menu did not pass its nurse-safe response contract.');
  }
  return offerings.sort((a, b) => (
    a.category.displayOrder - b.category.displayOrder
    || a.category.name.localeCompare(b.category.name)
    || a.publicName.localeCompare(b.publicName)
  ));
}

function OfferingCard({ offering }) {
  return (
    <article className="av-glass-card overflow-hidden rounded-[1.9rem] border border-foreground/[0.1] bg-background/68 p-5 shadow-[0_24px_80px_hsl(var(--foreground)/0.055)] backdrop-blur-2xl md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/42">{offering.type.replace(/_/g, ' ')}</p>
          <h2 className="mt-2 font-heading text-3xl uppercase leading-[0.92] text-foreground">{offering.publicName}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {offering.duration ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background/55 px-3 py-1.5 font-body text-[10px] font-semibold text-foreground/55">
              <Clock3 className="h-3.5 w-3.5" />{offering.duration} min
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-500/[0.08] px-3 py-1.5 font-body text-[10px] font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />Active
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-foreground/[0.08] bg-background/45 p-4">
          <div className="flex items-center gap-2 text-foreground/70">
            <BookOpen className="h-4 w-4" />
            <h3 className="font-body text-[10px] font-bold uppercase tracking-[0.16em]">Nurse instructions</h3>
          </div>
          <p className="mt-3 whitespace-pre-line font-body text-[12px] leading-relaxed text-foreground/58">
            {offering.instructions}
          </p>
          {offering.protocolReference ? (
            <p className="mt-3 rounded-xl bg-foreground/[0.045] px-3 py-2 font-body text-[10px] text-foreground/55">
              Protocol reference: <strong className="font-semibold text-foreground/75">{offering.protocolReference}</strong>
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-foreground/[0.08] bg-background/45 p-4">
          <div className="flex items-center gap-2 text-foreground/70">
            <PackageCheck className="h-4 w-4" />
            <h3 className="font-body text-[10px] font-bold uppercase tracking-[0.16em]">Requirements</h3>
          </div>
          {offering.requiredSupplies.length || offering.inventoryRequirements.length ? (
            <ul className="mt-3 space-y-2 font-body text-[12px] leading-relaxed text-foreground/58">
              {offering.requiredSupplies.map((supply) => <li key={`supply-${supply}`}>• {supply}</li>)}
              {offering.inventoryRequirements.map((item) => (
                <li key={`inventory-${item.itemName}`}>• {item.itemName} — {item.quantity} {item.unit}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/48">No additional mapped supplies.</p>
          )}
          {offering.allowedAddons.length ? (
            <div className="mt-4 border-t border-foreground/[0.08] pt-3">
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/38">Allowed add-ons</p>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/55">
                {offering.allowedAddons.map((addon) => addon.publicName).join(' · ')}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </article>
  );
}

export default function Services() {
  useSeo({
    title: 'Service Menu — Avalon Vitality',
    description: 'Nurse-safe live service instructions and supply requirements.',
    path: '/provider/services',
    robots: 'noindex, nofollow, noarchive',
  });
  const [state, setState] = useState({ loading: true, error: '', offerings: [] });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await apiGet('/api/me/catalog?audience=nurse');
      setState({ loading: false, error: '', offerings: normalizeNurseCatalog(payload) });
    } catch (error) {
      setState({ loading: false, error: error?.message || 'The service menu is unavailable.', offerings: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const unique = new Map();
    for (const offering of state.offerings) unique.set(offering.category.key, offering.category);
    return [...unique.values()].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }, [state.offerings]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.offerings.filter((offering) => {
      if (category !== 'all' && offering.category.key !== category) return false;
      if (!needle) return true;
      return [
        offering.publicName, offering.type, offering.category.name, offering.instructions,
        offering.protocolReference, ...offering.requiredSupplies,
        ...offering.inventoryRequirements.map((item) => item.itemName),
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [category, query, state.offerings]);

  if (!state.loading && state.error) {
    return (
      <main className="min-h-dvh bg-background px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
        <section className="mx-auto max-w-5xl">
          <OperationalSourceUnavailable
            title="Service menu unavailable"
            description="The current nurse instructions and supply requirements could not be verified. No cached menu, pricing, costs, or sample protocols are shown."
          />
        </section>
        <MobileNavBar items={PROVIDER_NAV_ITEMS} columns={3} maxWidth="shift" mobileOnly={false} ariaLabel="Provider operations" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.08),transparent_28rem),hsl(var(--background))] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/42">Clinical operations</p>
            <h1 className="mt-2 font-heading text-5xl uppercase leading-none md:text-6xl">Service menu</h1>
            <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-foreground/52">
              Current nurse instructions, protocol references, and mapped supply requirements.
            </p>
          </div>
          <button type="button" onClick={load} disabled={state.loading} className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15 bg-background/65 backdrop-blur-xl disabled:opacity-50" aria-label="Refresh service menu">
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {state.offerings.length ? <div className="av-glass-card mt-7 rounded-[1.75rem] border border-foreground/[0.1] bg-background/62 p-3 shadow-[0_24px_80px_hsl(var(--foreground)/0.045)] backdrop-blur-2xl">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-foreground/[0.035] px-4">
            <Search className="h-4 w-4 text-foreground/38" />
            <span className="sr-only">Search the service menu</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services, protocols, or supplies" className="w-full bg-transparent font-body text-sm text-foreground outline-none placeholder:text-foreground/35" />
          </label>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            <button type="button" onClick={() => setCategory('all')} className={`min-h-9 shrink-0 rounded-full px-4 font-body text-[9px] font-bold uppercase tracking-[0.14em] ${category === 'all' ? 'bg-foreground text-background' : 'text-foreground/52'}`}>All</button>
            {categories.map((item) => (
              <button type="button" key={item.key} onClick={() => setCategory(item.key)} className={`min-h-9 shrink-0 rounded-full px-4 font-body text-[9px] font-bold uppercase tracking-[0.14em] ${category === item.key ? 'bg-foreground text-background' : 'text-foreground/52'}`}>{item.name}</button>
            ))}
          </div>
        </div> : null}

        {state.loading ? (
          <p className="mt-8 flex items-center justify-center gap-2 rounded-3xl border border-foreground/10 p-10 font-body text-sm text-foreground/50" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />Loading the live service menu
          </p>
        ) : null}

        {!state.loading && !state.offerings.length ? (
          <div className="av-glass-card mt-7 flex min-h-72 items-center justify-center rounded-[1.9rem] border border-foreground/[0.1] bg-background/68 p-8 text-center shadow-[0_24px_80px_hsl(var(--foreground)/0.055)] backdrop-blur-2xl">
            <div className="max-w-md"><BookOpen className="mx-auto h-7 w-7 text-foreground/28" /><h2 className="mt-5 font-heading text-4xl uppercase leading-none text-foreground">No nurse-approved services published</h2><p className="mt-3 font-body text-sm leading-relaxed text-foreground/52">The live Catalog is connected and currently has no services with human-approved nurse instructions. Nothing cached, inferred, or drafted is shown.</p></div>
          </div>
        ) : null}

        {!state.loading && state.offerings.length ? (
          <div className="mt-5 grid gap-4">
            {visible.map((offering) => <OfferingCard key={offering.id} offering={offering} />)}
            {!visible.length ? (
              <p className="rounded-[1.75rem] border border-dashed border-foreground/15 p-10 text-center font-body text-sm text-foreground/45">No services match this search.</p>
            ) : null}
          </div>
        ) : null}
      </section>
      <MobileNavBar items={PROVIDER_NAV_ITEMS} columns={3} maxWidth="shift" mobileOnly={false} ariaLabel="Provider operations" />
    </main>
  );
}
