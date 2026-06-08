import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { transform as swcTransform } from '@swc/core'

const API_ROUTES = {
  '/api/acuity-availability': './api/acuity-availability.js',
  '/api/acuity-book': './api/acuity-book.js',
  '/api/create-checkout-session': './api/create-checkout-session.js',
  '/api/integrations/acuity/test': './api/integrations/acuity/test.js',
  '/api/integrations/acuity/webhook': './api/integrations/acuity/webhook.js',
  '/api/integrations/attio/test': './api/integrations/attio/test.js',
  '/api/integrations/attio/upsert-person': './api/integrations/attio/upsert-person.js',
  '/api/integrations/stripe/test': './api/integrations/stripe/test.js',
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
  return {
    name: 'avalon-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
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
            server.config.logger.error(err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Local API failed' }));
          }
        })();
      });
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
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
          if (id.includes('node_modules/framer-motion')) return 'motion-vendor';
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
