// Bump VERSION on every upload so phones fetch the new app.
const VERSION = "gt-2.11";
const CORE = ["./", "index.html", "manifest.json", "icon-180.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App page: network first so updates arrive; fall back to cache after 3 s or when offline,
  // so weak gym signal doesn't stall launch.
  if (req.mode === "navigate") {
    // Skip the browser's HTTP cache (GitHub Pages holds pages ~10 min) so a new upload shows on next launch.
    const fetched = fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
    // Keep the worker alive until the fresh page is stored (copy taken before the page is handed over).
    e.waitUntil(fetched.then(res => {
      if (res.ok) { const copy = res.clone(); return caches.open(VERSION).then(c => c.put("index.html", copy)); }
    }).catch(() => {}));
    const cached = () => caches.match("index.html");
    // A server error (e.g. GitHub Pages 404/5xx) falls back to the cached app instead of an error page.
    const net = fetched.then(res => res.ok ? res : cached().then(c => c || res));
    const slow = new Promise(r => setTimeout(r, 3000)).then(cached);
    e.respondWith(
      Promise.race([net.catch(cached), slow.then(c => c || net)])
        .then(r => r || net)
        // Offline with nothing cached (e.g. iOS cleared storage): a readable message instead of a failed load.
        .catch(() => new Response("GymTracker is offline and not cached yet. Open it once with signal.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }))
    );
    return;
  }

  // Everything else (icons, fonts, React from unpkg): cache first.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
