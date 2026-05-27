import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const BASE_URL = (process.env.INTERACTION_QA_BASE_URL || 'http://localhost:4173').replace(/\/$/, '');
const PORT = Number(process.env.INTERACTION_QA_DEBUG_PORT || 9351);
const PASSWORD = process.env.INTERACTION_QA_PASSWORD || 'JonJones1986';

const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const DESKTOP = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };

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
        if (res.statusCode >= 400) reject(new Error(`${method} ${url} failed with ${res.statusCode}: ${body}`));
        else resolve(body ? JSON.parse(body) : null);
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
  throw new Error('Chrome executable not found. Set CHROME_PATH to run interaction QA.');
}

async function waitForChrome() {
  const deadline = Date.now() + 10_000;
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
    this.nextId = 1;
    this.pending = new Map();
    this.consoleIssues = [];
    this.networkIssues = [];
    this.requests = new Map();
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
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      const text = message.params.args?.map((arg) => arg.value || arg.description || '').join(' ').trim();
      if (text) this.consoleIssues.push(text);
    }
    if (message.method === 'Network.requestWillBeSent') {
      this.requests.set(message.params.requestId, message.params.request?.url || '');
    }
    if (message.method === 'Network.loadingFailed') {
      const url = this.requests.get(message.params.requestId) || '';
      this.networkIssues.push([message.params.errorText, url].filter(Boolean).join(' · '));
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 25_000);
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

async function evalOnPage(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Page evaluation failed.');
  }
  return result.result.value;
}

async function waitForReady(cdp) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const state = await evalOnPage(cdp, 'document.readyState');
    if (state === 'complete') return;
    await wait(160);
  }
  throw new Error('Page did not finish loading.');
}

async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', viewport);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: viewport.mobile });
}

async function open(cdp, route, viewport = MOBILE) {
  cdp.consoleIssues = [];
  cdp.networkIssues = [];
  cdp.requests.clear();
  await setViewport(cdp, viewport);
  await cdp.send('Page.navigate', { url: `${BASE_URL}${route}` });
  await waitForReady(cdp);
  await evalOnPage(cdp, `sessionStorage.setItem('av.splash.seen', '1'); localStorage.setItem('cookieConsent', 'allowed');`);
  await wait(450);
}

async function waitForText(cdp, pattern, timeout = 7000) {
  const source = pattern instanceof RegExp ? pattern.source : String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = pattern instanceof RegExp ? pattern.flags : 'i';
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ok = await evalOnPage(cdp, `new RegExp(${JSON.stringify(source)}, ${JSON.stringify(flags.includes('i') ? 'i' : '')}).test(document.body?.innerText || '')`);
    if (ok) return;
    await wait(180);
  }
  const text = await evalOnPage(cdp, `(document.body?.innerText || '').slice(0, 900)`);
  throw new Error(`Timed out waiting for ${pattern}. Current text: ${text}`);
}

async function clickText(cdp, text, options = {}) {
  const clicked = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(String(text).toLowerCase())};
    const exact = ${JSON.stringify(Boolean(options.exact))};
    const candidates = Array.from(document.querySelectorAll('button, a[href], [role="button"]'));
    const visible = candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const label = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' &&
        (exact ? label === wanted : label.includes(wanted));
    });
    const target = visible[${Number(options.index || 0)}] || null;
    if (!target) return { ok: false, labels: candidates.map((el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 50) };
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return { ok: true, label: (target.innerText || target.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim() };
  })()`);
  if (!clicked.ok) throw new Error(`Could not click "${text}". Visible controls: ${clicked.labels.join(' | ')}`);
  await wait(options.wait ?? 650);
  return clicked.label;
}

async function clickAria(cdp, text) {
  const clicked = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(String(text).toLowerCase())};
    const candidates = Array.from(document.querySelectorAll('button[aria-label], a[aria-label]'));
    const target = candidates.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (el.getAttribute('aria-label') || '').toLowerCase().includes(wanted);
    });
    if (!target) return { ok: false, labels: candidates.map((el) => el.getAttribute('aria-label')).slice(0, 50) };
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return { ok: true, label: target.getAttribute('aria-label') };
  })()`);
  if (!clicked.ok) throw new Error(`Could not click aria "${text}". Labels: ${clicked.labels.join(' | ')}`);
  await wait(650);
  return clicked.label;
}

async function fillByLabel(cdp, label, value) {
  const filled = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(String(label).toLowerCase())};
    const labels = Array.from(document.querySelectorAll('label'));
    const wrapper = labels.find((el) => (el.innerText || '').trim().toLowerCase().startsWith(wanted));
    const input = wrapper?.querySelector('input, textarea, select');
    if (!input) return false;
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(input, ${JSON.stringify(value)}) : input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!filled) throw new Error(`Could not fill "${label}".`);
  await wait(120);
}

async function assertHealthy(cdp, label) {
  const health = await evalOnPage(cdp, `(() => {
    const text = document.body?.innerText || '';
    return {
      path: location.pathname,
      textLength: text.trim().length,
      overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth,
      badWords: /whoops|our bad|something went wrong|cannot read properties|product missing|product not found/i.test(text + ' ' + document.title),
    };
  })()`);
  const failures = [];
  if (health.textLength < 80) failures.push(`blank render ${health.textLength}`);
  if (health.overflow > 2) failures.push(`horizontal overflow ${health.overflow}px`);
  if (health.badWords) failures.push('bad failure copy visible');
  if (cdp.consoleIssues.length) failures.push(`console: ${cdp.consoleIssues.slice(0, 3).join(' | ')}`);
  if (cdp.networkIssues.some((issue) => !/ERR_ABORTED|favicon/i.test(issue))) failures.push(`network: ${cdp.networkIssues.slice(0, 3).join(' | ')}`);
  if (failures.length) throw new Error(`${label} failed: ${failures.join('; ')}`);
  return health;
}

function session(role) {
  const map = {
    admin: ['ADMIN001', 'Admin', '/admin'],
    provider: ['NURSE001', 'Stephanie R.', '/provider/shift'],
    client: ['CLIENT001', 'Sarah', '/members/dashboard'],
  };
  const [username, name, redirect] = map[role];
  return {
    id: `interaction-${role}`,
    username,
    canonicalUsername: username,
    name,
    role: role === 'provider' ? 'provider' : role,
    redirect,
    seededAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    authMode: 'pre-api-hard-wall',
    mfa: 'placeholder',
    securityWall: 'pre-api-hard-wall',
  };
}

async function setSession(cdp, role) {
  const value = JSON.stringify(session(role));
  await evalOnPage(cdp, `sessionStorage.setItem('av.session', ${JSON.stringify(value)});`);
}

async function testBookingAddOnFlow(cdp) {
  await open(cdp, '/book?reset=1', MOBILE);
  await evalOnPage(cdp, 'localStorage.clear(); sessionStorage.setItem("av.splash.seen", "1");');
  await open(cdp, '/book?reset=1', MOBILE);
  await clickText(cdp, 'Perform');
  await clickText(cdp, 'One-Time');
  await waitForText(cdp, /Myers/i);
  await clickAria(cdp, "Select Myers");
  await waitForText(cdp, /Add-ons/i);
  await clickText(cdp, 'Extra Fluid');
  await waitForText(cdp, /\$275|275/);
  await clickText(cdp, 'Continue with 1 add-on');
  await waitForText(cdp, /Where should we come/i);
  await clickText(cdp, 'Office');
  await clickText(cdp, 'Office · SoMa');
  await clickText(cdp, 'Continue');
  await waitForText(cdp, /When do you want us/i);
  await clickText(cdp, 'Tomorrow');
  await clickText(cdp, 'Continue');
  await fillByLabel(cdp, 'Name', 'Demo Client');
  await fillByLabel(cdp, 'Phone', '(415) 555-0144');
  await fillByLabel(cdp, 'Email', 'demo.client@avalon.local');
  await clickText(cdp, 'Hold $50');
  await waitForText(cdp, /Hold received|Confirmation|Myers/i);
  const booking = await evalOnPage(cdp, `JSON.parse(localStorage.getItem('av.local.lastBooking') || 'null')`);
  if (booking?.protocolKey !== 'myers') throw new Error(`Booking protocol mismatch: ${booking?.protocolKey}`);
  if (!booking?.addOns?.includes('Extra Fluid')) throw new Error('Booking did not retain Extra Fluid add-on.');
  if (booking?.subtotal !== 275) throw new Error(`Booking subtotal expected 275, got ${booking?.subtotal}.`);
  await assertHealthy(cdp, 'booking add-on flow');
  console.log(`PASS interaction booking: ${booking.id} Myers + Extra Fluid.`);
}

async function testSubscriptionTierSwitch(cdp) {
  await open(cdp, '/subscription', MOBILE);
  await clickText(cdp, 'Starter');
  await waitForText(cdp, /\$199|Start Starter/i);
  await clickText(cdp, 'VIP');
  await waitForText(cdp, /\$899|Start VIP/i);
  await clickText(cdp, 'Start VIP');
  await waitForText(cdp, /VIP|checkout|secure|subscription/i);
  await assertHealthy(cdp, 'subscription tier switching');
  console.log('PASS interaction subscription: starter and VIP switching works.');
}

async function testRolePortals(cdp) {
  const checks = [
    { role: 'client', route: '/members/dashboard', expected: /dashboard|protocol|visit|message/i },
    { role: 'client', route: '/members/messages', expected: /message|care|support/i },
    { role: 'provider', route: '/provider/shift', expected: /shift|eta|client|route/i },
    { role: 'provider', route: '/provider/clients', expected: /client roster|clients/i },
    { role: 'admin', route: '/admin', expected: /admin|today|command|requests/i },
    { role: 'admin', route: '/admin/bookings', expected: /booking|visit|request|command/i },
    { role: 'admin', route: '/admin/inventory', expected: /inventory|stock|kit/i },
  ];
  for (const item of checks) {
    await open(cdp, item.route, MOBILE);
    await setSession(cdp, item.role);
    await open(cdp, item.route, MOBILE);
    await waitForText(cdp, item.expected);
    await assertHealthy(cdp, `${item.role} ${item.route}`);
  }
  console.log(`PASS interaction portals: ${checks.length} protected surfaces render under demo auth.`);
}

async function testFooterAndProductAlias(cdp) {
  await open(cdp, '/', DESKTOP);
  const footer = await evalOnPage(cdp, `(() => {
    const element = document.querySelector('footer');
    const rect = element.getBoundingClientRect();
    return { height: Math.round(rect.height), text: element.innerText };
  })()`);
  if (footer.height > 380) throw new Error(`Footer too tall after tighten pass: ${footer.height}px.`);
  if (!/Book|Plans|Protocols|Launches|Terms|Privacy/.test(footer.text)) throw new Error('Footer core links missing.');

  await open(cdp, '/products/iv-vitamins/myers', MOBILE);
  await waitForText(cdp, /Myers/i);
  const notFound = await evalOnPage(cdp, `/Product missing|Product Not Found/i.test(document.body.innerText + document.title)`);
  if (notFound) throw new Error('/products/iv-vitamins/myers still renders product-not-found copy.');
  await assertHealthy(cdp, 'footer and product alias');
  console.log('PASS interaction polish: footer tight and Myers alias resolves.');
}

let chrome;
let profileDir;
let cdp;

try {
  const chromePath = await findChrome();
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-interaction-qa-'));
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
  const target = await requestJson(`http://127.0.0.1:${PORT}/json/new?about:blank`, 'PUT');
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  await testBookingAddOnFlow(cdp);
  await testSubscriptionTierSwitch(cdp);
  await testRolePortals(cdp);
  await testFooterAndProductAlias(cdp);

  // Password is intentionally referenced so the test fails loudly if the beta credential changes.
  if (PASSWORD !== 'JonJones1986' && !process.env.INTERACTION_QA_PASSWORD) {
    throw new Error('Unexpected beta demo password default.');
  }

  console.log('Interaction QA passed: critical pre-API clicks are functional.');
} finally {
  cdp?.close();
  await stopChrome(chrome);
  await removeProfileDir(profileDir);
}
