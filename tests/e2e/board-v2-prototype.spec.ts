import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("board v2 prototype", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      function makeDataUrl(color: string, width = 32, height = 32) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          return "";
        }
        context.fillStyle = color;
        context.fillRect(0, 0, width, height);
        context.fillStyle = "rgba(255,255,255,0.7)";
        context.beginPath();
        context.arc(width * 0.35, height * 0.42, Math.min(width, height) * 0.18, 0, Math.PI * 2);
        context.arc(width * 0.65, height * 0.42, Math.min(width, height) * 0.18, 0, Math.PI * 2);
        context.fill();
        return canvas.toDataURL("image/png");
      }

      const catId = "board-prototype-cat";
      const first = new Date("2026-07-08T12:00:00+09:00").getTime();
      window.localStorage.setItem("active_cat_id", catId);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: catId,
            name: "むぎ",
            createdAt: new Date(first).toISOString(),
            updatedAt: new Date(first).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: `own-${first}`,
            catId,
            ownerCatId: catId,
            src: makeDataUrl("#c77c63", 24, 48),
            createdAt: first,
            state: "sleeping",
            visibility: "shared",
            deliveryStatus: "available",
            triggerLabel: "daily",
            theme: "sleeping",
            shared: true,
          },
          {
            id: `own-${first - 3600000}`,
            catId,
            ownerCatId: catId,
            src: makeDataUrl("#7898b2", 48, 24),
            createdAt: first - 3600000,
            state: "sleeping",
            visibility: "shared",
            deliveryStatus: "available",
            triggerLabel: "daily",
            theme: "sleeping",
            shared: true,
          },
          {
            id: `own-${first - 86400000}`,
            catId,
            ownerCatId: catId,
            src: makeDataUrl("#9a8062"),
            createdAt: first - 86400000,
            state: "sleeping",
            visibility: "shared",
            deliveryStatus: "available",
            triggerLabel: "daily",
            theme: "sleeping",
            shared: true,
          },
        ]),
      );
      window.localStorage.setItem("nyaruhodo_exchange_kept_photos", "[]");
    });
  });

  test("uses the production collection shell and swaps only the v2 board", async ({ page }) => {
    await page.goto("/prototypes/board-v2?mode=v2&layout=natural&frame=f3&order=brightest");

    await expect(page.getByTestId("mainichi-photo-board")).toBeVisible();
    await expect(page.getByTestId("mainichi-month-select")).toBeVisible();
    await expect(page.getByTestId("mainichi-prototype-month-board")).toBeVisible();
    await expect(page.getByTestId("mainichi-prototype-photo")).toHaveCount(3);
    await expect(page.getByTestId("board-v2-settings-button")).toBeVisible();
  });

  test("uses the unchanged production board for the current comparison query", async ({ page }) => {
    await page.goto("/prototypes/board-v2?mode=current&layout=natural&frame=f3");

    await expect(page.getByTestId("mainichi-month-board")).toBeVisible();
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(3);
    await expect(page.getByTestId("mainichi-prototype-month-board")).toHaveCount(0);
  });

  test("offers the comparison controls in a mobile-friendly settings sheet", async ({ page }) => {
    await page.goto("/prototypes/board-v2?mode=v2&layout=crop&frame=f1&order=newest");

    await page.getByTestId("board-v2-settings-button").click();
    await expect(page.getByText("ボードの比較")).toBeVisible();
    await page.getByTestId("board-v2-option-layout-natural").click();
    await page.getByTestId("board-v2-option-frame-f3").click();
    await page.getByTestId("board-v2-option-order-brightest").click();
    await page.getByTestId("board-v2-option-mode-current").click();

    await expect(page).toHaveURL(/mode=current/);
    await expect(page).toHaveURL(/layout=natural/);
    await expect(page).toHaveURL(/frame=f3/);
    await expect(page).toHaveURL(/order=brightest/);
    await expect(page.getByTestId("mainichi-month-board")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem("neteruneko_board_v2_prototype_options")),
      )
      .toContain('"layout":"natural"');
  });

  test("keeps prototype routes covered by the production 404 gate", async () => {
    const layout = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/prototypes/layout.tsx"),
      "utf8",
    );

    expect(layout).toContain('process.env.VERCEL_ENV === "production"');
    expect(layout).toContain("notFound()");
  });

  test("exposes the same collection renderer through an admin-only production route", async () => {
    const pageSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/board-v2/page.tsx"),
      "utf8",
    );
    const analyticsSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/admin/analytics/AdminAnalyticsClient.tsx",
      ),
      "utf8",
    );

    expect(pageSource).toContain("AdminAccessGate");
    expect(pageSource).toContain("readBoardV2PrototypeOptions");
    expect(analyticsSource).toContain("/admin/board-v2");
  });
});
