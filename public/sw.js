const CACHE_VERSION = "2026-06-28-01";
const STATIC_CACHE = `neteruneko-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `neteruneko-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/favicon.ico",
  "/icon-envelope-v2-192.png",
  "/icon-envelope-v2-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (shouldNeverCache(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function shouldNeverCache(request, url) {
  if (url.pathname.startsWith("/api/")) {
    return true;
  }

  if (url.pathname.includes("/storage/v1/object/sign/")) {
    return true;
  }

  if (url.searchParams.has("token")) {
    return true;
  }

  if (request.headers.has("authorization")) {
    return true;
  }

  return false;
}

function isStaticAsset(request, url) {
  if (url.origin !== self.location.origin) {
    return false;
  }

  return (
    url.pathname.startsWith("/_next/static/") ||
    ["style", "script", "font"].includes(request.destination) ||
    (request.destination === "image" && isPublicAppAsset(url.pathname))
  );
}

function isPublicAppAsset(pathname) {
  return (
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/fonts/")
  );
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cachedOffline = await caches.match(OFFLINE_URL);

    return (
      cachedOffline ??
      new Response("offline", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cached ?? (await fresh) ?? Response.error();
}
