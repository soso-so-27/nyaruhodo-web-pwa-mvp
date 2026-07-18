import { expect, test } from "@playwright/test";

test.describe("service site", () => {
  test("explains the experience and opens onboarding on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/about?src=threads");

    await expect(page.getByRole("heading", { name: "ねてるねこ", level: 1 })).toBeVisible();
    await expect(page.getByText("一日は、こんなふうに。" )).toBeVisible();
    await expect(page.getByText("くらべない。いそがない。さわがない。" )).toBeVisible();

    const cta = page.getByRole("link", { name: "最初の一通を受け取る" });
    await expect(cta).toHaveAttribute("href", "/onboarding?src=threads");
  });

  test("remains readable on desktop instead of showing the app device gate", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/about");

    await expect(page.getByRole("heading", { name: "ねてるねこ", level: 1 })).toBeVisible();
    await expect(page.getByText("スマホで使うアプリです。" )).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ねてるねこをはじめる" })).toBeVisible();

    await page.getByRole("link", { name: "利用規約" }).click();
    await expect(page.getByRole("heading", { name: "利用規約", level: 1 })).toBeVisible();
    await expect(page.getByText("スマホで使うアプリです。" )).toHaveCount(0);
  });
});
