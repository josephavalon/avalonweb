import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

// Execute the actual page in an isolated shallow render and flush its effects.
// The network, alerts, analytics and session writes are spies, never providers.
// This catches the original regression: opening a receipt URL was enough to
// notify staff and count a submission, even with only a draft guided selection.
const source = await fs.readFile(new URL('../src/pages/RequestReceived.jsx', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' });

function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== 'object') return [];
  return [node, ...descendants(node.props?.children)];
}

function renderedText(node) {
  if (Array.isArray(node)) return node.map(renderedText).join(' ');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node && typeof node === 'object' ? renderedText(node.props?.children) : '';
}

for (const draftFlow of [null, { id: 'qa-draft', selectedAt: 1, recommendedAt: 1 }]) {
  const calls = [];
  const effects = [];
  const metadata = [];
  const spy = (name, result) => (...args) => { calls.push({ name, args }); return result; };
  const jsx = (type, props) => ({ type, props });
  const Link = 'RouterLink';
  const modules = {
    react: { useEffect: (effect) => effects.push(effect) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-router-dom': { Link },
    'lucide-react': { ArrowRight: 'ArrowRight', FileText: 'FileText', Check: 'Check' },
    '@/lib/seo': { useSeo: (value) => metadata.push(value) },
    '@/lib/intakeAlert': { pingIntakeAlert: spy('staff-alert', true) },
    '@/lib/analytics': {
      ANALYTICS_EVENTS: { REQUEST_SUBMITTED: 'request_submitted' },
      trackConsented: spy('analytics', true),
    },
    '@/lib/guidedSession': {
      readGuidedFlow: () => draftFlow,
      timestampGuidedFlow: spy('guided-submission-write'),
    },
  };
  const module = { exports: {} };
  const fetch = spy('network', Promise.resolve({ ok: true }));
  const context = {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `Unreviewed page dependency: ${name}`);
      return modules[name];
    },
    fetch,
    window: {
      fetch,
      sessionStorage: { getItem: () => null, setItem: spy('session-write') },
    },
  };

  vm.runInNewContext(code, context, { filename: 'RequestReceived.jsx' });
  // Repeated renders also cover a harmless refresh/remount of the public page.
  for (let render = 0; render < 2; render += 1) {
    const tree = module.exports.default();
    while (effects.length) effects.shift()();
    assert.deepEqual(calls, [], 'Viewing request follow-up must not send alerts, record submissions, write receipts or call APIs');
    const content = renderedText(tree);
    assert.match(content, /If you submitted the visit request form/);
    assert.doesNotMatch(content, /request received|your request has been received/i);
    const elements = descendants(tree);
    assert.ok(elements.some((element) => element.type === Link && element.props.to === '/start'), 'The visitor needs a working request path');
    assert.ok(elements.some((element) => element.type === 'a' && element.props.href === 'tel:+14159807708'), 'The visitor needs a direct contact path');
  }
  assert.equal(metadata.at(-1).robots, 'noindex, nofollow');
}

console.log('Request follow-up QA passed: direct visits and draft-flow visits produce no alerts, submission events or API calls.');
