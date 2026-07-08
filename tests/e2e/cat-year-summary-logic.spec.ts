import { expect, test } from "@playwright/test";

import {
  createCatYearSummaries,
  type CatYearSummaryPhoto,
} from "../../src/lib/cats/yearSummary";
import type { CatSleepingMilestone } from "../../src/lib/home/sleepingPhotos";
import type { OmoideMemory } from "../../src/lib/home/omoideDelivery";

const photoSrc =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lm6v9wAAAABJRU5ErkJggg==";

test.describe("cat year summaries", () => {
  test("groups photos, pickups, and milestones by year", () => {
    const summaries = createCatYearSummaries({
      photos: [
        photo("p2026-a", "2026-06-10T12:00:00+09:00"),
        photo("p2026-b", "2026-06-11T12:00:00+09:00"),
        photo("p2025", "2025-05-10T12:00:00+09:00"),
      ],
      memories: [memory("m2026", "2026-06-12T20:00:00+09:00")],
      milestones: [milestone(10, "2026-06-11T12:00:00+09:00")],
    });

    expect(summaries.map((summary) => summary.year)).toEqual([2026, 2025]);
    expect(summaries[0]).toMatchObject({
      photoCount: 2,
      pickupCount: 1,
      milestoneCount: 1,
      activeMonthLabel: "6月によく とりました",
      highlights: ["10枚目"],
    });
    expect(summaries[1]).toMatchObject({
      photoCount: 1,
      pickupCount: 0,
      milestoneCount: 0,
      activeMonthLabel: "5月によく とりました",
    });
  });

  test("uses the current year as a quiet empty state", () => {
    const summaries = createCatYearSummaries({
      photos: [],
      memories: [],
      milestones: [],
      now: Date.parse("2026-06-10T12:00:00+09:00"),
    });

    expect(summaries).toEqual([
      {
        year: 2026,
        photoCount: 0,
        pickupCount: 0,
        milestoneCount: 0,
        activeMonthLabel: "これから",
        coverSrc: undefined,
        highlights: [],
      },
    ]);
  });
});

function photo(id: string, createdAt: string): CatYearSummaryPhoto {
  return {
    id,
    src: photoSrc,
    createdAt: Date.parse(createdAt),
  };
}

function milestone(
  target: CatSleepingMilestone["target"],
  reachedAt: string,
): CatSleepingMilestone {
  return {
    target,
    photoId: `milestone-${target}`,
    src: photoSrc,
    reachedAt: Date.parse(reachedAt),
  };
}

function memory(id: string, deliveredAt: string): OmoideMemory {
  const timestamp = Date.parse(deliveredAt);

  return {
    id,
    catId: "cat-mugi",
    catName: "むぎ",
    sourcePhotoId: `source-${id}`,
    sourceDateKey: "2025-06-12",
    deliveryDateKey: "2026-06-12",
    photo: {
      id: `source-${id}`,
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
      createdAt: timestamp - 365 * 86_400_000,
    },
    lookback: "year",
    reason: "same_day",
    title: "1年前の、きょう。",
    subtitle: "",
    voice: "",
    bridge: "",
    deliveredAt: timestamp,
    openedAt: timestamp + 60_000,
  };
}
