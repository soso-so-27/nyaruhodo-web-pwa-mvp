import { STORAGE_KEYS } from "../storage";
import type { ExchangePhoto, OwnSleepingPhoto } from "./sleepingPhotos";

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
    const raw = window.localStorage.getItem(STORAGE_KEYS.eveningDeliveryDays);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const store: EveningDeliveryStore = {};
    for (const [dateKey, day] of Object.entries(parsed)) {
      if (isValidDateKey(dateKey) && isEveningDeliveryDay(day)) {
        store[dateKey] = { ...day, dateKey };
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

export function writeEveningDeliveryStore(store: EveningDeliveryStore) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEYS.eveningDeliveryDays,
      JSON.stringify(pruneEveningDeliveryStore(store)),
    );
    window.dispatchEvent(new Event("neteruneko_evening_delivery_updated"));
  } catch {
    // Local delivery state should never block taking or keeping photos.
  }
}

export function recordEveningDeliveryTarget(
  ownPhoto: OwnSleepingPhoto,
  now = Date.now(),
) {
  const store = readEveningDeliveryStore();
  const targetDateKey = getEveningDeliveryTargetDateKey(now);
  const day = store[targetDateKey] ?? { dateKey: targetDateKey };
  const isExchangeTarget = !day.targetOwnPhotoId;

  if (isExchangeTarget) {
    store[targetDateKey] = {
      ...day,
      dateKey: targetDateKey,
      targetOwnPhotoId: ownPhoto.id,
      targetCatId: ownPhoto.ownerCatId ?? ownPhoto.catId,
      targetCapturedAt: ownPhoto.createdAt,
      targetPhoto: ownPhoto,
    };
    writeEveningDeliveryStore(store);
  }

  return {
    dateKey: targetDateKey,
    isExchangeTarget,
    isTodayDelivery: targetDateKey === getJstDateKey(now),
  };
}

export function setEveningDeliveredPhoto(
  dateKey: string,
  deliveredPhoto: ExchangePhoto,
  deliveredAt = Date.now(),
) {
  const store = readEveningDeliveryStore();
  const day = store[dateKey] ?? { dateKey };

  store[dateKey] = {
    ...day,
    dateKey,
    deliveredPhoto,
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
  writeEveningDeliveryStore(store);
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

  if (!day || !deliveredPhoto || deliveredPhoto.src === dataUrl) {
    return deliveredPhoto ?? null;
  }

  const nextPhoto = {
    ...deliveredPhoto,
    src: dataUrl,
    thumbnailSrc: dataUrl,
    displaySrc: dataUrl,
    originalSrc: dataUrl,
  };

  store[dateKey] = {
    ...day,
    deliveredPhoto: nextPhoto,
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
  const todayKey = getJstDateKey(now);
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

export function addJstDays(dateKey: string, days: number) {
  const base = getJstDayStartTime(dateKey);
  return getJstDateKey(base + days * 24 * 60 * 60 * 1000);
}

export function getJstDeliveryTime(dateKey: string) {
  return getJstDayStartTime(dateKey) + EVENING_DELIVERY_HOUR * 60 * 60 * 1000;
}

function getJstAutoOpenTime(dateKey: string) {
  return getJstDayStartTime(addJstDays(dateKey, 1)) + 5 * 60 * 60 * 1000;
}

export function getEveningDeliveryCompletionCopy(now = Date.now()) {
  return getEveningDeliveryTargetDateKey(now) === getJstDateKey(now)
    ? "こんやの よる8じごろ、もう1まい とどきます。"
    : "あしたの よる8じごろ、つぎの ねがおが とどきます。";
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

  return (
    ownPhotos.find((photo) =>
      activeCatId ? photo.ownerCatId === activeCatId : true,
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

function pruneEveningDeliveryStore(store: EveningDeliveryStore) {
  const entries = Object.entries(store)
    .filter(([dateKey, day]) => isValidDateKey(dateKey) && isEveningDeliveryDay(day))
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 90);

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
