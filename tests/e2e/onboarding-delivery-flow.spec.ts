import { devices, expect, test, type Locator, type Page } from "@playwright/test";
import { encode } from "jpeg-js";

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC",
  "base64",
);

const testJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgoBAgICAgICBQMDBQoHBgcKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCv/AABEIAAIAAwMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APLPhB8HvhJ/wrPRv+LW+HP+PMf8wS39T/sV+J53nmdf2rW/2mpv/PL/ADP0Hww4j4h/1Ay7/bKv8Nf8vJ935n//2Q==",
  "base64",
);

const orientedTestJpeg = withExifOrientation(testJpeg, 6);
const wideTestJpegPixels = Buffer.alloc(1601 * 4, 180);
for (let offset = 3; offset < wideTestJpegPixels.length; offset += 4) {
  wideTestJpegPixels[offset] = 255;
}
const wideTestJpeg = encode(
  { data: wideTestJpegPixels, width: 1601, height: 1 },
  80,
).data;
const landscapeTestJpegPixels = Buffer.alloc(240 * 160 * 4, 180);
for (let offset = 3; offset < landscapeTestJpegPixels.length; offset += 4) {
  landscapeTestJpegPixels[offset] = 255;
}
const landscapeTestJpeg = encode(
  { data: landscapeTestJpegPixels, width: 240, height: 160 },
  80,
).data;
const landscapeDeliveryDataUrl = `data:image/jpeg;base64,${landscapeTestJpeg.toString(
  "base64",
)}`;
const colorfulTestJpegPixels = Buffer.alloc(32 * 32 * 4);
for (let offset = 0; offset < colorfulTestJpegPixels.length; offset += 4) {
  const pixel = offset / 4;
  const x = pixel % 32;
  const y = Math.floor(pixel / 32);
  colorfulTestJpegPixels[offset] = 80 + x * 5;
  colorfulTestJpegPixels[offset + 1] = 70 + y * 5;
  colorfulTestJpegPixels[offset + 2] = 210 - x * 3;
  colorfulTestJpegPixels[offset + 3] = 255;
}
const colorfulTestJpeg = encode(
  { data: colorfulTestJpegPixels, width: 32, height: 32 },
  90,
).data;
const colorfulDeliveryDataUrl = `data:image/jpeg;base64,${colorfulTestJpeg.toString(
  "base64",
)}`;
const portraitDeliveryDataUrl = `data:image/jpeg;base64,${orientedTestJpeg.toString(
  "base64",
)}`;

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
    const originalQueueWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("[photo-originals]")) {
        originalQueueWarnings.push(message.text());
      }
    });
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
            src: colorfulDeliveryDataUrl,
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
            src: colorfulDeliveryDataUrl,
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

    const introCopy = page.getByTestId("onboarding-exchange-explanation");
    await expect(introCopy).toBeVisible();
    await expect(introCopy).toContainText("入れたねがおも、確認のあと、");
    await expect(introCopy).toContainText("どこかのおうちへ届きます。");
    await expect(page.getByTestId("onboarding-privacy-note")).toHaveText(
      "ねてるねこの外には公開されません",
    );
    await expect(
      page.getByText("自分のねこのねがおを1枚入れると、", { exact: true }),
    ).toHaveCount(0);
    await expectUsesUiTypography(
      page.locator('[data-onboarding-title="true"]'),
      "500",
    );
    await expect(page.getByText("外には出ません。", { exact: true })).toHaveCount(0);

    await page.locator("button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    const originalQueueEvents = await waitForAnalyticsEvents(page, [
      "photo_original_queued",
    ]);
    expect(originalQueueWarnings).toEqual([]);
    expect(originalQueueEvents.photo_original_queued?.properties).toMatchObject({
      source_surface: "onboarding",
      queued_locally: true,
    });
    await expect.poll(() => readPendingOriginalPhotoCount(page)).toBe(1);
    await expect(
      page.getByTestId("original-photo-preservation-warning"),
    ).toHaveCount(0);
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

    await expect(page.getByLabel("ねがおを保存しました")).toHaveAttribute(
      "data-delivery-issue",
      "no_candidate",
    );
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
      page.getByRole("button", { name: "ねてるねこを はじめる" }),
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
    await page.getByRole("button", { name: "ねてるねこを はじめる" }).click();
    await continuePastOptionalOnboardingNamePrompt(page);
    await expect(page).toHaveURL(/\/home\?from=onboarding_second_photo/);
    await expect(page.getByTestId("onboarding-second-photo-invitation")).toBeVisible();

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
    await routeImmediateDelivery(page, portraitDeliveryDataUrl);

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
      page.getByRole("button", { name: "ねてるねこを はじめる" }),
    ).toBeVisible();
    await expect(
      page.getByText("この一通は、『とどいた』にしまわれました"),
    ).toBeVisible();
    await expect(page.getByTestId("home-install-invitation")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-delivered-photos").locator("img")).toHaveCount(1);
    await expect(page.getByTestId("onboarding-delivered-photos")).toHaveAttribute(
      "data-photo-frame",
      "f3",
    );
    const deliveredLayout = await page.evaluate(() => {
      const letter = document.querySelector<HTMLElement>(
        '[data-testid="onboarding-delivered-letter"]',
      );
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
      const letterStyle = letter ? window.getComputedStyle(letter) : null;
      const frameStyle = frame ? window.getComputedStyle(frame) : null;
      const photoStyle = frame?.querySelector("img")
        ? window.getComputedStyle(frame.querySelector("img")!)
        : null;
      const photo = frame?.querySelector("img") as HTMLImageElement | null;

      return {
        frameWidth: frameRect?.width ?? 0,
        frameHeight: frameRect?.height ?? 0,
        frameRight: frameRect?.right ?? Number.POSITIVE_INFINITY,
        titleBottom: titleRect?.bottom ?? Number.POSITIVE_INFINITY,
        frameTop: frameRect?.top ?? Number.NEGATIVE_INFINITY,
        buttonBottom: buttonRect?.bottom ?? Number.POSITIVE_INFINITY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        letterContainsButton: Boolean(letter?.contains(button)),
        letterPaddingTop: letterStyle?.paddingTop ?? "",
        letterBorderRadius: letterStyle?.borderRadius ?? "",
        letterBorderWidth: letterStyle?.borderTopWidth ?? "",
        letterBackgroundImage: letterStyle?.backgroundImage ?? "",
        framePaddingTop: frameStyle?.paddingTop ?? "",
        frameBorderRadius: frameStyle?.borderRadius ?? "",
        frameBorderWidth: frameStyle?.borderTopWidth ?? "",
        frameShadow: frameStyle?.boxShadow ?? "",
        objectFit: photoStyle?.objectFit ?? "",
        frameAspect: Number(frame?.dataset.photoAspect ?? 0),
        photoNaturalAspect:
          photo?.naturalWidth && photo.naturalHeight
            ? photo.naturalWidth / photo.naturalHeight
            : 0,
      };
    });
    expect(deliveredLayout.frameWidth).toBeGreaterThanOrEqual(240);
    expect(deliveredLayout.photoNaturalAspect).toBeCloseTo(2 / 3, 2);
    expect(deliveredLayout.frameAspect).toBeCloseTo(
      deliveredLayout.photoNaturalAspect,
      3,
    );
    expect(deliveredLayout.frameWidth / deliveredLayout.frameHeight).toBeCloseTo(
      deliveredLayout.photoNaturalAspect,
      2,
    );
    expect(deliveredLayout.frameRight).toBeLessThanOrEqual(deliveredLayout.viewportWidth);
    expect(deliveredLayout.titleBottom).toBeLessThanOrEqual(
      deliveredLayout.frameTop,
    );
    expect(deliveredLayout.buttonBottom).toBeLessThanOrEqual(
      deliveredLayout.viewportHeight,
    );
    expect(deliveredLayout.letterContainsButton).toBe(false);
    expect(deliveredLayout.letterPaddingTop).toBe("0px");
    expect(deliveredLayout.letterBorderRadius).toBe("0px");
    expect(deliveredLayout.letterBorderWidth).toBe("0px");
    expect(deliveredLayout.letterBackgroundImage).toBe("none");
    expect(deliveredLayout.framePaddingTop).toBe("0px");
    expect(deliveredLayout.frameBorderRadius).toBe("0px");
    expect(deliveredLayout.frameBorderWidth).toBe("1px");
    expect(deliveredLayout.frameShadow).not.toBe("none");
    expect(deliveredLayout.objectFit).toBe("contain");
    if (process.env.CAPTURE_ONBOARDING_DELIVERED === "1") {
      await page.screenshot({
        path: "artifacts/onboarding-delivered-natural-frame.png",
        animations: "disabled",
      });
    }
    await page.setViewportSize({ width: 320, height: 568 });
    const compactDeliveredLayout = await page
      .getByTestId("onboarding-delivered-continue")
      .evaluate((button) => {
        const rect = button.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          viewportHeight: window.innerHeight,
        };
      });
    expect(compactDeliveredLayout.top).toBeGreaterThanOrEqual(0);
    expect(compactDeliveredLayout.bottom).toBeLessThanOrEqual(
      compactDeliveredLayout.viewportHeight,
    );
    if (process.env.CAPTURE_ONBOARDING_DELIVERED === "1") {
      await page.screenshot({
        path: "artifacts/onboarding-delivered-natural-frame-320x568.png",
        animations: "disabled",
      });
    }
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
    await expect(page.getByRole("button", { name: "閉じる" })).toHaveCount(0);
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
  });

  test("uses the tayori frame and selected photo aspect while waiting and naming", async ({
    page,
  }) => {
    const releaseExchange = await routeBlockedExchangeDelivery(page);
    try {
      await page.goto("/onboarding");
      await page.getByTestId("onboarding-photo-select").click();
      await page.locator('input[type="file"]').last().setInputFiles({
        name: "wide-own-sleeping.jpg",
        mimeType: "image/jpeg",
        buffer: landscapeTestJpeg,
      });

      const preview = page.getByTestId("onboarding-saving-photo-preview");
      await expect(preview).toHaveAttribute("data-photo-ready", "true");
      await expect(preview).toHaveAttribute("data-photo-frame", "f3");
      await expect
        .poll(() =>
          preview.evaluate((frame) =>
            Number((frame as HTMLElement).dataset.photoAspect ?? 0),
          ),
        )
        .toBeGreaterThan(1.4);

      const waitingLayout = await preview.evaluate((frame) => {
        const image = frame.querySelector("img") as HTMLImageElement | null;
        const frameRect = frame.getBoundingClientRect();
        const frameStyle = window.getComputedStyle(frame);
        const imageStyle = image ? window.getComputedStyle(image) : null;

        return {
          frameAspect: frameRect.width / frameRect.height,
          photoAspect:
            image?.naturalWidth && image.naturalHeight
              ? image.naturalWidth / image.naturalHeight
              : 0,
          borderRadius: frameStyle.borderRadius,
          borderWidth: frameStyle.borderTopWidth,
          boxShadow: frameStyle.boxShadow,
          objectFit: imageStyle?.objectFit ?? "",
        };
      });

      expect(waitingLayout.frameAspect).toBeCloseTo(waitingLayout.photoAspect, 1);
      expect(waitingLayout.borderRadius).toBe("0px");
      expect(waitingLayout.borderWidth).toBe("1px");
      expect(waitingLayout.boxShadow).not.toBe("none");
      expect(waitingLayout.objectFit).toBe("contain");

      if (process.env.CAPTURE_ONBOARDING_WAITING === "1") {
        await page.screenshot({
          path: "artifacts/onboarding-delivery-waiting-photo-frame.png",
          animations: "disabled",
        });
      }

      releaseExchange();
      await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
      await expect(page.getByTestId("onboarding-delivered-continue")).toBeEnabled();
      await page.getByTestId("onboarding-delivered-continue").click();

      const namePreview = page.getByTestId("onboarding-name-photo-preview");
      await expect(namePreview).toHaveAttribute("data-photo-frame", "f3");
      await expect
        .poll(() =>
          namePreview.evaluate((frame) =>
            Number((frame as HTMLElement).dataset.photoAspect ?? 0),
          ),
        )
        .toBeGreaterThan(1.4);

      const nameLayout = await namePreview.evaluate((frame) => {
        const image = frame.querySelector("img") as HTMLImageElement | null;
        const frameRect = frame.getBoundingClientRect();
        const frameStyle = window.getComputedStyle(frame);
        const imageStyle = image ? window.getComputedStyle(image) : null;

        return {
          frameAspect: frameRect.width / frameRect.height,
          frameHeight: frameRect.height,
          photoAspect:
            image?.naturalWidth && image.naturalHeight
              ? image.naturalWidth / image.naturalHeight
              : 0,
          borderRadius: frameStyle.borderRadius,
          borderWidth: frameStyle.borderTopWidth,
          boxShadow: frameStyle.boxShadow,
          objectFit: imageStyle?.objectFit ?? "",
        };
      });

      expect(nameLayout.frameAspect).toBeCloseTo(nameLayout.photoAspect, 1);
      expect(nameLayout.frameHeight).toBeLessThanOrEqual(240);
      expect(nameLayout.borderRadius).toBe("0px");
      expect(nameLayout.borderWidth).toBe("1px");
      expect(nameLayout.boxShadow).not.toBe("none");
      expect(nameLayout.objectFit).toBe("contain");

      if (process.env.CAPTURE_ONBOARDING_NAME === "1") {
        await page.screenshot({
          path: "artifacts/onboarding-name-natural-photo-frame.png",
          animations: "disabled",
        });
      }
    } finally {
      releaseExchange();
    }
  });

  test("keeps every onboarding step centered on a narrow Android viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      });
    });

    const releaseExchange = await routeBlockedExchangeDelivery(page);
    try {
      await page.goto("/onboarding");
      await expectOnboardingLayoutWithinViewport(page);
      await captureAndroidOnboardingStep(page, "intro");

      await page.getByTestId("onboarding-photo-select").click();
      await page.locator('input[type="file"]').last().setInputFiles({
        name: "android-own-sleeping.jpg",
        mimeType: "image/jpeg",
        buffer: landscapeTestJpeg,
      });
      await expect(
        page.getByTestId("onboarding-saving-photo-preview"),
      ).toHaveAttribute("data-photo-ready", "true");
      await expectOnboardingLayoutWithinViewport(page);
      await captureAndroidOnboardingStep(page, "waiting");

      releaseExchange();
      const openButton = page.getByRole("button", {
        name: "ねこだよりを ひらく",
      });
      await expect(openButton).toBeVisible();
      await expectOnboardingLayoutWithinViewport(page);
      await captureAndroidOnboardingStep(page, "envelope");

      await openButton.click();
      await expect(page.getByTestId("onboarding-delivered-continue")).toBeEnabled();
      await expectOnboardingLayoutWithinViewport(page);
      await captureAndroidOnboardingStep(page, "delivered");

      await page.getByTestId("onboarding-delivered-continue").click();
      await expect(page.getByRole("heading", { name: "この子の名前は？" })).toBeVisible();
      await expectOnboardingLayoutWithinViewport(page);
      await captureAndroidOnboardingStep(page, "naming");
    } finally {
      releaseExchange();
    }
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
    await expect(
      page.getByRole("button", { name: "ねてるねこを はじめる" }),
    ).toBeEnabled();
  });

  test("does not keep a false photo error after a delayed LINE image loads", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });

      const completeDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        "complete",
      );
      if (!completeDescriptor?.get) {
        return;
      }

      let forcedIntermediateState = false;
      Object.defineProperty(HTMLImageElement.prototype, "complete", {
        configurable: true,
        get() {
          const image = this as HTMLImageElement;
          if (
            !forcedIntermediateState &&
            image.src.includes("delayed-onboarding-delivery.png") &&
            image.closest('[data-testid="onboarding-delivered-photos"]') &&
            image.naturalWidth === 0
          ) {
            forcedIntermediateState = true;
            (
              window as typeof window & {
                __forcedLineImageIntermediateState?: boolean;
              }
            ).__forcedLineImageIntermediateState = true;
            return true;
          }

          return completeDescriptor.get?.call(image) ?? false;
        },
      });
    });
    await routeDelayedOnboardingDelivery(page);
    await page.goto("/onboarding?source=instagram_bio");
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.getByTestId("onboarding-photo-select").click();
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
    await expect
      .poll(() =>
        page
          .getByTestId("onboarding-delivered-photos")
          .locator("img")
          .last()
          .evaluate((image) =>
            (image as HTMLImageElement).currentSrc.startsWith("data:image/"),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & {
            __forcedLineImageIntermediateState?: boolean;
          }).__forcedLineImageIntermediateState,
      ),
    ).toBe(true);
    await expect(
      page.getByText("写真を表示できません", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("onboarding-delivery-photo-error"),
    ).toHaveCount(0);
  });

  test("shows the second photo invitation on home before 8pm", async ({
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

    await expect(page.getByTestId("onboarding-second-photo-invitation")).toHaveCount(0);
    await expect(page.getByTestId("home-install-invitation")).toHaveCount(0);
    await page.getByTestId("onboarding-delivered-continue").click();
    await continuePastOptionalOnboardingNamePrompt(page);
    await expect(page).toHaveURL(/\/home\?from=onboarding_second_photo/);
    await expect(page.getByTestId("onboarding-second-photo-invitation")).toBeVisible();
    await expectUsesUiTypography(
      page.getByTestId("onboarding-second-photo-title"),
      "500",
    );
    await expect(
      page.getByRole("button", { name: "今夜の一枚を とる" }),
    ).toBeVisible();
    await expect(page.getByTestId("home-install-invitation")).toHaveCount(0);
    await page.screenshot({
      path: "artifacts/onboarding-second-photo-home.png",
      fullPage: true,
    });
  });

  test("keeps the second photo invitation after cancel and defers install after skip", async ({
    page,
  }) => {
    await mockBrowserDate(page, "2026-07-06T10:00:00+09:00");
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
    });

    await page.goto("/home?from=onboarding_second_photo");
    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "second-photo-cancel.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page.getByTestId("onboarding-second-photo-invitation")).toBeVisible();
    await expect(page).toHaveURL(/from=onboarding_second_photo/);

    await page.getByRole("button", { name: "今日はここまで" }).click();
    await expect(page.getByTestId("onboarding-second-photo-invitation")).toHaveCount(0);
    await expect(page.getByTestId("home-install-invitation")).toHaveCount(0);
    await expect(page).not.toHaveURL(/from=onboarding_second_photo/);
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
    await expect(page).toHaveURL(/\/home\?from=onboarding_second_photo/);
    await expect(page.getByTestId("home-install-invitation")).toHaveCount(0);
    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-chain.png",
      mimeType: "image/png",
      buffer: testPng,
    });
    const saveDialog = page.getByRole("dialog");
    await expect(saveDialog).toBeVisible();
    await saveDialog.locator("button").last().click();

    await expect(page.getByTestId("onboarding-second-photo-invitation")).toHaveCount(0);
    await expect(page.getByTestId("home-install-invitation")).toBeVisible();
    await page.getByRole("button", { name: "あとで" }).click();

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
    await page.evaluate(() => {
      const trackedWindow = window as Window & {
        __accountLoadingObserver?: MutationObserver;
        __accountLoadingScreenSeen?: boolean;
      };
      const inspect = () => {
        if (document.querySelector('[aria-label="アカウントを確認中"]')) {
          trackedWindow.__accountLoadingScreenSeen = true;
        }
      };

      trackedWindow.__accountLoadingScreenSeen = false;
      trackedWindow.__accountLoadingObserver?.disconnect();
      trackedWindow.__accountLoadingObserver = new MutationObserver(inspect);
      trackedWindow.__accountLoadingObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      inspect();
    });
    await page.getByTestId("onboarding-delivered-continue").click();
    await continuePastOptionalOnboardingNamePrompt(page);
    await expect(page).toHaveURL(/\/account\/create\?from=onboarding/);
    await expect(page).toHaveURL(/next=second_photo/);
    await expect(page.getByTestId("account-create-handoff")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __accountLoadingScreenSeen?: boolean })
            .__accountLoadingScreenSeen,
      ),
    ).toBe(false);
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
    await expect(
      page.getByRole("button", { name: "ねてるねこを はじめる" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("onboarding-second-photo-invitation"),
    ).toHaveCount(0);
    await expect(page.getByTestId("home-install-invitation")).toHaveCount(0);
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
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });
    });
    await routeStorageDeliveryWithSignedDisplay(page);

    await page.goto("/onboarding?source=line");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.locator("main button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "sleeping-cat.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
    await expect(
      page.getByRole("button", { name: "ねてるねこを はじめる" }),
    ).toBeEnabled();

    const openedSnapshot = await readOnboardingDeliverySnapshot(page);
    expect(openedSnapshot.deliveredPhoto?.sourcePhotoId).toBe("stock-signed-e2e-fake");
    expect(openedSnapshot.deliveredPhoto?.src).toBe(
      "storage:admin-stock/sleeping/onboarding-delivered-signed.jpg",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          JSON.parse(
            window.localStorage.getItem(
              "neteruneko_exchange_photo_offline_cache",
            ) ?? "[]",
          ),
        ),
      )
      .toEqual([
        expect.objectContaining({
          photoId: openedSnapshot.deliveredPhoto?.id,
          dataUrl: expect.stringMatching(/^data:image\//),
        }),
      ]);
    const deliveredImage = page
      .getByTestId("onboarding-delivered-photos")
      .locator('img[alt="届いたねがお"]');
    await expect
      .poll(() =>
        deliveredImage.evaluate((image) => ({
          naturalWidth: (image as HTMLImageElement).naturalWidth,
          opacity: window.getComputedStyle(image).opacity,
        })),
      )
      .toEqual({
        naturalWidth: 100,
        opacity: "1",
      });
    await page.waitForTimeout(1200);
    await expect(deliveredImage).toHaveCSS("opacity", "1");
    if (process.env.CAPTURE_ONBOARDING_DELIVERED === "1") {
      await page.screenshot({
        path: "artifacts/onboarding-delivered-unframed-line.png",
        animations: "disabled",
      });
    }
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
    await expect(page.getByText("iPhoneで追加する")).toHaveCount(0);
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
    await page.screenshot({
      path: "artifacts/home-install-ios-invitation.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "追加のしかたを見る" }).click();

    await expect(page.getByText("iPhoneで追加する")).toBeVisible();
    await expectUsesUiTypography(page.getByText("iPhoneで追加する"), "500");
    await expect(page.getByText("「ホーム画面に追加」を選ぶ")).toBeVisible();
    await page.screenshot({
      path: "artifacts/home-install-ios-guide.png",
      fullPage: true,
    });
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
    await page.getByRole("button", { name: "追加のしかたを見る" }).click();

    await expect(page.getByText("Androidで追加する")).toBeVisible();
    await expect(
      page.getByText("「アプリをインストール」または「ホーム画面に追加」を選ぶ"),
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/home-install-android-guide.png",
      fullPage: true,
    });
  });

  test("keeps the first photo action inside a compact phone viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/onboarding?reset=1&source=direct");

    const action = page.getByTestId("onboarding-photo-select");
    await expect(action).toBeVisible();
    await expectUsesUiTypography(
      page.locator('[data-onboarding-title="true"]'),
      "500",
    );
    await page.screenshot({
      path: "artifacts/onboarding-intro-redesign.png",
      fullPage: true,
    });
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
    await expect(page).toHaveURL(/\/home\?from=onboarding_second_photo/);
    await expect(
      page.getByTestId("onboarding-second-photo-invitation"),
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

  test("resumes from IndexedDB when localStorage rejects onboarding progress", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItemWithOnboardingQuota(
        key,
        value,
      ) {
        if (key === "neteruneko_onboarding_progress") {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    });
    await routeImmediateDelivery(page, () => {
      exchangeCalls += 1;
    });

    await page.goto("/onboarding?source=instagram_bio");
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "durable-onboarding.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect(page.getByRole("button", { name: "ねこだよりを ひらく" })).toBeVisible();
    await expect.poll(() => exchangeCalls).toBe(1);
    await expect
      .poll(() => readDurableOnboardingProgress(page))
      .toMatchObject({ stage: "arrived", source: "instagram_bio" });
    expect(await readOnboardingProgress(page)).toBeNull();

    await page.reload();
    await expect(page.getByRole("button", { name: "ねこだよりを ひらく" })).toBeVisible();
    expect(exchangeCalls).toBe(1);
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

  test("stabilizes a LINE photo with FileReader when Blob.arrayBuffer is unavailable", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });

      const originalArrayBuffer = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function arrayBuffer() {
        return this instanceof File
          ? Promise.reject(new DOMException("content URI is unavailable to Blob.arrayBuffer"))
          : originalArrayBuffer.call(this);
      };
      const originalCreateImageBitmap = window.createImageBitmap.bind(window);
      window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
        if (args[0] instanceof Blob && !(args[0] instanceof File)) {
          (window as typeof window & { __decodedStableLineBlob?: boolean })
            .__decodedStableLineBlob = true;
        }
        return originalCreateImageBitmap(...args);
      }) as typeof createImageBitmap;
    });
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?source=instagram_dm");
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "line-filereader-photo.jpg",
      mimeType: "image/jpeg",
      buffer: orientedTestJpeg,
    });

    await expect(
      page.getByRole("button", { name: "ねこだよりを ひらく" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __decodedStableLineBlob?: boolean })
            .__decodedStableLineBlob,
      ),
    ).toBe(true);
  });

  test("uses a constrained bitmap decode for a large Android LINE photo", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0",
      });

      const originalCreateImageBitmap = window.createImageBitmap.bind(window);
      window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
        const options = args[1] as ImageBitmapOptions | undefined;
        const constrainedSize = options?.resizeWidth ?? options?.resizeHeight;
        if (!constrainedSize) {
          return Promise.reject(new DOMException("full-size bitmap decode exceeded memory"));
        }

        (
          window as typeof window & { __lineBitmapDecodeSizes?: number[] }
        ).__lineBitmapDecodeSizes ??= [];
        (
          window as typeof window & { __lineBitmapDecodeSizes: number[] }
        ).__lineBitmapDecodeSizes.push(constrainedSize);
        return originalCreateImageBitmap(args[0]);
      }) as typeof createImageBitmap;
    });
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?source=instagram_dm");
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "line-large-photo.jpg",
      mimeType: "image/jpeg",
      buffer: wideTestJpeg,
    });

    await expect(
      page.getByRole("button", { name: "ねこだよりを ひらく" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __lineBitmapDecodeSizes?: number[] })
            .__lineBitmapDecodeSizes,
      ),
    ).toContain(1200);
  });

  test("recovers from a slow Android photo provider without another selection", async ({
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
        return performance.now() - firstDecodeAt < 2400;
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
      const originalArrayBuffer = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function arrayBuffer() {
        return shouldFailDecoder()
          ? Promise.reject(new DOMException("photo provider is still preparing"))
          : originalArrayBuffer.call(this);
      };
    });
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?source=instagram_dm");
    await page.getByRole("button", { name: "このまま試す" }).click();
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "line-transient-photo.jpg",
      mimeType: "application/octet-stream",
      buffer: orientedTestJpeg,
    });

    await expect(page.getByTestId("onboarding-saving-photo-preview")).toHaveAttribute(
      "data-photo-ready",
      "false",
    );
    await expect(page.locator('main img[src^="blob:"]')).toHaveCount(0);
    await expect(
      page.getByText(
        /写真(?:を読み込めませんでした|の読み込みが途中で止まりました)/,
      ),
    ).toHaveCount(0);
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
    await expect(page.getByLabel("ねがおを保存しました")).toHaveAttribute(
      "data-delivery-issue",
      "temporary_error",
    );
    await expect(page.getByText("候補の確認で止まりました。", { exact: false })).toBeVisible();
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

  test("allows another selection after rejecting a renamed non-image", async ({
    page,
  }) => {
    test.slow();
    await routeImmediateDelivery(page);
    await page.goto("/onboarding");
    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "not-really-a-photo.jpg",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a photo", "utf8"),
    });

    await expect(
      page.getByText(
        "写真の読み込みが途中で止まりました。少し待ってから、同じ写真をもう一度選んでください。",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-photo-select")).toBeVisible();

    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "valid-after-decode-error.jpg",
      mimeType: "image/jpeg",
      buffer: orientedTestJpeg,
    });
    await expect(
      page.getByRole("button", { name: "ねこだよりを ひらく" }),
    ).toBeVisible();
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
    const retryButton = page.getByTestId("onboarding-delivery-photo-retry");
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton
        .evaluate((button: HTMLButtonElement) => button.click())
        .catch(() => undefined);
    }
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
      window.localStorage.setItem(
        "neteruneko_exchange_photo_offline_cache",
        JSON.stringify([{ photoId: "kept-old", dataUrl: "data:image/png;base64,AA==" }]),
      );
      window.localStorage.setItem("cat_profiles", JSON.stringify([{ id: "cat-old" }]));
      window.localStorage.setItem("active_cat_id", "cat-old");
      window.localStorage.setItem("analytics_anonymous_id", "anonymous-reset-e2e");
      window.localStorage.setItem(
        "nyaruhodo_supabase_auth",
        JSON.stringify({ access_token: "stale-test-session" }),
      );
      window.localStorage.setItem(
        "nyaruhodo_supabase_auth-code-verifier",
        "stale-test-verifier",
      );
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
      page.getByText(
        "テスト用に、この端末のオンボーディング状態とログイン状態をリセットしました。",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\?ref=ABC234$/);

    const storage = await page.evaluate(() => ({
      completed: window.localStorage.getItem("onboarding_completed"),
      progress: window.localStorage.getItem("neteruneko_onboarding_progress"),
      ownPhotos: window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos"),
      keptPhotos: window.localStorage.getItem("nyaruhodo_exchange_kept_photos"),
      offlinePhotoCache: window.localStorage.getItem(
        "neteruneko_exchange_photo_offline_cache",
      ),
      profiles: window.localStorage.getItem("cat_profiles"),
      activeCatId: window.localStorage.getItem("active_cat_id"),
      anonymousId: window.localStorage.getItem("analytics_anonymous_id"),
      authSession: window.localStorage.getItem("nyaruhodo_supabase_auth"),
      authCodeVerifier: window.localStorage.getItem(
        "nyaruhodo_supabase_auth-code-verifier",
      ),
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
    expect(storage.offlinePhotoCache).toBeNull();
    expect(storage.profiles).toBeNull();
    expect(storage.activeCatId).toBeNull();
    expect(storage.anonymousId).toBeTruthy();
    expect(storage.anonymousId).not.toBe("anonymous-reset-e2e");
    expect(storage.authSession).toBeNull();
    expect(storage.authCodeVerifier).toBeNull();
    expect(storage.recordLog).toBeNull();
    expect(storage.sessionReady).toBeNull();
    expect(storage.pendingReferral).toContain("ABC234");
  });

  test("accepts the legacy reset query without leaving it in the URL", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify([
          {
            id: "legacy-reset-letter",
            src: "data:image/png;base64,AA==",
            deliveredAt: Date.now(),
          },
        ]),
      );
    });

    await page.goto("/onboarding?src=instagram_bio&reset=1");

    await expect(
      page.getByText(
        "テスト用に、この端末のオンボーディング状態とログイン状態をリセットしました。",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\?src=instagram_bio$/);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("nyaruhodo_exchange_kept_photos"),
        ),
      )
      .toBeNull();
  });

  test("shows only the new received letter after a test reset", async ({
    page,
  }) => {
    const previousLetter = {
      id: "previous-onboarding-letter",
      sourcePhotoId: "previous-onboarding-source",
      src: portraitDeliveryDataUrl,
      title: "",
      subtitle: "",
      triggerLabel: "sleeping",
      theme: "sleeping",
      deliveredAt: Date.parse("2026-07-15T20:00:00+09:00"),
    };

    await page.goto("/offline");
    await page.evaluate(async (letter) => {
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify([letter]),
      );
      window.localStorage.setItem(
        "nyaruhodo_supabase_auth",
        JSON.stringify({ access_token: "stale-test-session" }),
      );
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("neteruneko-durable-state", 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("records")) {
            request.result.createObjectStore("records", { keyPath: "key" });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("records", "readwrite");
          transaction.objectStore("records").put({
            key: "photo-history:kept:v1",
            value: [letter],
            updatedAt: Date.now(),
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    }, previousLetter);
    await routeImmediateDelivery(page);

    await page.goto("/onboarding?src=instagram_bio&reset=1");
    await expect(
      page.getByText(
        "テスト用に、この端末のオンボーディング状態とログイン状態をリセットしました。",
      ),
    ).toBeVisible();

    await page.evaluate((letter) => {
      if (window.localStorage.getItem("nyaruhodo_supabase_auth")) {
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify([letter]),
        );
      }
    }, previousLetter);

    await page.getByTestId("onboarding-photo-select").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "fresh-onboarding-photo.png",
      mimeType: "image/png",
      buffer: testPng,
    });
    await page.getByRole("button", { name: "ねこだよりを ひらく" }).click();
    await expect(page.getByTestId("onboarding-delivered-continue")).toBeEnabled();

    await page.goto("/collection");
    await page.getByRole("tab", { name: "とどいた" }).click();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);
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
        keptExchangePhotos?: Array<{
          id?: string;
          sourcePhotoId?: string;
          offlineSrc?: string;
        }>;
        pendingReferralCode?: string | null;
        resetTargetLocalState?: boolean;
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
        src: "storage:admin-stock/sleeping/onboarding-current-delivered.jpg",
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
          currentDeliveredPhoto,
          {
            ...currentDeliveredPhoto,
            id: "old-kept-photo",
            sourcePhotoId: "old-source-photo",
          },
        ]),
      );
      window.localStorage.setItem(
        "neteruneko_exchange_photo_offline_cache",
        JSON.stringify([
          {
            photoId: currentDeliveredPhoto.id,
            sourcePhotoId: currentDeliveredPhoto.sourcePhotoId,
            dataUrl: imageDataUrl,
            updatedAt: Date.now(),
          },
        ]),
      );
      window.sessionStorage.setItem(
        "neteruneko_onboarding_test_reset_done",
        "true",
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
    await page.evaluate(() => {
      const trackedWindow = window as Window & {
        __handoffLoadingObserver?: MutationObserver;
        __handoffLoadingScreenSeen?: boolean;
      };
      const inspect = () => {
        if (document.body?.textContent?.includes("ねがおを 確認しています")) {
          trackedWindow.__handoffLoadingScreenSeen = true;
        }
      };

      trackedWindow.__handoffLoadingScreenSeen = false;
      trackedWindow.__handoffLoadingObserver?.disconnect();
      trackedWindow.__handoffLoadingObserver = new MutationObserver(inspect);
      trackedWindow.__handoffLoadingObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      inspect();
    });
    await handoffButton.click();

    await expect.poll(() => capturedCreateBodies.length).toBe(1);
    await expect(page).toHaveURL(/\/onboarding\/continue\?handoff=/);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __handoffLoadingScreenSeen?: boolean })
            .__handoffLoadingScreenSeen,
      ),
    ).toBe(false);
    const capturedPayload = capturedCreateBodies[0]?.payload;

    expect(capturedPayload?.ownSleepingPhotos).toHaveLength(1);
    expect(capturedPayload?.keptExchangePhotos).toHaveLength(1);
    expect(capturedPayload?.keptExchangePhotos?.[0]).toMatchObject({
      id: "onboarding-current-delivered",
      sourcePhotoId: "source-current-delivered",
      offlineSrc: imageDataUrl,
    });
    expect(capturedPayload?.catProfiles).toHaveLength(1);
    expect(capturedPayload?.catProfiles?.[0]?.id).toBe("cat-current");
    expect(capturedPayload?.activeCatId).toBe("cat-current");
    expect(capturedPayload?.pendingReferralCode).toContain("LINE234");
    expect(capturedPayload?.resetTargetLocalState).toBe(true);
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
    const deliveredStorageSrc =
      "storage:admin-stock/sleeping/handoff-delivered.jpg";
    await page.route("**/api/photo-storage/signed-url", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null, error: "forbidden_photo" }),
      });
    });
    await page.route("**/api/photo-storage/signed-urls", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ signedUrls: {} }),
      });
    });
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
            keptExchangePhotos: [
              {
                id: "handoff-delivered-photo",
                sourcePhotoId: "handoff-delivered-source",
                src: deliveredStorageSrc,
                offlineSrc: landscapeDeliveryDataUrl,
                title: "",
                subtitle: "",
                triggerLabel: "sleeping",
                theme: "sleeping",
                deliveredAt: Date.now(),
              },
            ],
            pendingReferralCode: "LINE234",
            resetTargetLocalState: true,
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
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          "2026-07-14": {
            dateKey: "2026-07-14",
            deliveredPhoto: {
              id: "stale-target-evening-delivery",
              sourcePhotoId: "stale-target-evening-source",
              src: "storage:delivery-archive/stale-target-evening.webp",
              title: "stale",
              subtitle: "",
              triggerLabel: "sleeping",
              theme: "sleeping",
              deliveredAt: Date.now() - 20_000,
            },
            deliveredAt: Date.now() - 20_000,
            openedAt: Date.now() - 10_000,
            openedBy: "user",
          },
        }),
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
          eveningDeliveryDays: window.localStorage.getItem(
            "neteruneko_evening_delivery_days",
          ),
        })),
      )
      .toMatchObject({
        activeCatId: "handoff-cat",
        completed: "true",
        eveningDeliveryDays: null,
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
    expect(keptPhotos).toHaveLength(1);
    expect(keptPhotos[0]).toMatchObject({
      id: "handoff-delivered-photo",
      sourcePhotoId: "handoff-delivered-source",
      src: deliveredStorageSrc,
    });
    expect(keptPhotos[0]?.offlineSrc).toBeUndefined();
    const offlineCache = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem("neteruneko_exchange_photo_offline_cache") ??
          "[]",
      ),
    );
    expect(offlineCache).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          photoId: "handoff-delivered-photo",
          dataUrl: landscapeDeliveryDataUrl,
        }),
      ]),
    );

    await page.goto("/collection");
    await page.getByRole("tab", { name: "とどいた" }).click();
    const deliveredCard = page.getByTestId("mainichi-board-photo-delivered");
    await expect(deliveredCard).toHaveCount(1);
    await expect
      .poll(async () =>
        Number(await deliveredCard.getAttribute("data-display-natural-ratio")),
      )
      .toBeCloseTo(1.5, 2);
    await expect
      .poll(() =>
        deliveredCard
          .locator("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    await deliveredCard.click();
    const viewer = page.getByTestId("mainichi-photo-viewer");
    await expect(viewer).toBeVisible();
    await expect(
      viewer.getByText("写真を表示できません", { exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        viewer.locator("img").evaluateAll((images) =>
          images.some((element) => {
            const image = element as HTMLImageElement;
            return (
              image.complete &&
              image.naturalWidth > 0 &&
              image.naturalWidth / image.naturalHeight > 1.45
            );
          }),
        ),
      )
      .toBe(true);
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
  test("restores a handoff into a genuinely separate browser origin", async ({
    page,
    context,
  }) => {
    const sourceBase = new URL(
      process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    );
    const targetBase = new URL(sourceBase);
    targetBase.hostname = sourceBase.hostname === "localhost" ? "127.0.0.1" : "localhost";
    const imageDataUrl = `data:image/png;base64,${testPng.toString("base64")}`;

    await page.goto(new URL("/offline", sourceBase).toString());
    await page.evaluate(() => {
      window.localStorage.setItem("active_cat_id", "source-origin-cat");
      window.localStorage.setItem("cross_origin_source_marker", "preserved");
    });

    const targetPage = await context.newPage();
    await targetPage.route("**/api/onboarding/handoff/redeem", async (route) => {
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
            catProfiles: [{ id: "target-origin-cat", name: "mugi" }],
            activeCatId: "target-origin-cat",
            ownSleepingPhotos: [
              {
                id: "target-origin-own-photo",
                catId: "target-origin-cat",
                ownerCatId: "target-origin-cat",
                src: imageDataUrl,
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
            pendingReferralCode: null,
            resetTargetLocalState: true,
          },
        }),
      });
    });

    const continueUrl = new URL(
      "/onboarding/continue?handoff=onb_00000000-0000-4000-8000-000000000000_0123456789abcdef0123",
      targetBase,
    );
    await targetPage.goto(continueUrl.toString());
    await targetPage.evaluate(() => {
      window.localStorage.setItem("active_cat_id", "stale-target-cat");
      window.localStorage.setItem("neteruneko_evening_delivery_days", "{}");
    });
    await targetPage.locator("main button").first().click();
    await expect(targetPage).toHaveURL(/\/home\?handoff=restored/);

    await expect
      .poll(() =>
        targetPage.evaluate(() => ({
          activeCatId: window.localStorage.getItem("active_cat_id"),
          eveningDays: window.localStorage.getItem("neteruneko_evening_delivery_days"),
          ownPhotos: JSON.parse(
            window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ?? "[]",
          ) as Array<{ id?: string }>,
        })),
      )
      .toMatchObject({
        activeCatId: "target-origin-cat",
        eveningDays: null,
        ownPhotos: [{ id: "target-origin-own-photo" }],
      });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          activeCatId: window.localStorage.getItem("active_cat_id"),
          sourceMarker: window.localStorage.getItem("cross_origin_source_marker"),
        })),
      )
      .toEqual({
        activeCatId: "source-origin-cat",
        sourceMarker: "preserved",
      });
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

async function routeImmediateDelivery(
  page: Page,
  deliveredSrcOrOnCall:
    | string
    | (() => void) = `data:image/png;base64,${testPng.toString("base64")}`,
) {
  const deliveredSrc =
    typeof deliveredSrcOrOnCall === "string"
      ? deliveredSrcOrOnCall
      : `data:image/png;base64,${testPng.toString("base64")}`;
  const onCall =
    typeof deliveredSrcOrOnCall === "function"
      ? deliveredSrcOrOnCall
      : () => undefined;
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    onCall();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        photo: {
          id: `delivered-test-${Date.now()}`,
          sourcePhotoId: "stock-e2e-fake",
          src: deliveredSrc,
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

async function routeBlockedExchangeDelivery(page: Page) {
  let releaseExchange: () => void = () => undefined;
  const exchangeGate = new Promise<void>((resolve) => {
    releaseExchange = resolve;
  });

  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    await exchangeGate;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        photo: {
          id: `delivered-waiting-${Date.now()}`,
          sourcePhotoId: "stock-waiting-e2e-fake",
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

  return releaseExchange;
}

async function expectOnboardingLayoutWithinViewport(page: Page) {
  const layout = await page
    .getByTestId("onboarding-layout-container")
    .evaluate((container) => {
      const main = container.closest("main");
      const containerRect = container.getBoundingClientRect();
      const visibleTextElements = [
        ...container.querySelectorAll<HTMLElement>("h1, h2, p, button, input"),
      ].filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      });
      const outside = visibleTextElements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent?.trim().slice(0, 40) ?? element.tagName,
            left: rect.left,
            right: rect.right,
          };
        })
        .filter((rect) => rect.left < -1 || rect.right > window.innerWidth + 1);
      const overlaps: string[] = [];
      const exchangeRoute = container.querySelector<HTMLElement>(
        '[data-onboarding-exchange-route="true"]',
      );
      const exchangeLead = container.querySelector<HTMLElement>(
        '[data-onboarding-lead="true"]',
      );
      const exchangeRouteVisualBottom = exchangeRoute
        ? Math.max(
            exchangeRoute.getBoundingClientRect().bottom,
            ...[...exchangeRoute.children].map(
              (child) => child.getBoundingClientRect().bottom,
            ),
          )
        : null;
      const exchangeLeadTop = exchangeLead?.getBoundingClientRect().top ?? null;
      const centeredTargets = [
        ["delivered letter", '[data-testid="onboarding-delivered-letter"]'],
        ["delivered title", '[data-testid="onboarding-delivered-title"]'],
        ["delivered photo", '[data-testid="onboarding-delivered-photos"]'],
        ["delivered action", '[data-testid="onboarding-delivered-continue"]'],
      ]
        .map(([name, selector]) => {
          const element = container.querySelector<HTMLElement>(selector);
          if (!element) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          return {
            name,
            offset: rect.left + rect.width / 2 - window.innerWidth / 2,
          };
        })
        .filter((target): target is { name: string; offset: number } => Boolean(target));

      for (let firstIndex = 0; firstIndex < visibleTextElements.length; firstIndex += 1) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < visibleTextElements.length;
          secondIndex += 1
        ) {
          const first = visibleTextElements[firstIndex];
          const second = visibleTextElements[secondIndex];
          if (first.contains(second) || second.contains(first)) {
            continue;
          }

          const firstRect = first.getBoundingClientRect();
          const secondRect = second.getBoundingClientRect();
          const overlapWidth =
            Math.min(firstRect.right, secondRect.right) -
            Math.max(firstRect.left, secondRect.left);
          const overlapHeight =
            Math.min(firstRect.bottom, secondRect.bottom) -
            Math.max(firstRect.top, secondRect.top);

          if (overlapWidth > 1 && overlapHeight > 1) {
            overlaps.push(
              `${first.textContent?.trim().slice(0, 24)} / ${second.textContent
                ?.trim()
                .slice(0, 24)}`,
            );
          }
        }
      }

      return {
        center: containerRect.left + containerRect.width / 2,
        expectedCenter: window.innerWidth / 2,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        outside,
        overlaps,
        centeredTargets,
        exchangeCopyGap:
          exchangeRouteVisualBottom !== null && exchangeLeadTop !== null
            ? exchangeLeadTop - exchangeRouteVisualBottom
            : null,
        textSizeAdjust: main
          ? window.getComputedStyle(main).webkitTextSizeAdjust
          : "",
      };
    });

  expect(layout.innerWidth).toBe(360);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);
  expect(layout.center).toBeCloseTo(layout.expectedCenter, 1);
  expect(layout.outside).toEqual([]);
  expect(layout.overlaps).toEqual([]);
  for (const target of layout.centeredTargets) {
    expect(
      Math.abs(target.offset),
      `${target.name} should be centered`,
    ).toBeLessThanOrEqual(1);
  }
  if (layout.exchangeCopyGap !== null) {
    expect(layout.exchangeCopyGap).toBeGreaterThanOrEqual(8);
  }
  expect(layout.textSizeAdjust).toBe("100%");
}

async function captureAndroidOnboardingStep(page: Page, step: string) {
  if (process.env.CAPTURE_ONBOARDING_ANDROID !== "1") {
    return;
  }

  await page.screenshot({
    path: `artifacts/onboarding-android-${step}-360x640.png`,
    animations: "disabled",
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
    if (route.request().resourceType() !== "image") {
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
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

async function readPendingOriginalPhotoCount(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("neteruneko-photo-originals", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("pending-originals")) {
            database.close();
            resolve(0);
            return;
          }

          const transaction = database.transaction("pending-originals", "readonly");
          const countRequest = transaction.objectStore("pending-originals").count();
          countRequest.onsuccess = () => resolve(countRequest.result);
          countRequest.onerror = () => reject(countRequest.error);
          transaction.oncomplete = () => database.close();
        };
      }),
  );
}

async function readDurableOnboardingProgress(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("neteruneko-durable-state", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("records", "readonly");
          const getRequest = transaction
            .objectStore("records")
            .get("onboarding-progress:v1");
          getRequest.onsuccess = () => resolve(getRequest.result?.value ?? null);
          getRequest.onerror = () => reject(getRequest.error);
          transaction.oncomplete = () => database.close();
        };
      }),
  );
}

async function expectVisibleNonBlackImage(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () =>
      locator.evaluate(async (image) => {
        if (!(image instanceof HTMLImageElement)) {
          return { loaded: false, brightness: 0, colorfulPixels: 0, valid: false };
        }

        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
          return { loaded: false, brightness: 0, colorfulPixels: 0, valid: false };
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
          return { loaded: true, brightness: 0, colorfulPixels: 0, valid: false };
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

        const brightness = visiblePixels > 0 ? brightnessSum / visiblePixels : 0;
        return {
          loaded: true,
          brightness,
          colorfulPixels,
          valid: brightness > 80 && colorfulPixels > 0,
        };
      }),
    )
    .toEqual(
      expect.objectContaining({
        loaded: true,
        valid: true,
      }),
    );
}

async function expectUsesUiTypography(
  locator: Locator,
  expectedWeight?: string,
) {
  const typography = await locator.evaluate((element) => {
    const rootStyle = window.getComputedStyle(document.documentElement);
    const uiFamily = rootStyle
      .getPropertyValue("--font-zen-kaku")
      .split(",")[0]
      ?.trim()
      .replace(/^['"]|['"]$/g, "");
    const elementStyle = window.getComputedStyle(element);

    return {
      fontFamily: elementStyle.fontFamily,
      fontWeight: elementStyle.fontWeight,
      uiFamily,
    };
  });

  expect(typography.uiFamily).toBeTruthy();
  expect(typography.fontFamily).toContain(typography.uiFamily);
  if (expectedWeight) {
    expect(typography.fontWeight).toBe(expectedWeight);
  }
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
