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
    id: 'everything',
    name: 'Everything IV',
    description: 'Every base ingredient + every add-on, packaged.',
    blurb: 'Maxed Myers + every in-bag boost + an IM shot + Normatec + extra fluid bag. ~90 minutes. The Works.',
    options: [
      { id: 'works',     name: 'The Works',          price: 599, sub: 'Myers + extra mag, B-complex, B-12, Vit C, glutathione, zinc, amino blend + Normatec + extra fluid + 1 IM shot.' },
      { id: 'works-nad', name: 'The Works + NAD+',   price: 749, sub: 'Everything above + 50 mg NAD+ push. Cellular reset on top.' },
    ],
  },
];

// Add-ons. Two flavors:
//   1) Extra IV meds — in-bag boosts that stack with any IV base.
//   2) Stack-able IM shots + physical add-ons that work alongside any visit
//      (some valid even with IM-only).
// `compatibleBaseCategories` filters which bases each add-on appears for.
// `group` lets the UI render them under section headers.
export const ADD_ONS = [
  // --- Extra IV meds (in-bag boosts; IV bases only) -----------------------
  { id: 'extra-mag',      name: 'Extra magnesium',          price: 25, sub: '+200 mg in-bag boost.',                  group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-bcx',      name: 'Extra B-complex',          price: 20, sub: 'Full spectrum B vitamins added to bag.',  group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-b12',      name: 'Extra B-12 (in IV)',       price: 20, sub: '+1 mg methylcobalamin in-bag.',           group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-vitc',     name: 'Extra Vitamin C',          price: 30, sub: '+5 g high-dose Vitamin C in-bag.',        group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-gluta',    name: 'Extra glutathione push',   price: 40, sub: '+200 mg push during your IV.',            group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-zinc',     name: 'Extra zinc',               price: 20, sub: '+5 mg in-bag boost.',                     group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-amino',    name: 'Amino acid blend',         price: 35, sub: 'L-carnitine, taurine, lysine in-bag.',    group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'extra-nad-push', name: 'NAD+ push (50 mg)',        price: 150, sub: 'NAD+ push during your IV.',              group: 'Extra IV meds', compatibleBaseCategories: ['iv-vitamins', 'iv-cbd'] },

  // --- Stack-able IM shots (work with any base, including IM-only) -------
  { id: 'add-im-b12',     name: 'Add B-12 IM shot',         price: 60, sub: 'Methylcobalamin shot.',                   group: 'Stack a shot',     compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'add-im-gluta',   name: 'Add glutathione shot',     price: 80, sub: 'Master antioxidant push.',                group: 'Stack a shot',     compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'add-im-vitd',    name: 'Add Vitamin D shot',       price: 60, sub: 'For documented deficiency.',              group: 'Stack a shot',     compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },

  // --- Physical add-ons (IV bases only) ----------------------------------
  { id: 'extra-fluid',    name: 'Extra fluid bag',          price: 75, sub: 'Second 500 mL bag during your IV.',       group: 'Recovery',          compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
  { id: 'normatec',       name: 'Normatec compression',     price: 60, sub: '20 min legs-only compression therapy.',   group: 'Recovery',          compatibleBaseCategories: ['iv-vitamins', 'iv-nad', 'iv-cbd'] },
];

export const findOption = (categoryId, optionId) => {
  const cat = BASE_CATEGORIES.find(c => c.id === categoryId);
  return cat?.options.find(o => o.id === optionId) || null;
};
