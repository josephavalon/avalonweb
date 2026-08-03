// Thin barrel — the actual catalog domain lives under src/data/catalog/, split
// by concern (sessions, addons, shots, packages, categories, verticals,
// products-by-category, treatment-builders). Keeping this file as the public
// import surface means every existing `import { ... } from '@/data/catalog'`
// keeps working without churn.

export { slugify, money, subscriberPrice, annualPrice } from './catalog/slugify.js';
export { IV_SESSIONS } from './catalog/iv-sessions.js';
export { IV_ADDONS } from './catalog/iv-addons.js';
export { IM_SHOTS } from './catalog/im-shots.js';
export { PACKAGES } from './catalog/packages.js';
export { IV_CATEGORIES, IV_GOAL_RECOMMENDATION } from './catalog/categories.js';
export { VERTICALS } from './catalog/verticals.js';
export { productsByCategory, getProduct } from './catalog/products-by-category.js';
