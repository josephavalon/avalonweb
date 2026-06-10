// Avalon Vitality v2
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureAttribution, getExperimentVariant } from '@/lib/analytics'
import { applyTheme, THEME_KEY } from '@/lib/theme'

function applyStoredTheme() {
  try {
    // Reverse to the light (daytime) default: one-time flip for visitors whose
    // stored preference predates it. The theme switcher still works afterward.
    if (!window.localStorage.getItem('avalon.theme.light-default')) {
      window.localStorage.setItem(THEME_KEY, 'daytime');
      window.localStorage.setItem('avalon.theme.light-default', '1');
    }
  } catch {
    /* storage unavailable in private windows; the default theme still applies */
  }
  try {
    applyTheme();
  } catch (err) {
    document.documentElement.classList.add('daytime');
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
