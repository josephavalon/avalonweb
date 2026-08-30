import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Database,
  Eye,
  FileClock,
  Filter,
  Layers3,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  Users,
  X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { useSeo } from '@/lib/seo';

const SECTIONS = Object.freeze([
  { key: 'overview', label: 'Overview', icon: Sparkles },
  { key: 'services', label: 'Services', icon: ShieldCheck },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'packages', label: 'Packages', icon: Layers3 },
  { key: 'addons', label: 'Add-Ons', icon: Plus },
  { key: 'pricing', label: 'Pricing', icon: CircleDollarSign },
  { key: 'categories', label: 'Categories', icon: Tag },
  { key: 'availability', label: 'Availability', icon: MapPin },
  { key: 'inventory', label: 'Inventory Mapping', icon: Boxes },
  { key: 'audit', label: 'Audit/History', icon: FileClock },
]);

const OFFERING_TYPES = Object.freeze([
  ['iv_treatment', 'IV Treatment'],
  ['im_injection', 'IM Injection'],
  ['add_on', 'Add-On'],
  ['service', 'Service'],
  ['product', 'Product'],
  ['package', 'Package'],
  ['membership_benefit', 'Membership Benefit'],
  ['event_offering', 'Event Offering'],
  ['consultation', 'Consultation'],
  ['fee', 'Fee'],
  ['other', 'Other'],
]);

const OFFERING_TYPE_VALUES = new Set(OFFERING_TYPES.map(([value]) => value));
const OFFERING_TYPE_LABELS = new Map(OFFERING_TYPES);

function canonicalOfferingType(value) {
  const raw = String(value || '').trim();
  if (OFFERING_TYPE_VALUES.has(raw)) return raw;
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (OFFERING_TYPE_VALUES.has(normalized)) return normalized;
  return 'other';
}

function offeringTypeLabel(value) {
  return OFFERING_TYPE_LABELS.get(canonicalOfferingType(value)) || 'Other';
}

const VISIBILITY_OPTIONS = Object.freeze([
  ['client', 'Client'],
  ['nurse', 'Nurse'],
  ['np', 'NP'],
  ['physician', 'Physician'],
  ['admin', 'Admin'],
  ['event', 'Event'],
  ['membership', 'Membership'],
  ['partner', 'Partner'],
  ['public', 'Public website'],
  ['private_link', 'Private link'],
]);

const LIST_TYPES = Object.freeze({
  services: new Set(['iv_treatment', 'im_injection', 'service', 'event_offering', 'consultation', 'fee', 'membership_benefit', 'other']),
  products: new Set(['product']),
  packages: new Set(['package']),
  addons: new Set(['add_on']),
});

const SURFACE = 'rounded-[1.6rem] border border-foreground/[0.09] bg-white/[0.52] shadow-[0_18px_60px_rgba(75,57,38,0.055)] backdrop-blur-2xl';
const INPUT = 'w-full rounded-xl border border-foreground/[0.12] bg-white/55 px-3.5 py-2.5 font-body text-sm text-foreground outline-none transition focus:border-foreground/30 focus:bg-white/75 focus:ring-4 focus:ring-foreground/[0.035] placeholder:text-foreground/28';
const LABEL = 'mb-1.5 block font-body text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/45';
const BUTTON_PRIMARY = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 font-body text-[11px] font-bold uppercase tracking-[0.13em] text-background shadow-sm transition hover:-translate-y-px hover:shadow-lg disabled:pointer-events-none disabled:opacity-35';
const BUTTON_SECONDARY = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-foreground/[0.13] bg-white/45 px-4 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/70 transition hover:border-foreground/25 hover:bg-white/75 hover:text-foreground disabled:pointer-events-none disabled:opacity-35';

const EMPTY_VISIBILITY = Object.freeze({
  ...Object.fromEntries(VISIBILITY_OPTIONS.map(([key]) => [key, false])),
  admin: true,
});

// Vite replaces DEV at build time. Keeping the whole bridge behind a top-level
// conditional lets Rollup erase the loader, URL, and fallback handling from
// the production Catalog chunk after the pre-transform step.
const loadDevelopmentPreview = import.meta.env.DEV
  ? async () => {
      const previewModuleUrl = new URL('/app-modules/pages/admin/catalogPreviewFallback.js', window.location.origin).href;
      const { getCurrentMenuPreview } = await import(previewModuleUrl);
      return getCurrentMenuPreview();
    }
  : null;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function bool(value) {
  return value === true;
}

function normalizeVisibility(row = {}) {
  const source = row.visibility && typeof row.visibility === 'object'
    ? row.visibility
    : row.visibility_by_audience && typeof row.visibility_by_audience === 'object'
      ? row.visibility_by_audience
      : {};
  return Object.fromEntries(VISIBILITY_OPTIONS.map(([key]) => [
    key,
    bool(firstDefined(
      source[key],
      key === 'public' ? source.public_website : undefined,
      row[`${key}_visible`],
      key === 'public' ? row.public_visible : undefined,
    )),
  ]));
}

function normalizeOffering(row, categoryById) {
  if (!row || typeof row !== 'object') return null;
  const id = String(firstDefined(row.id, row.offering_id, row.stable_key, '')).trim();
  if (!id) return null;
  const categoryId = firstDefined(row.category_id, row.category?.id, null);
  return {
    ...row,
    id,
    stable_key: String(firstDefined(row.stable_key, row.key, id)),
    internal_name: String(firstDefined(row.internal_name, row.internalName, row.name, '')).trim(),
    public_name: String(firstDefined(row.public_name, row.publicName, row.name, '')).trim(),
    short_name: String(firstDefined(row.short_name, row.shortName, '')).trim(),
    sku: firstDefined(row.sku, row.internal_code, null),
    type: canonicalOfferingType(firstDefined(row.type, row.offering_type, 'other')),
    category_id: categoryId,
    category_name: String(firstDefined(row.category_name, row.category?.name, categoryById.get(String(categoryId))?.name, 'Uncategorized')),
    status: String(firstDefined(row.status, 'draft')).toLowerCase(),
    base_price_cents: firstDefined(row.base_price_cents, row.retail_price_cents, row.price_cents, null),
    internal_cost_cents: firstDefined(row.internal_cost_cents, row.cost_cents, row.estimated_cogs_cents, null),
    estimated_duration_minutes: firstDefined(row.estimated_duration_minutes, row.duration_minutes, null),
    duration_label: String(firstDefined(row.duration_label, row.duration, '')),
    short_description: String(firstDefined(row.short_description, row.description, '')).trim(),
    client_description: String(firstDefined(row.client_description, row.public_description, row.description, '')).trim(),
    nurse_instructions: String(firstDefined(row.nurse_instructions, row.fulfillment_instructions, '')).trim(),
    protocol_reference: String(firstDefined(row.protocol_reference, row.protocol_ref, '')).trim(),
    thumbnail_url: firstDefined(row.thumbnail_url, row.thumbnail, null),
    hero_url: firstDefined(row.hero_url, row.hero_image, null),
    visibility: normalizeVisibility(row),
    locations: asArray(firstDefined(row.locations, row.available_locations, [])),
    availability: asArray(firstDefined(row.availability, row.availability_rules, [])),
    inventory_requirements: asArray(firstDefined(row.inventory_requirements, row.inventory_mappings, row.required_supplies, [])),
    allowed_addons: asArray(firstDefined(row.allowed_addons, row.addons, [])),
    last_updated: firstDefined(row.last_updated, row.updated_at, null),
    display_order: Number(firstDefined(row.display_order, 0)) || 0,
  };
}

function normalizeDashboard(payload) {
  const root = payload?.dashboard && typeof payload.dashboard === 'object'
    ? payload.dashboard
    : payload?.catalog && typeof payload.catalog === 'object'
      ? payload.catalog
      : payload;
  const source = firstDefined(payload?.source, root?.source);
  if (!root || typeof root !== 'object' || source !== 'live' || !Array.isArray(root.offerings)) {
    throw new Error('Catalog did not return a verified live source.');
  }
  const categories = asArray(firstDefined(root.categories, root.category_rows, [])).filter((row) => row && typeof row === 'object');
  const categoryById = new Map(categories.map((row) => [String(row.id), row]));
  const offerings = root.offerings.map((row) => normalizeOffering(row, categoryById));
  if (offerings.some((row) => !row)) throw new Error('Catalog returned an invalid offering record.');
  return {
    source: 'live',
    imported: bool(firstDefined(root.imported, root.import_complete, true)),
    readiness: root.readiness && typeof root.readiness === 'object'
      ? {
          ready: root.readiness.ready === true,
          code: String(root.readiness.code || ''),
          latest_import: root.readiness.latest_import || null,
        }
      : { ready: false, code: 'catalog_readiness_unverified', latest_import: null },
    offerings,
    categories,
    pricing_rules: asArray(firstDefined(root.pricing_rules, root.price_rules, root.prices, [])),
    availability_rules: asArray(firstDefined(root.availability_rules, [])),
    inventory_mappings: asArray(firstDefined(root.inventory_mappings, root.inventory_requirements, [])),
    audit_history: asArray(firstDefined(root.audit_history, root.audit, root.history, [])),
  };
}

function cents(value) {
  if (value === '' || value === undefined || value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function formatMoney(value) {
  const amount = cents(value);
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

function formatDate(value, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replace(/_/g, ' ');
}

function marginFor(offering) {
  const price = cents(offering.base_price_cents);
  const cost = cents(offering.internal_cost_cents);
  if (price === null || cost === null || price <= 0) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

function visibleTo(offering, audience) {
  if (audience === 'admin') return true;
  return bool(offering.visibility?.[audience]);
}

function statusTone(status) {
  if (status === 'active') return 'border-emerald-700/15 bg-emerald-700/[0.08] text-emerald-900';
  if (status === 'scheduled') return 'border-blue-700/15 bg-blue-700/[0.08] text-blue-900';
  if (status === 'archived' || status === 'inactive') return 'border-foreground/10 bg-foreground/[0.035] text-foreground/45';
  return 'border-amber-700/15 bg-amber-700/[0.08] text-amber-900';
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.13em] ${statusTone(status)}`}>
      {status || 'draft'}
    </span>
  );
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full border transition ${checked ? 'border-foreground bg-foreground' : 'border-foreground/20 bg-foreground/[0.06]'} disabled:opacity-35`}
    >
      <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-transform ${checked ? 'translate-x-[19px] bg-background' : 'translate-x-[3px] bg-foreground/50'}`} />
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[32rem] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-foreground/35" />
        <p className="mt-4 font-body text-xs font-semibold uppercase tracking-[0.16em] text-foreground/38">Loading verified catalog</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, accent = false }) {
  return (
    <div className={`${SURFACE} min-w-0 p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">{label}</p>
          <p className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.01em] text-foreground">{value}</p>
          <p className="mt-2 min-h-8 font-body text-xs leading-relaxed text-foreground/48">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${accent ? 'bg-foreground text-background' : 'border border-foreground/[0.08] bg-white/45 text-foreground/50'}`}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function CatalogEmpty({ onCreate, onImport, readOnly }) {
  return (
    <div className={`${SURFACE} flex min-h-[26rem] items-center justify-center px-6 py-16 text-center`}>
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-foreground/[0.1] bg-white/55">
          <Database className="h-5 w-5 text-foreground/35" />
        </div>
        <h3 className="mt-6 font-heading text-4xl uppercase leading-none text-foreground">No offerings yet</h3>
        <p className="mt-3 font-body text-sm leading-relaxed text-foreground/50">
          Start with a private draft or import Avalon's currently verified menu into the centralized Catalog.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onCreate} disabled={readOnly} className={BUTTON_PRIMARY}><Plus className="h-3.5 w-3.5" /> New offering</button>
          <button type="button" onClick={onImport} className={BUTTON_SECONDARY}><Upload className="h-3.5 w-3.5" /> Import current menu</button>
        </div>
      </div>
    </div>
  );
}

function SectionNavigation({ active, onChange }) {
  return (
    <div className={`${SURFACE} overflow-hidden p-1.5`}>
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[1.15rem] px-3.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] transition ${active === key ? 'bg-foreground text-background shadow-sm' : 'text-foreground/48 hover:bg-white/55 hover:text-foreground'}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterBar({ query, setQuery, status, setStatus, type, setType, category, setCategory, categories, count }) {
  return (
    <div className={`${SURFACE} p-3`}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search offerings</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, SKU, type, or category"
            className={`${INPUT} pl-10`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex">
          <label className="relative">
            <span className="sr-only">Filter by status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${INPUT} min-w-32 appearance-none pr-9`}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35" />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by type</span>
            <select value={type} onChange={(event) => setType(event.target.value)} className={`${INPUT} min-w-36 appearance-none pr-9`}>
              <option value="all">All types</option>
              {OFFERING_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35" />
          </label>
          <label className="relative col-span-2 sm:col-span-1">
            <span className="sr-only">Filter by category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={`${INPUT} min-w-36 appearance-none pr-9`}>
              <option value="all">All categories</option>
              {categories.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.name || 'Unnamed'}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35" />
          </label>
        </div>
        <span className="shrink-0 px-2 text-right font-body text-[10px] font-bold uppercase tracking-[0.13em] text-foreground/38">{count} shown</span>
      </div>
    </div>
  );
}

function VisibilityDots({ offering }) {
  const shown = [['client', 'Client'], ['nurse', 'Nurse'], ['event', 'Event'], ['membership', 'Member']];
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(([key, label]) => (
        <span key={key} className={`rounded-full border px-2 py-1 font-body text-[8px] font-bold uppercase tracking-[0.11em] ${offering.visibility[key] ? 'border-foreground/13 bg-foreground/[0.065] text-foreground/70' : 'border-foreground/[0.07] text-foreground/25'}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

function OfferingActions({ offering, readOnly, onPreview, onEdit, onDuplicate, onArchive }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={() => onPreview(offering)} className="rounded-xl p-2 text-foreground/40 transition hover:bg-white/70 hover:text-foreground" aria-label={`Preview ${offering.public_name || offering.internal_name}`}><Eye className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => onEdit(offering)} disabled={readOnly} className="rounded-xl p-2 text-foreground/40 transition hover:bg-white/70 hover:text-foreground disabled:opacity-25" aria-label={`Edit ${offering.public_name || offering.internal_name}`}><Pencil className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => onDuplicate(offering)} disabled={readOnly} className="rounded-xl p-2 text-foreground/40 transition hover:bg-white/70 hover:text-foreground disabled:opacity-25" aria-label={`Duplicate ${offering.public_name || offering.internal_name}`}><Copy className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => onArchive(offering)} disabled={readOnly || offering.status === 'archived'} className="rounded-xl p-2 text-foreground/40 transition hover:bg-white/70 hover:text-foreground disabled:opacity-25" aria-label={`Archive ${offering.public_name || offering.internal_name}`}><Archive className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function OfferingsTable({ rows, readOnly, onPreview, onEdit, onDuplicate, onArchive }) {
  if (!rows.length) {
    return (
      <div className={`${SURFACE} flex min-h-64 items-center justify-center p-8 text-center`}>
        <div>
          <Filter className="mx-auto h-5 w-5 text-foreground/28" />
          <p className="mt-4 font-heading text-3xl uppercase leading-none text-foreground">No matching offerings</p>
          <p className="mt-2 font-body text-xs text-foreground/45">Adjust the search or filters to see more of the Catalog.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead>
            <tr className="border-b border-foreground/[0.08] bg-white/25">
              {['Service', 'Category', 'Type', 'Retail price', 'Internal cost', 'Margin', 'Visibility', 'Locations', 'Status', 'Last updated', ''].map((label) => (
                <th key={label} className="px-3 py-3 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/36 first:pl-5 last:pr-4">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((offering) => {
              const margin = marginFor(offering);
              return (
                <tr key={offering.id} className="group border-b border-foreground/[0.065] transition last:border-0 hover:bg-white/38">
                  <td className="max-w-[260px] px-3 py-4 pl-5">
                    <button type="button" onClick={() => onPreview(offering)} className="block w-full text-left">
                      <span className="block truncate font-body text-sm font-semibold text-foreground">{offering.public_name || offering.internal_name || 'Untitled offering'}</span>
                      <span className="mt-1 block truncate font-body text-[10px] uppercase tracking-[0.1em] text-foreground/34">{offering.sku || offering.stable_key}</span>
                    </button>
                  </td>
                  <td className="px-3 py-4 font-body text-xs text-foreground/58">{offering.category_name}</td>
                  <td className="px-3 py-4 font-body text-xs text-foreground/58">{offeringTypeLabel(offering.type)}</td>
                  <td className="px-3 py-4 font-body text-sm font-semibold text-foreground">{formatMoney(offering.base_price_cents)}</td>
                  <td className="px-3 py-4 font-body text-xs text-foreground/50">{formatMoney(offering.internal_cost_cents)}</td>
                  <td className="px-3 py-4 font-body text-xs font-semibold text-foreground/58">{margin === null ? '—' : `${margin}%`}</td>
                  <td className="px-3 py-4"><VisibilityDots offering={offering} /></td>
                  <td className="px-3 py-4 font-body text-xs text-foreground/55">{offering.locations.length || '—'}</td>
                  <td className="px-3 py-4"><StatusPill status={offering.status} /></td>
                  <td className="px-3 py-4 font-body text-[11px] text-foreground/42">{formatDate(offering.last_updated)}</td>
                  <td className="px-3 py-4 pr-4"><OfferingActions {...{ offering, readOnly, onPreview, onEdit, onDuplicate, onArchive }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-foreground/[0.07] lg:hidden">
        {rows.map((offering) => {
          const margin = marginFor(offering);
          return (
            <article key={offering.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onPreview(offering)} className="min-w-0 text-left">
                  <p className="truncate font-body text-sm font-semibold text-foreground">{offering.public_name || offering.internal_name || 'Untitled offering'}</p>
                  <p className="mt-1 font-body text-[10px] uppercase tracking-[0.1em] text-foreground/38">{offering.category_name} · {offeringTypeLabel(offering.type)}</p>
                </button>
                <StatusPill status={offering.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-foreground/[0.032] p-3">
                <div><p className="text-[9px] uppercase tracking-[0.12em] text-foreground/35">Retail</p><p className="mt-1 text-sm font-semibold">{formatMoney(offering.base_price_cents)}</p></div>
                <div><p className="text-[9px] uppercase tracking-[0.12em] text-foreground/35">Cost</p><p className="mt-1 text-sm font-semibold">{formatMoney(offering.internal_cost_cents)}</p></div>
                <div><p className="text-[9px] uppercase tracking-[0.12em] text-foreground/35">Margin</p><p className="mt-1 text-sm font-semibold">{margin === null ? '—' : `${margin}%`}</p></div>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3"><VisibilityDots offering={offering} /><OfferingActions {...{ offering, readOnly, onPreview, onEdit, onDuplicate, onArchive }} /></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ModalShell({ title, eyebrow, onClose, children, wide = false, footer }) {
  useEffect(() => {
    const handler = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="av-modal-scrim fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-foreground/[0.1] bg-[hsl(var(--background)/0.94)] shadow-[0_30px_100px_rgba(51,39,29,0.24)] backdrop-blur-3xl sm:rounded-[2rem] ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-foreground/[0.08] px-5 py-5 sm:px-7">
          <div>
            {eyebrow ? <p className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/38">{eyebrow}</p> : null}
            <h2 className="mt-1 font-heading text-4xl uppercase leading-none text-foreground">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-foreground/[0.1] bg-white/35 p-2 text-foreground/45 transition hover:bg-white/70 hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        {footer ? <footer className="border-t border-foreground/[0.08] bg-white/20 px-5 py-4 sm:px-7">{footer}</footer> : null}
      </section>
    </div>
  );
}

function PreviewDialog({ offering, initialAudience, onClose }) {
  const [audience, setAudience] = useState(initialAudience || 'admin');
  const audienceLabel = audience === 'admin' ? 'Admin' : audience === 'client' ? 'Client' : 'Nurse';
  const allowed = visibleTo(offering, audience);
  const margin = marginFor(offering);
  return (
    <ModalShell title={offering.public_name || offering.internal_name || 'Offering preview'} eyebrow="Configuration preview" onClose={onClose} wide>
      <div className="mb-6 inline-flex rounded-full border border-foreground/[0.1] bg-white/40 p-1">
        {['admin', 'client', 'nurse'].map((key) => (
          <button key={key} type="button" onClick={() => setAudience(key)} className={`rounded-full px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.13em] transition ${audience === key ? 'bg-foreground text-background shadow-sm' : 'text-foreground/45 hover:text-foreground'}`}>{key}</button>
        ))}
      </div>
      {audience !== 'admin' ? <p className="mb-5 rounded-2xl border border-amber-800/15 bg-amber-100/30 px-4 py-3 text-[11px] leading-relaxed text-amber-950/65">This previews configured content only. The live {audienceLabel.toLowerCase()} surface independently checks status, category, visibility, availability, price, and required audience fields before rendering.</p> : null}
      {!allowed ? (
        <div className={`${SURFACE} flex min-h-72 items-center justify-center p-8 text-center`}>
          <div><Eye className="mx-auto h-6 w-6 text-foreground/25" /><p className="mt-5 font-heading text-4xl uppercase leading-none">Hidden from {audienceLabel}</p><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-foreground/48">Visibility is currently disabled for this audience. Enabling it is only one of the checks required before the runtime surface can render the offering.</p></div>
        </div>
      ) : audience === 'client' ? (
        <div className="mx-auto max-w-lg overflow-hidden rounded-[2rem] border border-foreground/[0.1] bg-white/60 shadow-[0_24px_80px_rgba(62,45,28,0.08)]">
          {offering.hero_url || offering.thumbnail_url ? <img src={offering.hero_url || offering.thumbnail_url} alt="" className="h-48 w-full object-cover" /> : <div className="h-36 bg-gradient-to-br from-white/65 via-foreground/[0.035] to-white/20" />}
          <div className="p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">{offering.category_name}</p>
            <div className="mt-3 flex items-start justify-between gap-5"><h3 className="font-heading text-5xl uppercase leading-[0.9]">{offering.public_name}</h3><p className="shrink-0 text-lg font-semibold">{formatMoney(offering.base_price_cents)}</p></div>
            <p className="mt-5 text-sm leading-relaxed text-foreground/55">{offering.client_description || offering.short_description || 'No client description has been configured.'}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-foreground/45"><Clock3 className="h-3.5 w-3.5" /> {offering.duration_label || (offering.estimated_duration_minutes ? `${offering.estimated_duration_minutes} minutes` : 'Duration confirmed before booking')}</div>
            <button type="button" className={`${BUTTON_PRIMARY} mt-7 w-full`} disabled>Book this service <ArrowRight className="h-3.5 w-3.5" /></button>
            <p className="mt-3 text-center text-[10px] text-foreground/35">Preview only · booking disabled</p>
          </div>
        </div>
      ) : audience === 'nurse' ? (
        <div className="mx-auto max-w-3xl space-y-3">
          <div className={`${SURFACE} p-6`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Fulfillment view</p><h3 className="mt-2 text-xl font-semibold">{offering.public_name || offering.internal_name}</h3><p className="mt-1 text-xs text-foreground/45">{offeringTypeLabel(offering.type)} · {offering.category_name}</p></div><StatusPill status={offering.status} /></div></div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className={`${SURFACE} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Instructions</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/62">{offering.nurse_instructions || 'No nurse instructions configured.'}</p></div>
            <div className={`${SURFACE} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Protocol & timing</p><p className="mt-3 text-sm font-semibold">{offering.protocol_reference || 'No protocol reference configured'}</p><p className="mt-2 text-xs text-foreground/48">{offering.duration_label || (offering.estimated_duration_minutes ? `${offering.estimated_duration_minutes} minutes` : 'No duration configured')}</p></div>
          </div>
          <div className={`${SURFACE} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Required supplies</p>{offering.inventory_requirements.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{offering.inventory_requirements.map((item, index) => <li key={String(item.id || item.inventory_item_id || item.name || index)} className="rounded-xl bg-foreground/[0.035] px-3 py-2 text-xs text-foreground/62">{typeof item === 'string' ? item : `${firstDefined(item.quantity, 1)} × ${firstDefined(item.name, item.inventory_name, item.label, 'Mapped item')}`}</li>)}</ul> : <p className="mt-3 text-sm text-foreground/45">No supply mapping configured.</p>}</div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className={`${SURFACE} p-5 lg:col-span-2`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Identity</p><dl className="mt-4 grid gap-4 sm:grid-cols-2"><Detail label="Internal name" value={offering.internal_name} /><Detail label="Public name" value={offering.public_name} /><Detail label="Stable ID" value={offering.stable_key} mono /><Detail label="SKU / code" value={offering.sku} mono /><Detail label="Type" value={offeringTypeLabel(offering.type)} /><Detail label="Category" value={offering.category_name} /></dl></div>
          <div className={`${SURFACE} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Financials</p><dl className="mt-4 space-y-4"><Detail label="Retail" value={formatMoney(offering.base_price_cents)} /><Detail label="Internal cost" value={formatMoney(offering.internal_cost_cents)} /><Detail label="Gross margin" value={margin === null ? '—' : `${margin}%`} /></dl></div>
          <div className={`${SURFACE} p-5 lg:col-span-2`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Presentation & fulfillment</p><dl className="mt-4 space-y-4"><Detail label="Client description" value={offering.client_description || offering.short_description} /><Detail label="Nurse instructions" value={offering.nurse_instructions} /><Detail label="Protocol reference" value={offering.protocol_reference} /></dl></div>
          <div className={`${SURFACE} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Visibility</p><div className="mt-4 grid grid-cols-2 gap-2">{VISIBILITY_OPTIONS.map(([key, label]) => <div key={key} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[10px] font-semibold ${offering.visibility[key] ? 'bg-foreground/[0.06] text-foreground' : 'text-foreground/30'}`}><span className={`h-1.5 w-1.5 rounded-full ${offering.visibility[key] ? 'bg-emerald-700' : 'bg-foreground/20'}`} />{label}</div>)}</div></div>
        </div>
      )}
    </ModalShell>
  );
}

function Detail({ label, value, mono = false }) {
  return <div><dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/34">{label}</dt><dd className={`mt-1.5 break-words text-sm leading-relaxed text-foreground/65 ${mono ? 'font-mono text-xs' : ''}`}>{displayValue(value)}</dd></div>;
}

function fieldFromOffering(offering) {
  if (!offering) return {
    internal_name: '', public_name: '', short_name: '', sku: '', type: 'iv_treatment', category_id: '', status: 'draft',
    base_price_dollars: '', internal_cost_dollars: '', estimated_duration_minutes: '', short_description: '', client_description: '', nurse_instructions: '', protocol_reference: '',
    visibility: { ...EMPTY_VISIBILITY }, reason: '',
  };
  return {
    internal_name: offering.internal_name || '',
    public_name: offering.public_name || '',
    short_name: offering.short_name || '',
    sku: offering.sku || '',
    type: canonicalOfferingType(offering.type),
    category_id: offering.category_id == null ? '' : String(offering.category_id),
    status: offering.status || 'draft',
    base_price_dollars: offering.base_price_cents == null ? '' : Number(offering.base_price_cents) / 100,
    internal_cost_dollars: offering.internal_cost_cents == null ? '' : Number(offering.internal_cost_cents) / 100,
    estimated_duration_minutes: offering.estimated_duration_minutes ?? '',
    short_description: offering.short_description || '',
    client_description: offering.client_description || '',
    nurse_instructions: offering.nurse_instructions || '',
    protocol_reference: offering.protocol_reference || '',
    visibility: { ...EMPTY_VISIBILITY, ...offering.visibility },
    reason: '',
  };
}

function validateOfferingForm(form) {
  const errors = [];
  if (!form.internal_name.trim()) errors.push('Internal name is required.');
  if (!OFFERING_TYPE_VALUES.has(form.type)) errors.push('Choose a valid offering type.');
  if (!form.reason.trim()) errors.push('A change reason is required for the audit history.');
  const visibleOutsideAdmin = VISIBILITY_OPTIONS.some(([key]) => key !== 'admin' && form.visibility[key]);
  if (form.status === 'active' && visibleOutsideAdmin) {
    if (!form.public_name.trim()) errors.push('Public name is required before an active offering can be visible.');
    if (!form.category_id) errors.push('Category is required before an active offering can be visible.');
    if (form.base_price_dollars === '' || !Number.isFinite(Number(form.base_price_dollars)) || Number(form.base_price_dollars) <= 0) errors.push('A retail price greater than $0 is required before an active offering can be visible.');
    if (!form.short_description.trim()) errors.push('Short description is required before an active offering can be visible.');
    if ((form.visibility.client || form.visibility.public) && !form.client_description.trim()) errors.push('Client description is required for client-visible offerings.');
    if (form.visibility.nurse && !form.nurse_instructions.trim()) errors.push('Nurse instructions are required for nurse-visible offerings.');
  }
  return errors;
}

function OfferingEditor({ offering, categories, onClose, onSave, busy }) {
  const [form, setForm] = useState(() => fieldFromOffering(offering));
  const [errors, setErrors] = useState([]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validateOfferingForm(form);
    if (nextErrors.length) { setErrors(nextErrors); return; }
    setErrors([]);
    onSave({
      internal_name: form.internal_name.trim(),
      public_name: form.public_name.trim() || null,
      short_name: form.short_name.trim() || null,
      sku: form.sku.trim() || null,
      type: form.type,
      category_id: form.category_id || null,
      status: form.status,
      base_price_cents: form.base_price_dollars === '' ? null : Math.round(Number(form.base_price_dollars) * 100),
      internal_cost_cents: form.internal_cost_dollars === '' ? null : Math.round(Number(form.internal_cost_dollars) * 100),
      estimated_duration_minutes: form.estimated_duration_minutes === '' ? null : Math.max(0, Math.round(Number(form.estimated_duration_minutes))),
      short_description: form.short_description.trim() || null,
      client_description: form.client_description.trim() || null,
      nurse_instructions: form.nurse_instructions.trim() || null,
      protocol_reference: form.protocol_reference.trim() || null,
      visibility: { ...form.visibility, admin: true },
      reason: form.reason.trim(),
    });
  };
  return (
    <ModalShell
      title={offering ? 'Edit offering' : 'New offering'}
      eyebrow={offering ? offering.stable_key : 'Private by default'}
      onClose={onClose}
      wide
      footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-lg text-[11px] leading-relaxed text-foreground/42">New offerings begin as private drafts. Active, visible offerings must pass completeness checks before saving.</p><div className="flex gap-2"><button type="button" onClick={onClose} disabled={busy} className={BUTTON_SECONDARY}>Cancel</button><button form="catalog-offering-form" type="submit" disabled={busy} className={BUTTON_PRIMARY}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{offering ? 'Save changes' : 'Create draft'}</button></div></div>}
    >
      <form id="catalog-offering-form" onSubmit={submit} className="space-y-7">
        {errors.length ? <div role="alert" className="rounded-2xl border border-red-700/15 bg-red-700/[0.055] px-4 py-3"><p className="text-xs font-semibold text-red-900">Resolve before saving</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-900/70">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <EditorSection title="Identity" description="One stable offering record used by every Avalon surface.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Internal name *"><input value={form.internal_name} onChange={(event) => set('internal_name', event.target.value)} className={INPUT} autoFocus /></Field>
            <Field label="Public name"><input value={form.public_name} onChange={(event) => set('public_name', event.target.value)} className={INPUT} /></Field>
            <Field label="Short name"><input value={form.short_name} onChange={(event) => set('short_name', event.target.value)} className={INPUT} /></Field>
            <Field label="SKU / internal code"><input value={form.sku} onChange={(event) => set('sku', event.target.value)} className={INPUT} /></Field>
            <Field label="Type *"><select value={form.type} onChange={(event) => set('type', event.target.value)} className={INPUT}>{OFFERING_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Category"><select value={form.category_id} onChange={(event) => set('category_id', event.target.value)} className={INPUT}><option value="">Uncategorized</option>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.name || 'Unnamed category'}</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={(event) => set('status', event.target.value)} className={INPUT}><option value="draft">Draft</option><option value="active" disabled={offering?.status !== 'active'}>Active — requires approved availability</option><option value="scheduled" disabled={offering?.status !== 'scheduled'}>Scheduled — requires approved availability</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select>{!['active', 'scheduled'].includes(offering?.status) ? <span className="mt-1.5 block text-[10px] leading-relaxed text-foreground/36">Activation and scheduling remain gated until an explicit availability rule is approved.</span> : null}</Field>
          </div>
        </EditorSection>
        <EditorSection title="Pricing & timing" description="Costs remain visible only to approved admin roles.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Retail price ($)"><input type="number" min="0" step="0.01" value={form.base_price_dollars} onChange={(event) => set('base_price_dollars', event.target.value)} className={INPUT} /></Field>
            <Field label="Internal cost ($)"><input type="number" min="0" step="0.01" value={form.internal_cost_dollars} onChange={(event) => set('internal_cost_dollars', event.target.value)} className={INPUT} /></Field>
            <Field label="Duration (minutes)"><input type="number" min="0" step="1" value={form.estimated_duration_minutes} onChange={(event) => set('estimated_duration_minutes', event.target.value)} className={INPUT} /></Field>
          </div>
        </EditorSection>
        <EditorSection title="Presentation & fulfillment" description="Audience-specific content stays separated on the same Offering.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Short description"><textarea rows={3} value={form.short_description} onChange={(event) => set('short_description', event.target.value)} className={INPUT} /></Field>
            <Field label="Client description"><textarea rows={3} value={form.client_description} onChange={(event) => set('client_description', event.target.value)} className={INPUT} /></Field>
            <Field label="Nurse instructions"><textarea rows={4} value={form.nurse_instructions} onChange={(event) => set('nurse_instructions', event.target.value)} className={INPUT} /></Field>
            <Field label="Protocol reference"><textarea rows={4} value={form.protocol_reference} onChange={(event) => set('protocol_reference', event.target.value)} className={INPUT} /></Field>
          </div>
        </EditorSection>
        <EditorSection title="Visibility" description="Every audience is hidden until explicitly enabled.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{VISIBILITY_OPTIONS.map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/[0.08] bg-white/35 px-3 py-3"><span><span className="block text-xs font-semibold text-foreground/62">{label}</span>{key === 'admin' ? <span className="mt-0.5 block text-[9px] uppercase tracking-[0.1em] text-foreground/30">Always visible</span> : null}</span><Toggle checked={key === 'admin' || form.visibility[key]} disabled={key === 'admin'} onChange={(value) => set('visibility', { ...form.visibility, [key]: value })} label={`${label} visibility`} /></div>)}</div>
        </EditorSection>
        <EditorSection title="Audit reason" description="Every important change must be attributable and explainable.">
          <Field label="Reason for this change *"><textarea rows={3} value={form.reason} onChange={(event) => set('reason', event.target.value)} placeholder="What changed, and why?" className={INPUT} /></Field>
        </EditorSection>
      </form>
    </ModalShell>
  );
}

function EditorSection({ title, description, children }) {
  return <section><div className="mb-4"><h3 className="text-sm font-semibold text-foreground">{title}</h3><p className="mt-1 text-xs leading-relaxed text-foreground/43">{description}</p></div>{children}</section>;
}

function Field({ label, children }) {
  return <label className="block"><span className={LABEL}>{label}</span>{children}</label>;
}

function ReasonDialog({ mode, offering, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  const copy = mode === 'archive'
    ? { title: 'Archive offering', action: 'Archive', description: 'This removes the offering from active use without deleting its history.' }
    : mode === 'duplicate'
      ? { title: 'Duplicate offering', action: 'Create private copy', description: 'The copy will be created as a hidden draft with its own stable ID.' }
      : { title: 'Import current menu', action: 'Start controlled import', description: 'The backend will reconcile the current verified menu into stable Catalog records. Nothing is published by this screen.' };
  return (
    <ModalShell title={copy.title} eyebrow={offering?.public_name || 'Controlled Catalog action'} onClose={onClose} footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cancel</button><button type="button" onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={busy || !reason.trim()} className={BUTTON_PRIMARY}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{copy.action}</button></div>}>
      <p className="text-sm leading-relaxed text-foreground/55">{copy.description}</p>
      <label className="mt-5 block"><span className={LABEL}>Reason * </span><textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for the audit history" className={INPUT} autoFocus /></label>
    </ModalShell>
  );
}

function PricingPanel({ offerings, rules, onTrace }) {
  const withPrice = offerings.filter((offering) => offering.base_price_cents != null);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_2.15fr]">
        <div className={`${SURFACE} p-6`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Deterministic priority</p><h3 className="mt-3 font-heading text-4xl uppercase leading-none">One answer for every price</h3><p className="mt-4 text-sm leading-relaxed text-foreground/50">Contract → Event → Membership → Location → Standard retail. Live rules may narrow this sequence, and every result stays traceable.</p><div className="mt-6 space-y-2">{['Contract price', 'Event override', 'Membership price', 'Location price', 'Standard retail'].map((label, index) => <div key={label} className="flex items-center gap-3 rounded-xl bg-foreground/[0.035] px-3 py-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background">{index + 1}</span><span className="text-xs font-semibold text-foreground/60">{label}</span></div>)}</div></div>
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="border-b border-foreground/[0.08] px-5 py-4"><h3 className="text-sm font-semibold">Offering economics</h3><p className="mt-1 text-xs text-foreground/42">Internal cost and margin never leave the admin view.</p></div>
          {withPrice.length ? <div className="divide-y divide-foreground/[0.07]">{withPrice.map((offering) => { const margin = marginFor(offering); return <div key={offering.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.5fr_0.7fr_0.7fr_0.55fr_auto] sm:items-center"><div><p className="text-sm font-semibold">{offering.public_name || offering.internal_name}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-foreground/35">{offering.category_name}</p></div><Detail label="Retail" value={formatMoney(offering.base_price_cents)} /><Detail label="Cost" value={formatMoney(offering.internal_cost_cents)} /><Detail label="Margin" value={margin === null ? '—' : `${margin}%`} /><button type="button" onClick={() => onTrace(offering)} className={BUTTON_SECONDARY}>Why this price?</button></div>; })}</div> : <PanelEmpty label="No live prices configured" />}
        </div>
      </div>
      <SimpleDataPanel title="Contextual pricing rules" description="Scheduled, channel, membership, event, partner, and location overrides." rows={rules} columns={[['Offering', ['offering_name', 'public_name', 'offering_id']], ['Context', ['context', 'price_type', 'channel']], ['Price', ['amount_cents', 'price_cents'], 'money'], ['Priority', ['priority']], ['Effective', ['effective_at', 'starts_at'], 'date'], ['Status', ['status']]]} empty="No contextual pricing rules configured." />
    </div>
  );
}

function CategoriesPanel({ categories, offerings }) {
  const counts = new Map();
  offerings.forEach((offering) => counts.set(String(offering.category_id), (counts.get(String(offering.category_id)) || 0) + 1));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {categories.length ? categories.map((category) => (
        <article key={String(category.id)} className={`${SURFACE} p-5`}>
          <div className="flex items-start justify-between gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background"><Tag className="h-4 w-4" /></div><StatusPill status={category.status || 'active'} /></div>
          <h3 className="mt-5 font-heading text-3xl uppercase leading-none">{category.name || 'Unnamed category'}</h3>
          <p className="mt-3 min-h-10 text-xs leading-relaxed text-foreground/48">{category.description || 'No category description configured.'}</p>
          <div className="mt-5 flex items-center justify-between border-t border-foreground/[0.07] pt-4"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-foreground/35">Offerings</span><span className="text-lg font-semibold">{firstDefined(category.offering_count, counts.get(String(category.id)), 0)}</span></div>
        </article>
      )) : <div className="md:col-span-2 xl:col-span-3"><PanelEmpty label="No live categories configured" /></div>}
    </div>
  );
}

function AvailabilityPanel({ rules, offerings }) {
  return <SimpleDataPanel title="Availability engine" description="Rules answer whether an offering can be sold here, to this audience, through this channel, now." rows={rules} columns={[['Offering', ['offering_name', 'public_name', 'offering_id']], ['Scope', ['scope_type', 'context_type', 'channel']], ['Value', ['scope_value', 'context_value', 'location_name']], ['Decision', ['available', 'effect']], ['Start', ['starts_at', 'start_date'], 'date'], ['End', ['ends_at', 'end_date'], 'date'], ['Priority', ['priority']]]} empty={offerings.length ? 'No scoped availability rules. Offerings remain closed unless the live engine explicitly allows the context.' : 'No offerings or availability rules configured.'} />;
}

function InventoryPanel({ mappings, offerings }) {
  const offeringMappings = mappings.length ? mappings : offerings.flatMap((offering) => offering.inventory_requirements.map((mapping) => ({ ...mapping, offering_name: offering.public_name || offering.internal_name, offering_id: offering.id })));
  return (
    <div className="space-y-4">
      <div className={`${SURFACE} flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between`}><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Relationship layer only</p><h3 className="mt-2 font-heading text-4xl uppercase leading-none">Catalog maps consumption. Inventory owns stock.</h3><p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/50">Completing an offering can emit consumption against Avalon's existing inventory source. Catalog does not create another stock ledger.</p></div><Link to="/admin/inventory" className={BUTTON_SECONDARY}>Open inventory <ArrowRight className="h-3.5 w-3.5" /></Link></div>
      <SimpleDataPanel title="Mapped consumables" description="Stable offering-to-inventory references and quantities." rows={offeringMappings} columns={[['Offering', ['offering_name', 'public_name', 'offering_id']], ['Inventory item', ['inventory_name', 'item_name', 'name', 'inventory_item_id']], ['Quantity', ['quantity']], ['Unit', ['unit']], ['Source', ['inventory_source', 'source']], ['Status', ['status']]]} empty="No inventory mappings configured." />
    </div>
  );
}

function AuditPanel({ rows }) {
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="border-b border-foreground/[0.08] px-5 py-5"><h3 className="text-sm font-semibold">Append-only audit records</h3><p className="mt-1 text-xs text-foreground/42">Actor identifier, source, reason, and before/after record payloads are retained. Friendly actor names and field-level diffs are a later admin enhancement.</p></div>
      {rows.length ? <div className="divide-y divide-foreground/[0.07]">{rows.map((row, index) => <article key={String(firstDefined(row.id, `${row.created_at || 'audit'}-${index}`))} className="grid gap-4 px-5 py-5 lg:grid-cols-[0.7fr_1.25fr_0.8fr_1fr_1fr]"><div><p className="break-all font-mono text-[10px] font-semibold">{displayValue(firstDefined(row.actor_name, row.actor_email, row.actor, row.actor_profile_id, row.actor_type === 'system' ? 'System' : 'Unattributed'))}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-foreground/35">{displayValue(firstDefined(row.source, row.actor_type, 'Unknown source'))}</p></div><div><p className="text-xs font-semibold">{displayValue(firstDefined(row.object_name, row.offering_name, row.object_type, 'Catalog'))}</p><p className="mt-1 text-[10px] text-foreground/40">{displayValue(firstDefined(row.field, row.action))}</p></div><div><p className="text-xs text-foreground/58">{formatDate(firstDefined(row.created_at, row.timestamp), true)}</p></div><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/34">Before / after</p><p className="mt-1 break-words text-xs text-foreground/58">{displayValue(firstDefined(row.previous_value, row.before))} → {displayValue(firstDefined(row.new_value, row.after))}</p></div><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/34">Reason</p><p className="mt-1 text-xs leading-relaxed text-foreground/58">{displayValue(row.reason)}</p></div></article>)}</div> : <PanelEmpty label="No catalog changes recorded" />}
    </div>
  );
}

function SimpleDataPanel({ title, description, rows, columns, empty }) {
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="border-b border-foreground/[0.08] px-5 py-5"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-foreground/42">{description}</p></div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse"><thead><tr className="border-b border-foreground/[0.07] bg-white/20">{columns.map(([label]) => <th key={label} className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/34 first:pl-5">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(firstDefined(row.id, `${title}-${index}`))} className="border-b border-foreground/[0.06] last:border-0">{columns.map(([label, keys, type]) => { const value = firstDefined(...keys.map((key) => row?.[key])); return <td key={label} className="max-w-[300px] px-4 py-3 text-xs text-foreground/58 first:pl-5">{type === 'money' ? formatMoney(value) : type === 'date' ? formatDate(value) : displayValue(value)}</td>; })}</tr>)}</tbody></table></div> : <PanelEmpty label={empty} />}
    </div>
  );
}

function PanelEmpty({ label }) {
  return <div className="flex min-h-44 items-center justify-center p-8 text-center"><div><Database className="mx-auto h-5 w-5 text-foreground/24" /><p className="mt-3 text-sm text-foreground/45">{label}</p></div></div>;
}

function PriceTraceDialog({ offering, trace, loading, error, onClose }) {
  const rawRules = firstDefined(trace?.trace, trace?.rules, []);
  const traceRules = Array.isArray(rawRules) ? rawRules : rawRules && typeof rawRules === 'object' ? [rawRules] : [];
  return (
    <ModalShell title="Why this price?" eyebrow={offering.public_name || offering.internal_name} onClose={onClose}>
      {loading ? <LoadingState /> : error ? <div className="rounded-2xl border border-red-700/15 bg-red-700/[0.05] p-4 text-sm text-red-900/70">{error}</div> : trace ? <div className="space-y-4"><div className={`${SURFACE} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/38">Effective price</p><p className="mt-3 font-heading text-5xl uppercase leading-none">{formatMoney(firstDefined(trace.effective_price_cents, trace.price_cents, trace.amount_cents))}</p><p className="mt-3 text-sm text-foreground/50">{displayValue(firstDefined(trace.explanation, trace.reason, trace.rule_name, trace.trace?.reason, 'Resolved by the live pricing engine.'))}</p></div>{traceRules.map((rule, index) => <div key={String(rule.id || rule.rule_key || index)} className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/[0.08] bg-white/35 px-4 py-3"><div><p className="text-xs font-semibold">{displayValue(firstDefined(rule.name, rule.rule_key, rule.type, rule.price_type, 'Pricing rule'))}</p><p className="mt-1 text-[10px] text-foreground/38">Priority {displayValue(rule.priority)}</p></div><p className="text-sm font-semibold">{formatMoney(firstDefined(rule.amount_cents, rule.price_cents, trace.price_cents))}</p></div>)}</div> : <PanelEmpty label="No pricing trace returned." />}
    </ModalShell>
  );
}

export default function Catalog() {
  useSeo({ title: 'Catalog — Avalon Admin', description: 'Centralized Avalon offerings, pricing, availability, and audience controls.' });
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveError, setLiveError] = useState('');
  const [section, setSection] = useState('overview');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [preview, setPreview] = useState(null);
  const [previewAudience, setPreviewAudience] = useState('admin');
  const [editor, setEditor] = useState(null);
  const [reasonDialog, setReasonDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [traceState, setTraceState] = useState(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLiveError('');
    try {
      const payload = await apiGet('/api/admin/catalog?view=dashboard');
      setCatalog(normalizeDashboard(payload));
    } catch (error) {
      const message = error?.message || 'The live Catalog is unavailable.';
      if (loadDevelopmentPreview) {
        try {
          setCatalog(await loadDevelopmentPreview());
          setLiveError(message);
        } catch {
          setCatalog(null);
          setLiveError(message);
        }
      } else {
        setCatalog(null);
        setLiveError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const readOnly = catalog?.source !== 'live';
  const importVerified = catalog?.readiness?.ready === true;
  const offerings = catalog?.offerings || [];
  const categories = catalog?.categories || [];
  const stats = useMemo(() => {
    const active = offerings.filter((offering) => offering.status === 'active').length;
    const clientVisible = offerings.filter((offering) => offering.visibility.client || offering.visibility.public).length;
    const nurseVisible = offerings.filter((offering) => offering.visibility.nurse).length;
    const mapped = offerings.filter((offering) => offering.inventory_requirements.length > 0).length;
    return { total: offerings.length, active, clientVisible, nurseVisible, mapped };
  }, [offerings]);

  const visibleOfferings = useMemo(() => {
    const sectionTypes = LIST_TYPES[section];
    const normalizedQuery = query.trim().toLowerCase();
    return offerings
      .filter((offering) => !sectionTypes || sectionTypes.has(offering.type))
      .filter((offering) => status === 'all' || offering.status === status)
      .filter((offering) => type === 'all' || offering.type === type)
      .filter((offering) => category === 'all' || String(offering.category_id) === category)
      .filter((offering) => !normalizedQuery || [offering.public_name, offering.internal_name, offering.short_name, offering.sku, offering.stable_key, offering.type, offeringTypeLabel(offering.type), offering.category_name].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => a.display_order - b.display_order || (a.public_name || a.internal_name).localeCompare(b.public_name || b.internal_name));
  }, [offerings, section, query, status, type, category]);

  const runOfferingSave = async (dto) => {
    setBusy(true);
    try {
      const editing = editor?.offering;
      if (editing) await apiPatch('/api/admin/catalog', { action: 'update_offering', offering_id: editing.id, expected_version: editing.version, ...dto });
      else await apiPost('/api/admin/catalog', { action: 'create_offering', availability_mode: 'closed', ...dto });
      setEditor(null);
      setNotice({ tone: 'success', text: editing ? 'Offering updated.' : 'Private draft created.' });
      await loadCatalog();
    } catch (error) {
      setNotice({ tone: 'error', text: error?.message || 'Catalog change failed.' });
    } finally { setBusy(false); }
  };

  const confirmReasonAction = async (reason) => {
    const dialog = reasonDialog;
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.mode === 'import') await apiPost('/api/admin/catalog', { action: 'import_legacy', reason });
      if (dialog.mode === 'duplicate') await apiPost('/api/admin/catalog', { action: 'duplicate_offering', offering_id: dialog.offering.id, reason });
      if (dialog.mode === 'archive') await apiPost('/api/admin/catalog', { action: 'archive_offering', offering_id: dialog.offering.id, expected_version: dialog.offering.version, reason });
      setReasonDialog(null);
      setNotice({ tone: 'success', text: dialog.mode === 'import' ? 'Controlled import completed.' : dialog.mode === 'duplicate' ? 'Private draft copy created.' : 'Offering archived.' });
      await loadCatalog();
    } catch (error) {
      setNotice({ tone: 'error', text: error?.message || 'Catalog action failed.' });
    } finally { setBusy(false); }
  };

  const tracePrice = async (offering) => {
    setTraceState({ offering, loading: true, trace: null, error: '' });
    try {
      const response = await apiPost('/api/admin/catalog', { action: 'get_effective_price', offering_id: offering.id, context: { channel: 'client' } });
      setTraceState({ offering, loading: false, trace: response?.result || response?.pricing || response, error: '' });
    } catch (error) {
      setTraceState({ offering, loading: false, trace: null, error: error?.message || 'Pricing trace is unavailable.' });
    }
  };

  const openPreview = (offering, audience = 'admin') => { setPreview(offering); setPreviewAudience(audience); };
  const actions = <button type="button" onClick={() => setEditor({ offering: null })} disabled={readOnly || loading} className={`${BUTTON_PRIMARY} hidden sm:inline-flex`}><Plus className="h-3.5 w-3.5" /> New offering</button>;

  return (
    <AdminShell title="Catalog" actions={actions}>
      {notice ? <div className={`fixed right-4 top-20 z-[110] max-w-sm rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl ${notice.tone === 'error' ? 'border-red-700/15 bg-red-50/90 text-red-950' : 'border-emerald-700/15 bg-emerald-50/90 text-emerald-950'}`} role="status"><p className="text-sm font-semibold">{notice.text}</p></div> : null}
      {loading ? <LoadingState /> : !catalog ? (
        <div>
          <OperationalSourceUnavailable title="Catalog source unavailable" description="No sample, test, draft, or locally invented offering records are shown. Catalog actions remain disabled until the verified live source is connected." />
          <div className="-mt-20 flex justify-center pb-16"><button type="button" onClick={loadCatalog} className={BUTTON_SECONDARY}><RefreshCw className="h-3.5 w-3.5" /> Retry live source</button></div>
        </div>
      ) : (
        <div className="space-y-5">
          {readOnly ? (
            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-amber-800/15 bg-amber-100/28 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-semibold text-amber-950">Development preview · read-only current menu</p><p className="mt-1 text-[11px] leading-relaxed text-amber-950/58">The live Catalog API did not verify. These current-menu rows are isolated to development and cannot be edited. Production fails closed.</p></div>
              <div className="flex shrink-0 gap-2"><button type="button" onClick={loadCatalog} className={BUTTON_SECONDARY}><RefreshCw className="h-3.5 w-3.5" /> Retry</button><button type="button" onClick={() => setReasonDialog({ mode: 'import' })} className={BUTTON_PRIMARY}><Upload className="h-3.5 w-3.5" /> Import current menu</button></div>
            </div>
          ) : null}

          <section className={`${SURFACE} relative overflow-hidden p-6 sm:p-8`}>
            <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/75 blur-3xl" />
            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-foreground/[0.1] bg-white/45 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/45">Avalon OS · Catalog foundation</span>{readOnly ? <span className="rounded-full border border-amber-800/15 bg-amber-100/35 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-950/70">Development preview</span> : importVerified ? <span className="rounded-full border border-emerald-800/15 bg-emerald-100/35 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-950/70">Import verified · consumers gated</span> : <span className="rounded-full border border-amber-800/15 bg-amber-100/35 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-950/70">Not cut over</span>}</div>
                <h2 className="mt-5 font-heading text-5xl uppercase leading-[0.86] tracking-[-0.01em] text-foreground sm:text-7xl">One offering.<br />Every context.</h2>
                <p className="mt-5 max-w-2xl font-body text-sm leading-relaxed text-foreground/52 sm:text-base">Define one governed offering with audience-specific presentation, pricing, availability, and fulfillment configuration. Public commerce, events, memberships, partners, and agents remain unchanged until each integration is separately verified and activated.</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button type="button" onClick={() => offerings[0] && openPreview(offerings[0], 'client')} disabled={!offerings.length} className={BUTTON_SECONDARY}><Eye className="h-3.5 w-3.5" /> Client configuration</button>
                <button type="button" onClick={() => offerings[0] && openPreview(offerings[0], 'nurse')} disabled={!offerings.length} className={BUTTON_SECONDARY}><Users className="h-3.5 w-3.5" /> Nurse configuration</button>
                <button type="button" onClick={() => setEditor({ offering: null })} disabled={readOnly} className={`${BUTTON_PRIMARY} sm:hidden`}><Plus className="h-3.5 w-3.5" /> New offering</button>
              </div>
            </div>
          </section>

          <SectionNavigation active={section} onChange={setSection} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="All offerings" value={stats.total} detail="One stable record per offering" icon={Layers3} accent />
            <MetricCard label="Active" value={stats.active} detail="Currently enabled in Catalog" icon={Check} />
            <MetricCard label="Client flagged" value={stats.clientVisible} detail="Visibility configuration" icon={Eye} />
            <MetricCard label="Nurse flagged" value={stats.nurseVisible} detail="Visibility configuration" icon={Users} />
            <MetricCard label="Inventory mapped" value={stats.mapped} detail="Linked to existing stock truth" icon={Boxes} />
          </div>

          {['overview', 'services', 'products', 'packages', 'addons'].includes(section) ? (
            <div className="space-y-3">
              <FilterBar {...{ query, setQuery, status, setStatus, type, setType, category, setCategory, categories }} count={visibleOfferings.length} />
              {!offerings.length && section === 'overview' ? <CatalogEmpty onCreate={() => setEditor({ offering: null })} onImport={() => setReasonDialog({ mode: 'import' })} readOnly={readOnly} /> : <OfferingsTable rows={visibleOfferings} readOnly={readOnly} onPreview={openPreview} onEdit={(offering) => setEditor({ offering })} onDuplicate={(offering) => setReasonDialog({ mode: 'duplicate', offering })} onArchive={(offering) => setReasonDialog({ mode: 'archive', offering })} />}
            </div>
          ) : null}
          {section === 'pricing' ? <PricingPanel offerings={offerings} rules={catalog.pricing_rules} onTrace={tracePrice} /> : null}
          {section === 'categories' ? <CategoriesPanel categories={categories} offerings={offerings} /> : null}
          {section === 'availability' ? <AvailabilityPanel rules={catalog.availability_rules} offerings={offerings} /> : null}
          {section === 'inventory' ? <InventoryPanel mappings={catalog.inventory_mappings} offerings={offerings} /> : null}
          {section === 'audit' ? <AuditPanel rows={catalog.audit_history} /> : null}

          <footer className="flex flex-col gap-3 border-t border-foreground/[0.08] px-1 py-4 text-[10px] uppercase tracking-[0.14em] text-foreground/32 sm:flex-row sm:items-center sm:justify-between"><span>One offering · one stable ID · governed contexts</span><span>{readOnly ? `Live error: ${liveError}` : `Live Catalog storage connected · consumer cutover gated${importVerified ? ' · import verified' : ''}`}</span></footer>
        </div>
      )}

      {preview ? <PreviewDialog offering={preview} initialAudience={previewAudience} onClose={() => setPreview(null)} /> : null}
      {editor ? <OfferingEditor offering={editor.offering} categories={categories} onClose={() => !busy && setEditor(null)} onSave={runOfferingSave} busy={busy} /> : null}
      {reasonDialog ? <ReasonDialog mode={reasonDialog.mode} offering={reasonDialog.offering} onClose={() => !busy && setReasonDialog(null)} onConfirm={confirmReasonAction} busy={busy} /> : null}
      {traceState ? <PriceTraceDialog {...traceState} onClose={() => setTraceState(null)} /> : null}
    </AdminShell>
  );
}
