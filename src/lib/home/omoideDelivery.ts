import { trackProductEvent } from "../analytics/productAnalytics";
import { STORAGE_KEYS, readCachedJson, writeCachedJson } from "../storage";
import {
  addJstDays,
  getJstDateKey,
  getJstDeliveryTime,
} from "./eveningDelivery";
import type { OwnSleepingPhoto } from "./sleepingPhotos";

export type OmoideLookback =
  | "week"
  | "month"
  | "half_year"
  | "year"
  | "n_year";

export type OmoideReason =
  | "same_day"
  | "milestone"
  | "season"
  | "first_seed";

export type OmoideOpenSource = "home" | "pickup" | "bunbako" | "year";

export type OmoideMemory = {
  id: string;
  catId: string;
  catName: string;
  sourcePhotoId: string;
  sourceDateKey: string;
  deliveryDateKey: string;
  photo: OwnSleepingPhoto;
  lookback: OmoideLookback;
  reason: OmoideReason;
  title: string;
  subtitle: string;
  voice: string;
  bridge: string;
  deliveredAt: number;
  openedAt?: number;
  dismissedAt?: number;
};

export type OmoideMemoryStore = Record<string, OmoideMemory>;

export type OmoideMemoryControls = {
  disabled?: boolean;
  pausedUntil?: number;
  hiddenDateKeys?: string[];
  usedSourcePhotoIds?: string[];
};

const EARLY_HOUSEHOLD_INTERVAL_DAYS = 7;
const SETTLED_HOUSEHOLD_INTERVAL_DAYS = 14;
const EARLY_EXPERIENCE_TARGET = 3;
const FIRST_SEED_START_DAY = 7;

export function readOmoideMemories(): OmoideMemory[] {
  return Object.values(readOmoideMemoryStore())
    .filter(isValidOmoideMemory)
    .sort((a, b) => b.deliveredAt - a.deliveredAt);
}

export function readOmoideMemoriesForCat(catId: string | null) {
  const memories = readOmoideMemories();
  const catMemories = catId
    ? memories.filter((memory) => memory.catId === catId)
    : memories;
  return readOmoideMemoryControls().disabled
    ? catMemories.filter((memory) => Boolean(memory.openedAt))
    : catMemories;
}

export function readLatestArrivedOmoideMemory(
  catId: string | null,
  now = Date.now(),
) {
  const todayKey = getJstDateKey(now);
  return (
    readOmoideMemoriesForCat(catId).find(
      (memory) =>
        memory.deliveryDateKey === todayKey &&
        !memory.openedAt &&
        !memory.dismissedAt &&
        now >= getJstDeliveryTime(memory.deliveryDateKey),
    ) ?? null
  );
}

export function hasUnopenedArrivedOmoideMemory(now = Date.now()) {
  if (readOmoideMemoryControls().disabled) {
    return false;
  }
  return readOmoideMemories().some(
    (memory) =>
      !memory.openedAt &&
      !memory.dismissedAt &&
      now >= getJstDeliveryTime(memory.deliveryDateKey),
  );
}

export function ensureOmoideMemoryArrival({
  catId,
  catName,
  familySinceDate,
  ownPhotos,
  now = Date.now(),
}: {
  catId: string | null;
  catName: string;
  familySinceDate?: string;
  ownPhotos: OwnSleepingPhoto[];
  now?: number;
}) {
  if (!catId || now < getJstDeliveryTime(getJstDateKey(now))) {
    return null;
  }

  const controls = readOmoideMemoryControls();
  if (controls.disabled || (controls.pausedUntil ?? 0) > now) {
    return null;
  }
  // TODO: When farewell/memorial state exists, suppress celebratory memory
  // arrivals here or switch them to the quiet memorial tone before delivery.

  const store = readOmoideMemoryStore();
  const usedSourcePhotoIds = new Set([
    ...(controls.usedSourcePhotoIds ?? []),
    ...Object.values(store).map((memory) => memory.sourcePhotoId),
  ]);
  const todayKey = getJstDateKey(now);
  const storedMemories = Object.values(store).filter(isValidOmoideMemory);
  const existing = storedMemories.find(
    (memory) => memory.deliveryDateKey === todayKey,
  );
  if (existing) {
    return existing;
  }

  const latest = [...storedMemories].sort(
    (a, b) => b.deliveredAt - a.deliveredAt,
  )[0];
  const intervalDays = getOmoideHouseholdIntervalDays(storedMemories);
  if (
    latest &&
    now - latest.deliveredAt < intervalDays * 24 * 60 * 60 * 1000
  ) {
    return null;
  }

  const candidate = selectOmoideCandidate({
    catId,
    catName,
    familySinceDate,
    ownPhotos,
    controls,
    usedSourcePhotoIds,
    now,
  });
  if (!candidate) {
    return null;
  }

  const memory: OmoideMemory = {
    ...candidate,
    id: createOmoideId(now),
    catId,
    catName,
    deliveryDateKey: todayKey,
    deliveredAt: now,
  };

  writeOmoideMemoryStore({
    ...store,
    [memory.id]: memory,
  });
  writeOmoideMemoryControls({
    ...controls,
    usedSourcePhotoIds: [
      ...new Set([...usedSourcePhotoIds, memory.sourcePhotoId]),
    ],
  });

  trackProductEvent(
    "omoide_generated",
    {
      lookback: memory.lookback,
      reason: memory.reason,
      household_interval_days: intervalDays,
      household_opened_count: storedMemories.filter((item) => item.openedAt)
        .length,
      days_since_first_photo: getDaysSinceFirstPhoto(ownPhotos, catId, now),
    },
    { localCatId: catId },
  );

  return memory;
}

export function markOmoideMemoryOpened(
  id: string,
  openedAt = Date.now(),
  source: OmoideOpenSource = "home",
) {
  const store = readOmoideMemoryStore();
  const memory = store[id];
  if (!memory) {
    return null;
  }

  const nextMemory = memory.openedAt ? memory : { ...memory, openedAt };
  if (!memory.openedAt) {
    writeOmoideMemoryStore({ ...store, [id]: nextMemory });
  }
  trackProductEvent(
    "omoide_opened",
    {
      source,
      memory_age: openedAt - memory.photo.createdAt,
      already_opened: Boolean(memory.openedAt),
    },
    { localCatId: memory.catId },
  );
  return nextMemory;
}

export function getOmoideHouseholdIntervalDays(
  memories: readonly Pick<OmoideMemory, "openedAt">[],
) {
  const openedCount = memories.filter(
    (memory) => typeof memory.openedAt === "number",
  ).length;
  return openedCount < EARLY_EXPERIENCE_TARGET
    ? EARLY_HOUSEHOLD_INTERVAL_DAYS
    : SETTLED_HOUSEHOLD_INTERVAL_DAYS;
}

export function markOmoideMemoryDismissed(id: string, dismissedAt = Date.now()) {
  const store = readOmoideMemoryStore();
  const memory = store[id];
  if (!memory) {
    return null;
  }

  const nextMemory = { ...memory, dismissedAt };
  writeOmoideMemoryStore({ ...store, [id]: nextMemory });
  trackProductEvent("omoide_dismissed", {}, { localCatId: memory.catId });
  return nextMemory;
}

export function trackOmoideMemoryDismissed(
  memory: OmoideMemory,
  source: OmoideOpenSource,
) {
  // Means closing the viewer / returning to the omoide box; event name is kept for analytics continuity.
  trackProductEvent("omoide_dismissed", { source }, { localCatId: memory.catId });
}

export function pauseOmoideMemories(days = 30) {
  const pausedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
  writeOmoideMemoryControls({
    ...readOmoideMemoryControls(),
    pausedUntil,
  });
  trackProductEvent("omoide_paused", { days });
}

export function disableOmoideMemories(disabled: boolean) {
  writeOmoideMemoryControls({
    ...readOmoideMemoryControls(),
    disabled,
  });
  if (disabled) {
    trackProductEvent("omoide_disabled");
  }
}

export function hideOmoideDate(dateKey: string) {
  const controls = readOmoideMemoryControls();
  const hiddenDateKeys = new Set(controls.hiddenDateKeys ?? []);
  hiddenDateKeys.add(dateKey);
  writeOmoideMemoryControls({
    ...controls,
    hiddenDateKeys: [...hiddenDateKeys].sort(),
  });
  trackProductEvent("omoide_date_hidden", { date_key: dateKey });
}

export function readOmoideMemoryControls(): OmoideMemoryControls {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = readCachedJson<unknown>(STORAGE_KEYS.omoideMemoryControls) ?? {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const controls = parsed as Partial<OmoideMemoryControls>;
    return {
      disabled: controls.disabled === true,
      pausedUntil:
        typeof controls.pausedUntil === "number" &&
        Number.isFinite(controls.pausedUntil)
          ? controls.pausedUntil
          : undefined,
      hiddenDateKeys: Array.isArray(controls.hiddenDateKeys)
        ? controls.hiddenDateKeys.filter(
            (dateKey): dateKey is string => typeof dateKey === "string",
          )
        : [],
      usedSourcePhotoIds: Array.isArray(controls.usedSourcePhotoIds)
        ? [
            ...new Set(
              controls.usedSourcePhotoIds.filter(
                (photoId): photoId is string =>
                  typeof photoId === "string" && photoId.length > 0,
              ),
            ),
          ]
        : [],
    };
  } catch {
    return {};
  }
}

function selectOmoideCandidate({
  catId,
  catName,
  familySinceDate,
  ownPhotos,
  controls,
  usedSourcePhotoIds,
  now,
}: {
  catId: string;
  catName: string;
  familySinceDate?: string;
  ownPhotos: OwnSleepingPhoto[];
  controls: OmoideMemoryControls;
  usedSourcePhotoIds: Set<string>;
  now: number;
}) {
  const allCatPhotos = ownPhotos
    .filter((photo) => photo.ownerCatId === catId || photo.catId === catId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const photos = allCatPhotos.filter((photo) => !usedSourcePhotoIds.has(photo.id));
  if (photos.length === 0) {
    return null;
  }

  const hiddenDateKeys = new Set(controls.hiddenDateKeys ?? []);
  const firstRecordedPhoto = allCatPhotos[0] ?? null;
  const daysSinceFirstPhoto = firstRecordedPhoto
    ? getDaysSinceTimestamp(firstRecordedPhoto.createdAt, now)
    : 0;
  const todayKey = getJstDateKey(now);
  const priorMemories = readOmoideMemoriesForCat(catId);

  if (
    daysSinceFirstPhoto >= FIRST_SEED_START_DAY &&
    priorMemories.length === 0
  ) {
    const firstPhoto =
      firstRecordedPhoto &&
      !usedSourcePhotoIds.has(firstRecordedPhoto.id) &&
      !hiddenDateKeys.has(getJstDateKey(firstRecordedPhoto.createdAt))
        ? firstRecordedPhoto
        : null;
    if (firstPhoto) {
      return createOmoideCandidate({
        catName,
        photo: firstPhoto,
        sourceDateKey: getJstDateKey(firstPhoto.createdAt),
        lookback: "week",
        reason: "first_seed",
        title: "はじめての、ねがお。",
        now,
        familySinceDate,
      });
    }
  }

  const lookbacks = getOmoideLookbackDateKeys(todayKey);
  for (const lookback of lookbacks) {
    if (hiddenDateKeys.has(lookback.dateKey)) {
      continue;
    }

    const photo = findRepresentativePhotoForDate(photos, lookback.dateKey);
    if (!photo) {
      continue;
    }

    return createOmoideCandidate({
      catName,
      photo,
      sourceDateKey: lookback.dateKey,
      lookback: lookback.lookback,
      reason: "same_day",
      title: getOmoideTitle(lookback),
      now,
      familySinceDate,
    });
  }

  return null;
}

function createOmoideCandidate({
  catName,
  photo,
  sourceDateKey,
  lookback,
  reason,
  title,
  now,
  familySinceDate,
}: {
  catName: string;
  photo: OwnSleepingPhoto;
  sourceDateKey: string;
  lookback: OmoideLookback;
  reason: OmoideReason;
  title: string;
  now: number;
  familySinceDate?: string;
}) {
  const days = Math.max(
    1,
    Math.round((now - photo.createdAt) / 86_400_000),
  );
  const season = getSeasonName(sourceDateKey);

  return {
    sourcePhotoId: photo.id,
    sourceDateKey,
    photo,
    lookback,
    reason,
    title,
    subtitle:
      reason === "first_seed"
        ? "はじめて記録した ねがおです。"
        : `${catName}の、${title.replace("、きょう。", "")}の ねがおです。`,
    voice:
      reason === "first_seed"
        ? "はじめての、ねがお。"
        : `${getSeasonCountLabel(sourceDateKey, familySinceDate)}の ${season} の、ある日。`,
    bridge:
      days >= 365
        ? `あれから、${Math.max(1, Math.floor(days / 365))}年。`
        : `あれから、${days}日。`,
  };
}

function findRepresentativePhotoForDate(
  photos: OwnSleepingPhoto[],
  dateKey: string,
) {
  return (
    photos
      .filter((photo) => getJstDateKey(photo.createdAt) === dateKey)
      .sort((a, b) => {
        const aScore = getRepresentativeScore(a);
        const bScore = getRepresentativeScore(b);
        return bScore - aScore || b.createdAt - a.createdAt;
      })[0] ?? null
  );
}

function getRepresentativeScore(photo: OwnSleepingPhoto) {
  let score = 0;
  if (photo.visibility === "shared") score += 2;
  if (photo.thumbnailSrc || photo.displaySrc) score += 1;
  return score;
}

export function getOmoideLookbackDateKeys(todayKey: string) {
  const keys: {
    lookback: OmoideLookback;
    dateKey: string;
    amount?: number;
  }[] = [
    { lookback: "year", dateKey: addJstMonths(todayKey, -12), amount: 1 },
  ];

  for (let years = 2; years <= 10; years += 1) {
    keys.push({
      lookback: "n_year",
      dateKey: addJstMonths(todayKey, -12 * years),
      amount: years,
    });
  }

  keys.push(
    { lookback: "half_year", dateKey: addJstMonths(todayKey, -6) },
    { lookback: "month", dateKey: addJstMonths(todayKey, -1) },
    { lookback: "week", dateKey: addJstDays(todayKey, -7) },
  );

  return keys;
}

function getOmoideTitle(lookback: {
  lookback: OmoideLookback;
  amount?: number;
}) {
  if (lookback.lookback === "week") return "1週間前の、きょう。";
  if (lookback.lookback === "month") return "1ヶ月前の、きょう。";
  if (lookback.lookback === "half_year") return "6ヶ月前の、きょう。";
  if (lookback.lookback === "year") return "1年前の、きょう。";
  return `${lookback.amount ?? 2}年前の、きょう。`;
}

function getDaysSinceFirstPhoto(
  photos: OwnSleepingPhoto[],
  catId: string,
  now: number,
) {
  const firstPhoto = photos
    .filter((photo) => photo.ownerCatId === catId || photo.catId === catId)
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  return firstPhoto ? getDaysSinceTimestamp(firstPhoto.createdAt, now) : 0;
}

function getDaysSinceTimestamp(timestamp: number, now: number) {
  return Math.max(1, Math.floor((now - timestamp) / 86_400_000) + 1);
}

function getSeasonName(dateKey: string) {
  const month = Number(dateKey.slice(5, 7));
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

function getSeasonCountLabel(dateKey: string, familySinceDate?: string) {
  const joinedAt = parseLocalDateStart(familySinceDate);
  if (joinedAt) {
    const joinedYear = Number(getJstDateKey(joinedAt).slice(0, 4));
    const photoYear = Number(dateKey.slice(0, 4));
    return `${Math.max(1, photoYear - joinedYear + 1)}回目`;
  }

  const year = Number(dateKey.slice(0, 4));
  const currentYear = Number(getJstDateKey().slice(0, 4));
  return `${Math.max(1, currentYear - year + 1)}回目`;
}

function addJstMonths(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${shifted.getUTCFullYear()}-${String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function parseLocalDateStart(value?: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000;
}

function readOmoideMemoryStore(): OmoideMemoryStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = readCachedJson<unknown>(STORAGE_KEYS.omoideMemories) ?? {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, memory]) => isValidOmoideMemory(memory)),
    ) as OmoideMemoryStore;
  } catch {
    return {};
  }
}

function writeOmoideMemoryStore(store: OmoideMemoryStore) {
  if (typeof window === "undefined") {
    return;
  }

  const entries = Object.entries(store)
    .filter(([, memory]) => isValidOmoideMemory(memory))
    .sort(([, a], [, b]) => b.deliveredAt - a.deliveredAt)
    .slice(0, 120);

  writeCachedJson(
    STORAGE_KEYS.omoideMemories,
    Object.fromEntries(entries),
  );
  window.dispatchEvent(new Event("neteruneko_omoide_memories_updated"));
}

function writeOmoideMemoryControls(controls: OmoideMemoryControls) {
  if (typeof window === "undefined") {
    return;
  }

  writeCachedJson(
    STORAGE_KEYS.omoideMemoryControls,
    controls,
  );
  window.dispatchEvent(new Event("neteruneko_omoide_memories_updated"));
}

function isValidOmoideMemory(value: unknown): value is OmoideMemory {
  if (!value || typeof value !== "object") {
    return false;
  }

  const memory = value as Partial<OmoideMemory>;
  return Boolean(
    typeof memory.id === "string" &&
      typeof memory.catId === "string" &&
      typeof memory.sourcePhotoId === "string" &&
      typeof memory.sourceDateKey === "string" &&
      typeof memory.deliveryDateKey === "string" &&
      typeof memory.deliveredAt === "number" &&
      memory.photo &&
      typeof memory.photo === "object" &&
      typeof memory.photo.src === "string",
  );
}

function createOmoideId(timestamp: number) {
  const random =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);
  return `omoide-${timestamp}-${random}`;
}
