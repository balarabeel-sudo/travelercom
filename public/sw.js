// TravelerCom app-shell service worker (v2).
// Goal: the app opens instantly and shows the homepage even with no data/internet.
// Only same-origin files are cached. Supabase/API calls are NOT touched here.

const CACHE_NAME = 'travelercom-shell-v2';

// Reads index.html, finds every JS/CSS/icon file it uses, and caches them all.
// This makes the app work offline right after the FIRST visit.
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexUrl = new URL('./index.html', self.location).href;
  const response = await fetch(indexUrl, { cache: 'reload' });
  const html = await response.clone().text();

  await cache.put(indexUrl, response.clone());
  await cache.put(new URL('./', self.location).href, response);

  // Find src="..." and href="..." values that point to our own files.
  const found = new Set();
  const regex = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], self.location);
      if (url.origin === self.location.origin) found.add(url.href);
    } catch (e) {
      // Ignore invalid URLs.
    }
  }

  await Promise.all(
    Array.from(found).map((href) =>
      fetch(href)
        .then((res) => (res.ok ? cache.put(href, res) : null))
        .catch(() => null)
    )
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('travelercom-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests to our own origin.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const indexUrl = new URL('./index.html', self.location).href;

  // Page navigations: try network first, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(indexUrl, copy));
          return response;
        })
        .catch(() => caches.match(indexUrl))
    );
    return;
  }

  // Static files (JS, CSS, images, fonts): serve from cache first, update in background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
