import assert from 'node:assert/strict';
import {
  NAD_FOUNDER_DISCOUNT,
  founderPricingFor,
} from '../src/data/catalog/founder-pricing.js';

assert.equal(NAD_FOUNDER_DISCOUNT, 50, 'NAD+ founder discount must remain $50');

for (const standard of [350, 500, 650, 700, 800, 1000, 1200]) {
  const pricing = founderPricingFor({ price: `$${standard.toLocaleString()}` }, 'nad');
  assert.equal(pricing.standard, standard);
  assert.equal(pricing.founder, standard - 50);
  assert.equal(pricing.discount, 50);
}

assert.deepEqual(
  founderPricingFor({ protocolKey: 'hydration', oneTime: '$200' }, 'iv-vitamins'),
  { standard: 200, founder: 175, discount: 25 },
);
assert.deepEqual(
  founderPricingFor({ protocolKey: 'myers', oneTime: '$250' }, 'iv-vitamins'),
  { standard: 250, founder: 195, discount: 55 },
);
assert.deepEqual(
  founderPricingFor({ protocolKey: 'postnight', oneTime: '$250' }, 'iv-vitamins'),
  { standard: 250, founder: 195, discount: 55 },
);
assert.equal(
  founderPricingFor({ protocolKey: 'immunity', oneTime: '$250' }, 'iv-vitamins'),
  null,
  'Non-promoted IVs must keep their catalog price',
);

console.log('Menu founder pricing QA passed.');
