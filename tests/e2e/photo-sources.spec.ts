import { expect, test } from "@playwright/test";

import {
  PHOTO_DISPLAY_CONTRACT,
  completePhotoSourceSet,
  getPhotoAspectRatio,
  getPhotoContentIdentityKeys,
  getPhotoIdentityKeys,
  resolvePhotoFallbackSrcs,
  resolvePhotoSrc,
  resolvePhotoStorageVariant,
  type PhotoSourceSet,
} from "../../src/lib/photoSources";

test.describe("photo source resolution", () => {
  test("declares the supported display contexts", () => {
    expect(Object.keys(PHOTO_DISPLAY_CONTRACT)).toEqual([
      "list",
      "board",
      "hero",
      "cover",
      "detail",
    ]);
    expect(PHOTO_DISPLAY_CONTRACT.list.fit).toBe("cover");
    expect(PHOTO_DISPLAY_CONTRACT.board.source).toBe("display");
    expect(PHOTO_DISPLAY_CONTRACT.hero.storageVariant).toBe("hero");
    expect(PHOTO_DISPLAY_CONTRACT.cover.fit).toBe("cover");
    expect(PHOTO_DISPLAY_CONTRACT.detail.fit).toBe("contain");
  });

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
    expect(resolvePhotoStorageVariant(restoredPhoto, "cover")).toBe("hero");
    expect(resolvePhotoStorageVariant(restoredPhoto, "hero")).toBe("hero");
    expect(resolvePhotoSrc(restoredPhoto, "board")).toBe(restoredPhoto.src);
    expect(resolvePhotoStorageVariant(restoredPhoto, "board")).toBe("thumbnail");
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
    expect(resolvePhotoSrc(photo, "board")).toBe(photo.displaySrc);
    expect(resolvePhotoStorageVariant(photo, "board")).toBe("thumbnail");
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

  test("identifies the same onboarding photo across stored variants and signed URLs", () => {
    const displayPath =
      "user-1/onboarding/cat-1/display/onboarding-1721000000000.webp";
    const thumbnailPath =
      "user-1/onboarding/cat-1/thumbnail/onboarding-1721000000000.webp";
    const signedDisplayUrl =
      `https://example.supabase.co/storage/v1/object/sign/cat-photos/${displayPath}?token=test`;

    const displayKeys = getPhotoContentIdentityKeys({ src: signedDisplayUrl });
    const thumbnailKeys = getPhotoContentIdentityKeys({
      src: `storage:${thumbnailPath}`,
    });

    expect(displayKeys).toContain(
      "content-onboarding:user-1/onboarding/cat-1/onboarding-1721000000000.webp",
    );
    expect(thumbnailKeys).toContain(
      "content-onboarding:user-1/onboarding/cat-1/onboarding-1721000000000.webp",
    );
  });

  test("uses an exact data image as a stable content identity", () => {
    const src = "data:image/png;base64,AAAA";

    expect(getPhotoContentIdentityKeys({ src })).toEqual([
      `content-data:${src}`,
    ]);
  });

  test("deduplicates one delivered photo even when local ids differ", () => {
    const src = "storage:user-1/onboarding/cat-1/display/photo-1.webp";
    const first = getPhotoIdentityKeys({ id: "delivery-1", src });
    const second = getPhotoIdentityKeys({ id: "handoff-2", src });

    expect(first.some((key) => second.includes(key))).toBe(true);
  });

  test("uses persisted pixel dimensions before an image finishes loading", () => {
    expect(
      getPhotoAspectRatio({
        src: "storage:user-1/photo.webp",
        width: 4032,
        height: 3024,
      }),
    ).toBeCloseTo(4 / 3);
    expect(getPhotoAspectRatio({ src: "storage:user-1/legacy.webp" })).toBeNull();
  });
});
