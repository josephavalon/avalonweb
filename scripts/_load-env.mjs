import fs from 'node:fs';
import path from 'node:path';

function parseValue(raw = '') {
  const value = String(raw).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadEnvFiles(files, cwd = process.cwd()) {
  for (const file of files) {
    const fullPath = path.resolve(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const source = fs.readFileSync(fullPath, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, raw] = match;
      const value = parseValue(raw);
      if (!value) continue;
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
