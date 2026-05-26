import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.VISUAL_QA_BASE_URL || 'http://localhost:4173';
const PORT = Number(process.env.VISUAL_QA_DEBUG_PORT || 9339);
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.codex-audit/visual');

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'book', path: '/book' },
  { name: 'safety', path: '/safety' },
  { name: 'confirmation', path: '/booking/confirmation' },
  { name: 'protocols', path: '/protocols' },
  { name: 'launches', path: '/launches' },
  { name: 'client-dashboard', path: '/members/dashboard' },
  { name: 'nurse-shift', path: '/provider/shift' },
  { name: 'admin', path: '/admin' },
];

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2, mobile: false },
  { name: 'desktop', width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
];

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
  throw new Error('Chrome executable not found. Set CHROME_PATH to run visual QA.');
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

async function evalOnPage(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Page evaluation failed.');
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

async function captureRoute(cdp, route, viewport) {
  cdp.consoleIssues = [];
  await cdp.send('Emulation.setDeviceMetricsOverride', viewport);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: viewport.mobile });
  await cdp.send('Page.navigate', { url: new URL(route.path, BASE_URL).toString() });
  await waitForReady(cdp);
  await evalOnPage(cdp, `localStorage.setItem('cookieConsent', 'allowed')`);
  await wait(900);

  const health = await evalOnPage(cdp, `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const text = normalize(document.body?.innerText || '');
    const width = window.innerWidth;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const hero = document.querySelector('h1, h2, main [role="heading"]')?.innerText || '';
    const headingCounts = {};
    for (const el of Array.from(document.querySelectorAll('h1,h2,h3'))) {
      if (!visible(el)) continue;
      const value = normalize(el.innerText);
      if (value.length < 4) continue;
      headingCounts[value] = (headingCounts[value] || 0) + 1;
    }
    const duplicateHeadings = Object.entries(headingCounts)
      .filter(([, count]) => count > 1)
      .map(([value, count]) => value + ' (' + count + ')');
    const sectionCounts = {};
    for (const el of Array.from(document.querySelectorAll('section'))) {
      if (!visible(el)) continue;
      const value = normalize(el.innerText).slice(0, 180);
      if (value.length < 40) continue;
      sectionCounts[value] = (sectionCounts[value] || 0) + 1;
    }
    const duplicateSections = Object.entries(sectionCounts)
      .filter(([, count]) => count > 1)
      .map(([value, count]) => value.slice(0, 72) + '... (' + count + ')');
    return {
      title: document.title,
      path: location.pathname,
      blank: text.length < 35,
      overflow: Math.max(0, Math.round(scrollWidth - width)),
      hero: hero.trim().slice(0, 80),
      duplicateHeadings,
      duplicateSections,
    };
  })()`);

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = `${route.name}-${viewport.name}.png`;
  await fs.writeFile(path.join(OUT_DIR, file), Buffer.from(shot.data, 'base64'));

  return {
    route: route.path,
    viewport: viewport.name,
    file,
    ...health,
    consoleIssues: [...new Set(cdp.consoleIssues)].slice(0, 6),
  };
}

let chrome;
let profileDir;
let cdp;

try {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const chromePath = await findChrome();
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-visual-qa-'));
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

  const failures = [];
  const results = [];
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const result = await captureRoute(cdp, route, viewport);
      results.push(result);
      const problems = [];
      if (result.blank) problems.push('blank page');
      if (result.overflow > 2) problems.push(`horizontal overflow ${result.overflow}px`);
      if (result.duplicateHeadings.length) problems.push(`duplicate headings: ${result.duplicateHeadings.join('; ')}`);
      if (result.duplicateSections.length) problems.push(`duplicate sections: ${result.duplicateSections.join('; ')}`);
      if (result.consoleIssues.length) problems.push(`${result.consoleIssues.length} console issue(s)`);
      if (problems.length) failures.push({ ...result, problems });
      console.log(`${problems.length ? 'FAIL' : 'PASS'} ${route.path} ${viewport.name} -> ${result.file}`);
    }
  }

  await fs.writeFile(
    path.join(OUT_DIR, 'visual-qa-report.json'),
    JSON.stringify({ baseUrl: BASE_URL, generatedAt: new Date().toISOString(), results }, null, 2),
  );

  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure.route} ${failure.viewport}: ${failure.problems.join(', ')}`);
    throw new Error('Visual QA found regressions.');
  }

  console.log(`Visual QA passed. Screenshots saved in ${OUT_DIR}`);
} finally {
  cdp?.close();
  await stopChrome(chrome);
  await removeProfileDir(profileDir);
}
