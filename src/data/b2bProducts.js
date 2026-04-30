// Bay to Breakers presale catalog.
// To wire real Square checkout: in Square Dashboard, create a Payment Link
// for each product (and each combo with compression add-on), then drop
// the URL into squareUrl below. Coupons stay client-side; the squareUrl
// always points to the BASE price; coupon discount is shown to the
// buyer in the order summary and noted in the Square checkout title.

// B2B IV inventory — 150 Bay 2 Bay IV bags total for race day.
// Pool is shared across the single IV + every bundle that contains it.
// Update B2B_IV_SOLD manually as Square reports sales (or wire a webhook later).
export const B2B_IV_INVENTORY = 150;
export const B2B_IV_SOLD = 0;

export const IM_SHOT_INVENTORY = 1000;
export const IM_SHOT_SOLD = 0;

export const B2B_PRODUCTS = [
  // Singles
  {
    id: 'bay2bay-shot',
    name: 'Bay 2 Bay IM Shot',
    tagline: 'Finish-line shot',
    description: 'Quick intramuscular shot at the finish line — choose B-12 or glutathione. Recovery in a hurry.',
    price: 40,
    originalPrice: 60,
    kind: 'single',
    consumes: ['imShot'],
    flair: { line1: '33% OFF', line2: 'ONE DAY ONLY' },
    squareUrl: 'https://square.link/u/REPLACE-ME-SHOT',
  },
  {
    id: 'bay2bay-iv',
    name: "Myer's Cocktail",
    tagline: 'Race-day hydration, full bag',
    description: '500 mL classic Myer\'s cocktail. Magnesium, calcium gluconate, B-1, B-2, B-3, B-5, B-6, B-12, and high-dose Vitamin C. Saline base. Delivered at the finish line.',
    price: 120,
    originalPrice: 300,
    kind: 'single',
    consumes: ['b2bIv'],
    flair: { line1: '60% OFF', line2: 'ONE DAY ONLY' },
    squareUrl: 'https://square.link/u/REPLACE-ME-IV',
  },
  {
    id: 'bay2bay-cbd',
    name: 'CBD IV',
    tagline: 'Full-body recovery',
    description: 'Premium CBD infusion (zero THC) for post-race recovery. 99mg therapeutic dose.',
    price: 200,
    originalPrice: 350,
    kind: 'single',
    consumes: ['cbdIv'],
    flair: { line1: '43% OFF', line2: 'ONE DAY ONLY' },
    squareUrl: 'https://square.link/u/REPLACE-ME-CBD',
  },
  // Bundles — pre-priced with a small bundle discount baked in
  {
    id: 'bundle-iv-im',
    name: 'B2B IV + IM',
    tagline: 'Save $10 — IV + shot',
    description: 'Full Bay 2 Bay IV plus an intramuscular B-12 or glutathione shot at the finish line.',
    price: 150,
    originalPrice: 360,
    kind: 'bundle',
    consumes: ['b2bIv', 'imShot'],
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-IV-IM',
  },
  {
    id: 'bundle-full-recovery',
    name: 'B2B IV + IM + Boots',
    tagline: 'Save $20 — IV + shot + boots',
    description: 'The whole protocol at the finish line: Bay 2 Bay IV, intramuscular B-12 or glutathione shot, and Normatec compression. Three steps, dialed.',
    price: 190,
    originalPrice: 410,
    kind: 'bundle',
    consumes: ['b2bIv', 'imShot', 'boots'],
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-FULL',
  },
  {
    id: 'bundle-cbd-compression',
    name: 'CBD IV + Boots',
    tagline: 'Save $20 — Premium recovery',
    description: 'CBD IV with Normatec compression boots. Premium recovery pairing for hard race effort.',
    price: 380,
    originalPrice: 400,
    kind: 'bundle',
    consumes: ['cbdIv', 'boots'],
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-CBD-COMP',
  },
  {
    id: 'bundle-cbd-im-boots',
    name: 'CBD IV + IM + Boots',
    tagline: 'Save $20 — Full premium stack',
    description: 'CBD IV, intramuscular B-12 or glutathione shot, and Normatec compression boots. Top-tier finish-line protocol.',
    price: 420,
    originalPrice: 460,
    kind: 'bundle',
    consumes: ['cbdIv', 'imShot', 'boots'],
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-CBD-IM-COMP',
  },
];

export const COMPRESSION_ADDON = {
  id: 'compression',
  name: 'Normatec compression boots',
  description: 'Normatec compression boots, 20-minute session. Add to any IV or shot.',
  price: 50,
  squareUrl: 'https://square.link/u/REPLACE-ME-COMPRESSION',
};

// Coupon codes — manage manually here. Apply % off or flat amount.
// Codes are case-insensitive at runtime.
export const COUPONS = {
  'BAYTOBAY10':   { kind: 'percent', value: 10, label: '10% off' },
  'NOFAKESWEAT':  { kind: 'percent', value: 20, label: '20% off' },
  'FOUNDER25':    { kind: 'percent', value: 25, label: '25% off' },
  'CREW50':       { kind: 'flat',    value: 50, label: '$50 off' },
  'PRESS':        { kind: 'percent', value: 100, label: 'Press comp' },
};
