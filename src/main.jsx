// Avalon Vitality v2
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureAttribution, getExperimentVariant } from '@/lib/analytics'

function applyStoredTheme() {
  try {
    const root = document.documentElement;
    root.classList.remove('dark', 'golden', 'dubs');
    root.classList.add('dark');
    localStorage.setItem('avalon.theme', 'dark');
    localStorage.setItem('avalon.theme.v2', '1');
  } catch (err) {
    document.documentElement.classList.add('dark');
    if (import.meta.env?.DEV) console.warn('[theme-boot]', err);
  }
}

// Keep the public beta dark-only for now.
try {
  localStorage.setItem('avalon.theme', 'dark');
  localStorage.setItem('avalon.theme.v2', '1');
} catch (err) {
  if (import.meta.env?.DEV) console.warn('[theme-migration]', err);
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
