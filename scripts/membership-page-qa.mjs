import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, menu, app] = await Promise.all([
  readFile(new URL('../app-modules/pages/MembershipPricing.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/landing/CornerMenuHeader.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
]);

assert.match(page, /founderPlans\('vitamin', 195\)/, 'Vitamin memberships must remain $195 per credit.');
assert.match(page, /founderPlans\('nad', 300, 4\)/, 'NAD+ memberships must remain $300 per credit.');
assert.match(page, /\$50 founder savings per credit/, 'NAD+ founder savings must remain explicit.');
assert.equal((page.match(/to="\/start"/g) || []).length, 2, 'Card and closing membership CTAs must both target /start.');
assert.doesNotMatch(page, /api\/memberships\/plans|membership\/review|\/login\?redirect/, 'Public membership CTAs must not depend on billing or login APIs.');

const menuLinks = menu.match(/\{ label: 'Memberships', to: '\/membership' \}/g) || [];
assert.equal(menuLinks.length, 2, 'Memberships must appear in both public and OS dropdown menus.');
assert.match(menu, /Start'[^\n]*\n\s*\{ label: 'Memberships'/, 'Memberships must appear directly beneath Start in the OS menu.');
const startThenMemberships = /\{ label: 'Start', to: '\/start' \},\n\s*\{ label: 'Memberships', to: '\/membership' \}/g;
assert.equal((menu.match(startThenMemberships) || []).length, 2, 'Memberships must appear directly beneath Start in both dropdown menus.');

assert.match(app, /Route path="\/membership" element=\{<MembershipPricing \/>\}/, 'The public membership route must render the pricing page.');

console.log('Membership page QA passed.');
