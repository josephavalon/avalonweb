import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dist = path.join(repoRoot, 'dist');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  return fallback;
}

const host = argValue('--host', process.env.HOST || '127.0.0.1');
const port = Number(argValue('--port', process.env.PORT || '4173'));

const mimeTypes = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0] || '/');
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return path.join(root, normalized);
}

function readIfFile(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

function isPrivateRoute(urlPath) {
  if (urlPath === '/admin/login') return false;
  return ['/admin', '/provider', '/members', '/api'].some((prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`));
}

const PUBLIC_SPA_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/(event-iv-therapy-bay-area|pricing|safety|ingredients|gift|athlete|hangover|jet-lag|press)$/,
  /^\/(locations|learn|products|launches|events|presale|therapies)(\/.+)?$/,
  /^\/(our-story|team|medical-direction|apply|careers|faq|services\/nad|services\/cbd)$/,
  /^\/(subscription|plan|corporate|hotel|service-area|partners|platform|b2b|custom|book|protocols|menu|checkout|checkout\/success|login|signup|forgot|forgot-password|admin\/login|order|redeem)$/,
  /^\/booking\/confirmation$/,
  /^\/(privacy|privacy-policy|terms|terms-and-conditions|terms-of-service|telehealth-disclaimer|product-disclaimer|notice-of-privacy-practices|hipaa-notice|cookie-policy|cookies)$/,
];

function isPublicSpaRoute(urlPath) {
  return PUBLIC_SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(urlPath));
}

function sendJson(res, status, payload, method) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (method === 'HEAD') res.end();
  else res.end(JSON.stringify(payload));
}

function localAppointmentSummary(url) {
  const id = url.searchParams.get('appointment') || url.searchParams.get('id') || url.searchParams.get('session_id') || 'local-preview';
  return {
    id,
    type: 'Avalon local request',
    datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    duration: 60,
    location: 'Local request address',
    price: 0,
    paymentStatus: 'local_preview',
    status: 'local_preview',
    source: 'preview-server',
    preApi: true,
  };
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('error', () => resolve({}));
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function localCheckoutSession(url, body = {}) {
  const localId = `local-${Date.now()}`;
  const origin = url.origin;
  const items = Array.isArray(body.items) ? body.items : [];
  const membership = body.membership && typeof body.membership === 'object' ? body.membership : null;
  return {
    ok: true,
    provider: 'local-simulation',
    previewOnly: true,
    preApiHardWall: true,
    code: 'pre_api_hard_wall',
    appointment: {
      id: localId,
      provider: 'local-simulation',
      type: items[0]?.label || membership?.name || 'Avalon local simulation',
      datetime: body.appointment?.acuityDatetime || null,
      preApi: true,
    },
    url: `${origin}/booking/confirmation?appointment=${encodeURIComponent(localId)}&preapi=1`,
  };
}

function routeUrl(urlPath) {
  const normalized = urlPath === '/' ? '/' : urlPath.replace(/\/+$/, '');
  return `https://www.avalonvitality.co${normalized === '/' ? '/' : normalized}`;
}

function withCrawlerMeta(htmlBuffer, {
  robots = 'noindex, nofollow',
  title = 'Page Not Found | Avalon Vitality',
  description = 'This Avalon Vitality page is not available for indexing.',
  canonicalPath = '/',
  body = null,
} = {}) {
  let html = htmlBuffer.toString('utf8');
  const replacements = [
    [/<title>[^<]*<\/title>/i, `<title>${title}</title>`],
    [/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`],
    [/<meta name="robots" content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${robots}" />`],
    [/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${routeUrl(canonicalPath)}" />`],
    [/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${description}" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${routeUrl(canonicalPath)}" />`],
  ];

  for (const [pattern, tag] of replacements) {
    html = pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
  }

  if (body) html = html.replace(/<div id="root">[\s\S]*<\/div>\s*<!-- Google Translate target/i, `<div id="root">${body}\n    </div>\n\n    <!-- Google Translate target`);
  return Buffer.from(html);
}

function unavailableBody(label, detail) {
  return `
      <div id="seo-prerender" style="min-height:100vh;background-color:#2a2521;background-image:linear-gradient(90deg,rgba(42,37,33,.84),rgba(42,37,33,.52) 45%,rgba(42,37,33,.22)),url('/images/avalon-static-back-512.webp');background-size:cover;background-position:86% 52%;color:#f4f4f1;font-family:Inter,Arial,sans-serif;padding:48px 24px;">
        <main style="max-width:760px;margin:0 auto;">
          <p style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:rgba(244,244,241,.52);margin:0 0 18px;">Avalon Vitality</p>
          <h1 style="font-family:Arial,sans-serif;font-size:clamp(42px,10vw,82px);line-height:.9;text-transform:uppercase;margin:0 0 24px;">${label}</h1>
          <p style="max-width:620px;font-size:18px;line-height:1.65;color:rgba(244,244,241,.68);margin:0;">${detail}</p>
        </main>
      </div>`;
}

function resolveRootHtml(baseName) {
  const canonical = path.join(dist, `${baseName}.html`);
  if (fs.existsSync(canonical)) return canonical;
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fallback = fs.readdirSync(dist)
    .find((name) => new RegExp(`^${escaped} \\d+\\.html$`).test(name));
  return fallback ? path.join(dist, fallback) : canonical;
}

if (!readIfFile(resolveRootHtml('index'))) {
  console.error('[preview-server] dist/index.html missing. Run npm run build first.');
  process.exit(1);
}

function candidateFiles(urlPath) {
  const exact = safeJoin(dist, urlPath);
  const candidates = [exact];

  if (!path.extname(exact)) {
    candidates.push(`${exact}.html`);
    candidates.push(path.join(exact, 'index.html'));
  }

  if (urlPath.endsWith('/')) candidates.push(path.join(exact, 'index.html'));
  return candidates;
}

function send(res, status, file, body, method) {
  const ext = path.extname(file);
  const base = path.basename(file);
  const isCrawlControl = base === 'robots.txt' || base === 'sitemap.xml';
  const headers = {
    'Content-Type': mimeTypes.get(ext) || 'application/octet-stream',
    'Cache-Control': ext === '.html' || isCrawlControl ? 'no-cache' : 'public, max-age=31536000, immutable',
  };
  if (ext === '.html' && Buffer.isBuffer(body) && body.includes('noindex')) {
    headers['X-Robots-Tag'] = 'noindex, nofollow';
  }
  res.writeHead(status, headers);
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${host}:${port}`);

  if (url.pathname === '/api/create-checkout-session' && method === 'POST') {
    sendJson(res, 200, localCheckoutSession(url, await readJsonBody(req)), method);
    return;
  }

  if (!['GET', 'HEAD'].includes(method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const isAssetLike = /\.[a-z0-9]+$/i.test(url.pathname);

  if (url.pathname === '/api/appointment-summary') {
    sendJson(res, 200, localAppointmentSummary(url), method);
    return;
  }

  for (const file of candidateFiles(url.pathname)) {
    const live = readIfFile(file);
    if (live) {
      send(res, 200, file, live, method);
      return;
    }
  }

  if (!isAssetLike) {
    const indexPath = resolveRootHtml('index');
    const liveIndex = readIfFile(indexPath);
    if (liveIndex) {
      if (isPrivateRoute(url.pathname)) {
        const body = unavailableBody('Portal', 'This application route is private and is blocked from search indexing. Sign in through Avalon to continue.');
        send(res, 200, indexPath, withCrawlerMeta(liveIndex, {
          title: 'Avalon Portal | Avalon Vitality',
          description: 'Private Avalon Vitality portal route. This page is not indexable.',
          canonicalPath: '/login',
          body,
        }), method);
        return;
      }
      if (isPublicSpaRoute(url.pathname)) {
        send(res, 200, indexPath, liveIndex, method);
        return;
      }
      const body = unavailableBody('Page Not Found', 'The requested Avalon Vitality page does not exist or has moved.');
      send(res, 404, indexPath, withCrawlerMeta(liveIndex, {
        title: 'Page Not Found | Avalon Vitality',
        description: 'This Avalon Vitality page does not exist or has moved.',
        canonicalPath: url.pathname,
        body,
      }), method);
      return;
    }
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('dist/index.html missing. Run npm run build first.');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  if (method === 'HEAD') res.end();
  else res.end('Not found');
});

server.listen(port, host, () => {
  console.log(`  ➜  Local:   http://${host}:${port}/`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
