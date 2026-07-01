import { isUsablePhotoSrc, normalizePersistentPhotoSrc } from "../photoStorage";
import { STORAGE_KEYS } from "../storage";

export type CatGalleryPhoto = {
  id: string;
  catId: string;
  src: string;
  createdAt: number;
};

export const CAT_GALLERY_PHOTOS_UPDATED_EVENT =
  "neteruneko_cat_gallery_photos_updated";

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
}: {
  catId: string;
  src: string;
}) {
  const normalizedSrc = normalizePersistentPhotoSrc(src) || src;

  if (!catId || !isUsablePhotoSrc(normalizedSrc)) {
    return null;
  }

  const createdAt = Date.now();
  const photo: CatGalleryPhoto = {
    id: createCatGalleryPhotoId(createdAt),
    catId,
    src: normalizedSrc,
    createdAt,
  };

  try {
    const saved = readCatGalleryPhotos(null);
    writeStorageArray(STORAGE_KEYS.catGalleryPhotos, [photo, ...saved].slice(0, 120));
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

  const nextPhotos = [...photoMap.values()]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 120);

  writeStorageArray(STORAGE_KEYS.catGalleryPhotos, nextPhotos);
  dispatchCatGalleryPhotosUpdated();

  return restoredCount;
}

function normalizeCatGalleryPhoto(photo: CatGalleryPhoto): CatGalleryPhoto {
  return {
    id: photo.id,
    catId: photo.catId,
    src: normalizePersistentPhotoSrc(photo.src) || photo.src,
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
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [] as T[];
  }
}

function writeStorageArray<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
