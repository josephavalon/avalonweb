import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
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
});
