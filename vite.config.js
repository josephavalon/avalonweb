import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { transform as swcTransform } from '@swc/core'

const RETIRED_DEMO_PASSWORD = ['Jon', 'Jones', '1986'].join('');

const API_ROUTES = {
  '/api/acuity-availability': './api/acuity-availability.js',
  '/api/acuity-book': './api/acuity-book.js',
  '/api/create-checkout-session': './api/create-checkout-session.js',
  '/api/integrations/acuity/test': './api/integrations/acuity/test.js',
  '/api/integrations/acuity/webhook': './api/integrations/acuity/webhook.js',
  '/api/integrations/attio/test': './api/integrations/attio/test.js',
  '/api/integrations/attio/upsert-person': './api/integrations/attio/upsert-person.js',
  '/api/integrations/hubspot/test': './api/integrations/hubspot/test.js',
  '/api/integrations/hubspot/upsert-contact': './api/integrations/hubspot/upsert-contact.js',
  '/api/integrations/stripe/test': './api/integrations/stripe/test.js',
  '/api/admin/guest-profile': './api/admin/guest-profile.js',
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function createVercelResponse(res) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    json(payload) {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    },
    send(payload) {
      res.end(payload);
    },
  };
}

function localApiPlugin() {
  const mountLocalApi = (middlewares, logger) => {
    middlewares.use((req, res, next) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const routeFile = API_ROUTES[url.pathname];
      if (!routeFile) return next();

      (async () => {
        try {
          const moduleUrl = pathToFileURL(path.resolve(process.cwd(), routeFile)).href;
          const { default: handler } = await import(`${moduleUrl}?t=${Date.now()}`);
          req.query = Object.fromEntries(url.searchParams.entries());
          req.body = ['POST', 'PUT', 'PATCH'].includes(req.method || '') ? await readJsonBody(req) : {};
          await handler(req, createVercelResponse(res));
        } catch (err) {
          logger.error(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Local API failed' }));
        }
      })();
    });
  };

  return {
    name: 'avalon-local-api',
    configureServer(server) {
      mountLocalApi(server.middlewares, server.config.logger);
    },
    configurePreviewServer(server) {
      mountLocalApi(server.middlewares, server.config.logger);
    },
  };
}

function swcJsxTransformPlugin() {
  return {
    name: 'avalon-swc-jsx-transform',
    enforce: 'pre',
    async transform(code, id) {
      const [filename] = id.split('?');
      if (!/\.[jt]sx$/.test(filename) || filename.includes('/node_modules/')) return null;

      const result = await swcTransform(code, {
        filename,
        sourceMaps: true,
        jsc: {
          parser: {
            syntax: filename.endsWith('.tsx') || filename.endsWith('.ts') ? 'typescript' : 'ecmascript',
            jsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
              development: process.env.NODE_ENV !== 'production',
              refresh: false,
            },
          },
        },
      });

      return {
        code: result.code,
        map: result.map ? JSON.parse(result.map) : null,
      };
    },
  };
}

function applyEnv(mode) {
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(loadedEnv)) {
    if (process.env[key] == null) process.env[key] = value;
  }
  if (process.env.VITE_AVALON_DEMO_PASSWORD === RETIRED_DEMO_PASSWORD) {
    process.env.VITE_AVALON_DEMO_PASSWORD = '';
  }
}

function redactDemoPasswordPlugin(isLiveApiEnabled) {
  return {
    name: 'avalon-redact-demo-password',
    apply: 'build',
    renderChunk(code) {
      let next = code.replace(/JonJones1986/g, '');
      if (isLiveApiEnabled) {
        next = next
        .replace(/VITE_AVALON_DEMO_PASSWORD:"[^"]*"/g, 'VITE_AVALON_DEMO_PASSWORD:""')
        .replace(/JonJones1986/g, '');
      }
      return next === code ? null : { code: next, map: null };
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  applyEnv(mode);
  const liveApiEnabled = process.env.VITE_AVALON_ENABLE_LIVE_API === 'true';
  // Staging and prod share the same `vite build` invocation; the only signal
  // that this is a prod-host build is VITE_AVALON_ENABLE_LIVE_API=true. A prod
  // deploy with the flag missing would ship a demo-bearing bundle, which is a
  // HIPAA finding. Fail loud at build time so the deployer can't ship it
  // accidentally. Set AVALON_ALLOW_STAGING_BUILD=true to bypass for staging.
  if (
    mode === 'production'
    && !liveApiEnabled
    && process.env.VITE_AVALON_DEMO_PASSWORD
    && process.env.AVALON_ALLOW_STAGING_BUILD !== 'true'
  ) {
    throw new Error(
      'Refusing to build: production mode with VITE_AVALON_DEMO_PASSWORD set but VITE_AVALON_ENABLE_LIVE_API!=true. '
      + 'Set VITE_AVALON_ENABLE_LIVE_API=true for prod hosts, or AVALON_ALLOW_STAGING_BUILD=true for staging.'
    );
  }
  const fixtureAliases = mode === 'development'
    ? [
        { find: /^@\/fixtures\/adminMockData$/, replacement: path.resolve(import.meta.dirname, './src/data/adminMockData.js') },
        { find: /^@\/fixtures\/commandMockData$/, replacement: path.resolve(import.meta.dirname, './src/data/commandMockData.js') },
      ]
    : [];

  return {
  logLevel: 'info',
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: [
      ...fixtureAliases,
      { find: '@', replacement: path.resolve(import.meta.dirname, './src') },
    ],
  },
  plugins: [
    swcJsxTransformPlugin(),
    react(),
    localApiPlugin(),
    redactDemoPasswordPlugin(liveApiEnabled),
  ],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    watch: {
      ignored: ['**/vite.config.js.timestamp-*.mjs'],
    },
  },
  build: {
    // es2015 + explicit browser floors covers:
    // - iOS in-app browsers (Instagram, TikTok, Gmail) which run older WKWebView
    // - Android Chrome 58+ (WebView API level 22)
    // - Samsung Internet 8+
    // Slightly larger bundle than es2020 but zero parse failures on the target audience.
    target: ['es2015', 'chrome58', 'firefox57', 'safari11', 'edge18', 'ios11'],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) return 'react-vendor';
          // `motion` (formerly framer-motion) + its motion-dom/motion-utils deps
          if (id.includes('node_modules/motion')) return 'motion-vendor';
          if (id.includes('node_modules/lucide-react')) return 'icons-vendor';
          if (id.includes('node_modules/@stripe')) return 'stripe-vendor';
          if (id.includes('node_modules/@radix-ui')) return 'ui-vendor';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts-vendor';
          if (id.includes('node_modules/@supabase')) return 'supabase-vendor';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  };
});
