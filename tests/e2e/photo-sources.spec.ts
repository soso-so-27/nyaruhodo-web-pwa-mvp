import { expect, test } from "@playwright/test";

import {
  completePhotoSourceSet,
  resolvePhotoFallbackSrcs,
  resolvePhotoSrc,
  resolvePhotoStorageVariant,
  type PhotoSourceSet,
} from "../../src/lib/photoSources";

test.describe("photo source resolution", () => {
  test("keeps reconnected storage photos on the right display variants", () => {
    const restoredPhoto: PhotoSourceSet = {
      src: "storage:user-1/cat-1/sleeping/photo-1.jpg",
      thumbnailSrc: "storage:user-1/cat-1/sleeping/photo-1.jpg",
      displaySrc: "storage:user-1/cat-1/sleeping/photo-1.jpg",
      originalSrc: "storage:user-1/cat-1/sleeping/photo-1.jpg",
    };

    expect(resolvePhotoSrc(restoredPhoto, "list")).toBe(restoredPhoto.src);
    expect(resolvePhotoStorageVariant(restoredPhoto, "list")).toBe("thumbnail");
    expect(resolvePhotoSrc(restoredPhoto, "detail")).toBe(restoredPhoto.src);
    expect(resolvePhotoStorageVariant(restoredPhoto, "detail")).toBe("display");
    expect(resolvePhotoSrc(restoredPhoto, "cover")).toBe(restoredPhoto.src);
    expect(resolvePhotoStorageVariant(restoredPhoto, "cover")).toBe("display");
  });

  test("does not upscale a separately stored thumbnail asset", () => {
    const photo: PhotoSourceSet = {
      src: "storage:user-1/cat-1/sleeping/photo-1.jpg",
      thumbnailSrc: "storage:user-1/cat-1/sleeping/photo-1-thumb.webp",
      displaySrc: "storage:user-1/cat-1/sleeping/photo-1.jpg",
      originalSrc: "storage:user-1/cat-1/sleeping/photo-1.jpg",
    };

    expect(resolvePhotoSrc(photo, "list")).toBe(photo.thumbnailSrc);
    expect(resolvePhotoStorageVariant(photo, "list")).toBe("display");
    expect(resolvePhotoSrc(photo, "large")).toBe(photo.displaySrc);
    expect(resolvePhotoStorageVariant(photo, "large")).toBe("thumbnail");
  });

  test("returns stable unique fallbacks for every visible screen", () => {
    const photo: PhotoSourceSet = {
      src: "storage:user-1/cat-1/sleeping/photo-1.jpg",
      thumbnailSrc: "storage:user-1/cat-1/sleeping/photo-1-thumb.webp",
      displaySrc: "storage:user-1/cat-1/sleeping/photo-1.jpg",
      originalSrc: "storage:user-1/cat-1/sleeping/photo-1-original.jpg",
    };

    expect(resolvePhotoFallbackSrcs(photo)).toEqual([
      "storage:user-1/cat-1/sleeping/photo-1.jpg",
      "storage:user-1/cat-1/sleeping/photo-1-thumb.webp",
      "storage:user-1/cat-1/sleeping/photo-1-original.jpg",
    ]);
  });

  test("repairs already restored local photos that only have src", () => {
    const repaired = completePhotoSourceSet({
      src: "storage:user-1/cat-1/collection/photo-1.jpg",
    });

    expect(repaired.thumbnailSrc).toBe(repaired.src);
    expect(repaired.displaySrc).toBe(repaired.src);
    expect(repaired.originalSrc).toBe(repaired.src);
    expect(resolvePhotoStorageVariant(repaired, "list")).toBe("thumbnail");
    expect(resolvePhotoStorageVariant(repaired, "detail")).toBe("display");
  });
});
