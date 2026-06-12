import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.BOOKING_QA_BASE_URL || 'http://localhost:4173';
const PORT = Number(process.env.BOOKING_QA_DEBUG_PORT || 9338);
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };

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
  throw new Error('Chrome executable not found. Set CHROME_PATH to run booking QA.');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
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
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      const text = message.params.args?.map((arg) => arg.value || arg.description || '').join(' ').trim();
      if (text) this.consoleIssues.push(text);
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws?.close();
  }
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

async function waitForAppUrl(cdp) {
  const deadline = Date.now() + 12_000;
  let lastHref = '';
  while (Date.now() < deadline) {
    const href = await evalOnPage(cdp, 'location.href');
    lastHref = href;
    if (href.startsWith(BASE_URL)) return;
    await wait(160);
  }
  throw new Error(`App URL did not load before storage reset. Last URL: ${lastHref || 'unknown'}`);
}

async function clearAvalonStorage(cdp) {
  await evalOnPage(cdp, `(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('av.') || key === 'cookieConsent') localStorage.removeItem(key);
    }
    localStorage.setItem('cookieConsent', 'allowed');
  })()`);
}

async function clickText(cdp, text) {
  const found = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(text)}.toLowerCase();
    const candidates = Array.from(document.querySelectorAll('main button, main a[href], main [role="button"], .fixed button'));
    const matches = candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        (el.innerText || el.textContent || '').trim().toLowerCase().includes(wanted);
    });
    const target = matches.at(-1);
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  })()`);
  if (!found) {
    const buttons = await evalOnPage(cdp, `Array.from(document.querySelectorAll('button, a[href]')).map((el) => (el.innerText || el.textContent || '').trim()).filter(Boolean).slice(0, 24)`);
    throw new Error(`Could not click "${text}". Visible controls: ${buttons.join(' | ')}`);
  }
  await wait(700);
}

async function fillByLabel(cdp, label, value) {
  const filled = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(label)}.toLowerCase();
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const labels = Array.from(document.querySelectorAll('label'));
    const wrapper = labels.find((el) => visible(el) && (el.innerText || '').trim().toLowerCase().startsWith(wanted));
    const input = (wrapper ? Array.from(wrapper.querySelectorAll('input, textarea, select')).find(visible) : null) ||
      Array.from(document.querySelectorAll('input, textarea, select')).find((el) => {
        if (!visible(el)) return false;
        const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
        return aria.startsWith(wanted) || placeholder.startsWith(wanted);
      });
    if (!input) return false;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set;
    setter ? setter.call(input, ${JSON.stringify(value)}) : input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!filled) {
    const fields = await evalOnPage(cdp, `Array.from(document.querySelectorAll('input, textarea, select')).map((el) => ({
      aria: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      type: el.getAttribute('type') || el.tagName.toLowerCase(),
      value: el.value || '',
    })).slice(0, 24)`);
    const body = await evalOnPage(cdp, `(document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 600)`);
    throw new Error(`Could not fill "${label}". Visible fields: ${JSON.stringify(fields)}. Body: ${body}`);
  }
  await wait(120);
}

async function waitForBookingOutcome(cdp) {
  const deadline = Date.now() + 10_000;
  let result = null;

  while (Date.now() < deadline) {
    result = await evalOnPage(cdp, `(() => {
      const booking = JSON.parse(localStorage.getItem('av.local.lastBooking') || 'null');
      const handoff = JSON.parse(localStorage.getItem('av.local.webstore.latestHandoff') || 'null');
      const stripeFrame = Array.from(document.querySelectorAll('iframe')).find((frame) => /stripe|checkout/i.test(frame.src || ''));
      return {
        path: location.pathname,
        body: document.body.innerText || '',
        hasEmbeddedCheckout: Boolean(stripeFrame),
        stripeFrameSrc: stripeFrame?.src || '',
        bookingId: booking?.id || '',
        service: booking?.service || '',
        orderType: booking?.orderType || '',
        gfe: booking?.gfe || '',
        payment: booking?.payment || '',
        contact: booking?.contact || null,
        hasHandoff: Boolean(handoff?.bookingId),
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        width: window.innerWidth,
      };
    })()`);

    if (result.hasEmbeddedCheckout || result.path === '/booking/confirmation') return result;
    await wait(250);
  }

  return result;
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
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
      return;
    } catch {
      await wait(250);
    }
  }
}

let chrome;
let profileDir;
let cdp;

try {
  const chromePath = await findChrome();
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-booking-qa-'));
  chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
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
  await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });

  await cdp.send('Page.navigate', { url: `${BASE_URL}/book?reset=1&fresh=${Date.now()}` });
  await waitForAppUrl(cdp);
  await waitForReady(cdp);
  await clearAvalonStorage(cdp);
  await wait(500);

  await clickText(cdp, '9 therapies');
  await clickText(cdp, 'Recovery');
  await clickText(cdp, 'Next');
  await clickText(cdp, 'No Add-Ons');
  await clickText(cdp, 'Next');
  await clickText(cdp, 'Next');
  await fillByLabel(cdp, 'Address', '188 King St, San Francisco');
  await fillByLabel(cdp, 'ZIP', '94107');
  await clickText(cdp, 'Next');
  await wait(400);
  await fillByLabel(cdp, 'Name', 'QA Mobile Client');
  await fillByLabel(cdp, 'Phone', '(415) 555-0199');
  await fillByLabel(cdp, 'DOB', '01/02/1980');
  await fillByLabel(cdp, 'Email', 'qa@avalonvitality.co');
  await clickText(cdp, 'CONFIRM & PAY');
  const result = await waitForBookingOutcome(cdp);

  const failures = [];
  const staticFallback = result.path === '/booking/confirmation';
  const paymentReady = result.hasEmbeddedCheckout || staticFallback;
  if (!paymentReady) failures.push(`Expected embedded Stripe or static confirmation fallback, got ${result.path}.`);
  if (staticFallback && !/Hold received|Pay the hold|Review comes next|Confirmation/i.test(result.body || '')) failures.push('Confirmation copy did not render.');
  if (result.hasEmbeddedCheckout && !/stripe|checkout/i.test(result.stripeFrameSrc || '')) failures.push('Embedded Stripe iframe source missing.');
  if (!result.hasEmbeddedCheckout && !staticFallback) failures.push('Embedded checkout did not open.');
  if (!result.bookingId && staticFallback) failures.push('No local booking was saved.');
  if (staticFallback && !/Pending|Required|Cleared/i.test(result.gfe || '')) failures.push('GFE state missing.');
  if (staticFallback && !/50|due today|paid/i.test(result.payment || '')) failures.push('Payment state missing.');
  if (staticFallback && !result.contact?.dob) failures.push('DOB missing from saved booking.');
  if (!result.hasHandoff && staticFallback) failures.push('No local handoff marker.');
  if (result.scrollWidth - result.width > 2) failures.push(`Horizontal overflow ${result.scrollWidth - result.width}px.`);
  if (cdp.consoleIssues.length) failures.push(`Console issues: ${cdp.consoleIssues.join(' | ')}`);

  if (failures.length) {
    throw new Error(`Booking QA failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(`Booking QA passed: ${result.hasEmbeddedCheckout ? 'embedded checkout ready' : result.bookingId} · ${result.service || 'Avalon checkout'} · ${result.orderType || 'payment'}.`);
} finally {
  cdp?.close();
  await stopChrome(chrome);
  await removeProfileDir(profileDir);
}
