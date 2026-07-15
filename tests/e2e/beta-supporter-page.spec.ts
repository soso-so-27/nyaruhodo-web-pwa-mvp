import { expect, test, type Page } from "@playwright/test";

test.describe("β supporter page", () => {
  test("shows a truthful loading state before billing status resolves", async ({
    page,
  }) => {
    await mockSupporterApis(page, { delayMs: 500 });

    await page.goto("/beta-supporter", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("サポーター状態を確認中です。")).toBeVisible();
    await expect(page.getByText("現在、支払い導線は準備中です。")).toHaveCount(0);
  });

  test("gives logged-out readers a login action after the supporter story", async ({
    page,
  }) => {
    await mockSupporterApis(page);

    await page.goto("/beta-supporter");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "ねてるねこを、一緒に育てる。" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "このページの内容" })).toBeVisible();
    for (const link of await page
      .getByRole("navigation", { name: "このページの内容" })
      .getByRole("link")
      .all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText("月額 1,500円（税別）")).toBeVisible();
    await expect(page.getByText(/1,650円/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Googleでログイン" })).toBeVisible();
    await expect(page.getByText("毎月自動で更新され、いつでも解約できます。")).toBeVisible();
    await expect(
      page.getByText("保存した写真や、とどいたねこだよりは失われません。", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("shows the end date for a supporter scheduled to cancel", async ({
    page,
  }) => {
    await mockSupporterApis(page, {
      billing: {
        isLoggedIn: true,
        billingConfigured: true,
        isBetaSupporter: true,
        status: "active",
        currentPeriodEnd: "2026-08-12T15:00:00.000Z",
        cancelAtPeriodEnd: true,
        canManageBilling: true,
      },
      beta: {
        isLoggedIn: true,
        isBetaParticipant: true,
        feedbackEnabled: true,
        supporterVoiceEnabled: true,
        isBetaSupporter: true,
      },
    });

    await page.goto("/beta-supporter");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("解約予定です。", { exact: false })).toBeVisible();
    await expect(page.getByText("2026年8月13日まで", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "支払いを管理" })).toBeEnabled();
  });

  test("returns an expired checkout session to the supporter page after login", async ({
    page,
  }) => {
    await mockSupporterApis(page, {
      billing: {
        isLoggedIn: true,
        billingConfigured: true,
        isBetaSupporter: false,
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canManageBilling: false,
      },
      beta: {
        isLoggedIn: true,
        isBetaParticipant: true,
        feedbackEnabled: true,
        supporterVoiceEnabled: false,
        isBetaSupporter: false,
      },
    });
    await page.route("**/api/billing/create-checkout-session", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "login_required" }),
      });
    });

    await page.goto("/beta-supporter");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "応援する" }).click();

    await expect(page.getByTestId("auth-recovery-notice")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Googleでログインし直す" }),
    ).toHaveAttribute(
      "href",
      "/account/create?returnTo=%2Fbeta-supporter",
    );
    await expect(
      page.getByText("保存済みの写真と記録は、そのまま残ります。"),
    ).toBeVisible();
  });
});

async function mockSupporterApis(
  page: Page,
  options: {
    delayMs?: number;
    billing?: Record<string, unknown>;
    beta?: Record<string, unknown>;
  } = {},
) {
  await page.route("**/api/billing/status", async (route) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        options.billing ?? {
          isLoggedIn: false,
          billingConfigured: true,
          isBetaSupporter: false,
          status: "none",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canManageBilling: false,
        },
      ),
    });
  });
  await page.route("**/api/beta/capabilities", async (route) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        options.beta ?? {
          isLoggedIn: false,
          isBetaParticipant: false,
          feedbackEnabled: false,
          supporterVoiceEnabled: false,
          isBetaSupporter: false,
        },
      ),
    });
  });
}
