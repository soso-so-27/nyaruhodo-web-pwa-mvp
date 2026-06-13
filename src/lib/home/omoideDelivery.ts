import { trackProductEvent } from "../analytics/productAnalytics";
import { STORAGE_KEYS } from "../storage";
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
};

const MIN_DELIVERY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const FIRST_SEED_START_DAY = 7;
const FIRST_SEED_END_DAY = 10;

export function readOmoideMemories(): OmoideMemory[] {
  return Object.values(readOmoideMemoryStore())
    .filter(isValidOmoideMemory)
    .sort((a, b) => b.deliveredAt - a.deliveredAt);
}

export function readOmoideMemoriesForCat(catId: string | null) {
  const memories = readOmoideMemories();
  return catId ? memories.filter((memory) => memory.catId === catId) : memories;
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
  const todayKey = getJstDateKey(now);
  const existing = Object.values(store).find(
    (memory) => memory.catId === catId && memory.deliveryDateKey === todayKey,
  );
  if (existing) {
    return existing;
  }

  const latest = readOmoideMemoriesForCat(catId)[0];
  if (latest && now - latest.deliveredAt < MIN_DELIVERY_INTERVAL_MS) {
    return null;
  }

  const candidate = selectOmoideCandidate({
    catId,
    catName,
    familySinceDate,
    ownPhotos,
    controls,
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

  trackProductEvent(
    "omoide_generated",
    {
      lookback: memory.lookback,
      reason: memory.reason,
      days_since_join: getDaysSinceJoin(familySinceDate, now),
    },
    { localCatId: catId },
  );

  return memory;
}

export function markOmoideMemoryOpened(id: string, openedAt = Date.now()) {
  const store = readOmoideMemoryStore();
  const memory = store[id];
  if (!memory) {
    return null;
  }

  const nextMemory = { ...memory, openedAt };
  writeOmoideMemoryStore({ ...store, [id]: nextMemory });
  trackProductEvent(
    "omoide_opened",
    { source: "home", memory_age: openedAt - memory.photo.createdAt },
    { localCatId: memory.catId },
  );
  return nextMemory;
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
    const raw = window.localStorage.getItem(STORAGE_KEYS.omoideMemoryControls);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
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
  now,
}: {
  catId: string;
  catName: string;
  familySinceDate?: string;
  ownPhotos: OwnSleepingPhoto[];
  controls: OmoideMemoryControls;
  now: number;
}) {
  const photos = ownPhotos
    .filter((photo) => photo.ownerCatId === catId || photo.catId === catId)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (photos.length === 0) {
    return null;
  }

  const hiddenDateKeys = new Set(controls.hiddenDateKeys ?? []);
  const daysSinceJoin = getDaysSinceJoin(familySinceDate, now);
  const todayKey = getJstDateKey(now);
  const priorMemories = readOmoideMemoriesForCat(catId);

  if (
    daysSinceJoin >= FIRST_SEED_START_DAY &&
    daysSinceJoin <= FIRST_SEED_END_DAY &&
    !priorMemories.some((memory) => memory.reason === "first_seed")
  ) {
    const firstPhoto = photos.find(
      (photo) => !hiddenDateKeys.has(getJstDateKey(photo.createdAt)),
    );
    if (firstPhoto) {
      return createOmoideCandidate({
        catName,
        photo: firstPhoto,
        sourceDateKey: getJstDateKey(firstPhoto.createdAt),
        lookback: "week",
        reason: "first_seed",
        title: "はじめての、ねがお。",
        now,
      });
    }
  }

  const lookbacks = getLookbackDateKeys(todayKey);
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
}: {
  catName: string;
  photo: OwnSleepingPhoto;
  sourceDateKey: string;
  lookback: OmoideLookback;
  reason: OmoideReason;
  title: string;
  now: number;
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
        ? "はじめての ねがお が 届きました。"
        : `${title.replace("、きょう。", "")} の ${catName}から 届きました。`,
    voice:
      reason === "first_seed"
        ? "はじめての、ねがお。"
        : `${getSeasonCountLabel(sourceDateKey)}の ${season} の、ある日。`,
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

function getLookbackDateKeys(todayKey: string) {
  const keys: {
    lookback: OmoideLookback;
    dateKey: string;
    amount?: number;
  }[] = [
    { lookback: "week", dateKey: addJstDays(todayKey, -7) },
    { lookback: "month", dateKey: addJstMonths(todayKey, -1) },
    { lookback: "half_year", dateKey: addJstMonths(todayKey, -6) },
    { lookback: "year", dateKey: addJstMonths(todayKey, -12), amount: 1 },
  ];

  for (let years = 2; years <= 10; years += 1) {
    keys.push({
      lookback: "n_year",
      dateKey: addJstMonths(todayKey, -12 * years),
      amount: years,
    });
  }

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

function getDaysSinceJoin(familySinceDate: string | undefined, now: number) {
  const joinedAt = parseLocalDateStart(familySinceDate);
  if (!joinedAt) {
    return 0;
  }

  return Math.max(1, Math.floor((now - joinedAt) / 86_400_000) + 1);
}

function getSeasonName(dateKey: string) {
  const month = Number(dateKey.slice(5, 7));
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

function getSeasonCountLabel(dateKey: string) {
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
    const raw = window.localStorage.getItem(STORAGE_KEYS.omoideMemories);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
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

  window.localStorage.setItem(
    STORAGE_KEYS.omoideMemories,
    JSON.stringify(Object.fromEntries(entries)),
  );
  window.dispatchEvent(new Event("neteruneko_omoide_memories_updated"));
}

function writeOmoideMemoryControls(controls: OmoideMemoryControls) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEYS.omoideMemoryControls,
    JSON.stringify(controls),
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
