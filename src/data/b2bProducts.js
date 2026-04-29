// Bay to Breakers presale catalog.
// To wire real Square checkout: in Square Dashboard, create a Payment Link
// for each product (and each combo with compression add-on), then drop
// the URL into squareUrl below. Coupons stay client-side; the squareUrl
// always points to the BASE price; coupon discount is shown to the
// buyer in the order summary and noted in the Square checkout title.

export const B2B_PRODUCTS = [
  // Singles
  {
    id: 'bay2bay-iv',
    name: 'Bay 2 Bay IV',
    tagline: 'Race-day hydration, full bag',
    description: 'Avalon’s Bay-to-Breakers IV. 1L hydration with electrolytes, B-complex, glutathione. Delivered at the expo or near the finish line.',
    price: 120,
    kind: 'single',
    squareUrl: 'https://square.link/u/REPLACE-ME-IV',
  },
  {
    id: 'bay2bay-shot',
    name: 'Bay 2 Bay IM Shot',
    tagline: 'In-and-out energy boost',
    description: 'Quick intramuscular B12 + lipo shot. Five minutes, no IV. Pre-race or recovery.',
    price: 40,
    kind: 'single',
    squareUrl: 'https://square.link/u/REPLACE-ME-SHOT',
  },
  {
    id: 'bay2bay-cbd',
    name: 'CBD IV',
    tagline: 'Full-body recovery',
    description: 'Premium CBD infusion (zero THC) for post-race recovery. 99mg therapeutic dose.',
    price: 350,
    kind: 'single',
    squareUrl: 'https://square.link/u/REPLACE-ME-CBD',
  },
  // Bundles — pre-priced with a small bundle discount baked in
  {
    id: 'bundle-shot-iv',
    name: 'Pre-Race + Recovery',
    tagline: 'Save $10 — Shot before, IV after',
    description: 'IM shot pre-race for energy. Bay 2 Bay IV at the finish line for recovery. The full race-day arc.',
    price: 150,
    originalPrice: 160,
    kind: 'bundle',
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-SHOT-IV',
  },
  {
    id: 'bundle-iv-compression',
    name: 'IV + Boots',
    tagline: 'Save $10 — Bag and pneumatic recovery',
    description: 'Full Bay 2 Bay IV plus a 20-minute compression therapy session. Walk away ready for Sunday brunch.',
    price: 160,
    originalPrice: 170,
    kind: 'bundle',
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-IV-COMP',
  },
  {
    id: 'bundle-full-recovery',
    name: 'Full Recovery',
    tagline: 'Save $25 — Shot + IV + Boots',
    description: 'The whole protocol: pre-race IM shot, post-race Bay 2 Bay IV, and pneumatic compression. Three steps, dialed.',
    price: 185,
    originalPrice: 210,
    kind: 'bundle',
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-FULL',
  },
  {
    id: 'bundle-cbd-compression',
    name: 'CBD + Boots',
    tagline: 'Save $20 — Premium recovery',
    description: 'CBD IV with compression therapy. The most complete recovery option for hard race effort.',
    price: 380,
    originalPrice: 400,
    kind: 'bundle',
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-CBD-COMP',
  },
  {
    id: 'bundle-crew-of-4',
    name: 'Crew of 4 IVs',
    tagline: 'Save $80 — Run with your team',
    description: 'Four Bay 2 Bay IVs for your crew. Same delivery slot, same nurse, single booking. $400 instead of $480.',
    price: 400,
    originalPrice: 480,
    kind: 'bundle',
    squareUrl: 'https://square.link/u/REPLACE-ME-BUNDLE-CREW',
  },
];

export const COMPRESSION_ADDON = {
  id: 'compression',
  name: 'Compression therapy',
  description: 'Pneumatic compression boots, 20-minute session. Add to any IV or shot.',
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
