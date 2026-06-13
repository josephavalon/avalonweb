import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const SELF_HOST_PREVIEW = !process.env.REVENUE_MATRIX_BASE_URL;
const PREVIEW_PORT = Number(process.env.REVENUE_MATRIX_PREVIEW_PORT || 4173);
const BASE_URL = (process.env.REVENUE_MATRIX_BASE_URL || `http://127.0.0.1:${PREVIEW_PORT}`).replace(/\/$/, '');
const PORT_BASE = Number(process.env.REVENUE_MATRIX_DEBUG_PORT_BASE || 9361);
const DEFAULT_TIMEOUT_MS = Number(process.env.REVENUE_MATRIX_TIMEOUT_MS || 14_000);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

const UAS = {
  desktopChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 360.0.0.0.12',
  tiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 BytedanceWebview TikTok/37.0.0',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone16,2;FBAV/520.0.0.0.0;FBBV/700000000]',
};

const MATRIX = [
  { id: 'desktop-chrome', label: 'Desktop Chrome', engine: 'chrome', viewport: { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, ua: UAS.desktopChrome, assumedShare: 0.30 },
  { id: 'desktop-webkit', label: 'Desktop Safari/WebKit', engine: 'webkit', viewport: { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, ua: UAS.iphoneSafari.replace('iPhone; CPU iPhone OS 18_5 like Mac OS X', 'Macintosh; Intel Mac OS X 10_15_7').replace(' Mobile/15E148', ''), assumedShare: 0.08 },
  { id: 'android-chrome', label: 'Android Chrome', viewport: { width: 412, height: 915, deviceScaleFactor: 3, mobile: true }, ua: UAS.androidChrome, assumedShare: 0.16 },
  { id: 'iphone-webkit', label: 'iPhone Safari/WebKit', engine: 'webkit', viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, ua: UAS.iphoneSafari, assumedShare: 0.24 },
  { id: 'iphone-safari-ua', label: 'iPhone Safari UA on Chrome engine', engine: 'chrome', viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, ua: UAS.iphoneSafari, assumedShare: 0.04, limitation: 'Chrome engine UA sanity check; WebKit proof comes from iphone-webkit.' },
  { id: 'instagram-webview', label: 'Instagram in-app webview UA', viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, ua: UAS.instagram, assumedShare: 0.12 },
  { id: 'tiktok-webview', label: 'TikTok in-app webview UA', viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, ua: UAS.tiktok, assumedShare: 0.06 },
  { id: 'facebook-webview', label: 'Facebook in-app webview UA', viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, ua: UAS.facebook, assumedShare: 0.06 },
];

function selectedMatrix() {
  const only = (process.env.REVENUE_MATRIX_ONLY || '').split(',').map((item) => item.trim()).filter(Boolean);
  return only.length ? MATRIX.filter((item) => only.includes(item.id)) : MATRIX;
}

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

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(900, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPreview(url) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await probe(url)) return true;
    await wait(250);
  }
  return false;
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error('Chrome executable not found. Set CHROME_PATH to run revenue matrix QA.');
}

async function waitForChrome(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await requestJson(`http://127.0.0.1:${port}/json/version`);
      return;
    } catch {
      await wait(120);
    }
  }
  throw new Error(`Timed out waiting for Chrome debugging port ${port}.`);
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
      const { resolve, reject, timeout } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timeout);
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
      const reason = `${message.params.errorText || 'network_failed'} ${url}`.trim();
      if (!/ERR_ABORTED|favicon|chrome-extension/i.test(reason)) this.networkIssues.push(reason);
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, Number(process.env.REVENUE_MATRIX_CDP_TIMEOUT_MS || 45_000));
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  close() {
    this.ws?.close();
  }
}

async function evalOnPage(cdp, expression, label = 'page evaluation') {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`${label} failed: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'unknown page error'}`);
  }
  return result.result.value;
}

async function waitForReady(cdp) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await evalOnPage(cdp, 'document.readyState', 'readyState');
    if (state === 'complete') return;
    await wait(160);
  }
  throw new Error('Page did not finish loading.');
}

async function waitForAppUrl(cdp) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  let lastHref = '';
  while (Date.now() < deadline) {
    const href = await evalOnPage(cdp, 'location.href', 'location check');
    lastHref = href;
    if (href.startsWith(BASE_URL)) return;
    await wait(160);
  }
  throw new Error(`App URL did not load. Last URL: ${lastHref || 'unknown'}`);
}

async function clearAvalonStorage(cdp) {
  await evalOnPage(cdp, `(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('cookieConsent', 'allowed');
    sessionStorage.setItem('av.splash.seen', '1');
  })()`, 'storage reset');
}

async function clickText(cdp, text) {
  const found = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(text)}.toLowerCase();
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const candidates = Array.from(document.querySelectorAll('main button, main a[href], main [role="button"], .fixed button, footer button'));
    const matches = candidates.filter((el) => visible(el) && (el.innerText || el.textContent || '').trim().toLowerCase().includes(wanted));
    const target = matches.at(-1);
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  })()`, `click ${text}`);
  if (!found) {
    const controls = await evalOnPage(cdp, `Array.from(document.querySelectorAll('button, a[href]')).map((el) => (el.innerText || el.textContent || '').trim()).filter(Boolean).slice(0, 28)`, 'visible controls');
    throw new Error(`Could not click "${text}". Visible controls: ${controls.join(' | ')}`);
  }
  await wait(650);
}

async function clickAnyText(cdp, labels) {
  const failures = [];
  for (const label of labels) {
    try {
      await clickText(cdp, label);
      return label;
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
    }
  }
  throw new Error(`Could not click any of ${labels.join(', ')}.\n${failures.join('\n')}`);
}

async function fillByLabel(cdp, label, value) {
  const filled = await evalOnPage(cdp, `(() => {
    const wanted = ${JSON.stringify(label)}.toLowerCase();
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const fields = Array.from(document.querySelectorAll('input, textarea, select')).filter(visible);
    const input = fields.find((el) => {
      const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
      const ownLabel = el.id ? (document.querySelector(\`label[for="\${CSS.escape(el.id)}"]\`)?.innerText || '').trim().toLowerCase() : '';
      const wrapperLabel = (el.closest('label')?.innerText || '').trim().toLowerCase();
      return aria.startsWith(wanted) || placeholder.startsWith(wanted) || ownLabel.startsWith(wanted) || wrapperLabel.startsWith(wanted);
    });
    if (!input) return false;
    input.focus();
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(input, ${JSON.stringify(value)}) : input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`, `fill ${label}`);
  if (!filled) throw new Error(`Could not fill "${label}".`);
  await wait(120);
}

async function assertStickyBookBar(cdp, env) {
  const result = await evalOnPage(cdp, `(() => {
    const controls = Array.from(document.querySelectorAll('button, a[href], [role="button"]'));
    const target = controls.find((el) => {
      const text = (el.innerText || el.textContent || '').trim();
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return /next|continue|confirm|checkout|pay/i.test(text) &&
        rect.width >= 40 &&
        rect.height >= 40 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.pointerEvents !== 'none';
    });
    return target ? { ok: true, text: (target.innerText || target.textContent || '').trim(), width: Math.round(target.getBoundingClientRect().width), height: Math.round(target.getBoundingClientRect().height) } : { ok: false };
  })()`, 'sticky CTA check');
  if (!result.ok) throw new Error(`${env.id}: no visible tappable revenue CTA found.`);
  return result;
}

async function waitForRevenueOutcome(cdp) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  let result = null;
  while (Date.now() < deadline) {
    result = await evalOnPage(cdp, `(() => {
      const booking = JSON.parse(localStorage.getItem('av.local.lastBooking') || 'null');
      const handoff = JSON.parse(localStorage.getItem('av.local.webstore.latestHandoff') || 'null');
      const analytics = JSON.parse(localStorage.getItem('av.analytics.events') || '[]');
      const stripeFrame = Array.from(document.querySelectorAll('iframe')).find((frame) => /stripe|checkout/i.test(frame.src || ''));
      return {
        path: location.pathname,
        body: document.body.innerText || '',
        hasEmbeddedCheckout: Boolean(stripeFrame),
        stripeFrameSrc: stripeFrame?.src || '',
        bookingId: booking?.id || '',
        service: booking?.service || '',
        orderType: booking?.orderType || '',
        hasHandoff: Boolean(handoff?.bookingId),
        analyticsNames: analytics.map((event) => event.name),
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        width: window.innerWidth,
      };
    })()`, 'revenue outcome');
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
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }).catch(() => {});
}

async function stopProcess(processRef) {
  if (!processRef || processRef.killed) return;
  processRef.kill();
  await Promise.race([
    new Promise((resolve) => processRef.once('exit', resolve)),
    wait(1800),
  ]);
}

async function createPreviewSnapshot() {
  const repoRoot = process.cwd();
  const sourceDist = path.join(repoRoot, 'dist');
  const indexPath = path.join(sourceDist, 'index.html');
  try {
    await fs.access(indexPath);
  } catch {
    throw new Error('dist/index.html is missing. Run npm run build before npm run test:revenue-matrix.');
  }

  const snapshotRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-revenue-preview-'));
  await fs.mkdir(path.join(snapshotRoot, 'scripts'), { recursive: true });
  await fs.cp(sourceDist, path.join(snapshotRoot, 'dist'), { recursive: true });
  await fs.copyFile(
    path.join(repoRoot, 'scripts', 'preview-server.mjs'),
    path.join(snapshotRoot, 'scripts', 'preview-server.mjs'),
  );
  return snapshotRoot;
}

async function startSnapshotPreview(snapshotRoot) {
  const preview = spawn('node', ['scripts/preview-server.mjs', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)], {
    cwd: snapshotRoot,
    stdio: 'inherit',
  });
  const startup = await Promise.race([
    waitForPreview(BASE_URL).then((ready) => (ready ? 'ready' : 'timeout')),
    new Promise((resolve) => preview.once('exit', (code) => resolve(`exited ${code ?? 'unknown'}`))),
  ]);
  if (startup !== 'ready') {
    await stopProcess(preview);
    throw new Error(`Revenue matrix preview did not become ready at ${BASE_URL}: ${startup}`);
  }
  return preview;
}

function riskEstimate(env) {
  const monthlySessions = Number(process.env.REVENUE_MATRIX_MONTHLY_SESSIONS || 1000);
  const conversionRate = Number(process.env.REVENUE_MATRIX_CONVERSION_RATE || 0.035);
  const averageOrderValue = Number(process.env.REVENUE_MATRIX_AOV || 275);
  return Math.round(monthlySessions * env.assumedShare * conversionRate * averageOrderValue);
}

async function runCdpEnvironment(chromePath, env, index) {
  const port = PORT_BASE + index;
  let chrome;
  let profileDir;
  let cdp;

  try {
    profileDir = await fs.mkdtemp(path.join(os.tmpdir(), `avalon-revenue-${env.id}-`));
    chrome = spawn(chromePath, [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ], { stdio: 'ignore' });

    await waitForChrome(port);
    const target = await requestJson(`http://127.0.0.1:${port}/json/new?about:blank`, 'PUT');
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', env.viewport);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: env.viewport.mobile });
    await cdp.send('Emulation.setUserAgentOverride', {
      userAgent: env.ua,
      platform: env.viewport.mobile ? 'iPhone' : 'macOS',
    });

    await cdp.send('Page.navigate', { url: `${BASE_URL}/?utm_source=revenue_matrix&utm_medium=qa&utm_campaign=${env.id}` });
    await waitForAppUrl(cdp);
    await waitForReady(cdp);
    await clearAvalonStorage(cdp);

    await cdp.send('Page.navigate', { url: `${BASE_URL}/book?reset=1&matrix=${encodeURIComponent(env.id)}` });
    await waitForReady(cdp);
    await wait(500);
    await clickAnyText(cdp, ['Recovery', 'Hydration']);
    await assertStickyBookBar(cdp, env);
    await clickText(cdp, 'Next');
    await clickText(cdp, 'No Add-Ons');
    await assertStickyBookBar(cdp, env);
    await clickText(cdp, 'Next');
    await clickText(cdp, 'Next');
    await fillByLabel(cdp, 'Address', '188 King St, San Francisco');
    await fillByLabel(cdp, 'ZIP', '94107');
    await assertStickyBookBar(cdp, env);
    await clickText(cdp, 'Next');
    await fillByLabel(cdp, 'Name', 'Revenue Matrix QA');
    await fillByLabel(cdp, 'Phone', '(415) 555-0199');
    await fillByLabel(cdp, 'DOB', '01/02/1980');
    await fillByLabel(cdp, 'Email', `qa+${env.id}@avalonvitality.co`);
    await assertStickyBookBar(cdp, env);
    await clickText(cdp, 'CONFIRM & PAY');
    const outcome = await waitForRevenueOutcome(cdp);

    const failures = [];
    const staticFallback = outcome?.path === '/booking/confirmation';
    if (!outcome?.hasEmbeddedCheckout && !staticFallback) failures.push(`payment step not reached; path=${outcome?.path || 'unknown'}`);
    if (outcome?.hasEmbeddedCheckout && !/stripe|checkout/i.test(outcome.stripeFrameSrc || '')) failures.push('Stripe iframe source missing.');
    if (staticFallback && !/Hold received|Pay the hold|Review comes next|Confirmation/i.test(outcome.body || '')) failures.push('local payment fallback confirmation copy missing.');
    if (staticFallback && !outcome.bookingId) failures.push('local fallback did not persist booking id.');
    if (staticFallback && !outcome.hasHandoff) failures.push('local fallback did not persist checkout handoff marker.');
    if ((outcome?.scrollWidth || 0) - (outcome?.width || 0) > 2) failures.push(`horizontal overflow ${(outcome.scrollWidth || 0) - (outcome.width || 0)}px`);
    for (const required of ['step_viewed', 'step_completed', 'checkout_started']) {
      if (!outcome?.analyticsNames?.includes(required)) failures.push(`missing analytics event ${required}`);
    }
    if (cdp.consoleIssues.length) failures.push(`console issues: ${cdp.consoleIssues.slice(0, 4).join(' | ')}`);
    if (cdp.networkIssues.length) failures.push(`network issues: ${cdp.networkIssues.slice(0, 4).join(' | ')}`);

    const result = {
      env,
      outcome,
      risk: riskEstimate(env),
      failures,
    };
    if (failures.length) throw Object.assign(new Error(failures.join('; ')), { result });
    return result;
  } finally {
    cdp?.close();
    await stopChrome(chrome);
    await removeProfileDir(profileDir);
  }
}

async function loadWebKit() {
  try {
    const playwright = await import('playwright');
    return playwright.webkit;
  } catch (error) {
    throw new Error(`Playwright WebKit is required for Safari revenue matrix lanes. Run npm install and npx playwright install webkit. ${error.message}`);
  }
}

async function playwrightClickText(page, text) {
  const found = await page.evaluate((wantedText) => {
    const wanted = String(wantedText || '').toLowerCase();
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const candidates = Array.from(document.querySelectorAll('main button, main a[href], main [role="button"], .fixed button, footer button'));
    const matches = candidates.filter((el) => visible(el) && (el.innerText || el.textContent || '').trim().toLowerCase().includes(wanted));
    const target = matches.at(-1);
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  }, text);
  if (!found) {
    const controls = await page.evaluate(() => Array.from(document.querySelectorAll('button, a[href]')).map((el) => (el.innerText || el.textContent || '').trim()).filter(Boolean).slice(0, 28));
    throw new Error(`Could not click "${text}". Visible controls: ${controls.join(' | ')}`);
  }
  await page.waitForTimeout(650);
}

async function playwrightClickAnyText(page, labels) {
  const failures = [];
  for (const label of labels) {
    try {
      await playwrightClickText(page, label);
      return label;
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
    }
  }
  throw new Error(`Could not click any of ${labels.join(', ')}.\n${failures.join('\n')}`);
}

async function playwrightFillByLabel(page, label, value) {
  const filled = await page.evaluate(({ label: wantedLabel, value: nextValue }) => {
    const wanted = String(wantedLabel || '').toLowerCase();
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const fields = Array.from(document.querySelectorAll('input, textarea, select')).filter(visible);
    const input = fields.find((el) => {
      const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
      const ownLabel = el.id ? (document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText || '').trim().toLowerCase() : '';
      const wrapperLabel = (el.closest('label')?.innerText || '').trim().toLowerCase();
      return aria.startsWith(wanted) || placeholder.startsWith(wanted) || ownLabel.startsWith(wanted) || wrapperLabel.startsWith(wanted);
    });
    if (!input) return false;
    input.focus();
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(input, nextValue) : input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { label, value });
  if (!filled) throw new Error(`Could not fill "${label}".`);
  await page.waitForTimeout(120);
}

async function playwrightAssertStickyBookBar(page, env) {
  const result = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('button, a[href], [role="button"]'));
    const target = controls.find((el) => {
      const text = (el.innerText || el.textContent || '').trim();
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return /next|continue|confirm|checkout|pay/i.test(text) &&
        rect.width >= 40 &&
        rect.height >= 40 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.pointerEvents !== 'none';
    });
    return target ? { ok: true, text: (target.innerText || target.textContent || '').trim(), width: Math.round(target.getBoundingClientRect().width), height: Math.round(target.getBoundingClientRect().height) } : { ok: false };
  });
  if (!result.ok) throw new Error(`${env.id}: no visible tappable revenue CTA found.`);
  return result;
}

async function playwrightRevenueOutcome(page) {
  return page.evaluate(() => {
    const booking = JSON.parse(localStorage.getItem('av.local.lastBooking') || 'null');
    const handoff = JSON.parse(localStorage.getItem('av.local.webstore.latestHandoff') || 'null');
    const analytics = JSON.parse(localStorage.getItem('av.analytics.events') || '[]');
    const stripeFrame = Array.from(document.querySelectorAll('iframe')).find((frame) => /stripe|checkout/i.test(frame.src || ''));
    return {
      path: location.pathname,
      body: document.body.innerText || '',
      hasEmbeddedCheckout: Boolean(stripeFrame),
      stripeFrameSrc: stripeFrame?.src || '',
      bookingId: booking?.id || '',
      service: booking?.service || '',
      orderType: booking?.orderType || '',
      hasHandoff: Boolean(handoff?.bookingId),
      analyticsNames: analytics.map((event) => event.name),
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      width: window.innerWidth,
    };
  });
}

async function waitForPlaywrightRevenueOutcome(page) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  let result = null;
  while (Date.now() < deadline) {
    result = await playwrightRevenueOutcome(page);
    if (result.hasEmbeddedCheckout || result.path === '/booking/confirmation') return result;
    await page.waitForTimeout(250);
  }
  return result;
}

function validateRevenueOutcome(outcome, runtimeIssues = []) {
  const failures = [];
  const materialRuntimeIssues = runtimeIssues.filter((issue) => !isIgnorableRuntimeIssue(issue));
  const staticFallback = outcome?.path === '/booking/confirmation';
  if (!outcome?.hasEmbeddedCheckout && !staticFallback) failures.push(`payment step not reached; path=${outcome?.path || 'unknown'}`);
  if (outcome?.hasEmbeddedCheckout && !/stripe|checkout/i.test(outcome.stripeFrameSrc || '')) failures.push('Stripe iframe source missing.');
  if (staticFallback && !/Hold received|Pay the hold|Review comes next|Confirmation/i.test(outcome.body || '')) failures.push('local payment fallback confirmation copy missing.');
  if (staticFallback && !outcome.bookingId) failures.push('local fallback did not persist booking id.');
  if (staticFallback && !outcome.hasHandoff) failures.push('local fallback did not persist checkout handoff marker.');
  if ((outcome?.scrollWidth || 0) - (outcome?.width || 0) > 2) failures.push(`horizontal overflow ${(outcome.scrollWidth || 0) - (outcome.width || 0)}px`);
  for (const required of ['step_viewed', 'step_completed', 'checkout_started']) {
    if (!outcome?.analyticsNames?.includes(required)) failures.push(`missing analytics event ${required}`);
  }
  if (materialRuntimeIssues.length) failures.push(`runtime issues: ${materialRuntimeIssues.slice(0, 4).join(' | ')}`);
  return failures;
}

function isIgnorableRuntimeIssue(issue = '') {
  const text = String(issue);
  return /Failed to load resource: the server responded with a status of 405/i.test(text)
    || /^cancelled https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/bags\/[^ ]+\.(?:png|jpe?g|webp|avif)(?:\?.*)?$/i.test(text);
}

async function playwrightGoto(page, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: DEFAULT_TIMEOUT_MS });
      return;
    } catch (error) {
      lastError = error;
      if (!/interrupted by another navigation|Navigation failed because page was closed/i.test(String(error?.message || error))) break;
      await page.waitForTimeout(400);
    }
  }
  throw lastError;
}

async function runWebKitEnvironment(webkit, env) {
  let browser;
  try {
    browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: env.viewport.width, height: env.viewport.height },
      deviceScaleFactor: env.viewport.deviceScaleFactor,
      isMobile: env.viewport.mobile,
      hasTouch: env.viewport.mobile,
      userAgent: env.ua,
      locale: 'en-US',
    });
    const page = await context.newPage();
    const runtimeIssues = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) runtimeIssues.push(message.text());
    });
    page.on('pageerror', (error) => runtimeIssues.push(error.message));
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText || 'request failed';
      const url = request.url();
      if (!/ERR_ABORTED|favicon|chrome-extension/i.test(`${failure} ${url}`)) runtimeIssues.push(`${failure} ${url}`);
    });

    await playwrightGoto(page, `${BASE_URL}/?utm_source=revenue_matrix&utm_medium=qa&utm_campaign=${env.id}`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('cookieConsent', 'allowed');
      sessionStorage.setItem('av.splash.seen', '1');
    });
    await playwrightGoto(page, `${BASE_URL}/book?reset=1&matrix=${encodeURIComponent(env.id)}`);
    await page.waitForTimeout(500);
    await playwrightClickAnyText(page, ['Recovery', 'Hydration']);
    await playwrightAssertStickyBookBar(page, env);
    await playwrightClickText(page, 'Next');
    await playwrightClickText(page, 'No Add-Ons');
    await playwrightAssertStickyBookBar(page, env);
    await playwrightClickText(page, 'Next');
    await playwrightClickText(page, 'Next');
    await playwrightFillByLabel(page, 'Address', '188 King St, San Francisco');
    await playwrightFillByLabel(page, 'ZIP', '94107');
    await playwrightAssertStickyBookBar(page, env);
    await playwrightClickText(page, 'Next');
    await playwrightFillByLabel(page, 'Name', 'Revenue Matrix QA');
    await playwrightFillByLabel(page, 'Phone', '(415) 555-0199');
    await playwrightFillByLabel(page, 'DOB', '01/02/1980');
    await playwrightFillByLabel(page, 'Email', `qa+${env.id}@avalonvitality.co`);
    await playwrightAssertStickyBookBar(page, env);
    await playwrightClickText(page, 'CONFIRM & PAY');
    const outcome = await waitForPlaywrightRevenueOutcome(page);
    const failures = validateRevenueOutcome(outcome, runtimeIssues);
    const result = { env, outcome, risk: riskEstimate(env), failures };
    if (failures.length) throw Object.assign(new Error(failures.join('; ')), { result });
    await context.close();
    return result;
  } finally {
    await browser?.close();
  }
}

let previewProcess;
let previewSnapshotRoot;

try {
  if (SELF_HOST_PREVIEW) {
    previewSnapshotRoot = await createPreviewSnapshot();
    previewProcess = await startSnapshotPreview(previewSnapshotRoot);
  }

  const environments = selectedMatrix();
  if (!environments.length) throw new Error('No revenue matrix environments selected.');
  const needsChrome = environments.some((env) => (env.engine || 'chrome') === 'chrome');
  const needsWebKit = environments.some((env) => env.engine === 'webkit');
  const chromePath = needsChrome ? await findChrome() : null;
  const webkit = needsWebKit ? await loadWebKit() : null;

  const results = [];
  const failures = [];
  for (const [index, env] of environments.entries()) {
    try {
      const result = env.engine === 'webkit'
        ? await runWebKitEnvironment(webkit, env)
        : await runCdpEnvironment(chromePath, env, index);
      results.push(result);
      const mode = result.outcome.hasEmbeddedCheckout ? 'embedded checkout' : 'local checkout fallback';
      const note = env.limitation ? ` (${env.limitation})` : '';
      console.log(`PASS revenue ${env.id}: ${mode}; events=${[...new Set(result.outcome.analyticsNames)].join(',')}; assumed risk protected=$${result.risk}/mo${note}`);
    } catch (error) {
      const result = error.result || { env, risk: riskEstimate(env), failures: [error.message] };
      failures.push(result);
      console.log(`FAIL revenue ${env.id}: ${result.failures.join('; ')}; assumed risk=$${result.risk}/mo`);
    }
  }

  console.log('Revenue matrix coverage note: WebKit lanes use Playwright WebKit. Real-device Safari and real social app webviews remain staging/post-deploy verification targets.');

  if (failures.length) {
    throw new Error(`Revenue matrix failed ${failures.length}/${environments.length} environment(s).`);
  }

  console.log(`Revenue matrix QA passed ${results.length}/${environments.length} browser/profile checks.`);
} finally {
  await stopProcess(previewProcess);
  if (previewSnapshotRoot) await fs.rm(previewSnapshotRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
