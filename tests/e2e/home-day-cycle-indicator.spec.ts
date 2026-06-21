import { expect, test, type Page } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const beforeEight = Date.parse("2026-06-10T10:30:00.000Z");
const wellBeforeEight = Date.parse("2026-06-10T09:00:00.000Z");
const afterEight = Date.parse("2026-06-10T11:10:00.000Z");

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
        dateKey: "2026-06-10",
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
        dateKey: "2026-06-10",
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
        dateKey: "2026-06-10",
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
        dateKey: "2026-06-10",
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
    const box = await openButton.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1700);
    await page.mouse.up();

    await expect(page.getByTestId("evening-opening-pair")).toBeVisible();
  });

  test("omits motif animation classes when reduced motion is enabled", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedHomeState(page, {
      now: wellBeforeEight,
      eveningDay: {
        dateKey: "2026-06-10",
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
    await expect(page.getByText("まいにち", { exact: true }).first()).toBeVisible();

    await page.goto("/cats");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("うちのこ", { exact: true }).first()).toBeVisible();
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
          dateKey: "2026-06-10",
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
