import type { SupabaseClient } from "@supabase/supabase-js";

import { toStoragePhotoUrl } from "./photoStorage";

const MAX_STORAGE_PATH_LENGTH = 512;
const MAX_ANONYMOUS_ID_LENGTH = 160;

export function isSafeStoragePath(path: string) {
  return (
    Boolean(path) &&
    path.length <= MAX_STORAGE_PATH_LENGTH &&
    !path.includes("\\") &&
    path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

export function isOwnStoragePath(path: string, userId: string) {
  return path.split("/")[0] === userId;
}

export function normalizeAnonymousId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const anonymousId = value.trim();
  if (!anonymousId || anonymousId.length > MAX_ANONYMOUS_ID_LENGTH) {
    return null;
  }

  return anonymousId;
}

export function getStoragePhotoUrlVariants(path: string) {
  return [toStoragePhotoUrl(path), `storage://${path}`];
}

export async function isAuthorizedStoragePhotoPath({
  storagePath,
  userId,
  anonymousId,
  hasDeliveredPhoto,
}: {
  storagePath: string;
  userId: string;
  anonymousId: string | null;
  hasDeliveredPhoto: (
    photoUrlVariants: string[],
    userId: string,
    anonymousId: string | null,
  ) => Promise<boolean>;
}) {
  if (!isSafeStoragePath(storagePath)) {
    return false;
  }

  if (isOwnStoragePath(storagePath, userId)) {
    return true;
  }

  return hasDeliveredPhoto(
    getStoragePhotoUrlVariants(storagePath),
    userId,
    anonymousId,
  );
}

export async function hasDeliveredStoragePhoto({
  supabase,
  photoUrlVariants,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  photoUrlVariants: string[];
  userId: string;
  anonymousId: string | null;
}) {
  if (
    userId &&
    await hasDeliveredStoragePhotoForUser({
      supabase,
      photoUrlVariants,
      userId,
    })
  ) {
    return true;
  }

  if (!anonymousId) {
    return false;
  }

  const { data, error } = await supabase
    .from("cat_moment_deliveries")
    .select("id")
    .is("user_id", null)
    .eq("anonymous_id", anonymousId)
    .in("photo_url", photoUrlVariants)
    .limit(1);

  return !error && Array.isArray(data) && data.length > 0;
}

async function hasDeliveredStoragePhotoForUser({
  supabase,
  photoUrlVariants,
  userId,
}: {
  supabase: SupabaseClient;
  photoUrlVariants: string[];
  userId: string;
}) {
  const { data, error } = await supabase
    .from("cat_moment_deliveries")
    .select("id")
    .eq("user_id", userId)
    .in("photo_url", photoUrlVariants)
    .limit(1);

  return !error && Array.isArray(data) && data.length > 0;
}
