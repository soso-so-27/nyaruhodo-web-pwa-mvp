import { expect, test } from "@playwright/test";

test("shows the launch dashboard in Japanese with actionable sections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/admin/capabilities", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        isAdmin: true,
        testToolsEnabled: false,
        stockAdminEnabled: false,
      }),
    });
  });
  await page.route("**/api/admin/analytics?period=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(mockAnalyticsResponse),
    });
  });

  await page.goto("/admin/analytics");

  await expect(
    page.getByRole("heading", { name: "初動アナリティクス" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "公開後" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "公開側" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "最初の一通まで" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今夜の一通" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "端末と入口" })).toBeVisible();
  await expect(
    page.getByLabel("どこから来たか").getByText("Instagram bio", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("どこから来たか")
      .getByText("流入元不明（srcなし）", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/数字は実人数ではなく/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "新しい未解決があります" }),
  ).toBeVisible();
  await expect(
    page.getByText("赤 直近30分の未解決、または60分で同じ失敗が2 ID以上"),
  ).toBeVisible();
  await expect(page.getByText("利用した人", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "写真をもう一度入れたか" })).toBeVisible();
  await expect(
    page
      .getByLabel("未解決の出来事")
      .getByText("写真の読み込み・保存失敗")
      .first(),
  ).toBeVisible();
  await expect(page.getByText("3イベントを1件に集約")).toBeVisible();
  const exportPayload = JSON.parse(
    (await page.locator("[data-codex-analytics-export]").textContent()) ?? "{}",
  );
  expect(exportPayload).toMatchObject({
    schemaVersion: 1,
    audience: "product",
    period: "launch",
    operationalStatus: { level: "action" },
  });
  expect(exportPayload.recentEvents).toBeUndefined();
  await expect(page.getByText(/繝|縺|蜿/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/admin-analytics-launch.png",
    fullPage: true,
  });
});

test("offers a one-time Google login on the desktop admin page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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

  let authorizeUrl = "";
  await page.route("**/auth/v1/authorize?**", async (route) => {
    authorizeUrl = route.request().url();
    await route.fulfill({ contentType: "text/plain", body: "oauth handoff" });
  });

  await page.goto("/admin/analytics");

  const loginButton = page.getByRole("button", { name: "管理者でログイン" });
  await expect(loginButton).toBeVisible();
  await loginButton.click();
  await expect.poll(() => authorizeUrl).not.toBe("");

  const parsedAuthorizeUrl = new URL(authorizeUrl);
  expect(parsedAuthorizeUrl.searchParams.get("provider")).toBe("google");
  expect(parsedAuthorizeUrl.searchParams.get("prompt")).toBe("select_account");
  const redirectTo = new URL(
    parsedAuthorizeUrl.searchParams.get("redirect_to") ?? "",
  );
  expect(redirectTo.pathname).toBe("/auth/callback");
  expect(redirectTo.searchParams.get("next")).toBe("/admin/analytics");
});

test("returns a cancelled desktop admin login to the admin login action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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

  await page.goto("/auth/callback?next=/admin/analytics");

  await expect(page).toHaveURL(/\/admin\/analytics\?error=auth$/);
  await expect(
    page.getByRole("button", { name: "管理者でログイン" }),
  ).toBeVisible();
});

const metric = (key: string, label: string, users: number, events = users) => ({
  key,
  label,
  users,
  events,
});

const mockAnalyticsResponse = {
  period: "launch",
  audience: "product",
  generatedAt: "2026-07-17T13:30:00.000Z",
  range: {
    from: "2026-07-17T08:00:00.000Z",
    to: "2026-07-17T13:30:00.000Z",
  },
  totalEvents: 48,
  eventLimitReached: false,
  overview: [
    metric("intro", "オンボを見た", 10),
    metric("first_photo", "最初の写真を保存した", 8),
    metric("instant_arrival", "最初のねこだよりが届いた", 8),
    metric("instant_open", "最初のねこだよりを開いた", 7),
    metric("second_photo", "今夜の一枚を保存した", 5),
    metric("needs_attention", "要確認の識別ID", 1),
  ],
  funnel: [
    {
      ...metric("intro", "オンボを見た", 10),
      previousUsers: null,
      fromPreviousRate: null,
      fromStartRate: 100,
    },
    {
      ...metric("photo_picker", "写真をえらび始めた", 9),
      previousUsers: 10,
      fromPreviousRate: 90,
      fromStartRate: 90,
    },
  ],
  sourceBreakdown: [
    {
      source: "instagram_bio",
      introUsers: 10,
      submittedUsers: 8,
      openedUsers: 7,
      secondPhotoUsers: 5,
    },
    {
      source: "direct",
      introUsers: 2,
      submittedUsers: 1,
      openedUsers: 1,
      secondPhotoUsers: 0,
    },
  ],
  deliveryHealth: [
    metric("evening_reserved", "20時便に写真を入れた", 5),
    metric("evening_check_started", "20時便の確認を開始", 0, 0),
    metric("evening_check_succeeded", "20時便が成立", 0, 0),
    metric("evening_check_failed", "20時便の確認失敗", 0, 0),
  ],
  installHealth: [
    metric("install_invitation", "アプリ追加案内を表示", 5),
    metric("install_action", "追加手順へ進んだ", 2),
    metric("install_completed", "ブラウザが追加完了を通知", 1),
    metric("standalone_open", "PWAとして起動", 1),
  ],
  environment: {
    devices: [
      { key: "ios", users: 6 },
      { key: "android", users: 4 },
    ],
    contexts: [
      { key: "instagram", users: 7 },
      { key: "browser", users: 3 },
    ],
  },
  retention: {
    photoSubmitters: 8,
    repeatSubmitters: 5,
    returningDaySubmitters: 2,
    d1ReturnSubmitters: 0,
  },
  operationalStatus: {
    level: "action",
    unresolvedIncidents: 1,
    affectedActors: 1,
    freshIncidents: 1,
    spreadIssueCount: 0,
    latestAt: "2026-07-17T13:20:00.000Z",
  },
  errorSummary: [
    {
      eventName: "photo_upload_error",
      errorCode: "onboarding_photo_save_failed",
      incidents: 1,
      events: 3,
      users: 1,
      latestAt: "2026-07-17T13:20:00.000Z",
    },
  ],
  issueSummary: {
    recovered: [],
    expected: [],
  },
  diagnosticEventsExcluded: true,
  audienceCounts: {
    productEvents: 48,
    internalEvents: 12,
    internalActors: 1,
  },
  recentErrors: [
    {
      createdAt: "2026-07-17T13:20:00.000Z",
      eventName: "photo_upload_error",
      source: "instagram_bio",
      route: "/onboarding",
      surface: "onboarding",
      errorCode: "onboarding_photo_save_failed",
      errorMessage: "decode failed",
      anonymousId: "actor...0001",
      userId: null,
      submissionId: null,
      incidentEvents: 3,
      incidentFirstAt: "2026-07-17T13:19:58.000Z",
    },
  ],
  recentEvents: [],
};
