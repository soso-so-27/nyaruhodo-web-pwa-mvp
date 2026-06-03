import { COLLECTION_GROUPS, type CollectionSlot } from "./poses";
import { STORAGE_KEYS } from "../storage";

export function getCollectionSlotPhotoSlug(slot: CollectionSlot) {
  return `${slot.group}_${slot.id.replace(/-/g, "_")}`;
}

export function getDailyCollectionTarget(
  catId: string | null | undefined,
  collectionPhotos: Record<string, unknown[]> = {},
) {
  const slots = COLLECTION_GROUPS.flatMap((group) => group.slots);

  if (slots.length === 0) {
    return null;
  }

  const uncollectedSlots = slots.filter((slot) => {
    const slug = getCollectionSlotPhotoSlug(slot);
    return (collectionPhotos[slug]?.length ?? 0) === 0;
  });
  const candidates = uncollectedSlots.length > 0 ? uncollectedSlots : slots;
  const seed = hashString(`${catId ?? "cat"}-${getTodayJST()}`);

  return candidates[seed % candidates.length] ?? null;
}

export function readStoredCollectionPhotos(catId: string) {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.collectionPhotos);

    if (!raw) {
      return {};
    }

    const all = JSON.parse(raw) as Record<
      string,
      Record<string, StoredCollectionPhoto[] | StoredCollectionPhoto | string[] | string>
    >;
    const catPhotos = all[catId] ?? {};
    const photosForDisplay =
      countStoredPhotos(catPhotos) > 0 ? catPhotos : mergeAllCollectionPhotos(all);

    return Object.fromEntries(
      Object.entries(photosForDisplay).map(([slug, value]) => [
        slug,
        normalizeStoredPhotoList(value),
      ]),
    );
  } catch {
    return {};
  }
}

type StoredCollectionPhoto = {
  id?: string;
  src?: string;
};

function normalizeStoredPhotoList(
  value: StoredCollectionPhoto[] | StoredCollectionPhoto | string[] | string | undefined,
) {
  if (typeof value === "string") {
    return [value];
  }

  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .map((photo) => {
      if (typeof photo === "string") {
        return photo;
      }

      return typeof photo.src === "string" ? photo.src : null;
    })
    .filter((photo): photo is string => Boolean(photo));
}

function countStoredPhotos(
  photosBySlug: Record<
    string,
    StoredCollectionPhoto[] | StoredCollectionPhoto | string[] | string
  >,
) {
  return Object.values(photosBySlug).reduce(
    (count, value) => count + normalizeStoredPhotoList(value).length,
    0,
  );
}

function mergeAllCollectionPhotos(
  allPhotos: Record<
    string,
    Record<string, StoredCollectionPhoto[] | StoredCollectionPhoto | string[] | string>
  >,
) {
  const merged: Record<string, string[]> = {};

  for (const photosBySlug of Object.values(allPhotos)) {
    for (const [slug, value] of Object.entries(photosBySlug)) {
      merged[slug] = [
        ...(merged[slug] ?? []),
        ...normalizeStoredPhotoList(value),
      ];
    }
  }

  return merged;
}

function getTodayJST() {
  return new Date()
    .toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
