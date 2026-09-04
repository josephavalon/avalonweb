import assert from 'node:assert/strict';
import { GUIDED_OFFERINGS } from '../src/data/guidedCommerce.js';
import { productsByCategory, getProduct } from '../src/data/catalog/products-by-category.js';
import { founderPricingFor, priceNumber } from '../src/data/catalog/founder-pricing.js';
import { slugify } from '../src/data/catalog/slugify.js';
import { resolveConsumerOffering } from '../src/data/consumerOffering.js';

const failures = [];
let passed = 0;
function check(label, run) {
  try {
    run();
    passed += 1;
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

const canonicalNames = {
  myers: "Myers' Cocktail IV",
  performance: 'Event Performance IV',
  'night-out': 'Post Night Out IV',
  'nad-vitality': 'NAD+ IV Vitality',
};

for (const offering of GUIDED_OFFERINGS) {
  if (offering.protocolKey === 'cbd') continue;
  for (const therapyName of [offering.id, offering.name]) {
    check(`Guided ${offering.id} via ${therapyName}`, () => {
      const resolved = resolveConsumerOffering({
        protocolKey: offering.protocolKey,
        doseKey: offering.doseKey,
        therapyName,
      });
      assert.ok(resolved, 'must resolve a known guided selection');
      assert.equal(resolved.name, canonicalNames[offering.id] || offering.name);
      assert.equal(resolved.product.protocolKey, offering.protocolKey);
      if (offering.doseKey) assert.equal(resolved.product.doseKey, offering.doseKey);
      assert.ok(resolved.duration, 'visit duration must be available');
      assert.ok(resolved.ingredients.length > 0, 'ingredients must be available');
      assert.equal(resolved.isStartingPrice, false, 'a selected offering has an exact price');
      assert.equal(
        getProduct(resolved.category, resolved.detailsPath.split('/').at(-1))?.treatment,
        resolved.product,
        'the details link must resolve to the same catalog product',
      );
    });
  }
}

for (const category of ['iv-vitamins', 'nad']) {
  for (const product of productsByCategory[category].treatments) {
    check(`Menu parity: ${product.name}`, () => {
      const resolved = resolveConsumerOffering({ category, slug: slugify(product.name) });
      const standard = priceNumber(product.oneTime ?? product.price);
      const founder = founderPricingFor(product, category);
      assert.ok(resolved);
      assert.equal(resolved.name, product.name);
      assert.equal(resolved.standardPrice, standard);
      assert.equal(resolved.price, founder?.founder ?? standard);
      assert.deepEqual(resolved.founderPricing, founder);
      assert.equal(resolved.isStartingPrice, false);
    });
    check(`Product-name handoff: ${product.name}`, () => {
      const resolved = resolveConsumerOffering({
        protocolKey: product.protocolKey,
        doseKey: product.doseKey,
        therapyName: product.name,
      });
      assert.ok(resolved, 'product booking handoff must resolve');
      assert.equal(resolved.product, product);
    });
  }
}

for (const input of [
  { protocolKey: 'nad' },
  { therapyName: 'NAD+' },
  { therapyName: 'NAD+ IV' },
]) {
  check(`Generic NAD: ${JSON.stringify(input)}`, () => {
    const resolved = resolveConsumerOffering(input);
    assert.ok(resolved);
    assert.equal(resolved.name, 'NAD+ IV');
    assert.equal(resolved.price, 300);
    assert.equal(resolved.priceLabel, 'From $300');
    assert.equal(resolved.isStartingPrice, true);
    assert.equal(resolved.duration, 'Depends on your selected dose');
    assert.equal(resolved.detailsPath, '/protocols');
  });
}

const rejectedInputs = [
  {},
  { protocolKey: 'missing' },
  { therapyName: 'unknown-treatment' },
  { protocolKey: 'hydration', therapyName: 'unknown-treatment' },
  { protocolKey: 'recovery', therapyName: 'Energy IV' },
  { protocolKey: 'nad', doseKey: 'nad_unknown' },
  { protocolKey: 'nad', therapyName: 'NAD+ IV 999mg' },
  { protocolKey: 'nad', therapyName: 'Hydration IV' },
  { category: 'missing', slug: 'hydration-iv' },
  { category: 'iv-vitamins', slug: 'unknown' },
  { category: 'iv-vitamins' },
  { slug: 'hydration-iv' },
  { protocolKey: 'cbd' },
  { therapyName: 'CBD IV' },
  { category: 'cbd', slug: 'cbd-iv-33mg' },
  { category: 'shots', slug: slugify(productsByCategory.shots.treatments[0].name) },
  { category: 'iv-addons', slug: slugify(productsByCategory['iv-addons'].treatments[0].name) },
  // Conflicting URL fields must not produce an authoritative price for a
  // different treatment or dose than the visitor's selected product.
  { protocolKey: 'recovery', therapyName: 'NAD+ IV 500mg' },
  { protocolKey: 'missing', therapyName: 'NAD+ IV 500mg' },
  { protocolKey: 'hydration', doseKey: 'nad_500' },
  { protocolKey: 'nad', doseKey: 'nad_750', therapyName: 'NAD+ IV 500mg' },
  { protocolKey: 'nad', doseKey: 'nad_500', therapyName: 'Hydration IV' },
  { protocolKey: 'recovery', category: 'iv-vitamins', slug: 'hydration-iv' },
  { protocolKey: 'nad', doseKey: 'nad_500', category: 'nad', slug: 'nad-iv-750mg' },
];

for (const input of rejectedInputs) {
  check(`Reject unknown or conflicting selection ${JSON.stringify(input)}`, () => {
    const resolved = resolveConsumerOffering(input);
    assert.ok(resolved === null, `resolved to ${resolved?.name || 'an unexpected value'}`);
  });
}

for (const [alias, expectedName] of [
  ['launch-performance', 'Event Performance IV'],
  ['food-poisoning', 'Food Poisoning IV'],
]) {
  check(`Legacy product alias ${alias}`, () => {
    const resolved = resolveConsumerOffering({ category: 'iv-vitamins', slug: alias });
    assert.equal(resolved?.name, expectedName);
  });
}

if (failures.length) {
  console.error(`Consumer offering QA: ${passed} passed; ${failures.length} failed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Consumer offering QA passed ${passed} selection, price, dose and rejection checks.`);
}
