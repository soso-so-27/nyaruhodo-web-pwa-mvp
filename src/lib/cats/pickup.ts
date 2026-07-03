import type {
  CatSleepingMilestone,
  CatSleepingMilestoneTarget,
} from "../home/sleepingPhotos";
import type { OmoideMemory } from "../home/omoideDelivery";
import { readCachedJson, writeCachedJson } from "../storage";

export type CatPickupPhoto = {
  id: string;
  src: string;
  createdAt: number;
};

export type CatPickupHistoryItem = {
  id: string;
  type: CatPickupType;
  sourceId: string;
  seenAt: number;
};

export type CatPickupHistory = Record<string, CatPickupHistoryItem>;

export type CatPickupType =
  | "birthday"
  | "first_photo"
  | "memory"
  | "milestone";

export type CatPickupTarget =
  | { kind: "memory"; memory: OmoideMemory }
  | {
      kind: "photo";
      photo: {
        src: string;
        title: string;
        timestamp: number;
      };
    }
  | { kind: "milestones" };

export type CatPickup = {
  id: string;
  type: CatPickupType;
  sourceId: string;
  title: string;
  body: string;
  actionLabel: string;
  score: number;
  scoredAt: number;
  src?: string;
  target: CatPickupTarget;
};

export type CatPickupInput = {
  now: number;
  photos: CatPickupPhoto[];
  milestones: CatSleepingMilestone[];
  memories: OmoideMemory[];
  birthdayStatus: { copy: string; isToday: boolean } | null;
  history?: CatPickupHistory;
};

const CAT_PICKUP_HISTORY_KEY = "neteruneko_cat_pickup_history";
const MIN_PICKUP_SCORE = 72;
const RECENT_SEEN_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const RECENT_TYPE_PENALTY_MS = 2 * 24 * 60 * 60 * 1000;
const MILESTONE_FRESH_MS = 14 * 24 * 60 * 60 * 1000;

export function selectCatPickup({
  now,
  photos,
  milestones,
  memories,
  birthdayStatus,
  history = {},
}: CatPickupInput): CatPickup | null {
  const candidates = [
    createBirthdayCandidate({ now, birthdayStatus }),
    createMemoryCandidate({ now, memories }),
    createMilestoneCandidate({ now, milestones }),
    createFirstPhotoCandidate({ now, photos }),
  ].filter((candidate): candidate is CatPickup => Boolean(candidate));

  const ranked = candidates
    .map((candidate) => applyHistoryScore(candidate, history, now))
    .filter((candidate) => candidate.score >= MIN_PICKUP_SCORE)
    .sort((left, right) => right.score - left.score || right.scoredAt - left.scoredAt);

  return ranked[0] ?? null;
}

export function readCatPickupHistory(catId: string | null): CatPickupHistory {
  if (!catId || typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = readCachedJson<Record<string, unknown>>(CAT_PICKUP_HISTORY_KEY) ?? {};
    const byCat = parsed?.[catId];

    if (!byCat || typeof byCat !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(byCat).filter(([, value]) => isCatPickupHistoryItem(value)),
    ) as CatPickupHistory;
  } catch {
    return {};
  }
}

export function markCatPickupSeen(
  catId: string | null,
  pickup: CatPickup,
  seenAt = Date.now(),
) {
  if (!catId || typeof window === "undefined") {
    return;
  }

  try {
    const parsed = readCachedJson<Record<string, unknown>>(CAT_PICKUP_HISTORY_KEY) ?? {};
    const store = parsed && typeof parsed === "object" ? parsed : {};
    const current =
      store[catId] && typeof store[catId] === "object" ? store[catId] : {};

    writeCachedJson(
      CAT_PICKUP_HISTORY_KEY,
      {
        ...store,
        [catId]: prunePickupHistory({
          ...current,
          [pickup.id]: {
            id: pickup.id,
            type: pickup.type,
            sourceId: pickup.sourceId,
            seenAt,
          },
        }),
      },
    );
  } catch {
    // Pickup history is a quality-of-life guard. Failing silently keeps the page usable.
  }
}

function createBirthdayCandidate({
  now,
  birthdayStatus,
}: Pick<CatPickupInput, "now" | "birthdayStatus">): CatPickup | null {
  if (!birthdayStatus?.isToday) {
    return null;
  }

  const year = new Date(now).getFullYear();

  return {
    id: `birthday-${year}`,
    type: "birthday",
    sourceId: `birthday-${year}`,
    title: "誕生日",
    body: "今日は大事な日です",
    actionLabel: "記念を見る",
    score: 96,
    scoredAt: now,
    target: { kind: "milestones" },
  };
}

function createMemoryCandidate({
  now,
  memories,
}: Pick<CatPickupInput, "now" | "memories">): CatPickup | null {
  const memory =
    memories.find(
      (item) =>
        item.deliveredAt <= now && !item.openedAt && !item.dismissedAt,
    ) ?? null;

  if (!memory) {
    return null;
  }

  return {
    id: `memory-${memory.id}`,
    type: "memory",
    sourceId: memory.sourcePhotoId,
    title: "思い出",
    body: getMemoryPickupBody(memory),
    actionLabel: "見る",
    score: 82 + getLookbackBonus(memory.lookback),
    scoredAt: memory.deliveredAt,
    src: memory.photo.thumbnailSrc ?? memory.photo.displaySrc ?? memory.photo.src,
    target: { kind: "memory", memory },
  };
}

function createMilestoneCandidate({
  now,
  milestones,
}: Pick<CatPickupInput, "now" | "milestones">): CatPickup | null {
  const milestone =
    milestones
      .filter(
        (item) =>
          item.reachedAt > 0 &&
          item.src &&
          now - item.reachedAt <= MILESTONE_FRESH_MS,
      )
      .sort((left, right) => right.target - left.target || right.reachedAt - left.reachedAt)[0] ??
    null;

  if (!milestone) {
    return null;
  }

  return {
    id: `milestone-${milestone.target}`,
    type: "milestone",
    sourceId: milestone.photoId || `milestone-${milestone.target}`,
    title: getMilestoneTitle(milestone.target),
    body: `${milestone.target}枚までたまりました`,
    actionLabel: "見る",
    score: milestone.target >= 50 ? 90 : 84,
    scoredAt: milestone.reachedAt,
    src: milestone.src,
    target: {
      kind: "photo",
      photo: {
        src: milestone.src,
        title: getMilestoneTitle(milestone.target),
        timestamp: milestone.reachedAt,
      },
    },
  };
}

function createFirstPhotoCandidate({
  now,
  photos,
}: Pick<CatPickupInput, "now" | "photos">): CatPickup | null {
  const firstPhoto = [...photos].sort((left, right) => left.createdAt - right.createdAt)[0];

  if (!firstPhoto || photos.length > 2) {
    return null;
  }

  return {
    id: `first-photo-${firstPhoto.id}`,
    type: "first_photo",
    sourceId: firstPhoto.id,
    title: "はじめてのねがお",
    body: "最初の1枚を残せました",
    actionLabel: "見る",
    score: 80,
    scoredAt: firstPhoto.createdAt || now,
    src: firstPhoto.src,
    target: {
      kind: "photo",
      photo: {
        src: firstPhoto.src,
        title: "はじめてのねがお",
        timestamp: firstPhoto.createdAt,
      },
    },
  };
}

function applyHistoryScore(
  pickup: CatPickup,
  history: CatPickupHistory,
  now: number,
) {
  const seenItems = Object.values(history).sort((left, right) => right.seenAt - left.seenAt);
  const latestSameSource = seenItems.find(
    (item) => item.sourceId === pickup.sourceId || item.id === pickup.id,
  );

  if (latestSameSource && now - latestSameSource.seenAt < RECENT_SEEN_COOLDOWN_MS) {
    return { ...pickup, score: 0 };
  }

  const latestSeen = seenItems[0];
  if (
    latestSeen?.type === pickup.type &&
    now - latestSeen.seenAt < RECENT_TYPE_PENALTY_MS
  ) {
    return { ...pickup, score: pickup.score - 18 };
  }

  return pickup;
}

function prunePickupHistory(history: CatPickupHistory) {
  return Object.fromEntries(
    Object.entries(history)
      .filter(([, item]) => isCatPickupHistoryItem(item))
      .sort(([, left], [, right]) => right.seenAt - left.seenAt)
      .slice(0, 80),
  );
}

function getMemoryPickupBody(memory: OmoideMemory) {
  if (memory.lookback === "week") return "前のねがおを見返せます";
  if (memory.lookback === "month") return "1か月前のねがおです";
  if (memory.lookback === "half_year") return "半年前のねがおです";
  if (memory.lookback === "year") return "1年前のねがおです";
  return "前に撮ったねがおです";
}

function getLookbackBonus(lookback: OmoideMemory["lookback"]) {
  if (lookback === "year" || lookback === "n_year") return 12;
  if (lookback === "half_year") return 9;
  if (lookback === "month") return 6;
  return 3;
}

function getMilestoneTitle(target: CatSleepingMilestoneTarget) {
  if (target === 1) return "はじめてのねがお";
  return `${target}枚目のねがお`;
}

function isCatPickupHistoryItem(value: unknown): value is CatPickupHistoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<CatPickupHistoryItem>;
  return (
    typeof item.id === "string" &&
    isCatPickupType(item.type) &&
    typeof item.sourceId === "string" &&
    typeof item.seenAt === "number" &&
    Number.isFinite(item.seenAt)
  );
}

function isCatPickupType(value: unknown): value is CatPickupType {
  return (
    value === "birthday" ||
    value === "first_photo" ||
    value === "memory" ||
    value === "milestone"
  );
}
