import {
  getStoragePhotoPath,
  isUsablePhotoSrc,
  normalizePersistentPhotoSrc,
} from "../photoStorage";
import {
  completePhotoSourceSet,
  getPhotoContentIdentityKeys,
  getPhotoIdentityKeys,
} from "../photoSources";
import { purgePhotoSwCacheForSources } from "../photoSwCache";
import {
  readCachedPhotoHistoryEntries,
  removePhotoHistoryEntry,
  upsertPhotoHistoryEntries,
} from "../photoHistoryLedger";
import { readCachedJson, writeCachedJson } from "../storage";
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
  width?: number;
  height?: number;
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
  offlineSrc?: string;
  width?: number;
  height?: number;
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
  width?: number;
  height?: number;
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
  captureContext?: "daily" | "onboarding";
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

type ExchangePhotoOfflineCacheEntry = {
  photoId: string;
  sourcePhotoId?: string;
  dataUrl: string;
  updatedAt: number;
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
const EXCHANGE_PHOTO_OFFLINE_CACHE_STORAGE_KEY =
  "neteruneko_exchange_photo_offline_cache";
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
  const photos = readAllOwnSleepingPhotos().filter(isRegularOwnSleepingPhoto);

  const activeCatPhotos = activeCatId
    ? photos.filter((photo) => photo.ownerCatId === activeCatId)
    : photos;

  return (activeCatPhotos.length > 0 ? activeCatPhotos : photos).slice(0, 24);
}

export function readOwnSleepingPhotosForSync() {
  return readAllOwnSleepingPhotos().filter(isRegularOwnSleepingPhoto);
}

export function readOwnSleepingPhotosForAlbum(activeCatId: string | null = null) {
  const photos = dedupeOwnSleepingPhotosForAlbum(readAllOwnSleepingPhotos());

  const activeCatPhotos = activeCatId
    ? photos.filter((photo) => photo.ownerCatId === activeCatId)
    : photos;

  return activeCatPhotos.length > 0 ? activeCatPhotos : photos;
}

function dedupeOwnSleepingPhotosForAlbum(photos: OwnSleepingPhoto[]) {
  const seenContent = new Map<string, boolean>();
  const seenOnboardingDates = new Set<string>();

  return photos.filter((photo) => {
    const ownerCatId = photo.ownerCatId ?? photo.catId;
    const date = new Date(photo.createdAt + 9 * 60 * 60 * 1000);
    const dateKey = date.toISOString().slice(0, 10);
    if (photo.captureContext === "onboarding") {
      if (seenOnboardingDates.has(dateKey)) {
        return false;
      }

      seenOnboardingDates.add(dateKey);
    }
    const contentKeys = getPhotoContentIdentityKeys(photo).map(
      (key) => `${ownerCatId}:${dateKey}:${key}`,
    );

    if (contentKeys.length === 0) {
      return true;
    }

    const isOnboardingPhoto = photo.captureContext === "onboarding";
    const matchesOnboardingPhoto = contentKeys.some(
      (key) => seenContent.get(key) === true,
    );
    if (
      contentKeys.some((key) => seenContent.has(key)) &&
      (isOnboardingPhoto || matchesOnboardingPhoto)
    ) {
      return false;
    }

    for (const key of contentKeys) {
      seenContent.set(key, seenContent.get(key) === true || isOnboardingPhoto);
    }
    return true;
  });
}

export function readAllOwnSleepingPhotos() {
  const cachedPhotos = readStorageArray<OwnSleepingPhoto>(
    OWN_SLEEPING_PHOTO_STORAGE_KEY,
  )
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto);
  const ledgerPhotos = readCachedPhotoHistoryEntries<OwnSleepingPhoto>("own")
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto);

  return mergeOwnSleepingPhotos(cachedPhotos, ledgerPhotos);
}

export function isOnboardingOwnSleepingPhoto(
  photo: Pick<OwnSleepingPhoto, "id"> &
    Partial<Pick<OwnSleepingPhoto, "captureContext">>,
) {
  return photo.captureContext === "onboarding" || isOnboardingOwnSleepingPhotoId(photo.id);
}

function isRegularOwnSleepingPhoto(photo: OwnSleepingPhoto) {
  return !isOnboardingOwnSleepingPhoto(photo);
}

export function readOwnSleepingPhotoCount(activeCatId: string | null) {
  const photos = readAllOwnSleepingPhotos();

  if (activeCatId) {
    return getOwnSleepingPhotoCountForCat(activeCatId, photos);
  }

  const stats = readCatSleepingStats();
  const onboardingCountByCat = photos.reduce<Record<string, number>>(
    (counts, photo) => {
      if (isOnboardingOwnSleepingPhoto(photo)) {
        const catId = photo.ownerCatId ?? photo.catId;
        counts[catId] = (counts[catId] ?? 0) + 1;
      }
      return counts;
    },
    {},
  );
  const statTotal = Object.values(stats).reduce(
    (total, stat) => total + Math.max(0, stat.takenCount ?? 0),
    0,
  );
  const onboardingTotal = Object.values(onboardingCountByCat).reduce(
    (total, count) => total + count,
    0,
  );

  return Math.max(
    Math.max(0, statTotal - onboardingTotal),
    photos.filter(isRegularOwnSleepingPhoto).length,
  );
}

export function readCatSleepingMilestones(
  activeCatId: string | null,
): CatSleepingMilestone[] {
  if (!activeCatId) {
    return createEmptyCatSleepingMilestones();
  }

  const stored = readCatSleepingMilestoneStore()[activeCatId] ?? [];
  const byTarget = new Map<CatSleepingMilestoneTarget, CatSleepingMilestone>();

  const photos = readStorageArray<OwnSleepingPhoto>(OWN_SLEEPING_PHOTO_STORAGE_KEY)
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto)
    .filter(isRegularOwnSleepingPhoto)
    .filter((photo) => photo.ownerCatId === activeCatId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const regularPhotoIds = new Set(photos.map((photo) => photo.id));

  for (const milestone of stored) {
    if (
      isValidCatSleepingMilestone(milestone) &&
      !isOnboardingOwnSleepingPhotoId(milestone.photoId) &&
      (regularPhotoIds.size === 0 || regularPhotoIds.has(milestone.photoId))
    ) {
      byTarget.set(milestone.target, milestone);
    }
  }

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
  void upsertPhotoHistoryEntries("own", restoredOwnPhotos).catch(() => undefined);
  void upsertPhotoHistoryEntries("kept", restoredKeptPhotos).catch(
    () => undefined,
  );
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
  return photos
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto)
    .filter(isRegularOwnSleepingPhoto).length;
}

type CatSleepingStatsStore = Record<string, { takenCount: number }>;
type CatSleepingMilestoneStore = Record<string, CatSleepingMilestone[]>;

function getOwnSleepingPhotoCountForCat(
  activeCatId: string,
  photos: OwnSleepingPhoto[],
) {
  const storedCount =
    readCatSleepingStats()[activeCatId]?.takenCount ?? 0;
  const normalizedPhotos = photos
    .filter(isValidOwnSleepingPhoto)
    .map(normalizeOwnSleepingPhoto);
  const onboardingCount = normalizedPhotos.filter(
    (photo) =>
      (photo.ownerCatId ?? photo.catId) === activeCatId &&
      isOnboardingOwnSleepingPhoto(photo),
  ).length;
  const visibleCount = normalizedPhotos.filter(
    (photo) =>
      (photo.ownerCatId ?? photo.catId) === activeCatId &&
      isRegularOwnSleepingPhoto(photo),
  ).length;

  return Math.max(Math.max(0, storedCount - onboardingCount), visibleCount);
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
  void upsertPhotoHistoryEntries("own", normalizedPhotos).catch(() => undefined);
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

export async function saveOwnSleepingPhoto({
  photoId,
  catId,
  src,
  thumbnailSrc,
  displaySrc,
  originalSrc,
  width,
  height,
  triggerLabel,
  theme,
  shared,
  captureContext = "daily",
  minRetainedCount = 1,
}: {
  photoId?: string;
  catId: string;
  src: string;
  thumbnailSrc?: string | null;
  displaySrc?: string | null;
  originalSrc?: string | null;
  width?: number | null;
  height?: number | null;
  triggerLabel: string;
  theme: string;
  shared: boolean;
  captureContext?: OwnSleepingPhoto["captureContext"];
  minRetainedCount?: number;
}) {
  if (!isUsablePhotoSrc(src)) {
    return null;
  }

  try {
    const saved = readAllOwnSleepingPhotos();
    const previousTakenCount = getOwnSleepingPhotoCountForCat(catId, saved);
    const existingPhoto = photoId
      ? saved.find((photo) => photo.id === photoId)
      : undefined;
    const createdAt = existingPhoto?.createdAt ?? Date.now();
    const normalizedThumbnailSrc = normalizeOptionalPhotoSrc(thumbnailSrc);
    const normalizedDisplaySrc = normalizeOptionalPhotoSrc(displaySrc);
    const normalizedOriginalSrc = normalizeOptionalPhotoSrc(originalSrc);
    const ownPhoto: OwnSleepingPhoto = {
      id: photoId ?? createOwnSleepingPhotoId(createdAt),
      ownerCatId: catId,
      catId,
      src,
      ...(normalizedThumbnailSrc ? { thumbnailSrc: normalizedThumbnailSrc } : {}),
      ...(normalizedDisplaySrc ? { displaySrc: normalizedDisplaySrc } : {}),
      ...(normalizedOriginalSrc ? { originalSrc: normalizedOriginalSrc } : {}),
      ...(isValidPhotoDimension(width) ? { width } : {}),
      ...(isValidPhotoDimension(height) ? { height } : {}),
      state: "sleeping",
      visibility: shared ? "shared" : "private",
      deliveryStatus: "available",
      triggerLabel,
      theme,
      shared,
      createdAt,
      captureContext,
    };
    const normalizedOwnPhoto = normalizeOwnSleepingPhoto(ownPhoto);
    const nextPhotos = [
      normalizedOwnPhoto,
      ...saved.filter((photo) => photo.id !== normalizedOwnPhoto.id),
    ];
    let wasSavedDurably = false;
    try {
      await upsertPhotoHistoryEntries("own", [normalizedOwnPhoto]);
      wasSavedDurably = true;
    } catch {
      // The compact local cache remains a fallback when IndexedDB is unavailable.
    }
    const savedPhotos = writeStorageArrayWithFallback(
      OWN_SLEEPING_PHOTO_STORAGE_KEY,
      nextPhotos,
      [24, 12, 6, 1],
      minRetainedCount,
    );

    if (
      wasSavedDurably ||
      savedPhotos.some((photo) => photo.id === normalizedOwnPhoto.id)
    ) {
      if (!existingPhoto && isRegularOwnSleepingPhoto(normalizedOwnPhoto)) {
        recordOwnSleepingPhotoTaken(normalizedOwnPhoto, previousTakenCount + 1);
      }
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
    const photos = readAllOwnSleepingPhotos();
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
    if (updatedTargetPhoto) {
      void upsertPhotoHistoryEntries("own", [updatedTargetPhoto]).catch(
        () => undefined,
      );
    }

    dispatchBoxPhotoStorageEvent();
    return updatedTargetPhoto;
  } catch {
    // Local MVP storage should not block album use.
  }

  return null;
}

export async function deleteOwnSleepingPhoto(photoId: string) {
  let targetPhoto: OwnSleepingPhoto | undefined;
  let photos: OwnSleepingPhoto[] = [];

  try {
    photos = readAllOwnSleepingPhotos();
    targetPhoto = photos.find((photo) => photo.id === photoId);

    if (!targetPhoto) {
      return true;
    }

    await removePhotoHistoryEntry("own", targetPhoto);
    writeStorageArray(
      OWN_SLEEPING_PHOTO_STORAGE_KEY,
      photos.filter((photo) => photo.id !== photoId),
    );
    purgePhotoSwCacheForSources(
      [
        targetPhoto.src,
        targetPhoto.thumbnailSrc,
        targetPhoto.displaySrc,
        targetPhoto.originalSrc,
      ],
      "own_photo_deleted",
    );
    dispatchBoxPhotoStorageEvent();
    return true;
  } catch {
    if (targetPhoto) {
      await upsertPhotoHistoryEntries("own", [targetPhoto]).catch(() => undefined);
      try {
        writeStorageArray(OWN_SLEEPING_PHOTO_STORAGE_KEY, photos);
      } catch {
        // Keep the durable copy as the source of truth when local cache recovery fails.
      }
    }
    return false;
  }
}

export function updateOwnSleepingPhotoDimensions(
  photo: Pick<OwnSleepingPhoto, "id" | "sourceMomentId">,
  size: { width: number; height: number },
) {
  if (!isValidPhotoDimension(size.width) || !isValidPhotoDimension(size.height)) {
    return false;
  }

  const photos = readAllOwnSleepingPhotos();
  const targetIndex = photos.findIndex(
    (candidate) =>
      candidate.id === photo.id ||
      Boolean(
        photo.sourceMomentId &&
          candidate.sourceMomentId === photo.sourceMomentId,
      ),
  );
  if (targetIndex < 0) {
    return false;
  }

  const updatedPhoto = {
    ...photos[targetIndex],
    width: size.width,
    height: size.height,
  };
  const nextPhotos = photos.map((candidate, index) =>
    index === targetIndex ? updatedPhoto : candidate,
  );

  void upsertPhotoHistoryEntries("own", [updatedPhoto]).catch(() => undefined);
  writeStorageArrayWithFallback(
    OWN_SLEEPING_PHOTO_STORAGE_KEY,
    nextPhotos,
    [24, 12, 6, 1],
  );
  dispatchBoxPhotoStorageEvent();
  return true;
}

export function readKeptExchangePhotos() {
  return readAllKeptExchangePhotos().slice(0, 50);
}

export function readAllKeptExchangePhotos() {
  return mergeExchangePhotos(
    [],
    [
      ...readStorageArray<ExchangePhoto>(KEPT_EXCHANGE_PHOTO_STORAGE_KEY),
      ...readCachedPhotoHistoryEntries<ExchangePhoto>("kept"),
    ],
  )
    .map(withExchangePhotoOfflineSrc);
}

export function readKeptExchangePhotosForSync() {
  return readAllKeptExchangePhotos();
}

export function readKeptExchangePhotosForAlbum() {
  return readAllKeptExchangePhotos();
}

export function persistOwnSleepingPhotoHistory(photo: OwnSleepingPhoto) {
  return upsertPhotoHistoryEntries("own", [normalizeOwnSleepingPhoto(photo)]);
}

export function persistKeptExchangePhotoHistory(photo: ExchangePhoto) {
  const normalized = sanitizeExchangePhotoForPersistence(photo);

  return normalized
    ? upsertPhotoHistoryEntries("kept", [normalized])
    : Promise.reject(new Error("invalid_kept_exchange_photo"));
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
    const existingPhotos = readAllKeptExchangePhotos();
    const contentDuplicate = existingPhotos.find((savedPhoto) =>
      hasMatchingPhotoContent(savedPhoto, persistentPhoto),
    );
    const photoToStore = contentDuplicate
      ? mergeExchangePhotoVersions(contentDuplicate, persistentPhoto)
      : persistentPhoto;
    const saved = existingPhotos.filter(
      (savedPhoto) =>
        savedPhoto.id !== photoToStore.id &&
        (!photoToStore.sourcePhotoId ||
          savedPhoto.sourcePhotoId !== photoToStore.sourcePhotoId) &&
        !hasMatchingPhotoContent(savedPhoto, photoToStore),
    );
    const savedPhotos = writeStorageArrayWithFallback(
      KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
      [photoToStore, ...saved],
      [50, 30, 20, 12, 6, 1],
    );
    void upsertPhotoHistoryEntries("kept", [photoToStore]).catch(
      () => undefined,
    );

    if (
      savedPhotos.some(
        (savedPhoto) =>
          savedPhoto.id === photoToStore.id ||
          Boolean(
            photoToStore.sourcePhotoId &&
              savedPhoto.sourcePhotoId === photoToStore.sourcePhotoId,
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
    const status = cacheExchangePhotoOfflineDataUrl(target, dataUrl);

    recordDeliveryStorageWritebackTrace({
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      status,
    });

    if (status === "saved") {
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

export function updateKeptExchangePhotoDimensions(
  photo: Pick<ExchangePhoto, "id" | "sourcePhotoId">,
  size: { width: number; height: number },
) {
  if (!isValidPhotoDimension(size.width) || !isValidPhotoDimension(size.height)) {
    return false;
  }

  const saved = readAllKeptExchangePhotos();
  const targetIndex = saved.findIndex((savedPhoto) =>
    getPhotoIdentityKeys(savedPhoto).some((key) =>
      getPhotoIdentityKeys({ ...photo, src: "" }).includes(key),
    ),
  );
  if (targetIndex < 0) {
    return false;
  }

  const updatedPhoto = {
    ...saved[targetIndex],
    width: size.width,
    height: size.height,
  };
  const nextPhotos = saved.map((savedPhoto, index) =>
    index === targetIndex ? updatedPhoto : savedPhoto,
  );

  void upsertPhotoHistoryEntries("kept", [updatedPhoto]).catch(() => undefined);
  writeStorageArrayWithFallback(
    KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
    nextPhotos,
    [50, 30, 20, 12, 6, 1],
  );
  dispatchBoxPhotoStorageEvent();
  return true;
}

export function cacheExchangePhotoOfflineDataUrl(
  photo: Pick<ExchangePhoto, "id" | "sourcePhotoId">,
  dataUrl: string,
) {
  if (!dataUrl.startsWith("data:image/")) {
    return "ignored" as const;
  }

  try {
    const entries = readExchangePhotoOfflineCache();
    const existing = entries.find((entry) => isSameExchangePhoto(entry, photo));
    if (existing && existing.dataUrl.length >= dataUrl.length) {
      return "ignored" as const;
    }

    const nextEntry: ExchangePhotoOfflineCacheEntry = {
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      dataUrl,
      updatedAt: Date.now(),
    };
    const savedEntries = writeStorageArrayWithFallback(
      EXCHANGE_PHOTO_OFFLINE_CACHE_STORAGE_KEY,
      [nextEntry, ...entries.filter((entry) => !isSameExchangePhoto(entry, photo))],
      [8, 4, 2, 1],
    );

    return savedEntries.some(
      (entry) => entry.photoId === photo.id && entry.dataUrl === dataUrl,
    )
      ? ("saved" as const)
      : ("quota" as const);
  } catch {
    return "quota" as const;
  }
}

export function withExchangePhotoOfflineSrc(photo: ExchangePhoto): ExchangePhoto {
  const cached = readExchangePhotoOfflineCache().find((entry) =>
    isSameExchangePhoto(entry, photo),
  );

  if (!cached || (photo.offlineSrc && photo.offlineSrc.length >= cached.dataUrl.length)) {
    return photo;
  }

  return { ...photo, offlineSrc: cached.dataUrl };
}

function readExchangePhotoOfflineCache() {
  return readStorageArray<ExchangePhotoOfflineCacheEntry>(
    EXCHANGE_PHOTO_OFFLINE_CACHE_STORAGE_KEY,
  ).filter(
    (entry) =>
      typeof entry.photoId === "string" &&
      typeof entry.dataUrl === "string" &&
      entry.dataUrl.startsWith("data:image/"),
  );
}

function isSameExchangePhoto(
  entry: Pick<ExchangePhotoOfflineCacheEntry, "photoId" | "sourcePhotoId">,
  photo: Pick<ExchangePhoto, "id" | "sourcePhotoId">,
) {
  return (
    entry.photoId === photo.id ||
    Boolean(
      entry.sourcePhotoId &&
        photo.sourcePhotoId &&
        entry.sourcePhotoId === photo.sourcePhotoId,
    )
  );
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

  return completePhotoSourceSet({
    ...photo,
    src: persistentSrc,
    thumbnailSrc: normalizePersistentExchangePhotoSrc(photo.thumbnailSrc),
    displaySrc: normalizePersistentExchangePhotoSrc(photo.displaySrc),
    originalSrc: normalizePersistentExchangePhotoSrc(photo.originalSrc),
    offlineSrc: normalizePersistentExchangePhotoSrc(photo.offlineSrc),
  });
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
    const photos = readAllKeptExchangePhotos();
    const targetPhoto = photos.find((photo) => photo.id === photoId);
    const nextPhotos = photos.filter((photo) => photo.id !== photoId);

    writeStorageArray(KEPT_EXCHANGE_PHOTO_STORAGE_KEY, nextPhotos);

    if (targetPhoto) {
      void removePhotoHistoryEntry("kept", targetPhoto).catch(() => undefined);
      purgePhotoSwCacheForSources(
        [
          targetPhoto.src,
          targetPhoto.thumbnailSrc,
          targetPhoto.displaySrc,
          targetPhoto.originalSrc,
          targetPhoto.offlineSrc,
        ],
        "reported_hidden",
      );
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
  const photos: Array<ExchangePhoto | null> = [];
  const indexByIdentity = new Map<string, number>();

  for (const photo of [...existingPhotos, ...restoredPhotos]) {
    const normalizedPhoto = sanitizeExchangePhotoForPersistence(photo);
    if (!normalizedPhoto) {
      continue;
    }

    const matchingIndexes = new Set(
      getExchangePhotoIdentityKeys(normalizedPhoto)
        .map((key) => indexByIdentity.get(key))
        .filter((index): index is number => index !== undefined),
    );

    if (matchingIndexes.size === 0) {
      const nextIndex = photos.length;
      photos.push(normalizedPhoto);
      registerExchangePhotoIdentities(
        indexByIdentity,
        normalizedPhoto,
        nextIndex,
      );
      continue;
    }

    const [primaryIndex, ...duplicateIndexes] = [...matchingIndexes];
    let mergedPhoto = photos[primaryIndex] ?? normalizedPhoto;

    for (const duplicateIndex of duplicateIndexes) {
      const duplicatePhoto = photos[duplicateIndex];
      if (!duplicatePhoto) {
        continue;
      }

      mergedPhoto = mergeExchangePhotoVersions(mergedPhoto, duplicatePhoto);
      registerExchangePhotoIdentities(
        indexByIdentity,
        duplicatePhoto,
        primaryIndex,
      );
      photos[duplicateIndex] = null;
    }

    mergedPhoto = mergeExchangePhotoVersions(mergedPhoto, normalizedPhoto);
    photos[primaryIndex] = mergedPhoto;
    registerExchangePhotoIdentities(
      indexByIdentity,
      mergedPhoto,
      primaryIndex,
    );
  }

  return photos
    .filter((photo): photo is ExchangePhoto => Boolean(photo))
    .sort((a, b) => b.deliveredAt - a.deliveredAt);
}

function getExchangePhotoIdentityKeys(photo: ExchangePhoto) {
  return getPhotoIdentityKeys(photo);
}

function hasMatchingPhotoContent(
  first: ExchangePhoto,
  second: ExchangePhoto,
) {
  const firstKeys = new Set(getPhotoContentIdentityKeys(first));

  return getPhotoContentIdentityKeys(second).some((key) => firstKeys.has(key));
}

function registerExchangePhotoIdentities(
  indexByIdentity: Map<string, number>,
  photo: ExchangePhoto,
  index: number,
) {
  for (const key of getExchangePhotoIdentityKeys(photo)) {
    indexByIdentity.set(key, index);
  }
}

function mergeExchangePhotoVersions(
  existing: ExchangePhoto,
  incoming: ExchangePhoto,
) {
  const preferred =
    incoming.deliveredAt >= existing.deliveredAt ? incoming : existing;
  const fallback = preferred === incoming ? existing : incoming;

  return completePhotoSourceSet({
    ...fallback,
    ...preferred,
    sourcePhotoId: preferred.sourcePhotoId ?? fallback.sourcePhotoId,
    thumbnailSrc: preferred.thumbnailSrc ?? fallback.thumbnailSrc,
    displaySrc: preferred.displaySrc ?? fallback.displaySrc,
    originalSrc: preferred.originalSrc ?? fallback.originalSrc,
    offlineSrc: preferred.offlineSrc ?? fallback.offlineSrc,
    width: preferred.width ?? fallback.width,
    height: preferred.height ?? fallback.height,
    deliveredAt: Math.max(existing.deliveredAt, incoming.deliveredAt),
  });
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
    const parsed = readCachedJson<unknown>(key) ?? [];

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
    const parsed = readCachedJson<unknown>(key) ?? {};

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch {
    return {} as T;
  }
}

function writeStorageArray<T>(key: string, value: T[]) {
  writeCachedJson(key, value.map(compactDuplicatePhotoSources));
}

function compactDuplicatePhotoSources<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const compact = { ...(value as Record<string, unknown>) };
  const src = compact.src;

  if (typeof src !== "string") {
    return value;
  }

  for (const key of ["thumbnailSrc", "displaySrc", "originalSrc"] as const) {
    if (compact[key] === src) {
      delete compact[key];
    }
  }

  return compact as T;
}

function writeStorageValue<T>(key: string, value: T) {
  writeCachedJson(key, value);
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

  return completePhotoSourceSet({
    id: photo.id,
    ownerCatId,
    catId: photo.catId ?? ownerCatId,
    src: normalizePersistentPhotoSrc(photo.src) || photo.src,
    ...(thumbnailSrc ? { thumbnailSrc } : {}),
    ...(displaySrc ? { displaySrc } : {}),
    ...(originalSrc ? { originalSrc } : {}),
    ...(isValidPhotoDimension(photo.width) ? { width: photo.width } : {}),
    ...(isValidPhotoDimension(photo.height) ? { height: photo.height } : {}),
    state: photo.state ?? "sleeping",
    visibility: photo.visibility ?? (shared ? "shared" : "private"),
    deliveryStatus: photo.deliveryStatus ?? "available",
    triggerLabel: photo.triggerLabel ?? "ねがお",
    theme: photo.theme ?? "sleeping",
    shared,
    createdAt: photo.createdAt ?? Date.now(),
    sourceMomentId: photo.sourceMomentId,
    captureContext: photo.captureContext === "onboarding" ? "onboarding" : "daily",
  });
}

function isOnboardingOwnSleepingPhotoId(id: string | undefined) {
  return typeof id === "string" && id.startsWith("onboarding-");
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

function isValidPhotoDimension(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
