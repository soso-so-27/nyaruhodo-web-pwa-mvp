export type CatMomentState = "sleeping";
export type CatMomentVisibility = "private" | "shared";
export type CatMomentDeliveryStatus = "available" | "hidden" | "reported";

export type CatMoment = {
  id: string;
  ownerCatId: string;
  src: string;
  state: CatMomentState;
  visibility: CatMomentVisibility;
  deliveryStatus: CatMomentDeliveryStatus;
  createdAt: number;
  sourceMomentId?: string;
};

export type CatMomentRecord = {
  id: string;
  owner_cat_id: string;
  photo_url: string;
  state: CatMomentState;
  visibility: CatMomentVisibility;
  delivery_status: CatMomentDeliveryStatus;
  created_at: string;
  source_moment_id: string | null;
};

export type ExchangePhoto = {
  id: string;
  sourcePhotoId?: string;
  src: string;
  title: string;
  subtitle: string;
  triggerLabel: string;
  theme: string;
  deliveredAt: number;
};

export type ExchangePhotoPoolItem = {
  id: string;
  sourceOwnPhotoId?: string;
  sourceCatId?: string;
  src: string;
  title: string;
  subtitle: string;
  tags: readonly string[];
};

export type OwnSleepingPhoto = CatMoment & {
  id: string;
  catId: string;
  src: string;
  triggerLabel: string;
  theme: string;
  shared: boolean;
  createdAt: number;
};

export type HiddenExchangePhotoReason = "hide" | "report";

export type DeliverableSleepingPhotoInput = {
  triggerLabel: string;
  theme: string;
  category: string;
  seed: string;
  excludePhotoId?: string;
  recipientCatId?: string | null;
};

export type DeliverableSleepingPhotoResult = {
  photo: ExchangePhotoPoolItem | null;
  source: "shared" | "none";
};

export type KeptExchangePhotoStorageDebug = {
  rawLength: number;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  latestId: string | null;
  latestSourcePhotoId: string | null;
  latestSrcKind: "data" | "storage" | "http" | "empty" | "other";
  latestSrcLength: number;
  latestSrcPrefix: string;
  parseError: string | null;
};

export const BOX_PHOTO_STORAGE_EVENT = "nyaruhodo_box_photos_updated";

const KEPT_EXCHANGE_PHOTO_STORAGE_KEY = "nyaruhodo_exchange_kept_photos";
const DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY =
  "nyaruhodo_exchange_dismissed_photos";
const REPORTED_EXCHANGE_PHOTO_STORAGE_KEY =
  "nyaruhodo_exchange_reported_photos";
const OWN_SLEEPING_PHOTO_STORAGE_KEY =
  "nyaruhodo_exchange_own_sleeping_photos";

export function readOwnSleepingPhotos(activeCatId: string | null = null) {
  const photos = readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY)
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto);

  const activeCatPhotos = activeCatId
    ? photos.filter((photo) => photo.ownerCatId === activeCatId)
    : photos;

  return (activeCatPhotos.length > 0 ? activeCatPhotos : photos).slice(0, 24);
}

export function readOwnSleepingPhotoCount(activeCatId: string | null) {
  return readOwnSleepingPhotos(activeCatId).length;
}

export function restoreSyncedSleepingPhotos({
  ownPhotos,
  keptPhotos,
  mergeLocal,
}: {
  ownPhotos: OwnSleepingPhoto[];
  keptPhotos: ExchangePhoto[];
  mergeLocal: boolean;
}) {
  const existingOwnPhotos = mergeLocal
    ? readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY)
    : [];
  const existingKeptPhotos = mergeLocal ? readKeptExchangePhotos() : [];
  const restoredOwnPhotos = mergeOwnSleepingPhotos(existingOwnPhotos, ownPhotos);
  const restoredKeptPhotos = mergeExchangePhotos(existingKeptPhotos, keptPhotos);
  const savedOwnPhotos = writeStorageArrayWithFallback(
    OWN_SLEEPING_PHOTO_STORAGE_KEY,
    restoredOwnPhotos,
    [24, 12, 6, 1],
  );
  const savedKeptPhotos = writeStorageArrayWithFallback(
    KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
    restoredKeptPhotos,
    [50, 24, 12, 6, 1],
  );

  if (savedOwnPhotos.length > 0 || savedKeptPhotos.length > 0) {
    dispatchBoxPhotoStorageEvent();
  }

  return {
    ownCount: savedOwnPhotos.length,
    keptCount: savedKeptPhotos.length,
  };
}

export function toCatMomentRecord(moment: CatMoment): CatMomentRecord {
  return {
    id: moment.id,
    owner_cat_id: moment.ownerCatId,
    photo_url: moment.src,
    state: moment.state,
    visibility: moment.visibility,
    delivery_status: moment.deliveryStatus,
    created_at: new Date(moment.createdAt).toISOString(),
    source_moment_id: moment.sourceMomentId ?? null,
  };
}

export function ownSleepingPhotoToCatMoment(photo: OwnSleepingPhoto): CatMoment {
  const normalized = normalizeOwnSleepingPhoto(photo);

  return {
    id: normalized.id,
    ownerCatId: normalized.ownerCatId,
    src: normalized.src,
    state: normalized.state,
    visibility: normalized.visibility,
    deliveryStatus: normalized.deliveryStatus,
    createdAt: normalized.createdAt,
    sourceMomentId: normalized.sourceMomentId,
  };
}

export function readOwnSleepingMomentRecords(activeCatId: string | null = null) {
  return readOwnSleepingPhotos(activeCatId)
    .map(ownSleepingPhotoToCatMoment)
    .map(toCatMomentRecord);
}

export function fromCatMomentRecord(record: CatMomentRecord): CatMoment {
  return {
    id: record.id,
    ownerCatId: record.owner_cat_id,
    src: record.photo_url,
    state: record.state,
    visibility: record.visibility,
    deliveryStatus: record.delivery_status,
    createdAt: new Date(record.created_at).getTime(),
    sourceMomentId: record.source_moment_id ?? undefined,
  };
}

export function saveOwnSleepingPhoto({
  catId,
  src,
  triggerLabel,
  theme,
  shared,
}: {
  catId: string;
  src: string;
  triggerLabel: string;
  theme: string;
  shared: boolean;
}) {
  try {
    const saved = readStorageArray<OwnSleepingPhoto>(
      OWN_SLEEPING_PHOTO_STORAGE_KEY,
    );
    const createdAt = Date.now();
    const ownPhoto: OwnSleepingPhoto = {
      id: `own-sleeping-${createdAt}`,
      ownerCatId: catId,
      catId,
      src,
      state: "sleeping",
      visibility: shared ? "shared" : "private",
      deliveryStatus: "available",
      triggerLabel,
      theme,
      shared,
      createdAt,
    };
    const normalizedOwnPhoto = normalizeOwnSleepingPhoto(ownPhoto);
    const nextPhotos = [normalizedOwnPhoto, ...saved];
    const keepCounts = [24, 12, 6, 1];

    for (const keepCount of keepCounts) {
      try {
        writeStorageArray(
          OWN_SLEEPING_PHOTO_STORAGE_KEY,
          nextPhotos.slice(0, keepCount),
        );
        dispatchBoxPhotoStorageEvent();
        return normalizedOwnPhoto;
      } catch {
        // Retry with fewer older photos if local storage is near its limit.
      }
    }
  } catch {
    // The calling flow handles a null result.
  }

  return null;
}

export function updateOwnSleepingPhotoDelivery(photoId: string, shared: boolean) {
  try {
    const photos = readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY);
    const targetPhoto = photos.find((photo) => photo.id === photoId);
    const updatedTargetPhoto = targetPhoto
      ? normalizeOwnSleepingPhoto({
          ...targetPhoto,
          shared,
          visibility: shared ? "shared" : "private",
        })
      : null;
    const nextPhotos = photos.map((photo) =>
      photo.id === photoId && updatedTargetPhoto ? updatedTargetPhoto : photo,
    );

    writeStorageArray(OWN_SLEEPING_PHOTO_STORAGE_KEY, nextPhotos);

    dispatchBoxPhotoStorageEvent();
    return updatedTargetPhoto;
  } catch {
    // Local MVP storage should not block album use.
  }

  return null;
}

export function deleteOwnSleepingPhoto(photoId: string) {
  try {
    const photos = readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY);
    const targetPhoto = photos.find((photo) => photo.id === photoId);
    const nextPhotos = photos.filter((photo) => photo.id !== photoId);

    writeStorageArray(OWN_SLEEPING_PHOTO_STORAGE_KEY, nextPhotos);

    dispatchBoxPhotoStorageEvent();
  } catch {
    // Local MVP storage should not block album use.
  }
}

export function readKeptExchangePhotos() {
  return readStorageArray<ExchangePhoto>(KEPT_EXCHANGE_PHOTO_STORAGE_KEY)
    .filter(isValidExchangePhoto)
    .slice(0, 50);
}

export function readKeptExchangePhotoCount() {
  return readKeptExchangePhotos().length;
}

export function readKeptExchangePhotoStorageDebug(): KeptExchangePhotoStorageDebug {
  if (typeof window === "undefined") {
    return createEmptyKeptExchangeDebug(0, "window_unavailable");
  }

  const raw = window.localStorage.getItem(KEPT_EXCHANGE_PHOTO_STORAGE_KEY) ?? "";

  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const photos = Array.isArray(parsed)
      ? (parsed as Partial<ExchangePhoto>[])
      : [];
    const validPhotos = photos.filter(isValidExchangePhoto);
    const latestPhoto = photos[0] ?? null;
    const latestSrc =
      typeof latestPhoto?.src === "string" ? latestPhoto.src : "";

    return {
      rawLength: raw.length,
      totalCount: photos.length,
      validCount: validPhotos.length,
      invalidCount: Math.max(0, photos.length - validPhotos.length),
      latestId: typeof latestPhoto?.id === "string" ? latestPhoto.id : null,
      latestSourcePhotoId:
        typeof latestPhoto?.sourcePhotoId === "string"
          ? latestPhoto.sourcePhotoId
          : null,
      latestSrcKind: getPhotoSrcKind(latestSrc),
      latestSrcLength: latestSrc.length,
      latestSrcPrefix: latestSrc.slice(0, 42),
      parseError: null,
    };
  } catch (error) {
    return createEmptyKeptExchangeDebug(
      raw.length,
      error instanceof Error ? error.message : "parse_error",
    );
  }
}

export function keepExchangePhoto(photo: ExchangePhoto) {
  if (!isValidExchangePhoto(photo)) {
    return false;
  }

  try {
    const saved = readKeptExchangePhotos().filter(
      (savedPhoto) =>
        savedPhoto.id !== photo.id &&
        (!photo.sourcePhotoId || savedPhoto.sourcePhotoId !== photo.sourcePhotoId),
    );
    const savedPhotos = writeStorageArrayWithFallback(
      KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
      [photo, ...saved],
      [50, 30, 20, 12, 6, 1],
    );

    if (
      savedPhotos.some(
        (savedPhoto) =>
          savedPhoto.id === photo.id ||
          Boolean(photo.sourcePhotoId && savedPhoto.sourcePhotoId === photo.sourcePhotoId),
      )
    ) {
      dispatchBoxPhotoStorageEvent();
      return true;
    }
  } catch {
    // The received photo is a soft reward, so storage failure should not block.
  }

  return false;
}

function createEmptyKeptExchangeDebug(
  rawLength: number,
  parseError: string | null,
): KeptExchangePhotoStorageDebug {
  return {
    rawLength,
    totalCount: 0,
    validCount: 0,
    invalidCount: 0,
    latestId: null,
    latestSourcePhotoId: null,
    latestSrcKind: "empty",
    latestSrcLength: 0,
    latestSrcPrefix: "",
    parseError,
  };
}

function getPhotoSrcKind(src: string): KeptExchangePhotoStorageDebug["latestSrcKind"] {
  if (!src) {
    return "empty";
  }
  if (src.startsWith("data:image/")) {
    return "data";
  }
  if (src.startsWith("storage://")) {
    return "storage";
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return "http";
  }

  return "other";
}

export function dismissExchangePhoto(photo: ExchangePhoto) {
  try {
    const saved = readStorageArray<Partial<ExchangePhoto>>(
      DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY,
    );
    const dismissed = {
      id: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      src: photo.src,
      dismissedAt: Date.now(),
    };

    writeStorageArray(
      DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY,
      [dismissed, ...saved].slice(0, 80),
    );
  } catch {
    // Dismiss history only helps avoid repeats; failure should not block closing.
  }
}

export function reportExchangePhoto(photo: ExchangePhoto) {
  try {
    const reported = readStorageArray<Partial<ExchangePhoto>>(
      REPORTED_EXCHANGE_PHOTO_STORAGE_KEY,
    );
    const dismissed = readStorageArray<Partial<ExchangePhoto>>(
      DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY,
    );
    const reportedPhoto = {
      ...photo,
      reportedAt: Date.now(),
    };
    const dismissedPhoto = {
      id: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      src: photo.src,
      dismissedAt: Date.now(),
    };

    writeStorageArray(
      REPORTED_EXCHANGE_PHOTO_STORAGE_KEY,
      [reportedPhoto, ...reported].slice(0, 50),
    );
    writeStorageArray(
      DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY,
      [dismissedPhoto, ...dismissed].slice(0, 80),
    );
  } catch {
    // Reporting is a safety action, but it should still let the user close.
  }
}

export function hideKeptExchangePhoto(
  photoId: string,
  reason: HiddenExchangePhotoReason,
) {
  try {
    const photos = readKeptExchangePhotos();
    const targetPhoto = photos.find((photo) => photo.id === photoId);
    const nextPhotos = photos.filter((photo) => photo.id !== photoId);

    writeStorageArray(KEPT_EXCHANGE_PHOTO_STORAGE_KEY, nextPhotos);

    if (targetPhoto) {
      const historyKey =
        reason === "report"
          ? REPORTED_EXCHANGE_PHOTO_STORAGE_KEY
          : DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY;
      const history = readStorageArray<Partial<ExchangePhoto>>(historyKey);
      const historyPhoto =
        reason === "report"
          ? { ...targetPhoto, reportedAt: Date.now() }
          : { ...targetPhoto, dismissedAt: Date.now() };

      writeStorageArray(historyKey, [historyPhoto, ...history].slice(0, 50));
    }

    dispatchBoxPhotoStorageEvent();
  } catch {
    // Local MVP storage should not block album use.
  }
}

export function readBlockedExchangePhotoIds() {
  const blockedIds = new Set<string>();

  addExchangePhotoIdsFromStorage(blockedIds, KEPT_EXCHANGE_PHOTO_STORAGE_KEY);
  addExchangePhotoIdsFromStorage(blockedIds, DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY);
  addExchangePhotoIdsFromStorage(blockedIds, REPORTED_EXCHANGE_PHOTO_STORAGE_KEY);

  return blockedIds;
}

export function dispatchBoxPhotoStorageEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(BOX_PHOTO_STORAGE_EVENT));
}

function mergeOwnSleepingPhotos(
  existingPhotos: OwnSleepingPhoto[],
  restoredPhotos: OwnSleepingPhoto[],
) {
  const byId = new Map<string, OwnSleepingPhoto>();

  for (const photo of [...existingPhotos, ...restoredPhotos]) {
    if (!isValidOwnSleepingPhoto(photo)) {
      continue;
    }

    const normalized = normalizeOwnSleepingPhoto(photo);
    byId.set(normalized.id, normalized);
  }

  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function mergeExchangePhotos(
  existingPhotos: ExchangePhoto[],
  restoredPhotos: ExchangePhoto[],
) {
  const byId = new Map<string, ExchangePhoto>();

  for (const photo of [...existingPhotos, ...restoredPhotos]) {
    if (!isValidExchangePhoto(photo)) {
      continue;
    }

    byId.set(photo.id, photo);
  }

  return [...byId.values()].sort((a, b) => b.deliveredAt - a.deliveredAt);
}

function addExchangePhotoIdsFromStorage(blockedIds: Set<string>, key: string) {
  const photos = readStorageArray<Partial<ExchangePhoto>>(key);

  for (const photo of photos) {
    if (typeof photo.sourcePhotoId === "string") {
      blockedIds.add(photo.sourcePhotoId);
    }
    if (typeof photo.id === "string") {
      blockedIds.add(photo.id);
    }
  }
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

function writeStorageArrayWithFallback<T>(
  key: string,
  value: T[],
  keepCounts: number[],
) {
  for (const keepCount of keepCounts) {
    const nextValue = value.slice(0, keepCount);

    try {
      writeStorageArray(key, nextValue);
      return nextValue;
    } catch {
      // Try again with fewer photos when iOS PWA storage is tight.
    }
  }

  return [] as T[];
}

function isValidOwnSleepingPhoto(photo: Partial<OwnSleepingPhoto>) {
  return Boolean(
    typeof photo.id === "string" &&
      (typeof photo.catId === "string" ||
        typeof photo.ownerCatId === "string") &&
      typeof photo.src === "string",
  );
}

function normalizeOwnSleepingPhoto(photo: OwnSleepingPhoto): OwnSleepingPhoto {
  const ownerCatId = photo.ownerCatId ?? photo.catId;
  const shared = photo.shared ?? photo.visibility === "shared";

  return {
    ...photo,
    ownerCatId,
    catId: photo.catId ?? ownerCatId,
    state: photo.state ?? "sleeping",
    visibility: photo.visibility ?? (shared ? "shared" : "private"),
    deliveryStatus: photo.deliveryStatus ?? "available",
    shared,
  };
}

function isValidExchangePhoto(photo: Partial<ExchangePhoto>) {
  return Boolean(
    typeof photo.id === "string" &&
      typeof photo.src === "string" &&
      photo.src.trim().length > 0,
  );
}
