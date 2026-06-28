import { expect, test, type Locator, type Page } from "@playwright/test";

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC",
  "base64",
);

test.describe("onboarding delivery flow", () => {
  test("reaches the album after adding a real test candidate", async ({ page }) => {
    let exchangeCalls = 0;
    let stockCalls = 0;
    const stockResponses: Array<{
      ok: boolean;
      status: number;
      hasPhoto: boolean;
      error?: string | null;
      srcKind?: string;
      sourceOwnPhotoId?: string;
    }> = [];
    const exchangeResponses: Array<{
      source?: string;
      hasPhoto: boolean;
      sourcePhotoId?: string;
      error?: string | null;
      diagnostics?: Record<string, unknown>;
    }> = [];

    await page.route("**/api/admin/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isAdmin: true,
          testToolsEnabled: true,
          stockAdminEnabled: true,
        }),
      });
    });

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;

      if (exchangeCalls === 1) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            photo: null,
            source: "none",
            diagnostics: {
              source: "none",
              availableCount: 0,
              candidateCount: 0,
              normalCandidateCount: 0,
              fallbackCandidateCount: 0,
              fallbackActive: false,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: `delivered-test-${Date.now()}`,
            sourcePhotoId: stockResponses[0]?.sourceOwnPhotoId ?? "stock-e2e-fake",
            src: `data:image/png;base64,${testPng.toString("base64")}`,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.now(),
          },
          source: "remote",
          diagnostics: {
            source: "remote",
            availableCount: 1,
            candidateCount: 1,
            normalCandidateCount: 1,
            fallbackCandidateCount: 0,
            fallbackActive: false,
          },
        }),
      });
    });

    await page.route("**/api/sleeping-delivery/stock", async (route) => {
      stockCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "remote-stock-e2e-fake",
            sourceOwnPhotoId: "stock-e2e-fake",
            sourceCatId: "admin-stock",
            src: `data:image/png;base64,${testPng.toString("base64")}`,
            title: "",
            subtitle: "",
            tags: ["sleeping"],
          },
        }),
      });
    });

    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes("/api/sleeping-delivery/stock")) {
        try {
          const result = await response.json();
          stockResponses.push({
            ok: response.ok(),
            status: response.status(),
            hasPhoto: Boolean(result.photo),
            error: result.error ?? null,
            srcKind: readSrcKind(result.photo?.src),
            sourceOwnPhotoId: result.photo?.sourceOwnPhotoId,
          });
        } catch {
          stockResponses.push({
            ok: response.ok(),
            status: response.status(),
            hasPhoto: false,
            error: "unreadable_stock_response",
          });
        }
      }
      if (!url.includes("/api/sleeping-delivery/exchange")) {
        return;
      }

      try {
        const result = await response.json();
        exchangeResponses.push({
          source: result.source,
          hasPhoto: Boolean(result.photo),
          sourcePhotoId: result.photo?.sourcePhotoId,
          error: result.error ?? null,
          diagnostics: result.diagnostics,
        });
      } catch {
        exchangeResponses.push({
          hasPhoto: false,
          error: "unreadable_exchange_response",
        });
      }
    });

    await page.goto("/onboarding?test");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator("button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect.poll(() => exchangeCalls).toBe(1);
    const addCandidateButton = page.getByRole("button", {
      name: "とどく候補を追加する",
    });
    const openEnvelopeButton = page.getByRole("button", {
      name: "ねこだよりを開く",
    });

    await expect
      .poll(async () => {
        if (await addCandidateButton.isVisible()) {
          return "test-tools";
        }

        if (await openEnvelopeButton.isVisible()) {
          return "production-fallback";
        }

        return "waiting";
      })
      .not.toBe("waiting");

    if (await openEnvelopeButton.isVisible()) {
      await expect(addCandidateButton).toHaveCount(0);
      return;
    }

    await addCandidateButton.click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "stock-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect.poll(() => stockCalls).toBe(1);
    await expect.poll(() => stockResponses.length).toBe(1);
    expect(stockResponses[0]).toMatchObject({
      ok: true,
      status: 200,
      hasPhoto: true,
      error: null,
      srcKind: "data",
    });
    await expect.poll(() => exchangeCalls).toBe(2);
    await expect.poll(() => exchangeResponses.length).toBe(2);
    expect(exchangeResponses.at(-1)).toMatchObject({
      source: "remote",
      hasPhoto: true,
      sourcePhotoId: stockResponses[0].sourceOwnPhotoId,
      error: null,
    });
    await expect(page.getByText("ねこだよりが")).toBeVisible();
    await expect(page.getByText("届きました")).toBeVisible();
    await page.getByRole("button", { name: "ねこだよりを開く" }).click();
    await page.waitForTimeout(1600);
    await expectVisibleNonBlackImage(page.locator("main img").last());
    await expect(
      page.getByText(/届いたねこだよりを[\s\S]*しまいました。[\s\S]*夜8時の便りになります。/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "つづける" }),
    ).toBeVisible();
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
    const eveningDeliveryDays = await page.evaluate(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );

      return Object.values(parsed).filter((day) =>
        Boolean((day as { targetOwnPhotoId?: string }).targetOwnPhotoId),
      ).length;
    });
    expect(eveningDeliveryDays).toBeGreaterThan(0);
    await page.getByRole("button", { name: "つづける" }).click();
    await continuePastOptionalOnboardingNamePrompt(page);
    await expect(page).toHaveURL(/\/account\/create\?from=onboarding/);

    const storage = await page.evaluate(() => {
      const readArray = (key: string) => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");

          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      return {
        ownSleepingPhotos: readArray("nyaruhodo_exchange_own_sleeping_photos"),
        keptExchangePhotos: readArray("nyaruhodo_exchange_kept_photos"),
      };
    });

    expect(storage.ownSleepingPhotos.length).toBeGreaterThan(0);
    expect(storage.keptExchangePhotos.length).toBeGreaterThan(0);
    expect(storage.ownSleepingPhotos[0]?.src).toMatch(/^data:image\//);
    expect(storage.keptExchangePhotos[0]?.src).toBeTruthy();
  });

  test("automatically keeps a delivered photo after opening it", async ({
    page,
  }) => {
    await routeImmediateDelivery(page);

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "ねがおを1枚入れる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByRole("button", { name: "ねこだよりを開く" })).toBeVisible();
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(0);
    await page.getByRole("button", { name: "ねこだよりを開く" }).click();
    await page.waitForTimeout(1600);
    await expect(
      page.getByRole("button", { name: "つづける" }),
    ).toBeVisible();
    await expect(
      page.getByText(/届いたねこだよりを[\s\S]*しまいました。[\s\S]*夜8時の便りになります。/),
    ).toBeVisible();
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);

    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
  });

  test("falls back to thumbnail for storage-backed onboarding deliveries and keeps them visible", async ({
    page,
  }) => {
    await routeStorageDeliveryWithBrokenDisplay(page);

    await page.goto("/onboarding?source=instagram_story");
    await page.waitForLoadState("networkidle");
    await page.locator("main button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.locator("main button").first()).toBeVisible();
    await page.locator("main button").first().click();
    await page.waitForTimeout(1800);

    await expectVisibleNonBlackImage(page.locator("main img").last());
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
    const openedSnapshot = await readOnboardingDeliverySnapshot(page);

    expect(openedSnapshot.ownPhoto?.id).toBeTruthy();
    expect(openedSnapshot.deliveredPhoto?.id).toBeTruthy();
    expect(openedSnapshot.deliveredPhoto?.sourcePhotoId).toBe("stock-storage-e2e-fake");
    expect(openedSnapshot.keptPhoto?.sourcePhotoId).toBe("stock-storage-e2e-fake");
    expect(openedSnapshot.openedAt).toBeTruthy();
    expect(openedSnapshot.keptAt).toBeTruthy();
    expect(openedSnapshot.deliveredPhoto?.id).not.toBe(openedSnapshot.ownPhoto?.id);
    expect(openedSnapshot.keptPhoto?.id).toBe(openedSnapshot.deliveredPhoto?.id);

    await page.goto("/collection");
    await page.locator('[role="tab"]').nth(0).click();
    const sentCard = page.getByTestId("mainichi-board-photo-sent").first();
    await expect(sentCard).toBeVisible();
    await expect(sentCard).not.toHaveAttribute(
      "data-source-photo-id",
      "stock-storage-e2e-fake",
    );

    await page.locator('[role="tab"]').nth(1).click();
    const deliveredCard = page.getByTestId("mainichi-board-photo-delivered").first();
    await expect(deliveredCard).toBeVisible();
    await expect(deliveredCard).toHaveAttribute(
      "data-photo-id",
      openedSnapshot.deliveredPhoto?.id ?? "",
    );
    await expect(deliveredCard).toHaveAttribute(
      "data-source-photo-id",
      "stock-storage-e2e-fake",
    );
    await expectVisibleNonBlackImage(deliveredCard.locator("img").first());

    await markOnboardingAlbumCreatedInBrowser(page);
    await page.goto("/collection");
    await page.locator('[role="tab"]').nth(1).click();
    const deliveredCardAfterAlbum = page
      .getByTestId("mainichi-board-photo-delivered")
      .first();
    await expect(deliveredCardAfterAlbum).toBeVisible();
    await expect(deliveredCardAfterAlbum).toHaveAttribute(
      "data-photo-id",
      openedSnapshot.deliveredPhoto?.id ?? "",
    );
    await expect(deliveredCardAfterAlbum).toHaveAttribute(
      "data-source-photo-id",
      "stock-storage-e2e-fake",
    );
  });

  test("does not show the PWA home install guide inside Instagram browser", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      Object.defineProperty(window.navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 350.0.0.0 Mobile/15E148",
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("iPhoneでホームに置く")).toHaveCount(0);
  });

  test("restores the current onboarding state across repeated social URL visits", async ({
    page,
  }) => {
    let exchangeCalls = 0;

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "delivered-social-revisit",
            sourcePhotoId: "stock-social-revisit",
            src: `data:image/png;base64,${testPng.toString("base64")}`,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.now(),
          },
          source: "remote",
          diagnostics: {
            source: "remote",
            availableCount: 1,
            candidateCount: 1,
            normalCandidateCount: 1,
            fallbackCandidateCount: 0,
            fallbackActive: false,
          },
        }),
      });
    });

    await page.goto("/onboarding?source=instagram_story");
    await expect(
      page.getByRole("button", { name: "ねがおを1枚入れる" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "ねがおを1枚入れる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByRole("button", { name: "ねこだよりを開く" })).toBeVisible();
    await expect.poll(() => exchangeCalls).toBe(1);
    const submittedProgress = await readOnboardingProgress(page);
    expect(submittedProgress).toMatchObject({
      stage: "arrived",
      source: "instagram_story",
    });
    expect(submittedProgress.submissionId).toContain(submittedProgress.dateKey);

    await page.goto("/onboarding?source=instagram_dm");
    await expect(page.getByRole("button", { name: "ねこだよりを開く" })).toBeVisible();
    await expect.poll(() => exchangeCalls).toBe(1);
    expect(await readOnboardingProgress(page)).toMatchObject({
      stage: "arrived",
      source: "instagram_story",
      submissionId: submittedProgress.submissionId,
    });

    await page.getByRole("button", { name: "ねこだよりを開く" }).click();
    await page.waitForTimeout(1600);
    await expect(
      page.getByText(/届いたねこだよりを[\s\S]*しまいました。/),
    ).toBeVisible();

    await page.goto("/onboarding?source=instagram_bio");
    await expect(page).toHaveURL(/\/account\/create\?from=onboarding&source=instagram_bio/);
    await expect(
      page.getByRole("heading", { name: "うちのこのアルバムをつくる" }),
    ).toBeVisible();

    await page.evaluate(() => {
      const raw = window.localStorage.getItem("neteruneko_onboarding_progress");
      const progress = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({ ...progress, stage: "album_created" }),
      );
    });
    await page.goto("/onboarding?source=unknown_source");
    await expect(page).toHaveURL(/\/home/);
  });

  test("does not let yesterday album completion block a new social onboarding day", async ({
    page,
  }) => {
    await routeImmediateDelivery(page);
    await page.addInitScript(() => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(yesterday);

      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "anonymous-yesterday",
          dateKey,
          stage: "album_created",
          source: "instagram_story",
          submissionId: `onboarding:anonymous-yesterday:${dateKey}`,
          updatedAt: yesterday.getTime(),
        }),
      );
    });

    await page.goto("/onboarding?source=instagram_story");
    await expect(page).not.toHaveURL(/\/home/);
    await expect(
      page.getByRole("button", { name: "ねがおを1枚入れる" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "ねがおを1枚入れる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "today-own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByRole("button", { name: "ねこだよりを開く" })).toBeVisible();
    const progress = await readOnboardingProgress(page);
    const todayKey = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );

    expect(progress).toMatchObject({
      dateKey: todayKey,
      stage: "arrived",
      source: "instagram_story",
    });
    expect(progress.submissionId).toContain(todayKey);
  });

  test("normalizes unknown social source without blocking onboarding", async ({
    page,
  }) => {
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?source=instagram_reels");
    await expect(
      page.getByRole("button", { name: "ねがおを1枚入れる" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "ねがおを1枚入れる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "unknown-source-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByRole("button", { name: "ねこだよりを開く" })).toBeVisible();
    expect(await readOnboardingProgress(page)).toMatchObject({
      stage: "arrived",
      source: "unknown",
    });
  });

  test("skips the name entry for an existing named cat", async ({ page }) => {
    await seedOnboardingAlbumCompletionReady(page);
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-existing",
      name: "むぎ",
    });

    await page.goto("/cats?onboarding=1");

    await expect(page.getByText("アルバムに入りました")).toBeVisible();
    await expect(page.getByText("また寝ていたら、ここへ。")).toBeVisible();
    await expect(page.getByText("このねこの名前は？")).toHaveCount(0);
    await expect(page.getByText("プロフィール")).toHaveCount(0);
    await expect(page.getByText("うちの背景")).toHaveCount(0);
    await expect(page.getByText("基本情報")).toHaveCount(0);
    await expect(page.getByText("アカウントと設定")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "アルバムをつくる" })).toHaveCount(0);
  });

  test("does not show the onboarding completion panel on direct cats access", async ({
    page,
  }) => {
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-direct",
      name: "むぎ",
    });

    await page.goto("/cats?onboarding=1");

    await expect(page.getByText("アルバムに入りました")).toHaveCount(0);
    await expect(page.getByText("アルバムができました")).toHaveCount(0);
  });

  test("treats the default cat name with profile details as an existing cat", async ({
    page,
  }) => {
    await seedOnboardingAlbumCompletionReady(page);
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-default-with-details",
      name: "ミケ",
      avatarDataUrl: `data:image/png;base64,${testPng.toString("base64")}`,
    });

    await page.goto("/cats?onboarding=1");

    await expect(page.getByText("アルバムに入りました")).toBeVisible();
    await expect(page.getByText("このねこの名前は？")).toHaveCount(0);
  });

  test("asks for a name when the default cat has no profile details", async ({
    page,
  }) => {
    await seedOnboardingAlbumCompletionReady(page);
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-default-empty",
      name: "ミケ",
    });

    await page.goto("/cats?onboarding=1");

    await expect(page.getByText("このねこの名前は？")).toBeVisible();
    await expect(page.getByRole("button", { name: "アルバムをつくる" })).toBeVisible();
  });

  test("shows a persistent completion panel after creating an onboarding album", async ({
    page,
  }) => {
    await seedOnboardingAlbumCompletionReady(page);
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-default-empty",
      name: "ミケ",
    });

    await page.goto("/cats?onboarding=1");

    await page.getByLabel("この子の名前").fill("こむぎ");
    await page.getByRole("button", { name: "アルバムをつくる" }).click();

    await expect(page.getByText("アルバムができました")).toBeVisible();
    await expect(page.getByText("また寝ていたら、ここへ。")).toBeVisible();
    await expect(page.getByRole("link", { name: "ねてるねこへ" })).toBeVisible();
    await expect(page.getByText("このねこの名前は？")).toHaveCount(0);
    await expect(page.getByText("プロフィール")).toHaveCount(0);
    await expect(page.getByText("うちの背景")).toHaveCount(0);
    await expect(page.getByText("基本情報")).toHaveCount(0);
    await expect(page.getByText("アカウントと設定")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "アルバムをつくる" })).toHaveCount(0);
  });

  test("asks for a name when the cat name is empty", async ({ page }) => {
    await seedOnboardingAlbumCompletionReady(page);
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-empty-name",
      name: "",
    });

    await page.goto("/cats?onboarding=1");

    await expect(page.getByText("このねこの名前は？")).toBeVisible();
    await expect(page.getByRole("button", { name: "アルバムをつくる" })).toBeVisible();
  });
});

async function seedOnboardingAlbumCompletionReady(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "neteruneko_onboarding_album_completion_ready",
      "true",
    );
  });
}

async function seedCatProfileBeforeLoad(page: Page, input: {
  id: string;
  name: string;
  avatarDataUrl?: string;
}) {
  await page.addInitScript((profileInput) => {
    const now = new Date().toISOString();

    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: profileInput.id,
          name: profileInput.name,
          createdAt: now,
          updatedAt: now,
          ...(profileInput.avatarDataUrl
            ? { avatarDataUrl: profileInput.avatarDataUrl }
            : {}),
        },
      ]),
    );
    window.localStorage.setItem("active_cat_id", profileInput.id);
  }, input);
}

async function continuePastOptionalOnboardingNamePrompt(page: Page) {
  const nameInput = page.locator("main section input").first();
  const didShowNamePrompt = await nameInput
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!didShowNamePrompt) {
    return;
  }

  await page.locator("main section button").last().click();
}

async function routeImmediateDelivery(page: Page) {
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        photo: {
          id: `delivered-test-${Date.now()}`,
          sourcePhotoId: "stock-e2e-fake",
          src: `data:image/png;base64,${testPng.toString("base64")}`,
          title: "",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: Date.now(),
        },
        source: "remote",
        diagnostics: {
          source: "remote",
          availableCount: 1,
          candidateCount: 1,
          normalCandidateCount: 1,
          fallbackCandidateCount: 0,
          fallbackActive: false,
        },
      }),
    });
  });
}

async function routeStorageDeliveryWithBrokenDisplay(page: Page) {
  await page.route("https://example.com/missing-delivery-display.jpg", async (route) => {
    await route.fulfill({ status: 404, body: "" });
  });
  await page.route("**/api/photo-storage/signed-url", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ signedUrl: null, error: "forbidden_photo" }),
    });
  });
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        photo: {
          id: `delivered-storage-${Date.now()}`,
          sourcePhotoId: "stock-storage-e2e-fake",
          src: "storage:admin-stock/sleeping/onboarding-delivered.jpg",
          displaySrc: "https://example.com/missing-delivery-display.jpg",
          thumbnailSrc: `data:image/png;base64,${testPng.toString("base64")}`,
          title: "",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: Date.now(),
        },
        source: "remote",
        diagnostics: {
          source: "remote",
          availableCount: 1,
          candidateCount: 1,
          normalCandidateCount: 1,
          fallbackCandidateCount: 0,
          fallbackActive: false,
        },
      }),
    });
  });
}

async function readKeptExchangePhotoCount(page: Page) {
  return page.evaluate(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
      );

      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
}

async function readOnboardingDeliverySnapshot(page: Page) {
  return page.evaluate(() => {
    const readArray = (key: string) => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");

        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const readObject = (key: string) => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}");

        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    };
    const ownSleepingPhotos = readArray("nyaruhodo_exchange_own_sleeping_photos");
    const keptExchangePhotos = readArray("nyaruhodo_exchange_kept_photos");
    const eveningDeliveryDays = Object.values(
      readObject("neteruneko_evening_delivery_days"),
    ) as Array<{
      deliveredPhoto?: {
        id?: string;
        sourcePhotoId?: string;
        src?: string;
      };
      deliveredAt?: number;
      openedAt?: string;
      keptAt?: string;
    }>;
    const openedDays = eveningDeliveryDays
      .filter((day) => Boolean(day.deliveredPhoto && day.openedAt))
      .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0));
    const openedDay = openedDays[0] ?? null;

    return {
      ownPhoto: ownSleepingPhotos[0] ?? null,
      keptPhoto: keptExchangePhotos[0] ?? null,
      deliveredPhoto: openedDay?.deliveredPhoto ?? null,
      openedAt: openedDay?.openedAt ?? null,
      keptAt: openedDay?.keptAt ?? null,
    };
  });
}

async function markOnboardingAlbumCreatedInBrowser(page: Page) {
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("neteruneko_onboarding_progress");
    const progress = raw ? JSON.parse(raw) : {};

    window.localStorage.setItem(
      "neteruneko_onboarding_progress",
      JSON.stringify({
        ...progress,
        stage: "album_created",
        albumCreatedAt: new Date().toISOString(),
      }),
    );
    window.localStorage.setItem("onboarding_completed", "true");
    window.sessionStorage.setItem(
      "neteruneko_onboarding_album_completion_ready",
      "true",
    );
  });
}

async function readOnboardingProgress(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("neteruneko_onboarding_progress");
    return raw ? JSON.parse(raw) : null;
  });
}

async function expectVisibleNonBlackImage(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () =>
      locator.evaluate(async (image) => {
        if (!(image instanceof HTMLImageElement)) {
          return { loaded: false, brightness: 0, colorfulPixels: 0 };
        }

        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
          return { loaded: false, brightness: 0, colorfulPixels: 0 };
        }

        try {
          await image.decode();
        } catch {
          // The image may already be decoded; continue to canvas sampling.
        }

        const canvas = document.createElement("canvas");
        const width = Math.min(32, image.naturalWidth);
        const height = Math.min(32, image.naturalHeight);
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          return { loaded: true, brightness: 0, colorfulPixels: 0 };
        }

        context.drawImage(image, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height).data;
        let brightnessSum = 0;
        let colorfulPixels = 0;
        let visiblePixels = 0;

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index] ?? 0;
          const green = data[index + 1] ?? 0;
          const blue = data[index + 2] ?? 0;
          const alpha = data[index + 3] ?? 0;

          if (alpha < 16) {
            continue;
          }

          visiblePixels += 1;
          brightnessSum += red + green + blue;
          if (Math.max(red, green, blue) - Math.min(red, green, blue) > 24) {
            colorfulPixels += 1;
          }
        }

        return {
          loaded: true,
          brightness: visiblePixels > 0 ? brightnessSum / visiblePixels : 0,
          colorfulPixels,
        };
      }),
    )
    .toEqual(
      expect.objectContaining({
        loaded: true,
        colorfulPixels: expect.any(Number),
      }),
    );

  const sample = await locator.evaluate((image) => {
    const canvas = document.createElement("canvas");
    const img = image as HTMLImageElement;
    const width = Math.min(32, img.naturalWidth);
    const height = Math.min(32, img.naturalHeight);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return { brightness: 0, colorfulPixels: 0 };
    }
    context.drawImage(img, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    let brightnessSum = 0;
    let colorfulPixels = 0;
    let visiblePixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;
      if (alpha < 16) {
        continue;
      }
      visiblePixels += 1;
      brightnessSum += red + green + blue;
      if (Math.max(red, green, blue) - Math.min(red, green, blue) > 24) {
        colorfulPixels += 1;
      }
    }

    return {
      brightness: visiblePixels > 0 ? brightnessSum / visiblePixels : 0,
      colorfulPixels,
    };
  });

  expect(sample.brightness).toBeGreaterThan(80);
  expect(sample.colorfulPixels).toBeGreaterThan(0);
}

function readSrcKind(src: unknown) {
  if (typeof src !== "string") {
    return "empty";
  }
  if (src.startsWith("data:image/")) {
    return "data";
  }
  if (src.startsWith("storage:")) {
    return "storage";
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return "http";
  }

  return "other";
}
