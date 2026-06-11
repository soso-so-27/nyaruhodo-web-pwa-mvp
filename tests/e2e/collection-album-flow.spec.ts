import { expect, test } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

test.describe("collection album flow", () => {
  test("shows taken sleeping photos even when older photos belong to a previous cat id", async ({
    page,
  }) => {
    const now = Date.now();

    await page.addInitScript(
      ({ currentCatId, previousCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
            {
              id: `own-sleeping-${createdAt - 1000}`,
              ownerCatId: previousCatId,
              catId: previousCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt: createdAt - 1000,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        previousCatId: "previous-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main img")).toHaveCount(2);
  });

  test("shows restored storage sleeping photos alongside latest local photos", async ({
    page,
  }) => {
    const now = Date.now();

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string };

      if (body.src === "storage:user-1/current-cat/sleeping/restored.jpg") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: photoDataUrl }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
            {
              id: `own-sleeping-${createdAt - 1000}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src: "storage:user-1/current-cat/sleeping/restored.jpg",
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt: createdAt - 1000,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main img")).toHaveCount(2);
  });

  test("shows legacy storage-url sleeping photos alongside latest local photos", async ({
    page,
  }) => {
    const now = Date.now();

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string };

      if (
        body.src === "storage://user-1/current-cat/sleeping/restored.jpg" ||
        body.src === "storage:user-1/current-cat/sleeping/restored.jpg"
      ) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: photoDataUrl }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
            {
              id: `own-sleeping-${createdAt - 1000}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src: "storage://user-1/current-cat/sleeping/restored.jpg",
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt: createdAt - 1000,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main img")).toHaveCount(2);
  });

  test("hides the other slot before the first evening delivery target day", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-10T10:00:00.000Z");
    const todayKey = "2026-06-10";
    const yesterdayAt = now - 24 * 60 * 60 * 1000;

    await page.addInitScript(
      ({ currentCatId, src, createdAt, olderCreatedAt, targetDateKey }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow =
          createdAt;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "ミケ",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [targetDateKey]: {
              dateKey: targetDateKey,
              targetOwnPhotoId: "own-sleeping-today",
              targetCatId: currentCatId,
              targetCapturedAt: createdAt,
            },
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "own-sleeping-today",
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt,
            },
            {
              id: "own-sleeping-yesterday",
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: olderCreatedAt,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
        olderCreatedAt: yesterdayAt,
        targetDateKey: todayKey,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('button[aria-label="どこかのこを開く"]')).toHaveCount(
      1,
    );
    await expect(page.getByText("この日は おやすみ")).toHaveCount(0);
  });
});
