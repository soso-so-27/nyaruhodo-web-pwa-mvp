import { expect, test } from "@playwright/test";

test.describe("onboarding handoff API", () => {
  test("keeps a handoff redeemable until it expires", async ({ request }) => {
    const createResponse = await request.post("/api/onboarding/handoff/create", {
      data: {
        source: "direct",
        payload: {
          version: 1,
          createdAt: new Date().toISOString(),
          source: "direct",
          onboardingProgress: null,
          onboardingCompleted: true,
          catProfiles: [{ id: "retry-cat", name: "むぎ" }],
          activeCatId: "retry-cat",
          ownSleepingPhotos: [],
          keptExchangePhotos: [],
          pendingReferralCode: null,
          session: null,
        },
      },
    });
    expect(createResponse.ok()).toBe(true);
    const created = (await createResponse.json()) as { token: string };

    const first = await request.post("/api/onboarding/handoff/redeem", {
      data: { token: created.token },
    });
    const second = await request.post("/api/onboarding/handoff/redeem", {
      data: { token: created.token },
    });

    expect(first.ok()).toBe(true);
    expect(second.ok()).toBe(true);
    await expect(second.json()).resolves.toMatchObject({
      ok: true,
      payload: { activeCatId: "retry-cat" },
    });
  });
});
