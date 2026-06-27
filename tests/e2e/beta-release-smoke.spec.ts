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
});
