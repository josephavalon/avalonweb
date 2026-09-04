const FEATURED_IV_FOUNDER_PRICES = Object.freeze({
  hydration: 175,
  myers: 195,
  postnight: 195,
});

export const NAD_FOUNDER_DISCOUNT = 50;

export function priceNumber(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function founderPricingFor(product, categorySlug) {
  const standard = priceNumber(product?.oneTime ?? product?.price);
  if (standard === null) return null;

  const founder = categorySlug === 'nad'
    ? standard - NAD_FOUNDER_DISCOUNT
    : FEATURED_IV_FOUNDER_PRICES[product?.protocolKey];

  if (!Number.isFinite(founder) || founder >= standard) return null;

  return {
    standard,
    founder,
    discount: standard - founder,
  };
}

export function formatPrice(value) {
  return `$${Number(value).toLocaleString()}`;
}
