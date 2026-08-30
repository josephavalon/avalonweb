import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { productsByCategory, slugify } from '@/data/products';
import { useSeo } from '@/lib/seo';

const CATEGORY_ORDER = ['iv-vitamins', 'nad', 'cbd', 'iv-addons', 'shots'];
const PUBLIC_CATALOG_CUTOVER = import.meta.env.VITE_CATALOG_PUBLIC_CUTOVER === 'true';
const BLOCKED_MARKER = /(?:^|[\s_-])(demo|draft|fixture|sample|test)(?:$|[\s_-])/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_RESPONSE_KEYS = new Set(['source', 'generated_at', 'offerings']);
const SAFE_CLIENT_KEYS = new Set([
  'id', 'public_name', 'short_name', 'type', 'status', 'description', 'short_description',
  'benefits', 'estimated_duration_minutes', 'display_order', 'featured', 'thumbnail_url',
  'hero_url', 'detail_path', 'booking_path', 'price_cents', 'currency',
  'compare_at_price_cents', 'availability', 'category', 'included_items', 'allowed_addons',
]);
const SAFE_CATEGORY_KEYS = new Set(['key', 'name', 'description', 'display_order']);
const SAFE_AVAILABILITY_KEYS = new Set(['available']);
const SAFE_ADDON_KEYS = new Set(['id', 'public_name', 'price_cents', 'currency']);

const SECTION_EYEBROWS = {
  'iv-addons': 'Added to any IV',
  shots: 'Added to any IV',
};
const SECTION_NOTES = {
  'iv-addons': 'Add-ons are given during an IV visit. They aren’t available on their own.',
  shots: 'Shots are given during an IV visit. They aren’t available on their own.',
};

function objectOnly(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowlist) {
  return objectOnly(value)
    && Object.keys(value).length === allowlist.size
    && Object.keys(value).every((key) => allowlist.has(key));
}

function safeAssetUrl(value) {
  if (value == null || value === '') return null;
  const url = String(value).trim();
  return (/^\/(?!\/)[^\s]*$/.test(url) || /^https:\/\/[^\s]+$/i.test(url)) ? url : null;
}

function safeAppPath(value, kind) {
  if (value == null || value === '') return null;
  const path = String(value).trim();
  if (kind === 'detail') return /^\/products\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(path) ? path : null;
  return /^\/book(?:[/?#][^\s]*)?$/.test(path) || /^\/products\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(path)
    ? path
    : null;
}

function safeStrings(value, max = 30) {
  if (!Array.isArray(value) || value.length > max) return null;
  if (value.some((item) => typeof item !== 'string')) return null;
  const rows = value.map((item) => item.trim()).filter(Boolean);
  return rows.length === value.length ? rows : null;
}

function normalizeClientOffering(row) {
  if (!exactKeys(row, SAFE_CLIENT_KEYS)) return null;
  if (!exactKeys(row.category, SAFE_CATEGORY_KEYS)) return null;
  if (!exactKeys(row.availability, SAFE_AVAILABILITY_KEYS) || row.availability.available !== true) return null;
  if (!Array.isArray(row.allowed_addons) || row.allowed_addons.some((item) => !exactKeys(item, SAFE_ADDON_KEYS))) return null;
  if (['id', 'public_name', 'type', 'status', 'currency', 'detail_path', 'booking_path'].some((key) => typeof row[key] !== 'string')) return null;
  if (['short_name', 'description', 'short_description', 'thumbnail_url', 'hero_url'].some((key) => row[key] != null && typeof row[key] !== 'string')) return null;
  if (['key', 'name'].some((key) => typeof row.category[key] !== 'string')) return null;
  if (row.category.description != null && typeof row.category.description !== 'string') return null;

  const id = String(row.id || '').trim();
  const name = String(row.public_name || '').trim();
  const type = String(row.type || '').trim();
  const categoryKey = String(row.category.key || '').trim();
  const categoryName = String(row.category.name || '').trim();
  const priceCents = Number(row.price_cents);
  const detailPath = safeAppPath(row.detail_path, 'detail');
  const bookingPath = safeAppPath(row.booking_path, 'booking');
  const benefits = safeStrings(row.benefits || []);
  const includedItems = safeStrings(row.included_items || []);
  const markerText = `${id} ${name} ${row.status || ''} ${categoryKey}`;
  const duration = row.estimated_duration_minutes == null ? null : Number(row.estimated_duration_minutes);
  const displayOrder = Number(row.display_order);
  const categoryDisplayOrder = Number(row.category.display_order);
  const compareAtPriceCents = row.compare_at_price_cents == null ? null : Number(row.compare_at_price_cents);

  if (!/^[a-z0-9][a-z0-9_-]{1,119}$/i.test(id) || UUID_RE.test(id) || !name || !type || !categoryKey || !categoryName) return null;
  if (!/^[a-z0-9][a-z0-9_-]{1,119}$/i.test(categoryKey) || UUID_RE.test(categoryKey)) return null;
  if (row.status !== 'active' || BLOCKED_MARKER.test(markerText)) return null;
  if (typeof row.price_cents !== 'number' || !Number.isInteger(priceCents) || priceCents <= 0 || String(row.currency || '').toUpperCase() !== 'USD') return null;
  if (typeof row.display_order !== 'number' || typeof row.category.display_order !== 'number' || !Number.isInteger(displayOrder) || !Number.isInteger(categoryDisplayOrder)) return null;
  if (duration != null && (typeof row.estimated_duration_minutes !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 1440)) return null;
  if (typeof row.featured !== 'boolean') return null;
  if (compareAtPriceCents != null && (typeof row.compare_at_price_cents !== 'number' || !Number.isInteger(compareAtPriceCents) || compareAtPriceCents <= 0)) return null;
  if (!detailPath || !bookingPath || !benefits || !includedItems) return null;

  const addons = row.allowed_addons.map((addon) => {
    if (typeof addon.id !== 'string' || typeof addon.public_name !== 'string' || typeof addon.currency !== 'string') return null;
    const addonPrice = Number(addon.price_cents);
    const addonId = String(addon.id || '').trim();
    const addonName = String(addon.public_name || '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{1,119}$/i.test(addonId) || UUID_RE.test(addonId) || !addonName || BLOCKED_MARKER.test(`${addonId} ${addonName}`)) return null;
    if (typeof addon.price_cents !== 'number' || !Number.isInteger(addonPrice) || addonPrice <= 0 || String(addon.currency || '').toUpperCase() !== 'USD') return null;
    return { id: addonId, name: addonName, priceCents: addonPrice };
  });
  if (addons.some((item) => !item)) return null;

  const thumbnail = safeAssetUrl(row.thumbnail_url);
  const hero = safeAssetUrl(row.hero_url);
  if ((row.thumbnail_url && !thumbnail) || (row.hero_url && !hero)) return null;

  return {
    id,
    name,
    description: String(row.description || row.short_description || '').trim(),
    image: thumbnail || hero,
    priceCents,
    detailPath,
    bookingPath,
    displayOrder,
    category: {
      key: categoryKey,
      name: categoryName,
      description: String(row.category.description || '').trim(),
      displayOrder: categoryDisplayOrder,
    },
    addons,
  };
}

function normalizeLiveCatalog(payload) {
  if (!exactKeys(payload, SAFE_RESPONSE_KEYS)
    || payload.source !== 'live'
    || typeof payload.generated_at !== 'string'
    || Number.isNaN(Date.parse(payload.generated_at))
    || !Array.isArray(payload.offerings)
    || payload.offerings.length === 0) {
    throw new Error('The live menu is not ready.');
  }
  const offerings = payload.offerings.map(normalizeClientOffering);
  if (offerings.some((item) => !item) || offerings.length !== payload.offerings.length) {
    throw new Error('The live menu response did not pass its safety contract.');
  }
  return offerings;
}

function legacyOfferings() {
  return CATEGORY_ORDER.flatMap((categoryKey, categoryIndex) => {
    const category = productsByCategory[categoryKey];
    if (!category) return [];
    return category.treatments.map((product, displayOrder) => ({
      id: `${categoryKey}-${slugify(product.name)}`,
      name: product.name,
      description: product.benefitStatement || product.desc || '',
      image: product.image || null,
      displayPrice: product.oneTime || product.price || 'Price confirmed before booking',
      detailPath: `/products/${categoryKey}/${slugify(product.name)}`,
      bookingPath: `/products/${categoryKey}/${slugify(product.name)}`,
      displayOrder,
      category: {
        key: categoryKey,
        name: category.categoryLabel || category.title,
        description: category.description || '',
        displayOrder: categoryIndex,
      },
    }));
  });
}

function money(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: Number(cents) % 100 ? 2 : 0,
  }).format(Number(cents) / 100);
}

function MenuSection({ id, heading, eyebrow, note, defaultOpen, children }) {
  return (
    <details className="nd-menu__section" open={defaultOpen}>
      <summary className="nd-menu__section-title">
        <span className="nd-menu__section-heading">
          <h2 id={id}>{heading}</h2>
          {eyebrow && <p>{eyebrow}</p>}
          {note && <p className="nd-menu__shots-note">{note}</p>}
        </span>
        <ChevronDown className="nd-menu__section-chevron" aria-hidden="true" />
      </summary>
      <div className="nd-menu__section-body">
        <div className="nd-menu__list">{children}</div>
      </div>
    </details>
  );
}

export default function ConsumerMenu() {
  useSeo({
    title: 'Therapies — Avalon Vitality',
    description: 'Explore Avalon Vitality mobile IV therapy options and transparent per-visit pricing.',
    path: '/protocols',
  });
  const [state, setState] = useState(() => ({
    loading: PUBLIC_CATALOG_CUTOVER,
    error: '',
    source: PUBLIC_CATALOG_CUTOVER ? 'pending' : 'transitional',
    offerings: PUBLIC_CATALOG_CUTOVER ? [] : legacyOfferings(),
  }));

  useEffect(() => {
    // The server performs the shadow comparison during import. The public
    // browser must not opportunistically switch sources before the explicit
    // production cutover flag is enabled.
    if (!PUBLIC_CATALOG_CUTOVER) return undefined;
    let active = true;
    fetch('/api/catalog?audience=client', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error('The live menu is temporarily unavailable.');
        return normalizeLiveCatalog(body);
      })
      .then((offerings) => {
        if (active) setState({ loading: false, error: '', source: 'live', offerings });
      })
      .catch((error) => {
        if (!active) return;
        if (PUBLIC_CATALOG_CUTOVER) {
          setState({ loading: false, error: error.message, source: 'unavailable', offerings: [] });
        } else {
          setState((current) => ({ ...current, loading: false, error: '', source: 'transitional' }));
        }
      });
    return () => { active = false; };
  }, []);

  const sections = useMemo(() => {
    const grouped = new Map();
    for (const offering of state.offerings) {
      const key = offering.category.key;
      if (!grouped.has(key)) grouped.set(key, { category: offering.category, offerings: [] });
      grouped.get(key).offerings.push(offering);
    }
    return [...grouped.values()]
      .sort((a, b) => a.category.displayOrder - b.category.displayOrder || a.category.name.localeCompare(b.category.name))
      .map((section) => ({
        ...section,
        offerings: section.offerings.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
      }));
  }, [state.offerings]);

  return (
    <div className="nd-consumer">
      <main className="nd-menu">
        <div className="nd-menu__intro">
          <p>Therapies</p>
          <h1>Physician-formulated.<br />Nurse-delivered.</h1>
          <span>Every visit is reviewed before care and delivered by a registered nurse.</span>
        </div>

        {state.loading ? (
          <div className="flex min-h-64 items-center justify-center text-foreground/45" role="status">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the live menu
          </div>
        ) : null}

        {!state.loading && state.source === 'unavailable' ? (
          <section className="mx-auto my-16 max-w-xl rounded-[2rem] border border-foreground/10 bg-foreground/[0.025] px-6 py-12 text-center">
            <p className="font-heading text-4xl uppercase text-foreground">Menu temporarily unavailable</p>
            <p className="mx-auto mt-4 max-w-md font-body text-sm leading-relaxed text-foreground/55">
              We could not verify the current offerings and prices, so no stale menu is being shown. Please check back shortly.
            </p>
          </section>
        ) : null}

        {!state.loading && state.source !== 'unavailable' ? sections.map((section, index) => (
          <MenuSection
            key={section.category.key}
            id={`menu-${section.category.key}`}
            heading={section.category.name}
            eyebrow={SECTION_EYEBROWS[section.category.key]}
            note={SECTION_NOTES[section.category.key]}
            defaultOpen={index === 0}
          >
            {section.offerings.map((offering) => (
              <Link key={offering.id} to={offering.detailPath} className="nd-menu__item">
                <span className="nd-menu__bag" aria-hidden="true">
                  {offering.image ? <img src={offering.image} alt="" loading="lazy" decoding="async" /> : null}
                </span>
                <span className="nd-menu__item-copy">
                  <strong>{offering.name}</strong>
                  <small>{offering.description}</small>
                </span>
                <span className="nd-menu__item-price">
                  {offering.priceCents ? money(offering.priceCents) : offering.displayPrice}
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </MenuSection>
        )) : null}

        <p className="nd-consumer__medical-note">
          General wellness services only. Treatment requires intake, consent, and clinical approval.
        </p>
      </main>

      <ConsumerFooter />
    </div>
  );
}
