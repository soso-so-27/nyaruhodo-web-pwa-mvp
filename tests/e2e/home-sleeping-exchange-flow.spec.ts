import { expect, test, type Page } from "@playwright/test";

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

test.describe("home sleeping exchange flow", () => {
  test("saves the taken photo, waits until evening, then keeps the delivered photo", async ({
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
            src: deliveredDataUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.now(),
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

    await page.getByRole("button", { name: "ねがおをとる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping.svg",
      mimeType: "image/svg+xml",
      buffer: testSvg,
    });

    await expect(page.locator("section").last().locator("img")).toBeVisible();
    await page.getByRole("button", { name: "とっておく" }).click();

    await page.waitForTimeout(500);
    expect(exchangeCalls).toBe(0);
    await expect(
      page.getByRole("heading", { name: "おあずかり中" }),
    ).toBeVisible();

    await page.evaluate((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
    }, afterDelivery);

    await expect.poll(() => exchangeCalls).toBe(1);
    await expect(page.getByText("ねがおが とどいています")).toBeVisible();
    await page.getByRole("button", { name: "ねがおをひらく" }).click();
    await expect(page.getByText("きょうの 2まい")).toBeVisible();
    await expect(page.getByTestId("evening-opening-pair").locator("img")).toHaveCount(2);
    await page.getByRole("button", { name: "とっておく" }).click();

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
    expect(storage.keptExchangePhotos[0]?.src).toMatch(/^data:image\//);
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
            src: storageSrc,
            thumbnailSrc: transientUrl,
            displaySrc: transientUrl,
            originalSrc: transientUrl,
            title: "",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.now(),
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

    await page.evaluate((now) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
    }, afterDelivery);

    await expect.poll(() => exchangeCalls).toBe(1);
    await page.locator("main button").first().click();
    await expect(page.getByTestId("evening-opening-pair")).toBeVisible();
    await expect(page.getByTestId("evening-opening-pair").locator("img")).toHaveCount(2);

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

    await page.getByTestId("evening-opening-pair").locator("button").last().click();
    await expect.poll(() => readKeptExchangePhotoCount(page)).toBe(1);
    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('main img[src^="data:image/"]')).toHaveCount(2);

    await page.unroute(transientUrl);
    await page.route(transientUrl, async (route) => {
      await route.fulfill({ status: 404, body: "" });
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('main img[src^="data:image/"]')).toHaveCount(2);
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
            name: "むぎ",
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

    await expect(page.getByText("とると、1枚とどく", { exact: true })).toHaveCount(0);
    await expect(page.getByText("とると、よる8じごろ とどく")).toBeVisible();
    await expect(page.getByTestId("day-cycle-indicator")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByText(/あと .*時間/)).toHaveCount(0);

    await page.getByRole("button", { name: "ねがおをとる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping.svg",
      mimeType: "image/svg+xml",
      buffer: testSvg,
    });

    await expect(page.locator("section").last().locator("img")).toBeVisible();
    await expect(page.getByText(/とっておくと、よる8じごろ とどきます。/)).toBeVisible();
    await page.getByRole("button", { name: "とっておく" }).click();

    await page.waitForTimeout(500);
    expect(exchangeCalls).toBe(0);
    await expect(page.getByText("ねがおが とどいています")).toHaveCount(0);

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
            name: "むぎ",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );
    }, afterDelivery);

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ photo: null, source: "none" }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("いまとると、あしたのよるに とどく", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "ねがおをとる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "after-eight.svg",
      mimeType: "image/svg+xml",
      buffer: testSvg,
    });

    await expect(page.locator("section").last().locator("img")).toBeVisible();
    await expect(page.getByText(/とっておくと、あしたのよるに とどきます。/)).toBeVisible();
    await page.getByRole("button", { name: "とっておく" }).click();
    await page.waitForTimeout(500);

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
            name: "むぎ",
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

    await expect(page.getByText("ねがおが とどいています")).toHaveCount(0);
    await expect(page.getByText("きょうの 2まい")).toHaveCount(0);
    await expect(page.getByText("とると、よる8じごろ とどく")).toBeVisible();
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

    await expect(page.getByTestId("day-cycle-indicator")).toHaveAttribute(
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
            name: "むぎ",
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

    await expect(page.getByTestId("day-cycle-indicator")).toHaveAttribute(
      "data-state",
      "1",
      { timeout: 15000 },
    );
    expect(exchangeCalls).toBe(1);

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

  test("keeps multiple taken photos when iOS storage rejects the first multi-photo write", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    const existingLargePhotoSrc = deliveredDataUrl;

    await page.addInitScript((largePhotoSrc) => {
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
        "lock_data_quota-cat",
        JSON.stringify({
          sleepingCounterLockedUntil: Date.now() + 6 * 60 * 60 * 1000,
        }),
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
            createdAt: Date.now() - 1000,
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
    }, existingLargePhotoSrc);

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ photo: null, source: "none" }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "ねがおをとる" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping-new.svg",
      mimeType: "image/svg+xml",
      buffer: testSvg,
    });
    await expect(page.locator("section").last().locator("img")).toBeVisible();
    await page.getByRole("button", { name: "とっておく" }).click();
    await page.waitForTimeout(200);

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

    expect(storage).toHaveLength(2);
    expect(new Set(storage.map((photo) => photo.id)).size).toBe(2);
    expect(storage.every((photo) => String(photo.src).startsWith("data:image/"))).toBe(true);
    expect(storage.some((photo) => photo.id === "existing-large-sleeping-photo")).toBe(true);
    expect(
      storage.some(
        (photo) =>
          photo.id === "existing-large-sleeping-photo" &&
          String(photo.src) !== existingLargePhotoSrc,
      ),
    ).toBe(true);
  });

  test("keeps separate taken photos even when saved in the same millisecond", async ({
    page,
  }) => {
    const fixedNow = Date.now();

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
      window.localStorage.setItem(
        "lock_data_same-ms-cat",
        JSON.stringify({
          sleepingCounterLockedUntil: originalDateNow() + 6 * 60 * 60 * 1000,
        }),
      );
    }, fixedNow);

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    for (const index of [1, 2]) {
      await page
        .getByRole("button", {
          name: index === 1 ? "ねがおをとる" : "いまとると、アルバムに はいります",
        })
        .click();
      await page.locator('input[type="file"]').last().setInputFiles({
        name: `same-ms-${index}.svg`,
        mimeType: "image/svg+xml",
        buffer: testSvg,
      });
      await expect(page.locator("section").last().locator("img")).toBeVisible();
      await page.getByRole("button", { name: "とっておく" }).click();
      await page.waitForTimeout(500);
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

    await expect(page.locator("main img")).toHaveCount(2);
  });
});

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
