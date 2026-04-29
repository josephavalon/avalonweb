// Bay to Breakers presale catalog.
// To wire real Square checkout: in Square Dashboard, create a Payment Link
// for each product (and each combo with compression add-on), then drop
// the URL into squareUrl below. Coupons stay client-side; the squareUrl
// always points to the BASE price; coupon discount is shown to the
// buyer in the order summary and noted in the Square checkout title.

export const B2B_PRODUCTS = [
  {
    id: 'bay2bay-iv',
    name: 'Bay 2 Bay IV',
    tagline: 'Race-day hydration, full bag',
    description: 'Avalon’s Bay-to-Breakers IV. 1L hydration with electrolytes, B-complex, glutathione. Delivered at the expo or near the finish line.',
    price: 120,
    squareUrl: 'https://square.link/u/REPLACE-ME-IV',
  },
  {
    id: 'bay2bay-shot',
    name: 'Bay 2 Bay IM Shot',
    tagline: 'In-and-out energy boost',
    description: 'Quick intramuscular B12 + lipo shot. Five minutes, no IV. Pre-race or recovery.',
    price: 40,
    squareUrl: 'https://square.link/u/REPLACE-ME-SHOT',
  },
  {
    id: 'bay2bay-cbd',
    name: 'CBD IV',
    tagline: 'Full-body recovery',
    description: 'Premium CBD infusion (zero THC) for post-race recovery. 99mg therapeutic dose.',
    price: 350,
    squareUrl: 'https://square.link/u/REPLACE-ME-CBD',
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
  'FOUNDER25':    { kind: 'percent', value: 25, label: '25% off' },
  'CREW50':       { kind: 'flat',    value: 50, label: '$50 off' },
  'PRESS':        { kind: 'percent', value: 100, label: 'Press comp' },
};
