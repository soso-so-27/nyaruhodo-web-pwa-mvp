import { STORAGE_KEYS, readCachedJson, writeCachedJson } from "../storage";
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

export type EveningDeliveryDay = {
  dateKey: string;
  targetOwnPhotoId?: string;
  targetCatId?: string;
  targetCapturedAt?: number;
  targetPhoto?: OwnSleepingPhoto;
  deliveredPhoto?: ExchangePhoto;
  deliveredAt?: number;
  openedAt?: number;
  openedBy?: "user" | "system";
  keptAt?: number;
  skippedAt?: number;
};

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
  | {
      kind: "delivered";
      dateKey: string;
      targetPhoto: OwnSleepingPhoto | null;
      deliveredPhoto: ExchangePhoto;
    }
  | {
      kind: "opened";
      dateKey: string;
      targetPhoto: OwnSleepingPhoto | null;
      deliveredPhoto: ExchangePhoto;
    };

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
        store[dateKey] = {
          ...day,
          dateKey,
          ...(day.deliveredPhoto
            ? { deliveredPhoto: withExchangePhotoOfflineSrc(day.deliveredPhoto) }
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
    .filter((day) => Boolean(day.deliveredPhoto))
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
  const canReplaceTarget = !day.deliveredPhoto && !day.openedAt;
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
      day.deliveredPhoto ||
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
        !day.deliveredPhoto &&
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
        !day?.deliveredPhoto &&
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
  const persistentDeliveredPhoto =
    sanitizeExchangePhotoForPersistence(deliveredPhoto);

  if (!persistentDeliveredPhoto) {
    return false;
  }

  const store = readEveningDeliveryStore();
  const day = store[dateKey] ?? { dateKey };

  store[dateKey] = {
    ...day,
    dateKey,
    deliveredPhoto: persistentDeliveredPhoto,
    deliveredAt,
  };
  for (const [otherDateKey, otherDay] of Object.entries(store)) {
    if (
      otherDateKey < dateKey &&
      otherDay.targetOwnPhotoId &&
      !otherDay.deliveredPhoto &&
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
      persistentDeliveredPhoto.id
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
    return;
  }

  store[dateKey] = {
    ...day,
    openedAt,
    openedBy,
  };
  writeEveningDeliveryStore(store);
  clearAppBadge();
}

export function markEveningDeliverySkipped(dateKey: string, skippedAt = Date.now()) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day) {
    return;
  }

  store[dateKey] = {
    ...day,
    skippedAt,
  };
  writeEveningDeliveryStore(store);
}

export function autoOpenExpiredEveningDeliveries(now = Date.now()) {
  const store = readEveningDeliveryStore();
  let hasChanged = false;

  for (const [dateKey, day] of Object.entries(store)) {
    if (
      day.deliveredPhoto &&
      !day.openedAt &&
      now >= getJstAutoOpenTime(dateKey)
    ) {
      store[dateKey] = {
        ...day,
        openedAt: getJstAutoOpenTime(dateKey),
        openedBy: "system",
      };
      hasChanged = true;
    }
  }

  if (hasChanged) {
    writeEveningDeliveryStore(store);
    clearAppBadge();
  }

  return hasChanged;
}

export function markEveningDeliveryKept(dateKey: string, keptAt = Date.now()) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey];

  if (!day) {
    return;
  }

  store[dateKey] = {
    ...day,
    openedAt: day.openedAt ?? keptAt,
    openedBy: day.openedBy ?? "user",
    keptAt,
  };
  writeEveningDeliveryStore(store);
  clearAppBadge();
}

export function updateEveningDeliveredPhotoDataUrl(
  dateKey: string,
  dataUrl: string,
) {
  if (!dataUrl.startsWith("data:image/")) {
    return null;
  }

  const store = readEveningDeliveryStore();
  const day = store[dateKey];
  const deliveredPhoto = day?.deliveredPhoto;

  if (!day || !deliveredPhoto) {
    return deliveredPhoto ?? null;
  }

  if (
    deliveredPhoto.offlineSrc &&
    deliveredPhoto.offlineSrc.length >= dataUrl.length
  ) {
    return deliveredPhoto;
  }

  const nextPhoto = {
    ...deliveredPhoto,
    offlineSrc: dataUrl,
  };
  cacheExchangePhotoOfflineDataUrl(deliveredPhoto, dataUrl);

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
    return visibleDeliveredDay.openedAt
      ? {
          kind: "opened",
          dateKey: visibleDeliveredDay.dateKey,
          targetPhoto,
          deliveredPhoto: visibleDeliveredDay.deliveredPhoto,
        }
      : {
          kind: "delivered",
          dateKey: visibleDeliveredDay.dateKey,
          targetPhoto,
          deliveredPhoto: visibleDeliveredDay.deliveredPhoto,
        };
  }

  const todayDay = store[todayKey];

  if (todayDay?.targetOwnPhotoId) {
    return {
      kind: "waiting",
      dateKey: todayKey,
      isTodayDelivery: true,
      targetPhoto: findTargetPhoto(todayDay, ownPhotos, activeCatId),
    };
  }

  const targetDateKey = getEveningDeliveryTargetDateKey(now);
  const targetDay = store[targetDateKey];
  if (targetDay?.targetOwnPhotoId) {
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
          !day.deliveredPhoto &&
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
          day.deliveredPhoto &&
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
