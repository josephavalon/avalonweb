import { IM_SHOTS, IV_ADDONS, IV_SESSIONS, PACKAGES } from '../../src/data/catalog.js';

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/^pkg-/, '')
    .replace(/^iv-/, '')
    .replace(/^addon-/, '')
    .replace(/^im-/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function addPriceKey(map, key, price) {
  const normalizedKey = normalizeKey(key);
  const amount = Number(price);
  if (!normalizedKey || !Number.isFinite(amount)) return;
  if (map.has(normalizedKey)) return;
  map.set(normalizedKey, amount);
}

function buildItemPriceMap() {
  const map = new Map();

  for (const session of IV_SESSIONS) {
    if (Array.isArray(session.doses) && session.doses.length) {
      const firstDose = session.doses[0];
      addPriceKey(map, session.key, firstDose.price);
      for (const dose of session.doses) {
        addPriceKey(map, dose.key, dose.price);
        const doseAmount = String(dose.label || '').match(/(\d+)\s*mg/i)?.[1];
        if (doseAmount) addPriceKey(map, `${dose.key}mg`, dose.price);
      }
    } else {
      addPriceKey(map, session.key, session.price);
    }
  }

  for (const shot of IM_SHOTS) addPriceKey(map, shot.label, shot.price);
  for (const pack of PACKAGES) {
    addPriceKey(map, pack.key, pack.price);
    for (const item of pack.items || []) addPriceKey(map, item.cartKey || item.key || item.label, item.price);
  }

  const aliasEntries = {
    custom_hydration: map.get('hydration'),
    custom_recovery: map.get('recovery'),
    custom_energy: map.get('energy'),
    custom_myers: map.get('myers'),
    custom_immunity: map.get('immunity'),
    custom_beauty: map.get('beauty'),
    custom_postnight: map.get('postnight'),
    custom_travel: map.get('jetlag'),
    custom_advanced: map.get('nad'),
    custom_cbd: map.get('cbd_vitality') ?? map.get('cbd'),
  };
  for (const [key, price] of Object.entries(aliasEntries)) addPriceKey(map, key, price);

  return map;
}

function buildAddonLabelMap() {
  const map = new Map();
  for (const addon of IV_ADDONS) map.set(normalize(addon.label), Number(addon.price));
  for (const shot of IM_SHOTS) map.set(normalize(shot.label), Number(shot.price));

  for (const session of IV_SESSIONS) {
    for (const dose of session.doses || []) {
      const doseAmount = String(dose.label || '').match(/(\d+)\s*mg/i)?.[1];
      if (doseAmount) map.set(normalize(`${session.label} ${doseAmount}mg`), Number(dose.price));
    }
  }

  const aliasEntries = {
    'magnesium boost': map.get('magnesium support'),
  };
  for (const [label, price] of Object.entries(aliasEntries)) {
    if (Number.isFinite(price)) map.set(label, price);
  }

  return map;
}

export const ITEM_PRICE_BY_KEY = buildItemPriceMap();
export const ADDON_PRICE_BY_LABEL = buildAddonLabelMap();

export const MEMBERSHIP_PRICE_BY_NAME = new Map(Object.entries({
  starter: 199,
  pro: 389,
  premium: 400,
  vip: 899,
  concierge: 899,
}));

const MEMBERSHIP_TERMS = {
  monthly: { key: 'monthly', months: 1, discount: 0, billing: 'monthly', commitmentMonths: 3 },
  'three month': { key: 'three-month', months: 3, discount: 0.05, billing: 'three-month', commitmentMonths: 3 },
  'three-month': { key: 'three-month', months: 3, discount: 0.05, billing: 'three-month', commitmentMonths: 3 },
  'six month': { key: 'six-month', months: 6, discount: 0.08, billing: 'six-month', commitmentMonths: 6 },
  'six-month': { key: 'six-month', months: 6, discount: 0.08, billing: 'six-month', commitmentMonths: 6 },
  annual: { key: 'annual', months: 12, discount: 0.15, billing: 'annual', commitmentMonths: 12 },
  '12 month': { key: 'annual', months: 12, discount: 0.15, billing: 'annual', commitmentMonths: 12 },
  '12-month': { key: 'annual', months: 12, discount: 0.15, billing: 'annual', commitmentMonths: 12 },
};

function priceForItem(item = {}) {
  const itemType = String(item.type || '').toLowerCase();
  const key = normalizeKey(item.key || item.cartKey || '');
  if (ITEM_PRICE_BY_KEY.has(key)) return ITEM_PRICE_BY_KEY.get(key);

  const label = normalize(item.label || item.name || '');
  if (itemType !== 'iv' && ADDON_PRICE_BY_LABEL.has(label)) return ADDON_PRICE_BY_LABEL.get(label);

  if (label.includes('nad') && label.includes('1000')) return 800;
  if (label.includes('nad') && label.includes('1500')) return 1200;
  if (label.includes('nad') && label.includes('1250')) return 1000;
  if (label.includes('nad') && label.includes('750')) return 650;
  if (label.includes('nad') && label.includes('500')) return 500;
  if (label.includes('nad') && label.includes('250')) return 350;
  if (label.includes('cbd') && label.includes('review plus')) return 450;
  if (label.includes('cbd') && label.includes('132')) return 650;
  if (label.includes('cbd') && label.includes('99')) return 350;
  if (label.includes('cbd') && label.includes('66')) return 300;
  if (label.includes('cbd') && label.includes('33')) return 250;
  if (label.includes('cbd')) return 250;

  return null;
}

export function sanitizeCheckoutItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const price = priceForItem(item);
    if (price == null) {
      throw Object.assign(new Error(`Unknown checkout item: ${item?.label || item?.key || 'item'}`), { status: 400 });
    }
    return {
      ...item,
      price,
      label: item.label || item.key || 'Avalon service',
      type: item.type || 'service',
    };
  });
}

export function sanitizeCheckoutMembership(membership = null) {
  if (!membership) return null;
  const key = normalize(membership.name || '');
  const termKey = normalize(membership.term || membership.billing || 'monthly');
  const term = MEMBERSHIP_TERMS[termKey] || MEMBERSHIP_TERMS.monthly;
  const monthlyPrice = MEMBERSHIP_PRICE_BY_NAME.get(key);
  const price = monthlyPrice == null ? null : Math.max(0, Math.round(monthlyPrice * term.months * (1 - term.discount)));
  if (price == null && key === 'custom') {
    const proposed = Number(membership.price);
    if (Number.isFinite(proposed) && proposed >= 150 && proposed <= 10000) {
      return {
        ...membership,
        price: proposed,
        billing: term.billing,
        term: term.key,
        commitmentMonths: term.commitmentMonths,
      };
    }
  }
  if (price == null) {
    throw Object.assign(new Error(`Unknown membership: ${membership.name || 'membership'}`), { status: 400 });
  }
  return {
    ...membership,
    price,
    monthlyPrice,
    billing: term.billing,
    term: term.key,
    commitmentMonths: term.commitmentMonths,
  };
}
