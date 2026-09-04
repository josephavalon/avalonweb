import { getProduct, productsByCategory } from './catalog/products-by-category.js';
import { slugify } from './catalog/slugify.js';
import { formatPrice, founderPricingFor, priceNumber } from './catalog/founder-pricing.js';

const OFFERING_SLUGS = Object.freeze({
  hydration: 'hydration-iv',
  myers: 'myers-cocktail-iv',
  'myers-iv': 'myers-cocktail-iv',
  recovery: 'recovery-iv',
  performance: 'event-performance-iv',
  'performance-iv': 'event-performance-iv',
  'night-out': 'post-night-out-iv',
  'night-out-iv': 'post-night-out-iv',
  postnight: 'post-night-out-iv',
  hangover: 'post-night-out-iv',
  'food-poisoning': 'food-poisoning-iv',
  jetlag: 'jet-lag-iv',
  'jet-lag': 'jet-lag-iv',
  energy: 'energy-iv',
  immunity: 'immunity-iv',
  beauty: 'beauty-iv',
});

const SERVICE_DETAIL_PATTERN = /clinici|registered nurse|appointment|administration|visit|review|window/i;

export function consumerProductIngredients(product) {
  const source = product.ingredients || product.included || product.benefits || [];
  return [...new Set(source.filter((item) => item && !SERVICE_DETAIL_PATTERN.test(item)))].slice(0, 10);
}

/** Resolve public visit information from the same catalog used by the menu. */
export function resolveConsumerOffering({ protocolKey, doseKey, therapyName, category, slug } = {}) {
  if (protocolKey === 'cbd' || category === 'cbd') return null;

  let resolvedCategory = category;
  let product = category && slug ? getProduct(category, slug)?.treatment : null;
  let isStartingPrice = false;
  if (!product && (category || slug)) return null;

  if (!product) {
    const normalizedName = slugify(therapyName || '');
    if (protocolKey === 'nad' || /^nad(?:-|$)/.test(normalizedName)) {
      resolvedCategory = 'nad';
      const doses = productsByCategory.nad.treatments;
      const namedDose = doses.find((item) => slugify(item.name) === normalizedName
        || item.doseKey?.replace('_', '-') === normalizedName);
      product = doseKey ? doses.find((item) => item.doseKey === doseKey) : namedDose;
      if (!product && !doseKey && (!normalizedName || ['nad', 'nad-iv'].includes(normalizedName))) {
        product = doses.find((item) => item.doseKey === 'nad_250');
        isStartingPrice = true;
      }
    } else {
      resolvedCategory = 'iv-vitamins';
      const treatments = productsByCategory[resolvedCategory].treatments;
      const canonicalSlug = OFFERING_SLUGS[normalizedName] || normalizedName;
      product = treatments.find((item) => slugify(item.name) === canonicalSlug);
      if (product && protocolKey && product.protocolKey !== protocolKey) return null;
      if (!product && protocolKey && (!normalizedName || normalizedName === protocolKey)) {
        product = treatments.find((item) => item.protocolKey === protocolKey);
      }
    }
  }

  if (!product || product.addOnOnly) return null;
  if (protocolKey && product.protocolKey !== protocolKey) return null;
  if (doseKey && product.doseKey !== doseKey) return null;
  if (therapyName) {
    const name = slugify(therapyName);
    const productSlug = slugify(product.name);
    const isGenericNad = product.protocolKey === 'nad' && ['nad', 'nad-iv'].includes(name);
    const nameMatches = name === productSlug
      || OFFERING_SLUGS[name] === productSlug
      || product.doseKey?.replace('_', '-') === name
      || getProduct(resolvedCategory, name)?.treatment === product
      || isGenericNad;
    if (!nameMatches) return null;
  }
  const founderPricing = founderPricingFor(product, resolvedCategory);
  const standardPrice = priceNumber(product.oneTime ?? product.price);
  const price = founderPricing?.founder ?? standardPrice;
  if (price === null) return null;

  return {
    name: isStartingPrice ? 'NAD+ IV' : product.name,
    price,
    standardPrice,
    priceLabel: `${isStartingPrice ? 'From ' : ''}${formatPrice(price)}`,
    duration: isStartingPrice ? 'Depends on your selected dose' : product.duration || product.timeline?.at(-1)?.value || 'Confirmed before care',
    detailsPath: isStartingPrice ? '/protocols' : `/products/${resolvedCategory}/${slugify(product.name)}`,
    ingredients: consumerProductIngredients(product),
    founderPricing,
    product,
    category: resolvedCategory,
    isStartingPrice,
  };
}
