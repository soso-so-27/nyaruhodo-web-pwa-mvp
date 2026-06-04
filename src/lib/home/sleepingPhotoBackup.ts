import { STORAGE_KEYS } from "../storage";
import { createBrowserSupabaseClient } from "../supabase/browser";
import {
  ownSleepingPhotoToCatMoment,
  toCatMomentRecord,
  type OwnSleepingPhoto,
} from "./sleepingPhotos";
import {
  getDataUrlExtension,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../photoStorage";

export async function backupOwnSleepingPhotoMoment(photo: OwnSleepingPhoto) {
  if (typeof window === "undefined") {
    return;
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return;
  }

  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    const anonymousId = userId ? null : getOrCreateAnonymousId();
    const moment = ownSleepingPhotoToCatMoment(photo);
    const record = toCatMomentRecord(moment);
    const keepInlineForDelivery =
      photo.shared || record.visibility === "shared";
    const photoUrl =
      !keepInlineForDelivery && userId && record.photo_url.startsWith("data:")
        ? toStoragePhotoUrl(
            await uploadDataUrl(
              supabase,
              `${userId}/${sanitizePathSegment(photo.ownerCatId)}/sleeping/${sanitizePathSegment(
                record.id,
              )}.${getDataUrlExtension(record.photo_url)}`,
              record.photo_url,
            ),
          )
        : record.photo_url;

    const row = {
      user_id: userId,
      anonymous_id: anonymousId,
      local_moment_id: record.id,
      local_cat_id: photo.catId,
      owner_cat_id: record.owner_cat_id,
      photo_url: photoUrl,
      state: record.state,
      visibility: record.visibility,
      delivery_status: record.delivery_status,
      source_moment_id: record.source_moment_id,
      metadata: {
        trigger_label: photo.triggerLabel,
        theme: photo.theme,
      },
      captured_at: record.created_at,
      created_at: record.created_at,
    };

    if (userId) {
      await supabase
        .from("cat_moments")
        .delete()
        .eq("user_id", userId)
        .eq("local_moment_id", record.id);
    }

    await supabase.from("cat_moments").insert(row);
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
