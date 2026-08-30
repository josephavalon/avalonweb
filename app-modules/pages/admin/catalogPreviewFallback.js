import { productsByCategory, slugify } from '@/data/products';

function priceToCents(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function typeForCategory(categoryKey) {
  if (categoryKey === 'iv-addons') return 'add_on';
  if (categoryKey === 'shots') return 'im_injection';
  return 'iv_treatment';
}

// Development-only bridge for visually comparing the future Catalog read model
// with Avalon's current verified client menu. Catalog.jsx dynamically imports
// this module only when import.meta.env.DEV, so none of these legacy rows or
// source imports are present in the production Catalog bundle.
export function getCurrentMenuPreview() {
  const categories = Object.entries(productsByCategory).map(([key, category], index) => ({
    id: `legacy-category:${key}`,
    name: category.categoryLabel || category.title || key,
    description: category.description || '',
    status: 'active',
    display_order: index,
    offering_count: Array.isArray(category.treatments) ? category.treatments.length : 0,
  }));

  const offerings = Object.entries(productsByCategory).flatMap(([categoryKey, category], categoryIndex) =>
    (category.treatments || []).map((treatment, itemIndex) => {
      const publicName = String(treatment.name || '').trim();
      return {
        id: `legacy:${categoryKey}:${slugify(publicName)}`,
        stable_key: `legacy:${categoryKey}:${slugify(publicName)}`,
        internal_name: publicName,
        public_name: publicName,
        short_name: publicName,
        sku: null,
        type: typeForCategory(categoryKey),
        category_id: `legacy-category:${categoryKey}`,
        category_name: category.categoryLabel || category.title || categoryKey,
        status: 'active',
        base_price_cents: priceToCents(treatment.price),
        internal_cost_cents: null,
        estimated_duration_minutes: null,
        duration_label: treatment.duration || '',
        short_description: treatment.desc || treatment.benefitStatement || '',
        client_description: treatment.desc || treatment.benefitStatement || '',
        nurse_instructions: '',
        thumbnail_url: treatment.image || null,
        hero_url: treatment.image || null,
        visibility: {
          client: true,
          nurse: false,
          np: false,
          physician: false,
          admin: true,
          event: false,
          membership: false,
          partner: false,
          public: true,
          private_link: false,
        },
        locations: [],
        inventory_requirements: [],
        availability: [],
        last_updated: null,
        display_order: categoryIndex * 100 + itemIndex,
      };
    }),
  );

  return {
    source: 'development-preview',
    imported: false,
    offerings,
    categories,
    pricing_rules: [],
    availability_rules: [],
    inventory_mappings: [],
    audit_history: [],
  };
}
