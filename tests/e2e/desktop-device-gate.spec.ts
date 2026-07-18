import { devices, expect, test } from "@playwright/test";

test.describe("user device gate", () => {
  test("shows a phone guide on desktop user pages", async ({ page }) => {
    await page.goto("/onboarding?source=instagram_story");

    await expect(page.getByText("スマホで使うアプリ")).toBeVisible();
    await expect(page.getByRole("button", { name: "URLをコピー" })).toBeVisible();
  });

  test("does not block admin pages on desktop", async ({ page }) => {
    await page.goto("/admin/analytics");

    await expect(page.getByText("スマホで使うアプリ")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "初動アナリティクス" }),
    ).toBeVisible();
  });
});

test.describe("mobile user pages", () => {
  test.use({
    viewport: devices["iPhone 12 Pro"].viewport,
    userAgent: devices["iPhone 12 Pro"].userAgent,
    deviceScaleFactor: devices["iPhone 12 Pro"].deviceScaleFactor,
    isMobile: devices["iPhone 12 Pro"].isMobile,
    hasTouch: devices["iPhone 12 Pro"].hasTouch,
  });

  test("shows onboarding normally on mobile", async ({ page }) => {
    await page.goto("/onboarding?source=instagram_story");

    await expect(page.getByText("スマホで使うアプリ")).not.toBeVisible();
    await expect(page.locator(".deviceGateMobileApp main").first()).toBeVisible();
  });
});

test.describe("desktop OAuth callback", () => {
  test.use({ javaScriptEnabled: false });

  test("does not hide the existing auth callback behind the phone guide", async ({
    page,
  }) => {
    await page.goto("/auth/callback?next=/admin/analytics");

    await expect(page.getByText("スマホで使うアプリ")).toHaveCount(0);
  });
});
