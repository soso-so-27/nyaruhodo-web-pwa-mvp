import { STORAGE_KEYS } from "../storage/keys";

export function readAnonymousId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId);
}

export function getOrCreateAnonymousId() {
  const existing = readAnonymousId();
  if (existing) {
    return existing;
  }

  const nextId = createAnonymousId();
  window.localStorage.setItem(STORAGE_KEYS.analyticsAnonymousId, nextId);
  return nextId;
}

function createAnonymousId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
