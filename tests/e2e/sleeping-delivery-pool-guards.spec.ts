import { expect, test, type APIRequestContext } from "@playwright/test";

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

test.describe("sleeping delivery pool guards", () => {
  test("does not return known test or debug pool rows", async ({ request }) => {
    for (let index = 0; index < 12; index += 1) {
      const result = await readCandidate(request, index);

      if (!result.photo) {
        continue;
      }

      expectCandidateIsNotTestPoolPhoto(result.photo);
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
  expect(photo.sourceCatId ?? "").not.toBe("admin-stock");
  expect(photo.src ?? "").not.toContain("placecats.com");
}
