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

export const BOX_PHOTO_STORAGE_EVENT = "nyaruhodo_box_photos_updated";

const KEPT_EXCHANGE_PHOTO_STORAGE_KEY = "nyaruhodo_exchange_kept_photos";
const DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY =
  "nyaruhodo_exchange_dismissed_photos";
const REPORTED_EXCHANGE_PHOTO_STORAGE_KEY =
  "nyaruhodo_exchange_reported_photos";
const SHARED_EXCHANGE_PHOTO_STORAGE_KEY = "nyaruhodo_exchange_shared_photos";
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

  for (const photo of savedOwnPhotos) {
    try {
      if (photo.shared) {
        addSharedSleepingPhoto(photo);
      }
    } catch {
      // Shared-photo history is optional during account restore.
    }
  }

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

    if (updatedTargetPhoto?.src) {
      if (shared) {
        addSharedSleepingPhoto(updatedTargetPhoto);
      } else {
        removeSharedSleepingPhoto(updatedTargetPhoto);
      }
    }

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

    if (targetPhoto?.src) {
      removeSharedSleepingPhoto(targetPhoto);
    }

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

export function keepExchangePhoto(photo: ExchangePhoto) {
  try {
    const saved = readKeptExchangePhotos();

    writeStorageArray(
      KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
      [photo, ...saved].slice(0, 50),
    );
    dispatchBoxPhotoStorageEvent();
  } catch {
    // The received photo is a soft reward, so storage failure should not block.
  }
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

export function readSharedExchangePhotos() {
  return readStorageArray<ExchangePhotoPoolItem>(SHARED_EXCHANGE_PHOTO_STORAGE_KEY)
    .filter(isValidExchangePhotoPoolItem)
    .slice(0, 60);
}

export function saveSharedExchangePhoto({
  ownPhoto,
  title = "とったねがお",
  subtitle = "",
  tags = ["sleeping", "ねてる"],
}: {
  ownPhoto: OwnSleepingPhoto;
  title?: string;
  subtitle?: string;
  tags?: readonly string[];
}) {
  try {
    const current = readSharedExchangePhotos();
    const sharedPhoto: ExchangePhotoPoolItem = {
      id: `shared-sleeping-${Date.now()}`,
      sourceOwnPhotoId: ownPhoto.id,
      sourceCatId: ownPhoto.catId,
      src: ownPhoto.src,
      title,
      subtitle,
      tags,
    };

    writeStorageArrayWithFallback(
      SHARED_EXCHANGE_PHOTO_STORAGE_KEY,
      [sharedPhoto, ...current],
      [60, 40, 30, 20, 12, 6, 1],
    );

    return sharedPhoto;
  } catch {
    // Sharing is optional, so keep the main recording flow alive.
    return null;
  }
}

export function saveSharedExchangeStockPhoto({
  src,
  title = "ほかの猫のねがお",
  subtitle = "",
  tags = ["sleeping", "ねてる"],
}: {
  src: string;
  title?: string;
  subtitle?: string;
  tags?: readonly string[];
}) {
  try {
    const current = readSharedExchangePhotos();
    const createdAt = Date.now();
    const sharedPhoto: ExchangePhotoPoolItem = {
      id: `stock-sleeping-${createdAt}-${Math.random().toString(16).slice(2)}`,
      sourceCatId: "admin-stock",
      src,
      title,
      subtitle,
      tags,
    };
    const savedPhotos = writeStorageArrayWithFallback(
      SHARED_EXCHANGE_PHOTO_STORAGE_KEY,
      [sharedPhoto, ...current],
      [60, 40, 30, 20, 12, 6, 1],
    );

    dispatchBoxPhotoStorageEvent();
    return savedPhotos.some((photo) => photo.id === sharedPhoto.id)
      ? sharedPhoto
      : null;
  } catch {
    return null;
  }
}

export function readBlockedExchangePhotoIds() {
  const blockedIds = new Set<string>();

  addExchangePhotoIdsFromStorage(blockedIds, KEPT_EXCHANGE_PHOTO_STORAGE_KEY);
  addExchangePhotoIdsFromStorage(blockedIds, DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY);
  addExchangePhotoIdsFromStorage(blockedIds, REPORTED_EXCHANGE_PHOTO_STORAGE_KEY);

  return blockedIds;
}

export function isExchangePoolItemBlocked(
  photo: ExchangePhotoPoolItem,
  blockedIds: Set<string>,
) {
  return (
    blockedIds.has(photo.id) ||
    Boolean(photo.sourceOwnPhotoId && blockedIds.has(photo.sourceOwnPhotoId))
  );
}

export function selectDeliverableSleepingPhoto({
  triggerLabel,
  theme,
  category,
  seed,
  excludePhotoId,
  recipientCatId,
}: DeliverableSleepingPhotoInput): DeliverableSleepingPhotoResult {
  const normalizedTheme = theme.toLowerCase();
  const blockedPhotoIds = readBlockedExchangePhotoIds();
  const allSharedPhotos = readSharedExchangePhotos().filter(
    (photo) =>
      photo.id !== excludePhotoId &&
      photo.sourceOwnPhotoId !== excludePhotoId,
  );
  const sharedPool = allSharedPhotos.filter(
    (photo) =>
      photo.sourceCatId !== recipientCatId &&
      !isExchangePoolItemBlocked(photo, blockedPhotoIds),
  );
  const relaxedUnblockedPool =
    sharedPool.length > 0
      ? sharedPool
      : allSharedPhotos.filter(
          (photo) => !isExchangePoolItemBlocked(photo, blockedPhotoIds),
        );
  const relaxedRepeatablePool =
    relaxedUnblockedPool.length > 0 ? relaxedUnblockedPool : allSharedPhotos;
  const sharedCandidates = sharedPool.filter((photo) =>
    photo.tags.some(
      (tag) =>
        tag.toLowerCase() === normalizedTheme ||
        tag === triggerLabel ||
        tag === category,
    ),
  );
  const relaxedCandidates = relaxedRepeatablePool.filter((photo) =>
    photo.tags.some(
      (tag) =>
        tag.toLowerCase() === normalizedTheme ||
        tag === triggerLabel ||
        tag === category,
    ),
  );
  const selection =
    sharedCandidates.length > 0
      ? { pool: sharedCandidates, source: "shared" as const }
      : relaxedCandidates.length > 0
        ? { pool: relaxedCandidates, source: "shared" as const }
        : { pool: relaxedRepeatablePool, source: "shared" as const };

  if (selection.pool.length === 0) {
    return { photo: null, source: "none" };
  }

  const index =
    hashText(`${seed}:${triggerLabel}:${theme}`) % selection.pool.length;

  return {
    photo: selection.pool[index],
    source: selection.source,
  };
}

export function dispatchBoxPhotoStorageEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(BOX_PHOTO_STORAGE_EVENT));
}

function addSharedSleepingPhoto(photo: OwnSleepingPhoto) {
  const sharedPhotos = readSharedExchangePhotos();

  if (sharedPhotos.some((sharedPhoto) => sharedPhoto.src === photo.src)) {
    return;
  }

  const sharedPhoto: ExchangePhotoPoolItem = {
    id: `shared-sleeping-${Date.now()}`,
    sourceOwnPhotoId: photo.id,
    sourceCatId: photo.catId,
    src: photo.src,
    title: "とったねがお",
    subtitle: "",
    tags: ["sleeping", "ねてる"],
  };

  writeStorageArray(
    SHARED_EXCHANGE_PHOTO_STORAGE_KEY,
    [sharedPhoto, ...sharedPhotos].slice(0, 30),
  );
}

function removeSharedSleepingPhoto(photo: OwnSleepingPhoto) {
  const sharedPhotos = readStorageArray<ExchangePhotoPoolItem>(
    SHARED_EXCHANGE_PHOTO_STORAGE_KEY,
  );
  const nextPhotos = sharedPhotos.filter(
    (sharedPhoto) =>
      sharedPhoto.sourceOwnPhotoId !== photo.id && sharedPhoto.src !== photo.src,
  );

  writeStorageArray(SHARED_EXCHANGE_PHOTO_STORAGE_KEY, nextPhotos);
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

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
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
  return Boolean(typeof photo.id === "string" && typeof photo.src === "string");
}

function isValidExchangePhotoPoolItem(
  photo: Partial<ExchangePhotoPoolItem>,
): photo is ExchangePhotoPoolItem {
  return Boolean(
    typeof photo.id === "string" &&
      typeof photo.src === "string" &&
      typeof photo.title === "string" &&
      typeof photo.subtitle === "string" &&
      Array.isArray(photo.tags),
  );
}
