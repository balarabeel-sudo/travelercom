// Minimal service worker — required for PWA installability (TWA/Play Store).
// Intentionally does not cache anything yet, so it never serves stale app data.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Pass-through: always fetch from network.
})
