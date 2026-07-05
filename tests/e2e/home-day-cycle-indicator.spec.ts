import { expect, test, type Page } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const currentJstDateKey = getCurrentJstDateKey();
const beforeEight = getCurrentJstTime(19, 30);
const wellBeforeEight = getCurrentJstTime(18, 0);
const afterEight = getCurrentJstTime(20, 10);

test.describe("home desk state cycle", () => {
  test("maps home states to day-cycle indicator classes", async ({ page }) => {
    await seedHomeState(page, { now: beforeEight });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );

    await seedHomeState(page, {
      now: wellBeforeEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
      },
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "2",
    );

    await seedHomeState(page, {
      now: afterEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
        deliveredPhoto: buildDeliveredPhoto(),
        deliveredAt: beforeEight,
      },
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );

    await seedHomeState(page, {
      now: afterEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
        deliveredPhoto: buildDeliveredPhoto(),
        deliveredAt: beforeEight,
        openedAt: beforeEight,
      },
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
  });

  test("opens delivery from the state 3 desk letter", async ({ page }) => {
    await seedHomeState(page, {
      now: afterEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
        deliveredPhoto: buildDeliveredPhoto(),
        deliveredAt: beforeEight,
      },
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    const openButton = page.getByTestId("desk-open-letter");
    await openButton.click();

    await expect(page.getByTestId("evening-opening-pair")).toBeVisible();
  });

  test("keeps the evening delivery state independent of the selected cat", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ nowValue, dateKey, src }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = nowValue;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.clear();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "cat-other");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "cat-home",
              name: "むぎ",
              createdAt: new Date(nowValue).toISOString(),
              updatedAt: new Date(nowValue).toISOString(),
            },
            {
              id: "cat-other",
              name: "そら",
              createdAt: new Date(nowValue).toISOString(),
              updatedAt: new Date(nowValue).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "own-today",
              ownerCatId: "cat-home",
              catId: "cat-home",
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: nowValue,
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [dateKey]: {
              dateKey,
              targetOwnPhotoId: "own-today",
              targetCatId: "cat-home",
              targetCapturedAt: nowValue,
              deliveredPhoto: {
                id: "delivered-today",
                sourcePhotoId: "source-today",
                src,
                triggerLabel: "sleeping",
                theme: "sleeping",
                deliveredAt: nowValue,
              },
              deliveredAt: nowValue,
            },
          }),
        );
      },
      { nowValue: afterEight, dateKey: currentJstDateKey, src: photoDataUrl },
    );

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(1);
  });

  test("omits motif animation classes when reduced motion is enabled", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedHomeState(page, {
      now: wellBeforeEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
      },
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".day-cycle-dot-flow")).toHaveCount(0);
    await expect(page.locator(".day-cycle-camera-fill")).toHaveCount(0);
  });

  test("hides routine subcopy after ten exchanges but keeps the end-of-day copy", async ({
    page,
  }) => {
    await seedHomeState(page, {
      now: beforeEight,
      keptExchangePhotoCount: 10,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByText("むぎ、ねてる?")).toHaveCount(0);

    await seedHomeState(page, {
      now: afterEight,
      keptExchangePhotoCount: 10,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1b",
    );
    await expect(page.getByText("きょうは とどかない")).toBeVisible();
    await expect(page.getByText("また あした")).toBeVisible();
  });

  test("removes the home wordmark while keeping page identity elsewhere", async ({
    page,
  }) => {
    await seedHomeState(page, { now: beforeEight });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("ねてるねこ", { exact: true })).toBeHidden();

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("ねこだより", { exact: true }).first()).toBeVisible();

    await page.goto("/cats");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: "うちのこ" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "記録" })).toBeVisible();
  });

  test("hides the presence line even when the presence api returns a count", async ({
    page,
  }) => {
    await page.route("/api/presence", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 124 }),
      });
    });
    await seedHomeState(page, { now: beforeEight });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/きょうも、.*ねこが ねています/)).toHaveCount(0);
  });

  test("omits the presence line when the presence api returns null", async ({
    page,
  }) => {
    await page.route("/api/presence", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: null }),
      });
    });
    await seedHomeState(page, { now: beforeEight });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/きょうも、.*ねこが ねています/)).toHaveCount(0);
  });

  test("keeps the home usable when the presence fetch fails", async ({ page }) => {
    await page.route("/api/presence", async (route) => {
      await route.abort();
    });
    await seedHomeState(page, { now: beforeEight });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByText(/きょうも、.*ねこが ねています/)).toHaveCount(0);
  });

  test("keeps the home frame usable on mobile viewports", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      await seedHomeState(page, {
        now: wellBeforeEight,
        eveningDay: {
          dateKey: currentJstDateKey,
          targetOwnPhotoId: "own-today",
          targetCatId: "cat-home",
          targetCapturedAt: beforeEight,
        },
      });

      await page.goto("/home");
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
        "data-state",
        "2",
      );

      const frameBox = await page.getByTestId("desk-home-frame").boundingBox();
      expect(frameBox).not.toBeNull();
      expect(frameBox!.width).toBeLessThanOrEqual(viewport.width - 24);
      expect(frameBox!.height).toBeGreaterThan(220);
      await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    }
  });
});

async function seedHomeState(
  page: Page,
  {
    now,
    eveningDay,
    keptExchangePhotoCount = 0,
  }: {
    now: number;
    eveningDay?: Record<string, unknown>;
    keptExchangePhotoCount?: number;
  },
) {
  await page.addInitScript(
    ({ nowValue, eveningDayValue, keptCount, src }) => {
      const originalDateNow = Date.now.bind(Date);
      (window as typeof window & { __testNow?: number }).__testNow = nowValue;
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.clear();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("neteruneko_onboarding_completed", "true");
      window.localStorage.setItem("active_cat_id", "cat-home");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-home",
            name: "ミケ",
            createdAt: new Date(nowValue).toISOString(),
            updatedAt: new Date(nowValue).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "own-today",
            ownerCatId: "cat-home",
            catId: "cat-home",
            src,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: true,
            createdAt: nowValue,
          },
        ]),
      );
      if (eveningDayValue) {
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [eveningDayValue.dateKey as string]: eveningDayValue,
          }),
        );
      }
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify(
          Array.from({ length: keptCount }, (_, index) => ({
            id: `kept-${index}`,
            src,
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: nowValue - index,
          })),
        ),
      );
    },
    {
      nowValue: now,
      eveningDayValue: eveningDay ?? null,
      keptCount: keptExchangePhotoCount,
      src: photoDataUrl,
    },
  );
}

function buildDeliveredPhoto() {
  return {
    id: "delivered-today",
    sourcePhotoId: "source-today",
    src: photoDataUrl,
    triggerLabel: "sleeping",
    theme: "sleeping",
    deliveredAt: beforeEight,
  };
}

function getCurrentJstDateKey() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentJstTime(hour: number, minute: number) {
  const [year, month, day] = currentJstDateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day, hour - 9, minute);
}
