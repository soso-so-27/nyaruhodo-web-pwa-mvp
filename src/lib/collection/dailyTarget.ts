import { COLLECTION_GROUPS, type CollectionSlot } from "./poses";

const COLLECTION_PHOTOS_STORAGE_KEY = "collection_photos";

export function getCollectionSlotPhotoSlug(slot: CollectionSlot) {
  return `${slot.group}_${slot.id.replace(/-/g, "_")}`;
}

export function getDailyCollectionTarget(
  catId: string | null | undefined,
  collectionPhotos: Record<string, string[]> = {},
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
    const raw = window.localStorage.getItem(COLLECTION_PHOTOS_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const all = JSON.parse(raw) as Record<
      string,
      Record<string, string[] | string>
    >;
    const catPhotos = all[catId] ?? {};

    return Object.fromEntries(
      Object.entries(catPhotos).map(([slug, value]) => [
        slug,
        normalizeStoredPhotoList(value),
      ]),
    );
  } catch {
    return {};
  }
}

function normalizeStoredPhotoList(value: string[] | string | undefined) {
  if (typeof value === "string") {
    return [value];
  }

  return value ?? [];
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
