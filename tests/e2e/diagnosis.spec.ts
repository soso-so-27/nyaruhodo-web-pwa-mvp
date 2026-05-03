import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test.setTimeout(120_000);
test.describe.configure({ mode: "serial" });

let savedDiagnosisUrl: string | null = null;
const e2eLocalCatId = "local-cat-e2e";

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
  await expect(page.getByText("まずはここから")).toBeVisible();
  await expect(page.getByText("手がかり")).toBeVisible();
});

test("home app shell keeps cat management out of the top and scrolls by bottom nav", async ({
  page,
}) => {
  await page.goto("/home");

  await expect(page.getByRole("heading", { name: /今日の/ })).toBeVisible();
  const header = page.locator("header").first();
  await expect(header.getByRole("button", { name: "猫を追加" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "名前を変更" })).toHaveCount(0);

  const bottomNav = page.getByRole("navigation", { name: "ホーム内ナビ" });
  await bottomNav.getByRole("link", { name: "きろく" }).click();
  await expect(page.getByRole("heading", { name: /いまどうしてる/ })).toBeInViewport();

  await bottomNav.getByRole("link", { name: "ねこ" }).click();
  await expect(page.getByRole("heading", { name: "ねこの設定" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "猫を追加" })).toBeVisible();
  await expect(page.getByRole("button", { name: "名前を変更" })).toBeVisible();
});

test("main diagnosis CTA shows the next action card", async ({ page }) => {
  await openSavedMeowingDiagnosis(page);
  await page.waitForLoadState("networkidle");
  savedDiagnosisUrl = page.url();
  await clickVisibleMainCta(page);

  await expect(page.getByText("まずは試してみてください")).toBeVisible();
  await expect(page.getByRole("button", { name: "ホームで様子を見る" })).toBeVisible();
});

test("negative diagnosis CTA shows the retry guidance card", async ({ page }) => {
  if (savedDiagnosisUrl) {
    await page.goto(savedDiagnosisUrl);
    await expect(
      page.getByRole("heading", { name: "さっきの様子から" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
  } else {
    await openSavedMeowingDiagnosis(page);
  }

  const negativeButton = page.getByRole("button", { name: "違うかも" });
  await expect(negativeButton).toBeEnabled();
  await negativeButton.click();

  await expect(
    page.getByText("違ったことも記録しました", { exact: true }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(
    page
      .locator("section")
      .filter({ hasText: "違ったことも記録しました" })
      .getByRole("button", { name: "ホームに戻る" }),
  ).toBeVisible();
});

async function openSavedMeowingDiagnosis(page: import("@playwright/test").Page) {
  await page.goto("/home");
  await page.evaluate(() => {
    window.localStorage.removeItem("latest_hypothesis");
    window.localStorage.removeItem("current_cat_hint_suppression");
  });
  await page.getByRole("heading", { name: "ちょっと気になる？" }).scrollIntoViewIfNeeded();

  const meowingButton = page.getByRole("button", { name: "鳴いてる" });
  await expect(meowingButton).toBeVisible();
  await meowingButton.click();

  try {
    await page.waitForURL(/\/diagnose\?/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "さっきの様子から" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    return;
  } catch {
    const eventId = await createE2eMeowingEvent();
    await page.goto(
      `/diagnose?input=meowing&event_id=${eventId}&local_cat_id=${e2eLocalCatId}`,
    );
    await expect(
      page.getByRole("heading", { name: "さっきの様子から" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
}

async function createE2eMeowingEvent() {
  loadPublicEnvForE2e("NEXT_PUBLIC_SUPABASE_URL");
  loadPublicEnvForE2e("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase public env values for E2E setup.");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const id = crypto.randomUUID();
  const { error } = await supabase.from("events").insert({
    id,
    event_type: "concern",
    signal: "meowing",
    label: "鳴いてる",
    source: "home",
    local_cat_id: e2eLocalCatId,
    context: {},
  });

  if (error) {
    throw new Error("Failed to create E2E event.");
  }

  return id;
}

function loadPublicEnvForE2e(key: string) {
  if (process.env[key]) {
    return;
  }

  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const match = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`));

  if (!match) {
    return;
  }

  process.env[key] = match
    .slice(key.length + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
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
