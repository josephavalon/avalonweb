// Group recovery catalog.
// To wire real Square checkout: in Square Dashboard, create a Payment Link
// for each product (and each combo with compression add-on), then drop
// the URL into squareUrl below. Coupons stay client-side; the squareUrl
// always points to the BASE price; coupon discount is shown to the
// buyer in the order summary and noted in the Square checkout title.

// Group IV inventory — 200 IV bags reserved for private group programs.
// Pool is shared across the single IV + every bundle that contains it.
// Update B2B_IV_SOLD manually as Square reports sales (or wire a webhook later).
export const B2B_IV_INVENTORY = 200;
export const B2B_IV_SOLD = 0;

export const IM_SHOT_INVENTORY = 1000;
export const IM_SHOT_SOLD = 0;

export const B2B_PRODUCTS = [
  // Singles
  {
    id: 'bay2bay-shot',
    name: 'IM Shot',
    tagline: 'Quick boost',
    description: 'B-12 or glutathione.',
    price: 40,
    originalPrice: 60,
    kind: 'single',
    consumes: ['imShot'],
    flair: { line1: 'GROUP', line2: 'RATE' },
    squareUrl: 'https://square.link/u/xpooOvYi',
  },
  {
    id: 'bay2bay-iv',
    name: 'Group IV',
    tagline: 'Full hydration',
    description: "500 mL Myers' Cocktail.",
    price: 120,
    originalPrice: 300,
    kind: 'single',
    consumes: ['b2bIv'],
    flair: { line1: 'GROUP', line2: 'RATE' },
    squareUrl: 'https://square.link/u/5Mqez7ub',
  },
  {
    id: 'bay2bay-cbd',
    name: 'CBD IV Review',
    tagline: 'Approval gated',
    description: 'Held for clinical and legal approval.',
    price: 200,
    originalPrice: 350,
    kind: 'single',
    consumes: ['cbdIv'],
    flair: { line1: 'GROUP', line2: 'RATE' },
    squareUrl: 'https://square.link/u/LdDbC7pU',
  },
  // Bundles — pre-priced with a small bundle discount baked in
  {
    id: 'bundle-iv-im',
    name: 'IV + IM',
    tagline: 'IV + shot',
    description: 'Hydration plus B-12 or glutathione.',
    price: 150,
    originalPrice: 160,
    kind: 'bundle',
    consumes: ['b2bIv', 'imShot'],
    flair: { line1: 'SAVE $10', line2: 'VS SINGLES' },
    squareUrl: 'https://square.link/u/VXdPe9jg',
  },
  {
    id: 'bundle-full-recovery',
    name: 'IV + IM + Boots',
    tagline: 'Full support',
    description: 'IV, shot, and compression.',
    price: 190,
    originalPrice: 210,
    kind: 'bundle',
    consumes: ['b2bIv', 'imShot', 'boots'],
    flair: { line1: 'SAVE $20', line2: 'VS SINGLES' },
    squareUrl: 'https://square.link/u/vLIDwBdS',
  },
  {
    id: 'bundle-cbd-compression',
    name: 'CBD Review + Boots',
    tagline: 'Approval gated',
    description: 'CBD IV review plus compression.',
    price: 240,
    originalPrice: 250,
    kind: 'bundle',
    consumes: ['cbdIv', 'boots'],
    flair: { line1: 'SAVE $10', line2: 'VS SINGLES' },
    squareUrl: 'https://square.link/u/b7Ni8IYl',
  },
  {
    id: 'bundle-cbd-im-boots',
    name: 'CBD Review + IM + Boots',
    tagline: 'Approval gated',
    description: 'CBD IV review, shot, and compression.',
    price: 270,
    originalPrice: 290,
    kind: 'bundle',
    consumes: ['cbdIv', 'imShot', 'boots'],
    flair: { line1: 'SAVE $20', line2: 'VS SINGLES' },
    squareUrl: 'https://square.link/u/VGk7yHA8',
  },
];

export const COMPRESSION_ADDON = {
  id: 'compression',
  name: 'Normatec compression boots',
  description: 'Compression add-on.',
  price: 50,
  originalPrice: 60,
  flair: { line1: 'GROUP', line2: 'ADD-ON' },
  squareUrl: 'https://square.link/u/REPLACE-ME-COMPRESSION',
};

// Coupon codes — manage manually here. Apply % off or flat amount.
// Codes are case-insensitive at runtime.
export const COUPONS = {
  'GROUP10':      { kind: 'percent', value: 10, label: '10% off' },
  'NOFAKESWEAT':  { kind: 'percent', value: 20, label: '20% off' },
  'FOUNDER25':    { kind: 'percent', value: 25, label: '25% off' },
  'CREW50':       { kind: 'flat',    value: 50, label: '$50 off' },
  'PRESS':        { kind: 'percent', value: 100, label: 'Press comp' },
};
