import { expect, test, type Page } from "@playwright/test";

test.describe("settings page organization", () => {
  test("keeps the photo storage note folded until requested", async ({ page }) => {
    await seedLoggedInSession(page);
    await mockSettingsApis(page, {
      referral: loggedInReferralSummary(),
    });

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

  test("keeps unavailable feedback hidden and destructive account actions last", async ({
    page,
  }) => {
    await mockSettingsApis(page);

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("改善メモを送る")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ログインして参加する" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "解約方法" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "データの削除・退会" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Googleでログイン" })).toBeVisible();
    await expect(
      page.getByText("写真と記録は、この端末に保存されています。", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("ログインして保存すると、別の端末でも戻せます。", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByText("写真が見えないとき", { exact: true })).toBeVisible();
    await expect(page.getByText("写真と記録の保存", { exact: true })).toHaveCount(0);
    await expect(page.getByText("困ったとき", { exact: true })).toBeVisible();
    await expect(page.getByText("古い画面が残るとき")).toBeHidden();
    await expect(page.getByText("ビルド", { exact: true })).toBeVisible();

    const accountLabel = page.getByText("アカウント", { exact: true });
    const accountDataLabel = page.getByText("アカウントとデータ", {
      exact: true,
    });
    expect(
      await accountLabel.evaluate((account, accountData) =>
        Boolean(account.compareDocumentPosition(accountData as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
        await accountDataLabel.elementHandle(),
      ),
    ).toBe(true);
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

  test("turns a partial storage check failure into an actionable retry state", async ({
    page,
  }) => {
    await seedLoggedInSession(page);
    await mockSettingsApis(page, {
      referral: loggedInReferralSummary(),
      restFailure: true,
    });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("一部の保存状態を確認できませんでした。", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "もう一度確認する" })).toBeVisible();
    await expect(page.getByText("保存状態を確認中です。")).toHaveCount(0);
  });

  test("recovers an expired feedback session without losing the draft", async ({
    page,
  }) => {
    await seedLoggedInSession(page);
    await mockSettingsApis(page, {
      referral: loggedInReferralSummary(),
      beta: {
        isLoggedIn: true,
        isBetaParticipant: true,
        feedbackEnabled: true,
        supporterVoiceEnabled: false,
        isBetaSupporter: false,
      },
    });
    await page.route("**/api/beta/feedback", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "login_required" }),
      });
    });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "改善メモを書く" }).click();
    await page.getByLabel("本文").fill("送信前の内容を残してほしいです");
    await page.getByRole("button", { name: "送る", exact: true }).click();

    await expect(page.getByTestId("auth-recovery-notice")).toBeVisible();
    await expect(page.getByLabel("本文")).toHaveValue(
      "送信前の内容を残してほしいです",
    );
    await expect(
      page.getByRole("link", { name: "Googleでログインし直す" }),
    ).toHaveAttribute("href", "/account/create?returnTo=%2Fsettings");
  });
});

async function mockSettingsApis(
  page: Page,
  {
    referral,
    beta,
    restFailure = false,
  }: {
    referral?: {
      isLoggedIn: boolean;
      referralEnabled: boolean;
      code: string | null;
      shareUrl: string | null;
      acceptedCount: number;
    };
    beta?: {
      isLoggedIn: boolean;
      isBetaParticipant: boolean;
      feedbackEnabled: boolean;
      supporterVoiceEnabled: boolean;
      isBetaSupporter: boolean;
    };
    restFailure?: boolean;
  } = {},
) {
  const isLoggedIn = Boolean(referral?.isLoggedIn || beta?.isLoggedIn);

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
        isLoggedIn,
        isBetaParticipant: false,
        feedbackEnabled: false,
        supporterVoiceEnabled: false,
        isBetaSupporter: false,
        ...beta,
      }),
    });
  });
  await page.route("**/api/billing/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        isLoggedIn,
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
    if (!isLoggedIn) {
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
    if (restFailure) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "storage check unavailable" }),
      });
      return;
    }

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

function loggedInReferralSummary() {
  return {
    isLoggedIn: true,
    referralEnabled: false,
    code: null,
    shareUrl: null,
    acceptedCount: 0,
  };
}
