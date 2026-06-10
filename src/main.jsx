// Avalon Vitality v2
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureAttribution, getExperimentVariant } from '@/lib/analytics'
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
captureAttribution();
getExperimentVariant('booking_entry_v1', ['protocol-first', 'fast-hold']);

document.getElementById('seo-prerender')?.remove();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

const isLocalPreview = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

if ('serviceWorker' in navigator && isLocalPreview) {
  navigator.serviceWorker.getRegistrations?.().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});
}

if ('serviceWorker' in navigator && import.meta.env?.PROD && !isLocalPreview) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, { once: true });
}
