import { expect, test } from "@playwright/test";

import {
  assessPrintPhotoQuality,
  PRINT_PHOTO_PRODUCTS,
} from "../../src/lib/printPhotoQuality";
import { buildOriginalPhotoStoragePath } from "../../src/lib/photoOriginals";

test.describe("print photo quality", () => {
  test("keeps a phone original suitable for postcard printing", () => {
    const result = assessPrintPhotoQuality({
      pixelWidth: 3024,
      pixelHeight: 4032,
      product: "postcard",
    });

    expect(result.status).toBe("ready");
    expect(result.effectiveDpi).toBeGreaterThanOrEqual(300);
  });

  test("warns before a display derivative is used for a large print", () => {
    const result = assessPrintPhotoQuality({
      pixelWidth: 1200,
      pixelHeight: 900,
      product: "a4",
    });

    expect(result.status).toBe("insufficient");
    expect(result.effectiveDpi).toBeLessThan(180);
  });

  test("accounts for cover cropping and landscape orientation", () => {
    const result = assessPrintPhotoQuality({
      pixelWidth: 4032,
      pixelHeight: 3024,
      product: "twoL",
    });

    expect(result.usedPixelWidth).toBeLessThanOrEqual(4032);
    expect(result.usedPixelHeight).toBeLessThanOrEqual(3024);
    expect(PRINT_PHOTO_PRODUCTS.twoL.widthMm).toBe(127);
  });

  test("partitions private originals by month and source", () => {
    const path = buildOriginalPhotoStoragePath({
      fileName: "IMG_1234.HEIC",
      localAssetId: "own-sleeping:photo/1",
      ownerUserId: "user-123",
      queuedAt: Date.parse("2026-07-15T03:00:00.000Z"),
      sourceSurface: "sleeping",
    });

    expect(path).toMatch(
      /^user-123\/originals\/sleeping\/2026\/07\/own-sleeping-photo-1-[a-z0-9]+\.heic$/,
    );
  });
});
