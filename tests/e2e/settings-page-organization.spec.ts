import { expect, test, type Page } from "@playwright/test";

test.describe("settings page organization", () => {
  test("keeps the photo storage note folded until requested", async ({ page }) => {
    await mockSettingsApis(page);

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const summary = page.getByText("写真が見えないとき", { exact: true });
    const hiddenNote = page
      .locator("details")
      .filter({ has: summary })
      .locator("p");
    await expect(summary).toBeVisible();
    await expect(hiddenNote).toBeHidden();

    await summary.click();

    await expect(hiddenNote).toBeVisible();
  });

  test("hides the referral code while keeping share actions", async ({ page }) => {
    await seedLoggedInSession(page);
    await mockSettingsApis(page, {
      referral: {
        isLoggedIn: true,
        referralEnabled: true,
        code: "2YYMRWG2",
        shareUrl: "https://nyaruhodo.jp/onboarding?ref=2YYMRWG2",
        acceptedCount: 0,
      },
    });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("ねてるねこを 紹介する")).toBeVisible();
    await expect(page.getByText("紹介コード")).toHaveCount(0);
    await expect(page.getByText("2YYMRWG2")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "共有する" })).toBeVisible();
    await expect(page.getByRole("button", { name: "リンクをコピー" })).toBeVisible();
  });

  test("maps the legacy omoide disabled value to the receive switch", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "neteruneko_omoide_memory_controls",
        JSON.stringify({ disabled: true }),
      );
    });
    await mockSettingsApis(page);

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const switchControl = page.getByRole("switch", {
      name: /思い出便を 受け取る/,
    });
    await expect(switchControl).toHaveAttribute("aria-checked", "false");

    await switchControl.click();

    await expect(switchControl).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem(
            "neteruneko_omoide_memory_controls",
          );
          return raw ? JSON.parse(raw) : null;
        }),
      )
      .toEqual({
        disabled: false,
        hiddenDateKeys: [],
        usedSourcePhotoIds: [],
      });
  });
});

async function mockSettingsApis(
  page: Page,
  {
    referral,
  }: {
    referral?: {
      isLoggedIn: boolean;
      referralEnabled: boolean;
      code: string | null;
      shareUrl: string | null;
      acceptedCount: number;
    };
  } = {},
) {
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
        isLoggedIn: Boolean(referral?.isLoggedIn),
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
        isLoggedIn: Boolean(referral?.isLoggedIn),
        billingConfigured: false,
        isBetaSupporter: false,
        status: "none",
        canManageBilling: false,
      }),
    });
  });
  await page.route("**/api/referrals/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        referral ?? {
          isLoggedIn: false,
          referralEnabled: false,
          code: null,
          shareUrl: null,
          acceptedCount: 0,
        },
      ),
    });
  });
  await page.route("**/api/referrals/claim", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ claimed: false, status: "missing_code" }),
    });
  });
  await page.route("**/auth/v1/user", async (route) => {
    if (!referral?.isLoggedIn) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "not logged in" }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "settings-user",
        aud: "authenticated",
        role: "authenticated",
        email: "settings@example.com",
      }),
    });
  });
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-range": "0-0/0",
      },
      body: route.request().method() === "HEAD" ? "" : "[]",
    });
  });
}

async function seedLoggedInSession(page: Page) {
  await page.addInitScript(() => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    window.localStorage.setItem(
      "nyaruhodo_supabase_auth",
      JSON.stringify({
        access_token: "settings-test-token",
        refresh_token: "settings-test-refresh-token",
        expires_at: expiresAt,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "settings-user",
          aud: "authenticated",
          role: "authenticated",
          email: "settings@example.com",
        },
      }),
    );
  });
}
