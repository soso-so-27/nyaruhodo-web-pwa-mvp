import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const testSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <rect width="1200" height="1200" fill="#f4eadc"/>
    ${Array.from({ length: 900 }, (_, index) => {
      const x = (index * 37) % 1200;
      const y = (index * 53) % 1200;
      const hue = (index * 29) % 360;
      return `<rect x="${x}" y="${y}" width="46" height="46" fill="hsl(${hue},70%,55%)"/>`;
    }).join("")}
  </svg>`,
);

const deliveredDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";
const testUploadPng = Buffer.from(deliveredDataUrl.split(",")[1], "base64");
const catPhotoFixturePath = path.resolve(
  process.cwd(),
  "tests/fixtures/cat-photo-mugi.jpg",
);
const deliveredLandscapeDataUrl = `data:image/jpeg;base64,${readFileSync(
  catPhotoFixturePath,
).toString("base64")}`;

async function waitForOwnSleepingPhotoCount(page: Page, minCount: number) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const parsed = JSON.parse(
          window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
            "[]",
        );
        return Array.isArray(parsed) ? parsed.length : 0;
      }),
    )
    .toBeGreaterThanOrEqual(minCount);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function confirmSleepingPhotoShare(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("button").last().click();
}

function readEveningTargetOwnPhotoId(page: Page, dateKey: string) {
  return page.evaluate((targetDateKey) => {
    const parsed = JSON.parse(
      window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
    );
    return parsed[targetDateKey]?.targetOwnPhotoId ?? null;
  }, dateKey);
}

function readPendingOriginalPhotos(page: Page) {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === "neteruneko-photo-originals")) {
      return [];
    }

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("neteruneko-photo-originals", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!database.objectStoreNames.contains("pending-originals")) {
      database.close();
      return [];
    }

    return new Promise<
      Array<{ blobSize: number; localAssetId: string; sourceSurface: string }>
    >((resolve, reject) => {
      const transaction = database.transaction("pending-originals", "readonly");
      const request = transaction.objectStore("pending-originals").getAll();
      request.onsuccess = () => {
        resolve(
          request.result.map(
            (entry: {
              bytes?: ArrayBuffer;
              blob?: Blob;
              localAssetId?: string;
              sourceSurface?: string;
            }) => ({
              blobSize: entry.bytes?.byteLength ?? entry.blob?.size ?? 0,
              localAssetId: entry.localAssetId ?? "",
              sourceSurface: entry.sourceSurface ?? "",
            }),
          ),
        );
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  });
}

test.describe("home sleeping exchange flow", () => {
  test("saves the taken photo, waits until evening, then opens the delivered pair", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const beforeDelivery = Date.parse("2026-06-10T10:59:00.000Z");
    const afterDelivery = Date.parse("2026-06-10T11:01:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");

      const originalSetItem = Storage.prototype.setItem;
      let ownPhotoWriteFailures = 0;

      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (
          key === "nyaruhodo_exchange_own_sleeping_photos" &&
          ownPhotoWriteFailures < 4
        ) {
          ownPhotoWriteFailures += 1;
          throw new DOMException("Quota exceeded for test", "QuotaExceededError");
        }

        return originalSetItem.call(this, key, value);
      };
    }, beforeDelivery);

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: `delivered-test-${Date.now()}`,
            sourcePhotoId: "source-test-photo",
            src: deliveredLandscapeDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
          diagnostics: {
            source: "remote",
            candidateCount: 1,
            normalCandidateCount: 1,
            fallbackCandidateCount: 0,
            fallbackActive: false,
          },
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);

    await waitForOwnSleepingPhotoCount(page, 1);

    await expect
      .poll(() => readPendingOriginalPhotos(page))
      .toEqual([
        expect.objectContaining({
          blobSize: testUploadPng.length,
          sourceSurface: "sleeping",
        }),
      ]);

    expect(exchangeCalls).toBe(0);
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "2",
    );
    const deliveryTargetBeforeEvening = await page.evaluate(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );
      return parsed["2026-06-10"]?.targetOwnPhotoId ?? null;
    });
    expect(deliveryTargetBeforeEvening).toBeTruthy();

    await advanceHomeClockTo(page, afterDelivery);

    await expect.poll(() => exchangeCalls).toBe(1);
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );
    const openButton = page.getByTestId("desk-open-letter");
    await openButton.click();
    const openingPanel = page.getByTestId("evening-opening-pair");
    const deliveredLetter = openingPanel.getByTestId("evening-opening-letter");
    await expect(deliveredLetter.locator("img")).toHaveCount(1);
    await expect(
      deliveredLetter.getByTestId("evening-opening-photo-frame"),
    ).toHaveAttribute("data-photo-frame", "f3");
    await expect(deliveredLetter).toContainText("ねこだより");
    await expect(deliveredLetter).toContainText(
      "この一通は、『とどいた』にしまわれました",
    );
    await expect(
      deliveredLetter.getByRole("button", { name: "また、あした" }),
    ).toHaveCount(0);
    const deliveredLetterStyles = await deliveredLetter.evaluate((letter) => {
      const frame = letter.querySelector<HTMLElement>(
        '[data-testid="evening-opening-photo-frame"]',
      );
      const letterStyle = getComputedStyle(letter);
      const frameStyle = frame ? getComputedStyle(frame) : null;
      const photo = frame?.querySelector("img") as HTMLImageElement | null;

      return {
        letterPaddingTop: letterStyle.paddingTop,
        letterBorderRadius: letterStyle.borderRadius,
        letterBorderWidth: letterStyle.borderTopWidth,
        letterBackgroundImage: letterStyle.backgroundImage,
        framePaddingTop: frameStyle?.paddingTop ?? "",
        frameBorderWidth: frameStyle?.borderTopWidth ?? "",
        frameShadow: frameStyle?.boxShadow ?? "",
        frameAspect:
          frame && frame.clientHeight > 0
            ? frame.clientWidth / frame.clientHeight
            : 0,
        photoNaturalAspect:
          photo?.naturalWidth && photo.naturalHeight
            ? photo.naturalWidth / photo.naturalHeight
            : 0,
      };
    });
    expect(deliveredLetterStyles.letterPaddingTop).toBe("0px");
    expect(deliveredLetterStyles.letterBorderRadius).toBe("0px");
    expect(deliveredLetterStyles.letterBorderWidth).toBe("0px");
    expect(deliveredLetterStyles.letterBackgroundImage).toBe("none");
    expect(deliveredLetterStyles.framePaddingTop).toBe("0px");
    expect(deliveredLetterStyles.frameBorderWidth).toBe("1px");
    expect(deliveredLetterStyles.frameShadow).not.toBe("none");
    expect(deliveredLetterStyles.photoNaturalAspect).toBeCloseTo(3 / 2, 2);
    expect(deliveredLetterStyles.frameAspect).toBeCloseTo(
      deliveredLetterStyles.photoNaturalAspect,
      2,
    );
    if (process.env.CAPTURE_DELIVERED_LETTER === "1") {
      await page.screenshot({
        path: "artifacts/home-evening-opening-letter.png",
        animations: "disabled",
      });
    }
    await page.setViewportSize({ width: 320, height: 568 });
    const compactActionBounds = await openingPanel
      .getByRole("button", { name: "また、あした" })
      .evaluate((button) => {
        const rect = button.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          viewportHeight: window.innerHeight,
        };
      });
    expect(compactActionBounds.top).toBeGreaterThanOrEqual(0);
    expect(compactActionBounds.bottom).toBeLessThanOrEqual(
      compactActionBounds.viewportHeight,
    );
    if (process.env.CAPTURE_DELIVERED_LETTER === "1") {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      await page.screenshot({
        path: "artifacts/home-evening-opening-letter-320x568.png",
        animations: "disabled",
      });
    }
    await expect(openingPanel.getByRole("button", { name: "閉じる" })).toHaveCount(0);
    await expect(openingPanel.locator("button")).toHaveCount(1);
    await openingPanel.getByRole("button", { name: "また、あした" }).click();
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );

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
        eveningDeliveryDays: JSON.parse(
          window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
        ),
      };
    });

    expect(storage.ownSleepingPhotos.length).toBeGreaterThan(0);
    expect(storage.ownSleepingPhotos[0]?.src).toMatch(/^data:image\//);
    expect(storage.keptExchangePhotos.length).toBeGreaterThan(0);
    expect(storage.keptExchangePhotos[0]?.src).toBeTruthy();
    expect(storage.eveningDeliveryDays["2026-06-10"]?.openedAt).toBeTruthy();
    expect(storage.eveningDeliveryDays["2026-06-10"]?.keptAt).toBeTruthy();
  });

  test("does not save the taken photo before the share confirmation sheet", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "confirm-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "confirm-cat",
            name: "confirm cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "needs-confirmation.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });

    await expect(page.getByRole("dialog")).toBeVisible();
    const beforeConfirm = await page.evaluate(() => ({
      ownPhotos: JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
          "[]",
      ),
      eveningDays: JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      ),
    }));
    expect(beforeConfirm.ownPhotos).toHaveLength(0);
    expect(beforeConfirm.eveningDays["2026-06-10"]?.targetOwnPhotoId).toBeFalsy();

    await confirmSleepingPhotoShare(page);
    await waitForOwnSleepingPhotoCount(page, 1);

    const afterConfirmTargetId = await readEveningTargetOwnPhotoId(
      page,
      "2026-06-10",
    );
    expect(afterConfirmTargetId).toBeTruthy();
  });

  test("stores an evening target without duplicating the photo payload", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "android-quota-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "android-quota-cat",
            name: "android quota cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );

      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (
          key === "neteruneko_evening_delivery_days" &&
          String(value).includes('"targetPhoto"')
        ) {
          throw new DOMException("Quota exceeded for test", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    }, beforeDelivery);

    await page.route("**/api/sleeping-delivery/backup", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "android-large-photo.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);
    await waitForOwnSleepingPhotoCount(page, 1);

    const savedTarget = await page.evaluate(() => {
      const store = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );
      return store["2026-06-10"] ?? null;
    });
    expect(savedTarget?.targetOwnPhotoId).toBeTruthy();
    expect(savedTarget?.targetCatId).toBe("android-quota-cat");
    expect(savedTarget?.targetPhoto).toBeUndefined();
  });

  test("retries a compact moderation backup without losing the evening target", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");
    let backupCalls = 0;
    const backupBodies: Array<Record<string, any>> = [];

    await page.addInitScript((now) => {
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => now ?? originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "backup-retry-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "backup-retry-cat",
            name: "backup retry cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);
    await page.route("**/api/sleeping-delivery/backup", async (route) => {
      backupCalls += 1;
      backupBodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: backupCalls === 1 ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          backupCalls === 1
            ? { ok: false, error: "backup_unavailable" }
            : { ok: true },
        ),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "backup-retry.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);

    await expect.poll(() => backupCalls).toBe(2);
    expect(backupBodies[0]?.photo?.src).toMatch(/^data:image\//);
    expect(backupBodies[0]?.photo?.thumbnailSrc).toBeUndefined();
    expect(backupBodies[0]?.photo?.displaySrc).toBeUndefined();
    expect(backupBodies[0]?.photo?.originalSrc).toBeUndefined();
    await expect
      .poll(() => readEveningTargetOwnPhotoId(page, "2026-06-10"))
      .not.toBeNull();
    await expect(
      page.getByText(
        "ねこだよりの予約はできましたが、写真を審査へ送れませんでした。通信を確認して、もう一度おためしください。",
      ),
    ).toHaveCount(0);
  });

  test("keeps the evening target and warns when moderation backup retries fail", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");
    let backupCalls = 0;

    await page.addInitScript((now) => {
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => now ?? originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "backup-failure-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "backup-failure-cat",
            name: "backup failure cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);
    await page.route("**/api/sleeping-delivery/backup", async (route) => {
      backupCalls += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "backup_unavailable" }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "backup-failure.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);

    await expect.poll(() => backupCalls).toBe(3);
    await expect(
      page.getByText(
        "ねこだよりの予約はできましたが、写真を審査へ送れませんでした。通信を確認して、もう一度おためしください。",
      ),
    ).toBeVisible();
    await expect
      .poll(() => readEveningTargetOwnPhotoId(page, "2026-06-10"))
      .not.toBeNull();
  });

  test("repairs a missing same-day target and delivers after an Android revisit", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-10T11:05:00.000Z");
    const capturedAt = Date.parse("2026-06-10T09:10:00.000Z");

    await seedMissingEveningTarget(page, {
      now: afterDelivery,
      capturedAt,
      catId: "android-repair-cat",
      photoId: "android-shared-photo",
      shared: true,
      captureContext: "daily",
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      const body = route.request().postDataJSON() as {
        ownPhoto?: { id?: string };
        recipientCatId?: string;
      };
      expect(body.ownPhoto?.id).toBe("android-shared-photo");
      expect(body.recipientCatId).toBe("android-repair-cat");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "android-repaired-delivery",
            sourcePhotoId: "android-repaired-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect.poll(() => exchangeCalls).toBe(1);

    const store = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      ),
    );
    expect(store["2026-06-10"]?.targetOwnPhotoId).toBe(
      "android-shared-photo",
    );
    expect(store["2026-06-10"]?.targetPhoto).toBeUndefined();
    expect(store["2026-06-10"]?.deliveredPhoto?.id).toBe(
      "android-repaired-delivery",
    );
  });

  test("sends the logged-in session for a data-url evening photo", async ({
    page,
  }) => {
    const afterDelivery = Date.parse("2026-06-10T11:05:00.000Z");
    const capturedAt = Date.parse("2026-06-10T09:10:00.000Z");
    let authorizationHeader: string | undefined;

    await seedMissingEveningTarget(page, {
      now: afterDelivery,
      capturedAt,
      catId: "authenticated-data-cat",
      photoId: "authenticated-data-photo",
      shared: true,
      captureContext: "daily",
    });
    await page.addInitScript((expiresAt) => {
      window.localStorage.setItem(
        "nyaruhodo_supabase_auth",
        JSON.stringify({
          access_token: "e2e-access-token",
          refresh_token: "e2e-refresh-token",
          expires_in: 3600,
          expires_at: expiresAt,
          token_type: "bearer",
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            aud: "authenticated",
            role: "authenticated",
            email: "evening-e2e@example.com",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    }, Math.floor(afterDelivery / 1000) + 3600);
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      authorizationHeader = route.request().headers().authorization;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "authenticated-data-delivery",
            sourcePhotoId: "authenticated-data-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await expect.poll(() => authorizationHeader).toBe("Bearer e2e-access-token");
  });

  test("releases a stalled Android exchange and retries automatically", async ({
    page,
  }) => {
    test.slow();
    let completedExchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-10T11:05:00.000Z");
    const capturedAt = Date.parse("2026-06-10T09:10:00.000Z");

    await seedMissingEveningTarget(page, {
      now: afterDelivery,
      capturedAt,
      catId: "android-timeout-cat",
      photoId: "android-timeout-photo",
      shared: true,
      captureContext: "daily",
    });
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      let didStallExchange = false;
      window.fetch = (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (
          !didStallExchange &&
          url.includes("/api/sleeping-delivery/exchange")
        ) {
          didStallExchange = true;
          (
            window as typeof window & { __stalledExchangeAborted?: boolean }
          ).__stalledExchangeAborted = false;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                (
                  window as typeof window & {
                    __stalledExchangeAborted?: boolean;
                  }
                ).__stalledExchangeAborted = true;
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          });
        }
        return originalFetch(input, init);
      };
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      completedExchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "android-timeout-delivery",
            sourcePhotoId: "android-timeout-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as typeof window & {
                  __stalledExchangeAborted?: boolean;
                }
              ).__stalledExchangeAborted === true,
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect
      .poll(() => completedExchangeCalls, { timeout: 25_000 })
      .toBe(1);

    const deliveredId = await page.evaluate(() => {
      const store = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );
      return store["2026-06-10"]?.deliveredPhoto?.id ?? null;
    });
    expect(deliveredId).toBe("android-timeout-delivery");
  });

  test("replays the exchange when the delivered letter cannot be persisted once", async ({
    page,
  }) => {
    const afterDelivery = Date.parse("2026-06-10T11:05:00.000Z");
    const capturedAt = Date.parse("2026-06-10T09:10:00.000Z");
    let exchangeCalls = 0;

    await seedMissingEveningTarget(page, {
      now: afterDelivery,
      capturedAt,
      catId: "delivery-write-retry-cat",
      photoId: "delivery-write-retry-photo",
      shared: true,
      captureContext: "daily",
    });
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem;
      let shouldFailDeliveredWriteBatch = true;
      let hasScheduledDeliveredWriteRecovery = false;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (
          key === "neteruneko_evening_delivery_days" &&
          String(value).includes('"deliveredPhoto"') &&
          shouldFailDeliveredWriteBatch
        ) {
          if (!hasScheduledDeliveredWriteRecovery) {
            hasScheduledDeliveredWriteRecovery = true;
            window.setTimeout(() => {
              shouldFailDeliveredWriteBatch = false;
            }, 0);
          }
          throw new DOMException("Quota exceeded for test", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "delivery-write-retry-delivery",
            sourcePhotoId: "delivery-write-retry-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await expect.poll(() => exchangeCalls, { timeout: 10_000 }).toBe(2);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const store = JSON.parse(
            window.localStorage.getItem("neteruneko_evening_delivery_days") ??
              "{}",
          );
          return store["2026-06-10"]?.deliveredPhoto?.id ?? null;
        }),
      )
      .toBe("delivery-write-retry-delivery");
  });

  test("does not repair private or onboarding-only photos into an evening target", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-10T11:05:00.000Z");
    const capturedAt = Date.parse("2026-06-10T09:10:00.000Z");

    await page.addInitScript(
      ({ now, capturedAtValue, photoSrc }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = now;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("active_cat_id", "repair-guard-cat");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "repair-guard-cat",
              name: "repair guard cat",
              createdAt: new Date(capturedAtValue).toISOString(),
              updatedAt: new Date(capturedAtValue).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "private-photo",
              ownerCatId: "repair-guard-cat",
              catId: "repair-guard-cat",
              src: photoSrc,
              visibility: "private",
              shared: false,
              triggerLabel: "sleeping",
              theme: "sleeping",
              createdAt: capturedAtValue,
              captureContext: "daily",
            },
            {
              id: "onboarding-photo",
              ownerCatId: "repair-guard-cat",
              catId: "repair-guard-cat",
              src: photoSrc,
              visibility: "shared",
              shared: true,
              triggerLabel: "sleeping",
              theme: "sleeping",
              createdAt: capturedAtValue - 60_000,
              captureContext: "onboarding",
            },
          ]),
        );
      },
      { now: afterDelivery, capturedAtValue: capturedAt, photoSrc: deliveredDataUrl },
    );
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ photo: null, source: "none" }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_800);
    expect(exchangeCalls).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("neteruneko_evening_delivery_days"),
        ),
      )
      .toBeNull();
  });

  test("updates the save sheet status when switching delivery mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "status-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "status-cat",
            name: "status cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
          {
            id: "status-cat-second",
            name: "second cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles(catPhotoFixturePath);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("exchange-share-status")).toHaveText(
      "よる8時に とどきます。",
    );
    await expect(page.getByTestId("exchange-share-submit")).toHaveText("のこす");
    await expect(page.getByTestId("exchange-share-submit")).toBeVisible();
    await expect(page.getByTestId("exchange-share-cat-status-cat-second")).toBeVisible();
    await expect(page.getByTestId("exchange-share-mode-shared")).toBeVisible();
    await expect(page.getByTestId("exchange-share-mode-private")).toBeVisible();
    const controlMetrics = await page.evaluate(() => {
      const submit = document.querySelector<HTMLElement>(
        '[data-testid="exchange-share-submit"]',
      );
      const shared = document.querySelector<HTMLElement>(
        '[data-testid="exchange-share-mode-shared"]',
      );
      const privateMode = document.querySelector<HTMLElement>(
        '[data-testid="exchange-share-mode-private"]',
      );
      if (!submit || !shared || !privateMode) {
        return null;
      }

      const submitStyle = getComputedStyle(submit);
      const sharedStyle = getComputedStyle(shared);
      const privateStyle = getComputedStyle(privateMode);
      const preview = document.querySelector<HTMLElement>(
        "[data-exchange-share-preview]",
      );
      const previewStyle = preview ? getComputedStyle(preview) : null;
      return {
        submitHeight: submit.getBoundingClientRect().height,
        sharedHeight: shared.getBoundingClientRect().height,
        privateHeight: privateMode.getBoundingClientRect().height,
        submitBackground: submitStyle.backgroundColor,
        sharedBackground: sharedStyle.backgroundColor,
        privateBackground: privateStyle.backgroundColor,
        privateShadow: privateStyle.boxShadow,
        previewBorderWidth: previewStyle?.borderTopWidth ?? "",
        previewPadding: previewStyle?.paddingTop ?? "",
        previewShadow: previewStyle?.boxShadow ?? "",
      };
    });
    expect(controlMetrics).not.toBeNull();
    expect(controlMetrics?.submitHeight).toBeGreaterThanOrEqual(44);
    expect(controlMetrics?.sharedHeight).toBeGreaterThanOrEqual(44);
    expect(controlMetrics?.privateHeight).toBeGreaterThanOrEqual(44);
    expect(controlMetrics?.submitBackground).not.toBe(
      controlMetrics?.sharedBackground,
    );
    expect(controlMetrics?.submitBackground).not.toBe(
      controlMetrics?.privateBackground,
    );
    expect(controlMetrics?.privateShadow).toBe("none");
    expect(controlMetrics?.previewBorderWidth).toBe("1px");
    expect(controlMetrics?.previewPadding).toBe("0px");
    expect(controlMetrics?.previewShadow).toBe("none");
    if (process.env.CAPTURE_PHOTO_SAVE_SHEET === "1") {
      await page.screenshot({
        path: "artifacts/photo-save-sheet-320x568-shared.png",
        animations: "disabled",
      });
    }
    await expect
      .poll(() =>
        page.getByTestId("exchange-share-submit").evaluate((button) => {
          const rect = button.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);

    await expect(page.getByTestId("exchange-share-submit")).toHaveAttribute(
      "data-app-button-variant",
      "primary",
    );

    await expect
      .poll(async () => {
        const sharedBox = await page
          .getByTestId("exchange-share-mode-shared")
          .boundingBox();
        const privateBox = await page
          .getByTestId("exchange-share-mode-private")
          .boundingBox();
        const submitBox = await page
          .getByTestId("exchange-share-submit")
          .boundingBox();

        if (!sharedBox || !privateBox || !submitBox) {
          return false;
        }

        const modeBottom = Math.max(
          sharedBox.y + sharedBox.height,
          privateBox.y + privateBox.height,
        );

        return modeBottom + 8 <= submitBox.y;
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const submitBox = await page
          .getByTestId("exchange-share-submit")
          .boundingBox();
        const navBox = await page.locator("[data-app-bottom-nav]").boundingBox();

        if (!submitBox || !navBox) {
          return false;
        }

        return submitBox.y + submitBox.height < navBox.y;
      })
      .toBe(true);

    await page.getByTestId("exchange-share-mode-private").click();
    await expect(page.getByTestId("exchange-share-status")).toHaveText(
      "じぶんの記録にのこします。そとには出ません。",
    );
    if (process.env.CAPTURE_PHOTO_SAVE_SHEET === "1") {
      await page.screenshot({
        path: "artifacts/photo-save-sheet-320x568-private.png",
        animations: "disabled",
      });
    }

    await page.getByTestId("exchange-share-mode-shared").click();
    await expect(page.getByTestId("exchange-share-status")).toHaveText(
      "よる8時に とどきます。",
    );

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("exchange-share-submit")).toBeFocused();
    await expect
      .poll(() =>
        page.getByTestId("exchange-share-submit").evaluate((button) => {
          const style = getComputedStyle(button);
          return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
        }),
      )
      .toBe(true);

    await page.getByTestId("exchange-share-submit").click();
    await expect(page.getByTestId("exchange-share-submit")).toHaveText(
      "しまいました",
    );
    await expect(page.locator("[data-exchange-share-preview]")).toHaveAttribute(
      "data-save-state",
      "saved",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("keeps the primary save action readable across home ambient themes", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const phases = [
      { key: "morning", now: Date.parse("2026-06-10T00:00:00.000Z") },
      { key: "noon", now: Date.parse("2026-06-10T04:00:00.000Z") },
      { key: "evening", now: Date.parse("2026-06-10T09:00:00.000Z") },
      { key: "night", now: Date.parse("2026-06-10T12:00:00.000Z") },
    ] as const;

    await page.addInitScript((initialNow) => {
      (window as typeof window & { __testNow?: number }).__testNow = initialNow;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      const originalSetInterval = window.setInterval.bind(window);
      window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
        originalSetInterval(
          handler,
          timeout === 60_000 ? 50 : timeout,
          ...args,
        )) as typeof window.setInterval;
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "ambient-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "ambient-cat",
            name: "むぎ",
            createdAt: new Date(initialNow).toISOString(),
            updatedAt: new Date(initialNow).toISOString(),
          },
        ]),
      );
    }, phases[0].now);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles(catPhotoFixturePath);

    const dialog = page.getByRole("dialog");
    const submit = page.getByTestId("exchange-share-submit");
    await expect(dialog).toBeVisible();
    await expect(submit).toBeVisible();

    for (const phase of phases) {
      await page.evaluate((now) => {
        (window as typeof window & { __testNow?: number }).__testNow = now;
      }, phase.now);
      await expect(page.locator("html")).toHaveAttribute("data-paper-theme", phase.key);

      const visualState = await submit.evaluate((button) => {
        const parseRgb = (value: string) =>
          (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (value: string) => {
          const channels = parseRgb(value).map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return (
            0.2126 * channels[0] +
            0.7152 * channels[1] +
            0.0722 * channels[2]
          );
        };
        const style = getComputedStyle(button);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        const contrast =
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05);
        const rect = button.getBoundingClientRect();
        const preview = document.querySelector<HTMLElement>(
          "[data-exchange-share-preview]",
        );

        return {
          contrast,
          submitInViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
          previewHeight: preview?.getBoundingClientRect().height ?? 0,
        };
      });

      expect(visualState.contrast).toBeGreaterThanOrEqual(4.5);
      expect(visualState.submitInViewport).toBe(true);
      expect(visualState.previewHeight).toBeGreaterThanOrEqual(156);

      if (process.env.CAPTURE_PHOTO_SAVE_SHEET === "1") {
        if (phase.key === "morning") {
          await page.screenshot({
            path: "artifacts/photo-save-sheet-390x844-shared.png",
            animations: "disabled",
          });
          await page.screenshot({
            path: "artifacts/photo-save-sheet-ambient-morning.png",
            animations: "disabled",
          });
        }
        if (phase.key === "night") {
          await page.screenshot({
            path: "artifacts/photo-save-sheet-ambient-night.png",
            animations: "disabled",
          });
        }
      }
    }
  });

  test("keeps a home photo private when the user chooses 自分だけ", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "private-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "private-cat",
            name: "private cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "private-home-photo.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });

    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByTestId("exchange-share-mode-private").click();
    await page.getByTestId("exchange-share-submit").click();
    await waitForOwnSleepingPhotoCount(page, 1);

    const privatePhotoState = await page.evaluate(() => {
      const photos = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
          "[]",
      ) as { shared?: boolean; visibility?: string; ownerCatId?: string }[];
      const eveningDays = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      ) as Record<string, { targetOwnPhotoId?: string } | undefined>;
      const photo = photos.find((candidate) => candidate.ownerCatId === "private-cat");

      return {
        shared: photo?.shared,
        visibility: photo?.visibility,
        deliveryTargetId: eveningDays["2026-06-10"]?.targetOwnPhotoId ?? null,
      };
    });

    expect(privatePhotoState).toEqual({
      shared: false,
      visibility: "private",
      deliveryTargetId: null,
    });
  });

  test("defaults the save sheet to the previously selected cat", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "cat-mugi");
      window.localStorage.setItem(
        "neteruneko_exchange_share_cat_selection",
        JSON.stringify({ catId: "cat-ame" }),
      );
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-mugi",
            name: "むぎ",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
          {
            id: "cat-ame",
            name: "あめ",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "remember-cat.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("exchange-share-cat-cat-ame")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByTestId("exchange-share-cat-cat-mugi")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("uses the latest same-day retake as today's delivery photo", async ({
    page,
  }) => {
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "retake-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "retake-cat",
            name: "retake cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "first-sleeping.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);
    await waitForOwnSleepingPhotoCount(page, 1);
    await expect(page.getByTestId("home-retake-action")).toBeVisible();
    const firstTargetId = await readEveningTargetOwnPhotoId(page, "2026-06-10");
    expect(firstTargetId).toBeTruthy();

    await page.evaluate(
      (nextNow) => {
        (window as typeof window & { __testNow?: number }).__testNow = nextNow;
      },
      beforeDelivery + 60_000,
    );
    await page.getByTestId("home-retake-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "second-sleeping.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);
    await waitForOwnSleepingPhotoCount(page, 2);

    const storage = await page.evaluate(() => {
      const photos = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
          "[]",
      );
      const days = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );
      return {
        latestOwnPhotoId: Array.isArray(photos) ? photos[0]?.id : null,
        targetOwnPhotoId: days["2026-06-10"]?.targetOwnPhotoId ?? null,
      };
    });

    expect(storage.latestOwnPhotoId).toBeTruthy();
    expect(storage.latestOwnPhotoId).not.toBe(firstTargetId);
    expect(storage.targetOwnPhotoId).toBe(storage.latestOwnPhotoId);
  });

  test("uses the stored delivery target cat instead of the selected cat", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    let recipientCatId: string | null = null;
    const beforeDelivery = Date.parse("2026-06-10T10:59:00.000Z");
    const afterDelivery = Date.parse("2026-06-10T11:01:00.000Z");

    await page.addInitScript(
      ({ now, capturedAt, ownDataUrl }) => {
        (window as typeof window & { __testNow?: number }).__testNow = now;
        const originalDateNow = Date.now.bind(Date);
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "cat-other");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "cat-target",
              name: "むぎ",
              createdAt: new Date(now).toISOString(),
              updatedAt: new Date(now).toISOString(),
            },
            {
              id: "cat-other",
              name: "そら",
              createdAt: new Date(now).toISOString(),
              updatedAt: new Date(now).toISOString(),
            },
          ]),
        );
        const ownPhoto = {
          id: "target-cat-own-photo",
          ownerCatId: "cat-target",
          catId: "cat-target",
          src: ownDataUrl,
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: true,
          createdAt: capturedAt,
        };
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([ownPhoto]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-06-10": {
              dateKey: "2026-06-10",
              targetOwnPhotoId: ownPhoto.id,
              targetCatId: "cat-target",
              targetCapturedAt: capturedAt,
              targetPhoto: ownPhoto,
            },
          }),
        );
      },
      { now: afterDelivery, capturedAt: beforeDelivery, ownDataUrl: deliveredDataUrl },
    );

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      const body = route.request().postDataJSON() as { recipientCatId?: string };
      recipientCatId = body.recipientCatId ?? null;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: `delivered-target-cat-${Date.now()}`,
            sourcePhotoId: "source-target-cat",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
          diagnostics: {
            source: "remote",
            candidateCount: 1,
            normalCandidateCount: 1,
            fallbackCandidateCount: 0,
            fallbackActive: false,
          },
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect.poll(() => exchangeCalls).toBe(1);
    expect(recipientCatId).toBe("cat-target");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );
  });

  test("lets anonymous users open storage deliveries without signed-url API auth", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    let signedUrlCalls = 0;
    const beforeDelivery = Date.parse("2026-06-10T10:59:00.000Z");
    const afterDelivery = Date.parse("2026-06-10T11:01:00.000Z");
    const transientUrl = "https://delivery.example/anonymous-delivered.png";
    const storageSrc = "storage:admin-stock/sleeping/anonymous-delivered.png";
    const deliveredImage = Buffer.from(deliveredDataUrl.split(",")[1], "base64");

    await page.addInitScript(({ now, ownDataUrl }) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      const catId = "anonymous-storage-cat";
      const ownPhotoId = "anonymous-storage-own-photo";
      const dateKey = "2026-06-10";
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", catId);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: catId,
            name: "anonymous cat",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
      const ownPhoto = {
        id: ownPhotoId,
        ownerCatId: catId,
        catId,
        src: ownDataUrl,
        state: "sleeping",
        visibility: "private",
        deliveryStatus: "available",
        triggerLabel: "sleeping",
        theme: "sleeping",
        shared: false,
        createdAt: now,
      };
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([ownPhoto]),
      );
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          [dateKey]: {
            dateKey,
            targetOwnPhotoId: ownPhotoId,
            targetCatId: catId,
            targetCapturedAt: now,
            targetPhoto: ownPhoto,
          },
        }),
      );
    }, { now: beforeDelivery, ownDataUrl: deliveredDataUrl });

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      signedUrlCalls += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null, error: "auth_required" }),
      });
    });
    await page.route(transientUrl, async (route) => {
      await route.fulfill({
        contentType: "image/png",
        body: deliveredImage,
      });
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: `delivered-anon-storage-${Date.now()}`,
            sourcePhotoId: "stock-anonymous-storage",
            src: deliveredDataUrl,
            thumbnailSrc: deliveredDataUrl,
            displaySrc: deliveredDataUrl,
            originalSrc: storageSrc,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
          diagnostics: {
            source: "remote",
            candidateCount: 1,
            normalCandidateCount: 1,
            fallbackCandidateCount: 0,
            fallbackActive: false,
          },
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await advanceHomeClockTo(page, afterDelivery);

    await expect.poll(() => exchangeCalls).toBe(1);
    const openButton = page.getByTestId("desk-open-letter");
    await openButton.click();
    const openingPanel = page.getByTestId("evening-opening-pair");
    await expect(openingPanel).toBeVisible();
    await expect(openingPanel.locator("img")).toHaveCount(1);
    await expect(openingPanel.getByRole("button", { name: "閉じる" })).toHaveCount(0);
    await expect(
      openingPanel.getByRole("button", { name: "また、あした" }),
    ).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const store = JSON.parse(
            window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
          ) as Record<string, { deliveredPhoto?: { src?: string } }>;
          const deliveredDay = Object.values(store).find((day) =>
            Boolean(day.deliveredPhoto),
          );
          return deliveredDay?.deliveredPhoto?.src ?? "";
        }),
      )
      .toMatch(/^data:image\//);

    const openedDelivery = await page.evaluate(() => {
      const store = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      ) as Record<string, { openedAt?: number; keptAt?: number; deliveredPhoto?: { src?: string } }>;
      return Object.values(store).find((day) => Boolean(day.deliveredPhoto));
    });
    expect(openedDelivery?.openedAt).toBeTruthy();
    expect(openedDelivery?.keptAt).toBeTruthy();

    await openingPanel.getByRole("button", { name: "また、あした" }).click();
    expect(signedUrlCalls).toBe(0);
  });

  test("ignores the legacy six-hour lock and uses evening delivery copy", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const beforeDelivery = Date.parse("2026-06-10T10:50:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "locked-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "locked-cat",
            name: "mugi",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "lock_data_locked-cat",
        JSON.stringify({
          sleepingCounterLockedUntil: Date.now() + 6 * 60 * 60 * 1000,
        }),
      );
    }, beforeDelivery);

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: `delivered-test-${Date.now()}`,
            sourcePhotoId: "source-test-photo",
            src: deliveredDataUrl,
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

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByTestId("home-empty-action")).toBeVisible();
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);

    await waitForOwnSleepingPhotoCount(page, 1);
    expect(exchangeCalls).toBe(0);
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "2",
    );

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
    expect(storage.keptExchangePhotos).toHaveLength(0);
  });

  test("treats photos after 8pm as tomorrow delivery", async ({ page }) => {
    let exchangeCalls = 0;
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");
    const afterDelivery = Date.parse("2026-06-10T11:10:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "after-eight-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "after-eight-cat",
            name: "mugi",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, beforeDelivery);

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ photo: null, source: "none" }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "after-eight.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await page.evaluate((nextNow) => {
      (window as typeof window & { __testNow?: number }).__testNow = nextNow;
    }, afterDelivery);
    await confirmSleepingPhotoShare(page);

    await waitForOwnSleepingPhotoCount(page, 1);

    expect(exchangeCalls).toBe(0);

    const store = await page.evaluate(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      );

      return Object.keys(parsed);
    });

    expect(store).toContain("2026-06-11");
    expect(store).not.toContain("2026-06-10");
  });

  test("returns to the before state after an opened delivery rolls over to a new day", async ({
    page,
  }) => {
    const nextMorning = Date.parse("2026-06-11T00:30:00.000Z");

    await page.addInitScript((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "rollover-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "rollover-cat",
            name: "mugi",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          "2026-06-10": {
            dateKey: "2026-06-10",
            targetOwnPhotoId: "old-own",
            targetCatId: "rollover-cat",
            deliveredPhoto: {
              id: "old-delivered",
              src: "data:image/png;base64,iVBORw0KGgo=",
              title: "",
              subtitle: "",
              triggerLabel: "sleeping",
              theme: "sleeping",
              deliveredAt: now - 1000,
            },
            openedAt: now - 500,
            keptAt: now - 400,
          },
        }),
      );
    }, nextMorning);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByTestId("home-empty-action")).toBeVisible();
  });

  test("keeps today's kept evening delivery open on the home screen", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-10T12:30:00.000Z");

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ photo: null, source: "none" }),
      });
    });

    await page.addInitScript(
      ({ now, photoSrc }) => {
        (window as typeof window & { __testNow?: number }).__testNow = now;
        const originalDateNow = Date.now.bind(Date);
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("active_cat_id", "kept-today-cat");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "kept-today-cat",
              name: "kept today cat",
              createdAt: new Date(now).toISOString(),
              updatedAt: new Date(now).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "kept-today-own",
              ownerCatId: "kept-today-cat",
              catId: "kept-today-cat",
              src: photoSrc,
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: now - 60 * 60 * 1000,
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-06-10": {
              dateKey: "2026-06-10",
              targetOwnPhotoId: "kept-today-own",
              targetCatId: "kept-today-cat",
              targetCapturedAt: now - 60 * 60 * 1000,
              deliveredPhoto: {
                id: "kept-today-delivered",
                sourcePhotoId: "kept-today-source",
                src: photoSrc,
                title: "",
                subtitle: "",
                triggerLabel: "sleeping",
                theme: "sleeping",
                deliveredAt: now - 1000,
              },
              openedAt: now - 900,
              keptAt: now - 800,
            },
          }),
        );
      },
      { now: afterDelivery, photoSrc: deliveredDataUrl },
    );

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect.poll(() => exchangeCalls).toBe(0);
  });

  test("auto-opens missed delivery after 5am without keeping it on the home desk", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const nextMorning = Date.parse("2026-06-11T01:00:00.000Z");

    await page.addInitScript((payload) => {
      const { now, photoSrc } = payload as { now: number; photoSrc: string };
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "missed-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "missed-cat",
            name: "mugi",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          "2026-06-09": {
            dateKey: "2026-06-09",
            targetOwnPhotoId: "older-own",
            targetCatId: "missed-cat",
            targetCapturedAt: now - 2 * 24 * 60 * 60 * 1000,
          },
          "2026-06-10": {
            dateKey: "2026-06-10",
            targetOwnPhotoId: "latest-own",
            targetCatId: "missed-cat",
            targetCapturedAt: now - 24 * 60 * 60 * 1000,
          },
        }),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "older-own",
            catId: "missed-cat",
            ownerCatId: "missed-cat",
            src: photoSrc,
            triggerLabel: "sleeping",
            theme: "sleeping",
            createdAt: now - 2 * 24 * 60 * 60 * 1000,
          },
          {
            id: "latest-own",
            catId: "missed-cat",
            ownerCatId: "missed-cat",
            src: photoSrc,
            triggerLabel: "sleeping",
            theme: "sleeping",
            createdAt: now - 24 * 60 * 60 * 1000,
          },
        ]),
      );
    }, { now: nextMorning, photoSrc: deliveredDataUrl });

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "missed-delivered",
            sourcePhotoId: "missed-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: nextMorning,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
      { timeout: 15000 },
    );
    await expect.poll(() => exchangeCalls, { timeout: 15000 }).toBe(1);

    const store = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      ),
    );

    expect(store["2026-06-10"]?.deliveredPhoto?.id).toBe("missed-delivered");
    expect(store["2026-06-10"]?.openedAt).toBeTruthy();
    expect(store["2026-06-10"]?.openedBy).toBe("system");
    expect(store["2026-06-09"]?.skippedAt).toBeTruthy();
  });

  test("rescues a legacy evening target by matching the latest same-day own photo", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-11T11:08:00.000Z");
    const capturedAt = Date.parse("2026-06-11T09:32:00.000Z");

    await page.addInitScript(
      ({ now, capturedAtValue, photoSrc }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = now;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "legacy-cat");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "legacy-cat",
              name: "legacy cat",
              createdAt: new Date(capturedAtValue).toISOString(),
              updatedAt: new Date(capturedAtValue).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-06-11": {
              dateKey: "2026-06-11",
              targetOwnPhotoId: "missing-legacy-id",
              targetCatId: "legacy-cat",
              targetCapturedAt: capturedAtValue,
            },
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "old-photo-yesterday",
              ownerCatId: "legacy-cat",
              catId: "legacy-cat",
              src: photoSrc,
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: capturedAtValue - 24 * 60 * 60 * 1000,
            },
            {
              id: "legacy-same-day-photo",
              ownerCatId: "legacy-cat",
              catId: "legacy-cat",
              src: photoSrc,
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: capturedAtValue + 5 * 60 * 1000,
            },
          ]),
        );
      },
      { now: afterDelivery, capturedAtValue: capturedAt, photoSrc: deliveredDataUrl },
    );

    await page.route("**/api/presence", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ count: null }),
      });
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      const body = route.request().postDataJSON() as {
        ownPhoto?: { id?: string };
      };
      expect(body.ownPhoto?.id).toBe("legacy-same-day-photo");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "legacy-delivered",
            sourcePhotoId: "legacy-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect.poll(() => exchangeCalls).toBe(1);

    const store = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      ),
    );

    expect(store["2026-06-11"]?.deliveredPhoto?.id).toBe("legacy-delivered");
  });

  test("uses a storage reference for direct evening delivery matches", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-11T11:12:00.000Z");
    const capturedAt = Date.parse("2026-06-11T09:40:00.000Z");

    await page.addInitScript(
      ({ now, capturedAtValue, photoSrc }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = now;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "direct-storage-cat");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "direct-storage-cat",
              name: "direct storage cat",
              createdAt: new Date(capturedAtValue).toISOString(),
              updatedAt: new Date(capturedAtValue).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-06-11": {
              dateKey: "2026-06-11",
              targetOwnPhotoId: "direct-photo-with-storage-original",
              targetCatId: "direct-storage-cat",
              targetCapturedAt: capturedAtValue,
            },
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "direct-photo-with-storage-original",
              ownerCatId: "direct-storage-cat",
              catId: "direct-storage-cat",
              src: photoSrc,
              originalSrc: "storage://direct-storage-cat/sleeping/original.jpg",
              displaySrc: "storage://direct-storage-cat/sleeping/display.jpg",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: capturedAtValue,
            },
          ]),
        );
      },
      { now: afterDelivery, capturedAtValue: capturedAt, photoSrc: deliveredDataUrl },
    );

    await page.route("**/api/presence", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ count: null }),
      });
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      const body = route.request().postDataJSON() as {
        ownPhoto?: { id?: string; src?: string };
      };
      expect(body.ownPhoto?.id).toBe("direct-photo-with-storage-original");
      expect(body.ownPhoto?.src).toBe(
        "storage:direct-storage-cat/sleeping/display.jpg",
      );
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "direct-storage-delivered",
            sourcePhotoId: "direct-storage-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect.poll(() => exchangeCalls).toBe(1);
  });

  test("sends a storage-only direct evening photo reference to exchange", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-11T11:14:00.000Z");
    const capturedAt = Date.parse("2026-06-11T09:45:00.000Z");
    const storageSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600">
        <rect width="1600" height="1600" fill="#f6efe4"/>
        <circle cx="800" cy="800" r="520" fill="#b8917a"/>
        <circle cx="620" cy="680" r="90" fill="#2f2924"/>
        <circle cx="980" cy="680" r="90" fill="#2f2924"/>
      </svg>`,
    );

    await page.addInitScript(
      ({ now, capturedAtValue }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = now;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "storage-only-cat");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "storage-only-cat",
              name: "storage only cat",
              createdAt: new Date(capturedAtValue).toISOString(),
              updatedAt: new Date(capturedAtValue).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-06-11": {
              dateKey: "2026-06-11",
              targetOwnPhotoId: "storage-only-photo",
              targetCatId: "storage-only-cat",
              targetCapturedAt: capturedAtValue,
            },
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "storage-only-photo",
              ownerCatId: "storage-only-cat",
              catId: "storage-only-cat",
              src: "storage:test-user/storage-only-cat/sleeping/display.jpg",
              originalSrc:
                "storage:test-user/storage-only-cat/sleeping/original.jpg",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: capturedAtValue,
            },
          ]),
        );
      },
      { now: afterDelivery, capturedAtValue: capturedAt },
    );

    await page.route("**/storage/v1/object/**", async (route) => {
      await route.fulfill({
        contentType: "image/svg+xml",
        body: storageSvg,
      });
    });
    await page.route("**/api/presence", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ count: null }),
      });
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      const body = route.request().postDataJSON() as {
        ownPhoto?: { id?: string; src?: string };
      };
      expect(body.ownPhoto?.id).toBe("storage-only-photo");
      expect(body.ownPhoto?.src).toBe(
        "storage:test-user/storage-only-cat/sleeping/display.jpg",
      );
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "storage-only-delivered",
            sourcePhotoId: "storage-only-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect.poll(() => exchangeCalls).toBe(1);
  });

  test("delivers from the stored target photo when a logged-in restore has no own photo row", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const afterDelivery = Date.parse("2026-06-11T11:05:00.000Z");

    await page.addInitScript(
      ({ now, photoSrc }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = now;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "logged-in-cat");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "logged-in-cat",
              name: "login cat",
              createdAt: new Date(now).toISOString(),
              updatedAt: new Date(now).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-06-11": {
              dateKey: "2026-06-11",
              targetOwnPhotoId: "restored-target-only",
              targetCatId: "logged-in-cat",
              targetCapturedAt: now - 2 * 60 * 60 * 1000,
              targetPhoto: {
                id: "restored-target-only",
                ownerCatId: "logged-in-cat",
                catId: "logged-in-cat",
                src: photoSrc,
                triggerLabel: "sleeping",
                theme: "sleeping",
                shared: true,
                createdAt: now - 2 * 60 * 60 * 1000,
              },
            },
          }),
        );
        window.localStorage.removeItem("nyaruhodo_exchange_own_sleeping_photos");
      },
      { now: afterDelivery, photoSrc: deliveredDataUrl },
    );

    await page.route("**/api/admin/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isAdmin: false,
          testToolsEnabled: false,
          stockAdminEnabled: false,
        }),
      });
    });
    await page.route("**/api/beta/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: true,
          isBetaParticipant: true,
          feedbackEnabled: true,
          supporterVoiceEnabled: true,
        }),
      });
    });
    await page.route("**/api/billing/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: true,
          billingConfigured: true,
          isBetaSupporter: false,
          status: "none",
          canManageBilling: false,
        }),
      });
    });
    await page.route("**/api/presence", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ count: null }),
      });
    });
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      const body = route.request().postDataJSON() as {
        ownPhoto?: { id?: string };
      };
      expect(body.ownPhoto?.id).toBe("restored-target-only");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "restored-delivered",
            sourcePhotoId: "restored-source",
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: afterDelivery,
          },
          source: "remote",
        }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect.poll(() => exchangeCalls).toBe(1);

    const store = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
      ),
    );

    expect(store["2026-06-11"]?.deliveredPhoto?.id).toBe("restored-delivered");
  });

  test("keeps the full photo ledger when iOS storage shrinks the local cache", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const existingLargePhotoSrc = deliveredDataUrl;
    const beforeDelivery = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript(({ largePhotoSrc, now }) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "quota-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "quota-cat",
            name: "quota cat",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "existing-large-sleeping-photo",
            ownerCatId: "quota-cat",
            catId: "quota-cat",
            src: largePhotoSrc,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: false,
            createdAt: now - 24 * 60 * 60 * 1000,
          },
        ]),
      );

      const originalSetItem = Storage.prototype.setItem;

      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (key === "nyaruhodo_exchange_own_sleeping_photos") {
          try {
            const parsed = JSON.parse(String(value));
            if (
              Array.isArray(parsed) &&
              parsed.length > 1 &&
              parsed.some((photo) =>
                photo?.id === "existing-large-sleeping-photo" &&
                String(photo?.src ?? "") === largePhotoSrc,
              )
            ) {
              throw new DOMException("Quota exceeded for test", "QuotaExceededError");
            }
          } catch (error) {
            if (error instanceof DOMException) {
              throw error;
            }
          }
        }

        return originalSetItem.call(this, key, value);
      };
    }, { largePhotoSrc: existingLargePhotoSrc, now: beforeDelivery });

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ photo: null, source: "none" }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("home-empty-action").click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping-new.png",
      mimeType: "image/png",
      buffer: testUploadPng,
    });
    await confirmSleepingPhotoShare(page);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("neteruneko-durable-state", 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const entries = await new Promise<unknown[]>((resolve, reject) => {
            const transaction = database.transaction("records", "readonly");
            const request = transaction
              .objectStore("records")
              .get("photo-history:own:v1");
            request.onsuccess = () =>
              resolve(Array.isArray(request.result?.value) ? request.result.value : []);
            request.onerror = () => reject(request.error);
          });
          database.close();
          return entries.length;
        }),
      )
      .toBeGreaterThanOrEqual(2);

    expect(exchangeCalls).toBe(0);

    const storage = await page.evaluate(() => {
      const readArray = (key: string) => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      return readArray("nyaruhodo_exchange_own_sleeping_photos").map((photo) => ({
        id: photo?.id,
        src: photo?.src,
      }));
    });

    expect(storage).toHaveLength(1);
    expect(String(storage[0]?.src)).toMatch(/^data:image\//);

    await page.goto("/collection");
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(2);
  });

  test("keeps separate taken photos even when saved in the same millisecond", async ({
    page,
  }) => {
    const fixedNow = Date.parse("2026-06-10T10:30:00.000Z");

    await page.addInitScript((now) => {
      const originalDateNow = Date.now.bind(Date);

      Date.now = () => now;
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", "same-ms-cat");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "same-ms-cat",
            name: "same ms cat",
            createdAt: new Date(originalDateNow()).toISOString(),
            updatedAt: new Date(originalDateNow()).toISOString(),
          },
        ]),
      );
    }, fixedNow);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    for (const index of [1, 2]) {
      await page.getByTestId("home-empty-action").click();
      await page.locator('input[type="file"]').last().setInputFiles({
        name: `same-ms-${index}.png`,
        mimeType: "image/png",
        buffer: testUploadPng,
      });
      await confirmSleepingPhotoShare(page);
      await waitForOwnSleepingPhotoCount(page, index);
      if (index === 1) {
        await page.evaluate(() => {
          window.localStorage.removeItem("neteruneko_evening_delivery_days");
          const photos = JSON.parse(
            window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
              "[]",
          );
          if (Array.isArray(photos)) {
            window.localStorage.setItem(
              "nyaruhodo_exchange_own_sleeping_photos",
              JSON.stringify(
                photos.map((photo) =>
                  photo && typeof photo === "object"
                    ? {
                        ...photo,
                        createdAt:
                          typeof photo.createdAt === "number"
                            ? photo.createdAt - 24 * 60 * 60 * 1000
                            : photo.createdAt,
                      }
                    : photo,
                ),
              ),
            );
          }
        });
        await page.goto("/home");
        await page.waitForLoadState("networkidle");
      }
    }

    const storage = await page.evaluate(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
          "[]",
      );

      return Array.isArray(parsed)
        ? parsed.map((photo) => ({ id: photo.id, src: photo.src }))
        : [];
    });

    expect(storage).toHaveLength(2);
    expect(new Set(storage.map((photo) => photo.id)).size).toBe(2);
    expect(storage.every((photo) => String(photo.src).startsWith("data:image/"))).toBe(true);

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(2);
  });
});

async function seedMissingEveningTarget(
  page: Page,
  {
    now,
    capturedAt,
    catId,
    photoId,
    shared,
    captureContext,
  }: {
    now: number;
    capturedAt: number;
    catId: string;
    photoId: string;
    shared: boolean;
    captureContext: "daily" | "onboarding";
  },
) {
  await page.addInitScript(
    ({ nowValue, capturedAtValue, catIdValue, photoIdValue, isShared, context, photoSrc }) => {
      const originalDateNow = Date.now.bind(Date);
      (window as typeof window & { __testNow?: number }).__testNow = nowValue;
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("neteruneko_onboarding_completed", "true");
      window.localStorage.setItem("active_cat_id", catIdValue);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: catIdValue,
            name: "repair cat",
            createdAt: new Date(capturedAtValue).toISOString(),
            updatedAt: new Date(capturedAtValue).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: photoIdValue,
            ownerCatId: catIdValue,
            catId: catIdValue,
            src: photoSrc,
            visibility: isShared ? "shared" : "private",
            shared: isShared,
            triggerLabel: "sleeping",
            theme: "sleeping",
            createdAt: capturedAtValue,
            captureContext: context,
          },
        ]),
      );
      window.localStorage.removeItem("neteruneko_evening_delivery_days");
    },
    {
      nowValue: now,
      capturedAtValue: capturedAt,
      catIdValue: catId,
      photoIdValue: photoId,
      isShared: shared,
      context: captureContext,
      photoSrc: deliveredDataUrl,
    },
  );
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

async function advanceHomeClockTo(page: Page, now: number) {
  await page.evaluate((nextNow) => {
    (window as typeof window & { __testNow?: number }).__testNow = nextNow;
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  }, now);
}
