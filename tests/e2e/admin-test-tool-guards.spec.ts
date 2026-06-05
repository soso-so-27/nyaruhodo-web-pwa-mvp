import { expect, test } from "@playwright/test";

test.describe("admin test tool guards", () => {
  test("rejects stock candidate writes without admin access", async ({ request }) => {
    const response = await request.post("/api/sleeping-delivery/stock", {
      data: {
        src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lw9x5wAAAABJRU5ErkJggg==",
      },
    });

    expect(response.ok()).toBeFalsy();
    expect([403, 404, 503]).toContain(response.status());
  });

  test("hides settings test tools for non-admin users", async ({ page }) => {
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

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('a[href="/onboarding?test=1"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "とどくねがおを追加する" }),
    ).toHaveCount(0);
  });

  test("does not enable onboarding test mode for non-admin query access", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    let stockCalls = 0;

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
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: null,
          source: "none",
          diagnostics: {
            source: "none",
            availableCount: 0,
            candidateCount: 0,
            excludedCount: 0,
          },
        }),
      });
    });
    await page.route("**/api/sleeping-delivery/stock", async (route) => {
      stockCalls += 1;
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ photo: null, error: "admin_required" }),
      });
    });

    await page.goto("/onboarding?test=1");
    await page.waitForLoadState("networkidle");
    await page.locator("button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect.poll(() => exchangeCalls).toBe(1);
    await expect(
      page.getByRole("button", { name: "とどく候補を追加する" }),
    ).toHaveCount(0);
    expect(stockCalls).toBe(0);
  });

  test("shows settings test tools when admin capabilities are enabled", async ({
    page,
  }) => {
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

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('a[href="/onboarding?test=1"]')).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "とどくねがおを追加する" }),
    ).toBeVisible();
  });
});

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC",
  "base64",
);
