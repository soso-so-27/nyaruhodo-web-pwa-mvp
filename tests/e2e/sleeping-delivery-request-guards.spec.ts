import { expect, test } from "@playwright/test";

import {
  validateOwnPhotoSrc,
  validateOwnStoragePhotoPathAccess,
} from "../../src/lib/home/sleepingDeliveryRequestGuards";

const validPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lm6v9wAAAABJRU5ErkJggg==";

test.describe("sleeping delivery request guards", () => {
  test("accepts supported image data URLs and rejects malformed media", () => {
    expect(validateOwnPhotoSrc(validPngDataUrl)).toEqual({ ok: true });
    expect(validateOwnPhotoSrc("data:text/plain;base64,SGVsbG8=")).toMatchObject({
      ok: false,
      status: 415,
      error: "unsupported_media_type",
    });
    expect(validateOwnPhotoSrc("data:image/png;base64,SGVsbG8=")).toMatchObject({
      ok: false,
      status: 400,
      error: "invalid_exchange_request",
    });
  });

  test("requires storage-backed own photos to belong to the authenticated user", () => {
    expect(validateOwnPhotoSrc("storage:user-1/cat/sleeping/photo.webp")).toEqual({
      ok: true,
    });
    expect(
      validateOwnStoragePhotoPathAccess("user-1/cat/sleeping/photo.webp", null),
    ).toMatchObject({
      ok: false,
      status: 401,
      error: "auth_required",
    });
    expect(
      validateOwnStoragePhotoPathAccess("user-2/cat/sleeping/photo.webp", "user-1"),
    ).toMatchObject({
      ok: false,
      status: 403,
      error: "forbidden_photo",
    });
    expect(
      validateOwnStoragePhotoPathAccess("user-1/cat/sleeping/photo.webp", "user-1"),
    ).toEqual({ ok: true });
  });

  test("rejects unsafe storage paths", () => {
    expect(validateOwnPhotoSrc("storage:user-1/../photo.webp")).toMatchObject({
      ok: false,
      status: 400,
      error: "invalid_exchange_request",
    });
    expect(
      validateOwnStoragePhotoPathAccess("user-1/../photo.webp", "user-1"),
    ).toMatchObject({
      ok: false,
      status: 400,
      error: "invalid_exchange_request",
    });
  });
});
