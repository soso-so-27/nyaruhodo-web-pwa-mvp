import { STORAGE_KEYS } from "../storage";
import type { OwnSleepingPhoto } from "./sleepingPhotos";

export async function backupOwnSleepingPhotoMoment(photo: OwnSleepingPhoto) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/sleeping-delivery/backup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        anonymousId: getOrCreateAnonymousId(),
        photo,
      }),
    });
  } catch {
    // Remote backup must never block the local sleeping-photo flow.
  }
}

function getOrCreateAnonymousId() {
  const existing = window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId);

  if (existing) {
    return existing;
  }

  const nextId = createId();
  window.localStorage.setItem(STORAGE_KEYS.analyticsAnonymousId, nextId);
  return nextId;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
