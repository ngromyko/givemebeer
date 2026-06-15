const CACHE_NAME = "pivo-nesi-v20260615-webp-5";
const CORE_ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "favicon.ico",
  "favicon.png",
  "favicon-192.png",
  "assets/wings.png",
  "assets/obstacle-top.png",
  "assets/obstacle-bottom.png",
  "assets/bg-church.webp",
  "assets/bg-culture.webp",
  "assets/bg-mayor.webp",
  "assets/bg-reservoir.webp",
  "assets/bg-zarechno-station.webp",
  "assets/bg-zarechno-rail.webp",
  "assets/bg-station.webp",
  "assets/bg-entry.webp",
  "assets/bg-center-church.webp",
  "assets/bg-orthodox.webp",
  "assets/bg-memorial.webp",
  "assets/bg-mound-glory.webp",
  "assets/bg-school.webp",
  "assets/bg-rodina.webp",
  "assets/bg-aerial.webp",
  "assets/bg-stadium-victoria.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
