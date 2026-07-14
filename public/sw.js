const CACHE = "etf-portfolio-shell-v3";
const scopeUrl = new URL("./", self.registration.scope).href;
const shellAssets = [
  scopeUrl,
  "logo.svg", "favicon.svg", "manifest.webmanifest", "robots.txt", "llms.txt", "apple-touch-icon.png",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png",
  "brands/axa.svg", "brands/state-street.svg", "brands/ubs.svg", "brands/vaneck.svg", "brands/vanguard.svg",
].map((asset) => new URL(asset, scopeUrl).href);

async function precacheShell() {
  const cache = await caches.open(CACHE);
  const page = await fetch(scopeUrl, { cache: "reload" });
  if (!page.ok) throw new Error("Unable to cache application shell");
  const html = await page.clone().text();
  await cache.put(scopeUrl, page);
  const linkedAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], scopeUrl))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
  await cache.addAll([...new Set([...shellAssets.slice(1), ...linkedAssets])]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(scopeUrl, copy));
      return response;
    }).catch(() => caches.match(scopeUrl)));
    return;
  }

  event.respondWith(caches.match(url.href, { ignoreVary: true }).then((cached) => {
    if (cached) {
      event.waitUntil(fetch(request).then((response) => {
        if (response.ok) return caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      }).catch(() => undefined));
      return cached;
    }
    return fetch(request).then((response) => {
      if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    });
  }));
});
