// Bump CACHE whenever you deploy so iPhones drop the old app shell.
// Clearing caches never touches localStorage, so your denim data is safe.
const CACHE = 'denim-v40';

self.addEventListener('install', e => {
  // The app page is required; icons/manifest are optional so a missing file can't block updates.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html'])
    .then(() => Promise.all(['./icon-180.png', './icon-512.png', './manifest.json', './fonts/Phosphor.woff2', './fonts/Phosphor-Fill.woff2', './fonts/BarlowCondensed-500.woff2', './fonts/BarlowCondensed-600.woff2', './fonts/BarlowCondensed-700.woff2', './fonts/JetBrainsMono-400.woff2'].map(u => c.add(u).catch(() => {}))))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // App page: network first (revalidating past GitHub Pages' 10-min HTTP cache) so updates arrive; cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Fonts, icons, manifest: serve from cache, refresh in background.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit || Response.error());
      return hit || net;
    })
  );
});
