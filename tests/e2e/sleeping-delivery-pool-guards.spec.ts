import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import {
  isBlockedDeliveryPhotoUrl,
  isBlockedDeliveryPoolRow,
  isStorageDeliveryPhotoUrl,
} from "../../src/lib/home/deliveryPoolGuards";
import {
  DISPLAY_SIGNED_URL_SECONDS,
  normalizePersistentPhotoSrc,
  toStoragePhotoUrl,
} from "../../src/lib/photoStorage";
import {
  getStoragePhotoUrlVariants,
  isAuthorizedStoragePhotoPath,
  isSafeStoragePath,
  normalizeAnonymousId,
} from "../../src/lib/photoStorageAuthorization";

const redBlueTestPhotoUrl =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAsHCAoIBwsKCQoMDAsNEBsSEA8PECEYGRQbJyMpKScjJiUsMT81LC47LyUmNko3O0FDRkdGKjRNUkxEUj9FRkP/2wBDAQwMDBAOECASEiBDLSYtQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0P/wAARCABkAGQDASIAAhEBAxEB/8QAGQABAQEBAQEAAAAAAAAAAAAAAAIHAwQB/8QAFxABAAMAAAAAAAAAAAAAAAAAAAEDMv/EABkBAQADAQEAAAAAAAAAAAAAAAADBgcEBf/EACgRAQAAAggGAwEAAAAAAAAAAAABBAIDFBViobHhETM0YXFyEhMxkf/aAAwDAQACEQMRAD8A+gPMXcAAAB2rxCk14hS5yvIoeIaM2nuqrfaOsQBO5AAAAHnAUVqgAAADtXiFJrxClzleRQ8Q0ZtPdVW+0dYgCdyAAAAPOAorVAAAAHavEKTXiFLnK8ih4hozae6qt9o6xAE7kAAAAecBRWqAAAAO1eIUmvEKXOV5FDxDRm091Vb7R1iAJ3IAAAA84CitUAAAAdq8QpNeIUucryKHiGjNp7qq32jrEATuQAAAB5xkIp9n7rxfODPZrwyELP3L5wZ7NeGQhZ+5fODPZsleIUxkezVT/wBdXRofH8hCH7srdfL/AHVtKs48OMYx/sWzDGRJeWHPZFYsWTZhjIXlhz2LFiybMMZC8sOexYsWQA8t3AAAAAAAAAAAAP/Z";

const normalCatLikePhotoUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const minimalWebpDataUrl = `data:image/webp;base64,${Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x0c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20,
]).toString("base64")}`;

type ExchangeResponse = {
  photo?: {
    id: string;
    sourcePhotoId?: string;
    src: string;
  } | null;
  source?: "remote" | "none";
};

type LocalEnv = Record<string, string>;

test.describe("sleeping delivery pool guards", () => {
  test("normalizes expiring storage urls before persistent photo saves", () => {
    const storageSrc = "storage:user/cat/sleeping/photo.jpg";
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/cat-photos/user/cat/sleeping/photo.jpg?token=temporary-token";

    expect(normalizePersistentPhotoSrc(storageSrc)).toBe(storageSrc);
    expect(normalizePersistentPhotoSrc(signedUrl)).toBe(
      toStoragePhotoUrl("user/cat/sleeping/photo.jpg"),
    );
    expect(normalizePersistentPhotoSrc(redBlueTestPhotoUrl)).toBe(
      redBlueTestPhotoUrl,
    );
    expect(
      normalizePersistentPhotoSrc(
        "https://example.com/photo.jpg?token=temporary-token",
      ),
    ).toBe(null);
    expect(normalizePersistentPhotoSrc("https://example.com/photo.jpg")).toBe(
      "https://example.com/photo.jpg",
    );
  });

  test("keeps display signed urls within the beta release lifetime budget", () => {
    expect(DISPLAY_SIGNED_URL_SECONDS).toBeGreaterThan(0);
    expect(DISPLAY_SIGNED_URL_SECONDS).toBeLessThanOrEqual(60 * 60);
  });

  test("blocks known red-blue test photo ids and matching data urls only", () => {
    expect(
      isBlockedDeliveryPoolRow({
        local_moment_id: "own-sleeping-1780670253932",
        photo_url: normalCatLikePhotoUrl,
      }),
    ).toBe(true);
    expect(isBlockedDeliveryPhotoUrl(redBlueTestPhotoUrl)).toBe(true);
    expect(
      isBlockedDeliveryPoolRow({
        local_moment_id: "normal-cat-photo",
        photo_url: redBlueTestPhotoUrl,
      }),
    ).toBe(true);
    expect(
      isBlockedDeliveryPoolRow({
        local_moment_id: "normal-cat-photo",
        photo_url: normalCatLikePhotoUrl,
      }),
    ).toBe(false);
  });

  test("detects storage paths used by delivery exchange", () => {
    expect(isStorageDeliveryPhotoUrl("storage:user/cat/sleeping/photo.jpg")).toBe(
      true,
    );
    expect(isStorageDeliveryPhotoUrl(normalCatLikePhotoUrl)).toBe(false);
    expect(isStorageDeliveryPhotoUrl("https://example.com/photo.jpg")).toBe(false);
  });

  test("requires admin access for delivery diagnostics", async ({ request }) => {
    const response = await request.post("/api/sleeping-delivery/diagnostics", {
      data: { blockedPhotoIds: [] },
    });

    expect(response.ok()).toBeFalsy();
    expect([403, 404]).toContain(response.status());

    const bodyText = await response.text();

    expect(bodyText).not.toContain("ADMIN_EMAILS");
    expect(bodyText).not.toContain("ENABLE_TEST_TOOLS");
  });

  test("presence api does not expose server diagnostics", async ({ request }) => {
    const response = await request.get("/api/presence");

    expect(response.status()).toBe(200);

    const bodyText = await response.text();

    expect(bodyText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(bodyText).not.toContain("ADMIN_EMAILS");
    expect(bodyText).not.toContain("select ");
    expect(bodyText).not.toContain("cat_moments");
    expect(bodyText).not.toContain("Error:");
  });

  test("signed photo url api rejects unauthenticated shared delivery paths without leaks", async ({
    request,
  }) => {
    const response = await request.post("/api/photo-storage/signed-url", {
      data: { src: "storage:admin-stock/sleeping/photo.jpg" },
    });

    expect(response.status()).toBe(401);

    const bodyText = await response.text();
    expect(bodyText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(bodyText).not.toContain("cat-photos");
    expect(bodyText).not.toContain("storage.objects");
    expect(bodyText).not.toContain("cat_moment_deliveries");
    expect(bodyText).not.toContain("Error:");
  });

  test("signed photo url api rejects unsafe storage paths without leaks", async ({
    request,
  }) => {
    for (const src of [
      "storage:../admin-stock/sleeping/photo.jpg",
      "storage:admin-stock//sleeping/photo.jpg",
      "storage:admin-stock/sleeping/..",
      "storage:admin-stock\\sleeping\\photo.jpg",
    ]) {
      const response = await request.post("/api/photo-storage/signed-url", {
        data: { src },
      });

      expect(response.status()).toBe(400);
      const bodyText = await response.text();
      expect(bodyText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(bodyText).not.toContain("cat-photos");
      expect(bodyText).not.toContain("storage.objects");
      expect(bodyText).not.toContain("Error:");
    }
  });

  test("authorizes only own or delivered storage photo paths", async () => {
    const deliveredVariants: string[][] = [];
    const authorize = (storagePath: string, anonymousId: string | null) =>
      isAuthorizedStoragePhotoPath({
        storagePath,
        userId: "user-1",
        anonymousId,
        hasDeliveredPhoto: async (variants, userId, deliveredAnonymousId) => {
          deliveredVariants.push(variants);
          return (
            userId === "user-1" &&
            deliveredAnonymousId === "anon-1" &&
            variants.includes("storage:admin-stock/sleeping/delivered.jpg")
          );
        },
      });

    await expect(authorize("user-1/cat/photo.jpg", null)).resolves.toBe(true);
    await expect(
      authorize("admin-stock/sleeping/delivered.jpg", "anon-1"),
    ).resolves.toBe(true);
    await expect(
      authorize("admin-stock/sleeping/not-delivered.jpg", "anon-1"),
    ).resolves.toBe(false);
    await expect(
      authorize("other-user/cat/photo.jpg", "anon-1"),
    ).resolves.toBe(false);
    await expect(authorize("../admin-stock/sleeping/photo.jpg", "anon-1")).resolves.toBe(
      false,
    );

    expect(deliveredVariants).toContainEqual(
      getStoragePhotoUrlVariants("admin-stock/sleeping/delivered.jpg"),
    );
    expect(isSafeStoragePath("admin-stock/sleeping/photo.jpg")).toBe(true);
    expect(isSafeStoragePath("admin-stock/sleeping/../photo.jpg")).toBe(false);
    expect(normalizeAnonymousId(" anon-1 ")).toBe("anon-1");
    expect(normalizeAnonymousId("")).toBe(null);
  });

  test("accepts supported exchange data urls", async ({ request }) => {
    await skipIfLocalSupabaseUnavailable();

    for (const [index, src] of [
      redBlueTestPhotoUrl,
      normalCatLikePhotoUrl,
      minimalWebpDataUrl,
      "storage:user/cat/sleeping/photo.jpg",
    ].entries()) {
      const response = await request.post("/api/sleeping-delivery/exchange", {
        data: buildExchangeRequest(src, `valid-${Date.now()}-${index}`),
      });

      expect(response.status()).not.toBe(400);
      expect(response.status()).not.toBe(413);
      expect(response.status()).not.toBe(415);
      expect(response.status()).not.toBe(429);
    }
  });

  test("rejects unsupported exchange photo sources", async ({ request }) => {
    for (const [src, expectedStatus] of [
      [
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
        415,
      ],
      ["data:image/heic;base64,AAAA", 415],
      ["https://example.com/cat.jpg", 415],
    ] as const) {
      const response = await request.post("/api/sleeping-delivery/exchange", {
        data: buildExchangeRequest(src, `invalid-${Date.now()}-${expectedStatus}`),
      });

      expect(response.status()).toBe(expectedStatus);
    }
  });

  test("requires authentication for storage-backed exchange photos", async ({
    request,
  }) => {
    const response = await request.post("/api/sleeping-delivery/exchange", {
      data: buildExchangeRequest(
        "storage:user-1/cat/sleeping/photo.jpg",
        `storage-auth-${Date.now()}`,
      ),
    });

    expect(response.status()).toBe(401);

    const bodyText = await response.text();
    expect(bodyText).toContain("auth_required");
    expect(bodyText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(bodyText).not.toContain("cat_moments");
    expect(bodyText).not.toContain("storage.objects");
    expect(bodyText).not.toContain("Error:");
  });

  test("rejects normal exchange before the server delivery date", async ({
    request,
  }) => {
    test.skip(
      !hasSupabasePublicConfigFromEnv(),
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for server delivery date validation.",
    );
    await skipIfLocalSupabaseUnavailable();

    const response = await request.post("/api/sleeping-delivery/exchange", {
      data: {
        ...buildExchangeRequest(normalCatLikePhotoUrl, `future-${Date.now()}`),
        debugDryRun: false,
        deliveryDateKey: "2099-01-01",
      },
    });

    expect(response.status()).toBe(422);
    const body = (await response.json()) as { error?: string; serverDateKey?: string };
    expect(body.error).toBe("delivery_not_yet");
    expect(body.serverDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("allows first onboarding exchange without a delivery date key", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the onboarding exchange smoke test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const anonymousId = `onboarding-anonymous-${createdAt}`;

    try {
      const response = await request.post("/api/sleeping-delivery/exchange", {
        data: {
          ...buildExchangeRequest(
            redBlueTestPhotoUrl,
            `onboarding-${createdAt}`,
            anonymousId,
          ),
          debugDryRun: false,
          mode: "onboarding",
        },
      });

      expect(response.status()).not.toBe(422);
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .eq("anonymous_id", anonymousId);
    }
  });

  test("keeps exchange response under the delivery latency budget", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const startedAt = performance.now();
    const response = await request.post("/api/sleeping-delivery/exchange", {
      data: buildExchangeRequest(
        normalCatLikePhotoUrl,
        `latency-${Date.now()}`,
      ),
    });
    const elapsedMs = performance.now() - startedAt;

    expect(response.status()).not.toBe(429);
    expect(elapsedMs).toBeLessThan(3000);
  });

  test("does not deliver pending moderation rows", async ({ request }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the moderation smoke test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const candidateId = `pending-candidate-${createdAt}`;
    const anonymousId = `pending-anonymous-${createdAt}`;

    try {
      const { error: insertError } = await adminSupabase.from("cat_moments").insert({
        anonymous_id: `pending-source-${createdAt}`,
        local_moment_id: candidateId,
        local_cat_id: `pending-source-cat-${createdAt}`,
        owner_cat_id: `pending-source-cat-${createdAt}`,
        photo_url: normalCatLikePhotoUrl,
        state: "sleeping",
        visibility: "shared",
        delivery_status: "available",
        moderation_status: "pending",
        source_moment_id: null,
        metadata: {
          source: "e2e-moderation",
          pool_kind: "user_shared",
          theme: "sleeping",
          trigger_label: "sleeping",
        },
        captured_at: new Date(createdAt - 60_000).toISOString(),
        created_at: new Date(createdAt - 60_000).toISOString(),
      });

      expect(insertError).toBeNull();

      const response = await request.post("/api/sleeping-delivery/exchange", {
        data: {
          ...buildExchangeRequest(
            normalCatLikePhotoUrl,
            `pending-own-${createdAt}`,
            anonymousId,
          ),
          debugDryRun: false,
          deliveryDateKey: getYesterdayJstDateKey(),
          preferredSourcePhotoId: candidateId,
        },
      });

      expect(response.status()).toBe(200);
      const body = (await response.json()) as ExchangeResponse;
      expect(body.photo?.sourcePhotoId).not.toBe(candidateId);
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase.from("cat_moments").delete().eq("local_moment_id", candidateId);
    }
  });

  test("keeps exchange idempotent for the same anonymous id and delivery date", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the idempotency smoke test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const anonymousId = `idem-anonymous-${createdAt}`;
    const candidateId = `idem-candidate-${createdAt}`;
    const ownId = `idem-own-${createdAt}`;
    const catId = `idem-cat-${createdAt}`;
    const deliveryDateKey = getYesterdayJstDateKey();

    try {
      const { error: insertError } = await adminSupabase.from("cat_moments").insert({
        anonymous_id: `idem-source-${createdAt}`,
        local_moment_id: candidateId,
        local_cat_id: `idem-source-cat-${createdAt}`,
        owner_cat_id: `idem-source-cat-${createdAt}`,
        photo_url: normalCatLikePhotoUrl,
        state: "sleeping",
        visibility: "shared",
        delivery_status: "available",
        moderation_status: "approved",
        moderated_at: new Date(createdAt - 60_000).toISOString(),
        moderated_by: "e2e",
        source_moment_id: null,
        metadata: {
          source: "e2e-idempotency",
          pool_kind: "user_shared",
          theme: "sleeping",
          trigger_label: "sleeping",
        },
        captured_at: new Date(createdAt - 60_000).toISOString(),
        created_at: new Date(createdAt - 60_000).toISOString(),
      });

      expect(insertError).toBeNull();

      const payload = {
        ...buildExchangeRequest(normalCatLikePhotoUrl, ownId, anonymousId),
        debugDryRun: false,
        deliveryDateKey,
        preferredSourcePhotoId: candidateId,
        seed: `${deliveryDateKey}:${ownId}`,
        recipientCatId: catId,
      };

      const firstResponse = await request.post("/api/sleeping-delivery/exchange", {
        data: payload,
      });
      expect(firstResponse.status()).toBe(200);
      const firstBody = (await firstResponse.json()) as ExchangeResponse;
      expect(firstBody.photo).toBeTruthy();

      const secondResponse = await request.post("/api/sleeping-delivery/exchange", {
        data: payload,
      });
      expect(secondResponse.status()).toBe(200);
      const secondBody = (await secondResponse.json()) as ExchangeResponse;

      expect(secondBody.photo?.id).toBe(firstBody.photo?.id);
      expect(secondBody.photo?.sourcePhotoId).toBe(candidateId);

      const { count, error: countError } = await adminSupabase
        .from("cat_moment_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("anonymous_id", anonymousId)
        .eq("local_delivery_id", firstBody.photo?.id ?? "");

      expect(countError).toBeNull();
      expect(count).toBe(1);
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", [candidateId, ownId]);
    }
  });

  test("accepts only delivered photo reports and counts distinct reporters", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the report abuse guard test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const sourcePhotoId = `report-source-${createdAt}`;
    const firstAnonymousId = `report-anon-a-${createdAt}`;
    const secondAnonymousId = `report-anon-b-${createdAt}`;
    const firstDeliveryId = `report-delivery-a-${createdAt}`;
    const secondDeliveryId = `report-delivery-b-${createdAt}`;
    let sourceMomentUuid: string | null = null;

    try {
      const { data: sourceMoment, error: sourceError } = await adminSupabase
        .from("cat_moments")
        .insert({
          anonymous_id: `report-source-owner-${createdAt}`,
          local_moment_id: sourcePhotoId,
          local_cat_id: `report-source-cat-${createdAt}`,
          owner_cat_id: `report-source-owner-cat-${createdAt}`,
          photo_url: normalCatLikePhotoUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          source_moment_id: null,
          metadata: { source: "report-test" },
          captured_at: new Date(createdAt).toISOString(),
          created_at: new Date(createdAt).toISOString(),
        })
        .select("id")
        .single();

      expect(sourceError).toBeFalsy();
      sourceMomentUuid = sourceMoment?.id ?? null;
      expect(sourceMomentUuid).toBeTruthy();

      const { error: deliveryError } = await adminSupabase
        .from("cat_moment_deliveries")
        .insert([
          {
            anonymous_id: firstAnonymousId,
            local_delivery_id: firstDeliveryId,
            source_moment_id: sourceMomentUuid,
            source_photo_id: sourcePhotoId,
            recipient_local_cat_id: `report-cat-a-${createdAt}`,
            photo_url: normalCatLikePhotoUrl,
            status: "delivered",
            metadata: { source: "report-test" },
            delivered_at: new Date(createdAt + 1).toISOString(),
          },
          {
            anonymous_id: secondAnonymousId,
            local_delivery_id: secondDeliveryId,
            source_moment_id: sourceMomentUuid,
            source_photo_id: sourcePhotoId,
            recipient_local_cat_id: `report-cat-b-${createdAt}`,
            photo_url: normalCatLikePhotoUrl,
            status: "delivered",
            metadata: { source: "report-test" },
            delivered_at: new Date(createdAt + 2).toISOString(),
          },
        ]);

      expect(deliveryError).toBeFalsy();

      const rejectedResponse = await request.post("/api/reports", {
        data: {
          photoId: `missing-delivery-${createdAt}`,
          sourcePhotoId,
          anonymousId: `not-delivered-${createdAt}`,
          reason: "not_cat",
        },
      });

      expect(rejectedResponse.status()).toBe(403);

      const firstReportResponse = await request.post("/api/reports", {
        data: {
          photoId: firstDeliveryId,
          sourcePhotoId,
          anonymousId: firstAnonymousId,
          reason: "not_cat",
        },
      });

      expect(firstReportResponse.status()).toBe(200);
      expect(await firstReportResponse.json()).toMatchObject({ ok: true });

      const duplicateReportResponse = await request.post("/api/reports", {
        data: {
          photoId: firstDeliveryId,
          sourcePhotoId,
          anonymousId: firstAnonymousId,
          reason: "uncomfortable",
        },
      });

      expect(duplicateReportResponse.status()).toBe(200);
      expect(await duplicateReportResponse.json()).toMatchObject({
        ok: true,
        duplicate: true,
      });

      const { count: duplicateCount, error: duplicateCountError } =
        await adminSupabase
          .from("photo_reports")
          .select("id", { count: "exact", head: true })
          .eq("source_photo_id", sourcePhotoId)
          .eq("reporter_anonymous_id", firstAnonymousId);

      expect(duplicateCountError).toBeFalsy();
      expect(duplicateCount).toBe(1);

      const secondReportResponse = await request.post("/api/reports", {
        data: {
          photoId: secondDeliveryId,
          sourcePhotoId,
          anonymousId: secondAnonymousId,
          reason: "other",
        },
      });

      expect(secondReportResponse.status()).toBe(200);

      const { data: reportedMoment, error: reportedMomentError } =
        await adminSupabase
          .from("cat_moments")
          .select("delivery_status")
          .eq("local_moment_id", sourcePhotoId)
          .single();

      expect(reportedMomentError).toBeFalsy();
      expect(reportedMoment?.delivery_status).toBe("reported");
    } finally {
      await adminSupabase
        .from("photo_reports")
        .delete()
        .eq("source_photo_id", sourcePhotoId);
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .in("anonymous_id", [firstAnonymousId, secondAnonymousId]);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .eq("local_moment_id", sourcePhotoId);
    }
  });

  test("rejects oversized exchange payload fields", async ({ request }) => {
    const oversizedDataUrl = `data:image/png;base64,${"A".repeat(2 * 1024 * 1024)}`;
    const oversizedPhotoResponse = await request.post(
      "/api/sleeping-delivery/exchange",
      {
        data: buildExchangeRequest(oversizedDataUrl, `oversized-${Date.now()}`),
      },
    );

    expect(oversizedPhotoResponse.status()).toBe(413);

    const blockedIdsResponse = await request.post(
      "/api/sleeping-delivery/exchange",
      {
        data: {
          ...buildExchangeRequest(
            normalCatLikePhotoUrl,
            `blocked-ids-${Date.now()}`,
          ),
          blockedPhotoIds: Array.from({ length: 101 }, (_, index) => `id-${index}`),
        },
      },
    );

    expect(blockedIdsResponse.status()).toBe(400);
  });

  test("rate limits repeated exchange calls", async ({ request }) => {
    await skipIfLocalSupabaseUnavailable();

    const anonymousId = `rate-limit-${Date.now()}`;
    const responses = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        request.post("/api/sleeping-delivery/exchange", {
          data: buildExchangeRequest(
            normalCatLikePhotoUrl,
            `${anonymousId}-${index}`,
            anonymousId,
          ),
        }),
      ),
    );

    expect(responses.map((response) => response.status())).toContain(429);
  });

  test("does not return known test or debug pool rows", async ({ request }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the production guard exchange test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const anonymousId = `guard-anonymous-${createdAt}`;
    const ownId = `guard-own-${createdAt}`;
    try {
      const exchangeResponse = await request.post(
      "/api/sleeping-delivery/exchange",
      {
        data: {
          ownPhoto: {
            id: ownId,
            catId: `guard-cat-${createdAt}`,
            ownerCatId: `guard-cat-${createdAt}`,
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC",
            createdAt,
            triggerLabel: "ねがお",
            theme: "sleeping",
          },
          triggerLabel: "ねがお",
          theme: "sleeping",
          category: "sleeping",
          seed: `guard-${createdAt}`,
          recipientCatId: `guard-cat-${createdAt}`,
          anonymousId,
          deliveryDateKey: getYesterdayJstDateKey(),
        },
      },
    );

    expect(exchangeResponse.ok()).toBeTruthy();
    const exchange = (await exchangeResponse.json()) as ExchangeResponse;

    if (exchange.photo) {
      expectCandidateIsNotTestPoolPhoto({
        id: exchange.photo.id,
        sourceOwnPhotoId: exchange.photo.sourcePhotoId,
        src: exchange.photo.src,
      });
    }
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase.from("cat_moments").delete().eq("local_moment_id", ownId);
    }
  });
});

function expectCandidateIsNotTestPoolPhoto(photo: {
  id?: string;
  sourceOwnPhotoId?: string;
  sourceCatId?: string;
  src?: string;
}) {
  expect(photo.sourceOwnPhotoId ?? "").not.toMatch(
    /^(e2e|prod-e2e|debug|fallback)-/,
  );
  expect(isBlockedDeliveryPhotoUrl(photo.src ?? "")).toBe(false);
  expect(photo.src ?? "").not.toContain("placecats.com");
  expect(photo.src ?? "").toMatch(/^(data:image\/|https?:\/\/|storage:)/);
}

function buildExchangeRequest(
  src: string,
  id: string,
  anonymousId = `guard-anonymous-${id}`,
) {
  return {
    ownPhoto: {
      id: `guard-own-${id}`,
      catId: `guard-cat-${id}`,
      ownerCatId: `guard-cat-${id}`,
      src,
      createdAt: Date.now(),
      triggerLabel: "sleeping",
      theme: "sleeping",
    },
    triggerLabel: "sleeping",
    theme: "sleeping",
    category: "sleeping",
    seed: `guard-${id}`,
    recipientCatId: `guard-cat-${id}`,
    anonymousId,
    blockedPhotoIds: [],
    debugDryRun: true,
  };
}

function getYesterdayJstDateKey() {
  const jstNow = Date.now() + 9 * 60 * 60 * 1000;
  const date = new Date(jstNow - 24 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createAdminSupabaseClientFromEnv() {
  const env = readLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function hasSupabasePublicConfigFromEnv() {
  const env = readLocalEnv();
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

let localSupabaseReachability: Promise<boolean> | null = null;

async function skipIfLocalSupabaseUnavailable() {
  test.skip(
    !(await isLocalSupabaseReachable()),
    "Local Supabase at 127.0.0.1:54321 is required for this delivery-pool integration test.",
  );
}

async function isLocalSupabaseReachable() {
  if (process.env.PLAYWRIGHT_REQUIRE_LOCAL_SUPABASE === "1") {
    return true;
  }

  const env = readLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !isLocalSupabaseUrl(url)) {
    return true;
  }

  localSupabaseReachability ??= probeLocalSupabase(url);
  return localSupabaseReachability;
}

function isLocalSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

async function probeLocalSupabase(value: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);

  try {
    const response = await fetch(new URL("/rest/v1/", value), {
      method: "HEAD",
      signal: controller.signal,
    });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function readLocalEnv(): LocalEnv {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce<LocalEnv>((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const equalsIndex = trimmed.indexOf("=");

      if (equalsIndex <= 0) {
        return env;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      const rawValue = trimmed.slice(equalsIndex + 1).trim();
      env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return env;
    }, {});
}
