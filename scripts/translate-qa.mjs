import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.TRANSLATE_QA_BASE_URL || 'http://localhost:4173';
const PORT = Number(process.env.TRANSLATE_QA_DEBUG_PORT || 9341);

const LANGUAGE_SEQUENCE = [
  { code: 'es', native: 'Español', cookie: '/auto/es' },
  { code: 'en', native: 'English', cookie: '' },
  { code: 'zh-CN', native: '中文', cookie: '/auto/zh-CN' },
  { code: 'en', native: 'English', cookie: '' },
  { code: 'tl', native: 'Filipino', cookie: '/auto/tl' },
  { code: 'en', native: 'English', cookie: '' },
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
  throw new Error('Chrome executable not found. Set CHROME_PATH to run translate QA.');
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
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, Number(process.env.TRANSLATE_QA_CDP_TIMEOUT_MS || 60_000));
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
    const detail = result.exceptionDetails.exception?.description
      || result.exceptionDetails.exception?.value
      || result.exceptionDetails.text
      || 'Page evaluation failed.';
    throw new Error(detail);
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

async function waitForLanguageSelector(cdp) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const exists = await evalOnPage(cdp, `Boolean(document.querySelector('[aria-label^="Select language"]'))`);
    if (exists) return;
    await wait(180);
  }
  const debug = await evalOnPage(cdp, `({
    title: document.title,
    path: location.pathname,
    text: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(-500),
    buttons: [...document.querySelectorAll('button')].map((node) => node.getAttribute('aria-label') || node.innerText.trim()).slice(-12),
  })`);
  throw new Error(`Language trigger not found after hydrate: ${JSON.stringify(debug)}`);
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

async function readLanguageState(cdp) {
  return evalOnPage(cdp, `(() => {
    const button = document.querySelector('[aria-label^="Select language"]');
    const cookie = decodeURIComponent((document.cookie.match(/(?:^|; )googtrans=([^;]*)/) || [])[1] || '');
    return {
      current: button?.dataset.currentLanguage || '',
      label: (button?.innerText || '').replace(/\\s+/g, ' ').trim(),
      cookie,
      lang: document.documentElement.lang || '',
      options: [...document.querySelectorAll('[data-lang-code]')].map((node) => node.getAttribute('data-lang-code')),
      notranslate: Boolean(button?.closest('.notranslate[translate="no"]')),
    };
  })()`);
}

async function waitForLanguage(cdp, language) {
  const deadline = Date.now() + 12_000;
  let lastState = null;
  while (Date.now() < deadline) {
    const state = await readLanguageState(cdp);
    lastState = state;
    const cookieOk = language.code === 'en'
      ? !state.cookie
      : [language.cookie, language.cookie.replace('/auto/', '/en/')].includes(state.cookie);
    const labelOk = state.label.toLocaleLowerCase().includes(language.native.toLocaleLowerCase());
    if (state.current === language.code && labelOk && cookieOk) return state;
    await wait(300);
  }
  throw new Error(`Language did not settle on ${language.code}: ${JSON.stringify(lastState)}`);
}

async function selectLanguage(cdp, code) {
  await waitForLanguageSelector(cdp);
  await evalOnPage(cdp, `(() => {
    window.scrollTo(0, document.body.scrollHeight);
    const trigger = document.querySelector('[aria-label^="Select language"]');
    if (!trigger) throw new Error('Language trigger not found');
    trigger.click();
    return true;
  })()`);

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const visible = await evalOnPage(cdp, `Boolean(document.querySelector('[data-lang-code="${code}"]'))`);
    if (visible) break;
    await wait(120);
  }

  await evalOnPage(cdp, `(() => {
    const option = document.querySelector('[data-lang-code="${code}"]');
    if (!option) throw new Error('Language option ${code} not found');
    option.click();
    return true;
  })()`);
  await wait(1500);
  await waitForReady(cdp);
  await waitForLanguageSelector(cdp);
}

let chrome;
let profileDir;
let cdp;

try {
  const chromePath = await findChrome();
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avalon-translate-qa-'));
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
  const tab = await requestJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE_URL)}`, 'PUT');
  cdp = new CdpClient(tab.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await waitForReady(cdp);
  await waitForLanguageSelector(cdp);
  await evalOnPage(cdp, `document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'; localStorage.setItem('cookieConsent', 'allowed');`);
  await cdp.send('Page.navigate', { url: BASE_URL });
  await waitForReady(cdp);
  await waitForLanguageSelector(cdp);

  const initial = await readLanguageState(cdp);
  const failures = [];
  if (initial.current !== 'en') failures.push(`initial language is ${initial.current || 'missing'}, expected en`);
  if (!initial.notranslate) failures.push('language selector is not protected with notranslate/translate=no');

  const results = [];
  for (const language of LANGUAGE_SEQUENCE) {
    await selectLanguage(cdp, language.code);
    const state = await waitForLanguage(cdp, language);
    results.push(`${language.code}:${state.label}:${state.cookie || 'cleared'}`);
    await wait(1500);
  }

  if (cdp.consoleIssues.length) {
    failures.push(`console issues: ${[...new Set(cdp.consoleIssues)].slice(0, 4).join(' | ')}`);
  }

  if (failures.length) {
    console.error('Translate QA failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Translate QA passed: ${results.join(' -> ')}`);
  }
} finally {
  cdp?.close();
  await stopChrome(chrome);
  await removeProfileDir(profileDir);
}
