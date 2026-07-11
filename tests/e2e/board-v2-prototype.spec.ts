import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { THUMBNAIL_TRANSFORM } from "../../src/lib/photoStorage";

test.describe("production nekodayori natural board", () => {
  test.beforeEach(async ({ page }) => {
    await seedBoard(page, 3, true);
  });

  test("uses natural ratios, f3 frames, no date badges, and newest-first order", async ({
    page,
  }) => {
    await page.goto("/collection");

    const photos = page.getByTestId("mainichi-board-photo-sent");
    const board = page.getByTestId("mainichi-natural-board");
    await expect(board).toBeVisible();
    await expect(board).toHaveAttribute("data-board-algorithm", "current");
    await expect(photos).toHaveCount(3);

    const timestamps = await photos.evaluateAll((items) =>
      items.map((item) => Number(item.getAttribute("data-photo-timestamp"))),
    );
    expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left));

    const firstRatio = await photos.first().evaluate((item) => {
      const width = (item as HTMLElement).offsetWidth;
      const height = (item as HTMLElement).offsetHeight;
      return width / height;
    });
    expect(firstRatio).toBeCloseTo(0.5, 1);

    const frame = photos.first().locator("span").first();
    await expect(frame).toHaveCSS("border-top-width", "1px");
    await expect(frame).toHaveCSS("border-radius", "0px");
    await expect(page.locator('[data-mainichi-paste-tape="true"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mainichi-date-badge"]')).toHaveCount(0);

    await page.getByRole("tab", { name: "とどいた" }).click();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);
  });

  test("pastes every decoded photo onto the board with the staggered motion", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("neteruneko_collection_nav_entry", "1");
    });
    await page.goto("/collection");
    const photos = page.getByTestId("mainichi-board-photo-sent");
    await expect(photos).toHaveCount(3);
    const motion = await photos.evaluateAll((items) =>
      items.map((item) => ({
        delay: Number(item.getAttribute("data-mainichi-motion-delay")),
        fromOpacity: Number(
          item.getAttribute("data-mainichi-motion-from-opacity"),
        ),
        fromScale: Number(item.getAttribute("data-mainichi-motion-from-scale")),
      })),
    );
    const delays = motion.map((entry) => entry.delay);
    expect(delays).toEqual([...delays].sort((left, right) => left - right));
    expect(new Set(delays).size).toBe(3);
    expect(motion.every((entry) => entry.fromOpacity === 0)).toBe(true);
    expect(motion.every((entry) => entry.fromScale < 1)).toBe(true);
  });

  test("keeps the selected current placement for a dense 31-photo month", async ({
    page,
  }) => {
    await seedBoard(page, 31, false);
    await page.goto("/collection");

    const photos = page.getByTestId("mainichi-board-photo-sent");
    await expect(photos).toHaveCount(31);
    await expect(page.getByTestId("mainichi-natural-board")).toHaveAttribute(
      "data-board-algorithm",
      "current",
    );
    await photos.last().scrollIntoViewIfNeeded();
    await expect(photos.last()).toBeVisible();
  });

  test("uses plain display dimensions as the card ratio source", async ({ page }) => {
    const displaySrc = "storage:user-1/cat-1/sleeping/display/landscape.jpg";
    const transformedSrc =
      "data:image/svg+xml," +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="600"></svg>');
    const plainDisplaySrc =
      "data:image/svg+xml," +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"></svg>');
    const requests: Array<{ src?: string; variant?: string }> = [];

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string; variant?: string };
      requests.push(body);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          signedUrl: body.variant === "display" ? plainDisplaySrc : transformedSrc,
        }),
      });
    });
    await page.addInitScript(({ src }) => {
      const createdAt = new Date("2026-07-08T12:00:00+09:00").getTime();
      window.localStorage.setItem("active_cat_id", "board-cat");
      window.localStorage.setItem("cat_profiles", JSON.stringify([{ id: "board-cat", name: "むぎ" }]));
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: `own-${createdAt}`,
            catId: "board-cat",
            ownerCatId: "board-cat",
            src,
            thumbnailSrc: src,
            displaySrc: src,
            originalSrc: src,
            createdAt,
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
    }, { src: displaySrc });

    await page.goto("/collection");
    const photo = page.getByTestId("mainichi-board-photo-sent");
    await expect(photo).toHaveAttribute("data-display-natural-ratio", "2.000000");
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: displaySrc, variant: "thumbnail" }),
        expect.objectContaining({ src: displaySrc, variant: "display" }),
      ]),
    );
  });

  test("requests a contain transform for thumbnail delivery", () => {
    expect(THUMBNAIL_TRANSFORM).toEqual({
      quality: 75,
      resize: "contain",
      width: 800,
    });
  });

  test("keeps the review-only illustration comparison sheet available", async ({
    page,
  }) => {
    await page.goto("/prototypes/board-v2");
    await page.getByTestId("board-v2-settings-button").click();

    await expect(page.getByText("イラスト", { exact: true })).toBeVisible();
    await expect(page.getByTestId("cat-illustration-variant-current")).toBeVisible();
    await expect(page.getByTestId("cat-illustration-variant-theme-a")).toBeVisible();
    await expect(page.getByTestId("cat-illustration-variant-theme-b")).toBeVisible();
    await expect(page.getByTestId("cat-illustration-variant-theme-c")).toBeVisible();
  });

  test("keeps prototype routes covered by the production 404 gate", async () => {
    const layout = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/prototypes/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain('process.env.VERCEL_ENV === "production"');
    expect(layout).toContain("notFound()");
  });
});

async function seedBoard(page: Page, sentCount: number, includeDelivered: boolean) {
  await page.addInitScript(
    ({ count, delivered }) => {
      function makeDataUrl(color: string, width: number, height: number) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return "";
        context.fillStyle = color;
        context.fillRect(0, 0, width, height);
        context.fillStyle = "rgba(255,255,255,0.66)";
        context.beginPath();
        context.arc(width * 0.5, height * 0.45, Math.min(width, height) * 0.22, 0, Math.PI * 2);
        context.fill();
        return canvas.toDataURL("image/png");
      }

      const catId = "board-cat";
      const newest = new Date("2026-07-08T12:00:00+09:00").getTime();
      const shapes = [
        { width: 24, height: 48 },
        { width: 48, height: 24 },
        { width: 32, height: 32 },
      ];
      const sent = Array.from({ length: count }, (_, index) => {
        const shape = shapes[index % shapes.length];
        return {
          id: `own-${newest - index * 3_600_000}`,
          catId,
          ownerCatId: catId,
          src: makeDataUrl(`hsl(${(index * 37) % 360} 36% 58%)`, shape.width, shape.height),
          createdAt: newest - index * 3_600_000,
          state: "sleeping",
          visibility: "shared",
          deliveryStatus: "available",
          triggerLabel: "daily",
          theme: "sleeping",
          shared: true,
        };
      });
      const kept = delivered
        ? [
            {
              id: "delivered-board",
              sourcePhotoId: "stock-board",
              src: makeDataUrl("#8b6f62", 48, 32),
              title: "とどいたねがお",
              subtitle: "",
              triggerLabel: "sleeping",
              theme: "sleeping",
              deliveredAt: newest - 90_000,
            },
          ]
        : [];

      window.localStorage.setItem("active_cat_id", catId);
      window.localStorage.setItem("cat_profiles", JSON.stringify([{ id: catId, name: "むぎ" }]));
      window.localStorage.setItem("nyaruhodo_exchange_own_sleeping_photos", JSON.stringify(sent));
      window.localStorage.setItem("nyaruhodo_exchange_kept_photos", JSON.stringify(kept));
    },
    { count: sentCount, delivered: includeDelivered },
  );
}
