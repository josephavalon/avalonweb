// vite.config.js
import react from "file:///sessions/determined-bold-brown/mnt/avalon%20vitality/node_modules/@vitejs/plugin-react/dist/index.js";
import { defineConfig } from "file:///sessions/determined-bold-brown/mnt/avalon%20vitality/node_modules/vite/dist/node/index.js";
import path from "node:path";
var __vite_injected_original_dirname = "/sessions/determined-bold-brown/mnt/avalon vitality";
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
    react()
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZGV0ZXJtaW5lZC1ib2xkLWJyb3duL21udC9hdmFsb24gdml0YWxpdHlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9kZXRlcm1pbmVkLWJvbGQtYnJvd24vbW50L2F2YWxvbiB2aXRhbGl0eS92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZGV0ZXJtaW5lZC1ib2xkLWJyb3duL21udC9hdmFsb24lMjB2aXRhbGl0eS92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5cbi8vIGh0dHBzOi8vdml0ZS5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgbG9nTGV2ZWw6ICdpbmZvJyxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgLy8gcmVhY3QtaG9vay1mb3JtIHNoaXBzIHdpdGhvdXQgaXRzIEVTTSBkaXN0IGluIHRoaXMgaW5zdGFsbCBcdTIwMTQgYWxpYXNcbiAgICAgIC8vIGRpcmVjdGx5IHRvIHRoZSBDSlMgZmlsZSBzbyBWaXRlIG5ldmVyIHRvdWNoZXMgdGhlIGJyb2tlbiBleHBvcnRzIG1hcC5cbiAgICAgICdyZWFjdC1ob29rLWZvcm0nOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9ub2RlX21vZHVsZXMvcmVhY3QtaG9vay1mb3JtL2Rpc3QvaW5kZXguY2pzLmpzJyksXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIHdhdGNoOiB7XG4gICAgICB1c2VQb2xsaW5nOiB0cnVlLFxuICAgICAgaW50ZXJ2YWw6IDMwMCxcbiAgICB9LFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ3JlYWN0LWhvb2stZm9ybSddLFxuICB9LFxuICBidWlsZDoge1xuICAgIC8vIGVzMjAxNSArIGV4cGxpY2l0IGJyb3dzZXIgZmxvb3JzIGNvdmVyczpcbiAgICAvLyAtIGlPUyBpbi1hcHAgYnJvd3NlcnMgKEluc3RhZ3JhbSwgVGlrVG9rLCBHbWFpbCkgd2hpY2ggcnVuIG9sZGVyIFdLV2ViVmlld1xuICAgIC8vIC0gQW5kcm9pZCBDaHJvbWUgNTgrIChXZWJWaWV3IEFQSSBsZXZlbCAyMilcbiAgICAvLyAtIFNhbXN1bmcgSW50ZXJuZXQgOCtcbiAgICAvLyBTbGlnaHRseSBsYXJnZXIgYnVuZGxlIHRoYW4gZXMyMDIwIGJ1dCB6ZXJvIHBhcnNlIGZhaWx1cmVzIG9uIHRoZSB0YXJnZXQgYXVkaWVuY2UuXG4gICAgdGFyZ2V0OiBbJ2VzMjAxNScsICdjaHJvbWU1OCcsICdmaXJlZm94NTcnLCAnc2FmYXJpMTEnLCAnZWRnZTE4JywgJ2lvczExJ10sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNlUsT0FBTyxXQUFXO0FBQy9WLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixVQUFVO0FBQUEsRUFDVixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUE7QUFBQTtBQUFBLE1BR3BDLG1CQUFtQixLQUFLLFFBQVEsa0NBQVcsa0RBQWtEO0FBQUEsSUFDL0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLElBQ1o7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsaUJBQWlCO0FBQUEsRUFDN0I7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNTCxRQUFRLENBQUMsVUFBVSxZQUFZLGFBQWEsWUFBWSxVQUFVLE9BQU87QUFBQSxFQUMzRTtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
