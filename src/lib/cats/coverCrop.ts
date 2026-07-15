export type CatCoverCrop = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const CAT_COVER_CROP_MIN_SCALE = 0.25;

const CAT_COVER_CROP_MAX_SCALE = 2.8;
const CAT_COVER_CROP_MAX_OFFSET = 48;

export function normalizeCatCoverCrop(
  crop:
    | Partial<CatCoverCrop>
    | Record<string, unknown>
    | null
    | undefined,
): CatCoverCrop | undefined {
  if (!crop || typeof crop !== "object" || Array.isArray(crop)) {
    return undefined;
  }

  const scale = Number(crop.scale);
  const offsetX = Number(crop.offsetX);
  const offsetY = Number(crop.offsetY);

  if (
    !Number.isFinite(scale) ||
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY)
  ) {
    return undefined;
  }

  return {
    scale: Math.min(
      CAT_COVER_CROP_MAX_SCALE,
      Math.max(CAT_COVER_CROP_MIN_SCALE, scale),
    ),
    offsetX: Math.min(
      CAT_COVER_CROP_MAX_OFFSET,
      Math.max(-CAT_COVER_CROP_MAX_OFFSET, offsetX),
    ),
    offsetY: Math.min(
      CAT_COVER_CROP_MAX_OFFSET,
      Math.max(-CAT_COVER_CROP_MAX_OFFSET, offsetY),
    ),
  };
}
