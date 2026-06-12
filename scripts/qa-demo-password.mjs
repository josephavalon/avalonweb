import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return Object.fromEntries(text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }));
  } catch {
    return {};
  }
}

export function readDemoPassword(primaryName) {
  const root = process.cwd();
  const envFile = {
    ...parseEnvFile(path.join(root, '.env')),
    ...parseEnvFile(path.join(root, '.env.local')),
  };
  return process.env[primaryName] ||
    process.env.VITE_AVALON_DEMO_PASSWORD ||
    envFile[primaryName] ||
    envFile.VITE_AVALON_DEMO_PASSWORD ||
    '';
}

export function requireDemoPassword(primaryName, label) {
  const password = readDemoPassword(primaryName);
  if (!password) {
    throw new Error(`${primaryName} or VITE_AVALON_DEMO_PASSWORD is required for ${label}.`);
  }
  return password;
}
