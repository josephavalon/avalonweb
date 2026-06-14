import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const inputDir = join(process.cwd(), 'public', 'bags');
const outputDir = join(inputDir, 'optimized');
const maxWidth = '360';
const warnBytes = 350 * 1024;

const hasSips = spawnSync('which', ['sips'], { encoding: 'utf8' }).status === 0;
if (!hasSips) {
  console.log('Skipping bag optimization: macOS sips is not available.');
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });

const files = (await readdir(inputDir)).filter((file) => ['.png', '.jpg', '.jpeg'].includes(extname(file).toLowerCase()));
let written = 0;
let refreshed = 0;

async function resizeTo(input, output) {
  const tmp = `${output}.tmp`;
  await rm(tmp, { force: true });
  const result = spawnSync('sips', ['--resampleWidth', maxWidth, input, '--out', tmp], { encoding: 'utf8' });
  if (result.status !== 0) {
    await rm(tmp, { force: true });
    throw new Error(result.stderr || result.stdout || 'sips failed');
  }
  return tmp;
}

for (const file of files) {
  const input = join(inputDir, file);
  const output = join(outputDir, file);

  try {
    const original = await stat(input);
    if (original.size > warnBytes) {
      const tmp = await resizeTo(input, input);
      const optimized = await stat(tmp);
      if (optimized.size < original.size) {
        await rename(tmp, input);
        written += 1;
      } else {
        await rm(tmp, { force: true });
        console.warn(`Optimized root copy is not smaller for ${file}; kept original.`);
      }
    }
  } catch (err) {
    console.warn(`Could not optimize ${file}: ${err.message}`);
    continue;
  }

  try {
    const inputStat = await stat(input);
    const outputStat = existsSync(output) ? await stat(output) : null;
    if (!outputStat || outputStat.size > warnBytes || outputStat.size > inputStat.size) {
      const tmp = await resizeTo(input, output);
      const next = await stat(tmp);
      if (!outputStat || next.size < outputStat.size) {
        await rename(tmp, output);
        refreshed += 1;
      } else {
        await rm(tmp, { force: true });
      }
    }
  } catch (err) {
    console.warn(`Could not refresh optimized/${file}: ${err.message}`);
  }
}

console.log(`Optimized ${written} root bag assets; refreshed ${refreshed} optimized copies.`);
