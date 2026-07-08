#!/usr/bin/env node
/**
 * Local preview for the events platform: serves the built SPA from dist/ and
 * proxies /api/* to a deployed Vercel preview (the serverless functions only
 * run on Vercel; no service-role secrets ever live on this machine).
 *
 * Run:  npm run build && node scripts/events-local-preview.mjs
 *       [--target https://<deployment>.vercel.app] [--port 4199]
 */
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const TARGET = argOf('--target', 'https://avalonweb-9890f505f-joseph-8775s-projects.vercel.app');
const PORT = Number(argOf('--port', '4199'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.xml': 'application/xml',
};

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Proxy the API to the deployed preview (functions don't run locally).
  if (url.pathname.startsWith('/api/')) {
    try {
      const body = ['GET', 'HEAD'].includes(req.method)
        ? undefined
        : await new Promise((resolve) => {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => resolve(Buffer.concat(chunks)));
          });
      const upstream = await fetch(`${TARGET}${url.pathname}${url.search}`, {
        method: req.method,
        headers: {
          'content-type': req.headers['content-type'] || 'application/json',
          ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        },
        body,
      });
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `Proxy to ${TARGET} failed: ${err.message}` }));
    }
    return;
  }

  // Static file if it exists; SPA fallback to index.html otherwise.
  const safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(DIST, safePath);
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!file.startsWith(DIST)) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`events local preview → http://localhost:${PORT}/events`);
  console.log(`api proxied to ${TARGET}`);
});
