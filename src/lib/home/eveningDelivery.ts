import { STORAGE_KEYS, readCachedJson, writeCachedJson } from "../storage";
import { trackProductEvent } from "../analytics/productAnalytics";
import {
  cacheExchangePhotoOfflineDataUrl,
  sanitizeExchangePhotoForPersistence,
  withExchangePhotoOfflineSrc,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "./sleepingPhotos";

export const EVENING_DELIVERY_HOUR = 20;
export const EVENING_REVIEW_CUTOFF_HOUR = 19;
export const EVENING_DELIVERY_VISIBLE_THRESHOLD = 30;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type EveningDeliveryBundleMetadata = {
  deliveryBundleId?: string;
  experienceVersion?: string;
  assignedVariant?: string;
  servedVariant?: string;
  requestedCount?: number;
  servedCount?: number;
  fallbackReason?: string | null;
};

export type EveningDeliveryDay = {
  dateKey: string;
  targetOwnPhotoId?: string;
  targetCatId?: string;
  targetCapturedAt?: number;
  targetPhoto?: OwnSleepingPhoto;
  deliveredPhoto?: ExchangePhoto;
  deliveredPhotos?: ExchangePhoto[];
  draftSelectedPhotoId?: string;
  selectedPhotoId?: string;
  deliveredAt?: number;
  openedAt?: number;
  openedBy?: "user" | "system";
  keptAt?: number;
  skippedAt?: number;
} & EveningDeliveryBundleMetadata;

export type EveningDeliveryStore = Record<string, EveningDeliveryDay>;

export type EveningHomeState =
  | {
      kind: "before";
      dateKey: string;
      isTodayDelivery: boolean;
      afterTodayDelivery: boolean;
    }
  | {
      kind: "waiting";
      dateKey: string;
      isTodayDelivery: boolean;
      targetPhoto: OwnSleepingPhoto | null;
    }
  | ({
      kind: "delivered";
      dateKey: string;
      targetPhoto: OwnSleepingPhoto | null;
      deliveredPhoto: ExchangePhoto;
      deliveredPhotos: ExchangePhoto[];
      draftSelectedPhotoId?: string;
    } & EveningDeliveryBundleMetadata)
  | ({
      kind: "opened";
      dateKey: string;
      targetPhoto: OwnSleepingPhoto | null;
      deliveredPhoto: ExchangePhoto;
      deliveredPhotos: ExchangePhoto[];
      draftSelectedPhotoId?: string;
    } & EveningDeliveryBundleMetadata);

export function readEveningDeliveryStore(): EveningDeliveryStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = readCachedJson<unknown>(STORAGE_KEYS.eveningDeliveryDays);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const store: EveningDeliveryStore = {};
    for (const [dateKey, day] of Object.entries(parsed)) {
      if (isValidDateKey(dateKey) && isEveningDeliveryDay(day)) {
        const sanitizedCandidates = sanitizeEveningDeliveredPhotos(
          day.deliveredPhotos,
        );
        const sanitizedDeliveredPhoto = sanitizeExchangePhotoForPersistence(
          day.deliveredPhoto,
        ) ?? readLegacySingleDeliveredPhoto(day.deliveredPhoto, day.deliveredPhotos);
        const hasResolvedSelection = Boolean(day.openedAt || day.selectedPhotoId);
        const hasMalformedBundle = Boolean(
          !hasResolvedSelection &&
            Array.isArray(day.deliveredPhotos) &&
            day.deliveredPhotos.length > 1 &&
            sanitizedCandidates.length !== 4,
        );
        const deliveredPhotos =
          !hasResolvedSelection && sanitizedCandidates.length === 4
            ? sanitizedCandidates.map(withExchangePhotoOfflineSrc)
            : [];
        const canonicalDeliveredPhoto = hasResolvedSelection
          ? sanitizedDeliveredPhoto ??
            sanitizedCandidates.find((photo) =>
              matchesExchangePhotoId(photo, day.selectedPhotoId ?? ""),
            ) ??
            sanitizedCandidates[0]
          : deliveredPhotos[0] ??
            sanitizedDeliveredPhoto ??
            sanitizedCandidates[0];
        const deliveredPhoto = canonicalDeliveredPhoto
          ? withExchangePhotoOfflineSrc(canonicalDeliveredPhoto)
          : undefined;
        const draftSelectedPhotoId =
          !hasResolvedSelection &&
          deliveredPhotos.some((photo) =>
            matchesExchangePhotoId(photo, day.draftSelectedPhotoId ?? ""),
          )
            ? day.draftSelectedPhotoId
            : undefined;

        store[dateKey] = {
          ...day,
          dateKey,
          deliveredPhoto,
          deliveredPhotos:
            deliveredPhotos.length === 4 ? deliveredPhotos : undefined,
          draftSelectedPhotoId,
          ...(hasMalformedBundle
            ? {
                servedVariant: "single_v1",
                servedCount: deliveredPhoto ? 1 : 0,
                fallbackReason:
                  day.fallbackReason ?? "client_persistence_filter",
              }
            : {}),
        };
      }
    }

    return store;
  } catch {
    return {};
  }
}

export function getFirstEveningDeliveryTargetDateKey(): string | null {
  const store = readEveningDeliveryStore();
  const targetDateKeys = Object.values(store)
    .filter((day) => Boolean(day.targetOwnPhotoId))
    .map((day) => day.dateKey)
    .filter(isValidDateKey)
    .sort();

  return targetDateKeys[0] ?? null;
}

export function isFirstEveningDelivery(dateKey: string) {
  const deliveredDateKeys = Object.values(readEveningDeliveryStore())
    .filter((day) => hasEveningDeliveryArrival(day) || Boolean(day.deliveredAt))
    .map((day) => day.dateKey)
    .sort();

  return deliveredDateKeys[0] === dateKey;
}

export function getSystemOpenedEveningDeliveryNotice(now = Date.now()) {
  autoOpenExpiredEveningDeliveries(now);
  const todayKey = getJstDateKey(now);
  const todayStart = getJstDayStartTime(todayKey);
  const noticeStart = todayStart + 5 * 60 * 60 * 1000;
  const nextDelivery = todayStart + EVENING_DELIVERY_HOUR * 60 * 60 * 1000;

  if (now < noticeStart || now >= nextDelivery) {
    return null;
  }

  const day = Object.values(readEveningDeliveryStore())
    .filter(
      (candidate) =>
        candidate.openedBy === "system" &&
        Boolean(candidate.deliveredPhoto) &&
        typeof candidate.openedAt === "number" &&
        candidate.openedAt >= noticeStart &&
        candidate.openedAt < nextDelivery,
    )
    .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))[0];

  return day?.deliveredPhoto
    ? { dateKey: day.dateKey, deliveredPhoto: day.deliveredPhoto }
    : null;
}

export function writeEveningDeliveryStore(store: EveningDeliveryStore) {
  if (typeof window === "undefined") {
    return false;
  }

  for (const keepCount of [90, 30, 7, 1]) {
    try {
      writeCachedJson(
        STORAGE_KEYS.eveningDeliveryDays,
        pruneEveningDeliveryStore(store, keepCount),
      );
      window.dispatchEvent(new Event("neteruneko_evening_delivery_updated"));
      return true;
    } catch {
      // Keep the newest delivery state when localStorage is nearly full.
    }
  }

  return false;
}

export function recordEveningDeliveryTarget(
  ownPhoto: OwnSleepingPhoto,
  now = Date.now(),
) {
  const store = readEveningDeliveryStore();
  const targetDateKey = getEveningDeliveryTargetDateKey(now);
  const day = store[targetDateKey] ?? { dateKey: targetDateKey };
  const canReplaceTarget = !hasEveningDeliveryArrival(day) && !day.openedAt;
  let persisted = false;

  if (canReplaceTarget) {
    store[targetDateKey] = {
      ...day,
      dateKey: targetDateKey,
      targetOwnPhotoId: ownPhoto.id,
      targetCatId: ownPhoto.ownerCatId ?? ownPhoto.catId,
      targetCapturedAt: ownPhoto.createdAt,
    };
    persisted = writeEveningDeliveryStore(store);
    persisted =
      persisted &&
      readEveningDeliveryStore()[targetDateKey]?.targetOwnPhotoId === ownPhoto.id;
  }

  return {
    dateKey: targetDateKey,
    isExchangeTarget: canReplaceTarget && persisted,
    isTodayDelivery: targetDateKey === getJstDateKey(now),
    persisted,
    targetSaveFailed: canReplaceTarget && !persisted,
  };
}

export function recordOnboardingEveningDeliveryTarget(
  ownPhoto: OwnSleepingPhoto,
  now = Date.now(),
) {
  const intendedDateKey = getEveningDeliveryTargetDateKey(ownPhoto.createdAt);

  if (now >= getJstAutoOpenTime(intendedDateKey)) {
    return null;
  }

  const existingDay = readEveningDeliveryStore()[intendedDateKey];
  if (existingDay?.targetOwnPhotoId) {
    const isSameTarget = existingDay.targetOwnPhotoId === ownPhoto.id;
    return {
      dateKey: intendedDateKey,
      isExchangeTarget: isSameTarget,
      isTodayDelivery: intendedDateKey === getJstDateKey(now),
      persisted: true,
      targetSaveFailed: false,
      alreadyReserved: true,
      outcome: isSameTarget
        ? ("already_reserved" as const)
        : ("existing_target_preserved" as const),
    };
  }

  const recorded = recordEveningDeliveryTarget(ownPhoto, ownPhoto.createdAt);
  return {
    ...recorded,
    alreadyReserved: false,
    outcome: recorded.isExchangeTarget
      ? ("reserved" as const)
      : recorded.targetSaveFailed
        ? ("write_failed" as const)
        : ("delivery_slot_unavailable" as const),
  };
}

export function clearEveningDeliveryTargetForPhoto(photoId: string) {
  const store = readEveningDeliveryStore();
  let changed = false;

  for (const [dateKey, day] of Object.entries(store)) {
    if (
      day.targetOwnPhotoId !== photoId ||
      hasEveningDeliveryArrival(day) ||
      day.openedAt
    ) {
      continue;
    }

    const {
      targetOwnPhotoId: _targetOwnPhotoId,
      targetCatId: _targetCatId,
      targetCapturedAt: _targetCapturedAt,
      targetPhoto: _targetPhoto,
      ...remainingDay
    } = day;
    store[dateKey] = { ...remainingDay, dateKey };
    changed = true;
  }

  if (!changed) {
    return true;
  }

  return (
    writeEveningDeliveryStore(store) &&
    !Object.values(readEveningDeliveryStore()).some(
      (day) =>
        day.targetOwnPhotoId === photoId &&
        !hasEveningDeliveryArrival(day) &&
        !day.openedAt,
    )
  );
}

export function repairMissingEveningDeliveryTarget(
  ownPhotos: OwnSleepingPhoto[],
  now = Date.now(),
) {
  const store = readEveningDeliveryStore();
  const candidate = ownPhotos
    .filter((photo) => {
      const shared = photo.shared ?? photo.visibility === "shared";
      if (!shared || photo.captureContext === "onboarding") {
        return false;
      }

      const dateKey = getJstDateKey(photo.createdAt);
      const deliveryTime = getJstDeliveryTime(dateKey);
      const day = store[dateKey];
      return (
        photo.createdAt < deliveryTime &&
        now >= deliveryTime &&
        now < getJstAutoOpenTime(dateKey) &&
        !day?.targetOwnPhotoId &&
        !hasEveningDeliveryArrival(day) &&
        !day?.openedAt &&
        !day?.skippedAt
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!candidate) {
    return null;
  }

  const dateKey = getJstDateKey(candidate.createdAt);
  store[dateKey] = {
    ...(store[dateKey] ?? { dateKey }),
    dateKey,
    targetOwnPhotoId: candidate.id,
    targetCatId: candidate.ownerCatId ?? candidate.catId,
    targetCapturedAt: candidate.createdAt,
  };

  const persisted = writeEveningDeliveryStore(store);
  if (
    !persisted ||
    readEveningDeliveryStore()[dateKey]?.targetOwnPhotoId !== candidate.id
  ) {
    return null;
  }

  return { dateKey, photoId: candidate.id };
}

export function setEveningDeliveredPhoto(
  dateKey: string,
  deliveredPhoto: ExchangePhoto,
  deliveredAt = Date.now(),
) {
  return setEveningDeliveredPhotos(dateKey, [deliveredPhoto], deliveredAt);
}

export function setEveningDeliveredPhotos(
  dateKey: string,
  deliveredPhotos: ExchangePhoto[],
  deliveredAtOrMetadata: number | EveningDeliveryBundleMetadata = Date.now(),
  metadata: EveningDeliveryBundleMetadata = {},
) {
  const sanitizedDeliveredPhotos = sanitizeEveningDeliveredPhotos(deliveredPhotos);
  if (sanitizedDeliveredPhotos.length === 0) {
    return false;
  }

  const shouldFallbackToSingle =
    deliveredPhotos.length > 1 && sanitizedDeliveredPhotos.length !== 4;
  const persistentDeliveredPhotos = shouldFallbackToSingle
    ? sanitizedDeliveredPhotos.slice(0, 1)
    : sanitizedDeliveredPhotos;

  const deliveredAt =
    typeof deliveredAtOrMetadata === "number"
      ? deliveredAtOrMetadata
      : Date.now();
  const bundleMetadata = sanitizeEveningDeliveryBundleMetadata(
    typeof deliveredAtOrMetadata === "number"
      ? metadata
      : deliveredAtOrMetadata,
  );
  const persistedMetadata = shouldFallbackToSingle
    ? {
        ...bundleMetadata,
        servedVariant: "single_v1",
        servedCount: 1,
        fallbackReason:
          bundleMetadata.fallbackReason ?? "client_persistence_filter",
      }
    : bundleMetadata;
  const store = readEveningDeliveryStore();
  const day = store[dateKey] ?? { dateKey };
  const firstPhoto = persistentDeliveredPhotos[0];

  store[dateKey] = {
    ...day,
    ...clearEveningDeliveryBundleMetadata(),
    ...persistedMetadata,
    dateKey,
    deliveredPhoto: firstPhoto,
    deliveredPhotos:
      persistentDeliveredPhotos.length > 1
        ? persistentDeliveredPhotos
        : undefined,
    draftSelectedPhotoId: undefined,
    selectedPhotoId: undefined,
    deliveredAt,
    openedAt: undefined,
    openedBy: undefined,
    keptAt: undefined,
    skippedAt: undefined,
  };
  for (const [otherDateKey, otherDay] of Object.entries(store)) {
    if (
      otherDateKey < dateKey &&
      otherDay.targetOwnPhotoId &&
      !hasEveningDeliveryArrival(otherDay) &&
      !otherDay.skippedAt
    ) {
      store[otherDateKey] = {
        ...otherDay,
        dateKey: otherDateKey,
        skippedAt: deliveredAt,
      };
    }
  }
  const persisted = writeEveningDeliveryStore(store);
  return (
    persisted &&
    readEveningDeliveryStore()[dateKey]?.deliveredPhoto?.id ===
      firstPhoto.id
  );
}

export function setEveningDeliveryDraftSelection(
  dateKey: string,
  photoId: string | null,
) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day || !hasUnresolvedEveningDeliverySelection(day)) {
    return false;
  }

  if (
    photoId &&
    !getEveningDeliveredPhotos(day).some((photo) =>
      matchesExchangePhotoId(photo, photoId),
    )
  ) {
    return false;
  }

  store[dateKey] = {
    ...day,
    draftSelectedPhotoId: photoId ?? undefined,
  };
  const persisted = writeEveningDeliveryStore(store);
  return Boolean(
    persisted &&
      readEveningDeliveryStore()[dateKey]?.draftSelectedPhotoId ===
        (photoId ?? undefined),
  );
}

export function skipEveningDeliverySelection(
  dateKey: string,
  skippedAt = Date.now(),
) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day || !hasUnresolvedEveningDeliverySelection(day)) {
    return false;
  }

  store[dateKey] = {
    ...day,
    deliveredPhoto: undefined,
    deliveredPhotos: undefined,
    draftSelectedPhotoId: undefined,
    selectedPhotoId: undefined,
    openedAt: undefined,
    openedBy: undefined,
    keptAt: undefined,
    skippedAt,
  };
  const persisted = writeEveningDeliveryStore(store);
  if (persisted) {
    clearAppBadge();
  }
  const persistedDay = readEveningDeliveryStore()[dateKey];
  return Boolean(
    persisted &&
      persistedDay?.skippedAt === skippedAt &&
      !hasEveningDeliveryArrival(persistedDay),
  );
}

export function resolveEveningDeliveryWithoutSelection(
  dateKey: string,
  resolvedAt = Date.now(),
) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day) {
    return false;
  }

  store[dateKey] = {
    ...day,
    deliveredPhoto: undefined,
    deliveredPhotos: undefined,
    draftSelectedPhotoId: undefined,
    selectedPhotoId: undefined,
    openedAt: undefined,
    openedBy: undefined,
    keptAt: undefined,
    skippedAt: resolvedAt,
  };
  const persisted = writeEveningDeliveryStore(store);
  if (persisted) {
    clearAppBadge();
  }
  const persistedDay = readEveningDeliveryStore()[dateKey];
  return Boolean(
    persisted &&
      persistedDay?.skippedAt === resolvedAt &&
      !hasEveningDeliveryArrival(persistedDay),
  );
}

export function resolveEveningDeliveryWithPhoto(
  dateKey: string,
  deliveredPhoto: ExchangePhoto,
  resolvedAt = Date.now(),
  metadata: EveningDeliveryBundleMetadata = {},
) {
  const sanitizedPhoto = sanitizeExchangePhotoForPersistence(deliveredPhoto);
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day || !sanitizedPhoto) {
    return false;
  }

  store[dateKey] = {
    ...day,
    ...clearEveningDeliveryBundleMetadata(),
    ...sanitizeEveningDeliveryBundleMetadata(metadata),
    dateKey,
    deliveredPhoto: sanitizedPhoto,
    deliveredPhotos: undefined,
    draftSelectedPhotoId: undefined,
    selectedPhotoId: sanitizedPhoto.id,
    deliveredAt: sanitizedPhoto.deliveredAt,
    openedAt: resolvedAt,
    openedBy: "system",
    keptAt: resolvedAt,
    skippedAt: undefined,
  };
  const persisted = writeEveningDeliveryStore(store);
  const persistedDay = readEveningDeliveryStore()[dateKey];
  return Boolean(
    persisted &&
      persistedDay?.deliveredPhoto?.id === sanitizedPhoto.id &&
      persistedDay.selectedPhotoId === sanitizedPhoto.id &&
      persistedDay.openedAt === resolvedAt &&
      persistedDay.keptAt === resolvedAt,
  );
}

export function selectEveningDeliveredPhoto(
  dateKey: string,
  photoId: string,
  selectedAt = Date.now(),
) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day || !photoId) {
    return false;
  }

  if (day.openedAt) {
    return Boolean(
      day.selectedPhotoId &&
        day.deliveredPhoto &&
        matchesExchangePhotoId(day.deliveredPhoto, photoId),
    );
  }

  const deliveredPhotos = getEveningDeliveredPhotos(day);
  if (deliveredPhotos.length <= 1) {
    return false;
  }

  const selectedPhoto = deliveredPhotos.find((photo) =>
    matchesExchangePhotoId(photo, photoId),
  );
  if (!selectedPhoto) {
    return false;
  }

  store[dateKey] = {
    ...day,
    deliveredPhoto: selectedPhoto,
    deliveredPhotos: undefined,
    draftSelectedPhotoId: undefined,
    selectedPhotoId: selectedPhoto.id,
    openedAt: selectedAt,
    openedBy: "user",
    keptAt: selectedAt,
  };
  const persisted = writeEveningDeliveryStore(store);
  const persistedDay = readEveningDeliveryStore()[dateKey];
  return Boolean(
    persisted &&
      persistedDay?.deliveredPhoto?.id === selectedPhoto.id &&
      persistedDay.selectedPhotoId === selectedPhoto.id &&
      persistedDay.openedBy === "user" &&
      persistedDay.openedAt === selectedAt &&
      persistedDay.keptAt === selectedAt,
  );
}

export function markEveningDeliveryOpened(
  dateKey: string,
  openedAt = Date.now(),
  openedBy: "user" | "system" = "user",
) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day) {
    return false;
  }

  if (hasUnresolvedEveningDeliverySelection(day)) {
    if (openedBy === "user") {
      return false;
    }

    store[dateKey] = {
      ...day,
      deliveredPhoto: undefined,
      deliveredPhotos: undefined,
      draftSelectedPhotoId: undefined,
      selectedPhotoId: undefined,
      openedAt: undefined,
      openedBy: undefined,
      keptAt: undefined,
      skippedAt: openedAt,
    };
  } else {
    store[dateKey] = {
      ...day,
      openedAt,
      openedBy,
    };
  }
  const persisted = writeEveningDeliveryStore(store);
  clearAppBadge();
  return persisted;
}

export function markEveningDeliverySkipped(dateKey: string, skippedAt = Date.now()) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day) {
    return false;
  }

  store[dateKey] = {
    ...day,
    skippedAt,
  };
  const persisted = writeEveningDeliveryStore(store);
  return Boolean(
    persisted && readEveningDeliveryStore()[dateKey]?.skippedAt === skippedAt,
  );
}

export function autoOpenExpiredEveningDeliveries(now = Date.now()) {
  const store = readEveningDeliveryStore();
  let hasChanged = false;
  const autoSkippedBundles: Array<{
    dateKey: string;
    day: EveningDeliveryDay;
    reason: "selection_expired" | "all_candidates_blocked";
  }> = [];

  for (const [dateKey, day] of Object.entries(store)) {
    if (
      hasEveningDeliveryArrival(day) &&
      !day.openedAt &&
      now >= getJstAutoOpenTime(dateKey)
    ) {
      const isUnresolvedBundle = hasUnresolvedEveningDeliverySelection(day);
      const deliveredPhotos = getEveningDeliveredPhotos(day);
      const openedAt = getJstAutoOpenTime(dateKey);

      if (isUnresolvedBundle) {
        store[dateKey] = {
          ...day,
          deliveredPhoto: undefined,
          deliveredPhotos: undefined,
          draftSelectedPhotoId: undefined,
          selectedPhotoId: undefined,
          openedAt: undefined,
          openedBy: undefined,
          keptAt: undefined,
          skippedAt: openedAt,
        };
        autoSkippedBundles.push({
          dateKey,
          day,
          reason: "selection_expired",
        });
        hasChanged = true;
        continue;
      }

      const firstPhoto = deliveredPhotos[0];
      if (!firstPhoto) {
        continue;
      }

      store[dateKey] = {
        ...day,
        deliveredPhoto: firstPhoto,
        deliveredPhotos: undefined,
        draftSelectedPhotoId: undefined,
        selectedPhotoId: day.selectedPhotoId,
        openedAt,
        openedBy: "system",
        keptAt: day.keptAt,
      };
      hasChanged = true;
    }
  }

  if (hasChanged) {
    const persisted = writeEveningDeliveryStore(store);
    if (!persisted) {
      return false;
    }
    clearAppBadge();
    for (const { dateKey, day, reason } of autoSkippedBundles) {
      trackProductEvent("evening_delivery_choice_auto_skipped", {
        delivery_date_key: dateKey,
        delivery_bundle_id: day.deliveryBundleId ?? null,
        experience_version: day.experienceVersion ?? "evening_choice_v1",
        assigned_variant: day.assignedVariant ?? "four_choice_v1",
        served_variant: day.servedVariant ?? "four_choice_v1",
        requested_count: day.requestedCount ?? 4,
        served_count: day.servedCount ?? 4,
        candidate_count: getEveningDeliveredPhotos(day).length,
        selection_method: "system_auto",
        skip_reason: reason,
      });
    }
  }

  return hasChanged;
}

export function markEveningDeliveryKept(dateKey: string, keptAt = Date.now()) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day) {
    return false;
  }

  if (hasUnresolvedEveningDeliverySelection(day)) {
    return false;
  }

  store[dateKey] = {
    ...day,
    openedAt: day.openedAt ?? keptAt,
    openedBy: day.openedBy ?? "user",
    keptAt,
  };
  const persisted = writeEveningDeliveryStore(store);
  clearAppBadge();
  return persisted;
}

export function updateEveningDeliveredPhotoDataUrl(
  dateKey: string,
  dataUrl: string,
  photoId?: string,
) {
  if (!dataUrl.startsWith("data:image/")) {
    return null;
  }

  const store = readEveningDeliveryStore();
  const day = store[dateKey];
  const deliveredPhoto = day
    ? photoId
      ? getEveningDeliveredPhotos(day).find((photo) =>
          matchesExchangePhotoId(photo, photoId),
        )
      : day.deliveredPhoto
    : undefined;

  if (!day || !deliveredPhoto) {
    return deliveredPhoto ?? null;
  }

  const nextPhoto =
    deliveredPhoto.offlineSrc &&
    deliveredPhoto.offlineSrc.length >= dataUrl.length
      ? deliveredPhoto
      : {
          ...deliveredPhoto,
          offlineSrc: dataUrl,
        };
  if (nextPhoto !== deliveredPhoto) {
    cacheExchangePhotoOfflineDataUrl(deliveredPhoto, dataUrl);
  }

  const nextDeliveredPhotos = day.deliveredPhotos?.map((photo) =>
    isSameExchangePhoto(photo, deliveredPhoto) ? nextPhoto : photo,
  );
  store[dateKey] = {
    ...day,
    deliveredPhoto:
      day.deliveredPhoto && isSameExchangePhoto(day.deliveredPhoto, deliveredPhoto)
        ? nextPhoto
        : day.deliveredPhoto,
    deliveredPhotos: nextDeliveredPhotos,
  };
  writeEveningDeliveryStore(store);

  return nextPhoto;
}

export function buildEveningHomeState({
  activeCatId,
  ownPhotos,
  now = Date.now(),
}: {
  activeCatId: string | null;
  ownPhotos: OwnSleepingPhoto[];
  now?: number;
}): EveningHomeState {
  autoOpenExpiredEveningDeliveries(now);
  const todayKey = getHomeDisplayDateKey(now);
  const store = readEveningDeliveryStore();
  const visibleDeliveredDay = findLatestVisibleDeliveredDay(store, now);

  if (visibleDeliveredDay?.deliveredPhoto) {
    const targetPhoto = findTargetPhoto(visibleDeliveredDay, ownPhotos, activeCatId);
    const deliveredPhotos = getEveningDeliveredPhotos(visibleDeliveredDay);
    const bundleMetadata = pickEveningDeliveryBundleMetadata(visibleDeliveredDay);
    return visibleDeliveredDay.openedAt
      ? {
          ...bundleMetadata,
          kind: "opened",
          dateKey: visibleDeliveredDay.dateKey,
          targetPhoto,
          deliveredPhoto: visibleDeliveredDay.deliveredPhoto,
          deliveredPhotos,
          draftSelectedPhotoId: visibleDeliveredDay.draftSelectedPhotoId,
        }
      : {
          ...bundleMetadata,
          kind: "delivered",
          dateKey: visibleDeliveredDay.dateKey,
          targetPhoto,
          deliveredPhoto: visibleDeliveredDay.deliveredPhoto,
          deliveredPhotos,
          draftSelectedPhotoId: visibleDeliveredDay.draftSelectedPhotoId,
        };
  }

  const todayDay = store[todayKey];

  if (todayDay?.targetOwnPhotoId && !todayDay.skippedAt) {
    return {
      kind: "waiting",
      dateKey: todayKey,
      isTodayDelivery: true,
      targetPhoto: findTargetPhoto(todayDay, ownPhotos, activeCatId),
    };
  }

  const targetDateKey = getEveningDeliveryTargetDateKey(now);
  const targetDay = store[targetDateKey];
  if (targetDay?.targetOwnPhotoId && !targetDay.skippedAt) {
    return {
      kind: "waiting",
      dateKey: targetDateKey,
      isTodayDelivery: targetDateKey === todayKey,
      targetPhoto: findTargetPhoto(targetDay, ownPhotos, activeCatId),
    };
  }

  return {
    kind: "before",
    dateKey: targetDateKey,
    isTodayDelivery: targetDateKey === todayKey,
    afterTodayDelivery: targetDateKey !== todayKey,
  };
}

export function getPendingEveningDeliveryDay(now = Date.now()) {
  const store = readEveningDeliveryStore();
  return (
    Object.values(store)
      .filter(
        (day) =>
          day.targetOwnPhotoId &&
          !hasEveningDeliveryArrival(day) &&
          !day.skippedAt &&
          now >= getJstDeliveryTime(day.dateKey),
      )
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] ?? null
  );
}

export function getEveningDeliveryTargetDateKey(now = Date.now()) {
  const todayKey = getJstDateKey(now);
  return now < getJstDeliveryTime(todayKey)
    ? todayKey
    : addJstDays(todayKey, 1);
}

export function getJstDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp + JST_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getJstHour(timestamp = Date.now()) {
  return new Date(timestamp + JST_OFFSET_MS).getUTCHours();
}

function getHomeDisplayDateKey(timestamp = Date.now()) {
  const todayKey = getJstDateKey(timestamp);
  if (getJstHour(timestamp) >= 5) {
    return todayKey;
  }

  return addJstDays(todayKey, -1);
}

export function addJstDays(dateKey: string, days: number) {
  const base = getJstDayStartTime(dateKey);
  return getJstDateKey(base + days * 24 * 60 * 60 * 1000);
}

export function getJstDeliveryTime(dateKey: string) {
  return getJstDayStartTime(dateKey) + EVENING_DELIVERY_HOUR * 60 * 60 * 1000;
}

export function getJstAutoOpenTime(dateKey: string) {
  return getJstDayStartTime(addJstDays(dateKey, 1)) + 5 * 60 * 60 * 1000;
}

export function getEveningDeliveryCompletionCopy(now = Date.now()) {
  return getEveningDeliveryTargetDateKey(now) === getJstDateKey(now)
    ? "こんやの よる8時ごろ、もう1まい とどきます。"
    : "あしたの よる8時ごろ、つぎの ねがおが とどきます。";
}

export function isTodaySleepingCounterVisible(countText: string) {
  const numeric = Number.parseInt(countText.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(numeric) && numeric >= EVENING_DELIVERY_VISIBLE_THRESHOLD;
}

export function shouldShowGuidanceCopy({
  keptExchangePhotoCount,
  now = Date.now(),
}: {
  keptExchangePhotoCount: number;
  now?: number;
}) {
  if (keptExchangePhotoCount < 5) {
    return true;
  }

  const firstTargetDateKey = getFirstEveningDeliveryTargetDateKey();
  if (!firstTargetDateKey) {
    return true;
  }

  return now - getJstDayStartTime(firstTargetDateKey) < 7 * 24 * 60 * 60 * 1000;
}

export async function setAppBadge(count = 1) {
  const nav = globalThis.navigator as
    | (Navigator & { setAppBadge?: (count?: number) => Promise<void> })
    | undefined;

  try {
    await nav?.setAppBadge?.(count);
  } catch {
    // Badge support varies by browser.
  }
}

export async function clearAppBadge() {
  const nav = globalThis.navigator as
    | (Navigator & { clearAppBadge?: () => Promise<void> })
    | undefined;

  try {
    await nav?.clearAppBadge?.();
  } catch {
    // Badge support varies by browser.
  }
}

function findTargetPhoto(
  day: EveningDeliveryDay,
  ownPhotos: OwnSleepingPhoto[],
  activeCatId: string | null,
) {
  const target = ownPhotos.find((photo) => photo.id === day.targetOwnPhotoId);
  if (target) {
    return target;
  }

  if (day.targetPhoto) {
    return day.targetPhoto;
  }

  const targetCatId = day.targetCatId ?? activeCatId;

  return (
    ownPhotos.find((photo) =>
      targetCatId ? (photo.ownerCatId ?? photo.catId) === targetCatId : true,
    ) ?? null
  );
}

function findLatestVisibleDeliveredDay(store: EveningDeliveryStore, now: number) {
  return (
    Object.values(store)
      .filter(
        (day) =>
          hasEveningDeliveryArrival(day) &&
          now >= getJstDeliveryTime(day.dateKey) &&
          now < getJstAutoOpenTime(day.dateKey),
      )
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] ?? null
  );
}

function getJstDayStartTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) - JST_OFFSET_MS;
}

function pruneEveningDeliveryStore(store: EveningDeliveryStore, keepCount = 90) {
  const entries = Object.entries(store)
    .filter(([dateKey, day]) => isValidDateKey(dateKey) && isEveningDeliveryDay(day))
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, keepCount)
    .map(([dateKey, day]) => {
      const { targetPhoto: _legacyTargetPhoto, ...compactDay } = day;
      return [dateKey, compactDay] as const;
    });

  return Object.fromEntries(entries);
}

function isEveningDeliveryDay(value: unknown): value is EveningDeliveryDay {
  if (!value || typeof value !== "object") {
    return false;
  }

  const day = value as Partial<EveningDeliveryDay>;
  return (
    typeof day.dateKey === "string" &&
    isValidDateKey(day.dateKey) &&
    isOptionalString(day.targetOwnPhotoId) &&
    isOptionalString(day.targetCatId) &&
    isOptionalString(day.draftSelectedPhotoId) &&
    isOptionalString(day.selectedPhotoId) &&
    isOptionalString(day.deliveryBundleId) &&
    isOptionalString(day.experienceVersion) &&
    isOptionalString(day.assignedVariant) &&
    isOptionalString(day.servedVariant) &&
    isOptionalFiniteNumber(day.requestedCount) &&
    isOptionalFiniteNumber(day.servedCount) &&
    isOptionalNullableString(day.fallbackReason) &&
    isOptionalExchangePhotoArray(day.deliveredPhotos) &&
    isOptionalFiniteNumber(day.targetCapturedAt) &&
    isOptionalFiniteNumber(day.deliveredAt) &&
    isOptionalFiniteNumber(day.openedAt) &&
    isOptionalOpenedBy(day.openedBy) &&
    isOptionalFiniteNumber(day.keptAt) &&
    isOptionalFiniteNumber(day.skippedAt)
  );
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isOptionalFiniteNumber(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isOptionalOpenedBy(value: unknown) {
  return value === undefined || value === "user" || value === "system";
}

function isOptionalNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalExchangePhotoArray(value: unknown) {
  return value === undefined || Array.isArray(value);
}

function hasEveningDeliveryArrival(
  day: EveningDeliveryDay | null | undefined,
) {
  return Boolean(day?.deliveredPhoto || day?.deliveredPhotos?.length);
}

function hasUnresolvedEveningDeliverySelection(day: EveningDeliveryDay) {
  return Boolean(
    day.deliveredPhotos &&
      day.deliveredPhotos.length > 1 &&
      !day.selectedPhotoId &&
      !day.openedAt,
  );
}

function getEveningDeliveredPhotos(day: EveningDeliveryDay) {
  if (day.deliveredPhotos && day.deliveredPhotos.length > 0) {
    return day.deliveredPhotos;
  }

  return day.deliveredPhoto ? [day.deliveredPhoto] : [];
}

function sanitizeEveningDeliveredPhotos(photos: unknown) {
  if (!Array.isArray(photos)) {
    return [];
  }

  const sanitized: ExchangePhoto[] = [];
  const identities = new Set<string>();
  for (const candidate of photos) {
    const photo = sanitizeExchangePhotoForPersistence(
      candidate as ExchangePhoto | null | undefined,
    );
    if (!photo) {
      continue;
    }

    const identity = photo.sourcePhotoId ?? photo.id;
    if (identities.has(identity)) {
      continue;
    }

    identities.add(identity);
    sanitized.push(photo);
  }

  return sanitized;
}

function readLegacySingleDeliveredPhoto(
  photo: unknown,
  deliveredPhotos: unknown,
): ExchangePhoto | undefined {
  if (
    Array.isArray(deliveredPhotos) ||
    !photo ||
    typeof photo !== "object"
  ) {
    return undefined;
  }

  const candidate = photo as Partial<ExchangePhoto>;
  return typeof candidate.id === "string" && typeof candidate.src === "string"
    ? (photo as ExchangePhoto)
    : undefined;
}

function matchesExchangePhotoId(photo: ExchangePhoto, photoId: string) {
  return photo.id === photoId || photo.sourcePhotoId === photoId;
}

function isSameExchangePhoto(first: ExchangePhoto, second: ExchangePhoto) {
  return (
    first.id === second.id ||
    Boolean(
      first.sourcePhotoId &&
        second.sourcePhotoId &&
        first.sourcePhotoId === second.sourcePhotoId,
    )
  );
}

function sanitizeEveningDeliveryBundleMetadata(
  metadata: EveningDeliveryBundleMetadata,
): EveningDeliveryBundleMetadata {
  return {
    deliveryBundleId: sanitizeOptionalString(metadata.deliveryBundleId),
    experienceVersion: sanitizeOptionalString(metadata.experienceVersion),
    assignedVariant: sanitizeOptionalString(metadata.assignedVariant),
    servedVariant: sanitizeOptionalString(metadata.servedVariant),
    requestedCount: sanitizeOptionalCount(metadata.requestedCount),
    servedCount: sanitizeOptionalCount(metadata.servedCount),
    fallbackReason:
      metadata.fallbackReason === null
        ? null
        : sanitizeOptionalString(metadata.fallbackReason),
  };
}

function pickEveningDeliveryBundleMetadata(
  day: EveningDeliveryDay,
): EveningDeliveryBundleMetadata {
  return sanitizeEveningDeliveryBundleMetadata(day);
}

function clearEveningDeliveryBundleMetadata(): EveningDeliveryBundleMetadata {
  return {
    deliveryBundleId: undefined,
    experienceVersion: undefined,
    assignedVariant: undefined,
    servedVariant: undefined,
    requestedCount: undefined,
    servedCount: undefined,
    fallbackReason: undefined,
  };
}

function sanitizeOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sanitizeOptionalCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
}
