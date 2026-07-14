import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function mockBillingStatus(
  page: Page,
  overrides: Record<string, unknown>,
) {
  await page.route("**/api/billing/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        isLoggedIn: true,
        billingConfigured: true,
        isBetaSupporter: false,
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canManageBilling: false,
        ...overrides,
      }),
    });
  });
}

test.describe("account deletion UI", () => {
  test("keeps delete action disabled until the confirmation text matches", async ({
    page,
  }) => {
    await mockBillingStatus(page, {});

    await page.goto("/account-deletion");
    await expect(page.getByTestId("account-delete-request-block")).toBeVisible();

    const submit = page.getByTestId("account-delete-submit");
    await expect(submit).toBeDisabled();

    await page.getByTestId("account-delete-confirm-input").fill("退会");
    await expect(submit).toBeDisabled();

    await page.getByTestId("account-delete-confirm-input").fill("たいかい");
    await expect(submit).toBeEnabled();
  });

  test("hides payment management block for a signed-in user without a subscription", async ({
    page,
  }) => {
    await mockBillingStatus(page, {
      isLoggedIn: true,
      isBetaSupporter: false,
      status: "none",
      canManageBilling: false,
    });

    await page.goto("/account-deletion");

    await expect(page.getByTestId("account-delete-request-block")).toBeVisible();
    await expect(page.getByTestId("account-delete-payment-block")).toHaveCount(0);
  });

  test("shows payment management block for a signed-in user with an active subscription", async ({
    page,
  }) => {
    await mockBillingStatus(page, {
      isLoggedIn: true,
      isBetaSupporter: true,
      status: "active",
      canManageBilling: true,
    });

    await page.route("**/api/billing/create-portal-session", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ url: "https://billing.example.test/session" }),
      });
    });

    await page.goto("/account-deletion");

    const paymentBlock = page.getByTestId("account-delete-payment-block");
    await expect(paymentBlock).toBeVisible();
    await expect(paymentBlock.getByText("退会は不要です。")).toBeVisible();
    await expect(
      paymentBlock.getByRole("button", { name: "支払いの管理" }),
    ).toBeVisible();
  });

  test("offers a safe login recovery when the billing session expires", async ({
    page,
  }) => {
    await mockBillingStatus(page, {
      isLoggedIn: true,
      isBetaSupporter: true,
      status: "active",
      canManageBilling: true,
    });
    await page.route("**/api/billing/create-portal-session", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "login_required" }),
      });
    });

    await page.goto("/account-deletion");
    await page.getByRole("button", { name: "支払いの管理" }).click();

    await expect(page.getByTestId("auth-recovery-notice")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Googleでログインし直す" }),
    ).toHaveAttribute(
      "href",
      "/account/create?returnTo=%2Faccount-deletion",
    );
  });
});
