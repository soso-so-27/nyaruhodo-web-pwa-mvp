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
  "state4_2010_week1.png",
  "state4_2010_habit.png",
  "state1b_2030.png",
  "album_today.png",
  "settings.png",
  "cats.png",
  "onboarding_intro.png",
  "nav_close_up.png",
];

const ownDataUrl = readFixtureDataUrl("cat-photo-mugi.jpg");
const deliveredDataUrl = readFixtureDataUrl("cat-photo-letter.jpg");

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
      });
      await page.goto(shot.route);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(shotsDir, `${shot.name}.png`),
        fullPage: true,
      });
    });
  }

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
  }: {
    now: number;
    state: "1" | "1b" | "2" | "3" | "4";
    habit: boolean;
  },
) {
  await page.addInitScript(
    ({ now, state, habit, ownDataUrl, deliveredDataUrl }) => {
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
    { now, state, habit, ownDataUrl, deliveredDataUrl },
  );

  await page.route("/api/presence", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 124 }),
    });
  });
}

function readFixtureDataUrl(fileName: string) {
  const filePath = path.resolve(workspaceRoot, "tests", "fixtures", fileName);
  const jpeg = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
