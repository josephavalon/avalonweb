import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';

const BASE_URL = process.env.RELEASE_QA_BASE_URL || 'http://localhost:4173';
const PREVIEW_PORT = Number(new URL(BASE_URL).port || 4173);

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

let preview;

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
  await run('npm', ['run', 'build']);
  await run('npm', ['run', 'test:performance']);
  await run('npm', ['run', 'test:smoke']);
  await run('npm', ['run', 'test:lifecycle']);
  await run('npm', ['run', 'test:kernel']);
  await run('npm', ['run', 'test:preapi']);
  await run('npm', ['run', 'test:day']);

  console.log(`\nStarting fresh local preview on ${BASE_URL}`);
  stopPort(PREVIEW_PORT);
  preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)], {
    stdio: 'inherit',
  });
  const ready = await waitFor(BASE_URL);
  if (!ready) throw new Error(`Preview did not become ready at ${BASE_URL}`);

  await run('npm', ['run', 'test:booking'], {
    env: { ...process.env, BOOKING_QA_BASE_URL: BASE_URL },
  });
  await run('npm', ['run', 'test:mobile'], {
    env: { ...process.env, MOBILE_QA_BASE_URL: BASE_URL },
  });
  await run('npm', ['run', 'test:stability'], {
    env: { ...process.env, STABILITY_QA_BASE_URL: BASE_URL },
  });
  await run('npm', ['run', 'test:visual'], {
    env: { ...process.env, VISUAL_QA_BASE_URL: BASE_URL },
  });
  await run('npm', ['run', 'test:translate'], {
    env: { ...process.env, TRANSLATE_QA_BASE_URL: BASE_URL },
  });

  console.log('\nRelease QA passed. Local no-API build is clear.');
} finally {
  if (preview && !preview.killed) preview.kill();
}
