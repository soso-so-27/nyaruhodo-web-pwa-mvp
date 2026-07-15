import { devices, expect, test, type Locator, type Page } from "@playwright/test";

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC",
  "base64",
);

const testJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgoBAgICAgICBQMDBQoHBgcKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCv/AABEIAAIAAwMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APLPhB8HvhJ/wrPRv+LW+HP+PMf8wS39T/sV+J53nmdf2rW/2mpv/PL/ADP0Hww4j4h/1Ay7/bKv8Nf8vJ935n//2Q==",
  "base64",
);

const orientedTestJpeg = withExifOrientation(testJpeg, 6);

function withExifOrientation(jpeg: Buffer, orientation: number) {
  const app1 = Buffer.from([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
    orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);

  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

test.describe("onboarding delivery flow", () => {
  test.use({
    viewport: devices["iPhone 12 Pro"].viewport,
    userAgent: devices["iPhone 12 Pro"].userAgent,
    deviceScaleFactor: devices["iPhone 12 Pro"].deviceScaleFactor,
    isMobile: devices["iPhone 12 Pro"].isMobile,
    hasTouch: devices["iPhone 12 Pro"].hasTouch,
  });

  test("reaches the album after adding a real test candidate", async ({ page }) => {
    test.slow();
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

    const introCopy = page
      .locator("p")
      .filter({ hasText: "自分のねこの寝顔を1枚入れると、" });
    await expect(introCopy).toBeVisible();
    await expect(introCopy).toContainText("どこかのねこの寝顔が1通届きます。");
    await expect(introCopy).toContainText("入れたねがおも、確認のあと、");
    await expect(introCopy).toContainText("どこかの人への一通になります。");
    await expect(introCopy).toContainText(
      "ねてるねこの外には公開されません。",
    );
    await expect(page.getByText("外には出ません。", { exact: true })).toHaveCount(0);

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
      name: "ねこだよりを ひらく",
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
    await expect(page.getByText("とどきました")).toBeVisible();
    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
    await page.waitForTimeout(1600);
    await expectVisibleNonBlackImage(page.locator("main img").last());
    await expect(
      page.getByText("この一通は、『とどいた』にしまわれました"),
    ).toBeVisible();
    await expect(
      page.getByText("どこかのおうちから届いた一通です。"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "つづける" }),
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/onboarding-delivered-opening.png",
      fullPage: true,
    });
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
    const eveningDeliveryDays = await page.evaluate(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );

      return Object.values(parsed).filter((day) =>
        Boolean((day as { targetOwnPhotoId?: string }).targetOwnPhotoId),
      ).length;
    });
    expect(eveningDeliveryDays).toBe(0);
    await page.getByRole("button", { name: "つづける" }).click();
    await continuePastOptionalOnboardingBridge(page);
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
    expect(storage.keptExchangePhotos).toHaveLength(1);
    expect(storage.ownSleepingPhotos[0]?.captureContext).toBe("onboarding");
    expect(storage.ownSleepingPhotos[0]?.src).toMatch(/^data:image\//);
  });

  test("keeps a delivered onboarding photo in the received album", async ({
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

    await expect(page.getByRole("button", { name: "ねこだよりを ひらく" })).toBeVisible();
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(0);
    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
    await page.waitForTimeout(1600);
    await expect(
      page.getByRole("button", { name: "つづける" }),
    ).toBeVisible();
    await expect(
      page.getByText("この一通は、『とどいた』にしまわれました"),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-install-guide")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-delivered-photos").locator("img")).toHaveCount(1);
    const deliveredLayout = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>(
        '[data-testid="onboarding-delivered-photos"]',
      );
      const title = document.querySelector<HTMLElement>(
        '[data-testid="onboarding-delivered-title"]',
      );
      const button = document.querySelector<HTMLElement>(
        '[data-testid="onboarding-delivered-continue"]',
      );
      const frameRect = frame?.getBoundingClientRect();
      const titleRect = title?.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      const frameStyle = frame ? window.getComputedStyle(frame) : null;
      const photoStyle = frame?.querySelector("img")
        ? window.getComputedStyle(frame.querySelector("img")!)
        : null;

      return {
        frameWidth: frameRect?.width ?? 0,
        frameHeight: frameRect?.height ?? 0,
        frameRight: frameRect?.right ?? Number.POSITIVE_INFINITY,
        titleBottom: titleRect?.bottom ?? Number.POSITIVE_INFINITY,
        frameTop: frameRect?.top ?? Number.NEGATIVE_INFINITY,
        buttonBottom: buttonRect?.bottom ?? Number.POSITIVE_INFINITY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        paddingTop: frameStyle?.paddingTop ?? "",
        borderRadius: frameStyle?.borderRadius ?? "",
        objectFit: photoStyle?.objectFit ?? "",
      };
    });
    expect(deliveredLayout.frameWidth).toBeGreaterThanOrEqual(240);
    expect(deliveredLayout.frameHeight).toBe(deliveredLayout.frameWidth);
    expect(deliveredLayout.frameRight).toBeLessThanOrEqual(deliveredLayout.viewportWidth);
    expect(deliveredLayout.titleBottom).toBeLessThanOrEqual(
      deliveredLayout.frameTop,
    );
    expect(deliveredLayout.buttonBottom).toBeLessThanOrEqual(
      deliveredLayout.viewportHeight,
    );
    expect(deliveredLayout.paddingTop).toBe("5px");
    expect(deliveredLayout.borderRadius).toBe("12px");
    expect(deliveredLayout.objectFit).toBe("contain");
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
    await expect(page.getByRole("button", { name: "閉じる" })).toHaveCount(0);
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
  });

  test("shows a named loading state when the onboarding delivery photo is slow", async ({
    page,
  }) => {
    await routeDelayedOnboardingDelivery(page);
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "ねがおを1枚入れる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
    await expect(
      page.getByTestId("onboarding-delivery-photo-loading"),
    ).toBeVisible();
    await expect(
      page.getByTestId("onboarding-delivery-photo-loading"),
    ).toHaveCount(0, { timeout: 4000 });
    await expect(page.getByRole("button", { name: "つづける" })).toBeEnabled();
  });

  test("shows a second photo bridge before 8pm after onboarding delivery", async ({
    page,
  }) => {
    await mockBrowserDate(page, "2026-07-06T10:00:00+09:00");
    await routeImmediateDelivery(page);

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.locator("main button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await page.locator("main button").first().click();
    await page.waitForTimeout(1600);

    await expect(page.getByTestId("onboarding-second-photo-primary")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-install-guide")).toHaveCount(0);
    await page.getByTestId("onboarding-delivered-continue").click();
    await continuePastOptionalOnboardingNamePrompt(page);
    await expect(page.getByTestId("onboarding-second-photo-primary")).toBeVisible();
  });

  test("continues from onboarding through the home photo to the 8pm letter", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-07-06T10:00:00+09:00");
    const afterDelivery = Date.parse("2026-07-06T20:01:00+09:00");
    const exchangeBodies: Array<Record<string, any>> = [];
    let backupCalls = 0;

    await page.addInitScript((now) => {
      const RealDate = Date;
      (window as typeof window & { __testNow?: number }).__testNow = now;
      class AdjustableDate extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(
              (window as typeof window & { __testNow?: number }).__testNow ??
                now,
            );
            return;
          }
          if (args.length === 1) {
            super(args[0] as string | number | Date);
            return;
          }
          super(...(args as [number, number, number, number?, number?, number?, number?]));
        }
        static now() {
          return (
            (window as typeof window & { __testNow?: number }).__testNow ?? now
          );
        }
      }
      Object.setPrototypeOf(AdjustableDate, RealDate);
      // @ts-expect-error Test-only adjustable browser clock.
      window.Date = AdjustableDate;
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
    }, beforeDelivery);
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeBodies.push(route.request().postDataJSON());
      const isOnboarding = exchangeBodies.length === 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: isOnboarding ? "onboarding-chain-letter" : "evening-chain-letter",
            sourcePhotoId: isOnboarding
              ? "onboarding-chain-source"
              : "evening-chain-source",
            src: `data:image/png;base64,${testPng.toString("base64")}`,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: isOnboarding ? beforeDelivery : afterDelivery,
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
    await page.route("**/api/sleeping-delivery/backup", async (route) => {
      backupCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.locator("main button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "onboarding-chain.png",
      mimeType: "image/png",
      buffer: testPng,
    });
    await expect.poll(() => exchangeBodies.length).toBe(1);
    await page.locator("main button").first().click();
    await page.waitForTimeout(1600);
    await page.getByTestId("onboarding-delivered-continue").click();
    await continuePastOptionalOnboardingNamePrompt(page);
    await page.getByTestId("onboarding-second-photo-primary").click();

    await expect(page).toHaveURL(/\/home\?from=onboarding_second_photo/);
    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-chain.png",
      mimeType: "image/png",
      buffer: testPng,
    });
    const saveDialog = page.getByRole("dialog");
    await expect(saveDialog).toBeVisible();
    await saveDialog.locator("button").last().click();

    await expect.poll(() => backupCalls).toBe(1);
    const target = await page.evaluate(() => {
      const store = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );
      return store["2026-07-06"] ?? null;
    });
    expect(target?.targetOwnPhotoId).toBeTruthy();
    expect(target?.targetPhoto).toBeUndefined();

    await page.evaluate((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    }, afterDelivery);

    await expect.poll(() => exchangeBodies.length).toBe(2);
    expect(exchangeBodies[0]?.anonymousId).toBe(exchangeBodies[1]?.anonymousId);
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );
    await page.getByTestId("desk-open-letter").click();
    await expect(page.getByTestId("evening-opening-pair")).toBeVisible();
  });


  test("routes embedded second photo bridge through account handoff", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/14.0.0",
      });
    });
    await mockBrowserDate(page, "2026-07-06T10:00:00+09:00");
    await routeImmediateDelivery(page);

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "SafariやChromeで 開くと安心です" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.locator("main button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await page.locator("main button").first().click();
    await page.waitForTimeout(1600);
    await page.getByTestId("onboarding-delivered-continue").click();
    await continuePastOptionalOnboardingNamePrompt(page);
    await expect(page.getByTestId("onboarding-second-photo-primary")).toBeVisible();
    await page.getByTestId("onboarding-second-photo-primary").click();

    await expect(page).toHaveURL(/\/account\/create\?from=onboarding/);
    await expect(page).toHaveURL(/next=second_photo/);
  });

  test("keeps the delivered letter focused after 8pm", async ({
    page,
  }) => {
    await mockBrowserDate(page, "2026-07-06T21:00:00+09:00");
    await routeImmediateDelivery(page);

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.locator("main button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await page.locator("main button").first().click();
    await page.waitForTimeout(1600);

    await expect(
      page.getByText("この一通は、『とどいた』にしまわれました"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "つづける" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "もう一枚いれておく" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("onboarding-install-guide")).toHaveCount(0);
  });

  test("falls back to thumbnail and keeps storage-backed onboarding deliveries", async ({
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
    expect(openedSnapshot.openedAt).toBeTruthy();
    expect(openedSnapshot.keptAt).toBeTruthy();
    expect(openedSnapshot.deliveredPhoto?.id).not.toBe(openedSnapshot.ownPhoto?.id);

    await page.goto("/collection");
    await page.locator('[role="tab"]').nth(0).click();
    await expect(page.getByTestId("mainichi-board-photo-sent").first()).toBeVisible();

    await page.locator('[role="tab"]').nth(1).click();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);

    await markOnboardingAlbumCreatedInBrowser(page);
    await page.goto("/collection");
    await page.locator('[role="tab"]').nth(1).click();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);
  });

  test("keeps signed onboarding deliveries in the received album", async ({
    page,
  }) => {
    await routeStorageDeliveryWithSignedDisplay(page);

    await page.goto("/onboarding?source=line");
    await page.waitForLoadState("networkidle");
    await page.locator("main button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "sleeping-cat.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
    await expect(page.getByRole("button", { name: "つづける" })).toBeEnabled();

    const openedSnapshot = await readOnboardingDeliverySnapshot(page);
    expect(openedSnapshot.deliveredPhoto?.sourcePhotoId).toBe("stock-signed-e2e-fake");
    expect(openedSnapshot.deliveredPhoto?.src).toBe(
      "storage:admin-stock/sleeping/onboarding-delivered-signed.jpg",
    );
    const offlineCache = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem("neteruneko_exchange_photo_offline_cache") ??
          "[]",
      ),
    );
    expect(offlineCache).toEqual([
      expect.objectContaining({
        photoId: openedSnapshot.deliveredPhoto?.id,
        dataUrl: expect.stringMatching(/^data:image\//),
      }),
    ]);
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);

    await page.evaluate(() => {
      window.localStorage.setItem("analytics_anonymous_id", "anonymous-other-context");
    });
    await page.goto("/collection");
    await page.locator('[role="tab"]').nth(1).click();

    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);
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

  test("does not show the PWA home install guide inside an Android WebView", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240105.004; wv) AppleWebKit/537.36 Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
      });
    });

    await page.goto("/home");
    await expect(page.getByLabel("ホーム画面に追加")).toHaveCount(0);
  });

  test("shows the iPhone home-screen guide after daytime onboarding", async ({
    page,
  }) => {
    await mockBrowserDate(page, "2026-07-06T10:00:00+09:00");
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem("neteruneko_home_install_hint_dismissed", "true");
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
      });
    });

    await page.goto("/home");
    await expect(page.getByLabel("ホーム画面に追加")).toBeVisible();
    await page.getByRole("button", { name: "置き方を見る" }).click();

    await expect(page.getByText("iPhoneでホームに置く")).toBeVisible();
    await expect(page.getByText("「ホーム画面に追加」を選ぶ")).toBeVisible();
  });

  test("shows the Android install guide after daytime onboarding", async ({
    page,
  }) => {
    await mockBrowserDate(page, "2026-07-06T10:00:00+09:00");
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem("neteruneko_home_install_hint_dismissed", "true");
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      });
    });

    await page.goto("/home");
    await expect(page.getByLabel("ホーム画面に追加")).toBeVisible();
    await page.getByRole("button", { name: "置き方を見る" }).click();

    await expect(page.getByText("Androidでホームに置く")).toBeVisible();
    await expect(
      page.getByText("「アプリをインストール」または「ホーム画面に追加」を選ぶ"),
    ).toBeVisible();
  });

  test("keeps the first photo action inside a compact phone viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/onboarding?reset=1&source=direct");

    const action = page.getByTestId("onboarding-photo-select");
    await expect(action).toBeVisible();
    const actionBox = await action.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.y).toBeGreaterThanOrEqual(0);
    expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(568);
  });

  test("records src attribution on app open and onboarding intro", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 500,
        body: JSON.stringify({ error: "keep local analytics queue for assertions" }),
      });
    });

    await page.goto("/onboarding?src=instagram_bio");
    await expect(page.locator("main button").first()).toBeVisible();

    const events = await waitForAnalyticsEvents(page, [
      "app_opened",
      "onboarding_intro_view",
    ]);

    expect(events.app_opened?.properties).toMatchObject({
      source: "instagram_bio",
      source_param: "instagram_bio",
      src: "instagram_bio",
    });
    expect(events.onboarding_intro_view?.properties).toMatchObject({
      source: "instagram_bio",
      source_param: "instagram_bio",
      src: "instagram_bio",
    });
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

    await expect(page.getByRole("button", { name: "ねこだよりを ひらく" })).toBeVisible();
    await expect.poll(() => exchangeCalls).toBe(1);
    const submittedProgress = await readOnboardingProgress(page);
    expect(submittedProgress).toMatchObject({
      stage: "arrived",
      source: "instagram_story",
    });
    expect(submittedProgress.submissionId).toContain(submittedProgress.dateKey);

    await page.goto("/onboarding?source=instagram_dm");
    await expect(page.getByRole("button", { name: "ねこだよりを ひらく" })).toBeVisible();
    await expect.poll(() => exchangeCalls).toBe(1);
    expect(await readOnboardingProgress(page)).toMatchObject({
      stage: "arrived",
      source: "instagram_story",
      submissionId: submittedProgress.submissionId,
    });

    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
    await page.waitForTimeout(1600);
    await expect(
      page.getByText("この一通は、『とどいた』にしまわれました"),
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
    await expect(
      page.locator(
        'img[src$="/illustrations/candidates/theme-e5-direction/muted.webp"]',
      ),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "ねがおを1枚入れる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "today-own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByRole("button", { name: "ねこだよりを ひらく" })).toBeVisible();
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

    await expect(page.getByRole("button", { name: "ねこだよりを ひらく" })).toBeVisible();
    expect(await readOnboardingProgress(page)).toMatchObject({
      stage: "arrived",
      source: "unknown",
    });
  });

  test("starts onboarding from referral links for new users", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("onboarding_completed");
      window.localStorage.removeItem("neteruneko_onboarding_progress");
      window.localStorage.removeItem("neteruneko_pending_referral_code");
    });

    await page.goto("/onboarding?source=referral&ref=ABC234");
    await expect(
      page.getByRole("button", { name: "ねがおを1枚入れる" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem("neteruneko_pending_referral_code");
          const parsed = raw ? JSON.parse(raw) : null;
          return parsed?.code ?? "";
        }),
      )
      .toBe("ABC234");
  });

  test("shows an external browser guide for referral links opened in LINE", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });
      window.localStorage.removeItem("onboarding_completed");
      window.localStorage.removeItem("neteruneko_onboarding_progress");
      window.localStorage.removeItem("neteruneko_pending_referral_code");
    });

    await page.goto("/onboarding?source=referral&ref=LINE234");
    await expect(
      page.getByRole("heading", { name: "SafariやChromeで 開くと安心です" }),
    ).toBeVisible();
    await expect(page.getByText("紹介リンク")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ねがおを1枚入れる" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "このまま試す" }).click();
    await expect(
      page.getByRole("button", { name: "ねがおを1枚入れる" }),
    ).toBeVisible();
    await expect(page.getByText("アプリでつづける")).toHaveCount(0);
  });

  test("accepts a valid photo with a generic MIME type in LINE onboarding", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });
    });
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?source=instagram_dm");
    await expect(
      page.getByRole("heading", { name: "SafariやChromeで 開くと安心です" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "line-photo.jpg",
      mimeType: "application/octet-stream",
      buffer: testPng,
    });

    await expect(
      page.getByText(/写真を読み込めませんでした/),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "ねこだよりを ひらく" }),
    ).toBeVisible();
  });

  test("recovers when LINE image decoders are temporarily unavailable", async ({
    page,
  }) => {
    test.slow();
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });

      let firstDecodeAt: number | null = null;
      const shouldFailDecoder = () => {
        firstDecodeAt ??= performance.now();
        return performance.now() - firstDecodeAt < 360;
      };
      const originalCreateImageBitmap = window.createImageBitmap.bind(window);
      window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) =>
        shouldFailDecoder()
          ? Promise.reject(new DOMException("decoder warming up"))
          : originalCreateImageBitmap(...args)) as typeof createImageBitmap;
      const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = ((blob: Blob | MediaSource) =>
        shouldFailDecoder()
          ? "data:text/plain;base64,bm90LWFuLWltYWdl"
          : originalCreateObjectUrl(blob)) as typeof URL.createObjectURL;
      const originalReadAsDataUrl = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function readAsDataURL(blob: Blob) {
        return originalReadAsDataUrl.call(
          this,
          shouldFailDecoder()
            ? new Blob(["not-an-image"], { type: "text/plain" })
            : blob,
        );
      };
    });
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?source=instagram_dm");
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "line-transient-photo.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByText(/写真を読み込めませんでした/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "ねこだよりを ひらく" }),
    ).toBeVisible();
  });

  test("accepts a LINE JPEG when every browser image decoder fails", async ({
    page,
  }) => {
    test.slow();
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });

      window.createImageBitmap = (() =>
        Promise.reject(new DOMException("native decoder unavailable"))) as typeof createImageBitmap;
      URL.createObjectURL = (() =>
        "data:text/plain;base64,bm90LWFuLWltYWdl") as typeof URL.createObjectURL;
      const originalReadAsDataUrl = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function readAsDataURL() {
        return originalReadAsDataUrl.call(
          this,
          new Blob(["not-an-image"], { type: "text/plain" }),
        );
      };
    });
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?source=instagram_dm");
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "line-native-decoder-fallback.jpg",
      mimeType: "image/jpeg",
      buffer: orientedTestJpeg,
    });

    await expect(page.getByText(/写真を読み込めませんでした/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "ねこだよりを ひらく" }),
    ).toBeVisible();
    const savedDimensions = await page.evaluate(async () => {
      const photos = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ?? "[]",
      ) as Array<{ src?: string }>;
      const src = photos[0]?.src;
      if (!src?.startsWith("data:image/")) {
        return null;
      }

      return new Promise<{ width: number; height: number } | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        image.onerror = () => resolve(null);
        image.src = src;
      });
    });
    expect(savedDimensions).toEqual({ width: 2, height: 3 });
  });

  test("retries delivery with the already saved onboarding photo", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    let capabilityCalls = 0;
    await page.route("**/api/admin/capabilities", async (route) => {
      capabilityCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isAdmin: true,
          testToolsEnabled: true,
          stockAdminEnabled: false,
        }),
      });
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      if (exchangeCalls === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "temporarily_unavailable" }),
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "delivered-after-retry",
            sourcePhotoId: "stock-after-retry",
            src: `data:image/png;base64,${testPng.toString("base64")}`,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.now(),
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/onboarding?test");
    await expect.poll(() => capabilityCalls).toBeGreaterThan(0);
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByTestId("onboarding-delivery-retry")).toBeVisible();
    await expect.poll(() => readOwnSleepingPhotoCount(page)).toBe(1);
    await page.getByTestId("onboarding-delivery-retry").click();

    await expect.poll(() => exchangeCalls).toBe(2);
    await expect(
      page.getByRole("button", { name: "ねこだよりを ひらく" }),
    ).toBeVisible();
    await expect.poll(() => readOwnSleepingPhotoCount(page)).toBe(1);
  });

  test("returns to photo selection after an unsupported onboarding file", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "not-a-photo.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a photo", "utf8"),
    });

    await expect(
      page.getByText(
        "写真を読み込めませんでした。JPEGやPNGなどの写真で、もう一度試してください。",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-photo-select")).toBeVisible();
  });

  test("rejects a renamed non-image after the decoder check", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "not-really-a-photo.jpg",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a photo", "utf8"),
    });

    await expect(
      page.getByText(
        "写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください。",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-photo-select")).toBeVisible();
  });

  test("offers a retry when the delivered onboarding photo cannot load", async ({
    page,
  }) => {
    let imageAvailable = false;
    let imageRequests = 0;
    await page.route("https://example.com/onboarding-delivery.jpg", async (route) => {
      imageRequests += 1;
      if (!imageAvailable) {
        await route.fulfill({ status: 404, body: "" });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { "content-type": "image/png" },
        body: testPng,
      });
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "delivered-broken-image",
            sourcePhotoId: "stock-broken-image",
            src: "https://example.com/onboarding-delivery.jpg",
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.now(),
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/onboarding");
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });
    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();

    await expect(page.getByTestId("onboarding-delivery-photo-error")).toBeVisible();
    imageAvailable = true;
    await page.getByTestId("onboarding-delivery-photo-retry").click();
    await expect(page.getByTestId("onboarding-delivery-photo-error")).toHaveCount(0);
    await expect.poll(() => imageRequests).toBeGreaterThan(1);
    await expect
      .poll(() =>
        page.getByTestId("onboarding-delivered-photos").evaluate((container) =>
          Array.from(container.querySelectorAll("img")).some(
            (image) => image.complete && image.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
  });

  test("offers a fresh start when an onboarding handoff has expired", async ({
    page,
  }) => {
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      await route.fulfill({
        status: 410,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "handoff_expired" }),
      });
    });

    await page.goto("/onboarding/continue?handoff=expired-token");
    await page
      .getByRole("button", { name: "ねがおを戻して ホームへ" })
      .click();

    await expect(
      page.getByRole("heading", { name: "つづきを戻せませんでした" }),
    ).toBeVisible();
    await expect(page.getByText(/期限が切れました/)).toBeVisible();
    await expect(page.getByTestId("onboarding-handoff-restart")).toHaveAttribute(
      "href",
      "/onboarding?reset_onboarding=1",
    );
    await expect(
      page.getByRole("button", { name: "もう一度ためす" }),
    ).toHaveCount(0);
  });

  test("does not offer an empty continuation URL when the handoff token is missing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });
    });

    await page.goto("/onboarding/continue");

    await expect(
      page.getByRole("heading", { name: "つづきを戻せませんでした" }),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-handoff-restart")).toBeVisible();
    await expect(page.getByRole("button", { name: "URLをコピー" })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("onboarding-handoff-primary")).toHaveCount(0);
    const restartBox = await page
      .getByTestId("onboarding-handoff-restart")
      .boundingBox();
    expect(restartBox).not.toBeNull();
    expect((restartBox?.y ?? 0) + (restartBox?.height ?? 0)).toBeLessThanOrEqual(
      568,
    );
  });

  test("keeps retry and fresh-start choices after a temporary handoff failure", async ({
    page,
  }) => {
    let redeemCalls = 0;
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      redeemCalls += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "handoff_redeem_failed" }),
      });
    });

    await page.goto("/onboarding/continue?handoff=temporary-failure-token");
    await page
      .getByRole("button", { name: "ねがおを戻して ホームへ" })
      .click();

    await expect(page.getByText(/通信を確認してもう一度/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "もう一度ためす" }),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-handoff-restart")).toBeVisible();

    await page.getByRole("button", { name: "もう一度ためす" }).click();
    await expect.poll(() => redeemCalls).toBe(2);
  });

  test("keeps both recovery choices after a Google callback failure", async ({
    page,
  }) => {
    await page.goto("/account/create?from=onboarding&source=direct&error=auth");

    await expect(
      page.getByText("Googleログインを完了できませんでした。少し時間をおいてもう一度お試しください。"),
    ).toBeVisible();
    await expect(page.getByTestId("account-create-google")).toBeVisible();
    await expect(page.getByTestId("account-create-handoff")).toBeVisible();
  });

  test("shows an external browser guide for Instagram bio links opened in an embedded browser", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 385.0.0.25.75",
      });
      window.localStorage.removeItem("onboarding_completed");
      window.localStorage.removeItem("neteruneko_onboarding_progress");
      window.localStorage.removeItem("neteruneko_pending_referral_code");
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => undefined },
      });
    });

    await page.goto("/onboarding?source=instagram_bio");
    await expect(
      page.getByRole("heading", { name: "SafariやChromeで 開くと安心です" }),
    ).toBeVisible();
    await expect(page.getByText("アプリ内ブラウザ")).toBeVisible();
    await expect(
      page.locator(
        'img[src$="/illustrations/candidates/theme-e5-direction/muted.webp"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "ねがおを1枚入れる" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "URLをコピーする" }).click();
    await expect(
      page.getByText(
        "コピーしました。SafariやChromeを開き、アドレス欄に貼り付けてください。",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "このまま試す" }),
    ).toBeVisible();
  });

  test("resets local onboarding test data from an explicit reset link", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await page.evaluate(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "anonymous-reset-e2e",
          dateKey: "2026-07-04",
          stage: "opened",
          source: "referral",
          submissionId: "onboarding:anonymous-reset-e2e:2026-07-04",
          updatedAt: Date.now(),
        }),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          { id: "onboarding-old", catId: "cat-old", src: "data:image/png;base64,AA==" },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify([{ id: "kept-old", src: "data:image/png;base64,AA==" }]),
      );
      window.localStorage.setItem("cat_profiles", JSON.stringify([{ id: "cat-old" }]));
      window.localStorage.setItem("active_cat_id", "cat-old");
      window.localStorage.setItem("analytics_anonymous_id", "anonymous-reset-e2e");
      window.localStorage.setItem(
        "record_log_cat-old",
        JSON.stringify([{ id: "log-old" }]),
      );
      window.sessionStorage.setItem(
        "neteruneko_onboarding_album_completion_ready",
        "true",
      );
    });

    await page.goto("/onboarding?ref=ABC234&reset_onboarding=1");
    await expect(
      page.getByText("テスト用に、この端末のオンボーディング状態をリセットしました。"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\?ref=ABC234$/);

    const storage = await page.evaluate(() => ({
      completed: window.localStorage.getItem("onboarding_completed"),
      progress: window.localStorage.getItem("neteruneko_onboarding_progress"),
      ownPhotos: window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos"),
      keptPhotos: window.localStorage.getItem("nyaruhodo_exchange_kept_photos"),
      profiles: window.localStorage.getItem("cat_profiles"),
      activeCatId: window.localStorage.getItem("active_cat_id"),
      anonymousId: window.localStorage.getItem("analytics_anonymous_id"),
      recordLog: window.localStorage.getItem("record_log_cat-old"),
      pendingReferral: window.localStorage.getItem("neteruneko_pending_referral_code"),
      sessionReady: window.sessionStorage.getItem(
        "neteruneko_onboarding_album_completion_ready",
      ),
    }));

    expect(storage.completed).toBeNull();
    expect(storage.progress).toBeNull();
    expect(storage.ownPhotos).toBeNull();
    expect(storage.keptPhotos).toBeNull();
    expect(storage.profiles).toBeNull();
    expect(storage.activeCatId).toBeNull();
    expect(storage.anonymousId).toBeTruthy();
    expect(storage.anonymousId).not.toBe("anonymous-reset-e2e");
    expect(storage.recordLog).toBeNull();
    expect(storage.sessionReady).toBeNull();
    expect(storage.pendingReferral).toContain("ABC234");
  });

  test("hands off only the current onboarding photos", async ({ page }) => {
    const imageDataUrl = `data:image/png;base64,${testPng.toString("base64")}`;
    const capturedCreateBodies: Array<{
      payload?: {
        onboardingProgress?: { ownPhoto?: { id?: string }; deliveredPhoto?: { id?: string } };
        source?: string;
        catProfiles?: Array<{ id?: string }>;
        activeCatId?: string | null;
        ownSleepingPhotos?: Array<{ id?: string }>;
        keptExchangePhotos?: Array<{ id?: string; sourcePhotoId?: string }>;
        pendingReferralCode?: string | null;
      };
    }> = [];

    await page.addInitScript(({ imageDataUrl }) => {
      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const currentOwnPhoto = {
        id: "onboarding-current-own",
        catId: "cat-current",
        ownerCatId: "cat-current",
        src: imageDataUrl,
        thumbnailSrc: imageDataUrl,
        displaySrc: imageDataUrl,
        originalSrc: imageDataUrl,
        state: "sleeping",
        visibility: "shared",
        deliveryStatus: "available",
        triggerLabel: "sleeping",
        theme: "sleeping",
        shared: true,
        createdAt: Date.now(),
        captureContext: "onboarding",
      };
      const currentDeliveredPhoto = {
        id: "onboarding-current-delivered",
        sourcePhotoId: "source-current-delivered",
        src: imageDataUrl,
        thumbnailSrc: imageDataUrl,
        displaySrc: imageDataUrl,
        originalSrc: imageDataUrl,
        title: "",
        subtitle: "",
        triggerLabel: "sleeping",
        theme: "sleeping",
        deliveredAt: Date.now(),
      };

      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "anonymous-handoff-current",
          dateKey,
          stage: "opened",
          source: "referral",
          submissionId: `onboarding:anonymous-handoff-current:${dateKey}`,
          ownPhoto: currentOwnPhoto,
          selectedPhotoSrc: imageDataUrl,
          deliveredPhoto: currentDeliveredPhoto,
          isDeliveredPhotoKept: true,
          updatedAt: Date.now(),
        }),
      );
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          { id: "cat-current", name: "current" },
          { id: "cat-old", name: "old" },
        ]),
      );
      window.localStorage.setItem("active_cat_id", "cat-current");
      window.localStorage.setItem(
        "neteruneko_pending_referral_code",
        JSON.stringify({ code: "LINE234", capturedAt: new Date().toISOString() }),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          currentOwnPhoto,
          {
            ...currentOwnPhoto,
            id: "old-own-photo",
            catId: "cat-old",
            ownerCatId: "cat-old",
            captureContext: "daily",
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify([
          {
            ...currentDeliveredPhoto,
            id: "kept-current-copy",
          },
          {
            ...currentDeliveredPhoto,
            id: "old-kept-photo",
            sourcePhotoId: "old-source-photo",
          },
        ]),
      );
    }, { imageDataUrl });
    await page.route("**/api/onboarding/handoff/create", async (route) => {
      capturedCreateBodies.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          token: "onb_00000000-0000-4000-8000-000000000000_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          continueUrl:
            "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      });
    });

    await page.goto("/account/create?from=onboarding&source=referral");
    const handoffButton = page.locator("main button").nth(1);
    await expect(handoffButton).toBeVisible();
    await expect(handoffButton).toBeEnabled();
    await handoffButton.click();

    await expect.poll(() => capturedCreateBodies.length).toBe(1);
    const capturedPayload = capturedCreateBodies[0]?.payload;

    expect(capturedPayload?.ownSleepingPhotos).toHaveLength(1);
    expect(capturedPayload?.keptExchangePhotos).toHaveLength(0);
    expect(capturedPayload?.catProfiles).toHaveLength(1);
    expect(capturedPayload?.catProfiles?.[0]?.id).toBe("cat-current");
    expect(capturedPayload?.activeCatId).toBe("cat-current");
    expect(capturedPayload?.pendingReferralCode).toContain("LINE234");
    expect(capturedPayload?.ownSleepingPhotos?.[0]?.id).toBe("onboarding-current-own");
    expect(
      capturedPayload?.ownSleepingPhotos?.some(
        (photo) => photo.id === "old-own-photo",
      ),
    ).toBe(false);
    expect(
      capturedPayload?.keptExchangePhotos?.some(
        (photo) => photo.id === "old-kept-photo",
      ),
    ).toBe(false);
    expect(
      capturedPayload?.catProfiles?.some((profile) => profile.id === "cat-old"),
    ).toBe(false);
  });

  test("does not hand off stale referral codes outside referral onboarding", async ({
    page,
  }) => {
    const imageDataUrl = `data:image/png;base64,${testPng.toString("base64")}`;
    const capturedCreateBodies: Array<{
      payload?: {
        pendingReferralCode?: string | null;
      };
    }> = [];

    await page.addInitScript(({ imageDataUrl }) => {
      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const currentOwnPhoto = {
        id: "direct-current-own",
        catId: "cat-current",
        ownerCatId: "cat-current",
        src: imageDataUrl,
        thumbnailSrc: imageDataUrl,
        displaySrc: imageDataUrl,
        originalSrc: imageDataUrl,
        state: "sleeping",
        visibility: "shared",
        deliveryStatus: "available",
        triggerLabel: "sleeping",
        theme: "sleeping",
        shared: true,
        createdAt: Date.now(),
        captureContext: "onboarding",
      };

      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "anonymous-direct-handoff",
          dateKey,
          stage: "opened",
          source: "direct",
          submissionId: `onboarding:anonymous-direct-handoff:${dateKey}`,
          ownPhoto: currentOwnPhoto,
          selectedPhotoSrc: imageDataUrl,
          deliveredPhoto: null,
          isDeliveredPhotoKept: false,
          updatedAt: Date.now(),
        }),
      );
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([{ id: "cat-current", name: "current" }]),
      );
      window.localStorage.setItem("active_cat_id", "cat-current");
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([currentOwnPhoto]),
      );
      window.localStorage.setItem(
        "neteruneko_pending_referral_code",
        JSON.stringify({ code: "STALE234", capturedAt: new Date().toISOString() }),
      );
    }, { imageDataUrl });

    await page.route("**/api/onboarding/handoff/create", async (route) => {
      capturedCreateBodies.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          token: "onb_00000000-0000-4000-8000-000000000000_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          continueUrl:
            "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        }),
      });
    });

    await page.goto("/account/create?from=onboarding&source=direct");
    const handoffButton = page.locator("main button").nth(1);
    await expect(handoffButton).toBeVisible();
    await expect(handoffButton).toBeEnabled();
    await handoffButton.click();

    await expect.poll(() => capturedCreateBodies.length).toBe(1);
    expect(capturedCreateBodies[0]?.payload?.pendingReferralCode).toBeNull();
  });

  test("does not consume handoff links inside embedded browsers", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });
    });

    await page.goto(
      "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_0123456789abcdef0123456789abcdef0123",
    );
    await expect(
      page.getByRole("heading", { name: "ホーム画面アプリで つづけます" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "URLをコピー" })).toBeVisible();
    await expect(page.getByRole("button", { name: "このまま復元する" })).toHaveCount(0);
  });

  test("does not auto consume handoff links in normal browsers", async ({
    page,
  }) => {
    let redeemCalls = 0;
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      redeemCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({ ok: false, error: "handoff_already_used" }),
      });
    });

    await page.goto(
      "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_0123456789abcdef0123",
    );
    await page.waitForTimeout(500);

    expect(redeemCalls).toBe(0);

    await page.locator("main button").first().click();
    await expect.poll(() => redeemCalls).toBe(1);
  });

  test("restores handoff data and goes home after a manual click", async ({
    page,
  }) => {
    let redeemCalls = 0;
    const imageDataUrl = `data:image/png;base64,${testPng.toString("base64")}`;
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      redeemCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          payload: {
            version: 1,
            createdAt: new Date().toISOString(),
            source: "referral",
            onboardingProgress: null,
            onboardingCompleted: true,
            catProfiles: [
              {
                id: "handoff-cat",
                name: "むぎ",
                createdAt: new Date().toISOString(),
              },
            ],
            activeCatId: "handoff-cat",
            ownSleepingPhotos: [
              {
                id: "handoff-own-photo",
                catId: "handoff-cat",
                ownerCatId: "handoff-cat",
                src: imageDataUrl,
                thumbnailSrc: imageDataUrl,
                displaySrc: imageDataUrl,
                originalSrc: imageDataUrl,
                state: "sleeping",
                visibility: "shared",
                deliveryStatus: "available",
                triggerLabel: "sleeping",
                theme: "sleeping",
                shared: true,
                createdAt: Date.now(),
                captureContext: "onboarding",
              },
            ],
            keptExchangePhotos: [],
            pendingReferralCode: "LINE234",
          },
        }),
      });
    });

    await page.goto(
      "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_0123456789abcdef0123",
    );
    await page.evaluate(({ imageDataUrl }) => {
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "stale-target-own",
            catId: "stale-target-cat",
            ownerCatId: "stale-target-cat",
            src: imageDataUrl,
            state: "sleeping",
            visibility: "shared",
            deliveryStatus: "available",
            createdAt: Date.now() - 10_000,
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify([
          {
            id: "stale-target-kept",
            sourcePhotoId: "stale-target-source",
            src: imageDataUrl,
            title: "stale",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.now() - 10_000,
          },
        ]),
      );
    }, { imageDataUrl });
    await page.locator("main button").first().click();

    await expect.poll(() => redeemCalls).toBe(1);
    await expect(page).toHaveURL(/\/home\?handoff=restored/);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          activeCatId: window.localStorage.getItem("active_cat_id"),
          completed: window.localStorage.getItem("onboarding_completed"),
          profiles: window.localStorage.getItem("cat_profiles"),
          ownPhotos: window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos"),
          keptPhotos: window.localStorage.getItem("nyaruhodo_exchange_kept_photos"),
        })),
      )
      .toMatchObject({
        activeCatId: "handoff-cat",
        completed: "true",
      });
    const ownPhotos = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ?? "[]"),
    );
    const keptPhotos = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]"),
    );
    expect(ownPhotos).toHaveLength(1);
    expect(ownPhotos[0]?.src).toMatch(/^data:image\//);
    expect(ownPhotos.some((photo: { id?: string }) => photo.id === "stale-target-own")).toBe(
      false,
    );
    expect(keptPhotos).toHaveLength(0);
  });

  test("keeps the second-photo intent for account handoffs without an explicit next", async ({
    page,
  }) => {
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          payload: {
            version: 1,
            createdAt: new Date().toISOString(),
            source: "instagram_bio",
            onboardingProgress: null,
            onboardingCompleted: true,
            catProfiles: [{ id: "account-handoff-cat", name: "むぎ" }],
            activeCatId: "account-handoff-cat",
            ownSleepingPhotos: [],
            keptExchangePhotos: [],
            pendingReferralCode: null,
          },
        }),
      });
    });

    await page.goto(
      "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_0123456789abcdef0123&handoff_from=account",
    );
    await page.locator("main button").first().click();

    await expect(page).toHaveURL(
      /\/home\?handoff=restored&from=onboarding_second_photo/,
    );
    await expect(page.getByTestId("home-empty-action")).toBeVisible();
  });

  test("migrates a historical onboarding delivery into the received album", async ({
    page,
  }) => {
    const imageDataUrl = `data:image/png;base64,${testPng.toString("base64")}`;

    await page.addInitScript(({ imageDataUrl }) => {
      const now = Date.now();
      const dateKey = "2026-06-01";

      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem("active_cat_id", "onboarding-visible-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([{ id: "onboarding-visible-cat", name: "visible" }]),
      );
      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "onboarding-visible-anon",
          dateKey,
          stage: "album_created",
          source: "referral",
          submissionId: `onboarding:onboarding-visible-anon:${dateKey}`,
          deliveredPhoto: {
            id: "onboarding-visible-delivered",
            sourcePhotoId: "onboarding-visible-source",
            src: imageDataUrl,
            thumbnailSrc: imageDataUrl,
            displaySrc: imageDataUrl,
            originalSrc: imageDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: now,
          },
          isDeliveredPhotoKept: true,
          updatedAt: now,
        }),
      );
      window.localStorage.setItem("nyaruhodo_exchange_kept_photos", "[]");
    }, { imageDataUrl });

    await page.goto("/collection");
    await page.getByRole("tab", { name: "とどいた" }).click();

    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);
    const keptPhotos = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]"),
    );
    expect(keptPhotos).toHaveLength(1);
  });

  test("lets locally restored users go home when a handoff token is already used", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem("active_cat_id", "restored-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([{ id: "restored-cat", name: "むぎ" }]),
      );
    });
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({ ok: false, error: "handoff_already_used" }),
      });
    });

    await page.goto(
      "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_0123456789abcdef0123",
    );
    await page.locator("main button").first().click();

    await expect(
      page.getByText("この端末には、つづきが復元されています。ホームへ進めます。"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "ホームへ" })).toBeVisible();
  });

  test("does not treat an empty local cat list as a restored handoff", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem("cat_profiles", "[]");
    });
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({ ok: false, error: "handoff_already_used" }),
      });
    });

    await page.goto(
      "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_0123456789abcdef0123",
    );
    await page.locator("main button").first().click();

    await expect(
      page.getByText("このつづきのリンクは使用済みです。"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "つづきを戻せませんでした" }),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-handoff-restart")).toBeVisible();
    await expect(page.getByTestId("onboarding-handoff-primary")).toHaveCount(0);
    await expect(page).toHaveURL(/\/onboarding\/continue/);
  });

  test("does not keep referral links for users who already completed onboarding", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "completed-own-photo",
            ownerCatId: "completed-cat",
            catId: "completed-cat",
            src: "storage:completed-cat/sleeping/completed-own-photo.webp",
            state: "sleeping",
            visibility: "shared",
            deliveryStatus: "available",
            triggerLabel: "ねがお",
            theme: "sleeping",
            shared: true,
            createdAt: Date.now(),
          },
        ]),
      );
      window.localStorage.setItem(
        "neteruneko_pending_referral_code",
        JSON.stringify({ code: "OLD234", capturedAt: new Date().toISOString() }),
      );
    });

    await page.goto("/onboarding?source=referral&ref=ABC234");
    await expect(page).toHaveURL(/\/home/);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("neteruneko_pending_referral_code"),
        ),
      )
      .toBeNull();
  });

  test("clears stale onboarding completion flags without evidence", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.removeItem("neteruneko_onboarding_progress");
      window.localStorage.removeItem("nyaruhodo_exchange_own_sleeping_photos");
      window.localStorage.removeItem("neteruneko_pending_referral_code");
    });

    await page.goto("/onboarding?source=referral&ref=STALE1");
    await expect(page.locator("main button")).toHaveCount(1);
    await expect(page.locator("main button").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem("onboarding_completed")),
      )
      .toBeNull();
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

  test("recovers an unnamed default cat before showing the regular cats tabs", async ({
    page,
  }) => {
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-direct-empty",
      name: "ミケ",
    });

    await page.goto("/cats");

    await expect(
      page.getByRole("heading", { name: "この子の名前は？" }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await page.getByLabel("この子の名前").fill("ミケ");
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page.getByRole("radio", { name: "記録" })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "この子の名前は？" }),
    ).toHaveCount(0);
  });

  test("treats the default cat name with profile details as an existing cat", async ({
    page,
  }) => {
    await seedOnboardingAlbumCompletionReady(page);
    await seedCatProfileBeforeLoad(page, {
      id: "local-cat-default-with-details",
      name: "ミケ",
      coverPhotoDataUrl: `data:image/png;base64,${testPng.toString("base64")}`,
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
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByTestId("cats-tab-scroll")).toHaveCount(0);
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
  coverPhotoDataUrl?: string;
}) {
  await page.addInitScript((profileInput) => {
    if (window.localStorage.getItem("cat_profiles")) {
      return;
    }

    const now = new Date().toISOString();

    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: profileInput.id,
          name: profileInput.name,
          createdAt: now,
          updatedAt: now,
          ...(profileInput.coverPhotoDataUrl
            ? { coverPhotoDataUrl: profileInput.coverPhotoDataUrl }
            : {}),
        },
      ]),
    );
    window.localStorage.setItem("active_cat_id", profileInput.id);
  }, input);
}

async function continuePastOptionalOnboardingBridge(page: Page) {
  await continuePastOptionalOnboardingNamePrompt(page);

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (/\/account\/create\?from=onboarding/.test(page.url())) {
      break;
    }

    const buttons = page.locator("main button");
    const buttonCount = await buttons.count();
    const lastButton = buttons.last();
    const lastButtonText =
      buttonCount > 0 ? (await lastButton.textContent())?.trim() ?? "" : "";

    if (
      buttonCount >= 2 &&
      lastButtonText &&
      !lastButtonText.includes("つづける") &&
      !lastButtonText.includes("名前なしで進む")
    ) {
      await lastButton.click();
      break;
    }

    await page.waitForTimeout(250);
  }

  await continuePastOptionalOnboardingNamePrompt(page);
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

async function routeDelayedOnboardingDelivery(page: Page) {
  await page.route("https://example.com/delayed-onboarding-delivery.png", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "image/png",
      },
      body: testPng,
    });
  });
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        photo: {
          id: `delivered-delayed-${Date.now()}`,
          sourcePhotoId: "stock-delayed-e2e-fake",
          src: "https://example.com/delayed-onboarding-delivery.png",
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

async function mockBrowserDate(page: Page, isoDate: string) {
  await page.addInitScript((fixedIso) => {
    const fixedTime = new Date(fixedIso).valueOf();
    const RealDate = Date;

    class MockDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fixedTime);
          return;
        }

        if (args.length === 1) {
          super(args[0] as string | number | Date);
          return;
        }

        super(...(args as [number, number, number, number?, number?, number?, number?]));
      }

      static now() {
        return fixedTime;
      }
    }

    Object.setPrototypeOf(MockDate, RealDate);
    // @ts-expect-error Test-only Date replacement in the browser context.
    window.Date = MockDate;
  }, isoDate);
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

async function routeStorageDeliveryWithSignedDisplay(page: Page) {
  await page.route("https://example.com/signed-delivery-display.jpg", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "image/png",
      },
      body: testPng,
    });
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
          id: `delivered-signed-${Date.now()}`,
          sourcePhotoId: "stock-signed-e2e-fake",
          src: "storage:admin-stock/sleeping/onboarding-delivered-signed.jpg",
          displaySrc: "https://example.com/signed-delivery-display.jpg",
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

async function readOwnSleepingPhotoCount(page: Page) {
  return page.evaluate(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
          "[]",
      );

      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
}

async function waitForAnalyticsEvents(page: Page, names: string[]) {
  const readEvents = () =>
    page.evaluate((eventNames) => {
      const raw = window.localStorage.getItem("analytics_event_queue");
      const queue = raw ? JSON.parse(raw) : [];
      const result: Record<string, { properties?: Record<string, unknown> }> = {};

      for (const name of eventNames) {
        const match = [...queue]
          .reverse()
          .find((event) => event?.name === name);
        if (match) {
          result[name] = { properties: match.properties ?? {} };
        }
      }

      return result;
    }, names);

  await expect
    .poll(async () => Object.keys(await readEvents()).length)
    .toBe(names.length);

  return readEvents();
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
    const progress = readObject("neteruneko_onboarding_progress") as {
      deliveredPhoto?: {
        id?: string;
        sourcePhotoId?: string;
        src?: string;
      };
      stage?: string;
      isDeliveredPhotoKept?: boolean;
    };

    return {
      ownPhoto: ownSleepingPhotos[0] ?? null,
      keptPhoto: keptExchangePhotos[0] ?? null,
      deliveredPhoto: progress.deliveredPhoto ?? null,
      openedAt: progress.stage === "opened" ? "opened" : null,
      keptAt: progress.isDeliveredPhotoKept ? "kept" : null,
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
