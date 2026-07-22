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
  copyPreservedDeliveryPhotos,
  deleteStoredDataForUser,
} from "../../src/app/api/account/delete-stored-data/handler";
import {
  buildAccountStorageDeletionPlan,
  getArchivedDeliveryStoragePath,
} from "../../src/lib/accountDeletionStorage";
import { isAccountDeletionStripeCancellationRequired } from "../../src/lib/accountDeletionBilling";
import {
  isFastStockCandidateDeliverable,
  isRowDeliverable,
  buildEveningChoiceDeliverySlotId,
  buildIdempotentDeliveryId,
  isEveningChoiceIdentityEligible,
  isIdentityInEveningChoiceRollout,
  readExistingDelivery,
  resetOnboardingExchangeExceptionLimitForTests,
  shouldUseEveningChoiceBundlePath,
  validateExchangeDeliveryDateKey,
} from "../../src/app/api/sleeping-delivery/exchange/handler";
import { resolveExchangePhotoUploadSrc } from "../../src/lib/home/useEveningDelivery";
import {
  CAT_PHOTOS_BUCKET,
  DISPLAY_SIGNED_URL_SECONDS,
  getStoragePhotoPath,
  normalizePersistentPhotoSrc,
  toStoragePhotoUrl,
} from "../../src/lib/photoStorage";
import { buildOriginalPhotoStoragePath } from "../../src/lib/photoOriginals";
import {
  getStoragePhotoUrlVariants,
  isAuthorizedStoragePhotoPath,
  isSafeStoragePath,
  normalizeAnonymousId,
} from "../../src/lib/photoStorageAuthorization";
import {
  EVENING_CHOICE_RECIRCULATION_POLICY,
  buildFourChoiceExcludedSourceIds,
  classifyDeliveryExposureHistory,
  readCandidateLastShownAt,
  type DeliveryExposureRow,
} from "../../src/lib/server/deliveryRecirculation";

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
    title?: string;
  } | null;
  photos?: Array<{
    id: string;
    sourcePhotoId?: string;
    src: string;
    title?: string;
  }>;
  source?: "remote" | "none";
  bundleId?: string | null;
  experienceVersion?: string;
  assignedVariant?: string;
  servedVariant?: string;
  requestedCount?: number;
  servedCount?: number;
  fallbackReason?: string | null;
  diagnostics?: {
    normalCandidateCount?: number;
  };
  tier?: number | null;
};

type LocalEnv = Record<string, string>;

function createFourChoiceExposure(
  sourceId: string,
  deliveryDateKey: string,
): DeliveryExposureRow {
  return {
    source_moment_id: sourceId,
    source_photo_id: sourceId,
    status: "delivered",
    metadata: {
      bundle_id: `bundle-${deliveryDateKey}`,
      delivery_date_key: deliveryDateKey,
      delivery_position: 1,
      experience_version: "evening_choice_v1",
      served_variant: "four_choice_v1",
    },
    delivered_at: `${deliveryDateKey}T11:00:00.000Z`,
  };
}

test.describe("sleeping delivery pool guards", () => {
  test("assigns the four-choice rollout and slot ids deterministically", () => {
    const identity = "anon:stable-evening-choice";
    const first = isIdentityInEveningChoiceRollout(identity, 37);

    expect(isIdentityInEveningChoiceRollout(identity, 37)).toBe(first);
    expect(isIdentityInEveningChoiceRollout(identity, 0)).toBe(false);
    expect(isIdentityInEveningChoiceRollout(identity, 100)).toBe(true);
    expect(
      buildEveningChoiceDeliverySlotId({
        bundleId: "delivered-sleeping-2026-07-22-test",
        position: 4,
      }),
    ).toBe("delivered-sleeping-2026-07-22-test-choice-4");
  });

  test("limits production four-choice delivery to account identities", () => {
    expect(
      isEveningChoiceIdentityEligible({
        userId: "account-user",
        anonymousId: null,
        productionDeployment: true,
      }),
    ).toBe(true);
    expect(
      isEveningChoiceIdentityEligible({
        userId: null,
        anonymousId: "raw-anonymous-device",
        productionDeployment: true,
      }),
    ).toBe(false);
    expect(
      isEveningChoiceIdentityEligible({
        userId: null,
        anonymousId: "preview-anonymous-device",
        productionDeployment: false,
      }),
    ).toBe(true);
  });

  test("keeps capable rollout-zero requests on the legacy single path", () => {
    const assignedVariant = isIdentityInEveningChoiceRollout(
      "anon:rollout-zero-evening-choice",
      0,
    )
      ? "four_choice_v1"
      : "single_v1";

    expect(assignedVariant).toBe("single_v1");
    expect(
      shouldUseEveningChoiceBundlePath({
        isCapableRequest: true,
        assignedVariant,
        idempotentDeliveryId: "delivered-sleeping-2026-07-22-rollout-zero",
      }),
    ).toBe(false);
    expect(
      shouldUseEveningChoiceBundlePath({
        isCapableRequest: true,
        assignedVariant: "four_choice_v1",
        idempotentDeliveryId: "delivered-sleeping-2026-07-22-rollout-enabled",
      }),
    ).toBe(true);
  });

  test("recirculates only unselected four-choice exposures after fourteen clear nights", () => {
    const recentHistory = classifyDeliveryExposureHistory({
      currentDateKey: "2026-07-15",
      rows: [createFourChoiceExposure("source-a", "2026-07-01")],
    });
    expect(EVENING_CHOICE_RECIRCULATION_POLICY).toBe(
      "unselected_14_nights_v1",
    );
    expect(buildFourChoiceExcludedSourceIds(recentHistory)).toContain(
      "source-a",
    );

    const eligibleHistory = classifyDeliveryExposureHistory({
      currentDateKey: "2026-07-16",
      rows: [createFourChoiceExposure("source-a", "2026-07-01")],
    });
    expect(buildFourChoiceExcludedSourceIds(eligibleHistory)).not.toContain(
      "source-a",
    );
    expect(readCandidateLastShownAt(eligibleHistory, ["source-a"])).toBe(
      Date.parse("2026-07-01T11:00:00.000Z"),
    );
  });

  test("kept, reported, legacy, and source-photo-only history remain permanent", () => {
    const rows: DeliveryExposureRow[] = [
      { ...createFourChoiceExposure("kept-source", "2026-06-01"), status: "kept" },
      {
        ...createFourChoiceExposure("reported-source", "2026-06-01"),
        status: "reported",
      },
      {
        ...createFourChoiceExposure("legacy-source", "2026-06-01"),
        metadata: { served_variant: "single_v1" },
      },
      {
        ...createFourChoiceExposure("ignored-uuid", "2026-06-01"),
        source_moment_id: null,
        source_photo_id: "local-source-only",
        status: "hidden",
      },
    ];
    const history = classifyDeliveryExposureHistory({
      currentDateKey: "2026-07-20",
      rows,
    });

    expect(history.permanentSourceIds).toEqual(
      new Set([
        "kept-source",
        "reported-source",
        "legacy-source",
        "local-source-only",
      ]),
    );
  });

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
    expect(DISPLAY_SIGNED_URL_SECONDS).toBe(60 * 60 * 24);
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

  test("uses storage reference directly for synced account exchange photos", async () => {
    const upload = await resolveExchangePhotoUploadSrc({
      catId: "cat-storage",
      createdAt: Date.now(),
      deliveryStatus: "available",
      displaySrc: normalCatLikePhotoUrl,
      id: "own-storage-photo",
      ownerCatId: "cat-storage",
      shared: true,
      src: "storage:user/cat-storage/sleeping/own-storage-photo.webp",
      state: "sleeping",
      theme: "ねがお",
      triggerLabel: "20時",
      visibility: "shared",
    });

    expect(upload).toEqual({
      src: "storage:user/cat-storage/sleeping/own-storage-photo.webp",
      srcKind: "storage",
      resizeStep: "storage_direct",
    });
  });

  test("plans delivered account photos for archive before deleting user storage", () => {
    const plan = buildAccountStorageDeletionPlan({
      archivePathForSource: (sourcePath) =>
        getArchivedDeliveryStoragePath(sourcePath, "archive-id"),
      deliveryRows: [
        {
          photo_url: "storage:user-a/cat-1/sleeping/delivered.webp",
          status: "delivered",
        },
      ],
      ownerPrefix: "user-a",
      storagePaths: [
        "user-a/cat-1/sleeping/delivered.webp",
        "user-a/cat-1/sleeping/unshared.webp",
      ],
    });

    expect(plan.copies).toEqual([
      {
        archivePath: "delivery-archive/archive-id.webp",
        sourcePath: "user-a/cat-1/sleeping/delivered.webp",
        sourceUrlVariants: [
          "storage:user-a/cat-1/sleeping/delivered.webp",
          "storage://user-a/cat-1/sleeping/delivered.webp",
        ],
        targetPhotoUrl: "storage:delivery-archive/archive-id.webp",
      },
    ]);
    expect(plan.deletablePaths).toEqual(["user-a/cat-1/sleeping/unshared.webp"]);
    expect(plan.copies[0].archivePath).not.toContain("user-a");
  });

  test("does not preserve hidden or pending account photos", () => {
    const plan = buildAccountStorageDeletionPlan({
      archivePathForSource: (sourcePath) =>
        getArchivedDeliveryStoragePath(sourcePath, "archive-id"),
      deliveryRows: [
        {
          photo_url: "storage:user-a/cat-1/sleeping/hidden.webp",
          status: "hidden",
        },
        {
          photo_url: "storage:user-a/cat-1/sleeping/pending.webp",
          status: "pending",
        },
      ],
      ownerPrefix: "user-a",
      storagePaths: [
        "user-a/cat-1/sleeping/hidden.webp",
        "user-a/cat-1/sleeping/pending.webp",
      ],
    });

    expect(plan.copies).toEqual([]);
    expect(plan.deletablePaths).toEqual([
      "user-a/cat-1/sleeping/hidden.webp",
      "user-a/cat-1/sleeping/pending.webp",
    ]);
  });

  test("requires Stripe cancellation before deleting payable account data", () => {
    expect(
      isAccountDeletionStripeCancellationRequired({
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        priceId: "price_live",
        status: "active",
        stripeCustomerId: "cus_live",
        stripeSubscriptionId: "sub_live",
        userId: "user-a",
      }),
    ).toBe(true);
    expect(
      isAccountDeletionStripeCancellationRequired({
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        priceId: "price_live",
        status: "canceled",
        stripeCustomerId: "cus_live",
        stripeSubscriptionId: "sub_live",
        userId: "user-a",
      }),
    ).toBe(false);
    expect(
      isAccountDeletionStripeCancellationRequired({
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        priceId: "price_live",
        status: "active",
        stripeCustomerId: "cus_live",
        stripeSubscriptionId: null,
        userId: "user-a",
      }),
    ).toBe(false);
  });

  test("account deletion keeps auth when a table delete step fails", async () => {
    const fakeSupabase = createFakeAccountDeletionSupabase({
      deleteErrors: { cat_moments: "simulated delete failure" },
    });

    const result = await deleteStoredDataForUser(
      fakeSupabase.client,
      "user-delete-failure",
    );

    expect(result.status).toBe("error");
    expect(result.errors).toContain("delete step 3: simulated delete failure");
    expect(fakeSupabase.authDeleteCalls).toBe(0);
  });

  test("account deletion does not delete preserved source storage when no delivery rows update", async () => {
    const fakeSupabase = createFakeAccountDeletionSupabase({
      updateRowsBySourcePath: {
        "user-a/cat-1/sleeping/delivered.webp": [],
      },
    });
    const errors: string[] = [];

    const copied = await copyPreservedDeliveryPhotos(
      fakeSupabase.client,
      [
        {
          archivePath: "delivery-archive/archive.webp",
          sourcePath: "user-a/cat-1/sleeping/delivered.webp",
          sourceUrlVariants: [
            "storage:user-a/cat-1/sleeping/delivered.webp",
            "storage://user-a/cat-1/sleeping/delivered.webp",
          ],
          targetPhotoUrl: "storage:delivery-archive/archive.webp",
        },
      ],
      errors,
    );

    expect(copied).toEqual([]);
    expect(errors).toContain(
      "delivery preserve user-a/cat-1/sleeping/delivered.webp: no rows updated",
    );
    expect(fakeSupabase.storageRemovedPaths).toEqual([]);
  });

  test("excludes anonymous-era own rows after login when sender anonymous id is present", () => {
    const row = createDeliverableRow({
      anonymous_id: "anon-before-login",
      user_id: null,
    });
    const context = {
      userId: "user-after-login",
      anonymousId: null,
      senderAnonymousId: "anon-before-login",
      recipientCatId: "cat-current",
      excludePhotoId: "current-own-photo",
      blockedPhotoIds: new Set<string>(),
      deliveredSourceMomentIds: new Set<string>(),
    };

    expect(isRowDeliverable(row, context)).toBe(false);
    const fastRow =
      row as unknown as Parameters<typeof isFastStockCandidateDeliverable>[0];
    expect(isFastStockCandidateDeliverable(fastRow, context)).toBe(false);
  });

  test("excludes private rows from delivery candidates as a defense in depth", () => {
    const row = createDeliverableRow({
      visibility: "private",
    });
    const context = {
      userId: "user-recipient",
      anonymousId: null,
      senderAnonymousId: "anon-recipient",
      recipientCatId: "cat-current",
      excludePhotoId: "current-own-photo",
      blockedPhotoIds: new Set<string>(),
      deliveredSourceMomentIds: new Set<string>(),
    };

    expect(isRowDeliverable(row, context)).toBe(false);
    const fastRow =
      row as unknown as Parameters<typeof isFastStockCandidateDeliverable>[0];
    expect(isFastStockCandidateDeliverable(fastRow, context)).toBe(false);
  });

  test("allows onboarding retries but limits instant exchange exceptions per ip key", async () => {
    resetOnboardingExchangeExceptionLimitForTests();
    const fakeSupabase = createFakeOnboardingValidationSupabase(2);
    const baseArgs = {
      supabase: fakeSupabase.client,
      userId: null,
      anonymousId: "anon-onboarding",
      deliveryDateKey: null,
      mode: "onboarding" as const,
      debugDryRun: false,
      onboardingExceptionIpKey: "ip:203.0.113.10",
    };

    expect(
      await validateExchangeDeliveryDateKey(baseArgs),
    ).toEqual({ ok: true });
    expect(
      await validateExchangeDeliveryDateKey(baseArgs),
    ).toEqual({ ok: true });
    expect(
      await validateExchangeDeliveryDateKey(baseArgs),
    ).toEqual({ ok: true });

    const fourth = await validateExchangeDeliveryDateKey(baseArgs);

    expect(fourth).toMatchObject({
      ok: false,
      error: "delivery_not_yet",
    });
    expect(fakeSupabase.insertedAppEvents).toHaveLength(1);
    expect(fakeSupabase.insertedAppEvents[0].event_name).toBe(
      "onboarding_exchange_exception_limited",
    );
  });

  test("replays idempotent exchange deliveries from the current id", async () => {
    const localDeliveryId = buildIdempotentDeliveryId({
      anonymousId: "anon-idempotent",
      deliveryDateKey: "2026-07-05",
      userId: null,
    });

    const delivery = {
      anonymous_id: "anon-idempotent",
      delivered_at: new Date().toISOString(),
      id: "delivery-row-current",
      local_delivery_id: localDeliveryId,
      metadata: {},
      photo_url: normalCatLikePhotoUrl,
      recipient_local_cat_id: "cat-recipient",
      source_moment_id: "source-row",
      source_photo_id: "source-photo",
      status: "delivered",
      user_id: null,
    };
    const replay = await readExistingDelivery({
      anonymousId: "anon-idempotent",
      localDeliveryId,
      supabase: createFakeDeliveryLookupSupabase([delivery]).client,
      userId: null,
    });

    expect(replay?.local_delivery_id).toBe(localDeliveryId);
  });

  test("uses sha256 idempotent ids with distinct 96-bit digests", () => {
    const first = buildIdempotentDeliveryId({
      anonymousId: "anon-a",
      deliveryDateKey: "2026-07-05",
      userId: null,
    });
    const second = buildIdempotentDeliveryId({
      anonymousId: "anon-b",
      deliveryDateKey: "2026-07-05",
      userId: null,
    });

    expect(first).toMatch(/^delivered-sleeping-2026-07-05-[0-9a-f]{24}$/);
    expect(second).toMatch(/^delivered-sleeping-2026-07-05-[0-9a-f]{24}$/);
    expect(first).not.toBe(second);
  });

  test("preserves exact original photo bytes behind owner-only RLS", async () => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();
    const publicSupabase = createPublicSupabaseClientFromEnv();

    test.skip(
      !adminSupabase || !publicSupabase,
      "Local Supabase public and service role keys are required for original photo integration tests.",
    );

    if (!adminSupabase || !publicSupabase) {
      return;
    }

    const createdAt = Date.now();
    const owner = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `original-owner-${createdAt}@example.test`,
    );
    const other = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `original-other-${createdAt}@example.test`,
    );
    const ownerSupabase = createAuthenticatedSupabaseClientFromEnv(
      owner.accessToken,
    );
    const otherSupabase = createAuthenticatedSupabaseClientFromEnv(
      other.accessToken,
    );

    expect(ownerSupabase).toBeTruthy();
    expect(otherSupabase).toBeTruthy();
    if (!ownerSupabase || !otherSupabase) {
      return;
    }

    const localAssetId = `original-e2e-${createdAt}`;
    const originalBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...Array.from({ length: 1024 }, (_, index) => index % 251),
    ]);
    const originalPath = buildOriginalPhotoStoragePath({
      fileName: "original-e2e.png",
      localAssetId,
      ownerUserId: owner.userId,
      queuedAt: createdAt,
      sourceSurface: "sleeping",
      mimeType: "image/png",
    });

    try {
      const { error: uploadError } = await ownerSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .upload(originalPath, originalBytes, {
          contentType: "image/png",
          upsert: true,
        });
      expect(uploadError).toBeFalsy();

      const { error: insertError } = await ownerSupabase
        .from("photo_assets")
        .insert({
          user_id: owner.userId,
          local_asset_id: localAssetId,
          source_surface: "sleeping",
          original_storage_path: originalPath,
          original_file_name: "original-e2e.png",
          original_mime_type: "image/png",
          original_bytes: originalBytes.length,
          pixel_width: 4032,
          pixel_height: 3024,
          captured_at: new Date(createdAt).toISOString(),
          status: "ready",
        });
      expect(insertError).toBeFalsy();

      const { data: ownerRow, error: ownerReadError } = await ownerSupabase
        .from("photo_assets")
        .select("local_asset_id, original_bytes, original_storage_path, status")
        .eq("local_asset_id", localAssetId)
        .single();
      expect(ownerReadError).toBeFalsy();
      expect(ownerRow).toMatchObject({
        local_asset_id: localAssetId,
        original_bytes: originalBytes.length,
        original_storage_path: originalPath,
        status: "ready",
      });

      const { data: downloaded, error: downloadError } =
        await ownerSupabase.storage
          .from(CAT_PHOTOS_BUCKET)
          .download(originalPath);
      expect(downloadError).toBeFalsy();
      expect(Buffer.from(await downloaded!.arrayBuffer())).toEqual(originalBytes);

      const { data: otherRows, error: otherReadError } = await otherSupabase
        .from("photo_assets")
        .select("local_asset_id")
        .eq("local_asset_id", localAssetId);
      expect(otherReadError).toBeFalsy();
      expect(otherRows).toEqual([]);

      const { data: otherDownload, error: otherDownloadError } =
        await otherSupabase.storage
          .from(CAT_PHOTOS_BUCKET)
          .download(originalPath);
      expect(otherDownload).toBeNull();
      expect(otherDownloadError).toBeTruthy();
    } finally {
      await adminSupabase
        .from("photo_assets")
        .delete()
        .eq("user_id", owner.userId);
      await adminSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .remove([originalPath]);
      await adminSupabase.auth.admin.deleteUser(owner.userId);
      await adminSupabase.auth.admin.deleteUser(other.userId);
    }
  });

  test("account deletion guide explains delivered photos remain", async ({
    page,
  }) => {
    await page.goto("/account-deletion");

    await expect(
      page.getByText("すでにおとどけしたねこだよりは、受け取った方の記録に残ります。"),
    ).toHaveCount(1);
    await expect(
      page.getByText("保存されている写真ファイル（すでにねこだよりとして相手にとどいた写真を除く）"),
    ).toHaveCount(1);
  });

  test("account deletion keeps delivered photos viewable for recipients", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();
    const publicSupabase = createPublicSupabaseClientFromEnv();

    test.skip(
      !adminSupabase || !publicSupabase,
      "Local Supabase public and service role keys are required for account deletion integration tests.",
    );

    if (!adminSupabase || !publicSupabase) {
      return;
    }

    const createdAt = Date.now();
    const source = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `delete-source-${createdAt}@example.test`,
    );
    const recipient = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `delete-recipient-${createdAt}@example.test`,
    );
    const localMomentId = `delete-delivered-moment-${createdAt}`;
    const localDeliveryId = `delete-delivered-delivery-${createdAt}`;
    const anonymousId = `delete-anonymous-${createdAt}`;
    const anonymousMomentId = `delete-anonymous-moment-${createdAt}`;
    const sourcePath = `${source.userId}/e2e/account-delete/${localMomentId}.jpg`;
    const anonymousPath = `anonymous/${anonymousId}/e2e/account-delete/${anonymousMomentId}.jpg`;
    let archivePath: string | null = null;

    try {
      await uploadTestPhoto(adminSupabase, sourcePath);
      await uploadTestPhoto(adminSupabase, anonymousPath);
      await insertTestMoment(adminSupabase, {
        localMomentId,
        photoUrl: toStoragePhotoUrl(sourcePath),
        userId: source.userId,
      });
      await insertAnonymousTestMoment(adminSupabase, {
        anonymousId,
        localMomentId: anonymousMomentId,
        photoUrl: toStoragePhotoUrl(anonymousPath),
      });
      await insertTestDelivery(adminSupabase, {
        localDeliveryId,
        photoUrl: toStoragePhotoUrl(sourcePath),
        recipientUserId: recipient.userId,
        sourcePhotoId: localMomentId,
      });
      await insertTestAccountOwnedRows(adminSupabase, {
        accessToken: source.accessToken,
        anonymousId,
        eventId: createdAt,
        userId: source.userId,
      });
      const { error: photoAssetError } = await adminSupabase
        .from("photo_assets")
        .insert({
          user_id: source.userId,
          local_asset_id: localMomentId,
          source_surface: "sleeping",
          original_storage_path: sourcePath,
          original_file_name: `${localMomentId}.jpg`,
          original_mime_type: "image/jpeg",
          original_bytes: 1,
          captured_at: new Date(createdAt).toISOString(),
          status: "ready",
        });
      expect(photoAssetError).toBeFalsy();

      const response = await request.post("/api/account/delete-stored-data", {
        data: { anonymousId, userId: recipient.userId },
        headers: {
          authorization: `Bearer ${source.accessToken}`,
        },
      });

      expect(response.status()).toBe(200);
      await expectAccountUserDeleted(adminSupabase, source.userId);

      const { data: delivery, error: deliveryError } = await adminSupabase
        .from("cat_moment_deliveries")
        .select("photo_url, user_id")
        .eq("local_delivery_id", localDeliveryId)
        .single();

      expect(deliveryError).toBeFalsy();
      expect(delivery?.user_id).toBe(recipient.userId);
      expect(delivery?.photo_url).toMatch(/^storage:delivery-archive\//);
      expect(delivery?.photo_url ?? "").not.toContain(source.userId);

      archivePath = getStoragePhotoPath(delivery?.photo_url ?? "");
      expect(archivePath).toBeTruthy();

      const { data: archivedPhoto, error: archiveDownloadError } =
        await adminSupabase.storage
          .from(CAT_PHOTOS_BUCKET)
          .download(archivePath ?? "");
      expect(archiveDownloadError).toBeFalsy();
      expect(archivedPhoto).toBeTruthy();

      const { data: originalPhoto } = await adminSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .download(sourcePath);
      expect(originalPhoto).toBeNull();

      const signedUrlResponse = await request.post(
        "/api/photo-storage/signed-url",
        {
          data: { src: delivery?.photo_url },
          headers: {
            authorization: `Bearer ${recipient.accessToken}`,
          },
        },
      );

      expect(signedUrlResponse.status()).toBe(200);
      const signedUrlBody = await signedUrlResponse.json();
      expect(signedUrlBody?.signedUrl).toContain("/storage/v1/");

      const { count: appEventCount, error: appEventCountError } =
        await adminSupabase
          .from("app_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", source.userId);
      expect(appEventCountError).toBeFalsy();
      expect(appEventCount).toBe(0);

      await expectTableCount(adminSupabase, "account_local_state", {
        user_id: source.userId,
      }, 0);
      await expectTableCount(adminSupabase, "product_analytics_events", {
        user_id: source.userId,
      }, 0);
      await expectTableCount(adminSupabase, "mikke_window_answers", {
        user_id: source.userId,
      }, 0);
      await expectTableCount(adminSupabase, "profiles", {
        id: source.userId,
      }, 0);
      await expectTableCount(adminSupabase, "photo_assets", {
        user_id: source.userId,
      }, 0);
      await expectTableCount(adminSupabase, "cat_moments", {
        anonymous_id: anonymousId,
      }, 0);
      await expectTableCount(adminSupabase, "app_events", {
        anonymous_id: anonymousId,
      }, 0);
      await expectTableCount(adminSupabase, "product_analytics_events", {
        anonymous_id: anonymousId,
      }, 0);
      await expectTableCount(adminSupabase, "mikke_window_answers", {
        anonymous_id: anonymousId,
      }, 0);

      const { data: anonymousPhoto } = await adminSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .download(anonymousPath);
      expect(anonymousPhoto).toBeNull();
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("local_delivery_id", localDeliveryId);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", [localMomentId, anonymousMomentId]);
      await adminSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .remove([
          sourcePath,
          anonymousPath,
          ...(archivePath ? [archivePath] : []),
        ]);
      await adminSupabase.auth.admin.deleteUser(source.userId);
      await adminSupabase.auth.admin.deleteUser(recipient.userId);
    }
  });

  test("account deletion removes undelivered account storage", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();
    const publicSupabase = createPublicSupabaseClientFromEnv();

    test.skip(
      !adminSupabase || !publicSupabase,
      "Local Supabase public and service role keys are required for account deletion integration tests.",
    );

    if (!adminSupabase || !publicSupabase) {
      return;
    }

    const createdAt = Date.now();
    const source = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `delete-undelivered-${createdAt}@example.test`,
    );
    const localMomentId = `delete-undelivered-moment-${createdAt}`;
    const sourcePath = `${source.userId}/e2e/account-delete/${localMomentId}.jpg`;

    try {
      await uploadTestPhoto(adminSupabase, sourcePath);
      await insertTestMoment(adminSupabase, {
        localMomentId,
        photoUrl: toStoragePhotoUrl(sourcePath),
        userId: source.userId,
      });

      const response = await request.post("/api/account/delete-stored-data", {
        headers: {
          authorization: `Bearer ${source.accessToken}`,
        },
      });

      expect(response.status()).toBe(200);
      await expectAccountUserDeleted(adminSupabase, source.userId);

      const { data: originalPhoto } = await adminSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .download(sourcePath);
      expect(originalPhoto).toBeNull();
    } finally {
      await adminSupabase
        .from("cat_moments")
        .delete()
        .eq("local_moment_id", localMomentId);
      await adminSupabase.storage.from(CAT_PHOTOS_BUCKET).remove([sourcePath]);
      await adminSupabase.auth.admin.deleteUser(source.userId);
    }
  });

  test("account deletion derives the target user from the bearer token", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();
    const publicSupabase = createPublicSupabaseClientFromEnv();

    test.skip(
      !adminSupabase || !publicSupabase,
      "Local Supabase public and service role keys are required for account deletion integration tests.",
    );

    if (!adminSupabase || !publicSupabase) {
      return;
    }

    const createdAt = Date.now();
    const source = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `delete-body-source-${createdAt}@example.test`,
    );
    const other = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `delete-body-other-${createdAt}@example.test`,
    );
    const otherMomentId = `delete-body-other-moment-${createdAt}`;
    const otherPath = `${other.userId}/e2e/account-delete/${otherMomentId}.jpg`;

    try {
      await uploadTestPhoto(adminSupabase, otherPath);
      await insertTestMoment(adminSupabase, {
        localMomentId: otherMomentId,
        photoUrl: toStoragePhotoUrl(otherPath),
        userId: other.userId,
      });

      const response = await request.post("/api/account/delete-stored-data", {
        data: { userId: other.userId },
        headers: {
          authorization: `Bearer ${source.accessToken}`,
        },
      });

      expect(response.status()).toBe(200);
      await expectAccountUserDeleted(adminSupabase, source.userId);

      const { data: otherAuthUser, error: otherAuthError } =
        await adminSupabase.auth.admin.getUserById(other.userId);
      expect(otherAuthError).toBeFalsy();
      expect(otherAuthUser.user?.id).toBe(other.userId);

      const { data: otherMoment, error: otherMomentError } = await adminSupabase
        .from("cat_moments")
        .select("id")
        .eq("local_moment_id", otherMomentId)
        .single();
      expect(otherMomentError).toBeFalsy();
      expect(otherMoment?.id).toBeTruthy();

      const { data: otherPhoto, error: otherDownloadError } =
        await adminSupabase.storage.from(CAT_PHOTOS_BUCKET).download(otherPath);
      expect(otherDownloadError).toBeFalsy();
      expect(otherPhoto).toBeTruthy();
    } finally {
      await adminSupabase
        .from("cat_moments")
        .delete()
        .eq("local_moment_id", otherMomentId);
      await adminSupabase.storage.from(CAT_PHOTOS_BUCKET).remove([otherPath]);
      await adminSupabase.auth.admin.deleteUser(source.userId);
      await adminSupabase.auth.admin.deleteUser(other.userId);
    }
  });

  test("account deletion api rejects unauthenticated requests", async ({
    request,
  }) => {
    const response = await request.post("/api/account/delete-stored-data", {
      data: { userId: "00000000-0000-4000-8000-000000000000" },
    });

    expect(response.status()).toBe(401);
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
      authorize("user-1/anonymous-transfer/anon-a/cat-1/sleeping/photo-webp", null),
    ).resolves.toBe(true);
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
        headers: {
          "x-forwarded-for": `2001:db8::${createdAt.toString(16)}`,
        },
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

  test("puts approved onboarding photos into the normal delivery pool", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the onboarding pool smoke test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const sourceRequestId = `onboarding-pool-source-${createdAt}`;
    const recipientRequestId = `onboarding-pool-recipient-${createdAt}`;
    const sourceAnonymousId = `onboarding-pool-source-anon-${createdAt}`;
    const recipientAnonymousId = `onboarding-pool-recipient-anon-${createdAt}`;
    const onboardingMomentId = `guard-own-${sourceRequestId}`;
    const recipientMomentId = `guard-own-${recipientRequestId}`;

    try {
      const onboardingResponse = await request.post(
        "/api/sleeping-delivery/exchange",
        {
          headers: {
            "x-forwarded-for": `2001:db8:1::${createdAt.toString(16)}`,
          },
          data: {
            ...buildExchangeRequest(
              normalCatLikePhotoUrl,
              sourceRequestId,
              sourceAnonymousId,
            ),
            debugDryRun: false,
            mode: "onboarding",
          },
        },
      );

      expect(onboardingResponse.status()).not.toBe(422);

      const { data: pendingMoment, error: pendingError } = await adminSupabase
        .from("cat_moments")
        .select(
          "id, local_moment_id, visibility, delivery_status, moderation_status, metadata",
        )
        .eq("anonymous_id", sourceAnonymousId)
        .eq("local_moment_id", onboardingMomentId)
        .maybeSingle();

      expect(pendingError).toBeNull();
      expect(pendingMoment).toBeTruthy();
      if (!pendingMoment) {
        throw new Error("Expected onboarding photo to be inserted into cat_moments");
      }
      expect(pendingMoment.visibility).toBe("shared");
      expect(pendingMoment.delivery_status).toBe("available");
      expect(pendingMoment.moderation_status).toBe("pending");
      expect(pendingMoment.metadata?.pool_kind).toBe("user_shared");

      const { error: approveError } = await adminSupabase
        .from("cat_moments")
        .update({
          moderated_at: new Date().toISOString(),
          moderated_by: "e2e",
          moderation_status: "approved",
        })
        .eq("id", pendingMoment.id);

      expect(approveError).toBeNull();

      const deliveryResponse = await request.post(
        "/api/sleeping-delivery/exchange",
        {
          data: {
            ...buildExchangeRequest(
              normalCatLikePhotoUrl,
              recipientRequestId,
              recipientAnonymousId,
            ),
            debugDryRun: false,
            deliveryDateKey: getYesterdayJstDateKey(),
            preferredSourcePhotoId: onboardingMomentId,
            recipientCatId: `onboarding-pool-recipient-cat-${createdAt}`,
          },
        },
      );

      expect(deliveryResponse.status()).toBe(200);
      const deliveryBody = (await deliveryResponse.json()) as ExchangeResponse;
      expect(deliveryBody.photo?.sourcePhotoId).toBe(onboardingMomentId);
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .in("anonymous_id", [sourceAnonymousId, recipientAnonymousId]);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", [onboardingMomentId, recipientMomentId]);
    }
  });

  test("stores an owned storage-backed onboarding photo once and rejects another user's path", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();
    const publicSupabase = createPublicSupabaseClientFromEnv();

    test.skip(
      !adminSupabase || !publicSupabase,
      "Local Supabase public and service role keys are required for the storage-backed onboarding pool test.",
    );

    if (!adminSupabase || !publicSupabase) {
      return;
    }

    const createdAt = Date.now();
    const owner = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `onboarding-storage-owner-${createdAt}@example.test`,
    );
    const other = await createConfirmedTestUser(
      adminSupabase,
      publicSupabase,
      `onboarding-storage-other-${createdAt}@example.test`,
    );
    const requestId = `onboarding-storage-${createdAt}`;
    const localMomentId = `guard-own-${requestId}`;
    const ownerPath = `${owner.userId}/onboarding/cat/display/${requestId}.webp`;
    const otherPath = `${other.userId}/onboarding/cat/display/${requestId}.webp`;
    const anonymousId = `onboarding-storage-anon-${createdAt}`;
    const recipientAnonymousId = `onboarding-storage-recipient-${createdAt}`;
    const recipientRequestId = `onboarding-storage-recipient-${createdAt}`;

    try {
      await uploadTestPhoto(adminSupabase, ownerPath);
      await uploadTestPhoto(adminSupabase, otherPath);

      const requestData = {
        ...buildExchangeRequest(
          toStoragePhotoUrl(ownerPath),
          requestId,
          anonymousId,
        ),
        debugDryRun: false,
        mode: "onboarding" as const,
      };
      const headers = {
        authorization: `Bearer ${owner.accessToken}`,
        "x-forwarded-for": `2001:db8:3::${createdAt.toString(16)}`,
      };

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await request.post("/api/sleeping-delivery/exchange", {
          data: requestData,
          headers,
        });
        expect(response.status()).toBe(200);
      }

      const { data: moments, error: momentsError } = await adminSupabase
        .from("cat_moments")
        .select(
          "local_moment_id, photo_url, visibility, delivery_status, moderation_status, metadata",
        )
        .eq("user_id", owner.userId)
        .eq("local_moment_id", localMomentId);

      expect(momentsError).toBeNull();
      expect(moments).toHaveLength(1);
      expect(moments?.[0]).toMatchObject({
        local_moment_id: localMomentId,
        photo_url: toStoragePhotoUrl(ownerPath),
        visibility: "shared",
        delivery_status: "available",
        moderation_status: "pending",
      });
      expect(moments?.[0]?.metadata?.pool_kind).toBe("user_shared");
      expect(moments?.[0]?.metadata?.capture_context).toBe("onboarding");

      const { error: approveError } = await adminSupabase
        .from("cat_moments")
        .update({
          moderated_at: new Date().toISOString(),
          moderated_by: "e2e",
          moderation_status: "approved",
        })
        .eq("user_id", owner.userId)
        .eq("local_moment_id", localMomentId);

      expect(approveError).toBeNull();

      const deliveryResponse = await request.post(
        "/api/sleeping-delivery/exchange",
        {
          data: {
            ...buildExchangeRequest(
              normalCatLikePhotoUrl,
              recipientRequestId,
              recipientAnonymousId,
            ),
            debugDryRun: false,
            deliveryDateKey: getYesterdayJstDateKey(),
            preferredSourcePhotoId: localMomentId,
          },
        },
      );

      expect(deliveryResponse.status()).toBe(200);
      const deliveryBody = (await deliveryResponse.json()) as ExchangeResponse;
      expect(deliveryBody.photo?.sourcePhotoId).toBe(localMomentId);

      const forbiddenResponse = await request.post(
        "/api/sleeping-delivery/exchange",
        {
          data: {
            ...buildExchangeRequest(
              toStoragePhotoUrl(otherPath),
              `onboarding-storage-forbidden-${createdAt}`,
              anonymousId,
            ),
            debugDryRun: false,
            mode: "onboarding",
          },
          headers,
        },
      );

      expect(forbiddenResponse.status()).toBe(403);
      await expect(forbiddenResponse.json()).resolves.toMatchObject({
        error: "forbidden_photo",
      });
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .in("user_id", [owner.userId, other.userId]);
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", recipientAnonymousId);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("user_id", [owner.userId, other.userId]);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .eq("anonymous_id", recipientAnonymousId);
      await adminSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .remove([ownerPath, otherPath]);
      await adminSupabase.auth.admin.deleteUser(owner.userId);
      await adminSupabase.auth.admin.deleteUser(other.userId);
    }
  });

  test("uses admin stock only for immediate onboarding exchange", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the onboarding admin stock test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const normalCandidateId = `onboarding-normal-candidate-${createdAt}`;
    const adminCandidateId = `onboarding-admin-stock-${createdAt}`;
    const onboardingAnonymousId = `onboarding-admin-stock-anon-${createdAt}`;
    const normalAnonymousId = `onboarding-normal-anon-${createdAt}`;
    const normalRequestId = `onboarding-normal-recipient-${createdAt}`;

    try {
      const { error: insertError } = await adminSupabase.from("cat_moments").insert([
        {
          anonymous_id: `onboarding-normal-source-${createdAt}`,
          local_moment_id: normalCandidateId,
          local_cat_id: `onboarding-normal-source-cat-${createdAt}`,
          owner_cat_id: `onboarding-normal-source-cat-${createdAt}`,
          photo_url: normalCatLikePhotoUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          moderated_at: new Date(createdAt - 120_000).toISOString(),
          moderated_by: "e2e",
          source_moment_id: null,
          metadata: {
            source: "e2e-onboarding-admin-stock",
            pool_kind: "user_shared",
            theme: "sleeping",
            trigger_label: "sleeping",
          },
          captured_at: new Date(createdAt - 120_000).toISOString(),
          created_at: new Date(createdAt - 120_000).toISOString(),
        },
        {
          anonymous_id: `onboarding-admin-source-${createdAt}`,
          local_moment_id: adminCandidateId,
          local_cat_id: `onboarding-admin-source-cat-${createdAt}`,
          owner_cat_id: `onboarding-admin-source-cat-${createdAt}`,
          photo_url: normalCatLikePhotoUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          moderated_at: new Date(createdAt - 60_000).toISOString(),
          moderated_by: "e2e",
          source_moment_id: null,
          metadata: {
            source: "admin-stock",
            theme: "sleeping",
            trigger_label: "sleeping",
          },
          captured_at: new Date(createdAt - 60_000).toISOString(),
          created_at: new Date(createdAt - 60_000).toISOString(),
        },
      ]);

      expect(insertError).toBeNull();

      const onboardingResponse = await request.post(
        "/api/sleeping-delivery/exchange",
        {
          headers: {
            "x-forwarded-for": `2001:db8:2::${createdAt.toString(16)}`,
          },
          data: {
            ...buildExchangeRequest(
              normalCatLikePhotoUrl,
              `onboarding-admin-stock-own-${createdAt}`,
              onboardingAnonymousId,
            ),
            debugDryRun: false,
            mode: "onboarding",
            preferredSourcePhotoId: normalCandidateId,
            recipientCatId: `onboarding-admin-recipient-cat-${createdAt}`,
          },
        },
      );

      expect(onboardingResponse.status()).toBe(200);
      const onboardingBody = (await onboardingResponse.json()) as ExchangeResponse;
      expect(onboardingBody.photo?.sourcePhotoId).not.toBe(normalCandidateId);
      expect(onboardingBody.tier).toBe(3);
      expect(onboardingBody.diagnostics?.normalCandidateCount).toBe(0);

      const normalResponse = await request.post("/api/sleeping-delivery/exchange", {
        data: {
          ...buildExchangeRequest(
            normalCatLikePhotoUrl,
            normalRequestId,
            normalAnonymousId,
          ),
          debugDryRun: false,
          deliveryDateKey: getYesterdayJstDateKey(),
          preferredSourcePhotoId: normalCandidateId,
          recipientCatId: `onboarding-normal-recipient-cat-${createdAt}`,
        },
      });

      expect(normalResponse.status()).toBe(200);
      const normalBody = (await normalResponse.json()) as ExchangeResponse;
      expect(normalBody.photo?.sourcePhotoId).toBe(normalCandidateId);
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .in("anonymous_id", [onboardingAnonymousId, normalAnonymousId]);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", [
          normalCandidateId,
          adminCandidateId,
          `guard-own-onboarding-admin-stock-own-${createdAt}`,
          `guard-own-${normalRequestId}`,
        ]);
    }
  });

  test("distributes immediate onboarding exchange across admin stock photos", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the onboarding admin stock distribution test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const adminCandidateIds = Array.from(
      { length: 5 },
      (_, index) => `onboarding-admin-stock-distribution-${createdAt}-${index}`,
    );
    const candidateIdSet = new Set(adminCandidateIds);

    const { data: existingRows, error: existingRowsError } = await adminSupabase
      .from("cat_moments")
      .select("id, local_moment_id, metadata")
      .eq("visibility", "shared")
      .eq("delivery_status", "available")
      .eq("moderation_status", "approved");

    expect(existingRowsError).toBeNull();

    const blockedExistingAdminStockIds = ((existingRows ?? []) as Array<{
      id?: string | null;
      local_moment_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }>)
      .filter((row) => {
        const poolKind = row.metadata?.pool_kind;
        return (
          poolKind === "admin_stock" ||
          poolKind === "admin-stock" ||
          row.metadata?.source === "admin-stock"
        );
      })
      .flatMap((row) => [row.id, row.local_moment_id])
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    try {
      const { error: insertError } = await adminSupabase.from("cat_moments").insert(
        adminCandidateIds.map((candidateId, index) => ({
          anonymous_id: `onboarding-admin-distribution-source-${createdAt}-${index}`,
          local_moment_id: candidateId,
          local_cat_id: `onboarding-admin-distribution-cat-${createdAt}-${index}`,
          owner_cat_id: `onboarding-admin-distribution-cat-${createdAt}-${index}`,
          photo_url: normalCatLikePhotoUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          moderated_at: new Date(createdAt - 60_000 - index).toISOString(),
          moderated_by: "e2e",
          source_moment_id: null,
          metadata: {
            source: "admin-stock",
            theme: "sleeping",
            trigger_label: "sleeping",
          },
          captured_at: new Date(createdAt - 60_000 - index).toISOString(),
          created_at: new Date(createdAt - 60_000 - index).toISOString(),
        })),
      );

      expect(insertError).toBeNull();

      const selectedSourcePhotoIds = new Set<string>();

      for (let index = 0; index < 12; index += 1) {
        const exchangeResponse = await request.post(
          "/api/sleeping-delivery/exchange",
          {
            data: {
              ...buildExchangeRequest(
                normalCatLikePhotoUrl,
                `onboarding-admin-distribution-own-${createdAt}-${index}`,
                `onboarding-admin-distribution-anon-${createdAt}-${index}`,
              ),
              blockedPhotoIds: blockedExistingAdminStockIds,
              debugDryRun: true,
              mode: "onboarding",
              recipientCatId: `onboarding-admin-distribution-recipient-cat-${createdAt}-${index}`,
              seed: `onboarding-admin-distribution-seed-${createdAt}-${index}`,
            },
          },
        );

        expect(exchangeResponse.status()).toBe(200);
        const exchangeBody = (await exchangeResponse.json()) as ExchangeResponse;
        const sourcePhotoId = exchangeBody.photo?.sourcePhotoId ?? "";

        expect(candidateIdSet.has(sourcePhotoId)).toBe(true);
        selectedSourcePhotoIds.add(sourcePhotoId);
      }

      expect(selectedSourcePhotoIds.size).toBeGreaterThan(1);
    } finally {
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", adminCandidateIds);
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
      expect(secondBody.photo?.title).toBe("ほかの猫のねがお");

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

  test("returns one stable four-photo bundle for an eligible evening choice request", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the four-choice smoke test.",
    );
    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const anonymousId = `four-choice-anonymous-${createdAt}`;
    const candidateIds = Array.from(
      { length: 4 },
      (_, index) => `four-choice-candidate-${createdAt}-${index + 1}`,
    );
    const candidateStoragePaths = candidateIds.map(
      (candidateId) => `e2e/four-choice/${candidateId}.png`,
    );
    const deliveryDateKey = getYesterdayJstDateKey();

    try {
      await Promise.all(
        candidateStoragePaths.map((storagePath) =>
          uploadTestPhoto(adminSupabase, storagePath),
        ),
      );
      const { error: insertError } = await adminSupabase.from("cat_moments").insert(
        candidateIds.map((candidateId, index) => ({
          anonymous_id: `four-choice-source-${createdAt}-${index + 1}`,
          local_moment_id: candidateId,
          local_cat_id: `four-choice-source-cat-${createdAt}-${index + 1}`,
          owner_cat_id: `four-choice-source-cat-${createdAt}-${index + 1}`,
          photo_url: toStoragePhotoUrl(candidateStoragePaths[index]),
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          moderated_at: new Date(createdAt - 60_000).toISOString(),
          moderated_by: "e2e",
          source_moment_id: null,
          metadata: {
            source: "e2e-four-choice",
            pool_kind: "user_shared",
            theme: "sleeping",
            trigger_label: "sleeping",
          },
          captured_at: new Date(createdAt - 60_000).toISOString(),
          created_at: new Date(createdAt - 60_000 - index).toISOString(),
        })),
      );
      expect(insertError).toBeNull();

      const payload = {
        ...buildExchangeRequest(
          normalCatLikePhotoUrl,
          `four-choice-own-${createdAt}`,
          anonymousId,
        ),
        ownPhoto: {
          ...buildExchangeRequest(
            normalCatLikePhotoUrl,
            `four-choice-own-${createdAt}`,
            anonymousId,
          ).ownPhoto,
          shared: false,
        },
        capability: "evening_choice_v1",
        requestedCandidateCount: 4,
        debugDryRun: false,
        deliveryDateKey,
        preferredSourcePhotoId: candidateIds[0],
        seed: `${deliveryDateKey}:four-choice-own-${createdAt}`,
        recipientCatId: `four-choice-recipient-${createdAt}`,
      };

      const firstResponse = await request.post("/api/sleeping-delivery/exchange", {
        data: payload,
      });
      expect(firstResponse.status()).toBe(200);
      const firstBody = (await firstResponse.json()) as ExchangeResponse;

      expect(firstBody.experienceVersion).toBe("evening_choice_v1");
      expect(firstBody.assignedVariant).toBe("four_choice_v1");
      expect(firstBody.servedVariant).toBe("four_choice_v1");
      expect(firstBody.requestedCount).toBe(4);
      expect(firstBody.servedCount).toBe(4);
      expect(firstBody.fallbackReason).toBeNull();
      expect(firstBody.photos).toHaveLength(4);
      expect(firstBody.photo?.id).toBe(firstBody.photos?.[0]?.id);
      expect(firstBody.photo?.title).toBe("ほかの猫のねがお");
      expect(new Set(firstBody.photos?.map((photo) => photo.id)).size).toBe(4);
      expect(
        new Set(firstBody.photos?.map((photo) => photo.sourcePhotoId)).size,
      ).toBe(4);

      const secondResponse = await request.post("/api/sleeping-delivery/exchange", {
        data: payload,
      });
      expect(secondResponse.status()).toBe(200);
      const secondBody = (await secondResponse.json()) as ExchangeResponse;
      expect(secondBody.bundleId).toBe(firstBody.bundleId);
      expect(secondBody.photos?.map((photo) => photo.id)).toEqual(
        firstBody.photos?.map((photo) => photo.id),
      );
      expect(secondBody.photos?.map((photo) => photo.sourcePhotoId)).toEqual(
        firstBody.photos?.map((photo) => photo.sourcePhotoId),
      );

      const { count, error: countError } = await adminSupabase
        .from("cat_moment_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("anonymous_id", anonymousId)
        .contains("metadata", { bundle_id: firstBody.bundleId });
      expect(countError).toBeNull();
      expect(count).toBe(4);
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", candidateIds);
      await adminSupabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .remove(candidateStoragePaths);
    }
  });

  test("rejects malformed evening bundle ids without crashing", async ({
    request,
  }) => {
    const response = await request.post("/api/sleeping-delivery/choice", {
      data: {
        operation: "keep",
        bundleId: "[",
        deliveryDateKey: getTodayJstDateKey(),
        selectedPhotoId: "[-choice-1",
        anonymousId: "malformed-choice-anonymous-id",
      },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "invalid_identity",
    });
  });

  test("finalizes one canonical photo for an evening bundle", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();
    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "SUPABASE_SERVICE_ROLE_KEY is required.");
    if (!adminSupabase) return;

    const createdAt = Date.now();
    const anonymousId = `choice-resolution-anon-${createdAt}`;
    const deliveryDateKey = getTodayJstDateKey();
    const bundleId = buildIdempotentDeliveryId({
      userId: null,
      anonymousId,
      deliveryDateKey,
    });
    const deliveryIds = Array.from(
      { length: 4 },
      (_, index) =>
        buildEveningChoiceDeliverySlotId({
          bundleId,
          position: index + 1,
        }),
    );
    let transientUserId: string | null = null;

    try {
      const { error: insertError } = await adminSupabase
        .from("cat_moment_deliveries")
        .insert(
          deliveryIds.map((localDeliveryId, index) => ({
            anonymous_id: anonymousId,
            local_delivery_id: localDeliveryId,
            source_moment_id: null,
            source_photo_id: `choice-resolution-source-${createdAt}-${index + 1}`,
            recipient_local_cat_id: `choice-resolution-cat-${createdAt}`,
            photo_url: normalCatLikePhotoUrl,
            status: "delivered",
            metadata: {
              bundle_id: bundleId,
              delivery_date_key: deliveryDateKey,
              delivery_position: index + 1,
              experience_version: "evening_choice_v1",
              served_variant: "four_choice_v1",
            },
            delivered_at: new Date().toISOString(),
          })),
      );
      expect(insertError).toBeNull();

      const publicSupabase = createPublicSupabaseClientFromEnv();
      expect(publicSupabase).toBeTruthy();
      if (publicSupabase) {
        const { error: directTableError } = await publicSupabase
          .from("evening_delivery_choice_resolutions")
          .select("id")
          .limit(1);
        expect(directTableError).toBeTruthy();

        const { error: directRpcError } = await publicSupabase.rpc(
          "finalize_evening_delivery_choice",
          {
            p_user_id: null,
            p_anonymous_id: anonymousId,
            p_bundle_id: bundleId,
            p_delivery_date_key: deliveryDateKey,
            p_outcome: "skipped",
            p_selected_local_delivery_id: null,
          },
        );
        expect(directRpcError).toBeTruthy();
      }

      const { error: legacyMetadataError } = await adminSupabase
        .from("cat_moment_deliveries")
        .update({ metadata: { source: "legacy-device-sync" } })
        .eq("anonymous_id", anonymousId)
        .eq("local_delivery_id", deliveryIds[0]);
      expect(legacyMetadataError).toBeNull();

      const competingPhotoIds = [deliveryIds[1], deliveryIds[3]];
      const competingResponses = await Promise.all(
        competingPhotoIds.map((selectedPhotoId) =>
          request.post("/api/sleeping-delivery/choice", {
            data: {
              operation: "keep",
              bundleId,
              deliveryDateKey,
              selectedPhotoId,
              anonymousId,
            },
          }),
        ),
      );
      expect(competingResponses.map((response) => response.status()).sort()).toEqual([
        200,
        409,
      ]);
      const competingBodies = await Promise.all(
        competingResponses.map((response) => response.json()),
      );
      const winningBody = competingBodies.find((body) => body.ok === true) as {
        selectedPhotoId: string;
      };
      const losingBody = competingBodies.find((body) => body.ok === false);
      const winningPhotoId = winningBody.selectedPhotoId;
      expect(competingPhotoIds).toContain(winningPhotoId);
      expect(losingBody).toMatchObject({
        ok: false,
        error: "choice_already_resolved",
        canonical: {
          state: "kept",
          selectedPhotoId: winningPhotoId,
        },
      });

      const retry = await request.post("/api/sleeping-delivery/choice", {
        data: {
          operation: "keep",
          bundleId,
          deliveryDateKey,
          selectedPhotoId: winningPhotoId,
          anonymousId,
        },
      });
      expect(retry.status()).toBe(200);
      expect(await retry.json()).toMatchObject({
        ok: true,
        state: "kept",
        selectedPhotoId: winningPhotoId,
        idempotent: true,
      });

      const { error: staleSyncError } = await adminSupabase
        .from("cat_moment_deliveries")
        .update({ metadata: { source: "stale-account-sync" } })
        .eq("anonymous_id", anonymousId)
        .eq("local_delivery_id", winningPhotoId);
      expect(staleSyncError).toBeNull();

      const retryAfterMetadataOverwrite = await request.post(
        "/api/sleeping-delivery/choice",
        {
          data: {
            operation: "keep",
            bundleId,
            deliveryDateKey,
            selectedPhotoId: winningPhotoId,
            anonymousId,
          },
        },
      );
      expect(retryAfterMetadataOverwrite.status()).toBe(200);
      expect(await retryAfterMetadataOverwrite.json()).toMatchObject({
        ok: true,
        state: "kept",
        selectedPhotoId: winningPhotoId,
        idempotent: true,
      });

      const authenticatedSupabase = createPublicSupabaseClientFromEnv();
      expect(authenticatedSupabase).toBeTruthy();
      if (authenticatedSupabase) {
        const signedIn = await createConfirmedTestUser(
          adminSupabase,
          authenticatedSupabase,
          `choice-after-login-${createdAt}@example.test`,
        );
        transientUserId = signedIn.userId;

        const authenticatedRetry = await request.post(
          "/api/sleeping-delivery/choice",
          {
            headers: { Authorization: `Bearer ${signedIn.accessToken}` },
            data: {
              operation: "keep",
              bundleId,
              deliveryDateKey,
              selectedPhotoId: winningPhotoId,
              anonymousId,
            },
          },
        );
        expect(authenticatedRetry.status()).toBe(200);
        expect(await authenticatedRetry.json()).toMatchObject({
          ok: true,
          state: "kept",
          selectedPhotoId: winningPhotoId,
          idempotent: true,
        });

        const { error: authenticatedTableError } = await authenticatedSupabase
          .from("evening_delivery_choice_resolutions")
          .select("id")
          .limit(1);
        expect(authenticatedTableError).toBeTruthy();

        const { error: authenticatedRpcError } = await authenticatedSupabase.rpc(
          "finalize_evening_delivery_choice",
          {
            p_user_id: null,
            p_anonymous_id: anonymousId,
            p_bundle_id: bundleId,
            p_delivery_date_key: deliveryDateKey,
            p_outcome: "kept",
            p_selected_local_delivery_id: winningPhotoId,
          },
        );
        expect(authenticatedRpcError).toBeTruthy();
      }

      const { data: resolutionRows, error: resolutionError } =
        await adminSupabase
          .from("evening_delivery_choice_resolutions")
          .select("outcome, selected_local_delivery_id")
          .eq("anonymous_id", anonymousId);
      expect(resolutionError).toBeNull();
      expect(resolutionRows).toEqual([
        {
          outcome: "kept",
          selected_local_delivery_id: winningPhotoId,
        },
      ]);

      const { data: deliveryRows, error: deliveryError } = await adminSupabase
        .from("cat_moment_deliveries")
        .select("local_delivery_id, status")
        .eq("anonymous_id", anonymousId)
        .order("local_delivery_id");
      expect(deliveryError).toBeNull();
      expect(deliveryRows).toEqual(
        deliveryIds.map((localDeliveryId) => ({
          local_delivery_id: localDeliveryId,
          status: localDeliveryId === winningPhotoId ? "kept" : "delivered",
        })),
      );

      const { error: reportedStatusError } = await adminSupabase
        .from("cat_moment_deliveries")
        .update({ status: "reported" })
        .eq("anonymous_id", anonymousId)
        .eq("local_delivery_id", winningPhotoId);
      expect(reportedStatusError).toBeNull();

      const staleKeepRetry = await request.post(
        "/api/sleeping-delivery/choice",
        {
          data: {
            operation: "keep",
            bundleId,
            deliveryDateKey,
            selectedPhotoId: winningPhotoId,
            anonymousId,
          },
        },
      );
      expect(staleKeepRetry.status()).toBe(409);
      expect(await staleKeepRetry.json()).toMatchObject({
        ok: false,
        error: "choice_already_resolved",
        canonical: {
          state: "skipped",
          selectedPhotoId: null,
        },
      });

      const staleSkipRetry = await request.post(
        "/api/sleeping-delivery/choice",
        {
          data: {
            operation: "skip",
            bundleId,
            deliveryDateKey,
            selectedPhotoId: null,
            anonymousId,
          },
        },
      );
      expect(staleSkipRetry.status()).toBe(200);
      expect(await staleSkipRetry.json()).toMatchObject({
        ok: true,
        state: "skipped",
        selectedPhotoId: null,
        idempotent: true,
      });
    } finally {
      await adminSupabase
        .from("evening_delivery_choice_resolutions")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      if (transientUserId) {
        await adminSupabase.auth.admin.deleteUser(transientUserId);
      }
    }
  });

  test("backs up private own sleeping photos without exposing them to queue or delivery", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();

    const adminSupabase = createAdminSupabaseClientFromEnv();

    test.skip(
      !adminSupabase,
      "SUPABASE_SERVICE_ROLE_KEY is required for the private backup smoke test.",
    );

    if (!adminSupabase) {
      return;
    }

    const createdAt = Date.now();
    const anonymousId = `private-backup-anonymous-${createdAt}`;
    const localMomentId = `private-backup-moment-${createdAt}`;

    try {
      const response = await request.post("/api/sleeping-delivery/backup", {
        data: {
          anonymousId,
          photo: {
            id: localMomentId,
            catId: `private-backup-cat-${createdAt}`,
            ownerCatId: `private-backup-cat-${createdAt}`,
            src: normalCatLikePhotoUrl,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: false,
            captureContext: "onboarding",
            createdAt,
          },
        },
      });

      expect(response.status()).toBe(200);

      const { data: backedUpRows, error: readError } = await adminSupabase
        .from("cat_moments")
        .select("local_moment_id, visibility, moderation_status, delivery_status, metadata")
        .eq("anonymous_id", anonymousId)
        .eq("local_moment_id", localMomentId);

      expect(readError).toBeFalsy();
      expect(backedUpRows).toHaveLength(1);
      expect(backedUpRows?.[0]).toMatchObject({
        local_moment_id: localMomentId,
        visibility: "private",
        moderation_status: "pending",
        delivery_status: "available",
      });
      expect(backedUpRows?.[0]?.metadata).toMatchObject({
        source: "user_backup",
        pool_kind: "user_private",
        shared: false,
        capture_context: "onboarding",
      });

      const { count: queueCount, error: queueError } = await adminSupabase
        .from("cat_moments")
        .select("id", { count: "exact", head: true })
        .eq("local_moment_id", localMomentId)
        .eq("moderation_status", "pending")
        .eq("visibility", "shared")
        .eq("delivery_status", "available");

      expect(queueError).toBeFalsy();
      expect(queueCount).toBe(0);

      const { count: candidateCount, error: candidateError } = await adminSupabase
        .from("cat_moments")
        .select("id", { count: "exact", head: true })
        .eq("local_moment_id", localMomentId)
        .eq("visibility", "shared")
        .eq("delivery_status", "available")
        .eq("moderation_status", "approved");

      expect(candidateError).toBeFalsy();
      expect(candidateCount).toBe(0);
    } finally {
      await adminSupabase
        .from("cat_moments")
        .delete()
        .eq("anonymous_id", anonymousId);
    }
  });

  test("keeps a backed-up photo approved through retry and evening exchange", async ({
    request,
  }) => {
    await skipIfLocalSupabaseUnavailable();
    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "SUPABASE_SERVICE_ROLE_KEY is required.");
    if (!adminSupabase) return;

    const createdAt = Date.now();
    const anonymousId = `backup-idempotent-anon-${createdAt}`;
    const localMomentId = `backup-idempotent-own-${createdAt}`;
    const candidateId = `backup-idempotent-candidate-${createdAt}`;
    const photo = {
      id: localMomentId,
      catId: `backup-idempotent-cat-${createdAt}`,
      ownerCatId: `backup-idempotent-cat-${createdAt}`,
      src: normalCatLikePhotoUrl,
      state: "sleeping",
      visibility: "shared",
      deliveryStatus: "available",
      triggerLabel: "sleeping",
      theme: "sleeping",
      shared: true,
      createdAt,
    };

    try {
      const firstBackup = await request.post("/api/sleeping-delivery/backup", {
        data: { anonymousId, photo },
      });
      expect(firstBackup.status()).toBe(200);

      const { error: approveError } = await adminSupabase
        .from("cat_moments")
        .update({
          moderation_status: "approved",
          moderated_at: new Date().toISOString(),
          moderated_by: "e2e",
        })
        .eq("anonymous_id", anonymousId)
        .eq("local_moment_id", localMomentId);
      expect(approveError).toBeNull();

      const retryBackup = await request.post("/api/sleeping-delivery/backup", {
        data: { anonymousId, photo },
      });
      expect(retryBackup.status()).toBe(200);

      const { error: candidateError } = await adminSupabase
        .from("cat_moments")
        .insert({
          anonymous_id: `backup-idempotent-source-${createdAt}`,
          local_moment_id: candidateId,
          local_cat_id: `backup-idempotent-source-cat-${createdAt}`,
          owner_cat_id: `backup-idempotent-source-cat-${createdAt}`,
          photo_url: normalCatLikePhotoUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          moderated_at: new Date().toISOString(),
          moderated_by: "e2e",
          metadata: { source: "e2e", pool_kind: "user_shared" },
          captured_at: new Date(createdAt - 60_000).toISOString(),
          created_at: new Date(createdAt - 60_000).toISOString(),
        });
      expect(candidateError).toBeNull();

      const exchange = await request.post("/api/sleeping-delivery/exchange", {
        data: {
          ownPhoto: photo,
          triggerLabel: "sleeping",
          theme: "sleeping",
          category: "sleeping",
          seed: `backup-idempotent-${createdAt}`,
          deliveryDateKey: getYesterdayJstDateKey(),
          recipientCatId: photo.catId,
          anonymousId,
          preferredSourcePhotoId: candidateId,
          blockedPhotoIds: [],
        },
      });
      expect(exchange.status()).toBe(200);

      const { data: ownRows, error: readError } = await adminSupabase
        .from("cat_moments")
        .select("moderation_status, delivery_status, visibility, metadata")
        .eq("anonymous_id", anonymousId)
        .eq("local_moment_id", localMomentId);
      expect(readError).toBeNull();
      expect(ownRows).toHaveLength(1);
      expect(ownRows?.[0]).toMatchObject({
        moderation_status: "approved",
        delivery_status: "available",
        visibility: "shared",
      });
      expect(ownRows?.[0]?.metadata).toMatchObject({ source: "user_backup" });
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", [localMomentId, candidateId]);
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

async function createConfirmedTestUser(
  adminSupabase: any,
  publicSupabase: any,
  email: string,
) {
  const password = `Password-${Date.now()}-${Math.random().toString(16).slice(2)}!`;
  const { data: created, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    });

  expect(createError).toBeFalsy();
  expect(created.user?.id).toBeTruthy();

  const { data: signedIn, error: signInError } =
    await publicSupabase.auth.signInWithPassword({
      email,
      password,
    });

  expect(signInError).toBeFalsy();
  expect(signedIn.session?.access_token).toBeTruthy();

  return {
    accessToken: signedIn.session?.access_token ?? "",
    email,
    userId: created.user?.id ?? "",
  };
}

async function uploadTestPhoto(
  adminSupabase: any,
  storagePath: string,
) {
  const { buffer, contentType } = dataUrlToBuffer(normalCatLikePhotoUrl);
  const { error } = await adminSupabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  expect(error).toBeFalsy();
}

async function insertTestMoment(
  adminSupabase: any,
  {
    localMomentId,
    photoUrl,
    userId,
  }: {
    localMomentId: string;
    photoUrl: string;
    userId: string;
  },
) {
  const { error } = await adminSupabase.from("cat_moments").insert({
    anonymous_id: null,
    captured_at: new Date().toISOString(),
    delivery_status: "available",
    local_cat_id: "account-delete-cat",
    local_moment_id: localMomentId,
    metadata: { source: "e2e-account-deletion" },
    moderation_status: "approved",
    owner_cat_id: "account-delete-cat",
    photo_url: photoUrl,
    state: "sleeping",
    user_id: userId,
    visibility: "shared",
  });

  expect(error).toBeFalsy();
}

async function insertAnonymousTestMoment(
  adminSupabase: any,
  {
    anonymousId,
    localMomentId,
    photoUrl,
  }: {
    anonymousId: string;
    localMomentId: string;
    photoUrl: string;
  },
) {
  const { error } = await adminSupabase.from("cat_moments").insert({
    anonymous_id: anonymousId,
    captured_at: new Date().toISOString(),
    delivery_status: "available",
    local_cat_id: "account-delete-anonymous-cat",
    local_moment_id: localMomentId,
    metadata: { source: "e2e-account-deletion-anonymous" },
    moderation_status: "approved",
    owner_cat_id: "account-delete-anonymous-cat",
    photo_url: photoUrl,
    state: "sleeping",
    user_id: null,
    visibility: "shared",
  });

  expect(error).toBeFalsy();
}

async function insertTestDelivery(
  adminSupabase: any,
  {
    localDeliveryId,
    photoUrl,
    recipientUserId,
    sourcePhotoId,
  }: {
    localDeliveryId: string;
    photoUrl: string;
    recipientUserId: string;
    sourcePhotoId: string;
  },
) {
  const { error } = await adminSupabase.from("cat_moment_deliveries").insert({
    anonymous_id: null,
    local_delivery_id: localDeliveryId,
    metadata: { source: "e2e-account-deletion" },
    photo_url: photoUrl,
    recipient_local_cat_id: "account-delete-recipient-cat",
    source_photo_id: sourcePhotoId,
    status: "delivered",
    user_id: recipientUserId,
  });

  expect(error).toBeFalsy();
}

async function insertTestAppEvent(
  adminSupabase: any,
  userId: string,
  id: number,
  anonymousId?: string,
) {
  const { error } = await adminSupabase.from("app_events").insert({
    anonymous_id: anonymousId ?? null,
    event_name: `account_delete_e2e_${id}`,
    source: "direct",
    user_id: userId,
  });

  expect(error).toBeFalsy();
}

async function insertTestAccountOwnedRows(
  adminSupabase: any,
  {
    accessToken,
    anonymousId,
    eventId,
    userId,
  }: {
    accessToken: string;
    anonymousId: string;
    eventId: number;
    userId: string;
  },
) {
  const userSupabase = createAuthenticatedSupabaseClientFromEnv(accessToken);
  if (!userSupabase) {
    throw new Error("Authenticated Supabase test client unavailable");
  }

  await insertTestAppEvent(userSupabase, userId, eventId, anonymousId);

  const { error: localStateError } = await userSupabase
    .from("account_local_state")
    .upsert({
      state_key: `account-delete-e2e-${eventId}`,
      user_id: userId,
      value: { source: "e2e-account-deletion" },
    });
  expect(localStateError).toBeFalsy();

  const { error: productAnalyticsError } = await userSupabase
    .from("product_analytics_events")
    .insert({
      anonymous_id: anonymousId,
      local_cat_id: "account-delete-cat",
      name: `account_delete_e2e_${eventId}`,
      properties: { source: "e2e-account-deletion" },
      route: "/e2e-account-delete",
      session_id: `account-delete-session-${eventId}`,
      source: "direct",
      user_id: userId,
    });
  expect(productAnalyticsError).toBeFalsy();

  const { error: mikkeError } = await userSupabase
    .from("mikke_window_answers")
    .insert({
      anonymous_id: anonymousId,
      answer_id: "floor",
      answer_label: "floor",
      category: "place",
      local_cat_id: "account-delete-cat",
      metadata: { source: "e2e-account-deletion" },
      question_id: `account-delete-question-${eventId}`,
      user_id: userId,
      window_id: `account-delete-window-${eventId}`,
    });
  expect(mikkeError).toBeFalsy();

  const { error: profileError } = await userSupabase.from("profiles").upsert({
    display_name: "Account Delete E2E",
    id: userId,
  });
  expect(profileError).toBeFalsy();
}

async function expectTableCount(
  adminSupabase: any,
  table: string,
  filters: Record<string, string>,
  expected: number,
) {
  let query = adminSupabase
    .from(table)
    .select("*", { count: "exact", head: true });

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;
  expect(error).toBeFalsy();
  expect(count).toBe(expected);
}

async function expectAccountUserDeleted(
  adminSupabase: any,
  userId: string,
) {
  const { data, error } = await adminSupabase.auth.admin.getUserById(userId);

  expect(error || !data.user).toBeTruthy();
}

function createFakeAccountDeletionSupabase({
  deleteErrors = {},
  updateRowsBySourcePath = {},
}: {
  deleteErrors?: Record<string, string>;
  updateRowsBySourcePath?: Record<string, Array<{ id: string }>>;
}) {
  const state = {
    authDeleteCalls: 0,
    storageRemovedPaths: [] as string[],
  };
  const client = {
    auth: {
      admin: {
        deleteUser: async () => {
          state.authDeleteCalls += 1;
          return { error: null };
        },
      },
    },
    storage: {
      from: () => ({
        copy: async () => ({ error: null }),
        list: async () => ({ data: [], error: null }),
        remove: async (paths: string[]) => {
          state.storageRemovedPaths.push(...paths);
          return { error: null };
        },
      }),
    },
    from: (table: string) =>
      createFakeAccountDeletionQuery({
        deleteError: deleteErrors[table] ?? null,
        table,
        updateRowsBySourcePath,
      }),
  } as any;

  return {
    client,
    get authDeleteCalls() {
      return state.authDeleteCalls;
    },
    get storageRemovedPaths() {
      return state.storageRemovedPaths;
    },
  };
}

function createFakeAccountDeletionQuery({
  deleteError,
  table,
  updateRowsBySourcePath,
}: {
  deleteError: string | null;
  table: string;
  updateRowsBySourcePath: Record<string, Array<{ id: string }>>;
}) {
  let operation: "delete" | "select" | "update" | null = null;
  let sourcePath: string | null = null;

  const query = {
    delete() {
      operation = "delete";
      return query;
    },
    eq() {
      return query;
    },
    in(column: string, values: string[]) {
      if (column === "photo_url") {
        sourcePath =
          values
            .map((value) => value.replace(/^storage:\/\//, "").replace(/^storage:/, ""))
            .find((value) => updateRowsBySourcePath[value] !== undefined) ?? null;
      }
      return query;
    },
    maybeSingle: async () => ({ data: null, error: null }),
    or() {
      return query;
    },
    range() {
      return Promise.resolve({ data: [], error: null });
    },
    select() {
      if (operation === "update") {
        return Promise.resolve({
          data: sourcePath ? updateRowsBySourcePath[sourcePath] ?? [] : [],
          error: null,
        });
      }
      operation = "select";
      return query;
    },
    then(resolve: (value: { data?: unknown[]; error: { message: string } | null }) => void) {
      if (operation === "delete") {
        resolve({
          error: deleteError ? { message: deleteError } : null,
        });
        return;
      }
      resolve({ data: [], error: null });
    },
    update() {
      operation = "update";
      return query;
    },
  };

  void table;
  return query;
}

function createFakeOnboardingValidationSupabase(priorDeliveryCount = 0) {
  const insertedAppEvents: Array<Record<string, unknown>> = [];
  const client = {
    from: (table: string) => {
      if (table === "app_events") {
        return {
          insert: async (row: Record<string, unknown>) => {
            insertedAppEvents.push(row);
            return { error: null };
          },
        };
      }

      return {
        eq() {
          return this;
        },
        is() {
          return this;
        },
        select() {
          return this;
        },
        then(resolve: (value: { count: number; error: null }) => void) {
          resolve({ count: priorDeliveryCount, error: null });
        },
      };
    },
  } as any;

  return { client, insertedAppEvents };
}

function createFakeDeliveryLookupSupabase(deliveries: Array<Record<string, unknown>>) {
  const client = {
    from: (table: string) => {
      expect(table).toBe("cat_moment_deliveries");
      return createFakeDeliveryLookupQuery(deliveries);
    },
  } as any;

  return { client };
}

function createFakeDeliveryLookupQuery(deliveries: Array<Record<string, unknown>>) {
  const filters: Record<string, unknown> = {};

  const query = {
    eq(column: string, value: unknown) {
      filters[column] = value;
      return query;
    },
    is(column: string, value: unknown) {
      filters[column] = value;
      return query;
    },
    limit() {
      return query;
    },
    maybeSingle: async () => {
      const data =
        deliveries.find((delivery) =>
          Object.entries(filters).every(([column, value]) => {
            if (value === null) {
              return delivery[column] === null || delivery[column] === undefined;
            }
            return delivery[column] === value;
          }),
        ) ?? null;

      return { data, error: null };
    },
    select() {
      return query;
    },
  };

  return query;
}

function createDeliverableRow(
  overrides: Partial<{
    anonymous_id: string | null;
    user_id: string | null;
    visibility: "private" | "shared";
  }> = {},
) {
  return {
    anonymous_id: overrides.anonymous_id ?? "anon-other",
    created_at: new Date().toISOString(),
    delivery_count: 0,
    delivery_status: "available" as const,
    id: "row-id",
    local_cat_id: "cat-source",
    local_moment_id: "source-moment",
    metadata: { pool_kind: "user_shared" },
    moderation_status: "approved" as const,
    owner_cat_id: "cat-source",
    photo_url: normalCatLikePhotoUrl,
    pool_date: "2026-07-05",
    user_id: overrides.user_id ?? "user-other",
    visibility: overrides.visibility ?? "shared",
  };
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid test data URL");
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    contentType: match[1],
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

function getTodayJstDateKey() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createPublicSupabaseClientFromEnv() {
  const env = readLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createAuthenticatedSupabaseClientFromEnv(accessToken: string) {
  const env = readLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
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
