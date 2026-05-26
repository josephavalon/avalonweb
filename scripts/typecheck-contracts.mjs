import fs from 'node:fs';
import path from 'node:path';
import { transform } from '@swc/core';

const root = path.resolve('src/contracts');

function walk(entry) {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(entry).flatMap((name) => walk(path.join(entry, name)));
}

const files = walk(root).filter((file) => /\.ts$/.test(file));
const failures = [];

for (const file of files) {
  try {
    await transform(fs.readFileSync(file, 'utf8'), {
      filename: file,
      sourceMaps: false,
      jsc: {
        parser: {
          syntax: 'typescript',
        },
      },
    });
  } catch (error) {
    failures.push(`${path.relative(process.cwd(), file)}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`Contract type syntax check failed on ${failures.length} file(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Contract type syntax check passed ${files.length} file(s).`);
