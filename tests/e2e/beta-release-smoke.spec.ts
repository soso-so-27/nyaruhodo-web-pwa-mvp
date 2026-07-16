import { expect, test } from "@playwright/test";

const mainRoutes = [
  "/home",
  "/collection",
  "/cats",
  "/settings",
  "/how-to-use",
  "/beta-supporter",
];

const legalRoutes = [
  "/terms",
  "/privacy",
  "/contact",
  "/account-deletion",
  "/cancellation",
  "/commercial-transactions",
];

test.describe("beta release smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/admin/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isAdmin: false,
          testToolsEnabled: false,
          stockAdminEnabled: false,
        }),
      });
    });
    await page.route("**/api/beta/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: false,
          isBetaParticipant: false,
          feedbackEnabled: false,
          supporterVoiceEnabled: false,
          isBetaSupporter: false,
        }),
      });
    });
    await page.route("**/api/billing/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: false,
          billingConfigured: false,
          isBetaSupporter: false,
          status: "none",
          canManageBilling: false,
        }),
      });
    });
  });

  for (const route of mainRoutes) {
    test(`${route} loads without a fatal app error`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.ok()).toBe(true);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Application error");
      await expect(page.locator("body")).not.toContainText("This page could not be found");
    });
  }

  test("legal/support pages are reachable before sharing the beta link", async ({
    page,
  }) => {
    for (const route of legalRoutes) {
      const response = await page.goto(route);

      expect(response?.ok()).toBe(true);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Application error");
      await expect(page.locator("body")).not.toContainText(
        "This page could not be found",
      );
    }
  });

  test("how-to-use explains delivery and private choices", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        get: () =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      });
    });
    await page.goto("/how-to-use");

    await expect(
      page.getByText(/「届ける」でねがおをのこした日/),
    ).toBeVisible();
    await expect(
      page.getByText(/「自分だけ」でのこした写真/),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "ホーム画面に置く" })).toBeVisible();
    await expect(page.getByText(/LINEやInstagramの中では追加できません/)).toBeVisible();
    await expect(page.getByText("きょうの2まい")).toHaveCount(0);
  });

  test("PWA manifest and install icons are reachable", async ({ request }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");

    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.start_url).toBe("/home");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src);

      expect(iconResponse.ok()).toBe(true);
      expect(iconResponse.headers()["content-type"]).toContain("image/png");
    }
  });

  test("PWA service worker and offline fallback are reachable", async ({
    request,
  }) => {
    const serviceWorkerResponse = await request.get("/sw.js");
    expect(serviceWorkerResponse.ok()).toBe(true);
    expect(serviceWorkerResponse.headers()["content-type"]).toContain(
      "javascript",
    );

    const offlineResponse = await request.get("/offline");
    expect(offlineResponse.ok()).toBe(true);
    const offlineHtml = await offlineResponse.text();
    expect(offlineHtml).toContain("いまは通信できません");
    expect(offlineHtml).toContain("もう一度読み込む");
  });

  test("baseline security headers are present", async ({ request }) => {
    const response = await request.get("/home");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["permissions-policy"]).toContain("camera=(self)");
    expect(headers["content-security-policy-report-only"]).toContain(
      "default-src 'self'",
    );
  });

  test("onboarding exposes a complete social preview", async ({
    page,
    request,
  }) => {
    await page.goto("/onboarding?src=instagram_bio");

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "ねてるねこ | 猫の寝顔が、よる8時にとどく",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/images\/social\/onboarding-og\.webp$/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://nyaruhodo.jp/onboarding",
    );

    const imageResponse = await request.get(
      "/images/social/onboarding-og.webp",
    );
    expect(imageResponse.ok()).toBe(true);
    expect(imageResponse.headers()["content-type"]).toContain("image/webp");
  });

  test("regular navigation does not preload the PWA startup artwork", async ({
    page,
  }) => {
    await page.goto("/home");

    await expect(
      page.locator('link[rel="apple-touch-startup-image"]'),
    ).not.toHaveCount(0);
    await expect(
      page.locator(
        'link[rel="preload"][href*="/splash/startup-envelope-"]',
      ),
    ).toHaveCount(0);
  });
});
