import { mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const inputDir = join(process.cwd(), 'public', 'bags');
const outputDir = join(inputDir, 'optimized');
const maxWidth = '900';

const hasSips = spawnSync('which', ['sips'], { encoding: 'utf8' }).status === 0;
if (!hasSips) {
  console.log('Skipping bag optimization: macOS sips is not available.');
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });

const files = (await readdir(inputDir)).filter((file) => ['.png', '.jpg', '.jpeg'].includes(extname(file).toLowerCase()));
let written = 0;

for (const file of files) {
  const input = join(inputDir, file);
  const output = join(outputDir, file);
  if (existsSync(output)) continue;

  const result = spawnSync('sips', ['--resampleWidth', maxWidth, input, '--out', output], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.warn(`Could not optimize ${file}: ${result.stderr || result.stdout}`);
    continue;
  }

  const [original, optimized] = await Promise.all([stat(input), stat(output)]);
  if (optimized.size < original.size) written += 1;
  else console.warn(`Optimized copy is not smaller for ${file}; keep using the original asset.`);
}

console.log(`Optimized ${written} bag assets into public/bags/optimized.`);
