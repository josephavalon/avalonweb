// Self-destruct kill-switch.
//
// The previous cache-first service worker served mismatched/stale bundles after
// deploys, causing "Failed to fetch dynamically imported module" crashes. This
// replacement takes over from any already-installed worker (browsers re-check
// /sw.js on navigation), wipes all caches, unregisters itself, and reloads open
// tabs so they load fresh from the network. After it runs once there is no
// active service worker.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (err) {
      /* ignore */
    }
    try {
      await self.registration.unregister();
    } catch (err) {
      /* ignore */
    }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (err) {
      /* ignore */
    }
  })());
});

// No fetch handler — every request goes straight to the network.
