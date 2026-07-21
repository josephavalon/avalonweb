import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const BASE_URL = process.env.RELEASE_QA_BASE_URL || 'http://127.0.0.1:4173';
const PREVIEW_PORT = Number(new URL(BASE_URL).port || 4173);
const DEBUG_PORT_BASE = Number(process.env.RELEASE_QA_DEBUG_PORT_BASE || (20_000 + (process.pid % 10_000)));
const RETIRED_DEMO_PASSWORD = ['Jon', 'Jones', '1986'].join('');
const BROWSER_QA_DEBUG_ENV = {
  BOOKING_QA_DEBUG_PORT: String(DEBUG_PORT_BASE),
  LOGIN_QA_DEBUG_PORT: String(DEBUG_PORT_BASE + 1),
  INTERACTION_QA_DEBUG_PORT: String(DEBUG_PORT_BASE + 2),
  MOBILE_QA_DEBUG_PORT: String(DEBUG_PORT_BASE + 3),
  STABILITY_QA_DEBUG_PORT: String(DEBUG_PORT_BASE + 4),
  VISUAL_QA_DEBUG_PORT: String(DEBUG_PORT_BASE + 5),
  TRANSLATE_QA_DEBUG_PORT: String(DEBUG_PORT_BASE + 6),
};
const RELEASE_QA_DEMO_PASSWORD = resolveReleaseQaDemoPassword();

function resolveReleaseQaDemoPassword() {
  const configured = process.env.RELEASE_QA_DEMO_PASSWORD
    || process.env.VITE_AVALON_DEMO_PASSWORD
    || process.env.LOGIN_QA_PASSWORD
    || process.env.INTERACTION_QA_PASSWORD
    || '';
  if (configured && configured !== RETIRED_DEMO_PASSWORD) return configured;
  return `avalon-release-qa-${randomUUID()}`;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(' ')}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
    });
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

async function waitFor(url) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await probe(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function stopPort(port) {
  const result = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
  const pids = result.stdout
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const pid of pids) {
    try {
      process.kill(Number(pid));
    } catch {}
  }
}

function browserQaEnv(overrides = {}) {
  return { ...process.env, ...BROWSER_QA_DEBUG_ENV, ...overrides };
}

function releaseQaEnv(overrides = {}) {
  return {
    ...process.env,
    VITE_AVALON_ENABLE_LIVE_API: 'false',
    AVALON_ENABLE_LIVE_API: 'false',
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: '',
    VITE_AVALON_DEMO_PASSWORD: RELEASE_QA_DEMO_PASSWORD,
    LOGIN_QA_PASSWORD: RELEASE_QA_DEMO_PASSWORD,
    INTERACTION_QA_PASSWORD: RELEASE_QA_DEMO_PASSWORD,
    ...overrides,
  };
}

async function stopProcess(processRef) {
  if (!processRef || processRef.killed) return;
  processRef.kill();
  await Promise.race([
    new Promise((resolve) => processRef.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 1800)),
  ]);
}

function createPreviewSnapshot() {
  const sourceDist = path.join(repoRoot, 'dist');
  if (!fs.existsSync(path.join(sourceDist, 'index.html'))) {
    throw new Error('dist/index.html missing after build; cannot start release preview.');
  }
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'avalon-release-preview-'));
  const scriptsDir = path.join(snapshotRoot, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.cpSync(sourceDist, path.join(snapshotRoot, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'scripts', 'preview-server.mjs'), path.join(scriptsDir, 'preview-server.mjs'));
  return snapshotRoot;
}

async function startPreview() {
  if (!previewSnapshotRoot) throw new Error('Release preview snapshot was not created.');
  stopPort(PREVIEW_PORT);
  const processRef = spawn('node', ['scripts/preview-server.mjs', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)], {
    cwd: previewSnapshotRoot,
    stdio: 'inherit',
  });
  const startup = await Promise.race([
    waitFor(BASE_URL).then((ready) => (ready ? 'ready' : 'timeout')),
    new Promise((resolve) => processRef.once('exit', (code) => resolve(`exited ${code ?? 'unknown'}`))),
  ]);
  if (startup !== 'ready') {
    await stopProcess(processRef);
    throw new Error(`Preview did not become ready at ${BASE_URL}: ${startup}`);
  }
  return processRef;
}

async function runBrowserQa(scriptName, envOverrides) {
  console.log(`\nStarting fresh local preview on ${BASE_URL}`);
  preview = await startPreview();
  try {
    await run('npm', ['run', scriptName], {
      env: browserQaEnv(envOverrides),
    });
  } finally {
    await stopProcess(preview);
    preview = null;
  }
}

let preview;
let previewSnapshotRoot;

try {
  await run('npm', ['run', 'lint']);
  await run('npm', ['run', 'typecheck']);
  await run('npm', ['run', 'test:code-quality']);
  await run('npm', ['run', 'test:design-system']);
  await run('npm', ['run', 'test:analytics']);
  await run('npm', ['run', 'test:accessibility']);
  await run('npm', ['run', 'test:compliance']);
  await run('npm', ['run', 'test:privacy']);
  await run('npm', ['run', 'test:security']);
  await run('npm', ['run', 'build'], { env: releaseQaEnv() });
  await run('npm', ['run', 'test:launch-blockers'], { env: releaseQaEnv() });
  previewSnapshotRoot = createPreviewSnapshot();
  await run('npm', ['run', 'test:performance']);
  await run('npm', ['run', 'test:smoke']);
  await run('npm', ['run', 'test:lifecycle']);
  await run('npm', ['run', 'test:kernel']);
  await run('npm', ['run', 'test:preapi']);
  await run('npm', ['run', 'test:day']);

  await runBrowserQa('test:booking', { BOOKING_QA_BASE_URL: BASE_URL });
  await runBrowserQa('test:login', releaseQaEnv({ LOGIN_QA_BASE_URL: BASE_URL }));
  await runBrowserQa('test:interaction', releaseQaEnv({ INTERACTION_QA_BASE_URL: BASE_URL }));
  await runBrowserQa('test:mobile', { MOBILE_QA_BASE_URL: BASE_URL });
  await runBrowserQa('test:stability', { STABILITY_QA_BASE_URL: BASE_URL });
  await runBrowserQa('test:visual', { VISUAL_QA_BASE_URL: BASE_URL });
  await runBrowserQa('test:translate', { TRANSLATE_QA_BASE_URL: BASE_URL });

  console.log('\nRelease QA passed. Local no-API build is clear.');
} finally {
  await stopProcess(preview);
  if (previewSnapshotRoot) fs.rmSync(previewSnapshotRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
