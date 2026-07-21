const DAY_MS = 24 * 60 * 60 * 1000;

export const EVENING_CHOICE_RECIRCULATION_POLICY =
  "unselected_14_nights_v1";
export const EVENING_CHOICE_COOLDOWN_NIGHTS = 14;

export type DeliveryExposureRow = {
  source_moment_id: string | null;
  source_photo_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  delivered_at: string;
};

export type DeliveryExposureHistory = {
  allSourceIds: Set<string>;
  permanentSourceIds: Set<string>;
  recentSourceIds: Set<string>;
  lastShownAtBySourceId: Map<string, number>;
};

/**
 * A four-choice candidate that was merely shown may return after fourteen
 * complete intervening delivery nights. Everything else keeps the legacy
 * never-repeat behavior. Permanent exclusions always win for a source that
 * appears in both kinds of history.
 */
export function classifyDeliveryExposureHistory({
  rows,
  currentDateKey,
  cooldownNights = EVENING_CHOICE_COOLDOWN_NIGHTS,
}: {
  rows: DeliveryExposureRow[];
  currentDateKey: string;
  cooldownNights?: number;
}): DeliveryExposureHistory {
  const allSourceIds = new Set<string>();
  const permanentSourceIds = new Set<string>();
  const recentSourceIds = new Set<string>();
  const lastShownAtBySourceId = new Map<string, number>();

  for (const row of rows) {
    const sourceIds = readSourceIds(row);
    if (sourceIds.length === 0) {
      continue;
    }

    sourceIds.forEach((sourceId) => allSourceIds.add(sourceId));

    if (!isRecirculatableFourChoiceExposure(row)) {
      sourceIds.forEach((sourceId) => permanentSourceIds.add(sourceId));
      continue;
    }

    const shownAt = Date.parse(row.delivered_at);
    if (!Number.isFinite(shownAt)) {
      sourceIds.forEach((sourceId) => permanentSourceIds.add(sourceId));
      continue;
    }

    for (const sourceId of sourceIds) {
      const previousShownAt = lastShownAtBySourceId.get(sourceId) ?? 0;
      lastShownAtBySourceId.set(sourceId, Math.max(previousShownAt, shownAt));
    }

    const exposureDateKey = readExposureDateKey(row);
    const gapNights = exposureDateKey
      ? differenceInDateKeys(exposureDateKey, currentDateKey)
      : null;

    if (gapNights === null || gapNights <= cooldownNights) {
      sourceIds.forEach((sourceId) => recentSourceIds.add(sourceId));
    }
  }

  for (const sourceId of permanentSourceIds) {
    recentSourceIds.delete(sourceId);
  }

  return {
    allSourceIds,
    permanentSourceIds,
    recentSourceIds,
    lastShownAtBySourceId,
  };
}

export function buildFourChoiceExcludedSourceIds(
  history: DeliveryExposureHistory,
) {
  return new Set([
    ...history.permanentSourceIds,
    ...history.recentSourceIds,
  ]);
}

export function readCandidateLastShownAt(
  history: DeliveryExposureHistory,
  sourceIds: Array<string | null | undefined>,
) {
  let lastShownAt: number | null = null;

  for (const sourceId of sourceIds) {
    if (!sourceId) {
      continue;
    }
    const shownAt = history.lastShownAtBySourceId.get(sourceId);
    if (shownAt !== undefined) {
      lastShownAt = Math.max(lastShownAt ?? 0, shownAt);
    }
  }

  return lastShownAt;
}

function isRecirculatableFourChoiceExposure(row: DeliveryExposureRow) {
  const metadata = row.metadata ?? {};
  return (
    row.status === "delivered" &&
    metadata.experience_version === "evening_choice_v1" &&
    metadata.served_variant === "four_choice_v1" &&
    typeof metadata.bundle_id === "string" &&
    metadata.bundle_id.length > 0 &&
    typeof metadata.delivery_position === "number" &&
    Number.isInteger(metadata.delivery_position) &&
    metadata.delivery_position >= 1 &&
    metadata.delivery_position <= 4
  );
}

function readSourceIds(row: DeliveryExposureRow) {
  return [...new Set([row.source_moment_id, row.source_photo_id])].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function readExposureDateKey(row: DeliveryExposureRow) {
  const metadataDateKey = row.metadata?.delivery_date_key;
  if (typeof metadataDateKey === "string" && isDateKey(metadataDateKey)) {
    return metadataDateKey;
  }

  const deliveredAt = Date.parse(row.delivered_at);
  if (!Number.isFinite(deliveredAt)) {
    return null;
  }

  const jstDate = new Date(deliveredAt + 9 * 60 * 60 * 1000);
  return [
    jstDate.getUTCFullYear(),
    String(jstDate.getUTCMonth() + 1).padStart(2, "0"),
    String(jstDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function differenceInDateKeys(fromDateKey: string, toDateKey: string) {
  if (!isDateKey(fromDateKey) || !isDateKey(toDateKey)) {
    return null;
  }

  const from = Date.parse(`${fromDateKey}T00:00:00.000Z`);
  const to = Date.parse(`${toDateKey}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return null;
  }

  return Math.floor((to - from) / DAY_MS);
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
