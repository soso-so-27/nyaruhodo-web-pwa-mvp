import { createBrowserSupabaseClient } from "./supabase/browser";

export const CAT_PHOTOS_BUCKET = "cat-photos";
const STORAGE_PHOTO_PREFIX = "storage:";
const LEGACY_STORAGE_PHOTO_PREFIX = "storage://";
const DISPLAY_SIGNED_URL_SECONDS = 60 * 60 * 24;

type BrowserSupabaseClient = NonNullable<
  ReturnType<typeof createBrowserSupabaseClient>
>;

export function toStoragePhotoUrl(path: string) {
  return `${STORAGE_PHOTO_PREFIX}${path}`;
}

export function getStoragePhotoPath(value: string) {
  if (value.startsWith(LEGACY_STORAGE_PHOTO_PREFIX)) {
    return value.slice(LEGACY_STORAGE_PHOTO_PREFIX.length);
  }

  return value.startsWith(STORAGE_PHOTO_PREFIX)
    ? value.slice(STORAGE_PHOTO_PREFIX.length)
    : null;
}

export function getStoragePhotoPathFromUrl(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const objectIndex = segments.findIndex(
      (segment, index) =>
        segment === "object" &&
        segments[index - 1] === "v1" &&
        segments[index - 2] === "storage",
    );

    if (objectIndex < 0) {
      return null;
    }

    const bucketIndex = objectIndex + 2;
    const bucket = segments[bucketIndex];
    const pathSegments = segments.slice(bucketIndex + 1);

    if (bucket !== CAT_PHOTOS_BUCKET || pathSegments.length === 0) {
      return null;
    }

    return pathSegments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return null;
  }
}

export function isLikelySignedPhotoUrl(value: string) {
  try {
    const url = new URL(value);
    const signedParams = [
      "token",
      "expires",
      "expires_at",
      "expiresAt",
      "signature",
      "X-Amz-Signature",
      "X-Amz-Expires",
    ];

    return (
      url.pathname.includes("/storage/v1/object/sign/") ||
      signedParams.some((param) => url.searchParams.has(param))
    );
  } catch {
    return false;
  }
}

export function normalizePersistentPhotoSrc(value: string) {
  const src = value.trim();
  const storagePath = getStoragePhotoPath(src);

  if (storagePath !== null) {
    return storagePath.length > 0 ? toStoragePhotoUrl(storagePath) : null;
  }

  if (src.startsWith("data:image/")) {
    return src;
  }

  const urlStoragePath = getStoragePhotoPathFromUrl(src);
  if (urlStoragePath) {
    return toStoragePhotoUrl(urlStoragePath);
  }

  if (isLikelySignedPhotoUrl(src)) {
    return null;
  }

  return src;
}

export function isUsablePhotoSrc(value: string) {
  const src = value.trim();

  if (!src) {
    return false;
  }

  const storagePath = getStoragePhotoPath(src);
  if (storagePath !== null) {
    return storagePath.length > 0;
  }

  if (src.startsWith("http://") || src.startsWith("https://")) {
    return true;
  }

  if (!src.startsWith("data:image/")) {
    return false;
  }

  return /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(src) &&
    src.length >= 200;
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

export async function createSignedStorageUrl(
  supabase: BrowserSupabaseClient,
  path: string,
) {
  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .createSignedUrl(path, DISPLAY_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return undefined;
  }

  return data.signedUrl;
}

export async function uploadDataUrl(
  supabase: BrowserSupabaseClient,
  path: string,
  dataUrl: string,
) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return uploadBlob(supabase, path, blob, blob.type || "image/jpeg");
}

export async function uploadBlob(
  supabase: BrowserSupabaseClient,
  path: string,
  blob: Blob,
  contentType?: string,
) {
  const { error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      contentType: contentType || blob.type || "image/jpeg",
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
