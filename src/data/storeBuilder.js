// Store builder data — separate from acuityCatalog because the builder needs
// option-level structure (variants per category, stack-able add-ons) that the
// flat menu doesn't.

export const BASE_CATEGORIES = [
  {
    id: 'iv-vitamins',
    name: 'IV Vitamins',
    description: 'Hydration foundation. Pick a formula.',
    blurb: 'Saline base + vitamin/mineral blend. ~45–60 min.',
    options: [
      { id: 'hydration', name: 'Hydration',       price: 150, sub: 'Magnesium, B-complex. The everyday reset.' },
      { id: 'myers',     name: "Myers' Cocktail", price: 200, sub: 'Magnesium, calcium, B-complex, B-12, Vitamin C.' },
      { id: 'recovery',  name: 'Recovery',        price: 225, sub: 'Glutathione, B-complex, electrolytes.' },
      { id: 'athletic',  name: 'Athletic',        price: 250, sub: 'Amino acids, electrolytes, B-12.' },
      { id: 'glow',      name: 'Glow',            price: 250, sub: 'High-dose Vitamin C, biotin, glutathione.' },
      { id: 'immunity',  name: 'Immunity',        price: 225, sub: 'High-dose Vitamin C, zinc, B-complex.' },
    ],
  },
  {
    id: 'iv-nad',
    name: 'IV NAD+',
    description: 'Cellular repair. Pick a dose.',
    blurb: 'Pure NAD+ infusion. 90 min – 3 hr depending on dose.',
    options: [
      { id: 'nad-250',  name: 'NAD+ 250 mg',  price: 350,  sub: 'Entry / maintenance dose.' },
      { id: 'nad-500',  name: 'NAD+ 500 mg',  price: 600,  sub: 'Standard therapeutic dose.' },
      { id: 'nad-1000', name: 'NAD+ 1000 mg', price: 1100, sub: 'High dose. Protocol patients.' },
    ],
  },
  {
    id: 'iv-cbd',
    name: 'IV CBD',
    description: 'Recovery & calm. Premium CBD infusion.',
    blurb: 'Zero THC. 60–75 min.',
    options: [
      { id: 'cbd-33', name: 'CBD 33 mg', price: 250, sub: 'Standard recovery dose.' },
      { id: 'cbd-66', name: 'CBD 66 mg', price: 400, sub: 'Higher dose for chronic recovery.' },
    ],
  },
  {
    id: 'im-only',
    name: 'IM Shots only',
    description: 'No IV. Quick targeted boost — 5–10 min visit.',
    blurb: 'Choose any combination of intramuscular shots. Fast in, fast out.',
    options: [
      { id: 'im-b12',         name: 'B-12 Shot',         price: 60, sub: 'Energy, focus. Methylcobalamin.' },
      { id: 'im-glutathione', name: 'Glutathione Shot',  price: 80, sub: 'Master antioxidant push.' },
      { id: 'im-vitd',        name: 'Vitamin D Shot',    price: 60, sub: 'For documented deficiency.' },
    ],
  },
];

// Add-ons stack with any IV. Some are also valid alongside an IM-only base.
// `compatibleBaseCategories` controls whether the add-on shows for the picked base.
export const ADD_ONS = [
  { id: 'normatec',       name: 'Normatec compression',     price: 60, sub: '20 min legs-only compression therapy.', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-fluid',    name: 'Extra fluid bag',          price: 75, sub: 'Second 500 mL bag during your IV.',     compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'add-im-b12',     name: 'Add B-12 IM shot',         price: 60, sub: 'Stack onto your visit.',                 compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd', 'im-only'] },
  { id: 'add-im-gluta',   name: 'Add glutathione shot',     price: 80, sub: 'Master antioxidant.',                    compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd', 'im-only'] },
  { id: 'add-im-vitd',    name: 'Add Vitamin D shot',       price: 60, sub: 'Stack onto your visit.',                 compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd', 'im-only'] },
  { id: 'add-nad-push',   name: 'NAD+ push (50 mg)',        price: 150, sub: 'Quick push during your IV.',            compatibleBaseCategories: ['iv-vitamins', 'iv-cbd'] },
];

export const findOption = (categoryId, optionId) => {
  const cat = BASE_CATEGORIES.find(c => c.id === categoryId);
  return cat?.options.find(o => o.id === optionId) || null;
};
