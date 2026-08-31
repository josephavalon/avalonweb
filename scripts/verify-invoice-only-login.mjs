import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const cornerMenu = read('src/components/landing/CornerMenuHeader.jsx');
const navbar = read('app-modules/source/components/landing/Navbar.jsx');
const routes = read('src/App.jsx');
const nurseLogin = read('app-modules/pages/NurseLogin.jsx');
const invoiceUnlock = read('app-modules/pages/invoice/InvoiceUnlock.jsx');
const invoiceSession = read('src/lib/invoiceSession.js');
const invoiceUnlockApi = read('api/invoice/unlock.js');
const invoiceToken = read('api/_lib/invoice-token.js');

const frontDoorItems = cornerMenu.match(/const FRONT_DOOR_ITEMS = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.match(frontDoorItems, /label: 'Login', to: '\/nurse-login'/,
  'the public LOGIN item must open the invoice-only nurse gate');
assert.doesNotMatch(frontDoorItems, /\/login\?role=nurse/,
  'the public LOGIN item must never expose the full Nurse Portal');

assert.match(navbar, /signedOutLoginPath = isFrontDoorHost\(\) \? '\/nurse-login' : '\/login'/,
  'the responsive public navbar must use the same invoice-only entry');
assert.match(routes, /path="\/nurse" element=\{<Navigate to="\/nurse-login" replace \/>\}/,
  'the generic /nurse alias must resolve to invoice-only access');
assert.match(routes, /path="\/nurse-login" element=\{<NurseLogin \/>\}/,
  'the invoice-only login route must remain mounted');

assert.match(nurseLogin, /<InvoiceUnlock onUnlocked=\{\(\) => navigate\('\/invoice'\)\} \/>/,
  'successful shared nurse login must route only to /invoice');
assert.match(nurseLogin, /onClick=\{\(\) => navigate\('\/admin\/login'\)\}/,
  'the only full-platform choice from the shared login must be Admin');

assert.match(invoiceUnlock, /fetch\('\/api\/invoice\/unlock'/,
  'shared nurse credentials must be checked only by the invoice unlock API');
assert.match(invoiceSession, /sessionStorage\.setItem\(INVOICE_TOKEN_KEY, token\)/,
  'invoice access must remain a tab-scoped session');
assert.doesNotMatch(invoiceSession, /localStorage\.setItem/,
  'shared invoice access must not persist beyond the browser tab');
assert.match(invoiceUnlockApi, /createInvoiceToken\(\)/,
  'the shared credential must mint only the scoped invoice token');
assert.doesNotMatch(invoiceUnlockApi, /supabase|requireAuth|activePortal|provider\//i,
  'the invoice unlock API must not create an Avalon OS session');
assert.match(invoiceToken, /this token authenticates the DOOR, not the nurse/i,
  'the invoice-token authority boundary must stay explicit');
assert.doesNotMatch(routes, /invoiceSession|readInvoiceToken|isInvoiceSignedIn/,
  'the application route guard must never treat an invoice token as OS authentication');

console.log('Invoice-only login QA passed: shared nurses reach /invoice; Admin remains the full-platform path.');
