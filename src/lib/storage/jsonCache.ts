type CachedJsonValue = {
  raw: string | null;
  value: unknown;
};

const jsonCache = new Map<string, CachedJsonValue>();
let hasStorageListener = false;

export function readCachedJson<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  ensureStorageListener();

  const raw = window.localStorage.getItem(key);
  const cached = jsonCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.value as T;
  }

  if (raw === null || raw === "") {
    jsonCache.set(key, { raw, value: null });
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as T;
    jsonCache.set(key, { raw, value: parsed });
    return parsed;
  } catch {
    jsonCache.delete(key);
    return null;
  }
}

export function writeCachedJson(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  const raw = JSON.stringify(value);
  window.localStorage.setItem(key, raw);
  jsonCache.set(key, { raw, value });
}

export function removeCachedJson(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
  jsonCache.delete(key);
}

export function invalidateCachedJson(key?: string | null) {
  if (key) {
    jsonCache.delete(key);
    return;
  }

  jsonCache.clear();
}

function ensureStorageListener() {
  if (hasStorageListener || typeof window === "undefined") {
    return;
  }

  hasStorageListener = true;
  window.addEventListener("storage", (event) => {
    if (event.key) {
      jsonCache.delete(event.key);
    } else {
      jsonCache.clear();
    }
  });
}
