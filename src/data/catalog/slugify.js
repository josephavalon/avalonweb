export const slugify = (name) =>
  String(name)
    .toLowerCase()
    .replace(/\+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const money = (value) => `$${Number(value).toLocaleString()}`;
export const subscriberPrice = (value) => money(Math.round(Number(value) * 0.8));
export const annualPrice = (value) => money(Math.round(Number(value) * 0.8 * 9));
