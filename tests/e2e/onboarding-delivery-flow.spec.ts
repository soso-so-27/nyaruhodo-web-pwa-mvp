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
    await expect(page.locator("button").first()).toBeEnabled();

    await page.locator("button").first().click();
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
    await expectVisibleNonBlackImage(page.locator("main img").last());
    await expect(
      page.getByRole("button", { name: "アルバムで見る" }),
    ).toBeVisible();
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(0);
    await page.getByRole("button", { name: "アルバムで見る" }).click();
    await expect(page).toHaveURL(/\/collection/);

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

    await expectVisibleNonBlackImage(page.locator("main img").first());
    await page.getByRole("tab").nth(1).click();
    await expectVisibleNonBlackImage(page.locator("main img").first());
  });

  test("does not keep a delivered photo before the explicit keep action", async ({
    page,
  }) => {
    await routeImmediateDelivery(page);

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "ねてるねこを入れる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(
      page.getByRole("button", { name: "この2枚をとっておく" }),
    ).toBeVisible();
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(0);

    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(0);
  });

  test("skips the name entry for an existing named cat", async ({ page }) => {
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-existing",
      name: "むぎ",
    });

    await page.goto("/cats?onboarding=1");

    await expect(page.getByText("アルバムに入りました")).toBeVisible();
    await expect(page.getByText("また寝ていたら、ここへ。")).toBeVisible();
    await expect(page.getByText("このねこの名前は？")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "アルバムをつくる" })).toHaveCount(0);
  });

  test("treats the default cat name with profile details as an existing cat", async ({
    page,
  }) => {
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
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-default-empty",
      name: "ミケ",
    });

    await page.goto("/cats?onboarding=1");

    await page.getByLabel("この子の名前").fill("こむぎ");
    await page.getByRole("button", { name: "アルバムをつくる" }).click();

    await expect(page.getByText("アルバムができました")).toBeVisible();
    await expect(page.getByText("また寝ていたら、ここへ。")).toBeVisible();
    await expect(page.getByRole("link", { name: "ホームへ" })).toBeVisible();
    await expect(page.getByText("このねこの名前は？")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "アルバムをつくる" })).toHaveCount(0);
  });

  test("asks for a name when the cat name is empty", async ({ page }) => {
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-empty-name",
      name: "",
    });

    await page.goto("/cats?onboarding=1");

    await expect(page.getByText("このねこの名前は？")).toBeVisible();
    await expect(page.getByRole("button", { name: "アルバムをつくる" })).toBeVisible();
  });
});

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
