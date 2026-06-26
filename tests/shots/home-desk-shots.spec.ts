import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const shotsDir = path.resolve(workspaceRoot, "artifacts", "shots");
const expectedShotNames = [
  "state1_morning_week1.png",
  "state1_morning_habit.png",
  "state2_0900.png",
  "state2_1400.png",
  "state2_1400_habit.png",
  "state2_1800.png",
  "state2_1800_habit.png",
  "state3_2005_week1.png",
  "state3_2005_habit.png",
  "state3_2005_with_omoide.png",
  "state4_2010_week1.png",
  "state4_2010_habit.png",
  "state4_home_frame_viewer.png",
  "state4_home_frame_viewer_close.png",
  "state1b_2030.png",
  "album_today.png",
  "mainichi_board_2.png",
  "mainichi_board_12.png",
  "mainichi_board_24.png",
  "mainichi_board_31.png",
  "mainichi_board_31_bundle_sheet.png",
  "mainichi_board_62.png",
  "mainichi_board_62_bundle_sheet.png",
  "mainichi_board_delivered_12.png",
  "mainichi_month_picker_5_years.png",
  "album_missing_cases.png",
  "album_missing_a.png",
  "album_missing_b.png",
  "album_missing_c.png",
  "album_bottom.png",
  "settings.png",
  "settings_admin_moderation.png",
  "cats.png",
  "onboarding_intro.png",
  "nav_close_up.png",
];

const ownDataUrl = readFixtureDataUrl("cat-photo-mugi.jpg");
const deliveredDataUrl = readFixtureDataUrl("cat-photo-letter.jpg");
const mainichiBoardDataUrls = Array.from({ length: 12 }, (_, index) =>
  readFixtureDataUrl(`mainichi-board-${String(index + 1).padStart(2, "0")}.png`),
);

test.beforeAll(() => {
  const normalizedShotsDir = path.normalize(shotsDir);
  const expectedRoot = path.normalize(path.resolve(workspaceRoot, "artifacts", "shots"));
  if (normalizedShotsDir !== expectedRoot) {
    throw new Error(`Unexpected shots output directory: ${shotsDir}`);
  }
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });
});

test.afterAll(() => {
  const missing = expectedShotNames.filter(
    (name) => !fs.existsSync(path.join(shotsDir, name)),
  );
  expect(missing, `Missing shot files: ${missing.join(", ")}`).toEqual([]);
});

test.describe("home desk model shots", () => {
  for (const shot of [
    {
      name: "state1_morning_week1",
      state: "1",
      now: "2026-06-10T23:30:00.000Z",
      habit: false,
      route: "/home",
    },
    {
      name: "state1_morning_habit",
      state: "1",
      now: "2026-06-10T23:30:00.000Z",
      habit: true,
      route: "/home",
    },
    {
      name: "state2_0900",
      state: "2",
      now: "2026-06-10T00:00:00.000Z",
      habit: false,
      route: "/home",
    },
    {
      name: "state2_1400",
      state: "2",
      now: "2026-06-10T05:00:00.000Z",
      habit: false,
      route: "/home",
    },
    {
      name: "state2_1400_habit",
      state: "2",
      now: "2026-06-10T05:00:00.000Z",
      habit: true,
      route: "/home",
    },
    {
      name: "state2_1800",
      state: "2",
      now: "2026-06-10T09:00:00.000Z",
      habit: false,
      route: "/home",
    },
    {
      name: "state2_1800_habit",
      state: "2",
      now: "2026-06-10T09:00:00.000Z",
      habit: true,
      route: "/home",
    },
    {
      name: "state3_2005_week1",
      state: "3",
      now: "2026-06-10T11:05:00.000Z",
      habit: false,
      route: "/home",
    },
    {
      name: "state3_2005_habit",
      state: "3",
      now: "2026-06-10T11:05:00.000Z",
      habit: true,
      route: "/home",
    },
    {
      name: "state3_2005_with_omoide",
      state: "3",
      now: "2026-06-10T11:05:00.000Z",
      habit: true,
      withOmoideCandidate: true,
      route: "/home",
    },
    {
      name: "state4_2010_week1",
      state: "4",
      now: "2026-06-10T11:10:00.000Z",
      habit: false,
      route: "/home",
    },
    {
      name: "state4_2010_habit",
      state: "4",
      now: "2026-06-10T11:10:00.000Z",
      habit: true,
      route: "/home",
    },
    {
      name: "state1b_2030",
      state: "1b",
      now: "2026-06-10T11:30:00.000Z",
      habit: false,
      route: "/home",
    },
    {
      name: "album_today",
      state: "4",
      now: "2026-06-10T11:10:00.000Z",
      habit: false,
      route: "/collection",
    },
  ] as const) {
    test(shot.name, async ({ page }) => {
      await seedReviewState(page, {
        now: Date.parse(shot.now),
        state: shot.state,
        habit: shot.habit,
        withOmoideCandidate: "withOmoideCandidate" in shot ? shot.withOmoideCandidate : false,
      });
      await page.goto(shot.route);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(shotsDir, `${shot.name}.png`),
        fullPage: true,
      });
    });
  }

  test("album_missing_cases", async ({ page }) => {
    await seedCollectionMissingCases(page);
    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("mainichi-photo-board")).toBeVisible();
    await expect(page.getByTestId("mainichi-board-photo-sent").first()).toBeVisible();
    await expect(page.getByTestId("album-daily-missing-letter")).toHaveCount(0);
    await page.screenshot({
      path: path.join(shotsDir, "album_missing_cases.png"),
      fullPage: true,
    });
    const sentPhoto = page.getByTestId("mainichi-board-photo-sent").first();
    await sentPhoto.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "center" }),
    );
    await sentPhoto.screenshot({
      path: path.join(shotsDir, "album_missing_a.png"),
    });
    await page.getByRole("tab", { name: "とどいた" }).click();
    const deliveredBoard = page.getByTestId("mainichi-photo-board");
    await expect(page.getByTestId("mainichi-board-empty")).toBeVisible();
    await deliveredBoard.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "center" }),
    );
    await deliveredBoard.screenshot({
      path: path.join(shotsDir, "album_missing_b.png"),
    });
    const board = page.getByTestId("mainichi-photo-board");
    await board.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "center" }),
    );
    await board.screenshot({
      path: path.join(shotsDir, "album_missing_c.png"),
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(shotsDir, "album_bottom.png"),
      fullPage: false,
    });
  });

  for (const count of [2, 12, 24, 31, 62] as const) {
    test(`mainichi_board_${count}`, async ({ page }) => {
      await seedMainichiBoardPhotoCount(page, count);
      await page.goto("/collection");
      await page.waitForLoadState("networkidle");
      await hideBottomNavForBoardShot(page);
      const board = page.getByTestId("mainichi-photo-board");
      await expect(board).toBeVisible();
      await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(
        count > 24 ? 18 : count,
      );
      if (count > 24) {
        await expect(page.getByTestId("mainichi-month-bundle-open")).toBeVisible();
      }
      await page.waitForTimeout(500);
      await board.screenshot({
        path: path.join(shotsDir, `mainichi_board_${count}.png`),
      });
      if (count > 24) {
        await page.getByTestId("mainichi-month-bundle-open").click();
        const bundleDayCount = await page.getByTestId("mainichi-month-bundle-day").count();
        expect(bundleDayCount).toBeGreaterThan(8);
        await page.screenshot({
          path: path.join(shotsDir, `mainichi_board_${count}_bundle_sheet.png`),
          fullPage: false,
        });
      }
    });
  }

  test("mainichi_board_delivered_12", async ({ page }) => {
    await seedMainichiBoardPhotoCount(page, 12, "delivered");
    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await hideBottomNavForBoardShot(page);
    await page.getByRole("tab", { name: "とどいた" }).click();
    const board = page.getByTestId("mainichi-photo-board");
    await expect(board).toBeVisible();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(12);
    await page.waitForTimeout(500);
    await board.screenshot({
      path: path.join(shotsDir, "mainichi_board_delivered_12.png"),
    });
  });

  test("mainichi_month_picker_5_years", async ({ page }) => {
    await seedMainichiLongTermMonths(page);
    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("mainichi-month-select").click();
    await expect(page.getByTestId("mainichi-month-picker-year-2030")).toBeVisible();
    await expect(page.getByTestId("mainichi-month-picker-year-2026")).toBeVisible();
    await expect(page.locator('[data-testid^="mainichi-month-picker-year-"]')).toHaveCount(
      5,
    );
    await expect(page.locator('[data-testid^="mainichi-month-picker-row-"]')).toHaveCount(
      12,
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shotsDir, "mainichi_month_picker_5_years.png"),
      fullPage: false,
    });
  });

  test("state4_home_frame_viewer", async ({ page }) => {
    await seedReviewState(page, {
      now: Date.parse("2026-06-10T11:10:00.000Z"),
      state: "4",
      habit: false,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("desk-home-frame").click();
    await expect(page.getByTestId("desk-photo-viewer")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shotsDir, "state4_home_frame_viewer.png"),
      fullPage: true,
    });
  });

  test("state4_home_frame_viewer_close", async ({ page }) => {
    await seedReviewState(page, {
      now: Date.parse("2026-06-10T11:10:00.000Z"),
      state: "4",
      habit: false,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("desk-home-frame").click();
    await expect(page.getByRole("button", { name: "閉じる" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shotsDir, "state4_home_frame_viewer_close.png"),
      fullPage: true,
    });
  });

  test("nav_close_up", async ({ page }) => {
    await seedReviewState(page, {
      now: Date.parse("2026-06-10T05:00:00.000Z"),
      state: "2",
      habit: false,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    const nav = page.getByRole("navigation", { name: "下部ナビゲーション" });
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    await page.screenshot({
      path: path.join(shotsDir, "nav_close_up.png"),
      clip: {
        x: Math.max(0, box!.x - 12),
        y: Math.max(0, box!.y - 16),
        width: box!.width + 24,
        height: box!.height + 28,
      },
    });
  });

  test("settings_admin_moderation", async ({ page }) => {
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
    await page.route("**/api/beta/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: true,
          isBetaParticipant: true,
          feedbackEnabled: true,
          supporterVoiceEnabled: false,
          isBetaSupporter: false,
        }),
      });
    });
    await page.route("**/api/billing/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: true,
          billingConfigured: false,
          isBetaSupporter: false,
          status: "none",
          canManageBilling: false,
        }),
      });
    });
    await page.route("**/api/sleeping-delivery/diagnostics", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          source: "remote",
          availableCount: 0,
          candidateCount: 0,
          excludedCount: 0,
          unusableCount: 0,
          blockedCount: 0,
          adminStockCount: 0,
          userSharedCount: 0,
          hiddenCount: 0,
          reportedCount: 0,
          rlsReadable: true,
          checkedAt: new Date().toISOString(),
        }),
      });
    });
    await page.route("**/api/reports", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ reports: [] }),
      });
    });
    await page.route("**/api/moderation/queue", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          moments: [
            {
              id: "moderation-shot-1",
              localMomentId: "local-moderation-shot-1",
              photoSrc: ownDataUrl,
              moderationStatus: "pending",
              deliveryStatus: "available",
              createdAt: "2026-06-10T02:40:00.000Z",
            },
          ],
          pendingCount: 1,
        }),
      });
    });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "管理" }).click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(shotsDir, "settings_admin_moderation.png"),
      fullPage: true,
    });
  });

  for (const shot of [
    { name: "settings", route: "/settings" },
    { name: "cats", route: "/cats" },
    { name: "onboarding_intro", route: "/onboarding?test=1" },
  ] as const) {
    test(shot.name, async ({ page }) => {
      await seedReviewState(page, {
        now: Date.parse("2026-06-10T05:00:00.000Z"),
        state: "2",
        habit: false,
      });
      await page.goto(shot.route);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(shotsDir, `${shot.name}.png`),
        fullPage: true,
      });
    });
  }
});

async function seedReviewState(
  page: Page,
  {
    now,
    state,
    habit,
    withOmoideCandidate = false,
  }: {
    now: number;
    state: "1" | "1b" | "2" | "3" | "4";
    habit: boolean;
    withOmoideCandidate?: boolean;
  },
) {
  await page.addInitScript(
    ({ now, state, habit, withOmoideCandidate, ownDataUrl, deliveredDataUrl }) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();

      const catId = "cat-shot-mugi";
      const dateKey = "2026-06-10";
      const ownPhoto = {
        id: "own-shot-today",
        ownerCatId: catId,
        catId,
        src: ownDataUrl,
        state: "sleeping",
        visibility: "private",
        deliveryStatus: "available",
        triggerLabel: "sleeping",
        theme: "sleeping",
        shared: true,
        createdAt: Date.parse("2026-06-10T02:40:00.000Z"),
      };
      const deliveredPhoto = {
        id: "delivered-shot-today",
        sourcePhotoId: "source-shot-today",
        src: deliveredDataUrl,
        title: "",
        subtitle: "",
        triggerLabel: "sleeping",
        theme: "sleeping",
        deliveredAt: Date.parse("2026-06-10T11:05:00.000Z"),
      };
      const store: Record<string, unknown> = {};

      window.localStorage.setItem("neteruneko_home_desk_model", "1");
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", catId);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: catId,
            name: "むぎ",
            createdAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
            updatedAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
          },
        ]),
      );

      const ownPhotos = [] as typeof ownPhoto[];
      const omoidePhoto = {
        ...ownPhoto,
        id: "own-shot-omoide-week",
        createdAt: Date.parse("2026-06-03T02:40:00.000Z"),
      };
      if (state !== "1" && state !== "1b") {
        ownPhotos.unshift(ownPhoto);
        store[dateKey] = {
          dateKey,
          targetOwnPhotoId: ownPhoto.id,
          targetCatId: catId,
          targetCapturedAt: ownPhoto.createdAt,
          targetPhoto: ownPhoto,
          ...(state === "3" || state === "4"
            ? {
                deliveredPhoto,
                deliveredAt: deliveredPhoto.deliveredAt,
              }
            : {}),
          ...(state === "4" ? { openedAt: deliveredPhoto.deliveredAt + 1000 } : {}),
        };
      }
      if (withOmoideCandidate) {
        ownPhotos.push(omoidePhoto);
      }

      if (habit) {
        store["2026-06-01"] = {
          dateKey: "2026-06-01",
          targetOwnPhotoId: "first-shot-target",
          targetCatId: catId,
          targetCapturedAt: Date.parse("2026-06-01T02:40:00.000Z"),
          skippedAt: Date.parse("2026-06-02T02:40:00.000Z"),
        };
      }

      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(ownPhotos),
      );
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify(store),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify(
          Array.from({ length: habit ? 6 : 1 }, (_, index) => ({
            ...deliveredPhoto,
            id: `kept-shot-${index}`,
            sourcePhotoId: `kept-source-${index}`,
          })),
        ),
      );
    },
    { now, state, habit, withOmoideCandidate, ownDataUrl, deliveredDataUrl },
  );

  await page.route("/api/presence", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 124 }),
    });
  });
}

async function hideBottomNavForBoardShot(page: Page) {
  await page.addStyleTag({
    content:
      'nav[aria-label="下部ナビゲーション"] { display: none !important; }',
  });
}

async function seedCollectionMissingCases(page: Page) {
  await page.addInitScript(
    ({ ownDataUrl }) => {
      const now = Date.parse("2026-06-10T12:00:00.000Z");
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();

      const catId = "cat-shot-mugi";
      window.localStorage.setItem("neteruneko_home_desk_model", "1");
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", catId);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: catId,
            name: "むぎ",
            createdAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
            updatedAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
          },
        ]),
      );

      const ownPhotos = [
        {
          id: "own-shot-missing-a",
          ownerCatId: catId,
          catId,
          src: ownDataUrl,
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: true,
          createdAt: Date.parse("2026-06-10T02:40:00.000Z"),
        },
        {
          id: "own-shot-undeliverable-b",
          ownerCatId: catId,
          catId,
          src: ownDataUrl,
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: true,
          createdAt: Date.parse("2026-06-09T02:40:00.000Z"),
        },
      ];

      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(ownPhotos),
      );
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          "2026-06-10": {
            dateKey: "2026-06-10",
            targetOwnPhotoId: "own-shot-missing-a",
            targetCatId: catId,
            targetCapturedAt: Date.parse("2026-06-10T02:40:00.000Z"),
            targetPhoto: ownPhotos[0],
          },
          "2026-06-09": {
            dateKey: "2026-06-09",
            targetOwnPhotoId: "own-shot-undeliverable-b",
            targetCatId: catId,
            targetCapturedAt: Date.parse("2026-06-09T02:40:00.000Z"),
            targetPhoto: ownPhotos[1],
            openedAt: Date.parse("2026-06-09T11:10:00.000Z"),
            openedBy: "system",
          },
          "2026-06-08": {
            dateKey: "2026-06-08",
            targetOwnPhotoId: "missing-own-shot-c",
            targetCatId: catId,
            targetCapturedAt: Date.parse("2026-06-08T02:40:00.000Z"),
            openedAt: Date.parse("2026-06-08T11:10:00.000Z"),
            openedBy: "system",
          },
        }),
      );
    },
    { ownDataUrl },
  );

  await page.route("/api/presence", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 124 }),
    });
  });
}

async function seedMainichiBoardPhotoCount(
  page: Page,
  count: number,
  side: "sent" | "delivered" = "sent",
) {
  await page.addInitScript(
    ({ count, side, ownDataUrl, deliveredDataUrl, mainichiBoardDataUrls }) => {
      const now = Date.parse("2026-06-20T12:00:00.000Z");
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();

      const cats = [
        {
          id: "cat-shot-mugi",
          name: "\u3080\u304e",
          createdAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
          updatedAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
        },
        {
          id: "cat-shot-ame",
          name: "\u3042\u3081",
          createdAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
          updatedAt: new Date(Date.parse("2026-06-01T00:00:00.000Z")).toISOString(),
        },
      ];
      const photos = Array.from({ length: count }, (_, index) => {
        const isFullMonthCase = count >= 31;
        const month = isFullMonthCase ? "07" : "06";
        const day = isFullMonthCase ? 31 - (index % 31) : count - index;
        const dateKey = `2026-${month}-${String(day).padStart(2, "0")}`;
        const cat = cats[index % cats.length];
        const createdAt =
          Date.parse(`${dateKey}T03:00:00.000Z`) +
          Math.floor(index / 31) * 1000 * 60 * 5;

        return {
          id: `mainichi-shot-${index}`,
          ownerCatId: cat.id,
          catId: cat.id,
          src:
            index % 9 === 0
              ? ownDataUrl
              : index % 9 === 4
                ? deliveredDataUrl
                : mainichiBoardDataUrls[index % mainichiBoardDataUrls.length],
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: true,
          createdAt,
          dateKey,
        };
      });
      const keptPhotos =
        side === "delivered"
          ? photos.map((photo, index) => ({
              id: `kept-mainichi-shot-${index}`,
              sourcePhotoId: `kept-mainichi-source-${index}`,
              src: photo.src,
              title: "\u3069\u3053\u304b\u306e\u306d\u304c\u304a",
              subtitle: "",
              triggerLabel: "sleeping",
              theme: "sleeping",
              deliveredAt: photo.createdAt,
            }))
          : [];
      const eveningStore =
        side === "delivered"
          ? Object.fromEntries(
              photos.map((photo, index) => [
                photo.dateKey,
                {
                  dateKey: photo.dateKey,
                  targetOwnPhotoId: `target-mainichi-shot-${index}`,
                  targetCatId: cats[index % cats.length].id,
                  targetCapturedAt: photo.createdAt - 1000 * 60 * 60,
                  deliveredPhoto: keptPhotos[index],
                  deliveredAt: photo.createdAt,
                  openedAt: photo.createdAt + 1000,
                  openedBy: "user",
                },
              ]),
            )
          : {};

      window.localStorage.setItem("neteruneko_home_desk_model", "1");
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", cats[0].id);
      window.localStorage.setItem("cat_profiles", JSON.stringify(cats));
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(side === "sent" ? photos : []),
      );
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify(eveningStore),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify(keptPhotos),
      );
    },
    { count, side, ownDataUrl, deliveredDataUrl, mainichiBoardDataUrls },
  );
}

async function seedMainichiLongTermMonths(page: Page) {
  await page.addInitScript(() => {
    const now = Date.parse("2031-01-10T12:00:00.000Z");
    (window as typeof window & { __testNow?: number }).__testNow = now;
    const originalDateNow = Date.now.bind(Date);
    Date.now = () =>
      (window as typeof window & { __testNow?: number }).__testNow ??
      originalDateNow();

    const cats = [
      {
        id: "cat-shot-mugi",
        name: "\u3080\u304e",
        createdAt: new Date(Date.parse("2026-01-01T00:00:00.000Z")).toISOString(),
        updatedAt: new Date(Date.parse("2026-01-01T00:00:00.000Z")).toISOString(),
      },
      {
        id: "cat-shot-ame",
        name: "\u3042\u3081",
        createdAt: new Date(Date.parse("2026-01-01T00:00:00.000Z")).toISOString(),
        updatedAt: new Date(Date.parse("2026-01-01T00:00:00.000Z")).toISOString(),
      },
    ];
    const origin = window.location.origin;
    const lightweightPhotoSrcs = [
      `${origin}/images/ui/mainichi-board-paper.webp`,
      `${origin}/images/ui/mainichi-board-paper-v2.webp`,
      `${origin}/images/home/generated-envelope-wide.png`,
    ];
    const photos = [];

    for (let monthIndex = 0; monthIndex < 60; monthIndex += 1) {
      const date = new Date(Date.UTC(2030, 11 - monthIndex, 1, 3, 0, 0));
      const year = date.getUTCFullYear();
      const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
      const monthPhotoCount =
        monthIndex % 6 === 0
          ? 31
          : monthIndex % 5 === 0
            ? 18
            : monthIndex % 4 === 0
              ? 12
              : monthIndex % 3 === 0
                ? 8
                : monthIndex % 2 === 0
                  ? 3
                  : 1;

      for (let index = 0; index < monthPhotoCount; index += 1) {
        const day = `${Math.max(1, 28 - (index % 28))}`.padStart(2, "0");
        const dateKey = `${year}-${month}-${day}`;
        const cat = cats[(monthIndex + index) % cats.length];

        photos.push({
          id: `long-mainichi-${year}-${month}-${index}`,
          ownerCatId: cat.id,
          catId: cat.id,
          src: lightweightPhotoSrcs[(monthIndex + index) % lightweightPhotoSrcs.length],
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: true,
          createdAt: Date.parse(`${dateKey}T03:00:00.000Z`) + index * 1000 * 60,
          dateKey,
        });
      }
    }

    window.localStorage.setItem("neteruneko_home_desk_model", "1");
    window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
    window.localStorage.setItem("active_cat_id", cats[0].id);
    window.localStorage.setItem("cat_profiles", JSON.stringify(cats));
    window.localStorage.setItem(
      "nyaruhodo_exchange_own_sleeping_photos",
      JSON.stringify(photos),
    );
    window.localStorage.setItem("neteruneko_evening_delivery_days", JSON.stringify({}));
    window.localStorage.setItem("nyaruhodo_exchange_kept_photos", JSON.stringify([]));
  });
}

function readFixtureDataUrl(fileName: string) {
  const filePath = path.resolve(workspaceRoot, "tests", "fixtures", fileName);
  const jpeg = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
