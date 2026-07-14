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

  test("rejects beta feedback without login", async ({ request }) => {
    const response = await request.post("/api/beta/feedback", {
      data: {
        category: "bug",
        message: "settings feedback guard smoke test",
        kind: "beta_feedback",
      },
    });

    expect(response.ok()).toBeFalsy();
    expect([401, 403]).toContain(response.status());
  });

  test("rejects billing session creation without login", async ({ request }) => {
    const checkout = await request.post("/api/billing/create-checkout-session");
    const portal = await request.post("/api/billing/create-portal-session");

    expect(checkout.ok()).toBeFalsy();
    expect(portal.ok()).toBeFalsy();
    expect(checkout.status()).toBe(401);
    expect(portal.status()).toBe(401);
  });

  test("rejects stripe webhooks without a valid signature", async ({ request }) => {
    const response = await request.post("/api/stripe/webhook", {
      data: {
        id: "evt_e2e_fake",
        type: "checkout.session.completed",
        data: { object: {} },
      },
    });

    expect(response.ok()).toBeFalsy();
    expect([400, 503]).toContain(response.status());
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
    await page.route("**/api/beta/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: false,
          isBetaParticipant: false,
          feedbackEnabled: false,
          supporterVoiceEnabled: false,
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

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('a[href="/onboarding?test=1"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "とどくねがおを追加する" }),
    ).toHaveCount(0);
    await expect(page.getByText("データの削除・退会")).toBeVisible();
    await expect(page.getByText("通知", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Push通知はホーム画面アプリで使えます"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "この端末をアカウントに保存" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "アカウントからこの端末に復元" }),
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
    await page.route("**/api/beta/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: false,
          isBetaParticipant: false,
          feedbackEnabled: false,
          supporterVoiceEnabled: false,
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

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "管理" }).click();

    await expect(page.locator('a[href="/onboarding?test=1"]')).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "とどくねがおを追加する" }),
    ).toBeVisible();
  });

  test("shows beta feedback entry for beta participants", async ({ page }) => {
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

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "改善メモを書く" }),
    ).toBeVisible();
    await expect(page.getByText("βサポーター", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "βサポーターについて" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "βサポーターになる" }),
    ).toBeHidden();
  });

  test("shows supporter voice for active beta supporters", async ({ page }) => {
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
          isLoggedIn: true,
          isBetaParticipant: true,
          feedbackEnabled: true,
          supporterVoiceEnabled: true,
          isBetaSupporter: true,
        }),
      });
    });
    await page.route("**/api/billing/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isLoggedIn: true,
          billingConfigured: true,
          isBetaSupporter: true,
          status: "active",
          canManageBilling: true,
        }),
      });
    });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("βサポーターです")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "応援内容を確認する" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "支払いを管理" })).toBeHidden();

    await page.getByRole("link", { name: "応援内容を確認する" }).click();
    await page.waitForURL("**/beta-supporter");
    await expect(page.getByText("βサポーターについて").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "支払いを管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "応援しても、しなくても" }))
      .toBeVisible();
  });

  test("shows supporter checkout entry for beta participants who are not supporters yet", async ({
    page,
  }) => {
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
          billingConfigured: true,
          isBetaSupporter: false,
          status: "none",
          canManageBilling: false,
        }),
      });
    });

    await page.goto("/beta-supporter");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("βサポーターについて").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "応援する" })).toBeVisible();
    await expect(page.getByRole("button", { name: "支払いを管理" })).toBeHidden();
  });
});

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC",
  "base64",
);
