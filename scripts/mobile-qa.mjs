import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.MOBILE_QA_BASE_URL || 'http://127.0.0.1:4173';
const VIEWPORTS = (process.env.MOBILE_QA_WIDTHS || '320,375,390,430,768')
  .split(',')
  .map((width) => Number(width.trim()))
  .filter(Boolean)
  .map((width) => ({
    width,
    height: width >= 768 ? 1024 : 844,
    deviceScaleFactor: width >= 768 ? 2 : 3,
    mobile: width < 768,
  }));
const PORT = Number(process.env.MOBILE_QA_DEBUG_PORT || 9337);
const ROUTE_TIMEOUT_MS = Number(process.env.MOBILE_QA_ROUTE_TIMEOUT_MS || 45_000);
const CONNECT_TIMEOUT_MS = Number(process.env.MOBILE_QA_CONNECT_TIMEOUT_MS || 8_000);

const DEFAULT_ROUTES = [
  '/',
  '/protocols',
  '/menu',
  '/launches',
  '/launches/festival-recovery-presale',
  '/events',
  '/events/private-group-recovery',
  '/event-iv-therapy-bay-area',
  '/book',
  '/subscription',
  '/pricing',
  '/custom',
  '/checkout',
  '/checkout/success',
  '/booking/confirmation',
  '/our-story',
  '/team',
  '/medical-direction',
  '/careers',
  '/faq',
  '/corporate',
  '/hotel',
  '/service-area',
  '/partners',
  '/platform',
  '/b2b',
  '/safety',
  '/ingredients',
  '/gift',
  '/athlete',
  '/hangover',
  '/jet-lag',
  '/press',
  '/locations',
  '/locations/san-francisco',
  '/learn',
  '/learn/what-is-mobile-iv-therapy',
  '/privacy-policy',
  '/terms-and-conditions',
  '/terms-of-service',
  '/telehealth-disclaimer',
  '/product-disclaimer',
  '/notice-of-privacy-practices',
  '/cookie-policy',
  '/login',
  '/members/dashboard',
  '/members/messages',
  '/members/account',
  '/provider/shift',
  '/provider/dashboard',
  '/provider/kits',
  '/provider/training',
  '/admin',
  '/admin/field',
  '/admin/dispatch',
  '/admin/kits',
  '/admin/training',
  '/admin/inventory',
];

const ROUTES = (process.env.MOBILE_QA_ROUTES
  ? process.env.MOBILE_QA_ROUTES.split(',').map((route) => route.trim()).filter(Boolean)
  : DEFAULT_ROUTES);

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
    } catch (error) {
      if (attempt === 5) {
        console.warn(`Mobile QA could not remove temp Chrome profile: ${error.message}`);
        return;
      }
      await wait(250);
    }
  }
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error('Chrome executable not found. Set CHROME_PATH to run mobile QA.');
}

class CdpClient {
  constructor(wsUrl, targetId = null) {
    this.wsUrl = wsUrl;
    this.targetId = targetId;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleIssues = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out connecting to Chrome target after ${CONNECT_TIMEOUT_MS}ms.`));
        this.ws?.close();
      }, CONNECT_TIMEOUT_MS);
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', (error) => {
        clearTimeout(timeout);
        this.rejectPending(new Error(error.message || 'Chrome websocket error.'));
        reject(error);
      }, { once: true });
      this.ws.addEventListener('close', () => {
        clearTimeout(timeout);
        this.rejectPending(new Error('Chrome websocket closed.'));
      });
      this.ws.addEventListener('message', (event) => this.handleMessage(event));
    });
  }

  rejectPending(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
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

    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) {
      const entry = message.params.entry;
      this.consoleIssues.push([entry.text, entry.url].filter(Boolean).join(' · '));
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, Number(process.env.MOBILE_QA_CDP_TIMEOUT_MS || 45_000));
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
    this.rejectPending(new Error('Chrome websocket closed.'));
    this.ws?.close();
  }
}

async function createPageClient() {
  const target = await requestJson(`http://127.0.0.1:${PORT}/json/new?about:blank`, 'PUT');
  const client = new CdpClient(target.webSocketDebuggerUrl, target.id);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
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

async function waitForReady(cdp, route, viewport) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    let result;
    try {
      result = await cdp.send('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      });
    } catch (error) {
      throw new Error(`Mobile QA page readiness failed for ${route} @${viewport.width}: ${error.message}`);
    }
    if (result.result?.value === 'complete') return;
    await wait(180);
  }
}

async function auditRoute(cdp, route, viewport) {
  cdp.consoleIssues = [];
  const url = new URL(route, BASE_URL).toString();

  let result;
  const collectSnapshot = () => cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const viewportWidth = window.innerWidth;
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
      const text = (body?.textContent || '').replace(/\\s+/g, ' ').trim();
      const hiddenTags = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE']);
      const isClipped = (el, rect) => {
        let parent = el.parentElement;
        while (parent && parent !== body) {
          const parentStyle = window.getComputedStyle(parent);
          const clipsX = ['hidden', 'clip', 'scroll', 'auto'].includes(parentStyle.overflowX);
          const clipsY = ['hidden', 'clip', 'scroll', 'auto'].includes(parentStyle.overflowY);
          if (clipsX || clipsY) {
            const parentRect = parent.getBoundingClientRect();
            if ((clipsX && (rect.right < parentRect.left + 1 || rect.left > parentRect.right - 1)) ||
                (clipsY && (rect.bottom < parentRect.top + 1 || rect.top > parentRect.bottom - 1))) {
              return true;
            }
            if ((clipsX && (rect.left < parentRect.left - 2 || rect.right > parentRect.right + 2)) ||
                (clipsY && (rect.top < parentRect.top - 2 || rect.bottom > parentRect.bottom + 2))) {
              return true;
            }
          }
          parent = parent.parentElement;
        }
        return false;
      };
      const isVisible = (el, rect) => {
        const style = window.getComputedStyle(el);
        return !hiddenTags.has(el.tagName) &&
          !el.closest('[data-mobile-qa-ignore]') &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.left < viewportWidth &&
          !isClipped(el, rect) &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      };
      const labelFor = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName || '')
        .replace(/\\s+/g, ' ')
        .trim()
        .slice(0, 80);
      const classFor = (el) => typeof el.className === 'string' ? el.className.slice(0, 120) : '';
      const offenders = [];
      for (const el of Array.from(body?.querySelectorAll('*') || [])) {
        if (offenders.length >= 12) break;
        const rect = el.getBoundingClientRect();
        if (!isVisible(el, rect)) continue;
        if (rect.left < -2 || rect.right > viewportWidth + 2) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            label: labelFor(el),
            className: classFor(el),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
      }
      const smallTargets = [];
      for (const el of Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]'))) {
        if (smallTargets.length >= 12) break;
          const rect = el.getBoundingClientRect();
          if (!isVisible(el, rect) || el.disabled || el.getAttribute('aria-hidden') === 'true') continue;
          const style = window.getComputedStyle(el);
          if (style.pointerEvents === 'none') continue;
          if (rect.width < 40 || rect.height < 40) {
            smallTargets.push({
              tag: el.tagName.toLowerCase(),
              label: labelFor(el),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            });
          }
      }
      return {
        title: document.title,
        url: location.href,
        blank: text.length < 35,
        scrollWidth,
        viewportWidth,
        overflow: Math.max(0, Math.round(scrollWidth - viewportWidth)),
        offenders,
        smallTargets,
      };
    })()`,
  });
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', viewport);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: viewport.mobile });
    await cdp.send('Page.navigate', { url });
    await waitForReady(cdp, route, viewport);
    await wait(650);
    result = await collectSnapshot();
    if (result.result.value?.blank) {
      await wait(1500);
      result = await collectSnapshot();
    }
  } catch (error) {
    throw new Error(`Mobile QA route audit failed for ${route} @${viewport.width}: ${error.message}`);
  }

  return {
    route,
    viewport: viewport.width,
    ...result.result.value,
    consoleIssues: [...new Set(cdp.consoleIssues)].slice(0, 8),
  };
}

async function auditRouteWithTimeout(cdp, route, viewport) {
  let timeout;
  const label = `Mobile QA ${route} @${viewport.width}`;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      cdp.close();
      reject(new Error(`${label} timed out after ${ROUTE_TIMEOUT_MS}ms`));
    }, ROUTE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([auditRoute(cdp, route, viewport), timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

async function auditRouteWithRetry(cdp, route, viewport) {
  try {
    return { cdp, result: await auditRouteWithTimeout(cdp, route, viewport) };
  } catch (error) {
    const retryable = /CDP command timed out|page readiness failed|websocket closed|timed out after/i.test(error.message || '');
    if (!retryable) throw error;
    console.warn(`WARN ${error.message}; retrying ${route} @${viewport.width} with a fresh page target.`);
    await closePageClient(cdp);
    const retryClient = await createPageClient();
    return { cdp: retryClient, result: await auditRouteWithTimeout(retryClient, route, viewport) };
  }
}

function printFindings(results) {
  let failed = false;
  for (const result of results) {
    const problems = [];
    if (result.blank) problems.push('blank page');
    if (result.consoleIssues.length) problems.push(`${result.consoleIssues.length} console issue(s)`);
    if (result.overflow > 2 || result.offenders.length) problems.push(`horizontal overflow ${result.overflow}px`);
    if (result.smallTargets.length) problems.push(`${result.smallTargets.length} small tap target(s)`);

    if (!problems.length) {
      console.log(`PASS ${result.route} @${result.viewport}`);
      continue;
    }

    failed = true;
    console.log(`FAIL ${result.route} @${result.viewport}: ${problems.join(', ')}`);
    for (const issue of result.consoleIssues) console.log(`  console: ${issue}`);
    for (const offender of result.offenders.slice(0, 4)) {
      console.log(`  overflow: <${offender.tag}> "${offender.label}" right=${offender.right} width=${offender.width}`);
    }
    for (const target of result.smallTargets.slice(0, 4)) {
      console.log(`  tap: <${target.tag}> "${target.label}" ${target.width}x${target.height}`);
    }
  }
  if (failed) throw new Error('Mobile QA found regressions.');
}

let chrome;
let profileDir;
let cdp;
try {
  const chromePath = await findChrome();
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-mobile-qa-'));
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

  const results = [];
  for (const viewport of VIEWPORTS) {
    cdp = await createPageClient();
    try {
      for (const route of ROUTES) {
        console.log(`CHECK mobile ${route} @${viewport.width}`);
        const audited = await auditRouteWithRetry(cdp, route, viewport);
        cdp = audited.cdp;
        results.push(audited.result);
        console.log(`DONE mobile ${route} @${viewport.width}`);
      }
    } finally {
      await closePageClient(cdp);
      cdp = null;
    }
  }
  printFindings(results);
  console.log(`Mobile QA passed ${results.length}/${ROUTES.length * VIEWPORTS.length} route/viewport checks.`);
} finally {
  await closePageClient(cdp);
  await stopChrome(chrome);
  await removeProfileDir(profileDir);
}
