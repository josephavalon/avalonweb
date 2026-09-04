import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

// Execute the actual endpoint with only explicit stubs in a separate VM. No
// real environment, provider client, network API or rate-limit store is exposed.
const source = fs.readFileSync(new URL('../api/events/host-inquiry.js', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'js', format: 'cjs', target: 'es2022' }).code;
const validBody = {
  name: 'Test Inquiry Person',
  email: 'test-inquiry@example.invalid',
  phone: '4155550100',
  where: 'Test Venue',
  date: '2026-12-10',
  eventType: 'Office',
  guestRange: '25-50',
  guests: 30,
  ivDrips: 10,
  shots: 20,
};

async function invoke({
  method = 'POST',
  body = validBody,
  env = { RESEND_API_KEY: 'test-only-resend-key' },
  limitOk = true,
  providerResult = { data: { id: 'stub-delivery-id' }, error: null },
  providerThrows = false,
} = {}) {
  const calls = [];
  const logs = [];
  const rateLimits = [];
  let clients = 0;
  class StubResend {
    constructor(key) {
      clients += 1;
      assert.equal(key, env.RESEND_API_KEY.trim());
      this.emails = { send: async (payload) => {
        calls.push(payload);
        if (providerThrows) throw new Error(`${validBody.name} ${validBody.email} ${validBody.phone}`);
        return providerResult;
      } };
    }
  }
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    process: { env: { ...env } },
    console: Object.fromEntries(['log', 'warn', 'error'].map((level) => [level, (...args) => logs.push(args.join(' '))])),
    require: (name) => {
      if (name === 'resend') return { Resend: StubResend };
      if (name === '../_lib/rate-limit.js') return {
        clientIp: () => '192.0.2.25',
        checkRateLimit: async (options) => {
          rateLimits.push(options);
          return { ok: limitOk };
        },
      };
      throw new Error(`Unstubbed dependency blocked: ${name}`);
    },
  });
  vm.runInContext(compiled, context, { filename: 'host-inquiry.js', timeout: 1000 });
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; },
  };
  await module.exports.default({ method, body }, response);
  const logged = logs.join('\n');
  for (const value of [validBody.name, validBody.email, validBody.phone, validBody.where]) {
    assert.ok(!logged.includes(value), `Logs must not contain contact/inquiry data: ${value}`);
  }
  return { response, calls, logs, rateLimits, clients };
}

let passed = 0;
async function check(label, run) {
  await run();
  passed += 1;
  console.log(`PASS: ${label}`);
}

await check('missing or blank provider key fails with 503 and contact retry instructions', async () => {
  for (const env of [{}, { RESEND_API_KEY: '  ' }]) {
    const { response, clients } = await invoke({ env });
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.ok, false);
    assert.match(response.body.error, /try again.*415\) 980-7708/i);
    assert.equal(clients, 0);
  }
});

await check('provider SDK errors fail with 502 even when a message ID is present', async () => {
  for (const data of [null, { id: 'untrusted-id' }]) {
    const { response, calls } = await invoke({ providerResult: { data, error: { message: `${validBody.email} rejected` } } });
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.ok, false);
    assert.equal(calls.length, 1);
    assert.ok(!response.body.error.includes(validBody.email));
  }
});

await check('absent or invalid provider message IDs never return success', async () => {
  for (const providerResult of [null, {}, { data: null }, { data: {} }, { data: { id: '' } }, { data: { id: ' ' } }, { data: { id: 123 } }]) {
    const { response } = await invoke({ providerResult });
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.ok, false);
  }
});

await check('thrown provider errors fail without logging reflected contact data', async () => {
  const { response, calls } = await invoke({ providerThrows: true });
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.ok, false);
  assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify(response.body).includes(validBody.email));
});

await check('provider acceptance is required for success and preserves delivery fields', async () => {
  const { response, calls, logs, rateLimits } = await invoke();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, 'littonjose@gmail.com');
  assert.equal(calls[0].from, 'Avalon Events <support@avalonvitality.co>');
  assert.equal(calls[0].replyTo, validBody.email);
  assert.equal(calls[0].subject, 'Event inquiry — Test Venue · 2026-12-10');
  for (const value of [validBody.name, validBody.email, validBody.phone]) assert.ok(calls[0].text.includes(value));
  assert.equal(logs.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(rateLimits)), [{ key: 'events-host-inquiry:192.0.2.25', windowMs: 600000, max: 5 }]);
});

await check('existing contact validation rejects bad requests before provider delivery', async () => {
  for (const [body, error] of [
    [{ ...validBody, name: ' ' }, 'Your name is required.'],
    [{ ...validBody, email: '', phone: '' }, 'Add an email or mobile number.'],
    [{ ...validBody, email: 'invalid' }, 'Check your email address.'],
    [{ ...validBody, phone: '123' }, 'Check your mobile number.'],
  ]) {
    const { response, clients } = await invoke({ body });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { ok: false, error });
    assert.equal(clients, 0);
  }
});

await check('JSON input, phone-only contact, defaults and count limits are preserved', async () => {
  const { response, calls } = await invoke({
    body: JSON.stringify({ name: '  Test Inquiry Person  ', phone: validBody.phone, guests: 99999, ivDrips: 9999, shots: -5 }),
    env: { RESEND_API_KEY: 'test-only-resend-key', RESEND_FROM_EMAIL: 'Test Sender <test-sender@example.invalid>' },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].from, 'Test Sender <test-sender@example.invalid>');
  assert.equal(Object.hasOwn(calls[0], 'replyTo'), false);
  assert.match(calls[0].text, /Where:  Not specified/);
  assert.match(calls[0].text, /When:   Flexible/);
  assert.match(calls[0].text, /Guests: 5000/);
  assert.match(calls[0].text, /IV drips: 500 · Recovery shots: 0/);
});

await check('email normalization is preserved', async () => {
  const { response, calls } = await invoke({ body: { ...validBody, email: '  TEST-INQUIRY@EXAMPLE.INVALID  ', phone: '' } });
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].replyTo, validBody.email);
});

await check('method and rate-limit rejection do not instantiate the provider', async () => {
  const method = await invoke({ method: 'GET' });
  assert.equal(method.response.statusCode, 405);
  assert.equal(method.clients, 0);
  assert.equal(method.rateLimits.length, 0);
  const limited = await invoke({ limitOk: false });
  assert.equal(limited.response.statusCode, 429);
  assert.equal(limited.response.body.ok, false);
  assert.equal(limited.clients, 0);
});

await check('malformed JSON retains failure behavior and never calls the provider', async () => {
  const { response, clients } = await invoke({ body: '{invalid' });
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.ok, false);
  assert.equal(clients, 0);
});

console.log(`Host inquiry offline delivery QA passed ${passed} scenarios. No network or real environment used.`);
