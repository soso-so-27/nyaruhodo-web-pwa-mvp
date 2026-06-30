import {
  getStoragePhotoPath,
  isUsablePhotoSrc,
  normalizePersistentPhotoSrc,
} from "../photoStorage";
import { recordDeliveryStorageWritebackTrace } from "./eveningDeliveryTrace";

export type CatMomentState = "sleeping";
export type CatMomentVisibility = "private" | "shared";
export type CatMomentDeliveryStatus = "available" | "hidden" | "reported";

export type CatMoment = {
  id: string;
  ownerCatId: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
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
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
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
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  title: string;
  subtitle: string;
  tags: readonly string[];
};

export type OwnSleepingPhoto = CatMoment & {
  id: string;
  catId: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  triggerLabel: string;
  theme: string;
  shared: boolean;
  createdAt: number;
};

export const CAT_SLEEPING_MILESTONE_TARGETS = [1, 10, 50, 100] as const;

export type CatSleepingMilestoneTarget =
  (typeof CAT_SLEEPING_MILESTONE_TARGETS)[number];

export type CatSleepingMilestone = {
  target: CatSleepingMilestoneTarget;
  photoId: string;
  src: string;
  reachedAt: number;
};

export type HiddenExchangePhotoReason = "hide" | "report";
export type ExchangePhotoReportReason = "not_cat" | "uncomfortable" | "other";

type ExchangePhotoHistoryEntry = {
  photoId: string;
  sourcePhotoId?: string;
  reason?: HiddenExchangePhotoReason | ExchangePhotoReportReason;
  createdAt: number;
};

export type DeliverableSleepingPhotoInput = {
  triggerLabel: string;
  theme: string;
  category: string;
  seed: string;
  deliveryDateKey?: string;
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
const CAT_SLEEPING_STATS_STORAGE_KEY = "neteruneko_cat_sleeping_stats";
const CAT_SLEEPING_MILESTONES_STORAGE_KEY =
  "neteruneko_cat_sleeping_milestones";

export function readOwnSleepingPhotos(activeCatId: string | null = null) {
  const photos = readAllOwnSleepingPhotos();

  const activeCatPhotos = activeCatId
    ? photos.filter((photo) => photo.ownerCatId === activeCatId)
    : photos;

  return (activeCatPhotos.length > 0 ? activeCatPhotos : photos).slice(0, 24);
}

export function readAllOwnSleepingPhotos() {
  return readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY)
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto);
}

export function readOwnSleepingPhotoCount(activeCatId: string | null) {
  const photos = readAllOwnSleepingPhotos();

  if (activeCatId) {
    return getOwnSleepingPhotoCountForCat(activeCatId, photos);
  }

  const stats = readCatSleepingStats();
  const statTotal = Object.values(stats).reduce(
    (total, stat) => total + Math.max(0, stat.takenCount ?? 0),
    0,
  );

  return Math.max(statTotal, photos.length);
}

export function readCatSleepingMilestones(
  activeCatId: string | null,
): CatSleepingMilestone[] {
  if (!activeCatId) {
    return createEmptyCatSleepingMilestones();
  }

  const stored = readCatSleepingMilestoneStore()[activeCatId] ?? [];
  const byTarget = new Map<CatSleepingMilestoneTarget, CatSleepingMilestone>();

  for (const milestone of stored) {
    if (isValidCatSleepingMilestone(milestone)) {
      byTarget.set(milestone.target, milestone);
    }
  }

  const photos = readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY)
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto)
    .filter((photo) => photo.ownerCatId === activeCatId)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const target of CAT_SLEEPING_MILESTONE_TARGETS) {
    if (byTarget.has(target)) {
      continue;
    }

    const photo = photos[target - 1];

    if (photo) {
      byTarget.set(target, createCatSleepingMilestone(target, photo));
    }
  }

  return CAT_SLEEPING_MILESTONE_TARGETS.map(
    (target) =>
      byTarget.get(target) ?? {
        target,
        photoId: "",
        src: "",
        reachedAt: 0,
      },
  );
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
  const minimumOwnRetainedCount = mergeLocal
    ? getValidOwnSleepingPhotoCount(existingOwnPhotos)
    : 1;
  const minimumKeptRetainedCount = mergeLocal ? existingKeptPhotos.length : 1;
  const savedOwnPhotos = writeStorageArrayWithFallback(
    OWN_SLEEPING_PHOTO_STORAGE_KEY,
    restoredOwnPhotos,
    [24, 12, 6, 1],
    minimumOwnRetainedCount,
  );
  const savedKeptPhotos = writeStorageArrayWithFallback(
    KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
    restoredKeptPhotos,
    [50, 24, 12, 6, 1],
    minimumKeptRetainedCount,
  );

  if (savedOwnPhotos.length > 0 || savedKeptPhotos.length > 0) {
    dispatchBoxPhotoStorageEvent();
  }

  return {
    ownCount: savedOwnPhotos.length,
    keptCount: savedKeptPhotos.length,
  };
}

function getValidOwnSleepingPhotoCount(photos: OwnSleepingPhoto[]) {
  return photos.filter(isValidOwnSleepingPhoto).length;
}

type CatSleepingStatsStore = Record<string, { takenCount: number }>;
type CatSleepingMilestoneStore = Record<string, CatSleepingMilestone[]>;

function getOwnSleepingPhotoCountForCat(
  activeCatId: string,
  photos: OwnSleepingPhoto[],
) {
  const storedCount =
    readCatSleepingStats()[activeCatId]?.takenCount ?? 0;
  const visibleCount = photos.filter(
    (photo) => photo.ownerCatId === activeCatId,
  ).length;

  return Math.max(storedCount, visibleCount);
}

function recordOwnSleepingPhotoTaken(
  photo: OwnSleepingPhoto,
  nextTakenCount: number,
) {
  const catId = photo.ownerCatId;
  const stats = readCatSleepingStats();
  const currentCount = stats[catId]?.takenCount ?? 0;
  const savedCount = Math.max(currentCount, nextTakenCount);

  writeStorageValue(CAT_SLEEPING_STATS_STORAGE_KEY, {
    ...stats,
    [catId]: { takenCount: savedCount },
  });

  if (!isCatSleepingMilestoneTarget(savedCount)) {
    return;
  }

  const milestoneStore = readCatSleepingMilestoneStore();
  const milestones = milestoneStore[catId] ?? [];

  if (milestones.some((milestone) => milestone.target === savedCount)) {
    return;
  }

  writeStorageValue(CAT_SLEEPING_MILESTONES_STORAGE_KEY, {
    ...milestoneStore,
    [catId]: [
      ...milestones,
      createCatSleepingMilestone(savedCount, photo),
    ].sort((a, b) => a.target - b.target),
  });
}

function createCatSleepingMilestone(
  target: CatSleepingMilestoneTarget,
  photo: OwnSleepingPhoto,
): CatSleepingMilestone {
  return {
    target,
    photoId: photo.id,
    src: photo.src,
    reachedAt: photo.createdAt,
  };
}

function createEmptyCatSleepingMilestones() {
  return CAT_SLEEPING_MILESTONE_TARGETS.map((target) => ({
    target,
    photoId: "",
    src: "",
    reachedAt: 0,
  }));
}

function readCatSleepingStats(): CatSleepingStatsStore {
  return readStorageObject<CatSleepingStatsStore>(
    CAT_SLEEPING_STATS_STORAGE_KEY,
  );
}

function readCatSleepingMilestoneStore(): CatSleepingMilestoneStore {
  return readStorageObject<CatSleepingMilestoneStore>(
    CAT_SLEEPING_MILESTONES_STORAGE_KEY,
  );
}

function isCatSleepingMilestoneTarget(
  value: number,
): value is CatSleepingMilestoneTarget {
  return CAT_SLEEPING_MILESTONE_TARGETS.some((target) => target === value);
}

function isValidCatSleepingMilestone(
  milestone: Partial<CatSleepingMilestone>,
): milestone is CatSleepingMilestone {
  return Boolean(
    isCatSleepingMilestoneTarget(milestone.target ?? 0) &&
      typeof milestone.photoId === "string" &&
      typeof milestone.src === "string" &&
      isUsablePhotoSrc(milestone.src) &&
      typeof milestone.reachedAt === "number" &&
      Number.isFinite(milestone.reachedAt),
  );
}

export function writeOwnSleepingPhotosWithFallback(
  photos: OwnSleepingPhoto[],
  keepCounts = [24, 12, 6, 1],
  minRetainedCount = 1,
) {
  const normalizedPhotos = photos
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto);
  const minimumCount = Math.max(
    1,
    Math.min(minRetainedCount, normalizedPhotos.length),
  );
  const savedPhotos = writeStorageArrayWithFallback(
    OWN_SLEEPING_PHOTO_STORAGE_KEY,
    normalizedPhotos,
    keepCounts,
    minimumCount,
  );

  if (savedPhotos.length > 0) {
    dispatchBoxPhotoStorageEvent();
  }

  return savedPhotos;
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
    thumbnailSrc: normalized.thumbnailSrc,
    displaySrc: normalized.displaySrc,
    originalSrc: normalized.originalSrc,
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
  thumbnailSrc,
  displaySrc,
  originalSrc,
  triggerLabel,
  theme,
  shared,
  minRetainedCount = 1,
}: {
  catId: string;
  src: string;
  thumbnailSrc?: string | null;
  displaySrc?: string | null;
  originalSrc?: string | null;
  triggerLabel: string;
  theme: string;
  shared: boolean;
  minRetainedCount?: number;
}) {
  if (!isUsablePhotoSrc(src)) {
    return null;
  }

  try {
    const saved = readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY)
      .filter(isValidOwnSleepingPhoto)
      .map(normalizeOwnSleepingPhoto);
    const previousTakenCount = getOwnSleepingPhotoCountForCat(catId, saved);
    const createdAt = Date.now();
    const normalizedThumbnailSrc = normalizeOptionalPhotoSrc(thumbnailSrc);
    const normalizedDisplaySrc = normalizeOptionalPhotoSrc(displaySrc);
    const normalizedOriginalSrc = normalizeOptionalPhotoSrc(originalSrc);
    const ownPhoto: OwnSleepingPhoto = {
      id: createOwnSleepingPhotoId(createdAt),
      ownerCatId: catId,
      catId,
      src,
      ...(normalizedThumbnailSrc ? { thumbnailSrc: normalizedThumbnailSrc } : {}),
      ...(normalizedDisplaySrc ? { displaySrc: normalizedDisplaySrc } : {}),
      ...(normalizedOriginalSrc ? { originalSrc: normalizedOriginalSrc } : {}),
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
    const savedPhotos = writeStorageArrayWithFallback(
      OWN_SLEEPING_PHOTO_STORAGE_KEY,
      nextPhotos,
      [24, 12, 6, 1],
      minRetainedCount,
    );

    if (savedPhotos.some((photo) => photo.id === normalizedOwnPhoto.id)) {
      recordOwnSleepingPhotoTaken(normalizedOwnPhoto, previousTakenCount + 1);
      dispatchBoxPhotoStorageEvent();
        return normalizedOwnPhoto;
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
    .map(sanitizeExchangePhotoForPersistence)
    .filter((photo): photo is ExchangePhoto => Boolean(photo))
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
  const persistentPhoto = sanitizeExchangePhotoForPersistence(photo);

  if (!persistentPhoto) {
    return false;
  }

  try {
    const saved = readKeptExchangePhotos().filter(
      (savedPhoto) =>
        savedPhoto.id !== persistentPhoto.id &&
        (!persistentPhoto.sourcePhotoId ||
          savedPhoto.sourcePhotoId !== persistentPhoto.sourcePhotoId),
    );
    const savedPhotos = writeStorageArrayWithFallback(
      KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
      [persistentPhoto, ...saved],
      [50, 30, 20, 12, 6, 1],
    );

    if (
      savedPhotos.some(
        (savedPhoto) =>
          savedPhoto.id === persistentPhoto.id ||
          Boolean(
            persistentPhoto.sourcePhotoId &&
              savedPhoto.sourcePhotoId === persistentPhoto.sourcePhotoId,
          ),
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

export function updateKeptExchangePhotoDataUrl(
  photo: Pick<ExchangePhoto, "id" | "sourcePhotoId">,
  dataUrl: string,
) {
  if (!dataUrl.startsWith("data:image/")) {
    return "ignored" as const;
  }

  try {
    const saved = readKeptExchangePhotos();
    const targetIndex = saved.findIndex(
      (savedPhoto) =>
        savedPhoto.id === photo.id ||
        Boolean(
          photo.sourcePhotoId &&
            savedPhoto.sourcePhotoId === photo.sourcePhotoId,
        ),
    );

    if (targetIndex < 0) {
      return "ignored" as const;
    }

    const target = saved[targetIndex];

    if (target.src === dataUrl) {
      return "ignored" as const;
    }

    const nextPhotos = [...saved];
    nextPhotos[targetIndex] = {
      ...target,
      src: dataUrl,
      thumbnailSrc: dataUrl,
      displaySrc: dataUrl,
      originalSrc: dataUrl,
    };
    const savedPhotos = writeStorageArrayWithFallback(
      KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
      nextPhotos,
      [50, 30, 20, 12, 6, 1],
      saved.length,
    );
    const didSave = savedPhotos.some(
      (savedPhoto) => savedPhoto.id === target.id && savedPhoto.src === dataUrl,
    );
    const status = didSave ? "saved" : "quota";

    recordDeliveryStorageWritebackTrace({
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      status,
    });

    if (didSave) {
      dispatchBoxPhotoStorageEvent();
    }

    return status;
  } catch {
    recordDeliveryStorageWritebackTrace({
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      status: "quota",
    });
    return "quota" as const;
  }
}

function normalizePersistentExchangePhotoSrc(src: string | undefined) {
  if (!src) {
    return undefined;
  }

  const normalized = normalizePersistentPhotoSrc(src);
  if (!normalized || isHttpPhotoSrc(normalized)) {
    return undefined;
  }

  return isUsablePhotoSrc(normalized) ? normalized : undefined;
}

export function sanitizeExchangePhotoForPersistence(
  photo: ExchangePhoto | null | undefined,
): ExchangePhoto | null {
  if (!photo || typeof photo.id !== "string" || typeof photo.src !== "string") {
    return null;
  }

  const persistentSrc = normalizePersistentPhotoSrc(photo.src);

  if (
    !persistentSrc ||
    isHttpPhotoSrc(persistentSrc) ||
    !isUsablePhotoSrc(persistentSrc)
  ) {
    return null;
  }

  return {
    ...photo,
    src: persistentSrc,
    thumbnailSrc: normalizePersistentExchangePhotoSrc(photo.thumbnailSrc),
    displaySrc: normalizePersistentExchangePhotoSrc(photo.displaySrc),
    originalSrc: normalizePersistentExchangePhotoSrc(photo.originalSrc),
  };
}

function isHttpPhotoSrc(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
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
    const saved = readStorageArray<ExchangePhotoHistoryEntry>(
      DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY,
    );
    const dismissed: ExchangePhotoHistoryEntry = {
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      createdAt: Date.now(),
    };

    writeStorageArray(
      DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY,
      [dismissed, ...saved].slice(0, 80),
    );
  } catch {
    // Dismiss history only helps avoid repeats; failure should not block closing.
  }
}

export function reportExchangePhoto(
  photo: ExchangePhoto,
  reason: ExchangePhotoReportReason = "other",
) {
  try {
    const reported = readStorageArray<ExchangePhotoHistoryEntry>(
      REPORTED_EXCHANGE_PHOTO_STORAGE_KEY,
    );
    const dismissed = readStorageArray<ExchangePhotoHistoryEntry>(
      DISMISSED_EXCHANGE_PHOTO_STORAGE_KEY,
    );
    const createdAt = Date.now();
    const reportedPhoto: ExchangePhotoHistoryEntry = {
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      reason,
      createdAt,
    };
    const dismissedPhoto: ExchangePhotoHistoryEntry = {
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      reason: "report",
      createdAt,
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
      const history = readStorageArray<ExchangePhotoHistoryEntry>(historyKey);
      const historyPhoto: ExchangePhotoHistoryEntry = {
        photoId: targetPhoto.id,
        sourcePhotoId: targetPhoto.sourcePhotoId,
        reason,
        createdAt: Date.now(),
      };

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

  for (const photo of existingPhotos) {
    if (!isValidOwnSleepingPhoto(photo)) {
      continue;
    }

    const normalized = normalizeOwnSleepingPhoto(photo);
    byId.set(normalized.id, normalized);
  }

  for (const photo of restoredPhotos) {
    if (!isValidOwnSleepingPhoto(photo)) {
      continue;
    }

    const restored = normalizeOwnSleepingPhoto(photo);
    const existing = byId.get(restored.id);
    byId.set(
      restored.id,
      existing ? mergeOwnSleepingPhoto(existing, restored) : restored,
    );
  }

  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function createOwnSleepingPhotoId(createdAt: number) {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(16).slice(2);

  return `own-sleeping-${createdAt}-${random}`;
}

function mergeOwnSleepingPhoto(
  existing: OwnSleepingPhoto,
  restored: OwnSleepingPhoto,
) {
  if (isDataImageSrc(existing.src) && isStoragePhotoSrc(restored.src)) {
    return {
      ...existing,
      ...restored,
      src: existing.src,
    };
  }

  return restored;
}

function isDataImageSrc(src: string) {
  return src.startsWith("data:image/");
}

function isStoragePhotoSrc(src: string) {
  return getStoragePhotoPath(src) !== null;
}

function mergeExchangePhotos(
  existingPhotos: ExchangePhoto[],
  restoredPhotos: ExchangePhoto[],
) {
  const byId = new Map<string, ExchangePhoto>();

  for (const photo of [...existingPhotos, ...restoredPhotos]) {
    const normalizedPhoto = sanitizeExchangePhotoForPersistence(photo);
    if (!normalizedPhoto) {
      continue;
    }

    byId.set(normalizedPhoto.id, normalizedPhoto);
  }

  return [...byId.values()].sort((a, b) => b.deliveredAt - a.deliveredAt);
}

function addExchangePhotoIdsFromStorage(blockedIds: Set<string>, key: string) {
  const photos = readStorageArray<
    Partial<ExchangePhoto> & Partial<ExchangePhotoHistoryEntry>
  >(key);

  for (const photo of photos) {
    if (typeof photo.sourcePhotoId === "string") {
      blockedIds.add(photo.sourcePhotoId);
    }
    if (typeof photo.photoId === "string") {
      blockedIds.add(photo.photoId);
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

export function isExchangePhotoLocallyBlocked(
  photo: Pick<ExchangePhoto, "id" | "sourcePhotoId">,
) {
  const blockedIds = readBlockedExchangePhotoIds();

  return (
    blockedIds.has(photo.id) ||
    Boolean(photo.sourcePhotoId && blockedIds.has(photo.sourcePhotoId))
  );
}

function readStorageObject<T extends Record<string, unknown>>(key: string): T {
  if (typeof window === "undefined") {
    return {} as T;
  }

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch {
    return {} as T;
  }
}

function writeStorageArray<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function writeStorageValue<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function writeStorageArrayWithFallback<T>(
  key: string,
  value: T[],
  keepCounts: number[],
  minRetainedCount = 1,
) {
  const minimumCount = Math.max(1, Math.min(minRetainedCount, value.length));
  const effectiveKeepCounts = [...new Set([value.length, ...keepCounts])]
    .filter((keepCount) => keepCount > 0)
    .sort((a, b) => b - a);

  for (const keepCount of effectiveKeepCounts) {
    const nextValue = value.slice(0, keepCount);

    if (nextValue.length < minimumCount) {
      continue;
    }

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
      typeof photo.src === "string" &&
      isUsablePhotoSrc(photo.src),
  );
}

function normalizeOwnSleepingPhoto(photo: OwnSleepingPhoto): OwnSleepingPhoto {
  const ownerCatId = photo.ownerCatId ?? photo.catId;
  const shared = photo.shared ?? photo.visibility === "shared";
  const thumbnailSrc = normalizeOptionalPhotoSrc(photo.thumbnailSrc);
  const displaySrc = normalizeOptionalPhotoSrc(photo.displaySrc);
  const originalSrc = normalizeOptionalPhotoSrc(photo.originalSrc);

  return {
    id: photo.id,
    ownerCatId,
    catId: photo.catId ?? ownerCatId,
    src: normalizePersistentPhotoSrc(photo.src) || photo.src,
    ...(thumbnailSrc ? { thumbnailSrc } : {}),
    ...(displaySrc ? { displaySrc } : {}),
    ...(originalSrc ? { originalSrc } : {}),
    state: photo.state ?? "sleeping",
    visibility: photo.visibility ?? (shared ? "shared" : "private"),
    deliveryStatus: photo.deliveryStatus ?? "available",
    triggerLabel: photo.triggerLabel ?? "ねがお",
    theme: photo.theme ?? "sleeping",
    shared,
    createdAt: photo.createdAt ?? Date.now(),
    sourceMomentId: photo.sourceMomentId,
  };
}

function isValidExchangePhoto(photo: Partial<ExchangePhoto>) {
  return Boolean(
    typeof photo.id === "string" &&
      typeof photo.src === "string" &&
      isUsablePhotoSrc(photo.src),
  );
}

function normalizeOptionalPhotoSrc(src: string | null | undefined) {
  if (typeof src !== "string") {
    return null;
  }

  const normalized = normalizePersistentPhotoSrc(src);
  return normalized && isUsablePhotoSrc(normalized) ? normalized : null;
}
