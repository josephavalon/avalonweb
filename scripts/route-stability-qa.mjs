import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.STABILITY_QA_BASE_URL || 'http://localhost:4173';
const PORT = Number(process.env.STABILITY_QA_DEBUG_PORT || 9342);
const SAMPLE_DELAYS = (process.env.STABILITY_QA_DELAYS || '120,900,2600')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter(Boolean);

const VIEWPORTS = (process.env.STABILITY_QA_WIDTHS || '390,1280')
  .split(',')
  .map((width) => Number(width.trim()))
  .filter(Boolean)
  .map((width) => ({
    width,
    height: width < 768 ? 844 : 900,
    deviceScaleFactor: width < 768 ? 3 : 1,
    mobile: width < 768,
  }));

const DEFAULT_ROUTES = [
  '/',
  '/subscription',
  '/pricing',
  '/custom',
  '/book',
  '/checkout',
  '/checkout/success',
  '/booking/confirmation',
  '/protocols',
  '/menu',
  '/launches',
  '/launches/festival-recovery-presale',
  '/events',
  '/events/private-group-recovery',
  '/locations/san-francisco',
  '/learn/what-is-mobile-iv-therapy',
  '/login',
  '/members/dashboard',
  '/provider/shift',
  '/admin',
];

const ROUTES = process.env.STABILITY_QA_ROUTES
  ? process.env.STABILITY_QA_ROUTES.split(',').map((route) => route.trim()).filter(Boolean)
  : DEFAULT_ROUTES;

const SESSION_JSON = process.env.STABILITY_QA_SESSION_JSON || '';

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
  throw new Error('Chrome executable not found. Set CHROME_PATH to run route stability QA.');
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
    this.nextId = 1;
    this.pending = new Map();
    this.requests = new Map();
    this.consoleIssues = [];
    this.networkIssues = [];
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
      this.requests.set(message.params.requestId, {
        url: message.params.request?.url || '',
        type: message.params.type || '',
      });
    }

    if (message.method === 'Network.loadingFailed') {
      const request = this.requests.get(message.params.requestId) || {};
      const type = message.params.type || request.type || 'resource';
      const text = [type, message.params.errorText, request.url].filter(Boolean).join(': ');
      this.networkIssues.push(text);
    }

    if (message.method === 'Network.responseReceived') {
      const { response, type } = message.params;
      if (response?.status >= 400 && ['Document', 'Script', 'Stylesheet', 'Image', 'Font'].includes(type)) {
        this.networkIssues.push(`${response.status} ${type}: ${response.url}`);
      }
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 15_000);
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

async function waitForReady(cdp) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (result.result?.value === 'complete') return;
    await wait(180);
  }
}

async function snapshot(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
      const loading = !!document.querySelector('[aria-label="Loading"]');
      const fullScreenBlockers = Array.from(document.body?.querySelectorAll('*') || [])
        .map((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const zIndex = Number.parseInt(style.zIndex, 10) || 0;
          const isBlocking =
            style.position === 'fixed' &&
            zIndex >= 50 &&
            rect.width >= innerWidth * 0.94 &&
            rect.height >= innerHeight * 0.94 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
          if (!isBlocking) return null;
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            label: (el.getAttribute('aria-label') || el.textContent || el.className || '').toString().replace(/\\s+/g, ' ').trim().slice(0, 90),
            zIndex,
          };
        })
        .filter(Boolean)
        .slice(0, 4);
      return {
        path: location.pathname,
        title: document.title,
        textLength: text.length,
        loading,
        fullScreenBlockers,
      };
    })()`,
  });
  return result.result.value;
}

async function auditRoute(cdp, route, viewport) {
  cdp.consoleIssues = [];
  cdp.networkIssues = [];
  cdp.requests.clear();
  await cdp.send('Emulation.setDeviceMetricsOverride', viewport);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: viewport.mobile });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Page.navigate', { url: new URL(route, BASE_URL).toString() });
  await waitForReady(cdp);

  const samples = [];
  for (const delay of SAMPLE_DELAYS) {
    await wait(delay);
    samples.push({ delay, ...(await snapshot(cdp)) });
  }

  const final = samples.at(-1);
  const problems = [];
  if (!final || final.textLength < 35) problems.push(`blank final render (${final?.textLength || 0} chars)`);
  if (final?.loading) problems.push('loading state still mounted');
  if (final?.fullScreenBlockers?.length) problems.push('fullscreen blocker mounted');
  if (cdp.consoleIssues.length) problems.push(`${cdp.consoleIssues.length} console issue(s)`);
  if (cdp.networkIssues.length) problems.push(`${cdp.networkIssues.length} network issue(s)`);

  return {
    route,
    viewport: viewport.width,
    samples,
    final,
    problems,
    consoleIssues: [...new Set(cdp.consoleIssues)].slice(0, 6),
    networkIssues: [...new Set(cdp.networkIssues)].slice(0, 8),
  };
}

function printFindings(results) {
  let failed = false;
  for (const result of results) {
    if (!result.problems.length) {
      const finalText = result.final?.textLength || 0;
      const sampleText = result.samples.map((sample) => `${sample.delay}ms=${sample.textLength}`).join(' ');
      console.log(`PASS stability ${result.route} @${result.viewport} finalText=${finalText} ${sampleText}`);
      continue;
    }

    failed = true;
    console.log(`FAIL stability ${result.route} @${result.viewport}: ${result.problems.join(', ')}`);
    for (const sample of result.samples) {
      console.log(`  sample ${sample.delay}ms: path=${sample.path} text=${sample.textLength} loading=${sample.loading} blockers=${sample.fullScreenBlockers.length}`);
      for (const blocker of sample.fullScreenBlockers) {
        console.log(`    blocker: <${blocker.tag}> "${blocker.label}" z=${blocker.zIndex}`);
      }
    }
    for (const issue of result.consoleIssues) console.log(`  console: ${issue}`);
    for (const issue of result.networkIssues) console.log(`  network: ${issue}`);
  }
  if (failed) throw new Error('Route stability QA found regressions.');
}

let chrome;
let profileDir;
let cdp;

try {
  const chromePath = await findChrome();
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-route-stability-'));
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
  if (SESSION_JSON) {
    const sessionScript = `
      try {
        const session = ${SESSION_JSON};
        if (location.protocol === 'http:' || location.protocol === 'https:') {
          sessionStorage.setItem('av.session', JSON.stringify(session));
        }
      } catch {}
    `;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: sessionScript });
  }

  const results = [];
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      try {
        results.push(await auditRoute(cdp, route, viewport));
      } catch (error) {
        results.push({
          route,
          viewport: viewport.width,
          samples: [],
          final: null,
          problems: [`route audit crashed: ${error.message}`],
          consoleIssues: [],
          networkIssues: [],
        });
        try {
          await cdp.send('Page.navigate', { url: 'about:blank' });
          await waitForReady(cdp);
        } catch {}
      }
    }
  }
  printFindings(results);
  console.log(`Route stability QA passed ${results.length}/${ROUTES.length * VIEWPORTS.length} route/viewport checks.`);
} finally {
  cdp?.close();
  await stopChrome(chrome);
  await removeProfileDir(profileDir);
}
