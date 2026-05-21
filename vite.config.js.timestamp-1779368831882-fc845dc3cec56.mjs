// vite.config.js
import react from "file:///sessions/determined-bold-brown/mnt/avalon%20vitality/node_modules/@vitejs/plugin-react/dist/index.js";
import { defineConfig } from "file:///sessions/determined-bold-brown/mnt/avalon%20vitality/node_modules/vite/dist/node/index.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
var __vite_injected_original_dirname = "/sessions/determined-bold-brown/mnt/avalon vitality";
var API_ROUTES = {
  "/api/acuity-availability": "./api/acuity-availability.js",
  "/api/acuity-book": "./api/acuity-book.js",
  "/api/create-checkout-session": "./api/create-checkout-session.js",
  "/api/integrations/acuity/test": "./api/integrations/acuity/test.js",
  "/api/integrations/acuity/webhook": "./api/integrations/acuity/webhook.js"
};
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
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
      if (!res.headersSent) res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    },
    send(payload) {
      res.end(payload);
    }
  };
}
function localApiPlugin() {
  return {
    name: "avalon-local-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const routeFile = API_ROUTES[url.pathname];
        if (!routeFile) return next();
        try {
          const moduleUrl = pathToFileURL(path.resolve(process.cwd(), routeFile)).href;
          const { default: handler } = await import(`${moduleUrl}?t=${Date.now()}`);
          req.query = Object.fromEntries(url.searchParams.entries());
          req.body = ["POST", "PUT", "PATCH"].includes(req.method || "") ? await readJsonBody(req) : {};
          await handler(req, createVercelResponse(res));
        } catch (err) {
          server.config.logger.error(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Local API failed" }));
        }
      });
    }
  };
}
var vite_config_default = defineConfig({
  logLevel: "info",
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      // react-hook-form ships without its ESM dist in this install — alias
      // directly to the CJS file so Vite never touches the broken exports map.
      "react-hook-form": path.resolve(__vite_injected_original_dirname, "./node_modules/react-hook-form/dist/index.cjs.js")
    }
  },
  plugins: [
    react(),
    localApiPlugin()
  ],
  server: {
    watch: {
      usePolling: true,
      interval: 300
    }
  },
  optimizeDeps: {
    include: ["react-hook-form"]
  },
  build: {
    // es2015 + explicit browser floors covers:
    // - iOS in-app browsers (Instagram, TikTok, Gmail) which run older WKWebView
    // - Android Chrome 58+ (WebView API level 22)
    // - Samsung Internet 8+
    // Slightly larger bundle than es2020 but zero parse failures on the target audience.
    target: ["es2015", "chrome58", "firefox57", "safari11", "edge18", "ios11"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZGV0ZXJtaW5lZC1ib2xkLWJyb3duL21udC9hdmFsb24gdml0YWxpdHlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9kZXRlcm1pbmVkLWJvbGQtYnJvd24vbW50L2F2YWxvbiB2aXRhbGl0eS92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZGV0ZXJtaW5lZC1ib2xkLWJyb3duL21udC9hdmFsb24lMjB2aXRhbGl0eS92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnXG5cbmNvbnN0IEFQSV9ST1VURVMgPSB7XG4gICcvYXBpL2FjdWl0eS1hdmFpbGFiaWxpdHknOiAnLi9hcGkvYWN1aXR5LWF2YWlsYWJpbGl0eS5qcycsXG4gICcvYXBpL2FjdWl0eS1ib29rJzogJy4vYXBpL2FjdWl0eS1ib29rLmpzJyxcbiAgJy9hcGkvY3JlYXRlLWNoZWNrb3V0LXNlc3Npb24nOiAnLi9hcGkvY3JlYXRlLWNoZWNrb3V0LXNlc3Npb24uanMnLFxuICAnL2FwaS9pbnRlZ3JhdGlvbnMvYWN1aXR5L3Rlc3QnOiAnLi9hcGkvaW50ZWdyYXRpb25zL2FjdWl0eS90ZXN0LmpzJyxcbiAgJy9hcGkvaW50ZWdyYXRpb25zL2FjdWl0eS93ZWJob29rJzogJy4vYXBpL2ludGVncmF0aW9ucy9hY3VpdHkvd2ViaG9vay5qcycsXG59O1xuXG5hc3luYyBmdW5jdGlvbiByZWFkSnNvbkJvZHkocmVxKSB7XG4gIGNvbnN0IGNodW5rcyA9IFtdO1xuICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgY2h1bmtzLnB1c2goY2h1bmspO1xuICBpZiAoIWNodW5rcy5sZW5ndGgpIHJldHVybiB7fTtcbiAgY29uc3QgcmF3ID0gQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKCd1dGY4Jyk7XG4gIGlmICghcmF3KSByZXR1cm4ge307XG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UocmF3KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVZlcmNlbFJlc3BvbnNlKHJlcykge1xuICByZXR1cm4ge1xuICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICBzdGF0dXMoY29kZSkge1xuICAgICAgdGhpcy5zdGF0dXNDb2RlID0gY29kZTtcbiAgICAgIHJlcy5zdGF0dXNDb2RlID0gY29kZTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSB7XG4gICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAganNvbihwYXlsb2FkKSB7XG4gICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xuICAgIH0sXG4gICAgc2VuZChwYXlsb2FkKSB7XG4gICAgICByZXMuZW5kKHBheWxvYWQpO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGxvY2FsQXBpUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhdmFsb24tbG9jYWwtYXBpJyxcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgJy8nLCAnaHR0cDovL2xvY2FsaG9zdCcpO1xuICAgICAgICBjb25zdCByb3V0ZUZpbGUgPSBBUElfUk9VVEVTW3VybC5wYXRobmFtZV07XG4gICAgICAgIGlmICghcm91dGVGaWxlKSByZXR1cm4gbmV4dCgpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgbW9kdWxlVXJsID0gcGF0aFRvRmlsZVVSTChwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgcm91dGVGaWxlKSkuaHJlZjtcbiAgICAgICAgICBjb25zdCB7IGRlZmF1bHQ6IGhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydChgJHttb2R1bGVVcmx9P3Q9JHtEYXRlLm5vdygpfWApO1xuICAgICAgICAgIHJlcS5xdWVyeSA9IE9iamVjdC5mcm9tRW50cmllcyh1cmwuc2VhcmNoUGFyYW1zLmVudHJpZXMoKSk7XG4gICAgICAgICAgcmVxLmJvZHkgPSBbJ1BPU1QnLCAnUFVUJywgJ1BBVENIJ10uaW5jbHVkZXMocmVxLm1ldGhvZCB8fCAnJykgPyBhd2FpdCByZWFkSnNvbkJvZHkocmVxKSA6IHt9O1xuICAgICAgICAgIGF3YWl0IGhhbmRsZXIocmVxLCBjcmVhdGVWZXJjZWxSZXNwb25zZShyZXMpKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgc2VydmVyLmNvbmZpZy5sb2dnZXIuZXJyb3IoZXJyKTtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfHwgJ0xvY2FsIEFQSSBmYWlsZWQnIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBsb2dMZXZlbDogJ2luZm8nLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAvLyByZWFjdC1ob29rLWZvcm0gc2hpcHMgd2l0aG91dCBpdHMgRVNNIGRpc3QgaW4gdGhpcyBpbnN0YWxsIFx1MjAxNCBhbGlhc1xuICAgICAgLy8gZGlyZWN0bHkgdG8gdGhlIENKUyBmaWxlIHNvIFZpdGUgbmV2ZXIgdG91Y2hlcyB0aGUgYnJva2VuIGV4cG9ydHMgbWFwLlxuICAgICAgJ3JlYWN0LWhvb2stZm9ybSc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL25vZGVfbW9kdWxlcy9yZWFjdC1ob29rLWZvcm0vZGlzdC9pbmRleC5janMuanMnKSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBsb2NhbEFwaVBsdWdpbigpLFxuICBdLFxuICBzZXJ2ZXI6IHtcbiAgICB3YXRjaDoge1xuICAgICAgdXNlUG9sbGluZzogdHJ1ZSxcbiAgICAgIGludGVydmFsOiAzMDAsXG4gICAgfSxcbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgaW5jbHVkZTogWydyZWFjdC1ob29rLWZvcm0nXSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBlczIwMTUgKyBleHBsaWNpdCBicm93c2VyIGZsb29ycyBjb3ZlcnM6XG4gICAgLy8gLSBpT1MgaW4tYXBwIGJyb3dzZXJzIChJbnN0YWdyYW0sIFRpa1RvaywgR21haWwpIHdoaWNoIHJ1biBvbGRlciBXS1dlYlZpZXdcbiAgICAvLyAtIEFuZHJvaWQgQ2hyb21lIDU4KyAoV2ViVmlldyBBUEkgbGV2ZWwgMjIpXG4gICAgLy8gLSBTYW1zdW5nIEludGVybmV0IDgrXG4gICAgLy8gU2xpZ2h0bHkgbGFyZ2VyIGJ1bmRsZSB0aGFuIGVzMjAyMCBidXQgemVybyBwYXJzZSBmYWlsdXJlcyBvbiB0aGUgdGFyZ2V0IGF1ZGllbmNlLlxuICAgIHRhcmdldDogWydlczIwMTUnLCAnY2hyb21lNTgnLCAnZmlyZWZveDU3JywgJ3NhZmFyaTExJywgJ2VkZ2UxOCcsICdpb3MxMSddLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZVLE9BQU8sV0FBVztBQUMvVixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFIOUIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTSxhQUFhO0FBQUEsRUFDakIsNEJBQTRCO0FBQUEsRUFDNUIsb0JBQW9CO0FBQUEsRUFDcEIsZ0NBQWdDO0FBQUEsRUFDaEMsaUNBQWlDO0FBQUEsRUFDakMsb0NBQW9DO0FBQ3RDO0FBRUEsZUFBZSxhQUFhLEtBQUs7QUFDL0IsUUFBTSxTQUFTLENBQUM7QUFDaEIsbUJBQWlCLFNBQVMsSUFBSyxRQUFPLEtBQUssS0FBSztBQUNoRCxNQUFJLENBQUMsT0FBTyxPQUFRLFFBQU8sQ0FBQztBQUM1QixRQUFNLE1BQU0sT0FBTyxPQUFPLE1BQU0sRUFBRSxTQUFTLE1BQU07QUFDakQsTUFBSSxDQUFDLElBQUssUUFBTyxDQUFDO0FBQ2xCLE1BQUk7QUFDRixXQUFPLEtBQUssTUFBTSxHQUFHO0FBQUEsRUFDdkIsUUFBUTtBQUNOLFdBQU8sQ0FBQztBQUFBLEVBQ1Y7QUFDRjtBQUVBLFNBQVMscUJBQXFCLEtBQUs7QUFDakMsU0FBTztBQUFBLElBQ0wsWUFBWTtBQUFBLElBQ1osT0FBTyxNQUFNO0FBQ1gsV0FBSyxhQUFhO0FBQ2xCLFVBQUksYUFBYTtBQUNqQixhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsVUFBVSxNQUFNLE9BQU87QUFDckIsVUFBSSxVQUFVLE1BQU0sS0FBSztBQUN6QixhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsS0FBSyxTQUFTO0FBQ1osVUFBSSxDQUFDLElBQUksWUFBYSxLQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUN0RSxVQUFJLElBQUksS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQ2pDO0FBQUEsSUFDQSxLQUFLLFNBQVM7QUFDWixVQUFJLElBQUksT0FBTztBQUFBLElBQ2pCO0FBQUEsRUFDRjtBQUNGO0FBRUEsU0FBUyxpQkFBaUI7QUFDeEIsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUksT0FBTyxLQUFLLEtBQUssU0FBUztBQUMvQyxjQUFNLE1BQU0sSUFBSSxJQUFJLElBQUksT0FBTyxLQUFLLGtCQUFrQjtBQUN0RCxjQUFNLFlBQVksV0FBVyxJQUFJLFFBQVE7QUFDekMsWUFBSSxDQUFDLFVBQVcsUUFBTyxLQUFLO0FBRTVCLFlBQUk7QUFDRixnQkFBTSxZQUFZLGNBQWMsS0FBSyxRQUFRLFFBQVEsSUFBSSxHQUFHLFNBQVMsQ0FBQyxFQUFFO0FBQ3hFLGdCQUFNLEVBQUUsU0FBUyxRQUFRLElBQUksTUFBTSxPQUFPLEdBQUcsU0FBUyxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQ3RFLGNBQUksUUFBUSxPQUFPLFlBQVksSUFBSSxhQUFhLFFBQVEsQ0FBQztBQUN6RCxjQUFJLE9BQU8sQ0FBQyxRQUFRLE9BQU8sT0FBTyxFQUFFLFNBQVMsSUFBSSxVQUFVLEVBQUUsSUFBSSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUM7QUFDNUYsZ0JBQU0sUUFBUSxLQUFLLHFCQUFxQixHQUFHLENBQUM7QUFBQSxRQUM5QyxTQUFTLEtBQUs7QUFDWixpQkFBTyxPQUFPLE9BQU8sTUFBTSxHQUFHO0FBQzlCLGNBQUksYUFBYTtBQUNqQixjQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUNoRCxjQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxJQUFJLFdBQVcsbUJBQW1CLENBQUMsQ0FBQztBQUFBLFFBQ3RFO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDRjtBQUdBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFVBQVU7QUFBQSxFQUNWLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQTtBQUFBO0FBQUEsTUFHcEMsbUJBQW1CLEtBQUssUUFBUSxrQ0FBVyxrREFBa0Q7QUFBQSxJQUMvRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLGVBQWU7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLElBQ1o7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsaUJBQWlCO0FBQUEsRUFDN0I7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNTCxRQUFRLENBQUMsVUFBVSxZQUFZLGFBQWEsWUFBWSxVQUFVLE9BQU87QUFBQSxFQUMzRTtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
