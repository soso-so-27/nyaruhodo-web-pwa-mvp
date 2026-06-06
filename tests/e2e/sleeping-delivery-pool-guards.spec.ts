import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  isBlockedDeliveryPhotoUrl,
  isBlockedDeliveryPoolRow,
  isStorageDeliveryPhotoUrl,
} from "../../src/lib/home/deliveryPoolGuards";
import {
  normalizePersistentPhotoSrc,
  toStoragePhotoUrl,
} from "../../src/lib/photoStorage";

const redBlueTestPhotoUrl =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAsHCAoIBwsKCQoMDAsNEBsSEA8PECEYGRQbJyMpKScjJiUsMT81LC47LyUmNko3O0FDRkdGKjRNUkxEUj9FRkP/2wBDAQwMDBAOECASEiBDLSYtQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0P/wAARCABkAGQDASIAAhEBAxEB/8QAGQABAQEBAQEAAAAAAAAAAAAAAAIHAwQB/8QAFxABAAMAAAAAAAAAAAAAAAAAAAEDMv/EABkBAQADAQEAAAAAAAAAAAAAAAADBgcEBf/EACgRAQAAAggGAwEAAAAAAAAAAAABBAIDFBViobHhETM0YXFyEhMxkf/aAAwDAQACEQMRAD8A+gPMXcAAAB2rxCk14hS5yvIoeIaM2nuqrfaOsQBO5AAAAHnAUVqgAAADtXiFJrxClzleRQ8Q0ZtPdVW+0dYgCdyAAAAPOAorVAAAAHavEKTXiFLnK8ih4hozae6qt9o6xAE7kAAAAecBRWqAAAAO1eIUmvEKXOV5FDxDRm091Vb7R1iAJ3IAAAA84CitUAAAAdq8QpNeIUucryKHiGjNp7qq32jrEATuQAAAB5xkIp9n7rxfODPZrwyELP3L5wZ7NeGQhZ+5fODPZsleIUxkezVT/wBdXRofH8hCH7srdfL/AHVtKs48OMYx/sWzDGRJeWHPZFYsWTZhjIXlhz2LFiybMMZC8sOexYsWQA8t3AAAAAAAAAAAAP/Z";

const normalCatLikePhotoUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

type CandidateResponse = {
  photo?: {
    id?: string;
    sourceOwnPhotoId?: string;
    sourceCatId?: string;
    src?: string;
  } | null;
  source?: "remote" | "none";
};

type ExchangeResponse = {
  photo?: {
    id: string;
    sourcePhotoId?: string;
    src: string;
  } | null;
  source?: "remote" | "none";
};

type DiagnosticsResponse = {
  candidateCount: number;
  normalCandidateCount: number;
  fallbackCandidateCount: number;
  fallbackActive: boolean;
  excludedCount: number;
  totalSharedRows: number;
  blockedRows: number;
  storageExcludedRows: number;
  deliverableRows: number;
  dataImageDeliverableRows: number;
  httpDeliverableRows: number;
  storageRows: number;
};

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

  test("treats storage paths as non-deliverable for beta exchange", () => {
    expect(isStorageDeliveryPhotoUrl("storage:user/cat/sleeping/photo.jpg")).toBe(
      true,
    );
    expect(isStorageDeliveryPhotoUrl(normalCatLikePhotoUrl)).toBe(false);
    expect(isStorageDeliveryPhotoUrl("https://example.com/photo.jpg")).toBe(false);
  });

  test("reports diagnostics using the same storage exclusion as delivery", async ({
    request,
  }) => {
    const response = await request.post("/api/sleeping-delivery/diagnostics", {
      data: { blockedPhotoIds: [] },
    });

    expect(response.ok()).toBeTruthy();
    const diagnostics = (await response.json()) as DiagnosticsResponse;

    expect(diagnostics.candidateCount).toBe(diagnostics.deliverableRows);
    expect(diagnostics.normalCandidateCount).toBe(diagnostics.deliverableRows);
    expect(diagnostics.fallbackCandidateCount).toBe(0);
    expect(diagnostics.fallbackActive).toBe(false);
    expect(diagnostics.deliverableRows).toBe(
      diagnostics.dataImageDeliverableRows + diagnostics.httpDeliverableRows,
    );
    expect(diagnostics.storageRows).toBeGreaterThanOrEqual(
      diagnostics.storageExcludedRows,
    );
    expect(diagnostics.excludedCount).toBeGreaterThanOrEqual(
      diagnostics.storageExcludedRows,
    );
    expect(diagnostics.totalSharedRows).toBeGreaterThanOrEqual(
      diagnostics.blockedRows + diagnostics.storageRows,
    );
  });

  test("does not return known test or debug pool rows", async ({ request }) => {
    for (let index = 0; index < 12; index += 1) {
      const result = await readCandidate(request, index);

      if (!result.photo) {
        continue;
      }

      expectCandidateIsNotTestPoolPhoto(result.photo);
      expect(result.photo.src ?? "").not.toMatch(/^storage:/);
    }

    const createdAt = Date.now();
    const exchangeResponse = await request.post(
      "/api/sleeping-delivery/exchange",
      {
        data: {
          ownPhoto: {
            id: `guard-own-${createdAt}`,
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
          anonymousId: `guard-anonymous-${createdAt}`,
          debugDryRun: true,
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
      expect(exchange.photo.src).not.toMatch(/^storage:/);
    }
  });
});

async function readCandidate(request: APIRequestContext, index: number) {
  const response = await request.post("/api/sleeping-delivery/candidate", {
    data: {
      seed: `guard-candidate-${index}`,
      triggerLabel: "ねがお",
      theme: "sleeping",
      category: "sleeping",
      recipientCatId: `guard-recipient-${index}`,
      blockedPhotoIds: [],
    },
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as CandidateResponse;
}

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
  expect(photo.src ?? "").not.toMatch(/^storage:/);

  if (photo.sourceCatId === "admin-stock") {
    expect(photo.src ?? "").toMatch(/^data:image\//);
  }
}
