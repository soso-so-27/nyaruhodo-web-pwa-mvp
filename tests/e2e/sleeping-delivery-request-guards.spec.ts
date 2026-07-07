import { expect, test } from "@playwright/test";

import {
  validateOwnPhotoSrc,
  validateOwnStoragePhotoPathAccess,
} from "../../src/lib/home/sleepingDeliveryRequestGuards";
import {
  buildAnonymousTransferTargetPath,
  getReusableTransferMappings,
  isTransferIntentExpired,
  normalizeAnonymousTransferPaths,
} from "../../src/lib/auth/anonymousStorageTransfer";
import { authorizeAdminTaskRequest } from "../../src/lib/server/adminTaskAuth";

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

  test("requires anonymous transfer intent paths to match the anonymous owner", () => {
    expect(
      normalizeAnonymousTransferPaths({
        fromUserId: "anon-a",
        paths: ["anon-a/cat/sleeping/photo.webp"],
      }),
    ).toEqual({
      error: null,
      paths: ["anon-a/cat/sleeping/photo.webp"],
    });

    expect(
      normalizeAnonymousTransferPaths({
        fromUserId: "anon-a",
        paths: ["anon-b/cat/sleeping/photo.webp"],
      }),
    ).toMatchObject({ error: "invalid_path" });

    expect(
      normalizeAnonymousTransferPaths({
        allowedPaths: ["anon-a/cat/sleeping/allowed.webp"],
        fromUserId: "anon-a",
        paths: ["anon-a/cat/sleeping/stolen.webp"],
      }),
    ).toMatchObject({ error: "invalid_path" });
  });

  test("keeps anonymous transfer targets under the signed-in account prefix", () => {
    expect(
      buildAnonymousTransferTargetPath({
        fromUserId: "anon-a",
        sourcePath: "anon-a/cat-1/sleeping/photo.webp",
        targetUserId: "user-1",
      }),
    ).toBe("user-1/anonymous-transfer/anon-a/cat-1/sleeping/photo-webp");
  });

  test("allows completed anonymous transfer intents to be retried only by the same target", () => {
    const mappings = [{ from: "anon-a/photo.webp", to: "user-1/photo.webp" }];

    expect(
      getReusableTransferMappings({
        intent: {
          mappings,
          target_user_id: "user-1",
          used_at: "2026-07-07T00:00:00.000Z",
        },
        targetUserId: "user-1",
      }),
    ).toEqual(mappings);

    expect(
      getReusableTransferMappings({
        intent: {
          mappings,
          target_user_id: "user-1",
          used_at: "2026-07-07T00:00:00.000Z",
        },
        targetUserId: "user-2",
      }),
    ).toBeNull();
  });

  test("expires anonymous transfer intents after the short handoff window", () => {
    expect(
      isTransferIntentExpired("2026-07-07T00:15:00.000Z", Date.parse("2026-07-07T00:16:00.000Z")),
    ).toBe(true);
    expect(
      isTransferIntentExpired("2026-07-07T00:15:00.000Z", Date.parse("2026-07-07T00:14:00.000Z")),
    ).toBe(false);
  });

  test("accepts admin task secrets without direct string comparison", () => {
    const originalSecret = process.env.ADMIN_TASK_SECRET;
    const originalCronSecret = process.env.CRON_SECRET;
    const originalStorageSecret = process.env.STORAGE_HARDENING_SECRET;

    try {
      process.env.ADMIN_TASK_SECRET = "review-secret";
      delete process.env.CRON_SECRET;
      delete process.env.STORAGE_HARDENING_SECRET;

      expect(
        authorizeAdminTaskRequest(
          new Request("https://example.test/admin", {
            headers: { authorization: "Bearer review-secret" },
          }),
        ),
      ).toBeNull();

      expect(
        authorizeAdminTaskRequest(
          new Request("https://example.test/admin", {
            headers: { "x-cron-secret": "review-secret" },
          }),
        ),
      ).toBeNull();

      const rejected = authorizeAdminTaskRequest(
        new Request("https://example.test/admin", {
          headers: { authorization: "Bearer wrong" },
        }),
      );

      expect(rejected?.status).toBe(403);
    } finally {
      restoreEnv("ADMIN_TASK_SECRET", originalSecret);
      restoreEnv("CRON_SECRET", originalCronSecret);
      restoreEnv("STORAGE_HARDENING_SECRET", originalStorageSecret);
    }
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
