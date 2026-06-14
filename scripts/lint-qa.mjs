import fs from 'node:fs';
import path from 'node:path';
import { transform } from '@swc/core';

const roots = [
  'src/components',
  'src/pages',
  'src/Layout.jsx',
].map((entry) => path.resolve(entry));

const ignored = [
  `${path.sep}src${path.sep}components${path.sep}ui${path.sep}`,
];

function walk(entry) {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(entry).flatMap((name) => walk(path.join(entry, name)));
}

const files = roots
  .flatMap(walk)
  .filter((file) => /\.(js|jsx|mjs|cjs)$/.test(file))
  .filter((file) => !ignored.some((needle) => file.includes(needle)));

const failures = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    await transform(code, {
      filename: file,
      sourceMaps: false,
      jsc: {
        parser: {
          syntax: 'ecmascript',
          jsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    });
  } catch (error) {
    failures.push(`${path.relative(process.cwd(), file)}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`Lint QA failed on ${failures.length} file(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lint QA passed ${files.length} source files.`);
