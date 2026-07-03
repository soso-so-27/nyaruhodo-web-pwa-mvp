import { isUsablePhotoSrc, normalizePersistentPhotoSrc } from "../photoStorage";
import { STORAGE_KEYS, readCachedJson, writeCachedJson } from "../storage";

export type CatGalleryPhoto = {
  id: string;
  catId: string;
  src: string;
  thumbnailSrc?: string;
  createdAt: number;
};

export const CAT_GALLERY_PHOTOS_UPDATED_EVENT =
  "neteruneko_cat_gallery_photos_updated";
export const CAT_GALLERY_PHOTO_LIMIT = 100;
const CAT_GALLERY_INTRO_ACKNOWLEDGED_STORAGE_KEY =
  "neteruneko_cat_gallery_intro_acknowledged";

export function readCatGalleryPhotos(activeCatId: string | null = null) {
  const photos = readStorageArray<CatGalleryPhoto>(STORAGE_KEYS.catGalleryPhotos)
    .filter(isValidCatGalleryPhoto)
    .map(normalizeCatGalleryPhoto)
    .sort((left, right) => right.createdAt - left.createdAt);

  return activeCatId
    ? photos.filter((photo) => photo.catId === activeCatId)
    : photos;
}

export function saveCatGalleryPhoto({
  catId,
  src,
  thumbnailSrc,
}: {
  catId: string;
  src: string;
  thumbnailSrc?: string | null;
}) {
  const normalizedSrc = normalizePersistentPhotoSrc(src) || src;
  const normalizedThumbnailSrc =
    thumbnailSrc ? normalizePersistentPhotoSrc(thumbnailSrc) || thumbnailSrc : null;

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
    createdAt,
  };

  try {
    const saved = readCatGalleryPhotos(null);
    const savedForCat = saved.filter((savedPhoto) => savedPhoto.catId === catId);
    if (savedForCat.length >= CAT_GALLERY_PHOTO_LIMIT) {
      return null;
    }

    writeStorageArray(
      STORAGE_KEYS.catGalleryPhotos,
      limitCatGalleryPhotosPerCat([photo, ...saved]),
    );
    dispatchCatGalleryPhotosUpdated();
    return photo;
  } catch {
    return null;
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

  const nextPhotos = limitCatGalleryPhotosPerCat([...photoMap.values()]);

  writeStorageArray(STORAGE_KEYS.catGalleryPhotos, nextPhotos);
  dispatchCatGalleryPhotosUpdated();

  return restoredCount;
}

function normalizeCatGalleryPhoto(photo: CatGalleryPhoto): CatGalleryPhoto {
  return {
    id: photo.id,
    catId: photo.catId,
    src: normalizePersistentPhotoSrc(photo.src) || photo.src,
    ...(photo.thumbnailSrc && isUsablePhotoSrc(photo.thumbnailSrc)
      ? {
          thumbnailSrc:
            normalizePersistentPhotoSrc(photo.thumbnailSrc) || photo.thumbnailSrc,
        }
      : {}),
    createdAt: photo.createdAt,
  };
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
