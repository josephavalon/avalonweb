import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const BASE_URL = (process.env.LOGIN_QA_BASE_URL || 'http://localhost:4173').replace(/\/$/, '');
const PORT = Number(process.env.LOGIN_QA_DEBUG_PORT || 9348);
const PASSWORD = process.env.LOGIN_QA_PASSWORD || '';
if (!PASSWORD) {
  throw new Error('LOGIN_QA_PASSWORD is required for demo login QA.');
}

const VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
};

const MANUAL_CASES = [
  { label: 'client exact', username: 'CLIENT0001', password: PASSWORD, expectedPath: '/members/dashboard', expectedRole: 'client' },
  { label: 'client alias with spaces', username: ' client ', password: ` ${PASSWORD} `, expectedPath: '/members/dashboard', expectedRole: 'client' },
];

const ADMIN_CASES = [
  { label: 'admin exact', username: 'ADMIN001', password: PASSWORD, expectedPath: '/admin', expectedRole: 'admin' },
];

const SHORTCUT_CASES = [];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

function requestJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`${method} ${url} failed with ${res.statusCode}: ${body}`));
          return;
        }
        resolve(body ? JSON.parse(body) : null);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error('Chrome executable not found. Set CHROME_PATH to run login QA.');
}

async function waitForChrome() {
  const deadline = Date.now() + Number(process.env.CHROME_READY_TIMEOUT_MS || 30_000);
  while (Date.now() < deadline) {
    try {
      await requestJson(`http://127.0.0.1:${PORT}/json/version`);
      return;
    } catch {
      await wait(120);
    }
  }
  throw new Error('Timed out waiting for Chrome debugging port.');
}

async function stopChrome(processRef) {
  if (!processRef || processRef.killed) return;
  processRef.kill();
  await Promise.race([
    new Promise((resolve) => processRef.once('exit', resolve)),
    wait(1800),
  ]);
}

async function removeProfileDir(dir) {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.targetId = null;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleIssues = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
      this.ws.addEventListener('message', (event) => this.handleMessage(event));
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }

    if (message.method === 'Runtime.exceptionThrown') {
      this.consoleIssues.push(message.params.exceptionDetails?.text || 'Runtime exception');
    }

    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      const text = message.params.args?.map((arg) => arg.value || arg.description || '').join(' ').trim();
      if (text) this.consoleIssues.push(text);
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 45_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  close() {
    this.ws?.close();
  }
}

async function createPageClient() {
  const target = await requestJson(`http://127.0.0.1:${PORT}/json/new?about:blank`, 'PUT');
  const client = new CdpClient(target.webSocketDebuggerUrl);
  client.targetId = target.id;
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  return client;
}

async function closePageClient(client) {
  if (!client) return;
  const targetId = client.targetId;
  client.close();
  if (!targetId) return;
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/close/${encodeURIComponent(targetId)}`);
  } catch {}
}

async function waitForReady(cdp) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (result.result?.value === 'complete') return;
    await wait(160);
  }
  throw new Error('Login page did not finish loading.');
}

async function evalOnPage(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed.');
  }
  return result.result?.value;
}

async function waitForPageCondition(cdp, expression, label, timeout = 8_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ok = await evalOnPage(cdp, expression);
    if (ok) return;
    await wait(160);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function openLogin(cdp) {
  cdp.consoleIssues = [];
  await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Runtime.evaluate', {
    expression: `location.href = ${JSON.stringify(`${BASE_URL}/login`)}; true;`,
    returnByValue: true,
  });
  await waitForReady(cdp);
  await wait(350);
  await evalOnPage(cdp, `(() => {
    try {
      sessionStorage.clear();
      localStorage.setItem('cookieConsent', 'allowed');
    } catch {}
    return true;
  })()`);
  await waitForPageCondition(cdp, `(() => {
    const username = document.querySelector('#client-id');
    const password = document.querySelector('#client-password');
    const submit = document.querySelector('form button[type="submit"]');
    return Boolean(username && password && submit);
  })()`, 'login controls');
}

async function openAdminLogin(cdp) {
  cdp.consoleIssues = [];
  await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Runtime.evaluate', {
    expression: `location.href = ${JSON.stringify(`${BASE_URL}/admin/login`)}; true;`,
    returnByValue: true,
  });
  await waitForReady(cdp);
  await wait(350);
  await evalOnPage(cdp, `(() => {
    try {
      sessionStorage.clear();
      localStorage.setItem('cookieConsent', 'allowed');
    } catch {}
    return true;
  })()`);
  await waitForPageCondition(cdp, `(() => {
    const username = document.querySelector('#admin-id');
    const password = document.querySelector('#admin-password');
    const submit = document.querySelector('form button[type="submit"]');
    return Boolean(username && password && submit);
  })()`, 'admin login controls');
}

async function waitForPath(cdp, expectedPath) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const state = await evalOnPage(cdp, `(() => ({
      path: location.pathname,
      text: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400),
      session: (() => {
        try { return JSON.parse(sessionStorage.getItem('av.session') || 'null'); }
        catch { return null; }
      })(),
    }))()`);
    if (state.path === expectedPath) return state;
    await wait(180);
  }
  throw new Error(`Expected ${expectedPath}, still at ${await evalOnPage(cdp, 'location.pathname')}.`);
}

async function runManualLogin(cdp, testCase) {
  await openLogin(cdp);
  const ok = await evalOnPage(cdp, `(() => {
    const setValue = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const ready = setValue('#client-id', ${JSON.stringify(testCase.username)})
      && setValue('#client-password', ${JSON.stringify(testCase.password)});
    const submit = document.querySelector('form button[type="submit"]');
    if (!ready || !submit) return false;
    submit.click();
    return true;
  })()`);
  if (!ok) throw new Error(`Could not submit manual login for ${testCase.label}.`);

  const state = await waitForPath(cdp, testCase.expectedPath);
  if (state.session?.role !== testCase.expectedRole) {
    throw new Error(`${testCase.label} produced role ${state.session?.role || 'none'}, expected ${testCase.expectedRole}.`);
  }
  if (cdp.consoleIssues.length) throw new Error(`${testCase.label} console issue: ${cdp.consoleIssues[0]}`);
  console.log(`PASS login manual: ${testCase.label}`);
}

async function runShortcutLogin(cdp, testCase) {
  await openLogin(cdp);
  const clicked = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(testCase.username)};
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find((candidate) => (candidate.innerText || '').includes(wanted));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not find shortcut button ${testCase.username}.`);

  const state = await waitForPath(cdp, testCase.expectedPath);
  if (state.session?.role !== testCase.expectedRole) {
    throw new Error(`${testCase.username} produced role ${state.session?.role || 'none'}, expected ${testCase.expectedRole}.`);
  }
  if (cdp.consoleIssues.length) throw new Error(`${testCase.username} console issue: ${cdp.consoleIssues[0]}`);
  console.log(`PASS login shortcut: ${testCase.username}`);
}

async function runAdminLogin(cdp, testCase) {
  await openAdminLogin(cdp);
  const ok = await evalOnPage(cdp, `(() => {
    const setValue = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const ready = setValue('#admin-id', ${JSON.stringify(testCase.username)})
      && setValue('#admin-password', ${JSON.stringify(testCase.password)});
    const submit = document.querySelector('form button[type="submit"]');
    if (!ready || !submit) return false;
    submit.click();
    return true;
  })()`);
  if (!ok) throw new Error(`Could not submit admin login for ${testCase.label}.`);

  const state = await waitForPath(cdp, testCase.expectedPath);
  if (state.session?.role !== testCase.expectedRole) {
    throw new Error(`${testCase.label} produced role ${state.session?.role || 'none'}, expected ${testCase.expectedRole}.`);
  }
  if (cdp.consoleIssues.length) throw new Error(`${testCase.label} console issue: ${cdp.consoleIssues[0]}`);
  console.log(`PASS login admin: ${testCase.label}`);
}

let chrome;
let profileDir;
let cdp;

try {
  const chromePath = await findChrome();
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-login-qa-'));
  chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });

  await waitForChrome();
  for (const testCase of MANUAL_CASES) {
    await closePageClient(cdp);
    cdp = await createPageClient();
    await runManualLogin(cdp, testCase);
  }
  for (const testCase of ADMIN_CASES) {
    await closePageClient(cdp);
    cdp = await createPageClient();
    await runAdminLogin(cdp, testCase);
  }
  for (const testCase of SHORTCUT_CASES) {
    await closePageClient(cdp);
    cdp = await createPageClient();
    await runShortcutLogin(cdp, testCase);
  }

  console.log(`Login QA passed ${MANUAL_CASES.length + ADMIN_CASES.length + SHORTCUT_CASES.length} mobile beta login checks.`);
} finally {
  await closePageClient(cdp);
  await stopChrome(chrome);
  await removeProfileDir(profileDir);
}
