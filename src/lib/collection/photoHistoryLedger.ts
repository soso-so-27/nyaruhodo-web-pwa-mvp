import {
  readDurableClientValue,
  removeDurableClientValue,
  writeDurableClientValue,
} from "../storage/durableClientStore";

export type DurableCollectionPhoto = {
  id: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  width?: number;
  height?: number;
  createdAt?: string;
};

export type DurableCollectionPhotoStore = Record<
  string,
  Record<string, DurableCollectionPhoto[]>
>;

const COLLECTION_LEDGER_KEY = "collection-photo-history:v1";
let cachedStore: DurableCollectionPhotoStore = {};
let writeQueue = Promise.resolve();
let ledgerGeneration = 0;

export function getCollectionPhotoLedgerGeneration() {
  return ledgerGeneration;
}

export async function hydrateCollectionPhotoLedger(
  expectedGeneration = ledgerGeneration,
) {
  const persisted = await readDurableClientValue<DurableCollectionPhotoStore>(
    COLLECTION_LEDGER_KEY,
  );

  if (expectedGeneration !== ledgerGeneration) {
    return cachedStore;
  }

  cachedStore = normalizeCollectionStore(persisted);
  return cachedStore;
}

export function readCachedCollectionPhotoLedger() {
  return cachedStore;
}

export function mergeCollectionPhotoStores(
  preferred: DurableCollectionPhotoStore,
  fallback: DurableCollectionPhotoStore,
) {
  const merged: DurableCollectionPhotoStore = {};
  const catIds = new Set([...Object.keys(fallback), ...Object.keys(preferred)]);

  for (const catId of catIds) {
    merged[catId] = {};
    const preferredSlots = preferred[catId] ?? {};
    const fallbackSlots = fallback[catId] ?? {};
    const slugs = new Set([
      ...Object.keys(fallbackSlots),
      ...Object.keys(preferredSlots),
    ]);

    for (const slug of slugs) {
      merged[catId][slug] = mergeCollectionPhotoLists(
        preferredSlots[slug] ?? [],
        fallbackSlots[slug] ?? [],
      );
    }
  }

  return merged;
}

export function persistCollectionPhotoStore(
  store: DurableCollectionPhotoStore,
) {
  return queueCollectionLedgerWrite(async () => {
    const persisted = normalizeCollectionStore(
      await readDurableClientValue<DurableCollectionPhotoStore>(
        COLLECTION_LEDGER_KEY,
      ),
    );
    const merged = mergeCollectionPhotoStores(
      normalizeCollectionStore(store),
      persisted,
    );
    await writeDurableClientValue(COLLECTION_LEDGER_KEY, merged);
    cachedStore = merged;
  });
}

export function upsertCollectionPhotoHistory(
  catId: string,
  slug: string,
  photo: DurableCollectionPhoto,
) {
  return persistCollectionPhotoStore({
    [catId]: {
      [slug]: [photo],
    },
  });
}

export function migrateLegacyCollectionPhotoStore(value: unknown) {
  return migrateLegacyCollectionPhotoStoreForGeneration(value);
}

export function migrateLegacyCollectionPhotoStoreForGeneration(
  value: unknown,
  expectedGeneration?: number,
) {
  const legacyStore = normalizeCollectionStore(value);

  return queueCollectionLedgerWrite(async () => {
    if (
      expectedGeneration !== undefined &&
      expectedGeneration !== ledgerGeneration
    ) {
      return;
    }

    const persisted = await readDurableClientValue<DurableCollectionPhotoStore>(
      COLLECTION_LEDGER_KEY,
    );
    const merged = mergeCollectionPhotoStores(
      legacyStore,
      normalizeCollectionStore(persisted),
    );
    await writeDurableClientValue(COLLECTION_LEDGER_KEY, merged);
    cachedStore = merged;
  });
}

export function removeCollectionPhotoHistory(
  catId: string,
  slug: string,
  photo: Pick<DurableCollectionPhoto, "id" | "src">,
) {
  return queueCollectionLedgerWrite(async () => {
    const persisted = normalizeCollectionStore(
      await readDurableClientValue<DurableCollectionPhotoStore>(
        COLLECTION_LEDGER_KEY,
      ),
    );
    const currentPhotos = persisted[catId]?.[slug] ?? [];
    const nextPhotos = currentPhotos.filter(
      (candidate) => !isSameCollectionPhoto(candidate, photo),
    );

    if (persisted[catId]) {
      if (nextPhotos.length > 0) {
        persisted[catId][slug] = nextPhotos;
      } else {
        delete persisted[catId][slug];
      }
    }

    await writeDurableClientValue(COLLECTION_LEDGER_KEY, persisted);
    cachedStore = persisted;
  });
}

export async function clearCollectionPhotoLedger() {
  ledgerGeneration += 1;
  await writeQueue.catch(() => undefined);
  cachedStore = {};
  writeQueue = Promise.resolve();
  await removeDurableClientValue(COLLECTION_LEDGER_KEY);
}

function queueCollectionLedgerWrite(write: () => Promise<void>) {
  const next = writeQueue.catch(() => undefined).then(write);
  writeQueue = next;
  return next;
}

function normalizeCollectionStore(value: unknown): DurableCollectionPhotoStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: DurableCollectionPhotoStore = {};

  for (const [catId, rawSlots] of Object.entries(value)) {
    if (!rawSlots || typeof rawSlots !== "object" || Array.isArray(rawSlots)) {
      continue;
    }

    normalized[catId] = {};
    for (const [slug, rawPhotos] of Object.entries(rawSlots)) {
      const photos = (Array.isArray(rawPhotos) ? rawPhotos : [rawPhotos])
        .map((photo, index): DurableCollectionPhoto | null => {
          if (typeof photo === "string") {
            return photo
              ? { id: `${catId}:${slug}:${index}`, src: photo }
              : null;
          }
          if (
            !photo ||
            typeof photo !== "object" ||
            typeof (photo as DurableCollectionPhoto).src !== "string" ||
            !(photo as DurableCollectionPhoto).src
          ) {
            return null;
          }

          const normalizedPhoto = photo as Partial<DurableCollectionPhoto> & {
            src: string;
          };
          return {
            ...normalizedPhoto,
            id: normalizedPhoto.id || `${catId}:${slug}:${index}`,
          };
        })
        .filter((photo): photo is DurableCollectionPhoto => Boolean(photo));
      if (photos.length > 0) {
        normalized[catId][slug] = photos;
      }
    }
  }

  return normalized;
}

function mergeCollectionPhotoLists(
  preferred: DurableCollectionPhoto[],
  fallback: DurableCollectionPhoto[],
) {
  const merged: DurableCollectionPhoto[] = [];

  for (const photo of [...preferred, ...fallback]) {
    const matchingIndex = merged.findIndex((candidate) =>
      isSameCollectionPhoto(candidate, photo),
    );
    if (matchingIndex === -1) {
      merged.push(photo);
      continue;
    }

    merged[matchingIndex] = { ...photo, ...merged[matchingIndex] };
  }

  return merged.sort(
    (first, second) =>
      getCollectionPhotoTimestamp(second) - getCollectionPhotoTimestamp(first),
  );
}

function isSameCollectionPhoto(
  first: Pick<DurableCollectionPhoto, "id" | "src">,
  second: Pick<DurableCollectionPhoto, "id" | "src">,
) {
  return Boolean(
    (first.id && second.id && first.id === second.id) ||
      (first.src && second.src && first.src === second.src),
  );
}

function getCollectionPhotoTimestamp(photo: DurableCollectionPhoto) {
  const timestamp = photo.createdAt ? new Date(photo.createdAt).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
