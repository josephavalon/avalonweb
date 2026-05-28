// Avalon Vitality v2
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureAttribution, getExperimentVariant } from '@/lib/analytics'

function applyStoredTheme() {
  try {
    const stored = localStorage.getItem('avalon.theme') || 'dark';
    const theme = ['dark', 'light', 'golden', 'dubs'].includes(stored) ? stored : 'dark';
    const root = document.documentElement;
    root.classList.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') root.classList.add(theme);
    localStorage.setItem('avalon.theme', theme);
  } catch (err) {
    document.documentElement.classList.add('dark');
    if (import.meta.env?.DEV) console.warn('[theme-boot]', err);
  }
}

// One-time migration: reset old 'golden' default to 'dark'
try {
  if (!localStorage.getItem('avalon.theme.v2')) {
    localStorage.setItem('avalon.theme', 'dark');
    localStorage.setItem('avalon.theme.v2', '1');
  }
} catch (err) {
  if (import.meta.env?.DEV) console.warn('[theme-migration]', err);
}

applyStoredTheme();
captureAttribution();
getExperimentVariant('booking_entry_v1', ['protocol-first', 'fast-hold']);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, { once: true });
}
