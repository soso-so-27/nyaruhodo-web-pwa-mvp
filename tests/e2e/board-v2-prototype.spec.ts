import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("board v2 prototype", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (new URL(window.location.href).searchParams.get("empty") === "1") {
        localStorage.removeItem("nyaruhodo_exchange_own_sleeping_photos");
        localStorage.removeItem("nyaruhodo_exchange_kept_photos");
        return;
      }

      function makeDataUrl(color: string) {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext("2d");
        if (!context) {
          return "";
        }
        context.fillStyle = color;
        context.fillRect(0, 0, 32, 32);
        context.fillStyle = "rgba(255,255,255,0.7)";
        context.beginPath();
        context.arc(11, 12, 5, 0, Math.PI * 2);
        context.arc(22, 12, 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(90,70,50,0.6)";
        context.fillRect(9, 22, 15, 3);
        return canvas.toDataURL("image/png");
      }

      const first = new Date("2026-07-08T12:00:00+09:00").getTime();
      const second = new Date("2026-07-08T09:00:00+09:00").getTime();
      const third = new Date("2026-07-07T21:00:00+09:00").getTime();
      const photos = [
        {
          id: `own-${first}`,
          catId: "cat-1",
          ownerCatId: "cat-1",
          src: makeDataUrl("#c77c63"),
          createdAt: first,
          state: "sleeping",
          visibility: "shared",
          deliveryStatus: "available",
          triggerLabel: "daily",
          theme: "sleeping",
          shared: true,
        },
        {
          id: `own-${second}`,
          catId: "cat-1",
          ownerCatId: "cat-1",
          src: makeDataUrl("#7898b2"),
          createdAt: second,
          state: "sleeping",
          visibility: "shared",
          deliveryStatus: "available",
          triggerLabel: "daily",
          theme: "sleeping",
          shared: true,
        },
        {
          id: `own-${third}`,
          catId: "cat-1",
          ownerCatId: "cat-1",
          src: makeDataUrl("#9a8062"),
          createdAt: third,
          state: "sleeping",
          visibility: "shared",
          deliveryStatus: "available",
          triggerLabel: "daily",
          theme: "sleeping",
          shared: true,
        },
      ];
      localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(photos),
      );
      localStorage.setItem("nyaruhodo_exchange_kept_photos", JSON.stringify([]));
    });
  });

  test("renders v2 in descending time order and shows date tape only at the first photo of each day", async ({
    page,
  }) => {
    await page.goto("/prototypes/board-v2");

    await expect(page.getByTestId("board-v2-prototype")).toBeVisible();
    await expect(page.getByTestId("board-v2-layout")).toBeVisible();

    const photos = page.getByTestId("board-v2-photo");
    await expect(photos).toHaveCount(3);

    const timestamps = await photos.evaluateAll((nodes) =>
      nodes.map((node) => Number((node as HTMLElement).dataset.timestamp)),
    );
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));

    await expect(page.getByTestId("board-v2-date-tape")).toHaveCount(2);
  });

  test("can switch between v2 and current comparison layouts", async ({ page }) => {
    await page.goto("/prototypes/board-v2");

    await page.getByTestId("board-v2-current").click();
    await expect(page.getByTestId("board-v2-current-layout")).toBeVisible();

    await page.getByTestId("board-v2-v2").click();
    await expect(page.getByTestId("board-v2-layout")).toBeVisible();
  });

  test("keeps empty real-data controls clickable instead of auto-locking on restore", async ({
    page,
  }) => {
    await page.goto("/prototypes/board-v2?empty=1");

    await expect(page.getByTestId("board-v2-restore-notice")).toBeVisible();
    await expect(page.getByTestId("board-v2-login-link")).toHaveAttribute(
      "href",
      "/account/create?returnTo=%2Fprototypes%2Fboard-v2",
    );
    await expect(page.getByTestId("board-v2-restore-account")).toBeEnabled();

    await page.getByTestId("board-v2-current").click();
    await expect(page.getByTestId("board-v2-current")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByTestId("board-v2-delivered").click();
    await expect(page.getByTestId("board-v2-delivered")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("keeps prototype routes covered by the production 404 gate", async () => {
    const layout = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/prototypes/layout.tsx"),
      "utf8",
    );

    expect(layout).toContain('process.env.VERCEL_ENV === "production"');
    expect(layout).toContain("notFound()");
  });

  test("exposes board v2 through an admin-only production route", async () => {
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

    expect(pageSource).toContain("requireAdminAccess");
    expect(pageSource).toContain('returnToPath="/admin/board-v2"');
    expect(analyticsSource).toContain("/admin/board-v2");
  });
});
