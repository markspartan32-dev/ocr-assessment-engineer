/*
 * DataCommand service worker: offline-first app shell.
 *
 * - install:  precache every route's HTML plus the hashed /_next/static assets each page references.
 * - fetch:    pages are network-first, with the cached copy used when offline;
 *             /_next/static is cache-first (content-hashed, so it never changes);
 *             other same-origin GETs (RSC payloads, icons) are network-first with a cache fallback.
 * - activate: delete caches from older builds.
 *
 * Progress itself never touches the network: it lives in IndexedDB via localForage.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
// Pages and other responses live in separate caches, so an offline page fallback can never
// return an RSC payload that shares the page's path.
const PAGES = `datacommand-${VERSION}-pages`;
const ASSETS = `datacommand-${VERSION}-assets`;
const UNITS = ["F200", "F201", "F202", "F203", "F204", "F205", "F206"];
const ROUTES = [
  "/", "/review", "/exam", "/units", "/analytics", "/settings",
  ...UNITS.flatMap((u) => [`/review/${u}`, `/exam/${u}`, `/units/${u}`]),
];
const STATIC_FILES = ["/manifest.json", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"];
const ASSET_PATTERN = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

async function precache() {
  const pages = await caches.open(PAGES);
  const assetCache = await caches.open(ASSETS);
  await assetCache.addAll(STATIC_FILES).catch(() => undefined);
  const assets = new Set();
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const response = await fetch(route, { credentials: "same-origin" });
        if (!response.ok) return;
        const html = await response.clone().text();
        for (const match of html.matchAll(ASSET_PATTERN)) assets.add(match[1].replace(/&amp;/g, "&"));
        await pages.put(route, response);
      } catch {
        // A route that fails to precache is cached later at runtime.
      }
    }),
  );
  await Promise.all([...assets].map((url) => assetCache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("datacommand-") && k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, { fallbackUrl, ignoreSearch = false } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (ignoreSearch ? await cache.match(request, { ignoreSearch: true }) : undefined);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, { fallbackUrl: "/", ignoreSearch: true }));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (!url.pathname.startsWith("/_next/webpack-hmr")) {
    event.respondWith(networkFirst(request, ASSETS));
  }
});
