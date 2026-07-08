// vite.config.cjs — CommonJS version to bypass Node 24 + esbuild config-bundling hang.
// Vite loads .cjs configs directly without esbuild, so the hang never occurs.
// Keep in sync with vite.config.js.
const react = require('@vitejs/plugin-react')
const { defineConfig, loadEnv } = require('vite')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

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

// Prevents esbuild from spawning — which hangs the event loop on this machine.
//
// ROOT CAUSE: @vitejs/plugin-react's config() hook returns { esbuild: { jsx: "automatic" } }.
// Vite's mergeConfig falls through to `merged[key] = value` when existing=false (primitive)
// and value={...} (object), so plugin-react OVERWRITES our user-level `esbuild: false`.
// This re-enables the vite:esbuild plugin (line 48663 in dep-BK3b2jBa.js), which spawns
// the esbuild service IPC child process on the first file transform — hanging this machine.
//
// Fix: our config() hook runs AFTER plugin-react in the plugin array, so it wins the merge.
// We also removed hmr:false so plugin-react keeps its Babel transform for JSX (when
// hmr===false, plugin-react deletes its own transform assuming esbuild handles JSX).
function noOptimizerPlugin() {
  return {
    name: 'avalon-no-optimizer',
    // Re-assert esbuild:false AFTER plugin-react's config() hook overwrites it.
    // Plugin config() hooks run in array order; since we're after react(), we win.
    config() {
      return { esbuild: false };
    },
    configResolved(config) {
      const before = JSON.stringify(config.optimizeDeps.include);
      config.optimizeDeps.include = [];
      // Belt-and-suspenders: remove vite:esbuild from plugin list if it snuck in.
      const esbuildIdx = config.plugins.findIndex(p => p && p.name === 'vite:esbuild');
      if (esbuildIdx !== -1) {
        config.plugins.splice(esbuildIdx, 1);
        process.stderr.write('[AVALON] WARNING: vite:esbuild plugin found and removed\n');
      } else {
        process.stderr.write('[AVALON] OK: vite:esbuild plugin not present\n');
      }
      process.stdout.write(
        '\n[AVALON] configResolved. include before=' + before +
        ' after=[] noDiscovery=' + config.optimizeDeps.noDiscovery +
        ' esbuild=' + JSON.stringify(config.esbuild) + '\n'
      );
    },
  };
}

function localApiPlugin() {
  return {
    name: 'avalon-local-api',
    configureServer(server) {
      // RAW HTTP-level trace: fires before connect middleware, confirms request event works
      if (server.httpServer) {
        server.httpServer.on('listening', () => {
          const addr = server.httpServer.address();
          process.stderr.write('[AVALON] LISTENING on: ' + JSON.stringify(addr) + '\n');
        });
        server.httpServer.on('request', (req) => {
          process.stderr.write('[RAW-HTTP] ' + req.method + ' ' + req.url + '\n');
        });
        server.httpServer.on('error', (err) => {
          process.stderr.write('[AVALON] httpServer ERROR: ' + err.message + '\n');
        });
        server.httpServer.on('close', () => {
          process.stderr.write('[AVALON] httpServer CLOSED\n');
        });
        process.stderr.write('[AVALON] httpServer listeners attached. Already listening: ' + server.httpServer.listening + '\n');
      } else {
        process.stderr.write('[AVALON] WARNING: server.httpServer is null!\n');
      }

      server.middlewares.use((req, res, next) => {
        // Diagnostic: log every request to stderr (line-buffered, bypasses tee delay)
        process.stderr.write('[AVALON-REQ] ' + (req.method || '?') + ' ' + (req.url || '/') + '\n');

        // Diagnostic ping endpoint — responds immediately to confirm event loop is live
        if (req.url === '/__ping') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('pong');
          return;
        }

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

module.exports = defineConfig(({ mode }) => {
  applyEnv(mode);
  const liveApiEnabled = process.env.VITE_AVALON_ENABLE_LIVE_API === 'true';

  return {
    logLevel: 'info',
    // Disable esbuild for ALL file transforms — prevents IPC hang on this machine.
    // @vitejs/plugin-react (babel) handles JSX/TSX/TS instead.
    esbuild: false,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      react(),
      noOptimizerPlugin(),
      localApiPlugin(),
      redactDemoPasswordPlugin(liveApiEnabled),
    ],
    optimizeDeps: {
      noDiscovery: true,
      include: [],
      holdUntilCrawlEnd: false,
      exclude: [
        'react', 'react-dom', 'react-dom/client',
        'react/jsx-runtime', 'react/jsx-dev-runtime',
        'react-router-dom', 'framer-motion', 'motion-dom',
        'lucide-react', '@supabase/supabase-js',
        'react-hook-form', 'react-dropzone', 'qrcode.react',
        '@radix-ui/react-dialog', '@radix-ui/react-slot',
        '@radix-ui/react-label', '@radix-ui/react-select',
        '@radix-ui/react-checkbox', '@radix-ui/react-toast',
        '@radix-ui/react-accordion', '@radix-ui/react-tabs',
        '@radix-ui/react-scroll-area', '@radix-ui/react-separator',
        '@radix-ui/react-progress', '@radix-ui/react-avatar',
        '@radix-ui/react-switch', '@radix-ui/react-popover',
        '@radix-ui/react-tooltip', '@radix-ui/react-dropdown-menu',
        'stripe', 'resend',
      ],
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      // hmr:false removed — see noOptimizerPlugin comment above for why.
      // Keeping HMR enabled (WS only, no overlay) so plugin-react's Babel transform stays active.
      hmr: { overlay: false },
      watch: null,
      // Don't pre-warm any files — prevents warmup from triggering transforms.
      warmup: { clientFiles: [] },
    },
    build: {
      target: ['es2015', 'chrome58', 'firefox57', 'safari11', 'edge18', 'ios11'],
    },
  };
});
