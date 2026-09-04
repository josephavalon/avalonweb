import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const helper = await transform(await read('src/lib/careHost.js'), { format: 'cjs' });
const component = await transform(await read('src/components/CareRequestRedirect.jsx'), {
  loader: 'jsx', jsx: 'automatic', format: 'cjs',
});
const publicHosts = ['avalonvitality.co', 'www.avalonvitality.co', 'care.avalonvitality.co'];
let scenarios = 0;

function check(hostname, search, stored, expected, storageThrows = false) {
  const state = new Map(stored ? [['care-preview', '1']] : []);
  const noExternalNavigation = () => assert.fail('Public booking must never leave Avalon');
  const window = {
    location: { hostname, search, replace: noExternalNavigation, assign: noExternalNavigation },
    sessionStorage: {
      getItem: (key) => { if (storageThrows) throw new Error('Blocked storage'); return state.get(key); },
      setItem: (key, value) => { if (storageThrows) throw new Error('Blocked storage'); state.set(key, value); },
    },
  };
  const helperModule = { exports: {} };
  vm.runInNewContext(helper.code, { module: helperModule, exports: helperModule.exports, window });
  assert.equal(helperModule.exports.isCareHost(), expected, `${hostname}${search}`);

  let legacyMounted = false;
  const legacy = { type: () => { legacyMounted = true; return null; }, props: {} };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { useState: (initialize) => [initialize()] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-router-dom': { Navigate: 'Navigate' },
    '@/lib/careHost': helperModule.exports,
  };
  const module = { exports: {} };
  vm.runInNewContext(component.code, {
    module, exports: module.exports, window,
    require: (name) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; },
  });
  const result = module.exports.default({ children: legacy });
  if (typeof result.type === 'function') result.type(result.props);
  if (expected) {
    assert.equal(result.type, 'Navigate');
    assert.equal(result.props.to, '/start');
    assert.equal(result.props.replace, true);
    assert.equal(legacyMounted, false, 'The legacy intake must not mount on a public host');
  } else {
    assert.equal(result, legacy, 'Existing beta behavior must remain available');
  }
  scenarios += 1;
}

for (const host of publicHosts) {
  check(host, '', false, true);
  check(host, '?frontdoor=0', false, true, true);
}
check('beta.avalonvitality.co', '', false, false);
check('localhost', '', false, false);
check('preview.vercel.app', '?care=1', false, true);
check('preview.vercel.app', '', true, true);
check('beta.avalonvitality.co', '', false, false, true);

const config = JSON.parse(await read('vercel.json'));
for (const host of publicHosts) {
  for (const path of ['/book', '/book-now', '/booking', '/booking/confirmation', '/checkout', '/checkout/success', '/custom']) {
    const rule = config.redirects.find((row) => row.source === path && row.has?.some((condition) => condition.type === 'host' && condition.value === host));
    assert.equal(rule?.destination, '/start', `${host}${path} needs an internal server redirect`);
    assert.equal(rule?.permanent, false);
  }
}
for (const path of [
  'src/App.jsx', 'src/components/landing/StickyBookBar.jsx', 'src/components/admin/AdminShell.jsx',
  'app-modules/source/components/landing/Navbar.jsx', 'app-modules/pages/Menu.jsx',
  'app-modules/pages/products/ProductDetail.jsx',
]) {
  assert.doesNotMatch(await read(path), /ACUITY_URL|CareAcuityForward|https?:\/\/[^\s'"<>]*(?:acuityscheduling\.com|avalonvitality\.as\.me)/i, path);
}
await assert.rejects(read('src/components/CareAcuityForward.jsx'), { code: 'ENOENT' });
console.log(`Care request redirect QA passed: ${scenarios} host/render scenarios, 21 scoped server redirects, legacy intake mount prevention and public link removal.`);
