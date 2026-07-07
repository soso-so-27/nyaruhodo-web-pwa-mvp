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
});
