#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const baseUrl = String(process.env.SNOOCHES_BASE_URL || process.env.API_BASE_URL || 'https://snooches.avalonvitality.co').replace(/\/$/, '');
const requirePass = process.argv.includes('--require-pass');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = path.join(repoRoot, '.context');
const reportPath = path.join(reportDir, `snooches-production-exam-${timestamp}.md`);
const latestReportPath = path.join(reportDir, 'snooches-production-exam-latest.md');
const results = [];

function run(label, command, args, options = {}) {
  return new Promise((resolve) => {
    console.log(`\n==> ${label}`);
    console.log(`$ ${[command, ...args].join(' ')}`);
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...options.env },
      shell: false,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on('error', (error) => {
      output += `\n${error.message}\n`;
      results.push({ label, ok: false, output });
      resolve(false);
    });
    child.on('exit', (code) => {
      const ok = code === 0;
      results.push({ label, ok, output });
      resolve(ok);
    });
  });
}

async function checkHeaders() {
  const label = 'hosted root headers';
  console.log(`\n==> ${label}`);
  try {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD', redirect: 'manual' });
    const required = [
      ['content-security-policy', Boolean(response.headers.get('content-security-policy'))],
      ['strict-transport-security', Boolean(response.headers.get('strict-transport-security'))],
      ['x-frame-options DENY', response.headers.get('x-frame-options') === 'DENY'],
      ['x-robots-tag noindex', String(response.headers.get('x-robots-tag') || '').includes('noindex')],
      ['cache-control no-cache', String(response.headers.get('cache-control') || '').includes('no-cache')],
    ];
    const missing = required.filter(([, ok]) => !ok).map(([name]) => name);
    const output = [
      `status=${response.status}`,
      ...required.map(([name, ok]) => `${ok ? 'PASS' : 'FAIL'} ${name}`),
    ].join('\n');
    console.log(output);
    results.push({ label, ok: response.status === 200 && missing.length === 0, output });
  } catch (error) {
    const output = error?.message || String(error);
    console.error(output);
    results.push({ label, ok: false, output });
  }
}

function writeReport() {
  fs.mkdirSync(reportDir, { recursive: true });
  const failed = results.filter((result) => !result.ok);
  const lines = [
    '# Snooches Production-Readiness Exam',
    '',
    `Target: \`${baseUrl}\``,
    `Run: \`${new Date().toISOString()}\``,
    `Result: **${failed.length ? 'FAIL / BLOCKED' : 'PASS'}**`,
    '',
    '## Gates',
    '',
    ...results.map((result) => `- ${result.ok ? 'PASS' : 'FAIL'}: ${result.label}`),
    '',
  ];
  if (failed.length) {
    lines.push('## Blocking Output', '');
    for (const result of failed) {
      lines.push(`### ${result.label}`, '', '```text', result.output.trim().slice(-4000), '```', '');
    }
  }
  lines.push(
    '## Domain Safety',
    '',
    '- This exam script does not run Vercel production deployment commands.',
    '- Use `npm run deploy:snooches` only after every gate passes.',
    '- Keep `avalonvitality.co` and `www.avalonvitality.co` untouched for this launch.',
    '',
  );
  const report = `${lines.join('\n')}\n`;
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(latestReportPath, report);
  console.log(`\nWrote ${path.relative(repoRoot, reportPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, latestReportPath)}`);
  return failed.length === 0;
}

await run('lint', 'npm', ['run', 'lint']);
await run('typecheck', 'npm', ['run', 'typecheck']);
await run('build', 'npm', ['run', 'build']);
await run('launch blockers', 'npm', ['run', 'test:launch-blockers']);
await run('hosted admin endpoints', 'npm', ['run', 'verify:hosted-admin-endpoints'], {
  env: { API_BASE_URL: baseUrl },
});
await checkHeaders();
await run('vercel inspect snooches', 'npx', ['vercel', 'inspect', baseUrl]);
await run('live route stability', 'npm', ['run', 'test:stability'], {
  env: {
    STABILITY_QA_BASE_URL: baseUrl,
    STABILITY_QA_ROUTES: '/,/book,/subscription,/login,/signup,/admin/login,/privacy-policy,/terms-of-service,/products/cbd/cbd-33mg',
    STABILITY_QA_WIDTHS: '390,1280',
  },
});
await run('credentialed production verifier', 'npm', ['run', 'verify:prod'], {
  env: {
    API_BASE_URL: baseUrl,
    PUBLIC_SITE_URL: baseUrl,
    ACUITY_VERIFY: process.env.ACUITY_VERIFY || '1',
  },
});

const passed = writeReport();
if (!passed || requirePass) {
  process.exit(passed ? 0 : 1);
}
