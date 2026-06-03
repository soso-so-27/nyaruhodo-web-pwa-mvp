import { createBrowserSupabaseClient } from "./supabase/browser";

export const CAT_PHOTOS_BUCKET = "cat-photos";
const STORAGE_PHOTO_PREFIX = "storage:";

type BrowserSupabaseClient = NonNullable<
  ReturnType<typeof createBrowserSupabaseClient>
>;

export function toStoragePhotoUrl(path: string) {
  return `${STORAGE_PHOTO_PREFIX}${path}`;
}

export function getStoragePhotoPath(value: string) {
  return value.startsWith(STORAGE_PHOTO_PREFIX)
    ? value.slice(STORAGE_PHOTO_PREFIX.length)
    : null;
}

export async function resolveStoredPhotoUrl(
  supabase: BrowserSupabaseClient,
  value: string,
) {
  const storagePath = getStoragePhotoPath(value);

  if (!storagePath) {
    return value;
  }

  return downloadStoragePath(supabase, storagePath);
}

export async function uploadDataUrl(
  supabase: BrowserSupabaseClient,
  path: string,
  dataUrl: string,
) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`Photo upload failed: ${error.message}`);
  }

  return path;
}

export async function downloadStoragePath(
  supabase: BrowserSupabaseClient,
  path: string,
) {
  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .download(path);

  if (error || !data) {
    return undefined;
  }

  return blobToDataUrl(data);
}

export function getDataUrlExtension(dataUrl: string) {
  const mime = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);/)?.[1];

  if (mime === "image/png") {
    return "png";
  }

  if (mime === "image/webp") {
    return "webp";
  }

  return "jpg";
}

export function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "item";
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
