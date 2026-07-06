const CACHE_VERSION = "2026-06-28-01";
const STATIC_CACHE = `neteruneko-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `neteruneko-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";
const PHOTO_IMAGE_CACHE = "neteruneko-photo-images-v1";
const PHOTO_IMAGE_META_CACHE = "neteruneko-photo-image-meta-v1";
const PHOTO_CACHE_CONFIG_PATH = "/__sw-photo-cache/config";
const PHOTO_CACHE_VARIANT_PARAMS = [
  "width",
  "height",
  "quality",
  "resize",
  "format",
];
const CAT_PHOTOS_BUCKET = "cat-photos";
const STORAGE_SIGNED_OBJECT_MARKER = `/storage/v1/object/sign/${CAT_PHOTOS_BUCKET}/`;
const STORAGE_SIGNED_RENDER_MARKER = `/storage/v1/render/image/sign/${CAT_PHOTOS_BUCKET}/`;

let photoImageCacheEnabled = null;
let photoImageCacheEnabledPromise = null;

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

self.addEventListener("message", (event) => {
  const data = event.data;

  if (!data || typeof data !== "object") {
    return;
  }

  if (data.type === "NN_PHOTO_CACHE_CONFIG") {
    const enabled = data.enabled === true;
    event.waitUntil(writePhotoCacheConfig(enabled));
  }
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

async function readPhotoCacheEnabled() {
  if (typeof photoImageCacheEnabled === "boolean") {
    return photoImageCacheEnabled;
  }

  if (!photoImageCacheEnabledPromise) {
    photoImageCacheEnabledPromise = caches
      .open(PHOTO_IMAGE_META_CACHE)
      .then((cache) => cache.match(createPhotoCacheRequest(PHOTO_CACHE_CONFIG_PATH)))
      .then(async (response) => {
        if (!response) {
          return false;
        }

        const config = await response.json().catch(() => null);

        return config?.enabled === true;
      })
      .catch(() => false)
      .then((enabled) => {
        photoImageCacheEnabled = enabled;
        photoImageCacheEnabledPromise = null;
        return enabled;
      });
  }

  return photoImageCacheEnabledPromise;
}

async function writePhotoCacheConfig(enabled) {
  photoImageCacheEnabled = enabled;
  photoImageCacheEnabledPromise = null;
  const cache = await caches.open(PHOTO_IMAGE_META_CACHE);
  await cache.put(
    createPhotoCacheRequest(PHOTO_CACHE_CONFIG_PATH),
    jsonResponse({
      enabled,
      updatedAt: Date.now(),
    }),
  );
}

function createPhotoImageCacheInfo(request, url) {
  if (request.method !== "GET" || request.headers.has("authorization")) {
    return null;
  }

  const objectPath = getSignedPhotoObjectPath(url);

  if (!objectPath) {
    return null;
  }

  const variantKey = getPhotoVariantKey(url);
  const logicalKey = `cat-photo:${variantKey}:${objectPath}`;

  return {
    logicalKey,
    objectPath,
    variantKey,
  };
}

function getSignedPhotoObjectPath(url) {
  const pathname = url.pathname;
  const marker = pathname.includes(STORAGE_SIGNED_RENDER_MARKER)
    ? STORAGE_SIGNED_RENDER_MARKER
    : pathname.includes(STORAGE_SIGNED_OBJECT_MARKER)
      ? STORAGE_SIGNED_OBJECT_MARKER
      : null;

  if (!marker) {
    return null;
  }

  const encodedPath = pathname.slice(pathname.indexOf(marker) + marker.length);

  if (!encodedPath) {
    return null;
  }

  try {
    return encodedPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

function getPhotoVariantKey(url) {
  const values = PHOTO_CACHE_VARIANT_PARAMS.flatMap((name) => {
    const value = url.searchParams.get(name);
    return value ? [`${name}:${sanitizePhotoVariantValue(value)}`] : [];
  });

  return values.length > 0 ? values.join("|") : "plain";
}

function sanitizePhotoVariantValue(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32);
}

function createPhotoCacheRequest(path) {
  return new Request(`${self.location.origin}${path}`);
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
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
