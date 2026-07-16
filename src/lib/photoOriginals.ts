"use client";

import { trackProductEvent } from "./analytics/productAnalytics";
import { isAnonymousSupabaseUser } from "./auth/anonymousAuth";
import {
  getStableImageFileForPersistence,
  readImageFileDimensions,
} from "./imageResize";
import { assertSupportedImageFile } from "./imageFileValidation";
import {
  getStoragePhotoPath,
  sanitizePathSegment,
  uploadBlob,
} from "./photoStorage";
import { createBrowserSupabaseClient } from "./supabase/browser";

const ORIGINAL_QUEUE_DB_NAME = "neteruneko-photo-originals";
const ORIGINAL_QUEUE_DB_VERSION = 1;
const ORIGINAL_QUEUE_STORE = "pending-originals";
const MAX_FLUSH_ITEMS = 8;

export const ORIGINAL_PHOTO_PRESERVATION_FAILED_EVENT =
  "neteruneko_original_photo_preservation_failed";

export const ORIGINAL_PHOTO_SOURCE_SURFACES = [
  "sleeping",
  "onboarding",
  "cat_gallery",
  "collection",
  "cover",
  "home_cover",
] as const;

export type OriginalPhotoSourceSurface =
  (typeof ORIGINAL_PHOTO_SOURCE_SURFACES)[number];

type PendingOriginalPhoto = {
  key: string;
  bytes?: ArrayBuffer;
  blob?: Blob;
  catId: string | null;
  displaySrc: string | null;
  fileName: string;
  lastModified: number | null;
  localAssetId: string;
  mimeType: string;
  ownerUserId: string | null;
  queuedAt: number;
  sourceSurface: OriginalPhotoSourceSurface;
};

export type QueueOriginalPhotoInput = {
  file: File;
  localAssetId: string;
  sourceSurface: OriginalPhotoSourceSurface;
  displaySrc?: string | null;
  catId?: string | null;
};

let flushPromise: Promise<void> | null = null;

export async function queueOriginalPhotoPreservation({
  file,
  localAssetId,
  sourceSurface,
  displaySrc = null,
  catId = null,
}: QueueOriginalPhotoInput) {
  const stableFile = getStableImageFileForPersistence(file);
  assertSupportedImageFile(stableFile);
  const mimeType = resolveOriginalContentType(stableFile.type, stableFile.name);
  // WebKit can reject File instances backed by a transient file picker when
  // IndexedDB performs its structured clone. A full Blob slice keeps the
  // original bytes while removing that picker-backed File wrapper.
  const stableBlob = stableFile.slice(0, stableFile.size, mimeType);
  let stableBytes: ArrayBuffer;
  try {
    stableBytes = await readOriginalBlobBytes(stableBlob);
  } catch (error) {
    const queueErrorCode = getOriginalQueueErrorCode(error);
    trackProductEvent("photo_original_queued", {
      source_surface: sourceSurface,
      queued_locally: false,
      queue_error_code: queueErrorCode,
      file_size_bucket: getOriginalFileSizeBucket(stableBlob.size),
    });
    console.warn(
      `[photo-originals] Original byte copy failed: ${queueErrorCode}`,
      error,
    );
    notifyOriginalPhotoQueueFailure("failed", sourceSurface);
    return "failed";
  }

  const pending: PendingOriginalPhoto = {
    key: buildOriginalPhotoQueueKey(sourceSurface, localAssetId),
    bytes: stableBytes,
    catId,
    displaySrc,
    fileName: stableFile.name || `${sourceSurface}.jpg`,
    lastModified: Number.isFinite(stableFile.lastModified)
      ? stableFile.lastModified
      : null,
    localAssetId,
    mimeType,
    ownerUserId: null,
    queuedAt: Date.now(),
    sourceSurface,
  };

  let queueErrorCode: string | null = null;
  const queued = await putPendingOriginalPhoto(pending).then(
    () => true,
    (error: unknown) => {
      queueErrorCode = getOriginalQueueErrorCode(error);
      console.warn(
        `[photo-originals] IndexedDB queue failed: ${queueErrorCode}`,
        error,
      );
      return false;
    },
  );

  trackProductEvent("photo_original_queued", {
    source_surface: sourceSurface,
    queued_locally: queued,
    queue_error_code: queueErrorCode,
    file_size_bucket: getOriginalFileSizeBucket(stableBlob.size),
  });

  const ownerUserId = await readSignedInOwnerUserId();
  if (ownerUserId) {
    const claimed = { ...pending, ownerUserId };
    if (queued) {
      await putPendingOriginalPhoto(claimed).catch(() => undefined);
    }
    const uploaded = await uploadPendingOriginalPhoto(claimed, ownerUserId);
    if (uploaded && queued) {
      await deletePendingOriginalPhoto(pending.key).catch(() => undefined);
    }
    const result = uploaded ? "preserved" : queued ? "queued" : "failed";
    notifyOriginalPhotoQueueFailure(result, sourceSurface);
    return result;
  }

  const result = queued ? "queued" : "failed";
  notifyOriginalPhotoQueueFailure(result, sourceSurface);
  return result;
}

function notifyOriginalPhotoQueueFailure(
  result: "preserved" | "queued" | "failed",
  sourceSurface: OriginalPhotoSourceSurface,
) {
  if (result !== "failed" || typeof window === "undefined") {
    return;
  }

  trackProductEvent("photo_original_queue_failed", {
    source_surface: sourceSurface,
  });
  window.dispatchEvent(
    new CustomEvent(ORIGINAL_PHOTO_PRESERVATION_FAILED_EVENT, {
      detail: { sourceSurface },
    }),
  );
}

export function startOriginalPhotoPreservationQueue() {
  const flush = () => {
    void flushOriginalPhotoPreservationQueue();
  };

  flush();
  window.addEventListener("online", flush);
  const retryTimer = window.setInterval(flush, 60_000);

  const supabase = createBrowserSupabaseClient();
  const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
    if (session?.user && !isAnonymousSupabaseUser(session.user)) {
      window.setTimeout(flush, 0);
    }
  });

  return () => {
    window.removeEventListener("online", flush);
    window.clearInterval(retryTimer);
    authListener?.data.subscription.unsubscribe();
  };
}

export async function flushOriginalPhotoPreservationQueue() {
  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = flushPendingOriginalPhotos().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

async function flushPendingOriginalPhotos() {
  const ownerUserId = await readSignedInOwnerUserId();
  if (!ownerUserId) {
    return;
  }

  const pendingPhotos = await readPendingOriginalPhotos().catch(() => []);

  for (const pending of pendingPhotos.slice(0, MAX_FLUSH_ITEMS)) {
    if (pending.ownerUserId && pending.ownerUserId !== ownerUserId) {
      continue;
    }

    const claimed = pending.ownerUserId
      ? pending
      : { ...pending, ownerUserId };
    if (!pending.ownerUserId) {
      await putPendingOriginalPhoto(claimed).catch(() => undefined);
    }

    if (await uploadPendingOriginalPhoto(claimed, ownerUserId)) {
      await deletePendingOriginalPhoto(claimed.key).catch(() => undefined);
    }
  }
}

async function uploadPendingOriginalPhoto(
  pending: PendingOriginalPhoto,
  ownerUserId: string,
) {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return false;
  }

  const originalBlob = getPendingOriginalBlob(pending);
  if (!originalBlob) {
    trackOriginalPreservationFailure(pending, "invalid_queued_payload");
    return false;
  }

  const originalStoragePath = buildOriginalPhotoStoragePath({
    fileName: pending.fileName,
    localAssetId: pending.localAssetId,
    ownerUserId,
    queuedAt: pending.queuedAt,
    sourceSurface: pending.sourceSurface,
    mimeType: pending.mimeType,
  });
  const dimensions = await readImageFileDimensions(originalBlob).catch(() => null);
  const row = {
    user_id: ownerUserId,
    local_asset_id: pending.localAssetId,
    source_surface: pending.sourceSurface,
    cat_id: pending.catId,
    display_storage_path: pending.displaySrc
      ? getStoragePhotoPath(pending.displaySrc)
      : null,
    original_storage_path: originalStoragePath,
    original_file_name: pending.fileName,
    original_mime_type: pending.mimeType,
    original_bytes: originalBlob.size,
    pixel_width: dimensions?.width ?? null,
    pixel_height: dimensions?.height ?? null,
    file_last_modified_at: pending.lastModified
      ? new Date(pending.lastModified).toISOString()
      : null,
    captured_at: new Date(pending.queuedAt).toISOString(),
    status: "pending",
    last_error: null,
  };
  const { error: rowError } = await supabase
    .from("photo_assets")
    .upsert(row, {
      onConflict: "user_id,source_surface,local_asset_id",
    });

  if (rowError) {
    trackOriginalPreservationFailure(pending, "metadata_upsert_failed");
    return false;
  }

  try {
    await uploadBlob(
      supabase,
      originalStoragePath,
      originalBlob,
      pending.mimeType,
    );
  } catch {
    await markOriginalPhotoFailed({
      localAssetId: pending.localAssetId,
      ownerUserId,
      sourceSurface: pending.sourceSurface,
      errorCode: "storage_upload_failed",
    });
    trackOriginalPreservationFailure(pending, "storage_upload_failed");
    return false;
  }

  const { error: readyError } = await supabase
    .from("photo_assets")
    .update({ status: "ready", last_error: null })
    .eq("user_id", ownerUserId)
    .eq("source_surface", pending.sourceSurface)
    .eq("local_asset_id", pending.localAssetId);

  if (readyError) {
    trackOriginalPreservationFailure(pending, "metadata_ready_failed");
    return false;
  }

  trackProductEvent("photo_original_preserved", {
    source_surface: pending.sourceSurface,
    file_size_bucket: getOriginalFileSizeBucket(originalBlob.size),
    pixel_width: dimensions?.width ?? null,
    pixel_height: dimensions?.height ?? null,
  });
  return true;
}

async function markOriginalPhotoFailed({
  localAssetId,
  ownerUserId,
  sourceSurface,
  errorCode,
}: {
  localAssetId: string;
  ownerUserId: string;
  sourceSurface: OriginalPhotoSourceSurface;
  errorCode: string;
}) {
  const supabase = createBrowserSupabaseClient();
  await supabase
    ?.from("photo_assets")
    .update({ status: "failed", last_error: errorCode })
    .eq("user_id", ownerUserId)
    .eq("source_surface", sourceSurface)
    .eq("local_asset_id", localAssetId);
}

async function readSignedInOwnerUserId() {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  return user?.id && !isAnonymousSupabaseUser(user) ? user.id : null;
}

export function buildOriginalPhotoStoragePath({
  fileName,
  localAssetId,
  ownerUserId,
  queuedAt,
  sourceSurface,
  mimeType,
}: {
  fileName: string;
  localAssetId: string;
  ownerUserId: string;
  queuedAt: number;
  sourceSurface: OriginalPhotoSourceSurface;
  mimeType?: string;
}) {
  const date = new Date(queuedAt);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const extension = getOriginalFileExtension(fileName, mimeType);
  const identity = `${sourceSurface}:${localAssetId}`;
  const objectName = `${sanitizePathSegment(localAssetId)}-${hashPathIdentity(identity)}.${extension}`;

  return [
    sanitizePathSegment(ownerUserId),
    "originals",
    sourceSurface,
    year,
    month,
    objectName,
  ].join("/");
}

function buildOriginalPhotoQueueKey(
  sourceSurface: OriginalPhotoSourceSurface,
  localAssetId: string,
) {
  return `${sourceSurface}:${localAssetId}`;
}

function resolveOriginalContentType(type: string, fileName: string) {
  const normalized = type.trim().toLowerCase().split(";", 1)[0] ?? "";
  if (["image/jpeg", "image/jpg", "image/pjpeg"].includes(normalized)) {
    return "image/jpeg";
  }
  if (["image/png", "image/x-png"].includes(normalized)) {
    return "image/png";
  }
  if (["image/avif", "image/gif", "image/heic", "image/heif", "image/webp"].includes(normalized)) {
    return normalized;
  }

  const extension = getOriginalFileExtension(fileName);
  return extension === "png"
    ? "image/png"
    : extension === "webp"
      ? "image/webp"
      : extension === "avif"
        ? "image/avif"
        : extension === "gif"
          ? "image/gif"
          : extension === "heic"
            ? "image/heic"
            : extension === "heif"
              ? "image/heif"
              : "image/jpeg";
}

function getOriginalFileExtension(fileName: string, mimeType?: string) {
  const extensionByMime: Record<string, string> = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const normalizedMime = mimeType?.trim().toLowerCase();
  if (normalizedMime && extensionByMime[normalizedMime]) {
    return extensionByMime[normalizedMime];
  }

  const extension = fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  return extension && ["avif", "gif", "heic", "heif", "jpeg", "jpg", "png", "webp"].includes(extension)
    ? extension === "jpeg" ? "jpg" : extension
    : "jpg";
}

function hashPathIdentity(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getOriginalFileSizeBucket(size: number) {
  if (size < 1_000_000) return "small";
  if (size < 5_000_000) return "medium";
  if (size < 12_000_000) return "large";
  return "very_large";
}

function getPendingOriginalBlob(pending: PendingOriginalPhoto) {
  if (pending.bytes instanceof ArrayBuffer) {
    return new Blob([pending.bytes], { type: pending.mimeType });
  }
  return pending.blob instanceof Blob ? pending.blob : null;
}

async function readOriginalBlobBytes(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    try {
      return await blob.arrayBuffer();
    } catch {
      // Continue with FileReader for WebViews whose Blob reader is transient.
    }
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("original_blob_reader_returned_non_buffer"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("original_blob_reader_failed"));
    reader.onabort = () => reject(new Error("original_blob_reader_aborted"));
    reader.readAsArrayBuffer(blob);
  });
}

function getOriginalQueueErrorCode(error: unknown) {
  if (error instanceof DOMException || error instanceof Error) {
    return error.name || "client_storage_error";
  }
  return "unknown_client_storage_error";
}

function trackOriginalPreservationFailure(
  pending: PendingOriginalPhoto,
  errorCode: string,
) {
  const originalBlob = getPendingOriginalBlob(pending);
  trackProductEvent("photo_original_preservation_failed", {
    source_surface: pending.sourceSurface,
    error_code: errorCode,
    file_size_bucket: getOriginalFileSizeBucket(originalBlob?.size ?? 0),
  });
}

function openOriginalPhotoQueueDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb_unavailable"));
      return;
    }

    const request = indexedDB.open(
      ORIGINAL_QUEUE_DB_NAME,
      ORIGINAL_QUEUE_DB_VERSION,
    );
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ORIGINAL_QUEUE_STORE)) {
        db.createObjectStore(ORIGINAL_QUEUE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_open_failed"));
  });
}

async function putPendingOriginalPhoto(photo: PendingOriginalPhoto) {
  const db = await openOriginalPhotoQueueDb();
  await runOriginalQueueRequest(db, "readwrite", (store) => store.put(photo));
}

async function deletePendingOriginalPhoto(key: string) {
  const db = await openOriginalPhotoQueueDb();
  await runOriginalQueueRequest(db, "readwrite", (store) => store.delete(key));
}

async function readPendingOriginalPhotos() {
  const db = await openOriginalPhotoQueueDb();
  const photos = await runOriginalQueueRequest<PendingOriginalPhoto[]>(
    db,
    "readonly",
    (store) => store.getAll(),
  );
  return photos.sort((left, right) => left.queuedAt - right.queuedAt);
}

function runOriginalQueueRequest<T = IDBValidKey>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(ORIGINAL_QUEUE_STORE, mode);
    const request = createRequest(transaction.objectStore(ORIGINAL_QUEUE_STORE));
    let result!: T;
    let settled = false;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error ?? new Error("indexeddb_request_failed"));
      }
    };
    transaction.oncomplete = () => {
      db.close();
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    transaction.onerror = () => {
      db.close();
      if (!settled) {
        settled = true;
        reject(transaction.error ?? new Error("indexeddb_transaction_failed"));
      }
    };
    transaction.onabort = transaction.onerror;
  });
}
