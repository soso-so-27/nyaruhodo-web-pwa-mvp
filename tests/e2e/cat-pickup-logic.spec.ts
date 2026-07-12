import { expect, test } from "@playwright/test";

import {
  markCatPickupSeen,
  selectCatPickup,
  selectCatPickups,
  type CatPickupHistory,
  type CatPickupPhoto,
} from "../../src/lib/cats/pickup";
import type { CatSleepingMilestone } from "../../src/lib/home/sleepingPhotos";
import {
  getOmoideHouseholdIntervalDays,
  getOmoideLookbackDateKeys,
  type OmoideMemory,
} from "../../src/lib/home/omoideDelivery";

const now = Date.parse("2026-06-26T20:30:00+09:00");
const photoSrc =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lm6v9wAAAABJRU5ErkJggg==";

test.describe("cat pickup selection", () => {
  test("slows household omoide cadence after three opened memories", () => {
    expect(getOmoideHouseholdIntervalDays([])).toBe(7);
    expect(
      getOmoideHouseholdIntervalDays([
        { openedAt: now - 3 },
        { openedAt: now - 2 },
        { openedAt: now - 1 },
      ]),
    ).toBe(14);
    expect(
      getOmoideHouseholdIntervalDays([
        { openedAt: now - 2 },
        { openedAt: now - 1 },
        {},
      ]),
    ).toBe(7);
  });

  test("prefers longer omoide lookbacks over the weekly candidate", () => {
    expect(
      getOmoideLookbackDateKeys("2026-07-12").map(
        ({ lookback, amount }) => `${lookback}:${amount ?? 0}`,
      ),
    ).toEqual([
      "year:1",
      "n_year:2",
      "n_year:3",
      "n_year:4",
      "n_year:5",
      "n_year:6",
      "n_year:7",
      "n_year:8",
      "n_year:9",
      "n_year:10",
      "half_year:0",
      "month:0",
      "week:0",
    ]);
  });

  test("stays hidden when there is no strong reason to show a pickup", () => {
    expect(
      selectCatPickup({
        now,
        photos: [],
        milestones: emptyMilestones(),
        memories: [],
        birthdayStatus: null,
      }),
    ).toBeNull();
  });

  test("uses the first sleeping photo only in the early phase", () => {
    const pickup = selectCatPickup({
      now,
      photos: [photo("first", now - 86_400_000)],
      milestones: emptyMilestones(),
      memories: [],
      birthdayStatus: null,
    });

    expect(pickup?.type).toBe("first_photo");
    expect(pickup?.title).toBe("はじめてのねがお");
  });

  test("does not repeat a seen first photo during the cooldown", () => {
    const firstPhoto = photo("first", now - 86_400_000);
    const history: CatPickupHistory = {
      "first-photo-first": {
        id: "first-photo-first",
        type: "first_photo",
        sourceId: "first",
        seenAt: now - 86_400_000,
      },
    };

    expect(
      selectCatPickup({
        now,
        photos: [firstPhoto],
        milestones: emptyMilestones(),
        memories: [],
        birthdayStatus: null,
        history,
      }),
    ).toBeNull();
  });

  test("prefers a fresh larger milestone over early-photo pickup", () => {
    const pickup = selectCatPickup({
      now,
      photos: [photo("first", now - 86_400_000)],
      milestones: [
        ...emptyMilestones().filter((item) => item.target !== 50),
        milestone(50, "m50", now - 60_000),
      ],
      memories: [],
      birthdayStatus: null,
    });

    expect(pickup?.type).toBe("milestone");
    expect(pickup?.title).toBe("50枚目のねがお");
    expect(pickup?.score).toBeGreaterThanOrEqual(90);
  });

  test("shows an unopened past-photo memory without using delivered wording", () => {
    const pickup = selectCatPickup({
      now,
      photos: manyPhotos(12),
      milestones: emptyMilestones(),
      memories: [memory("memory-year", "source-year", now - 30_000, "year")],
      birthdayStatus: null,
    });

    expect(pickup?.type).toBe("memory");
    expect(pickup?.title).toBe("思い出");
    expect(pickup?.body).toBe("1年前のねがおです");
    expect(pickup?.score).toBeGreaterThanOrEqual(90);
  });

  test("lets the birthday status win because it is today-only", () => {
    const pickup = selectCatPickup({
      now,
      photos: manyPhotos(12),
      milestones: emptyMilestones(),
      memories: [memory("memory-week", "source-week", now - 30_000, "week")],
      birthdayStatus: { copy: "今日は誕生日です", isToday: true },
    });

    expect(pickup?.type).toBe("birthday");
    expect(pickup?.actionLabel).toBe("記念を見る");
  });

  test("uses the fixed priority of anniversary, milestone, then memory", () => {
    const pickup = selectCatPickup({
      now,
      photos: manyPhotos(12),
      milestones: [
        ...emptyMilestones().filter((item) => item.target !== 10),
        milestone(10, "milestone-10", now - 30_000),
      ],
      memories: [memory("memory-week", "source-week", now - 30_000, "week")],
      birthdayStatus: { copy: "きょうは 誕生日", isToday: true },
    });

    expect(pickup?.type).toBe("birthday");
  });

  test("allows two pickups only when birthday and family anniversary overlap", () => {
    const pickups = selectCatPickups({
      now,
      photos: manyPhotos(12),
      milestones: emptyMilestones(),
      memories: [memory("memory-week", "source-week", now - 30_000, "week")],
      birthdayStatus: { copy: "きょうは 誕生日", isToday: true },
      familyAnniversaryStatus: { copy: "きょうは 家族になった日", isToday: true },
    });

    expect(pickups.map((pickup) => pickup.type)).toEqual([
      "birthday",
      "family_anniversary",
    ]);
  });

  test("keeps a milestone for the next day when today is won by an anniversary", () => {
    const milestonePickup = milestone(10, "milestone-10", now - 30_000);
    const today = selectCatPickup({
      now,
      photos: manyPhotos(12),
      milestones: [...emptyMilestones().filter((item) => item.target !== 10), milestonePickup],
      memories: [memory("memory-week", "source-week", now - 30_000, "week")],
      birthdayStatus: { copy: "きょうは 誕生日", isToday: true },
    });

    expect(today?.type).toBe("birthday");

    const tomorrow = selectCatPickup({
      now: now + 86_400_000,
      photos: manyPhotos(12),
      milestones: [...emptyMilestones().filter((item) => item.target !== 10), milestonePickup],
      memories: [memory("memory-week", "source-week", now - 30_000, "week")],
      birthdayStatus: null,
      history: {
        [today!.id]: {
          id: today!.id,
          type: today!.type,
          sourceId: today!.sourceId,
          seenAt: now,
        },
      },
    });

    expect(tomorrow?.type).toBe("milestone");
    expect(tomorrow?.id).toBe("milestone-10");
  });
});

test("marks a cat pickup as seen in local storage", () => {
  const storage = new Map<string, string>();
  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      removeEventListener: () => undefined,
    },
  });

  try {
    markCatPickupSeen(
      "cat-mugi",
      {
        id: "first-photo-first",
        type: "first_photo",
        sourceId: "first",
        title: "はじめてのねがお",
        body: "最初の1枚を残せました",
        actionLabel: "見る",
        score: 80,
        scoredAt: now,
        target: {
          kind: "photo",
          photo: {
            src: "",
            title: "はじめてのねがお",
            timestamp: now,
          },
        },
      },
      now,
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }

  const raw = storage.get("neteruneko_cat_pickup_history");

  expect(raw).toContain("cat-mugi");
  expect(raw).toContain("first-photo-first");
});

function photo(id: string, createdAt: number): CatPickupPhoto {
  return {
    id,
    src: photoSrc,
    createdAt,
  };
}

function manyPhotos(count: number) {
  return Array.from({ length: count }, (_, index) =>
    photo(`photo-${index}`, now - index * 86_400_000),
  );
}

function emptyMilestones(): CatSleepingMilestone[] {
  return [1, 10, 50, 100].map((target) => ({
    target: target as CatSleepingMilestone["target"],
    photoId: "",
    src: "",
    reachedAt: 0,
  }));
}

function milestone(
  target: CatSleepingMilestone["target"],
  photoId: string,
  reachedAt: number,
): CatSleepingMilestone {
  return {
    target,
    photoId,
    src: photoSrc,
    reachedAt,
  };
}

function memory(
  id: string,
  sourcePhotoId: string,
  deliveredAt: number,
  lookback: OmoideMemory["lookback"],
): OmoideMemory {
  const sourcePhoto = {
    id: sourcePhotoId,
    ownerCatId: "cat-mugi",
    catId: "cat-mugi",
    src: photoSrc,
    thumbnailSrc: photoSrc,
    displaySrc: photoSrc,
    state: "sleeping",
    visibility: "private",
    deliveryStatus: "available",
    triggerLabel: "sleeping",
    theme: "sleeping",
    shared: false,
    createdAt: deliveredAt - 365 * 86_400_000,
  } as const;

  return {
    id,
    catId: "cat-mugi",
    catName: "むぎ",
    sourcePhotoId,
    sourceDateKey: "2025-06-26",
    deliveryDateKey: "2026-06-26",
    photo: sourcePhoto,
    lookback,
    reason: "same_day",
    title: "1年前の、きょう。",
    subtitle: "",
    voice: "",
    bridge: "",
    deliveredAt,
  };
}
