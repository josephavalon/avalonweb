import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const API_ROUTES = {
  '/api/acuity-availability': './api/acuity-availability.js',
  '/api/acuity-book': './api/acuity-book.js',
  '/api/create-checkout-session': './api/create-checkout-session.js',
  '/api/integrations/acuity/test': './api/integrations/acuity/test.js',
  '/api/integrations/acuity/webhook': './api/integrations/acuity/webhook.js',
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
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const routeFile = API_ROUTES[url.pathname];
        if (!routeFile) return next();

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
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
  logLevel: 'info',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // react-hook-form ships without its ESM dist in this install — alias
      // directly to the CJS file so Vite never touches the broken exports map.
      'react-hook-form': path.resolve(__dirname, './node_modules/react-hook-form/dist/index.cjs.js'),
    },
  },
  plugins: [
    react(),
    localApiPlugin(),
  ],
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  optimizeDeps: {
    include: ['react-hook-form'],
  },
  build: {
    // es2015 + explicit browser floors covers:
    // - iOS in-app browsers (Instagram, TikTok, Gmail) which run older WKWebView
    // - Android Chrome 58+ (WebView API level 22)
    // - Samsung Internet 8+
    // Slightly larger bundle than es2020 but zero parse failures on the target audience.
    target: ['es2015', 'chrome58', 'firefox57', 'safari11', 'edge18', 'ios11'],
  },
  };
});
