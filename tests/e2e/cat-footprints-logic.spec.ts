import { expect, test } from "@playwright/test";

import {
  createCatFootprintEntries,
  type CatFootprintPhoto,
} from "../../src/lib/cats/footprints";
import type { CatSleepingMilestone } from "../../src/lib/home/sleepingPhotos";
import type { OmoideMemory } from "../../src/lib/home/omoideDelivery";

const now = Date.parse("2026-06-26T20:30:00+09:00");
const photoSrc =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lm6v9wAAAABJRU5ErkJggg==";

test.describe("cat footprints", () => {
  test("mixes recent photos and milestones without duplicating milestone photos", () => {
    const entries = createCatFootprintEntries({
      photos: [
        photo("photo-11", now - 60_000),
        photo("photo-10", now - 120_000),
        photo("photo-9", now - 180_000),
      ],
      milestones: [
        ...emptyMilestones().filter((item) => item.target !== 10),
        milestone(10, "photo-10", now - 120_000),
      ],
      memories: [],
      max: 4,
    });

    expect(entries.map((entry) => entry.title)).toEqual([
      "ねがおを撮った",
      "10枚目",
      "ねがおを撮った",
    ]);
    expect(entries.filter((entry) => entry.id.includes("photo-10"))).toHaveLength(0);
    expect(entries.some((entry) => entry.id === "milestone-10")).toBe(true);
  });

  test("does not show unopened pickup memories as footprints", () => {
    const entries = createCatFootprintEntries({
      photos: [],
      milestones: emptyMilestones(),
      memories: [memory("unopened", now - 60_000)],
    });

    expect(entries).toHaveLength(0);
  });

  test("shows opened pickup memories as viewed footprints", () => {
    const entries = createCatFootprintEntries({
      photos: [],
      milestones: emptyMilestones(),
      memories: [{ ...memory("opened", now - 120_000), openedAt: now - 60_000 }],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("思い出を見た");
    expect(entries[0].type).toBe("pickup");
  });

  test("keeps the recent list compact and newest first", () => {
    const entries = createCatFootprintEntries({
      photos: Array.from({ length: 8 }, (_, index) =>
        photo(`photo-${index}`, now - index * 60_000),
      ),
      milestones: emptyMilestones(),
      memories: [],
      max: 4,
    });

    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.id)).toEqual([
      "photo-photo-0",
      "photo-photo-1",
      "photo-photo-2",
      "photo-photo-3",
    ]);
  });

  test("does not treat cat gallery photos as sleeping-photo footprints", () => {
    const entries = createCatFootprintEntries({
      photos: [
        photo("gallery-photo", now - 30_000, "photo"),
        photo("sleeping-photo", now - 60_000, "sleeping"),
      ],
      milestones: emptyMilestones(),
      memories: [],
    });

    expect(entries.map((entry) => entry.id)).toEqual(["photo-sleeping-photo"]);
  });
});

function photo(
  id: string,
  createdAt: number,
  kind: CatFootprintPhoto["kind"] = "sleeping",
): CatFootprintPhoto {
  return {
    id,
    src: photoSrc,
    createdAt,
    kind,
  };
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

function memory(id: string, deliveredAt: number): OmoideMemory {
  return {
    id,
    catId: "cat-mugi",
    catName: "むぎ",
    sourcePhotoId: `source-${id}`,
    sourceDateKey: "2025-06-26",
    deliveryDateKey: "2026-06-26",
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
      createdAt: deliveredAt - 365 * 86_400_000,
    },
    lookback: "year",
    reason: "same_day",
    title: "1年前の、きょう。",
    subtitle: "",
    voice: "",
    bridge: "",
    deliveredAt,
  };
}
