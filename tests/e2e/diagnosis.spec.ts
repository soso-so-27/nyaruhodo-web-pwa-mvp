import { expect, test } from "@playwright/test";

const mainCtaLabels = [
  "3分だけ遊んでみる",
  "ごはんを確認してみる",
  "声をかけてみる",
  "静かな場所をつくる",
  "体調を見てあげる",
  "少し様子を見る",
];

test.beforeEach(async ({ page }) => {
  await page.goto("/home");
  await page.evaluate(() => {
    window.localStorage.removeItem("latest_hypothesis");
    window.localStorage.removeItem("current_cat_hint_suppression");
  });
});

test("diagnosis page uses user-facing labels and avoids stale night copy", async ({
  page,
}) => {
  await page.goto("/diagnose?input=meowing");

  await expect(
    page.getByRole("heading", { name: "さっきの様子から" }),
  ).toBeVisible();
  await expect(page.getByText("今の仮説")).toHaveCount(0);
  await expect(page.getByText("夜なので")).toHaveCount(0);
  await expect(page.getByText("いま見えること")).toBeVisible();
  await expect(page.getByText("そう考えた理由")).toBeVisible();
});

test("main diagnosis CTA shows the next action card", async ({ page }) => {
  await openSavedMeowingDiagnosis(page);
  await clickVisibleMainCta(page);

  await expect(page.getByText("まずは試してみてください")).toBeVisible();
  await expect(page.getByRole("button", { name: "ホームで様子を見る" })).toBeVisible();
});

test("negative diagnosis CTA shows the retry guidance card", async ({ page }) => {
  await openSavedMeowingDiagnosis(page);

  await page.getByRole("button", { name: "違うかも" }).click();

  await expect(
    page.getByText("違ったことも記録しました", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({ hasText: "違ったことも記録しました" })
      .getByRole("button", { name: "ホームに戻る" }),
  ).toBeVisible();
});

async function openSavedMeowingDiagnosis(page: import("@playwright/test").Page) {
  await page.goto("/home");
  await page.getByRole("button", { name: "鳴いてる" }).click();
  await page.waitForURL(/\/diagnose\?/);
  await expect(
    page.getByRole("heading", { name: "さっきの様子から" }),
  ).toBeVisible();
}

async function clickVisibleMainCta(page: import("@playwright/test").Page) {
  for (const label of mainCtaLabels) {
    const button = page.getByRole("button", { name: label });

    if ((await button.count()) === 1 && (await button.isVisible())) {
      await button.click();
      return;
    }
  }

  throw new Error("No diagnosis main CTA was visible.");
}
