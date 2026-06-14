import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dist = path.join(repoRoot, 'dist');

fs.rmSync(dist, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
