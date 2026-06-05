import { expect, test, type APIRequestContext } from "@playwright/test";

type CandidateResponse = {
  photo?: {
    id?: string;
    sourceOwnPhotoId?: string;
  } | null;
};

type DiagnosticsResponse = {
  source: "remote" | "none" | "error";
  availableCount: number;
  candidateCount: number;
  normalCandidateCount: number;
  fallbackCandidateCount: number;
  fallbackActive: boolean;
  blockedCount: number;
  adminStockCount: number;
};

type ExchangeResponse = {
  photo?: {
    id: string;
    sourcePhotoId?: string;
    src: string;
  } | null;
  source?: "remote" | "none";
  diagnostics?: DiagnosticsResponse;
};

test.describe("sleeping delivery fallback", () => {
  test("delivers admin stock when device history blocks all visible candidates", async ({
    request,
  }) => {
    test.setTimeout(90_000);

    const { blockedPhotoIds, diagnostics } =
      await collectUntilAdminStockFallbackIsActive(request);

    expect(blockedPhotoIds.length).toBeGreaterThan(0);
    expect(diagnostics.adminStockCount).toBeGreaterThan(0);
    expect(diagnostics.source).toBe("remote");
    expect(diagnostics.normalCandidateCount).toBe(0);
    expect(diagnostics.fallbackActive).toBeTruthy();
    expect(diagnostics.fallbackCandidateCount).toBeGreaterThan(0);
    expect(diagnostics.candidateCount).toBe(diagnostics.fallbackCandidateCount);

    const createdAt = Date.now();
    const recipientCatId = `e2e-recipient-${createdAt}`;
    const exchangeResponse = await request.post(
      "/api/sleeping-delivery/exchange",
      {
        data: {
          ownPhoto: {
            id: `e2e-own-${createdAt}`,
            catId: recipientCatId,
            ownerCatId: recipientCatId,
            src: "https://placecats.com/320/320",
            createdAt,
            triggerLabel: "ねがお",
            theme: "sleeping",
          },
          triggerLabel: "ねがお",
          theme: "sleeping",
          category: "sleeping",
          seed: `e2e-${createdAt}`,
          recipientCatId,
          anonymousId: `e2e-anonymous-${createdAt}`,
          blockedPhotoIds,
          debugDryRun: true,
        },
      },
    );
    expect(exchangeResponse.ok()).toBeTruthy();
    const exchange = (await exchangeResponse.json()) as ExchangeResponse;

    expect(exchange.source).toBe("remote");
    expect(exchange.photo?.id).toBeTruthy();
    expect(exchange.photo?.sourcePhotoId).toBeTruthy();
    expect(exchange.photo?.src).toBeTruthy();
    expect(exchange.diagnostics?.candidateCount).toBeGreaterThan(0);
    expect(exchange.diagnostics?.normalCandidateCount).toBe(0);
    expect(exchange.diagnostics?.fallbackActive).toBeTruthy();
    expect(exchange.diagnostics?.fallbackCandidateCount).toBeGreaterThan(0);
  });
});

async function collectUntilAdminStockFallbackIsActive(
  request: APIRequestContext,
) {
  const blockedPhotoIds = new Set<string>();

  for (let index = 0; index < 120; index += 1) {
    const diagnostics = await readDiagnostics(request, [...blockedPhotoIds]);

    if (diagnostics.fallbackActive) {
      return { blockedPhotoIds: [...blockedPhotoIds], diagnostics };
    }

    const response = await request.post("/api/sleeping-delivery/candidate", {
      data: {
        seed: `collect-${index}`,
        triggerLabel: "ねがお",
        theme: "sleeping",
        category: "sleeping",
        recipientCatId: `collect-cat-${index}`,
        blockedPhotoIds: [...blockedPhotoIds],
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = (await response.json()) as CandidateResponse;

    if (result.photo?.id) {
      blockedPhotoIds.add(result.photo.id);
    }
    if (result.photo?.sourceOwnPhotoId) {
      blockedPhotoIds.add(result.photo.sourceOwnPhotoId);
    }
  }

  throw new Error("Admin stock fallback did not become active.");
}

async function readDiagnostics(
  request: APIRequestContext,
  blockedPhotoIds: string[],
) {
  const response = await request.post("/api/sleeping-delivery/diagnostics", {
    data: { blockedPhotoIds },
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as DiagnosticsResponse;
}
