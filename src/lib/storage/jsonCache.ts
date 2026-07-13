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

export function compactDuplicatePhotoSourcesInLocalStorage() {
  if (typeof window === "undefined") {
    return { compactedKeys: 0, releasedCharacters: 0 };
  }

  let compactedKeys = 0;
  let releasedCharacters = 0;
  const keys = Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index),
  ).filter((key): key is string => Boolean(key));

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw || !raw.includes('"src"')) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const changed = compactDuplicatePhotoSources(parsed);
      if (!changed) {
        continue;
      }

      const nextRaw = JSON.stringify(parsed);
      if (nextRaw.length >= raw.length) {
        continue;
      }

      window.localStorage.setItem(key, nextRaw);
      jsonCache.delete(key);
      compactedKeys += 1;
      releasedCharacters += raw.length - nextRaw.length;
    } catch {
      // Keep every original value when parsing or replacement is unavailable.
    }
  }

  return { compactedKeys, releasedCharacters };
}

function compactDuplicatePhotoSources(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object" || depth > 12) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.reduce(
      (changed, item) =>
        compactDuplicatePhotoSources(item, depth + 1) || changed,
      false,
    );
  }

  const record = value as Record<string, unknown>;
  const src = record.src;
  let changed = false;

  if (typeof src === "string") {
    for (const key of ["thumbnailSrc", "displaySrc", "originalSrc"] as const) {
      if (record[key] === src) {
        delete record[key];
        changed = true;
      }
    }
  }

  for (const item of Object.values(record)) {
    changed = compactDuplicatePhotoSources(item, depth + 1) || changed;
  }

  return changed;
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
