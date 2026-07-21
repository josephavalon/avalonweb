#!/usr/bin/env node
import { spawn } from 'node:child_process';

const baseUrl = 'https://snooches.avalonvitality.co';
const forbiddenAliasPattern = /https:\/\/(?:www\.)?avalonvitality\.co(?![.\w-])/;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(' ')}`);
    const child = spawn(command, args, {
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
      env: process.env,
    });
    let output = '';
    if (options.capture) {
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
    }
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
    });
  });
}

function assertNoMainDomain(output, label) {
  if (forbiddenAliasPattern.test(output)) {
    throw new Error(`${label} referenced the protected main domain. Aborting.`);
  }
}

await run('node', ['scripts/snooches-production-exam.mjs', '--require-pass']);
await run('vercel', ['build']);
const deployOutput = await run('vercel', ['deploy', '--prebuilt', '--no-prod'], { capture: true });
assertNoMainDomain(deployOutput, 'prebuilt deploy');

const deploymentUrl = deployOutput.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0];
if (!deploymentUrl) {
  throw new Error('Could not find the Vercel deployment URL in deploy output.');
}

await run('vercel', ['alias', 'set', deploymentUrl, 'snooches.avalonvitality.co']);
const inspectOutput = await run('npx', ['vercel', 'inspect', baseUrl], { capture: true });
assertNoMainDomain(inspectOutput, 'post-alias inspect');
if (!/\btarget\s+preview\b/.test(inspectOutput)) {
  throw new Error('Snooches deployment is not a Vercel preview target after aliasing.');
}
if (!inspectOutput.includes(baseUrl)) {
  throw new Error('Snooches alias was not present after deployment.');
}

console.log(`\nPASS: ${baseUrl} now points at ${deploymentUrl} and remains a preview deployment.`);
