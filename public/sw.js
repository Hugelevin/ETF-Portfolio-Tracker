// Vite replaces these markers with this release's fingerprint and full asset list.
const BUILD_VERSION = "__BUILD_VERSION__";
const BUILD_ASSETS = "__BUILD_ASSETS__";
const scopeUrl = new URL("./", self.registration.scope).href;
const CACHE_PREFIX = `etf-portfolio:${new URL(scopeUrl).pathname}:`;
const CACHE = `${CACHE_PREFIX}${BUILD_VERSION}`;
const COMPLETE = new URL("__precache_complete__", scopeUrl).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const urls = [scopeUrl, ...BUILD_ASSETS.map((asset) => new URL(asset, scopeUrl).href)];
    // Failed installation leaves the previous worker active.
    try {
      await cache.addAll(urls.map((url) => new Request(url, { cache: "reload" })));
      await cache.put(COMPLETE, new Response("complete"));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const previous = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE);
    const complete = [];
    for (const key of previous) {
      if (await (await caches.open(key)).match(COMPLETE)) complete.push(key);
    }
    // Keep the last fully installed build, not an abandoned install's empty cache.
    // Never delete another app's cache.
    await Promise.all(previous.filter((key) => key !== complete.at(-1)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5_000) });
    if (response.ok) return response;
    return await cache.match(scopeUrl) ?? response;
  } catch {
    return await cache.match(scopeUrl) ?? new Response("Offline. Connect once to download the application.", { status: 503 });
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  // These are public, build-versioned static files, independent of Origin.
  // Module/style requests may send Origin where precache requests did not.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const url = new URL(request.url);
  if (url.pathname.startsWith(new URL("assets/", scopeUrl).pathname)) {
    for (const key of await caches.keys()) {
      if (!key.startsWith(CACHE_PREFIX) || key === CACHE) continue;
      const previous = await (await caches.open(key)).match(request, { ignoreVary: true });
      if (previous) return previous;
    }
  }
  // No unbounded runtime cache. All current static assets are precached.
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(scopeUrl)) return;
  event.respondWith(request.mode === "navigate" ? navigation(request) : asset(request));
});
