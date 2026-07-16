import { isUsablePhotoSrc, normalizePersistentPhotoSrc } from "../photoStorage";
import { completePhotoSourceSet } from "../photoSources";
import { purgePhotoSwCacheForSources } from "../photoSwCache";
import { STORAGE_KEYS, readCachedJson, writeCachedJson } from "../storage";
import {
  readCachedPhotoHistoryEntries,
  removePhotoHistoryEntry,
  upsertPhotoHistoryEntries,
} from "../photoHistoryLedger";

export type CatGalleryPhoto = {
  id: string;
  catId: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  width?: number;
  height?: number;
  createdAt: number;
};

export const CAT_GALLERY_PHOTOS_UPDATED_EVENT =
  "neteruneko_cat_gallery_photos_updated";
export const CAT_GALLERY_PHOTO_LIMIT = 100;
const CAT_GALLERY_INTRO_ACKNOWLEDGED_STORAGE_KEY =
  "neteruneko_cat_gallery_intro_acknowledged";

export function readCatGalleryPhotos(activeCatId: string | null = null) {
  const photoMap = new Map<string, CatGalleryPhoto>();
  for (const photo of [
    ...readStorageArray<CatGalleryPhoto>(STORAGE_KEYS.catGalleryPhotos),
    ...readCachedPhotoHistoryEntries<CatGalleryPhoto>("gallery"),
  ]) {
    if (isValidCatGalleryPhoto(photo)) {
      const normalized = normalizeCatGalleryPhoto(photo);
      photoMap.set(normalized.id, normalized);
    }
  }
  const photos = [...photoMap.values()].sort(
    (left, right) => right.createdAt - left.createdAt,
  );

  return activeCatId
    ? photos.filter((photo) => photo.catId === activeCatId)
    : photos;
}

export async function saveCatGalleryPhoto({
  catId,
  src,
  thumbnailSrc,
  displaySrc,
  originalSrc,
  width,
  height,
}: {
  catId: string;
  src: string;
  thumbnailSrc?: string | null;
  displaySrc?: string | null;
  originalSrc?: string | null;
  width?: number | null;
  height?: number | null;
}) {
  const normalizedSrc = normalizePersistentPhotoSrc(src) || src;
  const normalizedThumbnailSrc =
    thumbnailSrc ? normalizePersistentPhotoSrc(thumbnailSrc) || thumbnailSrc : null;
  const normalizedDisplaySrc =
    displaySrc ? normalizePersistentPhotoSrc(displaySrc) || displaySrc : null;
  const normalizedOriginalSrc =
    originalSrc ? normalizePersistentPhotoSrc(originalSrc) || originalSrc : null;

  if (!catId || !isUsablePhotoSrc(normalizedSrc)) {
    return null;
  }

  const createdAt = Date.now();
  const photo: CatGalleryPhoto = {
    id: createCatGalleryPhotoId(createdAt),
    catId,
    src: normalizedSrc,
    ...(normalizedThumbnailSrc && isUsablePhotoSrc(normalizedThumbnailSrc)
      ? { thumbnailSrc: normalizedThumbnailSrc }
      : {}),
    ...(normalizedDisplaySrc && isUsablePhotoSrc(normalizedDisplaySrc)
      ? { displaySrc: normalizedDisplaySrc }
      : {}),
    ...(normalizedOriginalSrc && isUsablePhotoSrc(normalizedOriginalSrc)
      ? { originalSrc: normalizedOriginalSrc }
      : {}),
    ...(isValidPhotoDimension(width) ? { width } : {}),
    ...(isValidPhotoDimension(height) ? { height } : {}),
    createdAt,
  };

  const savedBeforeInsert = readCatGalleryPhotos(null);
  await upsertPhotoHistoryEntries("gallery", [photo]);

  try {
    writeStorageArray(
      STORAGE_KEYS.catGalleryPhotos,
      limitCatGalleryPhotosPerCat([
        photo,
        ...savedBeforeInsert.filter((savedPhoto) => savedPhoto.id !== photo.id),
      ]),
    );
    dispatchCatGalleryPhotosUpdated();
    return photo;
  } catch {
    dispatchCatGalleryPhotosUpdated();
    return photo;
  }
}

export function deleteCatGalleryPhoto(photoId: string) {
  if (!photoId) {
    return null;
  }

  const saved = readCatGalleryPhotos(null);
  const target = saved.find((photo) => photo.id === photoId) ?? null;

  if (!target) {
    return null;
  }

  writeStorageArray(
    STORAGE_KEYS.catGalleryPhotos,
    saved.filter((photo) => photo.id !== photoId),
  );
  void removePhotoHistoryEntry("gallery", target).catch(() => undefined);
  purgePhotoSwCacheForSources(
    [target.src, target.thumbnailSrc, target.displaySrc, target.originalSrc],
    "cat_gallery_photo_deleted",
  );
  dispatchCatGalleryPhotosUpdated();

  return target;
}

export function updateCatGalleryPhotoThumbnail(photoId: string, thumbnailSrc: string) {
  const normalizedThumbnailSrc =
    normalizePersistentPhotoSrc(thumbnailSrc) || thumbnailSrc;

  if (!photoId || !isUsablePhotoSrc(normalizedThumbnailSrc)) {
    return null;
  }

  const saved = readCatGalleryPhotos(null);
  let updatedPhoto: CatGalleryPhoto | null = null;
  const nextPhotos = saved.map((photo) => {
    if (photo.id !== photoId) {
      return photo;
    }

    updatedPhoto = {
      ...photo,
      thumbnailSrc: normalizedThumbnailSrc,
    };
    return updatedPhoto;
  });

  if (!updatedPhoto) {
    return null;
  }

  writeStorageArray(STORAGE_KEYS.catGalleryPhotos, nextPhotos);
  void upsertPhotoHistoryEntries("gallery", [updatedPhoto]).catch(
    () => undefined,
  );
  dispatchCatGalleryPhotosUpdated();
  return updatedPhoto;
}

export function hasAcknowledgedCatGalleryIntro() {
  if (typeof window === "undefined") {
    return true;
  }

  return (
    window.localStorage.getItem(CAT_GALLERY_INTRO_ACKNOWLEDGED_STORAGE_KEY) ===
    "true"
  );
}

export function acknowledgeCatGalleryIntro() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CAT_GALLERY_INTRO_ACKNOWLEDGED_STORAGE_KEY, "true");
}

export function restoreSyncedCatGalleryPhotos({
  photos,
  mergeLocal,
}: {
  photos: CatGalleryPhoto[];
  mergeLocal: boolean;
}) {
  const existing = mergeLocal ? readCatGalleryPhotos(null) : [];
  const photoMap = new Map<string, CatGalleryPhoto>();
  const existingIds = new Set(existing.map((photo) => photo.id));
  let restoredCount = 0;

  for (const photo of [...existing, ...photos]) {
    if (!isValidCatGalleryPhoto(photo)) {
      continue;
    }

    const normalized = normalizeCatGalleryPhoto(photo);
    if (!existingIds.has(normalized.id)) {
      restoredCount += 1;
    }
    photoMap.set(normalized.id, normalized);
  }

  const fullPhotoHistory = [...photoMap.values()];
  void upsertPhotoHistoryEntries("gallery", fullPhotoHistory).catch(
    () => undefined,
  );
  const nextPhotos = limitCatGalleryPhotosPerCat(fullPhotoHistory);

  writeStorageArray(STORAGE_KEYS.catGalleryPhotos, nextPhotos);
  dispatchCatGalleryPhotosUpdated();

  return restoredCount;
}

function normalizeCatGalleryPhoto(photo: CatGalleryPhoto): CatGalleryPhoto {
  return completePhotoSourceSet({
    id: photo.id,
    catId: photo.catId,
    src: normalizePersistentPhotoSrc(photo.src) || photo.src,
    ...(photo.thumbnailSrc && isUsablePhotoSrc(photo.thumbnailSrc)
      ? {
          thumbnailSrc:
            normalizePersistentPhotoSrc(photo.thumbnailSrc) || photo.thumbnailSrc,
        }
      : {}),
    ...(photo.displaySrc && isUsablePhotoSrc(photo.displaySrc)
      ? {
          displaySrc:
            normalizePersistentPhotoSrc(photo.displaySrc) || photo.displaySrc,
        }
      : {}),
    ...(photo.originalSrc && isUsablePhotoSrc(photo.originalSrc)
      ? {
          originalSrc:
            normalizePersistentPhotoSrc(photo.originalSrc) || photo.originalSrc,
        }
      : {}),
    ...(isValidPhotoDimension(photo.width) ? { width: photo.width } : {}),
    ...(isValidPhotoDimension(photo.height) ? { height: photo.height } : {}),
    createdAt: photo.createdAt,
  });
}

function isValidPhotoDimension(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidCatGalleryPhoto(
  photo: Partial<CatGalleryPhoto>,
): photo is CatGalleryPhoto {
  return Boolean(
    typeof photo.id === "string" &&
      typeof photo.catId === "string" &&
      typeof photo.src === "string" &&
      isUsablePhotoSrc(photo.src) &&
      typeof photo.createdAt === "number" &&
      Number.isFinite(photo.createdAt),
  );
}

function limitCatGalleryPhotosPerCat(photos: CatGalleryPhoto[]) {
  const countByCatId = new Map<string, number>();

  return photos
    .sort((left, right) => right.createdAt - left.createdAt)
    .filter((photo) => {
      const count = countByCatId.get(photo.catId) ?? 0;
      if (count >= CAT_GALLERY_PHOTO_LIMIT) {
        return false;
      }

      countByCatId.set(photo.catId, count + 1);
      return true;
    });
}

function createCatGalleryPhotoId(createdAt: number) {
  const random =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);

  return `cat-gallery-${createdAt}-${random}`;
}

function dispatchCatGalleryPhotosUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CAT_GALLERY_PHOTOS_UPDATED_EVENT));
}

function readStorageArray<T>(key: string) {
  if (typeof window === "undefined") {
    return [] as T[];
  }

  try {
    const parsed = readCachedJson<unknown>(key) ?? [];

    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [] as T[];
  }
}

function writeStorageArray<T>(key: string, value: T[]) {
  writeCachedJson(key, value);
}
