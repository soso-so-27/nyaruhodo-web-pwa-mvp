import type { CatSleepingMilestone } from "../home/sleepingPhotos";
import type { OmoideMemory } from "../home/omoideDelivery";

export type CatYearSummaryPhoto = {
  id: string;
  src: string;
  createdAt: number;
};

export type CatYearSummary = {
  year: number;
  photoCount: number;
  pickupCount: number;
  milestoneCount: number;
  activeMonthLabel: string;
  coverSrc?: string;
  highlights: string[];
};

export function createCatYearSummaries({
  photos,
  memories,
  milestones,
  now = Date.now(),
}: {
  photos: CatYearSummaryPhoto[];
  memories: OmoideMemory[];
  milestones: CatSleepingMilestone[];
  now?: number;
}): CatYearSummary[] {
  const rows = new Map<number, MutableYearSummary>();

  for (const photo of photos) {
    const date = toValidDate(photo.createdAt);
    const year = date.getFullYear();
    const row = getOrCreateRow(rows, year);
    row.photoCount += 1;
    row.monthCounts.set(date.getMonth(), (row.monthCounts.get(date.getMonth()) ?? 0) + 1);

    if (!row.coverSrc || photo.createdAt > row.coverTimestamp) {
      row.coverSrc = photo.src;
      row.coverTimestamp = photo.createdAt;
    }
  }

  for (const memory of memories) {
    const year = getYearFromDateKey(memory.deliveryDateKey);
    const row = getOrCreateRow(rows, year);
    row.pickupCount += 1;
  }

  for (const milestone of milestones) {
    if (!milestone.reachedAt) {
      continue;
    }

    const year = toValidDate(milestone.reachedAt).getFullYear();
    const row = getOrCreateRow(rows, year);
    row.milestoneCount += 1;
    row.highlights.push(getYearMilestoneLabel(milestone.target));

    if (!row.coverSrc && milestone.src) {
      row.coverSrc = milestone.src;
      row.coverTimestamp = milestone.reachedAt;
    }
  }

  if (rows.size === 0) {
    getOrCreateRow(rows, toValidDate(now).getFullYear());
  }

  return [...rows.values()]
    .map(toYearSummary)
    .sort((left, right) => right.year - left.year);
}

type MutableYearSummary = {
  year: number;
  photoCount: number;
  pickupCount: number;
  milestoneCount: number;
  monthCounts: Map<number, number>;
  coverSrc?: string;
  coverTimestamp: number;
  highlights: string[];
};

function getOrCreateRow(rows: Map<number, MutableYearSummary>, year: number) {
  const existing = rows.get(year);
  if (existing) {
    return existing;
  }

  const row: MutableYearSummary = {
    year,
    photoCount: 0,
    pickupCount: 0,
    milestoneCount: 0,
    monthCounts: new Map(),
    coverTimestamp: 0,
    highlights: [],
  };
  rows.set(year, row);
  return row;
}

function toYearSummary(row: MutableYearSummary): CatYearSummary {
  return {
    year: row.year,
    photoCount: row.photoCount,
    pickupCount: row.pickupCount,
    milestoneCount: row.milestoneCount,
    activeMonthLabel: getActiveMonthLabel(row.monthCounts),
    coverSrc: row.coverSrc,
    highlights: unique(row.highlights).slice(0, 3),
  };
}

function getActiveMonthLabel(monthCounts: Map<number, number>) {
  const [month] =
    [...monthCounts.entries()].sort(
      ([leftMonth, leftCount], [rightMonth, rightCount]) =>
        rightCount - leftCount || rightMonth - leftMonth,
    )[0] ?? [];

  return typeof month === "number" ? `${month + 1}月によく撮りました` : "これから";
}

function getYearMilestoneLabel(target: CatSleepingMilestone["target"]) {
  if (target === 1) return "はじめてのねがお";
  return `${target}枚目`;
}

function toValidDate(timestamp: number) {
  const date = new Date(timestamp || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getYearFromDateKey(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  return year || new Date().getFullYear();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
