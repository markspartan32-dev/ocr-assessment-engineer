/*
 * DataCommand service worker: offline-first app shell.
 *
 * - install:  precache every route's HTML plus the hashed /_next/static assets each page references
 *             (all or nothing: a failed fetch abandons the update and keeps the previous worker).
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

/**
 * All-or-nothing precache: everything is fetched before anything is written, and any failure
 * rejects the install. On a flaky connection the update is then abandoned, and the previous
 * worker keeps serving its complete caches instead of activating with holes in them.
 */
async function precache() {
  const assets = new Set(STATIC_FILES);
  const pages = await Promise.all(
    ROUTES.map(async (route) => {
      const response = await fetch(route, { credentials: "same-origin", cache: "no-cache" });
      if (!response.ok) throw new Error(`precache ${route}: HTTP ${response.status}`);
      const html = await response.clone().text();
      for (const match of html.matchAll(ASSET_PATTERN)) assets.add(match[1].replace(/&amp;/g, "&"));
      return [route, response];
    }),
  );
  const files = await Promise.all(
    [...assets].map(async (url) => {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`precache ${url}: HTTP ${response.status}`);
      return [url, response];
    }),
  );
  const [pageCache, assetCache] = await Promise.all([caches.open(PAGES), caches.open(ASSETS)]);
  await Promise.all([...pages.map(([url, r]) => pageCache.put(url, r)), ...files.map(([url, r]) => assetCache.put(url, r))]);
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
