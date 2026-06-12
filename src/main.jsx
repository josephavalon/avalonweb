// Avalon Vitality v2
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureAttribution, getExperimentVariant } from '@/lib/analytics'
import { initErrorTelemetry } from '@/lib/errorTelemetry'
import { applyTheme, THEME_KEY } from '@/lib/theme'

function applyStoredTheme() {
  try {
    // Revert to the dark default: one-time flip back for anyone the short-lived
    // light default migrated to daytime. The theme switcher still works after.
    if (!window.localStorage.getItem('avalon.theme.dark-restore')) {
      window.localStorage.setItem(THEME_KEY, 'dark');
      window.localStorage.setItem('avalon.theme.dark-restore', '1');
    }
  } catch {
    /* storage unavailable in private windows; the default theme still applies */
  }
  try {
    applyTheme();
  } catch (err) {
    document.documentElement.classList.add('dark');
    if (import.meta.env?.DEV) console.warn('[theme-boot]', err);
  }
}

applyStoredTheme();
initErrorTelemetry();
captureAttribution();
getExperimentVariant('booking_entry_v1', ['protocol-first', 'fast-hold']);

document.getElementById('seo-prerender')?.remove();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// A cache-first service worker was serving mismatched bundles after deploys,
// causing "Failed to fetch dynamically imported module" crashes. Unregister any
// existing worker and drop its caches, and do NOT register a new one.
// public/sw.js is now a self-destruct kill-switch so already-installed workers
// clean themselves up on their next update check too.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});
  if (window.caches?.keys) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
  }
}

// Safety net for future deploys: if a lazy-loaded chunk fails to fetch (an old
// tab after chunk hashes rotated), reload once to pull the current build.
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem('av-chunk-reload')) return;
    sessionStorage.setItem('av-chunk-reload', '1');
  } catch {
    /* sessionStorage unavailable; fall through to a single reload attempt */
  }
  window.location.reload();
});
