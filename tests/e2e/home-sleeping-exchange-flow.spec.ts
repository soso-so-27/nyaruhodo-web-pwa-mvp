import { expect, test } from "@playwright/test";

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
  test("saves the taken photo with compression fallback and keeps the delivered photo", async ({
    page,
  }) => {
    let exchangeCalls = 0;

    await page.addInitScript(() => {
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
    });

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

    await page.locator("section").first().locator("button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping.svg",
      mimeType: "image/svg+xml",
      buffer: testSvg,
    });

    await expect(page.locator("section").last().locator("img")).toBeVisible();
    await page.locator("section").last().locator("button").last().click();

    await expect.poll(() => exchangeCalls).toBe(1);
    await expect(page.locator("section").last().locator("img")).toBeVisible();
    await page.locator("section").last().locator("button").nth(1).click();

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

  test("keeps the taken photo without promising delivery while delivery is locked", async ({
    page,
  }) => {
    let exchangeCalls = 0;

    await page.addInitScript(() => {
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
    });

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
    await expect(page.getByText("とったねがおに入ります")).toBeVisible();
    await expect(page.getByText("つぎのねがおまで")).toBeVisible();
    await expect(page.getByText(/あと .*時間/)).toBeVisible();

    await page.locator("section").first().locator("button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "home-sleeping.svg",
      mimeType: "image/svg+xml",
      buffer: testSvg,
    });

    await expect(page.locator("section").last().locator("img")).toBeVisible();
    await expect(page.getByText("とったねがおには入ります。")).toBeVisible();
    await expect(page.getByText("まだ届かない")).toBeVisible();
    await page.locator("section").last().locator("button").last().click();

    await page.waitForTimeout(500);
    expect(exchangeCalls).toBe(0);
    await expect(page.getByText("ねがおがとどきました")).toHaveCount(0);

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

  test("keeps multiple taken photos when iOS storage rejects the first multi-photo write", async ({
    page,
  }) => {
    let exchangeCalls = 0;

    await page.addInitScript(() => {
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

      const originalSetItem = Storage.prototype.setItem;
      let rejectedMultiPhotoWrites = 0;

      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (key === "nyaruhodo_exchange_own_sleeping_photos") {
          try {
            const parsed = JSON.parse(String(value));
            if (Array.isArray(parsed) && parsed.length > 1 && rejectedMultiPhotoWrites < 3) {
              rejectedMultiPhotoWrites += 1;
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
    });

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ photo: null, source: "none" }),
      });
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    for (const index of [1, 2]) {
      await page.locator("section").first().locator("button").first().click();
      await page.locator('input[type="file"]').last().setInputFiles({
        name: `home-sleeping-${index}.svg`,
        mimeType: "image/svg+xml",
        buffer: testSvg,
      });
      await expect(page.locator("section").last().locator("img")).toBeVisible();
      await page.locator("section").last().locator("button").last().click();
      await page.waitForTimeout(200);
    }

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
  });
});
